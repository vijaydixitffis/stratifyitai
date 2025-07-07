/*
  # Fix Organization and User Management System

  1. Database Structure
    - Ensure organizations table has proper constraints
    - Fix user_profiles table structure
    - Add proper foreign key relationships
    - Fix RLS policies

  2. Functions and Triggers
    - Fix handle_new_user function
    - Add organization management functions
    - Ensure proper user creation workflow

  3. Security
    - Fix RLS policies for organization management
    - Ensure super admins can manage everything
    - Proper user creation permissions
*/

-- First, let's check and fix the organizations table structure
CREATE TABLE IF NOT EXISTS organizations (
  org_id SERIAL PRIMARY KEY,
  org_code VARCHAR(5) UNIQUE NOT NULL,
  org_name TEXT NOT NULL,
  description TEXT,
  sector TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure the constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'check_org_code_length'
  ) THEN
    ALTER TABLE organizations 
    ADD CONSTRAINT check_org_code_length CHECK (length(org_code) = 5);
  END IF;
END $$;

-- Ensure user_profiles table has all required columns
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS org_id INTEGER;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_profiles_org_id_fkey'
  ) THEN
    ALTER TABLE user_profiles 
    ADD CONSTRAINT user_profiles_org_id_fkey 
    FOREIGN KEY (org_id) REFERENCES organizations(org_id);
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_organizations_org_code ON organizations(org_code);
CREATE INDEX IF NOT EXISTS idx_user_profiles_org_id ON user_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_organization ON user_profiles(organization);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at);

-- Enable RLS on both tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to recreate them properly
DROP POLICY IF EXISTS "Authenticated users can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Super admins can manage all organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow insert user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Super admins full access" ON user_profiles;

-- Create comprehensive RLS policies for organizations
CREATE POLICY "Authenticated users can view all organizations"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage all organizations"
  ON organizations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin-super'
    )
  );

-- Create comprehensive RLS policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Allow insert user profiles"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins full access"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (
    -- Check if the current user has admin-super role in their metadata
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin-super'
    OR
    -- Fallback: allow if user is creating their own profile
    id = auth.uid()
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin-super'
    OR
    id = auth.uid()
  );

-- Create or replace function to update organization updated_at
CREATE OR REPLACE FUNCTION update_organization_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for organizations updated_at
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_updated_at();

-- Create or replace function to update user_profile updated_at
CREATE OR REPLACE FUNCTION update_user_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user_profiles updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profile_updated_at();

-- Create or replace the handle_new_user function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  org_id_val INTEGER;
  user_name TEXT;
  user_role TEXT;
  user_organization TEXT;
  user_email TEXT;
BEGIN
  -- Extract user data from metadata with safe defaults
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client-manager');
  user_organization := COALESCE(NEW.raw_user_meta_data->>'organization', 'Default Organization');
  user_email := NEW.email;
  
  -- Try to find existing organization by org_code first
  IF NEW.raw_user_meta_data->>'orgCode' IS NOT NULL THEN
    BEGIN
      SELECT o.org_id INTO org_id_val 
      FROM organizations o 
      WHERE o.org_code = NEW.raw_user_meta_data->>'orgCode';
    EXCEPTION WHEN OTHERS THEN
      org_id_val := NULL;
    END;
  END IF;

  -- If org_id is provided in metadata, use it (this takes precedence)
  IF NEW.raw_user_meta_data->>'org_id' IS NOT NULL THEN
    BEGIN
      org_id_val := (NEW.raw_user_meta_data->>'org_id')::INTEGER;
      
      -- Verify this org_id exists
      IF NOT EXISTS (SELECT 1 FROM organizations WHERE org_id = org_id_val) THEN
        org_id_val := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Keep the org_id_val from orgCode lookup or NULL
    END;
  END IF;

  -- Insert user profile with comprehensive error handling
  BEGIN
    INSERT INTO public.user_profiles (
      id, 
      name, 
      email,
      role, 
      organization, 
      org_id, 
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      user_name,
      user_email,
      user_role,
      user_organization,
      org_id_val,
      now(),
      now()
    );
    
    RAISE NOTICE 'Successfully created user profile for user % (%) with role % and org_id %', 
      NEW.id, user_name, user_role, org_id_val;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log the specific error but don't fail the user creation
    RAISE WARNING 'Failed to create user profile for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    
    -- Try to insert with minimal required fields as fallback
    BEGIN
      INSERT INTO public.user_profiles (
        id, 
        name, 
        email,
        role, 
        organization,
        created_at,
        updated_at
      )
      VALUES (
        NEW.id,
        user_name,
        user_email,
        'client-manager',
        'Default Organization',
        now(),
        now()
      );
      RAISE NOTICE 'Created fallback user profile for user %', NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create fallback user profile for user %: %', NEW.id, SQLERRM;
    END;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Insert some default organizations if they don't exist
