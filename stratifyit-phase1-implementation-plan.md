# StratifyIT — Implementation Plan
> Claude Code execution plan: Feature audit + UX overhaul + Phase 1 (Discover) full build · Phases 2 & 3 placeholders

---

## Part 1 — Feature Audit: What's Built vs What's Pending

### ✅ Implemented (working today)

| Area | What exists |
|------|-------------|
| **Auth** | Three-factor login (org code + email + password), org isolation, Supabase RLS policies |
| **Roles** | `admin`, `admin-super`, `client-manager`, `client-architect`, `client-cxo` defined in DB and JWT |
| **Navigation** | Role-split nav — admin tabs vs client tabs, tab-based routing in `App.tsx` |
| **Asset inventory** | Add/edit assets (form), bulk upload (CSV/Excel), asset types/categories, criticality, tags, status, owner |
| **Asset upload validation** | Schema validation on CSV rows, error/warning reporting |
| **Assessments shell** | `AssessmentsDashboard` — category grid, assessment list, start-assessment modal, process steps shown |
| **Assessment questions** | DB schema + data for AI Readiness, App Modernization, Database Architecture assessments (topics + questions + answer options) |
| **Client management** | Org onboarding form, user create/edit/delete, org list, org code provisioning |
| **Dashboard** | Asset stats cards (active/inactive/deprecated), quick action buttons |
| **DB schema** | `it_assets`, `it_asset_uploads`, `client_orgs`, `client_users`, `assessments`, `topics`, `questions`, `pa_categories`, `pa_assessments` |
| **Supabase RLS** | Per-org row isolation for assets and users; admin full-access policies |

---

### ❌ Not Implemented (gaps vs the 3-phase RBAC model)

#### UX & Navigation gaps
- [ ] No phase-aware navigation — "Discover / Analyze / Recommend" framing doesn't exist in UI
- [ ] No engagement/project context — users land on a generic dashboard, no sense of where they are in the rationalization journey
- [ ] Nav tabs not role-restricted correctly — `Strategy Insights` and `Reports` tabs exist but render "coming soon" strings
- [ ] No phase progress indicator or gate UI (admin architect sign-off flow missing)
- [ ] Dashboard is generic asset stats — no phase status, no next-action prompts per role

#### Phase 1 — Discover (gaps)
- [ ] Assessment questions UI — no actual question-by-question form renderer; `AssessmentsDashboard` shows categories but "Start Assessment" has no working flow
- [ ] No assessment session tracking — can't save progress, resume, or mark a topic complete
- [ ] Business capability questionnaire — topics exist in DB but no dedicated capability mapping UI (L1/L2/L3 hierarchy input)
- [ ] No asset-to-assessment linkage — assessments are org-level, not per-asset (App Modernization needs per-asset instance)
- [ ] No assessment completion status — admin architect can't see which assets have been assessed
- [ ] No data quality gate UI — no mechanism for admin architect to approve/reject Phase 1 completion
- [ ] Phase 1 dashboard card — no summary of ingestion progress per org for admin view

#### Phase 2 — Analyze (not started)
- [ ] No AI analysis trigger mechanism
- [ ] No asset scoring model or score storage schema
- [ ] No score viewer / scorecard UI
- [ ] No score override panel for admin architect
- [ ] No capability-to-asset mapping view
- [ ] No dependency/risk heatmap
- [ ] No "publish analysis" gate

#### Phase 3 — Recommend & Transform (not started)
- [ ] No 6R disposition assignment UI
- [ ] No asset scorecards output page
- [ ] No rationalization report generator
- [ ] No current/target state architecture canvas
- [ ] No technology roadmap (short/medium/long term) builder
- [ ] No executive summary report
- [ ] No CXO approval workflow
- [ ] No export (PDF/PPTX)
- [ ] `Reports` tab is a "coming soon" placeholder
- [ ] `Strategy Insights` tab is a "coming soon" placeholder

---

## Part 2 — Implementation Plan

### Guiding principles for CC execution

- Work file by file; commit logical units (one component, one service, one migration per session)
- Don't touch `AuthContext`, Supabase client config, or RLS SQL unless specifically listed
- All new components go in `src/components/` with matching service files in `src/services/`
- Use existing Tailwind + shadcn/ui patterns already in the codebase; no new UI libraries
- Phase 2 and 3 get placeholder pages with locked UI — clearly communicated to users, not broken "coming soon" text

---

