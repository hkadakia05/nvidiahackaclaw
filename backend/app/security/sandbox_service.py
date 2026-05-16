from pathlib import Path

from app.security.types import SandboxResult, SecurityAction, SecurityDecision


class SandboxService:
    """Backend wrapper for sandbox validation."""

    def __init__(self, security_root: Path) -> None:
        self.security_root = security_root
        self.runner_path = security_root / "sandbox" / "runner.py"
        self.dockerfile_path = security_root / "Dockerfile"

    async def run(self, action: SecurityAction, decision: SecurityDecision) -> SandboxResult:
        """
        Validate execution through the available sandbox boundary.

        The protected runner is currently a demo script, not a parameterized
        command API. Importing it would execute demo commands immediately, so
        the backend uses policy-backed sandbox validation and documents the
        Docker runner as future-only until a callable interface exists.
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

        target = action.command or action.path or action.domain or action.action_type
        return SandboxResult(
            status="completed",
            sandbox_used=True,
            output=f"Sandbox policy validation completed for: {target}",
            metadata=self._metadata("policy_validation_wrapper"),
        )

    def _metadata(self, mode: str) -> dict:
        return {
            "mode": mode,
            "runner_exists": self.runner_path.exists(),
            "dockerfile_exists": self.dockerfile_path.exists(),
            "docker_runtime_connected": False,
            "docker_runtime_reason": (
                "security/sandbox/runner.py has import-time demo execution and "
                "does not expose a parameterized backend API"
            ),
        }
