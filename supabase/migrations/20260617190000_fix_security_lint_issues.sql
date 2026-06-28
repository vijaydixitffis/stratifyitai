-- Fix three Supabase security lint findings:
--   1. RLS disabled on public.app_response  (rls_disabled_in_public)
--   2. RLS disabled on public.ai_response   (rls_disabled_in_public)
--   3. admin_full_users_access references user_metadata (rls_references_user_metadata)
--
-- Background for issue 3:
--   user_metadata is writable by any authenticated user via supabase.auth.update().
--   Using it in an RLS policy means any user could escalate to admin by patching
--   their own metadata.  app_metadata is server-side only (service_role / triggers)
--   and is safe to trust in security policies.
--   We introduce a SECURITY DEFINER trigger that syncs public.users.role (and
--   org_id / org_code) into auth.users.raw_app_meta_data on every insert/update,
--   and perform a one-time backfill for existing rows.

BEGIN;

-- ============================================================
-- 1.  app_response  – public form submissions (no login needed)
-- ============================================================

ALTER TABLE public.app_response ENABLE ROW LEVEL SECURITY;

-- Anonymous (public) users can submit responses
CREATE POLICY "anon_insert_app_response" ON public.app_response
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Admins can read / manage all submissions
CREATE POLICY "admin_full_app_response" ON public.app_response
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'admin-super')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'admin-super')
    )
  );

-- ============================================================
-- 2.  ai_response  – public form submissions (no login needed)
-- ============================================================

ALTER TABLE public.ai_response ENABLE ROW LEVEL SECURITY;

-- Anonymous (public) users can submit responses
CREATE POLICY "anon_insert_ai_response" ON public.ai_response
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Admins can read / manage all submissions
CREATE POLICY "admin_full_ai_response" ON public.ai_response
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'admin-super')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'admin-super')
    )
  );

-- ============================================================
-- 3.  Fix admin_full_users_access to use app_metadata
-- ============================================================

-- 3a. Trigger function: syncs role / org_id / org_code from public.users
--     into auth.users.raw_app_meta_data so those values are available in
--     the JWT as auth.jwt()->'app_metadata'.  Runs SECURITY DEFINER so it
--     can write to the auth schema without granting that permission broadly.
CREATE OR REPLACE FUNCTION public.sync_user_role_to_app_metadata()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3b. Attach trigger to public.users
DROP TRIGGER IF EXISTS trg_sync_role_to_app_metadata ON public.users;
CREATE TRIGGER trg_sync_role_to_app_metadata
  AFTER INSERT OR UPDATE OF role, org_id, org_code ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_to_app_metadata();

-- 3c. One-time backfill: push current role / org_id / org_code for all
--     existing users so app_metadata is populated immediately.
UPDATE auth.users au
SET raw_app_meta_data =
  COALESCE(au.raw_app_meta_data, '{}'::jsonb) ||
  jsonb_build_object(
    'role',     pu.role,
    'org_id',   pu.org_id,
    'org_code', pu.org_code
  )
FROM public.users pu
WHERE au.id = pu.id;

-- 3d. Replace the policy: use app_metadata (trusted) instead of user_metadata
DROP POLICY IF EXISTS "admin_full_users_access" ON public.users;
DROP POLICY IF EXISTS admin_full_users_access ON public.users;

CREATE POLICY "admin_full_users_access" ON public.users
  FOR ALL TO authenticated
  USING  ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin-super'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin-super'));

-- 3e. Update helper functions to read from app_metadata
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin-super');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.jwt() -> 'app_metadata' ->> 'role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN NULLIF((auth.jwt() -> 'app_metadata' ->> 'org_id')::INTEGER, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_user_org_code()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.jwt() -> 'app_metadata' ->> 'org_code';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
