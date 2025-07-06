-- Fix for user creation issue
-- Run this in your Supabase SQL editor

-- First, let's check the current user_profiles table structure
-- and ensure it has all required fields

-- Add any missing columns to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(org_id);

-- Update the handle_new_user function to be more robust
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  org_id_val INTEGER;
  user_name TEXT;
  user_role TEXT;
  user_organization TEXT;
BEGIN
  -- Extract user data from metadata
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client-manager');
  user_organization := COALESCE(NEW.raw_user_meta_data->>'organization', 'Default Organization');
  
  -- Try to find existing organization by org_code
  IF NEW.raw_user_meta_data->>'orgCode' IS NOT NULL THEN
    SELECT o.org_id INTO org_id_val 
    FROM organizations o 
    WHERE o.org_code = NEW.raw_user_meta_data->>'orgCode';
  END IF;

  -- Insert user profile with error handling
  BEGIN
    INSERT INTO public.user_profiles (id, name, role, organization, org_id, created_at)
    VALUES (
      NEW.id,
      user_name,
      user_role,
      user_organization,
      org_id_val,
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create user profile for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also, let's ensure the organizations exist for the existing users
INSERT INTO organizations (org_code, org_name, description, sector, remarks) VALUES
('FFITS', 'Future Focus IT Solutions', 'IT solutions and consulting company', 'Technology', 'Manasvee Dixit organization'),
('STRAT', 'StratifyIT.ai', 'IT consulting and strategy firm', 'Consulting', 'Vijaykumar Dixit organization')
ON CONFLICT (org_code) DO NOTHING;

-- Update existing user profiles to link them to organizations
DO $$
DECLARE
  ffits_org_id INTEGER;
  strat_org_id INTEGER;
BEGIN
  -- Get organization IDs
  SELECT org_id INTO ffits_org_id FROM organizations WHERE org_code = 'FFITS';
  SELECT org_id INTO strat_org_id FROM organizations WHERE org_code = 'STRAT';
  
  -- Update Manasvee Dixit's profile
  UPDATE user_profiles 
  SET 
    name = 'Manasvee Dixit',
    organization = 'Future Focus IT Solutions',
    org_id = ffits_org_id,
    role = 'client-cxo'
  WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'manasveedixit@gmail.com'
  );
  
  -- Update Vijaykumar Dixit's profile
  UPDATE user_profiles 
  SET 
    name = 'Vijaykumar Dixit',
    organization = 'StratifyIT.ai',
    org_id = strat_org_id,
    role = 'admin-super'
  WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'vijaykumardixit@gmail.com'
  );
  
  RAISE NOTICE 'Updated existing user profiles';
END $$;

-- Verify the setup
SELECT 
  up.name,
  up.email,
  up.organization,
  up.role,
  o.org_code,
  o.org_name
FROM user_profiles up
LEFT JOIN organizations o ON up.org_id = o.org_id
WHERE up.name IN ('Manasvee Dixit', 'Vijaykumar Dixit')
ORDER BY up.name; 