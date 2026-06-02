import { NextResponse } from "next/server";

import { createRulePackageDraft, publishRulePackage } from "@doc-maker/writing-domain/runtime";
import type {
  CreateRulePackageDraftInput,
  PublishRulePackageInput,
} from "@doc-maker/writing-domain/types";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const input = (await request.json().catch(() => ({}))) as CreateRulePackageDraftInput;
  const result = await createRulePackageDraft(runId, input);
  return NextResponse.json(result);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const input = (await request.json()) as Partial<PublishRulePackageInput>;

  if (!input.packageId) {
    return NextResponse.json({ error: "packageId is required" }, { status: 400 });
  }

  const result = await publishRulePackage(runId, { packageId: input.packageId });
  return NextResponse.json(result);
}
