# _future · Business Console（业务层 console / L1）

> **位置**：`_future/business-console.md`。**业务层 UI 设计**，**第二轮才动手开发**。MVP 过线前**不读**。
>
> 配套：[`../ADRs/025.md`](../ADRs/025.md)（业务层与框架层 UI 解耦决策）、[`../ADRs/021.md`](../ADRs/021.md)（修正后允许 git thin 前端）、[`../06-ui-spec.md`](../06-ui-spec.md)（L2/L3 框架层 console）、[`../00-glossary.md`](../00-glossary.md)（L1/L2/L3 三层定义）。

---

## 0. 立场：业务层和框架层解耦

**Business Console（L1）真正的设计动机**：**业务使用者只想看到本次素材跑到哪了 + 最终产出**，不关心框架。

| 没有 L1 | 有 L1 |
|---|---|
| 使用者必须懂节点 / 物料 / Decision Trace 才能跑流水线 | 上传 PPT → 看 Episode 状态 → 拿产出 |
| 出问题必须读 trace / attribution 才能诊断 | 出问题 = 状态徽章 + 一键跳转到对应节点 console |
| 跨节点状态散在 4 个 console，使用者要记端口 | 一屏看所有 Episode 状态 |
| 上传素材必须 git + CLI | 上传 = 拖文件到 UI（内部仍走 git thin 前端） |

**不是替代 L2/L3，是顶层解耦**。L1 跑通时 L2/L3 不可见；L1 出问题时跳进 L2/L3。

---

## 1. 设计纪律（7 条，承袭 [ADR-025](../ADRs/025.md)）

| # | 纪律 | 违反后果 |
|---|---|---|
| 1 | 以 Episode 为单元，不暴露节点内部 | UI 泄漏框架内部 = L1 立场垮 |
| 2 | 状态 ≥ 详情——状态徽章默认显示，详情折叠 | UI 变运维仪表盘 |
| 3 | 跑通的 Episode 不显示任何节点链接 | "出问题才进入"立场写死 |
| 4 | 不展示 Materials / Decision Trace / Attribution / rubric 分布 | 业务使用者无能力解释 |
| 5 | 核心动作只 3 个：上传 / 重跑 / 接受 | UI 长按钮 = 重新引入运维负担 |
| 6 | 素材上传仅作为 git 前端（内部走 `s2v cases register` + commit） | 绕过 git = 违反 [ADR-021](../ADRs/021.md) 修正后立场 |
| 7 | 不允许"在 UI 里改 prompt" | 物料改动必经 git + Promote Pipeline（[ADR-008](../ADRs/008.md)） |

---

## 2. 业务层 Console 原型

### 2.1 整页布局

