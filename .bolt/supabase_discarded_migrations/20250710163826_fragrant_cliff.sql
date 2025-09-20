/*
  # Create Portfolio Analysis Tables

  1. New Tables
    - `pa_categories`
      - `id` (uuid, primary key)
      - `category_id` (text, unique identifier)
      - `title` (text)
      - `description` (text)
      - `icon` (text, icon name)
      - `color` (text, CSS color class)
      - `sort_order` (integer)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `pa_assessments`
      - `id` (uuid, primary key)
      - `assessment_id` (text, unique identifier)
      - `category_id` (text, foreign key to pa_categories)
      - `name` (text)
      - `description` (text)
      - `duration` (text)
      - `complexity` (text)
      - `status` (text)
      - `sort_order` (integer)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read data
    - Add policies for admins to manage data
*/

-- Create pa_categories table
CREATE TABLE IF NOT EXISTS public.pa_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'Target',
  color text NOT NULL DEFAULT 'bg-blue-600',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create pa_assessments table
CREATE TABLE IF NOT EXISTS public.pa_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id text UNIQUE NOT NULL,
  category_id text NOT NULL REFERENCES public.pa_categories(category_id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration text DEFAULT '1-2 weeks',
  complexity text DEFAULT 'Medium' CHECK (complexity IN ('Low', 'Medium', 'High')),
  status text DEFAULT 'available' CHECK (status IN ('available', 'in-progress', 'completed', 'disabled')),
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pa_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pa_assessments ENABLE ROW LEVEL SECURITY;

-- Create policies for pa_categories
CREATE POLICY "Allow authenticated users to read pa_categories"
  ON public.pa_categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Allow admins to manage pa_categories"
  ON public.pa_categories
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid));

-- Create policies for pa_assessments
CREATE POLICY "Allow authenticated users to read pa_assessments"
  ON public.pa_assessments
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Allow admins to manage pa_assessments"
  ON public.pa_assessments
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = (auth.jwt() ->> 'sub')::uuid));

-- Insert categories data
INSERT INTO public.pa_categories (category_id, title, description, icon, color, sort_order) VALUES
('strategy-enterprise-arch', 'Strategy and Enterprise Architecture', 'Enterprise architecture plays a key role in ensuring business outcomes from innovations and disruptions with risks mitigated', 'Building', 'bg-blue-600', 1),
('digital-ecosystem', 'Digital Ecosystem Readiness', 'Every business is now evolving into social ecosystem using digital means and connectedness', 'Globe', 'bg-green-600', 2),
('it-optimization', 'IT Optimization and Consolidation', 'Address technical debt and optimize IT operations to reduce support costs', 'Settings', 'bg-purple-600', 3),
('technology-architecture', 'Technology Architecture', 'Modernizing with new technology and platforms adoption is key to keep OPEX in control', 'Cpu', 'bg-indigo-600', 4),
('enterprise-governance', 'Enterprise Architecture Governance', 'Establish governance frameworks and processes for enterprise architecture', 'Shield', 'bg-red-600', 5),
('specialized-assessments', 'Specialized Assessments', 'Domain-specific assessments for comprehensive IT portfolio evaluation', 'Target', 'bg-orange-600', 6);

-- Insert assessments data
INSERT INTO public.pa_assessments (assessment_id, category_id, name, description, duration, complexity, status, sort_order) VALUES
-- Strategy and Enterprise Architecture
('business-capability-modeling', 'strategy-enterprise-arch', 'Business Capability Modeling', 'Assess and model business capabilities to align IT investments with business strategy', '2-3 weeks', 'Medium', 'available', 1),
('business-it-alignment', 'strategy-enterprise-arch', 'Business and IT Strategy Alignment', 'Evaluate alignment between business objectives and IT strategy', '1-2 weeks', 'High', 'available', 2),
('digital-strategy', 'strategy-enterprise-arch', 'Digital Strategy Assessment', 'Comprehensive evaluation of digital transformation readiness and strategy', '3-4 weeks', 'High', 'available', 3),
('fsa-gap-analysis', 'strategy-enterprise-arch', 'FSA and Gap Analysis', 'Future State Architecture planning with current state gap analysis', '2-3 weeks', 'High', 'available', 4),
('ea-maturity', 'strategy-enterprise-arch', 'EA Maturity Assessment', 'Evaluate enterprise architecture maturity and governance capabilities', '1-2 weeks', 'Medium', 'available', 5),

