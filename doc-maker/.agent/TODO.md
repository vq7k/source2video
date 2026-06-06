# TODO

## 当前 in-progress

- [ ] 无，等待 Orchestrator 派发下一项（Task 8B 已完成，commit c91b5f0）

## 下一候选

- [ ] Task 8C：真实 PG migration + dataset draft 端到端连通验证 + standalone/部署接线（注意 pg 打包/trace root 实证，见 STATUS）
- [ ] 将 Writing JSON run/rule stores 包装为 framework contracts 的 adapter
- [ ] 为 `/writing` 与 `/framework` 的业务链路补 adapter-level regression tests

## 质量门禁

- [ ] 不把 `writing_*` 命名写入 framework schema
- [ ] UI 状态必须对应真实 run / trace / score / feedback 数据
- [ ] 业务规则复用链路必须能从一次人工标注追到 rule 或 dataset item
