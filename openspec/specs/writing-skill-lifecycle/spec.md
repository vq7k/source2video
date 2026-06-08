# writing-skill-lifecycle Specification

## Purpose
TBD - created by archiving change add-writing-production-system. Update Purpose after archive.
## Requirements
### Requirement: Writing Rules Candidate can iterate
The system SHALL version Writing Rules Candidate across rounds based on eval results and human feedback.

#### Scenario: Second generation round starts
- **WHEN** the user starts another round after scoring candidates
- **THEN** the system creates a new writing rules candidate version or records no-change rationale

### Requirement: Published Skill Package requires stability evidence
The system MUST require eval history, converged human feedback, risk checks, and version notes before publishing a Skill Package.

#### Scenario: User tries to publish after one weak round
- **WHEN** the candidate rules asset lacks enough evidence or has high similarity risk
- **THEN** the system blocks publishing and shows missing evidence

### Requirement: Published Skill Package is reusable asset
The system SHALL make Published Skill Packages selectable in future Writing Jobs as writing method input.

#### Scenario: User creates a new job
- **WHEN** at least one Skill Package is published
- **THEN** the job creation UI can select it as a reusable writing method

### Requirement: Baseline does not publish Skill Packages
The baseline prototype MUST keep Skill Package publishing out of the normal L1 flow.

#### Scenario: User completes one generation round
- **WHEN** candidates and feedback exist for a Writing Job
- **THEN** the system may update Writing Rules Candidate and Rule Snapshot, but SHALL NOT publish a reusable Skill Package automatically

### Requirement: Skill Package export is separate from product editing
The system SHALL keep product-facing rules editing separate from technical export formats such as Codex or Claude `SKILL.md`.

#### Scenario: User wants technical export
- **WHEN** the user requests export
- **THEN** the system can generate a technical Skill Package from the published Skill Package without exposing that format during normal editing

