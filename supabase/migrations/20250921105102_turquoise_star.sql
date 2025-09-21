-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS admin_full_access_client_orgs ON public.client_orgs;
DROP POLICY IF EXISTS admin_full_access_client_users ON public.client_users;
DROP POLICY IF EXISTS client_org_access_client_users ON public.client_users;
DROP POLICY IF EXISTS admin_full_access_it_assets ON public.it_assets;
DROP POLICY IF EXISTS client_org_access_it_assets ON public.it_assets;
DROP POLICY IF EXISTS admin_full_access_it_asset_uploads ON public.it_asset_uploads;
DROP POLICY IF EXISTS client_org_access_it_asset_uploads ON public.it_asset_uploads;
DROP POLICY IF EXISTS admin_full_access_admin_users ON public.admin_users;
DROP POLICY IF EXISTS admin_full_users_access ON public.users;
DROP POLICY IF EXISTS users_access ON public.users;
DROP POLICY IF EXISTS users_insert_own ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;

-- Enable RLS on all tables
ALTER TABLE public.client_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.it_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.it_asset_uploads ENABLE ROW LEVEL SECURITY;

-- 1. client_orgs policies
-- Admins: full access using JWT role
CREATE POLICY admin_full_access_client_orgs ON public.client_orgs
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin-%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin-%');

-- Clients: read access to their own org using JWT org_id
CREATE POLICY client_read_own_org ON public.client_orgs
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'role' LIKE 'client-%') AND 
    (org_id::text = auth.jwt() ->> 'org_id')
  );

-- Anonymous: read access for login validation
CREATE POLICY anon_select_organizations ON public.client_orgs
  FOR SELECT TO anon
  USING (true);

-- 2. users table policies (avoid recursion by using JWT directly)
-- Users can read their own record
CREATE POLICY users_read_own ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Users can update their own record
CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can insert their own record (for profile creation)
CREATE POLICY users_insert_own ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Admins: full access using JWT role (no recursion)
CREATE POLICY admin_full_access_users ON public.users
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin-%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin-%');

-- Clients: read access to users in their org using JWT org_id
CREATE POLICY client_read_org_users ON public.users
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'role' LIKE 'client-%') AND 
    (org_id::text = auth.jwt() ->> 'org_id')
  );

-- 3. it_assets policies
-- Admins: full access using JWT role
CREATE POLICY admin_full_access_it_assets ON public.it_assets
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin-%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin-%');

-- Clients: full access to their own org using JWT org_id
CREATE POLICY client_org_access_it_assets ON public.it_assets
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role' LIKE 'client-%') AND 
    (org_id::text = auth.jwt() ->> 'org_id')
  )
  WITH CHECK (
    (auth.jwt() ->> 'role' LIKE 'client-%') AND 
    (org_id::text = auth.jwt() ->> 'org_id')
  );

-- 4. it_asset_uploads policies
-- Admins: full access using JWT role
CREATE POLICY admin_full_access_it_asset_uploads ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin-%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin-%');

-- Clients: full access to their own org using JWT org_id
CREATE POLICY client_org_access_it_asset_uploads ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role' LIKE 'client-%') AND 
    (org_id::text = auth.jwt() ->> 'org_id')
  )
  WITH CHECK (
    (auth.jwt() ->> 'role' LIKE 'client-%') AND 
    (org_id::text = auth.jwt() ->> 'org_id')
  );