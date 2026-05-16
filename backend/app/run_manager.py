import asyncio
import uuid
from datetime import datetime

from fastapi import WebSocket
from sqlalchemy.orm import Session

from app import models
from app.agent_adapter import run_agent
from app.redis_client import get_cached_decision, set_cached_decision


# run_manager orchestrates a run from start to finish. It creates the run,
# calls the AI adapter, saves every event to SQLite, and streams events through
# the WebSocket.
EVENT_METADATA = {
    "run_started": {"source": "backend", "level": "info"},
    "agent_planning": {"source": "ai", "level": "info"},
    "model_reasoning": {"source": "ai", "level": "info"},
    "cached_decision_used": {"source": "redis", "level": "success"},
    "security_check": {"source": "security", "level": "info"},
    "tool_selected": {"source": "tool", "level": "info"},
    "tool_proposal": {"source": "tool", "level": "info"},
    "gpu_metric": {"source": "gpu", "level": "info"},
    "action_allowed": {"source": "security", "level": "success"},
    "action_blocked": {"source": "security", "level": "warning"},
    "final_answer": {"source": "ai", "level": "success"},
    "run_complete": {"source": "backend", "level": "success"},
    "run_failed": {"source": "backend", "level": "error"},
}


def get_event_metadata(event_type: str) -> dict:
    """Return frontend-friendly display metadata for an event type."""
    return EVENT_METADATA.get(event_type, {"source": "backend", "level": "info"})


def create_run(db: Session, task: str) -> models.Run:
    """Create and save a new run row."""
    run = models.Run(
        id=str(uuid.uuid4()),
        task=task,
        status="started",
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def save_event(
    db: Session,
    run_id: str,
    event_type: str,
    message: str,
    source: str | None = None,
    level: str | None = None,
) -> models.Event:
    """Create and save one event row."""
    metadata = get_event_metadata(event_type)
    event = models.Event(
        id=str(uuid.uuid4()),
        run_id=run_id,
        type=event_type,
        source=source or metadata["source"],
        level=level or metadata["level"],
        message=message,
        timestamp=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def event_to_websocket_payload(event: models.Event) -> dict:
    """Convert a database event into the JSON shape sent to WebSocket clients."""
    return {
        "run_id": event.run_id,
        "type": event.type,
        "source": event.source,
        "level": event.level,
        "message": event.message,
        "timestamp": event.timestamp.isoformat(),
    }


async def save_and_send_event(
    db: Session,
    websocket: WebSocket,
    run_id: str,
    event_type: str,
    message: str,
    source: str | None = None,
    level: str | None = None,
) -> None:
    """Save an event to SQLite and immediately stream it to the client."""
    event = save_event(db, run_id, event_type, message, source=source, level=level)
    await websocket.send_json(event_to_websocket_payload(event))


async def run_fake_agent_timeline(db: Session, websocket: WebSocket, task: str) -> str:
    """
    Create a run, stream fake timeline events, and return the new run id.

    This function is intentionally simple so it is easy to replace the fake
    timeline with real agent logic later.
    """
    run = create_run(db, task)

    cached_decision = get_cached_decision(task)
    if cached_decision:
        await save_and_send_event(db, websocket, run.id, "run_started", "Run started")
        await asyncio.sleep(0.2)
        await save_and_send_event(
            db,
            websocket,
            run.id,
            "cached_decision_used",
            f"Cached decision used: {cached_decision}",
        )
        await asyncio.sleep(0.2)
        await save_and_send_event(db, websocket, run.id, "run_complete", "Run completed")
    else:
        await save_and_send_event(db, websocket, run.id, "run_started", "Run started")
        await asyncio.sleep(0.25)

        async for agent_event in run_agent(task):
            await save_and_send_event(
                db,
                websocket,
                run.id,
                agent_event["type"],
                agent_event["message"],
                source=agent_event["source"],
                level=agent_event["level"],
            )

            if agent_event["type"] == "tool_proposal":
                await asyncio.sleep(0.25)
                await save_and_send_event(
                    db,
                    websocket,
                    run.id,
                    "security_check",
                    "Checking action against security policy",
                )
                await asyncio.sleep(0.25)
                await save_and_send_event(
                    db,
                    websocket,
                    run.id,
                    "gpu_metric",
                    "Estimated GPU cost calculated",
                )
                await asyncio.sleep(0.25)
                await save_and_send_event(
                    db,
                    websocket,
                    run.id,
                    "action_allowed",
                    "Action allowed",
                )

        # This is a fake decision for the demo. A real project could store an
        # actual security/action decision here.
        set_cached_decision(task, "allow")
        await asyncio.sleep(0.25)
        await save_and_send_event(db, websocket, run.id, "run_complete", "Run completed")

    run.status = "complete"
    db.commit()
    return run.id
