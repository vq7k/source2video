import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type ArtifactStoreWriteInput = {
  key?: string;
  bytes: Uint8Array;
  contentType?: string;
};

export type ArtifactStoreWriteResult = {
  uri: string;
  contentHash: string;
  byteLength: number;
};

export type ArtifactStoreReadResult = ArtifactStoreWriteResult & {
  bytes: Uint8Array;
  contentType?: string;
};

export type ArtifactStore = {
  putObject(input: ArtifactStoreWriteInput): Promise<ArtifactStoreWriteResult>;
  getObject(uri: string): Promise<ArtifactStoreReadResult>;
};

export type FilesystemArtifactStoreOptions = {
  rootDir: string;
};

export function artifactContentHash(bytes: Uint8Array) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function objectFilename(contentHash: string) {
  return contentHash.replace(/^sha256:/, "");
}

export function createFilesystemArtifactStore(options: FilesystemArtifactStoreOptions): ArtifactStore {
  const rootDir = path.resolve(options.rootDir);

  return {
    async putObject(input) {
      const contentHash = artifactContentHash(input.bytes);
      const filePath = path.join(rootDir, objectFilename(contentHash));

      await fs.mkdir(rootDir, { recursive: true });
      await fs.writeFile(filePath, input.bytes);

      return {
        uri: pathToFileURL(filePath).href,
        contentHash,
        byteLength: input.bytes.byteLength,
      };
    },

    async getObject(uri) {
      const filePath = fileURLToPath(uri);
      const bytes = await fs.readFile(filePath);
      const contentHash = artifactContentHash(bytes);

      return {
        uri,
        bytes,
        contentHash,
        byteLength: bytes.byteLength,
      };
    },
  };
}
