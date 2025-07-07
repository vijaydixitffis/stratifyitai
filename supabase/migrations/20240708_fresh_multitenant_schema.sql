-- Fresh schema for multi-tenant SaaS (no RLS)

-- 1. Client organizations table
CREATE TABLE IF NOT EXISTS public.client_orgs (
  org_id serial PRIMARY KEY,
  org_code text UNIQUE NOT NULL,
  org_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Admin users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  role text,
  org_id integer REFERENCES client_orgs(org_id),
  created_at timestamptz DEFAULT now()
);

-- 3. Client users table (renamed from user_profiles)
CREATE TABLE IF NOT EXISTS public.client_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  role text,
  org_id integer REFERENCES client_orgs(org_id),
  created_at timestamptz DEFAULT now()
);

-- 4. IT assets table (renamed from assets)
CREATE TABLE IF NOT EXISTS public.it_assets (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  category text,
  description text,
  owner text,
  status text,
  criticality text,
  last_updated timestamptz DEFAULT now(),
  created_by text,
  tags text[],
  metadata jsonb,
  org_id integer REFERENCES client_orgs(org_id),
  created_at timestamptz DEFAULT now()
);

-- 5. IT asset uploads table (renamed from asset_uploads)
CREATE TABLE IF NOT EXISTS public.it_asset_uploads (
  id uuid PRIMARY KEY,
  asset_id uuid REFERENCES it_assets(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz DEFAULT now(),
  org_id integer REFERENCES client_orgs(org_id)
);

-- Enable RLS and grant full access to admin users for all tables

-- 1. client_orgs
ALTER TABLE public.client_orgs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access ON public.client_orgs;
CREATE POLICY admin_full_access ON public.client_orgs
  USING (auth.uid() IN (SELECT id FROM admin_users));

-- 2. admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
   DROP POLICY IF EXISTS admin_full_access ON public.admin_users;
   CREATE POLICY all_admins_access ON public.admin_users
  USING (true);
  
-- 3. client_users
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access ON public.client_users;
CREATE POLICY admin_full_access ON public.client_users
  USING (auth.uid() IN (SELECT id FROM admin_users));

-- 4. it_assets
ALTER TABLE public.it_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access ON public.it_assets;
CREATE POLICY admin_full_access ON public.it_assets
  USING (auth.uid() IN (SELECT id FROM admin_users));

-- 5. it_asset_uploads
ALTER TABLE public.it_asset_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_full_access ON public.it_asset_uploads;
CREATE POLICY admin_full_access ON public.it_asset_uploads
  USING (auth.uid() IN (SELECT id FROM admin_users));

-- Client user RLS: Only allow access to it_assets and it_asset_uploads for their own org

-- it_assets
CREATE POLICY client_user_org_access_select ON public.it_assets
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM client_users WHERE org_id = it_assets.org_id)
  );
CREATE POLICY client_user_org_access_insert ON public.it_assets
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM client_users WHERE org_id = it_assets.org_id)
  );
CREATE POLICY client_user_org_access_update ON public.it_assets
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM client_users WHERE org_id = it_assets.org_id)
  );
CREATE POLICY client_user_org_access_delete ON public.it_assets
  FOR DELETE USING (
    auth.uid() IN (SELECT id FROM client_users WHERE org_id = it_assets.org_id)
  );

-- it_asset_uploads
CREATE POLICY client_user_org_access_select ON public.it_asset_uploads
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM client_users WHERE org_id = it_asset_uploads.org_id)
  );
CREATE POLICY client_user_org_access_insert ON public.it_asset_uploads
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM client_users WHERE org_id = it_asset_uploads.org_id)
  );
CREATE POLICY client_user_org_access_update ON public.it_asset_uploads
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM client_users WHERE org_id = it_asset_uploads.org_id)
  );
CREATE POLICY client_user_org_access_delete ON public.it_asset_uploads
  FOR DELETE USING (
    auth.uid() IN (SELECT id FROM client_users WHERE org_id = it_asset_uploads.org_id)
  ); 