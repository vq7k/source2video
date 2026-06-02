import type {
  CompileRulePatchInput,
  CreateRulePackageDraftInput,
  CreateWritingRunInput,
  DeriveWritingRuleScopeInput,
  FinalizeWritingRunInput,
  HumanFeedbackInput,
  PublishRulePackageInput,
  RecordTopicContextInput,
  RulePackageRecord,
  RunGenerationBatchInput,
  WritingRuleScopeRecord,
  WritingRunRecord,
} from "@doc-maker/writing-domain/types";

type ClientRequestOptions = {
  signal?: AbortSignal;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `请求失败：${url} (${response.status} ${response.statusText})${detail ? ` - ${detail.slice(0, 180)}` : ""}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function deriveRuleScope(input: DeriveWritingRuleScopeInput, options: ClientRequestOptions = {}) {
  return requestJson<{ ruleScope: WritingRuleScopeRecord; run: WritingRunRecord }>("/api/writing-runs/scope", {
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
  return requestJson<{ runs: WritingRunRecord[] }>("/api/writing-runs", { cache: "no-store" });
}

export async function listRulePackages() {
  return requestJson<{ rulePackages: RulePackageRecord[] }>("/api/rule-packages");
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

export async function recordWritingTopicContext(
  runId: string,
  input: RecordTopicContextInput,
  options: ClientRequestOptions = {},
) {
  return requestJson<{ run: WritingRunRecord }>(`/api/writing-runs/${runId}/topic-context`, {
    method: "POST",
    signal: options.signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
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

export async function createRulePackageDraft(
  runId: string,
  input: CreateRulePackageDraftInput = {},
  options: ClientRequestOptions = {},
) {
  return requestJson<{ run: WritingRunRecord; rulePackage: RulePackageRecord }>(`/api/writing-runs/${runId}/rule-package`, {
    method: "POST",
    signal: options.signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function publishRulePackageDraft(
  runId: string,
  input: PublishRulePackageInput,
  options: ClientRequestOptions = {},
) {
  return requestJson<{ run: WritingRunRecord; rulePackage: RulePackageRecord }>(`/api/writing-runs/${runId}/rule-package`, {
    method: "PATCH",
    signal: options.signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}
