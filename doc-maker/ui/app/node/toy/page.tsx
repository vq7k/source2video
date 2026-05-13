import { ConsoleHeader } from "@/components/l3/console-header";
import { MaterialsBadges } from "@/components/l3/materials-badges";
import { ArtifactPanel } from "@/components/l3/artifact-panel";
import { EvalAttributionPanel } from "@/components/l3/eval-attribution-panel";
import { DecisionTracePanel } from "@/components/l3/decision-trace-panel";
import { NodeMetricsBar } from "@/components/l3/node-metrics-bar";
import { RerunPanel } from "@/components/l3/rerun-panel";
import { FeedbackDialog } from "@/components/l3/feedback-dialog";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toyArtifact } from "@/lib/mock";

export default function ToyConsolePage() {
  const a = toyArtifact;
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-5 px-6 py-8">
      <ConsoleHeader title="source2video · Toy 节点控制台" artifactId={a.artifact_id} />

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
        metadata={[
          { key: "输入用例", value: a.case_id },
          { key: "时间", value: a.timestamp },
          { key: "用 token", value: a.token_used.toLocaleString() },
          { key: "延迟", value: `${a.latency_s}s` },
          { key: "成本", value: `$${a.cost_usd.toFixed(3)}` },
        ]}
      >
        <p className="text-xs text-muted-foreground">points:</p>
        <ol className="space-y-2 pl-5 text-sm">
          {a.content.points.map((p, idx) => (
            <li key={idx} className="flex items-start justify-between gap-3">
              <span className="flex-1">
                <span className="mr-2 inline-block w-5 text-right font-mono text-xs text-muted-foreground">
                  {idx + 1}.
                </span>
                {p}
              </span>
              <FeedbackDialog
                location={`points[${idx}]`}
                artifactId={a.artifact_id}
              />
            </li>
          ))}
        </ol>
      </ArtifactPanel>

      <EvalAttributionPanel dimensions={a.eval} />

      <DecisionTracePanel trace={a.decision_trace} />

      <NodeMetricsBar metrics={a.metrics} />

      <Card className="p-5">
        <h3 className="mb-2 text-sm font-medium">反馈历史</h3>
        {a.feedback_history.length === 0 ? (
          <p className="text-xs text-muted-foreground">（无历史反馈）</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {a.feedback_history.map((fb, idx) => (
              <li key={fb.feedback_id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-muted-foreground">
                    {fb.created_at}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {fb.location}
                  </span>
                  <span className="rounded-sm border bg-muted px-1 font-mono text-[10px]">
                    {fb.verdict}
                  </span>
                  <span className="rounded-sm border bg-muted px-1 font-mono text-[10px]">
                    cause={fb.likely_cause}
                  </span>
                  <span className="rounded-sm border bg-muted px-1 font-mono text-[10px]">
                    sev={fb.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs">{fb.issue}</p>
                {fb.expected && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    期望：{fb.expected}
                  </p>
                )}
                {idx < a.feedback_history.length - 1 && <Separator className="mt-2" />}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <RerunPanel
        node="toy"
        caseOptions={["01_basic.md", "02_long.md", "03_unicode.md"]}
        materialVersions={["v1.0", "v0.9"]}
      />

      <footer className="pt-4 text-center text-xs text-muted-foreground">
        L3 立场：作者本人的活体地图（ADR-020）· per-node 不聚合（ADR-010 / 不变量 #8）· 6 件套永远同一页（06-ui-spec §0.1）
      </footer>
    </main>
  );
}
