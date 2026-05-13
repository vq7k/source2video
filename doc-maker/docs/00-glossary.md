# 00 · Glossary（术语索引）

> 任何在文档里出现 ≥ 2 次的术语在这里有单一定义。其它文档里只引用，不重复定义。
>
> 配套：[`02-architecture.md`](./02-architecture.md)（机制）、[`03-invariants.md`](./03-invariants.md)（约束）、[`ADRs/`](./ADRs/)（决策）。

---

## 数据来源（case source）

每个 case 的 `metadata.yaml` 必填 `source` 字段，三选一：

| 值 | 含义 | 何时用 | 出处 |
|---|---|---|---|
| `synthetic` | 作者人造测试 case；frozen fixtures；可控覆盖边界（极短 / 极长 / Unicode / 含代码 / schema 异常等） | 框架 MVP 阶段唯一允许 | [ADR-018](ADRs/018.md)、[ADR-011](ADRs/011.md)、[07-acceptance §3.1](07-acceptance.md) |
| `business_extract` | 真实业务（ai-engineer-roadmap 教材）抽出的 case；可能跟上游联动（章节更新会反向触发重跑） | 业务侧第二轮 | [`_future/business-design.md`](_future/business-design.md) §9 / §10a、[ADR-018](ADRs/018.md) |
| `external` | 第三方来源（外部用户给的样本 / 不属于本仓的素材） | 第二轮后；当前为预留扩展位 | [04-handbook §2.0.4](04-handbook.md) |

**纪律**：MVP 阶段所有 case 的 `source` **必须**是 `synthetic`——业务数据不进框架测试（[ADR-018](ADRs/018.md)）。

---

## 物料（Materials）5 类

| 类型 | 必备? | 作用 | 出处 |
|---|---|---|---|
| `prompts/` | ✅ | LLM 调用模板 | [02-architecture §2.2](02-architecture.md)、[ADR-014](ADRs/014.md) |
| `schemas/` | ✅ | Pydantic 模型（artifact / case） | 同上 |
| `rubrics/` | ✅ | Eval 维度 + anchor（标杆例子：0/5/10 分各对应一个具体范例） | 同上 |
| `style_guides/` | 可省 | 风格指引（brand voice 类） | [ADR-022](ADRs/022.md) |
| `exemplars/` | 可省（bootstrap 建议 ≥1） | 示范样本（few-shot） | [ADR-017](ADRs/017.md) |

