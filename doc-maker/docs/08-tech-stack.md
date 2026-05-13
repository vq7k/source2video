# 08 · source2video 技术选型

> **阅读位置**：08 / 09（入口：[`README.md`](./README.md)）。**本文档定位**：实施前的**统一技术栈清单**——打开就能动手。包版本、`pyproject.toml`、`.env.example`、CI 镜像、替换触发条件全在这里。**仅框架技术栈**（共 20 项）；业务侧专属栈（TTS / 视频合成等）见 [`_future/business-design.md`](./_future/business-design.md) §5。
>
> 配套：[`02-architecture.md`](./02-architecture.md) §2.1 / [`ADRs/006.md`](./ADRs/006.md) / [`ADRs/007.md`](./ADRs/007.md)（具体选型理由 + 决策依据）。
>
> **冲突优先级**：02-architecture / ADRs > 08。08 是实施清单，不能改架构决策。

---

## 0. 立场

| 原则 | 出处 | 落到选型 |
|---|---|---|
| **从下往上爬，够用就停**（Pattern 阶梯） | ADR-005 | 默认选最薄的栈，不上 framework |
| **第一版禁止编排 framework**（5–8 节点 < 300 行 Python） | ADR-007 | 不上 LangGraph / Temporal；Langfuse + Streamlit 是例外 |
| **provider-agnostic** | ADR-021 + 01 §2.1 | LLM SDK 统一 OpenAI 兼容协议，不绑 Anthropic / OpenAI |
| **不造轮子** | ADR-007 / ADR-010 | git + 文件系统 是 SOT，不上 DB / Redis / Web 上传 |
| **就近放** | ADR-019 | 物料 / 代码 / UI / eval / 文档都在 `nodes/<name>/` |

---

## 1. 技术栈一览表

| # | 项 | 选型 | 备选 | 替换触发条件 |
|---|---|---|---|---|
| 1 | **语言** | Python 3.11+ | TypeScript / Rust | LLM SDK 在那边稳定且必须使用 |
| 2 | **包管理** | **uv** | poetry / pip | uv 出严重 bug 或维护中止 |
| 3 | **LLM SDK** | **openai (Python)** | anthropic / litellm | OpenAI 兼容协议被弃用 |
| 4 | **LLM 端点** | CLIProxyAPI (`localhost:8317`) | Anthropic 直连 / OpenRouter | 端点不稳 / Claude Max 订阅变更 |
| 5 | **默认生成模型** | **Claude Sonnet 4.6**（dogfood）| Opus 4.7 / GPT-5 | 趋势测试上新代明显更好 → 升档 |
| 6 | **默认 Judge 模型** | **Claude Sonnet 4.6**（同代同模型）| Opus 4.7 | ADR-006 跨模型 judge 反而增方差 |
| 7 | **L3 CI 模型** | **Claude Haiku 4.5** | GPT-4o-mini | Haiku 不能稳定输出 JSON |
| 8 | **结构化输出** | **Pydantic v2** | dataclass + manual / TypedDict | Pydantic v3 breaking |
| 9 | **异步** | asyncio + **tenacity** | trio / backoff | trio 显著优势出现 |
| 10 | **编排** | 纯 Python (~200–300 行) | LangGraph / Temporal | 节点数 > 8 + 状态复杂（ADR-007） |
| 11 | **Observability** | **Langfuse（自托管）** | Phoenix / 本地 JSONL | Langfuse 部署失败 → 临时降级 JSONL |
| 12 | **Eval** | LLM-as-judge（内部实现） | DeepEval / RAGAS | 评估容量爆炸前的成熟期 |
| 13 | **存储** | **Git + YAML + Parquet** | SQLite / Postgres | metrics 跑批量 > 100k 行/天 |
| 14 | **CLI 框架** | **typer + rich** | click / argparse | typer 兼容性问题 |
| 15 | **UI** | **Next.js 15 + React 19 + TypeScript + Tailwind + shadcn/ui** | Vite SPA / Streamlit / Astro | 性能 / SEO / 多团队 需求出现（[ADR-026](ADRs/026.md)） |
| 16 | **测试** | pytest + pytest-asyncio | unittest | — |
| 17 | **CI** | **GitHub Actions** | 本地 act | GH Actions 配额耗尽 |
| 18 | **代码风格** | **ruff** | black + flake8 + isort | ruff 出严重兼容性问题 |
| 19 | **pre-commit** | pre-commit framework | husky / lefthook | — |
| 20 | **文档** | Markdown + Mermaid + ASCII | Sphinx / MkDocs | 文档量爆炸（> 5000 行）+ 需要全文搜索 |

