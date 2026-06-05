# skill: init-agent-teams

> version: v0.4 · status: 成长中（持续修复，非累加）
> ⚠️ 本 SOP 仍在迭代。**用前先读 §已知问题；用后必按 §回写闭环 回写。**

把一套验证过的「多 Agent 协作骨架」装到**已存在的项目**里（init），并按需体检（check）。
**自包含**：所有模板在 `templates/`，离线可抄，不依赖来源仓库。

## 何时用
- **init**：一个已在跑的项目想要 Agent teams 治理层
- **check**：init 后验收，或 human 想给现有 Agent teams 体检

## 不做（边界）
- ❌ 空项目 scaffold（只做 brownfield 嵌入）
- ❌ 自动巡检 / 主动提醒（**监控归 human**）
- ❌ 碰业务代码 / 覆盖目标项目原有文件

---

## 模式 A：init（初始化）

> 信条：**没有可分工的活就不该有子 Agent**。默认产出是**单 agent**，角色按需长（§裂变阶梯）。

### A1 静态侦察
读目标项目：`README` · 包清单（`package.json`/`pom.xml`/`pyproject.toml`…）· 目录结构 · **已有的 `CLAUDE.md`/`AGENTS.md`**。得一份初步「项目画像」骨架。

### A2 runtime 历史对话挖掘
按 [`history-mining.md`](./history-mining.md) 加载分析 Claude Code/Codex 历史 → 项目真实画像 + 决策 + 踩坑 + 当前状态（**已脱敏**）。
**无历史** → 跳过，仅用 A1。

### A3 角色裁剪（默认单 agent，human 拍板）
按 §裂变阶梯，结合 A1+A2 证据。**默认单 agent 起步**；仅当静态 + 历史共同显示已有多个成熟独立模块才裂 Worker。三问 human：
1. 有几个能独立迭代/部署的模块？→ Worker 数（可为 0）
2. 有没有独立运维面（Docker/CI/服务器）？→ 要不要 infra 顶层
3. 视觉品位是核心卖点吗？→ 要不要 design Worker

### A4 嵌入骨架（不覆盖原有）
按裁剪结果从 `templates/` 取模板，**填 A1+A2 真实画像**（真模块名/栈/续接状态，不留占位符），落地目标项目：
- Core 必产：`.agent/{SOUL,STATUS,TODO}.md` + `PROJECT.md` + `CLAUDE.md`+`AGENTS.md` + `.skill/{catch-up,status-update}/SKILL.md`
- **每个常驻 Worker 的状态落在它自己的 cwd 下**（`<cwd>/.agent/`），一个 cwd 一个角色——遵「工作区硬规则」，不耦合根、不共享 cwd
- **每个 Worker 工作区也要建本地入口** `<cwd>/CLAUDE.md` + `<cwd>/AGENTS.md`（指向根 `PROJECT.md` + 本地 `.agent/SOUL.md`）——否则 agent 进该 cwd 时 catch-up「cat CLAUDE.md」落空、非 Claude runtime 无引导（见 `templates/worker-entry.template.md`）
- 已有 `CLAUDE.md` → **追加**指向 PROJECT.md 的链路，**不覆盖**；冲突项标出让 human 裁
- 绝不动业务代码、不删原有文件

### A5 产出清单 + 提示 Optional
列已产 Core + 可按需加挂的 Optional（裂变后的 `delegate-worker`/`worker-summary`、`.eval/`、隐私五层、由历史提炼的 `decisions`/`learned-rules`…），交 human 决定何时加。

### 裂变阶梯（A3 依据）
| 档 | 何时 | 建什么 |
|---|---|---|
| ① 单 agent（默认） | 没有可分工的活 | 一个 agent 包圆，`.agent/` 自交接 |
| ② 临时 SubAgent | 有独立活但**一次性** | 开 SubAgent 跑完即弃，**不立角色** |
| ③ 常驻 Worker | 一块活是**持续迭代领域** + **有独立工作区**（一个能 cd 进去的专属目录作 cwd） | 在该 cwd 下建 `<cwd>/.agent/` + 写 SOUL + 纳入派活/汇报 |

**①→③ 五判据**（全够才裂，缺一不立常驻）：边界清晰（能独立验收）· 会反复（非一次修）· 上下文该隔离 · 值得并行 · **有独立工作区**（专属目录作 cwd；无专属目录的横切职责不配常驻 Worker）。不够 → 留 ① 或走 ②。

#### 工作区硬规则（拆分的地基，违反 = 拆分非法）
- **cwd 唯一定位角色**：一个 cwd 只能对应**一个**角色。多角色共享一个 cwd（如都「从仓库根启动」）会让 catch-up「看 cwd 定角色」失效——**禁止**。
- **状态必在工作区内**：每个常驻 Worker 的状态 = `<它的 cwd>/.agent/`（SOUL/STATUS/TODO 直接在此）。**禁止**把 Worker 状态嵌进主理的 `.agent/` 子目录、或集中堆在根（如 `.agent*/workers/<role>/`）——那是耦合，子 Agent 无法独立进入工作区。
- **横切职责不配常驻**：部署 / 测试 / 运维等**横切整仓、无专属代码目录**的职责，**不该**做位置绑定的常驻 Worker；归主理（全局视角本就该协调），或按需派**临时 SubAgent**（给明确任务、跑完即弃、不占 cwd）。
- **入口齐备 + 引用同步**：每个 Worker 工作区除 `.agent/` 外还要有本地 `CLAUDE.md`+`AGENTS.md`，子 Agent 才能真正「独立进入工作区 catch-up」（缺入口 = 拆了角色却进不去）；改名 / 搬迁状态目录后，必须同步全项目引用（`.dockerignore`/`.gitignore`/文档/plan 里的旧路径与旧角色名），否则断链。

