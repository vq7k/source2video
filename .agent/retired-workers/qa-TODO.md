# TODO

## 当前 in-progress

无。等待 Orchestrator 派活。

## 下一候选

- [ ] 定义 framework data plane 本地测试矩阵：unit / integration / e2e / migration / backup-restore
- [ ] 为 Postgres SOT schema 写 migration 验收用例
- [ ] 为 job retry/lease 与 artifact offload 写可重复测试
- [ ] 定义 release gate：dataset、experiment、score threshold、人工审批证据

## 质量门禁

- [ ] PASS 必须附命令与结果
- [ ] 涉及数据迁移必须有 rollback 或 restore 路径
- [ ] 线上验收必须同时覆盖 health、业务 run、trace/score、日志
