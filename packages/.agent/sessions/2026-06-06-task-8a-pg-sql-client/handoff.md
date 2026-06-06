# FrameworkWorker Handoff — Task 8A: pg → FrameworkSqlClient adapter

## 任务身份

你是 source2video 持久 **FrameworkWorker**（cwd = `packages/`）。按 catch-up 你已知边界：只动 root `packages/**` framework，不碰 `doc-maker/**`、不碰 Writing。

## 背景

Writing dataset draft API（`POST /api/writing-runs/[runId]/dataset-drafts`）当前恒返回 `503 repository_unconfigured`，因为生产路径没有真实 `FrameworkSqlClient` 来源——全仓没有 `pg` 依赖，也没有 `pg.Pool → FrameworkSqlClient` 适配。

`FrameworkSqlClient` 接口（`packages/framework-store/src/db.ts`）：
```ts
export type FrameworkSqlResult<T> = { rows: T[] };
export type FrameworkSqlClient = {
  query<T>(sql: string, parameters?: readonly unknown[]): Promise<FrameworkSqlResult<T>>;
};
```
与 node-postgres（`pg`）的 `Pool.query(text, values) → { rows }` 形状天然对齐，适配是薄包装。

## 目标（本任务唯一交付）

在 `packages/framework-store` 提供一个 generic 的、连接 Postgres 的 `FrameworkSqlClient` 工厂，供任意业务 adapter（含 Writing）复用：

1. 给 `packages/framework-store/package.json` 增 `pg` 依赖（runtime）+ `@types/pg`（dev）。`pg` 是 node-postgres 标准 driver，直接选用。
2. 新增 `src/pg-client.ts`（命名你定，保持业务无关），导出工厂，例如：
   - `createPgSqlClient(input: { connectionString: string } | { pool: Pool }): FrameworkSqlClient`
   - 接受 connection string（内部建 `pg.Pool`）或外部传入的 `Pool`（便于复用/测试）。
   - 透传 `query<T>(sql, parameters)`，把 `pg` 的 `QueryResult.rows` 原样作为 `T[]` 返回。
   - 若内部建 Pool，提供可选的 `close()`/`end()` 出口（按你判断，别泄漏连接）。
3. 从 `packages/framework-store/src/index.ts` export 出去。

## 纪律

- **TDD**：先写失败测试再实现。用 fake/mock `pg.Pool`（构造一个满足 `query` 的假对象）验证：sql 透传、parameters 透传、`rows` 原样返回、泛型 `T` 正确。**不连真实 Postgres**、不依赖本机 `psql`。
- **命名业务无关**：不写 `writing*`/`docMaker*`，保持 framework 通用（仓级 ADR-023）。
- 不改 `createPostgresDatasetRepository` 等既有 repository 逻辑，只新增 adapter。

## 边界

- **可写**：`packages/framework-store/{package.json, src/pg-client.ts, src/index.ts}` + 对应测试文件 + 必要时 root `pnpm-lock.yaml`（pnpm install 产生）。
- **禁止**：`doc-maker/**`、root 其他 packages 的业务逻辑、任何 Writing 代码、线上/部署资源。
- **需升级 Orchestrator/user**：若发现 `pg` 引入导致 workspace/构建拓扑问题（如 Docker build、Next.js bundling）需要改 root 配置——先回报，别擅自扩面。

## 验证（必跑，贴真实输出）

```bash
# 在 packages/ 或仓库根，按 pnpm workspace 实际情况
pnpm install                 # 装 pg / @types/pg
pnpm --filter @source2video/framework-store test   # 或 targeted vitest 跑新测试文件
pnpm test                    # 全量，确认不回归（基线：10 files / 29-30 tests）
pnpm typecheck
git diff --check
```

期望：新测试通过；全量 test 不回归；typecheck 0；diff 干净。

## 提交

自验通过后 commit（conventional commit，scope = framework），例如：
`feat(framework): add postgres sql client adapter`
commit **只含 root `packages/**` + lockfile**，不得含 `doc-maker/**` 或 `.agent` 状态。

## 回报格式（写回给 Orchestrator）

- changed files（含 commit hash）
- commands + results（真实输出摘要）
- 新 adapter 的导出 API 签名（供 WritingWorker Task 8B import）
- risks
- next actionable（交棒 8B 需要知道的：怎么 import、connection string 还是 Pool、是否需 close）

收工按 worker 收工 SOP 更新 `packages/.agent/STATUS.md` + `TODO.md`。
