import Link from "next/link";
import { ArrowLeft, Braces, ClipboardCheck, GitBranch, Layers3, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const flow = [
  {
    title: "快速输入",
    body: "用户只输入一句想法、粘贴材料或参考文本，系统先提炼本轮写作规则范围。",
  },
  {
    title: "生成前检查",
    body: "把动态输入清洗成固定契约：内容摘要、依据边界、规则候选和风险提示。",
  },
  {
    title: "候选评审",
    body: "按固定轮数生成多个候选，自动评分；人工只做选中文本和打标签。",
  },
  {
    title: "定稿导出",
    body: "从本批候选中选择 1 个文本产物导出；TTS、视觉和视频处理在下游节点完成。",
  },
];

const architecture = [
  {
    icon: Layers3,
    title: "业务层",
    body: "负责文本生产工作流和用户交互，强调轻便、低认知成本。",
  },
  {
    icon: Braces,
    title: "框架层",
    body: "负责节点契约、评分、trace、反馈账本和规则快照，业务无关、可迁移。",
  },
  {
    icon: GitBranch,
    title: "观测层",
    body: "对接 Langfuse，保留模型调用、评分和人工反馈的可追溯记录。",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">doc-marker · 产品说明</h1>
            <Badge variant="muted">说明</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            面向专业内容创作者，把写作流程工程化：输入收束、候选生成、评分反馈、规则迭代。
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          返回工作台
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        {flow.map((item, index) => (
          <Card key={item.title} className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{index + 1}</Badge>
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">{item.body}</CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {architecture.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon className="size-4" />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">{item.body}</CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="mt-6 rounded-xl border-amber-200 bg-amber-50/60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ClipboardCheck className="size-4" />
            当前基线边界
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm leading-6 text-amber-950 md:grid-cols-2">
          <p>基线只支持短文本生产：300-500 中文字，约 60-90 秒口播基准。</p>
          <p>规则更新不会改写旧候选；运行下一批时才使用新的规则快照。</p>
        </CardContent>
      </Card>

      <Card className="mt-6 rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <RefreshCw className="size-4" />
            反馈闭环
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-muted-foreground">
          人工反馈进入反馈账本，系统自动归因并编译为规则草稿；规则草稿有数量上限，合并后形成下一批生成使用的规则快照。
        </CardContent>
      </Card>
    </main>
  );
}
