import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type InitiativeType =
  | 'rationalization'
  | 'capability-gap-fill'
  | 'modernization'
  | 'risk-mitigation'
  | 'ai-enablement'
  | 'foundation'
  | 'governance';

export type InitiativeHorizon = 'short-term' | 'mid-term' | 'long-term';
export type InitiativeEffort = 'S' | 'M' | 'L' | 'XL';
export type InitiativeCostBand = 'low' | 'medium' | 'high';
export type InitiativeStatus = 'proposed' | 'in-flight' | 'complete' | 'deferred' | 'cancelled';

export interface RoadmapInitiative {
  id: string;
  org_id: number;
  engagement_id: string;
  initiative_type: InitiativeType;
  horizon: InitiativeHorizon;
  title: string;
  description: string | null;
  effort: InitiativeEffort | null;
  cost_band: InitiativeCostBand | null;
  business_value_score: number | null;
  risk_if_delayed: 'low' | 'medium' | 'high' | null;
  linked_asset_ids: string[];
  linked_capability_ids: string[];
  linked_risk_ids: string[];
  milestone_number: 1 | 2 | 3 | null;
  workstream: string | null;
  status: InitiativeStatus;
  sort_order: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getInitiatives(engagementId: string): Promise<RoadmapInitiative[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase
    .from('roadmap_initiatives')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('roadmap_initiatives table not found or inaccessible:', error.message);
    return [];
  }
  return (data ?? []) as RoadmapInitiative[];
}

export async function createInitiative(
  initiative: Omit<RoadmapInitiative, 'id' | 'created_at' | 'updated_at'>,
): Promise<RoadmapInitiative | null> {
  if (!isSupabaseConfigured() || !supabase) return null;
  const { data, error } = await supabase
    .from('roadmap_initiatives')
    .insert(initiative)
    .select()
    .single();
  if (error) throw error;
  return data as RoadmapInitiative;
}

export async function updateInitiative(
  id: string,
  updates: Partial<Pick<RoadmapInitiative,
    'title' | 'description' | 'horizon' | 'initiative_type' | 'effort' |
    'cost_band' | 'business_value_score' | 'risk_if_delayed' | 'status' |
    'workstream' | 'sort_order' | 'linked_asset_ids' | 'linked_risk_ids'
  >>,
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase.from('roadmap_initiatives').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteInitiative(id: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase.from('roadmap_initiatives').delete().eq('id', id);
  if (error) throw error;
}

export const INITIATIVE_TYPE_LABELS: Record<InitiativeType, string> = {
  'rationalization':    'Rationalisation',
  'capability-gap-fill':'Capability Fill',
  'modernization':      'Modernisation',
  'risk-mitigation':    'Risk Mitigation',
  'ai-enablement':      'AI Enablement',
  'foundation':         'Foundation',
  'governance':         'Governance',
};

export const INITIATIVE_TYPE_COLORS: Record<InitiativeType, { bg: string; text: string }> = {
  'rationalization':    { bg: '#f7e7e5', text: '#a23a2f' },
  'capability-gap-fill':{ bg: '#e7f0f9', text: '#175a93' },
  'modernization':      { bg: '#ecebf6', text: '#403592' },
  'risk-mitigation':    { bg: '#f7e7e5', text: '#a23a2f' },
  'ai-enablement':      { bg: '#e7f9ef', text: '#1a6b40' },
  'foundation':         { bg: '#f4f6f9', text: '#2c3e50' },
  'governance':         { bg: '#f6edda', text: '#8a6314' },
};
