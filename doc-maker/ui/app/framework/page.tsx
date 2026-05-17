import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  Database,
  ExternalLink,
  FileText,
  ListChecks,
  MessageSquare,
  Radio,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FrameworkNodeRunRecord, LLMCallTraceRecord } from "@/lib/framework-run-types";
import { getLangfuseSettings, langfuseTraceUrl } from "@/lib/observability/langfuse";
import { readLLMRuntimeSettings, toLLMRuntimeSettingsView } from "@/lib/llm/settings";
import { listWritingRuns } from "@/lib/writing-runtime";
import type {
  CandidateRecord,
  HumanFeedbackRecord,
  RulePatchRecord,
  WritingRunRecord,
} from "@/lib/writing-run-types";
import { cn } from "@/lib/utils";

type FrameworkSearchParams = {
  runId?: string;
  node?: string;
  nodeRunId?: string;
  artifactId?: string;
  candidateId?: string;
  round?: string;
  returnTo?: string;
  traceId?: string;
};

type FrameworkPageProps = {
  searchParams?: Promise<FrameworkSearchParams>;
};

function traceCalls(run: WritingRunRecord) {
  const calls = new Map<string, LLMCallTraceRecord>();

  for (const call of run.llmTraces ?? []) {
    calls.set(call.id, call);
  }

  for (const call of run.frameworkRuns?.flatMap((node) => node.llmCalls ?? []) ?? []) {
    calls.set(call.id, call);
  }

  return Array.from(calls.values()).sort((left, right) => left.at.localeCompare(right.at));
}

function pickRun(runs: WritingRunRecord[], runId?: string) {
  if (runId) {
    return runs.find((run) => run.id === runId) ?? null;
  }

  return runs[0] ?? null;
}

function nodeKey(node: FrameworkNodeRunRecord) {
  return node.nodeId ?? node.nodeType;
}

function nodeCalls(node: FrameworkNodeRunRecord, calls: LLMCallTraceRecord[]) {
  const embedded = node.llmCalls ?? [];
  if (embedded.length) {
    return embedded;
  }

  return calls.filter((call) => call.nodeRunId === node.id);
}

function isFallbackCall(call: LLMCallTraceRecord) {
  return (
    call.provider.includes("fallback") ||
    call.promptVersion.includes("fallback") ||
    call.metadata?.fallback === true
  );
}

function nodeStatus(node: FrameworkNodeRunRecord, calls: LLMCallTraceRecord[]) {
  const related = nodeCalls(node, calls);
  if (!related.length) {
    return "no trace";
  }
  if (related.some((call) => call.status === "failed")) {
    return "failed";
  }
  if (related.some(isFallbackCall)) {
    return "fallback";
  }

  return "traced";
}

function nodeStatusLabel(status: string) {
  switch (status) {
    case "traced":
      return "已记录";
    case "fallback":
      return "已回退";
    case "failed":
      return "失败";
    case "no trace":
      return "无记录";
    default:
      return status;
  }
}

function nodeTitle(nodeType: string) {
  switch (nodeType) {
    case "scope_extraction":
      return "提炼写法范围";
    case "precheck_normalization":
      return "清洗生成契约";
    case "candidate_generation":
      return "生成候选批次";
    case "candidate_eval":
      return "候选自动评分";
    case "feedback_reasoning":
      return "分析人工反馈";
    case "feedback_compilation":
      return "整理反馈账本";
    case "rule_patch_compilation":
      return "编译规则草稿";
    default:
      return nodeType;
  }
}

function nodeWhy(nodeType: string) {
  switch (nodeType) {
    case "scope_extraction":
      return "把一句话想法和参考片段提炼为本轮写作规则范围。";
    case "precheck_normalization":
      return "把输入契约、输出契约和规则范围清洗成可生成、可评分的契约。";
    case "candidate_generation":
      return "按当前规则快照生成候选文本，并把自动评分写入观测层。";
    case "candidate_eval":
      return "按评分口径给候选评分，保留归因。";
    case "feedback_reasoning":
      return "把人工轻反馈写入评分和反馈元数据，供规则草稿使用。";
    case "feedback_compilation":
      return "把反馈整理成账本，不直接改写旧候选。";
    case "rule_patch_compilation":
      return "把反馈账本编译成下一轮规则草稿。";
    default:
      return "业务节点通过框架契约记录执行事实。";
  }
}

