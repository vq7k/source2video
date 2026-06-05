# STATUS

## 当前 actionable

**等待 FrameworkWorker 回报**：Task 0 Package Topology Split 已派发给 FrameworkWorker。handoff 位于 `packages/.agent/sessions/2026-06-05-task-0-package-topology/handoff.md`。当前分支 `codex/framework-topology` 有未提交 WIP，由 FrameworkWorker 接手完成、验证并提交；Orchestrator 暂停直接开发，只做验收。

## 当前阶段

**持久 Agent team 初始化完成；doc-maker Writing Production v1 已上线并完成线上闭环验收**（2026-06-05）。

Agent team：

- Orchestrator：仓库根 `.agent/`
- FrameworkWorker：`packages/.agent/`
- WritingWorker：`doc-maker/.agent/`

横切职责：

- Infra / Deploy / Cloud：临时 SubAgent，由 Orchestrator 从仓库根派发
- QA / Migration / Release Gate：临时 SubAgent，由 Orchestrator 从仓库根派发

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

**2026-06-05 派发 FrameworkWorker Task 0**：Orchestrator 越界启动了 package topology WIP 后暂停开发，将 `codex/framework-topology` 未提交 WIP 正式移交 FrameworkWorker。FrameworkWorker 应从 `packages/` catch-up，读取 handoff，完成 root `packages/` 拓扑迁移、验证并提交，不 push。

上一 session：**2026-06-05 持久 Agent team 初始化**：将项目从单 Orchestrator/Engineer 运行方式升级为持久 Agent team；新版规则下仅保留有独立 cwd 的 FrameworkWorker / WritingWorker；Infra / QA 改为临时 SubAgent 范围；明确 framework 归属仓库根 `packages/`，Writing 仅作为第一个业务 adapter。

再上一 session：**2026-06-05 Writing Production v1 上线验收**：本地测试/构建通过后 push CodeUp `main`，云效流水线 `8` 成功；修复生产 Caddy 缺失 `s2v.x-lin7.com` site block 导致的公网 TLS 握手失败；线上 health、页面、LLM runtime、业务 run、Langfuse/ScoreSink、framework 深链均验收通过。

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
