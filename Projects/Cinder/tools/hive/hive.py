#!/usr/bin/env python3
"""Hive: an hour-long game-feature automation across your own devices.

Built like the cellular system:
  ROOT cell (old PC)   runs the hub: the page, the task list, Godot checks, saving.
  WORKER cells (phones) ask their own local AI to plan, write and heal code.

  mitosis    a goal splits into small tasks, each one new GDScript file
  wound      a failed Godot check turns the task into a healing job
  necrosis   a task that fails 3 heals dies and is logged for you
  energy     a cell low on memory rests instead of taking work
  conservation  every success is a git commit on its own hive/ branch,
                never your main branch; nothing is thrown away silently

    python3 hive.py hub     start the hub + page   (old PC)
    python3 hive.py cell    start a worker cell    (each phone, or the old PC too)

Only the Python standard library is used.
"""
import http.server
import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request

HOME = os.path.expanduser("~")
CONFIG_PATH = os.path.join(HOME, ".hive", "config.json")
HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULTS = {
    "name": os.uname().nodename if hasattr(os, "uname") else "cell",
    "hub_url": "http://127.0.0.1:8790",
    "port": 8790,
    "ai_url": "http://127.0.0.1:11434",
    "model": "qwen2.5-coder:1.5b",
    "think": None,
    "repo_dir": os.path.join(HOME, "Game-Dev-Resources"),
    "project_dir": "Projects/Cinder",   # the Godot project inside the repo
    "features_dir": "features",         # new feature files go here
    "godot": "",                        # path to Godot; empty = skip checks
    "push": True,
    "min_free_mb": 900,                 # energy: below this a cell rests
}
MAX_HEALS = 3
CAPS = {"plan": 0.35, "code": 0.7, "heal": 0.7, "judge": 0.35}  # rough model temperature


def config():
    cfg = dict(DEFAULTS)
    try:
        with open(CONFIG_PATH, encoding="utf-8-sig") as f:
            cfg.update(json.load(f))
    except (OSError, ValueError):
        pass
    return cfg


def free_mb():
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemAvailable:"):
                    return int(line.split()[1]) // 1024
    except OSError:
        pass
    return None


def http_json(url, body=None, timeout=30, code=""):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json", "X-Hive-Code": code})
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read() or b"{}")


# ============================================================== the hub (ROOT)

