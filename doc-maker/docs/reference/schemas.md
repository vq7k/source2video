# Reference · Schemas

> 集中存放所有数据契约。代码以这里为 source of truth。
>
> 配套：[`../02-architecture.md`](../02-architecture.md)（机制定义）、[`../00-glossary.md`](../00-glossary.md)（术语索引）、[`../03-invariants.md`](../03-invariants.md)（约束）。

---

## Case metadata.yaml

每个 case 必须配套一份 metadata。这是反查"这份数据从哪来 / 是什么类型 / 谁加的"的依据，跟 Artifact 内嵌物料版本号同等性质（[不变量 #1](../03-invariants.md) 的延伸）。

```yaml
# fixtures/cases/staging/new_case.metadata.yaml
case_id: synthetic_recipe_01
type: markdown                      # markdown / yaml / text / structured
source: synthetic                   # synthetic / business_extract / external
created_at: 2026-05-12
created_by: xuelin
tags: [basic, list_format, baseline]
notes: "baseline 案例，普通段落 + 列表"
content_file: new_case.md           # 关联实际内容文件
size_chars: 312                     # 自动算
est_tokens: ~90                     # 自动算
sha256: a3f2c1...                   # register 时自动算
split: train                        # register 时自动分配
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `case_id` | string | ✅ | manifest 全局唯一；regex `^[a-z0-9_]+$` |
| `type` | enum | ✅ | `markdown` / `yaml` / `text` / `structured` |
| `source` | enum | ✅ | `synthetic` / `business_extract` / `external`（见 [00-glossary](../00-glossary.md) 数据来源） |
| `created_at` | date | ✅ | ISO 8601 日期 |
| `created_by` | string | ✅ | 作者 handle |
| `tags` | list[string] | 选 | 自由标签，用于聚类 / 检索 |
| `notes` | string | 选 | 自由文本说明 |
| `content_file` | string | ✅ | 关联实际内容文件相对路径 |
| `size_chars` | int | 自动 | register 时自动算 |
| `est_tokens` | int | 自动 | register 时自动算 |
| `sha256` | string | 自动 | register 时自动算 |
| `split` | enum | 自动 | `train` / `holdout`，按 case_id 哈希分桶自动分配（70/30） |

**出处**：[04-handbook §2.0.4](../04-handbook.md)、[ADR-018](../ADRs/018.md)、[不变量 #13](../03-invariants.md)。

---

## Artifact

节点产出物。**必须**内嵌所有用到的 Material 版本号（[不变量 #1](../03-invariants.md)）——这是命根子，多轮迭代后没法反查"配方"全盘失控。

```python
# 通用结构（业务节点扩展自己的字段）
class Artifact(BaseModel):
    artifact_id: str                    # 全局唯一
    node_name: str                      # 产出节点
    node_version: str                   # Node.version（IO 契约版本）
    case_id: str                        # 关联 case
    timestamp: datetime                 # 产出时间
    materials: dict[str, str]           # 内嵌物料版本号 ← 命根子
    # 例：{"prompts": "plan/step3@v1.4",
    #      "rubrics": "plan@v1.0",
    #      "schemas": "plan_artifact@v1.0",
    #      "style_guides": "ml_course@v1.2",
    #      "exemplars": ["ex_034", "ex_017"]}
    content: dict                       # 节点特定输出（业务节点扩展 schema）
    intermediates: list[ArtifactRef]    # 中间产物引用（缓存键）
    trace_id: str                       # Langfuse trace 关联
```

### 关键约束

| # | 约束 | 出处 |
|---|---|---|
| 1 | `materials` 字段必须列出所有用到的物料版本号 | [不变量 #1](../03-invariants.md)、[ADR-008](../ADRs/008.md) |
| 2 | 老 artifact 可用历史版本号复现（[07-acceptance §5 #9](../07-acceptance.md)） | [ADR-008](../ADRs/008.md) |
| 3 | Node 之间不互读 Artifact，只通过 Case / 上游 plan 中介 | [不变量 #9](../03-invariants.md)、[ADR-003](../ADRs/003.md) |
| 4 | 节点失败必须保留中间产物（可恢复重跑） | [02-architecture §1](../02-architecture.md) |

### RunResult（节点单次执行返回值）

```python
class RunResult(BaseModel):
    artifact: Artifact                   # 主产物
    intermediates: list[Artifact]        # 中间产物
    trace: Trace                         # 完整执行 trace
    signals: Signals

class Signals(BaseModel):
    autonomy_rate: float | None          # 人工 diff = 0 的比例
    eval_scores: dict                    # 各 rubric 维度分
    cost_tokens: int
    latency_ms: int
    revision_count: int                  # Eval-Opt 循环轮数
    needs_human_review: bool
```

**出处**：[02-architecture §1 Node 契约](../02-architecture.md)、[ADR-001](../ADRs/001.md)。

---

## Feedback

人工反馈强制结构化（[不变量 #7](../03-invariants.md)），自由文本反馈无法聚类归因。

```yaml
feedback_id: fb_2026_05_12_001
artifact_id: ml_linreg_ch01_plan
location: "shots[2].intent"
issue: "intent 标为 recap，实际内容是引入新概念"
expected: "应该是 setup"
likely_cause: "prompt"              # 归因聚类的命根子，受限标签
severity: medium
reviewer: alice
verdict: bad                        # good / bad / minor_nit
tags: []
```

### 字段约束

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `feedback_id` | string | ✅ | 全局唯一 |
| `artifact_id` | string | ✅ | 关联 artifact |
| `location` | string（路径） | ✅ | 机器可索引，精确指 artifact 内字段（如 `shots[2].intent`） |
| `verdict` | enum | ✅ | `good` / `bad` / `minor_nit`（不用 5 星评分） |
| `likely_cause` | enum | ✅ | `style` / `prompt` / `schema` / `rubric` / `exemplar` / `single-case`——**聚类归因的命根子，受限标签** |
| `issue` | string ≤ 200 字 | ✅ | 30 秒一句话 |
| `expected` | string ≤ 200 字 | 选 | 应该是什么 |
| `severity` | enum | ✅ | `high` / `medium` / `low` |
| `reviewer` | string | ✅ | 评审者 handle |
| `tags` | list[string] | 选 | 自由 string list，演化中的细分（如 `tts_pronunciation`） |

### 聚类与触发

- 单条反馈**不立即改物料**（[不变量 #15](../03-invariants.md)）
- 累积 ≥ N 条同 `likely_cause`（建议 N=3）触发 triage 聚类 → 归因 → 改物料 bump
- CI 拒绝引用 < N 条反馈的物料 bump

**出处**：[04-handbook §3.2](../04-handbook.md)、[02-architecture §2.5](../02-architecture.md)、[ADR-008](../ADRs/008.md)、[不变量 #7](../03-invariants.md) / [#15](../03-invariants.md)。

---

## Decision Trace

每次 LLM call 除了 prompt/output，**必须**落 Decision Trace（[不变量 #4](../03-invariants.md)）——"LLM 凭啥这么写"必须可追溯。缺字段 = 该次执行直接判失败（不是 lint）。

```yaml
decision_trace:
  prompt_template_id: "plan/step3@v1.4"
  rendered_prompt_diff: <模板渲染前后 diff>         # 看到了哪些变量被填进去
  materials_injected:
    style_guide: "series/ml_course/style@v1.2#L10-L20"   # 注入了哪段
    terminology: "series/ml_course/term@v1.1"
  exemplars_used:
    - id: "ex_034"
      reason: "few-shot similarity match"
      similarity: 0.72
  llm_thinking_summary: "I focused on hook → setup arc because target_duration=600s ..."
```

### 字段约束

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `prompt_template_id` | string | ✅ | 物料文件 + 版本号（如 `plan/step3@v1.4`） |
| `rendered_prompt_diff` | string / structured | ✅ | 模板渲染前后 diff，看到哪些变量被填进去 |
| `materials_injected` | dict[string, string] | ✅ | 注入的物料段落引用（含行号）|
| `exemplars_used` | list[ExemplarRef] | ✅ | 命中的 exemplar id + 召回理由 + 相似度 |
| `llm_thinking_summary` | string | ✅ | LLM thinking 摘要（不是完整 thinking，是 summary） |

**落点**：Langfuse + `traces/decisions/<case_id>.yaml`。

**出处**：[02-architecture §2.4](../02-architecture.md)、[ADR-012](../ADRs/012.md)、[不变量 #4](../03-invariants.md)。

---

## Eval Attribution

每条 rubric 维度 pass/fail **必须**输出 attribution（[不变量 #3](../03-invariants.md)）——没 attribution = judge 只是另一种黑盒，没解阶段 3 痛点 B。缺字段 = 该次判失败。

```yaml
dimension: "style_fidelity"
verdict: fail
attribution:
  violated_rule_ref: "materials/prompts/plan/v1.0.md#L34-L38"   # 物料文件 + 行号
  violated_anchor:   "rubrics/plan/v1.0.yaml#anchor_style_3"    # 命中的 anchor id
  citation_in_artifact: "shots[2].text:L5"                       # artifact 内的违反位置
  judge_thinking: "shot 2 的措辞用了'其实'（口语标记），违反 style 规则 #3 ..."
```

### 字段约束

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `dimension` | string | ✅ | rubric 维度名（如 `clarity` / `coverage` / `style_fidelity`） |
| `verdict` | enum | ✅ | `pass` / `fail` |
| `attribution.violated_rule_ref` | string | ✅（fail 时） | 物料文件 + 行号引用 |
| `attribution.violated_anchor` | string | ✅（fail 时） | rubric 内命中的 anchor id |
| `attribution.citation_in_artifact` | string | ✅（fail 时） | artifact 内的违反位置 |
| `attribution.judge_thinking` | string | ✅ | judge 的推理摘要 |

### 配套规则

| # | 规则 | 出处 |
|---|---|---|
| 1 | Judge 模型 ≥ Generator 同代；同节点同模型 | [不变量 #5](../03-invariants.md)、[ADR-006](../ADRs/006.md) |
| 2 | 缺 attribution 字段 = 该次执行直接判失败（框架级强约束，不是 lint） | [不变量 #3](../03-invariants.md) |

**落点**：Langfuse + `traces/eval/<case_id>.yaml`。

**出处**：[02-architecture §2.3](../02-architecture.md)、[ADR-012](../ADRs/012.md)、[不变量 #3](../03-invariants.md)。

---

## Materials Tag（物料规则起源分类）

每条物料规则必须打 4 选 1 的 tag（[不变量 #12a](../03-invariants.md)）：

```yaml
# nodes/<name>/prompts/_model_adapter/format_validator.md 文件头
version: 1.0
tag: capability_gap                  # 必填，4 选 1
created_at: 2026-05-12
expected_obsolete_by: "next-major-model-release"
trend_test_log:                      # 趋势测试痕迹
  - model: claude-haiku-4.5    pass_rate_without_rule: 60%
  - model: claude-sonnet-4.6   pass_rate_without_rule: 92%   # 已稳，准备删
```

### Tag 集合

| Tag | 含义 | 处置 |
|---|---|---|
| `capability_gap` | 模型能力不足的临时补丁 | 每次模型升级强制重跑回归，符合预期立刻删 |
| `business_policy` | 业务规则 / 品牌 / 合规 / 私有信息 | 长期持有，版本化 + 单测 |
| `channel_constraint` | 渠道/格式约束（字符上限、schema） | 长期持有，跟外部接口同步 |
| `integration_glue` | 系统集成胶水（schema 转换、字段映射） | 长期持有，跟集成方一起 review |

### 物理隔离两层（[不变量 #12b](../03-invariants.md)）

```
nodes/<name>/prompts/
├── _model_adapter/        ← capability_gap（易耗品，假设要被重写）
└── _business_rules/       ← 其它三类（长期资产）
```

**出处**：[02-architecture §2.2.3](../02-architecture.md)、[ADR-022](../ADRs/022.md)、[不变量 #12a](../03-invariants.md) / [#12b](../03-invariants.md) / [#12c](../03-invariants.md)。
