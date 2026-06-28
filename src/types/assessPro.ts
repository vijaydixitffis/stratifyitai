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
  icon: string;
  question_count: number;
}

export interface APAnswer {
  id: string;
  text: string;
  marks: number;
  // is_correct intentionally omitted — AssessPro API never exposes it
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
  scope: string;           // org_code
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
  topic_id?: string;   // not always present — AssessPro API omits it in some responses
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
  event:         'submission.completed';
  fired_at:      string;
  assignment_id: string;    // AssessPro assessment_assignments.id
  submission_id: string;
  percentage:    number;
  topic_scores:  APTopicScore[];
  // Fields NOT in the payload — resolved from local cache in webhook-assesspro handler
  // org_code, assessment_id, assessment_title, total_score, max_score, completed_at
}

// Local cache types (from StratifyIT Supabase)
export interface AssignmentCache {
  id: string;
  assesspro_assign_id: string;
  org_id: number;
  org_code: string;
  assesspro_assess_id: string;
  pa_assessment_id: string | null;
  assessment_title: string;
  assigned_to_user_id: string | null;
  assigned_by_user_id: string | null;
  status: 'ASSIGNED' | 'STARTED' | 'COMPLETED';
  due_date: string | null;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResultCache {
  id: string;
  assesspro_sub_id: string;
  assignment_cache_id: string | null;
  org_id: number;
  org_code: string;
  assesspro_assess_id: string;
  assessment_title: string | null;
  total_score: number | null;
  max_score: number | null;
  percentage: number | null;
  topic_scores: APTopicScore[] | null;
  completed_at: string | null;
  created_at: string;
}

export interface AIAnalysis {
  id: string;
  org_id: number;
  org_code: string;
  result_cache_id: string | null;
  assesspro_sub_id: string | null;
  asset_snapshot: AssetSnapshot[];
  rationalization_results: AssetDisposition[] | null;
  summary_text: string | null;
  ai_model: string;
  prompt_version: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export type EightRDisposition =
  | 'Retain'       // keep as-is; fit-for-purpose
  | 'Retire'       // decommission; obsolete or EOL
  | 'Replace'      // swap with COTS/SaaS equivalent
  | 'Consolidate'  // merge with a redundant peer asset
  | 'Modernise'    // significant refactor / code-level rework
  | 'Rehost'       // lift-and-shift; no code changes
  | 'Replatform'   // move to new platform (containerize, managed DB) with minor changes
  | 'Rearchitect'; // fundamental redesign for cloud-native / microservices

export interface AssetDisposition {
  asset_id:            string;
  asset_name:          string;
  asset_type:          string;
  disposition:         EightRDisposition;
  confidence:          'High' | 'Medium' | 'Low';
  rationale:           string;
  estimated_effort:    'Low' | 'Medium' | 'High';
  dependency_risk:     'None' | 'Low' | 'High';
  affected_dependents: string[];    // asset IDs that directly depend on this asset
  time_horizon:        'Immediate' | '6-12 months' | '12-24 months' | '24+ months';
}

/**
 * Snapshot of a single asset captured into ai_analyses.asset_snapshot at
 * rationalization time.  Mirrors the SELECT in ai-rationalization/index.ts —
 * keep both in sync whenever new fields are added.
 */
export interface AssetSnapshot {
  // Core
  id: string;
  name: string;
  type: string;
  category: string | null;
  status: string | null;
  criticality: string | null;
  description: string | null;

  // CMDB identification
  vendor: string | null;
  sourcing_type: 'cots' | 'custom_built' | 'open_source' | 'saas' | null;
  environment: string | null;
  business_unit: string | null;
  asset_tag: string | null;

  // Lifecycle dates — first-class columns (not metadata hacks)
  end_of_life_date: string | null;     // vendor EOL
  end_of_support_date: string | null;  // vendor EOS — key Retire/Replace signal
  purchase_date: string | null;
  last_reviewed_date: string | null;

  // Financial
  annual_cost: number | null;
  license_type: string | null;
  license_expiry_date: string | null;
  support_contract_id: string | null;

  // Compliance & Risk
  data_classification: 'public' | 'internal' | 'confidential' | 'restricted' | null;
  compliance_tags: string[] | null;
  criticality_justification: string | null;

  // Tech specs (free-form from form metadata fields)
  metadata: Record<string, unknown> | null;
  tags: string[] | null;
}

export interface RoadmapItem {
  id: string;
  analysis_id: string;
  org_id: number;
  title: string;
  description: string | null;
  initiative_type: string | null;
  effort: 'Low' | 'Medium' | 'High' | null;
  impact: 'Low' | 'Medium' | 'High' | null;
  priority_score: number | null;
  affected_assets: string[] | null;
  time_horizon: string | null;
  status: 'open' | 'in-progress' | 'completed' | 'deferred';
  sequence_number: number | null;
  created_at: string;
  updated_at: string;
}