function callSummary(call: LLMCallTraceRecord) {
  switch (call.nodeType) {
    case "scope_extraction":
      return "快速输入 / 参考文本 -> 写作规则范围";
    case "precheck_normalization":
      return "输入契约 + 输出契约 -> 内容摘要 / 规则 / 风险";
    case "candidate_generation":
      return "规则快照 -> 候选批次 + 评分";
    case "candidate_eval":
      return "评分口径 -> 候选分数";
    case "feedback_reasoning":
      return "选中文本 / 标签 -> 人工反馈评分";
    case "feedback_compilation":
      return "反馈项 -> 反馈账本";
    case "rule_patch_compilation":
      return "反馈账本 -> 规则草稿";
    default:
      return call.nodeType;
  }
}

function shortId(id?: string) {
  if (!id) {
      return "无";
  }

  return id.length > 18 ? `${id.slice(0, 18)}...` : id;
}

function nodeRound(node: FrameworkNodeRunRecord) {
  const text = [node.artifacts.map((artifact) => artifact.id).join(" "), node.inputs.join(" ")].join(" ");
  const matched = text.match(/_r(\d+)/);
  return matched ? Number(matched[1]) : null;
}

function nodeStage(nodeType: string) {
  switch (nodeType) {
    case "scope_extraction":
      return "输入";
    case "precheck_normalization":
      return "检查";
    case "candidate_generation":
    case "candidate_eval":
      return "生成";
    case "feedback_reasoning":
    case "feedback_compilation":
      return "评审";
    case "rule_patch_compilation":
      return "规则更新";
    default:
      return "其他";
  }
}

function groupedNodes(nodes: FrameworkNodeRunRecord[]) {
  const order = ["输入", "检查", "生成", "评审", "规则更新", "其他"];
  return order
    .map((stage) => ({
      stage,
      nodes: nodes.filter((node) => nodeStage(node.nodeType) === stage),
    }))
    .filter((group) => group.nodes.length);
}

function filteredNodes(run: WritingRunRecord | null, params: FrameworkSearchParams) {
  const nodes = run?.frameworkRuns ?? [];
  if (!run) {
    return [];
  }

  if (params.nodeRunId) {
    return nodes.filter((node) => node.id === params.nodeRunId);
  }

  if (params.node) {
    return nodes.filter((node) => node.id === params.node || node.nodeId === params.node || node.nodeType === params.node);
  }

  if (params.artifactId) {
    return nodes.filter((node) => node.artifacts.some((artifact) => artifact.id === params.artifactId));
  }

  if (params.candidateId) {
    const candidate = run.candidates.find((item) => item.id === params.candidateId);
    if (candidate?.round) {
      return nodes.filter((node) => node.nodeType === "candidate_generation" && nodeRound(node) === candidate.round);
    }

    return nodes.filter((node) => node.nodeType === "candidate_generation");
  }

  if (params.round) {
    const round = Number(params.round);
    return Number.isFinite(round)
      ? nodes.filter((node) => node.nodeType === "candidate_generation" && nodeRound(node) === round)
      : nodes;
  }

  return nodes;
}

function traceMatches(call: LLMCallTraceRecord, traceId: string | undefined) {
  if (!traceId) {
    return false;
  }

  return call.id === traceId || call.langfuseTraceId === traceId || call.upstreamTraceId === traceId;
}

function selectedNodeFor(
  allNodes: FrameworkNodeRunRecord[],
  matchedNodes: FrameworkNodeRunRecord[],
  params: FrameworkSearchParams,
  calls: LLMCallTraceRecord[],
) {
  if (params.traceId) {
    const traceCall = calls.find((call) => traceMatches(call, params.traceId));
    const traceNode =
      (traceCall?.nodeRunId ? allNodes.find((node) => node.id === traceCall.nodeRunId) : null) ??
      allNodes.find((node) => nodeCalls(node, calls).some((call) => traceMatches(call, params.traceId)));

    if (traceNode) {
      return traceNode;
    }
  }

  return matchedNodes[0] ?? null;
}

function safeReturnHref(returnTo: string | undefined, runId: string | undefined) {
  if (returnTo?.startsWith("/")) {
    return returnTo;
  }

  return runId ? `/?runId=${encodeURIComponent(runId)}` : "/";
}

function frameworkHref(params: FrameworkSearchParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  return `/framework?${search.toString()}`;
}

function firstLangfuseTraceUrl(calls: LLMCallTraceRecord[], selectedTraceId?: string) {
  const selectedTrace = calls.find((call) => traceMatches(call, selectedTraceId));
  const selectedTraceUrl = selectedTrace ? langfuseTraceUrl(selectedTrace.langfuseTraceId) : null;
  if (selectedTraceUrl) {
    return selectedTraceUrl;
  }

  const trace = calls.find((call) => langfuseTraceUrl(call.langfuseTraceId));
  return trace ? langfuseTraceUrl(trace.langfuseTraceId) : null;
}

