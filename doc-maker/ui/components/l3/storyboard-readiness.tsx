import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface Props {
  scope: string;
  artifactParam?: string;
}

export function StoryboardReadiness({ scope, artifactParam }: Props) {
  return (
    <Card className="border-dashed bg-muted/10 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="font-mono text-[10px]">
          STORYBOARD
        </Badge>
        <span>
          {scope} 当前使用内置示例产物；真实产物解析器尚未接入。
        </span>
        {artifactParam && (
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
            artifact={artifactParam}
          </code>
        )}
      </div>
    </Card>
  );
}
