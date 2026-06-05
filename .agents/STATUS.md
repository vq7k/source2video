# STATUS

## 当前 actionable

**明确下一步**：持久 Agent team 已初始化；下一步由 Orchestrator 派 FrameworkWorker 执行 `docs/superpowers/plans/2026-06-05-framework-data-plane-plan.md` 的 **Task 0: Package Topology Split**，先把通用 framework packages 固定到仓库根 `packages/`，再进入 contracts / Postgres SOT。

## 当前阶段

**持久 Agent team 初始化完成；doc-maker Writing Production v1 已上线并完成线上闭环验收**（2026-06-05）。

Agent team：

- Orchestrator：仓库根 `.agents/`
- FrameworkWorker：`packages/.agents/framework/`
- WritingWorker：`doc-maker/.agents/writing/`
- InfraWorker：`.agents/workers/infra/`
- QAWorker：`.agents/workers/qa/`

上一产品状态：

- 公网入口：`https://s2v.x-lin7.com`
- 默认入口：`/` 重定向/进入 `/writing`
- 部署：CodeUp `main` 自动触发云效流水线 `5006844`
- 最近部署提交：`1bfce63 docs(doc-maker): add writing research notes`；镜像 tag `1bfce634`
- 最近部署流水线：`pipelineRunId=8` `SUCCESS`；VMDeploy order `63382768` `Success`
- 线上验收：`/api/health` ok；`/writing` ok；`run_787ab96e` 到 `candidate_ready`，3 candidates，8 traces 全 `complete`；Langfuse trace `4b973abf-d46c-4539-ac6e-f79b50434fb5`，ScoreSink `complete`。
- 生产网关修复：`ftai-caddy` 原 Caddyfile 缺少 `s2v.x-lin7.com` HTTPS site block；已在服务器 `/opt/from-fullstack-to-ai/infra/Caddyfile` 追加并 reload，备份为 `Caddyfile.bak.s2v-20260605-085109`。
- 本次本地收口新增：`/writing` 反馈再来一轮 + Rule Package 草稿/发布；`/framework?traceId=` Trace 已定位 + ScoreSink 状态。
- 本地验证：`pnpm test` 4 files / 7 tests passed；`pnpm e2e` 6 passed；`pnpm build` passed。

## 最近一次 session

**2026-06-05 持久 Agent team 初始化**：将项目从单 Orchestrator/Engineer 运行方式升级为持久 Agent team；新增 FrameworkWorker / WritingWorker / InfraWorker / QAWorker 的专属 SOUL / STATUS / TODO / sessions 启动路径；明确 framework 归属仓库根 `packages/`，Writing 仅作为第一个业务 adapter。

上一 session：**2026-06-05 Writing Production v1 上线验收**：本地测试/构建通过后 push CodeUp `main`，云效流水线 `8` 成功；修复生产 Caddy 缺失 `s2v.x-lin7.com` site block 导致的公网 TLS 握手失败；线上 health、页面、LLM runtime、业务 run、Langfuse/ScoreSink、framework 深链均验收通过。

归档：[`sessions/2026-06-05-writing-production-online/`](./sessions/2026-06-05-writing-production-online/)

上一归档：[`sessions/2026-06-04-writing-v1-closure/`](./sessions/2026-06-04-writing-v1-closure/)

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