## Sprint 0 — UX Foundation (do first, unblocks everything)

> Goal: reframe the app around the 3-phase rationalization journey. Every role lands somewhere meaningful.

### 0.1 — Phase-aware dashboard redesign

**File:** `src/components/Dashboard.tsx`

Replace the generic asset stats cards with a phase status dashboard:

- **Admin view:** Per-org engagement card showing phase progress (`Phase 1 In Progress | 3/5 assets assessed | Gate: Pending`). CTA buttons scoped to current phase.
- **Client view:** "Your rationalization journey" banner showing current phase, completion %, and what's needed from them next. Role-specific next-action prompt (e.g. client architect sees "3 assets awaiting your assessment").
- Keep existing asset stats as a collapsed secondary section.

**CC prompt to use:**
```
Redesign Dashboard.tsx to show a phase-aware rationalization journey status panel at the top. 
For admin users show a per-org card grid with phase progress. For client users show a single 
org journey banner with current phase, completion percentage, and a role-specific next-action 
CTA. Keep existing asset stat cards below as a secondary section. Use existing Tailwind classes.
```

---

### 0.2 — Navigation restructure

**File:** `src/components/Navigation.tsx`

Restructure nav into phase-grouped tabs:

```
Admin tabs:    Dashboard | [Discover: Assets, Assessments] | [Analyze 🔒] | [Recommend 🔒] | Clients | Settings
Client tabs:   Dashboard | [Discover: Assets, Assessments] | [Analyze 🔒] | [Recommend 🔒]
```

- Group Discover-phase tabs under a `Discover` section label (or dropdown)
- Analyze and Recommend tabs visible but locked with a lock icon and tooltip: "Available after Phase 1 is complete"
- Remove `Strategy Insights` and `Reports` from nav for now — they belong inside Phase 2 and 3 respectively
- Admin architect gets an additional `Phase Gate` badge indicator in the nav showing pending sign-offs

**CC prompt to use:**
```
Restructure Navigation.tsx to group tabs by rationalization phase. Add a Discover section 
containing Assets and Assessments tabs. Add Analyze and Recommend tabs that are visible but 
disabled (with a lock icon) when the current engagement phase is < 2 or < 3. Remove the 
standalone Strategy Insights and Reports tabs. Admin tabs keep Clients and Settings. 
Use a phase context (can be a simple prop or context value for now).
```

---

### 0.3 — Role-gated route guard

**File:** `src/contexts/PhaseContext.tsx` (new)

Create a `PhaseContext` that:
- Stores current phase per selected org (1, 2, or 3)
- Exposes `canAccessPhase(n)` helper
- Reads from a `engagements` table (or a field on `client_orgs` for now — add `current_phase INT DEFAULT 1`)
- Admin consultant and admin architect can advance the phase; client roles cannot

**DB migration:** `supabase/migrations/YYYYMMDD_add_phase_to_orgs.sql`
```sql
ALTER TABLE client_orgs ADD COLUMN IF NOT EXISTS current_phase INT DEFAULT 1;
ALTER TABLE client_orgs ADD COLUMN IF NOT EXISTS phase1_approved_at TIMESTAMPTZ;
ALTER TABLE client_orgs ADD COLUMN IF NOT EXISTS phase1_approved_by UUID REFERENCES auth.users(id);
```

---

### 0.4 — Header org selector cleanup

**File:** `src/components/Header.tsx`

- Ensure the org selector (already partially built) only shows for admin roles
- Show the selected org's current phase badge next to the org name (`Phase 1 · Discover`)
- Add a "Phase gate" button for admin architect when phase 1 is completable

---

## Sprint 1 — Phase 1: Discover (full build)

> Goal: complete the Discover phase so a client can fully ingest assets, complete all assessments, and an admin architect can sign off.

### 1.1 — Assessment question renderer

**File:** `src/components/AssessmentRunner.tsx` (new)

This is the most important missing piece. Build a step-through question form:

- Loads questions for a given `assessment_id` from Supabase (`questions` + `topics` tables)
- Groups questions by topic with a topic progress sidebar
- Renders multiple-choice questions with radio buttons (answer options from `answer_options` table)
- Auto-saves answers to a new `assessment_responses` table on each answer
- Shows topic completion checkmarks
- Final submit triggers a completion record in `assessment_sessions`

