import { NextResponse } from "next/server";

import { compileRulePatch } from "@/lib/writing-runtime";
import type { CompileRulePatchInput } from "@/lib/writing-run-types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const body = (await request.json()) as CompileRulePatchInput;
  const run = await compileRulePatch(runId, body);
  return NextResponse.json({ run });
}
