import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function LoadingLine({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-zinc-200", className)} />;
}

function LoadingPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-lg border bg-white", className)}>{children}</div>;
}

export function WritingTopicListLoading() {
  return (
    <>
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="rounded-md border border-transparent bg-white/45 px-3 py-3"
        >
          <LoadingLine className="h-4 w-4/5" />
          <div className="mt-3 flex gap-2">
            <LoadingLine className="h-3 w-10" />
            <LoadingLine className="h-3 w-14" />
            <LoadingLine className="h-3 w-20" />
          </div>
        </div>
      ))}
    </>
  );
}

export function WritingWorkspaceLoading() {
  return (
    <div className="flex min-h-[620px] flex-col gap-5">
      <Card>
        <CardHeader>
          <LoadingLine className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <LoadingLine className="h-32 rounded-md bg-zinc-100" />
          <div className="mt-3 flex flex-wrap gap-2">
            <LoadingLine className="h-8 w-40 rounded-full bg-zinc-100" />
            <LoadingLine className="h-8 w-48 rounded-full bg-zinc-100" />
            <LoadingLine className="h-8 w-44 rounded-full bg-zinc-100" />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <LoadingLine className="h-9 w-28 rounded-md" />
        </CardFooter>
      </Card>

      <Card className="border-zinc-200">
        <CardHeader>
          <div className="mb-2 flex gap-2">
            <LoadingLine className="h-6 w-20 rounded-full bg-zinc-100" />
            <LoadingLine className="h-6 w-16 rounded-full bg-zinc-100" />
          </div>
          <LoadingLine className="h-6 w-2/3" />
          <LoadingLine className="mt-2 h-4 w-5/6 bg-zinc-100" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3 rounded-md bg-zinc-50 p-4">
            <LoadingLine className="h-4 w-full" />
            <LoadingLine className="h-4 w-11/12" />
            <LoadingLine className="h-4 w-10/12" />
            <LoadingLine className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function OverviewWorkspaceLoading() {
  return (
    <div className="grid h-full min-h-0 grid-cols-[240px_minmax(0,1fr)_340px] overflow-hidden bg-[#f6f5f1] max-[1180px]:grid-cols-[56px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-r bg-[#efeee9] max-[1180px]:items-center max-[1180px]:px-2">
        <div className="w-full border-b px-4 py-3 max-[1180px]:px-0">
          <LoadingLine className="h-4 w-24 max-[1180px]:mx-auto max-[1180px]:size-8 max-[1180px]:rounded-md" />
          <LoadingLine className="mt-2 h-3 w-16 bg-zinc-300 max-[1180px]:hidden" />
        </div>
        <div className="w-full border-b p-3 max-[1180px]:px-0">
          <LoadingLine className="h-9 w-full rounded-md max-[1180px]:mx-auto max-[1180px]:size-10" />
        </div>
        <div className="flex w-full flex-1 flex-col gap-2 p-3 max-[1180px]:items-center max-[1180px]:px-0">
          {Array.from({ length: 4 }, (_, index) => (
            <LoadingPanel
              key={index}
              className="w-full border-transparent bg-white/50 p-3 max-[1180px]:size-10 max-[1180px]:p-0"
            >
              <LoadingLine className="h-4 w-4/5 max-[1180px]:m-2 max-[1180px]:size-6" />
              <LoadingLine className="mt-2 h-3 w-2/3 bg-zinc-100 max-[1180px]:hidden" />
            </LoadingPanel>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col border-x bg-white">
        <header className="flex h-10 shrink-0 items-center justify-between border-b bg-[#fbfaf6] px-4">
          <div className="flex items-center gap-2">
            <LoadingLine className="size-8 rounded-md bg-zinc-100" />
            <LoadingLine className="h-4 w-44" />
          </div>
          <div className="flex items-center gap-2">
            <LoadingLine className="h-8 w-16 rounded-md bg-zinc-100" />
            <LoadingLine className="size-8 rounded-md bg-zinc-100" />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b px-4 py-3">
              <LoadingLine className="h-4 w-24" />
              <LoadingLine className="mt-2 h-3 w-36 bg-zinc-100" />
              <div className="mt-3 flex gap-2 overflow-hidden">
                {Array.from({ length: 5 }, (_, index) => (
                  <LoadingLine key={index} className="h-8 w-20 shrink-0 rounded-md bg-zinc-100" />
                ))}
              </div>
            </div>
            <div className="divide-y">
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="grid min-h-16 grid-cols-[minmax(0,1fr)_112px_88px_136px_auto] items-center gap-3 px-4 py-3"
                >
                  <div>
                    <LoadingLine className="h-4 w-3/5" />
                    <LoadingLine className="mt-2 h-3 w-4/5 bg-zinc-100" />
                  </div>
                  <LoadingLine className="hidden h-6 w-20 rounded-full bg-zinc-100 sm:block" />
                  <LoadingLine className="hidden h-3 w-14 bg-zinc-100 lg:block" />
                  <LoadingLine className="hidden h-3 w-24 bg-zinc-100 lg:block" />
                  <LoadingLine className="h-8 w-14 bg-zinc-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col bg-[#fbfaf6] max-[1180px]:hidden">
        <div className="border-b px-4 py-3">
          <LoadingLine className="h-4 w-28" />
          <LoadingLine className="mt-2 h-3 w-52 bg-zinc-100" />
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <LoadingPanel className="p-4">
            <LoadingLine className="h-4 w-24" />
            <LoadingLine className="mt-3 h-16 w-full bg-zinc-100" />
          </LoadingPanel>
          <LoadingPanel className="p-4">
            <LoadingLine className="h-4 w-32" />
            <div className="mt-3 grid gap-2">
              <LoadingLine className="h-8 w-full bg-zinc-100" />
              <LoadingLine className="h-8 w-full bg-zinc-100" />
              <LoadingLine className="h-8 w-4/5 bg-zinc-100" />
            </div>
          </LoadingPanel>
        </div>
      </aside>
    </div>
  );
}
