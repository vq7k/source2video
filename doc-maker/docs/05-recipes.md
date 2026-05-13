# 05 · Recipes（加新 X 的 step-by-step）

> **本文档定位**：任何"我要加一个 X"的操作集中在这里。先查 recipe，再去 [`04-handbook.md`](./04-handbook.md) 做日常循环。
>
> 配套：[`01-quickstart.md`](./01-quickstart.md)（首次启动）、[`reference/cli.md`](./reference/cli.md)（命令查询）、[`03-invariants.md`](./03-invariants.md)（不变量）。

---

## 5.1 加新 source case

**核心立场**：第一版**没有 Web UI 上传**。Source 入仓 = **本地编辑器 + git + CLI**（[`ADRs/021.md`](./ADRs/021.md)）。

> **澄清：没有 Web UI ≠ 没有 UI**。框架第一版**有 ToyNode Console**（Streamlit 单页），但它只**展示 artifact / 提反馈 / rerun**，**不**接受 source 上传——source 必经 git。详见 [`06-ui-spec.md`](./06-ui-spec.md)。
>
> **为什么这么分**：Web UI 上传 = 重新造 git（版本化 / diff / 审计 / CI 都白做一遍）；Per-Node Console = **作者本人的项目活体地图**（不靠它系统设计会在脑里冷却死掉）。两件事性质不同。

### 5.1.1 完整路径

从"我刚写完一份新 case markdown"到"能被跑批"的完整流程：

```
本地编辑器写文件
fixtures/cases/staging/new_case.md
fixtures/cases/staging/new_case.metadata.yaml
       │
       ▼
s2v cases lint fixtures/cases/staging/   ← 规则校验（见 5.1.2）
       │
       ▼ 通过
       │
s2v cases register --case <path> --split auto
   ├─ 自动分配 train(70%) / holdout(30%)（按 case_id 哈希分桶，可复现）
   ├─ 算 sha256 → 入 fixtures/cases/manifest.yaml
   └─ 把文件物理移动到 train/ 或 holdout/ 目录
       │
       ▼
git add fixtures/cases/<split>/<case>.md + manifest.yaml
git commit -m "register case <id>"
   └─ pre-commit hook 再 lint 一遍兜底
       │
       ▼ frozen 入仓
       │
s2v run <node> --cases fixtures/cases/train/   ← 可跑批了
```

### 5.1.2 规则校验清单（CLI 强制，违反即拒）

| 校验项 | 工具 | 失败后果 |
|---|---|---|
| **Schema 合规** | Pydantic `Case` 模型 | `lint` 失败，拒绝 register |
| **Encoding 必须 UTF-8** | 字节流检测 | lint 报错 |
| **大小上限** | 字符数 + 估算 token | 软上限警告；硬上限拒绝（防爆 context window） |
| **case_id 唯一性** | manifest hash 索引 | 重复 → 拒绝 |
| **目录 / 文件命名规范** | regex `^[a-z0-9_]+\.md$` | 不合规 → 拒绝 |
| **`metadata.yaml` 必备** | 文件存在性 | 缺失 → 拒绝 |
| **Holdout frozen 检测** | git diff vs manifest | 试图改已 register 的 holdout case → 拒绝（除非 `--force-update` + reviewer 双签） |
| **pre-commit hook 再 lint** | git hook | 漏跑 lint 也拦得住 |

### 5.1.3 `metadata.yaml` 必填 schema

每个 case 必须配套一份 metadata。这是反查"这份数据从哪来 / 是什么类型 / 谁加的"的依据，跟 Artifact 内嵌物料版本号同等性质（不变量 #1 的延伸）。

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

### 5.1.4 不允许的操作（框架直接拦）

| 反模式 | 框架怎么拦 |
|---|---|
| 直接把文件丢到 `fixtures/cases/train/` 跳过 register | pre-commit hook 检测无 manifest 入口 → 拒绝 commit |
| 物料迭代期间偷改 holdout case 内容 | git diff 检测 → 拒绝（不变量 #13） |
| 用 Web UI 上传（绕过 git） | 第一版**没有 Web UI**，设计上排除 |
| source 没经过 lint 就 register | `register` 命令内部强制先调 `lint` |
| 跑批时引用未 register 的 case | `run` 命令检查 manifest，未 register 即报错 |
| 第一次就跑全量 train | 不强拦，但**强烈建议先 smoke 单 case**——节省 LLM cost + 防止整批因低级错误浪费 |

### 5.1.5 业务侧 source 差异（第二轮）

业务 source（如 PPT→视频用的教材 markdown）：

| 项 | 框架 MVP（toy） | 业务侧第二轮 |
|---|---|---|
| 目录 | `fixtures/cases/<split>/` | `cases/episodes/<episode_id>/` |
| 内容形态 | 纯人造 markdown | 教材 README + 子文件底稿 + script.json 等 |
| `Case` schema 字段 | `case_id / type / content` 极简 | 加 `target_duration / series_ref / chapter_id / source_files[]` |
| 校验机制 | 同左 | **完全相同**，schema 不同但 CLI / lint / register / frozen / pre-commit 流程不变 |
| Source 来源 | 人造 | `ai-engineer-roadmap` 真实章节装载 |

