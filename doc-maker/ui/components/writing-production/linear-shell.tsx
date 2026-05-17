"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import {
  Archive,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Inbox,
  MessageSquareText,
  PanelLeft,
  PanelRight,
  PencilLine,
  Settings2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { WritingRunRecord } from "@/lib/writing-run-types";
import { cn } from "@/lib/utils";

export type CenterMode = "jobs" | "editor";
export type JobView = "all" | "drafts" | "precheck" | "reviewing" | "feedback" | "finalized";

const jobViewCopy: Record<JobView, { label: string; hint: string }> = {
  all: { label: "全部任务", hint: "全部文本生产任务" },
  drafts: { label: "草稿", hint: "尚未进入检查" },
  precheck: { label: "待检查", hint: "等待确认检查结果" },
  reviewing: { label: "评审中", hint: "已有候选，正在评审" },
  feedback: { label: "待处理", hint: "已有反馈或规则草稿" },
  finalized: { label: "已定稿", hint: "已定稿导出" },
};

const jobRailItems: Array<{
  view: JobView;
  icon: LucideIcon;
}> = [
  { view: "all", icon: Inbox },
  { view: "drafts", icon: PencilLine },
  { view: "precheck", icon: ClipboardCheck },
  { view: "reviewing", icon: MessageSquareText },
  { view: "feedback", icon: CheckCircle2 },
  { view: "finalized", icon: Archive },
];

const stageLabel: Record<string, string> = {
  intake: "输入",
  precheck: "检查",
  review: "评审",
  finalize: "定稿",
};

export function jobViewForRun(run: WritingRunRecord): JobView {
  if (run.status === "finalized") {
    return "finalized";
  }
  if (run.status === "precheck_ready") {
    return "precheck";
  }
  if (run.status === "feedback_recorded" || run.status === "rule_patch_ready") {
    return "feedback";
  }
  if (run.candidates.length > 0) {
    return "reviewing";
  }

  return "drafts";
}

export function runStateLabel(run: WritingRunRecord) {
  switch (jobViewForRun(run)) {
    case "precheck":
      return "待确认检查";
    case "reviewing":
      return "评审中";
    case "feedback":
      return "待处理反馈";
    case "finalized":
      return "已定稿";
    case "drafts":
      return "草稿";
    case "all":
      return "全部";
  }
}

