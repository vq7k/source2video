import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ConsoleHeader } from "@/components/l3/console-header";
import { MaterialsBadges } from "@/components/l3/materials-badges";
import { ArtifactPanel } from "@/components/l3/artifact-panel";
import { EvalAttributionPanel } from "@/components/l3/eval-attribution-panel";
import { DecisionTracePanel } from "@/components/l3/decision-trace-panel";
import { NodeMetricsBar } from "@/components/l3/node-metrics-bar";
import { RerunPanel } from "@/components/l3/rerun-panel";
import { FeedbackDialog } from "@/components/l3/feedback-dialog";
import { StoryboardReadiness } from "@/components/l3/storyboard-readiness";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { planArtifact } from "@/lib/mock";

interface PageProps {
  searchParams?: Promise<{ artifact?: string }>;
}

export default async function PlanConsolePage({ searchParams }: PageProps) {
  const artifactParam = (await searchParams)?.artifact;
  const a = planArtifact;
  const totalDuration = a.shots.reduce(
    (acc, s) => acc + s.target_duration_seconds,
    0,
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-5 px-6 py-8">
      <ConsoleHeader
        title="source2video · Plan 节点控制台"
        artifactId={a.artifact_id}
      />

      <StoryboardReadiness scope="Plan 诊断页" artifactParam={artifactParam} />

      <section>
        <h3 className="mb-2 text-sm font-medium">
          物料（Materials）{" "}
          <span className="text-xs font-normal text-muted-foreground">
            （点击徽章看物料 diff）
          </span>
        </h3>
        <MaterialsBadges materials={a.materials} />
      </section>

      <ArtifactPanel
        title="Plan 产物"
        metadata={[
          { key: "Episode 标识", value: a.episode_id },
          { key: "输入用例", value: a.case_id },
          { key: "时间", value: a.timestamp },
          { key: "目标时长", value: `${a.target_duration_seconds}s` },
          { key: "实际总时长", value: `${totalDuration}s (Δ ${totalDuration - a.target_duration_seconds}s)` },
          { key: "迭代轮数", value: `${a.revision_count} 轮` },
          { key: "用 token", value: a.token_used.toLocaleString() },
          { key: "成本", value: `$${a.cost_usd.toFixed(2)}` },
        ]}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">标题</span>
              <span className="font-medium">{a.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">叙事弧</span>
              <span>{a.narrative_arc}</span>
            </div>
          </div>
        </div>
      </ArtifactPanel>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3">
          <h3 className="text-sm font-medium">
            Shot 列表{" "}
            <span className="font-normal text-muted-foreground">
              ({a.shots.length} 个)
            </span>
          </h3>
          <p className="text-xs text-muted-foreground">
            点 shot_id → 跳 Shot 节点控制台
          </p>
        </div>
        <div className="border-t">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium">shot_id</th>
                <th className="px-3 py-2 text-left font-medium">意图</th>
                <th className="px-3 py-2 text-left font-medium">范围</th>
                <th className="px-3 py-2 text-right font-medium">时长</th>
                <th className="px-3 py-2 text-left font-medium">关键概念</th>
                <th className="px-3 py-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {a.shots.map((s) => (
                <tr key={s.shot_id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono">
                    <Link
                      href={`/node/shot/${s.shot_id}`}
                      className="hover:underline"
                    >
                      {s.shot_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="muted" className="font-mono">
                      {s.intent}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{s.scope}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {s.target_duration_seconds}s
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {s.key_concepts.join(" · ")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <FeedbackDialog
                        location={`shots[${s.shot_id}]`}
                        artifactId={a.artifact_id}
                      />
                      <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                        <Link href={`/node/shot/${s.shot_id}`}>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <EvalAttributionPanel
        title="跨步评估（4 步链整体）"
        description="executability 是 Plan 节点唯一真相——给定 shot slice，下游能否独立执行（business-design §3.4）。"
        dimensions={a.cross_step_eval}
      />

      <DecisionTracePanel
        trace={a.decision_trace}
        stepLabels={["内容消化", "叙事弧规划", "Shot 切分", "Evaluator-Optimizer"]}
      />

      <NodeMetricsBar metrics={a.metrics} />

      <RerunPanel
        node="plan"
        caseOptions={["ml_lr_e04b_source", "ml_knn_e02a_source"]}
        materialVersions={["v1.2", "v1.1", "v1.0"]}
        defaultVersion="v1.2"
      />

      <footer className="pt-4 text-center text-xs text-muted-foreground">
        Plan 节点 4 步链 · 物料版本快照 + 每步 prompt 独立 bump（business-design §3）
      </footer>
    </main>
  );
}
