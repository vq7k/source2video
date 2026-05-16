"use client";

import { useState } from "react";
import { RefreshCw, Scale } from "lucide-react";

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
  const [previewed, setPreviewed] = useState(false);

  const handleRerun = () => {
    setPreviewed(true);
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
        <Button onClick={handleRerun}>
          <RefreshCw className="mr-1.5 h-3 w-3" />
          预览重跑动作
        </Button>
        <Button variant="outline" onClick={handleRerun}>
          <Scale className="mr-1.5 h-3 w-3" />
          预览对比动作
        </Button>
      </div>
      {previewed && (
        <div className="mt-3 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p>当前仅预览 CLI/git-backed action，不会修改产品状态。</p>
          <code className="mt-2 block font-mono text-[11px]">
            {`s2v run ${node} --case ${caseId} --materials ${version}`}
          </code>
        </div>
      )}
    </Card>
  );
}
