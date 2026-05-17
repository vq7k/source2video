import type {
  FrameworkNodeRunRecord,
  LLMCallTraceRecord,
} from "@/lib/framework-run-types";
import type { CoreEvalRun } from "@/lib/workflow-core/eval";

export const RULE_PATCH_DRAFT_LIMIT = 5;
export const RULE_SNAPSHOT_RULE_LIMIT = 10;

export type WritingRunStatus =
  | "precheck_ready"
  | "candidate_ready"
  | "feedback_recorded"
  | "rule_patch_ready"
  | "finalized";

export type WritingJobSpec = {
  title: string;
  goal: string;
  source: string;
  writingReference: string;
  reviewPreference: string;
};

export type SkillPackageSnapshot = {
  id: string;
  category: string;
  version: string;
  status: string;
};

export type OutputProfileSnapshot = {
  name: string;
  artifacts: string[];
};

export type TextOutputContract = {
  artifactType: string;
  lengthRange: string;
  structure: string;
  formatRules: string;
  groundingRules: string;
  specialHandling: string;
  downstreamHandoff: string;
};

export type TraceStep = {
  id: string;
  at: string;
  layer: "L1" | "L2" | "L3";
  event: string;
  input: string;
  output: string;
};

export type WritingRuleScopeKind = "structure" | "tone" | "prohibition" | "checklist";

export type WritingRuleScopeItem = {
  id: string;
  kind: WritingRuleScopeKind;
  text: string;
  sourceNote: string;
  confidence: "low" | "medium" | "high";
};

export type RuleScopeExtractionEval = {
  id: string;
  status: "complete";
  score: number;
  checks: Array<{
    label: string;
    status: "pass" | "warning" | "blocked";
    evidence: string;
    guidance: string;
  }>;
};

export type WritingRuleScopeRecord = {
  id: string;
  createdAt: string;
  status: "draft" | "confirmed";
  source: "baseline" | "reference_paste" | "mixed";
  quickIntakeDigest: string;
  referencePaste?: string;
  items: WritingRuleScopeItem[];
  eval: RuleScopeExtractionEval;
  llmTrace: LLMCallTraceRecord;
  warning: string;
};

export type PrecheckRun = {
  id: string;
  status: "ready" | "confirmed";
  warning?: string;
  contentBrief: string;
  groundingBrief: string;
  writingRulesCandidate: string[];
  riskChecks: Array<{
    label: string;
    level: "low" | "medium" | "high";
    reason: string;
  }>;
};

export type CandidateRecord = {
  id: string;
  round?: number;
  runId?: string;
  generatedByRuleSnapshotId?: string;
  version: string;
  title: string;
  summary: string;
  excerpt: string;
  total: number;
  humanScore: string;
  breakdown: {
    quality: number;
    fit: number;
    style: number;
    risk: number;
  };
  rationale: string;
  risk: string;
  feedbackApplied?: string[];
};

export type EvalRun = {
  id: string;
  round?: number;
  status: "complete";
  profileVersion: string;
  coreEval?: CoreEvalRun;
  candidateResults: Array<{
    candidateId: string;
    total: number;
    strongestSignal: string;
    weakestSignal: string;
    attribution: Array<{
      dimension:
        | "基础质量"
        | "任务匹配"
        | "格式契约"
        | "风格偏好"
        | "风险扣分";
      source: string;
      evidence: string;
      score: number;
    }>;
  }>;
  riskSummary: string;
};

export type FeedbackStatus = "unprocessed" | "compiled" | "dismissed";

export type HumanFeedbackRecord = {
  id: string;
  at: string;
  candidateId: string;
  kind: "score" | "selection";
  score: number | null;
  note: string;
  quote?: string;
  verdict?: "accepted" | "revise" | "rejected" | "liked" | "rewrite";
  businessReason?:
    | "任务不准"
    | "事实不稳"
    | "风格不对"
    | "偏好不符"
    | "风险过高"
    | "表达冗余"
    | "结构问题"
    | "正向样本";
  likelyCause?: "style" | "prompt" | "schema" | "rubric" | "exemplar" | "single-case";
  issue?: string;
  expected?: string;
  confidence?: "low" | "medium" | "high";
  status?: FeedbackStatus;
  rulePatchId?: string;
};

export type HumanFeedbackInput = {
  candidateId: string;
  kind?: HumanFeedbackRecord["kind"];
  score?: number | null;
  note?: string;
  quote?: string;
  verdict?: HumanFeedbackRecord["verdict"];
  businessReason?: HumanFeedbackRecord["businessReason"];
  likelyCause?: HumanFeedbackRecord["likelyCause"];
  issue?: string;
  expected?: string;
  confidence?: HumanFeedbackRecord["confidence"];
};

export type WritingRulesCandidateRecord = {
  id: string;
  status: "candidate";
  version: string;
  iterationCount: number;
  meanHumanScore: number | null;
  updateNote: string;
};

export type RulePatchRecord = {
  id: string;
  at: string;
  status: "draft" | "applied" | "dismissed";
  sourceCandidateId: string;
  feedbackIds: string[];
  reason: string;
  rule: string;
  note: string;
};

export type RuleSnapshotRecord = {
  id: string;
  at: string;
  version: string;
  status: "active" | "archived";
  rules: string[];
  sourcePatchIds: string[];
};

export type GenerationRunRecord = {
  id: string;
  at: string;
  round: number;
  status: "complete";
  ruleSnapshotId: string;
  candidateIds: string[];
  evalRunId: string;
};

export type WritingRunRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: WritingRunStatus;
  finalizedCandidateId?: string;
  finalizedAt?: string;
  round: number;
  storePath: string;
  quickIntake: string;
  referencePaste?: string;
  ruleScope?: WritingRuleScopeRecord | null;
  skillPackage: SkillPackageSnapshot;
  outputProfile: OutputProfileSnapshot;
  outputContract?: TextOutputContract;
  jobSpec: WritingJobSpec;
  precheckRun: PrecheckRun;
  candidates: CandidateRecord[];
  evalRun: EvalRun | null;
  feedback: HumanFeedbackRecord[];
  rulePatches: RulePatchRecord[];
  ruleSnapshots: RuleSnapshotRecord[];
  generationRuns: GenerationRunRecord[];
  rulesCandidate: WritingRulesCandidateRecord;
  frameworkRuns?: FrameworkNodeRunRecord[];
  llmTraces?: LLMCallTraceRecord[];
  trace: TraceStep[];
};

export type CreateWritingRunInput = {
  quickIntake: string;
  referencePaste?: string;
  ruleScope?: WritingRuleScopeRecord | null;
  skillPackage: SkillPackageSnapshot;
  outputProfile: OutputProfileSnapshot;
  outputContract?: TextOutputContract;
  jobSpec: WritingJobSpec;
};

export type DeriveWritingRuleScopeInput = {
  quickIntake: string;
  referencePaste?: string;
  runId?: string;
};

export type CompileRulePatchInput = {
  candidateId: string;
};

export type RunGenerationBatchInput = {
  patchIds?: string[];
  candidateCount?: number;
};

export type FinalizeWritingRunInput = {
  candidateId: string;
};