> **TTS / 视频合成** 是业务侧第二轮才用的栈（ElevenLabs / ffmpeg），不在框架技术栈范围。见 [`_future/business-design.md`](./_future/business-design.md) §5 业务侧专属技术栈。

---

## 2. 关键选型理由（带 ADR 引用）

### 2.1 LLM SDK = OpenAI SDK（不是 Anthropic SDK）

- 走 **OpenAI 兼容协议**，框架内核 provider-agnostic
- Anthropic / 国内厂商 / 本地 Ollama 都能通过同协议接入
- 切换 provider = 改 `OPENAI_BASE_URL` 一行，不动代码
- 详见 01 §2.1

### 2.2 默认模型 = Sonnet 4.6（含 Judge）

- ADR-006：Judge ≥ generator 同代；**同节点 generator 与 judge 同模型**（跨模型 judging 增方差）
- L3 CI 用 Haiku 4.5 控成本（每次 PR ≤ $0.10）
- L4 dogfood 用 Sonnet 4.6（≤ $1.00/run）
- Opus 4.7 留给业务侧高 stakes 节点（Plan 节点 judge），MVP 不必上

### 2.3 编排 = 纯 Python（不上 LangGraph）

- ADR-007：第一版禁止 framework
- 节点数 < 8 + 状态简单 → asyncio + tenacity 够
- 第一版编排预期 < 300 行 Python
- 不变量 #10 强约束

### 2.4 Observability = Langfuse 自托管

- ADR-007 唯一例外（"Langfuse 必须早接"）
- 自托管：数据治理 + 不依赖外部服务可用性
- 接入方式：`from langfuse.openai import openai` 包装，零额外代码改动

### 2.5 UI = Next.js 15 + React 19 + TypeScript + Tailwind + shadcn/ui

- [ADR-026](ADRs/026.md)：UI 实施栈从 Streamlit 改为 Next.js（全栈统一）
- **触发动因**：[ADR-025](ADRs/025.md) 加入 L1 业务层 console（面向使用者，视觉是产品基本盘）+ L2 Hub Console（跨页路由），Streamlit 站不住
- **三层 UI 同栈**：L1 / L2 / L3 全部 Next.js App Router 单项目（`doc-maker/ui/`）
- **后端调 CLI**：Server Actions（Next.js 14+ 内置 RPC，类型安全）调 `s2v` Python CLI subprocess——**git thin 前端**（[ADR-021](021.md) 修正后允许）
- **数据源仍是文件系统 + git**：UI 不存数据库（[ADR-021](021.md) 精神）
- **行数纪律变更**：不限行数，强制"一屏视觉密度"——组件粒度按需拆（[06-ui-spec §1](06-ui-spec.md)）
- shadcn/ui (New York, neutral) + lucide-react + 不引入 zustand/redux（`useState` + Server Actions 够）

### 2.6 包管理 = uv

- 你 `ai-engineer-roadmap` 已用，工作流对齐
- 比 poetry 快 10×（dep resolve 秒级）
- pyproject.toml 标准

### 2.7 存储 = Git + YAML + Parquet

- **Git**：Source / Materials / Artifact / Feedback / Cases（所有需要版本化的）
- **YAML**：人可读的结构化数据（metadata / config / rubric）
- **Parquet**：metrics 跑批量（适合列式 query / 聚合）
- 不上数据库——ADR-021 精神延伸

### 2.8 CLI 框架 = typer + rich

- typer：FastAPI 同作者，类型提示驱动，与 Pydantic 天然契合
- rich：美化输出（表格 / 进度条 / 高亮 diff）
- 比 click 现代，比 argparse 简洁

---

## 3. 部署与本地开发

### 3.1 本地环境（已就位）

```
macOS Sequoia / Apple M4 Pro / 64GB
├── Python 3.11+      via uv
├── CLIProxyAPI       localhost:8317  → Anthropic API（Claude Max）
├── ClashX            127.0.0.1:7890  → 外网请求走代理
├── Langfuse 自托管   localhost:3000  via docker-compose（待部署）
└── Ollama            localhost:11434 → 本地 LLM（可选，做对照实验用）
```

### 3.2 仓库结构（动手前先建好）

