# AGENTS.md

This file helps AI coding agents become productive quickly in this repository.

## Project Scope
- Monorepo with Django REST backend and React frontend.
- Backend: `backend/` (project: `medcompare`, app: `api`).
- Frontend: `frontend/` (Create React App).
- Django serves API at `/api/*` and serves the React build for non-API routes.

Key references:
- API routing: [backend/api/urls.py](backend/api/urls.py)
- Backend settings/static serving: [backend/medcompare/settings.py](backend/medcompare/settings.py)
- Root URL dispatch: [backend/medcompare/urls.py](backend/medcompare/urls.py)
- Frontend routes: [frontend/src/App.js](frontend/src/App.js)
- Frontend API client/token handling: [frontend/src/api.js](frontend/src/api.js)

## Dev Setup And Commands
Use backend requirements from [backend/requirements.txt](backend/requirements.txt).

Backend:
- `cd backend`
- `python -m pip install --upgrade pip`
- `pip install -r requirements.txt`
- `python manage.py migrate`
- `python manage.py runserver`

Frontend:
- `cd frontend`
- `npm install`
- `npm start`

## Validation Commands
Match CI checks in [.github/workflows/ci.yml](.github/workflows/ci.yml):

Backend:
- `cd backend && python manage.py check`
- `cd backend && python manage.py test`

Frontend:
- `cd frontend && npm test -- --watchAll=false`
- `cd frontend && npm run build`

PR validation expectations are in [.github/pull_request_template.md](.github/pull_request_template.md).

## Architecture Notes
- Auth is DRF Token-based (`Authorization: Token <key>`), configured in [backend/medcompare/settings.py](backend/medcompare/settings.py).
- Main domain models are in [backend/api/models.py](backend/api/models.py): shops, medicines, cart, orders, wishlist, reviews, returns, notifications, user profiles/roles, OTP, prescriptions, fraud events.
- Most API resources use DRF ViewSets + router in [backend/api/urls.py](backend/api/urls.py), plus custom auth/order/review/return endpoints.
- Frontend axios instance defaults to `/api` unless `REACT_APP_API_BASE_URL` is set in [frontend/src/api.js](frontend/src/api.js).

## Conventions To Follow
- Keep backend business logic in viewsets/APIViews and serializers; follow existing DRF patterns in [backend/api/views.py](backend/api/views.py) and [backend/api/serializers.py](backend/api/serializers.py).
- Preserve endpoint response shapes already used by tests in [backend/api/tests.py](backend/api/tests.py) and frontend page tests under [frontend/src/pages/__tests__](frontend/src/pages/__tests__).
- Frontend auth state uses localStorage keys `medcompare_token` and `medcompare_signup_complete` in [frontend/src/api.js](frontend/src/api.js). Do not rename without coordinated changes/tests.

## Pitfalls And Gotchas
- Django expects frontend build artifacts from `frontend/build` for SPA serving. If UI routes fail in backend-served mode, run `cd frontend && npm run build`.
- Email and SMS behavior depends on environment variables in [backend/medcompare/settings.py](backend/medcompare/settings.py) (console email backend by default; Twilio optional).
- Disposable email checks are enforced in auth flows in [backend/api/views.py](backend/api/views.py). Keep backend and frontend validations aligned.
- Deploy workflow in [.github/workflows/deploy.yml](.github/workflows/deploy.yml) is intentionally safety-locked and disabled by default.

## Editing Guidance For Agents
- Prefer changing source files under `frontend/src` and `backend/api`; avoid editing generated files under `frontend/build`.
- When adding fields/endpoints in backend:
  - update model/serializer/view/url as needed,
  - create migrations under `backend/api/migrations`,
  - update or add API tests in [backend/api/tests.py](backend/api/tests.py),
  - adjust frontend API calls/pages/tests if contract changed.
- Before finalizing, run backend and frontend validations listed above.
