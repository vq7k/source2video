import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
            <Badge variant="muted" className="font-mono">
              L2
            </Badge>
            <span className="text-xs text-muted-foreground">总览层</span>
          </div>
        </div>
        <h1 className="text-xl font-semibold">doc-maker · 总览控制台</h1>
        <p className="text-xs text-muted-foreground">
          诊断导航视角 · 本页只展示在线指示、最近 artifact_id 与 readiness，不展示 pass-rate / materials analytics
        </p>
      </header>

      <NodeGrid />

      <footer className="mt-10 text-center text-xs text-muted-foreground">
        L2 单向跳转 → L3 · 只做诊断入口，不做跨节点分析看板
      </footer>
    </main>
  );
}
