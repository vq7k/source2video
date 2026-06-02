import { NextResponse } from "next/server";

import { listRulePackages } from "@doc-maker/writing-domain/runtime";

export const runtime = "nodejs";

export async function GET() {
  const rulePackages = await listRulePackages();
  return NextResponse.json({ rulePackages });
}
