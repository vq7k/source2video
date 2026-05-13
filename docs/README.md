# source2video 仓级文档入口

`source2video` 是 **LLM-driven 子系统的单仓 monorepo**。当前唯一子项目：**doc-maker**（PPT/教材 → 讲解视频文档）。未来可能扩展 video-maker / tts-maker / 其它（决策依据见 [`ADRs/023.md`](./ADRs/023.md)）。

---

## 仓级文档（薄）

本目录只放**跨子项目共享**的结构性内容。子项目专属文档（业务设计 / 用户手册 / UI / 验收等）住在各自子目录的 `docs/` 下。

| 文件 | 内容 |
|---|---|
| [`README.md`](./README.md)（本文） | 仓级文档入口 |
| [`repo-layout.md`](./repo-layout.md) | 仓内拓扑 + 跨仓边界（pipeline_io）+ 4 层 DAG + 技术架构分层 |
| [`ADRs/`](./ADRs/) | 仓级 ADR：023 单仓多子项目 / 024 4 层 DAG |

---

## 子项目文档（详）

| 子项目 | 入口 | 状态 |
|---|---|---|
| **doc-maker** | [`../doc-maker/README.md`](../doc-maker/README.md) → [`../doc-maker/docs/`](../doc-maker/docs/) | **开发中**（第一个子项目） |
| video-maker | — | TBD（撞点才建） |
| tts-maker | — | TBD（可能复用旧 harness，不一定 source2video-shaped） |
| s2v-core | — | **不存在**——抽离条件 = 第二个 LLM workflow 子项目开工（[`ADRs/023.md`](./ADRs/023.md)） |

---

## 文档冲突时的优先级

```
仓级 ADRs/024  >  仓级 ADRs/023  >  仓级 repo-layout  >  子项目 ADRs/  >  子项目其它文档
```

- 仓级结构性决策（ADRs/023 / 024）= 全仓约束
- 子项目专属决策（dm ADRs/001~022）= 仅 doc-maker 范围
- 子项目其它文档不能改架构原则
