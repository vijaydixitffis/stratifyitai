@@ .. @@
 DROP POLICY IF EXISTS client_access_client_users ON public.client_users;
 CREATE POLICY client_access_client_users ON public.client_users
   FOR ALL TO authenticated
   USING (
-    org_id::text = auth.jwt() ->> 'org_id'
+    org_id::text = auth.jwt() -> 'user_metadata' ->> 'org_id'
   )
   WITH CHECK (
-    org_id::text = auth.jwt() ->> 'org_id'
+    org_id::text = auth.jwt() -> 'user_metadata' ->> 'org_id'
   );
 
 -- 3. it_assets
@@ .. @@
 CREATE POLICY client_org_access_it_assets ON public.it_assets
   FOR ALL TO authenticated
   USING (
-    org_id::text = auth.jwt() ->> 'org_id'
+    org_id::text = auth.jwt() -> 'user_metadata' ->> 'org_id'
   )
   WITH CHECK (
-    org_id::text = auth.jwt() ->> 'org_id'
+    org_id::text = auth.jwt() -> 'user_metadata' ->> 'org_id'
   );
 
 -- 4. it_asset_uploads
@@ .. @@
 CREATE POLICY client_org_access_it_asset_uploads ON public.it_asset_uploads
   FOR ALL TO authenticated
   USING (
-    org_id::text = auth.jwt() ->> 'org_id'
+    org_id::text = auth.jwt() -> 'user_metadata' ->> 'org_id'
   )
   WITH CHECK (
-    org_id::text = auth.jwt() ->> 'org_id'
+    org_id::text = auth.jwt() -> 'user_metadata' ->> 'org_id'
   );