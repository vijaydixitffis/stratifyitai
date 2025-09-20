-- Fresh schema for StratifyIT.ai using unified users table (updated to match consolidated schema)
-- This file has been updated to use the new unified users table instead of separate admin_users and client_users tables

-- 1. users (unified table replacing admin_users and client_users)
DROP TABLE IF EXISTS public.users CASCADE;
CREATE TABLE public.users (
  id UUID NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'admin-super', 'client-manager', 'client-architect', 'client-cxo')),
  org_id INTEGER, -- NULL for admins, specific org for clients
  org_code TEXT, -- 'ADMIN' for admins, actual org_code for clients
  organization TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Insert admin users
INSERT INTO "public"."users" ("id", "email", "name", "role", "org_id", "org_code", "organization", "created_at", "updated_at") VALUES
('18c4a211-4125-444f-812b-4d5ae83bb39a', 'vijay.dixit@futurefocusit.solutions', 'Vijay Dixit', 'admin-super', NULL, 'ADMIN', 'StratifyIT.ai', '2025-07-07 10:42:26.158328+00', '2025-07-07 10:42:26.158328+00');

-- Insert client users (example - would need to be updated with actual client user data)
-- Note: This would typically be populated from the original client_users table data

-- 2. client_orgs (unchanged)
DROP TABLE IF EXISTS public.client_orgs CASCADE;
CREATE TABLE public.client_orgs (
  org_id SERIAL NOT NULL,
  org_code TEXT NOT NULL,
  org_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT,
  sector TEXT,
  remarks TEXT,
  CONSTRAINT client_orgs_pkey PRIMARY KEY (org_id),
  CONSTRAINT client_orgs_org_code_key UNIQUE (org_code)
) TABLESPACE pg_default;

INSERT INTO "public"."client_orgs" ("org_id", "org_code", "org_name", "created_at", "description", "sector", "remarks") VALUES
('1', 'ALTMK', 'Altimetrik', '2025-07-08 09:54:50.871362+00', 'Altimetrik Inc', 'Banking', 'Test'),
('2', 'STRAT', 'StratifyIT.ai', '2025-07-06 17:51:55.806289+00', null, null, null),
('6', 'FFITS', 'Future Focus IT Solutions', '2025-07-06 17:59:02.304556+00', null, null, null),
('15', 'BJJBK', 'Bajaj Broking', '2025-07-07 05:03:11.541597+00', null, null, null),
('18', 'SITIM', 'Site Impact Inc', '2025-07-07 06:55:56.166198+00', null, null, null);

-- 3. it_assets (unchanged)
DROP TABLE IF EXISTS public.it_assets CASCADE;
CREATE TABLE public.it_assets (
  id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  description TEXT,
  owner TEXT,
  status TEXT,
  criticality TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  tags TEXT[],
  metadata JSONB,
  org_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT it_assets_pkey PRIMARY KEY (id),
  CONSTRAINT it_assets_org_id_fkey FOREIGN KEY (org_id) REFERENCES client_orgs (org_id)
) TABLESPACE pg_default;

INSERT INTO "public"."it_assets" ("id", "name", "type", "category", "description", "owner", "status", "criticality", "last_updated", "created_by", "tags", "metadata", "org_id", "created_at") VALUES
('104f5c74-285b-4acf-8787-962901fbd2e2', 'F5 FW', 'infrastructure', 'Network Equipment', 'Firewall', 'Network team', 'active', 'medium', '2025-07-07 10:39:21.587887+00', 'unknown', '{"network","critical","security"}', '{"Vendor": "F5", "Attested": "Jul-7-25"}', '18', '2025-07-07 09:20:21.039063+00'),
('30fca544-9d80-467f-9348-f58b7e269368', 'Monitoring Service', 'third-party-service', 'Monitoring Service', 'Application monitoring and alerting platform', 'SRE Team', 'active', 'low', '2025-07-07 10:39:21.587887+00', 'system', '{"monitoring","observability","alerts"}', '{"plan": "Pro", "vendor": "DataDog", "retention": "30 days"}', '15', '2025-07-06 08:12:09.582997+00'),
('390d8341-40af-4abf-bc30-f7b9c95dd634', 'AWS EC2 Instances', 'infrastructure', 'Virtual Machine', 'Production web servers on AWS', 'DevOps Team', 'active', 'high', '2025-07-07 10:39:21.587887+00', 'system', '{"aws","ec2","compute"}', '{"region": "us-west-2", "instance_type": "t3.large", "instance_count": 5}', '15', '2025-07-06 08:12:09.582997+00'),
('7c2b451d-c751-4d8e-b047-df6214210044', 'API Gateway', 'middleware', 'API Gateway', 'Central API management and routing', 'Platform Team', 'active', 'medium', '2025-07-07 10:39:21.587887+00', 'system', '{"api","gateway","middleware"}', '{"version": "2.0", "endpoints": 45, "requests_per_day": "1M"}', '15', '2025-07-06 08:12:09.582997+00'),
('90a344e5-8ff8-4ae3-a17b-d377d8dd51a7', 'Customer Portal', 'application', 'Web Application', 'Main customer-facing portal for account management', 'IT Department', 'active', 'high', '2025-07-07 10:39:21.587887+00', 'system', '{"web","customer","portal"}', '{"hosting": "AWS", "version": "2.1.0", "framework": "React"}', '15', '2025-07-06 08:12:09.582997+00'),
('d80ef4be-e42f-49f5-ac7c-a171403ee6f2', 'Legacy ERP System', 'application', 'Enterprise Application', 'Legacy ERP system for financial operations', 'Finance Team', 'deprecated', 'medium', '2025-07-07 10:39:21.587887+00', 'system', '{"erp","legacy","finance"}', '{"vendor": "SAP", "version": "6.0", "end_of_life": "2025-12-31"}', '15', '2025-07-06 08:12:09.582997+00'),
('dadc48c0-a9ac-4c26-abf7-7f8709f90a73', 'Production Database', 'database', 'RDBMS (PostgreSQL)', 'Primary production database for customer data', 'Database Team', 'active', 'high', '2025-07-07 10:39:21.587887+00', 'system', '{"database","production","postgresql"}', '{"size": "2.5TB", "version": "14.2", "backup_frequency": "daily"}', '15', '2025-07-06 08:12:09.582997+00');

