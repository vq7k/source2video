import { afterEach, describe, expect, it } from "vitest";

import { getLLMRuntimeSettings, resolveModelForNode } from "@doc-maker/writing-domain/llm/settings";

describe("LLM runtime settings", () => {
  afterEach(() => {
    delete process.env.DOC_MAKER_LLM_PROVIDER;
    delete process.env.DOC_MAKER_LLM_BASE_URL;
    delete process.env.DOC_MAKER_LLM_MODEL;
  });

  it("uses the env model for all nodes when runtime is configured by env", () => {
    process.env.DOC_MAKER_LLM_PROVIDER = "openai-compatible";
    process.env.DOC_MAKER_LLM_BASE_URL = "https://api.deepseek.com";
    process.env.DOC_MAKER_LLM_MODEL = "deepseek-v4-pro";

    const settings = getLLMRuntimeSettings();

    expect(resolveModelForNode(settings, "scope_extraction")).toBe("deepseek-v4-pro");
    expect(resolveModelForNode(settings, "precheck_normalization")).toBe("deepseek-v4-pro");
  });
});
