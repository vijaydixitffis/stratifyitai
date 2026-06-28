# Track B — StratifyIT.ai: Consume the AssessPro API
**Product:** StratifyIT.ai  
**Goal:** Wire StratifyIT.ai to the AssessPro REST API so clients can run assessments natively inside StratifyIT, trigger AI-powered portfolio rationalization, and view a live Strategy Insights dashboard — completing the full MVP1 demo loop.  
**Duration:** 4 weeks (parallel to Track A)  
**Stack:** React 18 + TypeScript · Vite · Tailwind CSS · Supabase (PostgreSQL + Auth + Edge Functions) · Recharts · Anthropic Claude API  
**Prerequisite:** Track A Week 1 must be complete before Week 2 starts (API key needed). Track A Week 3 must be complete before Week 3 starts (submission + webhook endpoints needed).

---

## Context: What Exists Today vs What Needs to Be Built

### Currently working in StratifyIT.ai
| Component | File | Status |
|-----------|------|--------|
| 3-factor login (orgCode + email + password) | `src/contexts/AuthContext.tsx` | ✅ Done |
| Navigation (dashboard, assets, assessments, analytics, clients, reports, settings) | `src/components/Navigation.tsx` | ✅ Done |
| Asset Inventory CRUD + bulk upload | `src/components/AssetInventory.tsx` | ✅ Done |
| Assessment catalog UI (categories + pa_assessments) | `src/components/AssessmentsDashboard.tsx` | ✅ Done — but "Start" goes nowhere |
| Client Management (org onboarding, user creation) | `src/components/ClientManagement.tsx` | ✅ Done |
| Dashboard stat cards (total, active, high criticality, deprecated) | `src/components/Dashboard.tsx` | ✅ Done — no charts |
| Strategy Insights tab | `src/App.tsx` line ~analytics case | ❌ "coming soon" placeholder |
| Reports tab | `src/App.tsx` line ~reports case | ❌ "coming soon" placeholder |

### StratifyIT.ai database tables (Supabase)
```
users            id, email, name, role, org_id, org_code, organization
client_orgs      org_id, org_code, org_name, sector, description
it_assets        id, name, type, category, description, owner, status,
                 criticality, tags, metadata (JSONB), org_id, created_at
it_asset_uploads id, asset_id, file_url, org_id, uploaded_by, uploaded_at
pa_categories    id, category_id, title, description, icon, color, sort_order
pa_assessments   id, assessment_id, category_id, name, description, duration,
                 complexity, status, sort_order
```

### New tables to add in StratifyIT.ai Supabase (this track builds these)
```
assessment_assignments_cache   local cache of AssessPro assignments
assessment_results_cache       local cache of AssessPro submission results
ai_analyses                    Claude API output per org per assessment
roadmap_items                  prioritised transformation initiatives
```

---

## Guiding Principles for this Track

1. **Never access AssessPro's Supabase database directly.** All AssessPro data flows through the REST API only. This enforces the clean product boundary.
2. **Assessment-taking UI is built natively in StratifyIT.** Clients never leave StratifyIT.ai to answer questions. The UI calls AssessPro API to fetch questions and post answers.
3. **All AssessPro API calls go through a typed service layer** (`src/services/assessProApiClient.ts`). Components never call `fetch()` directly against AssessPro endpoints.
4. **Webhook endpoint receives the completed assessment scores and triggers Claude automatically.** No admin needs to manually kick off AI analysis.
5. **Org context is always explicit.** Every API call passes the org_code from `useAuth().user.orgCode`. Never assume or derive it.
6. **Existing components are modified minimally.** `AssessmentsDashboard.tsx` gets a new "Start Assessment" flow wired in. `App.tsx` analytics placeholder is replaced with a real component. Nothing else in the existing nav/auth/asset flow changes.

---

## Environment Variables to Add

Add to `.env` (and Supabase Edge Function secrets):

```bash
# AssessPro API
VITE_ASSESSPRO_API_BASE_URL=https://<assesspro-project-ref>.supabase.co/functions/v1
VITE_ASSESSPRO_API_KEY=ap_live_<your-32-char-key>          # generated in Track A Week 1

# Anthropic Claude API (used in Supabase Edge Function only — never in frontend)
ANTHROPIC_API_KEY=sk-ant-...                                # set as Supabase secret

# Webhook secret (must match what was registered with AssessPro)
ASSESSPRO_WEBHOOK_SECRET=<shared-secret>                    # set as Supabase secret
```

> **Security note:** `VITE_ASSESSPRO_API_KEY` is a read-only catalog key (scope: `read`). The write-scope key used for creating assignments and submissions must only be held server-side in the Supabase Edge Function environment, not in the Vite frontend bundle.

---

## New Files to Create

```
src/
├── services/
│   └── assessProApiClient.ts          # Typed API client for all AssessPro endpoints
├── components/
│   ├── AssessmentLauncher.tsx         # Admin: assign assessment to org
│   ├── AssessmentRunner.tsx           # Client: take assessment (Q&A UI)
│   ├── AssessmentResults.tsx          # Score summary after completion
│   ├── MyAssessments.tsx              # Client: list of assigned assessments
│   ├── StrategyInsightsDashboard.tsx  # Replaces "coming soon" analytics tab
│   ├── RationalizationView.tsx        # Per-asset Retain/Replace/Retire table
│   └── RoadmapView.tsx                # Prioritised transformation initiatives
├── types/
│   └── assessPro.ts                   # TypeScript types for AssessPro API responses
└── hooks/
    └── useAssessProApi.ts             # React hooks wrapping the API client

supabase/
├── migrations/
│   └── 20250802000000_add_assessment_integration.sql
└── functions/
    ├── webhook-assesspro/
    │   └── index.ts                   # Receives completion webhook from AssessPro
    └── ai-rationalization/
        └── index.ts                   # Calls Claude API, stores ai_analyses
```

---

## Database Migration

Create: `supabase/migrations/20250802000000_add_assessment_integration.sql`

