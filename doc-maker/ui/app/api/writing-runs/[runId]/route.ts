import { NextResponse } from "next/server";

import { readWritingRun } from "@/lib/writing-runtime";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const run = await readWritingRun(runId);
  return NextResponse.json({ run });
}
