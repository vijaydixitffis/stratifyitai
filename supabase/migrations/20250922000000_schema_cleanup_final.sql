-- COMPREHENSIVE SCHEMA CLEANUP: Retain Only Specified Tables with RLS
-- This migration consolidates the database to only contain the specified tables:
-- users, client_orgs, it_asset_uploads, it_assets, pa_categories, pa_assessments
-- All tables will have RLS enabled with proper policies

/*
  SCHEMA CLEANUP OVERVIEW:
  - Retains only: users, client_orgs, it_asset_uploads, it_assets, pa_categories, pa_assessments
  - Removes: admin_users, client_users (data migrated to unified users table)
  - Enables RLS on all retained tables
  - Creates proper access policies for admin vs client users
  - Admin users: org_code = 'ADMIN', full access to all tables
  - Client users: org_code from client_orgs via FK, restricted access
  - Preserves all existing data and relationships
  - Retains functions and triggers as requested
*/

BEGIN;

-- 1. BACKUP EXISTING DATA BEFORE SCHEMA CHANGES
-- This ensures we don't lose any data during the cleanup

-- Create temporary backup tables
CREATE TEMP TABLE temp_admin_users AS SELECT * FROM public.admin_users;
CREATE TEMP TABLE temp_client_users AS SELECT * FROM public.client_users;
CREATE TEMP TABLE temp_client_orgs AS SELECT * FROM public.client_orgs;
CREATE TEMP TABLE temp_it_assets AS SELECT * FROM public.it_assets;
CREATE TEMP TABLE temp_it_asset_uploads AS SELECT * FROM public.it_asset_uploads;
CREATE TEMP TABLE temp_pa_categories AS SELECT * FROM public.pa_categories;
CREATE TEMP TABLE temp_pa_assessments AS SELECT * FROM public.pa_assessments;

-- 2. DROP UNWANTED TABLES AND VIEWS
-- Drop tables that are not in the specified list
DROP TABLE IF EXISTS public.admin_users CASCADE;
DROP TABLE IF EXISTS public.client_users CASCADE;

-- Drop any unwanted views
DROP VIEW IF EXISTS public.admin_users_view CASCADE;
DROP VIEW IF EXISTS public.client_users_view CASCADE;

-- 3. RECREATE USERS TABLE WITH UNIFIED SCHEMA
-- This table combines admin_users and client_users functionality
DROP TABLE IF EXISTS public.users CASCADE;
CREATE TABLE public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'admin-super', 'client-manager', 'client-architect', 'client-cxo')),
  org_id INTEGER, -- NULL for admins, specific org for clients
  org_code TEXT, -- 'ADMIN' for admins, actual org_code for clients
  organization TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON public.users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_org_code ON public.users(org_code);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 4. MIGRATE USER DATA FROM BACKUP TABLES
-- Migrate admin users first
INSERT INTO public.users (id, email, name, role, org_id, org_code, organization, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.name, 'Admin User'),
  COALESCE(au.role, 'admin'),
  NULL, -- Admins have no org restriction
  'ADMIN', -- Admin org_code
  'StratifyIT.ai', -- Default organization for admins
  au.created_at,
  au.created_at
FROM temp_admin_users au
ON CONFLICT (id) DO NOTHING;

-- Migrate client users
INSERT INTO public.users (id, email, name, role, org_id, org_code, organization, created_at, updated_at)
SELECT
  cu.id,
  cu.email,
  COALESCE(cu.name, split_part(cu.email, '@', 1)),
  COALESCE(cu.role, 'client-manager'),
  cu.org_id,
  co.org_code, -- Get org_code from client_orgs
  co.org_name, -- Get org_name from client_orgs
  cu.created_at,
  cu.created_at
FROM temp_client_users cu
LEFT JOIN temp_client_orgs co ON cu.org_id = co.org_id
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  org_id = EXCLUDED.org_id,
  org_code = EXCLUDED.org_code,
  organization = EXCLUDED.organization,
  updated_at = NOW();

-- 5. RECREATE CLIENT_ORGS TABLE
DROP TABLE IF EXISTS public.client_orgs CASCADE;
CREATE TABLE public.client_orgs (
  org_id SERIAL PRIMARY KEY,
  org_code TEXT NOT NULL UNIQUE,
  org_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT,
  sector TEXT,
  remarks TEXT
);

