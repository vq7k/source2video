// 数据模型（按 docs/reference/schemas.md + business-design.md）

export type EpisodeStatus = "done" | "warn" | "running" | "failed";

export type StageStatus = "done" | "pending" | "running" | "failed";

export interface EpisodeProgress {
  plan: StageStatus;
  shot: { current: number; total: number };
  qa: StageStatus;
  done: StageStatus;
}

export interface EpisodeArtifactLinks {
  scripts?: string;
  shots?: string;
  qa_report?: string;
}

export interface Episode {
  id: string;
  title: string;
  status: EpisodeStatus;
  source: string;
  size: string;
  rounds?: number;
  duration?: string;
  artifacts?: EpisodeArtifactLinks;
  // warn 时
  qa_warnings?: number;
  warn_summary?: string;
  warn_node?: NodeName;
  warn_artifact_id?: string;
  // running 时
  progress?: EpisodeProgress;
  eta?: string;
  // failed 时
  error?: string;
  failed_node?: NodeName;
  failed_artifact_id?: string;
  trace_id?: string;
  // 两层文案（ADR-025 #4：L1 不展示 Materials / DT / EA / rubric 分布）
  user_message?: string; // L1 给使用者的人话
  technical_detail?: string; // 框架技术细节（折叠或仅 L3 显示）
}

export type NodeName = "toy" | "plan" | "shot" | "qa";

export interface NodeInfo {
  name: NodeName;
  label: string;
  alive: boolean;
  latest_artifact: string;
  materials_version: string;
  pass_rate_7d: string;
  description: string;
}

// Materials（5 类）

export type MaterialTag =
  | "capability_gap"
  | "business_policy"
  | "channel_constraint"
  | "integration_glue";

export interface MaterialRef {
  kind: "prompts" | "rubrics" | "schemas" | "style_guides" | "exemplars";
  name: string;
  version: string;
  tag?: MaterialTag;
  // 简单 diff 占位（点徽章查看）
  preview?: string;
}

// Decision Trace

export interface ExemplarUsed {
  id: string;
  reason: string;
  similarity: number;
}

export interface DecisionTrace {
  prompt_template_id: string;
  rendered_prompt_diff: string;
  materials_injected: Record<string, string>;
  exemplars_used: ExemplarUsed[];
  llm_thinking_summary: string;
}

// Eval Attribution

export type Verdict = "pass" | "fail";

export interface EvalAttribution {
  violated_rule_ref?: string;
  violated_anchor?: string;
  citation_in_artifact?: string;
  judge_thinking: string;
}

export interface EvalDimension {
  dimension: string;
  verdict: Verdict;
  attribution: EvalAttribution;
}

// Feedback

export interface Feedback {
  feedback_id: string;
  artifact_id: string;
  location: string;
  verdict: "good" | "bad" | "minor_nit";
  likely_cause:
    | "style"
    | "prompt"
    | "schema"
    | "rubric"
    | "exemplar"
    | "single-case";
  severity: "high" | "medium" | "low";
  issue: string;
  expected?: string;
  reviewer: string;
  created_at: string;
}

// Node metrics

export interface NodeMetrics {
  pass_rate: string;
  avg_tokens: string;
  budget_state: string;
  avg_latency: string;
  feedback_queue: string;
  avg_cost: string;
}

// Artifact 基础（每个 node 扩展自己的 content）

export interface ArtifactBase {
  artifact_id: string;
  node_name: NodeName;
  node_version: string;
  case_id: string;
  timestamp: string;
  materials: MaterialRef[];
  token_used: number;
  latency_s: number;
  cost_usd: number;
  decision_trace: DecisionTrace;
  eval: EvalDimension[];
  feedback_history: Feedback[];
  metrics: NodeMetrics;
}

// ToyNode artifact

export interface ToyArtifact extends ArtifactBase {
  node_name: "toy";
  content: {
    points: string[];
  };
}

// Plan artifact

export interface PlanShot {
  shot_id: string;
  intent: string;
  scope: string;
  target_duration_seconds: number;
  incoming_context: string | null;
  outgoing_state: string;
  key_concepts: string[];
  callbacks: { to: string; type: string }[];
  visual_hint: string;
}

export interface PlanArtifact extends ArtifactBase {
  node_name: "plan";
  episode_id: string;
  title: string;
  target_duration_seconds: number;
  narrative_arc: string;
  shots: PlanShot[];
  revision_count: number;
  cross_step_eval: EvalDimension[];
}

// Shot artifact

export interface ShotArtifact extends ArtifactBase {
  node_name: "shot";
  shot_id: string;
  episode_id: string;
  plan_artifact_id: string;
  text: string;
  text_tts: string;
  notes: { kind: string; duration: string; visual: string; cues: string[] }[];
  cross_step_consistency: Verdict;
  prev_shot_outgoing: string | null;
}

// QA artifact

export interface QaIssue {
  dimension: string;
  verdict: Verdict;
  affected_shots: string[];
  description: string;
  recommended_action: string;
}

export interface QaArtifact extends ArtifactBase {
  node_name: "qa";
  episode_id: string;
  plan_artifact_id: string;
  shot_artifact_ids: string[];
  issues: QaIssue[];
  overall_verdict: Verdict;
}