```sql
-- Migration: Assessment integration + AI analysis tables
-- Track B Week 1

BEGIN;

-- 1. Cache of AssessPro assignments scoped to this org
--    (source of truth is AssessPro DB; this is a local projection for fast UI rendering)
CREATE TABLE IF NOT EXISTS public.assessment_assignments_cache (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assesspro_assign_id TEXT NOT NULL UNIQUE,   -- ID from AssessPro's assessment_assignments
  org_id              INTEGER NOT NULL REFERENCES public.client_orgs(org_id),
  org_code            TEXT NOT NULL,
  assesspro_assess_id TEXT NOT NULL,          -- AssessPro assessment UUID
  pa_assessment_id    TEXT,                   -- FK to local pa_assessments.assessment_id (nullable — not all match)
  assessment_title    TEXT NOT NULL,
  assigned_to_user_id UUID REFERENCES public.users(id),
  assigned_by_user_id UUID REFERENCES public.users(id),
  status              TEXT DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED','STARTED','COMPLETED')),
  due_date            TIMESTAMPTZ,
  assigned_at         TIMESTAMPTZ DEFAULT NOW(),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_aac_org_id   ON public.assessment_assignments_cache(org_id);
CREATE INDEX idx_aac_user_id  ON public.assessment_assignments_cache(assigned_to_user_id);
CREATE INDEX idx_aac_status   ON public.assessment_assignments_cache(status);

-- 2. Cache of AssessPro submission results (written by webhook handler)
CREATE TABLE IF NOT EXISTS public.assessment_results_cache (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assesspro_sub_id     TEXT NOT NULL UNIQUE,  -- AssessPro submission UUID
  assignment_cache_id  UUID REFERENCES public.assessment_assignments_cache(id),
  org_id               INTEGER NOT NULL REFERENCES public.client_orgs(org_id),
  org_code             TEXT NOT NULL,
  assesspro_assess_id  TEXT NOT NULL,
  assessment_title     TEXT,
  total_score          INTEGER,
  max_score            INTEGER,
  percentage           INTEGER,
  topic_scores         JSONB,   -- array of { topic_id, topic_title, topic_icon, score, max_score, percentage }
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_arc_org_id ON public.assessment_results_cache(org_id);
CREATE INDEX idx_arc_assess ON public.assessment_results_cache(assesspro_assess_id);

-- 3. AI analysis output (written by ai-rationalization Edge Function)
CREATE TABLE IF NOT EXISTS public.ai_analyses (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  INTEGER NOT NULL REFERENCES public.client_orgs(org_id),
  org_code                TEXT NOT NULL,
  result_cache_id         UUID REFERENCES public.assessment_results_cache(id),
  assesspro_sub_id        TEXT,
  asset_snapshot          JSONB NOT NULL,   -- snapshot of it_assets at time of analysis
  rationalization_results JSONB,            -- per-asset { asset_id, name, type, disposition, confidence, rationale }
  summary_text            TEXT,             -- AI narrative paragraph
  ai_model                TEXT DEFAULT 'claude-sonnet-4-20250514',
  prompt_version          TEXT DEFAULT 'v1',
  status                  TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  error_message           TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_org_id ON public.ai_analyses(org_id);
CREATE INDEX idx_ai_status ON public.ai_analyses(status);

-- 4. AI-generated roadmap items (child of ai_analyses)
CREATE TABLE IF NOT EXISTS public.roadmap_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id      UUID NOT NULL REFERENCES public.ai_analyses(id) ON DELETE CASCADE,
  org_id           INTEGER NOT NULL REFERENCES public.client_orgs(org_id),
  title            TEXT NOT NULL,
  description      TEXT,
  initiative_type  TEXT,          -- e.g. "Retire", "Replace", "Consolidate", "Modernise", "Retain"
  effort           TEXT,          -- "Low" | "Medium" | "High"
  impact           TEXT,          -- "Low" | "Medium" | "High"
  priority_score   INTEGER,       -- 1–10 computed by AI
  affected_assets  TEXT[],        -- array of asset names
  time_horizon     TEXT,          -- "0-3 months" | "3-6 months" | "6-12 months" | "12+ months"
  status           TEXT DEFAULT 'open' CHECK (status IN ('open','in-progress','completed','deferred')),
  sequence_number  INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ri_analysis_id ON public.roadmap_items(analysis_id);
CREATE INDEX idx_ri_org_id      ON public.roadmap_items(org_id);
CREATE INDEX idx_ri_priority    ON public.roadmap_items(priority_score DESC);

-- 5. RLS policies (mirror existing StratifyIT patterns)

ALTER TABLE public.assessment_assignments_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_full_access_aac" ON public.assessment_assignments_cache
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')));
CREATE POLICY "client_org_access_aac" ON public.assessment_assignments_cache
  FOR ALL TO authenticated
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

ALTER TABLE public.assessment_results_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_full_access_arc" ON public.assessment_results_cache
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')));
CREATE POLICY "client_org_access_arc" ON public.assessment_results_cache
  FOR ALL TO authenticated
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_full_access_ai" ON public.ai_analyses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')));
CREATE POLICY "client_org_access_ai" ON public.ai_analyses
  FOR ALL TO authenticated
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_full_access_ri" ON public.roadmap_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','admin-super')));
CREATE POLICY "client_org_access_ri" ON public.roadmap_items
  FOR ALL TO authenticated
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

COMMIT;
```

---

## Week 1 — API Client + Schema Foundation

**Deliverable:** AssessPro API client is built and tested. Migration is applied. The assessment catalog in StratifyIT fetches real data from AssessPro (read-only). No UI flow changes yet.

### Task 1.1 — Run the migration

```bash
supabase db push
# Verify: assessment_assignments_cache, assessment_results_cache, ai_analyses, roadmap_items exist
```

### Task 1.2 — TypeScript types for AssessPro API

Create `src/types/assessPro.ts`:

