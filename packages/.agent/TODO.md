# TODO

## 当前 in-progress

- [ ] 等待 Orchestrator review Store Lane Task 2/3 / 派发下一步

## 下一候选

- [ ] Task 4: Add Artifact Store Abstraction
- [ ] Task 5: Implement Postgres Job Queue

## 质量门禁

- [x] Task 0 topology contract test 先红后绿
- [x] 禁止 framework schema / package API 出现业务域命名
- [x] 修改跨 package exports 后运行相关 typecheck / unit tests
- [x] Task 1 contract test 先红后绿
- [x] framework-store public API 不出现 `writing_*` / doc-maker 命名
- [x] Task 2 migration test 先红后绿
- [x] Task 3 repository CRUD test 先红后绿
