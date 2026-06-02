import { NextResponse } from "next/server";

import { readWritingRun } from "@doc-maker/writing-domain/runtime";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const run = await readWritingRun(runId);
  return NextResponse.json({
    frameworkRuns: run.frameworkRuns ?? [],
    llmTraces: run.llmTraces ?? [],
  });
}
