-- Fix for assets policy conflict in migrations
-- Run this script before running supabase db push --include-all

-- Drop all assets table policies
DROP POLICY IF EXISTS "Users can view all assets" ON assets;
DROP POLICY IF EXISTS "Users can insert assets" ON assets;
DROP POLICY IF EXISTS "Users can update assets" ON assets;
DROP POLICY IF EXISTS "Users can delete assets" ON assets;

-- Drop all asset_uploads table policies
DROP POLICY IF EXISTS "Users can view their uploads" ON asset_uploads;
DROP POLICY IF EXISTS "Users can insert uploads" ON asset_uploads;
DROP POLICY IF EXISTS "Users can update their uploads" ON asset_uploads;

-- Now you can run: supabase db push --include-all
-- The migrations will recreate all the policies properly 