-- Digital Ecosystem Readiness
('cloud-readiness', 'digital-ecosystem', 'Cloud Readiness Assessment', 'Evaluate applications and infrastructure readiness for cloud migration', '2-3 weeks', 'Medium', 'available', 1),
('api-hybrid-integration', 'digital-ecosystem', 'APIs and Hybrid Integration', 'Assess API strategy and hybrid integration capabilities', '1-2 weeks', 'Medium', 'available', 2),
('microservices-adoption', 'digital-ecosystem', 'Microservices Adoption', 'Evaluate readiness for microservices architecture adoption', '2-3 weeks', 'High', 'available', 3),
('mobile-omni-channel', 'digital-ecosystem', 'Mobile and Omni-Channel Readiness', 'Assess mobile and omnichannel customer experience capabilities', '1-2 weeks', 'Medium', 'available', 4),
('analytics-readiness', 'digital-ecosystem', 'Analytics and Data Readiness', 'Evaluate data analytics and business intelligence capabilities', '2-3 weeks', 'Medium', 'available', 5),

-- IT Optimization and Consolidation
('application-portfolio-rationalization', 'it-optimization', 'Applications Portfolio Rationalization', 'Analyze and optimize application portfolio for efficiency and cost reduction', '3-4 weeks', 'High', 'available', 1),
('solution-architecture', 'it-optimization', 'Solution Architecture Assessment', 'Evaluate solution architecture patterns and design principles', '2-3 weeks', 'High', 'available', 2),
('enterprise-integration-soa', 'it-optimization', 'Enterprise Integration and SOA', 'Assess enterprise integration patterns and service-oriented architecture', '2-3 weeks', 'High', 'available', 3),

-- Technology Architecture
('infrastructure-rationalization', 'technology-architecture', 'Infrastructure Rationalization', 'Optimize infrastructure components and reduce operational complexity', '2-3 weeks', 'Medium', 'available', 1),
('legacy-modernization', 'technology-architecture', 'Legacy Modernization Assessment', 'Evaluate legacy systems and create modernization roadmap', '3-4 weeks', 'High', 'available', 2),
('platform-architecture-upgrades', 'technology-architecture', 'Platform Architecture Upgrades', 'Assess platform architecture and identify upgrade opportunities', '2-3 weeks', 'Medium', 'available', 3),

-- Enterprise Architecture Governance
('ea-governance-framework', 'enterprise-governance', 'EA Governance Framework', 'Establish enterprise architecture governance processes and standards', '2-3 weeks', 'High', 'available', 1),
('architecture-compliance', 'enterprise-governance', 'Architecture Compliance Assessment', 'Evaluate compliance with enterprise architecture standards', '1-2 weeks', 'Medium', 'available', 2),
('technology-standards', 'enterprise-governance', 'Technology Standards Assessment', 'Review and optimize technology standards and guidelines', '1-2 weeks', 'Medium', 'available', 3),

-- Specialized Assessments
('ai-readiness', 'specialized-assessments', 'AI Readiness Assessment', 'Evaluate organizational readiness for artificial intelligence adoption', '2-3 weeks', 'High', 'available', 1),
('application-modernity', 'specialized-assessments', 'Application Modernity Assessment', 'Assess application architecture and technology stack modernity', '2-3 weeks', 'Medium', 'available', 2),
('database-architecture', 'specialized-assessments', 'Database Architecture Assessment', 'Comprehensive evaluation of database architecture and performance', '1-2 weeks', 'Medium', 'available', 3),
('network-infrastructure', 'specialized-assessments', 'Network/Infrastructure Assessment', 'Assess network architecture and infrastructure capabilities', '2-3 weeks', 'Medium', 'available', 4),
('devsecops', 'specialized-assessments', 'DevSecOps Assessment', 'Evaluate development, security, and operations integration maturity', '1-2 weeks', 'Medium', 'available', 5),
('scaled-agile', 'specialized-assessments', 'Scaled Agile Assessment', 'Assess agile transformation and scaled agile framework adoption', '1-2 weeks', 'Medium', 'available', 6),
('operational-support', 'specialized-assessments', 'Operational Support Assessment', 'Evaluate IT operations and support model effectiveness', '1-2 weeks', 'Medium', 'available', 7),
('target-operating-model', 'specialized-assessments', 'Target Operating Model Assessment', 'Design and assess target operating model for IT organization', '3-4 weeks', 'High', 'available', 8);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pa_categories_sort_order ON public.pa_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_pa_categories_is_active ON public.pa_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_pa_assessments_category_id ON public.pa_assessments(category_id);
CREATE INDEX IF NOT EXISTS idx_pa_assessments_sort_order ON public.pa_assessments(sort_order);
CREATE INDEX IF NOT EXISTS idx_pa_assessments_is_active ON public.pa_assessments(is_active);

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pa_categories_updated_at BEFORE UPDATE ON public.pa_categories FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_pa_assessments_updated_at BEFORE UPDATE ON public.pa_assessments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();