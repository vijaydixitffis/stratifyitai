# StratifyIT — Phase 2 (Analyze) & Phase 3 (Recommend & Transform)
## Complete Artifact Design + CC Implementation Plan

> Feed this file directly into Claude Code after completing the Sprint 1 (Discover) implementation.
> Phase 2 produces 10 structured artifacts. Phase 3 consumes all 10 to generate deliverables.

---

## Overview: The 10 Artifacts

| # | Artifact | Phase produced | Primary consumer in Phase 3 |
|---|----------|---------------|------------------------------|
| 1 | Per-asset score record | Analyze | Asset scorecards, 6R disposition logic |
| 2 | Portfolio heat map data | Analyze | Executive summary, rationalization report |
| 3 | Asset dependency map | Analyze | Roadmap sequencing, migration wave planning |
| 4 | Risk register | Analyze | Risk section of rationalization report, short-term roadmap |
| 5 | AI readiness profile | Analyze | AI enablement initiatives in roadmap |
| 6 | Capability gap analysis | Analyze | Target state architecture design |
| 7 | RAID log | Analyze | Risk/issue tracking across all Phase 3 deliverables |
| 8 | Executive summary report | Recommend | CXO review and sign-off |
| 9 | Current & target state architectures with milestone transitions | Recommend | Technology roadmap anchoring |
| 10 | Technology roadmap (short / mid / long term) | Recommend | Client execution plan |

Artifact 7 (Analysis sign-off) from the previous plan is replaced by the RAID log (Artifact 7 here) which is richer and also serves as the sign-off gate. The phase sign-off record is a separate lightweight row referencing the RAID log snapshot.

---

## Part 1 — Phase 2 Artifacts (Analyze)

### Artifact 1 — Per-Asset Score Record

**Purpose:** The atomic output of the AI/scoring engine. One record per asset per engagement. Drives 6R disposition and individual asset scorecards in Phase 3.

**Scoring dimensions** (each 1–5, derived from Phase 1 assessment responses):

| Dimension | Source assessment(s) | Scoring logic |
|-----------|----------------------|---------------|
| Technical health | App Modernization (Architecture, Dev/Deployment, Scalability, Security, Backward Compat topics) | Avg of topic scores mapped from answer `marks` field |
| Business fit | High Level IT Portfolio (Business Architecture topic) + Capability gap result | Does this asset support well-covered, high-priority capabilities? |
| Cloud readiness | App Modernization (Architecture, Scalability, Dev/Deployment) | Presence of cloud-native patterns, CI/CD, containerisation answers |
| Security posture | App Modernization (Security topic) + DB Architecture (Security topic) | Avg of security-category question marks |
| AI readiness | AI Readiness Assessment composite per capability | Mapped from org-level AI readiness profile to asset's primary capability |
| Operational risk | DB Architecture (Infrastructure, HA/DR) + App Modernization (Scalability) | Inverted: low HA/DR score = high operational risk |
| Cost efficiency signal | Asset metadata (status, vendor, EOL) + assessment responses on licensing | Deprecated status, EOL within 18mo, SaaS with low business fit = low score |

**Composite score formula:**
```
composite = (
  technical_health   × 0.25 +
  business_fit       × 0.20 +
  cloud_readiness    × 0.15 +
  security_posture   × 0.15 +
  ai_readiness       × 0.10 +
  operational_risk   × 0.10 +   -- stored inverted (5 = low risk)
  cost_efficiency    × 0.05
) × 20  -- maps to 0–100
```

Weights are configurable per engagement by the admin architect.

**DB schema:**
```sql
CREATE TABLE asset_scores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              INT NOT NULL REFERENCES client_orgs(id),
  asset_id            UUID NOT NULL REFERENCES it_assets(id),
  engagement_id       UUID NOT NULL REFERENCES engagements(id),
  -- Dimension scores (1–5)
  technical_health    SMALLINT CHECK (technical_health BETWEEN 1 AND 5),
  business_fit        SMALLINT CHECK (business_fit BETWEEN 1 AND 5),
  cloud_readiness     SMALLINT CHECK (cloud_readiness BETWEEN 1 AND 5),
  security_posture    SMALLINT CHECK (security_posture BETWEEN 1 AND 5),
  ai_readiness        SMALLINT CHECK (ai_readiness BETWEEN 1 AND 5),
  operational_risk    SMALLINT CHECK (operational_risk BETWEEN 1 AND 5),
  cost_efficiency     SMALLINT CHECK (cost_efficiency BETWEEN 1 AND 5),
  -- Computed
  composite_score     NUMERIC(5,2),               -- 0.00–100.00
  score_rationale     JSONB,                       -- {dimension: "AI-generated explanation"}
  -- Admin architect controls
  weight_overrides    JSONB,                       -- {dimension: weight} if customised
  admin_annotations   JSONB,                       -- {dimension: "override note"}
  admin_overridden_by UUID REFERENCES auth.users(id),
  admin_overridden_at TIMESTAMPTZ,
  -- Lifecycle
  scored_by           TEXT DEFAULT 'ai-engine',    -- 'ai-engine' | 'manual'
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, asset_id, engagement_id)
);
```

