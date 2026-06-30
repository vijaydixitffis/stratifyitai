import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface AIReadinessProfile {
  id: string;
  org_id: number;
  engagement_id: string;
  session_id: string | null;
  strategy_score:       number | null;
  tech_infra_score:     number | null;
  data_quality_score:   number | null;
  operations_score:     number | null;
  talent_score:         number | null;
  finance_score:        number | null;
  governance_score:     number | null;
  dept_specific_score:  number | null;
  composite_score:      number | null;
  data_completeness:    number;
  maturity_tier: 'exploring' | 'developing' | 'scaling' | 'leading' | null;
  tier_rationale:  string | null;
  top_3_strengths: Array<{ dimension: string; score: number; insight: string }> | null;
  top_3_gaps:      Array<{ dimension: string; score: number; recommendation: string }> | null;
  generated_at:    string;
  admin_reviewed_at: string | null;
}

// Topic-title keywords → AI readiness dimension
const TOPIC_DIMENSION_MAP: Array<{ keywords: string[]; dimension: keyof DimensionMap }> = [
  { keywords: ['strategy', 'objective', 'business strategy'],  dimension: 'strategy_score' },
  { keywords: ['tech infra', 'technological', 'infrastructure', 'platform'], dimension: 'tech_infra_score' },
  { keywords: ['data', 'quality', 'data infrastructure'],      dimension: 'data_quality_score' },
  { keywords: ['operation', 'process', 'efficiency'],          dimension: 'operations_score' },
  { keywords: ['talent', 'skill', 'people'],                   dimension: 'talent_score' },
  { keywords: ['finance', 'budget', 'funding', 'cost'],        dimension: 'finance_score' },
  { keywords: ['governance', 'ethics', 'policy'],              dimension: 'governance_score' },
  { keywords: ['department', 'dept', 'adoption', 'specific'],  dimension: 'dept_specific_score' },
];

type DimensionMap = {
  strategy_score:      number | null;
  tech_infra_score:    number | null;
  data_quality_score:  number | null;
  operations_score:    number | null;
  talent_score:        number | null;
  finance_score:       number | null;
  governance_score:    number | null;
  dept_specific_score: number | null;
};

const DIMENSION_LABELS: Record<keyof DimensionMap, string> = {
  strategy_score:      'Business Strategy',
  tech_infra_score:    'Tech Infrastructure',
  data_quality_score:  'Data Quality',
  operations_score:    'Operations',
  talent_score:        'Talent & Skills',
  finance_score:       'Finance & Budget',
  governance_score:    'Governance',
  dept_specific_score: 'Department Readiness',
};

function mapTopicToAIDimension(topicTitle: string): keyof DimensionMap | null {
  const lower = topicTitle.toLowerCase();
  for (const { keywords, dimension } of TOPIC_DIMENSION_MAP) {
    if (keywords.some(k => lower.includes(k))) return dimension;
  }
  return null;
}

function computeMaturityTier(composite: number): AIReadinessProfile['maturity_tier'] {
  if (composite >= 81) return 'leading';
  if (composite >= 61) return 'scaling';
  if (composite >= 41) return 'developing';
  return 'exploring';
}

function tierRationale(tier: AIReadinessProfile['maturity_tier']): string {
  switch (tier) {
    case 'leading':    return 'AI-native operations achievable — focus shifts to optimisation and responsible AI at scale.';
    case 'scaling':    return 'Broad AI adoption is feasible; governance and talent are the remaining barriers.';
    case 'developing': return 'Pockets of readiness exist; targeted AI pilots are viable in 1–2 capabilities with strong data maturity.';
    case 'exploring':
    default:           return 'AI is aspirational — foundational work is needed across data, infrastructure, and talent before any AI initiative.';
  }
}

export async function getAIReadinessProfile(
  orgId: number,
  engagementId: string,
): Promise<AIReadinessProfile | null> {
  if (!isSupabaseConfigured() || !supabase) return null;
  const { data } = await supabase
    .from('ai_readiness_profiles')
    .select('*')
    .eq('org_id', orgId)
    .eq('engagement_id', engagementId)
    .maybeSingle();
  return data as AIReadinessProfile | null;
}

