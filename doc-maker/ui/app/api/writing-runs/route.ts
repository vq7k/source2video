import { NextResponse } from "next/server";

import { createWritingRun, listWritingRuns } from "@doc-maker/writing-domain/runtime";
import type { CreateWritingRunInput } from "@doc-maker/writing-domain/types";

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
