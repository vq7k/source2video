## ADDED Requirements

### Requirement: Job Spec fields are editable
The system SHALL allow the L1 Writing Job Workbench user to edit goal, source material, writing reference, and review preference fields before running Precheck.

#### Scenario: User edits source material
- **WHEN** the user changes any Job Spec field
- **THEN** the workbench marks the job as requiring Precheck again

### Requirement: Output Profile is visible during job creation
The system SHALL show the selected Output Profile alongside the Job Spec before Precheck runs.

#### Scenario: Default structured explanation package
- **WHEN** the user opens the Writing Job Workbench
- **THEN** the selected Output Profile is `structured explanation package` and lists `plan`, `scripts`, `shots`, `visual_spec`, and `qa_report`

### Requirement: Precheck gates candidate generation
The system MUST prevent Candidate Draft display until Precheck has been run and confirmed.

#### Scenario: Precheck not yet confirmed
- **WHEN** the job is in `needs-precheck` or `precheck-ready` state
- **THEN** the Candidate Drafts area shows a waiting state instead of draft candidates

#### Scenario: Precheck confirmed
- **WHEN** the user confirms the Precheck output
- **THEN** the Candidate Drafts area shows multiple draft candidates with auto score, score breakdown, risk, and human scoring entry

### Requirement: Precheck output reflects the current job
The system SHALL derive visible Precheck summary text from the current Job Spec and selected Output Profile.

#### Scenario: User runs Precheck
- **WHEN** the user clicks `Run Precheck`
- **THEN** the Content Brief references the current job title or goal and the selected Output Profile

### Requirement: Eval Profile remains non-empty in interactive flow
The system MUST keep the first-round Eval Profile non-empty after every Precheck run.

#### Scenario: First Precheck run
- **WHEN** the user runs Precheck for a job without historical preferences
- **THEN** the Eval Profile still shows baseline quality, task fit, style preference, and risk deduction rules
