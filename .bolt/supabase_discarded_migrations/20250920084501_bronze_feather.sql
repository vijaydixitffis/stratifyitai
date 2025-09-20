-- Fix RLS policies for Portfolio Analysis tables

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all authenticated users to read pa_categories" ON public.pa_categories;
DROP POLICY IF EXISTS "Allow admins to manage pa_categories" ON public.pa_categories;
DROP POLICY IF EXISTS "Allow all authenticated users to read pa_assessments" ON public.pa_assessments;
DROP POLICY IF EXISTS "Allow admins to manage pa_assessments" ON public.pa_assessments;

-- Enable RLS on both tables
ALTER TABLE public.pa_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pa_assessments ENABLE ROW LEVEL SECURITY;

-- PA Categories policies
-- Allow all authenticated users to read active categories
CREATE POLICY "Allow all authenticated users to read pa_categories" ON public.pa_categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Allow admins full access to categories
CREATE POLICY "Allow admins to manage pa_categories" ON public.pa_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid
    )
  );

-- PA Assessments policies  
-- Allow all authenticated users to read active assessments
CREATE POLICY "Allow all authenticated users to read pa_assessments" ON public.pa_assessments
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Allow admins full access to assessments
CREATE POLICY "Allow admins to manage pa_assessments" ON public.pa_assessments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid
    )
  );