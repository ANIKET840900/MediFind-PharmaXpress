---
name: backend-endpoint-change
description: Safely add or modify backend API fields/endpoints in the Django DRF backend with tests and migrations.
---

# Backend Endpoint Change

Use this skill when adding or changing API behavior under `backend/api`.

## Scope
- Backend Django project: `backend/`
- API app: `backend/api/`
- Primary files:
  - `backend/api/models.py`
  - `backend/api/serializers.py`
  - `backend/api/views.py`
  - `backend/api/urls.py`
  - `backend/api/tests.py`
  - `backend/api/migrations/`

## Required Workflow
1. Confirm contract impact before coding.
   - Identify request/response fields, auth requirements, and status codes.
   - Preserve existing response shapes unless explicitly changing contract.

2. Implement backend changes in this order.
   - Update model fields if needed in `models.py`.
   - Update serializers in `serializers.py`.
   - Update ViewSet/APIView logic in `views.py`.
   - Register/adjust routes in `urls.py`.

3. Add migration when schema changed.
   - Run: `cd backend && python manage.py makemigrations api`
   - Verify migration file appears under `backend/api/migrations/`.

4. Add or update tests.
   - Extend `backend/api/tests.py` with success and failure paths.
   - Cover auth/permission and validation branches.

5. Validate locally.
   - `cd backend && python manage.py check`
   - `cd backend && python manage.py test`

## Medicine Platform Conventions
- Auth is DRF token-based (`Authorization: Token <key>`).
- Keep business logic in DRF views/serializers; avoid scattered logic.
- Keep frontend contract in sync if response payload changes.
- Disposable email checks exist in auth flows; do not bypass accidentally.

## Done Criteria
- Code updated in the correct backend layers.
- Migration created if model changed.
- Backend tests updated and passing.
- Any contract change clearly documented in PR summary.
