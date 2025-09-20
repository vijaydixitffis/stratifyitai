/*
  # Add New Portfolio Analysis Categories and Assessments

  1. New Categories Added:
    - General Strategy Assessment
    - IT Portfolio Assessment  
    - Operations Assessment

  2. New Assessments Added:
    - 5 assessments under General Strategy Assessment
    - 4 assessments under IT Portfolio Assessment
    - 5 assessments under Operations Assessment

  3. Features:
    - Proper category_id references
    - Appropriate complexity and duration assignments
    - Sequential sort ordering
    - All assessments set to active status
*/

-- Insert new categories
INSERT INTO public.pa_categories (category_id, title, description, icon, color, sort_order, is_active) VALUES
('general-strategy', 'General Strategy Assessment', 'Comprehensive evaluation of strategic alignment, end user impact, documentation adherence, process compliance, and economic considerations', 'Target', 'bg-teal-600', 7, true),
('it-portfolio', 'IT Portfolio Assessment', 'Detailed assessment of application architecture, business architecture, data architecture, and infrastructure/technology architecture', 'Database', 'bg-cyan-600', 8, true),
('operations', 'Operations Assessment', 'Evaluation of DevOps practices, SecOps implementation, engineering excellence, change management, and support processes', 'Settings', 'bg-emerald-600', 9, true);

-- Insert assessments for General Strategy Assessment
INSERT INTO public.pa_assessments (assessment_id, category_id, name, description, duration, complexity, status, sort_order, is_active) VALUES
('end-user-voices', 'general-strategy', 'End User Voices', 'Analyze top 10 concerns/issues impacting end users, wish list aspirations, and support ticket insights', '1-2 weeks', 'Medium', 'available', 1, true),
('strategy-impact', 'general-strategy', 'Strategy Impact', 'Evaluate changes in business priority, business model, target operating model, and alignment to target architecture', '2-3 weeks', 'High', 'available', 2, true),
('documentation-adherence', 'general-strategy', 'Documentation', 'Assess adherence to architecture principles, patterns, standards, policies, and level of documentation', '1-2 weeks', 'Low', 'available', 3, true),
('process-adherence', 'general-strategy', 'Process Adherence', 'Review adherence to PnX process, RAID logs, decision logs, roadmap alignment, and consolidation strategies', '2-3 weeks', 'Medium', 'available', 4, true),
('economics-assessment', 'general-strategy', 'Economics', 'Analyze total cost of ownership, development costs, maintenance costs, operations costs, and cost optimization opportunities', '2-4 weeks', 'High', 'available', 5, true);

-- Insert assessments for IT Portfolio Assessment
INSERT INTO public.pa_assessments (assessment_id, category_id, name, description, duration, complexity, status, sort_order, is_active) VALUES
('application-architecture', 'it-portfolio', 'Application Architecture', 'Comprehensive assessment of metadata, lifecycle, scalability, performance, high availability, resilience, security, and integration architecture', '3-4 weeks', 'High', 'available', 1, true),
('business-architecture', 'it-portfolio', 'Business Architecture', 'Evaluate business use cases, capabilities, growth plans, domain model, NFRs, business continuity, and target operating model', '2-3 weeks', 'High', 'available', 2, true),
('data-architecture', 'it-portfolio', 'Data Architecture', 'Assess data classification, lifecycle management, scalability, performance, high availability, security, and data governance', '2-3 weeks', 'High', 'available', 3, true),
('infrastructure-architecture', 'it-portfolio', 'Infrastructure/Technology Architecture', 'Evaluate platform adequacy, scalability, performance, high availability, resilience, security, and infrastructure automation', '2-3 weeks', 'High', 'available', 4, true);

-- Insert assessments for Operations Assessment
INSERT INTO public.pa_assessments (assessment_id, category_id, name, description, duration, complexity, status, sort_order, is_active) VALUES
('devops-assessment', 'operations', 'DevOps', 'Assess 12 Factor compliance, version control, CI-CD pipeline, identity management, secrets management, and deployment strategy', '2-3 weeks', 'Medium', 'available', 1, true),
('secops-assessment', 'operations', 'SecOps', 'Evaluate threat models, secure code reviews, SAST/DAST, VAPT, environment hardening, and security metrics reporting', '2-3 weeks', 'High', 'available', 2, true),
('engineering-excellence', 'operations', 'Engineering Excellence and Software Quality', 'Review static code analysis, design reviews, code reviews, test plans, defect tracking, automation testing, and quality metrics', '1-2 weeks', 'Medium', 'available', 3, true),
('change-service-management', 'operations', 'Change & Service Management', 'Assess CAB process compliance, change categorization, SLA management, CMDB accuracy, and service management processes', '2-3 weeks', 'Medium', 'available', 4, true),
('support-incident-management', 'operations', 'Support & Incident Management', 'Evaluate incident classification, MTTR, FCR rates, escalation procedures, 24/7 support coverage, and problem management', '1-2 weeks', 'Medium', 'available', 5, true);