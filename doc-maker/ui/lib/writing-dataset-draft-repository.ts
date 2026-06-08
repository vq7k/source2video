import {
  createPgSqlClient,
  createPostgresDatasetRepository,
  runFrameworkStoreMigrations,
} from "@source2video/framework-store";
import type { PgSqlClient } from "@source2video/framework-store";
import type { WritingDatasetDraftRepository } from "@doc-maker/writing-domain/dataset-draft-persistence";

type RepositoryProvider = () => WritingDatasetDraftRepository | null;

let repositoryProvider: RepositoryProvider | null = null;

let cachedClient: PgSqlClient | null = null;
let cachedRepository: WritingDatasetDraftRepository | null = null;
let migrationPromise: Promise<void> | null = null;

function repositoryWithMigration(
  repository: WritingDatasetDraftRepository,
  client: PgSqlClient,
): WritingDatasetDraftRepository {
  async function ensureMigrated() {
    migrationPromise ??= runFrameworkStoreMigrations(client)
      .then(() => undefined)
      .catch((error) => {
        migrationPromise = null;
        throw error;
      });
    await migrationPromise;
  }

  return {
    async getDataset(datasetId) {
      await ensureMigrated();
      return repository.getDataset ? repository.getDataset(datasetId) : null;
    },
    async putDataset(dataset) {
      await ensureMigrated();
      return repository.putDataset(dataset);
    },
    async appendDatasetItem(datasetId, item) {
      await ensureMigrated();
      return repository.appendDatasetItem(datasetId, item);
    },
  };
}

/**
 * Default production provider: when `FRAMEWORK_DATABASE_URL` is configured, lazily
 * build a Postgres-backed dataset repository (caching the underlying pg client as a
 * module singleton). With no connection string we return null so the API route keeps
 * answering `503 repository_unconfigured`.
 */
function resolveDefaultRepository(): WritingDatasetDraftRepository | null {
  const connectionString = process.env.FRAMEWORK_DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  if (!cachedRepository) {
    cachedClient = createPgSqlClient({ connectionString });
    cachedRepository = repositoryWithMigration(
      createPostgresDatasetRepository(cachedClient),
      cachedClient,
    );
  }

  return cachedRepository;
}

export function getWritingDatasetDraftRepository() {
  if (repositoryProvider) {
    return repositoryProvider();
  }

  return resolveDefaultRepository();
}

export function setWritingDatasetDraftRepositoryProviderForTests(
  provider: RepositoryProvider | null,
) {
  repositoryProvider = provider;
}
