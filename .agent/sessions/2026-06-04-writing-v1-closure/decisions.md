# Decisions

## D1: v1 闭环只声明主路径，不声明完整 Writing Production 全部 backlog

- **决定**：`07-acceptance.md` 增加 v1 闭环 DoD，完整 36 条保留为 v1 后 backlog。
- **原因**：当前 `/writing` 已能完成生成、反馈迭代、定稿、Rule Package 发布和观测；但 A/B 对照、dataset draft、完整发布治理等仍不应被冒充为已完成。

## D2: Rule Package 沉淀放进 `/writing`，不是要求用户进入 `/overview`

- **决定**：定稿后在 `/writing` 展示“规则包沉淀”，支持生成草稿和发布。
- **原因**：v1 主路径必须从默认入口完成闭环；`/overview` 保留为完整工作台/运营台。

## D3: trace 深链必须有可见命中条

- **决定**：`/framework?traceId=` 增加 “Trace 已定位” 状态条，展示 trace id、节点类型和 ScoreSink 状态。
- **原因**：只在右侧 call card 展示 trace 容易被布局/滚动遮住，测试和人工验收都需要稳定可见证据。

## D4: `/writing` 观测入口定位当前推荐候选的 eval trace

- **决定**：`/writing` 的“观测”链接不只传 `runId`，同时传 `candidateId / nodeRunId / traceId / returnTo`。
- **原因**：L1 用户点击观测时要看到当前候选的评分证据；返回 L1 时也必须恢复当前主题，避免观测动作打断主流程。
