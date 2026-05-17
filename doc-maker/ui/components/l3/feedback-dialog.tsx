"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { Feedback } from "@/lib/types";

interface Props {
  location: string;
  artifactId: string;
  trigger?: React.ReactNode;
}

const CAUSES: Feedback["likely_cause"][] = [
  "style",
  "prompt",
  "schema",
  "rubric",
  "exemplar",
  "single-case",
];

export function FeedbackDialog({ location, artifactId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [verdict, setVerdict] = useState<Feedback["verdict"]>("bad");
  const [cause, setCause] = useState<Feedback["likely_cause"]>("schema");
  const [severity, setSeverity] = useState<Feedback["severity"]>("medium");
  const [issue, setIssue] = useState("");
  const [expected, setExpected] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
            <MessageSquare className="h-3 w-3" />
            反馈
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            反馈{" "}
            <span className="font-mono text-sm text-muted-foreground">
              (location: {location})
            </span>
          </DialogTitle>
          <DialogDescription>
            当前只预览将写入的反馈，不会修改产品状态。
          </DialogDescription>
        </DialogHeader>

        {!submitted ? (
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-3 gap-2">
              <Label className="col-span-3 text-xs text-muted-foreground">
                判定
              </Label>
              <RadioGroup
                value={verdict}
                onValueChange={(v) => setVerdict(v as Feedback["verdict"])}
                className="col-span-3 flex gap-4"
              >
                {(["good", "bad", "minor_nit"] as const).map((v) => (
                  <Label
                    key={v}
                    htmlFor={`v-${v}`}
                    className="flex items-center gap-2"
                  >
                    <RadioGroupItem value={v} id={`v-${v}`} />
                    <span>{v}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                可能原因（5 层归因）
              </Label>
              <RadioGroup
                value={cause}
                onValueChange={(v) => setCause(v as Feedback["likely_cause"])}
                className="grid grid-cols-3 gap-2"
              >
                {CAUSES.map((c) => (
                  <Label
                    key={c}
                    htmlFor={`c-${c}`}
                    className="flex items-center gap-2"
                  >
                    <RadioGroupItem value={c} id={`c-${c}`} />
                    <span>{c}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Label className="col-span-3 text-xs text-muted-foreground">
                严重度
              </Label>
              <RadioGroup
                value={severity}
                onValueChange={(v) => setSeverity(v as Feedback["severity"])}
                className="col-span-3 flex gap-4"
              >
                {(["high", "medium", "low"] as const).map((v) => (
                  <Label
                    key={v}
                    htmlFor={`s-${v}`}
                    className="flex items-center gap-2"
                  >
                    <RadioGroupItem value={v} id={`s-${v}`} />
                    <span>{v}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fb-issue" className="text-xs text-muted-foreground">
                问题（≤ 200 字）
              </Label>
              <Textarea
                id="fb-issue"
                rows={2}
                value={issue}
                maxLength={200}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="一句话说清问题"
              />
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="fb-expected"
                className="text-xs text-muted-foreground"
              >
                期望（≤ 200 字，可选）
              </Label>
              <Input
                id="fb-expected"
                value={expected}
                maxLength={200}
                onChange={(e) => setExpected(e.target.value)}
                placeholder="应该是什么"
              />
            </div>

            <p className="font-mono text-[11px] text-muted-foreground">
              artifact_id: {artifactId}
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-4 text-sm text-muted-foreground">
            <p>将创建一条反馈记录；当前页面只预览记录内容，不改变任务状态。</p>
            <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-[11px]">
              {JSON.stringify({ artifactId, location, verdict, cause, severity, issue, expected }, null, 2)}
            </pre>
          </div>
        )}

        {!submitted && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={!issue.trim()}>
              提交反馈
            </Button>
          </DialogFooter>
        )}
        {submitted && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSubmitted(false);
                setIssue("");
                setExpected("");
                setOpen(false);
              }}
            >
              关闭
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
