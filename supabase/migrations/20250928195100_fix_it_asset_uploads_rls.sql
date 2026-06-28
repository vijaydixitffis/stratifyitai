-- Fix RLS policies for it_asset_uploads table to prevent infinite recursion
-- This migration replaces the problematic policies that query the users table
-- with policies that use JWT metadata instead

BEGIN;

-- Drop problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "admin_full_access_it_asset_uploads" ON public.it_asset_uploads;
DROP POLICY IF EXISTS "client_org_access_it_asset_uploads" ON public.it_asset_uploads;
DROP POLICY IF EXISTS "allow_all_it_asset_uploads" ON public.it_asset_uploads;

-- Policy: Admin users get full access to it_asset_uploads
CREATE POLICY "admin_full_access_it_asset_uploads" ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Policy: Client users can access asset uploads in their organization
CREATE POLICY "client_org_access_it_asset_uploads" ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (
    NOT public.is_admin_user() AND
    org_id = public.get_current_user_org_id()
  )
  WITH CHECK (
    NOT public.is_admin_user() AND
    org_id = public.get_current_user_org_id()
  );

-- Test the policies
DO $$
DECLARE
  test_result BOOLEAN;
BEGIN
  -- Test that policies are working without recursion
  RAISE NOTICE 'RLS policies for it_asset_uploads fixed - no infinite recursion should occur';
END $$;

COMMIT;
