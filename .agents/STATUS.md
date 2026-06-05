# STATUS

## 当前 actionable

**无明示 actionable，等 user 拍板下一步**。候选：

1. 部署 Writing Production v1 闭环收口到线上并做 smoke。
2. 继续推进 v1 后 backlog：Rule Scope A/B、dataset draft、发布治理或业务 UI 打磨。
3. video-maker / tts-maker 启动设计。
4. s2v-core 抽离决断：ADR-023 触发条件 = 第 2 个 LLM workflow 子项目开工；当前未触发。

**catch-up 后必升级**：当前无明确 actionable，agent 必问 user "现在该做什么"，不允许自行选择或默认关 session。

## 当前阶段

**doc-maker Writing Production v1 本地闭环已完成**（2026-06-04）。

- 公网入口：`https://s2v.x-lin7.com`
- 默认入口：`/` 重定向/进入 `/writing`
- 部署：CodeUp `main` 自动触发云效流水线 `5006844`
- 最近部署提交：`fda66ce fix(trace): preserve successful llm call status`
- 线上已完成首次验收：`/api/health` ok；候选生成到 `candidate_ready`；Langfuse trace 存在并可从 `/framework` 跳转。
- 本次本地收口新增：`/writing` 反馈再来一轮 + Rule Package 草稿/发布；`/framework?traceId=` Trace 已定位 + ScoreSink 状态。
- 本地验证：`pnpm test` 4 files / 7 tests passed；`pnpm e2e` 6 passed；`pnpm build` passed。

## 最近一次 session

**2026-06-04 Writing Production v1 闭环收口**：完成用户要求的 1-4：口径收敛、测试补证、产品主路径、观测硬化。新增 e2e 证明 `/writing` 再来一轮 + Rule Package 发布、`/writing` 观测深链 + 返回恢复，以及 `/framework?traceId=` 定位 trace + ScoreSink 状态；`pnpm test` / `pnpm e2e` / `pnpm build` 全绿。

归档：[`sessions/2026-06-04-writing-v1-closure/`](./sessions/2026-06-04-writing-v1-closure/)

上一归档：[`sessions/2026-06-02-source2video-deploy/`](./sessions/2026-06-02-source2video-deploy/)

## 阻塞

无。

## 引用

- 项目身份: [`../PROJECT.md`](../PROJECT.md)
- 仓拓扑: [`../docs/repo-layout.md`](../docs/repo-layout.md)
- 仓级 ADR: [`../docs/ADRs/`](../docs/ADRs/)
- doc-maker: [`../doc-maker/CLAUDE.md`](../doc-maker/CLAUDE.md)
- 部署文档: [`../docs/deploy.md`](../docs/deploy.md)
- OpenSpec 变更: [`../openspec/`](../openspec/)
- 项目级 SOP: [`./skills/`](./skills/)
- 任务清单: [`./TODO.md`](./TODO.md)
- learned-rules: [`./learned-rules.md`](./learned-rules.md)
