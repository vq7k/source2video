import Link from "next/link";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { nodes } from "@/lib/mock";

export function NodeGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {nodes.map((node) => (
        <Card key={node.name} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {node.name}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-mono",
                    node.alive ? "text-foreground" : "text-destructive",
                  )}
                >
                  {node.alive ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {node.alive ? "在线" : "离线"}
                </span>
              </div>
              <h3 className="mt-1 text-base font-medium">{node.label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {node.description}
              </p>
            </div>
            <Badge variant="muted" className="font-mono">
              {node.materials_version}
            </Badge>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <dt className="text-muted-foreground">最近产物</dt>
            <dd className="truncate font-mono" title={node.latest_artifact}>
              {node.latest_artifact}
            </dd>
            <dt className="text-muted-foreground">7 日通过率</dt>
            <dd className="font-mono">{node.pass_rate_7d}</dd>
          </dl>

          <div className="mt-4 flex justify-end">
            <Button asChild variant={node.alive ? "outline" : "secondary"} size="sm">
              <Link href={`/node/${node.name}`}>
                <ArrowRight className="mr-1.5 h-3 w-3" />
                打开控制台
              </Link>
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
