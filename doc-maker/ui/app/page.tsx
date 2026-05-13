import { Plus, RotateCw, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EpisodeList } from "@/components/l1/episode-list";
import { UploadDialog } from "@/components/l1/upload-dialog";
import { SystemHealthPanel } from "@/components/l1/system-health-panel";
import { episodes } from "@/lib/mock";

export default function BusinessConsolePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">doc-maker · 业务控制台</h1>
          <Badge variant="muted" className="font-mono">
            L1
          </Badge>
          <span className="text-xs text-muted-foreground">业务层</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <RotateCw className="mr-1 h-3 w-3" />
            刷新
          </Button>
          <Button variant="ghost" size="sm">
            <Settings className="mr-1 h-3 w-3" />
            设置
          </Button>
        </div>
      </header>

      <section className="mb-6 flex flex-wrap items-center gap-2">
        <Button variant="outline">
          <Plus className="mr-1 h-4 w-4" />
          新建 Episode
        </Button>
        <UploadDialog />
        <p className="ml-2 text-xs text-muted-foreground">
          以 Episode 为单元（ADR-025 纪律 #1）· 跑通的 Episode 不显示节点链接（纪律 #3）
        </p>
      </section>

      <section className="mb-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Episode 列表</h2>
          <p className="text-xs text-muted-foreground">
            {episodes.length} 个
          </p>
        </div>
        <EpisodeList initial={episodes} />
      </section>

      <section>
        <SystemHealthPanel />
      </section>

      <footer className="mt-10 text-center text-xs text-muted-foreground">
        L1 默认隐藏框架层 · 状态徽章 ≥ 详情（纪律 #2）· 核心动作只 3 个：上传 / 重跑 / 接受（纪律 #5）
      </footer>
    </main>
  );
}
