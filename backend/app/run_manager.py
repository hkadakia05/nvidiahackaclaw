import asyncio
import json
import uuid
from datetime import datetime

from fastapi import WebSocket
from sqlalchemy.orm import Session

from app import models
from app.agent_adapter import run_agent
from app import repo_analysis
import os
import sys
import threading
import queue
from app.redis_client import get_cached_decision, set_cached_decision
from app.security import SecurityAction, SecurityService


# run_manager orchestrates a run from start to finish. It creates the run,
# calls the AI adapter, saves every event to SQLite, and streams events through
# the WebSocket.
EVENT_METADATA = {
    "run_started": {"source": "backend", "level": "info"},
    "agent_planning": {"source": "ai", "level": "info"},
    "model_reasoning": {"source": "ai", "level": "info"},
    "cached_decision_used": {"source": "redis", "level": "success"},
    "security_check": {"source": "security", "level": "info"},
    "policy_evaluated": {"source": "security", "level": "info"},
    "resource_check": {"source": "security", "level": "info"},
    "tool_selected": {"source": "tool", "level": "info"},
    "tool_proposal": {"source": "tool", "level": "info"},
    "gpu_metric": {"source": "gpu", "level": "info"},
    "sandbox_started": {"source": "security", "level": "info"},
    "sandbox_completed": {"source": "security", "level": "success"},
    "action_allowed": {"source": "security", "level": "success"},
    "action_blocked": {"source": "security", "level": "warning"},
    "approval_required": {"source": "security", "level": "warning"},
    "sandbox_violation": {"source": "security", "level": "error"},
    "resource_limit_hit": {"source": "security", "level": "warning"},
    "security_warning": {"source": "security", "level": "warning"},
    "audit_written": {"source": "security", "level": "success"},
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
    details: dict | None = None,
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
        metadata_json=json.dumps(details or {}),
        timestamp=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def event_to_websocket_payload(event: models.Event) -> dict:
    """Convert a database event into the JSON shape sent to WebSocket clients."""
    payload = {
        "run_id": event.run_id,
        "type": event.type,
        "source": event.source,
        "level": event.level,
        "message": event.message,
        "timestamp": event.timestamp.isoformat(),
    }
    payload.update(event.details)
    return payload


async def save_and_send_event(
    db: Session,
    websocket: WebSocket,
    run_id: str,
    event_type: str,
    message: str,
    source: str | None = None,
    level: str | None = None,
    details: dict | None = None,
) -> None:
    """Save an event to SQLite and immediately stream it to the client."""
    event = save_event(
        db,
        run_id,
        event_type,
        message,
        source=source,
        level=level,
        details=details,
    )
    await websocket.send_json(event_to_websocket_payload(event))


async def run_fake_agent_timeline(db: Session, websocket: WebSocket, task: str, github_url: str | None = None) -> str:
    """
    Create a run, stream fake timeline events, and return the new run id.

    This function is intentionally simple so it is easy to replace the fake
    timeline with real agent logic later.
    """
    run = create_run(db, task)
    security_service = SecurityService()

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
        run_allowed = True
        adapter_failed = False
        await save_and_send_event(db, websocket, run.id, "run_started", "Run started")
        await asyncio.sleep(0.25)

        # If a GitHub URL is provided, attempt to launch the external agent runtime
        # at C:\Gauri\test_gpugodfather\gpu-agent-runtime\main.py. Stream process
        # stdout back to the frontend. Fall back to existing flows when no URL.
        if github_url:
            runtime_path = r"C:\Gauri\test_gpugodfather\gpu-agent-runtime\main.py"
            if not os.path.exists(runtime_path):
                await save_and_send_event(db, websocket, run.id, "run_failed", "Agent runtime not found")
                run.status = "failed"
                db.commit()
                return run.id

            try:
                await save_and_send_event(db, websocket, run.id, "runtime_started", f"Starting agent runtime for {github_url}")

                env = os.environ.copy()
                env["TARGET_GITHUB_URL"] = github_url
                env["ENABLE_WEBSOCKET"] = "false"

                proc = await asyncio.create_subprocess_exec(
                    sys.executable,
                    runtime_path,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT,
                    env=env,
                )

                # Read stdout lines and stream them as events
                assert proc.stdout is not None
                while True:
                    line = await proc.stdout.readline()
                    if not line:
                        break
                    text = line.decode(errors="replace").rstrip()
                    await save_and_send_event(db, websocket, run.id, "runtime_output", text)

                returncode = await proc.wait()
                if returncode != 0:
                    await save_and_send_event(
                        db,
                        websocket,
                        run.id,
                        "run_failed",
                        "Agent runtime failed",
                        details={"exit_code": returncode},
                    )
                    run.status = "failed"
                    db.commit()
                    return run.id

                await save_and_send_event(db, websocket, run.id, "runtime_completed", "runtime_completed")
                run.status = "complete"
                db.commit()
                return run.id
            except Exception as exc:
                await save_and_send_event(db, websocket, run.id, "run_failed", f"Agent runtime failed: {exc}")
                run.status = "failed"
                db.commit()
                return run.id


        async for agent_event in run_agent(task):
            details = dict(agent_event.get("details", {}))
            action = agent_event.get("action", {})
            if action:
                details.update(
                    {
                        "tool_name": action.get("tool_name"),
                        "action_type": action.get("action_type"),
                        "command": action.get("command"),
                        "path": action.get("path"),
                        "domain": action.get("domain"),
                    }
                )

            await save_and_send_event(
                db,
                websocket,
                run.id,
                agent_event["type"],
                agent_event["message"],
                source=agent_event["source"],
                level=agent_event["level"],
                details=details,
            )

            if agent_event["type"] == "run_failed":
                adapter_failed = True
                run_allowed = False
                break

            if agent_event["type"] == "tool_proposal":
                action_allowed = await evaluate_and_run_action(
                    db,
                    websocket,
                    run.id,
                    security_service,
                    agent_event.get("action", {}),
                )
                if not action_allowed:
                    run_allowed = False
                    break

        if not run_allowed:
            run.status = "failed" if adapter_failed else "blocked"
            db.commit()
            if not adapter_failed:
                await asyncio.sleep(0.25)
                await save_and_send_event(
                    db,
                    websocket,
                    run.id,
                    "run_failed",
                    "Run stopped by security policy",
                )
            return run.id

        # This is a fake decision for the demo. A real project could store an
        # actual security/action decision here.
        set_cached_decision(task, "allow")
        await asyncio.sleep(0.25)
        await save_and_send_event(db, websocket, run.id, "run_complete", "Run completed")

    run.status = "complete"
    db.commit()
    return run.id


async def evaluate_and_run_action(
    db: Session,
    websocket: WebSocket,
    run_id: str,
    security_service: SecurityService,
    action_data: dict,
) -> bool:
    """
    Evaluate an agent action, stream security events, and run the sandbox wrapper.

    Returns True only when the action is allowed and the sandbox completes.
    """
    action = SecurityAction(
        action_type=action_data.get("action_type", "unknown"),
        tool_name=action_data.get("tool_name"),
        command=action_data.get("command"),
        path=action_data.get("path"),
        domain=action_data.get("domain"),
        description=action_data.get("description"),
    )

    await asyncio.sleep(0.25)
    await save_and_send_event(
        db,
        websocket,
        run_id,
        "security_check",
        "Checking action against security policy",
        details={
            "action_type": action.action_type,
            "tool_name": action.tool_name,
            "command": action.command,
            "path": action.path,
            "domain": action.domain,
        },
    )

    decision = security_service.evaluate_action(action)
    await asyncio.sleep(0.25)
    await save_and_send_event(
        db,
        websocket,
        run_id,
        "policy_evaluated",
        (
            f"Policy decision: {decision.decision} "
            f"risk={decision.risk_level} reason={decision.reason}"
        ),
        details=security_service.normalized_payload(action, decision),
    )

    resource_check = security_service.check_resources(action)
    await asyncio.sleep(0.25)
    await save_and_send_event(
        db,
        websocket,
        run_id,
        "resource_check",
        resource_check.reason,
        details=security_service.normalized_payload(
            action,
            decision,
            resource_check=resource_check,
        ),
    )

    if not resource_check.allowed:
        sandbox_result = await security_service.run_in_sandbox(action, decision)
        audit_metadata = security_service.write_audit_record(
            run_id,
            action,
            decision,
            resource_check,
            sandbox_result,
        )
        await asyncio.sleep(0.25)
        await save_and_send_event(
            db,
            websocket,
            run_id,
            "audit_written",
            "Security audit record written",
            details=security_service.normalized_payload(
                action,
                decision,
                resource_check=resource_check,
                sandbox_result=sandbox_result,
                extra=audit_metadata,
            ),
        )
        await asyncio.sleep(0.25)
        await save_and_send_event(
            db,
            websocket,
            run_id,
            "resource_limit_hit",
            resource_check.reason,
            details=security_service.normalized_payload(
                action,
                decision,
                resource_check=resource_check,
                sandbox_result=sandbox_result,
            ),
        )
        return False

    if decision.decision == "deny":
        sandbox_result = await security_service.run_in_sandbox(action, decision)
        audit_metadata = security_service.write_audit_record(
            run_id,
            action,
            decision,
            resource_check,
            sandbox_result,
        )
        await asyncio.sleep(0.25)
        await save_and_send_event(
            db,
            websocket,
            run_id,
            "audit_written",
            "Security audit record written",
            details=security_service.normalized_payload(
                action,
                decision,
                resource_check=resource_check,
                sandbox_result=sandbox_result,
                extra=audit_metadata,
            ),
        )
        await asyncio.sleep(0.25)
        await save_and_send_event(
            db,
            websocket,
            run_id,
            "action_blocked",
            decision.reason,
            details=security_service.normalized_payload(
                action,
                decision,
                resource_check=resource_check,
                sandbox_result=sandbox_result,
            ),
        )
        await asyncio.sleep(0.25)
        await save_and_send_event(
            db,
            websocket,
            run_id,
            "sandbox_violation",
            sandbox_result.violation or "Sandbox blocked the action",
            details=security_service.normalized_payload(
                action,
                decision,
                resource_check=resource_check,
                sandbox_result=sandbox_result,
            ),
        )
        return False

    if decision.decision == "requires_approval":
        approval_metadata = security_service.handle_approval(action, decision)
        sandbox_result = await security_service.run_in_sandbox(action, decision)
        audit_metadata = security_service.write_audit_record(
            run_id,
            action,
            decision,
            resource_check,
            sandbox_result,
        )
        await asyncio.sleep(0.25)
        await save_and_send_event(
            db,
            websocket,
            run_id,
            "audit_written",
            "Security audit record written",
            details=security_service.normalized_payload(
                action,
                decision,
                resource_check=resource_check,
                sandbox_result=sandbox_result,
                extra=audit_metadata,
            ),
        )
        await asyncio.sleep(0.25)
        await save_and_send_event(
            db,
            websocket,
            run_id,
            "approval_required",
            decision.reason,
            details=security_service.normalized_payload(
                action,
                decision,
                resource_check=resource_check,
                sandbox_result=sandbox_result,
                extra={"approval": approval_metadata},
            ),
        )
        return False

    await asyncio.sleep(0.25)
    await save_and_send_event(
        db,
        websocket,
        run_id,
        "sandbox_started",
        "Sandbox started",
        details=security_service.normalized_payload(
            action,
            decision,
            resource_check=resource_check,
        ),
    )
    sandbox_result = await security_service.run_in_sandbox(action, decision)
    audit_metadata = security_service.write_audit_record(
        run_id,
        action,
        decision,
        resource_check,
        sandbox_result,
    )

    if sandbox_result.status != "completed":
        await asyncio.sleep(0.25)
        await save_and_send_event(
            db,
            websocket,
            run_id,
            "sandbox_violation",
            sandbox_result.violation or "Sandbox did not complete",
            details=security_service.normalized_payload(
                action,
                decision,
                resource_check=resource_check,
                sandbox_result=sandbox_result,
            ),
        )
        return False

    await asyncio.sleep(0.25)
    await save_and_send_event(
        db,
        websocket,
        run_id,
        "audit_written",
        "Security audit record written",
        details=security_service.normalized_payload(
            action,
            decision,
            resource_check=resource_check,
            sandbox_result=sandbox_result,
            extra=audit_metadata,
        ),
    )

    await asyncio.sleep(0.25)
    await save_and_send_event(
        db,
        websocket,
        run_id,
        "sandbox_completed",
        sandbox_result.output or "Sandbox completed",
        details=security_service.normalized_payload(
            action,
            decision,
            resource_check=resource_check,
            sandbox_result=sandbox_result,
        ),
    )
    await asyncio.sleep(0.25)
    await save_and_send_event(
        db,
        websocket,
        run_id,
        "gpu_metric",
        "Estimated GPU cost calculated",
        details={
            "action_type": action.action_type,
            "tool_name": action.tool_name,
            "resource_limits_checked": resource_check.checked,
            "reason": "No GPU limit policy is present in /security",
        },
    )
    await asyncio.sleep(0.25)
    await save_and_send_event(
        db,
        websocket,
        run_id,
        "action_allowed",
        decision.reason,
        details=security_service.normalized_payload(
            action,
            decision,
            resource_check=resource_check,
            sandbox_result=sandbox_result,
        ),
    )
    return True
