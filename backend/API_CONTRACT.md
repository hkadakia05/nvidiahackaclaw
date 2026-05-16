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
  "type": "policy_evaluated",
  "source": "security",
  "level": "info",
  "message": "Policy decision: deny risk=high reason=Command is blocked by shell policy: cat .env",
  "action_type": "shell",
  "tool_name": "shell",
  "decision": "deny",
  "risk_level": "high",
  "policy_triggered": "shell_blocklist",
  "reason": "Command is blocked by shell policy: cat .env",
  "metadata": {
    "source": "security",
    "sandbox_used": false,
    "resource_limits_checked": false,
    "audit_written": false
  },
  "timestamp": "2026-05-15T12:00:00.000000"
}
```

## Event Type List

```text
run_started
agent_planning
model_reasoning
cached_decision_used
security_check
policy_evaluated
resource_check
tool_proposal
sandbox_started
sandbox_completed
audit_written
gpu_metric
action_allowed
action_blocked
approval_required
sandbox_violation
resource_limit_hit
security_warning
final_answer
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

## AI Agent Adapter

The real AI agent will plug in later at:

```text
backend/app/agent_adapter.py
```

Today, `run_agent(task)` is a fake async generator that yields AI-shaped events
such as `agent_planning`, `model_reasoning`, `tool_proposal`, and `final_answer`.
It does not add `run_id` or `timestamp`; `run_manager.py` handles that when it
saves events to SQLite and streams them to the WebSocket client.

## Security Control Plane

The backend treats the repo-level `/security` folder as protected
infrastructure. It does not rewrite or restructure that module. Instead,
`backend/app/security/` contains backend-side adapters that read the existing
policy files and adapt agent actions into a standard decision shape:

```json
{
  "decision": "allow",
  "risk_level": "low",
  "policy_triggered": null,
  "reason": "Safe operation",
  "metadata": {
    "source": "security",
    "sandbox_used": false,
    "resource_limits_checked": false,
    "audit_written": false
  }
}
```

Possible decisions:

```text
allow
deny
requires_approval
```

When the agent proposes a tool action, the backend evaluates policy first,
runs the sandbox wrapper only when allowed, writes an audit record to
`security/logs/audit.log`, and streams security timeline events to the
frontend.

Docker Compose mounts `./security` into the backend container at `/security`
and sets `SECURITY_ROOT=/security`. Local venv runs use the repo-level
`security` folder by default.

Backend security services:

```text
backend/app/security/policy_service.py   - shell/filesystem/network/risk policies
backend/app/security/resource_service.py - reports resource-limit availability
backend/app/security/sandbox_service.py  - sandbox validation wrapper
backend/app/security/audit_service.py    - structured audit and compatibility logs
backend/app/security/approval_service.py - approval-required metadata
backend/app/security/security_service.py - central facade used by run_manager
```

Example blocked action:

```json
{
  "action_type": "shell",
  "command": "cat .env",
  "description": "Fake shell tool action proposed by the agent adapter"
}
```

That action is denied by `security/policies/shell.yaml` and produces events
such as `policy_evaluated`, `action_blocked`, and `sandbox_violation`.

## SQLite Schema Changes

This project does not use Alembic migrations yet. The app includes a small
development helper that adds the new `source` and `level` columns to an older
local SQLite database if they are missing. If your local database gets into a
weird state during hackathon development, stop the app and delete `hackathon.db`;
the backend will recreate the tables on startup.
