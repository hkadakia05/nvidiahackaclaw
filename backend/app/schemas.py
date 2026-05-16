from datetime import datetime

from pydantic import BaseModel


class EventOut(BaseModel):
    """Shape of an event returned by the REST API."""

    id: str
    run_id: str
    type: str
    source: str
    level: str
    message: str
    timestamp: datetime

    class Config:
        from_attributes = True


class RunOut(BaseModel):
    """Basic run data without its full event timeline."""

    id: str
    task: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class RunWithEventsOut(RunOut):
    """Detailed run response with all timeline events."""

    events: list[EventOut]
