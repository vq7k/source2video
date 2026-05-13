# 文档重构记录

> 一次性的重构 ADR。完成于零代码阶段，重排只动结构不动语义。**3 个月后可删本文件**。

## 为什么重构

5 个症结（重构前对话中识别）：

1. **概念散点**——"加新节点" / "UI 入口"等同概念分散在 3+ 文档
2. **术语只有部分有定义**——`synthetic` 6 处出现，`business_extract` / `external` 零处定义
3. **第一轮第二轮内容混杂**——03 / 05 §3 / 06 / 07 大段第二轮内容混在主流
4. **文件角色不纯**——01 同时讲机制 + 不变量 + 目录结构；04 同时是手册 + 反模式 + 设计纪律
5. **靠"冲突优先级表"和"30 行速查表"补结构**——这俩表存在 = 结构本身没自解释

## 重构原则

1. **按读者意图组织**（quickstart / handbook / recipes / reference / future）
2. **第二轮内容剥到 `_future/`**——MVP 期不读
3. **概念在一处定义**——抽 `00-glossary.md`，别处只 link
4. **不变量 / CLI / Schemas 独立成文**——从架构 / handbook 里拎出来
5. **ADR 单文件 → 多文件**——每条 ADR 一个 .md，跨引用清晰

## 文件映射表（旧 → 新）

### doc-maker/docs/

| 旧 | 新 |
|---|---|
| `01-architecture.md`（44KB，含 §4 不变量、§5 老项目） | `02-architecture.md`（删 §4 §5）+ `03-invariants.md`（独立不变量） |
| `02-acceptance.md` | `07-acceptance.md` |
| `03-design.md` | `_future/business-design.md` |
| `04-handbook.md` §1 / §3-§5 / §6.1-6.5 / §8 / §9 主体 | `04-handbook.md`（清理后） |
| `04-handbook.md` §2.0.1 / §2.0.5 启动 6 步 | `01-quickstart.md` |
| `04-handbook.md` §2.0.2 / §2.0.3 / §2.0.4 / §2.0.6 加 case | `05-recipes.md` §5.1 |
| `04-handbook.md` §6.6 加新节点 | `05-recipes.md` §5.3（综合 ADR-019 + 01 §2.6.1 + 03 §3 + §6.6 拼成 step-by-step） |
| `04-handbook.md` §7 CLI | `reference/cli.md` |
| `05-ui-spec.md` §0-§2 / §4-§8（删 §3 第二轮原型） | `06-ui-spec.md` |
| `05-ui-spec.md` §3 业务侧 Plan/Shot 原型 | 删除（_future/business-design.md 已含业务侧 console 设计） |
| `06-user-stories.md` | `_future/user-stories.md` |
| `07-test-cases.md` | `_future/test-cases.md` |
| `08-tech-stack.md` | `08-tech-stack.md`（保留，只改引用 + 编号 08/09） |
| `ADR.md`（单文件 22 条 + 末尾依赖图 + 未决） | `ADRs/001.md` ~ `022.md` + `ADRs/README.md`（含依赖图 + 未决） |
| **新文件** | `00-glossary.md`（术语单一定义） |
| **新文件** | `05-recipes.md` §5.2 加新物料 / §5.4 加 console |
| **新文件** | `reference/schemas.md`（Case / Artifact / Feedback / Decision Trace / Eval Attribution / Materials Tag 集中） |
| **新文件** | `_future/README.md`（"MVP 过线前不读"警告） |

### source2video/docs/（仓级）

| 旧 | 新 |
|---|---|
| `01-repo-layout.md` | `repo-layout.md`（去编号） |
| `ADR.md`（2 条 023/024） | `ADRs/023.md` + `024.md` + `ADRs/README.md` |
| `README.md` | 更新引用 |

### README + CLAUDE.md

- `source2video/README.md` — 更新仓级文档链接
- `doc-maker/README.md` — 阅读顺序按新编号
- `doc-maker/CLAUDE.md` — 必读文档表全面重排 + 加 `05-recipes.md` 入口

### 备份

- 旧文件全部保留在：
  - `doc-maker/docs.legacy/`
  - `docs.legacy/`
- 验收通过后可删

---

## ADR 文件名约定

- 文件名：纯数字三位（`019.md`），不带 slug
- 每个文件头部 frontmatter：

```yaml
---
id: ADR-019
title: 节点级目录结构（nodes/<name>/ 全套就近）
status: 采纳
scope: doc-maker    # 或 source2video（仓级）
related: [003, 010, 023]
---
```

