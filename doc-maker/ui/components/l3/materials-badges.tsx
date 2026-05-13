"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { MaterialRef } from "@/lib/types";

interface Props {
  materials: MaterialRef[];
}

export function MaterialsBadges({ materials }: Props) {
  const [active, setActive] = useState<MaterialRef | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {materials.map((m) => (
          <button
            key={`${m.kind}/${m.name}@${m.version}`}
            type="button"
            onClick={() => setActive(m)}
            className="cursor-pointer"
          >
            <Badge
              variant="outline"
              className="gap-1.5 font-mono hover:bg-muted"
            >
              <span className="text-muted-foreground">{m.kind}/</span>
              <span>{m.name}</span>
              <span className="text-muted-foreground">@{m.version}</span>
              {m.tag && (
                <span className="ml-1 rounded-sm border bg-muted px-1 text-[10px] text-muted-foreground">
                  {m.tag}
                </span>
              )}
            </Badge>
          </button>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">
                  {active.kind}/{active.name}@{active.version}
                </DialogTitle>
                <DialogDescription>
                  {active.tag ? `tag: ${active.tag}` : "物料 diff 预览（mock）"}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md bg-muted/40 p-3">
                <pre className="overflow-auto font-mono text-xs leading-relaxed">
                  {active.preview ?? `version: ${active.version}\n# (无预览，请查看完整 git 历史)`}
                </pre>
              </div>
              <p className="text-xs text-muted-foreground">
                编辑物料需走 git + 物料晋升流程（Promote Pipeline，ADR-008）。UI 不允许直接改 prompt。
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
