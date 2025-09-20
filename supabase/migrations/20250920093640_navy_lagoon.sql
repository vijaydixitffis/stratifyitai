-- RLS policies using efficient JWT claims for admin access and direct user ID matching

-- 0. admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_admin_users ON public.admin_users;
CREATE POLICY admin_full_access_admin_users ON public.admin_users
  FOR ALL TO authenticated
  USING (admin_users.id = (auth.jwt() ->> 'sub')::uuid)
  WITH CHECK (admin_users.id = (auth.jwt() ->> 'sub')::uuid);

-- 1. client_orgs
ALTER TABLE public.client_orgs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_client_orgs ON public.client_orgs;
DROP POLICY IF EXISTS full_access_client_orgs ON public.client_orgs;
DROP POLICY IF EXISTS "Allow anonymous access to client_orgs for login" ON public.client_orgs;

-- Allow anonymous users to select from client_orgs (needed for login validation)
CREATE POLICY "Allow anonymous access to client_orgs for login" ON public.client_orgs
  FOR SELECT
  TO anon
  USING (true);

-- Allow all authenticated users to select from client_orgs
CREATE POLICY full_access_client_orgs ON public.client_orgs
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins full access to client_orgs
CREATE POLICY admin_full_access_client_orgs ON public.client_orgs
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin-%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin-%');

-- 2. client_users
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_client_users ON public.client_users;
DROP POLICY IF EXISTS client_org_access_client_users ON public.client_users;
DROP POLICY IF EXISTS client_access_client_users ON public.client_users;
DROP POLICY IF EXISTS self_select_client_users ON public.client_users;

-- Allow admins full access to client_users
CREATE POLICY admin_full_access_client_users ON public.client_users
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin-%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin-%');

-- Allow users to access their own profile directly by user ID
CREATE POLICY self_access_client_users ON public.client_users
  FOR ALL TO authenticated
  USING (client_users.id = (auth.jwt() ->> 'sub')::uuid)
  WITH CHECK (client_users.id = (auth.jwt() ->> 'sub')::uuid);

-- Allow users to access other users in their organization (using app_metadata)
CREATE POLICY org_access_client_users ON public.client_users
  FOR SELECT TO authenticated
  USING (
    org_id::text = (auth.jwt() -> 'app_metadata' ->> 'org_id')
  );

-- 3. it_assets
ALTER TABLE public.it_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_it_assets ON public.it_assets;
DROP POLICY IF EXISTS client_org_access_it_assets ON public.it_assets;

-- Allow admins full access to it_assets
CREATE POLICY admin_full_access_it_assets ON public.it_assets
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin-%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin-%');

-- Allow client users to access assets in their organization
CREATE POLICY client_org_access_it_assets ON public.it_assets
  FOR ALL TO authenticated
  USING (
    org_id::text = (auth.jwt() -> 'app_metadata' ->> 'org_id')
  )
  WITH CHECK (
    org_id::text = (auth.jwt() -> 'app_metadata' ->> 'org_id')
  );

-- 4. it_asset_uploads
ALTER TABLE public.it_asset_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_it_asset_uploads ON public.it_asset_uploads;
DROP POLICY IF EXISTS client_org_access_it_asset_uploads ON public.it_asset_uploads;

-- Allow admins full access to it_asset_uploads
CREATE POLICY admin_full_access_it_asset_uploads ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin-%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin-%');

-- Allow client users to access uploads in their organization
CREATE POLICY client_org_access_it_asset_uploads ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (
    org_id::text = (auth.jwt() -> 'app_metadata' ->> 'org_id')
  )
  WITH CHECK (
    org_id::text = (auth.jwt() -> 'app_metadata' ->> 'org_id')
  );

-- 5. pa_categories
ALTER TABLE public.pa_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow admins to manage pa_categories" ON public.pa_categories;
DROP POLICY IF EXISTS "Allow all authenticated users to read pa_categories" ON public.pa_categories;

-- Allow admins to manage pa_categories
CREATE POLICY "Allow admins to manage pa_categories" ON public.pa_categories
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin-%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin-%');

-- Allow all authenticated users to read active pa_categories
CREATE POLICY "Allow all authenticated users to read pa_categories" ON public.pa_categories
  FOR SELECT TO authenticated
  USING (is_active = true);

-- 6. pa_assessments
ALTER TABLE public.pa_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow admins to manage pa_assessments" ON public.pa_assessments;
DROP POLICY IF EXISTS "Allow all authenticated users to read pa_assessments" ON public.pa_assessments;

-- Allow admins to manage pa_assessments
CREATE POLICY "Allow admins to manage pa_assessments" ON public.pa_assessments
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin-%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin-%');

-- Allow all authenticated users to read active pa_assessments
CREATE POLICY "Allow all authenticated users to read pa_assessments" ON public.pa_assessments
  FOR SELECT TO authenticated
  USING (is_active = true);