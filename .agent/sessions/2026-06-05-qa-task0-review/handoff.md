# Temporary QA SubAgent Handoff — Review Task 0 Commit

## 任务身份

你是 Orchestrator 临时派发的 **QA / Release Gate SubAgent**。你不是常驻 Worker，不创建 `.agent` 状态。

## 目标

独立 review `bda65dd chore(framework): split root package topology` 是否满足 Task 0 验收。

## Scope

只读/验证优先。不要改生产行为，不要改 framework 实现。

检查：

1. commit 是否只包含 Task 0 归属文件
2. root `packages/` 是否拥有 generic framework packages
3. legacy `doc-maker/packages/workflow-core|observability` 是否被清掉
4. imports 是否从 `@doc-maker/*` 切到 `@source2video/*`
5. 当前未提交文件是否没有混入 framework WIP

## 建议命令

```bash
git show --name-status --oneline --no-renames bda65dd
rg -n '@doc-maker/(workflow-core|observability)|doc-maker/packages/(workflow-core|observability)' packages doc-maker/packages doc-maker/ui/tests doc-maker/ui/app doc-maker/ui/tsconfig.json doc-maker/ui/vitest.config.ts
cd doc-maker/ui
pnpm exec vitest run tests/runtime/framework-package-topology.test.ts
pnpm test
pnpm typecheck
```

## 输出要求

写回一个临时 report，不要修改代码：

`/.agent/sessions/2026-06-05-qa-task0-review/report.md`

格式：

```markdown
## QA Summary

- Result: PASS / FAIL
- Evidence:
- Commands:
- Findings:
- Risks:
- Required fixes:
```
