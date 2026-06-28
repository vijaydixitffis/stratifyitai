import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AP_BASE      = Deno.env.get("ASSESSPRO_API_BASE_URL")!;
const AP_WRITE_KEY = Deno.env.get("ASSESSPRO_API_WRITE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

const apPost = (path: string, body: unknown) =>
  fetch(`${AP_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AP_WRITE_KEY}`,
    },
    body: JSON.stringify(body),
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    return await handleRequest(req);
  } catch (err) {
    console.error("[proxy-assesspro] Unhandled exception:", err);
    return json({ success: false, error: { code: "INTERNAL_ERROR", message: String(err) } }, 500);
  }
});

async function handleRequest(req: Request): Promise<Response> {
  // Validate env vars required for AssessPro integration
  if (!Deno.env.get("ASSESSPRO_API_BASE_URL")) {
    console.error("[proxy-assesspro] ASSESSPRO_API_BASE_URL secret is not set");
    return json({ success: false, error: { code: "CONFIG_ERROR", message: "AssessPro integration not configured" } }, 503);
  }

  // Validate caller is an authenticated StratifyIT user
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("org_code, org_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return json({ success: false, error: { code: "PROFILE_NOT_FOUND", message: "User profile not found" } }, 403);
  }

  const body = await req.json();
  const { action, payload } = body;

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Admins and client-architects can manage assessments and assignments
  const canManageAssessments =
    profile.role.startsWith("admin") || profile.role === "client-architect";

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION: create_assignment
  // Assigns an existing assessment to one or more org users.
  // ─────────────────────────────────────────────────────────────────────────
  if (action === "create_assignment") {
    if (!canManageAssessments) {
      return json({ success: false, error: { code: "FORBIDDEN", message: "Architect or Admin role required" } }, 403);
    }

    const users = payload.users as Array<{ id: string; email: string; name: string }>;
    if (!users?.length) {
      return json({ success: false, error: { code: "BAD_REQUEST", message: "users[] is required" } }, 400);
    }

    const results: unknown[] = [];
    const errors: unknown[] = [];

    for (const u of users) {
      const nameParts = (u.name ?? "").trim().split(/\s+/);
      const firstName = nameParts[0] || u.email.split("@")[0];
      const lastName  = nameParts.slice(1).join(" ") || "-";

      let apRes: Response;
      try {
        apRes = await apPost("/api-assignments", {
          assessment_id:     payload.assessment_id,
          client_email:      u.email,
          client_first_name: firstName,
          client_last_name:  lastName,
          scope:             payload.org_code,
          due_date:          payload.due_date ?? undefined,
        });
      } catch (fetchErr) {
        console.error(`[proxy-assesspro] create_assignment fetch failed for ${u.email}:`, fetchErr);
        errors.push({ userId: u.id, email: u.email, error: { message: String(fetchErr) } });
        continue;
      }

      const apData = await apRes.json();

      // UUID check: assigned_to_user_id must be a UUID FK, not an email string
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u.id);

      if (apRes.ok && apData.success) {
        const a = apData.data;
        await supabaseAdmin.from("assessment_assignments_cache").insert({
          assesspro_assign_id: a.assignment_id ?? a.id,
          org_id:              payload.org_id,
          org_code:            payload.org_code,
          assesspro_assess_id: payload.assessment_id,
          pa_assessment_id:    payload.pa_assessment_id ?? null,
          assessment_title:    payload.assessment_title,
          assigned_to_email:   u.email,
          ...(isUuid ? { assigned_to_user_id: u.id } : {}),
          assigned_by_user_id: user.id,
          status:              "ASSIGNED",
          due_date:            payload.due_date ?? null,
        });
        results.push({ userId: u.id, email: u.email, assignment: a });
      } else {
        errors.push({ userId: u.id, email: u.email, error: apData.error });
      }
    }

    return json({
      success: results.length > 0,
      data: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION: create_assessment
  // Creates a new assessment with topics and questions in AssessPro,
  // then optionally assigns it to the org user specified in payload.
  // Used by ai-asset-review to create per-asset questionnaires.
  // ─────────────────────────────────────────────────────────────────────────
  if (action === "create_assessment") {
    if (!canManageAssessments) {
      return json({ success: false, error: { code: "FORBIDDEN", message: "Architect or Admin role required" } }, 403);
    }

    // payload shape:
    // {
    //   org_id, org_code, asset_id,
    //   title, description,
    //   topics: [{ title, questions: [{ question, type, options?: string[], marks?: number }] }]
    //   assign_to_users?: [{ id, email, name }]
    //   due_date?: string
    // }
    const { org_id, org_code, asset_id, title, description, topics, assign_to_users, due_date } = payload as {
      org_id: number;
      org_code: string;
      asset_id: string;
      title: string;
      description?: string;
      topics: Array<{
        title: string;
        questions: Array<{ question: string; type: string; options?: string[]; marks?: number }>;
      }>;
      assign_to_users?: Array<{ id: string; email: string; name: string }>;
      due_date?: string;
    };

    if (!title || !topics?.length) {
      return json({ success: false, error: { code: "BAD_REQUEST", message: "title and topics[] are required" } }, 400);
    }

    // Try to create the assessment in AssessPro. If the service is unreachable,
    // fall back to local-only mode: store everything in Supabase and mark as assigned.
    let assessmentId: string | number = `local-${Date.now()}`;
    let assessmentTitle = title;
    let assessproMode: "live" | "local" = "local";

    try {
      const createRes = await apPost("/api-assessments", {
        title,
        description: description ?? `AI-generated architectural assessment for ${asset_id}`,
        org_code,
        topics: topics.map(t => ({
          title: t.title,
          questions: t.questions.map((q, idx) => ({
            question:         q.question,
            type:             q.type,
            sequence_number:  idx + 1,
            answers: q.type === "yes_no"
              ? [
                  { text: "Yes",           marks: q.marks ?? 3 },
                  { text: "No",            marks: 0 },
                  { text: "Partially/N/A", marks: 1 },
                ]
              : (q.options ?? []).map((opt, i) => ({
                  text:  opt,
                  marks: i === 0 ? (q.marks ?? 3) : Math.max(0, (q.marks ?? 3) - i),
                })),
          })),
        })),
      });

      const createData = await createRes.json();
      if (createRes.ok && createData.success) {
        assessmentId    = createData.data?.assessment_id ?? createData.data?.id ?? assessmentId;
        assessmentTitle = createData.data?.title ?? title;
        assessproMode   = "live";
        console.log(`[proxy-assesspro] AssessPro assessment created: id=${assessmentId}`);
      } else {
        console.warn(`[proxy-assesspro] AssessPro rejected create_assessment (${createRes.status}): falling back to local mode`);
      }
    } catch (fetchErr) {
      console.warn(`[proxy-assesspro] AssessPro unreachable: ${fetchErr} — falling back to local mode`);
    }

    // Update asset review with assessment reference
    if (asset_id) {
      await supabaseAdmin.from("it_asset_reviews").update({
        assesspro_assessment_id: String(assessmentId),
        review_status:           "questionnaire_pending",
        updated_at:              new Date().toISOString(),
      }).eq("asset_id", asset_id).eq("org_id", org_id);
    }

    // Assign to users — live via AssessPro if available, otherwise local-only
    const assignResults: unknown[] = [];
    if (assign_to_users?.length) {
      for (const u of assign_to_users) {
        const nameParts = (u.name ?? "").trim().split(/\s+/);
        const firstName = nameParts[0] || u.email.split("@")[0];
        const lastName  = nameParts.slice(1).join(" ") || "-";

        let assignmentId: string | number = `local-assign-${Date.now()}`;

        if (assessproMode === "live") {
          try {
            const assignRes = await apPost("/api-assignments", {
              assessment_id:     assessmentId,
              client_email:      u.email,
              client_first_name: firstName,
              client_last_name:  lastName,
              scope:             org_code,
              due_date:          due_date ?? undefined,
            });
            const assignData = await assignRes.json();
            if (assignRes.ok && assignData.success) {
              const a = assignData.data;
              assignmentId = a.assignment_id ?? a.id ?? assignmentId;
              console.log(`[proxy-assesspro] AssessPro assignment created: id=${assignmentId}`);
            } else {
              console.warn(`[proxy-assesspro] AssessPro rejected assignment for ${u.email} — storing locally`);
            }
          } catch (fetchErr) {
            console.warn(`[proxy-assesspro] Assignment fetch failed for ${u.email}: ${fetchErr} — storing locally`);
          }
        }

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u.id);
        await supabaseAdmin.from("assessment_assignments_cache").insert({
          assesspro_assign_id: String(assignmentId),
          org_id,
          org_code,
          assesspro_assess_id: String(assessmentId),
          assessment_title:    assessmentTitle,
          assigned_to_email:   u.email,
          ...(isUuid ? { assigned_to_user_id: u.id } : {}),
          assigned_by_user_id: user.id,
          status:              "ASSIGNED",
          due_date:            due_date ?? null,
          pa_assessment_id:    asset_id,
        });

        if (asset_id) {
          await supabaseAdmin.from("it_asset_reviews").update({
            assesspro_assignment_id: String(assignmentId),
            review_status:           "questionnaire_assigned",
            updated_at:              new Date().toISOString(),
          }).eq("asset_id", asset_id).eq("org_id", org_id);
        }

        assignResults.push({ userId: u.id, email: u.email, assignmentId });
      }
    }

    return json({
      success: true,
      data: {
        assessment_id:    assessmentId,
        assessment_title: assessmentTitle,
        assignments:      assignResults,
        mode:             assessproMode,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION: start_submission
  // Starts a new submission for an assignment. Returns the submission object.
  // ─────────────────────────────────────────────────────────────────────────
  if (action === "start_submission") {
    const apRes = await apPost("/api-submissions", {
      assignment_id: payload.assignment_id,
      user_id:       user.id,
    });
    const apData = await apRes.json();
    if (!apRes.ok || !apData.success) {
      return json({ success: false, error: apData.error ?? "Failed to start submission" }, 502);
    }

    // Update local cache status to STARTED
    await supabaseAdmin
      .from("assessment_assignments_cache")
      .update({
        status:     "STARTED",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("assesspro_assign_id", payload.assignment_id);

    return json({ success: true, data: apData.data });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION: save_answers
  // Saves (upserts) a batch of answers for an in-progress submission.
  // ─────────────────────────────────────────────────────────────────────────
  if (action === "save_answers") {
    const apRes = await apPost(
      `/api-submissions/${payload.submission_id}/answers`,
      { answers: payload.answers }
    );
    const apData = await apRes.json();
    if (!apRes.ok) {
      return json({ success: false, error: apData.error ?? "Failed to save answers" }, 502);
    }
    return json({ success: true, data: apData.data ?? {} });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION: complete_submission
  // Marks a submission as completed, triggering the AssessPro webhook.
  // ─────────────────────────────────────────────────────────────────────────
  if (action === "complete_submission") {
    const apRes = await apPost(
      `/api-submissions/${payload.submission_id}/complete`,
      {}
    );
    const apData = await apRes.json();
    if (!apRes.ok) {
      return json({ success: false, error: apData.error ?? "Failed to complete submission" }, 502);
    }
    return json({ success: true, data: apData.data ?? {} });
  }

  return json({ success: false, error: { code: "UNKNOWN_ACTION", message: `Unknown action: ${action}` } }, 400);
}
