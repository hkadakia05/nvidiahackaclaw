from pathlib import Path

from app.security.types import SecurityAction, SecurityDecision


class ApprovalService:
    """Handles approval-required decisions if /security exposes a queue."""

    def __init__(self, security_root: Path) -> None:
        self.security_root = security_root

    def handle(self, action: SecurityAction, decision: SecurityDecision) -> dict:
        """
        Return approval metadata.

        The current /security module has no approval queue or approval API.
        Backend therefore pauses/stops approval-required actions safely.
        """
        return {
            "approval_queue_available": False,
            "action_type": action.action_type,
            "reason": decision.reason,
        }
