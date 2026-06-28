-- ─────────────────────────────────────────────────────────────────────────────
-- RBAC: tighten write access on it_asset_documents and it_asset_reviews
-- Only admin, admin-super, and client-architect roles may INSERT/UPDATE/DELETE.
-- client-manager and client-cxo are read-only on these tables.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: return the role for the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- it_asset_documents
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the existing broad client write policy if present (replaced by role-scoped one below)
DROP POLICY IF EXISTS "client_org_access_asset_documents" ON public.it_asset_documents;

-- Recreate: clients may SELECT rows for their own org
CREATE POLICY "client_org_read_asset_documents"
  ON public.it_asset_documents FOR SELECT
  TO authenticated
  USING (
    public.is_admin_user()
    OR org_id = public.get_current_user_org_id()
  );

-- Only admin/architect may write documents
CREATE POLICY "architect_write_asset_documents"
  ON public.it_asset_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR (
      org_id = public.get_current_user_org_id()
      AND public.get_current_user_role() = 'client-architect'
    )
  );

CREATE POLICY "architect_update_asset_documents"
  ON public.it_asset_documents FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_user()
    OR (
      org_id = public.get_current_user_org_id()
      AND public.get_current_user_role() = 'client-architect'
    )
  );

CREATE POLICY "architect_delete_asset_documents"
  ON public.it_asset_documents FOR DELETE
  TO authenticated
  USING (
    public.is_admin_user()
    OR (
      org_id = public.get_current_user_org_id()
      AND public.get_current_user_role() = 'client-architect'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- it_asset_reviews
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "client_org_access_asset_reviews" ON public.it_asset_reviews;

-- All client roles may READ their org's reviews
CREATE POLICY "client_org_read_asset_reviews"
  ON public.it_asset_reviews FOR SELECT
  TO authenticated
  USING (
    public.is_admin_user()
    OR org_id = public.get_current_user_org_id()
  );

-- Only admin/architect may write review records
CREATE POLICY "architect_write_asset_reviews"
  ON public.it_asset_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR (
      org_id = public.get_current_user_org_id()
      AND public.get_current_user_role() = 'client-architect'
    )
  );

CREATE POLICY "architect_update_asset_reviews"
  ON public.it_asset_reviews FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_user()
    OR (
      org_id = public.get_current_user_org_id()
      AND public.get_current_user_role() = 'client-architect'
    )
  );
