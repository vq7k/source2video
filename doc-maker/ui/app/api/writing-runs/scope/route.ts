import { NextResponse } from "next/server";

import { createDraftWritingRun } from "@doc-maker/writing-domain/runtime";
import type { DeriveWritingRuleScopeInput } from "@doc-maker/writing-domain/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const input = (await request.json()) as DeriveWritingRuleScopeInput;
  const run = await createDraftWritingRun(input);
  return NextResponse.json({ ruleScope: run.ruleScope, run });
}
