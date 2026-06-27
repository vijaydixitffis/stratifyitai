-- Fix RLS helper functions to query users table instead of JWT metadata
-- The JWT metadata doesn't contain role and org_id, causing RLS policies to fail
-- These functions use SECURITY DEFINER to bypass RLS and query users table directly

BEGIN;

-- Recreate helper functions to query users table with SECURITY DEFINER
-- Using CREATE OR REPLACE to avoid dependency errors with RLS policies
-- SECURITY DEFINER allows these functions to bypass RLS on the users table
-- They only query for the current authenticated user (auth.uid())

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'admin-super')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT org_id FROM public.users 
    WHERE id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT role FROM public.users 
    WHERE id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_org_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT org_code FROM public.users 
    WHERE id = auth.uid()
  );
END;
$$;

-- Test the functions
DO $$
DECLARE
  is_admin BOOLEAN;
  user_org_id INTEGER;
  user_role TEXT;
  user_org_code TEXT;
BEGIN
  is_admin := public.is_admin_user();
  user_org_id := public.get_current_user_org_id();
  user_role := public.get_current_user_role();
  user_org_code := public.get_current_user_org_code();
  
  RAISE NOTICE 'RLS helper functions fixed:';
  RAISE NOTICE '  is_admin_user: %', is_admin;
  RAISE NOTICE '  get_current_user_org_id: %', user_org_id;
  RAISE NOTICE '  get_current_user_role: %', user_role;
  RAISE NOTICE '  get_current_user_org_code: %', user_org_code;
END $$;

COMMIT;
