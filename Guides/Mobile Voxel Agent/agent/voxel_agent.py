#!/usr/bin/env python3
"""Constrained voxel-asset agent controller for Termux.

The model never receives a shell. It can only return one JSON request per
turn, and each request maps to a fixed Python function:

  write_voxel_spec  write a validated voxel JSON spec (and a manifest)
  validate_voxel    run the fixed Godot build/validation script on one asset
  done              end the session

All writes stay inside one disposable Git worktree under
$WORKSPACE/sessions/. The OFF switch (voxel-mode off) is checked before
every model call and every action.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path, PurePosixPath

HOME = Path.home()
CONFIG_DIR = Path(os.environ.get("VOXEL_AGENT_CONFIG_DIR", HOME / ".config/voxel-agent"))
CONFIG_FILE = CONFIG_DIR / "config.json"
MODE_FILE = CONFIG_DIR / "mode"
STOP_FILE = CONFIG_DIR / "STOP"

SPEC_ROOT = "assets/generated"
MANIFEST_ROOT = ".ai/manifests"
SCENE_ROOT = "scenes/generated"
BUILD_SCRIPT = "res://tools/build_voxel.gd"

NAME_RE = re.compile(r"^[a-z0-9_]{1,48}$")
HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
SESSION_ID_RE = re.compile(r"^[0-9]{8}-[0-9]{6}$")

DEFAULT_LIMITS = {
    "command_timeout_seconds": 120,
    "request_timeout_seconds": 300,
    "maximum_spec_bytes": 2 * 1024 * 1024,
    "maximum_axis": 64,
    "maximum_voxels": 262144,
    "maximum_palette": 256,
    "maximum_steps": 12,
}

SYSTEM_PROMPT = """You build voxel assets for a Godot 4 project.
Reply with exactly one JSON object and nothing else: no prose, no code fences.
Allowed requests:

{"action": "write_voxel_spec",
 "path": "assets/generated/<name>.json",
 "asset": {"name": "<name>",
           "dimensions": [X, Y, Z],
           "palette": ["#RRGGBB", ...],
           "voxels": [[x, y, z, palette_index], ...]}}

{"action": "validate_voxel", "name": "<name>"}

{"action": "done", "summary": "<one sentence>"}

