import { supabase } from '../lib/supabase';
import type { AssetDocument, AssetReview, DocType, SourceType, GeneratedQuestion } from '../types/assetReview';

/** Sanitize a filename for use in Storage paths (spaces → underscores, keep extension). */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
}

// ─────────────────────────────────────────────────────────────────────────────
// Document service
// ─────────────────────────────────────────────────────────────────────────────
export const AssetDocumentService = {

  async getDocuments(assetId: string): Promise<AssetDocument[]> {
    const { data, error } = await supabase!
      .from('it_asset_documents')
      .select('*')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async addDocument(params: {
    asset_id: string;
    org_id: number;
    title: string;
    doc_type: DocType;
    source_type: SourceType;
    source_url?: string;
    access_token?: string;
    content?: string;          // for paste_text
    uploaded_by?: string;
  }): Promise<AssetDocument> {
    const { data, error } = await supabase!
      .from('it_asset_documents')
      .insert({
        ...params,
        fetch_status: params.source_type === 'paste_text' ? 'completed' : 'pending',
        word_count: params.content ? params.content.split(/\s+/).filter(Boolean).length : undefined,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteDocument(id: string): Promise<void> {
    const { error } = await supabase!.from('it_asset_documents').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  /** Trigger the ai-doc-fetch edge function for a URL-based document. */
  async fetchDocument(documentId: string): Promise<{ content?: string; summary?: string }> {
    const { data: { session } } = await supabase!.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-doc-fetch`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ document_id: documentId }),
      }
    );
    const json = await res.json();
    if (!json.success) throw new Error(json.error ?? 'Fetch failed');
    return json.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Review service
// ─────────────────────────────────────────────────────────────────────────────
export const AssetReviewService = {

  async getReview(assetId: string): Promise<AssetReview | null> {
    const { data, error } = await supabase!
      .from('it_asset_reviews')
      .select('*')
      .eq('asset_id', assetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async getReviewsForOrg(orgId: number): Promise<AssetReview[]> {
    const { data, error } = await supabase!
      .from('it_asset_reviews')
      .select('*')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Call ai-asset-review edge function to start / continue a review. */
  async startReview(params: {
    asset_id: string;
    org_id: number;
    org_code: string;
    override_incomplete?: boolean;
    questionnaire_answers?: Array<{ question_id: string; question: string; answer: string }>;
  }): Promise<{
    action: 'questionnaire_generated' | 'review_completed';
    review_id: string;
    completeness?: number;
    missing?: string[];
    questions?: GeneratedQuestion[];
    review_summary?: string;
    architecture_concerns?: unknown[];
  }> {
    const { data: { session } } = await supabase!.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-asset-review`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify(params),
      }
    );
    const json = await res.json();
    if (!json.success) throw new Error(json.error ?? 'Review failed');
    return json;
  },

  /** Create AssessPro assessment + assignment for the generated questions. */
  async createAssessproQuestionnaire(params: {
    asset_id: string;
    asset_name: string;
    org_id: number;
    org_code: string;
    questions: GeneratedQuestion[];
    assign_to_users: Array<{ id: string; email: string; name: string }>;
    due_date?: string;
  }): Promise<{ assessment_id: string; assessment_title: string }> {
    const { data: { session } } = await supabase!.auth.getSession();

    // Group questions by domain into topics
    const domainMap = new Map<string, { label: string; questions: GeneratedQuestion[] }>();
    for (const q of params.questions) {
      if (!domainMap.has(q.domain)) {
        domainMap.set(q.domain, { label: q.domain_label, questions: [] });
      }
      domainMap.get(q.domain)!.questions.push(q);
    }

    const topics = Array.from(domainMap.entries()).map(([, { label, questions }]) => ({
      title: label,
      questions: questions.map(q => ({
        question: q.question,
        type: q.type,
        options: q.options,
      })),
    }));

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-assesspro`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          action: 'create_assessment',
          payload: {
            org_id:         params.org_id,
            org_code:       params.org_code,
            asset_id:       params.asset_id,
            title:          `Architecture Review: ${params.asset_name}`,
            description:    `AI-generated architectural questionnaire for ${params.asset_name}`,
            topics,
            assign_to_users: params.assign_to_users,
            due_date:        params.due_date,
          },
        }),
      }
    );
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message ?? 'AssessPro create_assessment failed');
    return json.data;
  },

  /**
   * Upload a file to Supabase Storage under {orgCode}/{assetId}/{filename},
   * insert an it_asset_documents record, then trigger ai-doc-fetch for extraction.
   */
  async uploadDocumentFile(params: {
    file: File;
    asset_id: string;
    org_id: number;
    org_code: string;
    title: string;
    doc_type: DocType;
    uploaded_by?: string;
  }): Promise<AssetDocument> {
    const safeName = sanitizeFilename(params.file.name);
    const storagePath = `${params.org_code}/${params.asset_id}/${Date.now()}_${safeName}`;

    // 1. Upload to Storage
    const { error: uploadErr } = await supabase!.storage
      .from('asset-documents')
      .upload(storagePath, params.file, { upsert: false });
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    // 2. Get a long-lived signed URL (1 year)
    const { data: urlData, error: urlErr } = await supabase!.storage
      .from('asset-documents')
      .createSignedUrl(storagePath, 86400 * 365);
    if (urlErr || !urlData?.signedUrl) throw new Error('Failed to create signed URL');

    // 3. Insert document record
    const { data, error } = await supabase!
      .from('it_asset_documents')
      .insert({
        asset_id:    params.asset_id,
        org_id:      params.org_id,
        title:       params.title,
        doc_type:    params.doc_type,
        source_type: 'file_upload' as SourceType,
        source_url:  urlData.signedUrl,
        file_name:   params.file.name,
        file_size:   params.file.size,
        mime_type:   params.file.type,
        uploaded_by: params.uploaded_by,
        fetch_status: 'pending',
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // 4. Trigger ai-doc-fetch for text extraction (non-blocking)
    AssetDocumentService.fetchDocument(data.id).catch(console.error);
    return data;
  },

  async setOverrideIncomplete(reviewId: string, value: boolean): Promise<void> {
    const { error } = await supabase!
      .from('it_asset_reviews')
      .update({ override_incomplete: value, updated_at: new Date().toISOString() })
      .eq('id', reviewId);
    if (error) throw new Error(error.message);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio review summary helpers
// ─────────────────────────────────────────────────────────────────────────────
export interface PortfolioReviewSummary {
  total: number;
  addressed: number;
  questionnaire: number;
  pending: number;
  readinessPercent: number;
  canRunRationalization: boolean;
}

/** Manually trigger portfolio rationalization for the given org. */
export async function runRationalization(orgId: number, orgCode: string): Promise<string> {
  // 1. Create the ai_analyses row
  const { data: row, error } = await supabase!
    .from('ai_analyses')
    .insert({
      org_id:     orgId,
      org_code:   orgCode,
      asset_snapshot: [],
      status:     'pending',
    })
    .select('id')
    .single();
  if (error || !row) throw new Error(error?.message ?? 'Failed to create analysis row');

  // 2. Invoke edge function (fire-and-forget; returns immediately)
  supabase!.functions.invoke('ai-rationalization', {
    body: {
      analysis_id: row.id,
      org_id:      orgId,
      org_code:    orgCode,
      topic_scores: [],
      assessment_title: 'Manual Asset Review Rationalization',
      percentage:  0,
      source:      'manual_trigger',
    },
  }).catch(console.error);

  return row.id;
}

export async function getPortfolioReviewSummary(orgId: number, totalAssets: number): Promise<PortfolioReviewSummary> {
  const { data, error } = await supabase!
    .from('it_asset_reviews')
    .select('review_status, override_incomplete')
    .eq('org_id', orgId);

  if (error) throw new Error(error.message);

  const reviews = data ?? [];
  const addressed = reviews.filter(r =>
    r.review_status === 'addressed' || r.override_incomplete
  ).length;
  const questionnaire = reviews.filter(r =>
    ['questionnaire_pending', 'questionnaire_assigned', 'questionnaire_completed'].includes(r.review_status)
  ).length;
  const pending = totalAssets - addressed - questionnaire;
  const readinessPercent = totalAssets > 0 ? Math.round((addressed / totalAssets) * 100) : 0;

  return {
    total:              totalAssets,
    addressed,
    questionnaire,
    pending,
    readinessPercent,
    canRunRationalization: addressed > 0,
  };
}
