import { CheckCircle2, AlertTriangle, Loader2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EpisodeStatus } from "@/lib/types";

interface Props {
  status: EpisodeStatus;
  className?: string;
}

const config: Record<
  EpisodeStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "muted" | "outline";
    Icon: typeof CheckCircle2;
    spin?: boolean;
  }
> = {
  done: { label: "完成", variant: "secondary", Icon: CheckCircle2 },
  warn: { label: "警告", variant: "outline", Icon: AlertTriangle },
  running: { label: "跑批中", variant: "outline", Icon: Loader2, spin: true },
  failed: { label: "失败", variant: "destructive", Icon: XCircle },
};

export function StatusBadge({ status, className }: Props) {
  const { label, variant, Icon, spin } = config[status];
  return (
    <Badge
      variant={variant}
      className={cn("gap-1.5 px-2 py-0.5 font-mono text-[11px]", className)}
    >
      <Icon className={cn("h-3 w-3", spin && "animate-spin")} />
      {label}
    </Badge>
  );
}
