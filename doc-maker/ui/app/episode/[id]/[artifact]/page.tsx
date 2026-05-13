import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  FolderOpen,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  findEpisode,
  findEpisodeArtifacts,
  findCrossRepoJson,
  type ArtifactScript,
  type ArtifactShotYaml,
  type ArtifactQaReport,
  type CrossRepoJsonSample,
} from "@/lib/mock";

type ArtifactKind = "scripts" | "shots" | "qa-report";

const ARTIFACT_META: Record<
  ArtifactKind,
  { label: string; filename: string; icon: typeof FileText }
> = {
  scripts: { label: "Scripts", filename: "scripts.md", icon: FileText },
  shots: { label: "Shots", filename: "shots/", icon: FolderOpen },
  "qa-report": {
    label: "QA Report",
    filename: "qa_report.md",
    icon: ClipboardCheck,
  },
};

function isArtifactKind(v: string): v is ArtifactKind {
  return v === "scripts" || v === "shots" || v === "qa-report";
}

interface PageProps {
  params: Promise<{ id: string; artifact: string }>;
}

export default async function ArtifactViewerPage({ params }: PageProps) {
  const { id, artifact } = await params;

  if (!isArtifactKind(artifact)) {
    notFound();
  }

  const episode = findEpisode(id);
  const artifacts = findEpisodeArtifacts(id);

  if (!episode || !artifacts) {
    notFound();
  }

  const meta = ARTIFACT_META[artifact];
  const Icon = meta.icon;

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl space-y-5 px-6 py-8">
      <header className="space-y-2 border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="h-8 px-2">
              <Link href="/">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                返回业务控制台
              </Link>
            </Button>
            <Badge variant="muted" className="font-mono">
              L1 出口
            </Badge>
            <span className="text-xs text-muted-foreground">
              业务使用者视图
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px]">
              {artifacts.scripts.materials_version}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{episode.title}</h1>
          <span className="font-mono text-xs text-muted-foreground">
            / {meta.filename}
          </span>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {episode.id} · {meta.label}
        </p>
      </header>

      {artifact === "scripts" && <ScriptsView data={artifacts.scripts} />}
      {artifact === "shots" && <ShotsView data={artifacts.shots} />}
      {artifact === "qa-report" && <QaReportView data={artifacts.qa_report} />}

      <CrossRepoJsonViewer episodeId={id} artifact={artifact} />
    </main>
  );
}

// ---------------------------------------------------------------------------
// 跨仓 JSON 契约样本（pipeline_io 输出 → astral-pipeline 仓）
// 参 docs/repo-layout.md §2.2
// ---------------------------------------------------------------------------

