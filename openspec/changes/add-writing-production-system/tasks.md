## 1. 产品文档重定位

- [x] 1.1 更新 `doc-maker/docs/business-console.md`，把当前主线从 Episode 文档包工作台改为 Writing Job 文本生产系统。
- [x] 1.2 更新 `doc-maker/ui/README.md`，声明新路由/组件的产品契约：Job Spec、Precheck、Eval、Skill lifecycle。
- [x] 1.3 更新 `doc-maker/docs/07-acceptance.md`，增加 Writing Job / Precheck / Eval / Skill 发布的验收基线。
- [x] 1.4 新增 ADR 或 addendum，记录从 doc package generator 调整为 writing production system。

## 2. UI 信息架构

- [x] 2.1 将 L1 首页从 Episode 列表改为 Writing Job 工作台。
- [x] 2.2 增加 Job Spec 创建区，支持目标、底稿、写法参考、评审偏好四类输入。
- [x] 2.3 增加 Precheck 结果区，展示 Content Brief、Writing Skill Candidate、Eval Profile、Risk List。
- [x] 2.4 在 Precheck 结果中提示“已自动生成本轮评分标准”，并允许展开查看规则。

## 3. 生成与评估闭环

- [x] 3.1 增加多篇候选 Draft mock 数据，展示标题、摘要、正文片段、自动评分。
- [x] 3.2 展示 Eval Profile 的 score breakdown：基础质量、任务匹配、风格偏好、风险扣分。
- [x] 3.3 增加选中文本轻反馈，并让反馈进入 Feedback Ledger / Rule Patch，不直接覆盖旧候选或已发布 skill。
- [x] 3.4 增加 Rule Patch 草稿池上限与 Rule Snapshot active rules 上限。
- [x] 3.5 展示相似表达和事实漂移风险，避免“仿写”被误解为复制句子。

## 4. Writing Skill 生命周期

- [x] 4.1 展示 Writing Skill Candidate 当前版本、来源、适用范围、禁忌和检查表。
- [x] 4.2 增加 Skill 状态说明：candidate / ready-to-publish / published / blocked。
- [x] 4.3 明确当前 baseline 不发布 Published Skill，只保留 Candidate / Rule Snapshot 闭环。
- [x] 4.4 明确技术导出（Codex/Claude `SKILL.md`）是高级动作，不出现在普通流程里。

## 5. 验证

- [x] 5.1 运行 `openspec validate add-writing-production-system`。
- [x] 5.2 在 `doc-maker/ui` 运行 `pnpm typecheck`。
- [x] 5.3 在 `doc-maker/ui` 运行 `pnpm build`。
- [x] 5.4 浏览器检查首页：用户能看懂输入什么、Precheck 产出什么、为什么 Eval Profile 第一轮不为空。

## 6. 抽象上移兼容

- [x] 6.1 明确“源材料生成结构化讲解文档包”不是删除，而是默认 `Output Profile`。
- [x] 6.2 在首页 Job Spec 中展示 `structured explanation package` 输出档案。
- [x] 6.3 在 OpenSpec / ADR / README / 验收文档中去掉“砍掉旧设计”的误读空间。
