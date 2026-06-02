# decisions/

**session 级临时决策草稿**。

## 与 `docs/ADRs/` 的区别

| 类型 | 位置 | 持久度 | 受众 |
|---|---|---|---|
| **仓级正式 ADR** | `docs/ADRs/<NNN>.md` | 长期，定义仓级架构 | 跨 session / 跨 runtime / 跨 contributor |
| **session 临时草稿** | 本目录 `.agents/decisions/<date>-<topic>.md` | 短期，单 session 内做出的过程决策 | 本 session + 下次 catch-up 参考 |

**升级路径**：session 草稿如反映**仓级架构变化** → 升级写正式 ADR 到 `docs/ADRs/`，并在草稿末尾标 "↑ promoted to ADR-<NNN>"。

## 文件命名

`YYYY-MM-DD-<short-topic>.md`（kebab-case，topic ≤ 30 字符）

## 模板

```markdown
# decision: <一句话标题>

**日期**：YYYY-MM-DD
**session**：[`sessions/YYYY-MM-DD-<topic>/`](../sessions/YYYY-MM-DD-<topic>/)（如有归档）
**状态**：草稿 / 已采纳 / 已废弃 / promoted to ADR-<NNN>

## 背景
（为什么需要做这个决策；触发场景）

## 决策
（实际拍板的内容）

## 替代方案 + 拒选理由
（考虑过但没选的方案）

## 影响
（这个决策对后续工作的影响 / 触发什么待办）
```