export default async function LangfuseLensPage({ searchParams }: FrameworkPageProps) {
  const params = (await searchParams) ?? {};
  const runs = await listWritingRuns();
  const selectedRun = pickRun(runs, params.runId);
  const calls = selectedRun ? traceCalls(selectedRun) : [];
  const nodes = selectedRun?.frameworkRuns ?? [];
  const matchedNodes = filteredNodes(selectedRun, params);
  const selectedNode = selectedNodeFor(nodes, matchedNodes, params, calls);
  const selectedNodeCalls = selectedNode ? nodeCalls(selectedNode, calls) : [];
  const runtimeSettings = toLLMRuntimeSettingsView(await readLLMRuntimeSettings());
  const langfuseSettings = getLangfuseSettings();
  const failedCalls = calls.filter((call) => call.status === "failed");
  const selectedTraceId = params.traceId;
  const inspectorCalls = selectedNode ? selectedNodeCalls : [];
  const visibleLangfuseUrl = firstLangfuseTraceUrl(inspectorCalls, selectedTraceId) ?? null;
  const returnHref = safeReturnHref(params.returnTo, selectedRun?.id);

  return (
    <main className="grid h-screen grid-cols-[44px_minmax(0,1fr)] overflow-hidden bg-[#f6f5f1] text-zinc-950 xl:grid-cols-[44px_320px_minmax(0,1fr)_380px]">
      <FrameworkRail returnHref={returnHref} />

      <aside className="hidden min-h-0 flex-col border-r bg-white xl:flex">
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">任务</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">选择一个业务运行记录</div>
          </div>
          <Badge variant={langfuseSettings.configured ? "secondary" : "outline"}>
            {langfuseSettings.configured ? "Langfuse" : "本地"}
          </Badge>
        </div>
        <RunPicker runs={runs} selectedRun={selectedRun} returnTo={params.returnTo} />
      </aside>

      <section className="flex min-h-0 flex-col border-r bg-white">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link href={returnHref} className="hover:text-zinc-950">doc-marker</Link>
              <span>/</span>
              <span>观测</span>
              {selectedNode ? (
                <>
                  <span>/</span>
                  <span className="truncate font-medium text-zinc-950">{nodeTitle(selectedNode.nodeType)}</span>
                </>
              ) : null}
            </div>
            <div className="mt-1 truncate text-sm font-semibold">
              {selectedRun?.jobSpec.title ?? "未选择任务"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline">{runtimeSettings.provider}</Badge>
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href="/settings/llm">
                <Settings2 className="mr-1 size-3.5" />
                LLM
              </Link>
            </Button>
          </div>
        </header>

        <div className="flex min-h-12 shrink-0 items-center justify-between gap-4 border-b bg-[#fbfaf6] px-4 py-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">观测工作台</Badge>
              {!langfuseSettings.projectId ? <Badge variant="outline">缺少 LANGFUSE_PROJECT_ID</Badge> : null}
              {selectedRun ? <Badge variant="outline">{nodes.length} 个节点</Badge> : null}
              {selectedRun ? <Badge variant="outline">{calls.length} 次模型调用</Badge> : null}
              {failedCalls.length ? <Badge variant="destructive">{failedCalls.length} failed</Badge> : null}
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {selectedNode ? nodeWhy(selectedNode.nodeType) : `当前查询：${queryLabel(params)}`}
            </div>
          </div>
          {selectedRun ? <Badge variant="outline">round {selectedRun.round ?? 1}</Badge> : null}
        </div>

        {selectedRun ? (
          <NodeStageNav
            run={selectedRun}
            nodes={nodes}
            calls={calls}
            selectedNode={selectedNode}
            returnTo={params.returnTo}
          />
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f5f1]">
          <div className="mx-auto max-w-5xl p-5">
          {!selectedRun ? (
            <EmptyState title="还没有可查看的任务" body="先回工作台跑一次输入、检查、候选评审的业务闭环。" />
          ) : selectedNode ? (
            <NodeLens
              run={selectedRun}
              node={selectedNode}
              nodes={nodes}
              calls={selectedNodeCalls}
              selectedCandidateId={params.candidateId}
              returnTo={params.returnTo}
            />
          ) : (
            <RunLens run={selectedRun} nodes={matchedNodes} calls={calls} />
          )}
          </div>
        </div>

        <div className="max-h-[520px] shrink-0 border-t bg-[#fbfaf6] xl:hidden">
          <TraceInspector
            calls={inspectorCalls}
            selectedNode={selectedNode}
            visibleLangfuseUrl={visibleLangfuseUrl}
            selectedTraceId={selectedTraceId}
          />
        </div>
      </section>

      <aside className="hidden min-h-0 flex-col bg-[#fbfaf6] xl:flex">
        <TraceInspector
          calls={inspectorCalls}
          selectedNode={selectedNode}
          visibleLangfuseUrl={visibleLangfuseUrl}
          selectedTraceId={selectedTraceId}
        />
      </aside>
    </main>
  );
}

function FrameworkRail({ returnHref }: { returnHref: string }) {
  return (
    <nav className="flex min-h-0 flex-col items-center gap-3 border-r bg-[#efeee9] px-2 py-3">
      <Button asChild variant="ghost" size="icon" className="size-8" aria-label="返回主工作台" title="返回主工作台">
        <Link href={returnHref}>
          <ArrowLeft className="size-4" />
        </Link>
      </Button>
      <div className="flex size-8 items-center justify-center rounded-md bg-zinc-950 text-[11px] font-semibold text-white">
        Fx
      </div>
      <div className="mt-2 rotate-180 text-[11px] font-medium uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
        OBSERVE
      </div>
      <div className="mt-auto">
        <Button asChild variant="ghost" size="icon" className="size-8" aria-label="LLM 设置">
          <Link href="/settings/llm">
            <Settings2 className="size-4" />
          </Link>
        </Button>
      </div>
    </nav>
  );
}

function RunPicker({
  runs,
  selectedRun,
  returnTo,
}: {
  runs: WritingRunRecord[];
  selectedRun: WritingRunRecord | null;
  returnTo?: string;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between px-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Database className="size-4" />
          任务运行记录
        </div>
        <Badge variant="outline">{runs.length}</Badge>
      </div>
      <div className="min-h-0 flex-1 divide-y overflow-y-auto">
        {runs.map((run) => {
          const active = run.id === selectedRun?.id;

          return (
            <Link
              key={run.id}
              href={frameworkHref({ runId: run.id, returnTo })}
              className={cn(
                "block px-3 py-3 text-sm transition hover:bg-zinc-50",
                active && "bg-zinc-50 shadow-[inset_3px_0_0_#18181b]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="break-all font-mono text-xs">{run.id}</span>
                <Badge variant={active ? "secondary" : "outline"}>{run.status}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {run.jobSpec.title}
              </p>
            </Link>
          );
        })}
        {!runs.length ? <p className="px-3 py-6 text-sm text-muted-foreground">暂无任务。</p> : null}
      </div>
    </section>
  );
}

function NodeStageNav({
  run,
  nodes,
  calls,
  selectedNode,
  returnTo,
}: {
  run: WritingRunRecord;
  nodes: FrameworkNodeRunRecord[];
  calls: LLMCallTraceRecord[];
  selectedNode: FrameworkNodeRunRecord | null;
  returnTo?: string;
}) {
  return (
    <section className="shrink-0 border-b bg-white">
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CircleDot className="size-4" />
            当前任务流程节点
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            节点是当前任务的子层级；点击节点后，中间看业务产物，右侧看 trace 证据。
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {nodes.length} 个节点
        </Badge>
      </div>
      <div className="flex gap-3 overflow-x-auto border-t bg-[#fbfaf6] px-4 py-3">
        {groupedNodes(nodes).map((group) => (
          <div key={group.stage} className="min-w-[190px] max-w-[260px] flex-1 rounded-lg border bg-white">
            <div className="border-b bg-zinc-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.stage}
            </div>
            <div className="grid gap-1 p-2">
              {group.nodes.map((node) => (
                <NodeLink
                  key={node.id}
                  runId={run.id}
                  node={node}
                  index={nodes.findIndex((item) => item.id === node.id)}
                  active={node.id === selectedNode?.id}
                  status={nodeStatus(node, calls)}
                  returnTo={returnTo}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function NodeLink({
  runId,
  node,
  index,
  active,
  status,
  returnTo,
}: {
  runId: string;
  node: FrameworkNodeRunRecord;
  index: number;
  active: boolean;
  status: string;
  returnTo?: string;
}) {
  return (
    <Link
      href={frameworkHref({ runId, nodeRunId: node.id, returnTo })}
      className={cn(
        "block min-w-0 rounded-md border border-transparent px-2.5 py-2 transition hover:border-zinc-300 hover:bg-zinc-50",
        active && "border-zinc-900 bg-zinc-50 shadow-sm",
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md border bg-white font-mono text-[11px]",
            active && "border-zinc-900 text-zinc-950",
          )}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate font-semibold" title={nodeTitle(node.nodeType)}>
              {nodeTitle(node.nodeType)}
            </span>
            <Badge variant={status === "traced" ? "secondary" : "outline"} className="h-5 shrink-0 px-1.5 text-[10px]">
              {nodeStatusLabel(status)}
            </Badge>
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
            {nodeKey(node)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function RunLens({
  run,
  nodes,
  calls,
}: {
  run: WritingRunRecord;
  nodes: FrameworkNodeRunRecord[];
  calls: LLMCallTraceRecord[];
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="rounded-xl border-2 border-zinc-900 bg-white">
        <CardHeader className="border-b bg-zinc-50">
          <CardTitle className="text-lg">从上方选择一个流程节点</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            当前页只做业务运行的观测封装：先选任务，再选节点，最后查看该节点的业务产物、Eval 和 Trace。
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 p-5 md:grid-cols-3">
          <Info label="当前任务" value={run.id} />
          <Info label="流程节点" value={`${nodes.length} 个`} />
          <Info label="模型调用" value={`${calls.length} 条`} />
          {!nodes.length ? <EmptyBlock text="这个任务没有节点记录。" /> : null}
        </CardContent>
      </Card>

      <Card className="rounded-xl bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="size-4" />
            可用查询条件
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>推荐从业务节点进入：`runId + nodeRunId`。</p>
          <Info label="当前任务" value={run.id} />
          <Info label="候选过滤" value="/framework?runId=...&candidateId=candidate_r1_1" />
          <Info label="轮次过滤" value="/framework?runId=...&round=2" />
          <Info label="Artifact 过滤" value="/framework?runId=...&artifactId=..." />
        </CardContent>
      </Card>
    </section>
  );
}

function NodeLens({
  run,
  node,
  nodes,
  calls,
  selectedCandidateId,
  returnTo,
}: {
  run: WritingRunRecord;
  node: FrameworkNodeRunRecord;
  nodes: FrameworkNodeRunRecord[];
  calls: LLMCallTraceRecord[];
  selectedCandidateId?: string;
  returnTo?: string;
}) {
  const index = nodes.findIndex((item) => item.id === node.id);

  return (
    <section className="space-y-4">
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md border bg-white font-mono text-xs">
            {index + 1}
          </span>
          <h1 className="text-lg font-semibold">{nodeTitle(node.nodeType)}</h1>
          <Badge variant="outline">{nodeKey(node)}</Badge>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{nodeWhy(node.nodeType)}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Info label="输入" value={node.inputs.join(" + ")} />
          <Info label="输出" value={node.artifacts.map((artifact) => artifact.kind).join(", ")} />
          <Info label="LLM 调用" value={calls.length.toString()} />
          <Info label="节点运行 ID" value={node.id} />
        </div>
      </section>

      <NodeBusinessDetail run={run} node={node} selectedCandidateId={selectedCandidateId} />
      <EvalPanel node={node} />

      <details className="rounded-xl border bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
          工程兜底 JSON
        </summary>
        <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">
          {JSON.stringify({ node, calls }, null, 2)}
        </pre>
      </details>
    </section>
  );
}

function NodeBusinessDetail({
  run,
  node,
  selectedCandidateId,
}: {
  run: WritingRunRecord;
  node: FrameworkNodeRunRecord;
  selectedCandidateId?: string;
}) {
  switch (node.nodeType) {
    case "scope_extraction":
      return <ScopePanel run={run} />;
    case "precheck_normalization":
      return <PrecheckPanel run={run} />;
    case "candidate_generation":
      return <CandidatePanel run={run} node={node} selectedCandidateId={selectedCandidateId} />;
    case "feedback_reasoning":
      return <FeedbackPanel run={run} node={node} />;
    case "rule_patch_compilation":
      return <RulePatchPanel run={run} node={node} />;
    default:
      return <EmptyBlock text="这个节点暂时没有业务详情面板；可先查看 Trace 和 Eval。" />;
  }
}

function ScopePanel({ run }: { run: WritingRunRecord }) {
  if (!run.ruleScope) {
    return <EmptyBlock text="当前任务没有写作规则范围。" />;
  }

  return (
    <section className="rounded-xl border bg-zinc-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="size-4" />
          写作规则范围
        </h3>
        <Badge variant="secondary">score {run.ruleScope.eval.score}</Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {run.ruleScope.items.map((item) => (
          <div key={item.id} className="rounded-lg border bg-white p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{item.kind}</Badge>
              <Badge variant="secondary">{item.confidence}</Badge>
            </div>
            <p className="mt-2 leading-6 text-zinc-800">{item.text}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">来源：{item.sourceNote}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PrecheckPanel({ run }: { run: WritingRunRecord }) {
  return (
    <section className="rounded-xl border bg-zinc-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4" />
          生成前检查候选
        </h3>
        <Badge variant={run.precheckRun.status === "confirmed" ? "secondary" : "outline"}>
          {run.precheckRun.status}
        </Badge>
      </div>
      {run.precheckRun.warning ? (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          {run.precheckRun.warning}
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <DetailBlock title="内容摘要" body={run.precheckRun.contentBrief} />
        <DetailBlock title="依据边界" body={run.precheckRun.groundingBrief} />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <DetailList title="写作规则候选" items={run.precheckRun.writingRulesCandidate} />
        <div className="rounded-lg border bg-white p-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="size-4" />
            Risk Checks
          </h4>
          <div className="mt-2 space-y-2">
            {run.precheckRun.riskChecks.map((risk) => (
              <div key={risk.label} className="rounded-md border bg-zinc-50 p-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={risk.level === "high" ? "destructive" : "outline"}>{risk.level}</Badge>
                  <span className="font-medium">{risk.label}</span>
                </div>
                <p className="mt-2 leading-6 text-zinc-700">{risk.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CandidatePanel({
  run,
  node,
  selectedCandidateId,
}: {
  run: WritingRunRecord;
  node: FrameworkNodeRunRecord;
  selectedCandidateId?: string;
}) {
  const round = nodeRound(node) ?? run.round ?? 1;
  const candidates = run.candidates.filter((candidate) => (candidate.round ?? 1) === round);
  const visibleCandidates = selectedCandidateId
    ? candidates
        .slice()
        .sort((left, right) => Number(right.id === selectedCandidateId) - Number(left.id === selectedCandidateId))
    : candidates;
  const coreEval = run.evalRun?.round === round ? run.evalRun.coreEval : null;

  return (
    <section className="rounded-xl border bg-zinc-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">候选批次 · 第 {round} 轮</h3>
        <Badge variant="secondary">{candidates.length} 个候选</Badge>
      </div>
      <div className="mt-3 grid gap-3">
        {visibleCandidates.map((candidate) => (
          <CandidateCard key={candidate.id} candidate={candidate} selected={candidate.id === selectedCandidateId} />
        ))}
        {!candidates.length ? <EmptyBlock text="这个节点还没有候选文本。" /> : null}
      </div>
      {coreEval ? (
        <p className="mt-3 rounded-lg border bg-white p-3 text-sm leading-6 text-muted-foreground">
          Core Eval 已生成 {coreEval.candidateResults.length} 个候选的 attribution，并通过 ScoreSink 写入 Langfuse Scores。
        </p>
      ) : (
        <div className="mt-3">
          <EmptyBlock text="历史轮次的评分详情暂未单独保存；当前任务只保留最新评分记录。" />
        </div>
      )}
    </section>
  );
}

function CandidateCard({ candidate, selected = false }: { candidate: CandidateRecord; selected?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-3 text-sm",
        selected && "border-2 border-zinc-900 bg-zinc-50 shadow-sm",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{candidate.title}</div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{candidate.id}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {selected ? <Badge variant="secondary">当前候选</Badge> : null}
          <Badge variant="outline">score {candidate.total}</Badge>
        </div>
      </div>
      <p className="mt-2 leading-6 text-zinc-800">{candidate.summary}</p>
      <div className="mt-2 grid gap-2 md:grid-cols-4">
        <Info label="基础质量" value={candidate.breakdown.quality.toString()} />
        <Info label="任务匹配" value={candidate.breakdown.fit.toString()} />
        <Info label="风格偏好" value={candidate.breakdown.style.toString()} />
        <Info label="风险扣分" value={candidate.breakdown.risk.toString()} />
      </div>
    </div>
  );
}

function FeedbackPanel({ run, node }: { run: WritingRunRecord; node: FrameworkNodeRunRecord }) {
  const ids = new Set(node.artifacts.map((artifact) => artifact.id));
  const visible = run.feedback.filter((item) => ids.has(item.id));

  return (
    <section className="rounded-xl border bg-zinc-50 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="size-4" />
        人工反馈
      </h3>
      <div className="mt-3 space-y-2">
        {visible.map((item) => (
          <FeedbackCard key={item.id} feedback={item} />
        ))}
        {!visible.length ? <EmptyBlock text="这个节点没有反馈记录。" /> : null}
      </div>
    </section>
  );
}

function FeedbackCard({ feedback }: { feedback: HumanFeedbackRecord }) {
  return (
    <div className="rounded-lg border bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{feedback.kind}</Badge>
        <Badge variant="secondary">{feedback.status ?? "unprocessed"}</Badge>
        <span className="font-mono text-xs text-muted-foreground">{feedback.id}</span>
      </div>
      <p className="mt-2 leading-6 text-zinc-800">{feedback.issue ?? feedback.note}</p>
      {feedback.quote ? <p className="mt-2 rounded-md border bg-zinc-50 p-2 text-zinc-700">“{feedback.quote}”</p> : null}
      <p className="mt-2 text-xs text-muted-foreground">
        候选：{feedback.candidateId} · 原因：{feedback.businessReason ?? "无"} · 归因：{feedback.likelyCause ?? "无"}
      </p>
    </div>
  );
}

function RulePatchPanel({ run, node }: { run: WritingRunRecord; node: FrameworkNodeRunRecord }) {
  const ids = new Set(node.artifacts.map((artifact) => artifact.id));
  const visible = run.rulePatches.filter((item) => ids.has(item.id));

  return (
    <section className="rounded-xl border bg-zinc-50 p-4">
      <h3 className="text-sm font-semibold">规则草稿</h3>
      <div className="mt-3 space-y-2">
        {visible.map((patch) => (
          <RulePatchCard key={patch.id} patch={patch} />
        ))}
        {!visible.length ? <EmptyBlock text="这个节点没有规则草稿。" /> : null}
      </div>
    </section>
  );
}

function RulePatchCard({ patch }: { patch: RulePatchRecord }) {
  return (
    <div className="rounded-lg border bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{patch.status}</Badge>
        <span className="font-mono text-xs text-muted-foreground">{patch.id}</span>
      </div>
      <p className="mt-2 font-medium leading-6">{patch.rule}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-700">{patch.note}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        feedback: {patch.feedbackIds.join(", ")} · reason: {patch.reason}
      </p>
    </div>
  );
}

function EvalPanel({ node }: { node: FrameworkNodeRunRecord }) {
  return (
    <Card className="rounded-xl bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="size-4" />
          Eval / Scores
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          只展示该节点关联的检查和评分归因。
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {node.evalRuns.flatMap((evalRun) =>
          evalRun.checks.map((check) => (
            <div key={`${evalRun.id}-${check.label}`} className="rounded-lg border bg-zinc-50 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={check.status === "pass" ? "secondary" : "outline"}>{check.status}</Badge>
                <span className="font-medium">{check.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{evalRun.kind}</span>
              </div>
              <p className="mt-2 leading-6 text-zinc-800">{check.evidence}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{check.guidance}</p>
            </div>
          )),
        )}
        {!node.evalRuns.length ? <EmptyBlock text="这个节点还没有框架层 EvalRun。" /> : null}
      </CardContent>
    </Card>
  );
}

function TraceInspector({
  calls,
  selectedNode,
  visibleLangfuseUrl,
  selectedTraceId,
}: {
  calls: LLMCallTraceRecord[];
  selectedNode: FrameworkNodeRunRecord | null;
  visibleLangfuseUrl: string | null;
  selectedTraceId?: string;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b bg-white px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Trace 检查器</div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {selectedNode ? nodeTitle(selectedNode.nodeType) : "先从中间选择流程节点"}
            </p>
          </div>
          <Badge variant="outline">{calls.length}</Badge>
        </div>
      </div>
      <div className="shrink-0 border-b bg-[#fbfaf6] p-3">
        <div className="grid gap-2">
          {visibleLangfuseUrl ? (
            <Button asChild size="sm" className="w-full">
              <Link href={visibleLangfuseUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 size-3.5" />
                打开 Langfuse
              </Link>
            </Button>
          ) : (
            <Badge variant="outline" className="justify-center py-2">
              本地 trace 可用，暂无 Langfuse 外链
            </Badge>
          )}
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/settings/llm">
              <Settings2 className="mr-1 size-3.5" />
              LLM 配置
            </Link>
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <TracePanel calls={calls} selectedTraceId={selectedTraceId} />
      </div>
    </section>
  );
}

function TracePanel({ calls, selectedTraceId }: { calls: LLMCallTraceRecord[]; selectedTraceId?: string }) {
  return (
    <Card className="rounded-xl bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="size-4" />
              模型调用时间线
            </CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              先看调用顺序；需要细节时展开输入、输出和工程字段。
            </p>
          </div>
          <Badge variant="outline">{calls.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {calls.map((call) => (
          <CallCard key={call.id} call={call} selected={traceMatches(call, selectedTraceId)} />
        ))}
        {!calls.length ? <EmptyBlock text="先选择中间流程节点，再查看该节点的模型调用、输入输出和 Langfuse 外链。" /> : null}
      </CardContent>
    </Card>
  );
}

function CallCard({ call, selected = false }: { call: LLMCallTraceRecord; selected?: boolean }) {
  const fallback = isFallbackCall(call);
  const traceUrl = langfuseTraceUrl(call.langfuseTraceId);

  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-3 text-sm",
        selected && "border-2 border-zinc-900 shadow-sm",
        call.status === "failed" && "border-red-300 bg-red-50",
        fallback && call.status !== "failed" && "border-amber-300 bg-amber-50",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{callSummary(call)}</div>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{call.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{call.sink}</Badge>
          <Badge variant={call.status === "failed" ? "destructive" : "outline"}>
            {call.status === "failed" ? "失败" : "完成"}
          </Badge>
          {fallback ? <Badge variant="secondary">已回退</Badge> : null}
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        <Info label="模型提供方 / 模型" value={`${call.provider} / ${call.model}`} />
        <Info label="提示词版本" value={call.promptVersion} />
        <Info label="输出" value={call.outputArtifact.summary} />
        <Info label="评分写入" value={scoreSinkLabel(call)} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {traceUrl ? (
          <Button asChild size="sm">
            <Link href={traceUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 size-3.5" />
              打开 Langfuse
            </Link>
          </Button>
        ) : call.langfuseTraceId ? (
          <Badge variant="outline">已写 trace，配置 LANGFUSE_PROJECT_ID 后可直跳</Badge>
        ) : (
          <Badge variant="outline">无 Langfuse trace id</Badge>
        )}
        <Badge variant="outline">本地调用 {shortId(call.id)}</Badge>
        <Badge variant="outline">Langfuse trace {shortId(call.langfuseTraceId)}</Badge>
        {call.langfuseObservationId ? (
          <Badge variant="outline">Observation {shortId(call.langfuseObservationId)}</Badge>
        ) : null}
        <Badge variant="outline">节点 {shortId(call.nodeRunId)}</Badge>
      </div>
      <details className="mt-3 rounded-lg border bg-zinc-50 px-3 py-2" open={selected || undefined}>
        <summary className="cursor-pointer text-xs font-medium text-zinc-800">
          输入 / 输出详情
        </summary>
        <div className="mt-3 grid gap-3">
          <JsonBlock title="输入内容" value={call.inputPayload ?? { refs: call.inputRefs }} />
          <JsonBlock title="输出内容" value={call.outputPayload ?? call.outputArtifact} />
        </div>
      </details>
      <details className="mt-3 rounded-lg border bg-zinc-50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          工程字段
        </summary>
        <div className="mt-3 grid gap-2">
          <Info label="输入引用" value={call.inputRefs.join(", ")} />
          <Info label="输出产物" value={`${call.outputArtifact.kind}:${call.outputArtifact.id}`} />
          <Info label="评分结果" value={call.evalResult ? `${call.evalResult.kind} / ${call.evalResult.status}` : "跳过"} />
          <Info label="耗时" value={call.latencyMs ? `${call.latencyMs}ms` : "无"} />
        </div>
      </details>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border bg-white">
      <div className="border-b bg-zinc-50 px-3 py-2 text-xs font-medium text-muted-foreground">{title}</div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-5 text-zinc-800 [overflow-wrap:anywhere]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function scoreSinkLabel(call: LLMCallTraceRecord) {
  const scoreStatus = call.metadata?.scoreSinkStatus ?? call.metadata?.feedbackScoreSinkStatus;
  const scoreSink = call.metadata?.scoreSink ?? call.metadata?.feedbackScoreSink;
  const scoreCount = call.metadata?.scoreCount ?? call.metadata?.feedbackScoreCount;

  if (!scoreStatus) {
    return "无";
  }

  return `${scoreSink ?? "unknown"} / ${scoreStatus} / ${scoreCount ?? 0}`;
}

function queryLabel(params: FrameworkSearchParams) {
  const pairs = [
    ["runId", params.runId],
    ["nodeRunId", params.nodeRunId],
    ["node", params.node],
    ["artifactId", params.artifactId],
    ["candidateId", params.candidateId],
    ["round", params.round],
    ["traceId", params.traceId],
  ].filter(([, value]) => value);

  if (!pairs.length) {
    return "未指定，默认显示最近任务的节点目录";
  }

  return pairs.map(([key, value]) => `${key}=${value}`).join(" / ");
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-white px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium leading-5 [overflow-wrap:anywhere]">
        {value || "无"}
      </div>
    </div>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-800">{body || "无"}</p>
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <ol className="mt-2 space-y-2 text-sm leading-6 text-zinc-800">
        {items.map((item, index) => (
          <li key={`${index}-${item}`} className="flex gap-2">
            <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-white p-3 text-sm leading-6 text-muted-foreground">
      {text}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="rounded-xl bg-white">
      <CardContent className="p-6">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
