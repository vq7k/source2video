import { BookOpenCheck, CheckCircle2, CircleDot, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/writing-production/common";
import {
  RULE_PATCH_DRAFT_LIMIT,
  RULE_SNAPSHOT_RULE_LIMIT,
  type WritingRunRecord,
} from "@doc-maker/writing-domain/types";
import { cn } from "@/lib/utils";

export function CandidateWorkflowPanel({
  run,
  latestGenerationRunId,
  runtimeBusy,
  onRunGenerationBatch,
}: {
  run: WritingRunRecord;
  latestGenerationRunId?: string;
  runtimeBusy?: boolean;
  onRunGenerationBatch: () => Promise<void> | void;
}) {
  const generationRuns = run.generationRuns ?? [];
  const ruleSnapshots = run.ruleSnapshots ?? [];
  const rulePatches = run.rulePatches ?? [];
  const latestGenerationRun =
    generationRuns.find((item) => item.id === latestGenerationRunId) ?? generationRuns.at(-1);
  const activeRuleSnapshot =
    ruleSnapshots.find((item) => item.id === latestGenerationRun?.ruleSnapshotId) ??
    ruleSnapshots.at(-1);
  const unprocessedFeedback = run.feedback.filter(
    (item) => (item.status ?? "unprocessed") === "unprocessed",
  );
  const compiledFeedback = run.feedback.filter((item) => item.status === "compiled");
  const draftPatches = rulePatches.filter((item) => item.status === "draft");
  const appliedPatches = rulePatches.filter((item) => item.status === "applied");
  const nextAction =
    unprocessedFeedback.length > 0
      ? "反馈已写入，系统会自动编译为规则草稿。"
      : draftPatches.length > 0
        ? "规则草稿已准备好，可以运行下一批。"
        : "继续阅读候选，选中文本打标签。";

  return (
    <section className="rounded-lg border-2 border-zinc-900 bg-white p-4 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <SectionTitle icon={CircleDot} title="决策侧栏" />
            <Badge variant="secondary">编辑 / 决策</Badge>
          </div>
          <p className="mt-2 text-muted-foreground">
            反馈会自动合并为最多 {RULE_PATCH_DRAFT_LIMIT} 条规则草稿；旧候选冻结保存，运行下一批才生成新版本。
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-zinc-50 p-3">
        <div className="text-xs text-muted-foreground">下一步</div>
        <div className="mt-1 text-sm font-semibold">{nextAction}</div>
      </div>

      <Button
        className="mt-3 w-full"
        size="sm"
        disabled={runtimeBusy || draftPatches.length === 0}
        onClick={onRunGenerationBatch}
      >
        运行下一批
      </Button>

      <div className="mt-4 grid gap-2">
        <WorkflowStep
          title="1. 反馈"
          value={`${unprocessedFeedback.length} 未处理`}
          detail={`${compiledFeedback.length} 已编译 / ${run.feedback.length} 总计`}
          active={unprocessedFeedback.length > 0}
          done={run.feedback.length > 0 && unprocessedFeedback.length === 0}
        />
        <WorkflowStep
          title="2. 规则草稿"
          value={`${draftPatches.length}/${RULE_PATCH_DRAFT_LIMIT} 草稿`}
          detail={`${appliedPatches.length} 已用于规则快照；超出自动合并`}
          active={draftPatches.length > 0}
          done={appliedPatches.length > 0 && draftPatches.length === 0}
        />
        <WorkflowStep
          title="3. 规则快照"
          value={activeRuleSnapshot?.version ?? "rules-v1"}
          detail={`${activeRuleSnapshot?.rules.length ?? 0}/${RULE_SNAPSHOT_RULE_LIMIT} 条生效规则；${ruleSnapshots.length || 1} 个版本`}
          active={false}
          done={ruleSnapshots.length > 0}
        />
        <WorkflowStep
          title="4. 生成批次"
          value={latestGenerationRun ? `第 ${latestGenerationRun.round} 批` : "待生成"}
          detail={`${generationRuns.length} 批已保存`}
          active={false}
          done={generationRuns.length > 0}
        />
      </div>
    </section>
  );
}

export function DecisionQueuePanel({
  run,
  latestGenerationRunId,
  runtimeBusy,
  disabled,
  onRunGenerationBatch,
  onDeleteFeedback,
}: {
  run: WritingRunRecord;
  latestGenerationRunId?: string;
  runtimeBusy?: boolean;
  disabled?: boolean;
  onRunGenerationBatch: () => Promise<void> | void;
  onDeleteFeedback?: (feedbackId: string) => Promise<void> | void;
}) {
  const generationRuns = run.generationRuns ?? [];
  const ruleSnapshots = run.ruleSnapshots ?? [];
  const unprocessedFeedback = run.feedback.filter(
    (item) => (item.status ?? "unprocessed") === "unprocessed",
  );
  const compiledFeedback = run.feedback.filter((item) => item.status === "compiled");
  const draftPatches = run.rulePatches.filter((item) => item.status === "draft");
  const appliedPatches = run.rulePatches.filter((item) => item.status === "applied");
  const latestGenerationRun =
    generationRuns.find((item) => item.id === latestGenerationRunId) ?? generationRuns.at(-1);
  const activeRuleSnapshot =
    ruleSnapshots.find((item) => item.id === latestGenerationRun?.ruleSnapshotId) ??
    ruleSnapshots.at(-1);
  const nextAction =
    draftPatches.length > 0
      ? "规则草稿已准备好，可以运行下一批。"
      : unprocessedFeedback.length > 0
        ? "反馈已写入，等待系统整理成下一轮规则。"
        : "继续阅读候选，选中文本打标签。";

  return (
    <section className="rounded-lg border bg-white p-4 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionTitle icon={BookOpenCheck} title="决策队列" />
          <p className="mt-2 text-muted-foreground">
            这里不编辑正文，只处理“反馈 → 规则草稿 → 规则快照 → 下一批生成”的闭环。
          </p>
        </div>
        <Badge variant="outline">决策</Badge>
      </div>

      <div className="mt-4 rounded-lg border bg-zinc-50 p-3">
        <div className="text-xs text-muted-foreground">下一步</div>
        <div className="mt-1 text-sm font-semibold">{nextAction}</div>
        <Button
          className="mt-3 w-full"
          size="sm"
          disabled={runtimeBusy || draftPatches.length === 0}
          onClick={onRunGenerationBatch}
        >
          运行下一批
        </Button>
      </div>

      <div className="mt-3 grid gap-2">
        <WorkflowStep
          title="1. 反馈"
          value={`${unprocessedFeedback.length} 未处理`}
          detail={`${compiledFeedback.length} 已编译 / ${run.feedback.length} 总计`}
          active={unprocessedFeedback.length > 0}
          done={run.feedback.length > 0 && unprocessedFeedback.length === 0}
        />
        <WorkflowStep
          title="2. 下一轮规则"
          value={`${draftPatches.length}/${RULE_PATCH_DRAFT_LIMIT} 草稿`}
          detail={`${appliedPatches.length} 已应用；满 ${RULE_PATCH_DRAFT_LIMIT} 条会自动整理，不丢反馈`}
          active={draftPatches.length > 0}
          done={appliedPatches.length > 0 && draftPatches.length === 0}
        />
        <WorkflowStep
          title="3. 本轮规则版本"
          value={activeRuleSnapshot?.version ?? "rules-v1"}
          detail={`${activeRuleSnapshot?.rules.length ?? 0}/${RULE_SNAPSHOT_RULE_LIMIT} 条生效规则；${ruleSnapshots.length || 1} 个版本`}
          done={ruleSnapshots.length > 0}
        />
        <WorkflowStep
          title="4. 下一批候选"
          value={latestGenerationRun ? `第 ${latestGenerationRun.round} 批` : "待生成"}
          detail={`${generationRuns.length} 批已保存`}
          done={generationRuns.length > 0}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <section className="rounded-lg border bg-zinc-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">反馈账本</div>
            <Badge variant={run.feedback.length ? "secondary" : "muted"}>
              {run.feedback.length} 总计
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border bg-white p-2">
              <div className="text-muted-foreground">已编译</div>
              <div className="mt-1 text-sm font-semibold">{compiledFeedback.length}</div>
            </div>
            <div className="rounded-md border bg-white p-2">
              <div className="text-muted-foreground">待处理</div>
              <div className="mt-1 text-sm font-semibold">{unprocessedFeedback.length}</div>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            打标签后先进入反馈账本；自动生成规则草稿后，反馈会从“待处理”移到“已编译”。
          </p>
        </section>

        <section className="rounded-lg border bg-zinc-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">待处理反馈</div>
            <Badge variant={unprocessedFeedback.length ? "secondary" : "muted"}>
              {unprocessedFeedback.length}
            </Badge>
          </div>
          <div className="mt-3 space-y-2">
            {unprocessedFeedback.slice(0, 4).map((feedback) => (
              <div key={feedback.id} className="rounded-md border bg-white p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {feedback.candidateId}
                  </span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{feedback.businessReason ?? feedback.kind}</Badge>
                    {onDeleteFeedback ? (
                      <button
                        type="button"
                        className="rounded-full p-1 text-muted-foreground hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-40"
                        disabled={disabled}
                        onClick={() => onDeleteFeedback(feedback.id)}
                        aria-label="删除反馈标签"
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-700">
                  {feedback.quote || feedback.note}
                </p>
              </div>
            ))}
            {!unprocessedFeedback.length ? (
              <p className="text-xs text-muted-foreground">
                暂无待处理反馈。去左侧阅读区选中文本并点一个标签。
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border bg-zinc-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">规则草稿</div>
            <Badge variant={draftPatches.length ? "secondary" : "muted"}>
              {draftPatches.length}/{RULE_PATCH_DRAFT_LIMIT}
            </Badge>
          </div>
          <div className="mt-3 space-y-2">
            {draftPatches.slice(0, RULE_PATCH_DRAFT_LIMIT).map((patch) => (
              <div key={patch.id} className="rounded-md border bg-white p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {patch.sourceCandidateId}
                  </span>
                  <Badge variant="outline">{patch.status}</Badge>
                </div>
                <p className="mt-1 text-xs font-medium">{patch.rule}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{patch.reason}</p>
              </div>
            ))}
            {!draftPatches.length ? (
              <p className="text-xs text-muted-foreground">
                暂无规则草稿。去左侧阅读区打标签后，系统会自动把反馈编译成规则草稿。
              </p>
            ) : null}
            {draftPatches.length ? (
              <p className="text-xs text-muted-foreground">
                草稿池满 {RULE_PATCH_DRAFT_LIMIT} 条自动合并，不丢反馈。
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          已应用规则 {appliedPatches.length} 条。应用后只生成新的规则快照，不回写历史候选。
        </section>
      </div>
    </section>
  );
}

function WorkflowStep({
  title,
  value,
  detail,
  active,
  done,
}: {
  title: string;
  value: string;
  detail: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-3",
        active && "border-zinc-900 shadow-sm",
        done && !active && "border-emerald-200 bg-emerald-50/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground">{title}</div>
        {done ? <CheckCircle2 className="size-3.5 text-emerald-700" /> : null}
      </div>
      <div className="mt-2 text-sm font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
