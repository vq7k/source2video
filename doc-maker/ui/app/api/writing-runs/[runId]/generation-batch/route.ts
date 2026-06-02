import { NextResponse } from "next/server";

import { runGenerationBatch } from "@doc-maker/writing-domain/runtime";
import type { RunGenerationBatchInput } from "@doc-maker/writing-domain/types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as RunGenerationBatchInput;
  const run = await runGenerationBatch(runId, body);
  return NextResponse.json({ run });
}