export function LinearSidebar({
  jobView,
  counts,
  onChangeView,
  onNewJob,
}: {
  jobView: JobView;
  counts: Record<JobView, number>;
  onChangeView: (view: JobView) => void;
  onNewJob: () => void;
}) {
  const views: JobView[] = ["all", "drafts", "precheck", "reviewing", "feedback", "finalized"];

  return (
    <aside className="flex h-full min-h-0 flex-col bg-[#efeee9]">
      <div className="border-b px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">doc-marker</div>
          <div className="mt-1 text-xs text-muted-foreground">文本生产</div>
        </div>
      </div>
      <div className="border-b p-3">
        <Button className="w-full justify-start" size="sm" onClick={onNewJob}>
          <FileText className="size-4" />
          新建任务
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 p-3">
          {views.map((view) => {
            const active = jobView === view;
            const copy = jobViewCopy[view];

            return (
              <button
                key={view}
                type="button"
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-left transition",
                  active ? "bg-white shadow-sm ring-1 ring-zinc-200" : "hover:bg-white/70",
                )}
                onClick={() => onChangeView(view)}
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{copy.label}</span>
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs">{counts[view]}</span>
                </div>
                <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{copy.hint}</div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}

export function LinearSidebarRail({
  jobView,
  counts,
  onChangeView,
  onNewJob,
}: {
  jobView: JobView;
  counts: Record<JobView, number>;
  onChangeView: (view: JobView) => void;
  onNewJob: () => void;
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col items-center bg-[#efeee9] px-1.5 py-2">
      <div className="flex w-full flex-col items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="新建任务" onClick={onNewJob}>
          <FileText className="size-4" />
        </Button>
      </div>
      <Separator className="my-2 w-7" />
      <ScrollArea className="min-h-0 w-full flex-1">
        <nav
          aria-label="任务视图"
          className="flex flex-col items-center justify-start gap-1 py-1"
        >
          {jobRailItems.map(({ view, icon: Icon }) => {
            const count = counts[view];
            const countLabel = count > 99 ? "99+" : String(count);
            const copy = jobViewCopy[view];
            const active = jobView === view;

            return (
              <button
                key={view}
                type="button"
                aria-current={active ? "page" : undefined}
                aria-label={`${copy.label}，${count} 个任务`}
                title={`${copy.label} · ${copy.hint} · ${count} 个`}
                className={cn(
                  "relative flex size-10 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/70 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900",
                  active && "bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200",
                )}
                onClick={() => onChangeView(view)}
              >
                <Icon className="size-4" />
                <span className="sr-only">{copy.label}</span>
                {count ? (
                  <span className="absolute -right-0.5 -top-0.5 max-w-7 truncate rounded-full bg-zinc-900 px-1 text-[9px] leading-4 text-white">
                    {countLabel}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}

export function LinearTopBar({
  centerMode,
  jobView,
  stageBadge,
  activeRun,
  runtimeBusy,
  sidebarCollapsed,
  inspectorCollapsed,
  showSidebarToggle = true,
  sidebarToggleDisabled = false,
  inspectorToggleDisabled = false,
  onToggleSidebar,
  onToggleInspector,
  onOpenSettingsHref,
}: {
  centerMode: CenterMode;
  jobView: JobView;
  stageBadge: string;
  activeRun: WritingRunRecord | null;
  runtimeBusy: boolean;
  sidebarCollapsed: boolean;
  inspectorCollapsed: boolean;
  showSidebarToggle?: boolean;
  sidebarToggleDisabled?: boolean;
  inspectorToggleDisabled?: boolean;
  onToggleSidebar: () => void;
  onToggleInspector: () => void;
  onOpenSettingsHref: string;
}) {
  return (
    <header className="flex shrink-0 flex-col border-b bg-[#fbfaf6]">
      <div className="flex h-10 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2">
          {showSidebarToggle ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={
                  sidebarToggleDisabled
                    ? "窗口太窄，左侧导航保持折叠"
                    : sidebarCollapsed
                      ? "展开左侧导航"
                      : "折叠左侧导航"
                }
                disabled={sidebarToggleDisabled}
                onClick={onToggleSidebar}
              >
                <PanelLeft className="size-4" />
              </Button>
              <Separator orientation="vertical" className="h-5" />
            </>
          ) : null}
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap text-xs">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/">doc-marker</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate">{jobViewCopy[jobView].label}</BreadcrumbPage>
              </BreadcrumbItem>
              {activeRun ? (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="max-w-[min(42vw,360px)] truncate">
                      {activeRun?.jobSpec.title ?? "新建任务"}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : null}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={onOpenSettingsHref}>
              <Settings2 className="size-4" />
              LLM
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              inspectorToggleDisabled
                ? "窗口太窄，上下文面板保持折叠"
                : inspectorCollapsed
                  ? "展开上下文面板"
                  : "折叠上下文面板"
            }
            disabled={inspectorToggleDisabled}
            onClick={onToggleInspector}
          >
            <PanelRight className="size-4" />
          </Button>
        </div>
      </div>

      {centerMode === "editor" ? (
        <div className="flex min-h-12 items-center justify-between gap-4 border-t bg-white px-4 py-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="shrink-0">当前阶段</span>
              <span className="truncate font-medium text-zinc-950">{stageLabel[stageBadge] ?? stageBadge}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {runtimeBusy ? <Badge variant="secondary">运行中</Badge> : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function LinearJobList({
  runs,
  activeRunId,
  expandedRunId,
  view,
  onOpenRun,
  onToggleRun,
  renderExpandedRun,
}: {
  runs: WritingRunRecord[];
  activeRunId: string | null;
  expandedRunId?: string | null;
  view: JobView;
  onOpenRun: (run: WritingRunRecord) => void;
  onToggleRun?: (run: WritingRunRecord) => void;
  renderExpandedRun?: (run: WritingRunRecord) => ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold">任务列表</div>
          <div className="truncate text-xs text-muted-foreground">
            {jobViewCopy[view].label} · {runs.length} 个任务
          </div>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="divide-y">
          {runs.map((run) => {
            const active = activeRunId === run.id;
            const expanded = expandedRunId === run.id;

            return (
              <div key={run.id} className={cn("bg-white", active && "shadow-[inset_3px_0_0_#18181b]")}>
                <button
                  type="button"
                  className={cn(
                    "grid min-h-16 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 text-left text-sm transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900 sm:grid-cols-[minmax(0,1fr)_112px_auto] lg:grid-cols-[minmax(0,1fr)_112px_88px_136px_auto] lg:gap-3",
                    active && "bg-zinc-50/70",
                  )}
                  aria-expanded={onToggleRun ? expanded : undefined}
                  onClick={() => (onToggleRun ? onToggleRun(run) : onOpenRun(run))}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{run.jobSpec.title}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{run.quickIntake || run.id}</div>
                  </div>
                  <Badge variant={active ? "secondary" : "outline"} className="hidden justify-center truncate sm:inline-flex">
                    {runStateLabel(run)}
                  </Badge>
                  <div className="hidden truncate text-xs text-muted-foreground lg:block">{run.candidates.length} 个候选</div>
                  <div className="hidden truncate text-xs text-muted-foreground lg:block">
                    {new Date(run.updatedAt).toLocaleString("zh-CN")}
                  </div>
                  {onToggleRun ? (
                    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground">
                      {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      {expanded ? "收起" : "展开"}
                    </span>
                  ) : null}
                </button>
                {expanded && renderExpandedRun ? (
                  <div className="border-t bg-[#fbfaf6] py-4 pl-8 pr-4">
                    <div className="border-l border-zinc-200 pl-4">
                      {renderExpandedRun(run)}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {!runs.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            当前视图没有任务。
          </div>
        ) : null}
      </ScrollArea>
    </section>
  );
}
