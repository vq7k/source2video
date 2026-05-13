# source2video 产品功能设计（User Stories）

> **位置**：_future/user-stories.md。**业务侧（PPT→视频）设计**，第二轮才动手开发。
> MVP 过线前**不读**。框架 MVP 出口判据见 [`../07-acceptance.md`](../07-acceptance.md) §5。
>
> 配套：[`../07-acceptance.md`](../07-acceptance.md)（验收 + 出口判据 + 测试分层 + CI）、[`./test-cases.md`](./test-cases.md)（测试用例设计与详细内容）、[`../02-architecture.md`](../02-architecture.md)（机制定义）。
>
> **冲突优先级**：02-architecture 机制 > 07-acceptance 出口判据 > 本文档 AC 细节。

---

## 1. User Stories（全部 FU 视角）

每条 US 标注：P0 = MVP 必须 / P1 = MVP 可选 / P2 = MVP 不做。

**总览速查表**：

| 编号 | 标题 | 优先级 |
|---|---|---|
| US-01 | 批量跑测试 | P0 |
| US-02 | 人工修改初始规则 | P0 |
| US-03 | 物料版本可回滚与可复现 | P0 |
| US-04 | 每次 LLM call 白盒化可观测 | P0 |
| US-05 | 节点级 metrics 聚合 | P0 |
| US-06 | Synthetic 测试用例 + CI 集成 | P0 |
| US-07 | 人工反馈结构化入库 | P0 |
| US-08 | 反馈 → 物料升级 → regression 端到端 | P0 |
| US-09 | ToyNode 跑通 dogfood | P0 |
| US-10 | 规则遵守可追溯 / Eval Attribution | P0 |
| US-11 | 评估容量放大 / Auto-Judge at Scale | P0 |
| US-12 | ToyNode Console（节点级 review UI） | P0 |
| US-13 | 业务质量验收（一次过率 / rule_audit / 可执行率） | P2 |
| US-14 | 评审校准 / 对照样本 / 相关性校验 | P2 |

### US-01 · 批量跑测试 (P0)

> 作为 FU，我想用一条命令对一个节点跑 N 个 case，**以便**验证框架的 batch runner 能力。

**AC**：

- AC-01.1：`s2v run <node> --cases <case_set>` 一条命令跑完所有 case
- AC-01.2：单 case 失败不阻断其他 case，失败原因 + 中间产物落 `traces/<case_id>/`
- AC-01.3：支持 `--concurrency N`，受 rate limit 自适应退避
- AC-01.4：可用 `--materials <revspec>` 指定物料版本（默认 git HEAD）
- AC-01.5：跑完打印聚合：成功数 / 失败数 / latency / token / cost

### US-02 · 人工修改初始规则 (P0)

> 作为 FU，我想直接编辑 prompt / rubric / style guide 文件，**以便**验证框架的物料热编辑能力。

**AC**：

- AC-02.1：物料全部为 git 管理的纯文本（YAML / Markdown / Python class）
- AC-02.2：编辑后下一次 `s2v run` 自动加载最新版（cold reload）
- AC-02.3：物料文件头 / Pydantic version field 强制声明版本号；缺失版本号启动报错

### US-03 · 物料版本可回滚与可复现 (P0)

> 作为 FU，我想能用任意历史版本物料复现历史 artifact，**以便**验证框架的可复现性。

**AC**：

- AC-03.1：每个 artifact 头部包含 `materials: {prompts: "plan/step3@v1.4", ...}` 版本快照
- AC-03.2：`s2v run <node> --materials-from <artifact_id>` 能用某 artifact 的物料配方重跑
- AC-03.3：用同一物料版本对同一 case 重跑两次，artifact 在结构层面一致（LLM 随机性允许内容 diff，但 schema / 物料版本号必须 byte-identical）

### US-04 · 每次 LLM call 白盒化可观测 (P0)

> 作为 FU，我想能看到每次 LLM call **凭啥这么决策**——不只是 prompt/output，还要看到模板渲染前后 diff、注入的物料段落、用到的 exemplar、LLM thinking 摘要。**以便**验证框架解阶段 3 痛点 B（黑盒化）。

