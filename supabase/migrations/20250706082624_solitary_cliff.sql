/*
  # Asset Management System Schema

  1. New Tables
    - `assets`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `type` (text, required, constrained)
      - `category` (text, required)
      - `description` (text, required)
      - `owner` (text, required)
      - `status` (text, default 'active', constrained)
      - `criticality` (text, default 'medium', constrained)
      - `tags` (text array)
      - `metadata` (jsonb)
      - `created_by` (text, required)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `asset_uploads`
      - `id` (uuid, primary key)
      - `file_name` (text, required)
      - `file_size` (bigint)
      - `status` (text, default 'pending', constrained)
      - `progress` (integer, 0-100)
      - `total_rows` (integer)
      - `processed_rows` (integer)
      - `error_rows` (integer)
      - `errors` (jsonb)
      - `uploaded_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
      - `completed_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
    - Assets: full CRUD access for authenticated users
    - Uploads: users can only access their own uploads

  3. Performance
    - Indexes on frequently queried columns
    - Full-text search index
    - GIN indexes for arrays and jsonb
    - Auto-update trigger for updated_at
*/

-- Create assets table
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('application', 'database', 'infrastructure', 'middleware', 'cloud-service', 'third-party-service')),
  category text NOT NULL,
  description text NOT NULL,
  owner text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated', 'planned')),
  criticality text NOT NULL DEFAULT 'medium' CHECK (criticality IN ('high', 'medium', 'low')),
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create asset_uploads table
CREATE TABLE IF NOT EXISTS asset_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_size bigint,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  total_rows integer DEFAULT 0,
  processed_rows integer DEFAULT 0,
  error_rows integer DEFAULT 0,
  errors jsonb DEFAULT '[]',
  uploaded_by uuid,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'asset_uploads_uploaded_by_fkey'
    AND table_name = 'asset_uploads'
  ) THEN
    ALTER TABLE asset_uploads 
    ADD CONSTRAINT asset_uploads_uploaded_by_fkey 
    FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_uploads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DO $$
BEGIN
  -- Drop existing policies for assets table
  DROP POLICY IF EXISTS "Users can view all assets" ON assets;
  DROP POLICY IF EXISTS "Users can insert assets" ON assets;
  DROP POLICY IF EXISTS "Users can update assets" ON assets;
  DROP POLICY IF EXISTS "Users can delete assets" ON assets;
  
  -- Drop existing policies for asset_uploads table
  DROP POLICY IF EXISTS "Users can view their uploads" ON asset_uploads;
  DROP POLICY IF EXISTS "Users can insert uploads" ON asset_uploads;
  DROP POLICY IF EXISTS "Users can update their uploads" ON asset_uploads;
END $$;

-- Create policies for assets table
CREATE POLICY "Users can view all assets"
  ON assets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert assets"
  ON assets
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update assets"
  ON assets
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete assets"
  ON assets
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for asset_uploads table
CREATE POLICY "Users can view their uploads"
  ON asset_uploads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can insert uploads"
  ON asset_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update their uploads"
  ON asset_uploads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploaded_by);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_criticality ON assets(criticality);
CREATE INDEX IF NOT EXISTS idx_assets_created_by ON assets(created_by);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);
CREATE INDEX IF NOT EXISTS idx_assets_updated_at ON assets(updated_at);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_assets_search ON assets USING gin(to_tsvector('english', name || ' ' || description || ' ' || owner));

-- Tags search index
CREATE INDEX IF NOT EXISTS idx_assets_tags ON assets USING gin(tags);

-- Metadata search index
CREATE INDEX IF NOT EXISTS idx_assets_metadata ON assets USING gin(metadata);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for demonstration (only if table is empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM assets LIMIT 1) THEN
    INSERT INTO assets (name, type, category, description, owner, status, criticality, tags, metadata, created_by) VALUES
    ('Customer Portal', 'application', 'Web Application', 'Main customer-facing portal for account management', 'IT Department', 'active', 'high', ARRAY['web', 'customer', 'portal'], '{"version": "2.1.0", "framework": "React", "hosting": "AWS"}', 'system'),
    ('Production Database', 'database', 'RDBMS (PostgreSQL)', 'Primary production database for customer data', 'Database Team', 'active', 'high', ARRAY['database', 'production', 'postgresql'], '{"version": "14.2", "size": "2.5TB", "backup_frequency": "daily"}', 'system'),
    ('AWS EC2 Instances', 'infrastructure', 'Virtual Machine', 'Production web servers on AWS', 'DevOps Team', 'active', 'high', ARRAY['aws', 'ec2', 'compute'], '{"instance_count": 5, "region": "us-west-2", "instance_type": "t3.large"}', 'system'),
    ('API Gateway', 'middleware', 'API Gateway', 'Central API management and routing', 'Platform Team', 'active', 'medium', ARRAY['api', 'gateway', 'middleware'], '{"version": "2.0", "requests_per_day": "1M", "endpoints": 45}', 'system'),
    ('Monitoring Service', 'third-party-service', 'Monitoring Service', 'Application monitoring and alerting platform', 'SRE Team', 'active', 'low', ARRAY['monitoring', 'observability', 'alerts'], '{"vendor": "DataDog", "plan": "Pro", "retention": "30 days"}', 'system'),
    ('Legacy ERP System', 'application', 'Enterprise Application', 'Legacy ERP system for financial operations', 'Finance Team', 'deprecated', 'medium', ARRAY['erp', 'legacy', 'finance'], '{"vendor": "SAP", "version": "6.0", "end_of_life": "2025-12-31"}', 'system');
  END IF;
END $$;