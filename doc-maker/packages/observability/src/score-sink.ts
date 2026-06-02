import { writeLangfuseEvalScores, writeLangfuseFeedbackScore } from "@doc-maker/observability/langfuse";
import type { ScoreSink } from "@doc-maker/workflow-core/score";

export const localJsonScoreSink: ScoreSink = {
  name: "local-json",

  async writeEvalScores(input) {
    return {
      sink: this.name,
      status: "skipped",
      scoreCount: input.evalRun.candidateResults.reduce(
        (count, candidate) => count + candidate.attribution.length,
        0,
      ),
    };
  },

  async writeFeedbackScore() {
    return {
      sink: this.name,
      status: "skipped",
      scoreCount: 1,
    };
  },
};

export const langfuseScoreSink: ScoreSink = {
  name: "langfuse",

  async writeEvalScores(input) {
    const result = await writeLangfuseEvalScores(input);

    return {
      sink: this.name,
      ...result,
    };
  },

  async writeFeedbackScore(input) {
    const result = await writeLangfuseFeedbackScore(input);

    return {
      sink: this.name,
      ...result,
    };
  },
};

export const compositeScoreSink: ScoreSink = {
  name: "langfuse",

  async writeEvalScores(input) {
    try {
      const result = await langfuseScoreSink.writeEvalScores(input);
      if (result.status !== "skipped") {
        return result;
      }
    } catch (error) {
      return {
        sink: "local-json",
        status: "failed",
        scoreCount: 0,
        error: error instanceof Error ? error.message : "Langfuse score write failed",
      };
    }

    return localJsonScoreSink.writeEvalScores(input);
  },

  async writeFeedbackScore(input) {
    try {
      const result = await langfuseScoreSink.writeFeedbackScore(input);
      if (result.status !== "skipped") {
        return result;
      }
    } catch (error) {
      return {
        sink: "local-json",
        status: "failed",
        scoreCount: 0,
        error: error instanceof Error ? error.message : "Langfuse feedback score write failed",
      };
    }

    return localJsonScoreSink.writeFeedbackScore(input);
  },
};

export function getScoreSink(): ScoreSink {
  return compositeScoreSink;
}
