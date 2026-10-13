#!/usr/bin/env python3
"""Forge: type commands in Odysseus, and your Gemini AI designs voxel characters
that Godot builds and plays on this laptop.

Odysseus endpoint: http://127.0.0.1:8741/v1   model: forge

  make <description>   Gemini designs a new character, Godot builds it, shows a picture
  remix <name>         a new unique variation of a character
  heroes               build the 7 Cinderdeep heroes
  play <name>          open the character playable in Godot
  list                 show built characters
  undo                 delete the last character you made
  push                 save new characters to GitHub
  help                 this list
"""
import json, os, re, subprocess, sys, threading, time, urllib.request, http.server

HOME = os.path.expanduser("~/.forge")
CONFIG = os.path.join(HOME, "config.json")
DEFAULTS = {
    "port": 8741,
    "gemini_key": "",
    "model": "gemini-2.5-flash",
    "gemini_url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    "project": os.path.expanduser("~/Game-Dev-Resources/Projects/Cinder"),
    "godot": os.path.join(HOME, "godot", "godot"),
}
COMMANDS = ["make", "remix", "heroes", "play", "list", "undo", "push", "help"]

FORMAT = """Reply with ONE JSON object only. Fields:
name (short), blurb (one sentence), seed (1-99999),
build: {height 0.75-0.95, bulk 0.7-1.5, head 0.8-1.4, arms 0.85-1.15, legs 0.85-1.15},
colors: {skin, hair, main, dark, trim, cloth, metal, eye, glow} as hex like "#aa3322",
head: bare|helm|hood|wizard|mask|horns|cowl|skullhood|crown,
hair: none|short|long|braids|mohawk|topknot,
weapon: none|sword|greatsword|axe|mace|spear|scythe|bow|staff|firestaff|stormrod|daggers|tome,
offhand: none|shield|dagger|tome|orb|lantern,
armor: plate|leather|robe|cloth|bare,
texture: ""|plate|fur|ash,
fx: fire|frost|storm|poison|shadow|holy|blood|arcane,  glow: 0-2.5,
features (up to 10): pauldrons, cape, tabard, belt, pouches, quiver, scarf, fur_collar, beard, bracers,
greaves, spikes, skull_charms, runes, ember_cracks, glow_eyes, gem, chain, sash, tattoos, plume, kneepads.
Make every character distinct and readable against a dark ember-and-ash world. Use strong, contrasting colours."""


def cfg():
    c = dict(DEFAULTS)
    try:
        with open(CONFIG, encoding="utf-8-sig") as f:
            c.update(json.load(f))
    except (OSError, ValueError):
        pass
    return c


def built_dir(c):
    return os.path.join(c["project"], "characters", "built")


def made_dir(c):
    return os.path.join(c["project"], "characters", "made")


def built(c):
    d = built_dir(c)
    return sorted(n for n in os.listdir(d) if os.path.isfile(os.path.join(d, n, "rig.json"))) if os.path.isdir(d) else []


