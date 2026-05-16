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
  "message": "Run started",
  "timestamp": "2026-05-15T12:00:00.000000"
}
```

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
  requirements.txt
  .env.example
  README.md
```

## Notes

This project intentionally does not include authentication, real AI model calls, or NVIDIA Brev.
