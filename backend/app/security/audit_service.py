import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path

from app.security.types import ResourceCheck, SandboxResult, SecurityAction, SecurityDecision


class AuditService:
    """Writes audit records to the protected security log sinks."""

    def __init__(self, security_root: Path) -> None:
        self.log_dir = security_root / "logs"

    def write(
        self,
        run_id: str,
        action: SecurityAction,
        decision: SecurityDecision,
        resource_check: ResourceCheck,
        sandbox_result: SandboxResult,
    ) -> dict:
        """Append structured and compatibility audit records."""
        self.log_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.utcnow().isoformat()
        record = {
            "timestamp": timestamp,
            "run_id": run_id,
            "action": asdict(action),
            "decision": asdict(decision),
            "resource_check": asdict(resource_check),
            "sandbox_result": asdict(sandbox_result),
        }

        self._append("audit.log", json.dumps(record))

        if decision.decision == "deny":
            if action.action_type == "shell" and action.command:
                self._append("security.log", f"[{timestamp}] BLOCKED cmd: {action.command}")
            elif action.action_type == "filesystem" and action.path:
                self._append(
                    "filesystem.log",
                    f"[{timestamp}] BLOCKED FILE ACCESS: {action.path}",
                )
            elif action.action_type == "network" and action.domain:
                self._append(
                    "network.log",
                    f"[{timestamp}] BLOCKED NETWORK ACCESS: {action.domain}",
                )

        return {
            "audit_written": True,
            "audit_log": str(self.log_dir / "audit.log"),
        }

    def _append(self, filename: str, line: str) -> None:
        with open(self.log_dir / filename, "a", encoding="utf-8") as log_file:
            log_file.write(line + "\n")
