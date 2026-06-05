# TODO

## 当前 in-progress

- [ ] 等待 Orchestrator review Task 1 commit / 派发 Task 2

## 下一候选

- [ ] Task 2: Add Postgres Migrations
- [ ] 对齐 `doc-maker` 对 framework public exports 的 adapter 接入方式

## 质量门禁

- [x] Task 0 topology contract test 先红后绿
- [x] 禁止 framework schema / package API 出现业务域命名
- [x] 修改跨 package exports 后运行相关 typecheck / unit tests
- [x] Task 1 contract test 先红后绿
- [x] framework-store public API 不出现 `writing_*` / doc-maker 命名
