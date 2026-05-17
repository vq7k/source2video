import type {
  CandidateRecord,
  HumanFeedbackRecord,
  OutputProfileSnapshot,
  PrecheckRun,
  RulePatchRecord,
  RuleSnapshotRecord,
  RuleScopeExtractionEval,
  SkillPackageSnapshot,
  TextOutputContract,
  WritingJobSpec,
  WritingRuleScopeItem,
  WritingRuleScopeRecord,
} from "@/lib/writing-run-types";

export type RuleScopeDraftItem = Omit<WritingRuleScopeItem, "id">;

export type RuleScopeDraft = Pick<WritingRuleScopeRecord, "source" | "warning"> & {
  items: RuleScopeDraftItem[];
  eval: Omit<RuleScopeExtractionEval, "id">;
};

export type GenerateRuleScopeRequest = {
  quickIntake: string;
  referencePaste: string;
};

export type PrecheckDraft = Pick<
  PrecheckRun,
  "contentBrief" | "groundingBrief" | "writingRulesCandidate" | "riskChecks"
> & {
  warning: string;
};

export type GeneratePrecheckRequest = {
  quickIntake: string;
  referencePaste?: string;
  jobSpec: WritingJobSpec;
  outputContract: TextOutputContract;
  outputProfile: OutputProfileSnapshot;
  skillPackage: SkillPackageSnapshot;
  ruleScope: WritingRuleScopeRecord;
};

export type CandidateDraft = {
  title: string;
  summary: string;
  excerpt: string;
  rationale: string;
  risk: string;
  breakdown?: Partial<CandidateRecord["breakdown"]>;
};

export type GenerateCandidatesRequest = {
  round: number;
  candidateCount: number;
  jobSpec: WritingJobSpec;
  outputContract: TextOutputContract;
  outputProfile: OutputProfileSnapshot;
  skillPackage: SkillPackageSnapshot;
  precheckRun: PrecheckRun;
  ruleScope?: WritingRuleScopeRecord | null;
  ruleSnapshot: RuleSnapshotRecord;
  feedback: HumanFeedbackRecord[];
  rulePatches: RulePatchRecord[];
};

export type CandidateGenerationDraft = {
  warning: string;
  candidates: CandidateDraft[];
};

export type AnalyzeFeedbackRequest = {
  jobSpec: WritingJobSpec;
  precheckRun: PrecheckRun;
  candidate?: CandidateRecord;
  feedback: HumanFeedbackRecord;
};

export type FeedbackAnalysisDraft = Pick<
  HumanFeedbackRecord,
  "businessReason" | "likelyCause" | "issue" | "expected" | "confidence"
> & {
  note: string;
};

export type CompileRulePatchRequest = {
  jobSpec: WritingJobSpec;
  precheckRun: PrecheckRun;
  candidate?: CandidateRecord;
  feedback: HumanFeedbackRecord[];
  existingDraftRules: RulePatchRecord[];
};

export type RulePatchDraft = Pick<RulePatchRecord, "reason" | "rule" | "note">;

export type LLMProviderResponse<T> = {
  output: T;
  provider: string;
  model: string;
  promptVersion: string;
  traceId: string;
  latencyMs?: number;
  requestPayload?: unknown;
  responsePayload?: unknown;
};

export type LLMProvider = {
  generateRuleScope(request: GenerateRuleScopeRequest): Promise<LLMProviderResponse<RuleScopeDraft>>;
  generatePrecheck(request: GeneratePrecheckRequest): Promise<LLMProviderResponse<PrecheckDraft>>;
  generateCandidates(request: GenerateCandidatesRequest): Promise<LLMProviderResponse<CandidateGenerationDraft>>;
  analyzeFeedback(request: AnalyzeFeedbackRequest): Promise<LLMProviderResponse<FeedbackAnalysisDraft>>;
  compileRulePatch(request: CompileRulePatchRequest): Promise<LLMProviderResponse<RulePatchDraft>>;
};
