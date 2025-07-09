-- Fresh schema for StratifyIT.ai (no RLS, retains auth.users references)

-- 1. admin_users
DROP TABLE IF EXISTS public.admin_users CASCADE;
CREATE TABLE public.admin_users (
  id uuid NOT NULL,
  email text NOT NULL,
  name text NULL,
  role text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT admin_users_pkey PRIMARY KEY (id),
  CONSTRAINT admin_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
);

INSERT INTO public.admin_users (id, email, name, role, created_at) VALUES
('18c4a211-4125-444f-812b-4d5ae83bb39a', 'vijay.dixit@futurefocusit.solutions', 'Vijay Dixit', 'admin-super', '2025-07-07 10:42:26.158328+00');

-- 2. client_orgs
DROP TABLE IF EXISTS public.client_orgs CASCADE;
CREATE TABLE public.client_orgs (
  org_id serial NOT NULL,
  org_code text NOT NULL,
  org_name text NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  description text NULL,
  sector text NULL,
  remarks text NULL,
  CONSTRAINT client_orgs_pkey PRIMARY KEY (org_id),
  CONSTRAINT client_orgs_org_code_key UNIQUE (org_code)
);

INSERT INTO public.client_orgs (org_id, org_code, org_name, created_at, description, sector, remarks) VALUES
('1', 'ALTMK', 'Altimetrik', '2025-07-08 09:54:50.871362+00', 'Altimetrik Inc', 'Banking', 'Test'),
('2', 'STRAT', 'StratifyIT.ai', '2025-07-06 17:51:55.806289+00', null, null, null),
('6', 'FFITS', 'Future Focus IT Solutions', '2025-07-06 17:59:02.304556+00', null, null, null),
('15', 'BJJBK', 'Bajaj Broking', '2025-07-07 05:03:11.541597+00', null, null, null),
('18', 'SITIM', 'Site Impact Inc', '2025-07-07 06:55:56.166198+00', null, null, null);

-- 3. client_users
DROP TABLE IF EXISTS public.client_users CASCADE;
CREATE TABLE public.client_users (
  id uuid NOT NULL,
  email text NOT NULL,
  name text NULL,
  role text NULL,
  org_id integer NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT client_users_pkey PRIMARY KEY (id),
  CONSTRAINT client_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT client_users_org_id_fkey FOREIGN KEY (org_id) REFERENCES client_orgs (org_id)
);

-- 4. it_assets
DROP TABLE IF EXISTS public.it_assets CASCADE;
CREATE TABLE public.it_assets (
  id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  category text NULL,
  description text NULL,
  owner text NULL,
  status text NULL,
  criticality text NULL,
  last_updated timestamp with time zone NULL DEFAULT now(),
  created_by text NULL,
  tags text[] NULL,
  metadata jsonb NULL,
  org_id integer NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT it_assets_pkey PRIMARY KEY (id),
  CONSTRAINT it_assets_org_id_fkey FOREIGN KEY (org_id) REFERENCES client_orgs (org_id)
);

INSERT INTO public.it_assets (id, name, type, category, description, owner, status, criticality, last_updated, created_by, tags, metadata, org_id, created_at) VALUES
('104f5c74-285b-4acf-8787-962901fbd2e2', 'F5 FW', 'infrastructure', 'Network Equipment', 'Firewall', 'Network team', 'active', 'medium', '2025-07-07 10:39:21.587887+00', 'unknown', '{network,critical,security}', '{"Vendor": "F5", "Attested": "Jul-7-25"}', '18', '2025-07-07 09:20:21.039063+00'),
('30fca544-9d80-467f-9348-f58b7e269368', 'Monitoring Service', 'third-party-service', 'Monitoring Service', 'Application monitoring and alerting platform', 'SRE Team', 'active', 'low', '2025-07-07 10:39:21.587887+00', 'system', '{monitoring,observability,alerts}', '{"plan": "Pro", "vendor": "DataDog", "retention": "30 days"}', '15', '2025-07-06 08:12:09.582997+00'),
('390d8341-40af-4abf-bc30-f7b9c95dd634', 'AWS EC2 Instances', 'infrastructure', 'Virtual Machine', 'Production web servers on AWS', 'DevOps Team', 'active', 'high', '2025-07-07 10:39:21.587887+00', 'system', '{aws,ec2,compute}', '{"region": "us-west-2", "instance_type": "t3.large", "instance_count": 5}', '15', '2025-07-06 08:12:09.582997+00'),
('7c2b451d-c751-4d8e-b047-df6214210044', 'API Gateway', 'middleware', 'API Gateway', 'Central API management and routing', 'Platform Team', 'active', 'medium', '2025-07-07 10:39:21.587887+00', 'system', '{api,gateway,middleware}', '{"version": "2.0", "endpoints": 45, "requests_per_day": "1M"}', '15', '2025-07-06 08:12:09.582997+00'),
('90a344e5-8ff8-4ae3-a17b-d377d8dd51a7', 'Customer Portal', 'application', 'Web Application', 'Main customer-facing portal for account management', 'IT Department', 'active', 'high', '2025-07-07 10:39:21.587887+00', 'system', '{web,customer,portal}', '{"hosting": "AWS", "version": "2.1.0", "framework": "React"}', '15', '2025-07-06 08:12:09.582997+00'),
('d80ef4be-e42f-49f5-ac7c-a171403ee6f2', 'Legacy ERP System', 'application', 'Enterprise Application', 'Legacy ERP system for financial operations', 'Finance Team', 'deprecated', 'medium', '2025-07-07 10:39:21.587887+00', 'system', '{erp,legacy,finance}', '{"vendor": "SAP", "version": "6.0", "end_of_life": "2025-12-31"}', '15', '2025-07-06 08:12:09.582997+00'),
('dadc48c0-a9ac-4c26-abf7-7f8709f90a73', 'Production Database', 'database', 'RDBMS (PostgreSQL)', 'Primary production database for customer data', 'Database Team', 'active', 'high', '2025-07-07 10:39:21.587887+00', 'system', '{database,production,postgresql}', '{"size": "2.5TB", "version": "14.2", "backup_frequency": "daily"}', '15', '2025-07-06 08:12:09.582997+00');

-- 5. it_asset_uploads
DROP TABLE IF EXISTS public.it_asset_uploads CASCADE;
CREATE TABLE public.it_asset_uploads (
  id uuid NOT NULL,
  asset_id uuid NULL,
  file_url text NOT NULL,
  uploaded_by uuid NULL,
  uploaded_at timestamp with time zone NULL DEFAULT now(),
  org_id integer NULL,
  CONSTRAINT it_asset_uploads_pkey PRIMARY KEY (id),
  CONSTRAINT it_asset_uploads_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES it_assets (id) ON DELETE CASCADE,
  CONSTRAINT it_asset_uploads_org_id_fkey FOREIGN KEY (org_id) REFERENCES client_orgs (org_id),
  CONSTRAINT it_asset_uploads_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users (id)
); 