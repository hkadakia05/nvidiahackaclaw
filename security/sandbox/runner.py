import yaml
# need to install pyyaml in the Dockerfile for this to work

from datetime import datetime
from pathlib import Path

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


# log blocked cmd violations for audit trail grindset
def log_violation(cmd):
    with open(LOG_FILE, "a") as log:
        log.write(
            f"[{datetime.now()}] BLOCKED cmd: {cmd}\n"
        )


# simulate agent execution requests
def run_cmd(cmd):
    print(f"\n[AGENT REQUEST] {cmd}")

    if cmd in blocked_commands:
        print(f"[BLOCKED] {cmd}")
        log_violation(cmd)
        return

    print(f"[ALLOWED] {cmd}")


# filesystem violation logs bc we dont leak secrets in this household
def log_filesystem_violation(path):
    with open(FILESYSTEM_LOG, "a") as log:
        log.write(
            f"[{datetime.now()}] BLOCKED FILE ACCESS: {path}\n"
        )


# simulate protected file access checks
def access_file(path):
    print(f"\n[FILE ACCESS REQUEST] {path}")

    if path in blocked_paths:
        print(f"[BLOCKED FILE] {path}")
        log_filesystem_violation(path)
        return

    print(f"[FILE ACCESS GRANTED] {path}")


# demo cmd requests
run_cmd("ls")
run_cmd("cat .env")
run_cmd("rm -rf /")

# demo filesystem requests
access_file(".env")
access_file("notes.txt")