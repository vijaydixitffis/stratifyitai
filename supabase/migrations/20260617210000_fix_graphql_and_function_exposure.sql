-- Fix remaining GraphQL exposure and SECURITY DEFINER callable-by-anon warnings.
--
-- What this migration does:
--   1. REVOKE EXECUTE from anon on all 10 SECURITY DEFINER functions
--      (none should be callable before authentication)
--   2. REVOKE EXECUTE from authenticated on 8 functions not needed for direct
--      REST/RPC calls (trigger functions + pure RLS helpers not referenced in
--      active RLS policies).
--      EXCEPTION: is_admin_user() and get_current_user_org_id() MUST stay
--      executable by authenticated – active RLS policies on it_assets,
--      it_asset_uploads, it_asset_relationships, and client_orgs call them.
--   3. Create validate_org_code() – a narrow, intentionally-anon-accessible
--      function that returns TRUE/FALSE for a given org code. Replaces the
--      need for anon SELECT on client_orgs (used by the login form).
--   4. REVOKE SELECT from anon on client_orgs (now handled via validate_org_code)
--   5. REVOKE SELECT from authenticated on app_response and ai_response
--      (public form-capture tables; admin access is via service_role/dashboard)
--
-- Warnings that CANNOT be fixed by SQL and require dashboard action:
--   - auth_leaked_password_protection   → Dashboard > Auth > Password Settings
--   - auth_insufficient_mfa_options     → Dashboard > Auth > Providers (enable TOTP)
--   - vulnerable_postgres_version       → Dashboard > Project Settings > Upgrade DB
--
-- Warnings intentionally left (accepted risk):
--   - pg_graphql_authenticated_table_exposed for the 11 app tables: authenticated
--     users legitimately access these via PostgREST; RLS enforces row-level access.
--   - authenticated_security_definer_function_executable for is_admin_user() and
--     get_current_user_org_id(): cannot be revoked without breaking active RLS.
--   - pg_graphql_anon_table_exposed for validate_org_code: one intentional
--     anon-callable function is the controlled alternative to full table exposure.

BEGIN;

-- ============================================================
-- 1 & 2. Tighten EXECUTE grants on SECURITY DEFINER functions
-- ============================================================

-- Trigger functions – never callable via REST by anyone
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_user_role_to_app_metadata()     FROM anon, authenticated;

-- Pure RLS helpers not referenced by active policies – revoke from both roles
REVOKE EXECUTE ON FUNCTION public.check_user_role(text)                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_current_user_role()              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_current_user_org_code()          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_current_user_org_id_safe()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_current_user_org_code_safe()     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_user_profile(uuid, text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_current_user_profile()        FROM anon, authenticated;

-- RLS-critical helpers used by active policies on it_assets / it_asset_uploads /
-- it_asset_relationships / client_orgs – revoke from anon only; keep authenticated
REVOKE EXECUTE ON FUNCTION public.is_admin_user()                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_current_user_org_id()            FROM anon;

-- ============================================================
-- 3. Narrow org-code validation function for the login form
--    Called by the frontend BEFORE the user signs in, so it
--    must be accessible to the anon role.  Returns only a
--    boolean – no table data leaked.
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_org_code(p_org_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.client_orgs
    WHERE org_code = upper(trim(p_org_code))
  );
END;
$$;

-- Revoke the default PUBLIC grant, then allow only what is needed
REVOKE EXECUTE ON FUNCTION public.validate_org_code(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.validate_org_code(text) TO anon, authenticated;

-- ============================================================
-- 4. Remove anon SELECT on client_orgs
--    The login form now uses validate_org_code() RPC instead
-- ============================================================

REVOKE SELECT ON public.client_orgs FROM anon;

-- ============================================================
-- 5. Remove authenticated SELECT on form-capture tables
--    Admins access these via service_role (Supabase dashboard);
--    they are not displayed anywhere in the application UI.
-- ============================================================

REVOKE SELECT ON public.app_response FROM authenticated;
REVOKE SELECT ON public.ai_response  FROM authenticated;

-- Drop the admin SELECT policies on these tables – they are now unreachable
-- via authenticated role. Service_role bypasses RLS and can still read them.
DROP POLICY IF EXISTS "admin_full_app_response" ON public.app_response;
DROP POLICY IF EXISTS "admin_full_ai_response"  ON public.ai_response;

COMMIT;