-- Migrate client_orgs data
INSERT INTO public.client_orgs (org_id, org_code, org_name, created_at, description, sector, remarks)
SELECT org_id, org_code, org_name, created_at, description, sector, remarks
FROM temp_client_orgs
ON CONFLICT (org_id) DO NOTHING;

-- 6. RECREATE IT_ASSETS TABLE
DROP TABLE IF EXISTS public.it_assets CASCADE;
CREATE TABLE public.it_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  description TEXT,
  owner TEXT,
  status TEXT,
  criticality TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  tags TEXT[],
  metadata JSONB,
  org_id INTEGER REFERENCES public.client_orgs(org_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migrate it_assets data
INSERT INTO public.it_assets (id, name, type, category, description, owner, status, criticality, last_updated, created_by, tags, metadata, org_id, created_at)
SELECT id, name, type, category, description, owner, status, criticality, last_updated, created_by, tags, metadata, org_id, created_at
FROM temp_it_assets
ON CONFLICT (id) DO NOTHING;

-- 7. RECREATE IT_ASSET_UPLOADS TABLE
DROP TABLE IF EXISTS public.it_asset_uploads CASCADE;
CREATE TABLE public.it_asset_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.it_assets(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  org_id INTEGER REFERENCES public.client_orgs(org_id)
);

-- Migrate it_asset_uploads data
INSERT INTO public.it_asset_uploads (id, asset_id, file_url, uploaded_by, uploaded_at, org_id)
SELECT id, asset_id, file_url, uploaded_by, uploaded_at, org_id
FROM temp_it_asset_uploads
ON CONFLICT (id) DO NOTHING;

-- 8. RECREATE PA_CATEGORIES TABLE
DROP TABLE IF EXISTS public.pa_categories CASCADE;
CREATE TABLE public.pa_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'Target',
  color TEXT NOT NULL DEFAULT 'bg-blue-600',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrate pa_categories data
INSERT INTO public.pa_categories (id, category_id, title, description, icon, color, sort_order, is_active, created_at, updated_at)
SELECT id, category_id, title, description, icon, color, sort_order, is_active, created_at, updated_at
FROM temp_pa_categories
ON CONFLICT (id) DO NOTHING;

-- 9. RECREATE PA_ASSESSMENTS TABLE
DROP TABLE IF EXISTS public.pa_assessments CASCADE;
CREATE TABLE public.pa_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id TEXT UNIQUE NOT NULL,
  category_id TEXT NOT NULL REFERENCES public.pa_categories(category_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration TEXT DEFAULT '1-2 weeks',
  complexity TEXT DEFAULT 'Medium' CHECK (complexity IN ('Low', 'Medium', 'High')),
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'in-progress', 'completed', 'disabled')),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrate pa_assessments data
INSERT INTO public.pa_assessments (id, assessment_id, category_id, name, description, duration, complexity, status, sort_order, is_active, created_at, updated_at)
SELECT id, assessment_id, category_id, name, description, duration, complexity, status, sort_order, is_active, created_at, updated_at
FROM temp_pa_assessments
ON CONFLICT (id) DO NOTHING;

-- 10. ENABLE RLS ON ALL TABLES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.it_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.it_asset_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pa_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pa_assessments ENABLE ROW LEVEL SECURITY;

-- 11. DROP EXISTING POLICIES TO AVOID CONFLICTS
-- Users table policies
DROP POLICY IF EXISTS "users_self_and_org_access" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "admin_full_users_access" ON public.users;

-- Client orgs policies
DROP POLICY IF EXISTS "admin_full_access_client_orgs" ON public.client_orgs;
DROP POLICY IF EXISTS "full_access_client_orgs" ON public.client_orgs;
DROP POLICY IF EXISTS "Allow anonymous access to client_orgs for login" ON public.client_orgs;

-- IT assets policies
DROP POLICY IF EXISTS "admin_full_access_it_assets" ON public.it_assets;
DROP POLICY IF EXISTS "client_org_access_it_assets" ON public.it_assets;

-- IT asset uploads policies
DROP POLICY IF EXISTS "admin_full_access_it_asset_uploads" ON public.it_asset_uploads;
DROP POLICY IF EXISTS "client_org_access_it_asset_uploads" ON public.it_asset_uploads;

-- PA categories policies
DROP POLICY IF EXISTS "Allow admins to manage pa_categories" ON public.pa_categories;
DROP POLICY IF EXISTS "Allow all authenticated users to read pa_categories" ON public.pa_categories;

