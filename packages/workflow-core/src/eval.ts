import type { WorkflowMetadata } from "@source2video/workflow-core/artifact";

export type CoreEvalCheckStatus = "pass" | "warning" | "blocked";

export type CoreEvalDimension = {
  id: string;
  label: string;
  source: string;
  polarity?: "positive" | "negative";
  includeInTotal?: boolean;
  warningBelow?: number;
  blockedBelow?: number;
  warningAtOrBelow?: number;
  blockedAtOrBelow?: number;
  guidance: string;
};

export type CoreEvalCandidateInput = {
  id: string;
  scores: Record<string, number>;
  evidence: Record<string, string>;
  total?: number;
};

export type CoreEvalAttribution = {
  dimensionId: string;
  label: string;
  source: string;
  evidence: string;
  score: number;
  status: CoreEvalCheckStatus;
  guidance: string;
};

export type CoreEvalCandidateResult = {
  candidateId: string;
  total: number;
  strongestSignal: string;
  weakestSignal: string;
  attribution: CoreEvalAttribution[];
};

export type CoreEvalRun = {
  id: string;
  kind: string;
  status: "complete";
  profileVersion: string;
  profileSource: string;
  riskSummary: string;
  candidateResults: CoreEvalCandidateResult[];
};

export type CoreEvalRunRecord = CoreEvalRun & {
  runId?: string;
  nodeRunId?: string;
  createdAt: string;
  metadata: WorkflowMetadata;
};

export type RunDeterministicEvalInput = {
  id: string;
  kind: string;
  profileVersion: string;
  profileSource: string;
  riskSummary: string;
  dimensions: CoreEvalDimension[];
  candidates: CoreEvalCandidateInput[];
};

function statusForScore(dimension: CoreEvalDimension, score: number): CoreEvalCheckStatus {
  if (dimension.polarity === "negative") {
    if (typeof dimension.blockedAtOrBelow === "number" && score <= dimension.blockedAtOrBelow) {
      return "blocked";
    }
    if (typeof dimension.warningAtOrBelow === "number" && score <= dimension.warningAtOrBelow) {
      return "warning";
    }
    return "pass";
  }

  if (typeof dimension.blockedBelow === "number" && score < dimension.blockedBelow) {
    return "blocked";
  }
  if (typeof dimension.warningBelow === "number" && score < dimension.warningBelow) {
    return "warning";
  }
  return "pass";
}

function strongestSignal(attribution: CoreEvalAttribution[]) {
  return (
    attribution
      .filter((item) => item.score >= 0)
      .sort((left, right) => right.score - left.score)[0]?.label ??
    attribution[0]?.label ??
    "unknown"
  );
}

function weakestSignal(attribution: CoreEvalAttribution[]) {
  const blocked = attribution.find((item) => item.status === "blocked");
  if (blocked) {
    return blocked.label;
  }

  const warning = attribution.find((item) => item.status === "warning");
  if (warning) {
    return warning.label;
  }

  return (
    attribution
      .filter((item) => item.score >= 0)
      .sort((left, right) => left.score - right.score)[0]?.label ??
    attribution
      .sort((left, right) => left.score - right.score)[0]?.label ??
    "unknown"
  );
}

export function runDeterministicEval(input: RunDeterministicEvalInput): CoreEvalRun {
  return {
    id: input.id,
    kind: input.kind,
    status: "complete",
    profileVersion: input.profileVersion,
    profileSource: input.profileSource,
    riskSummary: input.riskSummary,
    candidateResults: input.candidates.map((candidate) => {
      const attribution = input.dimensions.map((dimension) => {
        const score = candidate.scores[dimension.id] ?? 0;

        return {
          dimensionId: dimension.id,
          label: dimension.label,
          source: dimension.source,
          evidence: candidate.evidence[dimension.id] ?? "No evidence recorded.",
          score,
          status: statusForScore(dimension, score),
          guidance: dimension.guidance,
        };
      });
      const total =
        typeof candidate.total === "number"
          ? candidate.total
          : input.dimensions
              .filter((dimension) => dimension.includeInTotal !== false)
              .reduce((sum, dimension) => sum + (candidate.scores[dimension.id] ?? 0), 0);

      return {
        candidateId: candidate.id,
        total,
        strongestSignal: strongestSignal(attribution),
        weakestSignal: weakestSignal(attribution),
        attribution,
      };
    }),
  };
}
