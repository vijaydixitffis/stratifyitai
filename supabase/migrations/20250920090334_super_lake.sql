/*
  # Update app_metadata for JWT claims

  1. Updates
    - Modify handle_new_user function to set app_metadata in auth.users
    - This ensures role, org_id, and org_code are available in JWT for RLS policies
  
  2. Security
    - Function runs with SECURITY DEFINER to update auth.users table
    - Maintains existing RLS policies that depend on JWT claims
*/

-- Function: handle_new_user()
-- Triggered after insert on auth.users to create a profile in admin_users or client_users
-- and update app_metadata for JWT claims

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role text;
  user_name text;
  user_org_id integer;
  user_org_code text;
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
    INSERT INTO public.admin_users (id, email, name, role, created_at)
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
    
    -- Set org_code for admin users
    user_org_code := 'ADMIN';
    
    -- Update app_metadata for admin users
    UPDATE auth.users 
    SET app_metadata = COALESCE(app_metadata, '{}'::jsonb) || 
        jsonb_build_object(
          'role', user_role,
          'org_code', user_org_code
        )
    WHERE id = NEW.id;
      
  ELSIF user_role LIKE 'client-%' THEN
    -- Get org_code for client users
    SELECT org_code INTO user_org_code
    FROM public.client_orgs
    WHERE org_id = user_org_id;
    
    -- Insert into client_users table
    INSERT INTO public.client_users (id, email, name, role, org_id, created_at)
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
    
    -- Update app_metadata for client users
    UPDATE auth.users 
    SET app_metadata = COALESCE(app_metadata, '{}'::jsonb) || 
        jsonb_build_object(
          'role', user_role,
          'org_id', user_org_id,
          'org_code', user_org_code
        )
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the auth user creation
  RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: call handle_new_user after insert on auth.users
DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER trg_handle_new_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();