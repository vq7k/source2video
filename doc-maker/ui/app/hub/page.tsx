import Link from "next/link";
import { ArrowLeft, GitBranch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NodeGrid } from "@/components/l2/node-grid";

export default function HubConsolePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-8">
      <header className="mb-6 space-y-2 border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="h-8 px-2">
              <Link href="/">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                返回业务控制台
              </Link>
            </Button>
            <Badge variant="muted">诊断总览</Badge>
            <span className="text-xs text-muted-foreground">节点状态</span>
          </div>
        </div>
        <h1 className="text-xl font-semibold">doc-maker · 节点总览</h1>
        <p className="text-xs text-muted-foreground">
          诊断导航视角 · 本页只展示在线状态、最近产物与检查入口，不承载跨节点分析看板。
        </p>
      </header>

      <NodeGrid />

      <section className="mt-6 rounded-lg border-2 border-zinc-900 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <GitBranch className="size-4" />
              Langfuse 诊断
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              读取真实文本生产任务，按业务节点查看调用记录、评分和评审结果。
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/framework">打开诊断</Link>
          </Button>
        </div>
      </section>

      <footer className="mt-10 text-center text-xs text-muted-foreground">
        只做诊断入口，不做跨节点分析看板。
      </footer>
    </main>
  );
}
