import { NextResponse } from "next/server";

import { testStructuredJSONRuntime } from "@/lib/llm/providers/structured-json";
import {
  readLLMRuntimeSettings,
  toLLMRuntimeSettingsView,
  type LLMRuntimeSettings,
} from "@/lib/llm/settings";
import { getTraceSink } from "@/lib/trace-sink";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Partial<LLMRuntimeSettings> | null;
  const current = await readLLMRuntimeSettings();
  const settings: LLMRuntimeSettings = {
    ...current,
    ...body,
  };
  const traceSink = getTraceSink();

  try {
    const result = await testStructuredJSONRuntime(settings);
    const trace = await traceSink.captureLLMCall({
      provider: result.provider,
      model: result.model,
      promptVersion: "llm-runtime-test-v0.1",
      nodeType: "scope_extraction",
      inputRefs: ["settings_form"],
      outputArtifact: {
        id: `llm_runtime_test_${Date.now().toString(36)}`,
        kind: "llm_runtime_test",
        label: "LLM 运行测试",
        summary: result.message,
      },
      evalResult: {
        id: `llm_runtime_test_eval_${Date.now().toString(36)}`,
        kind: "runtime_connection_check",
        status: "complete",
        score: null,
      },
      latencyMs: result.latencyMs,
      upstreamTraceId: result.upstreamTraceId,
      inputPayload: result.requestPayload,
      outputPayload: result.responsePayload,
    });

    return NextResponse.json({
      ok: true,
      message: result.message,
      settings: toLLMRuntimeSettingsView(settings),
      trace,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LLM 运行测试失败";
    const trace = await traceSink.captureLLMCall({
      status: "failed",
      provider: settings.provider,
      model: settings.model,
      promptVersion: "llm-runtime-test-v0.1",
      nodeType: "scope_extraction",
      inputRefs: ["settings_form"],
      outputArtifact: {
        id: `llm_runtime_test_failed_${Date.now().toString(36)}`,
        kind: "llm_runtime_test",
        label: "LLM 运行测试",
        summary: message,
      },
      evalResult: {
        id: `llm_runtime_test_eval_${Date.now().toString(36)}`,
        kind: "runtime_connection_check",
        status: "skipped",
        score: null,
      },
      metadata: {
        error: message,
      },
      inputPayload: {
        provider: settings.provider,
        baseUrl: settings.baseUrl,
        model: settings.model,
      },
      outputPayload: {
        error: message,
      },
    });

    return NextResponse.json({
      ok: false,
      message,
      settings: toLLMRuntimeSettingsView(settings),
      trace,
    });
  }
}
