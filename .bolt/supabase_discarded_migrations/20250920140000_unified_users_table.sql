-- MIGRATION: Unified Users Table for Multi-Tenant Access Control
-- This migration consolidates admin_users and client_users into a single users table
-- while maintaining proper multi-tenant security and organization-based access control

/*
  MIGRATION OVERVIEW:
  - Creates unified 'users' table with role-based access
  - Migrates existing data from admin_users and client_users
  - Implements clean RLS policies for multi-tenant isolation
  - Maintains admin privileges across organizations
  - Ensures client users are restricted to their organization

  SAFETY:
  - Transaction-based migration (can be rolled back)
  - Preserves all existing data
  - No data loss during migration
  - Maintains referential integrity
*/

BEGIN;

-- 1. Create the unified users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'client-manager', 'client-architect', 'client-cxo')),
  org_id INTEGER, -- NULL for admins, specific org for clients
  organization TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON public.users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 2. Migrate data from existing tables
-- Migrate admin users first (they have no org restrictions)
INSERT INTO public.users (id, email, name, role, org_id, organization, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.name, 'Admin User'),
  'admin',
  NULL, -- Admins have no org restriction
  'StratifyIT.ai', -- Default organization for admins
  au.created_at,
  au.created_at
FROM public.admin_users au
ON CONFLICT (id) DO NOTHING; -- Skip if user already exists

-- Migrate client users (they belong to specific organizations)
INSERT INTO public.users (id, email, name, role, org_id, organization, created_at, updated_at)
SELECT
  cu.id,
  cu.email,
  cu.name,
  cu.role,
  cu.org_id,
  'Organization', -- Will be updated with actual org name later
  cu.created_at,
  cu.created_at
FROM public.client_users cu
ON CONFLICT (id) DO NOTHING; -- Skip if user already exists

-- 3. Update organization names for client users
-- This joins with client_orgs to get the actual organization names
UPDATE public.users
SET organization = co.org_name
FROM public.client_orgs co
WHERE public.users.org_id = co.org_id
  AND public.users.role LIKE 'client%';

-- 4. Enable RLS on the users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for multi-tenant access control

-- Policy: Admins can access everything
CREATE POLICY "users_admin_full_access" ON public.users
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Policy: Users can read their own record and others in their organization
CREATE POLICY "users_client_read_access" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR
    (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()) AND
     role LIKE 'client%')
  );

-- Policy: Users can only insert/update their own records
CREATE POLICY "users_client_modify" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') AND
    id = auth.uid()
  );

CREATE POLICY "users_client_update" ON public.users
  FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') AND
    id = auth.uid()
  )
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') AND
    id = auth.uid()
  );

-- 6. Create helper functions for easier access control

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

-- 7. Create views for backward compatibility (optional)
-- These views help existing code continue working during transition

CREATE OR REPLACE VIEW public.admin_users_view AS
SELECT id, email, name, created_at, updated_at
FROM public.users
WHERE role = 'admin';

CREATE OR REPLACE VIEW public.client_users_view AS
SELECT
  u.id,
  u.email,
  u.name,
  u.role,
  u.org_id,
  u.organization,
  u.created_at,
  u.updated_at
FROM public.users u
WHERE u.role LIKE 'client%';

-- 8. Add comments for documentation
COMMENT ON TABLE public.users IS 'Unified users table combining admin and client users for multi-tenant access control';
COMMENT ON COLUMN public.users.role IS 'User role: admin (full access) or client-* (org-restricted access)';
COMMENT ON COLUMN public.users.org_id IS 'Organization ID for client users (NULL for admins)';
COMMENT ON FUNCTION is_admin_user() IS 'Returns true if current user is admin';
COMMENT ON FUNCTION get_current_user_org_id() IS 'Returns current user''s organization ID';
COMMENT ON FUNCTION get_current_user_role() IS 'Returns current user''s role';

-- 9. Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. Verify the migration
-- Count migrated records
DO $$
DECLARE
  admin_count INTEGER;
  client_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM public.users WHERE role = 'admin';
  SELECT COUNT(*) INTO client_count FROM public.users WHERE role LIKE 'client%';
  SELECT COUNT(*) INTO total_count FROM public.users;

  RAISE NOTICE 'Migration completed successfully:';
  RAISE NOTICE '  - Admin users migrated: %', admin_count;
  RAISE NOTICE '  - Client users migrated: %', client_count;
  RAISE NOTICE '  - Total users in unified table: %', total_count;
END $$;

COMMIT;

-- ROLLBACK INSTRUCTIONS:
-- If you need to rollback this migration, run:
--
-- BEGIN;
-- DROP VIEW IF EXISTS public.client_users_view;
-- DROP VIEW IF EXISTS public.admin_users_view;
-- DROP FUNCTION IF EXISTS is_admin_user();
-- DROP FUNCTION IF EXISTS get_current_user_org_id();
-- DROP FUNCTION IF EXISTS get_current_user_role();
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
-- DROP TABLE IF EXISTS public.users;
-- COMMIT;
--
-- Then restore your original admin_users and client_users tables from backup.
