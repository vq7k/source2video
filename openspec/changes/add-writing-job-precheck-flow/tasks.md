## 1. UI Flow State

- [x] 1.1 将 `doc-maker/ui/app/page.tsx` 改为 client-side workbench。
- [x] 1.2 让 Job Spec 四类输入可编辑，并在编辑后回到 `needs-precheck`。
- [x] 1.3 在创建区保留并展示默认 Output Profile。

## 2. Precheck Gate

- [x] 2.1 实现 `Run Precheck` 将状态切到 `precheck-ready`。
- [x] 2.2 实现 `Confirm Precheck` 将状态切到 `confirmed`。
- [x] 2.3 Candidate Drafts 在确认前显示等待态，确认后展示多篇候选。

## 3. Product Copy

- [x] 3.1 Precheck 的 Content Brief 文案引用当前 Job Spec 和 Output Profile。
- [x] 3.2 UI README 增加交互状态说明。

## 4. 验证

- [x] 4.1 运行 `openspec validate add-writing-job-precheck-flow`。
- [x] 4.2 在 `doc-maker/ui` 运行 `pnpm typecheck`。
- [x] 4.3 在 `doc-maker/ui` 运行 `pnpm build`。
- [x] 4.4 浏览器检查：初始待 Precheck，Run Precheck 后可确认，Confirm 后出现 Candidate Drafts；编辑回待 Precheck 由 `updateSpec` 路径覆盖。
