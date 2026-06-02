# Project: source2video

> 项目顶层身份。任何 agent runtime（Claude Code / Codex / Aider / 其他）进入本项目时**第一份必读**。

## 我是谁

`source2video` (s2v) — **LLM-driven 子系统的单仓 monorepo**。把外部独立 repo（astral-pipeline）的经验抽象重构成新的 LLM workflow 流水线。

当前子项目：

| 子项目 | 状态 | 内容 | 入口 |
|---|---|---|---|
| **doc-maker** | 业务原型推进中 | Writing Production 文本生成系统，讲解文档包是默认 Output Profile | [`./doc-maker/`](./doc-maker/) |
| video-maker | TBD | 视觉决策 + Remotion 渲染编排（可能） | — |
| tts-maker | TBD | 音频生成（可能复用旧 harness） | — |
| s2v-core | **不存在** | 共享框架包——抽离触发 = 第 2 个 LLM workflow 子项目开工 | [`docs/ADRs/023.md`](./docs/ADRs/023.md) |

跨仓拓扑：详 [`docs/repo-layout.md`](./docs/repo-layout.md)（s2v 决策 + astral-pipeline 数据/编排 + TTS / Remotion 外部）。

## 启动序列

### 第 1 步：找到自己角色

```
你的 cwd       →  你的角色
─────────────────────────────────
仓库根         →  Engineer（暂单角色，后续按需拆分）
doc-maker/    →  Engineer（同上；子项目级 catch-up 见 doc-maker/CLAUDE.md）
```

注：本项目当前为**单角色架构**（YAGNI）。后续如 doc-maker / video-maker / tts-maker 业务并发推进，可按需拆分 Worker（参考 `from-fullstack-to-ai` 项目 5 角色模型）。

### 第 2 步：catch-up（必跑，4 sub-step）

1. **读 `.agents/SOUL.md`**——你是谁、做什么、**不**做什么、边界
2. **读 `.agents/STATUS.md`**——当前状态 + 上次 session 留下什么 + **「当前 actionable」段**
3. **读 `.agents/TODO.md`**——任务清单
4. **必自报**（强制输出，不许跳过）：

```
我是 Engineer（cwd = <path>）。
我不做：
1. <SOUL "我不做" 第 1 条 — 替代路径>
2. <SOUL "我不做" 第 2 条 — 替代路径>
3. ...
```

未自报 = catch-up 未完成，**不可开干**。

### 第 3 步：判 STATUS actionable

读 STATUS.md "当前 actionable" 段后**必须**回答：

> 当前 STATUS 是否含**明确 actionable 下一步**？

- **有明确 actionable** → 按 TODO 开始
- **无 actionable / 全是历史** → **强制升级 user 问 "现在该做什么"**，不允许自行推断或默认 "无任务 = 关 session"

判定标准：如果你需要"猜"或"推断"下一步，那就是 STATUS 不够 actionable，必须升级。

## 找东西地图

| 你想做 | 去 |
|---|---|
| 理解项目身份 | 本文件 `PROJECT.md` |
| 理解我是谁（角色） | `.agents/SOUL.md` |
| 当前状态 / 上次 session 留下什么 | `.agents/STATUS.md` |
| 我该做什么 | `.agents/TODO.md` |
| 跨 session 踩坑 | `.agents/learned-rules.md` |
| 仓级 ADR（正式决策） | `docs/ADRs/` |
| session 级临时决策草稿 | `.agents/decisions/` |
| 历史 session 归档 | `.agents/sessions/` |
| 仓拓扑 / 架构分层 | `docs/repo-layout.md` |
| 项目级 SOP（OpenSpec / shadcn 等） | `.agents/skills/` |
| 子项目 doc-maker 上下文 | `doc-maker/CLAUDE.md` |
| OpenSpec 变更管理 | `openspec/` |

## Runtime 入口（自动加载）

| Runtime | 入口文件 | 说明 |
|---|---|---|
| Claude Code | `CLAUDE.md` | 自动加载，内容指向本文件 |
| Codex / Aider / 其他 | `AGENTS.md` | 同上 |
| 任何 runtime | 本文件 `PROJECT.md` | source of truth |

`.claude/` `.codex/` 目录已存在（runtime-specific 配置 / commands / skills），不冲突。

## 跨 runtime 上下文持久化原则

本项目的 agent 上下文（`.agents/SOUL.md` / `STATUS.md` / `TODO.md` / `learned-rules.md` / `sessions/` / `decisions/`）**全部 git tracked**，跟项目走不跟 runtime 走。

切换 Claude Code / Codex / Aider 时，新 runtime 读同一套文件，理解一致、记忆持续。

## session 结束 SOP（简化版）

session 结束前**必须**：

1. 更新 `.agents/STATUS.md`（替换"当前 actionable" + "当前阶段" + "最近一次 session"，不堆历史）
2. 更新 `.agents/TODO.md`（删除已完成 / 添加新发现）
3. 如有踩坑 → 追加 `.agents/learned-rules.md`（一条 L<N>）
4. 如有重大决策 → 写 `.agents/decisions/<date>-<topic>.md`（session 草稿）；如涉及仓级架构 → 升级写 `docs/ADRs/<NNN>.md`
5. 如 session 跨多个动作 → 归档到 `.agents/sessions/<date>-<topic>/`（context.md / decisions.md / outputs.md 三件套，按需）

YAGNI：单 commit 小动作不需要归档 sessions/；仅多步骤复杂 session 才走全套。
