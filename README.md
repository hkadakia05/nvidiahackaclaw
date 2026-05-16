# nvidiahackaclaw

# Backend — FastAPI Agent Control Plane

This backend is the control plane for the AI agents system. It receives agent run requests, streams live timeline events over WebSockets, stores run history in SQLite, and provides REST endpoints for the frontend to fetch previous runs.

## What this backend does

- Runs a FastAPI server
- Starts agent run sessions
- Streams live events through WebSocket
- Stores runs and events in SQLite
- Provides run history through REST APIs
- Connects to Redis as an optional cache
- Includes an AI agent adapter where the real AI agent can be plugged in later
- Runs locally with a Python virtual environment or through Docker Compose

## Project structure

```txt
backend/
  app/
    main.py              # FastAPI app and API routes
    run_manager.py       # Orchestrates runs, streams events, saves events
    agent_adapter.py     # Placeholder interface for future AI agent logic
    db.py                # SQLite database setup
    models.py            # SQLAlchemy database models
    schemas.py           # Pydantic response schemas
    redis_client.py      # Optional Redis cache helper
  API_CONTRACT.md        # Integration guide for frontend/other teams
  Dockerfile
  requirements.txt
  .env.example
  README.md
