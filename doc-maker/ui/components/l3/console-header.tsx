"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  title: string;
  artifactId: string;
  backHref?: string;
  backLabel?: string;
  extraRight?: React.ReactNode;
}

export function ConsoleHeader({
  title,
  artifactId,
  backHref = "/hub",
  backLabel = "总览控制台",
  extraRight,
}: Props) {
  return (
    <header className="space-y-1.5 border-b pb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="h-8 px-2">
            <Link href={backHref}>
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              {backLabel}
            </Link>
          </Button>
          <Badge variant="muted">节点诊断</Badge>
          <span className="text-xs text-muted-foreground">单节点产物</span>
        </div>
        <div className="flex items-center gap-2">
          {extraRight}
        </div>
      </div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="font-mono text-xs text-muted-foreground">
        产物：{artifactId}
      </p>
    </header>
  );
}