```typescript
// src/types/assessPro.ts

export interface APAssessment {
  id: string;
  title: string;
  description: string;
  topic_count: number;
}

export interface APTopic {
  id: string;
  title: string;
  description: string;
  sequence_number: number;
  icon: string;           // Lucide icon name, e.g. "Database"
  question_count: number;
}

export interface APAnswer {
  id: string;
  text: string;
  marks: number;
  // NOTE: is_correct is never present — AssessPro API intentionally omits it
}

export interface APQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'yes_no' | 'free_text';
  sequence_number: number;
  answers: APAnswer[];
}

export interface APAssignment {
  id: string;
  assessment_id: string;
  user_id: string;
  status: 'ASSIGNED' | 'STARTED' | 'COMPLETED';
  scope: string;          // org_code
  assigned_at: string;
  due_date: string | null;
  assessments: { id: string; title: string; description: string };
}

export interface APSubmission {
  id: string;
  assignment_id: string;
  assessment_id: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  started_at: string;
  completed_at: string | null;
}

export interface APTopicScore {
  topic_id: string;
  topic_title: string;
  topic_icon: string;
  score: number;
  max_score: number;
  percentage: number;
}

export interface APResult {
  submission_id: string;
  assessment_id: string;
  assessment_title: string;
  org_code: string;
  status: string;
  total_score: number;
  max_score: number;
  percentage: number;
  started_at: string;
  completed_at: string;
  topic_scores: APTopicScore[];
  answer_detail: {
    question: string;
    question_type: string;
    chosen_answer: string;
    marks_earned: number;
  }[];
}

export interface APWebhookPayload {
  event: 'submission.completed';
  fired_at: string;
  submission_id: string;
  assessment_id: string;
  org_code: string;
  total_score: number;
  max_score: number;
  percentage: number;
  completed_at: string;
  topic_scores: APTopicScore[];
}
```

### Task 1.3 — AssessPro API client service

Create `src/services/assessProApiClient.ts`:

```typescript
// src/services/assessProApiClient.ts
import type {
  APAssessment, APTopic, APQuestion, APAssignment,
  APSubmission, APResult
} from '../types/assessPro';

const BASE_URL = import.meta.env.VITE_ASSESSPRO_API_BASE_URL as string;

// Read-only key for catalog (safe in frontend)
const READ_KEY  = import.meta.env.VITE_ASSESSPRO_API_KEY as string;

class AssessProApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'AssessProApiError';
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  apiKey = READ_KEY
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(options.headers ?? {}),
    },
  });

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new AssessProApiError(
      res.status,
      body.error?.code ?? 'ERROR',
      body.error?.message ?? 'AssessPro API error'
    );
  }
  return body.data as T;
}

// ─── Catalog ────────────────────────────────────────────────────────────────

export async function listAssessments(): Promise<APAssessment[]> {
  return apiFetch<APAssessment[]>('/api-assessments');
}

export async function getAssessmentTopics(assessmentId: string): Promise<APTopic[]> {
  return apiFetch<APTopic[]>(`/api-topics?assessment_id=${assessmentId}`);
}

export async function getTopicQuestions(topicId: string): Promise<APQuestion[]> {
  return apiFetch<APQuestion[]>(`/api-topics/${topicId}/questions`);
}

// ─── Assignments (write operations — proxied through StratifyIT Edge Function) ─

// These are called from StratifyIT's own Edge Functions, not directly from the
// browser, so the write-scope API key stays server-side.
// The frontend calls the StratifyIT proxy endpoints below:

export async function getMyAssignments(orgCode: string): Promise<APAssignment[]> {
  return apiFetch<APAssignment[]>(`/api-assignments?scope=${orgCode}`);
}

// ─── Submissions ─────────────────────────────────────────────────────────────

// startSubmission, saveAnswers, completeSubmission are proxied through
// StratifyIT's Edge Function (to keep write API key server-side).
// Defined here for documentation; actual calls go to /functions/v1/proxy-assesspro

export async function getSubmission(submissionId: string): Promise<APSubmission> {
  return apiFetch<APSubmission>(`/api-submissions/${submissionId}`);
}

export async function getResult(submissionId: string): Promise<APResult> {
  return apiFetch<APResult>(`/api-results/${submissionId}`);
}
```

### Task 1.4 — Verify catalog data flows into existing AssessmentsDashboard

