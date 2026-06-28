// ─────────────────────────────────────────────────────────────────────────────
// Per-asset-type architectural review frameworks
// ─────────────────────────────────────────────────────────────────────────────

export interface ArchDomain {
  id: string;
  label: string;
  description: string;
  minDocWords: number;
}

export const REVIEW_FRAMEWORKS: Record<string, ArchDomain[]> = {
  application: [
    { id: "architecture_style",    label: "Architecture Style",     description: "Architectural pattern (monolith/microservices/serverless/SOA) and technical rationale",                        minDocWords: 50  },
    { id: "nfr_coverage",          label: "NFR Coverage",           description: "Availability SLA, RTO/RPO targets, scalability approach, performance budgets",                                minDocWords: 80  },
    { id: "tech_debt",             label: "Technical Debt",         description: "Known tech debt, legacy code patterns, planned refactors or re-platforming decisions",                        minDocWords: 30  },
    { id: "security_posture",      label: "Security Posture",       description: "Auth/authz design, OWASP controls, data-at-rest/transit protection, vulnerability management cadence",       minDocWords: 60  },
    { id: "integration_complexity",label: "Integration Complexity", description: "Number and nature of integrations, patterns used (REST/event/batch), coupling and contract governance",     minDocWords: 40  },
    { id: "deployment_maturity",   label: "Deployment Maturity",    description: "CI/CD pipeline maturity, containerisation, IaC coverage, release strategies (blue-green/canary)",          minDocWords: 40  },
    { id: "observability",         label: "Observability",          description: "Structured logging, metrics collection, distributed tracing, alerting and on-call runbooks",                minDocWords: 30  },
  ],
  database: [
    { id: "data_model",            label: "Data Model",             description: "Relational/NoSQL fitness for workload, schema design, normalisation level, query patterns",                 minDocWords: 60  },
    { id: "governance",            label: "Data Governance",        description: "Data ownership, retention policy, archival strategy, lineage tracking",                                    minDocWords: 40  },
    { id: "backup_recovery",       label: "Backup & Recovery",      description: "Backup frequency, RTO/RPO defined and tested, point-in-time recovery capability",                          minDocWords: 50  },
    { id: "performance_capacity",  label: "Performance & Capacity", description: "TPS/QPS targets, p99 query latency SLA, indexing strategy, capacity headroom",                            minDocWords: 40  },
    { id: "data_security",         label: "Data Security",          description: "Encryption at rest and in transit, column-level controls, access review cadence, audit logging",           minDocWords: 40  },
    { id: "data_residency",        label: "Data Residency",         description: "Geographic hosting, cross-border transfer controls, regulatory data-localisation requirements",             minDocWords: 30  },
  ],
  infrastructure: [
    { id: "capacity",              label: "Capacity Utilization",   description: "CPU/RAM utilisation, storage growth trend, right-sizing evidence, future-demand plan",                    minDocWords: 40  },
    { id: "patching",              label: "Patching Currency",      description: "OS and firmware patch level, vulnerability scan results, patch cadence and approval process",              minDocWords: 30  },
    { id: "high_availability",     label: "High Availability",      description: "Redundancy design (N+1/N+2), failover testing cadence, SPOF elimination",                                 minDocWords: 50  },
    { id: "disaster_recovery",     label: "Disaster Recovery",      description: "DR site/region, tested RTO/RPO, runbook existence and review date",                                       minDocWords: 50  },
    { id: "security_baseline",     label: "Security Baseline",      description: "CIS hardening level, network segmentation, vulnerability management, MFA enforcement",                    minDocWords: 40  },
    { id: "monitoring",            label: "Monitoring Coverage",    description: "Infrastructure metrics collection, log aggregation, health dashboards, on-call runbooks",                  minDocWords: 30  },
  ],
  "cloud-service": [
    { id: "cloud_native",          label: "Cloud-Native Maturity",  description: "Cloud-native vs lift-and-shift assessment, managed services usage, serverless/PaaS adoption level",      minDocWords: 50  },
    { id: "wa_reliability",        label: "WA: Reliability",        description: "Multi-AZ/region topology, auto-healing design, service quotas/limits management, DR testing",            minDocWords: 50  },
    { id: "wa_security",           label: "WA: Security",           description: "IAM least-privilege implementation, network controls, encryption, security monitoring (GuardDuty/Defender)", minDocWords: 50  },
    { id: "wa_cost",               label: "WA: Cost Optimization",  description: "Right-sizing evidence, reserved/savings-plan coverage, cost tagging taxonomy, budget alerts",            minDocWords: 30  },
    { id: "wa_performance",        label: "WA: Performance",        description: "Auto-scaling policies, caching layers (ElastiCache/CDN), performance benchmarks",                        minDocWords: 40  },
    { id: "wa_ops",                label: "WA: Operational Exc.",   description: "IaC coverage (Terraform/CDK), deployment automation, runbooks, observability stack",                     minDocWords: 40  },
  ],
  middleware: [
    { id: "integration_pattern",   label: "Integration Pattern",    description: "Sync vs async fit assessment, messaging vs REST vs batch, event-driven vs request-reply choice",         minDocWords: 50  },
    { id: "reliability",           label: "Reliability",            description: "Error handling, retry with back-off, dead-letter queues, circuit breakers, idempotency",                 minDocWords: 40  },
    { id: "throughput_latency",    label: "Throughput & Latency",   description: "Defined message/API throughput targets, p99 latency SLA, load test evidence",                           minDocWords: 40  },
    { id: "versioning",            label: "Versioning",             description: "API/schema versioning strategy, breaking-change governance, consumer contract testing",                  minDocWords: 30  },
    { id: "monitoring",            label: "Monitoring",             description: "Queue depth monitoring, consumer lag, error rate, throughput dashboards and paging",                     minDocWords: 30  },
    { id: "security",              label: "Security",               description: "TLS enforcement, mutual auth (mTLS), payload validation, secrets rotation",                             minDocWords: 30  },
  ],
  "third-party-service": [
    { id: "vendor_risk",           label: "Vendor Risk",            description: "Vendor financial health, product roadmap viability, support tier and response SLA",                    minDocWords: 40  },
    { id: "sla_terms",             label: "SLA Terms",              description: "Contracted uptime SLA %, support response time, credit/penalty clauses, measurement methodology",      minDocWords: 40  },
    { id: "data_handling",         label: "Data Handling",          description: "PII processing scope, cross-border data transfer basis, GDPR/CCPA DPA existence",                     minDocWords: 50  },
    { id: "exit_strategy",         label: "Exit Strategy",          description: "Data export capability, portability assessment, lock-in risk, estimated migration cost",              minDocWords: 40  },
    { id: "integration_dependency",label: "Integration Dependency", description: "Number of internal systems that depend on this vendor, coupling level, blast radius",                 minDocWords: 30  },
    { id: "compliance_alignment",  label: "Compliance Alignment",   description: "Vendor certifications (SOC2/ISO27001), regulatory alignment with org requirements",                   minDocWords: 30  },
  ],
};

