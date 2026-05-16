# Security Integration Audit

This document records how the backend integrates the protected `/security`
module. The backend does not modify, rewrite, or restructure `/security`.

## Connected Capabilities

`security/policies/shell.yaml`

- Connected through `backend/app/security/policy_service.py`.
- Uses `blocked_commands` for deny decisions.
- Uses command text in audit records and WebSocket security events.

`security/policies/filesystem.yaml`

- Connected through `backend/app/security/policy_service.py`.
- Uses `blocked_paths` for deny decisions.
- Uses `read_only` paths for `requires_approval` decisions.
- Sensitive files such as `.env`, `secrets.txt`, and `~/.ssh/id_rsa` are denied.

`security/policies/network.yaml`

- Connected through `backend/app/security/policy_service.py`.
- Uses `blocked_domains` for deny decisions.
- Uses `allowed_domains` for allow decisions.
- Unknown outbound domains return `requires_approval`.

`security/policies/risk-levels.yaml`

- Connected through `backend/app/security/policy_service.py`.
- Low-risk commands are allowed.
- Medium-risk and high-risk commands require approval unless directly blocked.

`security/logs/audit.log`

- Connected through `backend/app/security/audit_service.py`.
- Runtime writes structured JSON audit records containing run id, action,
  decision, resource check, and sandbox result.

`security/logs/security.log`

- Connected through `backend/app/security/audit_service.py`.
- Runtime writes compatibility blocked-shell-command lines.

`security/logs/filesystem.log`

- Connected through `backend/app/security/audit_service.py`.
- Runtime writes compatibility blocked-file-access lines.

`security/logs/network.log`

- Connected through `backend/app/security/audit_service.py`.
- Runtime writes compatibility blocked-network-access lines.

`security/Dockerfile`

- Connected operationally through Docker Compose by mounting `./security` at
  `/security` and setting `SECURITY_ROOT=/security`.
- Not used as an execution image yet because the sandbox runner has no
  parameterized command API.

`security/sandbox/runner.py`

- Connected indirectly through policy-compatible sandbox validation in
  `backend/app/security/sandbox_service.py`.
- Not imported directly because the file executes demo commands at import time.
- Not executed as a runtime sandbox yet because it does not accept backend action
  input or return structured results.

## Not Connectable Yet

Approval queue

- No approval queue, API, schema, or storage exists in `/security`.
- Backend returns `requires_approval`, emits `approval_required`, and safely
  stops the run.

Resource limits

- No GPU, CPU, memory, timeout, token, or cost limit policy exists in
  `/security`.
- Backend emits `resource_check` and records that no resource limits are present.

Docker sandbox execution

- `security/Dockerfile` can build a demo security container, but
  `security/sandbox/runner.py` does not expose a callable interface for a
  proposed backend action.
- Backend therefore uses policy-backed sandbox validation and records
  `docker_runtime_connected=false` in sandbox metadata.

## Runtime Flow

```text
Agent proposes action
-> run_manager receives action
-> SecurityService evaluates policy
-> ResourceService checks for resource-limit support
-> SandboxService validates the action
-> AuditService writes audit/log records
-> ApprovalService handles requires_approval metadata
-> run_manager streams WebSocket events
-> allowed actions continue
-> denied/approval actions stop safely
```

## Security WebSocket Events

```text
security_check
policy_evaluated
resource_check
sandbox_started
sandbox_completed
audit_written
action_allowed
action_blocked
approval_required
sandbox_violation
resource_limit_hit
run_failed
run_complete
```
