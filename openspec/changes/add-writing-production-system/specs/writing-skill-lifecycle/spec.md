## ADDED Requirements

### Requirement: Writing Skill Candidate can iterate
The system SHALL version Writing Skill Candidate across rounds based on eval results and human feedback.

#### Scenario: Second generation round starts
- **WHEN** the user starts another round after scoring candidates
- **THEN** the system creates a new candidate skill version or records no-change rationale

### Requirement: Published Writing Skill requires stability evidence
The system MUST require eval history, converged human feedback, risk checks, and version notes before publishing a Writing Skill.

#### Scenario: User tries to publish after one weak round
- **WHEN** the candidate skill lacks enough evidence or has high similarity risk
- **THEN** the system blocks publishing and shows missing evidence

### Requirement: Published skill is reusable asset
The system SHALL make Published Writing Skills selectable in future Writing Jobs as writing method input.

#### Scenario: User creates a new job
- **WHEN** at least one Writing Skill is published
- **THEN** the job creation UI can select it as a reusable writing method

### Requirement: Baseline does not publish skills
The baseline prototype MUST keep Writing Skill publishing out of the normal L1 flow.

#### Scenario: User completes one generation round
- **WHEN** candidates and feedback exist for a Writing Job
- **THEN** the system may update Writing Skill Candidate and Rule Snapshot, but SHALL NOT publish a reusable skill automatically

### Requirement: Skill export is separate from product editing
The system SHALL keep product-facing skill editing separate from technical export formats such as Codex or Claude `SKILL.md`.

#### Scenario: User wants technical export
- **WHEN** the user requests export
- **THEN** the system can generate a technical skill package from the published writing skill without exposing that format during normal editing
