-- RLS policies using direct auth.uid() to prevent infinite recursion

-- 0. admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_admin_users ON public.admin_users;
CREATE POLICY admin_full_access_admin_users ON public.admin_users
  FOR ALL TO authenticated
  USING (admin_users.id = auth.uid())
  WITH CHECK (admin_users.id = auth.uid());

-- 1. client_orgs
ALTER TABLE public.client_orgs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_client_orgs ON public.client_orgs;
DROP POLICY IF EXISTS full_access_client_orgs ON public.client_orgs;

-- Allow all authenticated users to select from client_orgs
CREATE POLICY full_access_client_orgs ON public.client_orgs
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. client_users - SIMPLIFIED to prevent recursion
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_client_users ON public.client_users;
DROP POLICY IF EXISTS client_org_access_client_users ON public.client_users;
DROP POLICY IF EXISTS client_access_client_users ON public.client_users;

-- Admin access: check if user exists in admin_users table
CREATE POLICY admin_full_access_client_users ON public.client_users
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = auth.uid()));

-- Self access: users can access their own record
CREATE POLICY self_access_client_users ON public.client_users
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 3. it_assets - SIMPLIFIED to prevent recursion
ALTER TABLE public.it_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_it_assets ON public.it_assets;
DROP POLICY IF EXISTS client_org_access_it_assets ON public.it_assets;

-- Admin access: check if user exists in admin_users table
CREATE POLICY admin_full_access_it_assets ON public.it_assets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = auth.uid()));

-- Client org access: check org_id matches user's org_id from client_users
CREATE POLICY client_org_access_it_assets ON public.it_assets
  FOR ALL TO authenticated
  USING (
    org_id IN (SELECT cu.org_id FROM public.client_users cu WHERE cu.id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT cu.org_id FROM public.client_users cu WHERE cu.id = auth.uid())
  );

-- 4. it_asset_uploads - SIMPLIFIED to prevent recursion
ALTER TABLE public.it_asset_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_it_asset_uploads ON public.it_asset_uploads;
DROP POLICY IF EXISTS client_org_access_it_asset_uploads ON public.it_asset_uploads;

-- Admin access: check if user exists in admin_users table
CREATE POLICY admin_full_access_it_asset_uploads ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = auth.uid()));

-- Client org access: check org_id matches user's org_id from client_users
CREATE POLICY client_org_access_it_asset_uploads ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (
    org_id IN (SELECT cu.org_id FROM public.client_users cu WHERE cu.id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT cu.org_id FROM public.client_users cu WHERE cu.id = auth.uid())
  );