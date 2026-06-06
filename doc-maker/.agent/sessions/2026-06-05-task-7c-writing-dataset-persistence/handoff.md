# Task 7C: Writing Dataset Persistence Flow

## 角色

WritingWorker（cwd = `/Users/xuelin/projects/source2video/doc-maker`）。

先按 `doc-maker/AGENTS.md` catch-up：读 `../PROJECT.md`、`.agent/SOUL.md`、`.agent/STATUS.md`、`.agent/TODO.md`，完成自报后再开工。

## 背景

已完成：

- FrameworkWorker Task 7A：`55cd28e feat(framework): persist dataset drafts`
- WritingWorker Task 7B：`24d323f feat(writing): adapt dataset drafts to framework items`

现在已有 `writingDatasetDraftItemToFrameworkDatasetItem()`，但还没有从真实 Writing run/API 触发并持久化 dataset draft 的链路。

## 目标

把 Writing 人工反馈沉淀出的 dataset draft 接入可调用的业务路径：

1. 读取真实 `WritingRunRecord`
2. 用 `buildWritingAdapterReadinessProjection()` 生成 dataset draft
3. 转换为 `FrameworkDatasetItem`
4. 通过注入的 generic `DatasetRepository` append 到固定 Writing draft dataset
5. 暴露一个轻量 API route 触发/返回结果

短期不接真实 PG driver；真实 `FRAMEWORK_DATABASE_URL` runtime client 留给 Infra/Orchestrator 后续处理。本任务先做 repository 注入与可测试 API flow。

## 建议实现

- 新增 `doc-maker/packages/writing-domain/src/dataset-draft-persistence.ts`
  - export `WRITING_DATASET_DRAFT_ID`
  - export `persistWritingDatasetDraftsForRun(run, repository, options?)`
  - 若 dataset 不存在，先 `putDataset({ kind: "writing_dataset_draft", version: "draft", ... })`
  - 逐条 append Task 7B 产出的 `FrameworkDatasetItem`
  - 返回 `{ dataset, items }` 或等价结构
- 新增 API route：`doc-maker/ui/app/api/writing-runs/[runId]/dataset-drafts/route.ts`
  - `POST` 读取 run
  - 使用一个可注入 repository provider
  - repository 未配置时返回明确 503/501，不假装成功
  - repository 配置时调用 persistence service 并返回 dataset/items 摘要
- 测试优先覆盖 service；如果 route 容易测，也覆盖 route handler。

## 允许修改

- `doc-maker/packages/writing-domain/src/adapter-readiness.ts`（仅必要小调整）
- `doc-maker/packages/writing-domain/src/dataset-draft-persistence.ts`
- `doc-maker/ui/app/api/writing-runs/[runId]/dataset-drafts/route.ts`
- `doc-maker/ui/tests/runtime/writing-dataset-persistence.test.ts`
- `doc-maker/ui/tests/runtime/writing-adapter-readiness.test.ts`（仅必要小调整）
- `doc-maker/.agent/STATUS.md`
- `doc-maker/.agent/TODO.md`

## 禁止修改

- 不改 root `packages/**`
- 不改 framework schema/migrations/contracts
- 不改 UI 页面
- 不做部署、Caddy、云资源、PG 运维
- 不新增 npm dependency，除非先停止并回报
- 不 push

## TDD 要求

先写 RED：

- 用真实 mock Writing JSON runtime 生成 run/feedback/rule patch/finalize/rule package
- 调用 persistence service 或 route
- 断言 fake `DatasetRepository` 收到 fixed dataset + `FrameworkDatasetItem`

再写 GREEN。

## 验证

从 `doc-maker/ui`：

```bash
pnpm exec vitest run tests/runtime/writing-dataset-persistence.test.ts tests/runtime/writing-adapter-readiness.test.ts tests/runtime/framework-dataset.test.ts
pnpm test
pnpm typecheck
```

从仓库根：

```bash
git diff --check
git diff --name-only HEAD
git show --name-only --pretty=format: HEAD -- packages
```

## 提交

只 stage 本任务允许的代码/测试文件；状态文件可更新但保持 unstaged。

```bash
git add doc-maker/packages/writing-domain/src/dataset-draft-persistence.ts \
  'doc-maker/ui/app/api/writing-runs/[runId]/dataset-drafts/route.ts' \
  doc-maker/ui/tests/runtime/writing-dataset-persistence.test.ts \
  doc-maker/packages/writing-domain/src/adapter-readiness.ts \
  doc-maker/ui/tests/runtime/writing-adapter-readiness.test.ts
git commit -m "feat(writing): persist dataset drafts through api flow"
```

若实际未改 adapter-readiness / adapter-readiness test，不要 stage 它们。

## 回报

回报 commit、验证结果、是否有未配置 repository 的运行时限制。不要 push。
