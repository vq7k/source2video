import { NextResponse } from "next/server";

import { finalizeWritingRun } from "@/lib/writing-runtime";
import type { FinalizeWritingRunInput } from "@/lib/writing-run-types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const input = (await request.json()) as Partial<FinalizeWritingRunInput>;

  if (!input.candidateId) {
    return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
  }

  const run = await finalizeWritingRun(runId, { candidateId: input.candidateId });
  return NextResponse.json({ run });
}
