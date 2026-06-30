import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LLM_API_KEY = Deno.env.get("LLM_API_KEY")!;
const AI_MODEL = "gemini-2.5-flash";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callGemini(prompt: string, maxTokens = 8192): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${LLM_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const finishReason = data.candidates?.[0]?.finishReason;
  if (finishReason === "MAX_TOKENS") {
    throw new Error(`Gemini response truncated (MAX_TOKENS). Increase maxTokens or reduce input size.`);
  }
  return text;
}

function parseJSON(raw: string): unknown {
  const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = clean.search(/[\[{]/);
  if (start === -1) throw new Error("No JSON found in response");
  try {
    return JSON.parse(clean.slice(start));
  } catch (e) {
    const snippet = clean.slice(start, start + 120);
    throw new Error(`JSON parse failed (response likely truncated). First 120 chars: ${snippet}`);
  }
}

// ── Action: generate capability model from Q&A answers ───────────────────────
async function generateModel(body: {
  sector: string;
  org_size: string;
  business_model: string;
  customers: string;
  core_functions: string[];
  strategic_priorities: string;
  tech_challenges: string;
  mission: string;
  strategic_goals: string;
  existing_assets?: string[];
}) {
  const functionsStr = body.core_functions?.join(", ") || "not specified";
  const assetsSection = body.existing_assets?.length
    ? `\nExisting IT asset inventory (${body.existing_assets.length} assets — use to align capability names with actual systems):\n${body.existing_assets.slice(0, 60).map(a => `  - ${a}`).join("\n")}`
    : "";

  const prompt = `You are a senior business architecture consultant specialising in capability modelling.

Generate a comprehensive Business Capability Model for the following organisation:

Organisation profile:
- Sector / industry: ${body.sector}
- Organisation size: ${body.org_size}
- Business model: ${body.business_model}
- Primary customers / stakeholders: ${body.customers}
- Core business functions: ${functionsStr}
- Strategic priorities (3-year horizon): ${body.strategic_priorities}
- Key technology challenges: ${body.tech_challenges}
- Mission: ${body.mission || "not provided"}
- Strategic goals: ${body.strategic_goals || "not provided"}${assetsSection}

Produce a 3-level capability model (L1 → L2 → L3).
Rules:
- 6-10 L1 capabilities (top-level domains, e.g. "Finance & Accounting", "Customer Management")
- Each L1 should have 3-6 L2 sub-domain capabilities
- Each L2 should have 2-5 L3 process-level capabilities
- Mark capabilities as ai_priority=true if AI/automation can meaningfully improve them
- Assign strategic_importance: critical | high | medium | low based on the org's priorities

Return ONLY a valid JSON array matching this exact schema (no prose, no markdown):
[
  {
    "name": "string",
    "description": "string (one sentence)",
    "level": 1,
    "strategic_importance": "critical|high|medium|low",
    "is_ai_priority": boolean,
    "children": [
      {
        "name": "string",
        "description": "string",
        "level": 2,
        "strategic_importance": "critical|high|medium|low",
        "is_ai_priority": boolean,
        "children": [
          {
            "name": "string",
            "description": "string",
            "level": 3,
            "strategic_importance": "critical|high|medium|low",
            "is_ai_priority": boolean,
            "children": []
          }
        ]
      }
    ]
  }
]`;

  const raw = await callGemini(prompt, 32768);
  const capabilities = parseJSON(raw);
  return { capabilities };
}

// ── Action: suggest asset-to-capability mappings ──────────────────────────────
const CAPS_PER_BATCH = 25;

async function mapAssetsBatch(
  capsBatch: { id: string; name: string; description: string }[],
  assetsStr: string,
): Promise<unknown[]> {
  const capsStr = JSON.stringify(capsBatch, null, 2);

  const prompt = `You are a senior IT architect performing a business capability to IT asset mapping.

Business Capabilities (L3 level, or L2 if L3 is not available):
${capsStr}

IT Asset Inventory:
${assetsStr}

Task: For each capability, identify which IT assets support, implement, or enable that capability.
An asset can (and often should) appear under multiple capabilities.

Scoring guidance:
- confidence 0.85-1.0: Asset is the primary system of record for this capability
- confidence 0.60-0.84: Asset significantly contributes to this capability
- confidence 0.40-0.59: Asset partially or indirectly supports this capability
- Below 0.40: Do not include

Return ONLY a valid JSON array (no prose, no markdown):
[
  {
    "capability_id": "string (from input)",
    "capability_name": "string",
    "supporting_assets": [
      {
        "asset_id": "string (from input)",
        "asset_name": "string",
        "confidence": 0.00,
        "mapping_type": "primary|secondary|enabling",
        "rationale": "One sentence explaining why this asset supports this capability"
      }
    ]
  }
]

Only include capabilities that have at least one matching asset. Omit capabilities with no matches.`;

  const raw = await callGemini(prompt, 65536);
  return parseJSON(raw) as unknown[];
}

async function mapAssets(body: {
  capabilities: { id: string; name: string; description: string; level: number }[];
  assets: { id: string; name: string; type: string; description: string; tags: string[]; category: string }[];
}) {
  const { capabilities, assets } = body;

  if (!capabilities?.length || !assets?.length) {
    return { mappings: [] };
  }

  const assetsStr = JSON.stringify(
    assets.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      category: a.category,
      description: a.description,
      tags: a.tags,
    })),
    null,
    2,
  );

  const capsMapped = capabilities.map(c => ({ id: c.id, name: c.name, description: c.description }));

  const batches: typeof capsMapped[] = [];
  for (let i = 0; i < capsMapped.length; i += CAPS_PER_BATCH) {
    batches.push(capsMapped.slice(i, i + CAPS_PER_BATCH));
  }

  const batchResults = await Promise.all(batches.map(batch => mapAssetsBatch(batch, assetsStr)));
  const mappings = batchResults.flat();
  return { mappings };
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const body = await req.json();
    const { action } = body;

    let result: unknown;

    if (action === "generate_model") {
      result = await generateModel(body);
    } else if (action === "map_assets") {
      result = await mapAssets(body);
    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-capabilities error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
