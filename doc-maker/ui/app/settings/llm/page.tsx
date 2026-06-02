import Link from "next/link";
import { ArrowLeft, GitBranch, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readLLMRuntimeSettings, toLLMRuntimeSettingsView } from "@doc-maker/writing-domain/llm/settings";
import { LLMSettingsForm } from "./llm-settings-form";

export default async function LLMSettingsPage() {
  const settings = toLLMRuntimeSettingsView(await readLLMRuntimeSettings());

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-8 text-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-xl border-2 border-zinc-900 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                  <Link href="/">
                    <ArrowLeft className="mr-1 size-3.5" />
                    返回工作台
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                  <Link href="/framework">
                    <GitBranch className="mr-1 size-3.5" />
                    诊断
                  </Link>
                </Button>
                <Badge variant="secondary">运行时</Badge>
                <Badge variant="outline">{settings.provider}</Badge>
              </div>
              <h1 className="mt-4 flex items-center gap-2 text-2xl font-semibold">
                <Settings2 className="size-5" />
                LLM 运行配置
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                配置后续任务使用的模型运行时。规则范围、生成前检查、候选生成、反馈分析和规则草稿都会经过统一模型提供方；TraceSink 会继续记录 provider、model、prompt version、输入和输出。
              </p>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-3 lg:w-[520px]">
              <Metric label="模型提供方" value={settings.provider} />
              <Metric label="模型" value={settings.model || "无"} />
              <Metric label="API Key" value={settings.apiKeyConfigured ? "已配置" : "缺失"} />
            </div>
          </div>
        </header>

        <LLMSettingsForm initialSettings={settings} />
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-zinc-50 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-mono text-sm font-semibold [overflow-wrap:anywhere]">{value}</div>
    </div>
  );
}
