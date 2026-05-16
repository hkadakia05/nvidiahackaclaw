# API Contract

This document explains how the frontend and teammates should integrate with the backend.

## Base URL

Local development:

```text
http://127.0.0.1:8000
```

Docker Compose uses the same URL from your browser because port `8000` is mapped to your machine.

## Health Endpoint

```text
GET /health
```

Response:

```json
{ "status": "ok" }
```

## Runs Endpoints

List saved runs:

```text
GET /api/runs
```

Get one saved run with timeline events:

```text
GET /api/runs/{run_id}
```

## WebSocket URL

```text
ws://127.0.0.1:8000/ws/run
```

## Client Message Example

Send this JSON after the WebSocket connects:

```json
{ "task": "test task" }
```

## Server Event Example

The server streams events live and also saves them in SQLite:

```json
{
  "run_id": "9a55db5c-c8ac-4be7-b37d-8323a553c732",
  "type": "security_check",
  "source": "security",
  "level": "info",
  "message": "Checking action against security policy",
  "timestamp": "2026-05-15T12:00:00.000000"
}
```

## Event Type List

```text
run_started
agent_planning
cached_decision_used
security_check
tool_selected
gpu_metric
action_allowed
action_blocked
run_complete
run_failed
```

## Source And Level

`source` tells the frontend where the event came from:

```text
backend
ai
redis
security
tool
gpu
```

`level` tells the frontend how to style the event:

```text
info
success
warning
error
```

Recommended frontend behavior:

```text
info    - normal timeline item
success - completed or allowed action
warning - needs attention but not a crash
error   - failed action or run
```

## Frontend Integration Note

The frontend should render WebSocket events live as they arrive from `/ws/run`.
It can also fetch saved run history later from the REST endpoints:

```text
GET /api/runs
GET /api/runs/{run_id}
```

## SQLite Schema Changes

This project does not use Alembic migrations yet. The app includes a small
development helper that adds the new `source` and `level` columns to an older
local SQLite database if they are missing. If your local database gets into a
weird state during hackathon development, stop the app and delete `hackathon.db`;
the backend will recreate the tables on startup.
