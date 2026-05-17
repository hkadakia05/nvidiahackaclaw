# Hackathon FastAPI Backend

Beginner-friendly FastAPI backend with WebSockets, SQLite, SQLAlchemy, and an optional Redis cache.

## Local Setup on Windows PowerShell

Run these commands from the `backend` folder:

```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API will run at:

```text
http://127.0.0.1:8000
```

## Docker Compose Setup

Run these commands from the repo root:

```powershell
docker compose up --build
```

The Compose setup starts two services:

```text
backend - FastAPI app running with uvicorn
redis   - official Redis image used as an optional cache
```

Compose also mounts the repo-level `security/` folder into the backend
container so the backend can read policies and write audit records.

The API will run at:

```text
http://127.0.0.1:8000
```

To stop the services:

```powershell
docker compose down
```

## Health Check

```powershell
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{ "status": "ok" }
```

## REST Endpoints

List all runs:

```text
GET /api/runs
```

Get one run with timeline events:

```text
GET /api/runs/{run_id}
```

## WebSocket Endpoint

Connect to:

```text
ws://127.0.0.1:8000/ws/run
```

Send:

```json
{ "task": "test task" }
```

The backend creates a unique `run_id`, stores the run in SQLite, and streams timeline events like:

```json
{
  "run_id": "example-id",
  "type": "run_started",
  "source": "backend",
  "level": "info",
  "message": "Run started",
  "timestamp": "2026-05-15T12:00:00.000000"
}
```

To test a blocked security action, send a task that contains a blocked command:

```json
{ "task": "please run cat .env" }
```

That should stream security events such as `policy_evaluated`,
`action_blocked`, `sandbox_violation`, and `run_failed`.

## Optional Redis Cache

Redis is optional. If Redis is not running, the app still works.

For local venv development, you can run Redis separately with Docker:

```powershell
docker run -d --name redis -p 6379:6379 redis
```

For Docker Compose, Redis is already included and the backend uses:

```text
REDIS_URL=redis://redis:6379/0
```

When Redis is running, the backend hashes the task string and caches a fake decision. If the same task is sent again, the WebSocket stream includes a `cached_decision_used` event.

## Project Structure

```text
backend/
  Dockerfile
  app/
    main.py
    db.py
    models.py
    schemas.py
    run_manager.py
    redis_client.py
    security/
    security_service.py
  requirements.txt
  .env.example
  API_CONTRACT.md
  SECURITY_INTEGRATION.md
  README.md
```

## Notes

This project intentionally does not include authentication, real AI model calls, or NVIDIA Brev.

## Real repository analysis (optional)

The backend can optionally clone and inspect public GitHub repositories to produce live analysis events.

Enable by setting environment variables (see `.env.example`):

```
REAL_REPO_ANALYSIS=true
CLONE_WORKSPACE_DIR=./tmp/repos
MAX_REPO_SIZE_MB=100
KEEP_CLONED_REPOS=false
```

How it works
- When the WebSocket run payload includes `githubUrl` and `REAL_REPO_ANALYSIS=true`, the backend will perform a shallow git clone and scan files.
- The inspector is read-only: it does not execute repository code. It parses `package.json`, `requirements.txt`, `pyproject.toml`, looks for `Dockerfile`, `.env`, `.gitignore`, and searches source files for risky patterns such as `eval`, `exec`, `os.system`, `subprocess`, or hard-coded secrets.
- The analysis emits events that stream to the dashboard, including `repo_clone_started`, `repo_clone_completed`, `repo_structure_detected`, `dependency_scan_started`, `dependency_scan_completed`, `security_scan_started`, `security_finding`, `agent_recommendation`, and `run_complete`.

Safety limitations
- The inspector performs only static, read-only analysis and never runs repository code or scripts. It uses `git clone --depth 1` for speed and safety.
- If you need to run code, implement a proper sandboxed execution environment (not included). Be cautious with private repositories and secrets.

Testing
- To test with the included demo repository, provide the GitHub URL in the frontend input and start a run. The repo analysis will clone and stream findings to the dashboard.
