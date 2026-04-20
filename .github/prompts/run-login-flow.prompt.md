---
name: Run App To Login Page
description: Start backend and frontend for this workspace, then open the login page in a browser.
argument-hint: Optional overrides (frontend port, backend port, login route)
agent: agent
---
Run this workspace end-to-end and stop only when the login page is open in a browser.

Goals:
1. Start backend services.
2. Start frontend services.
3. Open the app directly on the login page.
4. Report exact run status and URLs.

Execution steps:
1. Inspect the workspace to detect the backend and frontend start commands.
2. Install missing dependencies only if needed.
3. Start backend in one terminal.
4. Start frontend in a separate terminal.
5. Wait for both services to be ready.
6. Open the browser at the login page URL.

Defaults:
- Backend root: backend
- Frontend root: frontend
- Backend URL: http://localhost:8000
- Frontend URL: http://localhost:3000
- Login route: /login

Behavior:
- If ports are busy, choose the next available port and clearly report the new URLs.
- If a common startup issue appears, apply a minimal fix and continue.
- Keep services running after success.

Output format:
- Backend status: running/not running + URL + terminal identifier
- Frontend status: running/not running + URL + terminal identifier
- Opened URL: full login URL
- Issues fixed: short bullet list (or "none")
- Next command to stop services cleanly
