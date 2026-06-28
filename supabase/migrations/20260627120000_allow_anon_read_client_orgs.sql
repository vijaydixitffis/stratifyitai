-- Allow unauthenticated users to read client_orgs for login org-code validation.
-- The login flow validates the org code before a session exists, so the anon
-- role must be able to SELECT. Org codes are non-sensitive lookup values.

GRANT SELECT ON public.client_orgs TO anon;

CREATE POLICY "anon_read_client_orgs" ON public.client_orgs
  FOR SELECT TO anon
  USING (true);
