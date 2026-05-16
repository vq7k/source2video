import { NextResponse } from "next/server";

import { confirmWritingRunPrecheck } from "@/lib/writing-runtime";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const run = await confirmWritingRunPrecheck(runId);
  return NextResponse.json({ run });
}
