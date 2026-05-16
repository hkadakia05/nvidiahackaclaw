import yaml
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

# base dir for runner.py so docker doesnt tweak out
BASE_DIR = Path(__file__).resolve().parent

# paths for policies + logs n stuff
POLICY_FILE = BASE_DIR.parent / "policies/shell.yaml"
LOG_FILE = BASE_DIR.parent / "logs/security.log"

# load shell cmd policy before agent does dumb shit
with open(POLICY_FILE, "r") as f:
    shell_policy = yaml.safe_load(f)

blocked_commands = shell_policy["blocked_commands"]

# filesystem policy so agent doesnt touch sus files
FILESYSTEM_POLICY = BASE_DIR.parent / "policies/filesystem.yaml"
FILESYSTEM_LOG = BASE_DIR.parent / "logs/filesystem.log"

with open(FILESYSTEM_POLICY, "r") as f:
    filesystem_policy = yaml.safe_load(f)

blocked_paths = filesystem_policy["blocked_paths"]


def log_violation(cmd: str, violation_type: str = "command") -> None:
    """Log a security violation to the audit trail."""
    with open(LOG_FILE, "a") as log:
        log.write(
            f"[{datetime.now()}] BLOCKED {violation_type}: {cmd}\n"
        )


def log_filesystem_violation(path: str) -> None:
    """Log a filesystem violation to the audit trail."""
    with open(FILESYSTEM_LOG, "a") as log:
        log.write(
            f"[{datetime.now()}] BLOCKED FILE ACCESS: {path}\n"
        )


def run_cmd_sandbox(cmd: str, action_type: str = "shell") -> Dict[str, Any]:
    """
    Execute a command in sandboxed environment with security checks.
    
    Args:
        cmd (str): The command to execute
        action_type (str): Type of action being performed
        
    Returns:
        Dict[str, Any]: Result of the sandbox execution
    """
    print(f"\n[AGENT REQUEST] {cmd}")

    if cmd in blocked_commands:
        print(f"[BLOCKED] {cmd}")
        log_violation(cmd, "command")
        return {
            "status": "blocked",
            "violation": f"Command '{cmd}' is blocked by security policy",
            "command": cmd
        }

    print(f"[ALLOWED] {cmd}")
    return {
        "status": "completed",
        "output": f"Command '{cmd}' executed successfully",
        "command": cmd
    }


def access_file_sandbox(path: str, action_type: str = "filesystem") -> Dict[str, Any]:
    """
    Check filesystem access with security policy.
    
    Args:
        path (str): The file path to access
        action_type (str): Type of action being performed
        
    Returns:
        Dict[str, Any]: Result of the filesystem access check
    """
    print(f"\n[FILE ACCESS REQUEST] {path}")

    if path in blocked_paths:
        print(f"[BLOCKED FILE] {path}")
        log_filesystem_violation(path)
        return {
            "status": "blocked",
            "violation": f"Access to file '{path}' is blocked by security policy",
            "path": path
        }

    print(f"[FILE ACCESS GRANTED] {path}")
    return {
        "status": "completed",
        "output": f"Access to file '{path}' granted",
        "path": path
    }


def run_action_sandbox(action_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run a security action in sandboxed environment.
    
    Args:
        action_data (Dict[str, Any]): Action data including type and details
        
    Returns:
        Dict[str, Any]: Result of the sandbox execution
    """
    action_type = action_data.get("action_type", "unknown")
    
    if action_type == "shell":
        cmd = action_data.get("command", "")
        return run_cmd_sandbox(cmd, action_type)
    
    elif action_type == "filesystem":
        path = action_data.get("path", "")
        return access_file_sandbox(path, action_type)
    
    elif action_type == "network":
        domain = action_data.get("domain", "")
        # For now, just log the network request
        print(f"\n[NETWORK REQUEST] {domain}")
        return {
            "status": "completed",
            "output": f"Network request to {domain} completed",
            "domain": domain
        }
    
    else:
        return {
            "status": "blocked",
            "violation": f"Unknown action type: {action_type}"
        }


# For backward compatibility, we can still run the demo if needed
if __name__ == "__main__":
    # demo cmd requests
    run_cmd_sandbox("ls")
    run_cmd_sandbox("cat .env")
    run_cmd_sandbox("rm -rf /")

    # demo filesystem requests
    access_file_sandbox(".env")
    access_file_sandbox("notes.txt")