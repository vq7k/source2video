import type {
  ArtifactRecord,
  WorkflowJsonObject,
  WorkflowMetadata,
} from "@source2video/workflow-core/artifact";
import type { CoreEvalRunRecord } from "@source2video/workflow-core/eval";
import type { WorkflowFeedbackSignalRecord } from "@source2video/workflow-core/feedback";
import type { NodeRunRecord } from "@source2video/workflow-core/node";
import type { WorkflowRunRecord, WorkflowRunStatus } from "@source2video/workflow-core/run";

export type { FrameworkSqlClient, FrameworkSqlResult } from "./db";
export {
  frameworkMigrations,
  runFrameworkStoreMigrations,
  type FrameworkMigration,
  type FrameworkMigrationClient,
} from "./migrations";
export { createPostgresArtifactRepository, type ArtifactRepositoryOptions } from "./repositories/artifacts";
export { createPostgresJobRepository, type JobRepositoryOptions } from "./repositories/jobs";
export { createPostgresWorkflowRunRepository } from "./repositories/workflow-runs";

export type ListPage = {
  limit?: number;
  cursor?: string;
};

export type WorkflowRunListFilter = ListPage & {
  domain?: string;
  status?: WorkflowRunStatus;
  updatedAfter?: string;
};

export type ArtifactListFilter = ListPage & {
  kind?: string;
  runId?: string;
  nodeRunId?: string;
};

export type FrameworkJobStatus = "queued" | "leased" | "complete" | "failed" | "canceled";

export type FrameworkJobRecord = {
  id: string;
  kind: string;
  status: FrameworkJobStatus;
  runId?: string;
  nodeRunId?: string;
  leaseId?: string;
  workerId?: string;
  leasedAt?: string;
  leasedUntil?: string;
  completedAt?: string;
  failedAt?: string;
  error?: string;
  result?: WorkflowJsonObject;
  priority: number;
  payload: WorkflowJsonObject;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  createdAt: string;
  updatedAt: string;
  metadata: WorkflowMetadata;
};

export type EnqueueJobInput = {
  id?: string;
  kind: string;
  runId?: string;
  nodeRunId?: string;
  priority?: number;
  payload?: WorkflowJsonObject;
  maxAttempts?: number;
  availableAt?: string;
  metadata?: WorkflowMetadata;
};

export type LeaseJobInput = {
  workerId: string;
  leaseDurationMs: number;
  kinds?: string[];
};

export type FrameworkJobLease = {
  job: FrameworkJobRecord;
  leaseId: string;
  leasedUntil: string;
};

export type CompleteJobInput = {
  jobId: string;
  leaseId: string;
  completedAt?: string;
  result?: WorkflowJsonObject;
  metadata?: WorkflowMetadata;
};

export type FailJobInput = {
  jobId: string;
  leaseId: string;
  error: string;
  retryAt?: string;
  failedAt?: string;
  metadata?: WorkflowMetadata;
};

export type FrameworkDatasetItem = {
  id: string;
  datasetId: string;
  inputArtifacts: ArtifactRecord[];
  expectedArtifacts: ArtifactRecord[];
  metadata: WorkflowMetadata;
};

export type FrameworkDatasetRecord = {
  id: string;
  kind: string;
  version: string;
  items: FrameworkDatasetItem[];
  createdAt: string;
  updatedAt: string;
  metadata: WorkflowMetadata;
};

export type DatasetListFilter = ListPage & {
  kind?: string;
  version?: string;
};

export type WorkflowRunRepository = {
  putRun(run: WorkflowRunRecord): Promise<WorkflowRunRecord>;
  getRun(runId: string): Promise<WorkflowRunRecord | null>;
  listRuns(filter?: WorkflowRunListFilter): Promise<WorkflowRunRecord[]>;
  appendNodeRun(runId: string, nodeRun: NodeRunRecord): Promise<WorkflowRunRecord>;
  appendEvalRun(runId: string, evalRun: CoreEvalRunRecord): Promise<WorkflowRunRecord>;
  appendFeedbackSignal(runId: string, feedback: WorkflowFeedbackSignalRecord): Promise<WorkflowRunRecord>;
};

export type ArtifactRepository = {
  putArtifact(artifact: ArtifactRecord): Promise<ArtifactRecord>;
  getArtifact(artifactId: string): Promise<ArtifactRecord | null>;
  listArtifacts(filter?: ArtifactListFilter): Promise<ArtifactRecord[]>;
};

export type JobRepository = {
  enqueueJob(input: EnqueueJobInput): Promise<FrameworkJobRecord>;
  leaseJob(input: LeaseJobInput): Promise<FrameworkJobLease | null>;
  completeJob(input: CompleteJobInput): Promise<FrameworkJobRecord>;
  failJob(input: FailJobInput): Promise<FrameworkJobRecord>;
};

export type DatasetRepository = {
  putDataset(dataset: FrameworkDatasetRecord): Promise<FrameworkDatasetRecord>;
  getDataset(datasetId: string): Promise<FrameworkDatasetRecord | null>;
  listDatasets(filter?: DatasetListFilter): Promise<FrameworkDatasetRecord[]>;
  appendDatasetItem(datasetId: string, item: FrameworkDatasetItem): Promise<FrameworkDatasetRecord>;
};

export type FrameworkStore = {
  workflowRuns: WorkflowRunRepository;
  artifacts: ArtifactRepository;
  jobs: JobRepository;
  datasets: DatasetRepository;
};
