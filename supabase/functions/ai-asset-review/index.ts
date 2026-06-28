import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getFramework,
  computeCompleteness,
  questionsForDomains,
  reviewPrompt,
} from "./review-frameworks.ts";

const LLM_API_KEY = Deno.env.get("LLM_API_KEY")!;
const LLM_MODEL   = "gemini-2.5-flash";
// Completeness threshold: below this the AI generates a questionnaire instead of a full review
const COMPLETENESS_THRESHOLD = 40;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

async function callGemini(prompt: string, maxTokens = 8192): Promise<string> {
  const keyPresent = !!LLM_API_KEY && LLM_API_KEY !== "undefined";
  console.log(`[callGemini] model=${LLM_MODEL} maxTokens=${maxTokens} keyPresent=${keyPresent} keyPrefix=${LLM_API_KEY?.slice(0,8) ?? "MISSING"}`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${LLM_MODEL}:generateContent?key=${LLM_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.1,
        // Disable thinking — it consumes the token budget and truncates JSON output
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[callGemini] HTTP ${res.status} error: ${errBody}`);
    throw new Error(`Gemini API ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const parts: Array<{ text?: string; thought?: boolean }> = data.candidates?.[0]?.content?.parts ?? [];
  const finishReason = data.candidates?.[0]?.finishReason ?? "unknown";

  // Filter out thinking parts (thought=true) — only keep actual response text
  const responseParts = parts.filter(p => !p.thought);
  const text = responseParts.map(p => p.text ?? "").join("").trim();

  console.log(`[callGemini] finishReason=${finishReason} totalParts=${parts.length} responseParts=${responseParts.length} rawLength=${text.length}`);
  if (!text) {
    console.warn("[callGemini] Empty response text. Full response:", JSON.stringify(data).slice(0, 800));
  }

  return text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

/** Format CMDB asset data as a readable block for the review prompt. */
function formatCmdb(asset: Record<string, unknown>): string {
  const fields: Array<[string, unknown]> = [
    ["Name", asset.name], ["Type", asset.type], ["Category", asset.category],
    ["Status", asset.status], ["Criticality", asset.criticality],
    ["Vendor", asset.vendor], ["Sourcing Type", asset.sourcing_type],
    ["Environment", asset.environment], ["Business Unit", asset.business_unit],
    ["Annual Cost", asset.annual_cost ? `$${Number(asset.annual_cost).toLocaleString()}` : null],
    ["License Type", asset.license_type],
    ["End of Support", asset.end_of_support_date], ["End of Life", asset.end_of_life_date],
    ["Data Classification", asset.data_classification],
    ["Compliance Tags", Array.isArray(asset.compliance_tags) ? asset.compliance_tags.join(", ") : null],
    ["Criticality Justification", asset.criticality_justification],
    ["Description", asset.description],
  ];
  // Add metadata tech specs
  if (asset.metadata && typeof asset.metadata === "object") {
    for (const [k, v] of Object.entries(asset.metadata as Record<string, unknown>).slice(0, 8)) {
      fields.push([k.replace(/_/g, " "), v]);
    }
  }
  return fields
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // Accept both user JWT and service-role key (for webhook-triggered calls)
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceRole = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    isServiceRole
      ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      : Deno.env.get("SUPABASE_ANON_KEY")!,
    isServiceRole ? {} : { global: { headers: { Authorization: authHeader } } }
  );

  if (!isServiceRole) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ success: false, error: "UNAUTHORIZED" }, 401);
  }

  const body = await req.json() as {
    asset_id: string;
    org_id: number;
    org_code: string;
    override_incomplete?: boolean;
    questionnaire_answers?: Array<{ question_id: string; question: string; answer: string }>;
  };

  const { asset_id, org_id, org_code, override_incomplete = false, questionnaire_answers } = body;
  if (!asset_id || !org_id) return json({ success: false, error: "asset_id and org_id are required" }, 400);

  console.log(`[ai-asset-review] START asset_id=${asset_id} org_id=${org_id} override=${override_incomplete}`);

  // ── 1. Load asset CMDB data ────────────────────────────────────────────────
  const { data: asset, error: assetErr } = await supabase
    .from("it_assets")
    .select([
      "id", "name", "type", "category", "status", "criticality", "description",
      "vendor", "sourcing_type", "environment", "business_unit", "asset_tag",
      "end_of_life_date", "end_of_support_date", "purchase_date", "last_reviewed_date",
      "annual_cost", "license_type", "license_expiry_date",
      "data_classification", "compliance_tags", "criticality_justification",
      "metadata", "tags",
    ].join(", "))
    .eq("id", asset_id)
    .eq("org_id", org_id)
    .single();

  if (assetErr || !asset) {
    console.error(`[ai-asset-review] Asset not found: ${assetErr?.message}`);
    return json({ success: false, error: "Asset not found" }, 404);
  }
  console.log(`[ai-asset-review] Loaded asset: "${asset.name}" type=${asset.type}`);

  // ── 2. Load attached documents ─────────────────────────────────────────────
  const { data: docs } = await supabase
    .from("it_asset_documents")
    .select("title, doc_type, source_type, content, summary, word_count, fetch_status")
    .eq("asset_id", asset_id)
    .eq("fetch_status", "completed");

  const docCount = docs?.length ?? 0;
  const documentContent = (docs ?? [])
    .filter(d => d.content)
    .map(d => `=== ${d.title} [${d.doc_type}] ===\n${d.content}`)
    .join("\n\n");

  const totalWords = documentContent.split(/\s+/).filter(Boolean).length;
  console.log(`[ai-asset-review] Documents: count=${docCount} totalWords=${totalWords}`);

  // ── 3. Load or create review record ───────────────────────────────────────
  let { data: review } = await supabase
    .from("it_asset_reviews")
    .select("*")
    .eq("asset_id", asset_id)
    .maybeSingle();

  const reviewId = review?.id ?? null;
  const now = new Date().toISOString();

  if (!reviewId) {
    const { data: created } = await supabase
      .from("it_asset_reviews")
      .insert({ asset_id, org_id, review_status: "reviewing", updated_at: now })
      .select()
      .single();
    review = created;
    console.log(`[ai-asset-review] Created new review record id=${created?.id}`);
  } else {
    await supabase.from("it_asset_reviews")
      .update({ review_status: "reviewing", updated_at: now })
      .eq("id", reviewId);
    console.log(`[ai-asset-review] Using existing review record id=${reviewId}`);
  }

  if (!review) return json({ success: false, error: "Failed to create review record" }, 500);

  // ── 4. Determine framework + completeness ──────────────────────────────────
  const domains = getFramework(asset.type);
  const { score, missing } = computeCompleteness(domains, documentContent);

  const hasQuestionnaireAnswers = questionnaire_answers && questionnaire_answers.length > 0;
  const shouldRunFullReview = score >= COMPLETENESS_THRESHOLD || override_incomplete || hasQuestionnaireAnswers;

  console.log(`[ai-asset-review] Framework: type=${asset.type} domains=${domains.length} completeness=${score}% missing=[${missing.join(",")}] shouldRunFullReview=${shouldRunFullReview}`);

  // ── 5a. GENERATE QUESTIONNAIRE if completeness insufficient ────────────────
  if (!shouldRunFullReview) {
    console.log(`[ai-asset-review] Generating questionnaire for ${missing.length} missing domains`);
    const qPrompt = questionsForDomains(asset.name, asset.type, domains, missing);
    console.log(`[ai-asset-review] Question prompt length=${qPrompt.length} chars`);

    let questions: unknown[] = [];
    let geminiRaw = "";
    try {
      geminiRaw = await callGemini(qPrompt, 8192);
      console.log(`[ai-asset-review] Gemini raw response length=${geminiRaw.length} preview="${geminiRaw.slice(0, 200)}"`);
      questions = JSON.parse(geminiRaw);
      if (!Array.isArray(questions)) {
        console.warn(`[ai-asset-review] Parsed result is not an array: ${typeof questions}`);
        questions = [];
      }
      console.log(`[ai-asset-review] Parsed ${questions.length} questions`);
    } catch (e) {
      console.error(`[ai-asset-review] Question generation failed: ${e}`);
      console.error(`[ai-asset-review] Raw that failed to parse: "${geminiRaw.slice(0, 500)}"`);
      questions = [];
    }

    if (questions.length > 0) {
      await supabase.from("it_asset_reviews").update({
        review_status:          "questionnaire_pending",
        completeness_score:     score,
        missing_domains:        missing,
        ai_generated_questions: questions,
        updated_at:             now,
      }).eq("id", review.id);

      console.log(`[ai-asset-review] Saved ${questions.length} questions → questionnaire_pending`);
      return json({
        success:      true,
        action:       "questionnaire_generated",
        review_id:    review.id,
        completeness: score,
        missing:      missing,
        questions,
      });
    }

    // Question generation failed — fall through to full review
    console.warn("[ai-asset-review] 0 questions produced; falling through to full review");
  }

  // ── 5b. RUN FULL ARCHITECTURAL REVIEW ─────────────────────────────────────
  console.log(`[ai-asset-review] Running full architectural review`);
  const cmdbBlock = formatCmdb(asset as Record<string, unknown>);
  const answersBlock = hasQuestionnaireAnswers
    ? questionnaire_answers!.map(a => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n")
    : "";

  let reviewResult: {
    completeness_score: number;
    review_summary: string;
    architecture_domains: Record<string, { score: number; notes: string; status: string }>;
    architecture_concerns: Array<{ domain: string; domain_label: string; severity: string; concern: string; recommendation: string }>;
  };

  try {
    const prompt = reviewPrompt(
      asset.name, asset.type, asset.category ?? null,
      cmdbBlock, documentContent, answersBlock, domains
    );
    console.log(`[ai-asset-review] Full review prompt length=${prompt.length} chars`);
    const raw = await callGemini(prompt, 4096);
    console.log(`[ai-asset-review] Full review raw length=${raw.length} preview="${raw.slice(0, 200)}"`);
    reviewResult = JSON.parse(raw);
    console.log(`[ai-asset-review] Full review parsed: score=${reviewResult.completeness_score} concerns=${reviewResult.architecture_concerns?.length ?? 0}`);
  } catch (e) {
    console.error(`[ai-asset-review] Full review failed: ${e}`);
    await supabase.from("it_asset_reviews").update({
      review_status: "pending",
      updated_at:    now,
    }).eq("id", review.id);
    return json({ success: false, error: `AI review failed: ${e}` }, 500);
  }

  // ── 6. Persist review results ──────────────────────────────────────────────
  await supabase.from("it_asset_reviews").update({
    review_status:         "addressed",
    completeness_score:    reviewResult.completeness_score,
    missing_domains:       [],
    architecture_domains:  reviewResult.architecture_domains,
    architecture_concerns: reviewResult.architecture_concerns,
    review_summary:        reviewResult.review_summary,
    override_incomplete:   override_incomplete,
    reviewed_by_ai_at:     now,
    last_assessed_at:      now,
    updated_at:            now,
  }).eq("id", review.id);

  // ── 7. Update asset last_reviewed_date ─────────────────────────────────────
  await supabase.from("it_assets")
    .update({ last_reviewed_date: now.slice(0, 10), updated_at: now })
    .eq("id", asset_id);

  console.log(`[ai-asset-review] DONE: "${asset.name}" score=${reviewResult.completeness_score} concerns=${reviewResult.architecture_concerns?.length ?? 0}`);

  return json({
    success:               true,
    action:                "review_completed",
    review_id:             review.id,
    completeness_score:    reviewResult.completeness_score,
    review_summary:        reviewResult.review_summary,
    architecture_concerns: reviewResult.architecture_concerns,
  });
});
