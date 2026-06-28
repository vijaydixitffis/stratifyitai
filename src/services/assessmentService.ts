import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface AssessmentSession {
  id: string;
  org_id: number;
  asset_id: string | null;
  assessment_id: string;
  started_by: string | null;
  completed_at: string | null;
  status: 'in_progress' | 'completed' | 'flagged';
  created_at: string;
}

export interface AssessmentResponse {
  id: string;
  session_id: string;
  question_id: string;
  answer_option_id: string | null;
  text_answer: string | null;
}

export async function getSessionsForOrg(orgId: number): Promise<AssessmentSession[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase
    .from('assessment_sessions')
    .select('*')
    .eq('org_id', orgId);
  if (error) throw error;
  return data ?? [];
}

export async function getSessionStatus(
  orgId: number,
  assessmentId: string,
  assetId?: string | null,
): Promise<'not_started' | 'in_progress' | 'completed'> {
  if (!isSupabaseConfigured() || !supabase) return 'not_started';
  let query = supabase
    .from('assessment_sessions')
    .select('status')
    .eq('org_id', orgId)
    .eq('assessment_id', assessmentId);
  if (assetId) {
    query = query.eq('asset_id', assetId);
  } else {
    query = query.is('asset_id', null);
  }
  const { data } = await query.limit(1).single();
  if (!data) return 'not_started';
  return data.status === 'completed' ? 'completed' : 'in_progress';
}

export async function startOrResumeSession(
  orgId: number,
  assessmentId: string,
  startedBy: string,
  assetId?: string | null,
): Promise<AssessmentSession> {
  if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase not configured');

  let query = supabase
    .from('assessment_sessions')
    .select('*')
    .eq('org_id', orgId)
    .eq('assessment_id', assessmentId);
  if (assetId) {
    query = query.eq('asset_id', assetId);
  } else {
    query = query.is('asset_id', null);
  }
  const { data: existing } = await query.limit(1).single();
  if (existing) return existing as AssessmentSession;

  const { data, error } = await supabase
    .from('assessment_sessions')
    .insert({
      org_id: orgId,
      assessment_id: assessmentId,
      started_by: startedBy,
      asset_id: assetId ?? null,
      status: 'in_progress',
    })
    .select()
    .single();
  if (error) throw error;
  return data as AssessmentSession;
}

export async function saveResponse(
  sessionId: string,
  questionId: string,
  answerOptionId?: string | null,
  textAnswer?: string | null,
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase
    .from('assessment_responses')
    .upsert({
      session_id: sessionId,
      question_id: questionId,
      answer_option_id: answerOptionId ?? null,
      text_answer: textAnswer ?? null,
    }, { onConflict: 'session_id,question_id' });
  if (error) throw error;
}

export async function completeSession(sessionId: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase
    .from('assessment_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function getResponsesForSession(sessionId: string): Promise<AssessmentResponse[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase
    .from('assessment_responses')
    .select('*')
    .eq('session_id', sessionId);
  if (error) throw error;
  return data ?? [];
}
