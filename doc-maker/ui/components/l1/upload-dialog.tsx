"use client";

import { useState } from "react";
import { Upload, FileUp, Loader2, CheckCircle2 } from "lucide-react";

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
import type { Episode } from "@/lib/types";

type Phase = "form" | "linting" | "registering" | "done";

export function UploadDialog() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [id, setId] = useState("ml_lr_e04d");
  const [title, setTitle] = useState("线性回归 · 损失函数与梯度");
  const [target, setTarget] = useState("10:00");
  const [filename, setFilename] = useState("04线性回归_梯度.pptx");

  const reset = () => {
    setPhase("form");
    setId("ml_lr_e04d");
    setTitle("线性回归 · 损失函数与梯度");
    setTarget("10:00");
    setFilename("04线性回归_梯度.pptx");
  };

  const handleSubmit = () => {
    // 6 步 git thin 前端 mock：
    // 1. stage → 2. lint (1.5s) → 3. register (1.5s) → 4. commit → 5. trigger run → 6. show in list
    setPhase("linting");
    setTimeout(() => {
      setPhase("registering");
      setTimeout(() => {
        setPhase("done");
        const newEp: Episode = {
          id,
          title,
          status: "running",
          source: filename,
          size: "2.0MB",
          progress: {
            plan: "running",
            shot: { current: 0, total: 6 },
            qa: "pending",
            done: "pending",
          },
          eta: "5:00",
        };
        window.dispatchEvent(
          new CustomEvent<Episode>("episode:create", { detail: newEp }),
        );
        setTimeout(() => {
          setOpen(false);
          reset();
        }, 800);
      }, 1500);
    }, 1500);
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
          <DialogTitle>新建 Episode + 上传素材</DialogTitle>
          <DialogDescription>
            内部走 git thin 前端：lint → register → commit → 启动流水线。绕过 git 违反 ADR-021。
          </DialogDescription>
          <p className="rounded border border-amber-300/40 bg-amber-50/40 px-2 py-1 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
            ⚠ 原型期：当前为前端 mock，setTimeout 假装 lint/register/commit。实际实施需 Server Action 调 <code className="font-mono">s2v cases lint && register && git commit</code>。
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
              <Label>素材文件</Label>
              <div className="rounded-md border border-dashed border-input p-4 text-center text-sm text-muted-foreground">
                <FileUp className="mx-auto mb-1 h-5 w-5" />
                <p>拖拽或选择文件</p>
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs font-mono">
                <FileUp className="h-3 w-3 text-muted-foreground" />
                <span>{filename}</span>
                <span className="text-muted-foreground">(2.0MB)</span>
              </div>
            </div>
          </div>
        )}

        {phase === "linting" && (
          <PhaseStatus icon="loader" label="s2v cases lint fixtures/cases/staging/..." />
        )}
        {phase === "registering" && (
          <PhaseStatus icon="loader" label="s2v cases register --case ... --split auto + git commit" />
        )}
        {phase === "done" && (
          <PhaseStatus icon="check" label="提交完成，启动流水线" />
        )}

        <DialogFooter>
          {phase === "form" && (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={!id || !title}>
                上传 + 跑批
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PhaseStatus({
  icon,
  label,
}: {
  icon: "loader" | "check";
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/20 px-4 py-6">
      {icon === "loader" ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <CheckCircle2 className="h-5 w-5 text-foreground" />
      )}
      <span className="text-sm font-mono">{label}</span>
    </div>
  );
}
