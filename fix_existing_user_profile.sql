-- Fix for existing user profile causing 500 error
-- Run this in your Supabase SQL editor

-- First, let's check if the user profile exists
SELECT 'Checking if user profile exists for Vijaykumar Dixit' as status;

SELECT 
  up.id,
  up.name,
  up.email,
  up.role,
  up.organization,
  up.org_id,
  up.created_at,
  up.updated_at
FROM user_profiles up
WHERE up.id = '18c4a211-4125-444f-812b-4d5ae83bb39a';

-- Check if the user exists in auth.users
SELECT 'Checking auth.users table' as status;

SELECT 
  id,
  email,
  raw_user_meta_data
FROM auth.users 
WHERE id = '18c4a211-4125-444f-812b-4d5ae83bb39a';

-- Check organizations table
SELECT 'Checking organizations table' as status;

SELECT * FROM organizations ORDER BY org_code;

-- Now let's fix the user profile if it's missing or corrupted
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
  up.email,
  up.role,
  up.organization,
  o.org_code,
  up.created_at
FROM user_profiles up
LEFT JOIN organizations o ON up.org_id = o.org_id
WHERE up.name IN ('Vijaykumar Dixit', 'Manasvee Dixit')
ORDER BY up.name;

-- Check the table structure to ensure everything is correct
SELECT 'Checking user_profiles table structure' as status;

SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position; 