```
┌─────────────────────────────────────────────────────────────────────┐
│ doc-maker · Business Console                       [↻ 刷新][设置]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ [+ 新建 Episode]  [上传素材 (PPT/MD)]                                │
│                                                                       │
│ ┌─ Episodes ──────────────────────────────────────────────────────┐ │
│ │                                                                   │ │
│ │ ▸ ml_lr_e04b · 线性回归 · 向量与矩阵          ✅ done            │ │
│ │   素材: 03线性回归.pptx 2.4MB · 跑批 3 轮 · 用时 10:24            │ │
│ │   [📄 scripts.md] [🎬 shots/] [✓ qa_report]    [完整查看 →]       │ │
│ │                                                                   │ │
│ │ ▸ ml_knn_e02a · KNN 算法基础                  ⚠️ qa 警告 (2 处)  │ │
│ │   素材: 02KNN算法.pptx 1.8MB · 跑批 5 轮 · 用时 12:01             │ │
│ │   QA 报告：duration_align FAIL ×2                                  │ │
│ │   [→ QA Console]   [接受继续]   [回炉重跑]                        │ │
│ │                                                                   │ │
│ │ ▸ ml_lr_e04c · 线性回归 · 多元拓展             🔵 跑批中           │ │
│ │   plan ✓  →  shot (3/6)  →  qa  →  done                            │ │
│ │   预计还剩 4 分 12 秒                                              │ │
│ │                                                                   │ │
│ │ ▸ ml_dt_e05 · 决策树                          ❌ failed            │ │
│ │   失败：Plan 节点撞 Bounded Budget（L3 重试 3 次仍 fail）           │ │
│ │   [→ Plan Console]   [查看 trace]   [回滚到 v0]                    │ │
│ │                                                                   │ │
│ └────────────────────────────────────────────────────────────────────┘
│                                                                       │
│ ┌─ 系统健康（默认折叠）──────────────────── [▼ 展开] ────────────┐ │
│ │ 框架: ✅  · 物料: plan@v1.2 shot@v1.0 qa@v1.0  · [→ Hub Console] │ │
│ └────────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

注意：跑通 Episode（✅）只显示产出按钮，**不出现节点链接**。仅 ⚠️ / ❌ 状态才暴露节点入口（纪律 #3）。

### 2.2 上传素材弹窗

```
┌─ 新建 Episode + 上传素材 ───────────────────────────────────┐
│                                                              │
│  Episode ID:      [ml_lr_e04b___________]                    │
│  Title:           [线性回归 · 向量与矩阵_______________]      │
│  Target duration: [10:00___]                                 │
│                                                              │
│  Source files:    [+ 拖拽或选择文件]                         │
│    - 03线性回归.pptx (2.4MB)         [✕]                     │
│    - README.md (8KB)                  [✕]                    │
│                                                              │
│  Tags (可选): [lr] [linear-regression]                       │
│                                                              │
│             [Cancel]      [上传 + 跑批]                       │
└──────────────────────────────────────────────────────────────┘
```

**上传后端流程（git thin 前端，纪律 #6）**：

1. UI 后端把文件写到 `fixtures/cases/staging/<episode_id>/`
2. 自动调 `s2v cases lint fixtures/cases/staging/<episode_id>/`
3. lint 通过 → 自动调 `s2v cases register --case <path> --split auto`
4. `git add fixtures/cases/<split>/<episode_id>/ && git commit -m "register case <episode_id> (via business console)"`
5. 调 `s2v run pipeline --episode <episode_id>` 启动 pipeline（异步）
6. 前端轮询 `traces/episodes/<episode_id>/status.yaml` 显示进度

**纪律 #6 的工程化实现**：UI 后端是 CLI 的 subprocess 调用层，**不重新实现** lint / register / commit。CLI 失败 → UI 报错（不替 CLI 决定）。

### 2.3 错误时跳转节点 console（纪律 #3）

Episode 状态 = ⚠️ warn / ❌ fail 时，L1 显示"→ 进入 X 节点 console"按钮。点击后：

- URL: `http://localhost:8503/?artifact=ml_knn_e02a_qa_run_b1d4e5`
- 跳转到对应 per-node console（L3），带 artifact_id query param
- L3 console 自行 resolve query param，显示具体 artifact

L3 console 不需要为 L1 修改任何代码——query param 是已有约定（[06-ui-spec.md §5](../06-ui-spec.md)）。

---

## 3. 跟 L2 / L3 的跳转协议

```
                       ┌──────────────────┐
                       │ L1 Business      │ ← 使用者入口
                       │ Console          │
                       └────┬─────────────┘
                            │
              warn/fail     │      作者独立打开
                  跳转       │
              ┌─────────────┼─────────────────┐
              ▼             ▼                 ▼
       ┌─────────────┐ ┌─────────────┐  ┌────────────┐
       │ L3 Plan     │ │ L3 Shot     │  │ L2 Hub     │
       │ Console     │ │ Console     │  │ Console    │
       └─────────────┘ └─────────────┘  └────┬───────┘
                                              │
                                       ┌──────┼──────┐
                                       ▼      ▼      ▼
                                      L3     L3     L3
                                     Plan   Shot   QA
```

