import { NextResponse } from "next/server";

import { confirmWritingRunPrecheck } from "@doc-maker/writing-domain/runtime";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const run = await confirmWritingRunPrecheck(runId);
  return NextResponse.json({ run });
}
