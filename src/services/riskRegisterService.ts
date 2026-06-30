import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AssetScoreRecord } from './scoringService';

export interface RiskRegisterItem {
  id: string;
  org_id: number;
  engagement_id: string;
  asset_id: string | null;
  capability_id: string | null;
  risk_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  probability: 'high' | 'medium' | 'low' | null;
  impact: 'high' | 'medium' | 'low' | null;
  risk_score: number | null;
  title: string;
  description: string | null;
  mitigation_hint: string | null;
  owner: string | null;
  target_resolution: string | null;
  status: 'open' | 'mitigating' | 'resolved' | 'accepted';
  source: 'auto' | 'admin-architect' | 'client';
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RAIDItem {
  id: string;
  org_id: number;
  engagement_id: string;
  raid_type: 'risk' | 'assumption' | 'issue' | 'dependency';
  severity: 'critical' | 'high' | 'medium' | 'low' | null;
  probability: 'high' | 'medium' | 'low' | null;
  impact: 'high' | 'medium' | 'low' | null;
  ref_code: string | null;
  title: string;
  description: string | null;
  related_asset_ids: string[];
  related_capability_ids: string[];
  related_risk_ids: string[];
  raised_by: string | null;
  owner: string | null;
  due_date: string | null;
  response_plan: string | null;
  contingency: string | null;
  status: 'open' | 'in-progress' | 'resolved' | 'accepted' | 'invalidated';
  resolution_notes: string | null;
  resolved_at: string | null;
  phase_gate_item: boolean;
  created_at: string;
  updated_at: string;
}

// ── Risk scoring matrix ───────────────────────────────────────────────────────
const PROB_WEIGHT = { high: 3, medium: 2, low: 1 };
const IMPACT_WEIGHT = { high: 3, medium: 2, low: 1 };

function riskScore(prob: 'high' | 'medium' | 'low', impact: 'high' | 'medium' | 'low'): number {
  return PROB_WEIGHT[prob] * IMPACT_WEIGHT[impact];
}

// ── Auto-populate risks from published asset scores ───────────────────────────

interface AssetMeta {
  id: string;
  name: string;
  status: string | null;
  criticality: string | null;
  sourcing_type: string | null;
  end_of_life_date: string | null;
}

export async function autoPopulateRisks(
  orgId: number,
  engagementId: string,
): Promise<{ created: number }> {
  if (!isSupabaseConfigured() || !supabase) return { created: 0 };

  const [scoresRes, assetsRes, heatmapRes] = await Promise.all([
    supabase
      .from('asset_scores')
      .select('*')
      .eq('engagement_id', engagementId)
      .not('published_at', 'is', null),
    supabase
      .from('it_assets')
      .select('id, name, status, criticality, sourcing_type, end_of_life_date')
      .eq('org_id', orgId),
    supabase
      .from('portfolio_heatmap')
      .select('capability_id, gap_flag, ai_gap_flag, concentration_risk')
      .eq('engagement_id', engagementId),
  ]);

  const scores = (scoresRes.data ?? []) as AssetScoreRecord[];
  const assetMap: Record<string, AssetMeta> = {};
  for (const a of (assetsRes.data ?? []) as AssetMeta[]) {
    assetMap[a.id] = a;
  }

  const risks: Omit<RiskRegisterItem, 'id' | 'created_at' | 'updated_at'>[] = [];
  const now = Date.now();
  const within18mo = now + 18 * 30 * 86400_000;

  for (const score of scores) {
    const asset = assetMap[score.asset_id];
    if (!asset) continue;

    // eol-risk
    const eolDate = asset.end_of_life_date ? new Date(asset.end_of_life_date).getTime() : null;
    const isDeprecated = asset.status === 'deprecated';
    if (isDeprecated || (eolDate && eolDate < within18mo)) {
      risks.push({
        org_id: orgId, engagement_id: engagementId,
        asset_id: score.asset_id, capability_id: null,
        risk_type: 'eol-risk',
        severity: isDeprecated ? 'critical' : 'high',
        probability: 'high', impact: 'high',
        risk_score: riskScore('high', 'high'),
        title: `EOL Risk — ${asset.name}`,
        description: isDeprecated
          ? `${asset.name} is deprecated and should be retired or replaced.`
          : `${asset.name} reaches end-of-life within 18 months.`,
        mitigation_hint: 'Plan a decommission or replacement initiative in the short-term roadmap.',
        owner: null, target_resolution: null,
        status: 'open', source: 'auto', admin_notes: null, resolved_at: null,
      });
    }

    // security-exposure
    if (score.security_posture !== null && score.security_posture <= 2) {
      risks.push({
        org_id: orgId, engagement_id: engagementId,
        asset_id: score.asset_id, capability_id: null,
        risk_type: 'security-exposure',
        severity: score.security_posture === 1 ? 'critical' : 'high',
        probability: 'medium', impact: 'high',
        risk_score: riskScore('medium', 'high'),
        title: `Security Exposure — ${asset.name}`,
        description: `${asset.name} has a low security posture score (${score.security_posture}/5).`,
        mitigation_hint: 'Conduct a security audit and remediate gaps before this asset is retained or replatformed.',
        owner: null, target_resolution: null,
        status: 'open', source: 'auto', admin_notes: null, resolved_at: null,
      });
    }

    // technical-debt
    if (
      score.technical_health !== null && score.technical_health <= 2 &&
      score.business_fit !== null && score.business_fit >= 4
    ) {
      risks.push({
        org_id: orgId, engagement_id: engagementId,
        asset_id: score.asset_id, capability_id: null,
        risk_type: 'technical-debt',
        severity: 'high',
        probability: 'high', impact: 'medium',
        risk_score: riskScore('high', 'medium'),
        title: `Technical Debt — ${asset.name}`,
        description: `${asset.name} is business-critical (fit ${score.business_fit}/5) but technically weak (health ${score.technical_health}/5).`,
        mitigation_hint: 'Prioritise refactoring or modernisation to reduce the risk of failure in a high-value asset.',
        owner: null, target_resolution: null,
        status: 'open', source: 'auto', admin_notes: null, resolved_at: null,
      });
    }

    // vendor-lock-in
    if (
      asset.sourcing_type === 'saas' &&
      score.business_fit !== null && score.business_fit >= 4
    ) {
      risks.push({
        org_id: orgId, engagement_id: engagementId,
        asset_id: score.asset_id, capability_id: null,
        risk_type: 'vendor-lock-in',
        severity: 'medium',
        probability: 'medium', impact: 'medium',
        risk_score: riskScore('medium', 'medium'),
        title: `Vendor Lock-in — ${asset.name}`,
        description: `${asset.name} is a SaaS asset with high business fit and no obvious alternative. Vendor dependency could impact the organisation if terms change.`,
        mitigation_hint: 'Ensure contract exit clauses and data portability rights are in place. Evaluate alternatives for the target state.',
        owner: null, target_resolution: null,
        status: 'open', source: 'auto', admin_notes: null, resolved_at: null,
      });
    }

    // licence-cost-risk
    if (
      asset.sourcing_type === 'saas' &&
      score.cost_efficiency !== null && score.cost_efficiency <= 2 &&
      score.business_fit !== null && score.business_fit <= 2
    ) {
      risks.push({
        org_id: orgId, engagement_id: engagementId,
        asset_id: score.asset_id, capability_id: null,
        risk_type: 'licence-cost-risk',
        severity: 'medium',
        probability: 'low', impact: 'medium',
        risk_score: riskScore('low', 'medium'),
        title: `Licence Cost Risk — ${asset.name}`,
        description: `${asset.name} is a low-business-fit SaaS with poor cost efficiency. Consider retiring or replacing.`,
        mitigation_hint: 'Review licence terms at next renewal. Evaluate whether this asset can be decommissioned.',
        owner: null, target_resolution: null,
        status: 'open', source: 'auto', admin_notes: null, resolved_at: null,
      });
    }
  }

  // single-point-of-failure and capability-gap from heatmap
  const heatmapRows = (heatmapRes.data ?? []) as Array<{
    capability_id: string;
    gap_flag: boolean;
    ai_gap_flag: boolean;
    concentration_risk: boolean;
  }>;

  for (const row of heatmapRows) {
    if (row.concentration_risk) {
      risks.push({
        org_id: orgId, engagement_id: engagementId,
        asset_id: null, capability_id: row.capability_id,
        risk_type: 'single-point-of-failure',
        severity: 'critical',
        probability: 'medium', impact: 'high',
        risk_score: riskScore('medium', 'high'),
        title: 'Single Point of Failure — Critical Capability',
        description: 'A critical business capability is served by only one asset. Any failure, degradation, or retirement of that asset would leave the capability uncovered.',
        mitigation_hint: 'Introduce redundancy or an alternative asset for this capability in the mid-term roadmap.',
        owner: null, target_resolution: null,
        status: 'open', source: 'auto', admin_notes: null, resolved_at: null,
      });
    }
    if (row.gap_flag) {
      risks.push({
        org_id: orgId, engagement_id: engagementId,
        asset_id: null, capability_id: row.capability_id,
        risk_type: 'capability-gap',
        severity: 'high',
        probability: 'high', impact: 'high',
        risk_score: riskScore('high', 'high'),
        title: 'Capability Gap — No Supporting Asset',
        description: 'A business capability has no IT asset mapped to it. This gap represents either a blind spot in the inventory or an unmet organisational need.',
        mitigation_hint: 'Clarify whether this capability is intentionally not IT-supported, or whether an asset exists but was not mapped. Add to the target state architecture if needed.',
        owner: null, target_resolution: null,
        status: 'open', source: 'auto', admin_notes: null, resolved_at: null,
      });
    }
    if (row.ai_gap_flag) {
      risks.push({
        org_id: orgId, engagement_id: engagementId,
        asset_id: null, capability_id: row.capability_id,
        risk_type: 'ai-readiness-gap',
        severity: 'high',
        probability: 'high', impact: 'medium',
        risk_score: riskScore('high', 'medium'),
        title: 'AI Readiness Gap — AI-Priority Capability',
        description: 'This capability is designated as an AI strategic priority but the supporting assets have low AI readiness scores. AI initiatives will be blocked without foundational improvements.',
        mitigation_hint: 'Invest in data quality, governance, and infrastructure for this capability before launching AI initiatives.',
        owner: null, target_resolution: null,
        status: 'open', source: 'auto', admin_notes: null, resolved_at: null,
      });
    }
  }

  if (risks.length === 0) return { created: 0 };

  const { error } = await supabase
    .from('risk_register')
    .insert(risks);
  if (error) throw error;

  return { created: risks.length };
}

// ── RAID log CRUD ─────────────────────────────────────────────────────────────

export async function getRAIDItems(
  engagementId: string,
  raidType?: RAIDItem['raid_type'],
): Promise<RAIDItem[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  let q = supabase
    .from('raid_log')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('created_at', { ascending: false });
  if (raidType) q = q.eq('raid_type', raidType);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as RAIDItem[];
}

export async function createRAIDItem(
  item: Omit<RAIDItem, 'id' | 'ref_code' | 'created_at' | 'updated_at'>,
): Promise<RAIDItem> {
  if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('raid_log')
    .insert(item)
    .select()
    .single();
  if (error) throw error;
  return data as RAIDItem;
}

export async function updateRAIDItem(
  id: string,
  updates: Partial<Pick<RAIDItem,
    'title' | 'description' | 'severity' | 'status' | 'owner' | 'due_date' |
    'response_plan' | 'contingency' | 'resolution_notes' | 'phase_gate_item'
  >>,
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const payload: Record<string, unknown> = { ...updates };
  if (updates.status === 'resolved') payload.resolved_at = new Date().toISOString();
  const { error } = await supabase.from('raid_log').update(payload).eq('id', id);
  if (error) throw error;
}

export async function getPhaseGateStatus(engagementId: string): Promise<{
  total: number;
  open: number;
  canAdvance: boolean;
}> {
  if (!isSupabaseConfigured() || !supabase) return { total: 0, open: 0, canAdvance: true };
  const { data } = await supabase
    .from('raid_log')
    .select('status')
    .eq('engagement_id', engagementId)
    .eq('phase_gate_item', true);
  const items = (data ?? []) as Array<{ status: string }>;
  const open = items.filter(i => !['resolved', 'accepted'].includes(i.status)).length;
  return { total: items.length, open, canAdvance: open === 0 };
}

// ── Risk register CRUD ────────────────────────────────────────────────────────

export async function getRisks(engagementId: string): Promise<RiskRegisterItem[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase
    .from('risk_register')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('risk_score', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as RiskRegisterItem[];
}

export async function updateRisk(
  id: string,
  updates: Partial<Pick<RiskRegisterItem, 'status' | 'owner' | 'admin_notes' | 'target_resolution'>>,
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const payload: Record<string, unknown> = { ...updates };
  if (updates.status === 'resolved') payload.resolved_at = new Date().toISOString();
  const { error } = await supabase.from('risk_register').update(payload).eq('id', id);
  if (error) throw error;
}
