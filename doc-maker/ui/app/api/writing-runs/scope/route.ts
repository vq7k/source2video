import { NextResponse } from "next/server";

import { deriveWritingRuleScope } from "@/lib/writing-runtime";
import type { DeriveWritingRuleScopeInput } from "@/lib/writing-run-types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const input = (await request.json()) as DeriveWritingRuleScopeInput;
  const ruleScope = await deriveWritingRuleScope(input);
  return NextResponse.json({ ruleScope });
}
