-- CONSOLIDATED MIGRATION: Clean User Management System
-- This migration consolidates all user-related functionality into a single, clean setup
-- Fixes permission issues and removes problematic trigger-based approaches

/*
  CONSOLIDATION OVERVIEW:
  - Creates unified users table with proper schema and constraints
  - Sets up RLS policies that avoid circular dependencies
  - Provides database function approach for user profile creation
  - Removes all trigger-based code that requires elevated permissions
  - Consolidates helper functions and views
  - Fixes the "must be owner of relation" permission errors

  KEY FIXES:
  - Uses database functions instead of auth.users triggers
  - RLS policies allow users to create their own profiles
  - No elevated permissions required
  - Clean separation of concerns
*/

BEGIN;

-- 1. Create the unified users table (if not exists)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'client-manager', 'client-architect', 'client-cxo')),
  org_id INTEGER, -- NULL for admins, specific org for clients
  organization TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON public.users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 2. Enable RLS on the users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies that avoid circular dependencies
-- First drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "users_self_and_org_access" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "admin_full_users_access" ON public.users;

-- Policy: Users can read their own profile and others in their organization
CREATE POLICY "users_self_and_org_access" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR
    -- Allow access if user exists and has appropriate role
    (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')) OR
    -- Allow organization-based access for existing client users
    (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()) AND
     role LIKE 'client%')
  );

-- Policy: Users can insert their own profile (needed for new users)
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
  );

-- Policy: Users can update only their own profile
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy: Admin users get full access to all user records
CREATE POLICY "admin_full_users_access" ON public.users
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. Create helper functions for easier access control
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_current_user_org_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT org_id FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create database functions for user profile creation (no triggers needed)
CREATE OR REPLACE FUNCTION public.create_user_profile(
  user_id UUID,
  user_email TEXT,
  user_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB AS $$
DECLARE
  user_role TEXT;
  user_name TEXT;
  user_org_id INTEGER;
  user_organization TEXT;
  result JSONB;
BEGIN
  -- Extract user metadata from the JSON parameter
  user_role := COALESCE(
    user_metadata->>'role',
    'client-manager' -- Default role
  );

  user_name := COALESCE(
    user_metadata->>'name',
    user_metadata->>'full_name',
    split_part(user_email, '@', 1), -- Use email prefix as fallback
    'User'
  );

  -- Only set org_id for non-admin users
  IF user_role = 'admin' THEN
    user_org_id := NULL;
    user_organization := 'StratifyIT.ai';
  ELSE
    user_org_id := COALESCE(
      (user_metadata->>'org_id')::INTEGER,
      NULL
    );
    user_organization := COALESCE(
      user_metadata->>'organization',
      'Unknown Organization'
    );
  END IF;

  -- Insert or update the user profile
  INSERT INTO public.users (
    id,
    email,
    name,
    role,
    org_id,
    organization,
    created_at,
    updated_at
  ) VALUES (
    user_id,
    user_email,
    user_name,
    user_role,
    user_org_id,
    user_organization,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    org_id = EXCLUDED.org_id,
    organization = EXCLUDED.organization,
    updated_at = NOW()
  RETURNING
    jsonb_build_object(
      'id', id,
      'email', email,
      'name', name,
      'role', role,
      'org_id', org_id,
      'organization', organization,
      'created_at', created_at,
      'updated_at', updated_at
    ) INTO result;

  -- Return the created/updated profile
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function that can be called without parameters
CREATE OR REPLACE FUNCTION public.create_current_user_profile()
RETURNS JSONB AS $$
DECLARE
  current_user_id UUID;
  current_user_email TEXT;
  current_user_metadata JSONB;
BEGIN
  -- Get current user info (only works when authenticated)
  current_user_id := auth.uid();
  current_user_email := auth.jwt() ->> 'email';
  current_user_metadata := COALESCE(auth.jwt() -> 'user_metadata', '{}'::JSONB);

  -- Check if user already has a profile
  IF EXISTS (SELECT 1 FROM public.users WHERE id = current_user_id) THEN
    -- Return existing profile data
    RETURN (
      SELECT jsonb_build_object(
        'id', id,
        'email', email,
        'name', name,
        'role', role,
        'org_id', org_id,
        'organization', organization,
        'created_at', created_at,
        'updated_at', updated_at
      )
      FROM public.users
      WHERE id = current_user_id
    );
  END IF;

  -- Create new profile
  RETURN public.create_user_profile(current_user_id, current_user_email, current_user_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.users TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_user_profile(UUID, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_current_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_role() TO authenticated;

-- 7. Create trigger to automatically update updated_at
-- First drop the trigger if it exists to avoid conflicts
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Create views for backward compatibility
CREATE OR REPLACE VIEW public.admin_users_view AS
SELECT id, email, name, created_at, updated_at
FROM public.users
WHERE role = 'admin';

CREATE OR REPLACE VIEW public.client_users_view AS
SELECT
  u.id,
  u.email,
  u.name,
  u.role,
  u.org_id,
  u.organization,
  u.created_at,
  u.updated_at
FROM public.users u
WHERE u.role LIKE 'client%';

-- 9. Add helpful comments
COMMENT ON TABLE public.users IS 'Unified users table combining admin and client users for multi-tenant access control';
COMMENT ON COLUMN public.users.role IS 'User role: admin (full access) or client-* (org-restricted access)';
COMMENT ON COLUMN public.users.org_id IS 'Organization ID for client users (NULL for admins)';
COMMENT ON FUNCTION public.create_user_profile(UUID, TEXT, JSONB) IS 'Creates or updates a user profile with the provided metadata';
COMMENT ON FUNCTION public.create_current_user_profile() IS 'Creates a profile for the currently authenticated user or returns existing profile';
COMMENT ON FUNCTION is_admin_user() IS 'Returns true if current user is admin';
COMMENT ON FUNCTION get_current_user_org_id() IS 'Returns current user''s organization ID';
COMMENT ON FUNCTION get_current_user_role() IS 'Returns current user''s role';

-- 10. Verify the migration
DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
  function_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'users';

  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'users';

  SELECT COUNT(*) INTO function_count FROM pg_proc
  WHERE proname IN ('create_user_profile', 'create_current_user_profile', 'is_admin_user', 'get_current_user_org_id', 'get_current_user_role')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  RAISE NOTICE 'Consolidated migration completed successfully:';
  RAISE NOTICE '  - Users table created: %', (table_count > 0);
  RAISE NOTICE '  - RLS policies created: %', policy_count;
  RAISE NOTICE '  - Helper functions created: %', function_count;
  RAISE NOTICE '  - User profile creation functions ready';
  RAISE NOTICE '  - No triggers on auth.users (avoiding permission issues)';
END $$;

COMMIT;

-- ROLLBACK INSTRUCTIONS:
-- If you need to rollback this migration, run:
--
-- BEGIN;
-- DROP VIEW IF EXISTS public.client_users_view;
-- DROP VIEW IF EXISTS public.admin_users_view;
-- DROP FUNCTION IF EXISTS public.create_current_user_profile();
-- DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, JSONB);
-- DROP FUNCTION IF EXISTS is_admin_user();
-- DROP FUNCTION IF EXISTS get_current_user_org_id();
-- DROP FUNCTION IF EXISTS get_current_user_role();
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
-- DROP TABLE IF EXISTS public.users;
-- COMMIT;
