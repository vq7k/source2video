"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowRight, CheckCircle2, XCircle } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { nodes } from "@/lib/mock";

export function SystemHealthPanel() {
  const [open, setOpen] = useState(false);
  const allAlive = nodes.every((n) => n.alive);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">系统健康</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-mono text-xs",
                  allAlive ? "text-foreground" : "text-destructive",
                )}
              >
                {allAlive ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                生成服务 {allAlive ? "正常" : "需要诊断"}
              </span>
            </div>
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t bg-muted/20 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              业务层默认只展示可行动状态。需要排查时进入诊断总览。
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/hub">
                <ArrowRight className="mr-1.5 h-3 w-3" />
                总览控制台
              </Link>
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
