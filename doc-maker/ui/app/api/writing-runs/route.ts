import { NextResponse } from "next/server";

import { createWritingRun, listWritingRuns } from "@/lib/writing-runtime";
import type { CreateWritingRunInput } from "@/lib/writing-run-types";

export const runtime = "nodejs";

export async function GET() {
  const runs = await listWritingRuns();
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  const input = (await request.json()) as CreateWritingRunInput;
  const run = await createWritingRun(input);
  return NextResponse.json({ run });
}
