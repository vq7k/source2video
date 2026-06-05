import type { WritingDatasetDraftRepository } from "@doc-maker/writing-domain/dataset-draft-persistence";

type RepositoryProvider = () => WritingDatasetDraftRepository | null;

let repositoryProvider: RepositoryProvider | null = null;

export function getWritingDatasetDraftRepository() {
  return repositoryProvider ? repositoryProvider() : null;
}

export function setWritingDatasetDraftRepositoryProviderForTests(
  provider: RepositoryProvider | null,
) {
  repositoryProvider = provider;
}
