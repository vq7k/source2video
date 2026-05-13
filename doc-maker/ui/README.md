# doc-maker · 3-Layer UI Prototype

> **这是产品验收原型，不是实施代码**。验证 doc-maker `L1 / L2 / L3` UI 解耦的视觉与交互可行性（ADR-025）。所有数据 mock，所有"调 CLI / 写文件"只是 setTimeout + console.log 假装。

---

## 跑起来

```bash
cd doc-maker/ui
pnpm install
pnpm dev
# → http://localhost:3000
```

> 依赖 Node ≥ 20 / pnpm ≥ 10。

构建检查：

```bash
pnpm typecheck   # tsc --noEmit
pnpm build       # next build
```

---

## 6 个路由 · 验收要点

| # | 路由 | 层 | 验收要点 | 对应文档 |
|---|------|---|---------|---------|
| 1 | `/` | L1 Business Console | 4 个 Episode 四态（done/warn/running/failed）+ 上传 Dialog + 系统健康折叠面板 | `_future/business-console.md` §2.1 + ADR-025 |
| 2 | `/hub` | L2 Hub Console | 4 个 Node 卡：alive 指示 + 最近 artifact_id + Open Console 跳转 | `06-ui-spec.md` §0 / `00-glossary.md` UI 表 |
| 3 | `/node/toy` | L3 ToyNode | 完整 6 件套：Materials / Artifact / Eval Attribution / Decision Trace / Feedback / Rerun + Node Metrics | `06-ui-spec.md` §2 |
| 4 | `/node/plan` | L3 Plan | Plan artifact + shot list 表格（6 行可跳 Shot）+ cross-step eval + 4 步 Decision Trace 折叠 | `_future/business-design.md` §3 + `06-ui-spec.md` §2 |
| 5 | `/node/shot/[id]` | L3 Shot | 三件套（text / text_tts / notes）+ cross-step consistency + 跳回 plan | `_future/business-design.md` §4 |
| 6 | `/node/qa` | L3 QA | episode 一致性 5 维度 + duration_align FAIL ×2 + 跳回 plan/shot 链接 | `_future/business-design.md` §10 + ADR-010 |

### L1（`/`）细节验收清单

按 ADR-025 7 纪律对照：

- [x] 纪律 #1 以 Episode 为单元：4 个 Episode 卡，无节点视图
- [x] 纪律 #2 状态 ≥ 详情：StatusBadge 突出，系统健康面板默认折叠
- [x] 纪律 #3 done 不显示节点链接：`ml_lr_e04b` 只有 `scripts.md / shots/ / qa_report` 三个产出按钮
- [x] 纪律 #4 不展示 Materials / DT / EA / rubric：L1 没出现这些字眼
- [x] 纪律 #5 核心动作 ≤ 3：上传 / 接受 / 重跑
- [x] 纪律 #6 git thin 前端：上传 Dialog 走 form → lint → register → trigger run 4 phase（mock setTimeout）
- [x] 纪律 #7 不改 prompt：L1 无 prompt 编辑入口
- [x] running 状态自推进：useEffect setInterval 每 2.5s 推一次 shot 进度
- [x] 上传新建：window CustomEvent 把新 Episode 插入 EpisodeList 头部

### L2（`/hub`）细节验收清单

- [x] 4 节点卡（toy / plan / shot / qa）
- [x] alive 指示（qa = down 演示）
- [x] 最近 artifact_id + 7d 一次过率
- [x] 内容密度低（每卡 ≤ 6 行）
- [x] 不展示节点内部 artifact / DT / EA
- [x] 单向跳转：L2 → L3，不引用 L1 Episode 概念

### L3 共通验收清单

- [x] 6 件套同一页：Materials / Artifact / Eval Attribution / Decision Trace / Feedback / Rerun + Node Metrics
- [x] Materials 徽章可点击 → 弹出 diff 预览 Dialog
- [x] Feedback Dialog 30 秒填完（verdict / cause / severity / issue / expected）
- [x] Decision Trace 默认折叠
- [x] Rerun 显示等价 CLI 调用（thin shell）
- [x] 顶部 `← back` + 跨页跳转链接

---

## 视觉规范

- **不使用 emoji**——状态全部用 `lucide-react` 图标（CheckCircle2 / AlertTriangle / Loader2 / XCircle）+ shadcn Badge variant
- **单色调** neutral（shadcn New York 主题，base color = neutral）
- **中文字体**：layout.tsx 加 Geist + Noto Sans SC fallback
- **响应式**：≥ 1024px 笔记本优先；max-w-5xl 居中
- **状态色彩**：done/running = neutral，warn = outline + AlertTriangle，failed = destructive

---

## 项目结构

