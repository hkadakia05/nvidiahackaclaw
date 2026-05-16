import asyncio


async def run_agent(task: str):
    """
    Future AI agent integration point.

    Later, this function is where a real agent framework such as LangChain,
    OpenClaw, or Nemotron can plug in. For now, it yields fake AI-shaped events
    so the frontend can build against a realistic streaming flow.

    Important: this adapter does not add run_id or timestamp. The run_manager
    owns that because it saves events to SQLite and streams them to the client.
    """
    yield {
        "type": "agent_planning",
        "source": "ai",
        "level": "info",
        "message": f"Agent is planning how to handle: {task}",
    }
    await asyncio.sleep(0.35)

    yield {
        "type": "model_reasoning",
        "source": "ai",
        "level": "info",
        "message": "Model is reasoning about the safest next step",
    }
    await asyncio.sleep(0.35)

    yield {
        "type": "tool_proposal",
        "source": "tool",
        "level": "info",
        "message": "Agent proposed a tool call",
        "action": _action_from_task(task),
    }
    await asyncio.sleep(0.35)

    yield {
        "type": "final_answer",
        "source": "ai",
        "level": "success",
        "message": "Agent produced a final answer",
    }


def _action_from_task(task: str) -> dict:
    """
    Build a fake tool action for the security control plane.

    This keeps the demo useful: if a teammate sends a task like "run cat .env",
    the proposed action will hit the real shell policy from /security.
    """
    lower_task = task.lower()

    if "evil.com" in lower_task:
        return {
            "action_type": "network",
            "tool_name": "network_request",
            "domain": "evil.com",
            "description": "Fake network request proposed by the agent adapter",
        }

    if "github.com" in lower_task:
        return {
            "action_type": "network",
            "tool_name": "network_request",
            "domain": "github.com",
            "description": "Fake allowed network request proposed by the agent adapter",
        }

    if "secrets.txt" in lower_task:
        return {
            "action_type": "filesystem",
            "tool_name": "file_read",
            "path": "secrets.txt",
            "description": "Fake filesystem action proposed by the agent adapter",
        }

    if "id_rsa" in lower_task:
        return {
            "action_type": "filesystem",
            "tool_name": "file_read",
            "path": "~/.ssh/id_rsa",
            "description": "Fake filesystem action proposed by the agent adapter",
        }

    if "/etc/" in lower_task:
        return {
            "action_type": "filesystem",
            "tool_name": "file_read",
            "path": "/etc/passwd",
            "description": "Fake read-only filesystem action proposed by the agent adapter",
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
        "description": "Fake shell tool action proposed by the agent adapter",
    }
