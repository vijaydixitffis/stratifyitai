import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { APTopicScore } from '../types/assessPro';
import { Asset } from '../types';
import { getDefaultWeights } from './engagementService';

export interface DimensionScores {
  technical_health:  number | null;  // 1–5
  business_fit:      number | null;
  cloud_readiness:   number | null;
  security_posture:  number | null;
  ai_readiness:      number | null;
  operational_risk:  number | null;
  cost_efficiency:   number | null;
}

export interface AssetScoreRecord {
  id: string;
  org_id: number;
  asset_id: string;
  engagement_id: string;
  technical_health:    number | null;
  business_fit:        number | null;
  cloud_readiness:     number | null;
  security_posture:    number | null;
  ai_readiness:        number | null;
  operational_risk:    number | null;
  cost_efficiency:     number | null;
  composite_score:     number | null;
  data_completeness:   number;
  score_rationale:     Record<string, string> | null;
  recommended_disposition: string | null;
  weight_overrides:    Record<string, number> | null;
  admin_annotations:   Record<string, string> | null;
  scored_by: 'ai-engine' | 'manual' | 'metadata-only' | 'pending';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Topic-title keyword → dimension mapping ──────────────────────────────────
// AssessPro topic_titles are matched case-insensitively against these patterns.

const TOPIC_TO_DIMENSION: Array<{ keywords: string[]; dimensions: (keyof DimensionScores)[] }> = [
  { keywords: ['architecture'],                    dimensions: ['technical_health', 'cloud_readiness'] },
  { keywords: ['dev', 'deployment', 'ci/cd'],      dimensions: ['technical_health', 'cloud_readiness'] },
  { keywords: ['scalability', 'performance'],      dimensions: ['technical_health', 'cloud_readiness', 'operational_risk'] },
  { keywords: ['security'],                        dimensions: ['security_posture'] },
  { keywords: ['backward', 'compatibility'],       dimensions: ['technical_health'] },
  { keywords: ['business', 'architecture', 'portfolio'], dimensions: ['business_fit'] },
  { keywords: ['ha', 'dr', 'disaster', 'recovery', 'infrastructure'], dimensions: ['operational_risk'] },
  { keywords: ['strategy', 'objectives'],          dimensions: ['ai_readiness'] },
  { keywords: ['technological', 'tech infra'],     dimensions: ['ai_readiness', 'cloud_readiness'] },
  { keywords: ['data', 'quality'],                 dimensions: ['ai_readiness'] },
  { keywords: ['operations', 'process', 'efficiency'], dimensions: ['operational_risk'] },
  { keywords: ['talent', 'skills'],                dimensions: ['ai_readiness'] },
  { keywords: ['governance', 'ethics'],            dimensions: ['ai_readiness'] },
  { keywords: ['finance', 'budget', 'cost', 'licence', 'license'], dimensions: ['cost_efficiency'] },
];

function matchTopicToDimensions(topicTitle: string): (keyof DimensionScores)[] {
  const lower = topicTitle.toLowerCase();
  const matched = new Set<keyof DimensionScores>();
  for (const { keywords, dimensions } of TOPIC_TO_DIMENSION) {
    if (keywords.some(k => lower.includes(k))) {
      dimensions.forEach(d => matched.add(d));
    }
  }
  return Array.from(matched);
}

// Normalise a percentage (0–100) to a 1–5 scale
function pctTo5(pct: number): number {
  return Math.max(1, Math.min(5, Math.round(1 + (pct / 100) * 4)));
}

// ── Tier 1: AssessPro topic scores ────────────────────────────────────────────
function scoreFromTopics(topicScores: APTopicScore[]): Partial<DimensionScores> {
  const buckets: Partial<Record<keyof DimensionScores, number[]>> = {};

  for (const ts of topicScores) {
    const dims = matchTopicToDimensions(ts.topic_title);
    for (const dim of dims) {
      if (!buckets[dim]) buckets[dim] = [];
      buckets[dim]!.push(ts.percentage);
    }
  }

  const result: Partial<DimensionScores> = {};
  for (const [dim, values] of Object.entries(buckets) as [keyof DimensionScores, number[]][]) {
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    result[dim] = pctTo5(avg);
  }
  return result;
}

// ── Tier 2: Internal review architecture_domains ──────────────────────────────
interface ArchDomain { score: number; status: string }

function scoreFromReviewDomains(domains: Record<string, ArchDomain>): Partial<DimensionScores> {
  const result: Partial<DimensionScores> = {};
  const d = domains;

  const pick = (keys: string[]): number | null => {
    const vals = keys.flatMap(k => (d[k] ? [d[k].score] : []));
    if (!vals.length) return null;
    return pctTo5(vals.reduce((s, v) => s + v, 0) / vals.length);
  };

  result.technical_health = pick(['application', 'integration', 'api']);
  result.security_posture  = pick(['security', 'compliance']);
  result.cloud_readiness   = pick(['infrastructure', 'cloud']);
  result.operational_risk  = pick(['availability', 'resilience', 'operations']);
  return Object.fromEntries(
    Object.entries(result).filter(([, v]) => v !== null),
  ) as Partial<DimensionScores>;
}

// ── Tier 3: Asset metadata ────────────────────────────────────────────────────
function scoreFromMetadata(asset: Asset): Partial<DimensionScores> {
  const result: Partial<DimensionScores> = {};
  const now = Date.now();

  // cost_efficiency: deprecated SaaS or license expiry imminent → low
  let costScore = 3;
  if (asset.status === 'deprecated') costScore = 1;
  else if (asset.status === 'inactive') costScore = 2;
  const licenseExpiry = (asset as Record<string, unknown>).license_expiry_date as string | undefined;
  if (licenseExpiry && new Date(licenseExpiry).getTime() - now < 90 * 86400_000) costScore = Math.min(costScore, 2);
  result.cost_efficiency = costScore;

  // operational_risk: EOL within 18 months → high risk = inverted low score
  let opRisk = 4; // default: low risk = good score
  const eol = (asset as Record<string, unknown>).end_of_life_date as string | undefined;
  const eos = (asset as Record<string, unknown>).end_of_support_date as string | undefined;
  const eolTs = eol ? new Date(eol).getTime() : null;
  const eosTs = eos ? new Date(eos).getTime() : null;
  const within18mo = now + 18 * 30 * 86400_000;
  if (eolTs && eolTs < now) opRisk = 1;
  else if (eolTs && eolTs < within18mo) opRisk = 2;
  else if (eosTs && eosTs < within18mo) opRisk = Math.min(opRisk, 2);
  if (asset.status === 'deprecated') opRisk = Math.min(opRisk, 2);
  result.operational_risk = opRisk;

  // cloud_readiness signal from sourcing_type
  const sourcingType = (asset as Record<string, unknown>).sourcing_type as string | undefined;
  if (sourcingType === 'saas') result.cloud_readiness = 5;
  else if (sourcingType === 'open_source') result.cloud_readiness = 4;

  return result;
}

// ── Composite score ───────────────────────────────────────────────────────────
function computeComposite(
  dims: DimensionScores,
  weights: Record<string, number>,
): { composite: number | null; completeness: number } {
  const keys = Object.keys(dims) as (keyof DimensionScores)[];
  const scored = keys.filter(k => dims[k] !== null);

  if (scored.length < 4) {
    return { composite: null, completeness: Math.round((scored.length / 7) * 100) };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const k of scored) {
    const w = weights[k] ?? 0;
    // Normalise 1–5 to 0–1 then apply weight
    weightedSum += ((dims[k]! - 1) / 4) * w;
    totalWeight += w;
  }

  const composite = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100 * 10) / 10 : null;
  const completeness = Math.round((scored.length / 7) * 100);
  return { composite, completeness };
}

