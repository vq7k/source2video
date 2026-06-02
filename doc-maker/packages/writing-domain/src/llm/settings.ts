import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type LLMProviderKind = "mock" | "ollama" | "openai-compatible";

export type LLMNodeModelKey =
  | "scope_extraction"
  | "precheck_normalization"
  | "candidate_generation"
  | "feedback_reasoning"
  | "rule_patch_compilation";

export type LLMRuntimeSettings = {
  provider: LLMProviderKind;
  baseUrl: string;
  model: string;
  modelOverrides: Partial<Record<LLMNodeModelKey, string>>;
  updatedAt: string;
};

export type LLMRuntimeSettingsView = LLMRuntimeSettings & {
  apiKeyConfigured: boolean;
  apiKeyEnvNames: string[];
  storagePath: string;
};

const SETTINGS_DIR = path.join(process.cwd(), ".doc-maker-runtime");
const SETTINGS_PATH = path.join(SETTINGS_DIR, "llm-settings.json");
const API_KEY_ENV_NAMES = ["DOC_MAKER_LLM_API_KEY", "OPENAI_API_KEY"];

export const DEFAULT_LLM_SETTINGS: LLMRuntimeSettings = {
  provider: "openai-compatible",
  baseUrl: "http://localhost:8317/v1",
  model: "gpt-5.5",
  modelOverrides: {
    scope_extraction: "gpt-5.4-mini",
    precheck_normalization: "gpt-5.4-mini",
    feedback_reasoning: "gpt-5.4-mini",
    rule_patch_compilation: "gpt-5.4-mini",
  },
  updatedAt: "baseline",
};

function now() {
  return new Date().toISOString();
}

function defaultsFor(provider: LLMProviderKind): Pick<LLMRuntimeSettings, "baseUrl" | "model"> {
  switch (provider) {
    case "ollama":
      return {
        baseUrl: "http://localhost:11434",
        model: "gemma4:e4b",
      };
    case "openai-compatible":
      return {
        baseUrl: "http://localhost:8317/v1",
        model: "gpt-5.5",
      };
    case "mock":
      return {
        baseUrl: "",
        model: "mock-llm/rule-scope-v0",
      };
  }
}

function isProvider(value: unknown): value is LLMProviderKind {
  return value === "mock" || value === "ollama" || value === "openai-compatible";
}

function defaultModelOverrides(provider: LLMProviderKind): Partial<Record<LLMNodeModelKey, string>> {
  if (provider !== "openai-compatible") {
    return {};
  }

  return DEFAULT_LLM_SETTINGS.modelOverrides;
}

function normalizeModelOverrides(
  provider: LLMProviderKind,
  input: Partial<Record<LLMNodeModelKey, unknown>> | undefined,
) {
  const defaults = defaultModelOverrides(provider);
  const output: Partial<Record<LLMNodeModelKey, string>> = { ...defaults };
  const keys: LLMNodeModelKey[] = [
    "scope_extraction",
    "precheck_normalization",
    "candidate_generation",
    "feedback_reasoning",
    "rule_patch_compilation",
  ];

  for (const key of keys) {
    const value = input?.[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        output[key] = trimmed;
      } else {
        delete output[key];
      }
    }
  }

  return output;
}

function normalizeSettings(input: Partial<LLMRuntimeSettings>): LLMRuntimeSettings {
  const provider = isProvider(input.provider) ? input.provider : DEFAULT_LLM_SETTINGS.provider;
  const defaults = defaultsFor(provider);

  return {
    provider,
    baseUrl: typeof input.baseUrl === "string" && input.baseUrl.trim() ? input.baseUrl.trim() : defaults.baseUrl,
    model: typeof input.model === "string" && input.model.trim() ? input.model.trim() : defaults.model,
    modelOverrides: normalizeModelOverrides(provider, input.modelOverrides),
    updatedAt: typeof input.updatedAt === "string" && input.updatedAt ? input.updatedAt : now(),
  };
}

export function resolveModelForNode(settings: LLMRuntimeSettings, node: LLMNodeModelKey) {
  return settings.modelOverrides[node]?.trim() || settings.model;
}

export function getLLMRuntimeSettings(): LLMRuntimeSettings {
  if (process.env.DOC_MAKER_LLM_PROVIDER && isProvider(process.env.DOC_MAKER_LLM_PROVIDER)) {
    const provider = process.env.DOC_MAKER_LLM_PROVIDER;
    const defaults = defaultsFor(provider);
    return normalizeSettings({
      provider,
      baseUrl: process.env.DOC_MAKER_LLM_BASE_URL || defaults.baseUrl,
      model: process.env.DOC_MAKER_LLM_MODEL || defaults.model,
      updatedAt: "env",
    });
  }

  if (!existsSync(SETTINGS_PATH)) {
    return DEFAULT_LLM_SETTINGS;
  }

  try {
    return normalizeSettings(JSON.parse(readFileSync(SETTINGS_PATH, "utf8")) as Partial<LLMRuntimeSettings>);
  } catch {
    return DEFAULT_LLM_SETTINGS;
  }
}

export async function readLLMRuntimeSettings() {
  try {
    return normalizeSettings(JSON.parse(await readFile(SETTINGS_PATH, "utf8")) as Partial<LLMRuntimeSettings>);
  } catch {
    return DEFAULT_LLM_SETTINGS;
  }
}

export async function saveLLMRuntimeSettings(input: Partial<LLMRuntimeSettings>) {
  const settings = normalizeSettings({ ...input, updatedAt: now() });
  await mkdir(SETTINGS_DIR, { recursive: true });
  await writeFile(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}

export function getLLMApiKey() {
  for (const envName of API_KEY_ENV_NAMES) {
    const value = process.env[envName];
    if (value) {
      return value;
    }
  }

  return "";
}

export function toLLMRuntimeSettingsView(settings: LLMRuntimeSettings): LLMRuntimeSettingsView {
  return {
    ...settings,
    apiKeyConfigured: Boolean(getLLMApiKey()),
    apiKeyEnvNames: API_KEY_ENV_NAMES,
    storagePath: SETTINGS_PATH,
  };
}