export async function computeAndSaveAIReadinessProfile(
  orgId: number,
  engagementId: string,
): Promise<AIReadinessProfile | null> {
  if (!isSupabaseConfigured() || !supabase) return null;

  // Fetch AI Readiness assessment results from AssessPro cache
  const { data: resultCaches } = await supabase
    .from('assessment_results_cache')
    .select('topic_scores, assessment_title')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Also try internal assessment_responses for local assessment sessions
  const { data: sessions } = await supabase
    .from('assessment_sessions')
    .select('id, assessment_id')
    .eq('org_id', orgId)
    .eq('status', 'completed');

  const dims: DimensionMap = {
    strategy_score:      null,
    tech_infra_score:    null,
    data_quality_score:  null,
    operations_score:    null,
    talent_score:        null,
    finance_score:       null,
    governance_score:    null,
    dept_specific_score: null,
  };

  // Tier 1: map AssessPro topic scores to AI readiness dimensions
  const buckets: Partial<Record<keyof DimensionMap, number[]>> = {};
  for (const rc of (resultCaches ?? []) as Array<{ topic_scores: Array<{ topic_title: string; percentage: number }> | null; assessment_title: string | null }>) {
    if (!rc.topic_scores) continue;
    for (const ts of rc.topic_scores) {
      const dim = mapTopicToAIDimension(ts.topic_title);
      if (!dim) continue;
      if (!buckets[dim]) buckets[dim] = [];
      buckets[dim]!.push(ts.percentage);
    }
  }
  for (const [dim, vals] of Object.entries(buckets) as [keyof DimensionMap, number[]][]) {
    dims[dim] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10) / 10;
  }

  const scoredDims = (Object.values(dims).filter(v => v !== null) as number[]);
  const data_completeness = Math.round((scoredDims.length / 8) * 100);

  if (scoredDims.length === 0 && (sessions?.length ?? 0) === 0) {
    // No AI readiness data available at all
    const empty: Omit<AIReadinessProfile, 'id'> = {
      org_id: orgId,
      engagement_id: engagementId,
      session_id: null,
      ...dims,
      composite_score: null,
      data_completeness: 0,
      maturity_tier: null,
      tier_rationale: null,
      top_3_strengths: null,
      top_3_gaps: null,
      generated_at: new Date().toISOString(),
      admin_reviewed_at: null,
    };
    const { data: saved, error } = await supabase
      .from('ai_readiness_profiles')
      .upsert(empty, { onConflict: 'org_id,engagement_id' })
      .select()
      .single();
    if (error) throw error;
    return saved as AIReadinessProfile;
  }

  const composite = scoredDims.length > 0
    ? Math.round(scoredDims.reduce((s, v) => s + v, 0) / scoredDims.length * 10) / 10
    : null;

  const maturity_tier = composite !== null ? computeMaturityTier(composite) : null;

  // Top 3 strengths and gaps
  const scoredEntries = (Object.entries(dims) as [keyof DimensionMap, number | null][])
    .filter(([, v]) => v !== null)
    .map(([k, v]) => ({ key: k, score: v as number, label: DIMENSION_LABELS[k] }))
    .sort((a, b) => b.score - a.score);

  const top_3_strengths = scoredEntries.slice(0, 3).map(e => ({
    dimension: e.label,
    score: e.score,
    insight: `${e.label} scores ${e.score.toFixed(0)}% — a key enabler for AI adoption.`,
  }));

  const top_3_gaps = [...scoredEntries].reverse().slice(0, 3).map(e => ({
    dimension: e.label,
    score: e.score,
    recommendation: `Invest in ${e.label.toLowerCase()} to unblock AI initiatives.`,
  }));

  const profile: Omit<AIReadinessProfile, 'id'> = {
    org_id: orgId,
    engagement_id: engagementId,
    session_id: sessions?.[0]?.id ?? null,
    ...dims,
    composite_score: composite,
    data_completeness,
    maturity_tier,
    tier_rationale: maturity_tier ? tierRationale(maturity_tier) : null,
    top_3_strengths: top_3_strengths.length ? top_3_strengths : null,
    top_3_gaps: top_3_gaps.length ? top_3_gaps : null,
    generated_at: new Date().toISOString(),
    admin_reviewed_at: null,
  };

  const { data: saved, error } = await supabase
    .from('ai_readiness_profiles')
    .upsert(profile, { onConflict: 'org_id,engagement_id' })
    .select()
    .single();
  if (error) throw error;
  return saved as AIReadinessProfile;
}
