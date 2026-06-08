# generation-eval-loop Specification

## Purpose
TBD - created by archiving change add-writing-production-system. Update Purpose after archive.
## Requirements
### Requirement: Batch generation produces multiple candidates
The system SHALL generate multiple candidate drafts for a Writing Job rather than a single final answer.

#### Scenario: User confirms Precheck
- **WHEN** the user starts generation after Precheck
- **THEN** the system creates multiple candidate drafts tied to the same Content Brief and Writing Rules Candidate

### Requirement: Candidates are auto-evaluated
The system SHALL score each candidate draft with the current Eval Profile and show score breakdowns.

#### Scenario: Candidate generation completes
- **WHEN** draft candidates are available
- **THEN** each candidate shows total score, rule-level scores, and short rationale

#### Scenario: Core eval scores candidates
- **WHEN** candidate generation completes
- **THEN** the system evaluates candidates through the workflow-core eval runner
- **AND** stores candidate attribution with dimension, source, evidence, score, and pass/warning/blocked status
- **AND** maps the core eval result back into the Writing Job score breakdown without changing L1 UI concepts

### Requirement: Selection feedback feeds next iteration
The system MUST allow the user to select text in a candidate and attach lightweight review feedback that can update the next round.

#### Scenario: User tags selected text
- **WHEN** the user selects text and clicks a feedback tag
- **THEN** the system records the feedback in Feedback Ledger and compiles it into Rule Patch draft

### Requirement: Rule patches are capped and merged
The system MUST cap draft Rule Patches and merge similar or excess feedback instead of growing an unlimited rule stack.

#### Scenario: Draft patch pool reaches capacity
- **WHEN** new feedback arrives after the draft Rule Patch pool reaches 5 items
- **THEN** the system merges it into an existing draft and preserves feedback traceability

### Requirement: Next generation applies rule snapshots
The system SHALL apply draft Rule Patches only when the user starts the next generation run.

#### Scenario: User runs next batch
- **WHEN** the user clicks "Run next batch"
- **THEN** the system creates a new Rule Snapshot with at most 10 active rules and generates new candidates without rewriting old candidates

### Requirement: Eval Profile remains round-scoped until promoted
The system SHALL treat auto-created Eval Profile rules as round-scoped unless explicitly promoted into a reusable skill or preference profile.

#### Scenario: User edits Eval Profile in first round
- **WHEN** the user changes scoring weights for one job
- **THEN** the change applies to that round and is not automatically published as global policy

### Requirement: Similarity and factual risks are visible
The system SHALL flag over-imitation and factual drift risks during candidate evaluation.

#### Scenario: Candidate resembles reference too closely
- **WHEN** eval detects high similarity to a reference article
- **THEN** the candidate is marked with similarity risk and cannot be recommended without warning

### Requirement: LLM-like steps emit trace records
The system SHALL emit a unified LLM call trace record for every LLM-like step before Langfuse is connected.

#### Scenario: Runtime runs a generation loop step
- **WHEN** scope extraction, precheck normalization, candidate generation, feedback reasoning, or rule patch compilation runs
- **THEN** the system records provider, model, prompt version, input refs, output artifact, eval result, run id, node run id, and node type through TraceSink
- **AND** the record is available from the local run record until a Langfuse sink is attached

### Requirement: LLM runtime can be configured independently
The system SHALL provide a runtime settings surface for model provider configuration without coupling it to the writing job form.

#### Scenario: User tests a model runtime
- **WHEN** the user opens `/settings/llm` and runs Test Call for mock, Ollama, or OpenAI-compatible runtime
- **THEN** the system records a TraceSink test call with provider, model, prompt version, output artifact, eval result, and status
- **AND** API Key values are read only from environment variables, not saved through the UI

#### Scenario: User loads available runtime models
- **WHEN** the user loads models from `/settings/llm`
- **THEN** the system lists models from Ollama `/api/tags` or OpenAI-compatible `/models`
- **AND** the user can select a listed model while still being allowed to type a custom model name

#### Scenario: User generates Writing Rule Scope with a runtime model
- **WHEN** the user generates Writing Rule Scope from L1
- **THEN** the result shows provider, model, prompt version, trace id, and latency from the recorded LLM call

#### Scenario: Runtime call is in progress
- **WHEN** Scope extraction or Precheck normalization is running
- **THEN** L1 shows the active node, expected wait time, and a stop-waiting action
- **AND** stopping the wait does not delete already persisted historical run records
- **AND** failed or fallback traces are visibly marked in the Framework Viewer

