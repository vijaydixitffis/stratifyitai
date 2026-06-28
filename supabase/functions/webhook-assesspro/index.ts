import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("ASSESSPRO_WEBHOOK_SECRET")!;

serve(async (req) => {
  // 1. Verify HMAC-SHA256 signature
  const signature = req.headers.get("X-AssessPro-Signature") ?? "";
  const rawBody   = await req.text();

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expectedSig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expectedHex = "sha256=" + Array.from(new Uint8Array(expectedSig))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  if (signature !== expectedHex) {
    console.error("Webhook signature mismatch. Received:", signature.substring(0, 20));
    return new Response("Forbidden", { status: 403 });
  }

  // Actual AssessPro webhook payload:
  // { event, fired_at, assignment_id, submission_id, percentage, topic_scores, answer_detail? }
  const payload = JSON.parse(rawBody) as {
    event:         string;
    fired_at:      string;
    assignment_id: string;
    submission_id: string;
    percentage:    number;
    topic_scores:  Array<{ topic_title: string; topic_icon: string; score: number; max_score: number; percentage: number }>;
    answer_detail?: Array<{ question: string; question_type: string; chosen_answer: string; marks_earned: number }>;
  };

  if (payload.event !== "submission.completed") {
    return new Response("OK", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 2. Resolve org from the cached assignment
  const { data: cachedAssignment } = await supabase
    .from("assessment_assignments_cache")
    .select("id, org_id, org_code, assesspro_assess_id, assessment_title, pa_assessment_id")
    .eq("assesspro_assign_id", payload.assignment_id)
    .single();

  if (!cachedAssignment) {
    console.warn("Webhook received for unknown assignment_id:", payload.assignment_id);
    return new Response("OK", { status: 200 });
  }

  const totalScore = payload.topic_scores.reduce((s, t) => s + (t.score ?? 0), 0);
  const maxScore   = payload.topic_scores.reduce((s, t) => s + (t.max_score ?? 0), 0);

  // 3. Cache the submission result (upsert for idempotency)
  const { data: resultRow, error: resultError } = await supabase
    .from("assessment_results_cache")
    .upsert({
      assesspro_sub_id:     payload.submission_id,
      assignment_cache_id:  cachedAssignment.id,
      org_id:               cachedAssignment.org_id,
      org_code:             cachedAssignment.org_code,
      assesspro_assess_id:  cachedAssignment.assesspro_assess_id,
      assessment_title:     cachedAssignment.assessment_title,
      total_score:          totalScore,
      max_score:            maxScore,
      percentage:           payload.percentage,
      topic_scores:         payload.topic_scores,
      completed_at:         payload.fired_at,
    }, { onConflict: "assesspro_sub_id" })
    .select()
    .single();

  if (resultError) {
    console.error("Failed to cache result:", resultError);
    return new Response("Error", { status: 500 });
  }

  // 4. Update the specific assignment to COMPLETED
  await supabase
    .from("assessment_assignments_cache")
    .update({
      status:       "COMPLETED",
      completed_at: payload.fired_at,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", cachedAssignment.id);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5a. ASSET REVIEW questionnaire completion
  //     When an assignment was created via proxy-assesspro create_assessment for
  //     an asset-level questionnaire, pa_assessment_id holds the asset_id.
  //     Detect this and trigger the full ai-asset-review instead of rationalization.
  // ─────────────────────────────────────────────────────────────────────────────
  const assetId = cachedAssignment.pa_assessment_id;
  const { data: assetReview } = assetId
    ? await supabase
        .from("it_asset_reviews")
        .select("id, ai_generated_questions")
        .eq("asset_id", assetId)
        .maybeSingle()
    : { data: null };

  if (assetReview && payload.answer_detail?.length) {
    // Mark review as questionnaire_completed
    await supabase.from("it_asset_reviews").update({
      review_status: "questionnaire_completed",
      updated_at:    new Date().toISOString(),
    }).eq("id", assetReview.id);

    // Convert answer_detail to the questionnaire_answers shape expected by ai-asset-review
    const questionnaireAnswers = payload.answer_detail.map((a, idx) => ({
      question_id: `q_${idx}`,
      question:    a.question,
      answer:      a.chosen_answer,
    }));

    // Trigger ai-asset-review to run the full architectural review now that answers are available
    fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-asset-review`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          asset_id:               assetId,
          org_id:                 cachedAssignment.org_id,
          org_code:               cachedAssignment.org_code,
          override_incomplete:    true,
          questionnaire_answers:  questionnaireAnswers,
        }),
      }
    ).catch(e => console.error("Failed to trigger ai-asset-review:", e));

    console.log(`Asset review questionnaire completed for asset ${assetId}, triggering full review`);
    return new Response("OK", { status: 200 });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5b. REGULAR org assessment completion — trigger portfolio rationalization
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: analysisRow, error: analysisError } = await supabase
    .from("ai_analyses")
    .insert({
      org_id:           cachedAssignment.org_id,
      org_code:         cachedAssignment.org_code,
      result_cache_id:  resultRow?.id,
      assesspro_sub_id: payload.submission_id,
      asset_snapshot:   [],
      status:           "pending",
    })
    .select()
    .single();

  if (analysisError) {
    console.error("Failed to create ai_analyses row:", analysisError);
    return new Response("Error", { status: 500 });
  }

  // 6. Trigger ai-rationalization asynchronously (fire-and-forget)
  fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-rationalization`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        analysis_id:      analysisRow.id,
        org_id:           cachedAssignment.org_id,
        org_code:         cachedAssignment.org_code,
        topic_scores:     payload.topic_scores,
        assessment_title: cachedAssignment.assessment_title ?? "",
        submission_id:    payload.submission_id,
        percentage:       payload.percentage,
      }),
    }
  ).catch(e => console.error("Failed to trigger ai-rationalization:", e));

  console.log(`Webhook processed: submission ${payload.submission_id} for org ${cachedAssignment.org_code}`);
  return new Response("OK", { status: 200 });
});