每条 materials 强制 tag：`capability_gap` / `business_policy` / `channel_constraint` / `integration_glue`（[ADR-022](ADRs/022.md)、[不变量 #12a](03-invariants.md)）。

---

## 可观测性（Observability）

- **Decision Trace**：每条 LLM call 必须留的"它凭啥这么写"记录（rendered_prompt_diff / materials_injected / exemplars_used / llm_thinking_summary）。缺字段 = 判失败。出处 [ADR-012](ADRs/012.md)、[02-architecture §2.4](02-architecture.md)、[不变量 #4](03-invariants.md)。
- **Eval Attribution**：每条 rubric 维度 pass/fail 必须的归因字段（violated_rule_ref / violated_anchor / citation_in_artifact / judge_thinking）。缺字段 = 判失败（[不变量 #3](03-invariants.md)）。出处 [ADR-012](ADRs/012.md)、[02-architecture §2.3](02-architecture.md)。

完整字段定义见 [`reference/schemas.md`](reference/schemas.md)。

---

## 演化（Materials 演化）

- **演化三动作**：审美变 → 改 Materials（bump）；类型变 → 新增 Materials（v1/v2 并存或新目录）；IO 契约变 → 改节点代码（升 Node.version）。审美 / 标准 / 类型变化绝不动节点代码。出处 [ADR-014](ADRs/014.md)、[02-architecture §2.2.1](02-architecture.md)、[不变量 #11](03-invariants.md)。
- **Promote Pipeline**：v1.0 → v1.x 的硬约束流程（baseline → 反馈聚类阈值 → 选 L0~L5 层 → bump → 双向 Gate 裁决）。出处 [ADR-008](ADRs/008.md)、[02-architecture §2.2.2](02-architecture.md)。
- **L0–L5 升级路径**：撞墙时强制升级阶梯——L0 改 prompt → L1 加/改 exemplar → L2 改 rubric 维度/anchor → L3 改 schema → L4 拆节点 → L5 重新定义任务。代价递增，死磕 L0 等于完美过拟合。出处 [ADR-016](ADRs/016.md)、[04-handbook §4.2](04-handbook.md)。
- **Bounded Budget**：同一层物料 ≤ K 次 bump 后 holdout 仍无改进（建议 K=3）→ CLI/CI 禁止继续在该层改物料，必须升级到下一层。出处 [ADR-016](ADRs/016.md)、[不变量 #16](03-invariants.md)。

---

## 数据集（双向 Gate 评估）

- **Train**：物料迭代时跑的 case 集（70%）；作者可见，反馈写在这上面，物料迭代基于此。
- **Holdout**：promote 时才跑的 case 集（30%，frozen，物料迭代期禁日常访问；CI 检测 commit 引用 holdout case id 即拒）。
- **双向 Gate**：物料 bump 必须 train pass 改进 +Δ **且** holdout pass 不退化双满足才放行；任一不满足 CI 拒绝合并。出处 [ADR-015](ADRs/015.md)、[02-architecture §2.2.2](02-architecture.md)、[不变量 #13](03-invariants.md) / [#14](03-invariants.md)。

---

## 节点抽象

- **Artifact**：节点产出物的标准结构（含内嵌物料版本号；可反查"配方"，可在新物料下重跑得到 diff）。出处 [02-architecture §1](02-architecture.md)、[ADR-001](ADRs/001.md)、[不变量 #1](03-invariants.md)。
- **Case**：节点输入实例（一份独立的 markdown / yaml 等；配套 `metadata.yaml`）。出处 [02-architecture §1](02-architecture.md)、[04-handbook §2.0.4](04-handbook.md)。
- **Trace**：一次执行的完整 trace（LLM call / 中间产物 / 失败信息 / 物料版本快照）。出处 [02-architecture §1 / §2.4](02-architecture.md)。
- **Node**：一个 workflow 节点，可内含多步 LLM call + Evaluator-Optimizer 循环。出处 [02-architecture §1](02-architecture.md)、[ADR-001](ADRs/001.md)。
- **Episode**：业务侧（doc-maker）一个完整讲解视频单元（含多 Shot）。出处 [`_future/business-design.md`](_future/business-design.md)、[ADR-004](ADRs/004.md)。
- **Shot**：业务侧（doc-maker）Episode 内一个独立镜头（含 text / text_tts / notes 三件套）。出处 [`_future/business-design.md`](_future/business-design.md)、[ADR-003](ADRs/003.md)。

---

## UI（3 层架构，[ADR-025](ADRs/025.md)）

| 层 | 名称 | 谁用 | 单元 | 看什么 | 文档位置 |
|---|---|---|---|---|---|
| **L1** | **Business Console** | "使用者"（作者本人作为产品用户 / 未来非技术使用者） | **Episode** | 状态徽章 / 产出 / 错误跳转入口 | [`_future/business-console.md`](_future/business-console.md)（第二轮才动手） |
| **L2** | **Hub Console** | 作者运维视角 | **Node 集合** | 节点导航 / alive 指示 / 最近 artifact_id | [06-ui-spec](06-ui-spec.md) §2.0（拟） |
| **L3** | **Per-Node Console** | 作者深度排查 | **单个 Node** | Artifact / Materials / Eval Attribution / Decision Trace / 反馈表单 / rerun / 节点指标 | [06-ui-spec](06-ui-spec.md) 主体 |

**默认隐藏框架层**：L1 跑通的 Episode 不显示 L2/L3 链接；状态 = warn/fail 才暴露"→ 进入 X 节点 console"按钮。  
**单向跳转**：L1 → L3（跳过 L2，L1 已知节点）；L2 → L3（作者运维入口）；**L2/L3 不反向引用 L1 概念**（Episode 不进框架抽象）。

出处：[ADR-010](ADRs/010.md)（per-node 禁止聚合）、[ADR-020](ADRs/020.md)（L2/L3 是作者活体地图）、[ADR-021](ADRs/021.md)（L1 上传走 git thin 前端）、[ADR-025](ADRs/025.md)（L1/L2/L3 解耦决策）、[不变量 #8](03-invariants.md)。

实施栈：**Next.js 15 + React 19 + TypeScript + Tailwind + shadcn/ui**（[ADR-026](ADRs/026.md)，覆盖原 Streamlit 选型）。三层 UI 同一项目 `doc-maker/ui/`，单进程 path routing。视觉纪律：**一屏视觉密度**（不限行数，组件按需拆）。

---

## 框架内核（6 模块）

| 模块 | 职责 | 章节 |
|---|---|---|
| Node Runtime | 节点执行 / Protocol / 多步链 / Eval-Opt 循环 / 重试 / 缓存 | [02-architecture §2.1](02-architecture.md) |
| Materials Registry | 物料注册 + 版本化 + Promote + train/holdout 拆分 | [§2.2](02-architecture.md) |
| Eval Stack | Schema check + LLM-as-judge with attribution + Auto-judge Runner + Regression diff | [§2.3](02-architecture.md) |
| Observability | Langfuse trace + Decision Trace + Eval Attribution 落盘 + 指标聚合 | [§2.4](02-architecture.md) |
| Feedback Loop | 结构化反馈 schema + 聚类阈值 + 归因到 5 层 | [§2.5](02-architecture.md) |
| Per-Node Console | 节点活体 UI（Streamlit ≤200 行） | [§2.6](02-architecture.md) |

（业务侧治理实践不在内核——见 [§2a](02-architecture.md)：评审校准 / 对照样本 / 多评审 / 相关性校验 / rubric 反演 5 件，框架可提供 CLI 工具但触发与解读由业务侧决定）

---

## 重要不变量速记

参 [`03-invariants.md`](03-invariants.md)。常引用的：

- **#1** Artifact 必内嵌物料版本号
- **#3** Eval 缺 attribution = 判失败
- **#4** 每次 LLM call 必须 Decision Trace
- **#7** Node 之间不互读 Artifact（通过 Case / 上游 plan 中介）
- **#8** UI 不跨节点聚合
- **#11** 审美 / 标准 / 类型变化绝不动节点代码
- **#13** train(70%) / holdout(30%) frozen 拆分
- **#14** 物料 bump 双向 Gate
- **#15** 反馈聚类阈值 ≥ N（建议 N=3）才触发改物料
- **#16** Bounded Budget（K=3 撞 cap 强制升级）
- **#12a / #12b / #12c** 物料 tag / 物理隔离 / 升级期重跑
