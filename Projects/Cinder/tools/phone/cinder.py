#!/usr/bin/env python3
"""Cinder phone AI: simple commands that let a small local AI keep improving
the Cinderdeep voxel assets.

    push        improve the next asset a little, save it to GitHub
    push 5      do that 5 times in a row
    ask TEXT    ask for a change, e.g.  ask make the hound glow more
    look        open the newest preview pictures
    undo        take back the last AI change
    status      show the last changes
    stop        stop the AI and free the phone's memory
    menu        number buttons for all of the above

The AI may only change the safe settings in assets/tuning/<asset>.json, so it
can never break the game. GitHub rebuilds the 3D models and pictures itself.
Only uses Python's standard library.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

HOME = os.path.expanduser("~")
CONFIG_PATH = os.path.join(HOME, ".cinder", "config.json")
STATE_PATH = os.path.join(HOME, ".cinder", "state.json")
DEFAULTS = {
    "repo_dir": os.path.join(HOME, "Game-Dev-Resources"),
    "branch": "ccr-031f1132-nxzsb1",
    "github": "iteatsthesalt/Game-Dev-Resources",
    "ai_url": "http://127.0.0.1:11434",
    "model": "qwen2.5:1.5b",
    "small_model": "qwen2.5:0.5b",
}
# key: (default, min, max) — must match assets/tuning.gd
NUMBERS = {
    "scale": (1.0, 0.6, 1.6),
    "glow": (1.0, 0.0, 3.0),
    "brightness": (1.0, 0.6, 1.5),
    "tint_strength": (0.0, 0.0, 0.5),
    "saturation": (1.0, 0.4, 1.6),
    "wear": (0.0, 0.0, 0.25),
    "seed": (0, 0, 9999),
}
DEFAULT_WISH = ("Make it look a little better and more dramatic for a dark ember-and-ash fantasy game, "
                "while keeping it easy to read. Change one to three settings by small amounts.")


# ---------------------------------------------------------------- helpers

def say(text):
    print(text, flush=True)


def load_json(path, fallback):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return fallback


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def config():
    cfg = dict(DEFAULTS)
    cfg.update(load_json(CONFIG_PATH, {}))
    return cfg


def project(cfg):
    return os.path.join(cfg["repo_dir"], "Projects", "Cinder")


def git(cfg, *args, check=True):
    result = subprocess.run(["git", "-C", cfg["repo_dir"], *args], capture_output=True, text=True)
    if check and result.returncode != 0:
        raise RuntimeError("git %s failed: %s" % (" ".join(args), result.stderr.strip()[-300:]))
    return result.stdout.strip()


def assets(cfg):
    folder = os.path.join(project(cfg), "assets", "recipes")
    return sorted(f[:-3] for f in os.listdir(folder) if f.endswith(".gd"))


def describe(cfg, asset):
    """The recipe's top comment: a plain description of the asset."""
    path = os.path.join(project(cfg), "assets", "recipes", asset + ".gd")
    lines = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith("##"):
                lines.append(line[2:].strip())
            elif lines:
                break
    return " ".join(lines)[:600]


def free_memory_mb():
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemAvailable:"):
                    return int(line.split()[1]) // 1024
    except OSError:
        pass
    return None


# ---------------------------------------------------------------- the AI

def ai_running(cfg):
    try:
        urllib.request.urlopen(cfg["ai_url"] + "/api/tags", timeout=3)
        return True
    except (urllib.error.URLError, OSError):
        return False


def start_ai(cfg):
    if ai_running(cfg):
        return
    if not shutil.which("ollama"):
        raise RuntimeError("The AI (ollama) is not installed. Run the install line again.")
    say("Starting the AI...")
    env = dict(os.environ, OLLAMA_MAX_LOADED_MODELS="1", OLLAMA_NUM_PARALLEL="1", OLLAMA_KEEP_ALIVE="30s")
    log = open(os.path.join(HOME, ".cinder", "ai.log"), "a")
    subprocess.Popen(["ollama", "serve"], stdout=log, stderr=log, env=env, start_new_session=True)
    for _ in range(40):
        if ai_running(cfg):
            return
        time.sleep(0.5)
    raise RuntimeError("The AI did not start. Type: stop   then try again.")


