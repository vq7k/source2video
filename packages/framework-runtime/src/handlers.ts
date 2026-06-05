import type { WorkflowJsonObject } from "@source2video/workflow-core/artifact";

import type { FrameworkJobRecord } from "./jobs";

export type FrameworkJobHandlerContext = {
  workerId: string;
};

export type FrameworkJobHandler = (
  job: FrameworkJobRecord,
  context: FrameworkJobHandlerContext,
) => Promise<WorkflowJsonObject | void> | WorkflowJsonObject | void;

export type FrameworkHandlerRegistry = {
  register(kind: string, handler: FrameworkJobHandler): void;
  get(kind: string): FrameworkJobHandler | undefined;
  has(kind: string): boolean;
};

export function createHandlerRegistry(initialHandlers: Record<string, FrameworkJobHandler> = {}): FrameworkHandlerRegistry {
  const handlers = new Map<string, FrameworkJobHandler>(Object.entries(initialHandlers));

  return {
    register(kind, handler) {
      handlers.set(kind, handler);
    },

    get(kind) {
      return handlers.get(kind);
    },

    has(kind) {
      return handlers.has(kind);
    },
  };
}
