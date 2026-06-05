# TODO

## 当前 in-progress

无。等待 Orchestrator 派活。

## 下一候选

- [ ] 将 Writing JSON run/rule stores 包装为 framework contracts 的 adapter
- [ ] 把人工反馈沉淀为 rule package draft / dataset draft 的业务事件
- [ ] 为 `/writing` 与 `/framework` 的业务链路补 adapter-level regression tests

## 质量门禁

- [ ] 不把 `writing_*` 命名写入 framework schema
- [ ] UI 状态必须对应真实 run / trace / score / feedback 数据
- [ ] 业务规则复用链路必须能从一次人工标注追到 rule 或 dataset item
