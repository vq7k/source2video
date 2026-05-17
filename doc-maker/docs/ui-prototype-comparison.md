# UI 原型对比：工作台交互设计原则

## 范围

参考原型：

- `/Users/xuelin/projects/agent-lab/prototypes/agent-console.html`
- `/Users/xuelin/projects/agent-lab/prototypes/chat-flow.html`
- `/Users/xuelin/projects/agent-lab/prototypes/radar-ui-v2.html`

当前对比对象：

- `doc-maker/ui/app/page.tsx`
- `doc-maker/ui/components/writing-production/linear-shell.tsx`

## 原型阅读

| 原型 | 核心布局 | 可借鉴模式 | 局限 |
| --- | --- | --- | --- |
| `agent-console.html` | nav rail + run list + 执行/chat 区 | execution trace 以连续 tool card 嵌入主流程 | 对高密度 Job 评审过于简单 |
| `chat-flow.html` | 52px rail + 可拖拽列表 + 内容区 + trace drawer | 最接近工作台：对象列表、当前对象、上下文 trace、command palette、宽度记忆 | 领域是 item/chat，需要映射到 writing job |
| `radar-ui-v2.html` | app nav + topbar + inbox cards + bottom chat + trace panel | 页面级 IA 清晰：Inbox/Runs/Sources/Settings 和运行视图 | 卡片网格不适合长文生产 |

## 当前实现差距

| 区域 | 当前状态 | 差距 |
| --- | --- | --- |
| 折叠侧栏 | 竖排 `JOBS` 文本 rail | 折叠态应该是紧凑切换器：缩略图、tab 或列表，而不是装饰性标签 |
| 宽度模型 | 中间区域占比过强；左右栏空间不足时被压缩 | 宽度应由任务上下文决定：列表/编辑可读性优先，空间足够时保留侧栏 |
| 导航层级 | Jobs list、editor、inspector 在同一平面竞争 | 应遵循 rail -> 对象列表 -> 当前对象 -> 上下文 lens |
| trace/eval 可见性 | Inspector / framework detail 容易脱离业务对象 | trace/eval 应从选中的业务对象进入，并自动带入查询上下文 |
| 长内容展示 | 列表和 inspector 已拆分，但缺少稳定阅读区契约 | 生成长文需要 master-detail 阅读区，不适合卡片堆叠 |
| 拖拽行为 | 已有 resizable panels，但没有稳定的工作台宽度记忆 | 列宽应该明确、可拖拽、可持久化 |

## 设计原则

1. 折叠 rail 仍然是导航。
   52px rail 应暴露主要视图的紧凑 tab、icon 或 count，不应只显示竖排文本。

2. 产品应使用 master-detail，而不是 dashboard cards。
   Writing Job 是长文工作对象。默认结构应是：Job/status list -> selected job workspace -> contextual feedback/eval lens。

3. 可观测信息默认上下文化，除非用户进入诊断模式。
   Langfuse/framework 数据应该能从 job、candidate、precheck、eval node 进入，并预填上下文。全局 viewer 只能作为次级 diagnostics lens。

4. 宽度是带约束的用户偏好。
   桌面端：rail + resizable list + flexible work area + optional right lens。窄屏：rail 保留，侧栏以 overlay 打开。不出现假拖拽把手。

5. 长文本需要稳定阅读契约。
   Candidate text 应放在稳定阅读 pane 中，内部滚动，配合版本切换和局部反馈操作。反馈标签和 eval 详情进入侧栏或底部 lens，不要把卡片越撑越长。

6. 高密度工作台需要 command 和 filters。
   filter、count、keyboard navigation、command palette 能减少鼠标操作，比装饰性卡片更有价值。

## 推荐方向

以 `chat-flow.html` 作为主参考。它已经具备最接近 doc-marker 的工作台结构：

- object rail
- resizable list column
- active object detail
- trace drawer
- command/search workflow
- keyboard navigation

`radar-ui-v2.html` 只借鉴页面级 IA：Sources、Runs、Settings、Attention-like monitoring。

`agent-console.html` 只借鉴执行步骤展示：tool card、status dot、latency、compact run history。