**Recommended 6R disposition mapping** (used as default in Phase 3, overridable by admin architect):

| Composite score | Default disposition |
|-----------------|---------------------|
| 80–100 | Retain |
| 60–79 | Replatform |
| 40–59 | Refactor |
| 20–39 | Rehost or Replace |
| 0–19 | Retire |

Override logic: if `operational_risk ≤ 2` regardless of composite → flag for Retire. If `business_fit = 5` regardless of composite → block auto-Retire, escalate to admin architect.

---

### Artifact 2 — Portfolio Heat Map Data

**Purpose:** Aggregated view across all asset scores mapped to business capabilities. The visual centrepiece of the executive summary and rationalization report.

**What it shows:**
- X-axis: Business capabilities (L1 or L2 from `business_capabilities` table)
- Y-axis: Asset types or individual assets
- Cell value: composite score of the asset(s) serving that capability
- Colour encoding: red (0–39) → amber (40–59) → green (60–100)

**Derived signals stored alongside:**
- `coverage_score` per capability: avg composite of all assets supporting it
- `concentration_risk`: boolean — only 1 asset serving this capability with criticality = high
- `redundancy_flag`: >2 assets serving same L2 capability with similar category
- `gap_flag`: capability has no supporting asset at all
- `ai_gap_flag`: capability is AI-priority but avg AI readiness score ≤ 2

**DB schema:**
```sql
CREATE TABLE portfolio_heatmap (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              INT NOT NULL REFERENCES client_orgs(id),
  engagement_id       UUID NOT NULL REFERENCES engagements(id),
  capability_id       UUID NOT NULL REFERENCES business_capabilities(id),
  asset_id            UUID REFERENCES it_assets(id),         -- NULL = gap (no asset)
  composite_score     NUMERIC(5,2),
  is_primary_support  BOOLEAN DEFAULT true,
  coverage_score      NUMERIC(5,2),                          -- capability-level avg
  concentration_risk  BOOLEAN DEFAULT false,
  redundancy_flag     BOOLEAN DEFAULT false,
  redundancy_group_id UUID,                                  -- groups redundant assets
  gap_flag            BOOLEAN DEFAULT false,
  ai_gap_flag         BOOLEAN DEFAULT false,
  snapshot_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (engagement_id, capability_id, asset_id)
);
```

**How it's generated:** Materialized by a server function after all `asset_scores` are published. Admin architect can trigger a refresh.

---

### Artifact 3 — Asset Dependency Map

**Purpose:** Captures which assets depend on which other assets. Critical for sequencing 6R decisions — you cannot Retire an asset that 5 others call without a migration plan.

**Dependency types:**
- `data-flow`: asset A reads/writes data from asset B
- `auth`: asset A authenticates via asset B
- `api`: asset A calls asset B's API
- `infrastructure`: asset A runs on asset B (app on VM, app on DB)
- `middleware`: asset A routes through asset B (via API gateway, message queue)
- `monitoring`: asset B monitors asset A

**Cluster computation:** Assets with bidirectional or circular dependencies are grouped into `dependency_clusters`. Each cluster becomes a unit of planning — you address the whole cluster in one roadmap wave, not individual assets in isolation.

**DB schema:**
```sql
CREATE TABLE asset_dependencies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              INT NOT NULL REFERENCES client_orgs(id),
  engagement_id       UUID NOT NULL REFERENCES engagements(id),
  source_asset_id     UUID NOT NULL REFERENCES it_assets(id),
  target_asset_id     UUID NOT NULL REFERENCES it_assets(id),
  dependency_type     TEXT NOT NULL,  -- see types above
  direction           TEXT NOT NULL,  -- 'upstream' | 'downstream' | 'bidirectional'
  is_hard_dependency  BOOLEAN DEFAULT true,  -- false = soft/optional
  notes               TEXT,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (engagement_id, source_asset_id, target_asset_id, dependency_type)
);

CREATE TABLE dependency_clusters (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              INT NOT NULL REFERENCES client_orgs(id),
  engagement_id       UUID NOT NULL REFERENCES engagements(id),
  cluster_name        TEXT,           -- admin architect names this e.g. "CRM stack"
  asset_ids           UUID[],         -- all members of the cluster
  rationalization_wave INT,           -- 1, 2, 3 — which wave of the roadmap addresses this
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);
```

**UI needed (Phase 2):** A dependency input form for admin architect — select source asset, select target asset, choose type and direction. A force-directed graph visualisation (read-only for clients) showing the dependency network.

---

### Artifact 4 — Risk Register

**Purpose:** Structured log of all risks identified during analysis. Feeds the risk section of the rationalization report and drives short-term roadmap priorities. Separate from the RAID log (Artifact 7) — the risk register is asset/capability scoped; the RAID log is engagement/programme scoped.