The existing `AssessmentsDashboard.tsx` loads from `pa_categories` and `pa_assessments` (StratifyIT's own Supabase). This is fine and should remain — those categories and metadata stay local.

What changes: when a user clicks "Start Assessment" on a `pa_assessment`, StratifyIT needs to match it to an AssessPro assessment. Add a `assesspro_assessment_id` column to `pa_assessments`:

```sql
-- Run in Supabase SQL editor (or add to migration):
ALTER TABLE public.pa_assessments
  ADD COLUMN IF NOT EXISTS assesspro_assessment_id TEXT;

-- Then populate it by mapping titles:
-- UPDATE public.pa_assessments
-- SET assesspro_assessment_id = '<UUID from GET /api-assessments>'
-- WHERE assessment_id = 'cloud-readiness';
```

Add a mapping script to populate this once Track A Week 2 is complete:

```bash
# scripts/map_assessments.ts (run with deno or ts-node)
# 1. Calls GET /api-assessments on AssessPro
# 2. Fuzzy-matches title to pa_assessments.name
# 3. Prints UPDATE SQL to run manually
```

**Week 1 acceptance test:**
```bash
# In browser console after login:
import { listAssessments } from './services/assessProApiClient';
const a = await listAssessments();
console.log(a); // Should show 8 assessments from AssessPro
```

---

## Week 2 — Assignment Launcher + Assessment Runner UI

**Prerequisite:** Track A Week 3 complete (assignment + submission API live).

**Deliverable:** Admin can assign an assessment to a client org. Client user sees it in "My Assessments" and can take the full questionnaire inside StratifyIT. Answers are saved in real time.

### Task 2.1 — StratifyIT proxy Edge Function for write operations

Create `supabase/functions/proxy-assesspro/index.ts`.

This Edge Function holds the **write-scope AssessPro API key** server-side. The browser calls this function (authenticated with the user's Supabase JWT), and the function forwards to AssessPro.

```typescript
// supabase/functions/proxy-assesspro/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AP_BASE    = Deno.env.get("ASSESSPRO_API_BASE_URL")!;
const AP_WRITE_KEY = Deno.env.get("ASSESSPRO_API_WRITE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // Validate caller is an authenticated StratifyIT user
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
  }

  // Get user's org_code
  const { data: profile } = await supabase
    .from("users").select("org_code, org_id, role").eq("id", user.id).single();
  if (!profile) return new Response(JSON.stringify({ error: "Profile not found" }), { status: 403, headers: CORS });

  const body = await req.json();
  const { action, payload } = body; // action = "create_assignment" | "start_submission" | "save_answers" | "complete_submission"

  let apPath = "";
  let apMethod = "POST";
  let apBody: unknown = {};

  switch (action) {
    case "create_assignment":
      // Admin only
      if (!profile.role.startsWith("admin")) {
        return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: CORS });
      }
      apPath = "/api-assignments";
      apBody = {
        assessment_id: payload.assessment_id,
        user_ids: payload.user_ids,
        due_date: payload.due_date ?? null,
      };
      break;

    case "start_submission":
      apPath = "/api-submissions";
      apBody = { assignment_id: payload.assignment_id, user_id: user.id };
      break;

    case "save_answers":
      apPath = `/api-submissions/${payload.submission_id}/answers`;
      apBody = { answers: payload.answers };
      break;

    case "complete_submission":
      apPath = `/api-submissions/${payload.submission_id}/complete`;
      apBody = {};
      break;

    default:
      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: CORS });
  }

  // Forward to AssessPro
  const apRes = await fetch(`${AP_BASE}${apPath}`, {
    method: apMethod,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AP_WRITE_KEY}`,
    },
    body: JSON.stringify(apBody),
  });

  const apData = await apRes.json();

  // On create_assignment success: cache it in StratifyIT's DB
  if (action === "create_assignment" && apRes.ok && apData.success) {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const rows = apData.data.map((a: { id: string; assessment_id: string }) => ({
      assesspro_assign_id: a.id,
      org_id: payload.org_id,
      org_code: payload.org_code,
      assesspro_assess_id: a.assessment_id,
      assessment_title: payload.assessment_title,
      assigned_to_user_id: payload.user_ids[0] ?? null,
      assigned_by_user_id: user.id,
      status: "ASSIGNED",
      due_date: payload.due_date ?? null,
    }));
    await supabaseAdmin.from("assessment_assignments_cache").insert(rows);
  }

  return new Response(JSON.stringify(apData), {
    status: apRes.status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
});
```

### Task 2.2 — `AssessmentLauncher.tsx` (Admin component)

**File:** `src/components/AssessmentLauncher.tsx`

This is a modal/panel opened from the admin's `AssessmentsDashboard` when they click "Assign" on an assessment card.

```typescript
// Props:
interface AssessmentLauncherProps {
  paAssessmentId: string;       // local pa_assessments.assessment_id
  assessmentTitle: string;
  assessproAssessmentId: string; // AssessPro UUID
  onClose: () => void;
  onAssigned: () => void;
}
```

**UI elements:**
1. **Org selector** — dropdown of `client_orgs` (fetched from StratifyIT's Supabase). Currently selected org if admin has a selectedOrg context.
2. **User selector** — multi-select of users in the chosen org (`users` table filtered by `org_id`).
3. **Due date** — optional date picker.
4. **Assign button** — calls `proxy-assesspro` Edge Function with `action: "create_assignment"`.

```typescript
const handleAssign = async () => {
  setLoading(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-assesspro`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: "create_assignment",
          payload: {
            assessment_id: assessproAssessmentId,
            assessment_title: assessmentTitle,
            user_ids: selectedUserIds,
            org_id: selectedOrgId,
            org_code: selectedOrgCode,
            due_date: dueDate || null,
          },
        }),
      }
    );
    if (!res.ok) throw new Error("Assignment failed");
    onAssigned();
  } catch (e) {
    setError("Failed to assign assessment. Please try again.");
  } finally {
    setLoading(false);
  }
};
```

**Wire into `AssessmentsDashboard.tsx`:** Add an "Assign" button to each assessment card, visible only when `isAdmin`. Clicking opens `AssessmentLauncher` modal.

### Task 2.3 — `MyAssessments.tsx` (Client component)

**File:** `src/components/MyAssessments.tsx`

Client users see this panel inside the Portfolio Analysis tab (below the existing category grid).

Fetches from `assessment_assignments_cache` (StratifyIT's Supabase) filtered by `assigned_to_user_id = auth.uid()`.

```typescript
// Status badge colours:
// ASSIGNED  → blue   "Ready to start"
// STARTED   → amber  "In progress"
// COMPLETED → green  "Completed"

// Each row shows:
// Assessment title | Assigned by | Due date | Status badge | Action button

// Action button:
// ASSIGNED  → "Start"    → opens AssessmentRunner
// STARTED   → "Continue" → opens AssessmentRunner (resumes)
// COMPLETED → "View Results" → opens AssessmentResults
```

### Task 2.4 — `AssessmentRunner.tsx` (Client component)

This is the full questionnaire-taking UI. It is the most complex component in Track B.

**File:** `src/components/AssessmentRunner.tsx`

```typescript
interface AssessmentRunnerProps {
  assignment: {
    assesspro_assign_id: string;
    assesspro_assess_id: string;
    assessment_title: string;
  };
  onComplete: (submissionId: string) => void;
  onClose: () => void;
}
```

**State machine:**
```
LOADING_TOPICS
  → topics fetched via listAssessmentTopics(assessmentId)
STARTING_SUBMISSION
  → POST proxy-assesspro action:"start_submission"
  → submissionId stored in component state
ANSWERING (topicIndex: 0..n, questionIndex: 0..m)
  → renders current question + answers
  → on answer select: adds to local answersBuffer
  → auto-save every 30s or on topic change: POST proxy-assesspro action:"save_answers"
COMPLETING
  → POST proxy-assesspro action:"complete_submission"
  → update assignment_cache status to COMPLETED
DONE
  → triggers onComplete(submissionId)
```

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ [← Back]  Cloud Readiness Assessment        3 of 8 topics│
├──────────┬──────────────────────────────────────────────┤
│ Topic    │  Q4: How is your data currently backed up?    │
│ Sidebar  │                                               │
│          │  ○ Automated daily backups to offsite storage │
│ 1. Infra │  ○ Manual weekly backups                      │
│ 2. Data  │  ○ No formal backup process                   │
│ 3. ✓ Net │  ○ Real-time replication                      │
│ 4. App   │                                               │
│ ...      │  [Previous]           Question 4 of 12 [Next] │
└──────────┴──────────────────────────────────────────────┘
```

**Key implementation details:**

```typescript
// Auto-save buffer — flush every 30s and on topic navigation
const answersBuffer = useRef<{ question_id: string; answer_id?: string; text_answer?: string }[]>([]);

const flushAnswers = async () => {
  if (!submissionId || answersBuffer.current.length === 0) return;
  await proxyPost("save_answers", {
    submission_id: submissionId,
    answers: answersBuffer.current,
  });
  // Don't clear buffer — AssessPro upserts, so duplicates are safe
};

// On question answer
const handleAnswer = (questionId: string, answerId: string) => {
  setLocalAnswers(prev => ({ ...prev, [questionId]: answerId }));
  answersBuffer.current = answersBuffer.current
    .filter(a => a.question_id !== questionId)
    .concat({ question_id: questionId, answer_id: answerId });
};

// Free text questions
const handleTextAnswer = (questionId: string, text: string) => {
  setLocalAnswers(prev => ({ ...prev, [questionId]: text }));
  answersBuffer.current = answersBuffer.current
    .filter(a => a.question_id !== questionId)
    .concat({ question_id: questionId, text_answer: text });
};
```

**Progress indicator:** Show completed questions per topic in the sidebar. A topic is "complete" when all its questions have a local answer. Do not require all topics to be answered before the user can click "Complete Assessment" — partial submissions are valid.

**"Complete Assessment" button:** Only shown on the last topic. Calls `flushAnswers()` first, then `action:"complete_submission"`, then `onComplete(submissionId)`.

**Week 2 acceptance test:**
1. Admin logs in → Portfolio Analysis → clicks "Assign" on "Cloud Readiness Assessment" → selects Bajaj Broking org + user → sets due date → clicks Assign → success toast.
2. Client user (Bajaj Broking) logs in → Portfolio Analysis → sees "My Assessments" section with the assignment in ASSIGNED status.
3. Client clicks "Start" → `AssessmentRunner` opens → first topic loads with real questions from AssessPro API.
4. Client answers 3 questions → navigates to next topic → answers save (verify in AssessPro DB).
5. Client completes all topics → clicks "Complete Assessment" → status updates to COMPLETED.

---

## Week 3 — Webhook Handler + Claude AI Rationalization

**Prerequisite:** Track A Week 4 complete (webhook system live).

**Deliverable:** When a client completes an assessment, AssessPro fires a webhook to StratifyIT. StratifyIT receives it, validates the HMAC signature, caches the result, and triggers Claude API to produce rationalization scores and a roadmap. Results are stored in `ai_analyses` and `roadmap_items`.

### Task 3.1 — Webhook receiver Edge Function

**File:** `supabase/functions/webhook-assesspro/index.ts`

```typescript
// supabase/functions/webhook-assesspro/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("ASSESSPRO_WEBHOOK_SECRET")!;

serve(async (req) => {
  // 1. Verify HMAC signature
  const signature = req.headers.get("X-AssessPro-Signature") ?? "";
  const rawBody = await req.text();

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expectedSig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expectedHex = "sha256=" + Array.from(new Uint8Array(expectedSig))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  if (signature !== expectedHex) {
    console.error("Webhook signature mismatch");
    return new Response("Forbidden", { status: 403 });
  }

  const payload = JSON.parse(rawBody);

  if (payload.event !== "submission.completed") {
    return new Response("OK", { status: 200 }); // Acknowledge but ignore unknown events
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 2. Find matching org by org_code
  const { data: org } = await supabase
    .from("client_orgs")
    .select("org_id, org_code")
    .eq("org_code", payload.org_code)
    .single();

  if (!org) {
    console.error("Unknown org_code in webhook:", payload.org_code);
    return new Response("OK", { status: 200 }); // Don't 404 — acknowledge to prevent retry storms
  }

  // 3. Cache the result
  const { data: resultRow } = await supabase
    .from("assessment_results_cache")
    .upsert({
      assesspro_sub_id: payload.submission_id,
      org_id: org.org_id,
      org_code: org.org_code,
      assesspro_assess_id: payload.assessment_id,
      total_score: payload.total_score,
      max_score: payload.max_score,
      percentage: payload.percentage,
      topic_scores: payload.topic_scores,
      completed_at: payload.completed_at,
    }, { onConflict: "assesspro_sub_id" })
    .select()
    .single();

  // 4. Update assignment cache status
  await supabase
    .from("assessment_assignments_cache")
    .update({ status: "COMPLETED", completed_at: payload.completed_at })
    .eq("assesspro_assess_id", payload.assessment_id)
    .eq("org_code", org.org_code)
    .eq("status", "STARTED");

  // 5. Create a pending ai_analyses record
  const { data: analysisRow } = await supabase
    .from("ai_analyses")
    .insert({
      org_id: org.org_id,
      org_code: org.org_code,
      result_cache_id: resultRow?.id,
      assesspro_sub_id: payload.submission_id,
      asset_snapshot: [],      // filled by ai-rationalization function
      status: "pending",
    })
    .select()
    .single();

  // 6. Trigger ai-rationalization Edge Function (async, don't await)
  fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-rationalization`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        analysis_id: analysisRow?.id,
        org_id: org.org_id,
        org_code: org.org_code,
        topic_scores: payload.topic_scores,
        assessment_title: payload.assessment_title ?? "",
        submission_id: payload.submission_id,
        percentage: payload.percentage,
      }),
    }
  ).catch(e => console.error("Failed to trigger ai-rationalization:", e));

  return new Response("OK", { status: 200 });
});
```

**Register this webhook URL with AssessPro** (one-time setup, run after deploying):

```bash
curl -X POST https://<assesspro>.supabase.co/functions/v1/api-webhooks/register \
  -H "Authorization: Bearer ap_live_<write-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "target_url": "https://<stratifyit>.supabase.co/functions/v1/webhook-assesspro",
    "events": ["submission.completed"],
    "secret": "<shared-secret>"
  }'
```

### Task 3.2 — AI Rationalization Edge Function

**File:** `supabase/functions/ai-rationalization/index.ts`

This is the intelligence core of StratifyIT.ai. It:
1. Loads the org's `it_assets` from Supabase
2. Constructs a structured prompt combining asset inventory + assessment topic scores
3. Calls Claude API (claude-sonnet-4-20250514) with a JSON-only output instruction
4. Parses the response into `rationalization_results` + `roadmap_items`
5. Stores both in Supabase

```typescript
// supabase/functions/ai-rationalization/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const {
    analysis_id, org_id, org_code,
    topic_scores, assessment_title, percentage
  } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Mark as processing
  await supabase.from("ai_analyses")
    .update({ status: "processing" })
    .eq("id", analysis_id);

  try {
    // 1. Load org's assets
    const { data: assets } = await supabase
      .from("it_assets")
      .select("id, name, type, category, status, criticality, description, metadata, tags")
      .eq("org_id", org_id)
      .order("criticality", { ascending: false });

    if (!assets?.length) {
      await supabase.from("ai_analyses")
        .update({ status: "failed", error_message: "No assets found for org" })
        .eq("id", analysis_id);
      return new Response("No assets", { status: 200 });
    }

    // 2. Build prompt
    const prompt = buildRationalizationPrompt(assets, topic_scores, assessment_title, percentage);

    // 3. Call Claude API
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text ?? "";

    // 4. Parse JSON (Claude is instructed to return only JSON)
    const clean = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as {
      summary: string;
      asset_dispositions: {
        asset_id: string;
        asset_name: string;
        asset_type: string;
        disposition: "Retain" | "Replace" | "Retire" | "Consolidate" | "Modernise";
        confidence: "High" | "Medium" | "Low";
        rationale: string;
      }[];
      roadmap: {
        title: string;
        description: string;
        initiative_type: string;
        effort: "Low" | "Medium" | "High";
        impact: "Low" | "Medium" | "High";
        priority_score: number;
        affected_assets: string[];
        time_horizon: string;
      }[];
    };

    // 5. Update ai_analyses
    await supabase.from("ai_analyses").update({
      asset_snapshot: assets,
      rationalization_results: parsed.asset_dispositions,
      summary_text: parsed.summary,
      status: "completed",
      updated_at: new Date().toISOString(),
    }).eq("id", analysis_id);

    // 6. Insert roadmap items
    const roadmapRows = parsed.roadmap.map((item, idx) => ({
      analysis_id,
      org_id,
      title: item.title,
      description: item.description,
      initiative_type: item.initiative_type,
      effort: item.effort,
      impact: item.impact,
      priority_score: item.priority_score,
      affected_assets: item.affected_assets,
      time_horizon: item.time_horizon,
      sequence_number: idx + 1,
    }));

    await supabase.from("roadmap_items").insert(roadmapRows);

    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("AI rationalization failed:", err);
    await supabase.from("ai_analyses").update({
      status: "failed",
      error_message: String(err),
    }).eq("id", analysis_id);
    return new Response("Error", { status: 500 });
  }
});
```

### Task 3.3 — Claude prompt engineering

**File:** `supabase/functions/ai-rationalization/prompt.ts`

```typescript
export function buildRationalizationPrompt(
  assets: Asset[],
  topicScores: TopicScore[],
  assessmentTitle: string,
  overallPercentage: number
): string {
  const assetList = assets.map(a =>
    `- ${a.name} | Type: ${a.type} | Category: ${a.category ?? "N/A"} ` +
    `| Status: ${a.status} | Criticality: ${a.criticality} ` +
    `| Notes: ${a.description ?? ""} ` +
    `| EOL: ${(a.metadata as Record<string, string>)?.end_of_life ?? "Unknown"}`
  ).join("\n");

  const topicList = topicScores.map(t =>
    `- ${t.topic_title}: ${t.score}/${t.max_score} (${t.percentage}%)`
  ).join("\n");

  return `You are an enterprise IT architect advising a BFSI or retail technology organization.
You have been given their IT asset inventory and the results of their "${assessmentTitle}" assessment (overall score: ${overallPercentage}%).

ASSESSMENT TOPIC SCORES:
${topicList}

IT ASSET INVENTORY:
${assetList}

Based on the assessment scores and asset inventory, produce a rationalization analysis.
Use the following dispositions: Retain, Replace, Retire, Consolidate, Modernise.

CRITICAL: Respond ONLY with a valid JSON object. No preamble, no explanation, no markdown fences.

The JSON must have exactly this structure:
{
  "summary": "<2-3 sentence executive summary of the portfolio health and top priorities>",
  "asset_dispositions": [
    {
      "asset_id": "<asset id from inventory>",
      "asset_name": "<asset name>",
      "asset_type": "<asset type>",
      "disposition": "Retain|Replace|Retire|Consolidate|Modernise",
      "confidence": "High|Medium|Low",
      "rationale": "<1-2 sentence reasoning tied to assessment scores and asset attributes>"
    }
  ],
  "roadmap": [
    {
      "title": "<initiative title>",
      "description": "<what needs to be done and why>",
      "initiative_type": "Retire|Replace|Consolidate|Modernise|Governance|Process",
      "effort": "Low|Medium|High",
      "impact": "Low|Medium|High",
      "priority_score": <integer 1-10, 10 being highest priority>,
      "affected_assets": ["<asset name>", ...],
      "time_horizon": "0-3 months|3-6 months|6-12 months|12+ months"
    }
  ]
}

Return between 5 and 10 roadmap items. Sort roadmap by priority_score descending.
Do not include any text outside the JSON object.`;
}
```

**Week 3 acceptance test:**
1. Client completes an assessment → StratifyIT receives webhook within 5 seconds.
2. `assessment_results_cache` row is created with correct topic scores.
3. `ai_analyses` row transitions: `pending` → `processing` → `completed` within 30 seconds.
4. `rationalization_results` JSONB contains one entry per asset.
5. `roadmap_items` table has 5–10 rows for the org.
6. Verify `ai_analyses.summary_text` is coherent English prose.

---

## Week 4 — Strategy Insights Dashboard + Roadmap View + Results UI

**Deliverable:** The "Strategy Insights" tab is fully functional. Clients see portfolio health charts, AI rationalization per asset, and a prioritised roadmap. The "Analytics" placeholder in `App.tsx` is replaced. `AssessmentResults.tsx` shows post-completion scores.

### Task 4.1 — `AssessmentResults.tsx`

**File:** `src/components/AssessmentResults.tsx`

Shown immediately after `AssessmentRunner` completes (before AI analysis is ready).

```
┌────────────────────────────────────────────────┐
│ ✓ Assessment Complete                           │
│ Cloud Readiness Assessment · Bajaj Broking      │
│                                                 │
│   Overall Score: 73%  ████████░░  87/120        │
│                                                 │
│   Topic Breakdown:                              │
│   Infrastructure        ████████░░  75%         │
│   Data Architecture     █████████░  79%         │
│   Application Landscape ███████░░░  68%         │
│   Network & Security    ████████░░  72%         │
│   ...                                           │
│                                                 │
│   ⏳ AI analysis in progress...                 │
│   [View Strategy Insights] when ready           │
└────────────────────────────────────────────────┘
```

Fetches `assessment_results_cache` by `assesspro_sub_id`. Polls `ai_analyses.status` every 5 seconds; when `completed`, shows "View Strategy Insights" button that navigates to the analytics tab.

```typescript
// Polling hook
const [analysisStatus, setAnalysisStatus] = useState<string>("pending");

useEffect(() => {
  if (analysisStatus === "completed" || analysisStatus === "failed") return;
  const interval = setInterval(async () => {
    const { data } = await supabase
      .from("ai_analyses")
      .select("status")
      .eq("assesspro_sub_id", submissionId)
      .single();
    if (data?.status) setAnalysisStatus(data.status);
  }, 5000);
  return () => clearInterval(interval);
}, [submissionId, analysisStatus]);
```

### Task 4.2 — `StrategyInsightsDashboard.tsx`

**File:** `src/components/StrategyInsightsDashboard.tsx`

This completely replaces the `"coming soon"` placeholder in `src/App.tsx` analytics case.

Install Recharts first: `npm install recharts`

**Dashboard sections:**

#### Section 1 — Portfolio Health Overview (stat cards, already mostly exist in Dashboard.tsx — reuse logic)
```
[Total Assets: 24] [Active: 18] [High Criticality: 7] [Deprecated: 3] [Retiring Soon: 2]
```

#### Section 2 — Asset Distribution Chart (Recharts PieChart)
```typescript
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const ASSET_TYPE_COLORS: Record<string, string> = {
  application:      "#378ADD",
  database:         "#639922",
  infrastructure:   "#534AB7",
  middleware:       "#BA7517",
  "cloud-service":  "#1D9E75",
  "third-party-service": "#E24B4A",
};

// Data: group it_assets by type, count per type
const pieData = Object.entries(assetsByType).map(([type, count]) => ({
  name: type,
  value: count,
}));
```

#### Section 3 — Tech Debt Heatmap (Recharts custom grid or table)
```
Criticality × Status matrix:
             Active   Deprecated  Inactive
High           5          2          1
Medium         8          1          0
Low            5          0          2

Cells coloured by risk: green (active+low) → red (deprecated+high)
```

```typescript
// Built as a styled HTML table with Tailwind colour classes — not a chart
// Clicking a cell filters the asset list below
const getHeatmapColour = (criticality: string, status: string): string => {
  if (criticality === "high" && status === "deprecated") return "bg-red-200 text-red-900";
  if (criticality === "high" && status === "active")     return "bg-orange-100 text-orange-800";
  if (criticality === "medium" && status === "deprecated") return "bg-amber-100 text-amber-800";
  return "bg-green-50 text-green-800";
};
```

#### Section 4 — AI Rationalization Summary
Shows the latest `ai_analyses` row for the org (status = `completed`).

```
┌─────────────────────────────────────────────────────────────┐
│ 🤖 AI Portfolio Analysis  · Completed 2h ago               │
│ Based on: Cloud Readiness Assessment (73%)                  │
│                                                             │
│ "The portfolio shows moderate cloud readiness with          │
│  significant legacy risk concentrated in 3 applications..." │
└─────────────────────────────────────────────────────────────┘
```

#### Section 5 — `RationalizationView.tsx` — per-asset disposition table

**File:** `src/components/RationalizationView.tsx`

```typescript
// Renders ai_analyses.rationalization_results as a sortable table

// Columns: Asset Name | Type | Current Status | AI Disposition | Confidence | Rationale

// Disposition colour badges:
const DISPOSITION_COLOURS: Record<string, string> = {
  Retain:       "bg-green-100 text-green-800",
  Replace:      "bg-blue-100 text-blue-800",
  Retire:       "bg-red-100 text-red-800",
  Consolidate:  "bg-purple-100 text-purple-800",
  Modernise:    "bg-amber-100 text-amber-800",
};

// Confidence icons:
// High   → solid circle
// Medium → half circle
// Low    → outline circle
```

#### Section 6 — `RoadmapView.tsx` — transformation roadmap

**File:** `src/components/RoadmapView.tsx`

Two sub-views toggled by tabs:

**List view** (default):
```
Priority  Title                        Effort  Impact  Horizon     Status
  10      Retire Legacy ERP System      Low     High   0-3 months  Open
   9      Replace Core Banking CBS      High    High   12+ months  Open
   8      Consolidate API Gateways      Medium  High   3-6 months  Open
   ...
```

**Effort vs Impact matrix** (2×2 quadrant chart using Recharts ScatterChart):
```
         Low Impact    High Impact
High     ┌──────────┬─────────────┐
Effort   │  Avoid   │  Plan Last  │
         │          │             │
Low      ├──────────┼─────────────┤
Effort   │ Quick    │  Do First   │
         │ Wins     │             │
         └──────────┴─────────────┘
```

```typescript
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer } from "recharts";

// Encode effort/impact as numbers for scatter plot:
const encodeLevel = (level: string) => ({ Low: 1, Medium: 2, High: 3 }[level] ?? 1);

const scatterData = roadmapItems.map(item => ({
  x: encodeLevel(item.impact),
  y: encodeLevel(item.effort),
  z: item.priority_score * 10,  // bubble size
  name: item.title,
  horizon: item.time_horizon,
}));
```

### Task 4.3 — Wire StrategyInsightsDashboard into App.tsx

Replace the placeholder in `src/App.tsx`:

```typescript
// BEFORE:
case 'analytics':
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Strategy Insights</h2>
        <p className="text-gray-600">Advanced strategic insights and analytics coming soon...</p>
      </div>
    </div>
  );

// AFTER:
case 'analytics':
  return <StrategyInsightsDashboard />;
```

Also update `MyAssessments.tsx` to navigate to the analytics tab on "View Results":
```typescript
// Pass setActiveTab down from App.tsx via props or use a navigation context
onViewResults={() => setActiveTab('analytics')}
```

### Task 4.4 — Admin: Assignment wizard in Client Management

Wire the `AssessmentLauncher` into the admin's client management workflow. In `ClientManagement.tsx`, add an "Assign Assessment" button in the org detail panel that opens `AssessmentLauncher` pre-populated with the selected org.

### Task 4.5 — End-to-end demo script validation

Run through the full demo loop and confirm every step:

```
Step 1:  Admin logs in → Client Management → onboards "Bajaj Broking" org (already exists)
Step 2:  Admin → Portfolio Analysis → selects "Cloud Readiness Assessment"
Step 3:  Admin clicks "Assign" → selects Bajaj Broking → selects client user → sets due date → assigns
Step 4:  Client user logs in → Portfolio Analysis → sees assignment in "My Assessments" (ASSIGNED)
Step 5:  Client clicks "Start" → AssessmentRunner opens → 8 topics load
Step 6:  Client answers all questions (can skip some) → clicks "Complete Assessment"
Step 7:  AssessmentResults shows score breakdown (e.g. 73%)
Step 8:  "AI analysis in progress..." spinner visible
Step 9:  Within 30s → "View Strategy Insights" button appears (analysis complete)
Step 10: Strategy Insights tab → shows asset distribution chart, heatmap, AI summary
Step 11: Rationalization table → every asset has Retain/Replace/Retire/Consolidate/Modernise
Step 12: Roadmap tab → 5-10 prioritised initiatives with effort/impact matrix
```

**Week 4 acceptance criteria:**
- Demo loop completes end-to-end with no manual steps between assessment completion and AI output appearing
- Recharts render correctly for pie chart, heatmap, scatter chart
- Rationalization table is sortable by disposition and confidence
- Roadmap list is sortable by priority score
- Admin can view any org's Strategy Insights by switching org context
- `AssessmentResults` polling resolves correctly and navigates to analytics tab

---

## Component Dependency Map

```
App.tsx
├── Navigation.tsx              (no change)
├── Dashboard.tsx               (no change)
├── AssetInventory.tsx          (no change)
├── AssessmentsDashboard.tsx    (ADD: "Assign" button → AssessmentLauncher modal)
│   ├── AssessmentLauncher.tsx  (NEW — admin only)
│   └── MyAssessments.tsx       (NEW — client only, shown below category grid)
│       ├── AssessmentRunner.tsx     (NEW — full Q&A flow)
│       └── AssessmentResults.tsx    (NEW — post-completion score view)
├── ClientManagement.tsx        (ADD: "Assign Assessment" button in org detail)
├── StrategyInsightsDashboard.tsx (NEW — replaces 'analytics' placeholder)
│   ├── RationalizationView.tsx     (NEW)
│   └── RoadmapView.tsx             (NEW)
└── Reports tab                 (remains placeholder — MVP2)

src/services/
└── assessProApiClient.ts       (NEW — all AssessPro API calls)

src/types/
└── assessPro.ts                (NEW — TypeScript types)

supabase/functions/
├── proxy-assesspro/            (NEW — server-side write proxy)
├── webhook-assesspro/          (NEW — receives AssessPro webhook)
└── ai-rationalization/         (NEW — calls Claude API)
```

---

## Checklist — Track B Complete

- [ ] **Migration applied:** `assessment_assignments_cache`, `assessment_results_cache`, `ai_analyses`, `roadmap_items` tables live with RLS
- [ ] **`assessProApiClient.ts`** typed and tested — `listAssessments()` returns real data from AssessPro
- [ ] **`pa_assessments.assesspro_assessment_id`** column populated for all 8 AssessPro assessments
- [ ] **`proxy-assesspro` Edge Function** deployed — `create_assignment`, `start_submission`, `save_answers`, `complete_submission` all working
- [ ] **`AssessmentLauncher`** — admin can assign to any org + user, due date optional, success toast shown
- [ ] **`MyAssessments`** — client sees assigned assessments with correct status badges
- [ ] **`AssessmentRunner`** — loads all topics/questions from AssessPro API, answers auto-save every 30s, completion triggers proxy-assesspro
- [ ] **`webhook-assesspro` Edge Function** — HMAC validated, result cached, `ai_analyses` row created, `ai-rationalization` triggered async
- [ ] **`ai-rationalization` Edge Function** — Claude API called, JSON parsed without error, `rationalization_results` + `roadmap_items` written
- [ ] **`StrategyInsightsDashboard`** — asset distribution pie chart, tech debt heatmap, AI summary rendered
- [ ] **`RationalizationView`** — all assets listed with disposition + confidence + rationale, sortable
- [ ] **`RoadmapView`** — list view and effort/impact scatter chart working
- [ ] **`AssessmentResults`** — polls until analysis complete, navigates to Strategy Insights tab
- [ ] **Full demo loop** (Steps 1–12 above) runs without manual intervention in under 15 minutes

---

## Notes for Claude Code

1. **`VITE_ASSESSPRO_API_KEY` is a read-only key only.** Never use it for `create_assignment`, `start_submission`, `save_answers`, or `complete_submission`. Those actions go through the `proxy-assesspro` Edge Function which holds the write-key server-side in `ASSESSPRO_API_WRITE_KEY` (a Supabase secret, not a Vite env var).

2. **Do not modify `AuthContext.tsx`, `AssetInventory.tsx`, or `ClientManagement.tsx` beyond the specific additions listed.** These are stable and working.

3. **The `assessment_assignments_cache` is a local projection, not a source of truth.** If it gets out of sync with AssessPro, re-sync by calling `GET /api-assignments?scope=<orgCode>` and upserting. Build a `syncAssignments()` utility in `assessProApiClient.ts` for this.

4. **`AssessmentRunner` must handle topic navigation without network calls on every question.** Fetch all questions for a topic upfront when entering that topic (not one by one). Cache them in component state.

5. **Claude API is called from a Supabase Edge Function (Deno), not from the browser.** The `ANTHROPIC_API_KEY` must be set as a Supabase secret: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`. It must never appear in the Vite frontend bundle or `.env` file that gets committed.

6. **Recharts must be installed:** `npm install recharts`. It is not in the current `package.json`. Also install types: `npm install --save-dev @types/recharts` (if needed — Recharts 2.x ships its own types).

7. **The existing `pa_assessments` catalog and `AssessmentsDashboard.tsx` category grid stays unchanged.** The new flows (Assign button, My Assessments section) are additions, not replacements. A `pa_assessment` that has no `assesspro_assessment_id` mapped should show "Coming soon" instead of "Assign" until it is mapped.

8. **Webhook URL format for registration with AssessPro:** `https://<your-stratifyit-supabase-project-ref>.supabase.co/functions/v1/webhook-assesspro`. This URL must be publicly reachable. Supabase Edge Functions are public by default.
