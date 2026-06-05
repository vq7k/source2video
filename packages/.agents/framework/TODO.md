# TODO

## 当前 in-progress

无。等待 Orchestrator 派活。

## 下一候选

- [ ] Task 0: Package Topology Split，把通用 framework packages 固定在仓库根 `packages/`
- [ ] Task 1: Define Generic Persistence Contracts
- [ ] 对齐 `doc-maker` 对 framework public exports 的 adapter 接入方式

## 质量门禁

- [ ] contract tests 先红后绿
- [ ] 禁止 framework schema / package API 出现业务域命名
- [ ] 修改跨 package exports 后运行相关 typecheck / unit tests
