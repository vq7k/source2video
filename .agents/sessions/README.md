# sessions/

历史 session 归档。**复杂多步骤 session** 结束时按 PROJECT.md §"session 结束 SOP" 归档；单 commit 小动作不需要归档。

## 文件结构

```
sessions/
└── YYYY-MM-DD-<topic>/
    ├── context.md     # 本次 session 目标 + 起始上下文（catch-up 后立即写）
    ├── decisions.md   # session 内做的所有决策（包括 .agents/decisions/ 草稿索引）
    └── outputs.md     # 产出物索引（文件路径 / commit hash / 验收）
```

按需，单文件 session 也可以只写 `outputs.md`（如 bootstrap 类小 session）。

## 命名

`YYYY-MM-DD-<short-topic>` — topic 用 kebab-case，简短 ≤ 30 字符。

例：
- `2026-06-02-agent-harness-bootstrap/`
- `2026-06-10-doc-maker-observability-extract/`
- `2026-07-15-s2v-core-extraction-decision/`

## 何时归档

| 情景 | 是否归档 |
|---|---|
| 复杂多步骤（brainstorm + spec + plan + execute）| ✅ 必须 |
| 跨多 commit 的 milestone | ✅ 必须 |
| 单 commit 小修改 | ❌ 不归档（git log 自身够用）|
| 探索性调研产出 ADR | ✅ 归档（含调研材料）|
| Cold start catch-up + 简短交互 | ❌ 不归档 |

## 上挂

每次归档后在 `.agents/STATUS.md` "最近一次 session" 段引用归档路径。