class Hub:
    def __init__(self, cfg):
        self.cfg = cfg
        self.lock = threading.RLock()
        self.state = {
            "status": "idle", "goal": "", "minutes": 60, "started": 0, "deadline": 0,
            "round": 0, "branch": "", "tasks": [], "cells": {}, "log": [], "judge": "",
            "commits": 0, "planning": False, "judging": False, "judged_round": 0, "busy_since": 0,
        }
        self.next_id = 1
        self.project = os.path.join(cfg["repo_dir"], cfg["project_dir"])

    # ---- small helpers
    def log(self, text, cell="hub"):
        with self.lock:
            self.state["log"].append({"t": int(time.time()), "cell": cell, "text": text})
            del self.state["log"][:-200]
        print("[%s] %s" % (cell, text), flush=True)

    def git(self, *args, check=True):
        r = subprocess.run(["git", "-C", self.cfg["repo_dir"], *args], capture_output=True, text=True)
        if check and r.returncode != 0:
            raise RuntimeError("git %s: %s" % (args[0], r.stderr.strip()[-300:]))
        return r.stdout.strip()

    def features(self):
        folder = os.path.join(self.project, self.cfg["features_dir"])
        os.makedirs(folder, exist_ok=True)
        return sorted(f for f in os.listdir(folder) if f.endswith(".gd"))

    # ---- control
    def start(self, goal, minutes):
        with self.lock:
            if self.state["status"] == "running":
                return "already running"
            stamp = time.strftime("%Y%m%d-%H%M")
            branch = "hive/" + stamp
            self.git("fetch", "-q", "origin", check=False)
            self.git("checkout", "-q", "-B", branch)
            self.state.update(status="running", goal=goal.strip() or "Add small useful AoDJV features",
                              minutes=max(5, min(int(minutes), 240)), started=time.time(), round=0,
                              branch=branch, tasks=[], judge="", commits=0, planning=False, judging=False,
                              judged_round=0)
            self.state["deadline"] = self.state["started"] + self.state["minutes"] * 60
        self.log("Started on branch %s for %d minutes: %s" % (branch, self.state["minutes"], self.state["goal"]))
        return "started"

    def halt(self, why="halted by you"):
        with self.lock:
            if self.state["status"] != "running":
                return "not running"
            self.state["status"] = "halted" if why == "halted by you" else "done"
        self.log("Stopped: " + why)
        return "stopped"

    def tick(self):
        with self.lock:
            if self.state["status"] == "running" and time.time() > self.state["deadline"]:
                self.halt("time is up")
            now = time.time()
            for name, cell in self.state["cells"].items():
                cell["alive"] = now - cell["seen"] < 60
            # Self-repair: work held by a cell that went quiet goes back to the pool.
            if (self.state["planning"] or self.state["judging"]) and now - self.state["busy_since"] > 600:
                if self.state["planning"]:
                    self.state["round"] -= 1
                self.state["planning"] = self.state["judging"] = False
            for t in self.state["tasks"]:
                if t["owner"] and now - t.get("since", now) > 900:
                    t["owner"] = ""
                    if t["state"] == "growing":
                        t["state"] = "seed"

    # ---- work assignment
    def next_job(self, name, info):
        with self.lock:
            cell = self.state["cells"].setdefault(name, {"name": name, "done": 0})
            cell.update(info, seen=time.time(), job="", alive=True)
            if self.state["status"] != "running":
                return {"type": "sleep", "seconds": 10}
            mem = info.get("free_mb")
            if mem is not None and mem < info.get("rest_below", self.cfg["min_free_mb"]):
                cell["job"] = "resting (low energy)"
                return {"type": "sleep", "seconds": 30}
            tasks = self.state["tasks"]
            for t in tasks:
                if t["state"] == "wounded" and not t["owner"]:
                    return self._assign(cell, t, "heal")
            for t in tasks:
                if t["state"] == "seed" and not t["owner"]:
                    return self._assign(cell, t, "code")
            open_tasks = [t for t in tasks if t["state"] in ("seed", "growing", "wounded", "checking")]
            if not open_tasks and not self.state["planning"] and not self.state["judging"]:
                if self.state["judged_round"] < self.state["round"] and any(t["round"] == self.state["round"] for t in tasks):
                    self.state["judging"] = True
                    self.state["judged_round"] = self.state["round"]
                    self.state["busy_since"] = time.time()
                    cell["job"] = "judging the round"
                    return {"type": "judge", "goal": self.state["goal"], "done": self._done_titles()}
                self.state["planning"] = True
                self.state["busy_since"] = time.time()
                self.state["round"] += 1
                cell["job"] = "mitosis: splitting the goal"
                return {"type": "plan", "goal": self.state["goal"], "done": self._done_titles(),
                        "files": self.features(), "focus": self.state["judge"]}
            return {"type": "sleep", "seconds": 8}

    def _assign(self, cell, task, kind):
        task["owner"] = cell["name"]
        task["since"] = time.time()
        task["state"] = "growing" if kind == "code" else "wounded"
        cell["job"] = ("writing " if kind == "code" else "healing ") + task["title"]
        job = {"type": kind, "task": task["id"], "title": task["title"], "detail": task["detail"],
               "file": task["file"], "goal": self.state["goal"]}
        if kind == "heal":
            job["code"] = task.get("code", "")
            job["error"] = task.get("error", "")
        return job

    def _done_titles(self):
        return [t["title"] for t in self.state["tasks"] if t["state"] == "done"][-20:]

    # ---- results
    def result(self, name, body):
        kind = body.get("type")
        with self.lock:
            cell = self.state["cells"].get(name, {})
            cell["job"] = ""
        if kind == "plan":
            self._got_plan(name, body)
        elif kind == "judge":
            self._got_judge(name, body)
        elif kind in ("code", "heal"):
            self._got_code(name, body)
        return "ok"

    def _got_plan(self, name, body):
        with self.lock:
            self.state["planning"] = False
            made = 0
            for item in body.get("tasks", [])[:4]:
                title = str(item.get("title", "")).strip()[:80]
                file = safe_name(item.get("file", "") or title)
                if not title or not file or any(t["file"] == file or same_idea(t["title"], title)
                                                for t in self.state["tasks"] if t["state"] != "necrotic"):
                    continue
                self.state["tasks"].append({"id": self.next_id, "title": title, "file": file,
                                            "detail": str(item.get("detail", ""))[:600], "state": "seed",
                                            "owner": "", "tries": 0, "round": self.state["round"]})
                self.next_id += 1
                made += 1
        self.log("Mitosis: goal split into %d new task cells" % made, name)
        if not made:
            self.log("No usable tasks came back; trying again next turn.", name)

    def _got_judge(self, name, body):
        with self.lock:
            self.state["judging"] = False
            verdict = str(body.get("verdict", "continue")).lower()
            self.state["judge"] = str(body.get("next_focus", ""))[:300]
        self.log("Judge: %s. %s" % (verdict, str(body.get("reason", ""))[:200]), name)
        if verdict.startswith("stop"):
            self.halt("judge says the goal is reached")

    def _got_code(self, name, body):
        with self.lock:
            task = next((t for t in self.state["tasks"] if t["id"] == body.get("task")), None)
            if not task or self.state["status"] != "running":
                return
            task["state"] = "checking"
            task["owner"] = ""
        code = body.get("code", "")
        if not code.strip():
            self._wound(task, "The AI returned no code.", "", name)
            return
        rel = os.path.join(self.cfg["features_dir"], task["file"])
        path = os.path.join(self.project, rel)
        with open(path, "w", encoding="utf-8") as f:
            f.write(code.rstrip() + "\n")
        error = godot_check(self.cfg, self.project, "res://" + rel.replace(os.sep, "/"))
        if error:
            self._wound(task, error, code, name)
            return
        try:
            self.git("add", path)
            self.git("-c", "user.name=Hive", "-c", "user.email=hive@users.noreply.github.com",
                     "commit", "-q", "-m", "Hive: %s (by %s)" % (task["title"], name))
            if self.cfg["push"]:
                self.git("push", "-q", "-u", "origin", self.state["branch"], check=False)
        except RuntimeError as err:
            self.log("Saving failed: %s" % err, "hub")
        with self.lock:
            task["state"] = "done"
            self.state["commits"] += 1
            self.state["cells"].get(name, {}).update(done=self.state["cells"].get(name, {}).get("done", 0) + 1)
        self.log("Grew: %s -> %s%s" % (task["title"], rel, "" if self.cfg["godot"] else " (not checked: no Godot set)"), name)

    def _wound(self, task, error, code, name):
        with self.lock:
            task["tries"] += 1
            task["error"] = error[-1500:]
            task["code"] = code
            if task["tries"] > MAX_HEALS:
                task["state"] = "necrotic"
                path = os.path.join(self.project, self.cfg["features_dir"], task["file"])
                if os.path.exists(path):
                    os.remove(path)
                self.log("Necrosis: '%s' failed %d heals and was removed. Logged for you." % (task["title"], MAX_HEALS), name)
            else:
                task["state"] = "wounded"
                self.log("Wound on '%s': %s" % (task["title"], error.strip().splitlines()[0][:160] if error.strip() else "error"), name)

    def snapshot(self):
        with self.lock:
            s = json.loads(json.dumps(self.state))
        for t in s["tasks"]:
            t.pop("code", None)
        s["now"] = time.time()
        s["features"] = self.features()
        return s


