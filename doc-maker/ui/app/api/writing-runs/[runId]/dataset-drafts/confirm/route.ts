import { NextResponse } from "next/server";

import { readWritingRun } from "@doc-maker/writing-domain/runtime";
import { promoteWritingDatasetDraftsForRun } from "@doc-maker/writing-domain/dataset-draft-persistence";
import { getWritingDatasetDraftRepository } from "@/lib/writing-dataset-draft-repository";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

type ConfirmationRequestBody = {
  confirmedBy?: unknown;
  note?: unknown;
};

async function readConfirmation(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ConfirmationRequestBody;
  const confirmedBy = typeof body.confirmedBy === "string" ? body.confirmedBy.trim() : "";
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;

  if (!confirmedBy) {
    return {
      error: NextResponse.json(
        {
          error: "confirmedBy is required",
          status: "confirmation_required",
        },
        { status: 400 },
      ),
    };
  }

  return { confirmedBy, note };
}

export async function POST(request: Request, context: RouteContext) {
  const repository = getWritingDatasetDraftRepository();
  if (!repository) {
    return NextResponse.json(
      {
        error: "Writing dataset repository is not configured",
        status: "repository_unconfigured",
      },
      { status: 503 },
    );
  }

  const confirmation = await readConfirmation(request);
  if ("error" in confirmation) {
    return confirmation.error;
  }

  const { runId } = await context.params;
  const run = await readWritingRun(runId);

  if (!run) {
    return NextResponse.json(
      { error: "Writing run not found", runId },
      { status: 404 },
    );
  }

  const result = await promoteWritingDatasetDraftsForRun(run, repository, confirmation);

  return NextResponse.json({
    dataset: {
      id: result.dataset.id,
      kind: result.dataset.kind,
      version: result.dataset.version,
      itemCount: result.items.length,
      updatedAt: result.dataset.updatedAt,
    },
    items: result.items.map((item) => ({
      id: item.id,
      datasetId: item.datasetId,
      sourceRunId: item.sourceRunId,
      sourceArtifactId: item.sourceArtifactId,
      split: item.split,
    })),
  });
}