**Risk types auto-populated from scoring:**

| Risk type | Auto-trigger condition |
|-----------|------------------------|
| `eol-risk` | Asset `status = deprecated` OR vendor EOL metadata within 18 months |
| `single-point-of-failure` | Asset criticality = high, `concentration_risk = true`, `operational_risk ≤ 2` |
| `security-exposure` | `security_posture ≤ 2` |
| `capability-gap` | `gap_flag = true` on a high-strategic-importance capability |
| `ai-readiness-gap` | `ai_gap_flag = true` on a capability flagged for AI enablement |
| `technical-debt` | `technical_health ≤ 2` on any asset with `business_fit ≥ 4` |
| `vendor-lock-in` | SaaS/third-party asset with `business_fit ≥ 4` and no alternative asset |
| `licence-cost-risk` | SaaS asset with `cost_efficiency ≤ 2` and `business_fit ≤ 2` |

**DB schema:**
```sql
CREATE TABLE risk_register (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              INT NOT NULL REFERENCES client_orgs(id),
  engagement_id       UUID NOT NULL REFERENCES engagements(id),
  -- Scope
  asset_id            UUID REFERENCES it_assets(id),         -- NULL = org/capability level
  capability_id       UUID REFERENCES business_capabilities(id),
  -- Classification
  risk_type           TEXT NOT NULL,
  severity            TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  probability         TEXT CHECK (probability IN ('high','medium','low')),
  impact              TEXT CHECK (impact IN ('high','medium','low')),
  risk_score          INT,   -- probability × impact matrix: 1–9
  -- Content
  title               TEXT NOT NULL,
  description         TEXT,
  mitigation_hint     TEXT,   -- AI-generated suggestion
  -- Ownership
  owner               TEXT,   -- who is responsible for mitigating this risk
  target_resolution   DATE,
  -- Lifecycle
  status              TEXT DEFAULT 'open' CHECK (status IN ('open','mitigating','resolved','accepted')),
  source              TEXT DEFAULT 'auto' CHECK (source IN ('auto','admin-architect','client')),
  admin_notes         TEXT,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

---

### Artifact 5 — AI Readiness Profile

**Purpose:** Org-level maturity classification for AI adoption, derived entirely from Phase 1's AI Readiness Assessment responses. No new questions needed — just aggregation.

**Dimension scores** (from existing `assessment_responses` + `answer_options.marks`):

| Dimension | Source topic in AI Readiness Assessment |
|-----------|----------------------------------------|
| Business strategy | Business Strategy and Objectives topic |
| Tech infrastructure | Technological Infrastructure topic |
| Data quality | Data Infrastructure and Quality topic |
| Operations | Operations and Process Efficiency topic |
| Talent | Talent and Skills topic |
| Finance | Finance and Budget topic (question marks) |
| Governance | AI Governance and Ethics topic |
| Department readiness | Department-specific AI adoption topic |

**Maturity tiers:**

| Tier | Composite (0–100) | Readiness level |
|------|--------------------|-----------------|
| Exploring | 0–40 | AI is aspirational; foundational work needed across data, infra, and talent before any AI initiative |
| Developing | 41–60 | Pockets of readiness; targeted pilots viable in 1–2 capabilities with strong data maturity |
| Scaling | 61–80 | Broad AI adoption feasible; governance and talent are the remaining barriers |
| Leading | 81–100 | AI-native operations achievable; focus shifts to optimisation and responsible AI at scale |

**DB schema:**
```sql
CREATE TABLE ai_readiness_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  INT NOT NULL REFERENCES client_orgs(id),
  engagement_id           UUID NOT NULL REFERENCES engagements(id),
  session_id              UUID REFERENCES assessment_sessions(id),
  -- Dimension scores (0–100 each)
  strategy_score          NUMERIC(5,2),
  tech_infra_score        NUMERIC(5,2),
  data_quality_score      NUMERIC(5,2),
  operations_score        NUMERIC(5,2),
  talent_score            NUMERIC(5,2),
  finance_score           NUMERIC(5,2),
  governance_score        NUMERIC(5,2),
  dept_specific_score     NUMERIC(5,2),
  composite_score         NUMERIC(5,2),
  maturity_tier           TEXT CHECK (maturity_tier IN ('exploring','developing','scaling','leading')),
  -- Narrative
  tier_rationale          TEXT,    -- AI-generated explanation of the tier
  top_3_strengths         JSONB,   -- [{dimension, score, insight}]
  top_3_gaps              JSONB,   -- [{dimension, score, recommendation}]
  -- Lifecycle
  generated_at            TIMESTAMPTZ DEFAULT now(),
  admin_reviewed_at       TIMESTAMPTZ,
  UNIQUE (org_id, engagement_id)
);
```

---

### Artifact 6 — Capability Gap Analysis

**Purpose:** Maps the business capability model (L1/L2/L3) against portfolio coverage and scores to answer: "Which capabilities are poorly served, completely unserved, or over-served by the current IT estate?"

**Gap types:**

| Gap type | Condition | Action implication |
|----------|-----------|-------------------|
| `no-coverage` | No asset mapped to this capability | New capability needed in target state |
| `under-served` | Avg coverage score < 40 | Refactor or Replace existing assets |
| `adequate` | Avg coverage score 40–70 | Retain or minor Replatform |
| `well-served` | Avg coverage score > 70 | Retain; candidate for capability export/reuse |
| `over-served` | 3+ assets with overlapping category serving same L2 | Rationalise — retire redundant assets |
| `ai-priority-gap` | Capability is AI-strategic but AI readiness score ≤ 40 for supporting assets | Foundation work needed before AI initiative |

**Strategic importance flag:** set by the admin architect during Phase 2 — marks which L2 capabilities are strategically critical and should be prioritised in the target state architecture.

**DB schema:**
```sql
CREATE TABLE capability_gap_analysis (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  INT NOT NULL REFERENCES client_orgs(id),
  engagement_id           UUID NOT NULL REFERENCES engagements(id),
  capability_id           UUID NOT NULL REFERENCES business_capabilities(id),
  -- Coverage
  supporting_asset_count  INT DEFAULT 0,
  avg_coverage_score      NUMERIC(5,2),
  min_coverage_score      NUMERIC(5,2),
  max_coverage_score      NUMERIC(5,2),
  -- Gap classification
  gap_type                TEXT NOT NULL,   -- see types above
  strategic_importance    TEXT CHECK (strategic_importance IN ('critical','high','medium','low')),
  is_ai_priority          BOOLEAN DEFAULT false,
  -- Supporting asset list
  asset_ids               UUID[],
  primary_asset_id        UUID REFERENCES it_assets(id),
  -- Narrative
  gap_description         TEXT,    -- AI-generated
  recommendation_hint     TEXT,    -- AI-generated
  -- Admin controls
  admin_notes             TEXT,
  validated_by            UUID REFERENCES auth.users(id),
  validated_at            TIMESTAMPTZ,
  -- Lifecycle
  snapshot_at             TIMESTAMPTZ DEFAULT now(),
  UNIQUE (engagement_id, capability_id)
);
```

---

### Artifact 7 — RAID Log

**Purpose:** The programme-level log of Risks, Assumptions, Issues, and Dependencies for the entire rationalization engagement. Distinct from the risk register (which is asset/capability scoped) — the RAID log captures engagement-level concerns that cut across the programme: budget assumptions, organisational change risks, key people dependencies, open issues blocking decisions.

The RAID log also serves as the Phase 2 → Phase 3 gate document. Admin architect signs off on the RAID log (marks all critical open items as `accepted` or `resolved`) before Phase 3 begins.

**RAID categories:**

**Risks** — things that might happen and would negatively impact the programme
- Examples: key stakeholder leaving, budget freeze, technology end-of-life accelerating, data quality worse than assessed

**Assumptions** — things believed to be true that the recommendations depend on
- Examples: "Organisation will fund cloud migration in FY25", "IT team has capacity for parallel run", "Vendor X will be available for replacement"
- Assumptions that are invalidated become Issues or Risks

**Issues** — things that have already happened or are happening that need resolution
- Examples: incomplete asset inventory for a business unit, missing assessment responses, disputed business capability ownership, conflicting CXO priorities

**Dependencies** — external items that must happen for the recommendations to be executed
- Examples: procurement approval for new platform, HR sign-off on skill uplift programme, executive sponsor availability for roadmap review, third-party vendor migration support

**DB schema:**
```sql
CREATE TABLE raid_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              INT NOT NULL REFERENCES client_orgs(id),
  engagement_id       UUID NOT NULL REFERENCES engagements(id),
  -- Classification
  raid_type           TEXT NOT NULL CHECK (raid_type IN ('risk','assumption','issue','dependency')),
  severity            TEXT CHECK (severity IN ('critical','high','medium','low')),
  -- For risks: probability + impact
  probability         TEXT CHECK (probability IN ('high','medium','low')),
  impact              TEXT CHECK (impact IN ('high','medium','low')),
  -- Content
  ref_code            TEXT,          -- e.g. R-001, A-003, I-007, D-002 (auto-generated)
  title               TEXT NOT NULL,
  description         TEXT,
  -- Linkages to other artifacts
  related_asset_ids   UUID[],        -- assets this item relates to
  related_capability_ids UUID[],     -- capabilities affected
  related_risk_ids    UUID[],        -- risk_register.id cross-references
  -- Ownership and timeline
  raised_by           UUID REFERENCES auth.users(id),
  owner               TEXT,          -- person responsible for action/resolution
  due_date            DATE,
  -- Response
  response_plan       TEXT,          -- what is being done about it
  contingency         TEXT,          -- fallback if response fails (risks only)
  -- Lifecycle
  status              TEXT DEFAULT 'open'
                      CHECK (status IN ('open','in-progress','resolved','accepted','invalidated')),
  resolution_notes    TEXT,
  resolved_at         TIMESTAMPTZ,
  phase_gate_item     BOOLEAN DEFAULT false,  -- must be resolved/accepted before Phase 3 gate
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Auto-generate ref_code on insert (R-001, A-001, I-001, D-001 per engagement)
CREATE SEQUENCE raid_risk_seq;
CREATE SEQUENCE raid_assumption_seq;
CREATE SEQUENCE raid_issue_seq;
CREATE SEQUENCE raid_dependency_seq;
```

**Phase 2 gate rule:** `phase_gate_item = true` items must all have `status IN ('resolved','accepted')` before `phase_signoffs` record can be written with `phase = 2`.

**Auto-populated RAID items from scoring:**
- Every `severity = critical` entry in `risk_register` → auto-creates a RAID risk entry with `phase_gate_item = true`
- Every `assumption` baked into the scoring weights → auto-creates an assumption entry (e.g. "AI scoring weight of 10% assumes org has started AI strategy")
- Every `gap_flag = true` capability with `strategic_importance = critical` → auto-creates an issue entry

**UI needed:** A filterable, sortable table with inline edit for all four RAID types. Admin architect can create, edit, and resolve entries. Client roles can view and add comments. Phase gate status indicator at the top showing how many critical items are still open.

---

## Part 2 — Phase 3 Artifacts (Recommend & Transform)

### Artifact 8 — Executive Summary Report

**Purpose:** The CXO-facing document that synthesises the entire analysis into a 4–6 page narrative. Consumed by the client CXO for review and sign-off. Written by the admin architect, packaged by the admin consultant.

**Sections and data sources:**

```
1. Engagement overview
   - Org name, sector, engagement period, StratifyIT team
   - Source: client_orgs + engagement metadata

