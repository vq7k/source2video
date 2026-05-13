import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUp } from "lucide-react";

import { ConsoleHeader } from "@/components/l3/console-header";
import { MaterialsBadges } from "@/components/l3/materials-badges";
import { ArtifactPanel } from "@/components/l3/artifact-panel";
import { EvalAttributionPanel } from "@/components/l3/eval-attribution-panel";
import { DecisionTracePanel } from "@/components/l3/decision-trace-panel";
import { NodeMetricsBar } from "@/components/l3/node-metrics-bar";
import { RerunPanel } from "@/components/l3/rerun-panel";
import { FeedbackDialog } from "@/components/l3/feedback-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { findShotArtifact } from "@/lib/mock";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ShotConsolePage({ params }: Props) {
  const { id } = await params;
  const a = findShotArtifact(id);
  if (!a) notFound();

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-5 px-6 py-8">
      <ConsoleHeader
        title={`source2video · Shot 节点控制台 · ${a.shot_id}`}
        artifactId={a.artifact_id}
        backHref={`/node/plan?artifact=${a.plan_artifact_id}`}
        backLabel="返回 Plan"
        extraRight={
          <Button asChild variant="outline" size="sm">
            <Link href={`/node/plan?artifact=${a.plan_artifact_id}`}>
              <ArrowUp className="mr-1 h-3 w-3" />
              {a.plan_artifact_id.slice(0, 22)}…
            </Link>
          </Button>
        }
      />

      <section>
        <h3 className="mb-2 text-sm font-medium">
          物料（Materials）{" "}
          <span className="text-xs font-normal text-muted-foreground">
            （3 步 prompts + 3 个 rubrics，每步独立 bump）
          </span>
        </h3>
        <MaterialsBadges materials={a.materials} />
      </section>

      <ArtifactPanel
        title="Shot 产物 · 三件套"
        metadata={[
          { key: "Episode 标识", value: a.episode_id },
          { key: "Plan 产物标识", value: a.plan_artifact_id },
          { key: "前序 outgoing", value: a.prev_shot_outgoing ?? "（无前序）" },
          { key: "时间", value: a.timestamp },
          { key: "用 token", value: a.token_used.toLocaleString() },
          { key: "成本", value: `$${a.cost_usd.toFixed(3)}` },
        ]}
      >
        <div className="space-y-3">
          {/* text */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                text（字幕原文）
              </span>
              <FeedbackDialog location={`${a.shot_id}.text`} artifactId={a.artifact_id} />
            </div>
            <div className="rounded-md border bg-muted/10 p-3 text-sm leading-relaxed">
              {a.text}
            </div>
          </div>
          {/* text_tts */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                text_tts（TTS 友好版）
              </span>
              <FeedbackDialog
                location={`${a.shot_id}.text_tts`}
                artifactId={a.artifact_id}
              />
            </div>
            <div className="rounded-md border bg-muted/10 p-3 font-mono text-xs leading-relaxed">
              {a.text_tts}
            </div>
          </div>
          {/* notes */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                notes（视频制作指导）
              </span>
              <FeedbackDialog location={`${a.shot_id}.notes`} artifactId={a.artifact_id} />
            </div>
            <div className="rounded-md border bg-muted/10">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">类型</th>
                    <th className="px-3 py-1.5 text-left font-medium">时长</th>
                    <th className="px-3 py-1.5 text-left font-medium">视觉</th>
                    <th className="px-3 py-1.5 text-left font-medium">cues</th>
                  </tr>
                </thead>
                <tbody>
                  {a.notes.map((n, i) => (
                    <tr key={i} className="border-t last:border-0">
                      <td className="px-3 py-1.5 font-mono">{n.kind}</td>
                      <td className="px-3 py-1.5 font-mono">{n.duration}</td>
                      <td className="px-3 py-1.5">{n.visual}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {n.cues.join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ArtifactPanel>

      <EvalAttributionPanel
        title="跨步一致性（节点级 judge）"
        description="text / text_tts / notes 三者一致性 + 各步独立 rubric（business-design §4.5）。"
        dimensions={a.eval}
      />

      <Card className="p-5">
        <h3 className="mb-2 text-sm font-medium">Plan 引用</h3>
        <p className="text-xs text-muted-foreground">
          本 shot 不读其它 shot 的输出（ADR-003 shot 永不互读）；所有上下文来自 plan slice + prev_shot.outgoing_state（business-design §4.1）。
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Badge variant="muted" className="font-mono">
            plan_artifact_id
          </Badge>
          <Link
            href={`/node/plan?artifact=${a.plan_artifact_id}`}
            className="font-mono text-xs hover:underline"
          >
            {a.plan_artifact_id}
          </Link>
          <Button asChild variant="ghost" size="sm" className="ml-auto h-7 px-2">
            <Link href={`/node/plan?artifact=${a.plan_artifact_id}`}>
              <ArrowLeft className="mr-1 h-3 w-3" />
              返回 Plan
            </Link>
          </Button>
        </div>
      </Card>

      <DecisionTracePanel
        trace={a.decision_trace}
        stepLabels={["text 生成", "text_tts（并行）", "notes（并行）"]}
      />

      <NodeMetricsBar metrics={a.metrics} />

      <RerunPanel
        node="shot"
        caseOptions={[`${a.shot_id}_slice`]}
        materialVersions={["v1.0"]}
      />

      <footer className="pt-4 text-center text-xs text-muted-foreground">
        ShotExecutionNode 内部 3 步链（text → text_tts ∥ notes）· 不拆 3 个 Node（business-design §4.2）
      </footer>
    </main>
  );
}
