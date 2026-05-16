import os
from pathlib import Path
from typing import Any

import yaml

from app.security.types import SecurityAction, SecurityDecision


class PolicyService:
    """Reads and evaluates the protected /security policy files."""

    def __init__(self, security_root: Path | None = None) -> None:
        backend_dir = Path(__file__).resolve().parents[2]
        repo_root = backend_dir.parent
        self.security_root = security_root or Path(
            os.getenv("SECURITY_ROOT", repo_root / "security")
        )
        self.policy_dir = self.security_root / "policies"

        self.shell_policy = self._load_policy("shell.yaml")
        self.filesystem_policy = self._load_policy("filesystem.yaml")
        self.network_policy = self._load_policy("network.yaml")
        self.risk_policy = self._load_policy("risk-levels.yaml")

    def _load_policy(self, filename: str) -> dict[str, Any]:
        policy_path = self.policy_dir / filename
        with open(policy_path, "r", encoding="utf-8") as policy_file:
            return yaml.safe_load(policy_file) or {}

    def evaluate(self, action: SecurityAction) -> SecurityDecision:
        """Evaluate a proposed action against every relevant policy category."""
        if action.action_type == "shell":
            return self._evaluate_shell_action(action.command or "")

        if action.action_type == "filesystem":
            return self._evaluate_filesystem_action(action.path or "")

        if action.action_type == "network":
            return self._evaluate_network_action(action.domain or "")

        return self._decision(
            decision="requires_approval",
            risk_level="unknown",
            policy_triggered="unknown_action_type",
            reason=f"Unknown action type: {action.action_type}",
        )

    def _evaluate_shell_action(self, command: str) -> SecurityDecision:
        if command in self.shell_policy.get("blocked_commands", []):
            return self._decision(
                decision="deny",
                risk_level="high",
                policy_triggered="shell_blocklist",
                reason=f"Command is blocked by shell policy: {command}",
            )

        risk_level = self._risk_for_command(command)
        if risk_level in {"high", "medium"}:
            return self._decision(
                decision="requires_approval",
                risk_level=risk_level,
                policy_triggered=f"{risk_level}_risk_command",
                reason=f"Command needs approval before execution: {command}",
            )

        return self._decision(
            decision="allow",
            risk_level="low",
            policy_triggered=None,
            reason="Safe operation",
        )

    def _evaluate_filesystem_action(self, path: str) -> SecurityDecision:
        if path in self.filesystem_policy.get("blocked_paths", []):
            return self._decision(
                decision="deny",
                risk_level="high",
                policy_triggered="filesystem_boundary",
                reason="Attempted access to a blocked path",
            )

        for read_only_path in self.filesystem_policy.get("read_only", []):
            prefix = read_only_path.replace("/**", "")
            if path.startswith(prefix):
                return self._decision(
                    decision="requires_approval",
                    risk_level="medium",
                    policy_triggered="read_only_filesystem",
                    reason="Attempted access to a read-only filesystem area",
                )

        return self._decision(
            decision="allow",
            risk_level="low",
            policy_triggered=None,
            reason="Filesystem access is allowed",
        )

    def _evaluate_network_action(self, domain: str) -> SecurityDecision:
        if domain in self.network_policy.get("blocked_domains", []):
            return self._decision(
                decision="deny",
                risk_level="high",
                policy_triggered="blocked_domain",
                reason=f"Outbound request is blocked: {domain}",
            )

        if domain in self.network_policy.get("allowed_domains", []):
            return self._decision(
                decision="allow",
                risk_level="low",
                policy_triggered=None,
                reason="Domain is explicitly allowed",
            )

        return self._decision(
            decision="requires_approval",
            risk_level="medium",
            policy_triggered="external_network_access",
            reason=f"Outbound request needs approval: {domain}",
        )

    def _risk_for_command(self, command: str) -> str:
        for risk_level, commands in (
            ("high", self.risk_policy.get("high_risk", [])),
            ("medium", self.risk_policy.get("medium_risk", [])),
            ("low", self.risk_policy.get("low_risk", [])),
        ):
            for risky_command in commands:
                if command == risky_command or command.startswith(f"{risky_command} "):
                    return risk_level

        return "low"

    def _decision(
        self,
        decision: str,
        risk_level: str,
        policy_triggered: str | None,
        reason: str,
    ) -> SecurityDecision:
        return SecurityDecision(
            decision=decision,
            risk_level=risk_level,
            policy_triggered=policy_triggered,
            reason=reason,
            metadata={
                "source": "security",
                "sandbox_used": False,
                "resource_limits_checked": False,
                "audit_written": False,
            },
        )