**DB migration:** `supabase/migrations/YYYYMMDD_assessment_sessions.sql`
```sql
CREATE TABLE assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id INT REFERENCES client_orgs(id),
  asset_id UUID REFERENCES it_assets(id) NULLABLE, -- null for org-level assessments
  assessment_id UUID REFERENCES assessments(id),
  started_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'in_progress', -- in_progress | completed | flagged
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES assessment_sessions(id),
  question_id UUID REFERENCES questions(id),
  answer_option_id UUID REFERENCES answer_options(id) NULLABLE,
  text_answer TEXT NULLABLE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, question_id)
);
```

**CC prompt to use:**
```
Create AssessmentRunner.tsx that loads assessment questions from Supabase for a given 
assessment_id and (optionally) asset_id. Render a topic sidebar with completion status 
and a main question area with multiple-choice radio inputs. Auto-save each answer to 
assessment_responses table. Show a submit button on the last question that marks the 
session completed. Use existing shadcn/ui components and Tailwind patterns.
```

---

### 1.2 — Wire AssessmentRunner into AssessmentsDashboard

**File:** `src/components/AssessmentsDashboard.tsx`

- Replace the "Start Assessment" modal's dead CTA with navigation to `AssessmentRunner`
- Pass `assessment_id` and optionally `asset_id`
- Show session status (not started / in progress / completed) on each assessment card
- Pull session status from `assessment_sessions` table filtered by org

**CC prompt to use:**
```
Update AssessmentsDashboard.tsx to check assessment_sessions for each assessment card 
and show a status badge (Not started / In progress / Completed). Wire the Start Assessment 
button to open AssessmentRunner with the correct assessment_id. Add a Resume button for 
in-progress sessions.
```

---

### 1.3 — Per-asset assessment instances

**File:** `src/components/AssetInventory.tsx` (update)

Add an "Assess" button to each asset row that:
- Shows which assessments are applicable for this asset type (App Modernization for applications, Database Architecture for databases, etc.)
- Lets client architect start/resume an assessment session scoped to that asset
- Shows a completion badge on the asset row when all applicable assessments are done

**CC prompt to use:**
```
Add an Assess column to the asset inventory table. For each asset, show applicable 
assessment types based on asset.type (applications → App Modernization; databases → 
Database Architecture). Show session status badge. Clicking opens AssessmentRunner 
with asset_id set.
```

---

### 1.4 — Business capability mapping UI

**File:** `src/components/CapabilityMapper.tsx` (new)

A structured form for mapping the client org's business capabilities (L1 → L2 → L3 hierarchy):

- Input for org mission/vision/goals
- Accordion UI for L1 capabilities (e.g. Finance, HR, Operations)
- Nested inputs for L2 and L3 sub-capabilities
- Save to a new `business_capabilities` table
- Visible to client manager and client CXO; editable by both

**DB migration:** `supabase/migrations/YYYYMMDD_business_capabilities.sql`
```sql
CREATE TABLE business_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id INT REFERENCES client_orgs(id),
  level INT NOT NULL, -- 1, 2, or 3
  parent_id UUID REFERENCES business_capabilities(id),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

This becomes part of the Assessments tab under a "Business Capabilities" sub-section, or as a tab within the Discover section.

---

### 1.5 — Phase 1 progress tracker (admin view)

**File:** `src/components/Phase1Progress.tsx` (new)

Admin-only component visible in the Dashboard and in a new "Phase Gate" panel:

- Shows per-org progress across all 3 data streams:
  - Asset inventory: `X assets uploaded, Y with complete assessments`
  - Business capabilities: `L1 mapped / L2 mapped / L3 mapped`
  - AI readiness: `Assessment completed / not started`
- Shows an "Approve Phase 1" button for admin architect when all streams show complete
- Clicking approve writes `phase1_approved_at` and advances `current_phase` to 2

**CC prompt to use:**
```
Create Phase1Progress.tsx that queries assessment_sessions, it_assets, and 
business_capabilities for the selected org and renders a progress checklist across 
3 streams: Asset Inventory, Business Capabilities, and AI Readiness. Show an 
"Approve & advance to Phase 2" button visible only to admin-architect role, 
which updates client_orgs.current_phase = 2 and records approval metadata.
```

---

### 1.6 — Discover section landing page

**File:** `src/components/DiscoverLanding.tsx` (new)

When a user clicks the Discover section in nav, show a landing page:

- **Admin view:** Org selector at top, then Phase1Progress component, then links to Assets and Assessments
- **Client manager view:** "Your tasks for Discover phase" card with 3 items: upload assets, map capabilities, confirm AI readiness assessment is assigned to architect
- **Client architect view:** List of assets needing assessment with direct "Start" links
- **Client CXO view:** Read-only overview of ingestion status — counts only, no edit access

---

## Sprint 2 — Phase 2 & 3 Placeholders

> Goal: these phases are locked but must look intentional, not broken. Give users clarity on what's coming and what unlocks them.

### 2.1 — Analyze placeholder page

**File:** `src/components/AnalyzePlaceholder.tsx` (new)

A polished holding page for the Analyze tab:

```
[ Lock icon ] Phase 2 — Analyze