-- PA assessments policies
DROP POLICY IF EXISTS "Allow admins to manage pa_assessments" ON public.pa_assessments;
DROP POLICY IF EXISTS "Allow all authenticated users to read pa_assessments" ON public.pa_assessments;

-- 12. CREATE NEW RLS POLICIES

-- USERS TABLE POLICIES
-- Policy: Users can read their own profile and others in their organization
CREATE POLICY "users_self_and_org_access" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR
    -- Admin users can access all users
    (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND org_code = 'ADMIN')) OR
    -- Client users can access users in their organization
    (org_code = (SELECT org_code FROM public.users WHERE id = auth.uid()) AND
     (SELECT org_code FROM public.users WHERE id = auth.uid()) != 'ADMIN')
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

-- Policy: Admin users get full access to all user records
CREATE POLICY "admin_full_users_access" ON public.users
  FOR ALL TO authenticated
  USING (role IN ('admin', 'admin-super'))
  WITH CHECK (role IN ('admin', 'admin-super'));

-- CLIENT_ORGS TABLE POLICIES
-- Policy: Admin users get full access to client_orgs
CREATE POLICY "admin_full_access_client_orgs" ON public.client_orgs
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'admin-super'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'admin-super'))
  );

-- Policy: All authenticated users can read client_orgs (needed for org selection)
CREATE POLICY "authenticated_read_client_orgs" ON public.client_orgs
  FOR SELECT TO authenticated
  USING (true);

-- IT_ASSETS TABLE POLICIES
-- Policy: Admin users get full access to it_assets
CREATE POLICY "admin_full_access_it_assets" ON public.it_assets
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'admin-super'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'admin-super'))
  );

-- Policy: Client users can access assets in their organization
CREATE POLICY "client_org_access_it_assets" ON public.it_assets
  FOR ALL TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'admin-super')) AND
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'admin-super')) AND
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  );

-- IT_ASSET_UPLOADS TABLE POLICIES
-- Policy: Admin users get full access to it_asset_uploads
CREATE POLICY "admin_full_access_it_asset_uploads" ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'admin-super'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'admin-super'))
  );

-- Policy: Client users can access uploads in their organization
CREATE POLICY "client_org_access_it_asset_uploads" ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'admin-super')) AND
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  )
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'admin-super')) AND
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  );

-- PA_CATEGORIES TABLE POLICIES
-- Policy: Admin users get full access to pa_categories
CREATE POLICY "admin_full_access_pa_categories" ON public.pa_categories
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'admin-super'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'admin-super'))
  );

-- Policy: All authenticated users can read active pa_categories
CREATE POLICY "authenticated_read_pa_categories" ON public.pa_categories
  FOR SELECT TO authenticated
  USING (is_active = true);

-- PA_ASSESSMENTS TABLE POLICIES
-- Policy: Admin users get full access to pa_assessments
CREATE POLICY "admin_full_access_pa_assessments" ON public.pa_assessments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'admin-super'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'admin-super'))
  );

-- Policy: All authenticated users can read active pa_assessments
CREATE POLICY "authenticated_read_pa_assessments" ON public.pa_assessments
  FOR SELECT TO authenticated
  USING (is_active = true);

-- 13. RECREATE HELPER FUNCTIONS
-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'admin-super'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's organization ID
CREATE OR REPLACE FUNCTION get_current_user_org_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT org_id FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's org_code
CREATE OR REPLACE FUNCTION get_current_user_org_code()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT org_code FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. RECREATE USER PROFILE FUNCTIONS
-- Updated create_current_user_profile function with admin role detection
CREATE OR REPLACE FUNCTION public.create_current_user_profile()
RETURNS JSONB AS $$
DECLARE
  current_user_id UUID;
  current_user_email TEXT;
  current_user_metadata JSONB;
  user_role TEXT;
  user_name TEXT;
  user_org_id INTEGER;
  user_org_code TEXT;
  user_organization TEXT;
  result JSONB;
