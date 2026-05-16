import yaml
# need to install pyyaml in the Dockerfile for this to work

from datetime import datetime
from pathlib import Path

# base directory for runner.py
BASE_DIR = Path(__file__).resolve().parent

# correct paths for policies + logs
POLICY_FILE = BASE_DIR / "../policies/shell.yaml"
LOG_FILE = BASE_DIR / "../logs/security.log"

# ld cmd for shell
with open(POLICY_FILE, "r") as f:

    shell_policy = yaml.safe_load(f)

blocked_commands = shell_policy["blocked_commands"]


def log_violation(cmd):
    with open(LOG_FILE, "a") as log:
        log.write(
            f"[{datetime.now()}] BLOCKED cmd: {cmd}\n"
        )


def run_cmd(cmd):
    print(f"\n[AGENT REQUEST] {cmd}")

    if cmd in blocked_commands:
        print(f"[BLOCKED] {cmd}")
        log_violation(cmd)
        return

    print(f"[ALLOWED] {cmd}")

# load filesystem policy
with open(BASE_DIR / "../policies/filesystem.yaml", "r") as f:
    filesystem_policy = yaml.safe_load(f)

blocked_paths = filesystem_policy["blocked_paths"]

FILESYSTEM_LOG = BASE_DIR / "../logs/filesystem.log"


def log_filesystem_violation(path):
    with open(FILESYSTEM_LOG, "a") as log:
        log.write(
            f"[{datetime.now()}] BLOCKED FILE ACCESS: {path}\n"
        )


def access_file(path):
    print(f"\n[FILE ACCESS REQUEST] {path}")

    if path in blocked_paths:
        print(f"[BLOCKED FILE] {path}")
        log_filesystem_violation(path)
        return

    print(f"[File Access Granted] {path}")    


run_cmd("ls")
run_cmd("cat .env")
run_cmd("rm -rf /")
access_file(".env")
access_file("notes.txt")
