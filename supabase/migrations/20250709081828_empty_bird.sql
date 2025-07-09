/*
  # Fix Foreign Key References and Remove Unnecessary Users Table

  1. Problem Analysis
    - An unnecessary `users` table was created as intermediary between auth.users and admin_users/client_users
    - Foreign keys were incorrectly pointing to this intermediate table
    - This creates unnecessary complexity and potential data inconsistency

  2. Solution
    - Remove the intermediate `users` table
    - Restore direct foreign key references from admin_users/client_users to auth.users
    - Update the trigger to work directly with the profile tables
    - Ensure RLS policies work correctly with direct auth.users references

  3. Changes
    - Drop users table and related constraints
    - Restore original foreign key constraints to auth.users
    - Update handle_new_user trigger to work with profile tables directly
    - Clean up any orphaned data
*/

-- First, drop the trigger that references the users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Drop foreign key constraints that reference the users table
ALTER TABLE IF EXISTS client_users DROP CONSTRAINT IF EXISTS client_users_id_fkey;
ALTER TABLE IF EXISTS admin_users DROP CONSTRAINT IF EXISTS admin_users_id_fkey;

-- Drop the unnecessary users table
DROP TABLE IF EXISTS users CASCADE;

-- Restore correct foreign key constraints directly to auth.users
ALTER TABLE admin_users 
ADD CONSTRAINT admin_users_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE client_users 
ADD CONSTRAINT client_users_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create a simplified trigger function that doesn't use intermediate users table
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_name text;
  user_org_id integer;
BEGIN
  -- Extract metadata from the new auth user
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client-manager');
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  user_org_id := CASE 
    WHEN NEW.raw_user_meta_data->>'org_id' IS NOT NULL 
    THEN (NEW.raw_user_meta_data->>'org_id')::integer 
    ELSE NULL 
  END;

  -- Insert into appropriate profile table based on role
  IF user_role LIKE 'admin-%' THEN
    -- Insert into admin_users table
    INSERT INTO admin_users (id, email, name, role, created_at)
    VALUES (
      NEW.id,
      NEW.email,
      user_name,
      user_role,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role;
      
  ELSIF user_role LIKE 'client-%' THEN
    -- Insert into client_users table
    INSERT INTO client_users (id, email, name, role, org_id, created_at)
    VALUES (
      NEW.id,
      NEW.email,
      user_name,
      user_role,
      user_org_id,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      org_id = EXCLUDED.org_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the auth user creation
  RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Clean up any orphaned data and ensure consistency
-- Remove any admin_users that don't have corresponding auth.users
DELETE FROM admin_users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- Remove any client_users that don't have corresponding auth.users  
DELETE FROM client_users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- Verify the setup
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully';
  RAISE NOTICE 'Admin users count: %', (SELECT COUNT(*) FROM admin_users);
  RAISE NOTICE 'Client users count: %', (SELECT COUNT(*) FROM client_users);
  RAISE NOTICE 'Auth users count: %', (SELECT COUNT(*) FROM auth.users);
END $$;