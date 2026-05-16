from sqlalchemy import create_engine
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
    """Create database tables if they do not already exist."""
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency that gives each REST request its own DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
