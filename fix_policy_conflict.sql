-- Fix for policy conflict in navy_queen migration
-- Run this script before running the migration again

-- Drop the conflicting policy
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;

-- Also drop any other potentially conflicting policies
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Super admins can manage all users" ON user_profiles;
DROP POLICY IF EXISTS "Trigger can insert user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view all user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow insert user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Super admins full access" ON user_profiles;

-- Now you can run the migration again
-- The migration will recreate all the policies properly 