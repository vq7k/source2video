## ADDED Requirements

### Requirement: Job Spec is the single user input contract
The system SHALL expose Writing Job creation as the primary user entrypoint and normalize all user-provided goals, raw materials, references, writing skills, and review preferences into one Job Spec.

#### Scenario: User creates job with minimal title
- **WHEN** the user provides only a title or topic
- **THEN** the system creates a Job Spec with goal populated and marks missing source/context as Precheck risks

#### Scenario: User creates job with full material set
- **WHEN** the user provides title, source material, reference articles, external writing skill, and supervisor preferences
- **THEN** the system stores them under the same Job Spec instead of creating separate workflows

### Requirement: UI hides internal schema complexity
The system SHALL let users enter messy materials through simple fields and uploads while keeping schema normalization inside Precheck.

#### Scenario: User pastes mixed input
- **WHEN** the user pastes notes, links, transcript fragments, and constraints into the Job creation form
- **THEN** the UI accepts the input without requiring the user to classify every fragment manually

### Requirement: Job Spec separates content from method
The system MUST distinguish what to write from how to write it.

#### Scenario: Reference article is provided
- **WHEN** the user adds an example article as a reference
- **THEN** the system treats it as writing method/style input and not as factual source unless the user marks it as source material

### Requirement: Output Profile preserves concrete deliverable shape
The system SHALL represent concrete deliverable formats, including the structured explanation document package, as Output Profiles attached to a Writing Job.

#### Scenario: User selects structured explanation package
- **WHEN** the user creates a Writing Job for source-to-explanation work
- **THEN** the job can select an Output Profile that produces `plan`, `scripts`, `shots`, `visual_spec`, and `qa_report`

#### Scenario: Product abstraction changes
- **WHEN** the product is described as a writing production system
- **THEN** the system still preserves the structured explanation package as a supported Output Profile instead of deleting the prior design
