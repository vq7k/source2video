"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText, FolderOpen, ClipboardCheck, RefreshCw, ArrowRight, ChevronDown, ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StatusBadge } from "./status-badge";
import { ProgressPipeline } from "./progress-pipeline";
import type { Episode, NodeName } from "@/lib/types";

interface Props {
  episode: Episode;
  onAccept?: (id: string) => void;
  onRerun?: (id: string) => void;
}

function TechnicalDetail({ detail }: { detail: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-1">
      <CollapsibleTrigger
        type="button"
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        技术细节
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-1 rounded-md border bg-muted/30 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {detail}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function nodeDiagnosticHref(node?: NodeName, artifactId?: string) {
  if (!node) {
    return "/hub";
  }

  if (node === "shot" && artifactId) {
    return `/node/shot/${encodeURIComponent(artifactId)}`;
  }

  return `/node/${node}${artifactId ? `?artifact=${encodeURIComponent(artifactId)}` : ""}`;
}

function hasCompleteArtifacts(episode: Episode): episode is Episode & {
  artifacts: { scripts: string; shots: string; qa_report: string };
} {
  return Boolean(
    episode.artifacts?.scripts &&
      episode.artifacts.shots &&
      episode.artifacts.qa_report,
  );
}

function ArtifactButtons({ episode }: { episode: Episode }) {
  if (!hasCompleteArtifacts(episode)) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/episode/${episode.id}/scripts`}>
          <FileText className="mr-1.5 h-3 w-3" />
          {episode.artifacts.scripts}
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/episode/${episode.id}/shots`}>
          <FolderOpen className="mr-1.5 h-3 w-3" />
          {episode.artifacts.shots}
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/episode/${episode.id}/qa-report`}>
          <ClipboardCheck className="mr-1.5 h-3 w-3" />
          {episode.artifacts.qa_report}
        </Link>
      </Button>
    </div>
  );
}

export function EpisodeCard({ episode, onAccept, onRerun }: Props) {
  const isBoundedBudgetFailure = episode.failure_kind === "bounded_budget";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground">
              {episode.id}
            </span>
            <StatusBadge status={episode.status} />
          </div>
          <h3 className="mt-1 text-base font-medium">{episode.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            来源：{episode.source} · {episode.size}
            {episode.rounds !== undefined && ` · 跑批 ${episode.rounds} 轮`}
            {episode.duration && ` · 用时 ${episode.duration}`}
          </p>
        </div>
      </div>

      {/* done: 只显示产出按钮，无节点链接（纪律 #3） */}
      {episode.status === "done" && episode.artifacts && (
        <>
          <Separator className="my-3" />
          <ArtifactButtons episode={episode} />
        </>
      )}

      {/* warn: 节点链接 + 接受 + 重跑（纪律 #5：3 个核心动作） */}
      {episode.status === "warn" && (
        <>
          <Separator className="my-3" />
          <p className="text-sm">{episode.user_message ?? episode.warn_summary}</p>
          {episode.technical_detail && <TechnicalDetail detail={episode.technical_detail} />}
          {hasCompleteArtifacts(episode) && (
            <div className="mt-3">
              <p className="mb-2 text-xs text-muted-foreground">
                已生成文档包，可先查看后再接受或重跑。
              </p>
              <ArtifactButtons episode={episode} />
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link
                href={nodeDiagnosticHref(episode.warn_node, episode.warn_artifact_id)}
              >
                <ArrowRight className="mr-1.5 h-3 w-3" />
                {episode.warn_node === "qa" && "QA 诊断入口"}
                {episode.warn_node === "plan" && "Plan 诊断入口"}
                {episode.warn_node === "shot" && "Shot 诊断入口"}
                {episode.warn_node === "toy" && "Toy 诊断入口"}
              </Link>
            </Button>
            <span className="ml-auto" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAccept?.(episode.id)}
            >
              接受并继续
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRerun?.(episode.id)}
            >
              <RefreshCw className="mr-1.5 h-3 w-3" />
              重跑
            </Button>
          </div>
        </>
      )}

      {/* running: 进度 pipeline */}
      {episode.status === "running" && episode.progress && (
        <>
          <Separator className="my-3" />
          <ProgressPipeline progress={episode.progress} />
          {episode.eta && (
            <p className="mt-2 text-xs text-muted-foreground">
              预计剩余 {episode.eta}
            </p>
          )}
        </>
      )}

      {/* failed: 错误 + 诊断交接；Bounded Budget 不给假重跑 */}
      {episode.status === "failed" && (
        <>
          <Separator className="my-3" />
          <p className="text-sm text-destructive">{episode.user_message ?? episode.error}</p>
          {episode.technical_detail && <TechnicalDetail detail={episode.technical_detail} />}
          {episode.next_action && (
            <p className="mt-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              下一步：{episode.next_action}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link
                href={nodeDiagnosticHref(episode.failed_node, episode.failed_artifact_id)}
              >
                <ArrowRight className="mr-1.5 h-3 w-3" />
                {isBoundedBudgetFailure && "打开诊断包"}
                {!isBoundedBudgetFailure && episode.failed_node === "plan" && "Plan 诊断入口"}
                {!isBoundedBudgetFailure && episode.failed_node === "shot" && "Shot 诊断入口"}
                {!isBoundedBudgetFailure && episode.failed_node === "qa" && "QA 诊断入口"}
                {!isBoundedBudgetFailure && episode.failed_node === "toy" && "Toy 诊断入口"}
              </Link>
            </Button>
            <span className="ml-auto" />
            {!isBoundedBudgetFailure && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRerun?.(episode.id)}
              >
                <RefreshCw className="mr-1.5 h-3 w-3" />
                重新运行
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
