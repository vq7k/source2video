## 为什么

UI mock 暴露出真实路线变化：当前最有学习价值和产品价值的主线，已经从单纯的 framework/ToyNode MVP 转向业务侧 doc-maker 体验。需要补上文档先行的产品契约，让现有完整 UI mock 可以继续推进，而不是继续被过期的“framework-first”假设隐式牵引。

## 产品定位

doc-maker 是把一组源材料转换成可审阅、可追溯、可迭代的结构化讲解文档包的生成工作台。

首个落地场景是讲解型内容，首版文档包为：`plan / scripts / shots / visual_spec / qa_report`。产品能力保持通用，不锁死在单一业务域。

## 变更内容

- 将业务侧产品原型提升为明确的当前工作流。
- 将 UI 原型重新定义为“源材料 → 结构化讲解文档包”的产品发现面，而不是“framework MVP 已完成”的证据。
- 定义以 Episode 为中心的 Business Console 契约：上传、运行状态、warn/fail 处理、接受/重跑、产出查看。
- 定义业务 UI 与框架诊断层的边界：产品默认界面不得泄漏 Materials、Decision Trace、Eval Attribution、rubric 或跨仓实现细节。
- 在真实 backend artifact 存在之前，将 Plan/Shot/QA 页面标记为诊断/故事板界面，不能暗示生产可用。
- **BREAKING**：现有写着 “L1/Plan/Shot/QA 第二轮才做” 的文档必须修订，或明确标注为历史 framework-first 规划。

## 能力

### 新增能力

- `business-console`：以 Episode 为中心的业务产品流程，覆盖 source 上传、运行状态、用户决策和产出查看。
- `diagnostic-handoff`：从业务界面受控跳转到框架/节点诊断界面，且默认产品体验不泄漏内部细节。

### 修改能力

- 无。当前还没有既有 OpenSpec capability。

## 影响范围

- 受影响文档：`doc-maker/docs/07-acceptance.md`、`doc-maker/docs/06-ui-spec.md`、`doc-maker/docs/_future/business-console.md`、ADR-021/025/026 相关引用、`doc-maker/ui/README.md`。
- 受影响 UI：`doc-maker/ui/app/page.tsx`、L1 Episode 卡片、上传弹窗、产出查看页、系统健康区、L2/L3 路由可见性、mock 数据语义。
- 受影响产品决策：当前 MVP scope、业务原型中 “done” 的定义、产品原型/诊断原型/框架实现之间的边界。
