# Outputs

## Code

- `doc-maker/ui/app/writing/page.tsx`
  - `/writing` 定稿后可生成 Rule Package 草稿并发布。
  - `/writing` 的观测入口带 `runId / candidateId / nodeRunId / traceId / returnTo`，从 `/framework` 返回后恢复当前主题。
- `doc-maker/ui/app/framework/page.tsx`
  - `/framework?traceId=` 显式展示 trace 命中和 ScoreSink / Langfuse 状态。
  - 默认返回路径改为 `/writing`，避免根路由重定向丢上下文。

## Tests

- `doc-maker/ui/tests/e2e/writing-l1.spec.ts`
  - 新增“反馈再来一轮 + Rule Package 发布”闭环测试。
  - 新增“观测深链 + 返回恢复当前主题”闭环测试。
- `doc-maker/ui/tests/e2e/framework-trace.spec.ts`
  - 新增 trace 深链定位 + ScoreSink 状态测试。

## Docs

- `doc-maker/CLAUDE.md`
- `doc-maker/docs/07-acceptance.md`
- `doc-maker/docs/README.md`
- `doc-maker/docs/business-console.md`
- `doc-maker/docs/reference/langfuse.md`
- `.agents/STATUS.md`
- `.agents/TODO.md`
- `.agents/learned-rules.md`

## Verification

```bash
cd doc-maker/ui
pnpm test
pnpm e2e
pnpm build
```

结果：

- `pnpm test`: 4 files / 7 tests passed
- `pnpm e2e`: 6 tests passed
- `pnpm build`: passed