2. Portfolio snapshot (one page)
   - Total assets assessed, score distribution (pie/bar chart data)
   - Capability coverage summary (% well-served / under-served / gap)
   - AI readiness maturity tier + radar chart data
   - Source: asset_scores (aggregate), portfolio_heatmap, ai_readiness_profiles

3. Top findings (3–5 key insights)
   - Highest-severity risk register items
   - Biggest capability gaps
   - Most critical technical debt
   - Source: risk_register (critical/high), capability_gap_analysis (gap_type = no-coverage/under-served)

4. Recommended actions summary
   - 6R disposition breakdown (how many assets in each category)
   - Top 3 strategic initiatives from the roadmap
   - Source: asset_6r_dispositions (Phase 3), roadmap_initiatives (Phase 3)

5. Architecture direction (1 paragraph + diagram reference)
   - Key shifts from current to target state
   - Source: architecture_states (Phase 3)

6. RAID summary
   - Count of open risks, issues, assumptions, dependencies
   - Critical items and their status
   - Source: raid_log

7. Next steps and timeline
   - Milestone dates from the technology roadmap
   - Source: roadmap_milestones (Phase 3)

8. Sign-off block
   - Client CXO approval: status, date, name
   - StratifyIT lead: admin consultant name, date
   - Source: phase_signoffs (phase = 3)
