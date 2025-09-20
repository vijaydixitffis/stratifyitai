-- Fix admin user role detection in create_current_user_profile function
-- This migration updates the function to detect admin users based on email domain

/*
  FIX OVERVIEW:
  - Updates create_current_user_profile to detect admin users by email domain
  - Admin users with @stratifyit.ai email get 'admin' role
  - Other users default to 'client-manager' role
  - Fixes the issue where admin users were getting 'client-manager' role
*/

BEGIN;

-- Update the create_current_user_profile function to detect admin users
CREATE OR REPLACE FUNCTION public.create_current_user_profile()
RETURNS JSONB AS $$
DECLARE
  current_user_id UUID;
  current_user_email TEXT;
  current_user_metadata JSONB;
  user_role TEXT;
  user_name TEXT;
  user_org_id INTEGER;
  user_organization TEXT;
  result JSONB;
BEGIN
  -- Get current user info (only works when authenticated)
  current_user_id := auth.uid();
  current_user_email := auth.jwt() ->> 'email';
  current_user_metadata := COALESCE(auth.jwt() -> 'user_metadata', '{}'::JSONB);

  -- Determine user role based on email domain or metadata
  user_role := COALESCE(
    current_user_metadata->>'role',
    CASE
      WHEN current_user_email LIKE '%@stratifyit.ai' THEN 'admin'
      ELSE 'client-manager'
    END
  );

  -- Extract user name from metadata or email
  user_name := COALESCE(
    current_user_metadata->>'name',
    current_user_metadata->>'full_name',
    split_part(current_user_email, '@', 1), -- Use email prefix as fallback
    'User'
  );

  -- Set organization and org_id based on role
  IF user_role = 'admin' THEN
    user_org_id := NULL;
    user_organization := 'StratifyIT.ai';
  ELSE
    user_org_id := COALESCE(
      (current_user_metadata->>'org_id')::INTEGER,
      NULL
    );
    user_organization := COALESCE(
      current_user_metadata->>'organization',
      'Unknown Organization'
    );
  END IF;

  -- Check if user already has a profile
  IF EXISTS (SELECT 1 FROM public.users WHERE id = current_user_id) THEN
    -- Update existing profile with correct role
    UPDATE public.users SET
      email = current_user_email,
      name = user_name,
      role = user_role,
      org_id = user_org_id,
      organization = user_organization,
      updated_at = NOW()
    WHERE id = current_user_id
    RETURNING
      jsonb_build_object(
        'id', id,
        'email', email,
        'name', name,
        'role', role,
        'org_id', org_id,
        'organization', organization,
        'created_at', created_at,
        'updated_at', updated_at
      ) INTO result;

    RETURN result;
  END IF;

  -- Create new profile
  INSERT INTO public.users (
    id,
    email,
    name,
    role,
    org_id,
    organization,
    created_at,
    updated_at
  ) VALUES (
    current_user_id,
    current_user_email,
    user_name,
    user_role,
    user_org_id,
    user_organization,
    NOW(),
    NOW()
  )
  RETURNING
    jsonb_build_object(
      'id', id,
      'email', email,
      'name', name,
      'role', role,
      'org_id', org_id,
      'organization', organization,
      'created_at', created_at,
      'updated_at', updated_at
    ) INTO result;

  -- Return the created/updated profile
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_current_user_profile() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.create_current_user_profile() IS 'Creates or updates a profile for the currently authenticated user with automatic admin role detection';

-- Verify the function is updated
DO $$
BEGIN
  RAISE NOTICE 'Admin user role detection fix applied successfully';
  RAISE NOTICE 'Users with @stratifyit.ai email will automatically get admin role';
  RAISE NOTICE 'Other users will get client-manager role by default';
END $$;

COMMIT;

-- ROLLBACK INSTRUCTIONS:
-- If you need to rollback this migration, run:
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.create_current_user_profile();
-- -- Then recreate the original function from a previous migration
-- COMMIT;
