"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FlaskConical, RefreshCw, Save, ShieldAlert, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { LLMNodeModelKey, LLMProviderKind, LLMRuntimeSettingsView } from "@doc-maker/writing-domain/llm/settings";

type TestResult = {
  ok: boolean;
  message: string;
  trace?: {
    id: string;
    provider: string;
    model: string;
    status: string;
    latencyMs?: number;
  };
};

type ModelOption = {
  id: string;
  ownedBy?: string;
};

type ModelDiscoveryResult = {
  ok: boolean;
  message: string;
  models: ModelOption[];
};

const providerCopy: Record<LLMProviderKind, string> = {
  mock: "本地模拟运行，不访问外部模型",
  ollama: "本机 Ollama，适合先跑真实本地模型",
  "openai-compatible": "OpenAI-compatible endpoint，API Key 只读 env",
};

const providerDefaults: Record<LLMProviderKind, { baseUrl: string; model: string }> = {
  mock: {
    baseUrl: "",
    model: "mock-llm/rule-scope-v0",
  },
  ollama: {
    baseUrl: "http://localhost:11434",
    model: "gemma4:e4b",
  },
  "openai-compatible": {
    baseUrl: "http://localhost:8317/v1",
    model: "gpt-5.5",
  },
};

const nodeModelRows: Array<{
  key: LLMNodeModelKey;
  label: string;
  description: string;
}> = [
  {
    key: "scope_extraction",
    label: "规则范围提炼",
    description: "轻处理：从一句话/参考文本提炼结构、语气、禁忌。",
  },
  {
    key: "precheck_normalization",
    label: "生成前检查",
    description: "轻处理：清洗输入契约、生成 brief 和风险项。",
  },
  {
    key: "candidate_generation",
    label: "候选正文生成",
    description: "重处理：长文本正文生成，默认使用全局质量模型。",
  },
  {
    key: "feedback_reasoning",
    label: "反馈原因分析",
    description: "轻处理：把选中文本/标签归因成反馈原因。",
  },
  {
    key: "rule_patch_compilation",
    label: "规则草稿编译",
    description: "轻处理：把反馈压缩成下一轮规则草稿。",
  },
];

const defaultFastModel = "gpt-5.4-mini";

