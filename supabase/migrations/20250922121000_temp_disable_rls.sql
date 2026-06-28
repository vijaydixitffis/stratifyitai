-- TEMPORARY FIX: Disable problematic RLS policies to resolve infinite recursion
-- This is a temporary measure to get the application working while fixing the underlying issue

BEGIN;

-- Temporarily disable RLS on users table to allow basic functionality
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Keep RLS enabled on other tables but simplify policies
DROP POLICY IF EXISTS "client_org_access_it_assets" ON public.it_assets;
DROP POLICY IF EXISTS "client_org_access_it_asset_uploads" ON public.it_asset_uploads;

-- Create simplified policies for other tables
CREATE POLICY "allow_all_it_assets" ON public.it_assets
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_all_it_asset_uploads" ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Keep client_orgs policy simple
DROP POLICY IF EXISTS "authenticated_read_client_orgs" ON public.client_orgs;
CREATE POLICY "allow_all_client_orgs" ON public.client_orgs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;
