export type {
  CompleteJobInput,
  FailJobInput,
  FrameworkJobLease,
  FrameworkJobRecord,
  JobRepository,
  LeaseJobInput,
} from "../../framework-store/src/index";

export type FrameworkWorkerOnceResult =
  | {
      status: "idle";
    }
  | {
      status: "completed";
      job: import("../../framework-store/src/index").FrameworkJobRecord;
    }
  | {
      status: "failed";
      job: import("../../framework-store/src/index").FrameworkJobRecord;
      error: Error;
    };
