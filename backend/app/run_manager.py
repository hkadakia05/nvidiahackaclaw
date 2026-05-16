import asyncio
import uuid
from datetime import datetime

from fastapi import WebSocket
from sqlalchemy.orm import Session

from app import models
from app.redis_client import get_cached_decision, set_cached_decision


# These are fake timeline events for the hackathon demo.
# Later, each item could map to a real AI agent step.
FAKE_TIMELINE = [
    ("run_started", "Run started"),
    ("agent_planning", "Agent is planning the task"),
    ("security_check", "Checking action against security policy"),
    ("tool_selected", "Tool selected"),
    ("gpu_metric", "Estimated GPU cost calculated"),
    ("action_allowed", "Action allowed"),
    ("run_complete", "Run completed"),
]


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


def save_event(db: Session, run_id: str, event_type: str, message: str) -> models.Event:
    """Create and save one event row."""
    event = models.Event(
        id=str(uuid.uuid4()),
        run_id=run_id,
        type=event_type,
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
        "message": event.message,
        "timestamp": event.timestamp.isoformat(),
    }


async def save_and_send_event(
    db: Session,
    websocket: WebSocket,
    run_id: str,
    event_type: str,
    message: str,
) -> None:
    """Save an event to SQLite and immediately stream it to the client."""
    event = save_event(db, run_id, event_type, message)
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
        for event_type, message in FAKE_TIMELINE:
            await save_and_send_event(db, websocket, run.id, event_type, message)
            await asyncio.sleep(0.35)

        # This is a fake decision for the demo. A real project could store an
        # actual security/action decision here.
        set_cached_decision(task, "allow")

    run.status = "complete"
    db.commit()
    return run.id
