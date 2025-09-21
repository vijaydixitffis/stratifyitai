-- Consolidated RLS Policies to Fix Infinite Recursion
-- This file drops all existing policies and creates new ones that avoid circular dependencies

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "admin_full_access_users" ON public.users;
DROP POLICY IF EXISTS "users_access" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "admin_full_users_access" ON public.users;
DROP POLICY IF EXISTS "client_org_access_users" ON public.users;

DROP POLICY IF EXISTS "admin_full_access_client_orgs" ON public.client_orgs;
DROP POLICY IF EXISTS "allow_all_client_orgs" ON public.client_orgs;
DROP POLICY IF EXISTS "full_access_client_orgs" ON public.client_orgs;

DROP POLICY IF EXISTS "admin_full_access_it_assets" ON public.it_assets;
DROP POLICY IF EXISTS "allow_all_it_assets" ON public.it_assets;
DROP POLICY IF EXISTS "client_org_access_it_assets" ON public.it_assets;

DROP POLICY IF EXISTS "admin_full_access_it_asset_uploads" ON public.it_asset_uploads;
DROP POLICY IF EXISTS "allow_all_it_asset_uploads" ON public.it_asset_uploads;
DROP POLICY IF EXISTS "client_org_access_it_asset_uploads" ON public.it_asset_uploads;

DROP POLICY IF EXISTS "admin_full_access_pa_categories" ON public.pa_categories;
DROP POLICY IF EXISTS "authenticated_read_pa_categories" ON public.pa_categories;

DROP POLICY IF EXISTS "admin_full_access_pa_assessments" ON public.pa_assessments;
DROP POLICY IF EXISTS "authenticated_read_pa_assessments" ON public.pa_assessments;

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.it_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.it_asset_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pa_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pa_assessments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES (NO RECURSION - USES JWT CLAIMS DIRECTLY)
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can read all users (using JWT role claim directly)
CREATE POLICY "admins_read_all_users" ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin%');

-- Admins can insert/update/delete all users (using JWT role claim directly)
CREATE POLICY "admins_manage_all_users" ON public.users
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin%');

-- Client users can read users in their organization
CREATE POLICY "clients_read_org_users" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role' LIKE 'client%') AND 
    (org_id::text = auth.jwt() ->> 'org_id')
  );

-- ============================================================================
-- CLIENT_ORGS TABLE POLICIES
-- ============================================================================

-- All authenticated users can read organizations (needed for login validation)
CREATE POLICY "authenticated_read_orgs" ON public.client_orgs
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins can manage all organizations
CREATE POLICY "admins_manage_orgs" ON public.client_orgs
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin%');

-- ============================================================================
-- IT_ASSETS TABLE POLICIES
-- ============================================================================

-- Admins can manage all assets
CREATE POLICY "admins_manage_all_assets" ON public.it_assets
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin%');

-- Client users can manage assets in their organization
CREATE POLICY "clients_manage_org_assets" ON public.it_assets
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'role' LIKE 'client%') AND 
    (org_id::text = auth.jwt() ->> 'org_id')
  )
  WITH CHECK (
    (auth.jwt() ->> 'role' LIKE 'client%') AND 
    (org_id::text = auth.jwt() ->> 'org_id')
  );

-- ============================================================================
-- IT_ASSET_UPLOADS TABLE POLICIES
-- ============================================================================

-- Admins can manage all uploads
CREATE POLICY "admins_manage_all_uploads" ON public.it_asset_uploads
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin%');

-- Client users can manage uploads in their organization
CREATE POLICY "clients_manage_org_uploads" ON public.it_asset_uploads
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'role' LIKE 'client%') AND 
    (org_id::text = auth.jwt() ->> 'org_id')
  )
  WITH CHECK (
    (auth.jwt() ->> 'role' LIKE 'client%') AND 
    (org_id::text = auth.jwt() ->> 'org_id')
  );

-- ============================================================================
-- PA_CATEGORIES TABLE POLICIES
-- ============================================================================

-- All authenticated users can read active categories
CREATE POLICY "authenticated_read_categories" ON public.pa_categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can manage all categories
CREATE POLICY "admins_manage_categories" ON public.pa_categories
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin%');

-- ============================================================================
-- PA_ASSESSMENTS TABLE POLICIES
-- ============================================================================

-- All authenticated users can read active assessments
CREATE POLICY "authenticated_read_assessments" ON public.pa_assessments
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can manage all assessments
CREATE POLICY "admins_manage_assessments" ON public.pa_assessments
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin%');

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant permissions on tables
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.client_orgs TO authenticated;
GRANT ALL ON public.it_assets TO authenticated;
GRANT ALL ON public.it_asset_uploads TO authenticated;
GRANT ALL ON public.pa_categories TO authenticated;
GRANT ALL ON public.pa_assessments TO authenticated;

-- Grant permissions on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;