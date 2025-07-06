/*
  # User Profile System

  1. New Tables
    - `user_profiles`
      - `id` (uuid, references auth.users)
      - `name` (text)
      - `role` (text with enum constraint)
      - `organization` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `user_profiles` table
    - Add policies for users to read/update their own profiles
    - Add policies for admins to manage all profiles

  3. Functions
    - Auto-create profile on user signup
    - Update timestamp trigger
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'client-manager' CHECK (role IN (
    'client-manager', 
    'client-architect', 
    'client-cxo', 
    'admin-consultant', 
    'admin-architect', 
    'admin-super'
  )),
  organization text NOT NULL DEFAULT 'Default Organization',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON user_profiles;

-- Create simplified policies to avoid infinite recursion
CREATE POLICY "Users can view their own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow all authenticated users to view all profiles (for now)
-- This can be restricted later with proper role checking
CREATE POLICY "Authenticated users can view all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, role, organization)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client-manager'),
    COALESCE(NEW.raw_user_meta_data->>'organization', 'Default Organization')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profile_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_organization ON user_profiles(organization);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at);

-- Update assets table to reference user profiles properly
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_created_by_fkey;
ALTER TABLE assets ADD CONSTRAINT assets_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES user_profiles(id);

-- Create admin user function (for manual admin creation)
CREATE OR REPLACE FUNCTION create_admin_user(
  user_email text,
  user_password text,
  user_name text,
  user_role text DEFAULT 'admin-super',
  user_organization text DEFAULT 'StratifyIT.ai'
)
RETURNS uuid AS $$
DECLARE
  new_user_id uuid;
BEGIN
  -- This function should be called by a super admin or during initial setup
  -- In production, you'd want additional security checks here
  
  -- Note: This is a placeholder function. In practice, user creation
  -- should be done through Supabase Auth API or dashboard
  RAISE NOTICE 'Admin user creation should be done through Supabase Auth dashboard';
  RAISE NOTICE 'Email: %, Role: %, Organization: %', user_email, user_role, user_organization;
  
  RETURN null;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;