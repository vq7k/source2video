import Link from "next/link";
import { ArrowLeft, RefreshCw, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StoryboardReadiness } from "@/components/l3/storyboard-readiness";
import { planArtifact } from "@/lib/mock";

export default function ShotNodeOverviewPage() {
  const shots = planArtifact.shots;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-8">
      <header className="space-y-1.5 border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="h-8 px-2">
              <Link href="/hub">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                总览控制台
              </Link>
            </Button>
            <Badge variant="muted">节点诊断</Badge>
            <span className="text-xs text-muted-foreground">Shot 总览</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              <RefreshCw className="mr-1 h-3 w-3" />
              重跑（按 shot 进入）
            </Button>
          </div>
        </div>
        <h1 className="text-lg font-semibold">Shot 节点控制台 · 总览</h1>
        <p className="text-xs text-muted-foreground">
          ShotExecutionNode 是 per-instance 节点（每个 shot 一次调用，每个 shot 一份产物）
        </p>
      </header>

      <div className="mt-6 grid gap-4">
        <StoryboardReadiness scope="Shot 总览页" />

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex gap-3 pt-6 text-sm leading-relaxed">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="space-y-1.5">
              <p>
                <strong>没有"单一 shot 节点 artifact"</strong>——一个 Episode 跑出 N 个独立 shot 产物（如{" "}
                <code className="rounded bg-muted px-1 font-mono">ml_lr_e04b_shot_03_run_...</code>）。每个 shot 都有自己的 console。
              </p>
              <p className="text-xs text-muted-foreground">
                通常入口：从{" "}
                <Link href="/node/plan" className="font-medium text-primary hover:underline">
                  Plan 控制台
                </Link>{" "}
                shot list 表格点 shot_id 进入。下面列出最近 Episode（ml_lr_e04b）的 shot，可直接选。
              </p>
              <p className="text-xs text-muted-foreground">
                跟 toy / plan / qa 不一样——那三个节点一个 Episode 调一次，所以有"单一节点产物"；Shot 节点是 per-shot 调用（[ADR-002](../../about) 节点粒度纪律：变更频率 + 失败异质性驱动）。
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              最近 Episode · ml_lr_e04b · 线性回归 · 向量与矩阵
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">shot_id</th>
                  <th className="py-2 pr-3 font-medium">intent</th>
                  <th className="py-2 pr-3 font-medium">scope</th>
                  <th className="py-2 pr-3 font-medium">时长</th>
                  <th className="py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {shots.map((shot, idx) => (
                  <tr key={shot.shot_id} className="border-b last:border-0">
                    <td className="py-3 pr-3 text-xs text-muted-foreground">{idx + 1}</td>
                    <td className="py-3 pr-3 font-mono text-xs">{shot.shot_id}</td>
                    <td className="py-3 pr-3">
                      <Badge variant="muted" className="font-mono">
                        {shot.intent}
                      </Badge>
                    </td>
                    <td className="py-3 pr-3 text-xs text-muted-foreground">{shot.scope}</td>
                    <td className="py-3 pr-3 font-mono text-xs">
                      {shot.target_duration_seconds}s
                    </td>
                    <td className="py-3 text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/node/shot/${shot.shot_id}`}>打开 →</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          其它任务的 shot 列表将来通过{" "}
          <code className="rounded bg-muted px-1 font-mono">traces/artifacts/?node=shot</code>{" "}
          扫描得到。
        </p>
      </div>
    </main>
  );
}
