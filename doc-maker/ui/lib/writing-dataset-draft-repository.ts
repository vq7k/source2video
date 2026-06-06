import { createPgSqlClient, createPostgresDatasetRepository } from "@source2video/framework-store";
import type { PgSqlClient } from "@source2video/framework-store";
import type { WritingDatasetDraftRepository } from "@doc-maker/writing-domain/dataset-draft-persistence";

type RepositoryProvider = () => WritingDatasetDraftRepository | null;

let repositoryProvider: RepositoryProvider | null = null;

let cachedClient: PgSqlClient | null = null;
let cachedRepository: WritingDatasetDraftRepository | null = null;

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
    cachedRepository = createPostgresDatasetRepository(cachedClient);
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
