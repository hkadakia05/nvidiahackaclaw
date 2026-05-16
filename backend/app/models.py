from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String
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
    message = Column(String, nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)

    run = relationship("Run", back_populates="events")
