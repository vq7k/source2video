import { NextResponse } from "next/server";

import { recordTopicContext } from "@doc-maker/writing-domain/runtime";
import type { RecordTopicContextInput } from "@doc-maker/writing-domain/types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const body = (await request.json()) as RecordTopicContextInput;
  const text = body.text?.trim();

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const run = await recordTopicContext(runId, { ...body, text });
  return NextResponse.json({ run });
}
