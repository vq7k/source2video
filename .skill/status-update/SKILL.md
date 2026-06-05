# skill: status-update

更新 `.agents/STATUS.md`。

## 何时用

完成一段工作后，session 结束前。让下一次 session 能仅靠这个文件 catch up。

## STATUS.md 字段（宿主命名优先，至少 4 段）

```markdown
# STATUS

## 当前 actionable（catch-up 强制读这段判 ready 与否）
[一句话：现在你要做什么 / 谁该接 / 入口在哪。
如果当前真的无任务待办（milestone 已闭环，等下一步规划），明示写
"**无明示 actionable，等 user 拍板下一步**" — agent 看到这行**必须升级 user 问**，不允许自己默认 "关 session" 或自创任务。]

## 当前阶段
[一句话：当前在哪个 milestone / 范围]

## 最近一次 session
[日期 + 主题 + 做了什么 + 归档路径 .agents/sessions/<date>-<topic>/]

## 阻塞
[当前阻塞清单；无阻塞写"无"]

[可选] ## 下一步（actionable 的展开 / 候选）
[展开"当前 actionable"的具体动作 + 入口；或列候选让 user 拍板。若已有 TODO/引用段承载，可不强制新增。]
```

**关键区分**：
- "**当前 actionable**" = catch-up 后**立刻能开干**的下一步（必须明示，否则触发升级）
- "**下一步**" = actionable 的展开 / 多个候选 / 长期路线 — 容许模糊

## 步骤

1. 打开 `.agents/STATUS.md`
2. 替换上一次内容（不要堆历史，历史在 `sessions/`）
3. 至少保留 4 个 `##` 分段，并确保含 `当前 actionable` 或等价 readiness 锚点
4. commit message 写明 STATUS 更新原因

## 反例（不要这样写）

- ❌ "未启动" / "进行中" — 信息密度太低
- ❌ 长篇叙事 — STATUS 是状态快照不是日志，日志写到 `sessions/<date>-<topic>/outputs.md`
- ❌ 引用对话历史 — 下一 session 没有对话历史

## 校验

`grep -cE '^## ' .agents/STATUS.md` 应 ≥ 4，且 `当前 actionable` 段能让下个 agent 判断是否可开干。
