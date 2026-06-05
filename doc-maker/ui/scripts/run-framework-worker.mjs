#!/usr/bin/env node

const workerId = process.env.FRAMEWORK_WORKER_ID?.trim() || `framework-worker-${process.pid}`;

console.log(JSON.stringify({ workerId, status: "ready" }));
