import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface Engagement {
  id: string;
  org_id: number;
  name: string;
  current_phase: number;
  scoring_weights: Record<string, number> | null;
  phase1_approved_at: string | null;
  phase1_approved_by: string | null;
  phase2_approved_at: string | null;
  phase2_approved_by: string | null;
  phase3_approved_at: string | null;
  phase3_approved_by: string | null;
  status: 'active' | 'completed' | 'paused' | 'archived';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SCORING_WEIGHTS = {
  technical_health:  0.25,
  business_fit:      0.20,
  cloud_readiness:   0.15,
  security_posture:  0.15,
  ai_readiness:      0.10,
  operational_risk:  0.10,
  cost_efficiency:   0.05,
};

export function getDefaultWeights(): Record<string, number> {
  return { ...DEFAULT_SCORING_WEIGHTS };
}

export async function getOrCreateEngagement(orgId: number, userId?: string): Promise<Engagement | null> {
  if (!isSupabaseConfigured() || !supabase) return null;

  const { data: existing, error: fetchErr } = await supabase
    .from('engagements')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (existing) return existing as Engagement;

  const { data, error } = await supabase
    .from('engagements')
    .insert({
      org_id: orgId,
      name: 'IT Rationalization Engagement',
      created_by: userId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Engagement;
}

export async function getEngagement(engagementId: string): Promise<Engagement | null> {
  if (!isSupabaseConfigured() || !supabase) return null;
  const { data, error } = await supabase
    .from('engagements')
    .select('*')
    .eq('id', engagementId)
    .single();
  if (error) return null;
  return data as Engagement;
}

export async function getEngagementsForOrg(orgId: number): Promise<Engagement[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase
    .from('engagements')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Engagement[];
}

export async function updateEngagement(
  engagementId: string,
  updates: Partial<Pick<Engagement, 'name' | 'scoring_weights' | 'status'>>,
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase
    .from('engagements')
    .update(updates)
    .eq('id', engagementId);
  if (error) throw error;
}

export async function approvePhaseGate(
  engagementId: string,
  phase: 2 | 3,
  approvedBy: string,
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const col = `phase${phase}_approved`;
  const { error } = await supabase
    .from('engagements')
    .update({
      [`${col}_at`]: new Date().toISOString(),
      [`${col}_by`]: approvedBy,
      current_phase: phase,
    })
    .eq('id', engagementId);
  if (error) throw error;
}
