import { artifactRef } from "@source2video/workflow-core/artifact";
import type { ArtifactRef } from "@source2video/workflow-core/artifact";
import type { CoreEvalRun } from "@source2video/workflow-core/eval";
import { workflowFeedbackSignal } from "@source2video/workflow-core/feedback";
import { createNodeRunRecord } from "@source2video/workflow-core/node";
import type { WorkflowRunStatus } from "@source2video/workflow-core/run";
import { workflowRunRecord } from "@source2video/workflow-core/run";
import { workflowSnapshotRef } from "@source2video/workflow-core/snapshot";
import type {
  CandidateRecord,
  HumanFeedbackRecord,
  RuleSnapshotRecord,
  WritingRunRecord,
} from "@doc-maker/writing-domain/types";

function statusForWritingRun(run: WritingRunRecord): WorkflowRunStatus {
  switch (run.status) {
    case "draft_scope_ready":
      return "draft";
    case "precheck_ready":
      return "ready";
    case "candidate_ready":
      return "ready";
    case "feedback_recorded":
    case "rule_patch_ready":
      return "feedback";
    case "finalized":
      return "finalized";
    default:
      return "ready";
  }
}

export function writingInputArtifactRef(run: WritingRunRecord): ArtifactRef {
  return artifactRef({
    id: `${run.id}:input`,
    kind: "text_task_input",
    version: "v0",
    summary: run.quickIntake || run.jobSpec.title,
    materialRefs: [run.id],
    metadata: {
      title: run.jobSpec.title,
      hasReferencePaste: Boolean(run.referencePaste?.trim()),
    },
  });
}

export function writingCandidateArtifactRef(candidate: CandidateRecord): ArtifactRef {
  return artifactRef({
    id: candidate.id,
    kind: "text_candidate",
    version: candidate.version,
    summary: candidate.title,
    materialRefs: [candidate.runId ?? ""].filter(Boolean),
    metadata: {
      round: candidate.round ?? null,
      generatedByRuleSnapshotId: candidate.generatedByRuleSnapshotId ?? null,
      score: candidate.total,
    },
  });
}

function feedbackArtifactRef(feedback: HumanFeedbackRecord, candidates: CandidateRecord[]) {
  const candidate = candidates.find((item) => item.id === feedback.candidateId);
  return candidate
    ? writingCandidateArtifactRef(candidate)
    : artifactRef({
        id: feedback.candidateId,
        kind: "unknown_text_candidate",
        summary: feedback.candidateId,
        metadata: {},
      });
}

function snapshotRef(snapshot: RuleSnapshotRecord) {
  return workflowSnapshotRef({
    id: snapshot.id,
    kind: "rule_snapshot",
    version: snapshot.version,
    status: snapshot.status,
    sourceRefs: snapshot.sourcePatchIds,
    summary: `${snapshot.rules.length} active rules`,
    metadata: {
      ruleCount: snapshot.rules.length,
    },
  });
}

function nodeRunsForWriting(run: WritingRunRecord) {
  return (run.frameworkRuns ?? []).map((node) =>
    createNodeRunRecord({
      id: node.id,
      nodeId: node.nodeId ?? node.nodeType,
      nodeVersion: "v0",
      runId: run.id,
      status: node.status,
      inputRefs: node.inputs.map((input) =>
        artifactRef({
          id: input,
          kind: "input_ref",
          summary: input,
          metadata: {},
        }),
      ),
      outputRefs: node.artifacts.map((artifact) =>
        artifactRef({
          id: artifact.id,
          kind: artifact.kind,
          summary: artifact.summary || artifact.label,
          materialRefs: artifact.ref ? [artifact.ref] : [],
          metadata: {
            label: artifact.label,
          },
        }),
      ),
      evalRunRefs: node.evalRuns.map((evalRun) => evalRun.id),
      traceRefs: (node.llmCalls ?? []).map((call) => ({
        id: call.id,
        sink: call.sink,
        traceId: call.langfuseTraceId,
        observationId: call.langfuseObservationId,
      })),
      startedAt: node.startedAt,
      completedAt: node.completedAt,
      metadata: {
        layer: node.layer,
        nodeType: node.nodeType,
      },
    }),
  );
}

export function writingRunToWorkflowRun(run: WritingRunRecord) {
  const inputArtifact = writingInputArtifactRef(run);
  const candidateArtifacts = run.candidates.map(writingCandidateArtifactRef);
  const evalRuns = run.evalRun?.coreEval ? [run.evalRun.coreEval] : ([] as CoreEvalRun[]);

  return workflowRunRecord({
    id: run.id,
    domain: "writing",
    status: statusForWritingRun(run),
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    inputArtifacts: [inputArtifact],
    outputArtifacts: candidateArtifacts,
    nodeRuns: nodeRunsForWriting(run),
    evalRuns,
    feedbackSignals: run.feedback.map((feedback) =>
      workflowFeedbackSignal({
        id: feedback.id,
        at: feedback.at,
        targetArtifactRef: feedbackArtifactRef(feedback, run.candidates),
        status: feedback.status ?? "unprocessed",
        verdict: feedback.verdict,
        quote: feedback.quote,
        issue: feedback.issue,
        expected: feedback.expected,
        confidence: feedback.confidence,
        metadata: {
          businessReason: feedback.businessReason ?? null,
          likelyCause: feedback.likelyCause ?? null,
          rulePatchId: feedback.rulePatchId ?? null,
        },
      }),
    ),
    snapshots: run.ruleSnapshots.map(snapshotRef),
    metadata: {
      round: run.round,
      finalizedCandidateId: run.finalizedCandidateId ?? null,
      outputProfile: run.outputProfile.name,
      skillPackageId: run.skillPackage.id,
    },
  });
}
