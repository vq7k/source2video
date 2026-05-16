## 1. 文档基线重置

- [x] 1.1 更新 `doc-maker/ui/README.md`，将每个 route 标注为产品契约、诊断故事板或 mock-only。
- [x] 1.2 更新 `doc-maker/docs/07-acceptance.md`，区分 business prototype 验收与 framework ToyNode MVP 验收。
- [x] 1.3 更新 `doc-maker/docs/06-ui-spec.md`，保留 L2/L3 诊断指导，同时将当前产品工作指向 Business Console 文档。
- [x] 1.4 将 `doc-maker/docs/_future/business-console.md` 移入当前文档，或明确标注为已从 future planning 提升到当前主线。
- [x] 1.5 增加一个简短 ADR 或 ADR addendum，记录从 framework-first MVP 切到 business prototype 工作流的路线变化。

## 2. L1 产品状态模型

- [x] 2.1 更新 mock Episode 数据，使 `done` 和可接受的 `warn` 状态始终包含 output links。
- [x] 2.2 修复 `接受并继续`，确保它不能创建缺少 scripts、shots、QA report outputs 的 `done` Episode。
- [x] 2.3 对 Bounded Budget failure，用 escalation/diagnostic handoff 状态替换通用 failed-state rerun。
- [x] 2.4 修正 running progress，确保 shot 和 QA 阶段不会在上游阶段完成前推进。
- [x] 2.5 移除或显式禁用假的 L1 affordances，例如无行为的设置、刷新、新建 Episode、完整查看控件。

## 3. Upload 与 Rerun 流程

- [x] 3.1 增加 lint failure、register failure、commit failure 和 run trigger failure 的 mock upload 失败状态。
- [x] 3.2 让 upload UI 使用真实 file input，或将当前文件选择器标注为 storyboard-only。
- [x] 3.3 用业务可读文案展示 git-thin command progress，避免暴露不必要的框架内部细节。
- [x] 3.4 确保 upload 失败时不会向列表插入 running Episode。

## 4. 业务产出边界

- [x] 4.1 从 L1 cards、system health 和 output viewer 默认界面移除 Materials version 展示。
- [x] 4.2 移除 cross-repo JSON 和 `pipeline_io` 细节，或将其 gate 到显式 diagnostics action 后面。
- [x] 4.3 重写 QA output viewer 文案，让 warnings 具备业务可行动性，且不要求用户理解 rubric/framework。
- [x] 4.4 保持 done Episode outputs 为人类可读的 scripts、shots、QA report，并默认不展示 node console links。

## 5. Diagnostic Handoff

- [x] 5.1 为 Plan、Shot、QA 以及任何没有真实 artifacts 支撑的诊断页增加清晰的 mock/storyboard readiness badge。
- [x] 5.2 修改诊断页：存在 `?artifact=` 时必须尊重该参数，或明确说明 artifact resolver 尚未实现。
- [x] 5.3 将 L2 Hub 限制为导航和粗粒度 readiness；移除跨节点 pass-rate/material analytics，除非另行提出 analytics capability。
- [x] 5.4 更新 diagnostic rerun 和 feedback panels，让它们预览 CLI/git-backed actions，且不静默修改 product state。

## 6. 验证

- [x] 6.1 运行 `openspec validate promote-business-prototype`，修复任何 proposal/spec/task schema 问题。
- [x] 6.2 在 `doc-maker/ui` 运行 `pnpm typecheck`。
- [x] 6.3 在 `doc-maker/ui` 运行 `pnpm build`；如果 Google Fonts/network blocker 仍存在，则记录为已知阻塞。
- [x] 6.4 手动检查 L1 happy path、warn accept path、failed Bounded Budget path、upload failure path 和 output viewer boundary。