-- 4. it_asset_uploads (unchanged)
DROP TABLE IF EXISTS public.it_asset_uploads CASCADE;
CREATE TABLE public.it_asset_uploads (
  id UUID NOT NULL,
  asset_id UUID,
  file_url TEXT NOT NULL,
  uploaded_by UUID,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  org_id INTEGER,
  CONSTRAINT it_asset_uploads_pkey PRIMARY KEY (id),
  CONSTRAINT it_asset_uploads_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES it_assets (id) ON DELETE CASCADE,
  CONSTRAINT it_asset_uploads_org_id_fkey FOREIGN KEY (org_id) REFERENCES client_orgs (org_id),
  CONSTRAINT it_asset_uploads_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users (id)
) TABLESPACE pg_default;

-- 5. pa_categories (new - added to match consolidated schema)
DROP TABLE IF EXISTS public.pa_categories CASCADE;
CREATE TABLE public.pa_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'Target',
  color TEXT NOT NULL DEFAULT 'bg-blue-600',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
) TABLESPACE pg_default;

-- Insert PA categories (would need to be populated with actual data from consolidated schema)
-- INSERT INTO public.pa_categories (category_id, title, description, icon, color, sort_order) VALUES
-- ('strategy-enterprise-arch', 'Strategy and Enterprise Architecture', 'Enterprise architecture plays a key role in ensuring business outcomes from innovations and disruptions with risks mitigated', 'Building', 'bg-blue-600', 1),
-- ... (additional categories would be added here)

-- 6. pa_assessments (new - added to match consolidated schema)
DROP TABLE IF EXISTS public.pa_assessments CASCADE;
CREATE TABLE public.pa_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id TEXT UNIQUE NOT NULL,
  category_id TEXT NOT NULL REFERENCES public.pa_categories(category_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration TEXT DEFAULT '1-2 weeks',
  complexity TEXT DEFAULT 'Medium' CHECK (complexity IN ('Low', 'Medium', 'High')),
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'in-progress', 'completed', 'disabled')),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
) TABLESPACE pg_default;

-- Insert PA assessments (would need to be populated with actual data from consolidated schema)
-- INSERT INTO public.pa_assessments (assessment_id, category_id, name, description, duration, complexity, status, sort_order) VALUES
-- ('business-capability-modeling', 'strategy-enterprise-arch', 'Business Capability Modeling', 'Assess and model business capabilities to align IT investments with business strategy', '2-3 weeks', 'Medium', 'available', 1),
-- ... (additional assessments would be added here)

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_users_org_id ON public.users(org_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_users_org_code ON public.users(org_code) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email) TABLESPACE pg_default;

-- Add comments for documentation
COMMENT ON TABLE public.users IS 'Unified users table combining admin and client users for multi-tenant access control';
COMMENT ON COLUMN public.users.role IS 'User role: admin (full access) or client-* (org-restricted access)';
COMMENT ON COLUMN public.users.org_id IS 'Organization ID for client users (NULL for admins)';
COMMENT ON COLUMN public.users.org_code IS 'Organization code: ADMIN for admins, actual org_code for clients';
