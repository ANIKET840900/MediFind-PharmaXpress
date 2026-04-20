---
name: frontend-api-contract-sync
description: Keep React pages, API client usage, and tests aligned with backend API contract changes.
---

# Frontend API Contract Sync

Use this skill whenever backend API response/request shapes change or frontend API integration is updated.

## Scope
- Frontend app: `frontend/`
- Primary files:
  - `frontend/src/api.js`
  - `frontend/src/App.js`
  - `frontend/src/pages/**/*.jsx`
  - `frontend/src/pages/__tests__/*.test.jsx`

## Required Workflow
1. Identify the exact contract delta.
   - Changed fields, renamed fields, status code behavior, auth behavior.
   - Note whether pagination format changed (`results` vs array).

2. Update API usage in UI.
   - Keep axios instance usage through `frontend/src/api.js`.
   - Preserve token handling via `medcompare_token`.
   - Preserve signup gate behavior using `medcompare_signup_complete`.

3. Update affected page logic.
   - Adjust parsing of payloads and empty/error states.
   - Keep route behavior aligned with guarded routes in `frontend/src/App.js`.

4. Update tests with behavior-first assertions.
   - Update/extend affected tests in `frontend/src/pages/__tests__/`.
   - Mock `api` module and navigation consistently with existing tests.

5. Validate frontend.
   - `cd frontend && npm test -- --watchAll=false`
   - `cd frontend && npm run build`

## Medicine Platform Conventions
- API base defaults to `/api` unless `REACT_APP_API_BASE_URL` is set.
- Keep auth routes and non-auth routes behavior consistent with `RequireAuth`.
- Avoid changing localStorage key names without coordinated backend/frontend/test updates.

## Done Criteria
- Pages compile and tests pass.
- Contract changes reflected in page logic and tests.
- Build succeeds and auth flow remains intact.
