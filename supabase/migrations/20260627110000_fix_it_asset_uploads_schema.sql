-- Fix it_asset_uploads table schema to match application expectations
-- The current schema is missing columns needed for CSV upload tracking

BEGIN;

-- Drop existing table and recreate with correct schema
DROP TABLE IF EXISTS public.it_asset_uploads CASCADE;

-- Recreate it_asset_uploads with correct schema for upload tracking
CREATE TABLE public.it_asset_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_size INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0,
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::JSONB,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id INTEGER REFERENCES public.client_orgs(org_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_it_asset_uploads_uploaded_by ON public.it_asset_uploads(uploaded_by);
CREATE INDEX idx_it_asset_uploads_org_id ON public.it_asset_uploads(org_id);
CREATE INDEX idx_it_asset_uploads_status ON public.it_asset_uploads(status);
CREATE INDEX idx_it_asset_uploads_created_at ON public.it_asset_uploads(created_at DESC);

-- Enable RLS
ALTER TABLE public.it_asset_uploads ENABLE ROW LEVEL SECURITY;

-- Admin gets full access
CREATE POLICY "admin_full_access_it_asset_uploads"
  ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Client users can access uploads in their organization
CREATE POLICY "client_org_access_it_asset_uploads"
  ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (
    NOT public.is_admin_user() AND
    org_id = public.get_current_user_org_id()
  )
  WITH CHECK (
    NOT public.is_admin_user() AND
    org_id = public.get_current_user_org_id()
  );

-- Grant permissions
GRANT ALL ON public.it_asset_uploads TO authenticated;
GRANT ALL ON public.it_asset_uploads TO anon;

COMMIT;
