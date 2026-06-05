import { writingRunToWorkflowRun } from "@doc-maker/writing-domain/workflow-adapter";
import type { ArtifactRecord } from "@source2video/workflow-core/artifact";
import type { FrameworkDatasetItem } from "../../../../packages/framework-store/src/index";
import type {
  CandidateRecord,
  HumanFeedbackRecord,
  RulePackageRecord,
  RulePatchRecord,
  RuleSnapshotRecord,
  TextOutputContract,
  WritingJobSpec,
  WritingRunRecord,
} from "@doc-maker/writing-domain/types";

export type WritingAdapterRulePackageDraft = {
  id: string;
  sourceRunId: string;
  finalizedCandidateId: string;
  status: "draft" | "published";
  title: string;
  category: string;
  version: string;
  summary: string;
  rules: RulePackageRecord["rules"];
  sourceSummary: RulePackageRecord["sourceSummary"];
  outputContract?: TextOutputContract;
};

export type WritingDatasetDraftItem = {
  id: string;
  sourceRunId: string;
  candidateId: string;
  feedbackId: string;
  rulePatchId?: string;
  status: "needs_human_confirmation";
  input: {
    jobSpec: WritingJobSpec;
    outputContract?: TextOutputContract;
    ruleSnapshot?: RuleSnapshotRecord;
    candidate: Pick<CandidateRecord, "id" | "round" | "title" | "summary" | "excerpt" | "total" | "breakdown">;
  };
  expected: {
    feedback: Pick<
      HumanFeedbackRecord,
      | "verdict"
      | "quote"
      | "businessReason"
      | "likelyCause"
      | "issue"
      | "expected"
      | "confidence"
      | "status"
    >;
    finalizedCandidateId?: string;
    rulePatch?: Pick<RulePatchRecord, "id" | "status" | "reason" | "rule" | "note">;
  };
  evalEvidence: {
    candidateTotal: number;
    strongestSignal?: string;
    weakestSignal?: string;
    riskSummary?: string;
  };
  metadata: {
    domain: "writing";
    round: number;
    outputProfile: string;
    skillPackageId: string;
  };
};

export type WritingAdapterReadinessProjection = {
  workflowRun: ReturnType<typeof writingRunToWorkflowRun>;
  rulePackageDrafts: WritingAdapterRulePackageDraft[];
  datasetDraftItems: WritingDatasetDraftItem[];
  needsFromFrameworkWorker: string[];
};

export const WRITING_ADAPTER_FRAMEWORK_NEEDS = [
  "generic WorkflowRun repository can persist domain string + metadata without business table names",
  "generic Artifact repository can persist content or URI plus material refs and adapter-owned metadata",
  "generic Dataset draft repository can keep human-confirmation status before promotion",
  "generic Feedback signal contract can retain issue/expected/confidence plus opaque metadata",
  "generic Feedback repository can append signals and update/delete signal status without rewriting adapter records",
  "generic Artifact refs can preserve source material refs and adapter-owned metadata",
  "generic Rule or Snapshot repository can persist reusable rule packages by kind/version/sourceRefs/payload",
  "generic Eval evidence query can read candidate attribution by run, artifact, and feedback target",
] as const;

export type WritingDatasetFrameworkItemOptions = {
  datasetId: string;
  at?: string;
};

const DEFAULT_FRAMEWORK_DATASET_ITEM_TIMESTAMP = "1970-01-01T00:00:00.000Z";

function materialRefs(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value));
}

function summaryText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function artifactRecord(input: {
  id: string;
  kind: string;
  summary: string;
  materialRefs: string[];
  metadata: ArtifactRecord["metadata"];
  at: string;
}): ArtifactRecord {
  return {
    id: input.id,
    kind: input.kind,
    version: "draft",
    summary: input.summary,
    materialRefs: input.materialRefs,
    metadata: input.metadata,
    createdAt: input.at,
    updatedAt: input.at,
  };
}

function latestRuleSnapshot(run: WritingRunRecord) {
  return run.ruleSnapshots.find((snapshot) => snapshot.status === "active") ?? run.ruleSnapshots.at(-1);
}

function feedbackForDatasetDraft(run: WritingRunRecord, feedback: HumanFeedbackRecord): WritingDatasetDraftItem | null {
  const candidate = run.candidates.find((item) => item.id === feedback.candidateId);
  if (!candidate) {
    return null;
  }

  const evalResult = run.evalRun?.candidateResults.find((item) => item.candidateId === candidate.id);
  const rulePatch = feedback.rulePatchId
    ? run.rulePatches.find((patch) => patch.id === feedback.rulePatchId)
    : undefined;

  return {
    id: `dataset_draft_${run.id}_${feedback.id}`,
    sourceRunId: run.id,
    candidateId: candidate.id,
    feedbackId: feedback.id,
    rulePatchId: feedback.rulePatchId,
    status: "needs_human_confirmation",
    input: {
      jobSpec: run.jobSpec,
      outputContract: run.outputContract,
      ruleSnapshot: latestRuleSnapshot(run),
      candidate: {
        id: candidate.id,
        round: candidate.round,
        title: candidate.title,
        summary: candidate.summary,
        excerpt: candidate.excerpt,
        total: candidate.total,
        breakdown: candidate.breakdown,
      },
    },
    expected: {
      feedback: {
        verdict: feedback.verdict,
        quote: feedback.quote,
        businessReason: feedback.businessReason,
        likelyCause: feedback.likelyCause,
        issue: feedback.issue,
        expected: feedback.expected,
        confidence: feedback.confidence,
        status: feedback.status,
      },
      finalizedCandidateId: run.finalizedCandidateId,
      rulePatch: rulePatch
        ? {
            id: rulePatch.id,
            status: rulePatch.status,
            reason: rulePatch.reason,
            rule: rulePatch.rule,
            note: rulePatch.note,
          }
        : undefined,
    },
    evalEvidence: {
      candidateTotal: candidate.total,
      strongestSignal: evalResult?.strongestSignal,
      weakestSignal: evalResult?.weakestSignal,
      riskSummary: run.evalRun?.riskSummary,
    },
    metadata: {
      domain: "writing",
      round: candidate.round ?? run.round,
      outputProfile: run.outputProfile.name,
      skillPackageId: run.skillPackage.id,
    },
  };
}

