import type { ArtifactRecord, WorkflowJsonObject, WorkflowMetadata } from "@source2video/workflow-core/artifact";

import type { FrameworkSqlClient } from "../db";
import type {
  DatasetListFilter,
  DatasetRepository,
  FrameworkDatasetItem,
  FrameworkDatasetRecord,
  FrameworkDatasetSplit,
} from "../index";

type DatasetRow = {
  id: string;
  kind: string;
  version: string;
  created_at: string | Date;
  updated_at: string | Date;
  metadata_json: unknown;
};

type DatasetItemRow = {
  id: string;
  dataset_id: string;
  input_artifacts_json: unknown;
  expected_artifacts_json: unknown;
  metadata_json: unknown;
};

type DatasetItemStoredFields = {
  sourceRunId?: string;
  sourceNodeRunId?: string;
  sourceArtifactId?: string;
  inputRef?: ArtifactRecord;
  expectedOutputRef?: ArtifactRecord;
  split?: FrameworkDatasetSplit;
  labels?: WorkflowJsonObject;
};

const itemProjectionMetadataKey = "frameworkDatasetItem";

function toJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function fromJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return (value ?? fallback) as T;
}

function timestamp(value: string | Date | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function compactStoredFields(item: FrameworkDatasetItem): DatasetItemStoredFields {
  const storedFields: DatasetItemStoredFields = {};

  if (item.sourceRunId) {
    storedFields.sourceRunId = item.sourceRunId;
  }
  if (item.sourceNodeRunId) {
    storedFields.sourceNodeRunId = item.sourceNodeRunId;
  }
  if (item.sourceArtifactId) {
    storedFields.sourceArtifactId = item.sourceArtifactId;
  }
  if (item.inputRef) {
    storedFields.inputRef = item.inputRef;
  }
  if (item.expectedOutputRef) {
    storedFields.expectedOutputRef = item.expectedOutputRef;
  }
  if (item.split) {
    storedFields.split = item.split;
  }
  if (item.labels) {
    storedFields.labels = item.labels;
  }

  return storedFields;
}

function itemMetadataForStorage(item: FrameworkDatasetItem) {
  const storedFields = compactStoredFields(item);

  if (Object.keys(storedFields).length === 0) {
    return item.metadata;
  }

  return {
    ...item.metadata,
    [itemProjectionMetadataKey]: storedFields,
  };
}

function itemFromRow(row: DatasetItemRow): FrameworkDatasetItem {
  const metadataJson = fromJson<WorkflowMetadata>(row.metadata_json, {});
  const storedFields = metadataJson[itemProjectionMetadataKey] as DatasetItemStoredFields | undefined;
  const { [itemProjectionMetadataKey]: _storedFields, ...metadata } = metadataJson;

  return {
    id: row.id,
    datasetId: row.dataset_id,
    inputArtifacts: fromJson(row.input_artifacts_json, []),
    expectedArtifacts: fromJson(row.expected_artifacts_json, []),
    ...(storedFields ?? {}),
    metadata,
  };
}

function datasetFromRow(row: DatasetRow, items: FrameworkDatasetItem[]): FrameworkDatasetRecord {
  return {
    id: row.id,
    kind: row.kind,
    version: row.version,
    items,
    createdAt: timestamp(row.created_at) ?? "",
    updatedAt: timestamp(row.updated_at) ?? "",
    metadata: fromJson(row.metadata_json, {}),
  };
}

export function createPostgresDatasetRepository(client: FrameworkSqlClient): DatasetRepository {
  async function putDatasetItem(item: FrameworkDatasetItem) {
    const result = await client.query<DatasetItemRow>(
      `
        insert into framework_dataset_items (
          id,
          dataset_id,
          input_artifacts_json,
          expected_artifacts_json,
          metadata_json
        )
        values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)
        on conflict (id) do update set
          dataset_id = excluded.dataset_id,
          input_artifacts_json = excluded.input_artifacts_json,
          expected_artifacts_json = excluded.expected_artifacts_json,
          metadata_json = excluded.metadata_json
        returning *
      `,
      [
        item.id,
        item.datasetId,
        toJson(item.inputArtifacts),
        toJson(item.expectedArtifacts),
        toJson(itemMetadataForStorage(item)),
      ],
    );

    return itemFromRow(result.rows[0]);
  }

  async function listItems(datasetId: string) {
    const result = await client.query<DatasetItemRow>(
      `
        select *
        from framework_dataset_items
        where dataset_id = $1
        order by id asc
      `,
      [datasetId],
    );

    return result.rows.map(itemFromRow);
  }

  async function hydrateDataset(row: DatasetRow) {
    return datasetFromRow(row, await listItems(row.id));
  }

  return {
    async putDataset(dataset) {
      const result = await client.query<DatasetRow>(
        `
          insert into framework_datasets (
            id,
            kind,
            version,
            created_at,
            updated_at,
            metadata_json
          )
          values ($1, $2, $3, $4, $5, $6::jsonb)
          on conflict (id) do update set
            kind = excluded.kind,
            version = excluded.version,
            updated_at = excluded.updated_at,
            metadata_json = excluded.metadata_json
          returning *
        `,
        [dataset.id, dataset.kind, dataset.version, dataset.createdAt, dataset.updatedAt, toJson(dataset.metadata)],
      );

      for (const item of dataset.items) {
        await putDatasetItem(item);
      }

      return hydrateDataset(result.rows[0]);
    },

    async getDataset(datasetId) {
      const result = await client.query<DatasetRow>(
        `
          select *
          from framework_datasets
          where id = $1
        `,
        [datasetId],
      );
      const row = result.rows[0];

      return row ? hydrateDataset(row) : null;
    },

    async listDatasets(filter: DatasetListFilter = {}) {
      const parameters: unknown[] = [];
      const clauses: string[] = [];

      if (filter.kind) {
        parameters.push(filter.kind);
        clauses.push(`kind = $${parameters.length}`);
      }
      if (filter.version) {
        parameters.push(filter.version);
        clauses.push(`version = $${parameters.length}`);
      }

      const limit = filter.limit ?? 100;
      parameters.push(limit);
      const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
      const result = await client.query<DatasetRow>(
        `
          select *
          from framework_datasets
          ${where}
          order by updated_at desc, id asc
          limit $${parameters.length}
        `,
        parameters,
      );

      return Promise.all(result.rows.map(hydrateDataset));
    },

    async appendDatasetItem(datasetId, item) {
      await putDatasetItem({
        ...item,
        datasetId,
      });
      const dataset = await this.getDataset(datasetId);
      if (!dataset) {
        throw new Error(`Dataset not found: ${datasetId}`);
      }

      return dataset;
    },
  };
}
