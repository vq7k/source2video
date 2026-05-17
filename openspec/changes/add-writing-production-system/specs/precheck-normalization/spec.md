## ADDED Requirements

### Requirement: Precheck produces fixed structured outputs
The system SHALL run Precheck before generation and produce Content Brief, Writing Rules Candidate, Eval Profile, and Risk List.

#### Scenario: Precheck completes successfully
- **WHEN** the user submits a Writing Job
- **THEN** the system presents Content Brief, Writing Rules Candidate, Eval Profile, and Risk List for user confirmation

#### Scenario: Runtime model normalizes Precheck
- **WHEN** a configured runtime model is available
- **THEN** Precheck Normalization uses the provider to generate Content Brief, Grounding Brief, Writing Rules Candidate, and Risk List
- **AND** the L1 Precheck area shows provider, model, prompt version, trace id, and latency
- **AND** failed runtime calls fall back to deterministic Precheck with a visible warning

### Requirement: Content Brief is single-use task data
The system SHALL treat Content Brief as the normalized representation of this job's goal, facts, claims, audience, channel, constraints, and missing information.

#### Scenario: Raw material contains unclear facts
- **WHEN** Precheck detects claims without evidence
- **THEN** Content Brief lists them as uncertain facts and Risk List marks evidence gaps

### Requirement: Writing Rules Candidate captures reusable method
The system SHALL compile reference articles, external writing method packages, and review preferences into a Writing Rules Candidate containing structure, rhythm, tone, reasoning moves, checklist, and prohibitions.

#### Scenario: External writing method package is provided
- **WHEN** the user includes another author's writing method package
- **THEN** Precheck extracts process rules and checklists into Writing Rules Candidate

### Requirement: Scope extraction is separately evaluable
The system SHALL treat Manual Rule Scope extraction as a distinct eval surface from Job candidate evaluation.

#### Scenario: Reference paste is transformed into scope
- **WHEN** the system extracts Writing Rule Scope from a pasted reference
- **THEN** the eval checks whether the extracted structure, tone, prohibitions, and source notes are faithful to the reference
- **AND** the eval flags over-imitation or unsupported rules before they affect Baseline Stack

### Requirement: Eval Profile is auto-created for first round
The system MUST create a non-empty Eval Profile during Precheck using system defaults, Job Spec-derived rules, and style/preference-derived rules.

#### Scenario: No historical preference exists
- **WHEN** the first job for a new project is created
- **THEN** Eval Profile still contains baseline quality, task-fit, and style/preference scoring rules

### Requirement: Precheck requires confirmation before generation
The system SHALL not start batch generation until the user confirms or explicitly accepts the Precheck outputs.

#### Scenario: User sees risk list
- **WHEN** Precheck reports missing facts or high similarity risk
- **THEN** the user can revise inputs or continue with acknowledged risks
