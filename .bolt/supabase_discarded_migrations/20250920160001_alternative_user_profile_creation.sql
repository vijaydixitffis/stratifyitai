-- ALTERNATIVE APPROACH: User Profile Creation via Database Function
-- This migration provides an alternative to triggers that may have permission issues
-- Uses a database function that can be called from the application

/*
  ALTERNATIVE MIGRATION OVERVIEW:
  - Creates a database function to create user profiles
  - Can be called from application code after successful auth
  - Avoids permission issues with auth.users triggers
  - Provides the same auto-creation functionality
  - More reliable than direct trigger approach
*/

-- Create a function that can be called from the application
CREATE OR REPLACE FUNCTION public.create_user_profile(
  user_id UUID,
  user_email TEXT,
  user_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB AS $$
DECLARE
  user_role TEXT;
  user_name TEXT;
  user_org_id INTEGER;
  user_organization TEXT;
  result JSONB;
BEGIN
  -- Extract user metadata from the JSON parameter
  user_role := COALESCE(
    user_metadata->>'role',
    'client-manager' -- Default role
  );

  user_name := COALESCE(
    user_metadata->>'name',
    user_metadata->>'full_name',
    split_part(user_email, '@', 1), -- Use email prefix as fallback
    'User'
  );

  -- Only set org_id for non-admin users
  IF user_role = 'admin' THEN
    user_org_id := NULL;
    user_organization := 'StratifyIT.ai';
  ELSE
    user_org_id := COALESCE(
      (user_metadata->>'org_id')::INTEGER,
      NULL
    );
    user_organization := COALESCE(
      user_metadata->>'organization',
      'Unknown Organization'
    );
  END IF;

  -- Insert the user profile
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
    user_id,
    user_email,
    user_name,
    user_role,
    user_org_id,
    user_organization,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    org_id = EXCLUDED.org_id,
    organization = EXCLUDED.organization,
    updated_at = NOW()
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

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.create_user_profile(UUID, TEXT, JSONB) TO anon, authenticated, service_role;

-- Create a helper function that can be called without parameters
-- This will extract metadata from the current user's session
CREATE OR REPLACE FUNCTION public.create_current_user_profile()
RETURNS JSONB AS $$
DECLARE
  current_user_id UUID;
  current_user_email TEXT;
  current_user_metadata JSONB;
BEGIN
  -- Get current user info (only works when authenticated)
  current_user_id := auth.uid();
  current_user_email := auth.jwt() ->> 'email';
  current_user_metadata := COALESCE(auth.jwt() -> 'user_metadata', '{}'::JSONB);

  -- Check if user already has a profile
  IF EXISTS (SELECT 1 FROM public.users WHERE id = current_user_id) THEN
    -- Return existing profile
    RETURN jsonb_build_object('exists', true);
  END IF;

  -- Create new profile
  RETURN public.create_user_profile(current_user_id, current_user_email, current_user_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION public.create_current_user_profile() TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.create_user_profile(UUID, TEXT, JSONB) IS 'Creates or updates a user profile with the provided metadata';
COMMENT ON FUNCTION public.create_current_user_profile() IS 'Creates a profile for the currently authenticated user';

-- Verify the functions are set up correctly
DO $$
BEGIN
  RAISE NOTICE 'User profile creation functions setup completed successfully';
  RAISE NOTICE 'Use create_user_profile(user_id, email, metadata) for manual creation';
  RAISE NOTICE 'Use create_current_user_profile() for current authenticated user';
END $$;
