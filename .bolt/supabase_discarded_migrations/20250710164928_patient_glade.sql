/*
  # Update Portfolio Analysis RLS Policies

  1. Security Updates
    - Update pa_categories policies to allow client users read access
    - Update pa_assessments policies to allow client users read access
    - Ensure admin users have full CRUD access to both tables
    - Remove restrictive policies and add comprehensive ones

  2. Policy Structure
    - Client users: SELECT (read) access only
    - Admin users: ALL operations (CREATE, READ, UPDATE, DELETE)
*/

-- Drop existing policies for pa_categories
DROP POLICY IF EXISTS "Allow authenticated users to read pa_categories" ON public.pa_categories;
DROP POLICY IF EXISTS "Allow admins to manage pa_categories" ON public.pa_categories;

-- Drop existing policies for pa_assessments  
DROP POLICY IF EXISTS "Allow authenticated users to read pa_assessments" ON public.pa_assessments;
DROP POLICY IF EXISTS "Allow admins to manage pa_assessments" ON public.pa_assessments;

-- Create new policies for pa_categories
-- Allow all authenticated users (both client and admin) to read active categories
CREATE POLICY "Allow all authenticated users to read pa_categories"
  ON public.pa_categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Allow admin users full access to manage categories
CREATE POLICY "Allow admins to manage pa_categories"
  ON public.pa_categories
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid));

-- Create new policies for pa_assessments
-- Allow all authenticated users (both client and admin) to read active assessments
CREATE POLICY "Allow all authenticated users to read pa_assessments"
  ON public.pa_assessments
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Allow admin users full access to manage assessments
CREATE POLICY "Allow admins to manage pa_assessments"
  ON public.pa_assessments
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid));

-- Verify RLS is enabled on both tables
ALTER TABLE public.pa_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pa_assessments ENABLE ROW LEVEL SECURITY;