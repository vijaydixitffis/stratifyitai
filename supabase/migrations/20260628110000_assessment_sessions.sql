-- Assessment sessions and responses tables (Sprint 1.1)
BEGIN;

CREATE TABLE IF NOT EXISTS public.assessment_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        INT         NOT NULL REFERENCES public.client_orgs(org_id) ON DELETE CASCADE,
  asset_id      UUID        REFERENCES public.it_assets(id) ON DELETE SET NULL,
  assessment_id TEXT        NOT NULL,
  started_by    UUID        REFERENCES auth.users(id),
  completed_at  TIMESTAMPTZ,
  status        TEXT        NOT NULL DEFAULT 'in_progress'
                            CHECK (status IN ('in_progress','completed','flagged')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asess_org     ON public.assessment_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_asess_asset   ON public.assessment_sessions(asset_id);
CREATE INDEX IF NOT EXISTS idx_asess_status  ON public.assessment_sessions(status);

CREATE TABLE IF NOT EXISTS public.assessment_responses (
  id               UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID  NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  question_id      TEXT  NOT NULL,
  answer_option_id TEXT,
  text_answer      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_aresp_session ON public.assessment_responses(session_id);

-- updated_at trigger
CREATE TRIGGER update_assessment_sessions_updated_at
  BEFORE UPDATE ON public.assessment_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.assessment_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_asess" ON public.assessment_sessions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')));

CREATE POLICY "client_org_asess" ON public.assessment_sessions
  FOR ALL TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super'))
    AND org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super'))
    AND org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "admin_full_aresp" ON public.assessment_responses
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assessment_sessions s
    JOIN public.users u ON u.id = auth.uid()
    WHERE s.id = session_id AND u.role IN ('admin','admin-super')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assessment_sessions s
    JOIN public.users u ON u.id = auth.uid()
    WHERE s.id = session_id AND u.role IN ('admin','admin-super')
  ));

CREATE POLICY "client_org_aresp" ON public.assessment_responses
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assessment_sessions s
    JOIN public.users u ON u.id = auth.uid()
    WHERE s.id = session_id
      AND NOT (u.role IN ('admin','admin-super'))
      AND s.org_id = u.org_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assessment_sessions s
    JOIN public.users u ON u.id = auth.uid()
    WHERE s.id = session_id
      AND NOT (u.role IN ('admin','admin-super'))
      AND s.org_id = u.org_id
  ));

GRANT ALL ON public.assessment_sessions  TO authenticated, service_role;
GRANT ALL ON public.assessment_responses TO authenticated, service_role;

COMMIT;