def pick_model(cfg):
    """Use the smaller model when the phone is short on memory."""
    free = free_memory_mb()
    if free is not None and free < 1800:
        say("Phone memory is low (%d MB free), using the small AI." % free)
        return cfg["small_model"]
    return cfg["model"]


def ensure_model(cfg, model):
    tags = json.loads(urllib.request.urlopen(cfg["ai_url"] + "/api/tags", timeout=10).read())
    names = [m.get("name", "") for m in tags.get("models", [])]
    if model in names or model + ":latest" in names:
        return
    say("Downloading the AI model %s (one time only)..." % model)
    subprocess.run(["ollama", "pull", model], check=True)


def ask_ai(cfg, model, asset, current, wish, temperature):
    ranges = ", ".join("%s %s..%s" % (k, v[1], v[2]) for k, v in NUMBERS.items())
    system = (
        "You tune the look of ONE voxel 3D model in a dark fantasy game. "
        "Reply with ONLY one JSON object with exactly these keys: "
        "scale, glow, brightness, tint, tint_strength, saturation, wear, seed, notes. "
        "Allowed ranges: " + ranges + ". tint is a colour like \"#ff7a2a\". "
        "seed 0 keeps the original shape; another number makes a new variation. "
        "notes: what you changed, under 15 words. No other text.")
    user = ("Asset: %s\nWhat it is: %s\nCurrent settings: %s\nRequest: %s"
            % (asset, describe(cfg, asset), json.dumps(current), wish))
    body = json.dumps({
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "format": "json",
        "stream": False,
        "keep_alive": "30s",  # unload soon after, to give the phone its memory back
        "options": {"num_ctx": 2048, "temperature": temperature},
    }).encode()
    req = urllib.request.Request(cfg["ai_url"] + "/api/chat", data=body,
                                 headers={"Content-Type": "application/json"})
    reply = json.loads(urllib.request.urlopen(req, timeout=300).read())
    return reply.get("message", {}).get("content", "")


