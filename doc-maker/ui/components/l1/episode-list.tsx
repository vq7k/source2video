"use client";

import { useEffect, useState } from "react";

import { EpisodeCard } from "./episode-card";
import type { Episode } from "@/lib/types";

interface Props {
  initial: Episode[];
}

export function EpisodeList({ initial }: Props) {
  const [items, setItems] = useState<Episode[]>(initial);

  // 假装跑批进度推进：每 2.5s 推一次
  useEffect(() => {
    const timer = setInterval(() => {
      setItems((prev) =>
        prev.map((ep) => {
          if (ep.status !== "running" || !ep.progress) return ep;
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
              artifacts: {
                scripts: "scripts.md",
                shots: "shots/",
                qa_report: "qa_report.md",
              },
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
        ep.id === id ? { ...ep, status: "done", warn_summary: undefined } : ep,
      ),
    );
  };

  const handleRerun = (id: string) => {
    setItems((prev) =>
      prev.map((ep) =>
        ep.id === id
          ? {
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
            }
          : ep,
      ),
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
