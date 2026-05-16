import hashlib
import os
from typing import Optional

import redis
from redis.exceptions import RedisError


# The app works even if Redis is not installed or running.
# Redis is only used as a small optional cache for fake decisions.
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


def _get_client():
    """Return a Redis client if Redis is reachable, otherwise return None."""
    try:
        client = redis.from_url(REDIS_URL, decode_responses=True)
        client.ping()
        return client
    except RedisError:
        return None


def _task_cache_key(task: str) -> str:
    """Hash the task text so cache keys stay short and safe."""
    task_hash = hashlib.sha256(task.encode("utf-8")).hexdigest()
    return f"decision:{task_hash}"


def get_cached_decision(task: str) -> Optional[str]:
    """Read a cached decision for this task, if Redis is available."""
    client = _get_client()
    if client is None:
        return None

    try:
        return client.get(_task_cache_key(task))
    except RedisError:
        return None


def set_cached_decision(task: str, decision: str) -> None:
    """Save a decision for this task. Fail quietly if Redis is unavailable."""
    client = _get_client()
    if client is None:
        return

    try:
        # ex=3600 means the cache entry expires after one hour.
        client.set(_task_cache_key(task), decision, ex=3600)
    except RedisError:
        return