This phase begins once Phase 1 (Discover) is approved by your StratifyIT architect.

What happens here:
  · AI engine scores each asset against modernization, risk, and business fit criteria
  · Capability gaps are mapped across your portfolio
  · Dependency clusters and risk zones are identified
  · Your architect validates and publishes the analysis

Current status: [Phase 1 in progress — X% complete]

[ View Phase 1 progress → ]
```

- If phase is already 2 (for future use), show a "Analysis in progress" spinner state
- No functional buttons — informational only
- Visible to all roles; content slightly varies (admin sees more detail)

---

### 2.2 — Recommend & Transform placeholder page

**File:** `src/components/RecommendPlaceholder.tsx` (new)

Same pattern as Analyze placeholder:

```
[ Lock icon ] Phase 3 — Recommend & Transform

Available after Phase 2 analysis is complete and validated.

What you'll find here:
  · Asset scorecards with rationalization scores
  · 6R disposition recommendations (Retain / Retire / Rehost / Replatform / Refactor / Replace)
  · Current state and target state architecture diagrams
  · Technology roadmap: short-term (0–6 months), medium-term (6–18 months), long-term (18+ months)
  · Executive summary report for CXO review and sign-off

Current status: [Waiting for Phase 2]
```

---

### 2.3 — Nav lock enforcement

**File:** `src/components/Navigation.tsx` (update from Sprint 0)

Wire the phase lock to `PhaseContext`:

```tsx
// Analyze tab: disabled if currentPhase < 2
// Recommend tab: disabled if currentPhase < 3
// Show tooltip on hover: "Complete Phase 1 to unlock"
```

---

## Part 3 — Execution Order for CC Sessions

Run these in order. Each is a self-contained CC session.

```
Session 1:  Sprint 0.3 — PhaseContext + DB migration (add current_phase to client_orgs)
Session 2:  Sprint 0.1 — Dashboard redesign (phase-aware cards)
Session 3:  Sprint 0.2 + 0.4 — Navigation restructure + Header phase badge
Session 4:  Sprint 1.1 — AssessmentRunner component + DB migration (sessions + responses)
Session 5:  Sprint 1.2 — Wire AssessmentRunner into AssessmentsDashboard
Session 6:  Sprint 1.3 — Per-asset assessment in AssetInventory
Session 7:  Sprint 1.4 — CapabilityMapper component + DB migration
Session 8:  Sprint 1.5 — Phase1Progress tracker + approval flow
Session 9:  Sprint 1.6 — DiscoverLanding page (ties it all together)
Session 10: Sprint 2.1 — AnalyzePlaceholder page
Session 11: Sprint 2.2 — RecommendPlaceholder page
Session 12: Sprint 2.3 — Wire nav locks to PhaseContext
```

---

## Part 4 — Files Not to Touch

These are stable and working. Don't modify unless a session specifically requires it.

- `src/contexts/AuthContext.tsx` — auth is solid
- `src/lib/supabase.ts` — client config
- `supabase/stratify_rls_*.sql` — RLS policies (only add new tables' policies, never modify existing)
- `src/components/LoginForm.tsx` — working
- `src/components/ClientManagement.tsx` — working
- `src/services/assetService.ts` — working (only extend, don't rewrite)

---

## Part 5 — Deferred (post Phase 2/3 design decisions)

These are explicitly out of scope until the AI engine and deliverable formats are decided:

- AI analysis pipeline and scoring model
- Score storage schema and override panel
- 6R disposition data model and assignment UI
- Asset scorecard template
- Rationalization report generator
- Architecture diagram canvas
- Technology roadmap builder
- CXO approval workflow
- PDF/PPTX export
- `pa_categories` and `pa_assessments` tables (Portfolio Analysis service) — exists but not wired to the phase model yet; revisit in Phase 2 planning
