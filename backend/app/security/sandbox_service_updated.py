from pathlib import Path
from typing import Dict, Any
import sys

# Add the security directory to the path so we can import the sandbox runner
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "security"))

from app.security.types import SandboxResult, SecurityAction, SecurityDecision
from security.sandbox.runner_callable import run_action_sandbox


class SandboxService:
    """Backend wrapper for sandbox validation."""

    def __init__(self, security_root: Path) -> None:
        self.security_root = security_root

    async def run(self, action: SecurityAction, decision: SecurityDecision) -> SandboxResult:
        """
        Validate execution through the available sandbox boundary.
        """
        if decision.decision == "deny":
            return SandboxResult(
                status="blocked",
                sandbox_used=False,
                violation=decision.reason,
                metadata=self._metadata("policy_blocked_before_sandbox"),
            )

        if decision.decision == "requires_approval":
            return SandboxResult(
                status="approval_required",
                sandbox_used=False,
                violation=decision.reason,
                metadata=self._metadata("approval_required_before_sandbox"),
            )

        # Run the action through the sandbox
        try:
            sandbox_result = run_action_sandbox({
                "action_type": action.action_type,
                "command": action.command,
                "path": action.path,
                "domain": action.domain,
                "tool_name": action.tool_name,
                "description": action.description,
            })
            
            return SandboxResult(
                status=sandbox_result["status"],
                sandbox_used=True,
                output=sandbox_result.get("output", "Sandbox execution completed"),
                violation=sandbox_result.get("violation"),
                metadata=self._metadata("sandbox_execution"),
            )
        except Exception as e:
            return SandboxResult(
                status="error",
                sandbox_used=True,
                violation=f"Sandbox execution failed: {str(e)}",
                metadata=self._metadata("sandbox_execution_error"),
            )

    def _metadata(self, mode: str) -> dict:
        return {
            "mode": mode,
            "runner_exists": True,  # We now have a proper runner
            "dockerfile_exists": False,  # We're not using Docker for this demo
            "docker_runtime_connected": False,
            "docker_runtime_reason": (
                "Using local sandbox runner instead of Docker for demo purposes"
            ),
        }