function rulePackageDraft(packageRecord: RulePackageRecord): WritingAdapterRulePackageDraft {
  return {
    id: packageRecord.id,
    sourceRunId: packageRecord.sourceRunId,
    finalizedCandidateId: packageRecord.finalizedCandidateId,
    status: packageRecord.status,
    title: packageRecord.title,
    category: packageRecord.category,
    version: packageRecord.version,
    summary: packageRecord.summary,
    rules: packageRecord.rules,
    sourceSummary: packageRecord.sourceSummary,
    outputContract: packageRecord.outputContract,
  };
}

export function writingDatasetDraftItemToFrameworkDatasetItem(
  item: WritingDatasetDraftItem,
  options: WritingDatasetFrameworkItemOptions,
): FrameworkDatasetItem {
  const at = options.at ?? DEFAULT_FRAMEWORK_DATASET_ITEM_TIMESTAMP;
  const inputRef = artifactRecord({
    id: `${item.id}_input`,
    kind: "writing_dataset_input",
    summary: summaryText(item.input.jobSpec.title, "Writing dataset input"),
    materialRefs: materialRefs([item.sourceRunId, item.candidateId, item.input.ruleSnapshot?.id]),
    metadata: {
      domain: "writing",
      role: "input",
      reviewStatus: item.status,
      sourceDraftItemId: item.id,
      candidateId: item.candidateId,
      feedbackId: item.feedbackId,
      ruleSnapshotId: item.input.ruleSnapshot?.id ?? null,
      outputProfile: item.metadata.outputProfile,
      skillPackageId: item.metadata.skillPackageId,
    },
    at,
  });
  const expectedOutputRef = artifactRecord({
    id: `${item.id}_expected_output`,
    kind: "writing_feedback_expected_output",
    summary: summaryText(item.expected.feedback.expected ?? item.expected.feedback.issue, "Writing feedback expectation"),
    materialRefs: materialRefs([
      item.candidateId,
      item.feedbackId,
      item.rulePatchId,
      item.expected.finalizedCandidateId,
    ]),
    metadata: {
      domain: "writing",
      role: "expected_output",
      reviewStatus: item.status,
      candidateId: item.candidateId,
      feedbackId: item.feedbackId,
      finalizedCandidateId: item.expected.finalizedCandidateId ?? null,
      verdict: item.expected.feedback.verdict ?? null,
      confidence: item.expected.feedback.confidence ?? null,
      status: item.expected.feedback.status ?? null,
    },
    at,
  });

  return {
    id: item.id,
    datasetId: options.datasetId,
    sourceRunId: item.sourceRunId,
    sourceArtifactId: item.candidateId,
    inputRef,
    expectedOutputRef,
    split: "draft",
    labels: {
      feedback: {
        id: item.feedbackId,
        verdict: item.expected.feedback.verdict ?? null,
        confidence: item.expected.feedback.confidence ?? null,
        status: item.expected.feedback.status ?? null,
        quote: item.expected.feedback.quote ?? null,
        issue: item.expected.feedback.issue ?? null,
        expected: item.expected.feedback.expected ?? null,
        businessReason: item.expected.feedback.businessReason ?? null,
        likelyCause: item.expected.feedback.likelyCause ?? null,
      },
      rulePatch: item.expected.rulePatch
        ? {
            id: item.expected.rulePatch.id,
            status: item.expected.rulePatch.status,
            reason: item.expected.rulePatch.reason,
            rule: item.expected.rulePatch.rule,
            note: item.expected.rulePatch.note,
          }
        : null,
      finalizedCandidateId: item.expected.finalizedCandidateId ?? null,
    },
    inputArtifacts: [inputRef],
    expectedArtifacts: [expectedOutputRef],
    metadata: {
      domain: "writing",
      reviewStatus: item.status,
      sourceDraftItemId: item.id,
      candidateId: item.candidateId,
      feedbackId: item.feedbackId,
      rulePatchId: item.rulePatchId ?? null,
      round: item.metadata.round,
      outputProfile: item.metadata.outputProfile,
      skillPackageId: item.metadata.skillPackageId,
      candidateTotal: item.evalEvidence.candidateTotal,
      strongestSignal: item.evalEvidence.strongestSignal ?? null,
      weakestSignal: item.evalEvidence.weakestSignal ?? null,
      riskSummary: item.evalEvidence.riskSummary ?? null,
    },
  };
}

export function buildWritingAdapterReadinessProjection(
  run: WritingRunRecord,
): WritingAdapterReadinessProjection {
  return {
    workflowRun: writingRunToWorkflowRun(run),
    rulePackageDrafts: (run.rulePackages ?? []).map(rulePackageDraft),
    datasetDraftItems: run.feedback
      .map((feedback) => feedbackForDatasetDraft(run, feedback))
      .filter((item): item is WritingDatasetDraftItem => Boolean(item)),
    needsFromFrameworkWorker: [...WRITING_ADAPTER_FRAMEWORK_NEEDS],
  };
}
