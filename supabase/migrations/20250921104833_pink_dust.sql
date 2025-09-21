-- Function: handle_new_user()
-- Triggered after insert on auth.users to create a profile in the unified users table

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
  
  -- Set org-related fields based on role
  IF user_role LIKE 'admin-%' THEN
    user_org_id := NULL;
    user_org_code := 'ADMIN';
    user_organization := 'StratifyIT.ai';
  ELSE
    user_org_id := CASE 
      WHEN NEW.raw_user_meta_data->>'org_id' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'org_id')::integer 
      ELSE NULL 
    END;
    user_org_code := NEW.raw_user_meta_data->>'org_code';
    user_organization := NEW.raw_user_meta_data->>'organization';
  END IF;

  -- Insert into unified users table
  INSERT INTO public.users (id, email, name, role, org_id, org_code, organization, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    user_role,
    user_org_id,
    user_org_code,
    user_organization,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    org_id = EXCLUDED.org_id,
    org_code = EXCLUDED.org_code,
    organization = EXCLUDED.organization;

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