## 外部设计实践交叉验证

| 来源 | 相关原则 | doc-marker 决策 |
| --- | --- | --- |
| Apple HIG: Split Views | Split view 用于多层级内容；选中项需要保持高亮；pane 要有合理 min/max；紧凑宽度不应强行并排导致不可读。 | 保留 master-detail，但 compact mode 使用 overlay，不把完整 pane 挤进 56px。 |
| Microsoft Fluent: NavigationView | Navigation 根据宽度在 expanded pane、compact icon pane、overlay pane 之间切换；compact pane 仍然包含导航项，不是装饰标签。 | 折叠侧栏应变为 job-view tabs/icons/counts，不显示竖排 `JOBS`。 |
| Atlassian Design System: Grid / Aside | Side navigation 和 aside 是明确布局区域；常见宽度包括 56px collapsed、320px 默认 side nav、320-504px aside；内容区围绕这些区域响应式变化。 | 定义显式区域契约：rail 56、list 280-360、inspector 320-504、main editor 弹性伸缩，并持久化用户宽度。 |
| Android / Material responsive navigation | 导航组件随窗口宽度变化：compact、rail、drawer；选择取决于宽度和导航项数量。 | 在 in-app browser 窄宽度下使用 rail + overlay；只有空间足够时才使用常驻侧栏。 |
| WAI-ARIA APG Tabs | Tabs 需要 tablist/tab/tabpanel 语义、selected 状态、方向键导航和合理 focus movement。 | 如果折叠侧栏做成垂直 tabs，必须实现真实 tab/button 语义、active state 和键盘行为。 |
| Atlassian navigation redesign | 导航复杂度应收敛到可复用 primitives；用户需要自定义、常用项、可发现的 collapse，以及一致的 item actions。 | 不做一次性 sidebar 状态。应沉淀可复用 WorkbenchShell：rail item、list pane、content pane、contextual lens。 |

资料链接：

- Apple HIG Split Views: https://developer.apple.com/design/human-interface-guidelines/split-views
- Microsoft NavigationView: https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/navigationview
- Atlassian Grid / Side navigation and aside: https://atlassian.design/foundations/grid-beta/
- Android responsive navigation: https://developer.android.com/develop/ui/views/layout/build-responsive-navigation
- WAI-ARIA Tabs Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- Atlassian navigation redesign: https://www.atlassian.com/blog/design/designing-atlassians-new-navigation

## 交叉验证后的设计规则

1. Rail 是紧凑导航面板，不是最小化标签。
   它必须暴露主要 destination 和当前状态，可使用 icon、短标签、count、tooltip。

2. Pane 必须有契约。
   每个 pane 都要定义 role、default width、min width、max width、collapse behavior、persistence behavior。否则 resizable layout 会不可预测。

3. Compact mode 是另一种布局，不是损坏的桌面布局。
   低于最小可用宽度时，侧栏应作为 overlay 或 drawer 打开；如果中间内容不可读，就不应该继续并排。

4. 主内容不总是最宽区域。
   当前任务决定空间分配。Job list mode 优先列表密度；editor mode 优先阅读/编辑；diagnostics mode 优先 trace/eval 详情。

5. Observability 保持上下文化。
   trace/eval/log 数据应从业务 node 进入，并预填 run/candidate/node 上下文。全局 viewer 可以存在，但只能作为高级诊断视图。

6. 不复制产品视觉。
   借鉴的是结构模式：rail/list/detail/lens、adaptive pane modes、persisted widths、keyboardable tabs。视觉语言仍应保持 doc-marker 自身特点：克制、文本优先、服务长文生产。

## 近期 UI 重构目标

1. 将折叠 `JOBS` rail 改为紧凑 job-view tabs：All、Drafts、Precheck、Review、Feedback、Finalized。
2. 持久化 sidebar/list/inspector 宽度。
3. 中间区域改为自适应，而不是固定占据主导比例。
4. eval/trace 详情改为从 selected job/candidate/node 打开的 contextual lens。
5. 统一长 candidate 阅读模式：version nav + scroll reading pane + feedback lens。