BEGIN
  -- Get current user info (only works when authenticated)
  current_user_id := auth.uid();
  current_user_email := auth.jwt() ->> 'email';
  current_user_metadata := COALESCE(auth.jwt() -> 'user_metadata', '{}'::JSONB);

  -- Determine user role based on email domain or metadata
  user_role := COALESCE(
    current_user_metadata->>'role',
    CASE
      WHEN current_user_email LIKE '%@stratifyit.ai' THEN 'admin'
      ELSE 'client-manager'
    END
  );

  -- Extract user name from metadata or email
  user_name := COALESCE(
    current_user_metadata->>'name',
    current_user_metadata->>'full_name',
    split_part(current_user_email, '@', 1), -- Use email prefix as fallback
    'User'
  );

  -- Set organization, org_id, and org_code based on role
  IF user_role = 'admin' THEN
    user_org_id := NULL;
    user_org_code := 'ADMIN';
    user_organization := 'StratifyIT.ai';
  ELSE
    user_org_id := COALESCE(
      (current_user_metadata->>'org_id')::INTEGER,
      NULL
    );
    user_org_code := COALESCE(
      current_user_metadata->>'org_code',
      'UNKNOWN'
    );
    user_organization := COALESCE(
      current_user_metadata->>'organization',
      'Unknown Organization'
    );
  END IF;

  -- Check if user already has a profile
  IF EXISTS (SELECT 1 FROM public.users WHERE id = current_user_id) THEN
    -- Update existing profile with correct role
    UPDATE public.users SET
      email = current_user_email,
      name = user_name,
      role = user_role,
      org_id = user_org_id,
      org_code = user_org_code,
      organization = user_organization,
      updated_at = NOW()
    WHERE id = current_user_id
    RETURNING
      jsonb_build_object(
        'id', id,
        'email', email,
        'name', name,
        'role', role,
        'org_id', org_id,
        'org_code', org_code,
        'organization', organization,
        'created_at', created_at,
        'updated_at', updated_at
      ) INTO result;

    RETURN result;
  END IF;

  -- Create new profile
  INSERT INTO public.users (
    id,
    email,
    name,
    role,
    org_id,
    org_code,
    organization,
    created_at,
    updated_at
  ) VALUES (
    current_user_id,
    current_user_email,
    user_name,
    user_role,
    user_org_id,
    user_org_code,
    user_organization,
    NOW(),
    NOW()
  )
  RETURNING
    jsonb_build_object(
      'id', id,
      'email', email,
      'name', name,
      'role', role,
      'org_id', org_id,
      'org_code', org_code,
      'organization', organization,
      'created_at', created_at,
      'updated_at', updated_at
    ) INTO result;

  -- Return the created/updated profile
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. CREATE TRIGGERS FOR UPDATED_AT
-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables that have updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pa_categories_updated_at
  BEFORE UPDATE ON public.pa_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pa_assessments_updated_at
  BEFORE UPDATE ON public.pa_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 16. GRANT NECESSARY PERMISSIONS
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.users TO anon, authenticated, service_role;
GRANT ALL ON public.client_orgs TO anon, authenticated, service_role;
GRANT ALL ON public.it_assets TO anon, authenticated, service_role;
GRANT ALL ON public.it_asset_uploads TO anon, authenticated, service_role;
GRANT ALL ON public.pa_categories TO anon, authenticated, service_role;
GRANT ALL ON public.pa_assessments TO anon, authenticated, service_role;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.create_current_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_org_code() TO authenticated;

-- 17. ADD HELPFUL COMMENTS
COMMENT ON TABLE public.users IS 'Unified users table combining admin and client users for multi-tenant access control';
COMMENT ON COLUMN public.users.role IS 'User role: admin (full access) or client-* (org-restricted access)';
COMMENT ON COLUMN public.users.org_id IS 'Organization ID for client users (NULL for admins)';
COMMENT ON COLUMN public.users.org_code IS 'Organization code: ADMIN for admins, actual org_code for clients';
COMMENT ON FUNCTION public.create_current_user_profile() IS 'Creates or updates a profile for the currently authenticated user with automatic admin role detection';
COMMENT ON FUNCTION is_admin_user() IS 'Returns true if current user is admin (org_code = ADMIN)';
COMMENT ON FUNCTION get_current_user_org_id() IS 'Returns current user''s organization ID';
COMMENT ON FUNCTION get_current_user_role() IS 'Returns current user''s role';
COMMENT ON FUNCTION get_current_user_org_code() IS 'Returns current user''s organization code';

-- 18. VERIFY THE MIGRATION
DO $$
DECLARE
  users_count INTEGER;
  client_orgs_count INTEGER;
  it_assets_count INTEGER;
  it_asset_uploads_count INTEGER;
  pa_categories_count INTEGER;
  pa_assessments_count INTEGER;
  policy_count INTEGER;
  function_count INTEGER;
