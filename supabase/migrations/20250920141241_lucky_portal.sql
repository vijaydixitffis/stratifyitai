/*
  # Fix infinite recursion in RLS policies

  1. Problem
    - RLS policies using EXISTS queries on admin_users table cause infinite recursion
    - This happens when policies reference other tables with RLS enabled

  2. Solution
    - Replace EXISTS queries with direct JWT role checks
    - Use auth.jwt() ->> 'role' LIKE 'admin-%' pattern
    - This breaks the recursive dependency chain

  3. Changes
    - Update client_users admin policy to use JWT role check
    - Update it_assets admin policy to use JWT role check  
    - Update it_asset_uploads admin policy to use JWT role check
*/

-- Fix client_users admin policy
DROP POLICY IF EXISTS admin_full_access_client_users ON public.client_users;
CREATE POLICY admin_full_access_client_users ON public.client_users
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'role') LIKE 'admin-%')
  WITH CHECK ((auth.jwt() ->> 'role') LIKE 'admin-%');

-- Fix it_assets admin policy
DROP POLICY IF EXISTS admin_full_access_it_assets ON public.it_assets;
CREATE POLICY admin_full_access_it_assets ON public.it_assets
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'role') LIKE 'admin-%')
  WITH CHECK ((auth.jwt() ->> 'role') LIKE 'admin-%');

-- Fix it_asset_uploads admin policy
DROP POLICY IF EXISTS admin_full_access_it_asset_uploads ON public.it_asset_uploads;
CREATE POLICY admin_full_access_it_asset_uploads ON public.it_asset_uploads
  FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'role') LIKE 'admin-%')
  WITH CHECK ((auth.jwt() ->> 'role') LIKE 'admin-%');