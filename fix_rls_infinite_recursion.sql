-- Fix for infinite recursion in RLS policies
-- Run this in your Supabase SQL editor

-- First, let's disable RLS temporarily to break the recursion
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies that might be causing the recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Super admins can manage all users" ON user_profiles;
DROP POLICY IF EXISTS "Trigger can insert user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view all user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can manage their own profile" ON user_profiles;

-- Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create simplified policies that don't cause recursion
-- Policy 1: Allow users to view their own profile (simple check)
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy 2: Allow users to update their own profile (simple check)
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy 3: Allow insert for new user profiles (needed for trigger)
CREATE POLICY "Allow insert user profiles"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy 4: Super admin policy that doesn't cause recursion
-- Instead of checking user_profiles table, we'll use a simpler approach
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

-- Now let's fix the user profile for Vijaykumar Dixit
DO $$
DECLARE
  user_exists BOOLEAN;
  org_id_val INTEGER;
BEGIN
  -- Check if user profile exists
  SELECT EXISTS(
    SELECT 1 FROM user_profiles 
    WHERE id = '18c4a211-4125-444f-812b-4d5ae83bb39a'
  ) INTO user_exists;
  
  -- Get the STRAT organization ID
  SELECT org_id INTO org_id_val FROM organizations WHERE org_code = 'STRAT';
  
  IF user_exists THEN
    -- Update existing profile
    UPDATE user_profiles 
    SET 
      name = 'Vijaykumar Dixit',
      role = 'admin-super',
      organization = 'StratifyIT.ai',
      org_id = org_id_val,
      updated_at = now()
    WHERE id = '18c4a211-4125-444f-812b-4d5ae83bb39a';
    
    RAISE NOTICE 'Updated existing user profile for Vijaykumar Dixit';
  ELSE
    -- Create new profile
    INSERT INTO user_profiles (
      id,
      name,
      role,
      organization,
      org_id,
      created_at,
      updated_at
    ) VALUES (
      '18c4a211-4125-444f-812b-4d5ae83bb39a',
      'Vijaykumar Dixit',
      'admin-super',
      'StratifyIT.ai',
      org_id_val,
      now(),
      now()
    );
    
    RAISE NOTICE 'Created new user profile for Vijaykumar Dixit';
  END IF;
END $$;

-- Also ensure Manasvee Dixit's profile exists
DO $$
DECLARE
  user_exists BOOLEAN;
  org_id_val INTEGER;
BEGIN
  -- Check if user profile exists for Manasvee
  SELECT EXISTS(
    SELECT 1 FROM user_profiles up
    JOIN auth.users au ON up.id = au.id
    WHERE au.email = 'manasveedixit@gmail.com'
  ) INTO user_exists;
  
  -- Get the FFITS organization ID
  SELECT org_id INTO org_id_val FROM organizations WHERE org_code = 'FFITS';
  
  IF user_exists THEN
    -- Update existing profile
    UPDATE user_profiles 
    SET 
      name = 'Manasvee Dixit',
      role = 'client-cxo',
      organization = 'Future Focus IT Solutions',
      org_id = org_id_val,
      updated_at = now()
    WHERE id IN (
      SELECT id FROM auth.users WHERE email = 'manasveedixit@gmail.com'
    );
    
    RAISE NOTICE 'Updated existing user profile for Manasvee Dixit';
  ELSE
    -- Create new profile for Manasvee
    INSERT INTO user_profiles (
      id,
      name,
      role,
      organization,
      org_id,
      created_at,
      updated_at
    ) 
    SELECT 
      au.id,
      'Manasvee Dixit',
      'client-cxo',
      'Future Focus IT Solutions',
      org_id_val,
      now(),
      now()
    FROM auth.users au
    WHERE au.email = 'manasveedixit@gmail.com';
    
    RAISE NOTICE 'Created new user profile for Manasvee Dixit';
  END IF;
END $$;

-- Verify the fix
SELECT 'Verifying user profiles after fix' as status;

SELECT 
  up.id,
  up.name,
  up.role,
  up.organization,
  o.org_code,
  up.created_at
FROM user_profiles up
LEFT JOIN organizations o ON up.org_id = o.org_id
WHERE up.name IN ('Vijaykumar Dixit', 'Manasvee Dixit')
ORDER BY up.name;

-- Show current RLS policies
SELECT 'Current RLS policies on user_profiles' as status;

SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_profiles' 
AND schemaname = 'public'; 