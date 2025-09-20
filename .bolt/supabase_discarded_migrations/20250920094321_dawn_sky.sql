@@ .. @@
 -- 2. client_users
 ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
 DROP POLICY IF EXISTS admin_full_access_client_users ON public.client_users;
 CREATE POLICY admin_full_access_client_users ON public.client_users
   FOR ALL TO authenticated
-  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid))
-  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid));
+  USING ((auth.jwt() ->> 'role') LIKE 'admin-%')
+  WITH CHECK ((auth.jwt() ->> 'role') LIKE 'admin-%');

@@ .. @@
 -- 3. it_assets
 ALTER TABLE public.it_assets ENABLE ROW LEVEL SECURITY;
 DROP POLICY IF EXISTS admin_full_access_it_assets ON public.it_assets;
 CREATE POLICY admin_full_access_it_assets ON public.it_assets
   FOR ALL TO authenticated
-  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid))
-  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid));
+  USING ((auth.jwt() ->> 'role') LIKE 'admin-%')
+  WITH CHECK ((auth.jwt() ->> 'role') LIKE 'admin-%');
 DROP POLICY IF EXISTS client_org_access_it_assets ON public.it_assets;
 CREATE POLICY client_org_access_it_assets ON public.it_assets
   FOR ALL TO authenticated
@@ .. @@
 -- 4. it_asset_uploads
 ALTER TABLE public.it_asset_uploads ENABLE ROW LEVEL SECURITY;
 DROP POLICY IF EXISTS admin_full_access_it_asset_uploads ON public.it_asset_uploads;
 CREATE POLICY admin_full_access_it_asset_uploads ON public.it_asset_uploads
   FOR ALL TO authenticated
-  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid))
-  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid));
+  USING ((auth.jwt() ->> 'role') LIKE 'admin-%')
+  WITH CHECK ((auth.jwt() ->> 'role') LIKE 'admin-%');
 DROP POLICY IF EXISTS client_org_access_it_asset_uploads ON public.it_asset_uploads;
 CREATE POLICY client_org_access_it_asset_uploads ON public.it_asset_uploads
   FOR ALL TO authenticated