```

**DB schema:**
```sql
CREATE TABLE executive_summary_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              INT NOT NULL REFERENCES client_orgs(id),
  engagement_id       UUID NOT NULL REFERENCES engagements(id),
  version             INT DEFAULT 1,
  -- Authored content (rich text / markdown per section)
  section_engagement  TEXT,
  section_snapshot    JSONB,   -- structured chart data + narrative
  section_findings    JSONB,   -- [{title, description, severity, source_artifact}]
  section_actions     JSONB,   -- [{disposition_summary, top_initiatives}]
  section_architecture TEXT,   -- narrative paragraph
  section_raid        JSONB,   -- summary counts + critical items
  section_next_steps  TEXT,
  -- Lifecycle
  authored_by         UUID REFERENCES auth.users(id),
  authored_at         TIMESTAMPTZ,
  last_edited_by      UUID REFERENCES auth.users(id),
  last_edited_at      TIMESTAMPTZ,
  submitted_for_review_at TIMESTAMPTZ,
  -- CXO sign-off
  cxo_status          TEXT DEFAULT 'pending' CHECK (cxo_status IN ('pending','in-review','approved','revision-requested')),
  cxo_approved_by     UUID REFERENCES auth.users(id),
  cxo_approved_at     TIMESTAMPTZ,
  cxo_comments        TEXT,
  -- Packaging
  export_url          TEXT,    -- link to generated PDF in storage
  exported_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);
