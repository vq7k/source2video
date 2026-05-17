import { NextResponse } from "next/server";

import { discoverLLMRuntimeModels } from "@/lib/llm/model-discovery";
import {
  readLLMRuntimeSettings,
  type LLMProviderKind,
  type LLMRuntimeSettings,
} from "@/lib/llm/settings";

export const runtime = "nodejs";

function isProvider(value: string | null): value is LLMProviderKind {
  return value === "mock" || value === "ollama" || value === "openai-compatible";
}

export async function GET(request: Request) {
  const current = await readLLMRuntimeSettings();
  const params = new URL(request.url).searchParams;
  const providerParam = params.get("provider");

  if (providerParam && !isProvider(providerParam)) {
    return NextResponse.json({ ok: false, message: "不支持的模型提供方。", models: [] }, { status: 400 });
  }
  const provider: LLMProviderKind = providerParam && isProvider(providerParam) ? providerParam : current.provider;

  const settings: LLMRuntimeSettings = {
    ...current,
    provider,
    baseUrl: params.get("baseUrl") ?? current.baseUrl,
    model: params.get("model") ?? current.model,
  };

  try {
    return NextResponse.json(await discoverLLMRuntimeModels(settings));
  } catch (error) {
    return NextResponse.json({
      ok: false,
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      models: [],
      message: error instanceof Error ? error.message : "模型发现失败。",
    });
  }
}
