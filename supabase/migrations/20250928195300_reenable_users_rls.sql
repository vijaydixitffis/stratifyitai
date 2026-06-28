-- Re-enable RLS on users table with proper policies
-- This migration re-enables RLS on the users table that was temporarily disabled

BEGIN;

-- Re-enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- The users table policies should already be fixed from the previous migration
-- (20250922120000_fix_rls_recursion.sql) which uses JWT metadata instead of querying users table

-- Test that RLS is enabled and working
DO $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  -- Check if RLS is enabled on users table
  SELECT relrowsecurity INTO rls_enabled 
  FROM pg_class 
  WHERE relname = 'users' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  RAISE NOTICE 'RLS enabled on users table: %', rls_enabled;
  
  IF rls_enabled THEN
    RAISE NOTICE 'Users table RLS re-enabled successfully';
  ELSE
    RAISE NOTICE 'WARNING: RLS not enabled on users table';
  END IF;
END $$;

COMMIT;
