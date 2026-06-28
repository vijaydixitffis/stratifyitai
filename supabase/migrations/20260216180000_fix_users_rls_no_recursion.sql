-- Fix users table RLS policies to avoid infinite recursion (42P17)
-- Ensures authenticated users can load their profile from public.users without policies querying public.users

BEGIN;

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing users policies (names vary across migrations)
DROP POLICY IF EXISTS "users_self_and_org_access" ON public.users;
DROP POLICY IF EXISTS "users_access" ON public.users;
DROP POLICY IF EXISTS "admin_full_users_access" ON public.users;
DROP POLICY IF EXISTS admin_full_users_access ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS users_insert_own ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;

-- Minimal, recursion-safe policies:
-- 1) Users can always read their own profile row
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- 2) Users can insert their own profile row
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- 3) Users can update only their own profile row
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 4) Admin users can access all user records.
-- NOTE: This must not query public.users (would recurse). Use JWT metadata instead.
CREATE POLICY "admin_full_users_access" ON public.users
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin-super'))
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin-super'));

-- Replace helper functions used by other RLS policies so they never query public.users
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin-super');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN NULLIF((auth.jwt() -> 'user_metadata' ->> 'org_id')::INTEGER, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.jwt() -> 'user_metadata' ->> 'role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_user_org_code()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.jwt() -> 'user_metadata' ->> 'org_code';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
