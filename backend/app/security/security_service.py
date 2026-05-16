import os
from dataclasses import asdict
from pathlib import Path

from app.security.approval_service import ApprovalService
from app.security.audit_service import AuditService
from app.security.policy_service import PolicyService
from app.security.resource_service import ResourceService
from app.security.sandbox_service import SandboxService
from app.security.types import ResourceCheck, SandboxResult, SecurityAction, SecurityDecision


class SecurityService:
    """Central backend control-plane facade for protected /security capabilities."""

    def __init__(self) -> None:
        backend_dir = Path(__file__).resolve().parents[2]
        repo_root = backend_dir.parent
        self.security_root = Path(os.getenv("SECURITY_ROOT", repo_root / "security"))

        self.policy_service = PolicyService(self.security_root)
        self.resource_service = ResourceService(self.security_root)
        self.sandbox_service = SandboxService(self.security_root)
        self.audit_service = AuditService(self.security_root)
        self.approval_service = ApprovalService(self.security_root)

    def evaluate_action(self, action: SecurityAction) -> SecurityDecision:
        """Evaluate policy and return the normalized decision shape."""
        return self.policy_service.evaluate(action)

    def check_resources(self, action: SecurityAction) -> ResourceCheck:
        """Check resource limits when the security module exposes them."""
        return self.resource_service.check(action)

    async def run_in_sandbox(
        self,
        action: SecurityAction,
        decision: SecurityDecision,
    ) -> SandboxResult:
        """Run the backend sandbox wrapper."""
        return await self.sandbox_service.run(action, decision)

    def handle_approval(
        self,
        action: SecurityAction,
        decision: SecurityDecision,
    ) -> dict:
        """Handle requires_approval decisions."""
        return self.approval_service.handle(action, decision)

    def write_audit_record(
        self,
        run_id: str,
        action: SecurityAction,
        decision: SecurityDecision,
        resource_check: ResourceCheck,
        sandbox_result: SandboxResult,
    ) -> dict:
        """Write all relevant audit logs."""
        audit_metadata = self.audit_service.write(
            run_id,
            action,
            decision,
            resource_check,
            sandbox_result,
        )
        decision.metadata["audit_written"] = True
        return audit_metadata

    def normalized_payload(
        self,
        action: SecurityAction,
        decision: SecurityDecision,
        resource_check: ResourceCheck | None = None,
        sandbox_result: SandboxResult | None = None,
        extra: dict | None = None,
    ) -> dict:
        """Build metadata for timeline events and REST history."""
        metadata = dict(decision.metadata)
        if resource_check is not None:
            metadata["resource_limits_checked"] = resource_check.checked
            metadata["resource_check"] = asdict(resource_check)
        if sandbox_result is not None:
            metadata["sandbox_used"] = sandbox_result.sandbox_used
            metadata["sandbox_result"] = asdict(sandbox_result)
        if extra:
            metadata.update(extra)

        return {
            "action_type": action.action_type,
            "tool_name": action.tool_name,
            "command": action.command,
            "path": action.path,
            "domain": action.domain,
            "decision": decision.decision,
            "risk_level": decision.risk_level,
            "policy_triggered": decision.policy_triggered,
            "reason": decision.reason,
            "metadata": metadata,
        }
