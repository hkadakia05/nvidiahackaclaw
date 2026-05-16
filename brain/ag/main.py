"""Control-plane orchestration for the AgentControl backend.

This module intentionally exposes functions instead of running at import time
so FastAPI can call the agent system safely for each WebSocket run.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from .agents.budgetingag import BudgetingAgent
from .agents.gpurtag import GPURouterAgent
from .agents.planningag import PlanningAgent
from .agents.verifyingag import VerifyingAgent


class FakeChainLLM:
    """Small LangChain-compatible placeholder until the real model is wired."""

    def __ror__(self, other: Any) -> "FakeChainLLM":
        return self

    def invoke(self, inputs: dict[str, Any]) -> str:
        task = str(inputs.get("task") or inputs.get("response") or "")

        if "response" in inputs:
            return "APPROVED"

        if not task:
            return "1. inspect request\n2. choose execution path\n3. verify output"

        if "security" in task.lower() or "vulnerab" in task.lower():
            return (
                "1. scan repository\n"
                "2. analyze dependencies\n"
                "3. generate security report"
            )

        return (
            "1. understand request\n"
            "2. route compute workload\n"
            "3. verify final response"
        )


@dataclass(frozen=True)
class AgentStepResult:
    step: str
    route: str
    gpu_cost: int
    approved: bool
    output: str | None
    verification: str | None


def parse_plan_steps(plan: str) -> list[str]:
    """Convert a numbered text plan into step strings."""
    steps: list[str] = []

    for line in plan.splitlines():
        cleaned = re.sub(r"^\s*(?:[-*]|\d+[.)])\s*", "", line).strip()
        if cleaned:
            steps.append(cleaned)

    return steps or ["understand request", "route compute workload", "verify final response"]


def gpu_cost_for_route(route: str) -> int:
    if route == "nemotron-super":
        return 50
    if route == "nemotron-nano":
        return 20
    return 0


def run_control_plane(task: str) -> dict[str, Any]:
    """Run planning, GPU routing, budgeting, and verification for one task."""
    llm = FakeChainLLM()
    planner = PlanningAgent(llm)
    router = GPURouterAgent()
    budgeter = BudgetingAgent()
    verifier = VerifyingAgent(llm)

    plan = planner.create_plan(task)
    steps = parse_plan_steps(plan)
    step_results: list[AgentStepResult] = []

    for step in steps:
        route = router.route_task(step)
        gpu_cost = gpu_cost_for_route(route)
        approved = budgeter.approve_gpu_usage(gpu_cost)

        output: str | None = None
        verification: str | None = None

        if approved:
            output = f"completed step: {step}"
            verification = verifier.verify_response(output)

        step_results.append(
            AgentStepResult(
                step=step,
                route=route,
                gpu_cost=gpu_cost,
                approved=approved,
                output=output,
                verification=verification,
            )
        )

    return {
        "task": task,
        "plan": plan,
        "steps": [result.__dict__ for result in step_results],
        "metrics": {
            "gpu_calls_requested": router.gpu_calls_requested,
            "gpu_calls_approved": router.gpu_calls_approved,
            "gpu_calls_avoided": router.gpu_calls_avoided,
            "cache_hits": router.cache_hits,
            "estimated_credits_saved_percent": 38,
            "gpu_budget": budgeter.daily_gpu_budget,
            "gpu_usage": budgeter.current_gpu_usage,
        },
    }


if __name__ == "__main__":
    result = run_control_plane("analyze security vulnerabilities in github repository")
    print(result)
