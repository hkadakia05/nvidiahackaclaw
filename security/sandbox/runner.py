import yaml
#Dockerfile
with open("../policies/shell.yaml", "r") as f:
    shell_policy = yaml.safe_load(f)

blocked = shell_policy["blocked_commands"]

def run_cmd(cmd):
    if cmd in blocked:
        print(f"[BLOCKED] {cmd}")
        return

    print(f"[RUNNING] {cmd}")

run_cmd("cat .env")
run_cmd("ls")