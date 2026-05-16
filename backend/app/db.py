from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker


# SQLite stores the database in one local file.
# This keeps the hackathon setup simple: no separate database server is needed.
DATABASE_URL = "sqlite:///./hackathon.db"


# connect_args is required by SQLite when FastAPI uses the database from
# different request-handling threads.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)


# SessionLocal creates database sessions. A session is the object we use to
# read and write rows.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Base is the parent class for all SQLAlchemy models in models.py.
Base = declarative_base()


def create_db_tables() -> None:
    """
    Create database tables if they do not already exist.

    For this beginner project, we also handle one simple SQLite schema update:
    adding event metadata columns to an older local database. In production,
    teams normally use a migration tool like Alembic for this.
    """
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    add_event_metadata_columns_if_missing()


def add_event_metadata_columns_if_missing() -> None:
    """Add source/level columns to an existing local SQLite events table."""
    inspector = inspect(engine)

    if "events" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("events")}

    with engine.begin() as connection:
        if "source" not in existing_columns:
            connection.execute(
                text("ALTER TABLE events ADD COLUMN source VARCHAR NOT NULL DEFAULT 'backend'")
            )

        if "level" not in existing_columns:
            connection.execute(
                text("ALTER TABLE events ADD COLUMN level VARCHAR NOT NULL DEFAULT 'info'")
            )


def get_db():
    """FastAPI dependency that gives each REST request its own DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
