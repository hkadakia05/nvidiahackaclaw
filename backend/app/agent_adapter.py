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
    }
    await asyncio.sleep(0.35)

    yield {
        "type": "final_answer",
        "source": "ai",
        "level": "success",
        "message": "Agent produced a final answer",
    }
