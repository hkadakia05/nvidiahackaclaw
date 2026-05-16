from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.db import SessionLocal, create_db_tables, get_db
from app.models import Run
from app.run_manager import run_fake_agent_timeline
from app.schemas import RunOut, RunWithEventsOut


app = FastAPI(title="Hackathon Agent Backend")


@app.on_event("startup")
def on_startup() -> None:
    """Create SQLite tables when the app starts."""
    create_db_tables()


@app.get("/health")
def health() -> dict:
    """Tiny endpoint used to check if the backend is alive."""
    return {"status": "ok"}


@app.get("/")
def root() -> dict:
    """Friendly index route that points people to the useful backend URLs."""
    return {
        "name": "Hackathon Agent Backend",
        "status": "running",
        "docs": "/docs",
        "health": "/health",
        "websocket": "/ws/run",
        "runs": "/api/runs",
    }


@app.websocket("/ws/run")
async def websocket_run(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for running a fake agent timeline.

    Example client message:
    {"task": "test task"}
    """
    await websocket.accept()

    db = SessionLocal()
    try:
        data = await websocket.receive_json()
        task = data.get("task")

        if not task:
            await websocket.send_json({"error": "Please send JSON with a task field."})
            return

        await run_fake_agent_timeline(db, websocket, task)
    except WebSocketDisconnect:
        # The browser/client closed the connection. In a bigger app, this is
        # where you could mark the run as cancelled.
        return
    finally:
        db.close()


@app.get("/api/runs", response_model=list[RunOut])
def list_runs(db: Session = Depends(get_db)):
    """Return every run, newest first."""
    return db.query(Run).order_by(Run.created_at.desc()).all()


@app.get("/api/runs/{run_id}", response_model=RunWithEventsOut)
def get_run(run_id: str, db: Session = Depends(get_db)):
    """Return one run with its saved timeline events."""
    run = db.query(Run).filter(Run.id == run_id).first()
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run
