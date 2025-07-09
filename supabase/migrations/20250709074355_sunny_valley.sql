/*
  # Fix User Creation and Authentication Issues

  1. Tables
    - Ensure `users` table exists for auth.users references
    - Fix foreign key constraints for client_users and admin_users
    - Add proper RLS policies

  2. Security
    - Enable RLS on all user tables
    - Add policies for proper access control

  3. Functions
    - Create trigger function to handle new user creation
    - Ensure proper user profile creation on signup
*/

-- Ensure the users table exists (this should reference auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy for users table
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Service role can manage users"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into users table first
  INSERT INTO users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Ensure foreign key constraints are properly set up
DO $$
BEGIN
  -- Check if client_users foreign key exists and is correct
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'client_users_id_fkey' 
    AND table_name = 'client_users'
  ) THEN
    ALTER TABLE client_users 
    ADD CONSTRAINT client_users_id_fkey 
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  -- Check if admin_users foreign key exists and is correct
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'admin_users_id_fkey' 
    AND table_name = 'admin_users'
  ) THEN
    ALTER TABLE admin_users 
    ADD CONSTRAINT admin_users_id_fkey 
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update existing auth users to have entries in users table
INSERT INTO users (id, email, created_at, updated_at)
SELECT 
  id, 
  email, 
  created_at, 
  created_at
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = NOW();