def clean(raw, current):
    """Turn the AI's reply into safe settings, or None if it is unusable."""
    match = re.search(r"\{.*\}", raw or "", re.S)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None
    out = dict(current)
    for key, (_, lo, hi) in NUMBERS.items():
        value = data.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            value = min(max(float(value), lo), hi)
            out[key] = int(value) if key == "seed" else round(value, 2)
    tint = data.get("tint")
    if isinstance(tint, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", tint.strip()):
        out["tint"] = tint.strip().lower()
    out["notes"] = str(data.get("notes", ""))[:120]
    changed = [k for k in NUMBERS if out[k] != current.get(k)] + (["tint"] if out["tint"] != current.get("tint") else [])
    return out if changed else None


# ---------------------------------------------------------------- commands

def improve(cfg, asset, wish):
    path = os.path.join(project(cfg), "assets", "tuning", asset + ".json")
    current = {k: v[0] for k, v in NUMBERS.items()}
    current.update({"tint": "#ff7a2a", "notes": ""})
    current.update(load_json(path, {}))
    model = pick_model(cfg)
    ensure_model(cfg, model)
    say("Thinking about %s..." % asset.replace("_", " "))
    for temperature in (0.5, 0.9):
        result = clean(ask_ai(cfg, model, asset, current, wish, temperature), current)
        if result:
            save_json(path, result)
            try:
                git(cfg, "add", path)
                git(cfg, "commit", "-q", "-m", "Phone AI: %s - %s" % (asset, result["notes"] or "tweak"))
            except RuntimeError:
                git(cfg, "reset", "-q", check=False)
                git(cfg, "checkout", "-q", "--", path, check=False)
                raise
            say("Changed %s: %s" % (asset.replace("_", " "), result["notes"] or "small tweak"))
            return True
    say("The AI's answer for %s was not usable, skipped it." % asset)
    return False


def sync(cfg):
    # Self-repair: drop half-finished AI edits and make sure commits have a name.
    git(cfg, "reset", "-q", check=False)
    git(cfg, "checkout", "-q", "--", "Projects/Cinder/assets/tuning", check=False)
    if not git(cfg, "config", "user.name", check=False):
        git(cfg, "config", "user.name", "Cinder Phone AI")
    if not git(cfg, "config", "user.email", check=False):
        git(cfg, "config", "user.email", "phone-ai@users.noreply.github.com")
    git(cfg, "checkout", "-q", cfg["branch"])
    git(cfg, "pull", "-q", "--rebase", "--autostash", "origin", cfg["branch"])


def publish(cfg):
    say("Saving to GitHub...")
    git(cfg, "push", "-q", "origin", cfg["branch"])
    say("Saved. New pictures appear in about 5 minutes. Type: look")


def cmd_push(cfg, args):
    rounds = int(args[0]) if args and args[0].isdigit() else 1
    sync(cfg)
    start_ai(cfg)
    names = assets(cfg)
    state = load_json(STATE_PATH, {"next": 0})
    done = 0
    for _ in range(rounds):
        asset = names[state["next"] % len(names)]
        state["next"] += 1
        save_json(STATE_PATH, state)
        done += improve(cfg, asset, DEFAULT_WISH)
    if done:
        publish(cfg)


def cmd_ask(cfg, args):
    wish = " ".join(args).strip()
    if not wish:
        wish = input("What should change? ").strip()
    sync(cfg)
    names = assets(cfg)
    words = wish.lower()
    found = [a for a in names if any(part in words for part in a.split("_") if len(part) > 3)]
    if len(found) != 1:
        say("Which one?")
        for i, a in enumerate(names, 1):
            say("  %d  %s" % (i, a.replace("_", " ")))
        choice = input("Number: ").strip()
        if not choice.isdigit() or not 1 <= int(choice) <= len(names):
            say("Nothing changed.")
            return
        found = [names[int(choice) - 1]]
    start_ai(cfg)
    if improve(cfg, found[0], wish):
        publish(cfg)


def cmd_look(cfg, args):
    url = "https://github.com/%s/tree/%s/Projects/Cinder/previews" % (cfg["github"], cfg["branch"])
    say(url)
    if shutil.which("termux-open-url"):
        subprocess.run(["termux-open-url", url])


def cmd_undo(cfg, args):
    sync(cfg)
    last = git(cfg, "log", "-1", "--format=%H %s")
    if "Phone AI:" not in last:
        say("The last change was not made by the phone AI, so nothing was undone.")
        return
    git(cfg, "revert", "--no-edit", last.split()[0])
    say("Undid: " + last.split(" ", 1)[1])
    publish(cfg)


def cmd_status(cfg, args):
    say(git(cfg, "log", "-8", "--format=%cr  %s", "--", "Projects/Cinder/assets/tuning", check=False) or "No AI changes yet.")
    say("AI is " + ("running" if ai_running(cfg) else "stopped"))
    free = free_memory_mb()
    if free is not None:
        say("Phone memory free: %d MB" % free)


def cmd_stop(cfg, args):
    subprocess.run(["pkill", "-f", "ollama"], capture_output=True)
    say("AI stopped. Memory is free again.")


COMMANDS = {"push": cmd_push, "ask": cmd_ask, "look": cmd_look, "undo": cmd_undo,
            "status": cmd_status, "stop": cmd_stop}


def cmd_menu(cfg, args):
    buttons = [("push (improve the next model)", "push", []), ("push 5 times", "push", ["5"]),
               ("ask for a change", "ask", []), ("look at the pictures", "look", []),
               ("undo the last change", "undo", []), ("status", "status", []), ("stop the AI", "stop", [])]
    while True:
        say("\n== CINDER ==")
        for i, (label, _, _) in enumerate(buttons, 1):
            say("  %d  %s" % (i, label))
        say("  0  exit")
        choice = input("Press a number: ").strip()
        if choice in ("0", "", "q"):
            return
        if choice.isdigit() and 1 <= int(choice) <= len(buttons):
            _, name, extra = buttons[int(choice) - 1]
            run(cfg, name, extra)


def run(cfg, name, args):
    try:
        (cmd_menu if name == "menu" else COMMANDS[name])(cfg, args)
    except KeyboardInterrupt:
        say("\nStopped.")
    except Exception as error:  # plain words for a non-programmer
        say("Problem: %s" % error)
        say("Nothing was broken. Try again, or type: stop")


def main():
    args = sys.argv[1:]
    name = os.path.basename(sys.argv[0]).replace(".py", "")
    if name not in COMMANDS and name != "menu":
        name = args.pop(0) if args else "menu"
    if name not in COMMANDS and name != "menu":
        say(__doc__)
        return
    run(config(), name, args)


if __name__ == "__main__":
    main()