**AC**：

- AC-04.1：每次 LLM call 自动写入 Langfuse（prompt / output / model / token / latency / cost）
- AC-04.2：trace metadata 关联：节点名 / case id / 物料版本快照 / artifact id
- AC-04.3：Langfuse UI 能按节点 / case / 物料版本过滤
- AC-04.4：失败的 LLM call 同样入 trace（含 error stack）
- **AC-04.5**：每次 LLM call 必须包含 **Decision Trace** 字段：
  - `prompt_template_id` —— 用的哪个模板（含版本号）
  - `rendered_prompt_diff` —— 模板渲染前后 diff（看到哪些变量被填进去）
  - `materials_injected` —— 注入的 style / terminology / 其他物料段落 + 行号引用
  - `exemplars_used` —— 命中的 few-shot 列表 + 命中原因
  - `llm_thinking_summary` —— LLM thinking 摘要（≤ 200 字，从 reasoning content 截取）
- **AC-04.6**：用任意一个 artifact 字段反查 Decision Trace，能在 ≤ 3 跳内找到"为啥这么写"的完整证据链

### US-05 · 节点级 metrics 聚合 (P0)

> 作为 FU，我想能看到跑批的聚合指标，**以便**验证框架的指标采集能力。

**AC**：

- AC-05.1：跑批结束输出汇总（成功数 / 失败数 / latency / token / cost）
- AC-05.2：每条 rubric 维度的 pass/fail **次数**（不评估比例合理性）
- AC-05.3：metrics 落本地文件（CSV / Parquet）或 Langfuse dashboard

### US-06 · Synthetic 测试用例 + CI 集成 (P0)

> 作为 FU，我想框架自带一套**人造**测试用例（业务无关）作为永久 regression set，并接入 CI 自动跑，**以便**任何代码 / 物料改动都能自动验证不引入回归，**且框架 bug 跟业务 bug 完全可区分**。

**为什么必须 synthetic（不用业务数据）**：
1. 隔离性：框架 bug ≠ 业务 bug。用业务数据，测试失败时分不清"框架挂"还是"数据恰好不兼容"
2. 可控性：synthetic 可精确覆盖边界条件
3. 稳定性：业务数据可能改（ai-engineer-roadmap 在动），synthetic frozen 不变
4. 纪律一致：§0 "测框架不测业务"——业务数据不应出现在框架 fixtures

> 业务数据装载兼容是**第二轮业务侧 MVP** 的事（见 [`./business-design.md`](./business-design.md) §10a）。

**AC**：

- AC-06.1：`fixtures/cases/` 下提供 ≥5 份人造 markdown，覆盖边界（基础 / 极短 / 极长 / 含代码 / 含 Unicode）。具体设计见 §3
- AC-06.2：`fixtures/materials/toy/v1.0/` 下提供完整人造物料（prompt + rubric + schema + style_guide + 1-2 个 exemplar），无任何业务规则痕迹
- AC-06.3：`fixtures/` 全部 git frozen——除非显式更新 + changelog，否则禁止改动
- AC-06.4：CI 流程接入（见 §3.5）：
  - PR 触发 L1 + L2 + L3
  - main 推送触发 L4（toy dogfood 全量）
  - regression diff 退化 → CI 红 → PR 阻塞合并
- AC-06.5：`s2v eval regression --baseline <ref>` CLI 命令可对任意物料 bump 做新旧对比，并被 CI 调用

### US-07 · 人工反馈结构化入库 (P0)

> 作为 FU，我想能把对 artifact 的反馈写成结构化条目入 git，**以便**验证框架的反馈采集能力。

**AC**：

- AC-07.1：提供 CLI `s2v feedback add --artifact <id> --location <path> --issue <text>` 或等价 YAML 模板
- AC-07.2：反馈强制 schema（含 `likely_cause`），缺字段直接拒绝
- AC-07.3：反馈落 `feedback/<artifact_id>/<feedback_id>.yaml`，git 管理
- AC-07.4：能列出某 artifact 关联的所有反馈

### US-08 · 反馈 → 物料升级 → regression 端到端 (P0)

