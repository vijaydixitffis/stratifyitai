@@ .. @@
 -- Allow all authenticated users to select from client_orgs
 CREATE POLICY full_access_client_orgs ON public.client_orgs
   FOR SELECT
   TO authenticated
   USING (true);
+
+-- Allow anonymous access to client_orgs for login validation
+CREATE POLICY "Allow anonymous access to client_orgs for login" ON public.client_orgs
+  FOR SELECT
+  TO anon
+  USING (true);