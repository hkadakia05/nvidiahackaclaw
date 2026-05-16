from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class EventOut(BaseModel):
    """Shape of an event returned by the REST API."""

    id: str
    run_id: str
    type: str
    source: str
    level: str
    message: str
    timestamp: datetime
    action_type: str | None = None
    tool_name: str | None = None
    decision: str | None = None
    risk_level: str | None = None
    policy_triggered: str | None = None
    reason: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)

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
