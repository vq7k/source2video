## ADDED Requirements

### Requirement: Batch generation produces multiple candidates
The system SHALL generate multiple candidate drafts for a Writing Job rather than a single final answer.

#### Scenario: User confirms Precheck
- **WHEN** the user starts generation after Precheck
- **THEN** the system creates multiple candidate drafts tied to the same Content Brief and Writing Skill Candidate

### Requirement: Candidates are auto-evaluated
The system SHALL score each candidate draft with the current Eval Profile and show score breakdowns.

#### Scenario: Candidate generation completes
- **WHEN** draft candidates are available
- **THEN** each candidate shows total score, rule-level scores, and short rationale

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
