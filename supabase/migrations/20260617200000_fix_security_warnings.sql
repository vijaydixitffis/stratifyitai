-- Fix all remaining Supabase security warnings:
--   A. function_search_path_mutable  – add SET search_path = '' to all 13 functions
--      Also migrate _safe helpers + check_user_role from user_metadata → app_metadata
--   B. rls_policy_always_true        – add meaningful WITH CHECK on form INSERT policies
--   C. pg_graphql_anon_table_exposed – revoke SELECT from anon on all non-public tables
--      (client_orgs intentionally kept readable by anon for login org-code validation)

BEGIN;

-- ============================================================
-- A. Pin search_path on all public functions
-- ============================================================

-- Minimal trigger helper – no table access, no search_path risk, but flag it anyway
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_organization_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Admin / role helpers – use app_metadata (server-side only, tamper-proof)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin-super');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN auth.jwt() -> 'app_metadata' ->> 'role';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN NULLIF((auth.jwt() -> 'app_metadata' ->> 'org_id')::INTEGER, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_org_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN auth.jwt() -> 'app_metadata' ->> 'org_code';
END;
$$;

-- _safe variants: align with app_metadata (previously read user_metadata)
CREATE OR REPLACE FUNCTION public.get_current_user_org_id_safe()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN NULLIF((auth.jwt() -> 'app_metadata' ->> 'org_id')::INTEGER, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_org_code_safe()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN auth.jwt() -> 'app_metadata' ->> 'org_code';
END;
$$;

-- check_user_role: also migrate from user_metadata → app_metadata
CREATE OR REPLACE FUNCTION public.check_user_role(user_role text DEFAULT NULL::text)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF user_role IS NOT NULL THEN
    RETURN (auth.jwt() -> 'app_metadata' ->> 'role') = user_role;
  ELSE
    RETURN (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin-super');
  END IF;
END;
$$;

-- sync trigger: writes to auth schema (already schema-qualified)
CREATE OR REPLACE FUNCTION public.sync_user_role_to_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object(
      'role',     NEW.role,
      'org_id',   NEW.org_id,
      'org_code', NEW.org_code
    )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Auth trigger: creates public.users row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role         text;
  v_name         text;
  v_org_id       integer;
  v_org_code     text;
  v_organization text;
BEGIN
  v_role         := COALESCE(NEW.raw_user_meta_data->>'role', 'client-manager');
  v_name         := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  v_org_id       := CASE
                      WHEN NEW.raw_user_meta_data->>'org_id' IS NOT NULL
                      THEN (NEW.raw_user_meta_data->>'org_id')::integer
                      ELSE NULL
                    END;
  v_org_code     := COALESCE(NEW.raw_user_meta_data->>'orgCode',
                     CASE WHEN v_role LIKE 'admin%' THEN 'ADMIN' ELSE 'UNKNOWN' END);
  v_organization := COALESCE(NEW.raw_user_meta_data->>'organization', 'Unknown Organization');

  INSERT INTO public.users (id, email, name, role, org_id, org_code, organization, created_at, updated_at)
  VALUES (NEW.id, NEW.email, v_name, v_role, v_org_id, v_org_code, v_organization, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email        = EXCLUDED.email,
    name         = EXCLUDED.name,
    role         = EXCLUDED.role,
    org_id       = EXCLUDED.org_id,
    org_code     = EXCLUDED.org_code,
    organization = EXCLUDED.organization,
    updated_at   = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_user_profile(
  user_id       uuid,
  user_email    text,
  user_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role         TEXT;
  v_name         TEXT;
  v_org_id       INTEGER;
  v_organization TEXT;
  result         JSONB;
BEGIN
  v_role         := COALESCE(user_metadata->>'role', 'client-manager');
  v_name         := COALESCE(user_metadata->>'name', user_metadata->>'full_name',
                              split_part(user_email, '@', 1), 'User');
  IF v_role = 'admin' THEN
    v_org_id       := NULL;
    v_organization := 'StratifyIT.ai';
  ELSE
    v_org_id       := COALESCE((user_metadata->>'org_id')::INTEGER, NULL);
    v_organization := COALESCE(user_metadata->>'organization', 'Unknown Organization');
  END IF;

  INSERT INTO public.users (id, email, name, role, org_id, organization, created_at, updated_at)
  VALUES (user_id, user_email, v_name, v_role, v_org_id, v_organization, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email        = EXCLUDED.email,
    name         = EXCLUDED.name,
    role         = EXCLUDED.role,
    org_id       = EXCLUDED.org_id,
    organization = EXCLUDED.organization,
    updated_at   = NOW()
  RETURNING jsonb_build_object(
    'id', id, 'email', email, 'name', name, 'role', role,
    'org_id', org_id, 'organization', organization,
    'created_at', created_at, 'updated_at', updated_at
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_current_user_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid          UUID;
  v_email        TEXT;
  v_meta         JSONB;
  v_role         TEXT;
  v_name         TEXT;
  v_org_id       INTEGER;
  v_org_code     TEXT;
  v_organization TEXT;
  result         JSONB;
BEGIN
  v_uid   := auth.uid();
  v_email := auth.jwt() ->> 'email';
  v_meta  := COALESCE(auth.jwt() -> 'user_metadata', '{}'::JSONB);

  v_role := COALESCE(
    v_meta->>'role',
    CASE WHEN v_email LIKE '%@stratifyit.ai' THEN 'admin' ELSE 'client-manager' END
  );
  v_name := COALESCE(v_meta->>'name', v_meta->>'full_name', split_part(v_email, '@', 1), 'User');

  IF v_role = 'admin' THEN
    v_org_id       := NULL;
    v_org_code     := 'ADMIN';
    v_organization := 'StratifyIT.ai';
  ELSE
    v_org_id       := COALESCE((v_meta->>'org_id')::INTEGER, NULL);
    v_org_code     := COALESCE(v_meta->>'org_code', 'UNKNOWN');
    v_organization := COALESCE(v_meta->>'organization', 'Unknown Organization');
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_uid) THEN
    UPDATE public.users SET
      email        = v_email,
      name         = v_name,
      role         = v_role,
      org_id       = v_org_id,
      org_code     = v_org_code,
      organization = v_organization,
      updated_at   = NOW()
    WHERE id = v_uid
    RETURNING jsonb_build_object(
      'id', id, 'email', email, 'name', name, 'role', role,
      'org_id', org_id, 'org_code', org_code, 'organization', organization,
      'created_at', created_at, 'updated_at', updated_at
    ) INTO result;
    RETURN result;
  END IF;

  INSERT INTO public.users (id, email, name, role, org_id, org_code, organization, created_at, updated_at)
  VALUES (v_uid, v_email, v_name, v_role, v_org_id, v_org_code, v_organization, NOW(), NOW())
  RETURNING jsonb_build_object(
    'id', id, 'email', email, 'name', name, 'role', role,
    'org_id', org_id, 'org_code', org_code, 'organization', organization,
    'created_at', created_at, 'updated_at', updated_at
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- B. Replace always-true INSERT policies on public form tables
--    Require email to be non-null – both tables are contact/lead
--    capture forms where an email is the minimum useful record.
-- ============================================================

DROP POLICY IF EXISTS "anon_insert_app_response" ON public.app_response;
CREATE POLICY "anon_insert_app_response" ON public.app_response
  FOR INSERT TO anon, authenticated
  WITH CHECK (email IS NOT NULL);

DROP POLICY IF EXISTS "anon_insert_ai_response" ON public.ai_response;
CREATE POLICY "anon_insert_ai_response" ON public.ai_response
  FOR INSERT TO anon, authenticated
  WITH CHECK (email IS NOT NULL);

-- ============================================================
-- C. Revoke SELECT from anon on non-public tables
--    Removes tables from the GraphQL anon schema without
--    affecting PostgREST INSERT/UPDATE used by the app.
--    client_orgs is intentionally kept: anon SELECT is required
--    so the login form can validate org codes before sign-in.
-- ============================================================

REVOKE SELECT ON public.users                      FROM anon;
REVOKE SELECT ON public.it_assets                  FROM anon;
REVOKE SELECT ON public.it_asset_uploads           FROM anon;
REVOKE SELECT ON public.it_asset_relationships     FROM anon;
REVOKE SELECT ON public.pa_assessments             FROM anon;
REVOKE SELECT ON public.pa_categories              FROM anon;
REVOKE SELECT ON public.assessment_assignments_cache FROM anon;
REVOKE SELECT ON public.assessment_results_cache   FROM anon;
REVOKE SELECT ON public.ai_analyses                FROM anon;
REVOKE SELECT ON public.roadmap_items              FROM anon;
REVOKE SELECT ON public.app_response               FROM anon;
REVOKE SELECT ON public.ai_response                FROM anon;

COMMIT;
