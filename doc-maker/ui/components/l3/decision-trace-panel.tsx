"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import type { DecisionTrace } from "@/lib/types";

interface Props {
  trace: DecisionTrace;
  /** 多步链时显式给出各步标题 */
  stepLabels?: string[];
}

export function DecisionTracePanel({ trace, stepLabels }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/40"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">决策迹（Decision Trace）</span>
              <span className="text-xs text-muted-foreground">
                （默认折叠 · 按 [不变量 #4] 必须可追溯）
              </span>
            </div>
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 border-t bg-muted/10 px-5 py-4">
            {stepLabels && (
              <ol className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                {stepLabels.map((s, i) => (
                  <li key={s} className="flex items-center gap-1">
                    <span className="rounded-sm border bg-background px-1.5 py-0.5 font-mono">
                      {i + 1}. {s}
                    </span>
                    {i < stepLabels.length - 1 && (
                      <span className="text-muted-foreground/50">→</span>
                    )}
                  </li>
                ))}
              </ol>
            )}

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                prompt_template_id
              </p>
              <p className="font-mono text-xs">{trace.prompt_template_id}</p>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                rendered_prompt_diff
              </p>
              <pre className="overflow-auto rounded-md bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                {trace.rendered_prompt_diff}
              </pre>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                materials_injected
              </p>
              <ul className="space-y-0.5 font-mono text-xs">
                {Object.entries(trace.materials_injected).map(([k, v]) => (
                  <li key={k} className="flex gap-2">
                    <span className="text-muted-foreground">{k}:</span>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                exemplars_used
              </p>
              {trace.exemplars_used.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  （无 exemplar 注入）
                </p>
              ) : (
                <ul className="space-y-1 font-mono text-xs">
                  {trace.exemplars_used.map((ex) => (
                    <li key={ex.id} className="flex gap-2">
                      <span>{ex.id}</span>
                      <span className="text-muted-foreground">
                        （相似度 {ex.similarity.toFixed(2)}）
                      </span>
                      <span className="text-muted-foreground">— {ex.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                llm_thinking_summary
              </p>
              <p className="rounded-md bg-muted/40 p-3 text-xs leading-relaxed">
                {trace.llm_thinking_summary}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
