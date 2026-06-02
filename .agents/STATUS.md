# STATUS

## 当前 actionable

**无明示 actionable，等 user 拍板下一步**。候选（按 git 现场推断 + ADR）：

1. **完成 doc-maker/packages/observability 抽离**（git status 显示 3 个 R rename `doc-maker/ui/lib/{observability/langfuse,score-sink,trace-sink}.ts → doc-maker/packages/observability/src/` 未 commit + 5 个 doc-maker docs 同步未 commit — 这是 user in-progress 工作，本 bootstrap 不动）
2. doc-maker writing production 下一阶段范围决断（最近 commit `5a5c8cb` 加了 runtime observability，下一里程碑范围待定）
3. video-maker / tts-maker 启动设计（如 user 想推进；目前 TBD）
4. s2v-core 抽离时机决断（ADR-023 触发 = 第 2 个 LLM workflow 子项目开工 — 目前仅 doc-maker 推进，未到触发条件）
5. 跨 runtime harness 完善（agent 自我）：catch-up SOP 实战验证 / 按需拆 Worker / 按需补 `.agents/skills/catch-up` 或 `session-summary`

**catch-up 后必升级**：见上无明示 actionable，agent 必问 user "现在该做什么"，不允许自行选择或默认关 session。

## 当前阶段

**doc-maker 业务原型推进 + 跨 runtime agent harness 已建立**（2026-06-02）。

- doc-maker：UI mock + OpenSpec 文档基线 + writing production runtime observability 落地（commit `5a5c8cb`）+ packages/observability 抽离 in progress（未 commit）
- video-maker / tts-maker：TBD（等触发）
- s2v-core：不存在（等 ADR-023 触发条件）
- `.agents/` harness：本次 bootstrap 建立（PROJECT.md / SOUL / STATUS / TODO / learned-rules / decisions / sessions），跨 Claude Code / Codex / Aider 持久化

## 最近一次 session

**2026-06-02 跨 runtime agent harness bootstrap**：从外部上下文（`from-fullstack-to-ai` 项目 5 角色 + opus bootstrap 实战）最小化提炼。新增 9 文件 + 2 目录（PROJECT.md / CLAUDE.md / AGENTS.md / `.agents/SOUL.md` / `STATUS.md` / `TODO.md` / `learned-rules.md` / `decisions/README.md` / `sessions/README.md` + `decisions/` + `sessions/`）。

未触及 user in-progress 工作（doc-maker 多个 M / R 修改保留）。

详 git commit 本次 bootstrap message。

## 阻塞

无。

## 引用

- 项目身份: [`../PROJECT.md`](../PROJECT.md)
- 仓拓扑: [`../docs/repo-layout.md`](../docs/repo-layout.md)
- 仓级 ADR: [`../docs/ADRs/`](../docs/ADRs/)
- doc-maker: [`../doc-maker/CLAUDE.md`](../doc-maker/CLAUDE.md)
- OpenSpec 变更: [`../openspec/`](../openspec/)
- 项目级 SOP（已有）: [`./skills/`](./skills/)（openspec / shadcn / source-command 等）
- 任务清单: [`./TODO.md`](./TODO.md)
- learned-rules: [`./learned-rules.md`](./learned-rules.md)