```
source2video/
├── pyproject.toml
├── uv.lock
├── .env.example
├── .gitignore
├── .pre-commit-config.yaml
├── .github/workflows/ci.yml
├── README.md
│
├── docs/                    # 已就位（01-08 + ADR + README）
│
├── src/s2v/                 # 框架内核
│   ├── __init__.py
│   ├── runtime.py           # Node Runtime (§2.1)
│   ├── materials.py         # Materials Registry (§2.2)
│   ├── eval.py              # Eval Stack (§2.3)
│   ├── trace.py             # Observability (§2.4)
│   ├── feedback.py          # Feedback Loop (§2.5)
│   ├── cli.py               # typer CLI
│   └── schemas/             # Pydantic 公共 schema
│
├── nodes/                   # 节点级目录（ADR-019）
│   └── toy/
│       ├── README.md
│       ├── node.py
│       ├── prompts/
│       │   ├── _model_adapter/      # capability_gap 物料
│       │   └── _business_rules/     # business_policy 物料
│       ├── rubrics/
│       ├── schemas/
│       ├── style_guides/
│       ├── exemplars/
│       ├── eval/regression/
│       └── ui/console.py
│
├── fixtures/
│   ├── cases/
│   │   ├── train/           # 70%
│   │   ├── holdout/         # 30%
│   │   └── manifest.yaml
│   └── regression/v1/
│
├── traces/                  # 运行时产物（gitignored 大部分）
│   ├── artifacts/
│   ├── decisions/
│   ├── eval/
│   └── diffs/
│
├── reports/                 # 跑批报告（gitignored）
│
└── tests/
    ├── unit/                # L2
    └── integration/         # L3
```

### 3.3 `.env.example`

```bash
# LLM 端点（OpenAI 兼容协议）
OPENAI_BASE_URL=http://localhost:8317/v1
OPENAI_API_KEY=sk-...                              # CLIProxyAPI 自签 key

# 模型选择
S2V_MODEL=claude-sonnet-4-6                        # 默认生成模型
S2V_JUDGE_MODEL=claude-sonnet-4-6                  # 默认 judge 模型（同代同模型）
S2V_CI_MODEL=claude-haiku-4-5-20251001             # L3 CI 用便宜模型

# Langfuse
LANGFUSE_HOST=http://localhost:3000
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...

# 框架行为
S2V_LOG_LEVEL=INFO
S2V_CONCURRENCY=4                                  # 默认跑批并发
S2V_RETRY_MAX_ATTEMPTS=2                           # tenacity retry
S2V_BUDGET_K=3                                     # Bounded Budget 上限轮数
S2V_FEEDBACK_THRESHOLD_N=3                         # 反馈聚类阈值

# 代理（外网请求必须走 ClashX，ADR-021 例外）
HTTP_PROXY=socks5://127.0.0.1:7890
HTTPS_PROXY=socks5://127.0.0.1:7890
```

### 3.4 Langfuse 自托管部署

```bash
# docker-compose.yml 从 Langfuse 官方拉取
git clone https://github.com/langfuse/langfuse.git ~/langfuse-self-hosted
cd ~/langfuse-self-hosted
cp .env.example .env
# 编辑 .env 配置 Postgres / NEXTAUTH 等
docker compose up -d
```

打开 `http://localhost:3000` 注册管理员账号，新建 project 拿 keys 填回 `s2v/.env`。

**降级方案**：Langfuse 起不来 → 临时改用本地 JSONL trace（`traces/llm_calls/<run_id>.jsonl`），不阻塞 MVP。

### 3.5 CI 环境

```yaml
# .github/workflows/ci.yml 关键配置
runs-on: ubuntu-latest
strategy:
  matrix:
    python: ["3.11"]
env:
  OPENAI_BASE_URL: ${{ secrets.OPENAI_BASE_URL }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}    # 独立 CI key 带预算上限
  LANGFUSE_HOST: ${{ secrets.LANGFUSE_HOST }}
  LANGFUSE_PUBLIC_KEY: ${{ secrets.LANGFUSE_PUBLIC_KEY }}
  LANGFUSE_SECRET_KEY: ${{ secrets.LANGFUSE_SECRET_KEY }}
  S2V_MODEL: claude-haiku-4-5-20251001             # CI 用 Haiku 控成本
```

---

## 4. `pyproject.toml` 草稿

