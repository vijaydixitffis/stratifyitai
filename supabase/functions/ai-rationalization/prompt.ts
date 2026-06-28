// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Asset {
  id: string;
  name: string;
  type: string;
  category: string | null;
  status: string | null;
  criticality: string | null;
  description: string | null;
  vendor: string | null;
  sourcing_type: "cots" | "custom_built" | "open_source" | "saas" | null;
  environment: string | null;
  business_unit: string | null;
  asset_tag: string | null;
  end_of_life_date: string | null;
  end_of_support_date: string | null;
  purchase_date: string | null;
  last_reviewed_date: string | null;
  annual_cost: number | null;
  license_type: string | null;
  license_expiry_date: string | null;
  support_contract_id: string | null;
  data_classification: "public" | "internal" | "confidential" | "restricted" | null;
  compliance_tags: string[] | null;
  criticality_justification: string | null;
  metadata: Record<string, unknown> | null;
  tags: string[] | null;
}

interface AssetReviewResult {
  review_status: string;
  completeness_score: number | null;
  review_summary: string | null;
  architecture_concerns: Array<{
    domain: string;
    domain_label: string;
    severity: "low" | "medium" | "high" | "critical";
    concern: string;
    recommendation: string;
  }> | null;
  architecture_domains: Record<string, { score: number; notes: string }> | null;
}

interface Relationship {
  source_asset_id: string;
  target_asset_id: string;
  relationship_type: string;
}

