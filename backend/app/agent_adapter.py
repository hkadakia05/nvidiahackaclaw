import asyncio
import importlib
import sys
from pathlib import Path
from typing import Any, AsyncIterator


def _ensure_repo_imports() -> None:
    """Make the repo-level brain package importable in local and Docker runs."""
    current_file = Path(__file__).resolve()

    for candidate in (current_file.parents[1], current_file.parents[2]):
        if (candidate / "brain").is_dir() and str(candidate) not in sys.path:
            sys.path.insert(0, str(candidate))
            return


def _load_control_plane():
    _ensure_repo_imports()
    module = importlib.import_module("brain.ag.main")
    return module.run_control_plane


def _worker_metadata(
    name: str,
    agent_type: str,
    status: str,
    action: str,
    **extra: Any,
) -> dict[str, Any]:
    """Backend-generated demo telemetry for worker/control-plane dashboards."""
    metadata = {
        "telemetry_source": "backend_simulated",
        "worker_agent_name": name,
        "worker_agent_type": agent_type,
        "worker_agent_status": status,
        "requested_action": action,
    }
    metadata.update(extra)
    return metadata


async def run_agent(task: str) -> AsyncIterator[dict[str, Any]]:
    """
    Run the repo-level brain/ag control plane and yield backend timeline events.

    The run manager owns run ids, timestamps, persistence, WebSocket delivery,
    and security evaluation. This adapter only translates agent output into the
    existing event contract consumed by the dashboard.
    """
    try:
        run_control_plane = _load_control_plane()
        control_plane = await asyncio.to_thread(run_control_plane, task)
    except Exception as exc:
        yield {
            "type": "run_failed",
            "source": "ai",
            "level": "error",
            "message": f"Agent control plane failed: {exc}",
            "details": {
                "reason": str(exc),
                "metadata": {"agent_system": "brain/ag"},
            },
        }
        return

    yield {
        "type": "agent_planning",
        "source": "ai",
        "level": "info",
        "message": "Planning agent created an execution plan",
        "details": {
            "agent": "planning-agent",
            "plan": control_plane.get("plan", ""),
            "metadata": _worker_metadata(
                "Planning Agent",
                "control-plane planner",
                "running",
                "Create execution plan",
                model="fake-chain-llm",
                verifier_decision="pending",
            ),
        },
    }
    await asyncio.sleep(0.2)

    for index, step in enumerate(control_plane.get("steps", []), start=1):
        step_name = str(step.get("step", f"step {index}"))
        route = str(step.get("route", "unknown"))
        gpu_cost = int(step.get("gpu_cost", 0) or 0)
        approved = bool(step.get("approved", False))

        yield {
            "type": "model_reasoning",
            "source": "ai",
            "level": "info",
            "message": f"Planning step {index}: {step_name}",
            "details": {
                "agent": "planning-agent",
                "step": step_name,
                "step_index": index,
                "metadata": _worker_metadata(
                    "Planning Agent",
                    "control-plane planner",
                    "running",
                    step_name,
                    model="fake-chain-llm",
                    stepIndex=index,
                ),
            },
        }
        await asyncio.sleep(0.2)

        yield {
            "type": "gpu_metric",
            "source": "gpu",
            "level": "info",
            "message": f"GPU router selected {route} for: {step_name}",
            "details": {
                "agent": "gpu-router-agent",
                "route": route,
                "gpu_cost": gpu_cost,
                "approved": approved,
                "metadata": _worker_metadata(
                    "GPU Router Agent",
                    "compute router",
                    "running" if approved else "blocked",
                    step_name,
                    route=route,
                    costPerHour=gpu_cost,
                    gpuUsage=gpu_cost,
                    estimated_gpu_cost=gpu_cost,
                    budget_decision="approved" if approved else "denied",
                    model=route,
                ),
            },
        }
        await asyncio.sleep(0.2)

        if not approved:
            yield {
                "type": "security_warning",
                "source": "gpu",
                "level": "warning",
                "message": f"Budgeting agent denied GPU spend for: {step_name}",
                "details": {
                    "agent": "budgeting-agent",
                    "step": step_name,
                    "route": route,
                    "gpu_cost": gpu_cost,
                    "reason": "GPU budget exceeded",
                    "metadata": _worker_metadata(
                        "Budgeting Agent",
                        "budget guard",
                        "blocked",
                        step_name,
                        route=route,
                        costPerHour=gpu_cost,
                        estimated_gpu_cost=gpu_cost,
                        budget_decision="denied",
                        security_decision="budget_denied",
                    ),
                },
            }
            await asyncio.sleep(0.2)
            continue

        yield {
            "type": "model_reasoning",
            "source": "ai",
            "level": "success",
            "message": f"Verifier accepted output for: {step_name}",
            "details": {
                "agent": "verifying-agent",
                "step": step_name,
                "verification": step.get("verification"),
                "metadata": _worker_metadata(
                    "Verifying Agent",
                    "quality verifier",
                    "completed",
                    f"Verify output for {step_name}",
                    verifier_decision=str(step.get("verification") or "APPROVED"),
                    model="fake-chain-llm",
                ),
            },
        }
        await asyncio.sleep(0.2)

    metrics = control_plane.get("metrics", {})
    if int(metrics.get("gpu_usage", 0) or 0) >= 50:
        yield {
            "type": "security_warning",
            "source": "gpu",
            "level": "warning",
            "message": "Budgeting agent flagged elevated simulated GPU usage",
            "details": {
                "agent": "budgeting-agent",
                "reason": "Backend demo telemetry crossed the budget watch threshold",
                "metadata": _worker_metadata(
                    "Budgeting Agent",
                    "budget guard",
                    "running",
                    "Watch simulated GPU budget",
                    gpuUsage=metrics.get("gpu_usage", 0),
                    costPerHour=metrics.get("gpu_usage", 0),
                    estimated_gpu_cost=metrics.get("gpu_usage", 0),
                    budget_decision="watch",
                    security_decision="budget_watch",
                ),
            },
        }
        await asyncio.sleep(0.2)

    action = _action_from_task(task)
    yield {
        "type": "tool_proposal",
        "source": "tool",
        "level": "info",
        "message": "Agent proposed a backend-controlled tool action",
        "action": action,
        "details": {
            "metadata": _worker_metadata(
                "Tool Worker Agent",
                "tool executor",
                "running",
                action.get("description", "Propose controlled tool action"),
                requested_tool=action.get("tool_name") or "unknown",
                requested_tool_action=action.get("command")
                or action.get("path")
                or action.get("domain")
                or action.get("description", "tool action"),
            ),
        },
    }
    await asyncio.sleep(0.2)

    yield {
        "type": "final_answer",
        "source": "ai",
        "level": "success",
        "message": "Agent control plane produced a final answer",
        "details": {
            "agent": "control-plane",
            "metrics": metrics,
            "metadata": _worker_metadata(
                "Control Plane Agent",
                "run coordinator",
                "completed",
                "Produce final run summary",
                costSaved=metrics.get("estimated_credits_saved_percent", 0),
                gpuUsage=metrics.get("gpu_usage", 0),
                estimated_gpu_cost=metrics.get("gpu_usage", 0),
                budget_decision="completed",
                verifier_decision="approved",
            ),
        },
    }


