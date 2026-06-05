create table if not exists framework_schema_migrations (
  id text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);

create table if not exists framework_workflow_runs (
  id text primary key,
  domain text not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  input_artifacts_json jsonb not null default '[]'::jsonb,
  output_artifacts_json jsonb not null default '[]'::jsonb,
  eval_runs_json jsonb not null default '[]'::jsonb,
  feedback_signals_json jsonb not null default '[]'::jsonb,
  snapshots_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists framework_node_runs (
  id text primary key,
  run_id text not null references framework_workflow_runs(id) on delete cascade,
  node_id text not null,
  node_version text not null,
  status text not null,
  input_refs_json jsonb not null default '[]'::jsonb,
  output_refs_json jsonb not null default '[]'::jsonb,
  eval_run_refs_json jsonb not null default '[]'::jsonb,
  trace_refs_json jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  completed_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists framework_artifacts (
  id text primary key,
  run_id text references framework_workflow_runs(id) on delete set null,
  node_run_id text references framework_node_runs(id) on delete set null,
  kind text not null,
  version text not null,
  uri text,
  summary text not null,
  material_refs_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists framework_feedback_events (
  id text primary key,
  run_id text not null references framework_workflow_runs(id) on delete cascade,
  node_run_id text references framework_node_runs(id) on delete set null,
  target_artifact_ref_json jsonb not null,
  status text not null,
  verdict text,
  quote text,
  issue text,
  expected text,
  confidence text,
  metadata_json jsonb not null default '{}'::jsonb,
  event_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists framework_jobs (
  id text primary key,
  kind text not null,
  status text not null,
  run_id text references framework_workflow_runs(id) on delete set null,
  node_run_id text references framework_node_runs(id) on delete set null,
  priority integer not null default 100,
  payload_json jsonb not null,
  result_json jsonb,
  error_json jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  locked_by text,
  locked_at timestamptz,
  lease_id text,
  leased_until timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists framework_datasets (
  id text primary key,
  kind text not null,
  version text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists framework_dataset_items (
  id text primary key,
  dataset_id text not null references framework_datasets(id) on delete cascade,
  input_artifacts_json jsonb not null default '[]'::jsonb,
  expected_artifacts_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb
);

create table if not exists framework_experiments (
  id text primary key,
  dataset_id text references framework_datasets(id) on delete set null,
  kind text not null,
  status text not null,
  started_at timestamptz,
  completed_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists framework_release_gates (
  id text primary key,
  experiment_id text references framework_experiments(id) on delete set null,
  status text not null,
  result_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists framework_workflow_runs_domain_updated_at_idx
  on framework_workflow_runs(domain, updated_at desc);

create index if not exists framework_jobs_status_priority_run_after_idx
  on framework_jobs(status, priority, run_after);

create index if not exists framework_node_runs_run_id_idx
  on framework_node_runs(run_id);

create index if not exists framework_artifacts_run_id_idx
  on framework_artifacts(run_id);

create index if not exists framework_feedback_events_run_id_idx
  on framework_feedback_events(run_id);

create index if not exists framework_dataset_items_dataset_id_idx
  on framework_dataset_items(dataset_id);
