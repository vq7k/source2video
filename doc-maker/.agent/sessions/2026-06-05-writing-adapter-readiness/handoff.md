# WritingWorker Handoff — Writing Adapter Readiness

## 任务身份

你是 **WritingWorker**，启动 cwd 必须是 `doc-maker/`。

本任务可以与 FrameworkWorker Task 1 并行，但不能修改 root `packages/`，也不能提前实现未冻结的 framework API。

## 背景

FrameworkWorker 正在定义 generic persistence contracts。Writing 是第一个业务 adapter，需要准备好把现有 JSON run/rule/feedback 数据映射到 generic framework concepts。

## 目标

完成 adapter readiness：

1. 盘点 Writing 当前 run/rule/feedback 数据结构
2. 形成 mapping：Writing record -> generic run/artifact/feedback/dataset draft
3. 补最小 adapter-level regression test 草案或只读测试，证明现有数据可被映射，不要求接入 root `packages/` 新 contracts
4. 回报 FrameworkWorker Task 1 需要暴露哪些 public contract，不能要求 framework 出现 Writing 命名

## 可写

- `doc-maker/.agent/STATUS.md`
- `doc-maker/.agent/TODO.md`
- `doc-maker/.agent/sessions/2026-06-05-writing-adapter-readiness/**`
- `doc-maker/packages/writing-domain/**`（仅 mapping helper / tests；不要改核心 runtime 行为）
- `doc-maker/ui/tests/runtime/**`（adapter readiness test）
- `doc-maker/docs/**`（如需要记录 adapter mapping）

## 禁止

- 不改 root `packages/**`
- 不改 framework contracts/schema
- 不引入 `writing_*` framework table/schema 命名
- 不改 UI 交互/页面文案
- 不做部署/线上资源

## 建议检查入口

```bash
rg -n 'RunRecord|WritingRun|feedback|rule package|RulePackage|dataset' packages/writing-domain ui/tests docs
```

## 必跑验证

按实际改动选择最小命令，至少：

```bash
cd ui
pnpm exec vitest run tests/runtime/trace-status.test.ts
pnpm test
```

如果新增 readiness test，只跑对应测试并在回报里写明。

## 回报格式

```markdown
## WritingWorker Summary

- Branch:
- Commit or no-commit:
- Mapping:
- Changed files:
- Commands:
- Risks:
- Needs from FrameworkWorker:
```
