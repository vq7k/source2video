"use client";

import { useRef, useState } from "react";
import { Upload, FileUp, Loader2, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Episode } from "@/lib/types";

type Phase =
  | "form"
  | "linting"
  | "registering"
  | "committing"
  | "triggering"
  | "done"
  | "failed";
type UploadScenario =
  | "success"
  | "lint_failure"
  | "register_failure"
  | "commit_failure"
  | "trigger_failure";

interface SelectedFile {
  name: string;
  size: string;
}

interface UploadFailure {
  title: string;
  detail: string;
}

interface UploadDialogProps {
  onEpisodeCreate?: (episode: Episode) => void;
}

const UPLOAD_FAILURES: Record<Exclude<UploadScenario, "success">, UploadFailure> = {
  lint_failure: {
    title: "素材检查未通过",
    detail: "文件类型或章节元数据不符合要求；未登记 case，也不会启动流水线。",
  },
  register_failure: {
    title: "登记失败",
    detail: "Episode 标识已存在或 metadata 缺字段；未创建新的 running Episode。",
  },
  commit_failure: {
    title: "版本提交失败",
    detail: "工作区存在冲突或提交检查失败；素材已停在待处理状态，流水线未启动。",
  },
  trigger_failure: {
    title: "流水线启动失败",
    detail: "素材已登记并完成版本提交，但生成任务没有启动；需要从诊断入口重试触发。",
  },
};

const DEFAULT_SELECTED_FILE: SelectedFile = {
  name: "04线性回归_梯度.pptx",
  size: "2.0MB",
};

export function UploadDialog({ onEpisodeCreate }: UploadDialogProps) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [id, setId] = useState("ml_lr_e04d");
  const [title, setTitle] = useState("线性回归 · 损失函数与梯度");
  const [target, setTarget] = useState("10:00");
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(
    DEFAULT_SELECTED_FILE,
  );
  const [scenario, setScenario] = useState<UploadScenario>("success");
  const [failure, setFailure] = useState<UploadFailure | null>(null);

  const clearTimers = () => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current = [];
  };

  const schedule = (fn: () => void, ms: number) => {
    const timer = setTimeout(fn, ms);
    timers.current.push(timer);
  };

  const reset = () => {
    clearTimers();
    setPhase("form");
    setId("ml_lr_e04d");
    setTitle("线性回归 · 损失函数与梯度");
    setTarget("10:00");
    setSelectedFile(DEFAULT_SELECTED_FILE);
    setScenario("success");
    setFailure(null);
  };

  const fail = (key: Exclude<UploadScenario, "success">) => {
    setFailure(UPLOAD_FAILURES[key]);
    setPhase("failed");
  };

  const handleFileChange = (file?: File) => {
    if (!file) return;
    setSelectedFile({ name: file.name, size: formatBytes(file.size) });
  };

  const handleSubmit = () => {
    if (!selectedFile) return;
    clearTimers();
    setFailure(null);
    setPhase("linting");

    schedule(() => {
      if (scenario === "lint_failure") return fail("lint_failure");
      setPhase("registering");

      schedule(() => {
        if (scenario === "register_failure") return fail("register_failure");
        setPhase("committing");

        schedule(() => {
          if (scenario === "commit_failure") return fail("commit_failure");
          setPhase("triggering");

          schedule(() => {
            if (scenario === "trigger_failure") return fail("trigger_failure");
            setPhase("done");

            const newEp: Episode = {
              id,
              title,
              status: "running",
              source: selectedFile.name,
              size: selectedFile.size,
              progress: {
                plan: "running",
                shot: { current: 0, total: 6 },
                qa: "pending",
                done: "pending",
              },
              eta: "5:00",
            };

            onEpisodeCreate?.(newEp);

            schedule(() => {
              setOpen(false);
              reset();
            }, 800);
          }, 800);
        }, 800);
      }, 800);
    }, 800);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-1 h-4 w-4" />
          上传素材 (PPT / MD)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>上传素材并创建任务</DialogTitle>
          <DialogDescription>
            素材会先检查、登记版本、提交到 git，再启动生成流水线；UI 不保存私有状态。
          </DialogDescription>
          <p className="rounded border border-amber-300/40 bg-amber-50/40 px-2 py-1 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
            当前只做本地演示：检查、登记、提交和启动结果不会写入真实生产队列。
          </p>
        </DialogHeader>

        {phase === "form" && (
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="ep-id">Episode 标识</Label>
              <Input
                id="ep-id"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="ml_lr_e04d"
                className="font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ep-title">标题</Label>
              <Input
                id="ep-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ep-duration">目标时长</Label>
              <Input
                id="ep-duration"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="10:00"
                className="font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="source-file">素材文件</Label>
              <label
                htmlFor="source-file"
                className="cursor-pointer rounded-md border border-dashed border-input p-4 text-center text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-muted/30"
              >
                <FileUp className="mx-auto mb-1 h-5 w-5" />
                <p>{selectedFile ? "重新选择文件" : "选择 PPT / Markdown 文件"}</p>
              </label>
              <input
                id="source-file"
                type="file"
                accept=".ppt,.pptx,.md,.markdown"
                className="sr-only"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />
              {selectedFile && (
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs font-mono">
                  <FileUp className="h-3 w-3 text-muted-foreground" />
                  <span>{selectedFile.name}</span>
                  <span className="text-muted-foreground">({selectedFile.size})</span>
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label>演示场景</Label>
              <Select
                value={scenario}
                onValueChange={(value) => setScenario(value as UploadScenario)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="success">正常上传并启动</SelectItem>
                  <SelectItem value="lint_failure">素材检查失败</SelectItem>
                  <SelectItem value="register_failure">登记失败</SelectItem>
                  <SelectItem value="commit_failure">版本提交失败</SelectItem>
                  <SelectItem value="trigger_failure">流水线启动失败</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {phase === "linting" && (
          <PhaseStatus icon="loader" title="检查素材" detail="确认文件格式、章节元数据和 Episode 标识可用。" />
        )}
        {phase === "registering" && (
          <PhaseStatus icon="loader" title="登记版本" detail="把素材登记为可追溯的 case，准备进入流水线。" />
        )}
        {phase === "committing" && (
          <PhaseStatus icon="loader" title="提交版本" detail="保存本次素材变更，确保后续生成可复现。" />
        )}
        {phase === "triggering" && (
          <PhaseStatus icon="loader" title="启动生成" detail="创建 Episode 运行记录，并进入 plan 阶段。" />
        )}
        {phase === "done" && (
          <PhaseStatus icon="check" title="已启动生成" detail="Episode 已加入列表，正在进入 plan 阶段。" />
        )}
        {phase === "failed" && failure && (
          <PhaseStatus icon="error" title={failure.title} detail={failure.detail} />
        )}

        <DialogFooter>
          {phase === "form" && (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={!id || !title || !selectedFile}>
                上传并启动
              </Button>
            </>
          )}
          {phase === "failed" && (
            <Button
              variant="outline"
              onClick={() => {
                setFailure(null);
                setPhase("form");
              }}
            >
              返回修改
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PhaseStatus({
  icon,
  title,
  detail,
}: {
  icon: "loader" | "check" | "error";
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/20 px-4 py-6">
      {icon === "loader" ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : icon === "check" ? (
        <CheckCircle2 className="h-5 w-5 text-foreground" />
      ) : (
        <XCircle className="h-5 w-5 text-destructive" />
      )}
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
