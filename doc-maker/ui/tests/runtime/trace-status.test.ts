import { describe, expect, it } from "vitest";

import { localJsonTraceSink } from "@doc-maker/observability/trace-sink";

const baseTraceInput = {
  provider: "openai-compatible",
  model: "deepseek-v4-pro",
  promptVersion: "candidate-generation-v0.2",
  nodeType: "candidate_generation",
  inputRefs: ["job_spec"],
  outputArtifact: {
    id: "candidate_r1_1",
    kind: "candidate_text",
    label: "候选正文",
    summary: "第 1 批 / 独立路径 1/3",
  },
};

describe("trace status defaults", () => {
  it("keeps successful traces complete when optional status is explicitly undefined", async () => {
    const trace = await localJsonTraceSink.captureLLMCall({
      ...baseTraceInput,
      status: undefined,
    });

    expect(trace.status).toBe("complete");
  });
});
