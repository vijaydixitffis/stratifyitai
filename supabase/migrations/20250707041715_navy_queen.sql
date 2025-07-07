/*
  # Fix Client Management System

  1. Organizations Table
    - Ensure proper structure and constraints
    - Add proper indexes and policies
  
  2. User Profiles Integration
    - Link users to organizations
    - Update triggers and functions
  
  3. Security Policies
    - Proper RLS for organizations
    - Admin access controls
*/

-- First, ensure organizations table exists with proper structure
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

-- Add constraint to ensure org_code is exactly 5 characters
ALTER TABLE organizations 
DROP CONSTRAINT IF EXISTS check_org_code_length;

ALTER TABLE organizations 
ADD CONSTRAINT check_org_code_length CHECK (length(org_code) = 5);

-- Ensure user_profiles table has org_id column
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(org_id);

-- Add email column to user_profiles if it doesn't exist
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_organizations_org_code ON organizations(org_code);
CREATE INDEX IF NOT EXISTS idx_user_profiles_org_id ON user_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_organization ON user_profiles(organization);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at);

-- Enable RLS on organizations table
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Authenticated users can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Super admins can manage all organizations" ON organizations;

-- Create RLS policies for organizations
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

-- Update user_profiles policies to handle organization management
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Super admins can manage all users" ON user_profiles;
DROP POLICY IF EXISTS "Trigger can insert user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view all user profiles" ON user_profiles;

-- Recreate user_profiles policies
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
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin-super'
    OR
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

-- Update the handle_new_user function to properly handle organization linking
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
  
  -- Try to find existing organization by org_code
  IF NEW.raw_user_meta_data->>'orgCode' IS NOT NULL THEN
    BEGIN
      SELECT o.org_id INTO org_id_val 
      FROM organizations o 
      WHERE o.org_code = NEW.raw_user_meta_data->>'orgCode';
    EXCEPTION WHEN OTHERS THEN
      org_id_val := NULL;
    END;
  END IF;

  -- If org_id is provided in metadata, use it
  IF NEW.raw_user_meta_data->>'org_id' IS NOT NULL THEN
    BEGIN
      org_id_val := (NEW.raw_user_meta_data->>'org_id')::INTEGER;
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
    
    RAISE NOTICE 'Successfully created user profile for user % with role %', NEW.id, user_role;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log the specific error but don't fail the user creation
    RAISE WARNING 'Failed to create user profile for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    
    -- Try to insert with minimal required fields
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
('TECH1', 'TechCorp Inc.', 'Technology solutions provider', 'Technology', 'Sample client organization')
ON CONFLICT (org_code) DO NOTHING;

-- Update existing user profiles to link them to organizations where possible
DO $$
DECLARE
  strat_org_id INTEGER;
  demo_org_id INTEGER;
  tech_org_id INTEGER;
BEGIN
  -- Get organization IDs
  SELECT org_id INTO strat_org_id FROM organizations WHERE org_code = 'STRAT';
  SELECT org_id INTO demo_org_id FROM organizations WHERE org_code = 'DEMO1';
  SELECT org_id INTO tech_org_id FROM organizations WHERE org_code = 'TECH1';
  
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
  
  RAISE NOTICE 'Updated existing user profiles with organization links';
END $$;

-- Verify the setup
SELECT 'Organizations table structure:' as info;
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'User profiles table structure:' as info;
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'Current organizations:' as info;
SELECT * FROM organizations ORDER BY org_code;

SELECT 'Current RLS policies:' as info;
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('organizations', 'user_profiles')
ORDER BY tablename, policyname;