---

## 模式 B：check（自检，human 发起）

> check 是**给 human 的体检仪**：agent 只递报告，**裁决在 human**。

### B1 程序化硬校验
`bash <此 skill>/checks/structure-check.sh <目标项目根>` → B2-1~B2-5：结构完整性 / STATUS / 工作区独立性 / worker 入口齐备 / 引用一致性（后两者 WARN 给 human 核对）。

### B2 健康判据五组（单一来源，init 也按它搭）
1. **结构完整性 + 工作区独立性 + 入口齐备**：`.agent/` 三件套在 · 根三入口**互指对** · SOUL 四段齐 · 每角色 SOUL 直接在 `.agent[s]/` 下（不嵌子目录 / 不共享 cwd / 不耦合根；B2-3 查）· **每个 Worker 工作区有本地 `CLAUDE.md`+`AGENTS.md` 入口**（B2-4 查，缺=子 Agent 进不去）· **改名后全项目无旧路径 / 旧角色残留引用**（B2-5 查 + human 核对 `.dockerignore`/文档/plan）。
2. **自洽性**：角色边界**无重叠、无真空**（每职责唯一 owner）· catch-up 能 3 句话答「我是谁/上次/下一步」· STATUS 分段合理（≥4 段 + 含 actionable 锚点，宿主既有命名优先）。
3. **brownfield 兼容**：不与原有 `CLAUDE.md`/约定冲突 · 没覆盖/删原有文件。
4. **裂变 & 分层**（出报告给 human，**不自动改**）：单 agent 上是否堆 ≥2 块独立并行活（**该裂变**）· 已建 Worker 是否真有持续领域（**过度裂变**）· 规模 vs 已挂设施是否匹配（多 Worker 却无 decision-log = 缺口）。
5. **成长型**：本地快照 `version` vs 母版 · 已知问题是否积压未清。

### B3 出体检报告
每条 pass/fail + **不过项修法**；fail → **待修复动作，修完即清**（非累加）。第 4 组裂变/分层仅作**建议**呈现，human 裁。

---

## 成长型自进化

### 回写闭环（用完必做）
```
用 SOP 搭完/体检完 → 自检"哪步卡了/哪个模板别扭/哪条判据模糊"
   → 修进下方 §演进记录 / §已知问题 → bump version
   → 下个使用者进来先读到 → 避坑 / 接着改进
```
**持续修复非累加**：§已知问题是**待清零队列**（修进 changelog），不是越堆越长的告警墙。理想态：经常是空的。

### 母版 vs 快照
本文件是**母版**（single source）；带到新项目的是某 `version` 的**快照**。check B2 第 5 组据此比对「是否落后 / 有无新增已知问题」——提醒是 use-time、给 human 读，**非 agent 主动弹**。

## 演进记录（changelog）
- **v0.1（2026-06-04）** 初版：init/check 两阶段 + 历史挖掘 + 自包含模板 + 裂变阶梯 + 成长型。
- **dry-run（2026-06-04）** 跨样例项目只读验证 A1 侦察 + A2 历史 map（脱敏）走通；暴露 structure-check 的 STATUS 段校验对 brownfield 宿主命名过严，记入下方 §已知问题（见 `dry-run.md`）。
- **v0.2（2026-06-04）** 修复上述：structure-check B2-2 STATUS 校验改为「分段 ≥4 + 含 actionable readiness 锚点（不强求固定段名）」，status-update / B2 措辞同步软化；母仓自身 self-check 由 14/15 → 全 PASS。已知问题清零。
- **实战（2026-06-05，外部项目）** 暴露重大缺陷：skill 把「工作区独立性」只写成软判据（「上下文该隔离」），未落成硬规则——照此可拆出 **cwd 共享 + 状态耦合根 `.agents/`** 的非法 Worker（横切职责 infra/qa 无独立工作区，却借仓库根 cwd、状态塞 `.agents/workers/`，致子 Agent 无法独立进入工作区、catch-up「看 cwd 定角色」失效）。
- **v0.3（2026-06-05）** 修复上述：裂变判据 4→5 条（加「独立工作区」）+ 新增「工作区硬规则」段（cwd 唯一映射 / 状态必在 `<cwd>/.agent/` / 横切职责不配常驻）+ A4 嵌入规则 + catch-up cwd 唯一性 + B2 第 1 组并入工作区独立性 + structure-check 新增 B2-3 程序化检测（每 SOUL 必直接位于 `.agent[s]/` 下，否则判耦合）。已知问题清零。

- **实战 2（2026-06-05，外部项目自修后复检）** 暴露 check 盲区：v0.3 只验**根**工作区 + **结构**，不验**每个 worker 工作区入口齐备**、也不验**改名后引用一致性**——目标项目状态拍平后，`packages/` 缺本地 `CLAUDE/AGENTS`（子 Agent 进不去）、`.dockerignore`/文档/plan 仍引用旧 `.agents/` 路径与退休角色，check 全 PASS 却没抓出。
- **v0.4（2026-06-05）** 修复上述：A4 + 工作区硬规则加「worker 工作区本地入口（CLAUDE+AGENTS）+ 改名后同步全项目引用」；structure-check 新增 **B2-4**（worker 入口齐备，WARN）+ **B2-5**（引用一致性 / 旧路径残留，WARN）；新增 `templates/worker-entry.template.md`。已知问题清零。

## 已知问题 · 待清零
（空 —— 理想态。发现即修，修进 changelog。）