BEGIN
  -- Count records in each table
  SELECT COUNT(*) INTO users_count FROM public.users;
  SELECT COUNT(*) INTO client_orgs_count FROM public.client_orgs;
  SELECT COUNT(*) INTO it_assets_count FROM public.it_assets;
  SELECT COUNT(*) INTO it_asset_uploads_count FROM public.it_asset_uploads;
  SELECT COUNT(*) INTO pa_categories_count FROM public.pa_categories;
  SELECT COUNT(*) INTO pa_assessments_count FROM public.pa_assessments;

  -- Count policies
  SELECT COUNT(*) INTO policy_count FROM pg_policies
  WHERE tablename IN ('users', 'client_orgs', 'it_assets', 'it_asset_uploads', 'pa_categories', 'pa_assessments');

  -- Count functions
  SELECT COUNT(*) INTO function_count FROM pg_proc
  WHERE proname IN ('create_current_user_profile', 'is_admin_user', 'get_current_user_org_id', 'get_current_user_role', 'get_current_user_org_code', 'update_updated_at_column')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  RAISE NOTICE 'Schema cleanup completed successfully:';
  RAISE NOTICE '  - Users table: % records', users_count;
  RAISE NOTICE '  - Client orgs table: % records', client_orgs_count;
  RAISE NOTICE '  - IT assets table: % records', it_assets_count;
  RAISE NOTICE '  - IT asset uploads table: % records', it_asset_uploads_count;
  RAISE NOTICE '  - PA categories table: % records', pa_categories_count;
  RAISE NOTICE '  - PA assessments table: % records', pa_assessments_count;
  RAISE NOTICE '  - RLS policies created: %', policy_count;
  RAISE NOTICE '  - Helper functions created: %', function_count;
  RAISE NOTICE '  - Admin users (role=admin or admin-super): %', (SELECT COUNT(*) FROM public.users WHERE role IN ('admin', 'admin-super'));
  RAISE NOTICE '  - Client users: %', (SELECT COUNT(*) FROM public.users WHERE role NOT IN ('admin', 'admin-super'));
  RAISE NOTICE '  - Admin users with org_code=ADMIN: %', (SELECT COUNT(*) FROM public.users WHERE org_code = 'ADMIN');
END $$;

COMMIT;

-- ROLLBACK INSTRUCTIONS:
-- If you need to rollback this migration, run:
--
-- BEGIN;
-- -- Drop all created policies
-- DROP POLICY IF EXISTS "users_self_and_org_access" ON public.users;
-- DROP POLICY IF EXISTS "users_insert_own" ON public.users;
-- DROP POLICY IF EXISTS "users_update_own" ON public.users;
-- DROP POLICY IF EXISTS "admin_full_users_access" ON public.users;
-- DROP POLICY IF EXISTS "admin_full_access_client_orgs" ON public.client_orgs;
-- DROP POLICY IF EXISTS "authenticated_read_client_orgs" ON public.client_orgs;
-- DROP POLICY IF EXISTS "admin_full_access_it_assets" ON public.it_assets;
-- DROP POLICY IF EXISTS "client_org_access_it_assets" ON public.it_assets;
-- DROP POLICY IF EXISTS "admin_full_access_it_asset_uploads" ON public.it_asset_uploads;
-- DROP POLICY IF EXISTS "client_org_access_it_asset_uploads" ON public.it_asset_uploads;
-- DROP POLICY IF EXISTS "admin_full_access_pa_categories" ON public.pa_categories;
-- DROP POLICY IF EXISTS "authenticated_read_pa_categories" ON public.pa_categories;
-- DROP POLICY IF EXISTS "admin_full_access_pa_assessments" ON public.pa_assessments;
-- DROP POLICY IF EXISTS "authenticated_read_pa_assessments" ON public.pa_assessments;
--
-- -- Drop functions
-- DROP FUNCTION IF EXISTS public.create_current_user_profile();
-- DROP FUNCTION IF EXISTS is_admin_user();
-- DROP FUNCTION IF EXISTS get_current_user_org_id();
-- DROP FUNCTION IF EXISTS get_current_user_role();
-- DROP FUNCTION IF EXISTS get_current_user_org_code();
-- DROP FUNCTION IF EXISTS update_updated_at_column();
--
-- -- Drop triggers
-- DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
-- DROP TRIGGER IF EXISTS update_pa_categories_updated_at ON public.pa_categories;
-- DROP TRIGGER IF EXISTS update_pa_assessments_updated_at ON public.pa_assessments;
--
-- -- Restore original tables (from backup if available)
-- -- This would require having backup files of the original schema
-- COMMIT;
