-- RLS policies using unified users table

-- 1. client_orgs
ALTER TABLE public.client_orgs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_client_orgs ON public.client_orgs;
DROP POLICY IF EXISTS full_access_client_orgs ON public.client_orgs;

-- Allow all authenticated users to select from client_orgs
CREATE POLICY full_access_client_orgs ON public.client_orgs
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_users_access ON public.users;
DROP POLICY IF EXISTS users_access ON public.users;
DROP POLICY IF EXISTS users_insert_own ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;

-- Admin full access
CREATE POLICY admin_full_users_access ON public.users
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role LIKE 'admin-%'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role LIKE 'admin-%'
    )
  );

-- Users can read their own data and others in same org
CREATE POLICY users_access ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR
    (
      SELECT org_id FROM public.users WHERE id = auth.uid()
    ) = org_id OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role LIKE 'admin-%'
    )
  );

-- Users can insert their own record
CREATE POLICY users_insert_own ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can update their own record
CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 3. it_assets
ALTER TABLE public.it_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_it_assets ON public.it_assets;
DROP POLICY IF EXISTS client_org_access_it_assets ON public.it_assets;

-- Admin full access
CREATE POLICY admin_full_access_it_assets ON public.it_assets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role LIKE 'admin-%'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role LIKE 'admin-%'
    )
  );

-- Client org access
CREATE POLICY client_org_access_it_assets ON public.it_assets
  FOR ALL TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM public.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id = (
      SELECT org_id FROM public.users WHERE id = auth.uid()
    )
  );

-- 4. it_asset_uploads
ALTER TABLE public.it_asset_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_it_asset_uploads ON public.it_asset_uploads;
DROP POLICY IF EXISTS client_org_access_it_asset_uploads ON public.it_asset_uploads;

-- Admin full access
CREATE POLICY admin_full_access_it_asset_uploads ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role LIKE 'admin-%'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role LIKE 'admin-%'
    )
  );

-- Client org access
CREATE POLICY client_org_access_it_asset_uploads ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (
    org_id = (
      SELECT org_id FROM public.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id = (
      SELECT org_id FROM public.users WHERE id = auth.uid()
    )
  );

-- 5. pa_categories
ALTER TABLE public.pa_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_pa_categories ON public.pa_categories;
DROP POLICY IF EXISTS authenticated_read_pa_categories ON public.pa_categories;

-- Admin full access
CREATE POLICY admin_full_access_pa_categories ON public.pa_categories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role LIKE 'admin-%'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role LIKE 'admin-%'
    )
  );

-- Authenticated users can read active categories
CREATE POLICY authenticated_read_pa_categories ON public.pa_categories
  FOR SELECT TO authenticated
  USING (is_active = true);

-- 6. pa_assessments
ALTER TABLE public.pa_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access_pa_assessments ON public.pa_assessments;
DROP POLICY IF EXISTS authenticated_read_pa_assessments ON public.pa_assessments;

-- Admin full access
CREATE POLICY admin_full_access_pa_assessments ON public.pa_assessments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role LIKE 'admin-%'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role LIKE 'admin-%'
    )
  );

-- Authenticated users can read active assessments
CREATE POLICY authenticated_read_pa_assessments ON public.pa_assessments
  FOR SELECT TO authenticated
  USING (is_active = true);