> 作为 FU，我想走通一次"反馈→改物料→跑回归→bump 版本"的完整闭环，**以便**验证框架支持持续演进。

**AC**：

- AC-08.1：从一条反馈出发，改对应物料文件 → 跑 `s2v run <node> --cases <regression_set>` → 输出 diff
- AC-08.2：diff 包含：每个 case 的 artifact 新旧对比 + rubric 维度通过项变化
- AC-08.3：通过判据：闭环 6 步全部能跑（反馈→定位物料→改→regression→diff→bump），**不评估 diff 内容好坏**
- AC-08.4：闭环结束自动模板化 git commit `materials/.../v1.0 → v1.1` + changelog

### US-09 · ToyNode 跑通 dogfood (P0)

> 作为 FU，我想框架自带一个 ToyNode 完整跑完真实输入，**以便**验证框架不是空壳，且 **框架 bug 跟业务 bug 完全可区分**。

**ToyNode 定义**（人造、非业务、最薄但撑满框架所有能力）：

```
ToyNode: "MarkdownPointsExtractor"
══════════════════════════════════════════════════════
职责：把一份 markdown 抽取 N 个要点 + 给每个要点打分

内部流程（设计上撑满框架能力）：
  Step 1 · LLM call (Opus 兼容端点) → 抽取要点 list
  Step 2 · schema 强制（Pydantic 校验）
  Step 3 · Judge call → 按 rubric (3 维度) 给每个要点打分
  失败处理：schema 不合规 → tenacity retry ≤ 2 次

物料（撑满 Materials Registry 5 类）：
  - prompts/toy/extract.md          (步骤 1 prompt)
  - prompts/toy/judge.md            (步骤 3 prompt)
  - rubrics/toy/v1.0.yaml           (3 维度 rubric)
  - schemas/toy_artifact.py         (输出 schema)
  - style_guides/toy_voice.yaml     (注入 prompt 的 style)
  - exemplars/toy/*.yaml            (1-2 条 few-shot)

输出（撑满 Artifact 契约）：
  - artifact 含 points[] + 内嵌物料版本快照
  - intermediates 保留 Step 1 中间输出
  - trace 完整入 Langfuse
  - signals: {eval_scores, cost_tokens, latency_ms, ...}
══════════════════════════════════════════════════════
```

**AC**：

- AC-09.1：ToyNode 实现按上述定义到位（人造，无任何业务意图）
- AC-09.2：用 `cases/smoke/` 跑通 ≥1 个 case，产出符合 schema 的 artifact
- AC-09.3：trace 完整、metrics 聚合输出、反馈可入库
- AC-09.4：扩到 `cases/round1/` 跑 ≥3 个 case，框架不挂、产物结构合规
- AC-09.5：撑满检查清单——以下框架能力都被 ToyNode 触发过：
  - [ ] 多步链（Step 1 → Step 3）
  - [ ] Schema 强制 + retry
  - [ ] Materials 5 类全部加载
  - [ ] Judge call（独立于 generator）
  - [ ] Langfuse trace（含失败 case）
  - [ ] **Decision Trace 完整**（US-04 字段）
  - [ ] **Eval Attribution 完整**（US-10 字段）
  - [ ] 反馈结构化入库 + 改物料 + regression diff

> **不验**：artifact 内容好不好、要点抽取得对不对。ToyNode 是测框架的 dummy，不是业务节点。

### US-10 · 规则遵守可追溯 / Eval Attribution (P0)

> 作为 FU，我想 ToyNode 跑批后每条 rubric 维度的 pass/fail **都能追溯到具体规则段落 + LLM thinking + 触发的 anchor**，**以便**验证框架解阶段 3 痛点 B（黑盒化）的核心承诺：**判分必须可解释**。

**AC**：

- AC-10.1：每条 rubric 维度的 judge 输出包含：
  - `verdict` — pass / fail
  - `violated_rule_ref` — 物料文件路径 + 行号（如 `materials/prompts/toy/judge.md#L34-L38`）
  - `violated_anchor` — 命中的 anchor id（如 `rubrics/toy/v1.0.yaml#anchor_clarity_2`）
  - `citation_in_artifact` — artifact 内的违反位置（如 `points[1].text:L3`）
  - `judge_thinking` — judge LLM 的 reasoning 摘要（≤ 200 字）
