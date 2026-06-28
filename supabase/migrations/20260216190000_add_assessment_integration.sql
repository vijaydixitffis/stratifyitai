-- Migration: Assessment integration + AI analysis tables
-- Track B Week 1

BEGIN;

-- 1. Add assesspro_assessment_id to existing pa_assessments table
ALTER TABLE public.pa_assessments
  ADD COLUMN IF NOT EXISTS assesspro_assessment_id TEXT;

-- 2. Cache of AssessPro assignments scoped to this org
CREATE TABLE IF NOT EXISTS public.assessment_assignments_cache (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assesspro_assign_id TEXT NOT NULL UNIQUE,
  org_id              INTEGER NOT NULL REFERENCES public.client_orgs(org_id),
  org_code            TEXT NOT NULL,
  assesspro_assess_id TEXT NOT NULL,
  pa_assessment_id    TEXT,
  assessment_title    TEXT NOT NULL,
  assigned_to_user_id UUID REFERENCES public.users(id),
  assigned_by_user_id UUID REFERENCES public.users(id),
  status              TEXT DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED','STARTED','COMPLETED')),
  due_date            TIMESTAMPTZ,
  assigned_at         TIMESTAMPTZ DEFAULT NOW(),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aac_org_id   ON public.assessment_assignments_cache(org_id);
CREATE INDEX IF NOT EXISTS idx_aac_user_id  ON public.assessment_assignments_cache(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_aac_status   ON public.assessment_assignments_cache(status);
CREATE INDEX IF NOT EXISTS idx_aac_org_code ON public.assessment_assignments_cache(org_code);

-- 3. Cache of AssessPro submission results (written by webhook handler)
CREATE TABLE IF NOT EXISTS public.assessment_results_cache (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assesspro_sub_id     TEXT NOT NULL UNIQUE,
  assignment_cache_id  UUID REFERENCES public.assessment_assignments_cache(id),
  org_id               INTEGER NOT NULL REFERENCES public.client_orgs(org_id),
  org_code             TEXT NOT NULL,
  assesspro_assess_id  TEXT NOT NULL,
  assessment_title     TEXT,
  total_score          INTEGER,
  max_score            INTEGER,
  percentage           INTEGER,
  topic_scores         JSONB,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arc_org_id ON public.assessment_results_cache(org_id);
CREATE INDEX IF NOT EXISTS idx_arc_assess ON public.assessment_results_cache(assesspro_assess_id);

-- 4. AI analysis output (written by ai-rationalization Edge Function)
CREATE TABLE IF NOT EXISTS public.ai_analyses (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  INTEGER NOT NULL REFERENCES public.client_orgs(org_id),
  org_code                TEXT NOT NULL,
  result_cache_id         UUID REFERENCES public.assessment_results_cache(id),
  assesspro_sub_id        TEXT,
  asset_snapshot          JSONB NOT NULL DEFAULT '[]'::JSONB,
  rationalization_results JSONB,
  summary_text            TEXT,
  ai_model                TEXT DEFAULT 'claude-sonnet-4-6',
  prompt_version          TEXT DEFAULT 'v1',
  status                  TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  error_message           TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_org_id ON public.ai_analyses(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_status ON public.ai_analyses(status);
CREATE INDEX IF NOT EXISTS idx_ai_sub_id ON public.ai_analyses(assesspro_sub_id);

-- 5. AI-generated roadmap items (child of ai_analyses)
CREATE TABLE IF NOT EXISTS public.roadmap_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id      UUID NOT NULL REFERENCES public.ai_analyses(id) ON DELETE CASCADE,
  org_id           INTEGER NOT NULL REFERENCES public.client_orgs(org_id),
  title            TEXT NOT NULL,
  description      TEXT,
  initiative_type  TEXT,
  effort           TEXT CHECK (effort IN ('Low','Medium','High')),
  impact           TEXT CHECK (impact IN ('Low','Medium','High')),
  priority_score   INTEGER CHECK (priority_score BETWEEN 1 AND 10),
  affected_assets  TEXT[],
  time_horizon     TEXT,
  status           TEXT DEFAULT 'open' CHECK (status IN ('open','in-progress','completed','deferred')),
  sequence_number  INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ri_analysis_id ON public.roadmap_items(analysis_id);
CREATE INDEX IF NOT EXISTS idx_ri_org_id      ON public.roadmap_items(org_id);
CREATE INDEX IF NOT EXISTS idx_ri_priority    ON public.roadmap_items(priority_score DESC);

-- 6. Updated_at triggers for new tables
CREATE TRIGGER update_aac_updated_at
  BEFORE UPDATE ON public.assessment_assignments_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_analyses_updated_at
  BEFORE UPDATE ON public.ai_analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roadmap_items_updated_at
  BEFORE UPDATE ON public.roadmap_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. RLS policies

ALTER TABLE public.assessment_assignments_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_aac" ON public.assessment_assignments_cache
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')));

CREATE POLICY "client_org_access_aac" ON public.assessment_assignments_cache
  FOR SELECT TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')) AND
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  );

ALTER TABLE public.assessment_results_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_arc" ON public.assessment_results_cache
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')));

CREATE POLICY "client_org_access_arc" ON public.assessment_results_cache
  FOR SELECT TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')) AND
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  );

ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_ai" ON public.ai_analyses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')));

CREATE POLICY "client_org_access_ai" ON public.ai_analyses
  FOR SELECT TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')) AND
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  );

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_ri" ON public.roadmap_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')));

CREATE POLICY "client_org_access_ri" ON public.roadmap_items
  FOR SELECT TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')) AND
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  );

-- 8. Grants
GRANT ALL ON public.assessment_assignments_cache TO authenticated, service_role;
GRANT ALL ON public.assessment_results_cache TO authenticated, service_role;
GRANT ALL ON public.ai_analyses TO authenticated, service_role;
GRANT ALL ON public.roadmap_items TO authenticated, service_role;

COMMIT;
