"use client";

import { useState } from "react";
import { RefreshCw, Scale, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NodeName } from "@/lib/types";

interface Props {
  node: NodeName;
  caseOptions?: string[];
  materialVersions?: string[];
  defaultCase?: string;
  defaultVersion?: string;
}

export function RerunPanel({
  node,
  caseOptions = ["01_basic.md"],
  materialVersions = ["v1.0"],
  defaultCase,
  defaultVersion,
}: Props) {
  const [version, setVersion] = useState(defaultVersion ?? materialVersions[0]);
  const [caseId, setCaseId] = useState(defaultCase ?? caseOptions[0]);
  const [running, setRunning] = useState(false);

  const handleRerun = () => {
    setRunning(true);
    setTimeout(() => setRunning(false), 1800);
  };

  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-medium">重跑</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            物料版本
          </Label>
          <Select value={version} onValueChange={setVersion}>
            <SelectTrigger className="font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {materialVersions.map((v) => (
                <SelectItem key={v} value={v} className="font-mono">
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">输入用例</Label>
          <Select value={caseId} onValueChange={setCaseId}>
            <SelectTrigger className="font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {caseOptions.map((c) => (
                <SelectItem key={c} value={c} className="font-mono">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={handleRerun} disabled={running}>
          {running ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3 w-3" />
          )}
          {running ? "调 s2v run ..." : "重跑"}
        </Button>
        <Button variant="outline" disabled={running}>
          <Scale className="mr-1.5 h-3 w-3" />
          重跑并对比当前
        </Button>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
          {`subprocess.run([\"s2v\", \"run\", \"${node}\", \"--case\", \"${caseId}\", \"--materials\", \"${version}\"])`}
        </span>
      </div>
    </Card>
  );
}
