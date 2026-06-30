import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CapabilityGapRow {
  id: string;
  org_id: number;
  engagement_id: string;
  capability_id: string;
  supporting_asset_count: number;
  avg_coverage_score:  number | null;
  min_coverage_score:  number | null;
  max_coverage_score:  number | null;
  gap_type: 'no-coverage' | 'under-served' | 'adequate' | 'well-served' | 'over-served' | 'ai-priority-gap';
  strategic_importance: 'critical' | 'high' | 'medium' | 'low' | null;
  is_ai_priority: boolean;
  asset_ids: string[];
  primary_asset_id: string | null;
  gap_description:    string | null;
  recommendation_hint: string | null;
  admin_notes:  string | null;
  validated_by: string | null;
  validated_at: string | null;
  snapshot_at:  string;
}

export interface HeatmapRow {
  id: string;
  engagement_id: string;
  capability_id: string;
  asset_id: string | null;
  composite_score: number | null;
  coverage_score:  number | null;
  gap_flag:           boolean;
  ai_gap_flag:        boolean;
  concentration_risk: boolean;
  redundancy_flag:    boolean;
  snapshot_at: string;
}

type GapType = CapabilityGapRow['gap_type'];

function classifyGap(
  assetCount: number,
  avgScore: number | null,
  isAiPriority: boolean,
): GapType {
  if (assetCount === 0) return 'no-coverage';
  if (assetCount >= 3 && avgScore !== null && avgScore >= 60) return 'over-served';
  if (avgScore === null || avgScore < 40) return isAiPriority ? 'ai-priority-gap' : 'under-served';
  if (avgScore >= 70) return 'well-served';
  return 'adequate';
}

function gapDescription(gapType: GapType, capabilityName: string): string {
  switch (gapType) {
    case 'no-coverage':     return `No IT assets currently support "${capabilityName}". A new solution must be introduced in the target state.`;
    case 'under-served':    return `"${capabilityName}" is weakly supported — the assets serving it have low health or coverage scores.`;
    case 'adequate':        return `"${capabilityName}" is adequately covered. Minor improvements may be beneficial.`;
    case 'well-served':     return `"${capabilityName}" is well-covered by the existing asset portfolio.`;
    case 'over-served':     return `"${capabilityName}" has redundant assets. Rationalisation is recommended.`;
    case 'ai-priority-gap': return `"${capabilityName}" is a strategic AI priority but has insufficient asset readiness. Foundational work is needed before AI can be deployed here.`;
  }
}

function recommendationHint(gapType: GapType): string {
  switch (gapType) {
    case 'no-coverage':     return 'Procure or build a new asset to cover this capability in the target state architecture.';
    case 'under-served':    return 'Refactor or replace the existing asset(s) to improve coverage quality.';
    case 'adequate':        return 'Retain with a minor replatform or optimisation initiative.';
    case 'well-served':     return 'Retain as-is. Evaluate as a candidate for capability reuse across other areas.';
    case 'over-served':     return 'Retire or consolidate redundant assets serving this capability.';
    case 'ai-priority-gap': return 'Resolve data quality, governance, and infrastructure gaps before launching AI initiatives in this capability.';
  }
}

export async function getCapabilityGaps(engagementId: string): Promise<CapabilityGapRow[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase
    .from('capability_gap_analysis')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('gap_type');
  if (error) throw error;
  return (data ?? []) as CapabilityGapRow[];
}

export async function getHeatmapData(engagementId: string): Promise<HeatmapRow[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase
    .from('portfolio_heatmap')
    .select('*')
    .eq('engagement_id', engagementId);
  if (error) throw error;
  return (data ?? []) as HeatmapRow[];
}

