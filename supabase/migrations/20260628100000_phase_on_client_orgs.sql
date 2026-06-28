-- Phase tracking columns on client_orgs (Sprint 0.1)
BEGIN;

ALTER TABLE public.client_orgs
  ADD COLUMN IF NOT EXISTS current_phase   INT         DEFAULT 1,
  ADD COLUMN IF NOT EXISTS phase1_approved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phase1_approved_by  UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS phase2_approved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phase2_approved_by  UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.client_orgs.current_phase IS '1=Discover, 2=Analyze, 3=Recommend & Transform';

COMMIT;
