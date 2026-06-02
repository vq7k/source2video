# TODO

## 当前 in-progress（user 工作，本 harness session 不动）

- [ ] doc-maker/packages/observability 抽离完成（git status：3 R rename + 5 docs M 未 commit）
- [ ] doc-maker docs 同步（07-acceptance / README / business-console / framework-core / reference/langfuse）

## 候选里程碑（待 user 拍板优先级）

- [ ] doc-maker writing production 下一阶段范围决断（最近 `5a5c8cb` runtime observability 后续）
- [ ] video-maker 启动设计（如推进 — 视觉决策 + Remotion 渲染编排）
- [ ] tts-maker 启动设计（如推进，可能复用旧 harness 不一定 source2video-shaped）
- [ ] s2v-core 抽离决断（ADR-023 触发条件）

## 跨 runtime harness 后续完善（agent 自我）

- [ ] 实战验证：下次 cold start（无论 Claude / Codex / Aider）跑一遍 catch-up，看是否真自报角色 + 判 STATUS actionable + 强制升级
- [ ] 业务复杂度上升时拆 Worker：如 doc-maker / video-maker / tts-maker 各成独立 Worker session（参考 `from-fullstack-to-ai` 5 角色模型）
- [ ] 如多 session 模式形成，补 `.agents/skills/catch-up/SKILL.md` + `.agents/skills/session-summary/SKILL.md`（当前直接内嵌 PROJECT.md，YAGNI）
- [ ] 补项目硬约束（如适用）：隐私 / 化名 / secret 管理等，写入 `.agents/SOUL.md` 末尾段
