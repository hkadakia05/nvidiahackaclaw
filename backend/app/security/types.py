from dataclasses import dataclass, field
from typing import Literal


DecisionValue = Literal["allow", "deny", "requires_approval"]


@dataclass
class SecurityAction:
    """A normalized action request from an agent or tool."""

    action_type: str
    tool_name: str | None = None
    command: str | None = None
    path: str | None = None
    domain: str | None = None
    description: str | None = None


@dataclass
class SecurityDecision:
    """Standard decision shape returned by the backend control plane."""

    decision: DecisionValue
    risk_level: str
    policy_triggered: str | None
    reason: str
    metadata: dict = field(default_factory=dict)


@dataclass
class ResourceCheck:
    """Resource policy check result."""

    checked: bool
    allowed: bool
    reason: str
    metadata: dict = field(default_factory=dict)


@dataclass
class SandboxResult:
    """Result of the backend sandbox wrapper."""

    status: str
    sandbox_used: bool
    output: str | None = None
    violation: str | None = None
    metadata: dict = field(default_factory=dict)
