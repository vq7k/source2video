import { Card } from "@/components/ui/card";
import type { NodeMetrics } from "@/lib/types";

interface Props {
  metrics: NodeMetrics;
}

const labels: Array<{ key: keyof NodeMetrics; label: string }> = [
  { key: "pass_rate", label: "通过率" },
  { key: "avg_tokens", label: "平均 token" },
  { key: "budget_state", label: "预算" },
  { key: "avg_latency", label: "平均延迟" },
  { key: "feedback_queue", label: "改物料队列" },
  { key: "avg_cost", label: "平均成本" },
];

export function NodeMetricsBar({ metrics }: Props) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-medium">
        节点指标{" "}
        <span className="text-xs font-normal text-muted-foreground">
          （最近 7 次跑批）
        </span>
      </h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3">
        {labels.map(({ key, label }) => (
          <div key={key} className="flex justify-between border-b border-dashed pb-1.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-mono text-xs">{metrics[key]}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