INSERT INTO organizations (org_code, org_name, description, sector, remarks) VALUES
('STRAT', 'StratifyIT.ai', 'IT consulting and strategy firm', 'Consulting', 'Internal organization'),
('DEMO1', 'Demo Corporation', 'Demo organization for testing', 'Technology', 'Demo organization'),
('TECH1', 'TechCorp Inc.', 'Technology solutions provider', 'Technology', 'Sample client organization'),
('FFITS', 'Future Focus IT Solutions', 'IT solutions and consulting company', 'Technology', 'Manasvee Dixit organization')
ON CONFLICT (org_code) DO NOTHING;

-- Update existing user profiles to link them to organizations where possible
DO $$
DECLARE
  strat_org_id INTEGER;
  demo_org_id INTEGER;
  tech_org_id INTEGER;
  ffits_org_id INTEGER;
BEGIN
  -- Get organization IDs
  SELECT org_id INTO strat_org_id FROM organizations WHERE org_code = 'STRAT';
  SELECT org_id INTO demo_org_id FROM organizations WHERE org_code = 'DEMO1';
  SELECT org_id INTO tech_org_id FROM organizations WHERE org_code = 'TECH1';
  SELECT org_id INTO ffits_org_id FROM organizations WHERE org_code = 'FFITS';
  
  -- Update users based on their organization names
  UPDATE user_profiles 
  SET org_id = strat_org_id
  WHERE organization ILIKE '%stratify%' AND org_id IS NULL;
  
  UPDATE user_profiles 
  SET org_id = tech_org_id
  WHERE organization ILIKE '%techcorp%' AND org_id IS NULL;
  
  UPDATE user_profiles 
  SET org_id = demo_org_id
  WHERE organization ILIKE '%demo%' AND org_id IS NULL;
  
  UPDATE user_profiles 
  SET org_id = ffits_org_id
  WHERE organization ILIKE '%future focus%' AND org_id IS NULL;
  
  RAISE NOTICE 'Updated existing user profiles with organization links';
END $$;

-- Create a function to safely create organization with user
CREATE OR REPLACE FUNCTION create_organization_with_cxo(
  p_org_code TEXT,
  p_org_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_sector TEXT DEFAULT 'Technology',
  p_remarks TEXT DEFAULT NULL,
  p_cxo_email TEXT DEFAULT NULL,
  p_cxo_name TEXT DEFAULT NULL
)
RETURNS TABLE(org_id INTEGER, org_code TEXT, org_name TEXT, success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id INTEGER;
  result_message TEXT;
BEGIN
  -- Validate org_code length
  IF length(p_org_code) != 5 THEN
    RETURN QUERY SELECT NULL::INTEGER, p_org_code, p_org_name, FALSE, 'Organization code must be exactly 5 characters';
    RETURN;
  END IF;

  -- Check if org_code already exists
  IF EXISTS (SELECT 1 FROM organizations WHERE organizations.org_code = upper(p_org_code)) THEN
    RETURN QUERY SELECT NULL::INTEGER, p_org_code, p_org_name, FALSE, 'Organization code already exists';
    RETURN;
  END IF;

  BEGIN
    -- Insert the organization
    INSERT INTO organizations (org_code, org_name, description, sector, remarks)
    VALUES (upper(p_org_code), p_org_name, p_description, p_sector, p_remarks)
    RETURNING organizations.org_id INTO new_org_id;
    
    result_message := 'Organization created successfully';
    
    -- Return success
    RETURN QUERY SELECT new_org_id, upper(p_org_code), p_org_name, TRUE, result_message;
    
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT NULL::INTEGER, p_org_code, p_org_name, FALSE, 'Failed to create organization: ' || SQLERRM;
  END;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_organization_with_cxo TO authenticated;

-- Show current state for verification
SELECT 'Current organizations:' as info;
SELECT org_id, org_code, org_name, description, sector FROM organizations ORDER BY org_code;

SELECT 'Current user profiles with organizations:' as info;
SELECT 
  up.id,
  up.name,
  up.email,
  up.role,
  up.organization,
  up.org_id,
  o.org_code
FROM user_profiles up
LEFT JOIN organizations o ON up.org_id = o.org_id
ORDER BY up.created_at DESC;

SELECT 'RLS policies verification:' as info;
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('organizations', 'user_profiles')
ORDER BY tablename, policyname;