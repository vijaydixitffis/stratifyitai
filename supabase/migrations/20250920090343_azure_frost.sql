/*
  # Update existing users' app_metadata

  1. Updates
    - Update app_metadata for existing admin users
    - Update app_metadata for existing client users
    - This ensures JWT claims are available for RLS policies
  
  2. Security
    - Updates auth.users table to include role, org_id, and org_code in app_metadata
*/

-- Update app_metadata for existing admin users
UPDATE auth.users 
SET app_metadata = COALESCE(app_metadata, '{}'::jsonb) || 
    jsonb_build_object(
      'role', admin_users.role,
      'org_code', 'ADMIN'
    )
FROM admin_users
WHERE auth.users.id = admin_users.id;

-- Update app_metadata for existing client users
UPDATE auth.users 
SET app_metadata = COALESCE(app_metadata, '{}'::jsonb) || 
    jsonb_build_object(
      'role', client_users.role,
      'org_id', client_users.org_id,
      'org_code', client_orgs.org_code
    )
FROM client_users
JOIN client_orgs ON client_users.org_id = client_orgs.org_id
WHERE auth.users.id = client_users.id;