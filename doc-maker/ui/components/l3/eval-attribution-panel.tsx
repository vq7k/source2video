import { CheckCircle2, AlertTriangle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { EvalDimension } from "@/lib/types";

interface Props {
  title?: string;
  dimensions: EvalDimension[];
  description?: string;
}

export function EvalAttributionPanel({
  title = "评估归因（Eval Attribution）",
  description,
  dimensions,
}: Props) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {dimensions.filter((d) => d.verdict === "pass").length} 通过 /{" "}
          {dimensions.filter((d) => d.verdict === "fail").length} 不通过
        </span>
      </div>
      {description && (
        <p className="mb-3 text-xs text-muted-foreground">{description}</p>
      )}
      <ul className="space-y-3">
        {dimensions.map((d, idx) => (
          <li key={`${d.dimension}-${idx}`}>
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 inline-flex items-center gap-1 font-mono text-xs",
                  d.verdict === "pass" ? "text-foreground" : "text-destructive",
                )}
              >
                {d.verdict === "pass" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                {d.verdict === "pass" ? "通过" : "不通过"}
              </span>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">{d.dimension}</p>
                <p className="text-xs text-muted-foreground">
                  judge: <span className="text-foreground/80">{d.attribution.judge_thinking}</span>
                </p>
                {d.attribution.violated_anchor && (
                  <p className="font-mono text-[11px] text-muted-foreground">
                    anchor: {d.attribution.violated_anchor}
                  </p>
                )}
                {d.attribution.violated_rule_ref && (
                  <p className="font-mono text-[11px] text-muted-foreground">
                    violated: {d.attribution.violated_rule_ref}
                  </p>
                )}
                {d.attribution.citation_in_artifact && (
                  <p className="font-mono text-[11px] text-muted-foreground">
                    citation: {d.attribution.citation_in_artifact}
                  </p>
                )}
              </div>
            </div>
            {idx < dimensions.length - 1 && <Separator className="mt-3" />}
          </li>
        ))}
      </ul>
    </Card>
  );
}
