import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  FileUp,
  Cog,
  FileCheck2,
  Layers,
  Database,
  RefreshCw,
  Eye,
  EyeOff,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">心智模型 · 看懂这个系统</h1>
          <Badge variant="muted" className="font-mono">
            About
          </Badge>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          返回业务控制台（L1）
        </Link>
      </header>

      {/* TL;DR */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <p className="text-base leading-relaxed">
            <strong>一句话</strong>：doc-maker 是把 <strong>PPT/教材</strong> 自动转成{" "}
            <strong>讲解视频</strong> 的 LLM workflow 流水线。**你只管上传 + 看产出**；中间一堆"节点 / 物料 / 决策迹 / 反馈循环"都是给作者排查问题用的，**你跑通的时候完全看不到**。
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {/* Model 1: 使用者视角 vs 系统视角 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4" /> 模型 1 · 你看到什么 vs 系统在做什么
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded border bg-muted/30 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  你看到（L1 业务控制台）
                </div>
                <ol className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <FileUp className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    上传 PPT
                  </li>
                  <li className="flex items-start gap-2">
                    <RefreshCw className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    看 Episode 进度（plan ✓ → shot 3/6 → qa → done）
                  </li>
                  <li className="flex items-start gap-2">
                    <FileCheck2 className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    拿产出（scripts / shots / qa_report）
                  </li>
                </ol>
              </div>
              <div className="rounded border bg-muted/30 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  系统在做（你看不见）
                </div>
                <ol className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Cog className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    Plan 节点拆 Shot（用 4 步链 + Evaluator-Optimizer）
                  </li>
                  <li className="flex items-start gap-2">
                    <Cog className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    Shot 节点写三件套（text / text_tts / notes）
                  </li>
                  <li className="flex items-start gap-2">
                    <Cog className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    QA 节点检一致性 + duration_align
                  </li>
                </ol>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              **关键**：使用者层和框架层 <strong>解耦</strong>。跑通的 Episode 你只看左边；警告 / 失败才暴露右边的入口（"→ 进入 X 节点控制台"按钮）。这是 ADR-025 的核心立场。
            </p>
          </CardContent>
        </Card>

        {/* Model 2: 3 层 UI */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" /> 模型 2 · 三层 UI 谁看谁
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Tier
                level="L1"
                name="业务控制台"
                user="你（使用者）"
                show="Episode 状态 / 产出 / 错误入口"
                route="/"
                tone="primary"
              />
              <div className="ml-4 flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowDown className="h-3 w-3" />
                <span>仅警告 / 失败时跳转</span>
              </div>
              <Tier
                level="L3"
                name="节点控制台"
                user="作者（深度排查）"
                show="产物 / 物料 / 决策迹 / 反馈"
                route="/node/{toy|plan|shot|qa}"
                tone="muted"
              />
              <div className="ml-4 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">↕</span>
                <span>作者独立打开（不经 L1）</span>
              </div>
              <Tier
                level="L2"
                name="总览控制台"
                user="作者（运维入口）"
                show="所有节点在线状态 + 最近 artifact_id"
                route="/hub"
                tone="muted"
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              **默认你只在 L1**——L2 / L3 是作者用的。L1 跑通时不会出现 L2 / L3 的链接（纪律 #3）。L2 / L3 不反向引用 L1 的"Episode"概念（框架层不知道业务层存在）。
            </p>
          </CardContent>
        </Card>

        {/* Model 3: 数据流 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" /> 模型 3 · 数据怎么流（一次跑批）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-stretch gap-2 text-xs">
              <FlowBox label="你的 PPT" sub=".pptx / .md" />
              <FlowArrow />
              <FlowBox label="Case" sub="lint + register + git commit" />
              <FlowArrow />
              <FlowBox label="Pipeline" sub="Plan → Shot ×N → QA" tone="emphasis" />
              <FlowArrow />
              <FlowBox label="Artifact" sub="scripts + visual_spec + qa_report" />
              <FlowArrow />
              <FlowBox label="（未来）" sub="TTS + Remotion → mp4" tone="future" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              所有中间产物都落 <code className="rounded bg-muted px-1 font-mono">traces/</code> + <code className="rounded bg-muted px-1 font-mono">artifacts/</code>，**git 管理**——版本化 / diff / 回滚都免费。UI 不存数据库。
            </p>
          </CardContent>
        </Card>

        {/* Model 4: 节点内部 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cog className="h-4 w-4" /> 模型 4 · 一个节点内部长什么样
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded border-2 border-dashed border-muted-foreground/30 p-4">
              <div className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Node（例如 Plan）
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="space-y-2">
                  <div className="font-semibold">输入</div>
                  <BoxItem>Case（输入数据）</BoxItem>
                  <BoxItem>Materials 5 类</BoxItem>
                  <BoxItem>· prompt</BoxItem>
                  <BoxItem>· schema</BoxItem>
                  <BoxItem>· rubric</BoxItem>
                  <BoxItem>· style_guide</BoxItem>
                  <BoxItem>· exemplars</BoxItem>
                </div>
                <div className="flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Cog className="h-8 w-8 animate-spin text-muted-foreground/50 [animation-duration:8s]" />
                    <div className="text-center text-xs text-muted-foreground">
                      LLM call
                      <br />
                      （可能多步链）
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="font-semibold">输出</div>
                  <BoxItem>Artifact（含物料版本号）</BoxItem>
                  <BoxItem>Decision Trace</BoxItem>
                  <BoxItem>Eval Attribution</BoxItem>
                  <BoxItem>Metrics（cost / latency）</BoxItem>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              **审美 / 标准 / 类型变化绝不动节点代码**（不变量 #11）——改的是 Materials。这是框架的核心解耦点：节点是稳定的"代码"，物料是迭代的"配方"。
            </p>
          </CardContent>
        </Card>

        {/* Model 5: 反馈闭环 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4" /> 模型 5 · 系统怎么自己改进（反馈闭环）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
              <LoopStep n={1} label="看 artifact" sub="L3 console 一屏看完" />
              <LoopStep n={2} label="提反馈" sub="结构化表单 ≤ 30 秒" />
              <LoopStep n={3} label="聚类 ≥ 3" sub="单条 = 噪声" />
              <LoopStep n={4} label="改物料" sub="按 L0–L5 升级路径" />
              <LoopStep n={5} label="双向 Gate" sub="train+holdout 双满足才 bump" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              **这是给作者用的，不是给你**——L1 没有"提反馈"按钮。出问题时跳 L3 才看到。撞墙撞 K 轮强制升级（Bounded Budget），不许死磕同一层。
            </p>
          </CardContent>
        </Card>

        {/* What you'll see in this prototype */}
        <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" /> 这个原型让你看什么
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <div className="mb-2 font-semibold">L1（你的视角）</div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li className="flex gap-2">
                    <EyeOff className="mt-0.5 h-3 w-3 shrink-0" />
                    跑通的 Episode <strong>不显示</strong> 节点链接（看完成卡片）
                  </li>
                  <li className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    警告 / 失败才暴露 "→ 控制台" 按钮
                  </li>
                  <li className="flex gap-2">
                    <FileUp className="mt-0.5 h-3 w-3 shrink-0" />
                    上传弹框假装走 git thin 前端流程
                  </li>
                </ul>
              </div>
              <div>
                <div className="mb-2 font-semibold">L2 / L3（作者视角，原型让你也看）</div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li className="flex gap-2">
                    <Layers className="mt-0.5 h-3 w-3 shrink-0" />
                    L2 总览 = 4 节点状态卡 + 跳 L3
                  </li>
                  <li className="flex gap-2">
                    <Cog className="mt-0.5 h-3 w-3 shrink-0" />
                    L3 节点 = 产物 + 物料 + 决策迹 + 反馈 + 重跑
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded border border-primary/40 bg-primary text-primary-foreground px-3 py-1 text-xs font-medium hover:bg-primary/90"
              >
                → 去 L1 业务控制台
              </Link>
              <Link
                href="/hub"
                className="rounded border px-3 py-1 text-xs font-medium hover:bg-muted"
              >
                去 L2 总览控制台
              </Link>
              <Link
                href="/node/toy"
                className="rounded border px-3 py-1 text-xs font-medium hover:bg-muted"
              >
                去 L3 Toy 节点
              </Link>
              <Link
                href="/node/plan"
                className="rounded border px-3 py-1 text-xs font-medium hover:bg-muted"
              >
                去 L3 Plan 节点
              </Link>
              <Link
                href="/node/qa"
                className="rounded border px-3 py-1 text-xs font-medium hover:bg-muted"
              >
                去 L3 QA 节点
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <footer className="mt-8 text-center text-xs text-muted-foreground">
        看完了？随时点右下角{" "}
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          ?
        </span>{" "}
        回来。
      </footer>
    </main>
  );
}

