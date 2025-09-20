-- Allow users to select their own record based on auth.uid()
CREATE POLICY self_select_client_users ON public.client_users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- 3. it_assets