```
ui/
├── app/
│   ├── layout.tsx              # 全局 layout + Geist 字体
│   ├── globals.css             # Tailwind + shadcn 主题变量（neutral）
│   ├── page.tsx                # / L1
│   ├── hub/page.tsx            # /hub L2
│   ├── node/toy/page.tsx       # /node/toy L3
│   ├── node/plan/page.tsx      # /node/plan L3
│   ├── node/qa/page.tsx        # /node/qa L3
│   └── node/shot/[id]/page.tsx # /node/shot/shot_01 ~ shot_06
├── components/
│   ├── ui/                     # shadcn primitives（手写，未走 dlx）
│   ├── l1/                     # episode-card / episode-list / upload-dialog / status-badge / progress-pipeline / system-health-panel
│   ├── l2/                     # node-grid
│   └── l3/                     # artifact-panel / materials-badges / eval-attribution-panel / decision-trace-panel / feedback-dialog / rerun-panel / node-metrics-bar / console-header
├── lib/
│   ├── types.ts                # 全部 TS 类型（Episode / Node / Artifact / Material / DT / EA / Feedback）
│   ├── mock.ts                 # 完整 mock 数据
│   └── utils.ts                # cn()
└── README.md
```

---

## 跟设计文档的对应

| UI 元素 | 文档来源 |
|--------|---------|
| L1 7 纪律 | `docs/ADRs/025.md` + `docs/_future/business-console.md` §1 |
| L1 整页布局 | `docs/_future/business-console.md` §2.1 |
| L1 上传 Dialog 6 步 | `docs/_future/business-console.md` §2.2 |
| L2 节点卡 | `docs/00-glossary.md` UI 表 + `docs/06-ui-spec.md` §0 |
| L3 ToyNode 6 件套 | `docs/06-ui-spec.md` §2.1 |
| L3 反馈 Dialog 字段 | `docs/06-ui-spec.md` §2.2 + `docs/reference/schemas.md` Feedback |
| L3 物料 diff Dialog | `docs/06-ui-spec.md` §2.3 |
| Materials 5 类 + tag | `docs/00-glossary.md` 物料 5 类 + `docs/reference/schemas.md` Materials Tag |
| Decision Trace 5 字段 | `docs/reference/schemas.md` Decision Trace |
| Eval Attribution 字段 | `docs/reference/schemas.md` Eval Attribution |
| Plan 4 步链 | `docs/_future/business-design.md` §3 |
| Plan Artifact schema | `docs/_future/business-design.md` §3.3 |
| ShotExecutionNode 3 步链 | `docs/_future/business-design.md` §4.3 |
| ShotArtifact schema | `docs/_future/business-design.md` §4.4 |
| Episode QA 5 维度 | `docs/_future/business-design.md` §2.2 + §10 |

---

## 已知推断（文档没明说，我合理选定的）

1. **L1 Episode 状态推进 cadence**：文档说"轮询 `traces/episodes/<id>/status.yaml`"，未给频率。我选 `setInterval(2500ms)` —— 看上去够实时但不闪。
2. **L1 上传 Dialog phase 时长**：文档说 lint + register + commit + trigger。我用两段 1.5s 模拟 lint / register，最后立即插入 running Episode（验收时间感舒服 ≤ 4s）。
3. **L2 节点 `pass_rate_7d` 字段**：文档没列。我加上作为 alive 指示的辅助信号——L2 立场是"运维视角"，pass rate 比 alive bool 更有信息密度。
4. **L3 Decision Trace `prompt_template_id` 即 ToyNode 的物料 id**：文档说"物料文件 + 版本号"，我直接复用 `prompts/toy/extract@v1.0` 这种形式。
5. **L3 物料 diff Dialog 内容**：文档说"显示 content + 历史版本 + edit 跳 vim"。我做了 mock preview 文本，没接真实 git 历史（原型嘛）。
6. **Shot Console 三件套展示**：文档没给 ASCII。我选 text = 纯文本框 / text_tts = 等宽字体 / notes = 表格（kind / duration / visual / cues），跟 §4.4 schema 字段一一对应。
7. **QA 跳转链接**：文档说"跳回 plan / shot"，没说 plan 链接是否带 `?artifact=` query。我加了 query param 保持跟 L1 → L3 同协议。
8. **QA artifact 演示用 `ml_knn_e02a`**：L1 warn 卡用的 episode，跳过来直接看 fail ×2 case。

---

## 不实现的（明确排除）

- 真 CLI subprocess 调用 → 全 mock，setTimeout
- Langfuse / git history → 不接
- 持久化（DB / localStorage）→ 没有
- 用户认证 / 多人协作 → 单机原型
- 复杂动效 → shadcn primitive 默认就够
- Tailwind v4 → 选 v3，shadcn 生态成熟稳

---

## 立场总结

跑通这 6 个路由 = 验证 doc-maker UI 3 层解耦设计**视觉上行得通**：

- L1 Episode 卡片 4 态确实能传达"上传 → 跑 → 接受/重跑"全流程，业务使用者不用懂节点
- L2 Hub 真的是 ≤ 50 行级别的极简密度，看完就跳 L3，没有"全局仪表盘"诱惑
- L3 6 件套在同一页（不需要 tab / 跳页）确实塞得下，作者一屏认知减压
- 跨层跳转协议一致（query param）—— 没有中央路由也能工作

如果验收时发现"我看 L1 想知道某节点详情" → 那就是没走完"出问题才进 L3"的纪律 #3，UI 自己暴露了立场漏洞，回头改文档不改 UI。
