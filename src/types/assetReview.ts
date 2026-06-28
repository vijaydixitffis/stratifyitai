// ─────────────────────────────────────────────────────────────────────────────
// Types for the per-asset document capture and architectural review pipeline
// ─────────────────────────────────────────────────────────────────────────────

export type DocType =
  | 'architecture_doc'
  | 'design_decision'
  | 'nfr_spec'
  | 'runbook'
  | 'risk_assessment'
  | 'vendor_docs'
  | 'other';

export type SourceType =
  | 'url'
  | 'confluence'
  | 'sharepoint'
  | 'github'
  | 'gitlab'
  | 'google_drive'
  | 'file_upload'
  | 'paste_text';

export type FetchStatus = 'pending' | 'fetching' | 'completed' | 'failed';

export type ReviewStatus =
  | 'pending'
  | 'reviewing'
  | 'questionnaire_pending'
  | 'questionnaire_assigned'
  | 'questionnaire_completed'
  | 'addressed';

export interface AssetDocument {
  id: string;
  org_id: number;
  asset_id: string;
  doc_type: DocType;
  title: string;
  source_type: SourceType;
  source_url?: string;
  access_token?: string;
  content?: string;
  summary?: string;
  word_count?: number;
  fetch_status: FetchStatus;
  fetch_error?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ArchitectureDomainResult {
  score: number;        // 0-100
  notes: string;
  status: 'not_assessed' | 'partial' | 'assessed';
}

export interface ArchitectureConcern {
  domain: string;
  domain_label: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  concern: string;
  recommendation: string;
}

export interface GeneratedQuestion {
  id: string;
  domain: string;
  domain_label: string;
  question: string;
  type: 'yes_no' | 'multiple_choice' | 'scale';
  options?: string[];
  answer?: string;
  answered_at?: string;
}

export interface AssetReview {
  id: string;
  org_id: number;
  asset_id: string;
  review_status: ReviewStatus;
  completeness_score?: number;
  missing_domains?: string[];
  architecture_domains?: Record<string, ArchitectureDomainResult>;
  ai_generated_questions?: GeneratedQuestion[];
  assesspro_assessment_id?: string;
  assesspro_assignment_id?: string;
  review_summary?: string;
  architecture_concerns?: ArchitectureConcern[];
  override_incomplete: boolean;
  reviewed_by_ai_at?: string;
  last_assessed_at?: string;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Architecture framework types (mirrored in edge function review-frameworks.ts)
// ─────────────────────────────────────────────────────────────────────────────

export interface ArchitectureDomain {
  id: string;
  label: string;
  description: string;
  minDocWords: number;  // minimum document words needed to consider this domain covered
}

export const REVIEW_FRAMEWORKS: Record<string, ArchitectureDomain[]> = {
  application: [
    { id: 'architecture_style',    label: 'Architecture Style',     description: 'Monolith/microservices/serverless/SOA pattern and rationale',                     minDocWords: 50  },
    { id: 'nfr_coverage',          label: 'NFR Coverage',           description: 'Availability SLA, RTO/RPO targets, performance budgets, scalability approach',    minDocWords: 80  },
    { id: 'tech_debt',             label: 'Technical Debt',         description: 'Known debt, legacy patterns, planned refactors',                                   minDocWords: 30  },
    { id: 'security_posture',      label: 'Security Posture',       description: 'Auth/authz, OWASP controls, data protection, vulnerability management',            minDocWords: 60  },
    { id: 'integration_complexity',label: 'Integration Complexity', description: 'Number of integrations, patterns (REST/event/batch), coupling level',              minDocWords: 40  },
    { id: 'deployment_maturity',   label: 'Deployment Maturity',    description: 'CI/CD pipeline, containerisation, IaC, blue-green/canary deployments',            minDocWords: 40  },
    { id: 'observability',         label: 'Observability',          description: 'Logging, monitoring, distributed tracing, alerting coverage',                      minDocWords: 30  },
  ],
  database: [
    { id: 'data_model',            label: 'Data Model',             description: 'Relational/NoSQL fit for workload, schema design, normalisation',                  minDocWords: 60  },
    { id: 'governance',            label: 'Data Governance',        description: 'Data ownership, retention policy, archival strategy, lineage',                     minDocWords: 40  },
    { id: 'backup_recovery',       label: 'Backup & Recovery',      description: 'RTO/RPO defined and tested, backup frequency, point-in-time recovery',             minDocWords: 50  },
    { id: 'performance_capacity',  label: 'Performance & Capacity', description: 'TPS targets, query performance SLA, indexing strategy, capacity headroom',         minDocWords: 40  },
    { id: 'data_security',         label: 'Data Security',          description: 'Encryption at rest/transit, access control, audit logging',                        minDocWords: 40  },
    { id: 'data_residency',        label: 'Data Residency',         description: 'Geographic hosting, cross-border transfer controls, regulatory compliance',         minDocWords: 30  },
  ],
  infrastructure: [
    { id: 'capacity',              label: 'Capacity Utilization',   description: 'CPU/RAM headroom, storage growth trend, right-sizing evidence',                    minDocWords: 40  },
    { id: 'patching',              label: 'Patching Currency',      description: 'OS/firmware patch level, vulnerability scan results, patch cadence',               minDocWords: 30  },
    { id: 'high_availability',     label: 'High Availability',      description: 'Redundancy design, failover testing, single-point-of-failure elimination',         minDocWords: 50  },
    { id: 'disaster_recovery',     label: 'Disaster Recovery',      description: 'DR site/region, RTO/RPO defined and tested, runbook exists',                      minDocWords: 50  },
    { id: 'security_baseline',     label: 'Security Baseline',      description: 'CIS hardening, network segmentation, vulnerability management, MFA',               minDocWords: 40  },
    { id: 'monitoring',            label: 'Monitoring Coverage',    description: 'Infrastructure metrics, log aggregation, health dashboards, paging runbooks',      minDocWords: 30  },
  ],
  'cloud-service': [
    { id: 'cloud_native',          label: 'Cloud-Native Maturity',  description: 'Cloud-native vs lift-and-shift, managed services usage, serverless adoption',     minDocWords: 50  },
    { id: 'wa_reliability',        label: 'WA: Reliability',        description: 'Multi-AZ/region, auto-healing, quotas/limits management, DR testing',             minDocWords: 50  },
    { id: 'wa_security',           label: 'WA: Security',           description: 'IAM least-privilege, network controls, data encryption, security monitoring',     minDocWords: 50  },
    { id: 'wa_cost',               label: 'WA: Cost Optimization',  description: 'Right-sizing, reserved/savings plans, cost tagging, budget alerts',               minDocWords: 30  },
    { id: 'wa_performance',        label: 'WA: Performance',        description: 'Auto-scaling, caching strategy, CDN usage, performance benchmarks',               minDocWords: 40  },
    { id: 'wa_ops',                label: 'WA: Operational Exc.',   description: 'IaC coverage, deployment automation, runbooks, observability',                    minDocWords: 40  },
  ],
  middleware: [
    { id: 'integration_pattern',   label: 'Integration Pattern',    description: 'Sync/async fit, messaging vs REST vs batch, event-driven vs request-reply',       minDocWords: 50  },
    { id: 'reliability',           label: 'Reliability',            description: 'Error handling, retry strategy, dead-letter queues, circuit breakers',            minDocWords: 40  },
    { id: 'throughput_latency',    label: 'Throughput & Latency',   description: 'Message/API throughput targets, p99 latency SLA, load test evidence',            minDocWords: 40  },
    { id: 'versioning',            label: 'Versioning',             description: 'API/message versioning strategy, breaking-change management, consumer contracts',  minDocWords: 30  },
    { id: 'monitoring',            label: 'Monitoring',             description: 'Queue depth, lag, error rate, throughput dashboards and alerting',                minDocWords: 30  },
    { id: 'security',              label: 'Security',               description: 'TLS enforcement, mutual auth, payload validation, secrets management',            minDocWords: 30  },
  ],
  'third-party-service': [
    { id: 'vendor_risk',           label: 'Vendor Risk',            description: 'Vendor financial health, product roadmap viability, support tier',               minDocWords: 40  },
    { id: 'sla_terms',             label: 'SLA Terms',              description: 'Uptime SLA %, support response SLA, penalty/credit clauses',                     minDocWords: 40  },
    { id: 'data_handling',         label: 'Data Handling',          description: 'PII processing, cross-border data transfer controls, GDPR/CCPA compliance',       minDocWords: 50  },
    { id: 'exit_strategy',         label: 'Exit Strategy',          description: 'Data export capability, lock-in risk assessment, migration cost estimate',        minDocWords: 40  },
    { id: 'integration_dependency',label: 'Integration Dependency', description: 'Number of internal systems depending on this service, coupling level',            minDocWords: 30  },
    { id: 'compliance_alignment',  label: 'Compliance Alignment',   description: 'Certifications (SOC2, ISO27001), regulatory alignment with org requirements',    minDocWords: 30  },
  ],
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending:                 'Not Started',
  reviewing:               'AI Reviewing...',
  questionnaire_pending:   'Questionnaire Ready',
  questionnaire_assigned:  'Questionnaire Assigned',
  questionnaire_completed: 'Answers Received',
  addressed:               'Review Complete',
};

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  architecture_doc:  'Architecture Document',
  design_decision:   'Design Decision / ADR',
  nfr_spec:          'NFR Specification',
  runbook:           'Runbook / Operations',
  risk_assessment:   'Risk Assessment',
  vendor_docs:       'Vendor Documentation',
  other:             'Other',
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  url:          'Web URL',
  confluence:   'Confluence',
  sharepoint:   'SharePoint',
  github:       'GitHub',
  gitlab:       'GitLab',
  google_drive: 'Google Drive',
  file_upload:  'File Upload',
  paste_text:   'Paste Text',
};
