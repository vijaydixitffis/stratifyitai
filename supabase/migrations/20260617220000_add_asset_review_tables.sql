-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 5: Per-asset document capture + architectural review pipeline
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. it_asset_documents — per-asset knowledge articles (URLs, text, files)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.it_asset_documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       integer     REFERENCES public.client_orgs(org_id) ON DELETE CASCADE,
  asset_id     uuid        NOT NULL REFERENCES public.it_assets(id) ON DELETE CASCADE,

  -- Categorisation
  doc_type     text        NOT NULL DEFAULT 'other'
                CHECK (doc_type IN (
                  'architecture_doc', 'design_decision', 'nfr_spec',
                  'runbook', 'risk_assessment', 'vendor_docs', 'other'
                )),
  title        text        NOT NULL,

  -- Source
  source_type  text        NOT NULL
                CHECK (source_type IN (
                  'url', 'confluence', 'sharepoint', 'github', 'gitlab',
                  'google_drive', 'file_upload', 'paste_text'
                )),
  source_url   text,         -- original URL when source_type != paste_text/file_upload
  access_token text,         -- optional personal access token for private repos/spaces

  -- Content
  content      text,         -- extracted/stored text
  summary      text,         -- AI-generated one-paragraph summary
  word_count   integer,

  -- Fetch lifecycle
  fetch_status text        NOT NULL DEFAULT 'pending'
                CHECK (fetch_status IN ('pending', 'fetching', 'completed', 'failed')),
  fetch_error  text,

  -- File upload metadata (set when source_type = 'file_upload')
  file_name    text,
  file_size    integer,
  mime_type    text,

  -- Audit
  uploaded_by  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_it_asset_documents_asset_id ON public.it_asset_documents(asset_id);
CREATE INDEX IF NOT EXISTS idx_it_asset_documents_org_id   ON public.it_asset_documents(org_id);

ALTER TABLE public.it_asset_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_it_asset_documents"
  ON public.it_asset_documents
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "client_org_access_it_asset_documents"
  ON public.it_asset_documents
  FOR ALL TO authenticated
  USING (
    NOT public.is_admin_user() AND
    org_id = public.get_current_user_org_id()
  )
  WITH CHECK (
    NOT public.is_admin_user() AND
    org_id = public.get_current_user_org_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. it_asset_reviews — per-asset architectural review lifecycle
--    UNIQUE on asset_id: one active review record per asset
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.it_asset_reviews (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       integer     REFERENCES public.client_orgs(org_id) ON DELETE CASCADE,
  asset_id     uuid        NOT NULL REFERENCES public.it_assets(id) ON DELETE CASCADE UNIQUE,

  -- Review lifecycle state
  review_status text       NOT NULL DEFAULT 'pending'
                CHECK (review_status IN (
                  'pending',               -- no review started
                  'reviewing',             -- AI review in progress
                  'questionnaire_pending', -- AI generated questions, not yet assigned
                  'questionnaire_assigned',-- questionnaire assigned in AssessPro
                  'questionnaire_completed',-- all answers returned via webhook
                  'addressed'              -- full architectural review completed
                )),

  -- Completeness
  completeness_score  numeric(5,2),  -- 0-100
  missing_domains     text[],        -- domain ids with insufficient data

  -- Architectural domains (one key per domain, value = {score, notes, status})
  architecture_domains jsonb,

  -- AI-generated questions (when completeness < threshold)
  -- [{id, domain, domain_label, question, type, options?, answer, answered_at}]
  ai_generated_questions jsonb,

  -- AssessPro integration
  assesspro_assessment_id  text,
  assesspro_assignment_id  text,

  -- Review outputs (set when review_status = 'addressed')
  review_summary       text,
  architecture_concerns jsonb,  -- [{domain, severity, concern, recommendation}]

  -- Override flag: user elected to include in rationalization despite low completeness
  override_incomplete  boolean NOT NULL DEFAULT false,

  -- Timestamps
  reviewed_by_ai_at  timestamptz,
  last_assessed_at   timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_it_asset_reviews_asset_id ON public.it_asset_reviews(asset_id);
CREATE INDEX IF NOT EXISTS idx_it_asset_reviews_org_id   ON public.it_asset_reviews(org_id);
CREATE INDEX IF NOT EXISTS idx_it_asset_reviews_status   ON public.it_asset_reviews(review_status);

ALTER TABLE public.it_asset_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_it_asset_reviews"
  ON public.it_asset_reviews
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "client_org_access_it_asset_reviews"
  ON public.it_asset_reviews
  FOR ALL TO authenticated
  USING (
    NOT public.is_admin_user() AND
    org_id = public.get_current_user_org_id()
  )
  WITH CHECK (
    NOT public.is_admin_user() AND
    org_id = public.get_current_user_org_id()
  );

-- Service-role bypass for edge functions (ai-asset-review webhook trigger)
CREATE POLICY "service_role_bypass_it_asset_reviews"
  ON public.it_asset_reviews
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_bypass_it_asset_documents"
  ON public.it_asset_documents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