- ADR 之间互引：`[ADR-019](019.md)`（同目录跳转）
- ADR 引主流文档：`[02-architecture.md](../02-architecture.md)`
- ADR 引仓级（从 dm 视角）：`[ADR-023](../../../docs/ADRs/023.md)`
- dm/docs/ADRs/ 下的 `023.md` / `024.md` 是 stub（只有一行转发到仓级，方便 dm 内查找体验）

---

## 已知"推断"内容（需用户 review）

重构是机械搬运为主，但以下几处是 Agent **基于现有文档推断写出**——原文档没有正式定义，新文档把推断显式化了。**用户读到时如不认可可直接改**：

### 1. `00-glossary.md` 术语推断

| 术语 | 推断依据 |
|---|---|
| `business_extract` = "真实业务（ai-engineer-roadmap 教材）抽出的 case；可能跟上游联动" | ADR-018 / ADR-021 / 04 §2.0.7 业务 source 差异表 |
| `external` = "第三方来源 / 预留扩展位" | 原文档仅在 metadata.yaml 字段注释里列了枚举，零正式定义 |

### 2. `05-recipes.md` §5.3 加新节点 step-by-step

综合 ADR-019 + 01 §2.6.1 + 04 §6.6 + 03 §3/§4 拼出的完整 checklist。以下选择 Agent 做了但**原文档没明说**：

| 项 | Agent 选择 | 备注 |
|---|---|---|
| 节点目录里 `docs/` 和 `fixtures/` 子目录是否进 | 加了，但标"如有" | ADR-019 只列 `{README, node.py, prompts/, rubrics/, schemas/, ui/, eval/}` |
| UI 文件名 | 用 `ui/console.py` | 原文只说"≤200 行 Streamlit 单页"，未规定文件名 |
| `rubrics/` 是否同样两层物理隔离（`_model_adapter/` `_business_rules/`） | 加了 | 01 §2.2.3 明说 prompts/ 强制，rubrics/ 是"同样" |
| Step 9 更新主流文档分流 | 业务节点 → `_future/business-design.md`；框架节点 → `02-architecture.md` §2.6 + `nodes/index.md` | 原文未明说 |

### 3. ADR 内部锚点引用映射（机械替换）

| 原引用 | 新引用 |
|---|---|
| `01-architecture.md §X` | `../02-architecture.md` §X（章节锚点保留） |
| `05-ui-spec.md §4 index.md` | `../06-ui-spec.md` §4 |
| 仓级 `01 §2.1` (在 ADR-024 中) | `../../doc-maker/docs/02-architecture.md` §2.1 |

---

## Agent 跑批纪要

5 个并发 Agent 完成重构：

| Agent | 工作 | 输出 |
|---|---|---|
| 1 | ADR 拆分 | 22 dm + 2 仓级 + 2 dm stub + 2 README |
| 2 | 架构 + 不变量 | `02-architecture.md` (678 行) + `03-invariants.md` (189 行) |
| 3 | handbook + quickstart + cli + recipes | `01-quickstart.md` (117) + `04-handbook.md` (296) + `05-recipes.md` (291) + `reference/cli.md` (102) |
| 4 | UI + acceptance + glossary + schemas | `06-ui-spec.md` (248) + `07-acceptance.md` (330) + `00-glossary.md` (109) + `reference/schemas.md` (250) |
| 5 | 第二轮剥离 + 仓级 + READMEs | `_future/` 4 文件 + 仓级 3 文件 + 各层 README + CLAUDE.md |

外加：`08-tech-stack.md` 由主控制器后补迁移（重构 plan 时遗漏 Agent 分工）。

---

## 验证

- [x] 所有新文件落地（9 主流 + 25 ADR + 2 reference + 4 _future + 仓级 3 + 3 README + CLAUDE.md）
- [x] 全局 grep 无旧文件名残留（`01-architecture` / `02-acceptance` / `03-design` / `05-ui-spec` / `06-user-stories` / `07-test-cases` / `01-repo-layout` / `ADR.md`）
- [x] 子目录文件相对路径前缀正确（`reference/` 和 `_future/` 下用 `../`，`ADRs/` 下同目录用 `NNN.md`、跨目录用 `../`）
- [ ] **待用户全文 review**——本文件存在的全部目的就是给 reviewer 一份 "重构变了什么 / 哪些是推断" 的速查
