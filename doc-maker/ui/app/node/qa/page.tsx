import Link from "next/link";
import { CheckCircle2, AlertTriangle, ArrowRight, ArrowUp } from "lucide-react";

import { ConsoleHeader } from "@/components/l3/console-header";
import { MaterialsBadges } from "@/components/l3/materials-badges";
import { ArtifactPanel } from "@/components/l3/artifact-panel";
import { DecisionTracePanel } from "@/components/l3/decision-trace-panel";
import { NodeMetricsBar } from "@/components/l3/node-metrics-bar";
import { RerunPanel } from "@/components/l3/rerun-panel";
import { FeedbackDialog } from "@/components/l3/feedback-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { qaArtifact } from "@/lib/mock";

export default function QaConsolePage() {
  const a = qaArtifact;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-5 px-6 py-8">
      <ConsoleHeader
        title="source2video · QA 节点控制台"
        artifactId={a.artifact_id}
        extraRight={
          <Badge
            variant={a.overall_verdict === "pass" ? "secondary" : "destructive"}
            className="font-mono"
          >
            总判定：{a.overall_verdict === "pass" ? "通过" : "不通过"}
          </Badge>
        }
      />

      <section>
        <h3 className="mb-2 text-sm font-medium">物料（Materials）</h3>
        <MaterialsBadges materials={a.materials} />
      </section>

      <ArtifactPanel
        title="QA 报告 · Episode 一致性"
        metadata={[
          { key: "Episode 标识", value: a.episode_id },
          { key: "Plan 产物标识", value: a.plan_artifact_id },
          { key: "shot 检查数", value: `${a.shot_artifact_ids.length} 个` },
          { key: "时间", value: a.timestamp },
          { key: "用 token", value: a.token_used.toLocaleString() },
          { key: "成本", value: `$${a.cost_usd.toFixed(2)}` },
        ]}
      >
        <ul className="space-y-3">
          {a.issues.map((issue, idx) => (
            <li key={`${issue.dimension}-${idx}`}>
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 inline-flex items-center gap-1 font-mono text-xs",
                    issue.verdict === "pass"
                      ? "text-foreground"
                      : "text-destructive",
                  )}
                >
                  {issue.verdict === "pass" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  {issue.verdict === "pass" ? "通过" : "不通过"}
                </span>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{issue.dimension}</p>
                    {issue.affected_shots.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {issue.affected_shots.map((s) => (
                          <Link
                            key={s}
                            href={`/node/shot/${s}`}
                            className="rounded-sm border bg-muted px-1.5 py-0.5 font-mono text-[11px] hover:bg-accent"
                          >
                            {s}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs">{issue.description}</p>
                  <p className="text-xs text-muted-foreground">
                    建议：{issue.recommended_action}
                  </p>
                  {issue.verdict === "fail" && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {issue.affected_shots.map((s) => (
                        <Button asChild key={s} variant="outline" size="sm" className="h-7">
                          <Link href={`/node/shot/${s}`}>
                            <ArrowRight className="mr-1 h-3 w-3" />
                            修 {s}
                          </Link>
                        </Button>
                      ))}
                      <Button asChild variant="outline" size="sm" className="h-7">
                        <Link href={`/node/plan?artifact=${a.plan_artifact_id}`}>
                          <ArrowUp className="mr-1 h-3 w-3" />
                          回 Plan 调整 scope
                        </Link>
                      </Button>
                      <FeedbackDialog
                        location={`qa.${issue.dimension}`}
                        artifactId={a.artifact_id}
                      />
                    </div>
                  )}
                </div>
              </div>
              {idx < a.issues.length - 1 && <Separator className="mt-3" />}
            </li>
          ))}
        </ul>
      </ArtifactPanel>

      <Card className="p-5">
        <h3 className="mb-2 text-sm font-medium">跳回链路</h3>
        <p className="text-xs text-muted-foreground">
          QA 不通过 → 修 plan 或 shot。本节点不能"自动 fix"——任何修改都必须经 Plan / Shot 控制台触发对应物料 / scope 调整（ADR-014：节点代码不动，物料改）。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/node/plan?artifact=${a.plan_artifact_id}`}>
              <ArrowRight className="mr-1.5 h-3 w-3" />
              Plan 节点控制台
            </Link>
          </Button>
          {a.issues
            .filter((i) => i.verdict === "fail")
            .flatMap((i) => i.affected_shots)
            .map((s) => (
              <Button asChild key={s} variant="outline" size="sm">
                <Link href={`/node/shot/${s}`}>
                  <ArrowRight className="mr-1.5 h-3 w-3" />
                  Shot {s}
                </Link>
              </Button>
            ))}
        </div>
      </Card>

      <DecisionTracePanel trace={a.decision_trace} />

      <NodeMetricsBar metrics={a.metrics} />

      <RerunPanel
        node="qa"
        caseOptions={[a.episode_id]}
        materialVersions={["v1.0"]}
      />

      <footer className="pt-4 text-center text-xs text-muted-foreground">
        Episode QA · 5 维度（duration_alignment / style_drift / transition / terminology / coverage）· fail 不自动 fix，跳回 plan 或 shot
      </footer>
    </main>
  );
}
