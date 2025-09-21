-- Updated handle_new_user function for unified users table
-- This function is triggered after insert on auth.users to create a profile in the users table

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role text;
  user_name text;
  user_org_id integer;
  user_org_code text;
  user_organization text;
BEGIN
  -- Extract metadata from the new auth user
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client-manager');
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  user_org_id := CASE 
    WHEN NEW.raw_user_meta_data->>'org_id' IS NOT NULL 
    THEN (NEW.raw_user_meta_data->>'org_id')::integer 
    ELSE NULL 
  END;
  user_org_code := COALESCE(NEW.raw_user_meta_data->>'orgCode', 
    CASE WHEN user_role LIKE 'admin%' THEN 'ADMIN' ELSE 'UNKNOWN' END);
  user_organization := COALESCE(NEW.raw_user_meta_data->>'organization', 'Unknown Organization');

  -- Insert into unified users table
  INSERT INTO public.users (
    id, 
    email, 
    name, 
    role, 
    org_id, 
    org_code, 
    organization, 
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    user_role,
    user_org_id,
    user_org_code,
    user_organization,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    org_id = EXCLUDED.org_id,
    org_code = EXCLUDED.org_code,
    organization = EXCLUDED.organization,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the auth user creation
  RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;

-- Create trigger: call handle_new_user after insert on auth.users
CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();