import os
import shutil
import subprocess
import tempfile
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
import queue


def _short_text(text: str, limit: int = 200) -> str:
    return text if len(text) <= limit else text[:limit] + "..."


def inspect_repository(
    github_url: str,
    workspace_root: str,
    max_repo_size_mb: int = 100,
    keep_clone: bool = False,
    event_queue: Optional[queue.Queue] = None,
) -> Optional[List[Dict[str, Any]]]:
    """
    Clone and inspect a GitHub repository. Returns a list of event dicts.

    This function performs only read-only inspection: it clones the repo,
    parses files, and looks for patterns. It does NOT execute repository code.
    """
    events: List[Dict[str, Any]] = []

    if not github_url.startswith("https://github.com/"):
        events.append({"type": "repo_clone_completed", "message": "Invalid GitHub URL", "details": {"url": github_url}})
        return events

    repo_id = github_url.rstrip("/\n").split("/")[-2:]
    repo_name = "-".join(repo_id)

    clone_parent = Path(workspace_root)
    clone_parent.mkdir(parents=True, exist_ok=True)
    clone_dir = clone_parent / f"{repo_name}-{os.urandom(6).hex()}"

    events.append({"type": "repo_clone_started", "message": f"Cloning {github_url}", "details": {"url": github_url, "dest": str(clone_dir)}})
    if event_queue is not None:
        event_queue.put(events[-1])

    try:
        # Run a shallow clone
        subprocess.run(["git", "clone", "--depth", "1", github_url, str(clone_dir)], check=True, capture_output=True, text=True, timeout=120)
        events.append({"type": "repo_clone_completed", "message": "Clone completed", "details": {"dest": str(clone_dir)}})
        if event_queue is not None:
            event_queue.put(events[-1])
    except Exception as exc:
        events.append({"type": "repo_clone_completed", "message": f"Clone failed: {exc}", "details": {"error": _short_text(str(exc))}})
        if event_queue is not None:
            event_queue.put(events[-1])
        # Cleanup partial clone
        try:
            if clone_dir.exists():
                shutil.rmtree(clone_dir)
        except Exception:
            pass
        return events

    # Basic repository walk and detection
    events.append({"type": "repo_structure_detected", "message": "Scanning repository structure", "details": {"root": str(clone_dir)}})
    if event_queue is not None:
        event_queue.put(events[-1])

    found_files = {}
    languages = set()
    package_managers = set()
    dependencies = {}
    important_files = ["package.json", "requirements.txt", "pyproject.toml", "Dockerfile", "README.md", ".env", ".gitignore"]

    for root, dirs, files in os.walk(clone_dir):
        for fname in files:
            if fname in important_files:
                path = Path(root) / fname
                try:
                    found_files[fname] = str(path.relative_to(clone_dir))
                except Exception:
                    found_files[fname] = str(path)

            # quick language detection
            if fname.endswith((".py",)):
                languages.add("python")
            if fname.endswith((".js", ".ts", ".jsx", ".tsx")):
                languages.add("javascript")

    # Parse package.json if present
    pkg_path = clone_dir / "package.json"
    if pkg_path.exists():
        try:
            with open(pkg_path, "r", encoding="utf-8") as f:
                pkg = json.load(f)
            dependencies["npm"] = {
                "dependencies": pkg.get("dependencies", {}),
                "devDependencies": pkg.get("devDependencies", {}),
                "scripts": pkg.get("scripts", {}),
            }
            package_managers.add("npm")
        except Exception as exc:
            events.append({"type": "dependency_scan_started", "message": "Failed to parse package.json", "details": {"error": _short_text(str(exc))}})

    # Parse requirements.txt
    req_path = clone_dir / "requirements.txt"
    if req_path.exists():
        try:
            with open(req_path, "r", encoding="utf-8") as f:
                lines = [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]
            dependencies["pip"] = lines
            package_managers.add("pip")
        except Exception as exc:
            events.append({"type": "dependency_scan_started", "message": "Failed to parse requirements.txt", "details": {"error": _short_text(str(exc))}})

    # Parse pyproject.toml for poetry/modern python projects
    pyproj = clone_dir / "pyproject.toml"
    if pyproj.exists():
        try:
            # avoid adding toml dependency; do light parse
            with open(pyproj, "r", encoding="utf-8") as f:
                content = f.read()
            if "[tool.poetry]" in content or "[project]" in content:
                package_managers.add("poetry")
            dependencies["pyproject_snippet"] = _short_text(content, 1000)
        except Exception as exc:
            events.append({"type": "dependency_scan_started", "message": "Failed to read pyproject.toml", "details": {"error": _short_text(str(exc))}})

    events.append({"type": "dependency_scan_started", "message": "Dependency scanning started", "details": {"package_managers": list(package_managers)}})
    if event_queue is not None:
        event_queue.put(events[-1])

    events.append({"type": "dependency_scan_completed", "message": "Dependency scanning completed", "details": {"dependencies_summary": {k: (len(v) if isinstance(v, (list, dict)) else 1) for k, v in dependencies.items()}}})
    if event_queue is not None:
        event_queue.put(events[-1])

    # Security scan - simple heuristic checks
    findings = []
    events.append({"type": "security_scan_started", "message": "Security scan started", "details": {}})
    if event_queue is not None:
        event_queue.put(events[-1])

    # scan for secrets, exec/eval, subprocess, os.system, .env committed, wildcard CORS
    for root, dirs, files in os.walk(clone_dir):
        for fname in files:
            fpath = Path(root) / fname
            try:
                if fpath.suffix in {".py", ".js", ".ts", ".jsx", ".tsx", ".env", ""}:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as fh:
                        text = fh.read()
                    if ".env" in fname:
                        findings.append({"type": "security_finding", "message": ".env file committed", "details": {"path": str(fpath.relative_to(clone_dir))}})
                    if "eval(" in text or "exec(" in text:
                        findings.append({"type": "security_finding", "message": "Use of eval/exec detected", "details": {"path": str(fpath.relative_to(clone_dir))}})
                    if "subprocess" in text or "os.system" in text:
                        findings.append({"type": "security_finding", "message": "Potential shell execution usage", "details": {"path": str(fpath.relative_to(clone_dir))}})
                    if "allow_origins" in text and "*" in text:
                        findings.append({"type": "security_finding", "message": "Wildcard CORS detected", "details": {"path": str(fpath.relative_to(clone_dir))}})
                    if "debug=True" in text or "FLASK_DEBUG" in text:
                        findings.append({"type": "security_finding", "message": "Debug mode may be enabled", "details": {"path": str(fpath.relative_to(clone_dir))}})
                    # naive API key detection
                    if "sk-" in text or "API_KEY" in text or "AWS_SECRET_ACCESS_KEY" in text:
                        findings.append({"type": "security_finding", "message": "Possible hardcoded API key or secret", "details": {"path": str(fpath.relative_to(clone_dir))}})
            except Exception:
                continue

    # Remove duplicate findings by (type,message,path)
    seen = set()
    unique_findings = []
    for f in findings:
        key = (f.get("type"), f.get("message"), str(f.get("details", {}).get("path")))
        if key in seen:
            continue
        seen.add(key)
        unique_findings.append(f)

    for f in unique_findings:
        events.append(f)

    # Basic recommendations
    recs = []
    if "package_managers" in locals() and not package_managers:
        recs.append("No package manager files found; add package.json or requirements.txt")
    if any(f["message"] == ".env file committed" for f in unique_findings):
        recs.append("Remove .env from repo and add secrets to environment or secret store")
    if any("eval/exec" in f["message"] for f in unique_findings):
        recs.append("Avoid eval/exec; prefer safe parsers or restricted execution")

    events.append({"type": "agent_recommendation", "message": "Recommendations generated", "details": {"recommendations": recs}})
    if event_queue is not None:
        event_queue.put(events[-1])

    events.append({"type": "run_complete", "message": "Repository analysis complete", "details": {"path": str(clone_dir)}})
    if event_queue is not None:
        event_queue.put(events[-1])

    # cleanup unless requested to keep
    if not keep_clone:
        try:
            shutil.rmtree(clone_dir)
            events.append({"type": "repo_cleanup", "message": "Cloned repository removed", "details": {"dest": str(clone_dir)}})
            if event_queue is not None:
                event_queue.put(events[-1])
        except Exception as exc:
            events.append({"type": "repo_cleanup", "message": f"Failed to delete clone: {exc}", "details": {"error": _short_text(str(exc))}})
            if event_queue is not None:
                event_queue.put(events[-1])

    return events if event_queue is None else None
