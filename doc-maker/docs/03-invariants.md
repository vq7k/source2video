# 03 · 不变量（写在墙上）

> 16 主 + 3 子，从架构 + ADR 沉淀。违反即视为框架损坏。
>
> 配套：[`02-architecture.md`](./02-architecture.md)（机制定义）、[`ADRs/`](./ADRs/)（决策记录）。本文档**只列约束**，不解释机制——机制看 02，决策动机看 ADR。

---

## 主不变量

### #1 Artifact 必须内嵌所有用到的 Material 版本号

违反后果：多轮迭代后没法反查"配方"，全盘失控。

**出处**：[ADR-008](ADRs/008.md)

---

### #2 所有 LLM call 必经 Langfuse trace

违反后果：失去可观测，eval 变玄学。

**出处**：[ADR-012](ADRs/012.md)

---

### #3 每条 rubric 维度 pass/fail 必须输出 attribution

字段强制：`violated_rule_ref` + `anchor` + `citation` + `thinking`。

违反后果：没 attribution = judge 只是另一种黑盒，没解阶段 3 痛点 B。

**出处**：[ADR-012](ADRs/012.md)

---

### #4 每次 LLM call 必须有 Decision Trace

字段强制：`rendered_prompt_diff` + `materials_injected` + `exemplars_used` + `thinking`。

违反后果："LLM 凭啥这么写"无法追溯，规模化后失控。

**出处**：[ADR-012](ADRs/012.md)

---

### #5 Judge 模型 ≥ Generator 同代

同节点同模型；跨模型 judging 反而增方差。

违反后果：judge 信号偏移，优化方向跑偏。

**出处**：[ADR-006](ADRs/006.md)

---

### #6 任何 prompt / rubric / style 改动先跑 Regression set，通过才上线

违反后果：没 regression 集，prompt 迭代就是赌博。

**出处**：[ADR-015](ADRs/015.md)

---

### #7 反馈强制结构化 schema（含 `likely_cause`）

违反后果：自由文本反馈无法聚类归因，多轮后堆成无人敢动的坑。

**出处**：[ADR-008](ADRs/008.md)

---

### #8 Per-Node Console 禁止聚合视图，跨节点靠 artifact_id 跳

违反后果：在 UI 层重新引入节点耦合，架构白拆。

**出处**：[ADR-010](ADRs/010.md)

---

### #9 Node 之间不互读 Artifact，只通过 Case / 上游 plan 中介

违反后果：失去并行 / 独立 retry / 缓存边界干净的能力。

**出处**：[ADR-003](ADRs/003.md)

---

### #10 第一版禁止上编排 framework（LangGraph / Temporal 等）

违反后果：抽象绑死，看不清节点本身问题。

**出处**：[ADR-007](ADRs/007.md)

---

### #11 审美 / 标准 / 类型变化绝不动节点代码

必须落到 Materials（改 / 新增）；节点代码只对 IO 契约负责。机制见 [`02-architecture.md` §2.2.1](02-architecture.md#221-演化三动作行为变化的归位规则)。

违反后果：节点跟主观偏好反复改，永远稳不下来；框架变成另一个老项目。

**出处**：[ADR-014](ADRs/014.md)

---

### #12 v1.0 物料 bootstrap 例外，v1.x（x ≥ 1）必须配套 regression set + diff 通过才上线

机制见 [`02-architecture.md` §2.2.2 Promote Pipeline](02-architecture.md#222-promote-pipelinev10--v1x-的硬约束)。

违反后果：凭直觉改 prompt = 赌博；3 个月后 prompt 变成"谁也不敢动的诅咒"。

**出处**：[ADR-015](ADRs/015.md)

---

### #13 fixtures/cases/ 必须 train(70%) / holdout(30%) 拆分

物料迭代期间禁止访问 holdout；CI 检测 commit 引用 holdout case id 即拒。

违反后果：没 holdout = 无法证伪过拟合，物料看着"越来越好"实际是在背 train 集。

**出处**：[ADR-015](ADRs/015.md)

---

### #14 物料 bump 双向 Gate

train pass 改进 +Δ **且** holdout pass 不退化；任一不满足 CI 拒绝合并。

违反后果：单向 Gate = 经典过拟合陷阱。

**出处**：[ADR-015](ADRs/015.md)

---

### #15 反馈聚类阈值

单条反馈不触发改物料；**累积 ≥ N 条同 `likely_cause` 才触发**（建议 N=3）；CI 拒绝引用 < N 条反馈的物料 bump。

违反后果：单条反馈 = 噪声驱动 = 蒙特卡洛随机抖动。

**出处**：[ADR-008](ADRs/008.md)、[ADR-015](ADRs/015.md)

---

### #16 Bounded Budget

同一层物料 ≤ K 次 bump 后 holdout 仍无改进（建议 K=3）→ **CLI/CI 禁止继续在该层改物料**，必须升级到下一层（L0→L1→...→L5）。机制见 [`02-architecture.md` §2.2.2](02-architecture.md#222-promote-pipelinev10--v1x-的硬约束)。

违反后果：死磕 prompt = 完美过拟合 + 业务永远等不到；撞墙不让升级 = 假装在工作。

**出处**：[ADR-016](ADRs/016.md)

---

## 子不变量

### #12a 每条规则必须打 4 选 1 的 tag

Tag 集合：`capability_gap` / `business_policy` / `channel_constraint` / `integration_glue`。CI 拒绝缺 tag 的物料 commit。机制见 [`02-architecture.md` §2.2.3](02-architecture.md#223-规则起源分类与-tag-体系物料入口约束)。

违反后果：不分类 = 模型迭代后老 scaffolding 还在叠加，反而拖累新模型。

**出处**：[ADR-022](ADRs/022.md)

---

### #12b 物料分两层物理隔离

`_model_adapter/`（易耗品）+ `_business_rules/`（长期资产），不允许混放。机制见 [`02-architecture.md` §2.2.3](02-architecture.md#223-规则起源分类与-tag-体系物料入口约束)。

违反后果：混放 = 模型升级时不知道删哪些；3 代模型后 prompt 变成考古层。

**出处**：[ADR-022](ADRs/022.md)

---

### #12c 模型升级后强制重跑所有 `capability_gap` 规则的"无该规则"对照

新模型 pass ≥ baseline → 标 `obsolete_candidate` → 人工 review 删除。机制见 [`02-architecture.md` §2.2.3](02-architecture.md#223-规则起源分类与-tag-体系物料入口约束)。

违反后果：不清理 = 框架老化的主要来源；90%"框架越来越笨"是这个。

**出处**：[ADR-022](ADRs/022.md)

---

> **挪走的**：原 #10 "下游成品累计达阈值 N 时做 judge 分 ↔ 真实质量相关性校验"是**业务侧治理实践**（见 [`02-architecture.md` §2a](02-architecture.md#2a-业务侧治理实践不在框架内核)），不是框架不变量。框架提供 `s2v eval correlate` CLI，触发/解读由业务侧决定。
