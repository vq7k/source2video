# TODO

## 当前 in-progress

- [ ] 无，等待 Orchestrator 派发下一项（Task 8B + dataset confirmation closure 已完成）

## 下一候选

- [ ] 生产 data plane 启用：配 `FRAMEWORK_DATABASE_URL` + migration + 线上 dataset route 验收
- [ ] 将 Writing JSON run/rule stores 包装为 framework contracts 的 adapter
- [ ] 为 `/writing` 与 `/framework` 的业务链路补 adapter-level regression tests

## 质量门禁

- [ ] 不把 `writing_*` 命名写入 framework schema
- [ ] UI 状态必须对应真实 run / trace / score / feedback 数据
- [ ] 业务规则复用链路必须能从一次人工标注追到 rule 或 dataset item
