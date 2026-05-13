# source2video 仓级架构决策（ADRs）

> **本目录范围**：source2video 仓级（跨子项目）的结构性决策。
>
> **子项目专属 ADR 见**：
> - [`../../doc-maker/docs/ADRs/`](../../doc-maker/docs/ADRs/) — doc-maker 业务侧 + 框架内核（ADR-001 ~ ADR-022）
>
> 状态约定：Accepted / 采纳 = 已采纳；Open = 进入验证期；Deferred = 推迟到触发条件出现。

---

## 索引

| ID | 标题 | 状态 |
|---|---|---|
| [ADR-023](023.md) | 单仓多子项目 + 框架抽离时机延后 | 采纳 |
| [ADR-024](024.md) | 整体架构 = DAG（4 层），演化层循环不破坏 DAG 性质 | 采纳 |

---

## 决策依赖关系（速查）

```
═══════════════════════════════════════════════════════════════════
 仓级（结构性 ADR）
═══════════════════════════════════════════════════════════════════
ADR-023 单仓多子项目 + 框架抽离时机延后
   └─→ 现在 = doc-maker；第二个 LLM workflow 子项目开工时抽 s2v-core

ADR-024 整体架构 = DAG（4 层）
   └─→ 复杂编排撞墙时回溯本 ADR 找哪条性质被破坏
   ├─≡ ADR-003 shot 不互读（DAG 性质的关键落点）        ← 见 dm ADR
   ├─≡ 不变量 #7 Node 通过 plan 中介                    ← 见 dm 02-architecture
   └─≡ 不变量 #9 Node 不互读 Artifact                   ← 见 dm 02-architecture
```

**子项目 ADR 参考**：

- doc-maker ADR-001 ~ ADR-022：见 [`../../doc-maker/docs/ADRs/`](../../doc-maker/docs/ADRs/)

---

## 未决 / Deferred

（当前仓级 ADR 暂无未决项；子项目级未决项见 [`../../doc-maker/docs/ADRs/README.md`](../../doc-maker/docs/ADRs/README.md)。）