FILLER = {"add", "create", "implement", "make", "build", "system", "a", "an", "the", "for", "of",
          "and", "to", "basic", "simple", "new", "aodjv", "feature", "script", "gd"}


def same_idea(a, b):
    """True when two task titles mean the same thing (ignores add/create/implement...)."""
    wa = set(re.findall(r"[a-z]+", a.lower())) - FILLER
    wb = set(re.findall(r"[a-z]+", b.lower())) - FILLER
    return bool(wa and wb) and len(wa & wb) / len(wa | wb) >= 0.6


def safe_name(text):
    base = re.sub(r"[^a-z0-9_]+", "_", str(text).lower().replace(".gd", "")).strip("_")[:40]
    return (base + ".gd") if base else ""


def godot_check(cfg, project, res_path):
    """Parse the new script with Godot. Returns an error text, or '' when it passes."""
    godot = cfg["godot"]
    if not godot:
        return ""
    try:
        r = subprocess.run([godot, "--headless", "--path", project, "--check-only", "--script", res_path],
                           capture_output=True, text=True, timeout=180)
    except (OSError, subprocess.TimeoutExpired) as err:
        return "Godot could not run: %s" % err
    out = (r.stdout or "") + (r.stderr or "")
    bad = [l for l in out.splitlines() if "SCRIPT ERROR" in l or "Parse Error" in l or "ERROR:" in l and res_path in l]
    if bad or r.returncode not in (0, None):
        lines = [l.strip() for l in out.splitlines() if l.strip()]
        return "\n".join(bad + lines[-8:])[:1500] or "Godot reported an error."
    return ""


