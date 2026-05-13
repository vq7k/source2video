# doc-maker

**source2video 的第一个子项目**：PPT/教材 → 讲解视频文档（script + visual_spec + qa）。

> 第二个子项目暂未确定。框架抽离时机 = 第二个 LLM workflow 子项目开工时（见仓级 [`../docs/ADRs/023.md`](../docs/ADRs/023.md)）。

---

## 是什么

LLM workflow 流水线，把原始章节级语料（PPT/教材 markdown 等）转成讲解视频文档：

- **plan** 节点：内容规划 + shot 切分
- **shot_composer** 节点：产 text / text_tts / notes 三件套
- **visual** 节点：视觉决策（当前并入 shot_composer 的 notes 步骤）
- **episode_qa** 节点：期级一致性校验
- **toy** 节点（dogfood）：MarkdownPointsExtractor，撑满框架所有能力的人造节点

下游接 astral-pipeline（外部独立 repo）→ TTS → Remotion。

---

## 目录结构

```
doc-maker/
├── README.md                  本文（子项目入口）
├── CLAUDE.md                  ★ Claude Code 上下文（cd 进来开新会话必读）
├── docs/                      子项目文档（dm 专属，01–08 + ADR）
├── src/                       框架内核代码（命名业务无关，方便未来抽 s2v-core）
│   ├── runtime/
│   ├── materials/
│   ├── eval/
│   ├── observability/
│   ├── feedback/
│   └── pipeline_io/
├── nodes/                     业务节点（ADR-019 就近放）
│   ├── toy/
│   ├── plan/
│   ├── shot_composer/
│   ├── visual/
│   └── episode_qa/
├── fixtures/cases/            ToyNode synthetic 测试集
├── traces/                    运行时产物（gitignored 大部分）
├── reports/                   跑批报告（gitignored）
├── tests/                     L1 / L2 / L3 测试
├── pyproject.toml             子项目独立 pyproject
└── .env.example
```

---

## 文档入口

详细文档见 [`docs/README.md`](./docs/README.md)。建议阅读顺序：

1. [docs/README.md](./docs/README.md) — 文档地图
2. [docs/00-glossary.md](./docs/00-glossary.md) — 术语单一定义
3. [docs/01-quickstart.md](./docs/01-quickstart.md) — 5 步跑通 toy 节点
4. [docs/02-architecture.md](./docs/02-architecture.md) — 框架本体（5 抽象 + 6 模块）
5. [docs/03-invariants.md](./docs/03-invariants.md) — 16 主 + 3 子不变量
6. [docs/04-handbook.md](./docs/04-handbook.md) — 日常 4 动作循环
7. [docs/05-recipes.md](./docs/05-recipes.md) — 加新 source / 物料 / 节点 / console 的 step-by-step
8. [docs/06-ui-spec.md](./docs/06-ui-spec.md) — Per-Node Console UI 规格
9. [docs/07-acceptance.md](./docs/07-acceptance.md) — MVP 验收（出口判据 9 条）
10. [docs/08-tech-stack.md](./docs/08-tech-stack.md) — 技术选型 + pyproject + .env
11. [docs/ADRs/](./docs/ADRs/) — ADR-001~022（业务侧 + 框架内核决策） + 仓级 023/024 stub
12. [docs/_future/](./docs/_future/) — **第二轮才读**：business-design / user-stories / test-cases

仓级文档（跨子项目）见 [`../docs/`](../docs/)。

---

## 跟仓级的关系

| 这里（dm 子项目） | 仓级（s2v） |
|---|---|
| `docs/00–08` + `ADRs/001~022` | [`../docs/repo-layout.md`](../docs/repo-layout.md) + [`../docs/ADRs/`](../docs/ADRs/)（023 / 024） |
| 业务设计（_future/）/ 框架内核 / UI / US / TC | 仓拓扑 / 跨仓边界 / 4 层 DAG / 技术架构分层 |
| `src/` 命名业务无关（防御性预留） | 第二个 LLM workflow 子项目开工 → 抽到 `s2v/s2v-core/` |
| 通过 `pipeline_io` 跟 astral-pipeline 接力 | 跨仓契约（ADR-021 精神） |