业务侧第二轮启动时需要做的额外动作 = **写业务 Case schema + 写 source 装载脚本**，其它流程一字不变。

---

## 5.2 加新物料（bootstrap 从零）

### 5.2.1 最小物料定义

**硬约束（缺则启动 hard fail）**：仅 `prompts/`（无法 LLM call）+ `schemas/`（无法 validate）两类（[`ADRs/017.md`](./ADRs/017.md)）。

**graceful degrade**：
- 缺 rubric → judge 跳过，artifact 仍产出，标 `eval: skipped`
- 缺 style_guide → 不注入 style 块
- 缺 exemplars → few-shot 不注入

**极薄 bootstrap**：**1 份 exemplar 草示意 + 一句话 prompt + 1 个默认 schema 就能跑**。其它（rubric / style_guide / 多 step）都是演化产物。

### 5.2.2 step-by-step

1. **决定要哪些物料**
   - 必备：`prompts/` + `schemas/` + `rubrics/`（rubric 缺会 skip eval，不建议）
   - 可省：`style_guides/` + `exemplars/`（exemplars bootstrap 建议 ≥ 1）

2. **在节点目录下建物料子目录**（[`ADRs/019.md`](./ADRs/019.md) 节点级目录约束）

   ```
   nodes/<name>/
   ├── prompts/
   │   ├── _model_adapter/      ← capability_gap（易耗品）
   │   └── _business_rules/     ← 其它三类（长期资产）
   ├── schemas/
   ├── rubrics/
   ├── style_guides/    (可省)
   └── exemplars/       (可省，bootstrap 建议 ≥1)
   ```

   两层物理隔离（[`ADRs/022.md`](./ADRs/022.md)）：`_model_adapter/` 假设要被重写、`_business_rules/` 跟产品 owner 一起 review。

3. **每条物料强制 tag**（4 选 1，CI 校验，缺失即拒，见 [`ADRs/022.md`](./ADRs/022.md)）

   ```yaml
   # 文件头声明
   version: 1.0
   tag: capability_gap | business_policy | channel_constraint | integration_glue
   created_at: 2026-05-13
   ```

   | Tag | 含义 | 处置 |
   |---|---|---|
   | `capability_gap` | 模型能力不足的临时补丁 | **每次模型升级强制重跑回归** |
   | `business_policy` | 业务规则 / 品牌 / 合规 / 私有信息 | 长期持有 + 版本化 + 单测 |
   | `channel_constraint` | 渠道/格式约束 | 跟外部接口同步 |
   | `integration_glue` | 系统集成胶水 | 跟集成方一起 review |

4. **bootstrap exemplar ≥ 1**（[`ADRs/017.md`](./ADRs/017.md)）
   - 一份真实样本展示"我要的样子"
   - 不允许合成数据（exemplar 必须是真实样本片段）

5. **校验**

   ```bash
   s2v materials check <node>
   ```

   缺 `prompts/` 或 `schemas/` → hard fail；缺其它 → 标 graceful degrade。

6. **smoke 跑通**

   ```bash
   s2v run <node> --cases fixtures/cases/train/<one_case>.md
   ```

7. **演化**：物料 v1.0 投产后跑出的第一批 artifact + 人工抽样 = **强制性 regression seed**，分配到 train / holdout。后续 bump v1.x 按 [`04-handbook.md`](./04-handbook.md) §改物料 L0–L5。

> **v1.0 bootstrap 例外**：v1.0 不要求 regression set 与 holdout（鸡生蛋）；不进 promote 流程。但一旦投产，第一批 artifact 强制成为 regression seed 并 70/30 分配。详见 [`02-architecture.md`](./02-architecture.md) §2.2.2。

---

## 5.3 加新节点 step-by-step

> **范围**：本节是节点骨架与目录结构的"加节点 checklist"。涉及业务节点的具体设计（如 Plan 节点 4 步链、ShotExecutionNode 3 步链）见 [`_future/business-design.md`](./_future/business-design.md) §3 / §4。

### 5.3.1 完整 checklist

1. **mkdir 节点目录**（[`ADRs/019.md`](./ADRs/019.md) + [`02-architecture.md`](./02-architecture.md) §2.6.1）

   ```
   nodes/<new>/
   ├── README.md              这节点是什么、IO、当前物料版本
   ├── node.py                Node 实现（Python class）
   ├── prompts/               物料就近放（不集中到 fixtures/materials/）
   │   ├── _model_adapter/
   │   └── _business_rules/
   ├── rubrics/
   │   ├── _model_adapter/
   │   └── _business_rules/
   ├── schemas/
   ├── style_guides/          (可省)
   ├── exemplars/             (可省)
   ├── eval/                  这节点的 regression set
   ├── ui/                    这节点的 Streamlit 页（≤ 200 行）
   ├── docs/                  这节点的设计文档
   └── fixtures/              节点本地 fixtures（如有）
   ```

   **铁律**：节点拥有自己的一切——代码、物料、UI、文档、eval——**统统住在同一个目录**。不变量 #8 在 UI 层不够，必须延伸到**文件系统层**。