```

**Role access:**
- Admin architect: author all sections, submit for review
- Admin consultant: package, export, manage version
- Client CXO: read all, approve/request revision
- Client manager + architect: read-only after approval

---

### Artifact 9 — Current & Target State Architectures with Milestone Transitions

**Purpose:** Two architecture snapshots (current and target) with a milestone-based transition plan that addresses the capability gaps. Not a free-form diagramming tool — a structured data model that renders visually and connects to the roadmap milestones.

**Structure:**

**Current state architecture:**
- Captures the actual architecture of the client's IT estate as assessed
- Each layer (presentation, application, data, infrastructure, integration) lists the assets within it
- Annotated with scores, status, and identified issues
- Source: `it_assets` + `asset_scores` + `dependency_clusters`

**Target state architecture:**
- The intended future architecture addressing all identified gaps
- Same layer structure, but shows new/modernised assets alongside retained ones
- Each target asset is linked to a roadmap initiative that delivers it
- Gap fills: capabilities that had `gap_flag = true` now have a target asset against them

**Milestone transitions (the bridge between current and target):**

Three milestone points matching the technology roadmap:
- **Milestone 1 (Short-term, 0–6 months):** Quick wins, immediate risk mitigation, foundational changes
- **Milestone 2 (Mid-term, 6–18 months):** Core modernisation, major platform changes, capability gap fills
- **Milestone 3 (Long-term, 18–36 months):** Strategic transformation, AI enablement, target state achieved

Each milestone shows:
- Which assets have changed disposition (Retired / Replaced / Rehosted / etc.)
- Which capability gaps have been addressed
- Which architecture layers have changed
- Which RAID items should be resolved by this milestone

**DB schema:**
```sql
CREATE TABLE architecture_states (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              INT NOT NULL REFERENCES client_orgs(id),
  engagement_id       UUID NOT NULL REFERENCES engagements(id),
  state_type          TEXT NOT NULL CHECK (state_type IN ('current','target')),
  -- Layer-based structure
  layers              JSONB NOT NULL,
  /*
  layers structure:
  {
    "presentation": {
      "label": "Presentation Layer",
      "assets": [{asset_id, name, score, status, notes}],
      "notes": "admin architect text"
    },
    "application": { ... },
    "integration": { ... },
    "data": { ... },
    "infrastructure": { ... },
    "security": { ... }
  }
  */
  -- Narrative
  architecture_notes  TEXT,
  key_characteristics JSONB,   -- [{title, description}] — bullet points
  -- For target state only
  gaps_addressed      UUID[],  -- capability_gap_analysis.id items this state resolves
  -- Lifecycle
  authored_by         UUID REFERENCES auth.users(id),
  version             INT DEFAULT 1,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE architecture_milestones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              INT NOT NULL REFERENCES client_orgs(id),
  engagement_id       UUID NOT NULL REFERENCES engagements(id),
  milestone_number    INT NOT NULL CHECK (milestone_number IN (1,2,3)),
  label               TEXT NOT NULL,  -- e.g. "Foundation & Risk Mitigation"
  horizon             TEXT NOT NULL,  -- 'short-term' | 'mid-term' | 'long-term'
  target_date         DATE,
  -- What changes at this milestone
  asset_dispositions  JSONB,
  /*
  [{
    asset_id, asset_name, disposition,
    from_state: "current", to_state: "rehosted|retired|replaced|refactored|replatformed|retained",
    notes
  }]
  */
  gaps_addressed      UUID[],         -- capability_gap_analysis.id items resolved at this milestone
  raid_items_expected UUID[],         -- raid_log.id items expected to be resolved by this point
  architecture_delta  TEXT,           -- narrative: what the architecture looks like at this point
  success_criteria    JSONB,          -- [{criterion, measurement}]
  -- Lifecycle
  authored_by         UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (engagement_id, milestone_number)
);
```

**UI needed:**
- A layered architecture canvas (rendered from `architecture_states.layers` JSONB) — not a free-draw tool; a structured layer-by-layer view with asset cards in each layer
- A milestone transition timeline showing the three milestones with their delta descriptions
- A before/after toggle showing current vs target for any selected layer
- Admin architect edits via structured form (not canvas drawing) — select assets per layer, add notes

---

### Artifact 10 — Technology Roadmap

**Purpose:** The execution plan for achieving the target state. Three time horizons, each containing initiatives that map directly to architecture milestone transitions, capability gap fills, risk mitigations, and RAID resolutions.

**Initiative types:**

| Type | Description | Example |
|------|-------------|---------|
| `rationalization` | Execute a 6R disposition on an asset | "Retire Legacy ERP — migrate data to new Finance platform" |
| `capability-gap-fill` | Introduce a new asset/capability | "Procure and implement HRMS SaaS to address HR capability gap" |
| `modernization` | Upgrade/refactor an existing retained asset | "Refactor Customer Portal to microservices architecture" |
| `risk-mitigation` | Address a risk register or RAID item | "Implement HA/DR for Production Database (SPOF risk)" |
| `ai-enablement` | Introduce AI capabilities to a supported function | "Deploy AI document processing for Finance capability" |
| `foundation` | Prerequisite infrastructure/platform work | "Establish Kubernetes platform for container workloads" |
| `governance` | Process or governance change | "Implement API governance framework across integration layer" |

**Horizon definitions:**

| Horizon | Duration | Character | Milestone |
|---------|----------|-----------|-----------|
| Short-term | 0–6 months | Quick wins, immediate risk mitigations, no-regret moves, foundational enablers | Milestone 1 |
| Mid-term | 6–18 months | Core transformation, major platform changes, capability gap fills | Milestone 2 |
| Long-term | 18–36 months | Strategic bets, AI enablement, full target state achievement | Milestone 3 |

**DB schema:**
```sql
CREATE TABLE roadmap_initiatives (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              INT NOT NULL REFERENCES client_orgs(id),
  engagement_id       UUID NOT NULL REFERENCES engagements(id),
  -- Classification
  initiative_type     TEXT NOT NULL,   -- see types above
  horizon             TEXT NOT NULL CHECK (horizon IN ('short-term','mid-term','long-term')),
  milestone_id        UUID REFERENCES architecture_milestones(id),
  priority            INT,             -- 1 = highest, within horizon
  -- Content
  title               TEXT NOT NULL,
  description         TEXT,
  business_outcome    TEXT,            -- what business result this delivers
  -- Linkages
  asset_ids           UUID[],          -- assets involved (source: it_assets)
  capability_gap_ids  UUID[],          -- gaps this initiative addresses
  risk_ids            UUID[],          -- risk_register items this mitigates
  raid_ids            UUID[],          -- raid_log items this resolves or progresses
  depends_on_ids      UUID[],          -- other roadmap_initiatives.id that must complete first
  -- Sizing
  effort_estimate     TEXT,            -- 'S' | 'M' | 'L' | 'XL' (t-shirt sizing)
  cost_band           TEXT,            -- 'low' | 'medium' | 'high' (relative, not absolute)
  complexity          TEXT CHECK (complexity IN ('low','medium','high')),
  -- Ownership
  workstream          TEXT,            -- e.g. "Infrastructure", "Application Modernisation", "Data"
  responsible_team    TEXT,
  -- Timeline
  indicative_start    DATE,
  indicative_end      DATE,
  -- Lifecycle
  status              TEXT DEFAULT 'proposed'
                      CHECK (status IN ('proposed','approved','in-progress','completed','deferred')),
  authored_by         UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Roadmap header (one per engagement, holds metadata)
CREATE TABLE roadmap_headers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              INT NOT NULL REFERENCES client_orgs(id),
  engagement_id       UUID NOT NULL REFERENCES engagements(id),
  title               TEXT DEFAULT 'IT Rationalization Roadmap',
  executive_summary   TEXT,            -- 2–3 paragraph narrative of the overall journey
  guiding_principles  JSONB,           -- [{principle, description}] — e.g. "Cloud-first", "AI-ready"
  -- Counts (denormalised for display)
  short_term_count    INT DEFAULT 0,
  mid_term_count      INT DEFAULT 0,
  long_term_count     INT DEFAULT 0,
  -- CXO sign-off (shared with exec summary report sign-off)
  approved_by         UUID REFERENCES auth.users(id),
  approved_at         TIMESTAMPTZ,
  version             INT DEFAULT 1,
  authored_by         UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, engagement_id)
);
```

**UI needed:**
- A Kanban-style roadmap view with three columns (short / mid / long term), initiative cards in each column
- Initiative card shows: title, type badge, effort, linked assets count, linked gap/risk count
- Admin architect creates and edits initiatives via a side panel form
- Client roles see read-only view; client CXO can approve/comment on the roadmap as a whole
- Filtering by initiative type, workstream, asset, or gap
- A timeline/Gantt view alternative (showing indicative_start to indicative_end per initiative)

---

## Part 3 — Supporting Infrastructure

### Engagement table (prerequisite — add before Phase 2 build)

All Phase 2 and 3 artifacts reference an `engagement_id`. Create this table to replace the loose `current_phase` field on `client_orgs`.

```sql
CREATE TABLE engagements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              INT NOT NULL REFERENCES client_orgs(id),
  name                TEXT NOT NULL,   -- e.g. "FY25 IT Rationalization"
  current_phase       INT DEFAULT 1,
  -- Phase gate timestamps
  phase1_approved_at  TIMESTAMPTZ,
  phase1_approved_by  UUID REFERENCES auth.users(id),
  phase2_approved_at  TIMESTAMPTZ,
  phase2_approved_by  UUID REFERENCES auth.users(id),
  phase3_approved_at  TIMESTAMPTZ,
  phase3_approved_by  UUID REFERENCES auth.users(id),
  -- Config
  scoring_weights     JSONB,   -- custom weights per engagement if admin architect overrides
  -- Lifecycle
  status              TEXT DEFAULT 'active' CHECK (status IN ('active','completed','paused','archived')),
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