Rules: <name> is lowercase letters, digits and underscores. Each axis is
1..{maximum_axis}. Coordinates are integers with 0 <= x < X (same for y, z).
Each coordinate appears once. palette_index points into palette. At most
{maximum_voxels} voxels. Validate every asset you write, then send done.
You will receive each result as a JSON message."""


class Denied(ValueError):
    """A model request that the policy rejects."""


# ---------------------------------------------------------------- config

def load_config() -> dict:
    config = json.loads(CONFIG_FILE.read_text())
    config["limits"] = {**DEFAULT_LIMITS, **config.get("limits", {})}
    return config


def current_mode() -> str:
    if STOP_FILE.exists():
        return "off"
    try:
        value = MODE_FILE.read_text().strip()
    except FileNotFoundError:
        return "off"
    return value if value in ("local", "remote") else "off"


def require_on() -> str:
    mode = current_mode()
    if mode == "off":
        raise RuntimeError("AI mode is OFF")
    return mode


# ---------------------------------------------------------------- paths

def bounded_path(session: Path, relative, root: str, suffix: str) -> Path:
    """Return session/relative if it is a plain path under root with suffix.

    Symlinks are checked component by component *before* resolving, so a
    link planted anywhere along the path is refused rather than followed.
    """
    if not isinstance(relative, str) or not relative or "\\" in relative:
        raise Denied("Path must be a non-empty POSIX string")
    rel = PurePosixPath(relative)
    if rel.is_absolute():
        raise Denied("Absolute path denied")
    if any(part in ("..", ".", "") for part in relative.split("/")):
        raise Denied("Path traversal denied")
    root_parts = PurePosixPath(root).parts
    if rel.parts[: len(root_parts)] != root_parts or len(rel.parts) <= len(root_parts):
        raise Denied(f"Path is not under {root}/")
    if rel.suffix != suffix:
        raise Denied(f"Only {suffix} files may be written here")

    session = session.resolve(strict=True)
    current = session
    for part in rel.parts:
        current = current / part
        if current.is_symlink():
            raise Denied("Symlink denied")
    if not current.resolve(strict=False).is_relative_to(session):
        raise Denied("Workspace escape denied")
    return current


def check_session(workspace: Path, session: Path) -> Path:
    sessions = (workspace / "sessions").resolve(strict=True)
    if session.is_symlink():
        raise Denied("Session path is a symlink")
    session = session.resolve(strict=True)
    if session.parent != sessions or not SESSION_ID_RE.match(session.name):
        raise Denied(f"Session must be {sessions}/<YYYYmmdd-HHMMSS>")
    if not (session / ".git").is_file():
        raise Denied("Session is not a Git worktree; create it with voxel-session new")
    if not (session / "project.godot").is_file():
        raise Denied("Session has no project.godot at its root")
    return session


def write_atomic(target: Path, data: str) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_name(target.name + ".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w") as handle:
        handle.write(data)
    os.replace(tmp, target)


# ---------------------------------------------------------------- validation

def _is_int(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def validate_asset(asset, limits: dict) -> dict:
    if not isinstance(asset, dict):
        raise Denied("asset must be an object")
    if set(asset) != {"name", "dimensions", "palette", "voxels"}:
        raise Denied("asset needs exactly: name, dimensions, palette, voxels")

    name = asset["name"]
    if not isinstance(name, str) or not NAME_RE.match(name):
        raise Denied("Invalid asset name")

    dimensions = asset["dimensions"]
    axis = limits["maximum_axis"]
    if (not isinstance(dimensions, list) or len(dimensions) != 3
            or not all(_is_int(n) and 1 <= n <= axis for n in dimensions)):
        raise Denied(f"dimensions must be three integers in 1..{axis}")

    palette = asset["palette"]
    if (not isinstance(palette, list) or not 1 <= len(palette) <= limits["maximum_palette"]
            or not all(isinstance(c, str) and HEX_RE.match(c) for c in palette)):
        raise Denied("palette must be a list of #RRGGBB colors")

    voxels = asset["voxels"]
    if not isinstance(voxels, list):
        raise Denied("voxels must be a list")
    if len(voxels) > limits["maximum_voxels"]:
        raise Denied("Voxel limit exceeded")
    seen = set()
    for voxel in voxels:
        if not isinstance(voxel, list) or len(voxel) != 4 or not all(map(_is_int, voxel)):
            raise Denied("Each voxel must be [x, y, z, palette_index] integers")
        x, y, z, colour = voxel
        if not (0 <= x < dimensions[0] and 0 <= y < dimensions[1] and 0 <= z < dimensions[2]):
            raise Denied(f"Voxel {voxel} is outside dimensions")
        if not 0 <= colour < len(palette):
            raise Denied(f"Voxel {voxel} has an invalid palette index")
        if (x, y, z) in seen:
            raise Denied(f"Duplicate voxel at {[x, y, z]}")
        seen.add((x, y, z))
    return asset


def _require_keys(request: dict, keys: set) -> None:
    if set(request) != keys:
        raise Denied(f"{request.get('action')} needs exactly: {', '.join(sorted(keys))}")


# ---------------------------------------------------------------- actions

def write_voxel_spec(session: Path, request: dict, limits: dict) -> dict:
    _require_keys(request, {"action", "path", "asset"})
    asset = validate_asset(request["asset"], limits)
    name = asset["name"]
    if request["path"] != f"{SPEC_ROOT}/{name}.json":
        raise Denied(f"path must be {SPEC_ROOT}/{name}.json")

    data = json.dumps(asset, separators=(",", ":"))
    if len(data.encode()) > limits["maximum_spec_bytes"]:
        raise Denied("Specification too large")

    spec = bounded_path(session, request["path"], SPEC_ROOT, ".json")
    manifest = bounded_path(session, f"{MANIFEST_ROOT}/{name}.json", MANIFEST_ROOT, ".json")
    # The manifest is written by the controller, never by the model.
    manifest_data = json.dumps({
        "spec": f"res://{SPEC_ROOT}/{name}.json",
        "scene": f"res://{SCENE_ROOT}/{name}.tscn",
    }, indent=2)
    write_atomic(spec, data)
    write_atomic(manifest, manifest_data + "\n")
    return {"written": request["path"], "voxels": len(asset["voxels"])}


def run_godot(session: Path, name: str, config: dict) -> dict:
    godot = config.get("godot_bin") or os.environ.get("GODOT_BIN")
    if not godot:
        raise RuntimeError("No Godot binary configured (godot_bin or GODOT_BIN)")
    argv = [godot, "--headless", "--path", str(session), "--script", BUILD_SCRIPT, "--", name]
    env = {key: os.environ[key] for key in ("HOME", "PATH", "TMPDIR", "LANG", "PREFIX")
           if key in os.environ}
    try:
        proc = subprocess.run(
            argv, cwd=session, shell=False, capture_output=True, text=True, env=env,
            timeout=config["limits"]["command_timeout_seconds"],
        )
    except subprocess.TimeoutExpired:
        return {"returncode": None, "error": "Godot timed out"}
    return {
        "returncode": proc.returncode,
        "stdout": proc.stdout[-2000:],
        "stderr": proc.stderr[-2000:],
    }


def validate_voxel(session: Path, request: dict, config: dict) -> dict:
    _require_keys(request, {"action", "name"})
    name = request["name"]
    if not isinstance(name, str) or not NAME_RE.match(name):
        raise Denied("Invalid asset name")
    manifest = bounded_path(session, f"{MANIFEST_ROOT}/{name}.json", MANIFEST_ROOT, ".json")
    if not manifest.is_file():
        raise Denied(f"No manifest for {name}; write the spec first")
    return run_godot(session, name, config)


def execute(session: Path, request, config: dict) -> dict:
    require_on()
    if not isinstance(request, dict):
        raise Denied("Request must be a JSON object")
    action = request.get("action")
    if action == "write_voxel_spec":
        return write_voxel_spec(session, request, config["limits"])
    if action == "validate_voxel":
        return validate_voxel(session, request, config)
    if action == "done":
        _require_keys(request, {"action", "summary"})
        return {"done": True}
    raise Denied("Unknown action denied")


# ---------------------------------------------------------------- model

def endpoint(config: dict, mode: str) -> dict:
    settings = config[mode]
    base_url = settings["base_url"].rstrip("/")
    if mode == "local" and not re.match(r"^http://(127\.0\.0\.1|localhost)(:\d+)?/", base_url + "/"):
        raise RuntimeError("LOCAL endpoint must be on 127.0.0.1")
    if mode == "remote" and not base_url.startswith("https://"):
        raise RuntimeError("REMOTE endpoint must use https://")
    return settings | {"base_url": base_url}


def chat(config: dict, mode: str, messages: list) -> str:
    settings = endpoint(config, mode)
    headers = {"Content-Type": "application/json"}
    if mode == "remote":
        key = Path(settings["api_key_file"]).read_text().strip()
        headers["Authorization"] = f"Bearer {key}"
    body = {"model": settings["model"], "messages": messages, "temperature": 0.2}
    if settings.get("json_mode", True):
        body["response_format"] = {"type": "json_object"}
    req = urllib.request.Request(
        settings["base_url"] + "/chat/completions",
        data=json.dumps(body).encode(), headers=headers, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=config["limits"]["request_timeout_seconds"]) as resp:
            payload = json.load(resp)
    except urllib.error.HTTPError as err:
        # Never echo request headers; the status line is enough.
        raise RuntimeError(f"Model endpoint returned HTTP {err.code}") from None
    return payload["choices"][0]["message"]["content"]


def parse_request(text: str):
    """Accept one bare JSON object; reject prose, fences and arrays."""
    try:
        request = json.loads(text.strip())
    except (json.JSONDecodeError, AttributeError):
        raise Denied("Reply was not a single JSON object") from None
    if not isinstance(request, dict):
        raise Denied("Reply was not a single JSON object")
    return request


# ---------------------------------------------------------------- loop

def log_event(log: Path, **fields) -> None:
    fields["time"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(log, "a") as handle:
        handle.write(json.dumps(fields) + "\n")


def run(session_arg: str, prompt: str) -> int:
    config = load_config()
    limits = config["limits"]
    workspace = Path(config["workspace"])
    session = check_session(workspace, Path(session_arg))
    log = workspace / "logs" / f"{session.name}.jsonl"
    log.parent.mkdir(parents=True, exist_ok=True)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT
            .replace("{maximum_axis}", str(limits["maximum_axis"]))
            .replace("{maximum_voxels}", str(limits["maximum_voxels"]))},
        {"role": "user", "content": prompt},
    ]
    for step in range(limits["maximum_steps"]):
        mode = require_on()
        reply = chat(config, mode, messages)
        messages.append({"role": "assistant", "content": reply})
        try:
            request = parse_request(reply)
            result = {"ok": True, "result": execute(session, request, config)}
        except Denied as err:
            request, result = None, {"ok": False, "error": str(err)}
        action = request.get("action") if isinstance(request, dict) else None
        log_event(log, step=step, mode=mode, action=action, ok=result["ok"],
                  error=result.get("error"))
        print(f"[{step}] {action or 'invalid'}: {'ok' if result['ok'] else result['error']}")
        if result["ok"] and result["result"].get("done"):
            print(f"Done. Review with: git -C {session} diff")
            return 0
        messages.append({"role": "user", "content": json.dumps(result)})
    print("Step limit reached; review the session before continuing.", file=sys.stderr)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--session", required=True, help="Path of a session worktree")
    parser.add_argument("prompt", help="What to build, e.g. 'a small glowing ember'")
    args = parser.parse_args()
    try:
        return run(args.session, args.prompt)
    except (RuntimeError, Denied, FileNotFoundError) as err:
        print(f"voxel-agent: {err}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
