import { Check, Loader2, Clock, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EpisodeProgress, StageStatus } from "@/lib/types";

interface Props {
  progress: EpisodeProgress;
}

interface Stage {
  key: string;
  label: string;
  status: StageStatus;
  hint?: string;
}

export function ProgressPipeline({ progress }: Props) {
  const stages: Stage[] = [
    { key: "plan", label: "plan", status: progress.plan },
    {
      key: "shot",
      label: "shot",
      status: progress.shot.current === progress.shot.total ? "done" : "running",
      hint: `${progress.shot.current}/${progress.shot.total}`,
    },
    { key: "qa", label: "qa", status: progress.qa },
    { key: "done", label: "完成", status: progress.done },
  ];

  return (
    <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
      {stages.map((stage, idx) => (
        <div key={stage.key} className="flex items-center gap-1">
          <StageDot stage={stage} />
          {idx < stages.length - 1 && (
            <span className="text-muted-foreground/40">→</span>
          )}
        </div>
      ))}
    </div>
  );
}

function StageDot({ stage }: { stage: Stage }) {
  const iconConfig: Record<
    StageStatus,
    { Icon: typeof Check; spin?: boolean; tone: string }
  > = {
    done: { Icon: Check, tone: "text-foreground" },
    running: { Icon: Loader2, spin: true, tone: "text-foreground" },
    pending: { Icon: Clock, tone: "text-muted-foreground/50" },
    failed: { Icon: X, tone: "text-destructive" },
  };
  const { Icon, spin, tone } = iconConfig[stage.status];
  return (
    <span className={cn("inline-flex items-center gap-1", tone)}>
      <Icon className={cn("h-3 w-3", spin && "animate-spin")} />
      <span>
        {stage.label}
        {stage.hint && (
          <span className="ml-1 text-muted-foreground">({stage.hint})</span>
        )}
      </span>
    </span>
  );
}
