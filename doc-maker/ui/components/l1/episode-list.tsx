"use client";

import { useEffect, useState } from "react";

import { EpisodeCard } from "./episode-card";
import type { Episode } from "@/lib/types";

interface Props {
  initial: Episode[];
}

const COMPLETE_ARTIFACTS = {
  scripts: "scripts.md",
  shots: "shots/",
  qa_report: "qa_report.md",
};

export function EpisodeList({ initial }: Props) {
  const [items, setItems] = useState<Episode[]>(initial);

  // mock 进度只按 plan -> shot -> qa -> done 串行推进，避免展示并行幻觉。
  useEffect(() => {
    const timer = setInterval(() => {
      setItems((prev) =>
        prev.map((ep) => {
          if (ep.status !== "running" || !ep.progress) return ep;

          if (ep.progress.plan === "running") {
            return {
              ...ep,
              eta: "4:30",
              progress: { ...ep.progress, plan: "done" },
            };
          }

          if (ep.progress.plan !== "done") return ep;

          const { current, total } = ep.progress.shot;
          if (current < total) {
            return {
              ...ep,
              progress: {
                ...ep.progress,
                shot: { current: current + 1, total },
              },
            };
          }
          if (ep.progress.qa === "pending") {
            return {
              ...ep,
              progress: { ...ep.progress, qa: "running" },
            };
          }
          if (ep.progress.qa === "running") {
            return {
              ...ep,
              progress: { ...ep.progress, qa: "done", done: "done" },
              status: "done",
              rounds: 1,
              duration: "约 10:00",
              artifacts: COMPLETE_ARTIFACTS,
            };
          }
          return ep;
        }),
      );
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const handleAccept = (id: string) => {
    setItems((prev) =>
      prev.map((ep) =>
        ep.id === id && ep.status === "warn"
          ? hasCompleteArtifacts(ep)
            ? {
                ...ep,
                status: "done",
                qa_warnings: undefined,
                warn_summary: undefined,
                warn_node: undefined,
                warn_artifact_id: undefined,
                user_message: undefined,
                technical_detail: undefined,
              }
            : {
                ...ep,
                user_message:
                  "该 Episode 还没有完整文档包，不能接受为完成。请进入诊断或重跑。",
              }
          : ep,
      ),
    );
  };

  const handleRerun = (id: string) => {
    setItems((prev) =>
      prev.map((ep) => {
        if (ep.id !== id || ep.failure_kind === "bounded_budget") return ep;
        return {
          ...ep,
          status: "running",
          progress: {
            plan: "running",
            shot: { current: 0, total: 6 },
            qa: "pending",
            done: "pending",
          },
          eta: "5:00",
          error: undefined,
          warn_summary: undefined,
          user_message: undefined,
          technical_detail: undefined,
          next_action: undefined,
          artifacts: undefined,
        };
      }),
    );
  };

  /** 暴露 prepend 给上传 dialog 用 */
  return (
    <div className="space-y-3" data-list-root>
      <EpisodeListHandle setItems={setItems} />
      {items.map((ep) => (
        <EpisodeCard
          key={ep.id}
          episode={ep}
          onAccept={handleAccept}
          onRerun={handleRerun}
        />
      ))}
    </div>
  );
}

function hasCompleteArtifacts(episode: Episode) {
  return Boolean(
    episode.artifacts?.scripts &&
      episode.artifacts.shots &&
      episode.artifacts.qa_report,
  );
}

// 把 setItems 通过 window event 暴露给 UploadDialog（避免上层提状态成本）
function EpisodeListHandle({
  setItems,
}: {
  setItems: React.Dispatch<React.SetStateAction<Episode[]>>;
}) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Episode>).detail;
      if (!detail) return;
      setItems((prev) => [detail, ...prev]);
    };
    window.addEventListener("episode:create", handler);
    return () => window.removeEventListener("episode:create", handler);
  }, [setItems]);
  return null;
}
