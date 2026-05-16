## ADDED Requirements

### Requirement: Precheck produces fixed structured outputs
The system SHALL run Precheck before generation and produce Content Brief, Writing Skill Candidate, Eval Profile, and Risk List.

#### Scenario: Precheck completes successfully
- **WHEN** the user submits a Writing Job
- **THEN** the system presents Content Brief, Writing Skill Candidate, Eval Profile, and Risk List for user confirmation

### Requirement: Content Brief is single-use task data
The system SHALL treat Content Brief as the normalized representation of this job's goal, facts, claims, audience, channel, constraints, and missing information.

#### Scenario: Raw material contains unclear facts
- **WHEN** Precheck detects claims without evidence
- **THEN** Content Brief lists them as uncertain facts and Risk List marks evidence gaps

### Requirement: Writing Skill Candidate captures reusable method
The system SHALL compile reference articles, external writing skills, and review preferences into a Writing Skill Candidate containing structure, rhythm, tone, reasoning moves, checklist, and prohibitions.

#### Scenario: External writing skill is provided
- **WHEN** the user includes another author's writing skill
- **THEN** Precheck extracts process rules and checklists into Writing Skill Candidate

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
