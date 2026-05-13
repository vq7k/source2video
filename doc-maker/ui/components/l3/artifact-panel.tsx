import { Card } from "@/components/ui/card";

interface Props {
  title?: string;
  metadata?: Array<{ key: string; value: string }>;
  children: React.ReactNode;
}

export function ArtifactPanel({ title = "产物（Artifact）", metadata, children }: Props) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      <div className="space-y-3">{children}</div>
      {metadata && metadata.length > 0 && (
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 border-t pt-3 text-xs md:grid-cols-2">
          {metadata.map(({ key, value }) => (
            <div key={key} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}
