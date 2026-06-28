import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildRationalizationPrompt } from "./prompt.ts";

const LLM_API_KEY = Deno.env.get("LLM_API_KEY")!;
const AI_MODEL = "gemini-2.5-flash";

serve(async (req) => {
  const {
    analysis_id, org_id, org_code,
    topic_scores, assessment_title, percentage
  } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  await supabase.from("ai_analyses")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", analysis_id);

  try {
    // 1. Load org's IT assets with all CMDB fields
    const { data: assets, error: assetError } = await supabase
      .from("it_assets")
      .select([
        "id", "name", "type", "category", "status", "criticality", "description",
        "vendor", "sourcing_type", "environment", "business_unit", "asset_tag",
        "end_of_life_date", "end_of_support_date", "purchase_date", "last_reviewed_date",
        "annual_cost", "license_type", "license_expiry_date", "support_contract_id",
        "data_classification", "compliance_tags", "criticality_justification",
        "metadata", "tags",
      ].join(", "))
      .eq("org_id", org_id)
      .order("criticality", { ascending: false });

    if (assetError) throw new Error(`Failed to load assets: ${assetError.message}`);

    if (!assets?.length) {
      await supabase.from("ai_analyses").update({
        status: "failed",
        error_message: "No assets found for this organization.",
        updated_at: new Date().toISOString(),
      }).eq("id", analysis_id);
      return new Response("No assets", { status: 200 });
    }

    // 2. Load per-asset AI review results (completeness + concerns + domain scores)
    const { data: reviews } = await supabase
      .from("it_asset_reviews")
      .select("asset_id, review_status, completeness_score, review_summary, architecture_concerns, architecture_domains")
      .eq("org_id", org_id)
      .in("review_status", ["addressed"]);

    const reviewMap = new Map<string, {
      review_status: string;
      completeness_score: number | null;
      review_summary: string | null;
      architecture_concerns: unknown[] | null;
      architecture_domains: Record<string, { score: number; notes: string }> | null;
    }>();
    for (const r of (reviews ?? [])) {
      reviewMap.set(r.asset_id, r);
    }

    // 3. Load dependency relationships for the org
    const { data: relationships } = await supabase
      .from("it_asset_relationships")
      .select("source_asset_id, target_asset_id, relationship_type")
      .eq("org_id", org_id);

    const relList = relationships ?? [];

    // 4. Build prompt
    const prompt = buildRationalizationPrompt(
      assets, topic_scores ?? [], assessment_title ?? "", percentage ?? 0,
      reviewMap, relList
    );

    // 5. Call Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${LLM_API_KEY}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API error ${geminiRes.status}: ${errText}`);
    }

    const geminiData = await geminiRes.json();
    const rawText: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // 6. Parse JSON response
    const clean = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean) as {
      summary: string;
      asset_dispositions: {
        asset_id: string;
        asset_name: string;
        asset_type: string;
        disposition: "Retain" | "Replace" | "Retire" | "Consolidate" | "Modernise" | "Rehost" | "Replatform" | "Rearchitect";
        confidence: "High" | "Medium" | "Low";
        rationale: string;
        estimated_effort: "Low" | "Medium" | "High";
        dependency_risk: "None" | "Low" | "High";
        affected_dependents: string[];
        time_horizon: "Immediate" | "6-12 months" | "12-24 months" | "24+ months";
      }[];
      roadmap: {
        title: string;
        description: string;
        initiative_type: string;
        effort: "Low" | "Medium" | "High";
        impact: "Low" | "Medium" | "High";
        priority_score: number;
        affected_assets: string[];
        time_horizon: string;
      }[];
    };

    // 7. Store results
    await supabase.from("ai_analyses").update({
      asset_snapshot: assets,
      rationalization_results: parsed.asset_dispositions,
      summary_text: parsed.summary,
      ai_model: AI_MODEL,
      status: "completed",
      updated_at: new Date().toISOString(),
    }).eq("id", analysis_id);

    if (parsed.roadmap?.length) {
      const roadmapRows = parsed.roadmap.map((item, idx) => ({
        analysis_id,
        org_id,
        title: item.title,
        description: item.description,
        initiative_type: item.initiative_type,
        effort: item.effort,
        impact: item.impact,
        priority_score: item.priority_score,
        affected_assets: item.affected_assets,
        time_horizon: item.time_horizon,
        status: "open",
        sequence_number: idx + 1,
      }));
      await supabase.from("roadmap_items").insert(roadmapRows);
    }

    console.log(`AI rationalization completed for org ${org_code}, analysis ${analysis_id}`);
    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("AI rationalization failed:", err);
    await supabase.from("ai_analyses").update({
      status: "failed",
      error_message: String(err),
      updated_at: new Date().toISOString(),
    }).eq("id", analysis_id);
    return new Response("Error", { status: 500 });
  }
});
