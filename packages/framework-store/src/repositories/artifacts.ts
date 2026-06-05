import { createHash } from "node:crypto";

import type {
  ArtifactPayloadInput,
  ArtifactPayloadMetadata,
  ArtifactRecord,
  WorkflowMetadata,
} from "@source2video/workflow-core/artifact";

import type { FrameworkSqlClient } from "../db";
import type { ArtifactListFilter, ArtifactRepository } from "../index";

type ArtifactRow = {
  id: string;
  run_id?: string | null;
  node_run_id?: string | null;
  kind: string;
  version: string;
  uri?: string | null;
  summary: string;
  material_refs_json: unknown;
  metadata_json: unknown;
  created_at: string | Date;
  updated_at: string | Date;
};

type ArtifactObjectStore = {
  putObject(input: {
    key?: string;
    bytes: Uint8Array;
    contentType?: string;
  }): Promise<{
    uri: string;
    contentHash: string;
    byteLength: number;
  }>;
};

export type ArtifactRepositoryOptions = {
  store?: ArtifactObjectStore;
  inlinePayloadMaxBytes?: number;
};

const defaultInlinePayloadMaxBytes = 16 * 1024;

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

function hashBytes(bytes: Uint8Array) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function encodePayload(payload: ArtifactPayloadInput) {
  if ("bytes" in payload) {
    return {
      bytes: payload.bytes,
      inlineValue: undefined,
      contentType: payload.contentType,
    };
  }

  const encoding = payload.encoding ?? "utf8";
  const bytes = Buffer.from(payload.value, encoding);

  return {
    bytes,
    inlineValue: payload.value,
    contentType: payload.contentType,
  };
}

function artifactFromRow(row: ArtifactRow): ArtifactRecord {
  return {
    id: row.id,
    kind: row.kind,
    version: row.version,
    uri: row.uri ?? undefined,
    summary: row.summary,
    materialRefs: fromJson(row.material_refs_json, []),
    metadata: fromJson(row.metadata_json, {}),
    runId: row.run_id ?? undefined,
    nodeRunId: row.node_run_id ?? undefined,
    createdAt: timestamp(row.created_at) ?? "",
    updatedAt: timestamp(row.updated_at) ?? "",
  };
}

async function prepareArtifact(
  artifact: ArtifactRecord,
  options: Required<Pick<ArtifactRepositoryOptions, "inlinePayloadMaxBytes">> & Pick<ArtifactRepositoryOptions, "store">,
) {
  if (!artifact.payload) {
    return artifact;
  }

  const payload = encodePayload(artifact.payload);
  const contentHash = hashBytes(payload.bytes);
  const byteLength = payload.bytes.byteLength;
  let uri = artifact.uri;
  let payloadMetadata: ArtifactPayloadMetadata;

  if (byteLength <= options.inlinePayloadMaxBytes) {
    payloadMetadata = {
      contentType: payload.contentType,
      contentHash,
      byteLength,
      inlineValue: payload.inlineValue,
    };
  } else {
    if (!options.store) {
      throw new Error("Artifact store is required for payloads larger than inlinePayloadMaxBytes");
    }

    const stored = await options.store.putObject({
      key: artifact.id,
      bytes: payload.bytes,
      contentType: payload.contentType,
    });
    uri = stored.uri;
    payloadMetadata = {
      contentType: payload.contentType,
      contentHash: stored.contentHash,
      byteLength: stored.byteLength,
      uri,
    };
  }

  const metadata: WorkflowMetadata = {
    ...artifact.metadata,
    artifactPayload: payloadMetadata,
  };
  const { payload: _payload, ...record } = artifact;

  return {
    ...record,
    uri,
    metadata,
  };
}

export function createPostgresArtifactRepository(
  client: FrameworkSqlClient,
  options: ArtifactRepositoryOptions = {},
): ArtifactRepository {
  const repositoryOptions = {
    inlinePayloadMaxBytes: options.inlinePayloadMaxBytes ?? defaultInlinePayloadMaxBytes,
    store: options.store,
  };

  return {
    async putArtifact(artifact) {
      const record = await prepareArtifact(artifact, repositoryOptions);
      const result = await client.query<ArtifactRow>(
        `
          insert into framework_artifacts (
            id,
            run_id,
            node_run_id,
            kind,
            version,
            uri,
            summary,
            material_refs_json,
            metadata_json,
            created_at,
            updated_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)
          on conflict (id) do update set
            run_id = excluded.run_id,
            node_run_id = excluded.node_run_id,
            kind = excluded.kind,
            version = excluded.version,
            uri = excluded.uri,
            summary = excluded.summary,
            material_refs_json = excluded.material_refs_json,
            metadata_json = excluded.metadata_json,
            updated_at = excluded.updated_at
          returning *
        `,
        [
          record.id,
          record.runId,
          record.nodeRunId,
          record.kind,
          record.version,
          record.uri,
          record.summary,
          toJson(record.materialRefs),
          toJson(record.metadata),
          record.createdAt,
          record.updatedAt,
        ],
      );

      return artifactFromRow(result.rows[0]);
    },

    async getArtifact(artifactId) {
      const result = await client.query<ArtifactRow>(
        `
          select *
          from framework_artifacts
          where id = $1
        `,
        [artifactId],
      );
      const row = result.rows[0];

      return row ? artifactFromRow(row) : null;
    },

    async listArtifacts(filter: ArtifactListFilter = {}) {
      const parameters: unknown[] = [];
      const clauses: string[] = [];

      if (filter.kind) {
        parameters.push(filter.kind);
        clauses.push(`kind = $${parameters.length}`);
      }
      if (filter.runId) {
        parameters.push(filter.runId);
        clauses.push(`run_id = $${parameters.length}`);
      }
      if (filter.nodeRunId) {
        parameters.push(filter.nodeRunId);
        clauses.push(`node_run_id = $${parameters.length}`);
      }

      const limit = filter.limit ?? 100;
      parameters.push(limit);
      const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
      const result = await client.query<ArtifactRow>(
        `
          select *
          from framework_artifacts
          ${where}
          order by updated_at desc, id asc
          limit $${parameters.length}
        `,
        parameters,
      );

      return result.rows.map(artifactFromRow);
    },
  };
}
