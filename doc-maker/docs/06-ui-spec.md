# 06 · source2video UI 设计文档

> **阅读位置**：06 / 10（入口：[`README.md`](./README.md)）。**本文档定位**：**L2 / L3 诊断层 console** 的 UI 规格 + ASCII 原型 + 实施栈。**当前业务产品主线（L1 Business Console）** 见 [`business-console.md`](./business-console.md)。
>
> 配套：[`02-architecture.md`](./02-architecture.md) §2.6 / §2.6.1（机制与目录约束）、[`07-acceptance.md`](./07-acceptance.md) US-12（验收 AC）、[`04-handbook.md`](./04-handbook.md) §3（用户操作流程）、[`00-glossary.md`](./00-glossary.md)（术语索引）、[`ADRs/025.md`](./ADRs/025.md)（L1/L2/L3 分层决策）。

---

## 0. 立场：本文件讲诊断层 console（L2/L3），不讲业务产品层（L1）

source2video 有 3 层 UI（[ADR-025](./ADRs/025.md)）：

| 层 | 名称 | 谁用 | 在哪定义 |
|---|---|---|---|
| L1 | Business Console | "使用者"（作者本人作为产品用户 / 非技术使用者） | [`business-console.md`](./business-console.md)（当前产品主线） |
| L2 | Hub Console | 作者运维视角 | 本文件：诊断导航 / readiness，不做 dashboard |
| L3 | Per-Node Console | 作者深度排查 | 本文件主体：trace / eval / feedback / rerun 诊断闭环 |

**本文件主要讲 L3 / L2 诊断层 console，立场是给作者用的，不是给业务使用者用的**。L1 产品视角的所有设计纪律见 [`business-console.md`](./business-console.md)。Plan / Shot / QA 诊断页在真实 artifact 接入前属于故事板，不代表 backend ready。

---

## 0.1 立场（L2/L3 框架层 console）：UI 是给作者用的

**Per-Node Console 真正的设计动机**：**作者本人对项目的"活体感知"**。

| 没有 console | 有 per-node console |
|---|---|
| 节点设计 + 物料 + 指标散在文件系统多处 | 一屏看完，结构 + 状态一目了然 |
| 几周不碰，认知冷却 → 重启靠考古 | 几周不碰，打开 console = 立即拾回 |
| 改物料前要回忆"这个节点跑得如何" | 改物料前直接看指标卡 + 最新 attribution |
| 新人 vs 老人都要靠读文档 | 不区分新人老人——都靠看 console |

**不是协作便利工具，是认知负担减压器**。这套定位决定了 console 的所有设计取舍：

- **极简优先**：一屏看完比"功能丰富"重要
- **per-node 不聚合**：跨节点拼大表 = 重新引入耦合 = 重新增加认知负担
- **artifact + 物料 + 指标 + 反馈四件套永远在同一页**：作者眼睛不必跳来跳去
- **不做"全流程仪表盘"**：作者要的是"这个节点活着吗"，不是"整个系统状态"

---

## 1. 设计纪律（不变量）

