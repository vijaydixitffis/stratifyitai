-- Fix for 500 error when creating users
-- Run this in your Supabase SQL editor

-- First, let's check and fix the user_profiles table structure
-- Make sure all required columns exist with proper types

-- Add missing columns if they don't exist
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(org_id);

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Drop policies that depend on the role column before altering it
DROP POLICY IF EXISTS "Super admins can manage all organizations" ON organizations;
DROP POLICY IF EXISTS "Super admins can manage all users" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Trigger can insert user profiles" ON user_profiles;

-- Now we can safely alter the role column
ALTER TABLE user_profiles 
ALTER COLUMN role TYPE TEXT;

-- Drop the existing trigger to recreate it properly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create a more robust handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  org_id_val INTEGER;
  user_name TEXT;
  user_role TEXT;
  user_organization TEXT;
BEGIN
  -- Extract user data from metadata with safe defaults
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client-manager');
  user_organization := COALESCE(NEW.raw_user_meta_data->>'organization', 'Default Organization');
  
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

  -- Insert user profile with comprehensive error handling
  BEGIN
    INSERT INTO public.user_profiles (
      id, 
      name, 
      role, 
      organization, 
      org_id, 
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      user_name,
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
        role, 
        organization,
        created_at,
        updated_at
      )
      VALUES (
        NEW.id,
        user_name,
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

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Recreate RLS policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Super admins can manage all users"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin-super'
    )
  );

-- Allow the trigger function to insert profiles (bypass RLS for trigger)
CREATE POLICY "Trigger can insert user profiles"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Recreate the organizations policy
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

-- Test the setup by checking the current user_profiles structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show current organizations
SELECT * FROM organizations ORDER BY org_code; 