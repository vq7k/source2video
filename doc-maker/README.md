# doc-maker

**source2video 的第一个子项目**：当前主线是 Writing Production 文本生成生产系统；讲解文档包（plan / scripts / shots / visual_spec / qa_report）保留为默认 Output Profile。

> 第二个子项目暂未确定。框架抽离时机 = 第二个 LLM workflow 子项目开工时（见仓级 [`../docs/ADRs/023.md`](../docs/ADRs/023.md)）。

---

## 是什么

业务产品原型当前主线：把混乱素材、参考写法和评审偏好转换成可批量生成、可评分、可反馈迭代的短文本产物。首个落地场景仍是讲解型内容，但产品本质已从“文档包生成器”上移为“文本生成生产系统”。

底层 LLM workflow 负责把原始章节级语料（PPT/教材 markdown 等）转成讲解文档包：

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
7. [docs/business-console.md](./docs/business-console.md) — 当前 L1 业务产品原型 SOT
8. [docs/05-recipes.md](./docs/05-recipes.md) — 加新 source / 物料 / 节点 / console 的 step-by-step
9. [docs/06-ui-spec.md](./docs/06-ui-spec.md) — L2/L3 诊断层 Console UI 规格
10. [docs/07-acceptance.md](./docs/07-acceptance.md) — 业务原型验收 + framework ToyNode 历史基线
11. [docs/08-tech-stack.md](./docs/08-tech-stack.md) — 技术选型 + pyproject + .env
12. [docs/ADRs/](./docs/ADRs/) — ADR-001~028（业务侧 + 框架内核决策） + 仓级 023/024 stub
13. [docs/_future/](./docs/_future/) — 当前不作为主线；`business-console.md` 已提升到当前文档

仓级文档（跨子项目）见 [`../docs/`](../docs/)。

---

## 跟仓级的关系

| 这里（dm 子项目） | 仓级（s2v） |
|---|---|
| `docs/00–08` + `business-console.md` + `ADRs/001~028` | [`../docs/repo-layout.md`](../docs/repo-layout.md) + [`../docs/ADRs/`](../docs/ADRs/)（023 / 024） |
| 业务产品原型 / 框架内核 / 诊断 UI / US / TC | 仓拓扑 / 跨仓边界 / 4 层 DAG / 技术架构分层 |
| `src/` 命名业务无关（防御性预留） | 第二个 LLM workflow 子项目开工 → 抽到 `s2v/s2v-core/` |
| 通过 `pipeline_io` 跟 astral-pipeline 接力 | 跨仓契约（ADR-021 精神） |
