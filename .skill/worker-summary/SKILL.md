# skill: worker-summary

> source2video 常驻 Worker 回报协议。

## 何时用

FrameworkWorker / WritingWorker 完成被 Orchestrator 派发的任务后使用。

## 回报格式

```markdown
## <Worker> Summary

- Branch:
- Commit:
- Changed files:
- Commands:
- Result:
- Risks:
- Next actionable:
```

## 状态回写

- Worker 更新自己 cwd 下 `.agent/STATUS.md` / `.agent/TODO.md`
- 复杂任务写自己 cwd 下 `.agent/sessions/<YYYY-MM-DD>-<topic>/`
- Orchestrator 验收后更新根 `.agent/STATUS.md` / `.agent/TODO.md`
