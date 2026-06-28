-- Asset-to-capability mapping table
BEGIN;

CREATE TABLE IF NOT EXISTS public.asset_capability_mappings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            INT         NOT NULL REFERENCES public.client_orgs(org_id) ON DELETE CASCADE,
  asset_id          UUID        NOT NULL REFERENCES public.it_assets(id) ON DELETE CASCADE,
  capability_id     UUID        NOT NULL REFERENCES public.business_capabilities(id) ON DELETE CASCADE,
  mapping_type      TEXT        NOT NULL DEFAULT 'manual'
                                CHECK (mapping_type IN ('manual','ai_suggested','confirmed')),
  confidence_score  NUMERIC(4,3),  -- 0.000 to 1.000
  rationale         TEXT,
  created_by        UUID        REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, capability_id)
);

CREATE INDEX IF NOT EXISTS idx_acm_org        ON public.asset_capability_mappings(org_id);
CREATE INDEX IF NOT EXISTS idx_acm_asset      ON public.asset_capability_mappings(asset_id);
CREATE INDEX IF NOT EXISTS idx_acm_capability ON public.asset_capability_mappings(capability_id);
CREATE INDEX IF NOT EXISTS idx_acm_type       ON public.asset_capability_mappings(mapping_type);

CREATE TRIGGER update_acm_updated_at
  BEFORE UPDATE ON public.asset_capability_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.asset_capability_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY acm_admin_full ON public.asset_capability_mappings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')));

CREATE POLICY acm_client_org ON public.asset_capability_mappings
  FOR ALL TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super'))
    AND org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super'))
    AND org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  );

GRANT ALL ON public.asset_capability_mappings TO authenticated, service_role;

COMMIT;
