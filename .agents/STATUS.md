# STATUS

## 当前 actionable

**无明示 actionable，等 user 拍板下一步**。候选：

1. 继续推进 v1 后 backlog：Rule Scope A/B、dataset draft、发布治理或业务 UI 打磨。
2. video-maker / tts-maker 启动设计。
3. s2v-core 抽离决断：ADR-023 触发条件 = 第 2 个 LLM workflow 子项目开工；当前未触发。

**catch-up 后必升级**：当前无明确 actionable，agent 必问 user "现在该做什么"，不允许自行选择或默认关 session。

## 当前阶段

**doc-maker Writing Production v1 已上线并完成线上闭环验收**（2026-06-05）。

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

**2026-06-05 Writing Production v1 上线验收**：本地测试/构建通过后 push CodeUp `main`，云效流水线 `8` 成功；修复生产 Caddy 缺失 `s2v.x-lin7.com` site block 导致的公网 TLS 握手失败；线上 health、页面、LLM runtime、业务 run、Langfuse/ScoreSink、framework 深链均验收通过。

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
