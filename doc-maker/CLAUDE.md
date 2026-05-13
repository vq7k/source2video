# doc-maker — Claude Code 上下文

> **本文件给 Claude Code 用**。`cd doc-maker && claude` 进入子项目开发会话时，请先把这份手册读一遍。
>
> 对应的人类入口：[`./README.md`](./README.md)。

---

## 你在哪里

`source2video/doc-maker/` ——**source2video 仓的第一个子项目**。

**当前阶段**：文档完备，零代码。**下一步 = 实施 MVP**（见 `docs/07-acceptance.md` §5 出口判据 9 条）。

**子项目身份**：
- LLM workflow 流水线
- 输入：PPT/教材 markdown
- 输出：script + visual_spec + qa 文档
- 下游：astral-pipeline（外部 repo）→ TTS → Remotion

---

## 必读文档（按重要性）

| 优先级 | 文档 | 必读时机 |
|---|---|---|
| ★★★ | [`docs/02-architecture.md`](./docs/02-architecture.md) | 框架本体（5 抽象 + 6 模块）。写任何代码前 |
| ★★★ | [`docs/03-invariants.md`](./docs/03-invariants.md) | 16 主 + 3 子不变量。写代码前先过一遍 |
| ★★★ | [`docs/07-acceptance.md`](./docs/07-acceptance.md) | MVP 出口判据 9 条 |
| ★★★ | [`docs/04-handbook.md`](./docs/04-handbook.md) | 任何"怎么用"问题 |
| ★★ | [`docs/05-recipes.md`](./docs/05-recipes.md) | 加新 source / 物料 / 节点 / console step-by-step |
| ★★ | [`docs/08-tech-stack.md`](./docs/08-tech-stack.md) | 动手前打开就抄（pyproject / .env / 包版本） |
| ★★ | [`docs/06-ui-spec.md`](./docs/06-ui-spec.md) | 写 Streamlit Console 时 |
| ★★ | [`docs/01-quickstart.md`](./docs/01-quickstart.md) | 第一次跑通 toy 节点 |
| ★★ | [`docs/00-glossary.md`](./docs/00-glossary.md) | 拿不准术语含义时 |
| ★★ | [`docs/ADRs/`](./docs/ADRs/) | 遇到设计疑问时查 ADR-001~022 |
| ★ | [`docs/_future/business-design.md`](./docs/_future/business-design.md) | **第二轮才读**——涉及业务节点（plan / shot_composer / qa）时 |
| ★ | [`docs/_future/user-stories.md`](./docs/_future/user-stories.md) | **第二轮才读**——US 详细 AC |
| ★ | [`docs/_future/test-cases.md`](./docs/_future/test-cases.md) | **第二轮才读**——TC 细节 |
| ★ | [`../docs/repo-layout.md`](../docs/repo-layout.md) | 涉及跨仓边界 / 4 层 DAG / 技术分层时 |
| ★ | [`../docs/ADRs/`](../docs/ADRs/) | 涉及仓级决策（023 抽离时机 / 024 DAG） |

---

## 你必须遵守的纪律（高频违反 → 立刻回查）

| 纪律 | 出处 |
|---|---|
| **测框架，不测业务**（第一轮 MVP） | dm ADR-011 + `07-acceptance.md` §0 |
| **每条 LLM call 必须 Decision Trace** | dm ADR-012 + `02-architecture.md` §2.4 / 不变量 #4（`03-invariants.md`） |
| **每条 rubric pass/fail 必须 Eval Attribution**（缺字段判失败） | dm ADR-012 + `02-architecture.md` §2.3 / 不变量 #3 |
| **Node 之间不互读 Artifact，永远通过 plan 中介** | dm ADR-003 + 不变量 #7 #9 |
| **物料 bump 必经双向 Gate（train + holdout）** | dm ADR-015 + 不变量 #14 |
| **撞 K 轮 Bounded Budget → 强制升级 L0→L5，不许死磕** | dm ADR-016 + 不变量 #16 |
| **审美/标准/类型变化绝不动节点代码** | dm ADR-014 + 不变量 #11 |
| **物料每条规则强制 tag**（capability_gap / business_policy / channel_constraint / integration_glue）| dm ADR-022 + 不变量 #12a |
| **节点级目录就近放**（nodes/<name>/ 装代码+物料+UI+eval） | dm ADR-019 |
| **source 入仓走 git + CLI，无 Web UI 上传** | dm ADR-021 |
| **`src/` 命名业务无关**（不写 `doc_maker_runtime`，写 `runtime/`）—— 为未来抽 s2v-core 留路径 | 仓级 ADRs/023 |
| **不许跨节点横向边 / 执行层循环 / 跨节点共享状态机**（DAG 性质破坏的早期警报） | 仓级 ADRs/024 |

---

## 决策代理协议（用户偏好）

- 相近候选 → **直接选最优应用 + 一句理由 + "不爽再换"**
- 真正分歧（方向不同 / 工作量差一个量级 / 不可逆）→ 让用户拍板
- 不让用户在 A/B/C 之间挑

---

## 工作流速查

| 我要做什么 | 入口 |
|---|---|
| 跑批 toy 节点 | `docs/04-handbook.md` §2.1 |
| **加新东西**（source / 物料 / 节点 / console） | **`docs/05-recipes.md`** |
| 加新 source case | `docs/05-recipes.md`（Source 入仓 6 步）+ `docs/04-handbook.md` §2.0 |
| 改物料（撞墙怎么办） | `docs/04-handbook.md` §4 + L0–L5 + Bounded Budget |
| 提结构化反馈 | `docs/04-handbook.md` §3 |
| 验证物料改动（双向 Gate） | `docs/04-handbook.md` §5 |
| 加新节点 | `docs/05-recipes.md` + `docs/_future/business-design.md` §3/§4 设计模板（第二轮）+ ADR-019 目录结构 |
| 加新 ADR | `docs/ADRs/` 加新文件（NNN.md）+ 更新 README 索引 |
| 加新 US / TC | `docs/_future/user-stories.md` / `docs/_future/test-cases.md`（第二轮）+ `07-acceptance.md` 速览同步 |

---

## 当前要紧的下一步

按 `docs/07-acceptance.md` §5 MVP 出口判据 9 条：

1. [ ] L1 + L2 + L3 测试全绿
2. [ ] L4 ToyNode dogfood 在 `cases/round1/` ≥3 个 case 上跑通
3. [ ] Langfuse trace 完整 + Decision Trace 完整
4. [ ] Eval Attribution 完整（缺字段判失败）
5. [ ] Auto-judge 全量跑通
6. [ ] ToyNode Console 上线（Streamlit 单页 ≤ 200 行）
7. [ ] 反馈 → 改物料 → regression → bump 闭环跑通
8. [ ] 物料版本复现性
9. [ ] 框架不挂、产物结构合规

**实施起点**：环境验证 Hello World（OpenAI SDK + CLIProxyAPI + Langfuse），见 `docs/08-tech-stack.md` §3.1 / §3.3。

---

## 跟仓级（s2v）的边界

- **本子项目改动**（src / nodes / docs/00-08 / docs/ADRs / docs/_future）= 自己消化
- **跨仓级改动**（仓拓扑 / 4 层 DAG / 跨仓接力契约 / 仓级 ADR）= 必须先回 [`../docs/`](../docs/) 看是否冲突
- **第二个 LLM workflow 子项目开工** = 触发 `s2v-core` 抽离重构（届时 dm 改 import）