// ── 6R disposition from composite ────────────────────────────────────────────
function recommendDisposition(
  composite: number | null,
  dims: DimensionScores,
): string | null {
  if (composite === null) return null;

  // Override rules from the plan
  if (dims.operational_risk !== null && dims.operational_risk <= 2) return 'retire';
  if (dims.business_fit !== null && dims.business_fit === 5) {
    // Block auto-retire; push to refactor minimum
    if (composite < 40) return 'refactor';
  }

  if (composite >= 80) return 'retain';
  if (composite >= 60) return 'replatform';
  if (composite >= 40) return 'refactor';
  if (composite >= 20) return composite >= 30 ? 'rehost' : 'replace';
  return 'retire';
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getAssetScores(engagementId: string): Promise<AssetScoreRecord[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase
    .from('asset_scores')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('composite_score', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as AssetScoreRecord[];
}

export async function getAssetScore(
  assetId: string,
  engagementId: string,
): Promise<AssetScoreRecord | null> {
  if (!isSupabaseConfigured() || !supabase) return null;
  const { data } = await supabase
    .from('asset_scores')
    .select('*')
    .eq('asset_id', assetId)
    .eq('engagement_id', engagementId)
    .maybeSingle();
  return data as AssetScoreRecord | null;
}

export async function scoreAllAssets(
  orgId: number,
  engagementId: string,
  weights?: Record<string, number>,
): Promise<{ scored: number; skipped: number }> {
  if (!isSupabaseConfigured() || !supabase) return { scored: 0, skipped: 0 };

  const effectiveWeights = weights ?? getDefaultWeights();

  // Fetch all data sources in parallel
  const [assetsRes, reviewsRes, topicScoresRes, mappingsRes, aiReadinessRes] = await Promise.all([
    supabase.from('it_assets').select('*').eq('org_id', orgId),
    supabase.from('it_asset_reviews').select('*').eq('org_id', orgId),
    supabase
      .from('assessment_results_cache')
      .select('topic_scores, assessment_title')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('asset_capability_mappings')
      .select('asset_id, confidence_score, mapping_type')
      .eq('org_id', orgId),
    supabase
      .from('ai_readiness_profiles')
      .select('composite_score')
      .eq('org_id', orgId)
      .eq('engagement_id', engagementId)
      .maybeSingle(),
  ]);

  const assets: Asset[] = assetsRes.data ?? [];
  const reviews: Record<string, Record<string, { score: number; status: string }>> = {};
  for (const r of (reviewsRes.data ?? []) as Array<{ asset_id: string; architecture_domains: Record<string, { score: number; status: string }> }>) {
    if (r.architecture_domains) reviews[r.asset_id] = r.architecture_domains;
  }

  // Aggregate topic scores from all completed assessments
  const allTopicScores: APTopicScore[] = [];
  for (const rc of (topicScoresRes.data ?? []) as Array<{ topic_scores: APTopicScore[] | null }>) {
    if (rc.topic_scores) allTopicScores.push(...rc.topic_scores);
  }
  const tier1 = allTopicScores.length > 0 ? scoreFromTopics(allTopicScores) : {};

  // Org-level AI readiness → ai_readiness dimension for all assets (proxy)
  const orgAIReadiness = aiReadinessRes.data?.composite_score
    ? pctTo5(aiReadinessRes.data.composite_score)
    : null;

  // Capability mapping confidence → business_fit proxy
  const assetConfidence: Record<string, number> = {};
  for (const m of (mappingsRes.data ?? []) as Array<{ asset_id: string; confidence_score: number }>) {
    if (!assetConfidence[m.asset_id] || m.confidence_score > assetConfidence[m.asset_id]) {
      assetConfidence[m.asset_id] = m.confidence_score;
    }
  }

  let scored = 0;
  let skipped = 0;

  const upserts: Record<string, unknown>[] = [];

  for (const asset of assets) {
    const tier2 = reviews[asset.id] ? scoreFromReviewDomains(reviews[asset.id]) : {};
    const tier3 = scoreFromMetadata(asset);

    // Merge: tier1 wins over tier2 wins over tier3 (higher fidelity takes priority)
    const merged: DimensionScores = {
      technical_health:  tier1.technical_health  ?? tier2.technical_health  ?? null,
      business_fit:      tier1.business_fit      ?? tier2.business_fit      ?? null,
      cloud_readiness:   tier1.cloud_readiness   ?? tier2.cloud_readiness   ?? tier3.cloud_readiness ?? null,
      security_posture:  tier1.security_posture  ?? tier2.security_posture  ?? null,
      ai_readiness:      tier1.ai_readiness      ?? orgAIReadiness          ?? null,
      operational_risk:  tier1.operational_risk  ?? tier2.operational_risk  ?? tier3.operational_risk ?? null,
      cost_efficiency:   tier1.cost_efficiency   ?? tier3.cost_efficiency   ?? null,
    };

    // Override business_fit with capability mapping confidence if available
    if (assetConfidence[asset.id] !== undefined && merged.business_fit === null) {
      merged.business_fit = pctTo5(assetConfidence[asset.id] * 100);
    }

    const { composite, completeness } = computeComposite(merged, effectiveWeights);
    const disposition = recommendDisposition(composite, merged);

    const dataSourceTier =
      Object.keys(tier1).length > 0 ? 'ai-engine' :
      Object.keys(tier2).length > 0 ? 'ai-engine' :
      Object.values(tier3).some(v => v !== null) ? 'metadata-only' : 'pending';

    upserts.push({
      org_id:          orgId,
      asset_id:        asset.id,
      engagement_id:   engagementId,
      ...merged,
      composite_score:           composite,
      data_completeness:         completeness,
      recommended_disposition:   disposition,
      scored_by:                 dataSourceTier,
      weight_overrides:          weights ? weights : null,
    });
    scored++;
  }

  if (upserts.length > 0) {
    const { error } = await supabase
      .from('asset_scores')
      .upsert(upserts, { onConflict: 'org_id,asset_id,engagement_id' });
    if (error) throw error;
  }

  return { scored, skipped };
}

export async function publishAssetScores(engagementId: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase
    .from('asset_scores')
    .update({ published_at: new Date().toISOString() })
    .eq('engagement_id', engagementId)
    .is('published_at', null);
  if (error) throw error;
}

export async function updateAssetScoreAnnotation(
  scoreId: string,
  annotation: { dimension: string; note: string },
  adminId: string,
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;

  const { data: existing } = await supabase
    .from('asset_scores')
    .select('admin_annotations')
    .eq('id', scoreId)
    .single();

  const annotations = ((existing?.admin_annotations ?? {}) as Record<string, string>);
  annotations[annotation.dimension] = annotation.note;

  const { error } = await supabase
    .from('asset_scores')
    .update({
      admin_annotations:  annotations,
      admin_overridden_by: adminId,
      admin_overridden_at: new Date().toISOString(),
    })
    .eq('id', scoreId);
  if (error) throw error;
}

export async function overrideDimensionScore(
  scoreId: string,
  dimension: keyof DimensionScores,
  value: number,
  adminId: string,
  weights?: Record<string, number>,
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;

  const { data: existing } = await supabase
    .from('asset_scores')
    .select('*')
    .eq('id', scoreId)
    .single();

  if (!existing) return;

  const updated: DimensionScores = {
    technical_health:  existing.technical_health,
    business_fit:      existing.business_fit,
    cloud_readiness:   existing.cloud_readiness,
    security_posture:  existing.security_posture,
    ai_readiness:      existing.ai_readiness,
    operational_risk:  existing.operational_risk,
    cost_efficiency:   existing.cost_efficiency,
    [dimension]:       value,
  };

  const effectiveWeights = existing.weight_overrides ?? weights ?? getDefaultWeights();
  const { composite, completeness } = computeComposite(updated, effectiveWeights);

  const { error } = await supabase
    .from('asset_scores')
    .update({
      [dimension]:          value,
      composite_score:      composite,
      data_completeness:    completeness,
      recommended_disposition: recommendDisposition(composite, updated),
      scored_by:            'manual',
      admin_overridden_by:  adminId,
      admin_overridden_at:  new Date().toISOString(),
    })
    .eq('id', scoreId);
  if (error) throw error;
}