| # | 纪律 | 违反后果 |
|---|---|---|
| 1 | **一个 console 服务一个节点**，跨节点靠 artifact_id 超链接 | 聚合视图 = 在 UI 层重新引入节点耦合，架构白拆（[不变量 #8](03-invariants.md)） |
| 2 | **一屏视觉密度**（不限文件行数，组件按需拆分；[ADR-026](ADRs/026.md) 后换 Next.js + shadcn） | 行数失控 = 说明把业务逻辑塞进 UI，应该挪回节点；一屏看不完 = 失去"活体地图"定位 |
| 3 | **console 独立部署、独立可关停** | 一个挂了不影响别的；不必维护就先关掉 |
| 4 | **不做花哨**：表单 + 表格 + Markdown 渲染就够，不上 dashboard 组件 | 死掉的 UI 比没有 UI 更糟（[ADR-010](ADRs/010.md)） |
| 5 | **数据全从 trace / artifact / metrics 文件读**，不写新数据库 | 跟 source 入仓同理：git/文件系统是 SOT |
| 6 | **反馈表单弹出 ≤ 30 秒填完** | 录入摩擦大就没人填，反馈 schema 形同虚设 |
| 7 | **rerun 按钮内部调 `s2v run` CLI** | UI 不重复实现 runtime——CLI 是 SOT，UI 是 thin shell |

---

## 2. ToyNode Console 原型（框架 MVP）

### 2.1 整页布局

```
┌─────────────────────────────────────────────────────────────────────┐
│ source2video · ToyNode Console                                       │
│ artifact: 01_basic_run_2026-05-12_a3f2c1     [⟳ rerun] [← back]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ ┌─ Materials（点击徽章看物料 diff）─────────────────────────────┐ │
│ │  prompts/toy/extract@v1.0   rubrics/toy@v1.0                    │ │
│ │  schemas/toy_artifact@v1.0  style_guides/toy_voice@v1.0         │ │
│ │  exemplars: ex_01, ex_02                                         │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ ┌─ Artifact ─────────────────────────────────────────────────────┐ │
│ │ points:                                                          │ │
│ │   1. 合成饮料的核心是低成本可控原料           [💬 反馈]        │ │
│ │   2. 主要成分为水(80%)、糖(10%)、香精+色素   [💬]              │ │
│ │   3. 制作流程：过滤 → 配料 → 搅拌 → 冷藏     [💬]              │ │
│ │                                                                  │ │
│ │ metadata:                                                        │ │
│ │   source_case: cases/train/01_basic.md                          │ │
│ │   timestamp:   2026-05-12 14:23:01                              │ │
│ │   token_used:  1,247  ·  latency: 3.4s  ·  cost: $0.003        │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ ┌─ Eval Attribution（逐维度展开）───────────────────────────────┐ │
│ │  ✅ clarity    PASS  judge: "三个要点表述清晰，无歧义"          │ │
│ │                anchor: rubrics/toy@v1.0#clarity_anchor_1         │ │
│ │                                                                   │ │
│ │  ✅ coverage   PASS  judge: "覆盖原文 80%+ 主要内容"             │ │
│ │                anchor: rubrics/toy@v1.0#coverage_anchor_2        │ │
│ │                                                                   │ │
│ │  ⚠️ format    FAIL  judge: "points[2] 含全角逗号，schema 要求 │ │
│ │                半角"                                              │ │
│ │                violated: schemas/toy_artifact@v1.0#format_rule_3│ │
│ │                citation: points[2]:"水(80%)、糖(10%)、香精+色素" │ │
│ │                [💬 反馈]                                          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ ┌─ Decision Trace（折叠默认）─────────────────── [▼ 展开] ───┐   │
│ │  template: prompts/toy/extract@v1.0                            │   │
│ │  rendered_prompt_diff: (+278 字符: case content + style 注入)  │   │
│ │  materials_injected:                                            │   │
│ │    style_guide: toy_voice@v1.0#L1-L8                           │   │
│ │  exemplars_used:                                                │   │
│ │    - ex_01.yaml (similarity 0.72)                              │   │
│ │  llm_thinking_summary:                                          │   │
│ │    "I focused on three main aspects: cost-control, composition │   │
│ │     ratios, and process steps. Skipped the marketing tone..."  │   │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ ┌─ Node Metrics（最近 7 次跑批）─────────────────────────────────┐ │
│ │  一次过率:   5/7 (71%)        平均 token:    1.2K               │ │
│ │  Budget:    L0, 1/3 rounds    平均 latency:  3.4s               │ │
│ │  改物料 q:  0 触发中           平均 cost:    $0.004              │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ ┌─ Rerun ─────────────────────────────────────────────────────────┐ │
│ │  Materials version:  [v1.0 ▼]                                    │ │
│ │  Case:               [01_basic.md ▼]                            │ │
│ │                                                                   │ │
│ │  [⟳ Rerun]   [⚖️ Rerun & compare with current]                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 反馈弹窗（点 [💬] 后展开）

```
┌─ Feedback (location: points[2]) ──────────────────────────┐
│                                                            │
│  Verdict:        ○ good  ● bad  ○ minor_nit               │
│                                                            │
│  Likely cause:   ○ style                                   │
│                  ○ prompt                                  │
│                  ● schema    ← (点选)                       │
│                  ○ rubric                                  │
│                  ○ exemplar                                │
│                  ○ single-case                             │
│                                                            │
│  Severity:       ○ high  ● medium  ○ low                  │
│                                                            │
│  Issue (≤ 200 chars):                                      │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ schema 没强制半角符号，全角逗号混入                    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Expected (≤ 200 chars, 可选):                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ schema 加 regex 验证或预处理 normalize                │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Tags (可选): [+ add tag]                                  │
│                                                            │
│             [Cancel]   [Submit feedback]                   │
└────────────────────────────────────────────────────────────┘
```

提交后落 `nodes/toy/feedback/<feedback_id>.yaml`，写入 git。

### 2.3 物料徽章点击 → diff 弹窗

```
┌─ rubrics/toy@v1.0 ──────────────────────── [Close] ───────┐
│                                                            │
│  当前版本：v1.0                                            │
│  历史版本：(无，bootstrap)                                  │
│                                                            │
│  ┌─ Content ─────────────────────────────────────────┐    │
│  │ version: 1.0                                       │    │
│  │ dimensions:                                        │    │
│  │   - clarity:                                       │    │
│  │       anchors:                                     │    │
│  │         pass: "要点表述清晰，无歧义"                │    │
│  │         fail: "要点措辞模糊或自相矛盾"             │    │
│  │   - coverage: ...                                 │    │
│  │   - format: ...                                   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  [📝 Edit (跳 vim 模式)]   [📋 Show full git history]     │
└────────────────────────────────────────────────────────────┘
```

---

## 4. index.md 系统入口（不是 console，是文档）

```markdown
# source2video 系统索引

## 节点

| 节点 | 状态 | 当前物料版本 | Console |
|---|---|---|---|
| [toy](./nodes/toy/)   | ✅ MVP | v1.0   | `streamlit run nodes/toy/ui/console.py` |
| [plan](./nodes/plan/) | ⏳ 第二轮 | —    | TBD |
| [shot](./nodes/shot/) | ⏳ 第二轮 | —    | TBD |
| [qa](./nodes/qa/)     | ⏳ 第二轮 | —    | TBD |

## 连接关系

```
toy:  standalone

plan ──→ shot (×N) ──→ qa ──→ video
```

> 改某节点不动 index.md（除非接口变 / 新增 / 删节点）。
```

---

## 5. 实施栈（[ADR-026](ADRs/026.md)）

| 项 | 选型 | 理由 |
|---|---|---|
| 框架 | **Next.js 15 + App Router** | L1/L2/L3 三层 UI 同栈；File-based routing 帮跨页跳转 |
| 语言 + UI | **React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui (New York, neutral) + lucide-react** | 跟原型一脉相承，验收 → 实施零重写 |
| 数据源 | 直接读 `traces/` / `nodes/<name>/` / Langfuse API | UI 不存数据库；文件系统 / Langfuse 是 SOT |
| 触发 rerun | **Server Actions** 调 `subprocess.run(["s2v", "run", ...])` | CLI 是 SOT，UI 是 git thin 前端（[ADR-021](ADRs/021.md)） |
| 反馈写入 | Server Action 写 `nodes/<name>/feedback/<feedback_id>.yaml` | git 管理，跟 source 入仓同纪律 |
| 跨节点导航 | Next router + `searchParams.artifact=<id>`；各页面自己 resolve | 单 Next.js 进程内 path routing |
| 状态轮询 | `useEffect` + 轮询 `traces/episodes/<id>/status.yaml` | git/文件系统是 SOT，无 WebSocket |
| 部署 | **单一 Next.js 进程**（`pnpm dev` 或 `pnpm start`） | 比多 Streamlit 进程 + 端口管理简单 |
| 项目目录 | `doc-maker/ui/`（L1/L2/L3 集中；后续可按 [ADR-019](ADRs/019.md) 拆 L3 到 `nodes/<n>/ui/`） | 一致性 > 节点目录就近（MVP 阶段） |
| 版本 | `doc-maker/ui/package.json` `version` 字段 | 跟节点 IO 契约同步 bump 时 SemVer 升 |

---

## 6. 不允许的设计

| 反模式 | 为什么不许 |
|---|---|
| "全流程仪表盘" / "所有节点状态总览页" | 聚合 = 重新引入耦合，违反[不变量 #8](03-invariants.md) |
| 跨节点共享 UI 组件库（如统一头部 / 统一导航条） | 任何共享都是耦合点；每个 console 重复 30 行布局比共享一份"未来要改时谁也不敢动" 健康 |
| 在 console 里实现业务逻辑（如"我帮你聚类反馈"） | 业务逻辑必经 CLI；UI 只是显示 + 触发 |
| 编辑物料文件（直接在浏览器改 prompt） | 物料改动必经 git + Promote Pipeline，UI 编辑会绕过 Gate |
| 数据库 / Redis / 任何运行时存储 | 文件系统 / git / Langfuse 已经够；引入新存储就要维护 |
| 用户权限 / 登录 | 第一版你一个人用，连个用户表都不要 |
| **在同一 console 内**塞多个 tab（如 ToyNode console 加 "history / metrics / settings" tab） | 单 console 单页能塞下就单页；tab 切换 = 把折叠区拆成多次点击。**跨 console 跳转**用 Next router（属于 first-class 路由，不是反模式） |

---

## 7. 与其他文档的关系

| 文档 | 角色 |
|---|---|
| [`02-architecture.md`](./02-architecture.md) §2.6 / §2.6.1 | 机制定义 + 文件目录约束（最高优先级） |
| [`07-acceptance.md`](./07-acceptance.md) US-12 | 验收 AC（什么算 "Console 上线了"） |
| [`04-handbook.md`](./04-handbook.md) §3 | 用户怎么用 console（提反馈流程） |
| **06（本文）** | UI 规格 + 原型 + 实施栈 |
| [`00-glossary.md`](./00-glossary.md) | 术语索引（Per-Node Console / Decision Trace / Eval Attribution 等） |

冲突时以 02 机制定义为准。

---

## 8. 当 console 该退役时

**触发条件**：

- 节点被删除（对应 console 也删）
- 节点 IO 契约改变 → console 必须同步 bump（`__ui_version__`），不同步 = 视为损坏 → 该节点开发停摆
- console 维护成本 > 它解决的认知负担 → 关掉（不变量"死掉的 UI 比没有 UI 更糟"）

**退役不是失败**——是承认这个节点稳定到不需要单独的认知减压器了。可以把它的 README 写厚作为替代。