def run_hub(cfg):
    hub = Hub(cfg)
    if cfg["godot"]:
        print("Preparing Godot (first import)...", flush=True)
        subprocess.run([cfg["godot"], "--headless", "--path", hub.project, "--import"],
                       capture_output=True, timeout=900)
    page = os.path.join(HERE, "swarm.html")

    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def reply(self, obj, code=200, ctype="application/json"):
            data = obj if isinstance(obj, bytes) else json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path.startswith("/api/state"):
                hub.tick()
                return self.reply(hub.snapshot())
            with open(page, "rb") as f:
                self.reply(f.read(), ctype="text/html; charset=utf-8")

        def do_POST(self):
            # Pairing code: only your own devices may start, stop or send work.
            if cfg.get("code") and self.headers.get("X-Hive-Code", "").strip().upper() != cfg["code"].upper():
                return self.reply({"error": "wrong pairing code"}, 403)
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
            if self.path == "/api/start":
                return self.reply({"result": hub.start(body.get("goal", ""), body.get("minutes", 60))})
            if self.path == "/api/halt":
                return self.reply({"result": hub.halt()})
            if self.path == "/api/next":
                hub.tick()
                return self.reply(hub.next_job(body.get("name", "cell"), body.get("info", {})))
            if self.path == "/api/result":
                return self.reply({"result": hub.result(body.get("name", "cell"), body)})
            self.reply({"error": "unknown"}, 404)

    port = int(cfg["port"])
    print("Hive hub ready. Open http://<this-pc-address>:%d on your phone." % port, flush=True)
    http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()


# ============================================================== a worker cell

def ai(cfg, system, user, temperature, json_mode):
    body = {"model": cfg["model"], "stream": False, "keep_alive": "60s",
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "options": {"num_ctx": 4096, "temperature": temperature}}
    if json_mode:
        body["format"] = "json"
    if cfg["think"] is not None:
        body["think"] = cfg["think"]
    reply = http_json(cfg["ai_url"] + "/api/chat", body, timeout=600)
    return (reply.get("message", {}).get("content") or "").strip()


