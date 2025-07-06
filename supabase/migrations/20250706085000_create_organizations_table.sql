-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  org_id SERIAL PRIMARY KEY,
  org_code VARCHAR(5) UNIQUE NOT NULL,
  org_name TEXT NOT NULL,
  description TEXT,
  sector TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add org_id foreign key to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(org_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_org_code ON organizations(org_code);
CREATE INDEX IF NOT EXISTS idx_user_profiles_org_id ON user_profiles(org_id);

-- Create function to update updated_at timestamp for organizations
CREATE OR REPLACE FUNCTION update_organization_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at for organizations
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_updated_at();

-- Update the handle_new_user function to handle org_id
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  org_id_val INTEGER;
BEGIN
  -- Try to find existing organization by org_code
  IF NEW.raw_user_meta_data->>'orgCode' IS NOT NULL THEN
    SELECT o.org_id INTO org_id_val 
    FROM organizations o 
    WHERE o.org_code = NEW.raw_user_meta_data->>'orgCode';
  END IF;

  INSERT INTO public.user_profiles (id, name, role, organization, org_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client-manager'),
    COALESCE(NEW.raw_user_meta_data->>'organization', 'Default Organization'),
    org_id_val
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on organizations table
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Create policies for organizations table
CREATE POLICY "Authenticated users can view all organizations"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage all organizations"
  ON organizations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin-super'
    )
  );

-- Insert some sample organizations
INSERT INTO organizations (org_code, org_name, description, sector, remarks) VALUES
('TECH1', 'TechCorp Inc.', 'Leading technology solutions provider', 'Technology', 'Primary client'),
('STRAT1', 'StratifyIT.ai', 'IT consulting and strategy firm', 'Consulting', 'Internal organization'),
('FIN1', 'FinanceCorp', 'Financial services company', 'Finance', 'New client')
ON CONFLICT (org_code) DO NOTHING; 