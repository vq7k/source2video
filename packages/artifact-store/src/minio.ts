import type { ArtifactStore } from "./index";

export type S3CompatibleArtifactStoreConfig = {
  endpoint: string;
  bucket: string;
  region?: string;
  prefix?: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export function readS3CompatibleArtifactStoreConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): S3CompatibleArtifactStoreConfig | null {
  const endpoint = env.ARTIFACT_STORE_ENDPOINT?.trim();
  const bucket = env.ARTIFACT_STORE_BUCKET?.trim();
  const accessKeyId = env.ARTIFACT_STORE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.ARTIFACT_STORE_SECRET_ACCESS_KEY?.trim();

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: env.ARTIFACT_STORE_REGION?.trim() || undefined,
    prefix: env.ARTIFACT_STORE_PREFIX?.trim() || undefined,
  };
}

export function createS3CompatibleArtifactStoreFromEnv(
  env: Record<string, string | undefined> = process.env,
): ArtifactStore {
  const config = readS3CompatibleArtifactStoreConfigFromEnv(env);

  if (!config) {
    throw new Error("S3-compatible artifact store env is incomplete");
  }

  return {
    async putObject() {
      throw new Error("S3-compatible artifact store adapter boundary is not wired to an SDK");
    },

    async getObject() {
      throw new Error("S3-compatible artifact store adapter boundary is not wired to an SDK");
    },
  };
}
