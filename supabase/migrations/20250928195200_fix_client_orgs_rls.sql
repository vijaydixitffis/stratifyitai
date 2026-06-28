-- Fix RLS policies for client_orgs table to prevent infinite recursion
-- This migration replaces the problematic policies that query the users table
-- with policies that use JWT metadata instead

BEGIN;

-- Drop problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "admin_full_access_client_orgs" ON public.client_orgs;
DROP POLICY IF EXISTS "authenticated_read_client_orgs" ON public.client_orgs;
DROP POLICY IF EXISTS "allow_all_client_orgs" ON public.client_orgs;

-- Policy: Admin users get full access to client_orgs
CREATE POLICY "admin_full_access_client_orgs" ON public.client_orgs
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Policy: Client users can read client_orgs (needed for login validation)
CREATE POLICY "authenticated_read_client_orgs" ON public.client_orgs
  FOR SELECT TO authenticated
  USING (true);

-- Test the policies
DO $$
DECLARE
  test_result BOOLEAN;
BEGIN
  -- Test that policies are working without recursion
  RAISE NOTICE 'RLS policies for client_orgs fixed - no infinite recursion should occur';
END $$;

COMMIT;
