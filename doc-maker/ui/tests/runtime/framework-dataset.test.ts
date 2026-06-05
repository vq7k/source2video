import { describe, expect, it } from "vitest";

import type { ArtifactRecord, WorkflowJsonObject } from "@source2video/workflow-core/artifact";
import type {
  FrameworkDatasetItem,
  FrameworkDatasetRecord,
} from "../../../../packages/framework-store/src/index";

type QueryResult<T> = {
  rows: T[];
};

type DatasetRow = {
  id: string;
  kind: string;
  version: string;
  created_at: string;
  updated_at: string;
  metadata_json: string;
};

type DatasetItemRow = {
  id: string;
  dataset_id: string;
  input_artifacts_json: string;
  expected_artifacts_json: string;
  metadata_json: string;
};

function compactSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

class FakeDatasetSqlClient {
  readonly datasets = new Map<string, DatasetRow>();
  readonly items = new Map<string, DatasetItemRow[]>();
  readonly queries: Array<{ sql: string; parameters: readonly unknown[] }> = [];

  async query<T>(sql: string, parameters: readonly unknown[] = []): Promise<QueryResult<T>> {
    this.queries.push({ sql, parameters });
    const normalized = compactSql(sql);

    if (normalized.includes("insert into framework_datasets")) {
      const row: DatasetRow = {
        id: parameters[0] as string,
        kind: parameters[1] as string,
        version: parameters[2] as string,
        created_at: parameters[3] as string,
        updated_at: parameters[4] as string,
        metadata_json: parameters[5] as string,
      };
      this.datasets.set(row.id, row);
      return { rows: [row as T] };
    }

    if (normalized.includes("insert into framework_dataset_items")) {
      const row: DatasetItemRow = {
        id: parameters[0] as string,
        dataset_id: parameters[1] as string,
        input_artifacts_json: parameters[2] as string,
        expected_artifacts_json: parameters[3] as string,
        metadata_json: parameters[4] as string,
      };
      const rows = this.items.get(row.dataset_id) ?? [];
      const nextRows = rows.filter((item) => item.id !== row.id);
      nextRows.push(row);
      this.items.set(row.dataset_id, nextRows);
      return { rows: [row as T] };
    }

    if (normalized.includes("from framework_datasets") && normalized.includes("where id = $1")) {
      const row = this.datasets.get(parameters[0] as string);
      return { rows: row ? [row as T] : [] };
    }

    if (normalized.includes("from framework_datasets") && normalized.includes("where kind = $1")) {
      const rows = Array.from(this.datasets.values()).filter((row) => row.kind === parameters[0]);
      return { rows: rows as T[] };
    }

    if (normalized.includes("from framework_datasets")) {
      return { rows: Array.from(this.datasets.values()) as T[] };
    }

    if (normalized.includes("from framework_dataset_items") && normalized.includes("where dataset_id = $1")) {
      return { rows: (this.items.get(parameters[0] as string) ?? []) as T[] };
    }

    throw new Error(`Unhandled SQL in fake client: ${normalized}`);
  }
}

describe("framework dataset repository", () => {
  it("upserts, fetches, and lists generic datasets with parameterized SQL", async () => {
    const { createPostgresDatasetRepository } = await import("../../../../packages/framework-store/src/index");
    const client = new FakeDatasetSqlClient();
    const repository = createPostgresDatasetRepository(client);
    const at = "2026-06-05T00:00:00.000Z";
    const dataset: FrameworkDatasetRecord = {
      id: "dataset_regression_v1",
      kind: "regression",
      version: "v1",
      items: [],
      createdAt: at,
      updatedAt: at,
      metadata: { owner: "framework", active: true },
    };

    const created = await repository.putDataset(dataset);
    const updated = await repository.putDataset({
      ...dataset,
      version: "v2",
      updatedAt: "2026-06-05T01:00:00.000Z",
      metadata: { owner: "framework", active: false },
    });

    await expect(repository.getDataset(dataset.id)).resolves.toEqual(updated);
    await expect(repository.listDatasets({ kind: "regression" })).resolves.toEqual([updated]);
    expect(created.metadata.active).toBe(true);
    expect(client.queries.every((query) => Array.isArray(query.parameters))).toBe(true);
    expect(client.queries.some((query) => query.parameters.length > 0)).toBe(true);
    expect(client.queries.map((query) => query.sql).join("\n")).not.toContain("dataset_regression_v1");
  });

  it("appends draft items while preserving source refs, split, labels, and metadata", async () => {
    const { createPostgresDatasetRepository } = await import("../../../../packages/framework-store/src/index");
    const client = new FakeDatasetSqlClient();
    const repository = createPostgresDatasetRepository(client);
    const at = "2026-06-05T00:00:00.000Z";
    const inputRef: ArtifactRecord = {
      id: "artifact_input_1",
      kind: "input",
      version: "v1",
      summary: "input fixture",
      materialRefs: ["run_1"],
      metadata: { slot: "input" },
      createdAt: at,
      updatedAt: at,
    };
    const expectedOutputRef: ArtifactRecord = {
      id: "artifact_expected_1",
      kind: "expected_output",
      version: "v1",
      summary: "expected fixture",
      materialRefs: ["artifact_candidate_1"],
      metadata: { slot: "expected" },
      createdAt: at,
      updatedAt: at,
    };
    const labels: WorkflowJsonObject = {
      verdict: "accepted",
      confidence: "high",
      needsHumanConfirmation: true,
    };
    const dataset: FrameworkDatasetRecord = {
      id: "dataset_drafts",
      kind: "regression",
      version: "draft",
      items: [],
      createdAt: at,
      updatedAt: at,
      metadata: {},
    };
    const draftItem: FrameworkDatasetItem = {
      id: "dataset_item_1",
      datasetId: dataset.id,
      sourceRunId: "run_1",
      sourceArtifactId: "artifact_candidate_1",
      inputRef,
      expectedOutputRef,
      split: "draft",
      labels,
      inputArtifacts: [inputRef],
      expectedArtifacts: [expectedOutputRef],
      metadata: { domain: "generic", reviewStatus: "needs_human_confirmation" },
    };

    await repository.putDataset(dataset);
    const withDraftItem = await repository.appendDatasetItem(dataset.id, draftItem);

    expect(withDraftItem.items).toEqual([draftItem]);
    await expect(repository.getDataset(dataset.id)).resolves.toEqual(withDraftItem);
    expect(client.items.get(dataset.id)?.[0]?.metadata_json).toContain("reviewStatus");
    expect(client.items.get(dataset.id)?.[0]?.metadata_json).toContain("frameworkDatasetItem");
    expect(client.queries.every((query) => Array.isArray(query.parameters))).toBe(true);
  });
});