def _action_from_task(task: str) -> dict[str, Any]:
    """
    Build a tool action for the existing security control plane.

    This keeps the merged agent system connected to the current policy,
    sandbox, audit, and WebSocket flow.
    """
    lower_task = task.lower()

    if "evil.com" in lower_task:
        return {
            "action_type": "network",
            "tool_name": "network_request",
            "domain": "evil.com",
            "description": "Network request proposed by the agent adapter",
        }

    if "github.com" in lower_task:
        return {
            "action_type": "network",
            "tool_name": "network_request",
            "domain": "github.com",
            "description": "Allowed network request proposed by the agent adapter",
        }

    if "secrets.txt" in lower_task:
        return {
            "action_type": "filesystem",
            "tool_name": "file_read",
            "path": "secrets.txt",
            "description": "Filesystem action proposed by the agent adapter",
        }

    if "id_rsa" in lower_task:
        return {
            "action_type": "filesystem",
            "tool_name": "file_read",
            "path": "~/.ssh/id_rsa",
            "description": "Filesystem action proposed by the agent adapter",
        }

    if "/etc/" in lower_task:
        return {
            "action_type": "filesystem",
            "tool_name": "file_read",
            "path": "/etc/passwd",
            "description": "Read-only filesystem action proposed by the agent adapter",
        }

    if "cat .env" in lower_task:
        command = "cat .env"
    elif "rm -rf /" in lower_task:
        command = "rm -rf /"
    elif "sudo" in lower_task:
        command = "sudo"
    elif "git push origin main" in lower_task:
        command = "git push origin main"
    elif "pip install" in lower_task:
        command = "pip install"
    else:
        command = "ls"

    return {
        "action_type": "shell",
        "tool_name": "shell",
        "command": command,
        "description": "Shell tool action proposed by the agent adapter",
    }