### Phase 2 gate criteria (enforced before Phase 3 begins)

The following must all be true before `phase2_approved_at` can be written:

```
✅ All assets have a published asset_score record
✅ All assessment_sessions for the engagement are status = 'completed'
✅ capability_gap_analysis snapshot exists (at least one row per engagement)
✅ ai_readiness_profiles row exists
✅ portfolio_heatmap snapshot exists
✅ raid_log has at least one entry (RAID log has been started)
✅ All raid_log items with phase_gate_item = true have status IN ('resolved','accepted')
✅ Admin architect role has signed off (phase_signoffs record with phase = 2)
```

### RLS additions for new tables

```sql
-- All new tables follow the same pattern:
-- Admins: full access
-- Clients: SELECT only on own org_id after published_at / admin approval
-- Example for asset_scores:

ALTER TABLE asset_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_full_access_asset_scores ON asset_scores
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','admin-super')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','admin-super')));

CREATE POLICY client_read_published_asset_scores ON asset_scores
  FOR SELECT TO authenticated
  USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND published_at IS NOT NULL
  );

-- Apply same pattern to: portfolio_heatmap, dependency_clusters, risk_register,
-- ai_readiness_profiles, capability_gap_analysis, raid_log,
-- executive_summary_reports, architecture_states, architecture_milestones,
-- roadmap_initiatives, roadmap_headers
```

