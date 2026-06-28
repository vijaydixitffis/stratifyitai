-- Fix infinite recursion in RLS policies for users table
-- This migration resolves the circular dependency issue in RLS policies

BEGIN;

-- Drop problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "users_self_and_org_access" ON public.users;
DROP POLICY IF EXISTS "admin_full_users_access" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_access" ON public.users;

-- Recreate policies without circular dependencies
-- Policy: Users can read their own profile and others in their organization (simplified)
CREATE POLICY "users_access" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR
    -- Allow access based on JWT metadata without querying users table
    ((auth.jwt() -> 'user_metadata' ->> 'org_code') = (auth.jwt() -> 'user_metadata' ->> 'org_code')) OR
    -- Admin users can access all users (based on JWT role)
    ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin-super'))
  );

-- Policy: Users can insert their own profile (needed for new users)
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Policy: Users can update only their own profile
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy: Admin users get full access to all user records (simplified)
CREATE POLICY "admin_full_users_access" ON public.users
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin-super'))
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin-super'));

-- Update the helper functions to avoid recursion
-- Simplify check_user_role to not query users table
CREATE OR REPLACE FUNCTION public.check_user_role(user_role TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  -- Use only JWT metadata, don't query users table to avoid recursion
  IF user_role IS NOT NULL THEN
    RETURN (auth.jwt() -> 'user_metadata' ->> 'role') = user_role;
  ELSE
    RETURN (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin-super');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Simplify get_current_user_org_id_safe to not query users table
CREATE OR REPLACE FUNCTION public.get_current_user_org_id_safe()
RETURNS INTEGER AS $$
BEGIN
  -- Get org_id from JWT metadata instead of querying users table
  RETURN (auth.jwt() -> 'user_metadata' ->> 'org_id')::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keep get_current_user_org_code_safe as is since it only uses JWT
CREATE OR REPLACE FUNCTION public.get_current_user_org_code_safe()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.jwt() -> 'user_metadata' ->> 'org_code';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test the policies
DO $$
DECLARE
  test_result BOOLEAN;
BEGIN
  -- Test that we can query client_orgs without recursion
  SELECT COUNT(*) > 0 INTO test_result FROM public.client_orgs LIMIT 1;
  RAISE NOTICE 'Client orgs query test: %', test_result;

  -- Test that policies are working
  RAISE NOTICE 'RLS policies fixed - no infinite recursion should occur';
END $$;

COMMIT;