// --- Helper components ---

function Tier({
  level,
  name,
  user,
  show,
  route,
  tone,
}: {
  level: string;
  name: string;
  user: string;
  show: string;
  route: string;
  tone: "primary" | "muted";
}) {
  const isPrimary = tone === "primary";
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded border p-3 ${
        isPrimary ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"
      }`}
    >
      <Badge variant={isPrimary ? "default" : "muted"} className="font-mono">
        {level}
      </Badge>
      <div className="flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="font-semibold">{name}</div>
        <div className="text-xs text-muted-foreground">使用者：{user}</div>
        <div className="text-xs text-muted-foreground">看什么：{show}</div>
        <code className="rounded bg-background px-1 font-mono text-xs">{route}</code>
      </div>
    </div>
  );
}

function FlowBox({
  label,
  sub,
  tone,
}: {
  label: string;
  sub: string;
  tone?: "emphasis" | "future";
}) {
  const cls =
    tone === "emphasis"
      ? "border-primary/40 bg-primary/10"
      : tone === "future"
        ? "border-dashed border-muted-foreground/30 bg-muted/10 text-muted-foreground"
        : "border-border bg-muted/30";
  return (
    <div className={`flex min-w-[120px] flex-col gap-1 rounded border p-2 ${cls}`}>
      <div className="font-semibold">{label}</div>
      <div className="text-[10px] leading-tight text-muted-foreground">{sub}</div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center text-muted-foreground">
      <ArrowRight className="h-4 w-4" />
    </div>
  );
}

function BoxItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border bg-background px-2 py-1 text-[11px] leading-tight">
      {children}
    </div>
  );
}

function LoopStep({ n, label, sub }: { n: number; label: string; sub: string }) {
  return (
    <div className="rounded border bg-muted/30 p-2 text-xs">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {n}
        </span>
        <span className="font-semibold">{label}</span>
      </div>
      <div className="text-[10px] leading-tight text-muted-foreground">{sub}</div>
    </div>
  );
}