interface TopicScore {
  topic_title: string;
  score: number;
  max_score: number;
  percentage: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function lifecycleUrgency(dateStr: string | null): string {
  const days = daysUntil(dateStr);
  if (days === null) return "";
  if (days < 0)   return `PAST (${Math.abs(days)}d ago)`;
  if (days < 90)  return `CRITICAL — ${days}d remaining`;
  if (days < 180) return `URGENT — ${days}d remaining`;
  if (days < 365) return `${days}d remaining`;
  return dateStr!;
}

function formatAsset(
  a: Asset,
  review: AssetReviewResult | undefined,
  assetNameMap: Map<string, string>,
  relationships: Relationship[]
): string {
  const parts: string[] = [];

  parts.push(
    `[${a.id}] ${a.name}` +
    ` | type: ${a.type}` +
    (a.category    ? ` | category: ${a.category}`       : "") +
    (a.status      ? ` | status: ${a.status}`            : "") +
    (a.criticality ? ` | criticality: ${a.criticality}`  : "")
  );

  const ownershipParts: string[] = [];
  if (a.vendor)        ownershipParts.push(`vendor: ${a.vendor}`);
  if (a.sourcing_type) ownershipParts.push(`sourcing: ${a.sourcing_type.replace("_", "-")}`);
  if (a.environment)   ownershipParts.push(`env: ${a.environment}`);
  if (a.business_unit) ownershipParts.push(`BU: ${a.business_unit}`);
  if (ownershipParts.length) parts.push("  " + ownershipParts.join(" | "));

  const lifeParts: string[] = [];
  if (a.end_of_support_date) lifeParts.push(`EOS: ${lifecycleUrgency(a.end_of_support_date)}`);
  if (a.end_of_life_date)    lifeParts.push(`EOL: ${lifecycleUrgency(a.end_of_life_date)}`);
  if (a.license_expiry_date) lifeParts.push(`license expires: ${lifecycleUrgency(a.license_expiry_date)}`);
  if (a.annual_cost != null) lifeParts.push(`annual cost: $${a.annual_cost.toLocaleString()}`);
  if (a.license_type)        lifeParts.push(`license: ${a.license_type}`);
  if (lifeParts.length) parts.push("  " + lifeParts.join(" | "));

  const compParts: string[] = [];
  if (a.data_classification)     compParts.push(`data-class: ${a.data_classification}`);
  if (a.compliance_tags?.length) compParts.push(`compliance: ${a.compliance_tags.join(",")}`);
  if (compParts.length) parts.push("  " + compParts.join(" | "));

  if (a.description)               parts.push(`  notes: ${a.description}`);
  if (a.criticality_justification) parts.push(`  criticality-reason: ${a.criticality_justification}`);

  if (a.metadata && Object.keys(a.metadata).length > 0) {
    const specSnippet = Object.entries(a.metadata)
      .slice(0, 6)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    parts.push(`  tech-specs: ${specSnippet}`);
  }

  // AI architectural review results (if available)
  if (review) {
    if (review.review_summary) {
      parts.push(`  AI-review-summary: ${review.review_summary}`);
    }
    if (review.completeness_score != null) {
      parts.push(`  AI-review-completeness: ${review.completeness_score}%`);
    }
    // Domain scores
    if (review.architecture_domains) {
      const domainScores = Object.entries(review.architecture_domains)
        .map(([id, d]) => `${id}:${d.score}/100`)
        .join(", ");
      if (domainScores) parts.push(`  AI-domain-scores: ${domainScores}`);
    }
    // Top concerns (critical + high only, max 3)
    const topConcerns = (review.architecture_concerns ?? [])
      .filter(c => c.severity === "critical" || c.severity === "high")
      .slice(0, 3)
      .map(c => `[${c.severity.toUpperCase()}] ${c.domain_label}: ${c.concern}`)
      .join("; ");
    if (topConcerns) parts.push(`  AI-top-concerns: ${topConcerns}`);
  }

  // Dependency relationships for this asset
  const outgoing = relationships.filter(r => r.source_asset_id === a.id);
  const incoming = relationships.filter(r => r.target_asset_id === a.id);
  if (outgoing.length) {
    const deps = outgoing.map(r => `${r.relationship_type}→${assetNameMap.get(r.target_asset_id) ?? r.target_asset_id}`).join(", ");
    parts.push(`  depends-on: ${deps}`);
  }
  if (incoming.length) {
    const dependents = incoming.map(r => `${assetNameMap.get(r.source_asset_id) ?? r.source_asset_id}(${r.relationship_type})`).join(", ");
    parts.push(`  depended-on-by: ${dependents} [RETIREMENT RISK: these assets rely on this one]`);
  }

  return parts.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export function buildRationalizationPrompt(
  assets: Asset[],
  topicScores: TopicScore[],
  assessmentTitle: string,
  overallPercentage: number,
  reviewMap: Map<string, AssetReviewResult>,
  relationships: Relationship[]
): string {
  // Build name lookup for relationship display
  const assetNameMap = new Map<string, string>(assets.map(a => [a.id, a.name]));

  const assetList = assets
    .map(a => formatAsset(a, reviewMap.get(a.id), assetNameMap, relationships))
    .join("\n\n");

  const topicList = topicScores.length
    ? topicScores.map(t =>
        `- ${t.topic_title}: ${t.score}/${t.max_score} (${t.percentage.toFixed(0)}%)`
      ).join("\n")
    : "No assessment topic scores available — base analysis on CMDB data and AI review results.";

  // Aggregate portfolio signals
  const criticalEOS  = assets.filter(a => { const d = daysUntil(a.end_of_support_date); return d !== null && d < 365; });
  const criticalEOL  = assets.filter(a => { const d = daysUntil(a.end_of_life_date);    return d !== null && d < 365; });
  const highCostAssets = assets.filter(a => (a.annual_cost ?? 0) > 50000)
    .sort((a, b) => (b.annual_cost ?? 0) - (a.annual_cost ?? 0));
  const totalAnnualCost = assets.reduce((s, a) => s + (a.annual_cost ?? 0), 0);
  const cotsCount    = assets.filter(a => a.sourcing_type === "cots").length;
  const customCount  = assets.filter(a => a.sourcing_type === "custom_built").length;
  const complianceAssets = assets.filter(a => a.compliance_tags?.length);
  const reviewedCount = reviewMap.size;

  // Dependency risk summary
  const assetsWithDependents = new Set(relationships.map(r => r.target_asset_id));
  const highDepRiskAssets = assets
    .filter(a => assetsWithDependents.has(a.id))
    .map(a => {
      const count = relationships.filter(r => r.target_asset_id === a.id).length;
      return `${a.name} (${count} dependents)`;
    });

  const portfolioContext = [
    `Total assets: ${assets.length}`,
    `Assets with completed AI architectural review: ${reviewedCount}`,
    totalAnnualCost > 0
      ? `Total annual IT spend (declared): $${totalAnnualCost.toLocaleString()}`
      : null,
    cotsCount   ? `COTS packages: ${cotsCount}`   : null,
    customCount ? `Custom-built: ${customCount}`   : null,
    criticalEOS.length
      ? `Assets reaching EOS within 12 months: ${criticalEOS.length} (${criticalEOS.map(a => a.name).join(", ")})`
      : "No assets approaching EOS within 12 months",
    criticalEOL.length
      ? `Assets reaching EOL within 12 months: ${criticalEOL.length} (${criticalEOL.map(a => a.name).join(", ")})`
      : null,
    highCostAssets.length
      ? `Highest-cost assets: ${highCostAssets.slice(0, 3).map(a => `${a.name} ($${(a.annual_cost ?? 0).toLocaleString()})`).join(", ")}`
      : null,
    complianceAssets.length
      ? `Compliance-tagged assets: ${complianceAssets.length} (${[...new Set(complianceAssets.flatMap(a => a.compliance_tags ?? []))].join(", ")})`
      : null,
    highDepRiskAssets.length
      ? `High-dependency assets (risky to retire/replace): ${highDepRiskAssets.join(", ")}`
      : null,
  ].filter(Boolean).join("\n");

  return `You are a senior enterprise IT architect advising an organisation on IT portfolio rationalization.
You have been given:
1. Results from their "${assessmentTitle}" maturity assessment (overall score: ${overallPercentage.toFixed(0)}%).
2. Their full IT asset inventory with CMDB-grade detail.
3. Per-asset AI architectural review results where available (completeness score, domain scores, top concerns).
4. Asset dependency graph (runs_on, depends_on, connects_to relationships).

──────────────────────────────────────────────────────────
ASSESSMENT TOPIC SCORES
──────────────────────────────────────────────────────────
${topicList}

──────────────────────────────────────────────────────────
PORTFOLIO SUMMARY
──────────────────────────────────────────────────────────
${portfolioContext}

──────────────────────────────────────────────────────────
IT ASSET INVENTORY WITH AI REVIEW CONTEXT (${assets.length} assets)
──────────────────────────────────────────────────────────
${assetList}

──────────────────────────────────────────────────────────
RATIONALIZATION RULES — 8 Rs FRAMEWORK
──────────────────────────────────────────────────────────
Use ONLY these eight dispositions. Choose the most specific one that fits:

| Disposition  | When to apply |
|---|---|
| Retain       | Fit-for-purpose; no lifecycle or financial risk |
| Retire       | Obsolete, EOL passed, or no longer needed; decommission |
| Replace      | Swap with a modern COTS/SaaS equivalent; no code reuse |
| Consolidate  | Merge with a functionally redundant peer asset |
| Modernise    | Significant refactor/rewrite; code-level changes to existing system |
| Rehost       | Lift-and-shift to cloud or new infrastructure; zero code changes |
| Replatform   | Move to a new platform (containerize, managed DB, PaaS) with minor changes |
| Rearchitect  | Fundamental redesign — cloud-native, microservices, event-driven |

Apply the following rules (in priority order):

1. LIFECYCLE URGENCY
   • EOS within 90 days  → strongly prefer Retire or Replace (CRITICAL)
   • EOS within 180 days → prefer Retire or Replace (URGENT)
   • EOS within 12 months → lean toward Retire or Replace
   • EOL already PAST    → prefer Retire (deprecated/inactive) or Replace (still active)

2. AI REVIEW SIGNALS (where available — highest quality signal)
   • Architecture concerns at CRITICAL/HIGH severity → factor heavily into disposition
   • Low domain scores (< 40%) → lean toward Rearchitect or Modernise
   • Low completeness (< 50%) with many high concerns → Replace or Rearchitect
   • Good domain scores (> 70%) across all domains → Retain or Rehost only

3. DEPENDENCY RISK (from "depended-on-by" field)
   • An asset with active dependents must NOT be recommended Retire/Replace without
     explicitly noting a migration path in the rationale. Set dependency_risk = "High".
   • Assets with no incoming dependencies → dependency_risk = "None"

4. SOURCING TYPE SIGNALS
   • cots          → if underperforming or EOL, Replace with modern COTS/SaaS
   • custom_built  → if deprecated or low AI review scores, prefer Modernise or Rearchitect
   • open_source   → upgrade path preferred; Replatform if containerization helps
   • saas          → check license_expiry; if poor value vs annual_cost, Replace or Consolidate

5. FINANCIAL SIGNALS
   • High cost + poor scores + deprecated/EOL → strong Retire or Replace case
   • High cost + active + high criticality + good scores → Retain (cost justified)
   • Multiple overlapping assets with combined high cost → Consolidate

6. COMPLIANCE CONSTRAINTS
   • Assets with compliance_tags (PCI, HIPAA, SOX, GDPR) must have compliance impact
     noted in rationale. Retirement requires a compliance data-migration plan.
   • data_classification = restricted → do NOT recommend quick Retire without data plan.

7. CRITICALITY + STATUS
   • Deprecated + low criticality → Retire
   • Active + high criticality + good scores + no lifecycle risk → Retain
   • Planned (not yet live) + poor score area → reassess before deploying

8. ESTIMATED EFFORT
   • Retire/Rehost → Low effort
   • Replace/Replatform/Consolidate → Medium effort
   • Modernise/Rearchitect → High effort
   Adjust if AI review concerns or compliance tags increase complexity.

9. TIME HORIZON
   • Immediate: EOS/EOL already past, or CRITICAL lifecycle
   • 6-12 months: URGENT EOS/EOL, or critical AI review concerns
   • 12-24 months: medium lifecycle risk or moderate AI concerns
   • 24+ months: low urgency, strategic initiative

──────────────────────────────────────────────────────────
OUTPUT FORMAT
──────────────────────────────────────────────────────────
CRITICAL: Respond ONLY with a valid JSON object. No preamble, no explanation, no markdown fences.

{
  "summary": "<2-3 sentence executive summary: overall portfolio health, top lifecycle/financial risk, dependency risk highlights, and single highest-priority action>",
  "asset_dispositions": [
    {
      "asset_id": "<exact asset id>",
      "asset_name": "<asset name>",
      "asset_type": "<asset type>",
      "disposition": "Retain|Retire|Replace|Consolidate|Modernise|Rehost|Replatform|Rearchitect",
      "confidence": "High|Medium|Low",
      "rationale": "<2-3 sentences citing: EOS/EOL dates, annual cost, AI review findings, compliance tags, dependency risk, sourcing type, assessment scores — not generic statements>",
      "estimated_effort": "Low|Medium|High",
      "dependency_risk": "None|Low|High",
      "affected_dependents": ["<asset id of each asset that depends on this one>"],
      "time_horizon": "Immediate|6-12 months|12-24 months|24+ months"
    }
  ],
  "roadmap": [
    {
      "title": "<concise initiative title>",
      "description": "<what, why, and which compliance/financial risk it addresses — 2-3 sentences>",
      "initiative_type": "Retire|Replace|Consolidate|Modernise|Rehost|Replatform|Rearchitect|Governance|Process",
      "effort": "Low|Medium|High",
      "impact": "Low|Medium|High",
      "priority_score": <integer 1-10, 10 = highest priority>,
      "affected_assets": ["<asset name>"],
      "time_horizon": "0-3 months|3-6 months|6-12 months|12+ months"
    }
  ]
}

Every asset in the inventory must appear in asset_dispositions exactly once.
Return 5 to 10 roadmap items ordered by priority_score descending.
Roadmap items for CRITICAL EOS/EOL assets must have time_horizon "0-3 months" or "3-6 months".
Do not include any text outside the JSON object.`;
}