```toml
[project]
name = "source2video"
version = "0.1.0"
description = "LLM workflow pipeline framework"
requires-python = ">=3.11"
license = { text = "MIT" }
authors = [{ name = "xuelin" }]

dependencies = [
    "openai>=1.50",                   # OpenAI SDK（走兼容端点）
    "langfuse>=2.0",                  # 自带 openai wrapper
    "pydantic>=2.0",                  # 结构化输出 + schema 版本化
    "tenacity>=8.0",                  # retry
    "pyyaml>=6.0",                    # 物料 / metadata
    "typer>=0.12",                    # CLI
    "rich>=13.0",                     # CLI 美化
    "pyarrow>=15.0",                  # Parquet (metrics)
    "streamlit>=1.40",                # Per-Node Console
    "gitpython>=3.1",                 # git 操作（manifest / commit）
    "anyio>=4.0",                     # asyncio helper
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "pytest-cov>=5.0",
    "ruff>=0.5",
    "pre-commit>=3.0",
    "mypy>=1.10",                     # 类型检查（可选）
]

[project.scripts]
s2v = "s2v.cli:app"                   # CLI 入口

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
target-version = "py311"
line-length = 100
lint.select = ["E", "F", "I", "B", "UP", "RUF"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
markers = [
    "smoke: L1 启动 + load fixtures",
    "unit: L2 各 module 契约",
    "integration: L3 真实 LLM call",
]
```

---

## 5. 替换触发条件（动议级别）

每条都对应一个"框架长大后的拐点"——撞到才动，没撞到不动。

| 替换 | 触发条件 | 升级路径 |
|---|---|---|
| 纯 Python → LangGraph | 节点数 > 8 + 状态复杂（ADR-007） | 引入 LangGraph，纯 Python 编排层退化为节点内部实现 |
| OpenAI SDK → litellm | 多 provider 同时跑 + 需要 fallback chain | litellm 替换 openai sdk，base_url 改路由表 |
| Next.js → 拆分独立后端 | UI 多团队 / 移动端 / 多前端同后端 / Server Actions 性能瓶颈 | 抽 FastAPI 后端，Next.js 仅作前端 |
| Next.js → Astro / Vite | 静态 SEO 需求强烈 + 客户端交互极少 | 砍 Server Actions，迁静态站 |
| 文件系统 → SQLite | metrics 单跑批 > 100k 行 / 多用户并发读写 | metrics 迁 SQLite，其他（artifacts / feedback）仍 git |
| Langfuse 自托管 → Cloud | 自托管维护成本超过 cloud 费用 | 改 LANGFUSE_HOST，数据迁移 |
| Python → Rust（某个组件） | tokenizer / 编排 latency 成瓶颈（profile 出来） | 仅那个组件用 PyO3 包装，主代码仍 Python |

---

## 6. 不选什么 + 理由

| 不选 | 理由 |
|---|---|
| **LangChain / LangGraph** | ADR-007，第一版禁止 framework；> 8 节点再说 |
| **Streamlit**（原 §2.5，已被 [ADR-026](ADRs/026.md) 取代） | 视觉天花板低 / 路由 multipage 是 hack / 接不上 shadcn 等前端生态 |
| **独立 FastAPI 后端** | Next.js Server Actions 已是 RPC 风格调 `s2v` CLI；MVP 阶段不需要拆后端 |
| **MongoDB / Postgres** | 不需要数据库；git + YAML + Parquet 已 cover 所有 SOT 需求 |
| **Redis** | 没有跨进程缓存需求 |
| **Docker（除 Langfuse 部署）** | 本地开发不容器化；CI 用 GH Actions runner 即可 |
| **pytest-mock** | monkeypatch 够，不引入额外 lib |
| **DSPy** | 不做程序化 prompt 优化（ADR-005）；先证明任务能做再优化 |
| **MLflow / Weights&Biases** | Langfuse 已覆盖 trace + metrics + dashboard |
| **Argilla / Label Studio** | 第一版只有作者本人，不需要协作标注平台 |
| **OpenAI Evals** | LLM-as-judge 内部实现更直接控 attribution；OpenAI Evals 不输出 violated_rule_ref |

---

## 7. 版本锁定策略

| 锁定级别 | 怎么写 | 何时用 |
|---|---|---|
| **精确锁定** | `pkg==1.2.3` | LLM SDK / Langfuse / Pydantic（破坏性升级风险高） |
| **次要版本锁定** | `pkg>=1.2,<2.0` | 大部分 dev 依赖 |
| **最低版本** | `pkg>=1.0` | 工具类（rich / typer），向后兼容好 |

**uv.lock 提交进 git**——保证开发环境和 CI 一致。

---

## 8. 与其他文档的关系

| 文档 | 关系 |
|---|---|
| **01 §2.1 Node Runtime** | "LLM SDK 用 OpenAI SDK"——选型 → 08 §2.1 详细 |
| **03 §5 技术栈** | 业务案例的技术栈（TTS / 视频合成 / Notion 等），框架部分指向 08 |
| **04 §2.0 .env** | 用户操作向导 → 08 §3.3 是 canonical .env 来源 |
| **ADR-006 / ADR-007 / ADR-021** | 决策依据 → 08 §2 落地为具体选型 |

冲突时以 01 / ADR 为准（机制 > 实施清单）。
