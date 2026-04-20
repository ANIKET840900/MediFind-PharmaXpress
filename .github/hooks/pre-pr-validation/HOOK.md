---
name: pre-pr-validation
description: Run required local validation checks before presenting changes as merge-ready.
trigger: before-final-response
---

# Pre-PR Validation Hook

Run this hook before claiming work is complete for a code change.

## Required Checks
Run all checks below for every code change, regardless of which files were modified.

1. Backend checks:
   - `cd backend && python manage.py check`
   - `cd backend && python manage.py test`

2. Frontend checks:
   - `cd frontend && npm test -- --watchAll=false`
   - `cd frontend && npm run build`

## Reporting Rules
- In the final message, state exactly which commands were run.
- Report pass/fail for each command.
- If a command was not run, state why and treat the work as not fully validated.
- If tests fail, summarize the first actionable failure.

## Repository Alignment
This hook mirrors CI and PR expectations from:
- `.github/workflows/ci.yml`
- `.github/pull_request_template.md`
