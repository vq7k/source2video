import {
  buildWritingAdapterReadinessProjection,
  writingDatasetDraftItemToFrameworkDatasetItem,
} from "./adapter-readiness";
import type { WritingRunRecord } from "./types";
import type {
  FrameworkDatasetItem,
  FrameworkDatasetRecord,
  FrameworkDatasetSplit,
} from "../../../../packages/framework-store/src/index";

export const WRITING_DATASET_DRAFT_ID = "writing_dataset_draft";
export const WRITING_EVAL_DATASET_ID = "writing_eval_dataset";

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

export type PromoteWritingDatasetDraftsOptions = {
  at?: string;
  datasetId?: string;
  confirmedAt?: string;
  confirmedBy: string;
  note?: string;
  split?: FrameworkDatasetSplit;
};

export type PersistWritingDatasetDraftsResult = {
  dataset: FrameworkDatasetRecord;
  items: FrameworkDatasetItem[];
};

function createDatasetRecord(input: {
  datasetId: string;
  run: WritingRunRecord;
  at: string;
  kind?: string;
  version?: string;
  metadata?: FrameworkDatasetRecord["metadata"];
}): FrameworkDatasetRecord {
  return {
    id: input.datasetId,
    kind: input.kind ?? "writing_dataset_draft",
    version: input.version ?? "draft",
    items: [],
    createdAt: input.at,
    updatedAt: input.at,
    metadata: {
      domain: "writing",
      source: "writing_feedback_dataset_draft",
      sourceRunId: input.run.id,
      outputProfile: input.run.outputProfile.name,
      skillPackageId: input.run.skillPackage.id,
      ...(input.metadata ?? {}),
    },
  };
}

async function ensureDataset(
  repository: WritingDatasetDraftRepository,
  run: WritingRunRecord,
  datasetId: string,
  at: string,
  dataset?: Pick<FrameworkDatasetRecord, "kind" | "version" | "metadata">,
): Promise<FrameworkDatasetRecord> {
  const existing = repository.getDataset ? await repository.getDataset(datasetId) : null;
  if (existing) {
    return existing;
  }

  return repository.putDataset(createDatasetRecord({ datasetId, run, at, ...dataset }));
}

function datasetDraftItemsForRun(run: WritingRunRecord, datasetId: string, at: string) {
  const projection = buildWritingAdapterReadinessProjection(run);
  return projection.datasetDraftItems.map((item) =>
    writingDatasetDraftItemToFrameworkDatasetItem(item, { datasetId, at }),
  );
}

function confirmedItemId(item: FrameworkDatasetItem) {
  const sourceDraftItemId = String(item.metadata.sourceDraftItemId ?? item.id);
  return sourceDraftItemId.startsWith("dataset_draft_")
    ? sourceDraftItemId.replace("dataset_draft_", "eval_dataset_item_")
    : `eval_dataset_item_${sourceDraftItemId}`;
}

function withConfirmationMetadata(
  metadata: FrameworkDatasetRecord["metadata"],
  input: {
    sourceDraftItemId: string;
    confirmedBy: string;
    confirmedAt: string;
    note?: string | null;
  },
) {
  return {
    ...metadata,
    reviewStatus: "human_confirmed",
    sourceDraftItemId: input.sourceDraftItemId,
    confirmedBy: input.confirmedBy,
    confirmedAt: input.confirmedAt,
    confirmationNote: input.note ?? null,
  };
}

function confirmedDatasetItem(
  item: FrameworkDatasetItem,
  input: {
    datasetId: string;
    confirmedAt: string;
    confirmedBy: string;
    note?: string;
    split: FrameworkDatasetSplit;
  },
): FrameworkDatasetItem {
  const sourceDraftItemId = String(item.metadata.sourceDraftItemId ?? item.id);
  const id = confirmedItemId(item);
  const confirmation = {
    sourceDraftItemId,
    confirmedBy: input.confirmedBy,
    confirmedAt: input.confirmedAt,
    note: input.note ?? null,
  };
  const inputRef = item.inputRef
    ? {
        ...item.inputRef,
        id: `${id}_input`,
        version: "eval-v1",
        metadata: withConfirmationMetadata(item.inputRef.metadata, confirmation),
        updatedAt: input.confirmedAt,
      }
    : undefined;
  const expectedOutputRef = item.expectedOutputRef
    ? {
        ...item.expectedOutputRef,
        id: `${id}_expected_output`,
        version: "eval-v1",
        metadata: withConfirmationMetadata(item.expectedOutputRef.metadata, confirmation),
        updatedAt: input.confirmedAt,
      }
    : undefined;

  return {
    ...item,
    id,
    datasetId: input.datasetId,
    inputRef,
    expectedOutputRef,
    inputArtifacts: inputRef ? [inputRef] : item.inputArtifacts,
    expectedArtifacts: expectedOutputRef ? [expectedOutputRef] : item.expectedArtifacts,
    split: input.split,
    labels: {
      ...item.labels,
      confirmation,
    },
    metadata: withConfirmationMetadata(item.metadata, confirmation),
  };
}

export async function persistWritingDatasetDraftsForRun(
  run: WritingRunRecord,
  repository: WritingDatasetDraftRepository,
  options: PersistWritingDatasetDraftsOptions = {},
): Promise<PersistWritingDatasetDraftsResult> {
  const at = options.at ?? new Date().toISOString();
  const datasetId = options.datasetId ?? WRITING_DATASET_DRAFT_ID;
  let dataset = await ensureDataset(repository, run, datasetId, at);
  const items = datasetDraftItemsForRun(run, datasetId, at);

  for (const item of items) {
    dataset = await repository.appendDatasetItem(datasetId, item);
  }

  return { dataset, items };
}

export async function promoteWritingDatasetDraftsForRun(
  run: WritingRunRecord,
  repository: WritingDatasetDraftRepository,
  options: PromoteWritingDatasetDraftsOptions,
): Promise<PersistWritingDatasetDraftsResult> {
  const confirmedBy = options.confirmedBy.trim();
  if (!confirmedBy) {
    throw new Error("confirmedBy is required to promote Writing dataset drafts");
  }

  const at = options.at ?? new Date().toISOString();
  const confirmedAt = options.confirmedAt ?? at;
  const datasetId = options.datasetId ?? WRITING_EVAL_DATASET_ID;
  const split = options.split ?? "validation";
  let dataset = await ensureDataset(repository, run, datasetId, at, {
    kind: "writing_eval_dataset",
    version: "eval-v1",
    metadata: {
      source: "writing_human_confirmed_eval_dataset",
      reviewStatus: "human_confirmed",
    },
  });
  const draftItems = datasetDraftItemsForRun(run, WRITING_DATASET_DRAFT_ID, at);
  const items = draftItems.map((item) =>
    confirmedDatasetItem(item, {
      datasetId,
      confirmedAt,
      confirmedBy,
      note: options.note,
      split,
    }),
  );

  for (const item of items) {
    dataset = await repository.appendDatasetItem(datasetId, item);
  }

  return { dataset, items };
}
