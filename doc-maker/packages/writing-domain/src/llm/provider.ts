import { mockLLMProvider } from "@doc-maker/writing-domain/llm/providers/mock";
import { createStructuredJSONProvider } from "@doc-maker/writing-domain/llm/providers/structured-json";
import { getLLMRuntimeSettings } from "@doc-maker/writing-domain/llm/settings";
import type { LLMProvider } from "@doc-maker/writing-domain/llm/types";

export function getLLMProvider(): LLMProvider {
  const settings = getLLMRuntimeSettings();
  if (settings.provider === "mock") {
    return mockLLMProvider;
  }

  return createStructuredJSONProvider(settings);
}
