import {
  buildWritingAdapterReadinessProjection,
  writingDatasetDraftItemToFrameworkDatasetItem,
} from "./adapter-readiness";
import type { WritingRunRecord } from "./types";
import type {
  FrameworkDatasetItem,
  FrameworkDatasetRecord,
} from "../../../../packages/framework-store/src/index";

export const WRITING_DATASET_DRAFT_ID = "writing_dataset_draft";

export type WritingDatasetDraftRepository = {
  getDataset?: (datasetId: string) => Promise<FrameworkDatasetRecord | null>;
  putDataset: (dataset: FrameworkDatasetRecord) => Promise<FrameworkDatasetRecord>;
  appendDatasetItem: (
    datasetId: string,
    item: FrameworkDatasetItem,
  ) => Promise<FrameworkDatasetRecord>;
};

export type PersistWritingDatasetDraftsOptions = {
  at?: string;
  datasetId?: string;
};

export type PersistWritingDatasetDraftsResult = {
  dataset: FrameworkDatasetRecord;
  items: FrameworkDatasetItem[];
};

function createDatasetRecord(input: {
  datasetId: string;
  run: WritingRunRecord;
  at: string;
}): FrameworkDatasetRecord {
  return {
    id: input.datasetId,
    kind: "writing_dataset_draft",
    version: "draft",
    items: [],
    createdAt: input.at,
    updatedAt: input.at,
    metadata: {
      domain: "writing",
      source: "writing_feedback_dataset_draft",
      sourceRunId: input.run.id,
      outputProfile: input.run.outputProfile.name,
      skillPackageId: input.run.skillPackage.id,
    },
  };
}

async function ensureDataset(
  repository: WritingDatasetDraftRepository,
  run: WritingRunRecord,
  datasetId: string,
  at: string,
): Promise<FrameworkDatasetRecord> {
  const existing = repository.getDataset ? await repository.getDataset(datasetId) : null;
  if (existing) {
    return existing;
  }

  return repository.putDataset(createDatasetRecord({ datasetId, run, at }));
}

export async function persistWritingDatasetDraftsForRun(
  run: WritingRunRecord,
  repository: WritingDatasetDraftRepository,
  options: PersistWritingDatasetDraftsOptions = {},
): Promise<PersistWritingDatasetDraftsResult> {
  const at = options.at ?? new Date().toISOString();
  const datasetId = options.datasetId ?? WRITING_DATASET_DRAFT_ID;
  let dataset = await ensureDataset(repository, run, datasetId, at);
  const projection = buildWritingAdapterReadinessProjection(run);
  const items = projection.datasetDraftItems.map((item) =>
    writingDatasetDraftItemToFrameworkDatasetItem(item, { datasetId, at }),
  );

  for (const item of items) {
    dataset = await repository.appendDatasetItem(datasetId, item);
  }

  return { dataset, items };
}