---

## Part 4 — CC Session Execution Order for Phase 2 & 3

Run these after all Sprint 1 (Discover) sessions are complete.

### Phase 2 sessions

```
Session P2-1:  DB migration — engagements table + backfill existing orgs
Session P2-2:  DB migration — asset_scores + asset_dependencies + dependency_clusters
Session P2-3:  DB migration — risk_register + capability_gap_analysis + portfolio_heatmap
Session P2-4:  DB migration — ai_readiness_profiles + raid_log
Session P2-5:  DB migration — RLS policies for all new Phase 2 tables
Session P2-6:  Scoring engine service — src/services/scoringService.ts
               (reads assessment_responses, computes dimension scores, writes asset_scores)
Session P2-7:  AI readiness profile aggregator — src/services/aiReadinessService.ts
               (aggregates existing Phase 1 responses into ai_readiness_profiles)
Session P2-8:  Capability gap analysis service — src/services/capabilityGapService.ts
               (joins business_capabilities + portfolio_heatmap, writes capability_gap_analysis)
Session P2-9:  Risk register auto-population service — src/services/riskRegisterService.ts
               (triggers from asset_scores published event, writes risk_register rows)
Session P2-10: RAID log UI — src/components/RAIDLog.tsx
               (filterable table, inline edit, phase gate indicator)
Session P2-11: Dependency map input UI — src/components/DependencyMapper.tsx
               (form to add dependencies, force-directed graph visualisation)
Session P2-12: Asset score viewer + override panel — src/components/AssetScoreCard.tsx
               (dimension bars, composite score, admin annotation panel)
Session P2-13: Phase 2 analysis dashboard — src/components/AnalyzeDashboard.tsx
               (heat map grid, score distribution chart, AI readiness radar, gap summary)
Session P2-14: Phase 2 gate UI — src/components/Phase2Gate.tsx
               (checklist of gate criteria, RAID open items, sign-off button for admin architect)
```

### Phase 3 sessions

```
Session P3-1:  DB migration — architecture_states + architecture_milestones
Session P3-2:  DB migration — roadmap_initiatives + roadmap_headers
Session P3-3:  DB migration — executive_summary_reports
Session P3-4:  DB migration — RLS for all Phase 3 tables
Session P3-5:  Architecture state editor — src/components/ArchitectureStateEditor.tsx
               (layered form for current/target state; asset card placement per layer)
Session P3-6:  Milestone transition builder — src/components/MilestoneBuilder.tsx
               (three-milestone form; asset disposition deltas; gap/RAID linkage)
Session P3-7:  Roadmap builder — src/components/RoadmapBuilder.tsx
               (Kanban 3-column view; initiative create/edit side panel; timeline view toggle)
Session P3-8:  Executive summary editor — src/components/ExecutiveSummaryEditor.tsx
               (section-by-section editor for admin architect; auto-populate from artifacts)
Session P3-9:  6R disposition assignment — src/components/DispositionPanel.tsx
               (per-asset disposition selector; links to roadmap initiative; bulk assignment)
Session P3-10: CXO review flow — src/components/CXOReviewPanel.tsx
               (read-only summary; approve / request-revision buttons; comment field)
Session P3-11: Phase 3 Recommend landing — src/components/RecommendDashboard.tsx
               (replaces placeholder; shows all 3 Phase 3 artifacts with status)
Session P3-12: Export service — src/services/exportService.ts
               (generates PDF-ready JSON for executive summary; triggers storage upload)
```

---

## Part 5 — Files Not to Touch

Carry forward from the Phase 1 plan — same constraints apply:

- `src/contexts/AuthContext.tsx`
- `src/lib/supabase.ts`
- All existing `supabase/stratify_rls_*.sql` files (only add new migration files)
- `src/components/LoginForm.tsx`
- `src/services/assetService.ts` (extend only — add `getAssetsByEngagement`, never rewrite)
- `src/components/ClientManagement.tsx`
