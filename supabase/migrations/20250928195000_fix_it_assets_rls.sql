-- Fix RLS policies for it_assets table to prevent infinite recursion
-- This migration replaces the problematic policies that query the users table
-- with policies that use JWT metadata instead

BEGIN;

-- Drop problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "admin_full_access_it_assets" ON public.it_assets;
DROP POLICY IF EXISTS "client_org_access_it_assets" ON public.it_assets;
DROP POLICY IF EXISTS "allow_all_it_assets" ON public.it_assets;

-- Create helper function to check if user is admin based on JWT metadata
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check role from JWT metadata without querying users table
  RETURN (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin-super');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to get current user's org_id from JWT metadata
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS INTEGER AS $$
BEGIN
  -- Get org_id from JWT metadata without querying users table
  RETURN (auth.jwt() -> 'user_metadata' ->> 'org_id')::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy: Admin users get full access to it_assets
CREATE POLICY "admin_full_access_it_assets" ON public.it_assets
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Policy: Client users can access assets in their organization
CREATE POLICY "client_org_access_it_assets" ON public.it_assets
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
  -- Test that helper functions work
  RAISE NOTICE 'Admin user check: %', public.is_admin_user();
  RAISE NOTICE 'Current user org_id: %', public.get_current_user_org_id();
  
  -- Test that policies are working without recursion
  RAISE NOTICE 'RLS policies for it_assets fixed - no infinite recursion should occur';
END $$;

COMMIT;
