# skill: delegate-worker

主理角色（Orchestrator）→ Worker 委派。**第一次裂变出常驻 Worker 时才启用**（见 §裂变阶梯，二元：Worker / 不裂）。
> 下面「SubAgent 调用」是主理的**运行时委派手段**（用 `Agent`/Task tool、明确不立角色），不是架构角色档——别写进 PROJECT/SOUL。

## 委派前必做 3 件事
1. 更新 `<worker>/.agent/TODO.md`（任务 actionable 且**足够上下文**，Worker 不必回问）
2. **不超出 Worker 边界**（对照其 SOUL「我做 / 边界」）
3. 决策追溯（委派决定记入主理 session 归档）

## 两种委派方式
| 方式 | 用于 | 怎么做 |
|---|---|---|
| 手动 session | 长任务 / 持续领域 | `cd <worker>/` 启动 Worker session |
| SubAgent 调用 | 短任务 / 一次性 | `Agent` tool 派 SubAgent，给完整 prompt，跑完即弃（**不立角色**） |

## 委派后
等 Worker return summary（见 `worker-summary`）→ catch up 归档 → 按需独立 review。

## 失败模式（反例）
- ❌ TODO 上下文不足，Worker 反复回问
- ❌ 委派超出 Worker 边界的活
- ❌ 一次性小任务也立常驻 Worker（应走 SubAgent）
