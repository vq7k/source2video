import { NextResponse } from "next/server";

import { deleteHumanFeedback, recordHumanFeedback } from "@doc-maker/writing-domain/runtime";
import type { HumanFeedbackInput } from "@doc-maker/writing-domain/types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const body = (await request.json()) as HumanFeedbackInput;
  const run = await recordHumanFeedback(runId, body);
  return NextResponse.json({ run });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const body = (await request.json()) as { feedbackId?: string };
  if (!body.feedbackId) {
    return NextResponse.json({ error: "feedbackId is required" }, { status: 400 });
  }

  const run = await deleteHumanFeedback(runId, body.feedbackId);
  return NextResponse.json({ run });
}