def parse_json(text):
    m = re.search(r"\{.*\}", text or "", re.S)
    try:
        return json.loads(m.group(0)) if m else {}
    except ValueError:
        return {}


def code_block(text):
    m = re.search(r"```(?:gdscript|gd|python)?\s*\n(.*?)```", text or "", re.S)
    code = m.group(1) if m else (text or "")
    # Small models slip into Python; fix the safe, mechanical ones.
    code = re.sub(r"^(\s*)def (\w+)\(", r"\1func \2(", code, flags=re.M)
    code = re.sub(r"\bTrue\b", "true", code)
    code = re.sub(r"\bFalse\b", "false", code)
    code = re.sub(r"\bNone\b", "null", code)
    code = re.sub(r"^(\s*)onready var", r"\1@onready var", code, flags=re.M)
    code = re.sub(r"^(\s*)export var", r"\1@export var", code, flags=re.M)
    code = re.sub(r"""connect\(\s*["'](\w+)["']\s*,\s*self\s*,\s*["'](\w+)["']\s*\)""", r'connect("\1", \2)', code)
    code = re.sub(r"^(\s*)yield\(", r"\1await (", code, flags=re.M)
    # Godot refuses mixed tabs and spaces: turn every 4 leading spaces into a tab.
    lines = []
    for line in code.splitlines():
        lead = len(line) - len(line.lstrip(" \t"))
        indent = line[:lead].replace("    ", "\t").replace(" ", "")
        lines.append(indent + line[lead:])
    code = "\n".join(lines)
    if code.strip() and not re.search(r"^extends ", code, re.M):
        code = "extends Node\n\n" + code
    return code.strip() if "func " in code else ""


TEMPLATE = """extends Node
## <one line: what this feature does>

signal changed(value: float)

@export var max_value: float = 100.0
var value: float = 100.0


func _ready() -> void:
	pass


func _process(delta: float) -> void:
	pass
"""

# Known Godot errors -> a plain hint for the healer.
HINTS = [
    ("connect()", "Godot 4 connects signals like: some_signal.connect(_on_something) - never connect(\"x\", self, \"y\")."),
    ("@export", "Every @export needs a type and value, like: @export var speed: float = 2.0"),
    ("not found in base", "That function does not exist on this class. Remove it or use a real Godot 4 method."),
    ("Expected end of statement", "Check the line: one statement per line, no semicolons joining, colons after if/for/func."),
    ("Unexpected identifier", "This is GDScript, not Python: use func, var, and tabs for indentation."),
    ("Identifier", "A name is used before it is declared. Declare it with var at the top."),
    ("indent", "Indent with one tab per level, consistently."),
    ("random()", "GDScript uses randf() for 0..1 and randi_range(a, b) for whole numbers."),
    ("not declared in the current scope", "Declare that name with var at the top of the file, or use a value directly."),
]

GODOT_RULES = ("Godot 4 GDScript only (NOT Python): 'func' not 'def', true/false/null lowercase, start with "
               "'extends Node' or another real Godot 4 class, typed variables, "
               "@export, signal, func _ready(), func _process(delta). Never use Godot 3 names (no onready "
               "without @, no yield, no KinematicBody). No external assets or files. Keep it under 120 lines.")