export async function computeCapabilityGaps(
  orgId: number,
  engagementId: string,
): Promise<{ processed: number }> {
  if (!isSupabaseConfigured() || !supabase) return { processed: 0 };

  // Fetch all capabilities for this org
  const { data: capabilities, error: capErr } = await supabase
    .from('business_capabilities')
    .select('id, name, strategic_importance, is_ai_priority')
    .eq('org_id', orgId);
  if (capErr) throw capErr;
  if (!capabilities?.length) return { processed: 0 };

  // Fetch all asset_capability_mappings with scores
  const { data: mappings } = await supabase
    .from('asset_capability_mappings')
    .select('asset_id, capability_id, confidence_score')
    .eq('org_id', orgId);

  // Fetch published asset scores for this engagement
  const { data: scores } = await supabase
    .from('asset_scores')
    .select('asset_id, composite_score')
    .eq('engagement_id', engagementId)
    .not('published_at', 'is', null);

  // Build asset_id → composite_score lookup
  const scoreMap: Record<string, number | null> = {};
  for (const s of (scores ?? []) as Array<{ asset_id: string; composite_score: number | null }>) {
    scoreMap[s.asset_id] = s.composite_score;
  }

  // Group mappings by capability
  const capabilityAssets: Record<string, string[]> = {};
  for (const m of (mappings ?? []) as Array<{ asset_id: string; capability_id: string }>) {
    if (!capabilityAssets[m.capability_id]) capabilityAssets[m.capability_id] = [];
    capabilityAssets[m.capability_id].push(m.asset_id);
  }

  const gapUpserts: Record<string, unknown>[] = [];
  const heatmapUpserts: Record<string, unknown>[] = [];

  for (const cap of capabilities as Array<{ id: string; name: string; strategic_importance: string | null; is_ai_priority: boolean }>) {
    const assetIds = capabilityAssets[cap.id] ?? [];
    const coveredScores = assetIds.map(id => scoreMap[id]).filter((s): s is number => s !== null);

    const supporting_asset_count = assetIds.length;
    const avg_coverage_score = coveredScores.length
      ? Math.round(coveredScores.reduce((s, v) => s + v, 0) / coveredScores.length * 10) / 10
      : null;
    const min_coverage_score = coveredScores.length ? Math.min(...coveredScores) : null;
    const max_coverage_score = coveredScores.length ? Math.max(...coveredScores) : null;

    const gap_type = classifyGap(supporting_asset_count, avg_coverage_score, cap.is_ai_priority);
    const primaryAsset = assetIds[0] ?? null;

    gapUpserts.push({
      org_id:                  orgId,
      engagement_id:           engagementId,
      capability_id:           cap.id,
      supporting_asset_count,
      avg_coverage_score,
      min_coverage_score,
      max_coverage_score,
      gap_type,
      strategic_importance:    cap.strategic_importance,
      is_ai_priority:          cap.is_ai_priority,
      asset_ids:               assetIds,
      primary_asset_id:        primaryAsset,
      gap_description:         gapDescription(gap_type, cap.name),
      recommendation_hint:     recommendationHint(gap_type),
      snapshot_at:             new Date().toISOString(),
    });

    // Heatmap rows: one per asset, plus a gap row when no assets
    if (assetIds.length === 0) {
      heatmapUpserts.push({
        org_id: orgId,
        engagement_id: engagementId,
        capability_id: cap.id,
        asset_id: null,
        composite_score: null,
        coverage_score: null,
        gap_flag: true,
        ai_gap_flag: cap.is_ai_priority,
        concentration_risk: false,
        redundancy_flag: false,
        snapshot_at: new Date().toISOString(),
      });
    } else {
      const concentration_risk = assetIds.length === 1 && cap.strategic_importance === 'critical';
      const redundancy_flag = assetIds.length >= 3;

      for (const assetId of assetIds) {
        heatmapUpserts.push({
          org_id: orgId,
          engagement_id: engagementId,
          capability_id: cap.id,
          asset_id: assetId,
          composite_score: scoreMap[assetId] ?? null,
          is_primary_support: assetId === primaryAsset,
          coverage_score: avg_coverage_score,
          gap_flag: false,
          ai_gap_flag: cap.is_ai_priority && (avg_coverage_score === null || avg_coverage_score < 40),
          concentration_risk,
          redundancy_flag,
          snapshot_at: new Date().toISOString(),
        });
      }
    }
  }

  const [gapErr, heatErr] = await Promise.all([
    supabase
      .from('capability_gap_analysis')
      .upsert(gapUpserts, { onConflict: 'engagement_id,capability_id' })
      .then(r => r.error),
    supabase
      .from('portfolio_heatmap')
      .upsert(heatmapUpserts, { onConflict: 'engagement_id,capability_id,asset_id' })
      .then(r => r.error),
  ]);

  if (gapErr) throw gapErr;
  if (heatErr) throw heatErr;

  return { processed: capabilities.length };
}

export async function updateCapabilityGapAdmin(
  gapId: string,
  updates: Pick<CapabilityGapRow, 'strategic_importance' | 'admin_notes'>,
  validatedBy: string,
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase
    .from('capability_gap_analysis')
    .update({
      ...updates,
      validated_by: validatedBy,
      validated_at: new Date().toISOString(),
    })
    .eq('id', gapId);
  if (error) throw error;
}