**单向**：L1 → L3（跳过 L2，因为 L1 已知是哪个节点）；L2 → L3（运维入口）。  
**禁止**：L2/L3 反向引用 L1 概念——Episode 抽象不进框架层。

---

## 4. 实施栈（[ADR-026](../ADRs/026.md)）

| 项 | 选型 | 理由 |
|---|---|---|
| 框架 | **Next.js 15 + App Router** | 跟 L2/L3 一致（[ADR-026](../ADRs/026.md) 全栈统一） |
| 路由 | `/` = L1 主页（本文件设计的 console） | App Router file-based |
| 上传后端 | **Server Action** 调 `subprocess.run(["s2v", "cases", "lint/register"])` + git commit | git thin 前端（纪律 #6 + [ADR-021](../ADRs/021.md) 修正后） |
| 上传 UI | shadcn Dialog + Form + `<input type="file">` | 替代 `st.file_uploader` |
| 状态轮询 | `useEffect` + 轮询 `traces/episodes/<id>/status.yaml` | 文件系统 / git 是 SOT |
| 错误跳转 | Next router + `?artifact=<id>` → `/node/{name}` | 单进程 path routing，跨 L3 console 跳转零成本 |
| 部署 | 单一 Next.js 进程（建议端口 3000，作者也直接打开） | 比多 Streamlit 进程 + 端口管理简单 |
| 单页视觉 | **一屏视觉密度**（不限行数；组件按需拆） | [ADR-026](../ADRs/026.md) 行数纪律变更 |

---

## 5. 不允许的设计

| 反模式 | 为什么不许 |
|---|---|
| 在 L1 展示节点物料 / Decision Trace / Eval Attribution | 业务使用者无能力解释，等于噪声（纪律 #4） |
| 在 L1 改 prompt / 物料版本 | 物料改动必经 git + Promote Pipeline（纪律 #7） |
| L1 跨 Episode 拼大表（按 tag 聚合 / 平均一次过率 等） | 等于跨节点聚合，违反 L2/L3 解耦立场 |
| L2/L3 反向引用 L1（Episode 概念进入框架层） | 框架层不知道业务层存在（Episode 是业务概念，不进框架抽象） |
| 没跑通的 Episode 显示部分产出 | 半成品产物是噪声；要么 done 要么 failed |
| L1 持久化任何业务数据库 | 文件系统 + git 已是 SOT；引入 DB = 维护负担 |
| 在 L1 弹一个"提反馈"按钮 | 反馈表单是 L3 的事（[ADR-008](../ADRs/008.md)），业务使用者不应该提物料级反馈 |

---

## 6. 第二轮实施时机

- **触发条件**：业务侧第二轮启动（Plan / Shot / QA 节点 MVP 通过）
- **不是** MVP 出口判据（[07-acceptance §5](../07-acceptance.md)）的一部分——MVP 只要求 ToyNode Console（L3）
- 实施工作量估算：1–2 周（Streamlit 单页 + 上传 wizard + 状态轮询 + 跳转）
- 实施时**首先 review 本文档 + [ADR-025](../ADRs/025.md) + [ADR-021](../ADRs/021.md) 修正后立场**——以这三处为 SOT

---

## 7. 退役条件

| 触发 | 处置 |
|---|---|
| L1 跟 L2/L3 立场冲突浮现（如使用者强烈要求看 attribution） | 立场冲突 = 该使用者其实是"作者"——劝他用 L3 而不是把 L3 内容拉进 L1 |
| Episode 抽象需要进框架层（多个子项目都要 Episode） | 升格 Episode 到 `02-architecture.md` §1 + 仓级 ADR；本文档保留作业务案例 |
| L1 实施 ≥ 300 行 | 拆分或砍功能；不允许长出"小型仪表盘" |
| 框架内核改动导致 L1 上传后端 break | L1 重写 subprocess 调用层；不允许 L1 自己实现 lint/register（仍是 git thin 前端） |
