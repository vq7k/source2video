## Why

当前首页已经说明产品定位，但仍是静态 mock。下一步需要让用户能实际编辑 Job Spec、选择 Output Profile、触发 Precheck，并在确认 Precheck 后才看到候选生成结果，从而验证核心操作路径是否符合产品本质。

## What Changes

- 将 L1 首页从静态展示改为可操作的 Writing Job 流程 mock。
- Job Spec 四类输入变为可编辑字段，用户修改后 Precheck 状态回到待运行。
- Output Profile 在创建区显式展示，默认保留 `structured explanation package`。
- 增加 `Run Precheck` / `Confirm Precheck` 状态流：未 Precheck 时不展示候选 Draft，确认后才展示批量候选与打分。
- 保持本轮不接真实 LLM、不持久化、不引入后端 API。

## Capabilities

### New Capabilities

- `interactive-writing-job-flow`: 定义 Writing Job 创建、Output Profile 选择、Precheck 运行、Precheck 确认、候选 Draft 展示之间的前端状态契约。

### Modified Capabilities

- 无。当前仓库没有已归档主规格；本 change 在 UI mock 层补足交互契约。

## Impact

- 受影响 UI：`doc-maker/ui/app/page.tsx`。
- 受影响文档：`doc-maker/ui/README.md` 和当前 change 任务。
- 不影响 L2/L3 诊断页、旧 Episode viewer、真实生成执行链。
