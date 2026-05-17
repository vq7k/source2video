import { mockLLMProvider } from "@/lib/llm/providers/mock";
import { createStructuredJSONProvider } from "@/lib/llm/providers/structured-json";
import { getLLMRuntimeSettings } from "@/lib/llm/settings";
import type { LLMProvider } from "@/lib/llm/types";

export function getLLMProvider(): LLMProvider {
  const settings = getLLMRuntimeSettings();
  if (settings.provider === "mock") {
    return mockLLMProvider;
  }

  return createStructuredJSONProvider(settings);
}
