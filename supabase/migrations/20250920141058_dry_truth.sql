/*
  # Fix RLS Policies for Data Access

  1. Security Updates
    - Fix RLS policies on it_assets table
    - Fix RLS policies on client_users table
    - Add proper JWT metadata access
    - Ensure admins can access all data
    - Ensure clients can access their org data

  2. Changes
    - Drop existing problematic policies
    - Create new working policies with proper JWT access
    - Add anonymous access where needed for login flow
*/

-- Fix client_orgs policies (needed for login validation)
DROP POLICY IF EXISTS "Allow anonymous access to client_orgs for login" ON public.client_orgs;
DROP POLICY IF EXISTS "full_access_client_orgs" ON public.client_orgs;
DROP POLICY IF EXISTS "admin_full_access_client_orgs" ON public.client_orgs;

-- Allow anonymous access for organization validation during login
CREATE POLICY "Allow anonymous access to client_orgs for login"
  ON public.client_orgs
  FOR SELECT
  TO anon
  USING (true);

-- Allow all authenticated users to read organizations
CREATE POLICY "Allow authenticated read access to client_orgs"
  ON public.client_orgs
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins full access to organizations
CREATE POLICY "Allow admin full access to client_orgs"
  ON public.client_orgs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

-- Fix client_users policies
DROP POLICY IF EXISTS "admin_full_access_client_users" ON public.client_users;
DROP POLICY IF EXISTS "client_org_access_client_users" ON public.client_users;
DROP POLICY IF EXISTS "client_access_client_users" ON public.client_users;
DROP POLICY IF EXISTS "self_access_client_users" ON public.client_users;

-- Allow admins full access to client_users
CREATE POLICY "Allow admin full access to client_users"
  ON public.client_users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

-- Allow users to access their own profile
CREATE POLICY "Allow self access to client_users"
  ON public.client_users
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow users to read other users in their organization
CREATE POLICY "Allow org access to client_users"
  ON public.client_users
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.client_users 
      WHERE id = auth.uid()
    )
  );

-- Fix it_assets policies
DROP POLICY IF EXISTS "admin_full_access_it_assets" ON public.it_assets;
DROP POLICY IF EXISTS "client_org_access_it_assets" ON public.it_assets;

-- Allow admins full access to it_assets
CREATE POLICY "Allow admin full access to it_assets"
  ON public.it_assets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

-- Allow clients to access assets in their organization
CREATE POLICY "Allow client org access to it_assets"
  ON public.it_assets
  FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.client_users 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.client_users 
      WHERE id = auth.uid()
    )
  );

-- Fix it_asset_uploads policies
DROP POLICY IF EXISTS "admin_full_access_it_asset_uploads" ON public.it_asset_uploads;
DROP POLICY IF EXISTS "client_org_access_it_asset_uploads" ON public.it_asset_uploads;

-- Allow admins full access to it_asset_uploads
CREATE POLICY "Allow admin full access to it_asset_uploads"
  ON public.it_asset_uploads
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.id = auth.uid()
    )
  );

-- Allow clients to access uploads in their organization
CREATE POLICY "Allow client org access to it_asset_uploads"
  ON public.it_asset_uploads
  FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.client_users 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.client_users 
      WHERE id = auth.uid()
    )
  );

-- Fix admin_users policies
DROP POLICY IF EXISTS "admin_full_access_admin_users" ON public.admin_users;

-- Allow admins to access their own profile
CREATE POLICY "Allow self access to admin_users"
  ON public.admin_users
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());