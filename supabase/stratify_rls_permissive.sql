-- Enable RLS and add permissive policies for StratifyIT.ai

-- 1. client_orgs
ALTER TABLE public.client_orgs ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY admin_full_access_client_orgs ON public.client_orgs
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin-%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin-%');

-- 2. client_users
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY admin_full_access_client_users ON public.client_users
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin-%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin-%');

-- Clients: full access to their own org
CREATE POLICY client_org_access_client_users ON public.client_users
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role' LIKE 'client-%') AND (org_id::text = auth.jwt() ->> 'org_id')
  )
  WITH CHECK (
    (auth.jwt() ->> 'role' LIKE 'client-%') AND (org_id::text = auth.jwt() ->> 'org_id')
  );

-- 3. it_assets
ALTER TABLE public.it_assets ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY admin_full_access_it_assets ON public.it_assets
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin-%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin-%');

-- Clients: full access to their own org
CREATE POLICY client_org_access_it_assets ON public.it_assets
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role' LIKE 'client-%') AND (org_id::text = auth.jwt() ->> 'org_id')
  )
  WITH CHECK (
    (auth.jwt() ->> 'role' LIKE 'client-%') AND (org_id::text = auth.jwt() ->> 'org_id')
  );

-- 4. it_asset_uploads
ALTER TABLE public.it_asset_uploads ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY admin_full_access_it_asset_uploads ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin-%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin-%');

-- Clients: full access to their own org
CREATE POLICY client_org_access_it_asset_uploads ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role' LIKE 'client-%') AND (org_id::text = auth.jwt() ->> 'org_id')
  )
  WITH CHECK (
    (auth.jwt() ->> 'role' LIKE 'client-%') AND (org_id::text = auth.jwt() ->> 'org_id')
  ); 

-- 0. admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins: full access
CREATE POLICY admin_full_access_admin_users ON public.admin_users
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' LIKE 'admin-%')
  WITH CHECK (auth.jwt() ->> 'role' LIKE 'admin-%'); 