export function LLMSettingsForm({ initialSettings }: { initialSettings: LLMRuntimeSettingsView }) {
  const [settings, setSettings] = useState(initialSettings);
  const [busy, setBusy] = useState<"save" | "test" | "models" | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [modelResult, setModelResult] = useState<ModelDiscoveryResult | null>(null);

  const providerHint = useMemo(() => providerCopy[settings.provider], [settings.provider]);

  function update(field: keyof LLMRuntimeSettingsView, value: string) {
    setSettings((current) => ({
      ...current,
      ...(field === "provider"
        ? {
            provider: value as LLMProviderKind,
            ...providerDefaults[value as LLMProviderKind],
            modelOverrides:
              value === "openai-compatible"
                ? {
                    scope_extraction: defaultFastModel,
                    precheck_normalization: defaultFastModel,
                    feedback_reasoning: defaultFastModel,
                    rule_patch_compilation: defaultFastModel,
                  }
                : {},
          }
        : { [field]: value }),
    }));
    setResult(null);
    if (field === "provider" || field === "baseUrl") {
      setModelResult(null);
    }
  }

  function updateNodeModel(node: LLMNodeModelKey, value: string) {
    setSettings((current) => ({
      ...current,
      modelOverrides: {
        ...(current.modelOverrides ?? {}),
        [node]: value,
      },
    }));
    setResult(null);
  }

  function effectiveNodeModel(node: LLMNodeModelKey) {
    return settings.modelOverrides?.[node]?.trim() || settings.model;
  }

  async function saveSettings() {
    setBusy("save");
    setResult(null);
    try {
      const response = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      setSettings(data.settings);
      setResult({ ok: true, message: "LLM 运行配置已保存。" });
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : "保存失败" });
    } finally {
      setBusy(null);
    }
  }

  async function testCall() {
    setBusy("test");
    setResult(null);
    try {
      const response = await fetch("/api/settings/llm/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : "测试失败" });
    } finally {
      setBusy(null);
    }
  }

  async function loadModels() {
    setBusy("models");
    setResult(null);
    setModelResult(null);
    try {
      const params = new URLSearchParams({
        provider: settings.provider,
        baseUrl: settings.baseUrl,
        model: settings.model,
      });
      const response = await fetch(`/api/settings/llm/models?${params.toString()}`);
      const data = await response.json();
      setModelResult(data);
    } catch (error) {
      setModelResult({
        ok: false,
        message: error instanceof Error ? error.message : "加载模型失败",
        models: [],
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="rounded-xl border-2 border-zinc-900 bg-white">
        <CardHeader>
          <CardTitle className="text-base">运行配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="space-y-2">
              <span className="text-sm font-medium">模型提供方</span>
            <select
              value={settings.provider}
              onChange={(event) => update("provider", event.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="mock">本地模拟运行</option>
              <option value="ollama">ollama</option>
              <option value="openai-compatible">openai-compatible</option>
            </select>
            <p className="text-xs text-muted-foreground">{providerHint}</p>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">Base URL</span>
              <Input
                value={settings.baseUrl}
                onChange={(event) => update("baseUrl", event.target.value)}
                placeholder="http://localhost:11434"
                disabled={settings.provider === "mock"}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">模型</span>
              <Input
                value={settings.model}
                onChange={(event) => update("model", event.target.value)}
                placeholder="gemma4:e4b"
              />
            </label>
          </div>

          <section className="rounded-lg border bg-zinc-50 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">可用模型</div>
                <p className="text-xs text-muted-foreground">
                  从当前模型提供方拉取模型列表；仍保留手填，方便使用未列出的代理模型。
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={loadModels} disabled={Boolean(busy)}>
                <RefreshCw className="size-4" />
                {busy === "models" ? "加载中..." : "加载模型"}
              </Button>
            </div>
            {modelResult ? (
              <div className="mt-3 space-y-2">
                <p className={modelResult.ok ? "text-xs text-emerald-700" : "text-xs text-red-700"}>
                  {modelResult.message}
                </p>
                {modelResult.models.length ? (
                  <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
                    {modelResult.models.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => update("model", model.id)}
                        className={
                          model.id === settings.model
                            ? "rounded-full border border-zinc-950 bg-white px-3 py-1 text-xs font-medium text-zinc-950"
                            : "rounded-full border bg-white px-3 py-1 text-xs text-zinc-700 hover:border-zinc-400"
                        }
                        title={model.ownedBy}
                      >
                        {model.id}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border bg-zinc-50 p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-medium">节点模型路由</div>
                <p className="text-xs text-muted-foreground">
                  简单节点用快速模型，候选正文保留质量模型；留空表示继承全局模型。
                </p>
              </div>
              <Badge variant="secondary">per-node</Badge>
            </div>
            <div className="mt-3 grid gap-3">
              {nodeModelRows.map((row) => (
                <div key={row.key} className="rounded-lg border bg-white p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{row.label}</div>
                      <p className="mt-1 text-xs text-muted-foreground">{row.description}</p>
                    </div>
                    <Input
                      value={settings.modelOverrides?.[row.key] ?? ""}
                      onChange={(event) => updateNodeModel(row.key, event.target.value)}
                      placeholder={`继承 ${settings.model}`}
                      className="lg:w-56"
                    />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    实际使用：<span className="font-mono">{effectiveNodeModel(row.key)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-zinc-50 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={settings.apiKeyConfigured ? "secondary" : "outline"}>
                {settings.apiKeyConfigured ? "API Key 环境变量已就绪" : "未检测到 API Key 环境变量"}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {settings.apiKeyEnvNames.join(" / ")}
              </span>
            </div>
            <p className="mt-2 text-muted-foreground">
              API Key 不在页面输入，也不写入本地 JSON。需要 key 的 endpoint 只从 env 读取。
            </p>
          </section>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveSettings} disabled={Boolean(busy)}>
              <Save className="size-4" />
              {busy === "save" ? "保存中..." : "保存配置"}
            </Button>
            <Button variant="outline" onClick={testCall} disabled={Boolean(busy)}>
              <FlaskConical className="size-4" />
              {busy === "test" ? "测试中..." : "测试调用"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl bg-white">
        <CardHeader>
          <CardTitle className="text-base">当前生效</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <RuntimeRow label="模型提供方" value={settings.provider} />
          <RuntimeRow label="Base URL" value={settings.baseUrl || "无"} />
          <RuntimeRow label="全局模型" value={settings.model || "无"} />
          <RuntimeRow label="规则范围模型" value={effectiveNodeModel("scope_extraction")} />
          <RuntimeRow label="候选生成模型" value={effectiveNodeModel("candidate_generation")} />
          <RuntimeRow label="更新时间" value={settings.updatedAt} />
          <RuntimeRow label="存储位置" value={settings.storagePath} />

          {result ? (
            <div className={result.ok ? "rounded-lg border border-emerald-200 bg-emerald-50 p-3" : "rounded-lg border border-red-200 bg-red-50 p-3"}>
              <div className="flex items-center gap-2 font-medium">
                {result.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                {result.ok ? "测试通过" : "测试失败"}
              </div>
              <p className="mt-2 break-words text-xs leading-5 [overflow-wrap:anywhere]">{result.message}</p>
              {result.trace ? (
                <p className="mt-2 break-words font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {result.trace.id} · {result.trace.provider} / {result.trace.model}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-zinc-50 p-3 text-xs text-muted-foreground">
              保存只改变后续 run；旧 run 的 trace 不会被改写。
            </div>
          )}

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <ShieldAlert className="size-4" />
              风险边界
            </div>
            模型提供方仍是统一 endpoint；每个业务节点可选择不同模型。真实调用失败不会生成本地 mock，trace 会保留失败信息。
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RuntimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-zinc-50 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-mono text-sm [overflow-wrap:anywhere]">{value}</div>
    </div>
  );
}
