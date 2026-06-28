-- Business capabilities table for CapabilityMapper (Sprint 1.4)
BEGIN;

CREATE TABLE IF NOT EXISTS public.business_capabilities (
  id                    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                INT   NOT NULL REFERENCES public.client_orgs(org_id) ON DELETE CASCADE,
  level                 INT   NOT NULL CHECK (level IN (1,2,3)),
  parent_id             UUID  REFERENCES public.business_capabilities(id) ON DELETE CASCADE,
  name                  TEXT  NOT NULL,
  description           TEXT,
  is_ai_priority        BOOLEAN NOT NULL DEFAULT FALSE,
  strategic_importance  TEXT  NOT NULL DEFAULT 'medium'
                              CHECK (strategic_importance IN ('critical','high','medium','low')),
  sort_order            INT   NOT NULL DEFAULT 0,
  created_by            UUID  REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bcap_org    ON public.business_capabilities(org_id);
CREATE INDEX IF NOT EXISTS idx_bcap_parent ON public.business_capabilities(parent_id);
CREATE INDEX IF NOT EXISTS idx_bcap_level  ON public.business_capabilities(level);

-- Org mission/vision stored as a simple key-value on the org
ALTER TABLE public.client_orgs
  ADD COLUMN IF NOT EXISTS mission_statement TEXT,
  ADD COLUMN IF NOT EXISTS strategic_goals   TEXT;

CREATE TRIGGER update_bcap_updated_at
  BEFORE UPDATE ON public.business_capabilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.business_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_bcap" ON public.business_capabilities
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')));

CREATE POLICY "client_rw_bcap" ON public.business_capabilities
  FOR ALL TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super'))
    AND org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super'))
    AND org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  );

GRANT ALL ON public.business_capabilities TO authenticated, service_role;

COMMIT;
