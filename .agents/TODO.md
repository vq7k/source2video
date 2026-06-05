# TODO

## 当前 in-progress

- [ ] 派 FrameworkWorker 执行 framework data plane **Task 0: Package Topology Split**

## user/in-progress 文件归属（本次收口不重排）

- [ ] doc-maker docs 同步/提交决断：`07-acceptance.md` / `README.md` / `business-console.md` / `framework-core.md` / `reference/langfuse.md`
- [ ] 未跟踪 docs/skills 文件归属决断：`.agents/skills/`、`skills-lock.json`、若干 `doc-maker/docs/*research*.md` / remediation 文档

## 候选里程碑（待 user 拍板优先级）

- [ ] framework data plane 本地闭环：root `packages/` contracts → Postgres SOT → worker queue → artifact store → dataset/eval/gate
- [ ] doc-maker writing production 下一阶段范围决断：Topic/Round、规则包、评审闭环、业务 UI 打磨或稳定性增强
- [ ] video-maker 启动设计（如推进：视觉决策 + Remotion 渲染编排）
- [ ] tts-maker 启动设计（如推进，可能复用旧 harness，不一定 source2video-shaped）
- [ ] s2v-core 抽离决断（ADR-023 触发条件 = 第 2 个 LLM workflow 子项目开工）

## 已完成

- [x] 2026-06-05 初始化持久 Agent team：Orchestrator / FrameworkWorker / WritingWorker / InfraWorker / QAWorker
- [x] 2026-06-05 部署 Writing Production v1 闭环收口到线上并做 smoke / 业务验收

## 线上运维候选（按需）

- [ ] 将 `s2v.x-lin7.com` Caddy site block 从生产手工配置同步回网关项目的长期 SOT，避免未来重建 `ftai-caddy` 丢失配置
- [ ] 如继续用 Langfuse 页面验收，安装/启用 Codex Chrome Extension 后可复用 Chrome 登录态验证 trace 页面权限
- [ ] 如需要回滚，重跑云效历史流水线；镜像 tag 使用 `${CI_COMMIT_ID}`，不是裸 `latest`

## 跨 runtime harness 后续完善（agent 自我）

- [ ] 实战验证：下次 cold start（无论 Claude / Codex / Aider）跑一遍 catch-up，看是否真自报角色 + 判 STATUS actionable + 强制升级
- [x] 业务复杂度上升时拆 Worker：FrameworkWorker / WritingWorker / InfraWorker / QAWorker 已有持久启动路径
- [ ] 如多 session 模式形成，补 `.agents/skills/catch-up/SKILL.md` + `.agents/skills/session-summary/SKILL.md`
- [ ] 补项目硬约束（如适用）：隐私 / 化名 / secret 管理等，写入 `.agents/SOUL.md` 末尾段