/** Fallback framework for unknown asset types — uses the application framework. */
export function getFramework(assetType: string): ArchDomain[] {
  return REVIEW_FRAMEWORKS[assetType] ?? REVIEW_FRAMEWORKS.application;
}

/** Compute completeness of an asset's document corpus against the framework domains. */
export function computeCompleteness(
  domains: ArchDomain[],
  documentContent: string  // all document text concatenated
): { score: number; missing: string[] } {
  const totalWords = documentContent.split(/\s+/).filter(Boolean).length;

  // Domain coverage heuristic:
  // We don't have per-domain labelling on raw text, so we fall back to total word count
  // weighted across domains.  If a domain's minDocWords threshold is met globally, it passes.
  // This is intentionally coarse — the AI generates targeted questions for gaps.
  const wordsPerDomain = totalWords / (domains.length || 1);
  const missing: string[] = [];
  let passed = 0;

  for (const d of domains) {
    if (wordsPerDomain >= d.minDocWords) {
      passed++;
    } else {
      missing.push(d.id);
    }
  }

  const score = Math.round((passed / domains.length) * 100);
  return { score, missing };
}

/** Questions to generate per domain when completeness is insufficient. */
export function questionsForDomains(
  assetName: string,
  assetType: string,
  domains: ArchDomain[],
  targetDomainIds: string[]
): string {
  const relevant = domains.filter(d => targetDomainIds.includes(d.id));
  const domainList = relevant
    .map(d => `- **${d.label}**: ${d.description}`)
    .join("\n");

  return `You are an enterprise IT architect reviewing the asset "${assetName}" (type: ${assetType}).
The following architectural domains have insufficient documentation:

${domainList}

Generate a targeted questionnaire of at most 20 questions (fewer is better) that would give you enough information
to assess these domains for an IT rationalization review. Focus on the highest-value missing information.

Rules:
- At most 3 questions per domain
- Prefer yes/no and multiple-choice over free-text
- Each question must specify: id (slug), domain (domain id from the list), domain_label, question text, type (yes_no|multiple_choice|scale), and for multiple_choice: options (array of strings)
- Return ONLY a JSON array of question objects, no preamble.

JSON shape:
[
  {
    "id": "arch_style_q1",
    "domain": "architecture_style",
    "domain_label": "Architecture Style",
    "question": "What architectural style does the application follow?",
    "type": "multiple_choice",
    "options": ["Monolith", "Microservices", "Serverless", "SOA/ESB", "Unknown"]
  },
  ...
]`;
}

/** Full architectural review prompt for an asset with sufficient documentation. */
export function reviewPrompt(
  assetName: string,
  assetType: string,
  assetCategory: string | null,
  cmdbData: string,
  documentContent: string,
  questionnaireAnswers: string,
  domains: ArchDomain[]
): string {
  const domainList = domains.map(d => `- **${d.label}** (${d.id}): ${d.description}`).join("\n");

  return `You are a senior enterprise IT architect conducting an architectural review of the following asset.

## Asset CMDB Data
${cmdbData}

## Attached Documentation
${documentContent.slice(0, 15_000) || "(none provided)"}

## Questionnaire Answers
${questionnaireAnswers || "(no questionnaire answers available)"}

## Review Framework for ${assetType}${assetCategory ? ` / ${assetCategory}` : ""}
Evaluate each domain below:

${domainList}

## Instructions
Assess the asset against each domain in the framework.  For each domain, assign a score 0-100 and note key findings.
Then identify the top architecture concerns (issues that would influence Retain/Replace/Modernise decisions).
Finally, write a 2-3 sentence architectural review summary for senior stakeholders.

Respond ONLY with valid JSON in this exact shape:

{
  "completeness_score": <integer 0-100 reflecting how much architectural context is available>,
  "review_summary": "<2-3 sentences: overall architectural health, top risk, recommended disposition signal>",
  "architecture_domains": {
    "<domain_id>": {
      "score": <integer 0-100>,
      "notes": "<1-2 sentences on findings for this domain>",
      "status": "assessed"
    }
  },
  "architecture_concerns": [
    {
      "domain": "<domain_id>",
      "domain_label": "<domain label>",
      "severity": "low|medium|high|critical",
      "concern": "<specific architectural issue>",
      "recommendation": "<actionable recommendation>"
    }
  ]
}

Include ALL framework domains in architecture_domains.
List 0-5 architecture_concerns (only real issues, not placeholder text).
Do not include any text outside the JSON object.`;
}