2. **写 `nodes/<new>/node.py`**
   - 实现 Node Protocol（业务无关契约，见 [`02-architecture.md`](./02-architecture.md) §1）
   - 声明 `materials_spec`（要哪些物料）
   - 节点代码**只对 IO 契约负责，不为审美变化动**（不变量 #11）

3. **bootstrap 5 类物料**——指向 §5.2

   极薄起步：**1 份 exemplar + 一句话 prompt + 默认 schema**，其它演化产物（[`ADRs/017.md`](./ADRs/017.md)）。

   每条物料强制 tag（[`ADRs/022.md`](./ADRs/022.md)）。

4. **写 `nodes/<new>/ui/console.py`**（≤ 200 行 Streamlit）
   - 单页布局，artifact + 物料 + Eval Attribution + Decision Trace + 反馈表单 + rerun + 节点指标六件一屏
   - 跨节点导航：纯 artifact_id 超链接跳转，**禁止全流程聚合页**（不变量 #8）
   - 详细规范见 [`06-ui-spec.md`](./06-ui-spec.md)

5. **加 `nodes/<new>/eval/rubrics`**
   - 每条 rubric pass/fail 必须 Eval Attribution（[`ADRs/012.md`](./ADRs/012.md)）
   - anchor + 反例必须是**真实样本**，不能凭空编
   - 维度先 5–7 个 + 0/5/10 anchor 起步

6. **加 `nodes/<new>/docs/README.md`**
   - 节点是什么、IO 契约、当前物料版本、最近指标入口

7. **校验物料**

   ```bash
   s2v materials check <new>
   ```

   缺 `prompts/` 或 `schemas/` → hard fail。

8. **smoke 单 case**

   ```bash
   s2v run <new> --cases fixtures/cases/train/<one_case>.md
   ```

   看 artifact / Decision Trace / Eval 报告三件套是否齐。

9. **更新主流文档**
   - 业务节点 → 更新 [`_future/business-design.md`](./_future/business-design.md)
   - 框架级节点 → 更新 [`02-architecture.md`](./02-architecture.md) §2.6 节点清单 + `nodes/index.md` 全系统索引

### 5.3.2 加节点的判断纪律

- **变更频率 + 失败异质性驱动**——粒度不追求均匀（[`ADRs/002.md`](./ADRs/002.md)）
- **节点之间不互读 artifact，永远通过 plan 中介**（不变量 #7 #9 + [`ADRs/003.md`](./ADRs/003.md)）
- **审美 / 标准 / 类型变化绝不动节点代码**（不变量 #11 + [`ADRs/014.md`](./ADRs/014.md)）
- **3 次以上"只想改 sub-part"才触发拆节点 → L4 升级**（[`04-handbook.md`](./04-handbook.md) §改物料）

### 5.3.3 加业务节点的额外参考

加业务节点（如 Plan / ShotExecutionNode）时，节点内部如果是"多步链"模式（4 步链 / 3 步链），参考 [`_future/business-design.md`](./_future/business-design.md) §3 / §4 的设计模板——**只参考形式（怎么切 step、怎么独立 judge），不抄业务内容**。

---

## 5.4 加新 Per-Node Console（UI）

### 5.4.1 不变量

- **每节点独立 console**（不变量 #8，[`ADRs/010.md`](./ADRs/010.md)）
- **一个 console 一节点**——禁止"全流程聚合视图"
- 跨节点导航靠 artifact ID 超链接，**不做聚合**
- 每个 console 独立部署 / 独立可关停

### 5.4.2 落点

每节点的 Console 住在 `nodes/<name>/ui/console.py`，≤ 200 行 Streamlit（[`ADRs/019.md`](./ADRs/019.md) + [`ADRs/020.md`](./ADRs/020.md)）。

### 5.4.3 内容六件一屏

| 模块 | 说明 |
|---|---|
| Artifact 结构化渲染 | 不是裸 JSON |
| 物料版本徽章 | prompt vX / rubric vY / schema vZ / style / exemplars |
| **Eval Attribution** | 每条 rubric pass/fail + violated_rule_ref + judge_thinking |
| **Decision Trace** | rendered prompt diff / 注入物料 / 命中 exemplar / LLM thinking 摘要 |
| 字段旁结构化反馈按钮 | 弹反馈表单，预填 location |
| rerun 按钮 | 支持换不同物料版本对比 |
| 节点最近指标 | 一次过率 / Budget 当前层 + 剩余轮数 / 平均 cost |

完整实施栈 + ASCII 原型 + 反模式见 [`06-ui-spec.md`](./06-ui-spec.md)。
