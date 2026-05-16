from pathlib import Path

from app.security.types import ResourceCheck, SecurityAction


class ResourceService:
    """Checks resource controls if the protected security module exposes them."""

    def __init__(self, security_root: Path) -> None:
        self.security_root = security_root

    def check(self, action: SecurityAction) -> ResourceCheck:
        """
        Report resource-control status.

        The current /security module has no GPU, CPU, memory, timeout, token,
        or cost limit policy file. This service makes that explicit instead of
        pretending those controls exist.
        """
        return ResourceCheck(
            checked=False,
            allowed=True,
            reason="No resource limit policy is present in /security",
            metadata={
                "action_type": action.action_type,
                "resource_limits_available": False,
            },
        )
