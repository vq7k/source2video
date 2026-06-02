import type {
  CandidateRecord,
  RuleSnapshotRecord,
  WritingRunRecord,
} from "@doc-maker/writing-domain/types";

export type WritingTopicBucket = "current" | "waiting" | "history";

export type WritingTopicRound = {
  round: number;
  candidates: CandidateRecord[];
  bestCandidate: CandidateRecord | null;
};

export type WritingTopicView = {
  id: string;
  title: string;
  prompt: string;
  bucket: WritingTopicBucket;
  updatedAt: string;
  roundCount: number;
  feedbackCount: number;
  ruleCount: number;
  run: WritingRunRecord;
  rounds: WritingTopicRound[];
  currentRound: WritingTopicRound | null;
  recommendedCandidate: CandidateRecord | null;
  alternativeCandidates: CandidateRecord[];
  previousBestScore: number | null;
  activeRuleSnapshot: RuleSnapshotRecord | null;
};

function bucketForRun(run: WritingRunRecord): WritingTopicBucket {
  if (run.status === "finalized") {
    return "history";
  }
  if (
    run.status === "candidate_ready" ||
    run.status === "feedback_recorded" ||
    run.status === "rule_patch_ready"
  ) {
    return "waiting";
  }

  return "current";
}

function candidateRound(candidate: CandidateRecord) {
  return candidate.round ?? 1;
}

function evalTotalForCandidate(run: WritingRunRecord, candidate: CandidateRecord) {
  const evalResult = run.evalRun?.candidateResults.find((result) => result.candidateId === candidate.id);
  if (evalResult) {
    return evalResult.total;
  }

  // Historical rounds currently keep their eval result on the candidate cache.
  // The latest recommendation still reads EvalRun first; this fallback prevents
  // frozen rounds from becoming invisible after a newer round overwrites evalRun.
  return typeof candidate.total === "number" && candidate.total > 0 ? candidate.total : null;
}

function bestCandidate(run: WritingRunRecord, candidates: CandidateRecord[]) {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      total: evalTotalForCandidate(run, candidate),
    }))
    .filter((item): item is { candidate: CandidateRecord; total: number } => item.total !== null);

  if (!scored.length) {
    return null;
  }

  return scored.reduce((best, item) => (item.total > best.total ? item : best)).candidate;
}

function roundsForRun(run: WritingRunRecord): WritingTopicRound[] {
  const grouped = new Map<number, CandidateRecord[]>();

  for (const candidate of run.candidates) {
    const round = candidateRound(candidate);
    grouped.set(round, [...(grouped.get(round) ?? []), candidate]);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left - right)
    .map(([round, candidates]) => ({
      round,
      candidates: candidates.slice().sort((left, right) => {
        const rightScore = evalTotalForCandidate(run, right);
        const leftScore = evalTotalForCandidate(run, left);
        if (rightScore !== null && leftScore !== null) {
          return rightScore - leftScore;
        }
        if (rightScore !== null) {
          return 1;
        }
        if (leftScore !== null) {
          return -1;
        }
        return left.id.localeCompare(right.id);
      }),
      bestCandidate: bestCandidate(run, candidates),
    }));
}

function titleForRun(run: WritingRunRecord) {
  const title = run.jobSpec.title || run.quickIntake || "未命名主题";
  return title.length > 52 ? `${title.slice(0, 52)}...` : title;
}

export function buildWritingTopicView(run: WritingRunRecord): WritingTopicView {
  const rounds = roundsForRun(run);
  const currentRound = rounds.at(-1) ?? null;
  const recommendedCandidate = currentRound?.bestCandidate ?? null;
  const alternativeCandidates = currentRound
    ? currentRound.candidates.filter((candidate) => candidate.id !== recommendedCandidate?.id)
    : [];
  const previousBest = rounds.length > 1 ? rounds.at(-2)?.bestCandidate ?? null : null;
  const previousBestScore = previousBest ? evalTotalForCandidate(run, previousBest) : null;
  const activeRuleSnapshot = run.ruleSnapshots.at(-1) ?? null;

  return {
    id: run.id,
    title: titleForRun(run),
    prompt: run.quickIntake || run.jobSpec.source || run.jobSpec.goal,
    bucket: bucketForRun(run),
    updatedAt: run.updatedAt,
    roundCount: Math.max(run.round ?? 1, rounds.length || 1),
    feedbackCount: run.feedback.length,
    ruleCount: activeRuleSnapshot?.rules.length ?? run.precheckRun.writingRulesCandidate.length,
    run,
    rounds,
    currentRound,
    recommendedCandidate,
    alternativeCandidates,
    previousBestScore,
    activeRuleSnapshot,
  };
}

export function buildWritingTopics(runs: WritingRunRecord[]) {
  return runs
    .map(buildWritingTopicView)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function topicBucketLabel(bucket: WritingTopicBucket) {
  switch (bucket) {
    case "current":
      return "当前";
    case "waiting":
      return "待处理";
    case "history":
      return "历史";
  }
}
