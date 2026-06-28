import type {
  APAssessment, APTopic, APQuestion, APAssignment, APSubmission, APResult
} from '../types/assessPro';
import { supabase } from '../lib/supabase';

const BASE_URL    = import.meta.env.VITE_ASSESSPRO_API_BASE_URL as string | undefined;
const READ_KEY    = import.meta.env.VITE_ASSESSPRO_API_KEY      as string | undefined;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL          as string;

export class AssessProApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'AssessProApiError';
  }
}

export function isAssessProConfigured(): boolean {
  return !!(BASE_URL && READ_KEY);
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!BASE_URL || !READ_KEY) {
    throw new AssessProApiError(0, 'NOT_CONFIGURED', 'AssessPro API is not configured. Set VITE_ASSESSPRO_API_BASE_URL and VITE_ASSESSPRO_API_KEY.');
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${READ_KEY}`,
      ...(options.headers ?? {}),
    },
  });

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new AssessProApiError(
      res.status,
      body.error?.code ?? 'ERROR',
      body.error?.message ?? 'AssessPro API error'
    );
  }
  return body.data as T;
}

// ─── Proxy helper (write operations go through StratifyIT's Edge Function) ────

async function proxyPost<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase!.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/proxy-assesspro`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, payload }),
    }
  );

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new AssessProApiError(
      res.status,
      body.error?.code ?? 'PROXY_ERROR',
      body.error?.message ?? 'Proxy request failed'
    );
  }
  return body.data as T;
}

// ─── Catalog (read-only, safe in frontend) ───────────────────────────────────

export async function listAssessments(): Promise<APAssessment[]> {
  return apiFetch<APAssessment[]>('/api-assessments');
}

/** Returns the topics for an assessment by fetching the single-assessment detail endpoint. */
export async function getAssessmentTopics(assessmentId: string): Promise<APTopic[]> {
  const detail = await apiFetch<{ topics?: APTopic[] }>(`/api-assessments/${assessmentId}`);
  return detail.topics ?? [];
}

export async function getTopicQuestions(topicId: string): Promise<APQuestion[]> {
  return apiFetch<APQuestion[]>(`/api-topics/${topicId}/questions`);
}

// ─── Assignments ──────────────────────────────────────────────────────────────

/** List all assignments created by this org's API key. */
export async function getMyAssignments(): Promise<APAssignment[]> {
  return apiFetch<APAssignment[]>('/api-assignments');
}

export async function createAssignment(payload: {
  assessment_id: string;
  assessment_title: string;
  users: Array<{ id: string; email: string; name: string }>;
  org_id: number;
  org_code: string;
  due_date?: string | null;
  pa_assessment_id?: string | null;
}): Promise<Array<{ userId: string; email: string; assignment: unknown }>> {
  return proxyPost('create_assignment', payload);
}

// ─── Submissions (write — go through proxy) ───────────────────────────────────

/** Start a new submission for an assignment. Returns the submission object with its ID. */
export async function startSubmission(assignmentId: string): Promise<APSubmission> {
  return proxyPost<APSubmission>('start_submission', { assignment_id: assignmentId });
}

/** Upsert a batch of answers for an in-progress submission. */
export async function saveAnswers(
  submissionId: string,
  answers: Array<{ question_id: string; answer_id?: string; text_answer?: string }>
): Promise<void> {
  await proxyPost<unknown>('save_answers', { submission_id: submissionId, answers });
}

/** Mark a submission complete; triggers the AssessPro webhook which fires back to StratifyIT. */
export async function completeSubmission(submissionId: string): Promise<void> {
  await proxyPost<unknown>('complete_submission', { submission_id: submissionId });
}

// ─── Results ─────────────────────────────────────────────────────────────────

/** Fetch the scored result for a completed assignment. Takes the AssessPro assignment ID. */
export async function getResult(assignmentId: string): Promise<APResult> {
  return apiFetch<APResult>(`/api-results/${assignmentId}`);
}

// ─── Sync utility ────────────────────────────────────────────────────────────

export async function syncAssignments(): Promise<void> {
  if (!supabase) return;
  const assignments = await getMyAssignments();
  for (const a of assignments) {
    await supabase.from('assessment_assignments_cache').upsert({
      assesspro_assign_id: a.id,
      assesspro_assess_id: a.assessment_id,
      assessment_title:    (a as { assessments?: { title?: string } }).assessments?.title ?? '',
      status:              a.status,
      due_date:            a.due_date,
      assigned_at:         a.assigned_at,
    }, { onConflict: 'assesspro_assign_id', ignoreDuplicates: false });
  }
}
