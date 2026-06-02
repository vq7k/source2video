import type { ComponentType, ReactNode } from "react";

import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

export function StepMark({ value, active }: { value: string; active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 font-mono text-xs",
        active ? "border-zinc-700 bg-zinc-700 text-zinc-100" : "border-zinc-200 bg-zinc-100 text-zinc-500",
      )}
    >
      {value}
    </span>
  );
}

export function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      <Icon className="size-4" />
      {title}
    </div>
  );
}

export function WarningCallout({
  children,
  title = "LLM 生成提示",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
      <div>
        <div className="font-medium">{title}</div>
        <p className="mt-1 leading-5">{children}</p>
      </div>
    </div>
  );
}

export function InfoRow({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("rounded-md border bg-muted/30 px-3 py-2", wide && "md:col-span-2")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium leading-5 [overflow-wrap:anywhere]">{value}</div>
    </div>
  );
}
