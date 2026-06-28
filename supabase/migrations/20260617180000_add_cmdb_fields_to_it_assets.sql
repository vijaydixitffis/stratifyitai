-- CMDB-Grade Schema Enhancement for it_assets
-- Adds lifecycle, financial, compliance, identity, and environment columns
-- following ISO/IEC 19770-1 SAM + ServiceNow CMDB CI base-class pattern.
-- All new columns are nullable — no breaking change to existing rows.
-- Also creates it_asset_relationships for the CI dependency/hosting graph.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. New columns on it_assets
-- ─────────────────────────────────────────────────────────────────────────────

-- Identification
ALTER TABLE public.it_assets
  ADD COLUMN IF NOT EXISTS asset_tag         text,           -- business-facing CI ID (e.g. BJBK-APP-0042)
  ADD COLUMN IF NOT EXISTS vendor            text,           -- manufacturer / SaaS / COTS provider
  ADD COLUMN IF NOT EXISTS sourcing_type     text            -- cots | custom_built | open_source | saas
    CHECK (sourcing_type IS NULL OR sourcing_type IN ('cots','custom_built','open_source','saas'));

-- Ownership / Organisation
ALTER TABLE public.it_assets
  ADD COLUMN IF NOT EXISTS business_unit     text;           -- distinct from technical owner

-- Environment & Hosting (all types)
ALTER TABLE public.it_assets
  ADD COLUMN IF NOT EXISTS environment       text            -- production | staging | development | test | dr
    CHECK (environment IS NULL OR environment IN ('production','staging','development','test','dr'));

-- Infra/cloud-service identity fields
-- NOTE: For application / database / middleware / third-party-service rows these SHOULD be NULL.
-- The software CI reaches host identity via an it_asset_relationships 'runs_on' edge instead.
ALTER TABLE public.it_assets
  ADD COLUMN IF NOT EXISTS hostname          text,
  ADD COLUMN IF NOT EXISTS ip_address        text,
  ADD COLUMN IF NOT EXISTS serial_number     text,
  ADD COLUMN IF NOT EXISTS location          text;           -- DC / region / site

-- Lifecycle dates
ALTER TABLE public.it_assets
  ADD COLUMN IF NOT EXISTS purchase_date         date,
  ADD COLUMN IF NOT EXISTS warranty_end_date     date,
  ADD COLUMN IF NOT EXISTS end_of_life_date      date,       -- vendor EOL (software EOL equally important)
  ADD COLUMN IF NOT EXISTS end_of_support_date   date,       -- vendor EOS — key signal for Retire/Replace AI
  ADD COLUMN IF NOT EXISTS last_reviewed_date    date;

-- Financial
ALTER TABLE public.it_assets
  ADD COLUMN IF NOT EXISTS annual_cost           numeric(14,2),
  ADD COLUMN IF NOT EXISTS license_type          text,       -- perpetual | subscription | open_source | saas
  ADD COLUMN IF NOT EXISTS license_expiry_date   date,
  ADD COLUMN IF NOT EXISTS support_contract_id   text;

-- Compliance & Risk
ALTER TABLE public.it_assets
  ADD COLUMN IF NOT EXISTS data_classification   text        -- public | internal | confidential | restricted
    CHECK (data_classification IS NULL OR data_classification IN ('public','internal','confidential','restricted')),
  ADD COLUMN IF NOT EXISTS compliance_tags       text[],     -- {PCI,HIPAA,SOX,GDPR}
  ADD COLUMN IF NOT EXISTS criticality_justification text;   -- free-text rationale for criticality level

-- Audit
ALTER TABLE public.it_assets
  ADD COLUMN IF NOT EXISTS updated_by            text;       -- email of last editor (pairs with created_by)

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Indexes on the most-queried new columns
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_it_assets_environment
  ON public.it_assets (environment) WHERE environment IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_it_assets_end_of_support
  ON public.it_assets (end_of_support_date) WHERE end_of_support_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_it_assets_end_of_life
  ON public.it_assets (end_of_life_date) WHERE end_of_life_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_it_assets_data_classification
  ON public.it_assets (data_classification) WHERE data_classification IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_it_assets_sourcing_type
  ON public.it_assets (sourcing_type) WHERE sourcing_type IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. it_asset_relationships — CMDB CI relationship graph
-- ─────────────────────────────────────────────────────────────────────────────
-- Relationship types:
--   runs_on      : software/middleware CI → the infra/cloud CI hosting it
--   depends_on   : CI A cannot function without CI B
--   connects_to  : network-level connection (API-to-API, app-to-db)
--   part_of      : component membership (microservice → product)
--   backs_up     : backup/DR pair

CREATE TABLE IF NOT EXISTS public.it_asset_relationships (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             integer     REFERENCES public.client_orgs(org_id) ON DELETE CASCADE,
  source_asset_id    uuid        NOT NULL REFERENCES public.it_assets(id) ON DELETE CASCADE,
  target_asset_id    uuid        NOT NULL REFERENCES public.it_assets(id) ON DELETE CASCADE,
  relationship_type  text        NOT NULL
    CHECK (relationship_type IN ('runs_on','depends_on','connects_to','part_of','backs_up')),
  notes              text,
  created_at         timestamptz DEFAULT now(),
  created_by         text,
  CONSTRAINT no_self_reference CHECK (source_asset_id <> target_asset_id)
);

-- Prevent exact duplicate edges
CREATE UNIQUE INDEX IF NOT EXISTS uniq_it_asset_relationship
  ON public.it_asset_relationships (source_asset_id, target_asset_id, relationship_type);

CREATE INDEX IF NOT EXISTS idx_it_asset_rel_source
  ON public.it_asset_relationships (source_asset_id);

CREATE INDEX IF NOT EXISTS idx_it_asset_rel_target
  ON public.it_asset_relationships (target_asset_id);

CREATE INDEX IF NOT EXISTS idx_it_asset_rel_org
  ON public.it_asset_relationships (org_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS for it_asset_relationships
--    Reuses helper functions is_admin_user() / get_current_user_org_id()
--    already created in 20250928195000_fix_it_assets_rls.sql
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.it_asset_relationships ENABLE ROW LEVEL SECURITY;

-- Admin gets full access
CREATE POLICY "admin_full_access_it_asset_relationships"
  ON public.it_asset_relationships
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Client users can access relationships that belong to their org
CREATE POLICY "client_org_access_it_asset_relationships"
  ON public.it_asset_relationships
  FOR ALL TO authenticated
  USING (
    NOT public.is_admin_user() AND
    org_id = public.get_current_user_org_id()
  )
  WITH CHECK (
    NOT public.is_admin_user() AND
    org_id = public.get_current_user_org_id()
  );

COMMIT;
