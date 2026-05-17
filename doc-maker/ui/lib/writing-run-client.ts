import type {
  CompileRulePatchInput,
  CreateWritingRunInput,
  DeriveWritingRuleScopeInput,
  FinalizeWritingRunInput,
  HumanFeedbackInput,
  RunGenerationBatchInput,
  WritingRuleScopeRecord,
  WritingRunRecord,
} from "@/lib/writing-run-types";

type ClientRequestOptions = {
  signal?: AbortSignal;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`请求失败：${url}`);
  }

  return response.json() as Promise<T>;
}

export async function deriveRuleScope(input: DeriveWritingRuleScopeInput, options: ClientRequestOptions = {}) {
  return requestJson<{ ruleScope: WritingRuleScopeRecord }>("/api/writing-runs/scope", {
    method: "POST",
    signal: options.signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function createWritingRunRecord(input: CreateWritingRunInput, options: ClientRequestOptions = {}) {
  return requestJson<{ run: WritingRunRecord }>("/api/writing-runs", {
    method: "POST",
    signal: options.signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function listWritingRuns() {
  return requestJson<{ runs: WritingRunRecord[] }>("/api/writing-runs");
}

export async function confirmWritingRun(runId: string, options: ClientRequestOptions = {}) {
  return requestJson<{ run: WritingRunRecord }>(`/api/writing-runs/${runId}/confirm`, {
    method: "POST",
    signal: options.signal,
  });
}

export async function recordWritingFeedback(runId: string, input: HumanFeedbackInput, options: ClientRequestOptions = {}) {
  return requestJson<{ run: WritingRunRecord }>(`/api/writing-runs/${runId}/feedback`, {
    method: "POST",
    signal: options.signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteWritingFeedback(runId: string, feedbackId: string, options: ClientRequestOptions = {}) {
  return requestJson<{ run: WritingRunRecord }>(`/api/writing-runs/${runId}/feedback`, {
    method: "DELETE",
    signal: options.signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ feedbackId }),
  });
}

export async function compileWritingRulePatch(runId: string, input: CompileRulePatchInput, options: ClientRequestOptions = {}) {
  return requestJson<{ run: WritingRunRecord }>(`/api/writing-runs/${runId}/rule-patches`, {
    method: "POST",
    signal: options.signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function runWritingGenerationBatch(
  runId: string,
  input: RunGenerationBatchInput = {},
  options: ClientRequestOptions = {},
) {
  return requestJson<{ run: WritingRunRecord }>(`/api/writing-runs/${runId}/generation-batch`, {
    method: "POST",
    signal: options.signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function finalizeWritingRunRecord(
  runId: string,
  input: FinalizeWritingRunInput,
  options: ClientRequestOptions = {},
) {
  return requestJson<{ run: WritingRunRecord }>(`/api/writing-runs/${runId}/finalize`, {
    method: "POST",
    signal: options.signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}
