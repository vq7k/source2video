# source2video

**LLM-driven 子系统的单仓 monorepo**——把外部独立 repo 的经验抽象重构成新的 LLM workflow 流水线。

> 复用边界：`astral-pipeline`（数据 + 编排）作为外部独立 repo 复用；其它全部在 s2v 里重做。

---

## 子项目

| 子项目 | 状态 | 内容 | 入口 |
|---|---|---|---|
| **doc-maker** | 开发中（文档完备，零代码，准备实施 MVP） | PPT/教材 → 讲解视频文档（script + visual_spec + qa） | [`./doc-maker/`](./doc-maker/) |
| video-maker | TBD | 视觉决策 + Remotion 渲染编排（可能） | — |
| tts-maker | TBD | 音频生成（可能复用旧 harness，不一定 source2video-shaped） | — |
| s2v-core | **不存在** | 共享框架包——抽离条件 = 第二个 LLM workflow 子项目开工 | 见 [`docs/ADRs/023.md`](./docs/ADRs/023.md) |

---

## 仓级文档

| 文档 | 内容 |
|---|---|
| [`docs/README.md`](./docs/README.md) | 仓级文档入口 |
| [`docs/repo-layout.md`](./docs/repo-layout.md) | 仓拓扑 / 跨仓边界 / 4 层 DAG / 技术架构分层 |
| [`docs/ADRs/`](./docs/ADRs/) | 仓级 ADR：023 单仓多子项目 / 024 4 层 DAG |

---

## 跨仓拓扑（四方分工）

```
┌─ s2v ────────────────┐  ┌─ astral-pipeline ──┐
│ 决策（LLM 节点）      │  │ 数据 + 编排        │
└──────────────────────┘  └────────────────────┘

┌─ TTS（外部）─────────┐  ┌─ Remotion（外部）──┐
│ 音频生成              │  │ 视频渲染           │
└──────────────────────┘  └────────────────────┘
```

详见 [`docs/repo-layout.md`](./docs/repo-layout.md)。

---

## 开发入口

- **进入子项目开发**：`cd doc-maker && claude` —— `doc-maker/CLAUDE.md` 会自动加载子项目上下文
- **仓级讨论**：在仓根开 Claude Code 会话；先读 [`docs/`](./docs/)