def gemini(c, prompt):
    if not c["gemini_key"]:
        raise RuntimeError("No Gemini key yet. Put it in %s as \"gemini_key\"." % CONFIG)
    body = json.dumps({"model": c["model"], "response_format": {"type": "json_object"}, "temperature": 1.0,
                       "messages": [{"role": "system", "content": FORMAT}, {"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request(c["gemini_url"], body, {"Content-Type": "application/json",
                                                         "Authorization": "Bearer " + c["gemini_key"]})
    with urllib.request.urlopen(req, timeout=120) as r:
        text = json.load(r)["choices"][0]["message"]["content"]
    m = re.search(r"\{.*\}", text, re.S)
    return json.loads(m.group(0) if m else text)


def godot(c, *args, window=False, timeout=600):
    cmd = [c["godot"], "--path", c["project"]] + ([] if window else ["--headless"]) + list(args)
    if window:
        return subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def build(c, design_path):
    r = godot(c, "--script", "res://tools/build_character.gd", "--", "--design=" + design_path)
    results = [json.loads(l[7:]) for l in r.stdout.splitlines() if l.startswith("RESULT ")]
    if not results:
        return None, (r.stderr or r.stdout)[-400:]
    return results[0], results[0].get("error", "")


def picture(c, cid):
    out = os.path.join(built_dir(c), cid, "preview.png")
    p = godot(c, "--rendering-method", "gl_compatibility", "--resolution", "640x800",
              "res://game/play.tscn", "--", "--hero=" + cid, "--shot=" + out, window=True)
    try:
        p.wait(120)
    except subprocess.TimeoutExpired:
        p.kill()
    return os.path.isfile(out)


def make(c, say, wish, base=None):
    os.makedirs(made_dir(c), exist_ok=True)
    prompt = "Design this character: " + wish
    if base:
        prompt = "Make a new, clearly different variation of this character (new name, new seed): " + json.dumps(base)
    error = ""
    for attempt in range(2):
        say("Gemini is designing..." if attempt == 0 else "Fixing the design...")
        design = gemini(c, prompt + ("\nThe last try failed: " + error if error else ""))
        name = re.sub(r"[^a-z0-9]+", "_", str(design.get("name", "character")).lower()).strip("_") or "character"
        path = os.path.join(made_dir(c), name + ".json")
        with open(path, "w") as f:
            json.dump(design, f, indent=1)
        say("Godot is building **%s** (64×64×64 voxels)..." % design.get("name", name))
        result, error = build(c, path)
        if result and not error:
            cid = result["id"]
            with open(os.path.join(HOME, "last.txt"), "w") as f:
                f.write(cid)
            if result.get("notes"):
                say("Adjusted: " + "; ".join(result["notes"][:5]))
            say("Built in %.0f s. %s" % (result.get("ms", 0) / 1000, design.get("blurb", "")))
            if picture(c, cid):
                say("![%s](http://127.0.0.1:%d/pic/%s.png)" % (cid, c["port"], cid))
            say("Type `play %s` to play it." % cid)
            return
    say("Could not build it: " + str(error))


def find(c, words):
    names = built(c)
    text = "_".join(words)
    for n in names:
        if n == text or (text and (text in n or n in text)):
            return n
    return None


def run(c, say, name, args):
    if name == "make":
        if not args:
            return say("Say what to make, e.g. `make a frost witch with a lantern`.")
        return make(c, say, " ".join(args))
    if name == "remix":
        cid = find(c, args)
        if not cid:
            return say("Which one? Built: " + ", ".join(built(c)))
        with open(os.path.join(built_dir(c), cid, "design.json")) as f:
            return make(c, say, "", base=json.load(f))
    if name == "heroes":
        say("Building the 7 Cinderdeep heroes (about a minute)...")
        r = godot(c, "--script", "res://tools/build_character.gd", "--", "--heroes")
        for l in r.stdout.splitlines():
            if l.startswith("RESULT "):
                res = json.loads(l[7:])
                say("- %s %s" % (res["id"], "ok" if not res["error"] else "failed: " + res["error"]))
        return say("Type `play knight` (Tab switches character in the game).")
    if name == "play":
        cid = find(c, args) or (built(c) or [None])[0]
        if not cid:
            return say("Nothing built yet. Type `heroes` or `make ...` first.")
        godot(c, "res://game/play.tscn", "--", "--hero=" + cid, window=True)
        return say("Opened **%s** in Godot. WASD move, Shift run, Space dodge, J attack, K ability, Tab next." % cid)
    if name == "list":
        return say("Built: " + (", ".join(built(c)) or "nothing yet"))
    if name == "undo":
        try:
            cid = open(os.path.join(HOME, "last.txt")).read().strip()
        except OSError:
            return say("Nothing to undo.")
        import shutil
        shutil.rmtree(os.path.join(built_dir(c), cid), ignore_errors=True)
        os.remove(os.path.join(HOME, "last.txt"))
        return say("Deleted %s." % cid)
    if name == "push":
        repo = os.path.dirname(os.path.dirname(c["project"]))
        g = lambda *a: subprocess.run(["git", "-C", repo] + list(a), capture_output=True, text=True)
        g("add", "Projects/Cinder/characters")
        g("commit", "-m", "Forge: new characters")
        r = g("push")
        return say("Saved to GitHub." if r.returncode == 0 else "Push failed: " + r.stderr[-300:])
    say(__doc__.split("\n\n", 2)[2])


def serve(c):
    lock = threading.Lock()

    class H(http.server.BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        def log_message(self, *a): pass

        def send(self, code, data, ctype):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            m = re.match(r"/pic/([a-z0-9_]+)\.png", self.path)
            if m:
                f = os.path.join(built_dir(cfg()), m.group(1), "preview.png")
                if os.path.isfile(f):
                    return self.send(200, open(f, "rb").read(), "image/png")
                return self.send(404, b"", "text/plain")
            self.send(200, json.dumps({"object": "list", "data": [{"id": "forge", "object": "model"}]}).encode(),
                      "application/json")

        def do_POST(self):
            n = int(self.headers.get("Content-Length") or 0)
            try:
                body = json.loads(self.rfile.read(n) or b"{}")
            except ValueError:
                body = {}
            text = ""
            for msg in reversed(body.get("messages", [])):
                if msg.get("role") == "user":
                    t = msg.get("content", "")
                    text = " ".join(p.get("text", "") for p in t if isinstance(p, dict)) if isinstance(t, list) else str(t)
                    break
            words = text.strip().split()
            name = words[0].lower() if words and words[0].lower() in COMMANDS else "help"
            args = words[1:] if name != "help" else []
            stream = bool(body.get("stream"))
            base = {"id": "forge-%d" % time.time(), "created": int(time.time()), "model": "forge"}
            out = []
            if stream:
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Connection", "close")
                self.end_headers()

            def say(line):
                out.append(line)
                if stream:
                    ev = dict(base, object="chat.completion.chunk",
                              choices=[{"index": 0, "delta": {"content": line + "\n\n"}, "finish_reason": None}])
                    self.wfile.write(("data: " + json.dumps(ev) + "\n\n").encode())
                    self.wfile.flush()

            if lock.acquire(blocking=False):
                try:
                    run(cfg(), say, name, args)
                except Exception as e:
                    say("Error: %s" % e)
                finally:
                    lock.release()
            else:
                say("Still busy with the last command.")
            if stream:
                ev = dict(base, object="chat.completion.chunk", choices=[{"index": 0, "delta": {}, "finish_reason": "stop"}])
                self.wfile.write(("data: " + json.dumps(ev) + "\n\ndata: [DONE]\n\n").encode())
                self.close_connection = True
            else:
                self.send(200, json.dumps(dict(base, object="chat.completion", choices=[{"index": 0, "finish_reason": "stop",
                          "message": {"role": "assistant", "content": "\n\n".join(out)}}])).encode(), "application/json")

    print("Forge ready: add http://127.0.0.1:%d/v1 in Odysseus, model 'forge'." % c["port"], flush=True)
    http.server.ThreadingHTTPServer(("127.0.0.1", int(c["port"])), H).serve_forever()


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] == "serve":
        serve(cfg())
    else:
        run(cfg(), print, a[0], a[1:])
