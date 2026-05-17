import { getLLMApiKey, type LLMRuntimeSettings } from "@/lib/llm/settings";

export type LLMRuntimeModel = {
  id: string;
  ownedBy?: string;
};

export type LLMRuntimeModelDiscoveryResult = {
  ok: boolean;
  provider: LLMRuntimeSettings["provider"];
  baseUrl: string;
  models: LLMRuntimeModel[];
  message: string;
};

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function modelEndpoint(settings: LLMRuntimeSettings) {
  const baseUrl = trimSlash(settings.baseUrl);
  if (settings.provider === "ollama") {
    return `${baseUrl}/api/tags`;
  }
  if (baseUrl.endsWith("/models")) {
    return baseUrl;
  }
  if (baseUrl.endsWith("/chat/completions")) {
    return baseUrl.replace(/\/chat\/completions$/, "/models");
  }
  return `${baseUrl}/models`;
}

function normalizeOpenAIModels(payload: unknown): LLMRuntimeModel[] {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const data = Array.isArray(record.data) ? record.data : [];
  return data
    .map((item) => {
      const model = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        id: typeof model.id === "string" ? model.id : "",
        ownedBy: typeof model.owned_by === "string" ? model.owned_by : undefined,
      };
    })
    .filter((item) => item.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeOllamaModels(payload: unknown): LLMRuntimeModel[] {
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const data = Array.isArray(record.models) ? record.models : [];
  return data
    .map((item) => {
      const model = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const id = typeof model.name === "string"
        ? model.name
        : typeof model.model === "string"
          ? model.model
          : "";
      return {
        id,
        ownedBy: typeof model.modified_at === "string" ? "local ollama" : undefined,
      };
    })
    .filter((item) => item.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function discoverLLMRuntimeModels(settings: LLMRuntimeSettings): Promise<LLMRuntimeModelDiscoveryResult> {
  if (settings.provider === "mock") {
    return {
      ok: true,
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      models: [{ id: settings.model || "mock-llm/rule-scope-v0" }],
      message: "本地模拟运行只有一个内置模型",
    };
  }

  if (!settings.baseUrl) {
    return {
      ok: false,
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      models: [],
      message: "Base URL is required before loading models.",
    };
  }

  const apiKey = getLLMApiKey();
  const response = await fetch(modelEndpoint(settings), {
    headers: settings.provider === "openai-compatible" && apiKey
      ? { authorization: `Bearer ${apiKey}` }
      : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Model discovery failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  const models = settings.provider === "ollama"
    ? normalizeOllamaModels(payload)
    : normalizeOpenAIModels(payload);

  return {
    ok: true,
    provider: settings.provider,
    baseUrl: settings.baseUrl,
    models,
    message: models.length ? `loaded ${models.length} models` : "No models returned by runtime.",
  };
}