def do_job(cfg, job):
    kind = job["type"]
    if kind == "plan":
        system = ("You plan work for a small team building AoDJV - Ashes of Deja Vu, a dark-fantasy 3D voxel "
                  "survival roguelite in Godot 4 (one persistent mycelium world, hidden ember banks, Chaos Lords, "
                  "13 evolution paths, a constellation skill tree, hordes). Split the goal into 3 small, "
                  "independent tasks that are NOT already done. Each task creates ONE new self-contained GDScript file. "
                  "Reply with JSON holding exactly 3 tasks, like: {\"tasks\": ["
                  "{\"title\": \"<short name>\", \"file\": \"<short_name>.gd\", \"detail\": \"<what it does>\"}, ...]}. "
                  "The titles must come from the goal, not from this example.")
        user = "Goal: %s\nAlready done: %s\nExisting files: %s\nJudge's focus: %s" % (
            job["goal"], job["done"] or "nothing yet", job["files"] or "none", job.get("focus") or "none")
        return {"tasks": parse_json(ai(cfg, system, user, CAPS["plan"], True)).get("tasks", [])}
    if kind == "judge":
        system = ("You judge an automated game-dev round. Compare the finished tasks to the goal. Reply JSON: "
                  "{\"verdict\": \"continue\" or \"stop\", \"reason\": \"short\", \"next_focus\": \"what to build next\"}")
        return parse_json(ai(cfg, system, "Goal: %s\nFinished: %s" % (job["goal"], job["done"]), CAPS["judge"], True))
    if kind == "code":
        system = ("You write one complete GDScript file for a Godot 4 game. " + GODOT_RULES +
                  " Start from this template and fill it in:\n```gdscript\n" + TEMPLATE + "```\nReply with the code in one ```gdscript block.")
        user = "Game goal: %s\nFile: %s\nTask: %s\nDetails: %s" % (job["goal"], job["file"], job["title"], job["detail"])
        return {"code": code_block(ai(cfg, system, user, CAPS["code"], False))}
    if kind == "heal":
        system = "You fix a GDScript file so Godot 4 accepts it. " + GODOT_RULES + " Reply with the whole fixed file in one ```gdscript block."
        hints = [h for key, h in HINTS if key in job["error"]]
        m = re.search(r"\.gd:(\d+)\)", job["error"])
        if m:
            code_lines = job["code"].splitlines()
            n = int(m.group(1))
            if 0 < n <= len(code_lines):
                hints.append("The broken line is line %d: %s" % (n, code_lines[n - 1].strip()))
        user = "Task: %s\nGodot error:\n%s\nHow to fix: %s\n\nFile:\n```gdscript\n%s\n```" % (
            job["title"], job["error"], " ".join(hints) or "fix exactly the line in the error", job["code"])
        return {"code": code_block(ai(cfg, system, user, CAPS["heal"], False))}
    return {}


def run_cell(cfg):
    name = cfg["name"]
    print("Cell '%s' joining the hive at %s (AI: %s)" % (name, cfg["hub_url"], cfg["model"]), flush=True)
    while True:
        info = {"model": cfg["model"], "free_mb": free_mb(), "rest_below": cfg["min_free_mb"]}
        code = cfg.get("code", "")
        try:
            job = http_json(cfg["hub_url"] + "/api/next", {"name": name, "info": info}, code=code)
        except urllib.error.HTTPError as err:
            print("The hub refused this phone (%s). Check the pairing code in ~/.hive/config.json." % err.code, flush=True)
            time.sleep(60)
            continue
        except (urllib.error.URLError, OSError, ValueError) as err:
            print("Hub not reachable (%s). Retrying in 15 s." % err, flush=True)
            time.sleep(15)
            continue
        if job.get("type") == "sleep":
            time.sleep(job.get("seconds", 10))
            continue
        print("Job: %s %s" % (job["type"], job.get("title", "")), flush=True)
        try:
            result = do_job(cfg, job)
        except (urllib.error.URLError, OSError, ValueError) as err:
            print("Local AI problem: %s" % err, flush=True)
            result = {}
        result.update(type=job["type"], task=job.get("task"), name=name)
        try:
            http_json(cfg["hub_url"] + "/api/result", result, timeout=300, code=code)
        except (urllib.error.URLError, OSError) as err:
            print("Could not send the result: %s" % err, flush=True)


def main():
    role = sys.argv[1] if len(sys.argv) > 1 else ""
    cfg = config()
    if role == "hub":
        run_hub(cfg)
    elif role == "cell":
        run_cell(cfg)
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