- AC-10.2：没有 attribution 字段 / 字段为空 → ToyNode 该次执行**直接判失败**（框架级强约束，不是 lint）
- AC-10.3：随机抽 ≥3 个 ToyNode rubric 维度结果，能基于 attribution 在 ≤ 2 跳内人工验证"判分理由是否成立"
- AC-10.4：attribution 落 `traces/eval/<case_id>.yaml` + Langfuse metadata，可查询、可聚合

### US-11 · 评估容量放大 / Auto-Judge at Scale (P0)

> 作为 FU，我想框架能**自动跑完全量 rubric 评估**而无需人工逐条评，**以便**验证框架解阶段 3 痛点 A（评估容量崩溃）：**几万判断由 judge 顶起，人只做抽检与阈值校准**。

**AC**：

- AC-11.1：`s2v run toy --cases <set>` 跑完后，**框架自动跑完所有 case × 所有 rubric 维度的 judge call**，无需任何手动触发
- AC-11.2：每个 case 的所有 rubric 维度结果**聚合到 metrics 输出**：pass/fail 计数、attribution 抽样、judge cost 汇总
- AC-11.3：跑批输出 `reports/eval_<run_id>.md`，含：
  - 各维度 pass/fail 分布（counts，不评合理性）
  - 失败 case 的 attribution 聚类（按 violated_rule_ref 分组）
  - judge 自身的失败 / 超时 / schema 不合 比例
- AC-11.4：人工抽检入口：CLI `s2v eval review --sample 5` 随机抽 N 个 case 让人对照 judge attribution 判断"judge 自己是否在乱判"，结果记录入 评审校准 log（不要求每次跑批都做，记机制存在即可）

### US-12 · ToyNode Console（节点级 review UI）(P0)

> 作为 FU，我想框架自带一份 **ToyNode 专属的 Streamlit 单页 console**，**以便**用它作为项目的"活体地图"——artifact / 物料版本 / eval / 反馈 / rerun 一屏看完，不必每次靠读文档 + 读代码重建认知。

**为什么是 P0**：UI 不是协作便利工具，是**作者本人的项目记忆载体**。没有 console = 项目设计随时间在脑里冷却 → 重新启动认知靠考古文档 / 代码。**UI 是给作者用的，不是给新人用的**。详见 [`../06-ui-spec.md`](../06-ui-spec.md) §0 立场。

**AC**：

- AC-12.1：单页 Streamlit ≤ 200 行；服务 ToyNode **一个节点**，禁止跨节点聚合
- AC-12.2：展示内容（缺一项即不通过）：
  - artifact 结构化渲染（不是裸 JSON）
  - 物料版本徽章（prompts vX / rubric vY / schema vZ / style / exemplars）
  - Eval Attribution（每条 rubric 维度 pass/fail + violated_rule_ref + judge_thinking 摘要）
  - Decision Trace（rendered prompt diff / 注入物料 / 命中 exemplar / LLM thinking 摘要）
  - 字段旁挂结构化反馈按钮（弹出 §3.2 表单，预填 location）
  - rerun 按钮（含"换物料版本对比跑"选项）
  - 节点最近指标（一次过率 / Budget 当前层 + 剩余轮数 / 平均 cost）
- AC-12.3：跨节点导航靠 artifact_id 超链接（业务侧第二轮接 Plan/Shot 时生效；MVP 阶段 ToyNode 是唯一节点，超链接机制空跑即可，但**接口必须就位**）
- AC-12.4：console 失败不阻塞节点跑批（独立部署，挂了不影响 `s2v run`）
- AC-12.5：完整 UI spec + ASCII 原型见 [`../06-ui-spec.md`](../06-ui-spec.md)

### US-13 · 业务质量验收（一次过率 / rule_audit / 可执行率） (P2)

MVP **不做**。第二轮专门开"业务验收"章节后再定。

### US-14 · 评审校准 / 对照样本 / 相关性校验 (P2)

MVP 不做。等下游成品累计到阈值 + 有第二个人评审时再开。

---
