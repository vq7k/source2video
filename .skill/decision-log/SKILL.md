# skill: decision-log

决策怎么落。

## 决策分层（决定写哪里）

| 决策类型 | 落地位置 |
|---|---|
| 仓级正式决定（架构 / 技术栈 / 跨子项目范围） | `docs/ADRs/<NNN>.md` |
| session 级临时决定 | `.agents/decisions/<YYYY-MM-DD>-<topic>.md` |
| session 级临时决定（不沉淀） | session 归档 `decisions.md` 即可 |

## ADR 文件结构（精简版）

```markdown
# <编号>-<主题>

## 决定
[一句话]

## 背景
[为什么要决定]

## 备选与权衡
[考虑过哪些方案]

## 影响
[决定后哪些地方变]
```

## 步骤

1. 判断决策类型（看上表）
2. 写到对应位置
3. 改动相关文档（spec / SOUL / CLAUDE.md 等）
4. 一次 commit 把所有相关改动 + ADR/decision 一起提交
5. commit message 引用 ADR 或 decision 文件

## 反例

- ❌ 仓级架构变化只写 session 归档 → 下次 catch-up 找不到正式依据
- ❌ session 临时选择升级成 ADR → 污染仓级决策
- ❌ 写决定时不写"为什么" → 未来无法 audit

## 校验

仓级决策应能在 `docs/ADRs/` 找到；临时决策应能在 `.agents/decisions/` 或 session 归档找到。
