-- Migration to set up existing users with their organizations
-- This migration handles the two existing users: Manasvee Dixit and Vijaykumar Dixit

-- First, create the organizations for the existing users
INSERT INTO organizations (org_code, org_name, description, sector, remarks) VALUES
('FFITS', 'Future Focus IT Solutions', 'IT solutions and consulting company', 'Technology', 'Manasvee Dixit organization'),
('STRAT', 'StratifyIT.ai', 'IT consulting and strategy firm', 'Consulting', 'Vijaykumar Dixit organization')
ON CONFLICT (org_code) DO NOTHING;

-- Update user profiles for existing users
-- First, get the organization IDs
DO $$
DECLARE
  ffits_org_id INTEGER;
  strat_org_id INTEGER;
BEGIN
  -- Get organization IDs
  SELECT org_id INTO ffits_org_id FROM organizations WHERE org_code = 'FFITS';
  SELECT org_id INTO strat_org_id FROM organizations WHERE org_code = 'STRAT';
  
  -- Update Manasvee Dixit's profile (assuming email: manasveedixit@gmail.com)
  UPDATE user_profiles 
  SET 
    name = 'Manasvee Dixit',
    organization = 'Future Focus IT Solutions',
    org_id = ffits_org_id,
    role = 'client-cxo'
  WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'manasveedixit@gmail.com'
  );
  
  -- Update Vijaykumar Dixit's profile (assuming email: vijaykumardixit@gmail.com)
  UPDATE user_profiles 
  SET 
    name = 'Vijaykumar Dixit',
    organization = 'StratifyIT.ai',
    org_id = strat_org_id,
    role = 'admin-super'
  WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'vijaykumardixit@gmail.com'
  );
  
  -- Log the updates
  RAISE NOTICE 'Updated user profiles for existing users';
END $$;

-- Verify the setup
SELECT 
  up.name,
  up.email,
  up.organization,
  up.role,
  o.org_code,
  o.org_name
FROM user_profiles up
LEFT JOIN organizations o ON up.org_id = o.org_id
WHERE up.name IN ('Manasvee Dixit', 'Vijaykumar Dixit')
ORDER BY up.name; 