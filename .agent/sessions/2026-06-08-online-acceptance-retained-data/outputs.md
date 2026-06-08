# Online Acceptance With Retained Test Data — 2026-06-08

## Scope

- Ran fresh public acceptance against `https://s2v.x-lin7.com`.
- Preserved test data by design: no cleanup calls were made.
- Acceptance tag: `online-acceptance-2026-06-08-keep-data`.

## Evidence

- `GET /api/health` -> 200.
- `HEAD /writing` -> 200.
- `POST /api/writing-runs/missing-run/dataset-drafts` -> 404 `Writing run not found`, proving dataset repository is configured.
- Created retained run: `run_a51abf14`.
- Candidate: `candidate_r1_1`.
- Feedback: `feedback_531b81ef`, feedbackCount=1.
- Rule patch compile: 200, patchCount=1.
- Finalize: 200, status=`finalized`.
- Rule package: `rule_package_8b0b47cc`, status=`published`.
- Dataset draft item: `dataset_draft_run_a51abf14_feedback_531b81ef` in `writing_dataset_draft`, itemCount=1.
- Eval dataset item: `eval_dataset_item_run_a51abf14_feedback_531b81ef` in `writing_eval_dataset`, itemCount=1, split=`validation`.
- Read-back: status=`finalized`, feedbackCount=1, rulePackageCount=1, containsTag=true.

## Preservation Note

The run, feedback, rule package, draft dataset item, and eval dataset item are intentionally left in production as retained acceptance test data.
