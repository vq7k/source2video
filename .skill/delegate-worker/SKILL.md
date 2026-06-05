# skill: delegate-worker

> source2video 持久 Agent team 的任务委派规则。

## 何时用

当 Orchestrator 要把持续领域任务交给常驻 Worker 时使用。常驻 Worker 必须有独立 cwd。当前常驻 Worker：

| Worker | 启动 cwd | 状态目录 | 领域 |
|---|---|---|---|
| FrameworkWorker | `packages/` | `packages/.agent/` | root `packages/` 下 framework contracts/store/runtime/observability/artifact |
| WritingWorker | `doc-maker/` | `doc-maker/.agent/` | Writing UI/domain/adapter |

## 临时 SubAgent

以下横切职责不建常驻 Worker，因为它们共享仓库根 cwd，违反 cwd 唯一定位角色：

| 范围 | 方式 |
|---|---|
| Infra / Deploy / Cloud | Orchestrator 临时派发，产出回写根 `.agent/sessions/` |
| QA / Migration / Release Gate | Orchestrator 临时派发，产出回写根 `.agent/sessions/` |

## 委派步骤

1. **确认 owner 唯一**：任务只能有一个主 Worker；跨域协作写清依赖。
2. **写入 Worker 状态目录**：
   - 更新 `<worker>/STATUS.md` 的 `当前 actionable`
   - 更新 `<worker>/TODO.md` 的 `当前 in-progress`
   - 复杂任务新建 `<worker>/sessions/YYYY-MM-DD-topic/handoff.md`
3. **写清边界**：
   - 可写路径
   - 禁止路径
   - 需要 Orchestrator/user 拍板的动作
4. **写清验证**：
   - 必跑命令
   - 期望结果
   - 失败时回报格式
5. **写清回报格式**：
   - changed files
   - commands/results
   - risks
   - next actionable

## 禁止

- 不把候选任务当作已派发任务。
- 不让 Worker 猜上下文；必须给 handoff 文件或 STATUS 明确任务。
- 不让 Orchestrator 长期直接写 Worker 领域代码。
- 不让 Worker 修改外部 repo 或线上不可逆资源，除非 user explicit 拍板。
- 不把横切职责伪装成常驻 Worker。
