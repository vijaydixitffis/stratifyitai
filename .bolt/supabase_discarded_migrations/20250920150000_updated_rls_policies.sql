-- UPDATED RLS POLICIES: Compatible with Unified Users Table
-- This migration updates RLS policies to work with the unified users table
-- and maintains proper multi-tenant access control

/*
  MIGRATION OVERVIEW:
  - Updates existing RLS policies to work with unified users table
  - Maintains admin privileges across organizations
  - Ensures client users are restricted to their organization
  - Replaces old policies that referenced separate admin_users/client_users tables
*/

-- 1. Drop existing policies that reference old table structure
DROP POLICY IF EXISTS admin_full_access_it_assets ON public.it_assets;
DROP POLICY IF EXISTS admin_full_access_client_users ON public.client_users;
DROP POLICY IF EXISTS admin_full_access_it_asset_uploads ON public.it_asset_uploads;
DROP POLICY IF EXISTS admin_full_access_client_orgs ON public.client_orgs;
DROP POLICY IF EXISTS client_users_assets_access ON public.it_assets;
DROP POLICY IF EXISTS client_users_access ON public.client_users;
DROP POLICY IF EXISTS client_users_modify ON public.client_users;
DROP POLICY IF EXISTS client_users_update ON public.client_users;
DROP POLICY IF EXISTS client_users_uploads_access ON public.it_asset_uploads;

-- 2. Create new admin policies using unified users table

-- Admin users get full access to it_assets
CREATE POLICY admin_full_access_it_assets ON public.it_assets
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Admin users get full access to users table (for viewing all users)
CREATE POLICY admin_full_access_users ON public.users
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Admin users get full access to it_asset_uploads
CREATE POLICY admin_full_access_it_asset_uploads ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Admin users get full access to client_orgs
CREATE POLICY admin_full_access_client_orgs ON public.client_orgs
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- 3. Create policies for client users (organization-based access)

-- Client users can access assets in their organization
CREATE POLICY client_users_assets_access ON public.it_assets
  FOR ALL TO authenticated
  USING (
    NOT auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    AND
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role LIKE 'client%'
      AND it_assets.org_id = u.org_id
    )
  )
  WITH CHECK (
    NOT auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    AND
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role LIKE 'client%'
      AND it_assets.org_id = u.org_id
    )
  );

-- Client users can access their own records and others in their organization
CREATE POLICY client_users_access ON public.users
  FOR SELECT TO authenticated
  USING (
    NOT auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    AND
    (users.id = auth.uid() OR users.org_id = (
      SELECT u.org_id FROM public.users u WHERE u.id = auth.uid()
    ))
  );

-- Client users can insert and update only their own records
CREATE POLICY client_users_modify ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    AND
    users.id = auth.uid()
  );

CREATE POLICY client_users_update ON public.users
  FOR UPDATE TO authenticated
  USING (
    NOT auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    AND
    users.id = auth.uid()
  )
  WITH CHECK (
    NOT auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    AND
    users.id = auth.uid()
  );

-- Client users can access uploads in their organization
CREATE POLICY client_users_uploads_access ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING (
    NOT auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    AND
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role LIKE 'client%'
      AND it_asset_uploads.org_id = u.org_id
    )
  )
  WITH CHECK (
    NOT auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin')
    AND
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role LIKE 'client%'
      AND it_asset_uploads.org_id = u.org_id
    )
  );

-- 4. Create helper functions for easier access control

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
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

-- 5. Enable RLS on users table (if not already enabled)
-- Note: This should already be enabled from the unified users migration
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 6. Add comments for documentation
COMMENT ON FUNCTION is_admin_user() IS 'Returns true if current user is admin (unified users table)';
COMMENT ON FUNCTION get_current_user_org_id() IS 'Returns current user''s organization ID (unified users table)';
COMMENT ON FUNCTION get_current_user_role() IS 'Returns current user''s role (unified users table)';

-- 7. Verify the migration
DO $$
DECLARE
  admin_count INTEGER;
  client_count INTEGER;
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM public.users WHERE role = 'admin';
  SELECT COUNT(*) INTO client_count FROM public.users WHERE role LIKE 'client%';
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE schemaname = 'public';

  RAISE NOTICE 'RLS Update completed successfully:';
  RAISE NOTICE '  - Admin users in unified table: %', admin_count;
  RAISE NOTICE '  - Client users in unified table: %', client_count;
  RAISE NOTICE '  - Total policies created/updated: %', policy_count;
END $$;
