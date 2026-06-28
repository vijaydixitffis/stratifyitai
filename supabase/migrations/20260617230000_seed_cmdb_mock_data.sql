-- ─────────────────────────────────────────────────────────────────────────────
-- Seed CMDB-grade data for the 6 demo assets in org_id = 1
-- These assets were inserted before the CMDB columns migration; this fills
-- the new nullable columns with realistic values so AI review and
-- rationalization prompts receive meaningful signals.
-- ─────────────────────────────────────────────────────────────────────────────

-- Customer Portal (application, custom_built, production)
UPDATE public.it_assets SET
  vendor                  = 'In-house / Internal',
  sourcing_type           = 'custom_built',
  environment             = 'production',
  business_unit           = 'Customer Experience',
  asset_tag               = 'CE-APP-001',
  purchase_date           = '2019-03-15',
  end_of_support_date     = '2028-12-31',
  annual_cost             = 85000,
  license_type            = 'internal',
  data_classification     = 'confidential',
  compliance_tags         = ARRAY['PCI','GDPR'],
  criticality_justification = 'Primary customer touchpoint; handles payment data and PII',
  updated_by              = 'seed-migration'
WHERE org_id = 1 AND name = 'Customer Portal';

-- Production Database (database, open_source, production)
UPDATE public.it_assets SET
  vendor                  = 'PostgreSQL / EnterpriseDB',
  sourcing_type           = 'open_source',
  environment             = 'production',
  business_unit           = 'Platform Engineering',
  asset_tag               = 'PE-DB-001',
  purchase_date           = '2020-06-01',
  end_of_support_date     = '2027-11-14',
  annual_cost             = 42000,
  license_type            = 'open_source',
  data_classification     = 'restricted',
  compliance_tags         = ARRAY['PCI','SOX','GDPR'],
  criticality_justification = 'Stores all customer financial records and PII; single source of truth',
  updated_by              = 'seed-migration'
WHERE org_id = 1 AND name = 'Production Database';

-- AWS EC2 Instances (infrastructure, saas, production)
UPDATE public.it_assets SET
  vendor                  = 'Amazon Web Services',
  sourcing_type           = 'saas',
  environment             = 'production',
  business_unit           = 'Platform Engineering',
  asset_tag               = 'PE-INFRA-001',
  location                = 'AWS us-east-1',
  hostname                = 'ec2-web-prod-01',
  ip_address              = '10.0.1.100',
  purchase_date           = '2021-01-10',
  annual_cost             = 156000,
  license_type            = 'subscription',
  license_expiry_date     = '2026-12-31',
  data_classification     = 'confidential',
  compliance_tags         = ARRAY['PCI','SOX'],
  criticality_justification = 'Hosts all production web workloads; 5 instance fleet with auto-scaling',
  updated_by              = 'seed-migration'
WHERE org_id = 1 AND name = 'AWS EC2 Instances';

-- API Gateway (middleware, open_source, production)
UPDATE public.it_assets SET
  vendor                  = 'Kong Inc.',
  sourcing_type           = 'open_source',
  environment             = 'production',
  business_unit           = 'Platform Engineering',
  asset_tag               = 'PE-MW-001',
  purchase_date           = '2021-04-15',
  end_of_support_date     = '2027-06-30',
  annual_cost             = 28000,
  license_type            = 'open_source',
  data_classification     = 'internal',
  compliance_tags         = ARRAY['PCI'],
  criticality_justification = 'Routes 1M+ API calls/day; single point of egress for all services',
  updated_by              = 'seed-migration'
WHERE org_id = 1 AND name = 'API Gateway';

-- Monitoring Service (third-party-service, saas, production)
UPDATE public.it_assets SET
  vendor                  = 'Datadog Inc.',
  sourcing_type           = 'saas',
  environment             = 'production',
  business_unit           = 'SRE / Operations',
  asset_tag               = 'SRE-3PS-001',
  purchase_date           = '2022-01-01',
  license_expiry_date     = '2026-12-31',
  annual_cost             = 24000,
  license_type            = 'subscription',
  data_classification     = 'internal',
  compliance_tags         = ARRAY[]::text[],
  criticality_justification = 'On-call alerting depends on this service; outage detection latency risk',
  updated_by              = 'seed-migration'
WHERE org_id = 1 AND name = 'Monitoring Service';

-- Legacy ERP System (application, cots, production — nearing EOL/EOS)
UPDATE public.it_assets SET
  vendor                  = 'SAP SE',
  sourcing_type           = 'cots',
  environment             = 'production',
  business_unit           = 'Finance',
  asset_tag               = 'FIN-APP-001',
  purchase_date           = '2012-07-01',
  end_of_support_date     = '2025-06-30',
  end_of_life_date        = '2025-12-31',
  annual_cost             = 120000,
  license_type            = 'perpetual',
  support_contract_id     = 'SAP-SUPP-2012-FIN',
  data_classification     = 'restricted',
  compliance_tags         = ARRAY['SOX','GDPR'],
  criticality_justification = 'Core GL, AP, and AR ledger; no direct replacement identified yet',
  updated_by              = 'seed-migration'
WHERE org_id = 1 AND name = 'Legacy ERP System';
