from datetime import datetime
import json

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class Run(Base):
    """A single task execution requested by a client."""

    __tablename__ = "runs"

    # The run id is generated in Python so the same id can be sent over the
    # WebSocket immediately.
    id = Column(String, primary_key=True, index=True)
    task = Column(String, nullable=False)
    status = Column(String, nullable=False, default="started")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # This lets us access run.events in Python.
    events = relationship(
        "Event",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="Event.timestamp",
    )


class Event(Base):
    """One timeline item that belongs to a run."""

    __tablename__ = "events"

    id = Column(String, primary_key=True, index=True)
    run_id = Column(String, ForeignKey("runs.id"), nullable=False, index=True)
    type = Column(String, nullable=False)
    source = Column(String, nullable=False, default="backend")
    level = Column(String, nullable=False, default="info")
    message = Column(String, nullable=False)
    metadata_json = Column(Text, nullable=False, default="{}")
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)

    run = relationship("Run", back_populates="events")

    @property
    def details(self) -> dict:
        """Structured event metadata for frontend rendering and audit review."""
        try:
            return json.loads(self.metadata_json or "{}")
        except json.JSONDecodeError:
            return {}

    @property
    def action_type(self) -> str | None:
        return self.details.get("action_type")

    @property
    def tool_name(self) -> str | None:
        return self.details.get("tool_name")

    @property
    def decision(self) -> str | None:
        return self.details.get("decision")

    @property
    def risk_level(self) -> str | None:
        return self.details.get("risk_level")

    @property
    def policy_triggered(self) -> str | None:
        return self.details.get("policy_triggered")

    @property
    def reason(self) -> str | None:
        return self.details.get("reason")
