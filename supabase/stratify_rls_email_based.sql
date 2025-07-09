-- RLS policies using email domain for admin access

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

-- Allow all authenticated users to select from client_orgs
CREATE POLICY full_access_client_orgs ON public.client_orgs
  FOR SELECT
  TO authenticated
  USING (true);


-- 2. client_users
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_client_users ON public.client_users;
CREATE POLICY admin_full_access_client_users ON public.client_users
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid));

DROP POLICY IF EXISTS client_org_access_client_users ON public.client_users;
DROP POLICY IF EXISTS client_access_client_users ON public.client_users;
CREATE POLICY client_access_client_users ON public.client_users
  FOR ALL TO authenticated
  USING (
    org_id::text = auth.jwt() ->> 'org_id'
  )
  WITH CHECK (
    org_id::text = auth.jwt() ->> 'org_id'
  );

-- 3. it_assets
ALTER TABLE public.it_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_it_assets ON public.it_assets;
CREATE POLICY admin_full_access_it_assets ON public.it_assets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid));
DROP POLICY IF EXISTS client_org_access_it_assets ON public.it_assets;
CREATE POLICY client_org_access_it_assets ON public.it_assets
  FOR ALL TO authenticated
  USING (
    org_id::text = auth.jwt() ->> 'org_id'
  )
  WITH CHECK (
    org_id::text = auth.jwt() ->> 'org_id'
  );

-- 4. it_asset_uploads
ALTER TABLE public.it_asset_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_it_asset_uploads ON public.it_asset_uploads;
CREATE POLICY admin_full_access_it_asset_uploads ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid));
DROP POLICY IF EXISTS client_org_access_it_asset_uploads ON public.it_asset_uploads;
CREATE POLICY client_org_access_it_asset_uploads ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (
    org_id::text = auth.jwt() ->> 'org_id'
  )
  WITH CHECK (
    org_id::text = auth.jwt() ->> 'org_id'
  ); 