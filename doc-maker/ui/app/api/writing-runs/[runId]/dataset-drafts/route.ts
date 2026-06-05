import { NextResponse } from "next/server";

import { readWritingRun } from "@doc-maker/writing-domain/runtime";
import {
  persistWritingDatasetDraftsForRun,
  type WritingDatasetDraftRepository,
} from "@doc-maker/writing-domain/dataset-draft-persistence";

type RouteContext = {
  params: Promise<{ runId: string }> | { runId: string };
};

type RepositoryProvider = () => WritingDatasetDraftRepository | null;

let repositoryProvider: RepositoryProvider | null = null;

export function setWritingDatasetDraftRepositoryProviderForTests(
  provider: RepositoryProvider | null,
) {
  repositoryProvider = provider;
}

function getRepository() {
  return repositoryProvider ? repositoryProvider() : null;
}

async function resolveParams(context: RouteContext) {
  return context.params instanceof Promise ? await context.params : context.params;
}

export async function POST(_request: Request, context: RouteContext) {
  const repository = getRepository();
  if (!repository) {
    return NextResponse.json(
      {
        error: "Writing dataset repository is not configured",
        status: "repository_unconfigured",
      },
      { status: 503 },
    );
  }

  const { runId } = await resolveParams(context);
  const run = await readWritingRun(runId);

  if (!run) {
    return NextResponse.json(
      { error: "Writing run not found", runId },
      { status: 404 },
    );
  }

  const result = await persistWritingDatasetDraftsForRun(run, repository);

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