function CrossRepoJsonViewer({
  episodeId,
  artifact,
}: {
  episodeId: string;
  artifact: ArtifactKind;
}) {
  const crossRepo = findCrossRepoJson(episodeId);
  if (!crossRepo) return null;

  // 当前 viewer artifact 对应跨仓的哪个 JSON
  const mapping: Record<ArtifactKind, CrossRepoJsonSample | undefined> = {
    scripts: crossRepo.script,
    shots: crossRepo.visual_spec,
    "qa-report": crossRepo.qa,
  };
  const sample = mapping[artifact];
  if (!sample) return null;

  const label =
    artifact === "scripts"
      ? "script.json"
      : artifact === "shots"
        ? "visual_spec.json"
        : "qa.json";

  return (
    <Collapsible>
      <Card className="border-dashed">
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between gap-3 p-4 text-left">
            <div className="flex items-center gap-2">
              <Badge variant="muted" className="font-mono text-[10px]">
                跨仓契约
              </Badge>
              <span className="text-sm font-medium">
                查看跨仓 JSON 契约样本（{label}）
              </span>
              <span className="text-xs text-muted-foreground">
                pipeline_io 输出形态 · 给 TTS / Remotion 用
              </span>
            </div>
            <span className="text-xs text-muted-foreground">展开 ↓</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-4 py-4">
            <p className="mb-2 text-xs">
              路径：
              <code className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                {sample.path}
              </code>
            </p>
            <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
              这是经 <code className="font-mono">pipeline_io</code> 模块转换 +
              sha256 校验后，写入 astral-pipeline 仓的真实跨仓格式。**上方** 你看到的是 doc-maker
              内部可读格式（markdown / yaml）。**这里** 是给 TTS / Remotion 实际消费的 JSON。
              参 <code className="font-mono">docs/repo-layout.md</code> §2.2。
            </p>
            <pre className="overflow-x-auto rounded bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
              {sample.content}
            </pre>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// scripts.md
// ---------------------------------------------------------------------------

function ScriptsView({ data }: { data: ArtifactScript }) {
  const totalWords = data.sections.reduce(
    (acc, s) => acc + s.body.replace(/\s/g, "").length,
    0,
  );

  return (
    <article className="space-y-5">
      <Card className="p-5">
        <h2 className="text-base font-semibold">{data.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {data.episode_id} · 生成于 {data.generated_at}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
          <div>
            <span className="text-muted-foreground">总时长</span>
            <span className="ml-2 font-medium">
              {data.total_duration_seconds}s
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Shot 数</span>
            <span className="ml-2 font-medium">{data.shot_count}</span>
          </div>
          <div>
            <span className="text-muted-foreground">字数</span>
            <span className="ml-2 font-medium">{totalWords}</span>
          </div>
          <div>
            <span className="text-muted-foreground">物料</span>
            <span className="ml-2 font-mono text-[11px]">
              {data.materials_version}
            </span>
          </div>
        </div>
      </Card>

      {data.sections.map((section) => (
        <Card key={section.shot_id} className="p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">{section.heading}</h3>
            <Badge variant="muted" className="font-mono text-[11px]">
              {section.intent}
            </Badge>
          </div>
          <Separator className="my-3" />
          <div className="space-y-3 text-sm leading-7 text-foreground/90">
            {section.body.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </Card>
      ))}
    </article>
  );
}

// ---------------------------------------------------------------------------
// shots/
// ---------------------------------------------------------------------------

function ShotsView({ data }: { data: ArtifactShotYaml[] }) {
  return (
    <article className="space-y-4">
      <Card className="p-4">
        <p className="text-xs text-muted-foreground">
          共 {data.length} 个 shot 文件 · 点击展开查看 text / text_tts / notes
        </p>
      </Card>
      {data.map((shot) => (
        <ShotCard key={shot.shot_id} shot={shot} />
      ))}
    </article>
  );
}

function ShotCard({ shot }: { shot: ArtifactShotYaml }) {
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-mono text-sm font-semibold">
            {shot.shot_id}.yaml
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            intent: {shot.intent} · target: {shot.target_duration_seconds}s
          </p>
        </div>
        <Badge variant="muted" className="font-mono text-[11px]">
          {shot.intent}
        </Badge>
      </div>

      <Separator className="my-3" />

      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-medium hover:text-foreground/80">
          <span>text（字幕原文）</span>
          <span className="text-muted-foreground">▾</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <p className="rounded-md border bg-muted/30 p-3 text-sm leading-7">
            {shot.text}
          </p>
        </CollapsibleContent>
      </Collapsible>

      <div className="mt-4">
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-medium hover:text-foreground/80">
            <span>text_tts（TTS 友好版）</span>
            <span className="text-muted-foreground">▾</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <p className="rounded-md border bg-muted/30 p-3 text-sm leading-7">
              {shot.text_tts}
            </p>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="mt-4">
        <Collapsible>
          <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-medium hover:text-foreground/80">
            <span>notes（镜头指引）</span>
            <span className="text-muted-foreground">▸</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-3">
            <div>
              <h4 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                panels
              </h4>
              <div className="space-y-2">
                {shot.notes.panels.map((panel, i) => (
                  <div
                    key={i}
                    className="rounded-md border bg-muted/20 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px]"
                      >
                        {panel.time_range[0]}s – {panel.time_range[1]}s
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {panel.narration_ref}
                      </span>
                    </div>
                    <p className="mt-1 leading-6">{panel.visual}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                transitions
              </h4>
              <ul className="space-y-1 text-xs text-foreground/90">
                {shot.notes.transitions.map((t, i) => (
                  <li
                    key={i}
                    className="rounded-md border bg-muted/20 px-3 py-1.5 leading-6"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// qa_report.md
// ---------------------------------------------------------------------------

function QaReportView({ data }: { data: ArtifactQaReport }) {
  const passCount = data.dimensions.filter((d) => d.verdict === "pass").length;
  return (
    <article className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">QA 报告 · {data.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.episode_id} · 生成于 {data.generated_at}
            </p>
          </div>
          <Badge
            variant={data.overall_verdict === "pass" ? "secondary" : "destructive"}
            className="text-xs"
          >
            {data.overall_verdict === "pass" ? (
              <CheckCircle2 className="mr-1 h-3 w-3" />
            ) : (
              <XCircle className="mr-1 h-3 w-3" />
            )}
            整体 {data.overall_verdict.toUpperCase()}
          </Badge>
        </div>

        <Separator className="my-3" />

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
          <div>
            <span className="text-muted-foreground">Shot 通过</span>
            <span className="ml-2 font-medium">
              {data.shot_pass}/{data.shot_total}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">维度通过</span>
            <span className="ml-2 font-medium">
              {passCount}/{data.dimensions.length}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">实际时长</span>
            <span className="ml-2 font-medium">
              {data.total_duration_seconds}s
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">目标时长</span>
            <span className="ml-2 font-medium">
              {data.target_duration_seconds}s（Δ {data.duration_delta_pct}%）
            </span>
          </div>
        </div>
      </Card>

      <section>
        <h3 className="mb-3 text-sm font-medium">维度细则</h3>
        <div className="space-y-2">
          {data.dimensions.map((d) => (
            <Card key={d.dimension} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-mono text-sm font-medium">
                      {d.dimension}
                    </h4>
                    <Badge
                      variant={d.verdict === "pass" ? "secondary" : "destructive"}
                      className="text-[10px]"
                    >
                      {d.verdict === "pass" ? (
                        <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                      ) : (
                        <XCircle className="mr-1 h-2.5 w-2.5" />
                      )}
                      {d.verdict.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-foreground/90">
                    {d.detail}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium">警告</h3>
        {data.warnings.length === 0 ? (
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">无警告。</p>
          </Card>
        ) : (
          <ul className="space-y-1.5">
            {data.warnings.map((w, i) => (
              <li
                key={i}
                className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                {w}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium">物料快照</h3>
        <Card className="p-4">
          <div className="flex flex-wrap gap-1.5">
            {data.materials_snapshot.map((m) => (
              <Badge
                key={m}
                variant="outline"
                className="font-mono text-[11px]"
              >
                {m}
              </Badge>
            ))}
          </div>
        </Card>
      </section>
    </article>
  );
}
