# Safe CLI + AI Voxel Agent on an Android Phone

A setup for generating voxel assets with a local or remote AI model on an Android phone (written for a Moto G Stylus 2026) without giving the model a shell.

- **Termux** runs the automation: the controller, Git, and an optional local model.
- **Godot 4 Android Editor** is for interactive preview.
- **A Termux Godot 4 binary** handles headless validation, but only if the official Termux repository has one for your architecture.

The AI gets no shell. It can only return structured JSON requests. The controller maps those requests to a few fixed functions, and every change happens inside a disposable Git worktree.

> **Unverified details.** Live sources couldn't be checked when this guide was written. It doesn't name exact 2026 Termux or Godot package versions, and no single authoritative Godot project called **Cinder** could be identified. Where a capability matters, the guide gives a command that checks for it before you turn it on.

## Quick start (local model only, no Claude account)

In Termux, from a clone of this repository:

```bash
cd "Game-Dev-Resources/Guides/Mobile Voxel Agent"
bash bin/termux-setup            # add --llama to also build llama.cpp (slow)
voxel-llama ~/models/<your-model>.gguf     # terminal A: server on 127.0.0.1 only
voxel-mode local                           # terminal B
SESSION="$(voxel-session new)"
voxel-agent --session "$SESSION" "a small glowing ember, 8x8x8"
```

`termux-setup` is safe to re-run. It installs packages, creates the private folders, installs the helpers, writes a LOCAL-only config (no remote section, no API key), makes a project baseline commit, and runs the safety tests. It never downloads a model. Everything below explains each step.

## Home-screen shortcut

`shortcuts/` has a Termux:Widget launcher for Odysseus and an ember-voxel icon (`ember.png`, redrawn by `make_icon.py`). On the phone, install the **Termux:Widget** add-on from the same source as Termux, then run `bash shortcuts/install-shortcut.sh` and add a Termux:Widget widget to your home screen. The icon path (`~/.shortcuts/icons/<script>.png`) is how recent Termux:Widget versions pick up icons; if yours doesn't show it, check the add-on's own documentation.

## Files in this folder

| Path | Purpose |
| --- | --- |
| [`agent/voxel_agent.py`](agent/voxel_agent.py) | Constrained controller. Python standard library only. |
| [`agent/test_voxel_agent.py`](agent/test_voxel_agent.py) | Boundary tests for path escapes, symlinks, the OFF switch, bad assets, and prose replies. |
| [`agent/config.example.json`](agent/config.example.json) | Example configuration. |
| [`bin/voxel-mode`](bin/voxel-mode) | OFF / LOCAL / REMOTE switch. |
| [`bin/voxel-session`](bin/voxel-session) | Creates, lists, or discards disposable worktrees. |
| [`bin/termux-setup`](bin/termux-setup) | One-shot, re-runnable Termux setup for LOCAL mode. |
| [`bin/voxel-llama`](bin/voxel-llama) | Starts llama.cpp bound to `127.0.0.1` with small defaults. |
| [`godot/tools/build_voxel.gd`](godot/tools/build_voxel.gd) | Headless Godot script that re-validates a spec and builds a `MultiMesh` scene. |

---

## 1. Architecture

```text
Manual OFF / LOCAL / REMOTE switch (voxel-mode)
                 │
                 ▼
       Python controller in Termux
                 │
       ┌─────────┴──────────┐
 LOCAL llama.cpp      Remote API adapter
 127.0.0.1 only       https only; key read from a private file
       └─────────┬──────────┘
                 ▼
     One JSON object per model turn
                 ▼
 Schema + path + action validator
                 ▼
 Allowed actions only:
 • write_voxel_spec  → assets/generated/<name>.json
 • validate_voxel    → fixed Godot script builds scenes/generated/<name>.tscn
 • done
                 ▼
 Disposable Git worktree (sessions/<ID>)
                 ▼
 You review the diff → merge or discard
```

### Automation boundary

The **model** can write only one kind of file: `assets/generated/<name>.json`.

The **controller** then writes a manifest in `.ai/manifests/`. The **fixed Godot script** writes the scene in `scenes/generated/`. The model never writes `.gd`, `.tscn`, or `.tres` files. A `.gd` file is executable code, and `.tscn` and `.tres` files can embed scripts, so letting the model write them would amount to giving it code execution.

The model gets no tool for any of the following:

- arbitrary shell commands or package installation;
- Android intents, accessibility control, or shared storage;
- deleting files, or editing `project.godot`, plugins, export presets, `tools/`, or existing source;
- network access other than the selected model endpoint;
- Git push, credentials, or merging.

Here, "taking over" means running autonomously inside one disposable session while the switch is on, with a step limit (`maximum_steps`).

---

## 2. Install Termux safely

Install Termux from an official channel listed by the [Termux project](https://github.com/termux/termux-app#installation). Install add-ons such as **Termux:Widget** from the **same** source. Don't use repackaged APKs.

```bash
pkg update && pkg upgrade
pkg install git python clang cmake ninja jq
python --version && git --version
```

Create the private layout:

```bash
umask 077
mkdir -p "$HOME/src" "$HOME/models" "$HOME/.local/bin" "$HOME/.config/voxel-agent"
mkdir -p "$HOME/voxel-workspace"/{project,sessions,logs}
chmod 700 "$HOME/.config/voxel-agent" "$HOME/voxel-workspace"
```

Install the helpers from this folder and put them on `PATH`:

```bash
GUIDE="path/to/Guides/Mobile Voxel Agent"   # wherever you cloned this repository
install -m 700 "$GUIDE/bin/voxel-mode" "$GUIDE/bin/voxel-session" "$HOME/.local/bin/"
install -m 700 "$GUIDE/agent/voxel_agent.py" "$HOME/.local/bin/voxel-agent"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
. "$HOME/.bashrc"
```

### Storage

Keep the authoritative project in Termux's private `$HOME` (`/data/data/com.termux/files/home/voxel-workspace`). Run `termux-setup-storage` **only** if you need to copy approved builds to a folder the Godot Android Editor can see. Never put executables, models, credentials, or agent configuration in shared storage.

Android may stop long Termux jobs under battery or memory pressure. You can set Termux to **Unrestricted** battery use while you're actively developing. Don't disable Android's other process protections.

---

## 3. Install Godot 4

### Interactive editor

Install the editor using the official [Godot Android Editor documentation](https://docs.godotengine.org/en/stable/tutorials/editor/using_the_android_editor.html) and the official store listing. Use **GDScript**, not C#.

### Command-line binary in Termux

Inspect the package before you install it:

```bash
pkg install x11-repo
pkg search godot
```

Continue only if the result clearly says **Godot Engine 4.x** for your architecture:

```bash
pkg install godot
GODOT_BIN="$(command -v godot || command -v godot4)"
"$GODOT_BIN" --version
"$GODOT_BIN" --help | grep -E -- '--headless|--path|--script|--import'
```

The binary must support `--headless`, `--path`, and `--script`. If `--import` is also listed, run it once per session so that resources are imported before validation:

```bash
"$GODOT_BIN" --headless --path "$SESSION" --import
```

If there's no official Termux Godot 4 package, **stop**. Don't run random ARM binaries or install scripts. Instead, choose one of these:

1. Generate specs in Termux and preview them in the official Android editor. Leave `godot_bin` unset, and `validate_voxel` will report that no binary is configured.
2. Run validation on a trusted computer.
3. Treat a source build or `proot-distro` as experimental.

### Project setup

Copy `godot/tools/build_voxel.gd` into the project as `res://tools/build_voxel.gd`, then commit a baseline:

```bash
cd "$HOME/voxel-workspace/project"
mkdir -p tools && cp "$GUIDE/godot/tools/build_voxel.gd" tools/
git init && git add . && git commit -m "Baseline before AI sessions"
```

`project.godot` must be at the repository root, because every session worktree is opened directly with `--path`.

---

## 4. "Cinder" voxel assets

No single authoritative Godot 4 voxel plugin or format named **Cinder** could be verified. The name might refer to ember-themed art, a specific plugin, a private project, or a shortened name of some other product. **Don't generate assets against a guessed Cinder API.**

The safe baseline is:

```text
neutral voxel JSON → validated dimensions, palette and coordinates
  → build_voxel.gd → Godot-native MultiMesh PackedScene
```

When the exact Cinder repository or Asset Library URL is known, add the integration as `project/tools/adapters/cinder_adapter.gd`. Commit it in the baseline yourself, because the model can't write it. Only that adapter and its validator should need to change; the schema the model sees stays the same.

---

## 5. Local AI (llama.cpp)

The build steps follow the [llama.cpp Android documentation](https://github.com/ggml-org/llama.cpp/blob/master/docs/android.md):

```bash
cd "$HOME/src"
git clone --depth 1 https://github.com/ggml-org/llama.cpp.git
cd llama.cpp
cmake -S . -B build -G Ninja -DGGML_OPENMP=OFF
cmake --build build -j2
./build/bin/llama-server --help
```

Bind the server to loopback only:

```bash
"$HOME/src/llama.cpp/build/bin/llama-server" \
  --model "$HOME/models/coder-model.gguf" \
  --host 127.0.0.1 --port 8080 \
  --ctx-size 2048 --parallel 1
```

The controller refuses a LOCAL `base_url` that points anywhere other than `127.0.0.1` or `localhost`.

### Model size

The phone's exact RAM configuration isn't known, so start small:

- Use a roughly **1–2B-parameter** instruct or coding model, 4-bit GGUF, with a 2,048-token context. Run one request at a time.
- Increase model size or context only after you've watched memory pressure. Shrink the model before you turn up RAM Boost.
- A 3B-class model is worth testing on a higher-RAM variant, but don't make it the default. If System UI reloads, Termux exits, or token speed collapses, the model is too large.

A 2,048-token context fits only small assets. A 16×16×16 asset with many voxels won't fit in one reply, so keep LOCAL assets small or sparse, or use REMOTE mode for larger ones.

---

## 6. OFF / LOCAL / REMOTE switch

Copy the example configuration and edit it:

```bash
cp "$GUIDE/agent/config.example.json" "$HOME/.config/voxel-agent/config.json"
chmod 600 "$HOME/.config/voxel-agent/config.json"
```

The limits in the example are conservative starting values for policy, not phone specifications. If your endpoint rejects `response_format`, set `json_mode` to `false`. The controller still rejects any reply that isn't a single JSON object.

```bash
voxel-mode local    # or: remote
voxel-mode off
voxel-mode status
```

`off` writes a cooperative `STOP` file. The controller checks it before **every** model call and **every** action, so the next step after you switch off doesn't run. It doesn't kill any process. For Termux:Widget buttons, put one-line scripts in `~/.shortcuts/` that call these three fixed commands.

### Remote credentials

Write the key from the clipboard, so that it doesn't land in shell history:

```bash
umask 077
termux-clipboard-get > "$HOME/.config/voxel-agent/remote_api_key"   # needs the Termux:API add-on
chmod 600 "$HOME/.config/voxel-agent/remote_api_key"
```

The key must never end up in the Godot project, prompts, generated files, command lines, Git, or logs. The controller reads the key file when it sends each request, never logs headers, and reports HTTP errors by status code only. The private file is a practical baseline, not hardware-backed key storage.

A consumer chatbot subscription doesn't necessarily include API access. REMOTE mode needs a provider API endpoint and API credentials, which may be billed separately. The controller uses the OpenAI-compatible `/chat/completions` format. A provider with a different API needs its own `chat()` implementation that returns the reply text.

---

## 7. The controller

[`agent/voxel_agent.py`](agent/voxel_agent.py) is the full implementation. Its key properties:

- **Fixed dispatch.** `write_voxel_spec`, `validate_voxel`, and `done` map to Python functions. Unknown actions and extra keys are rejected. Nothing runs with `shell=True`.
- **Strict replies.** Each model turn must be exactly one JSON object. Prose, code fences, and arrays are rejected and reported back to the model as an error.
- **Path policy.** The spec path must equal `assets/generated/<name>.json`. Paths containing `..`, absolute paths, and backslashes are refused. Symlinks are checked component by component **before** the path is resolved; resolving first would follow a planted link. Writes are atomic and use `O_NOFOLLOW`.
- **Asset validation.** The controller checks for exactly three integer axes in `1..maximum_axis`, `#RRGGBB` palette colours, and integer `[x, y, z, palette_index]` voxels within bounds, with no duplicates and no more than `maximum_voxels`. `build_voxel.gd` repeats the same checks in Godot.
- **Session check.** The controller works only on a directory directly under `$WORKSPACE/sessions/` that has a Git worktree marker and a `project.godot`.
- **Godot.** `validate_voxel` runs the fixed command `godot --headless --path <session> --script res://tools/build_voxel.gd -- <name>` with a minimal environment and a timeout. The model gets back only the exit code and the last part of the output.
- **Logs.** `logs/<session>.jsonl` records the step, mode, action, and outcome for each turn, without request contents or headers.

The request schema the model sees:

```json
{
  "action": "write_voxel_spec",
  "path": "assets/generated/ember.json",
  "asset": {
    "name": "ember",
    "dimensions": [16, 16, 16],
    "palette": ["#26130F", "#D94B20", "#FFB52E"],
    "voxels": [[4, 0, 7, 0], [4, 1, 7, 1]]
  }
}
```

```json
{"action": "validate_voxel", "name": "ember"}
{"action": "done", "summary": "Built a small ember."}
```

---

## 8. Disposable sessions

```bash
voxel-mode local
SESSION="$(voxel-session new)"          # refuses to start if the project has uncommitted changes
voxel-agent --session "$SESSION" "a small glowing ember, 8x8x8"
```

Review the results:

```bash
git -C "$SESSION" status --short
git -C "$SESSION" diff --stat
git -C "$SESSION" diff
```

To **approve**, commit on the session branch, then merge it yourself:

```bash
git -C "$SESSION" add assets/generated scenes/generated .ai/manifests
git -C "$SESSION" commit -m "Add AI-generated ember"
git -C "$HOME/voxel-workspace/project" merge "ai/$(basename "$SESSION")"
voxel-session discard "$(basename "$SESSION")"
```

To **reject**, discard it:

```bash
voxel-session discard "$(basename "$SESSION")"
```

Discarding removes only that worktree and its `ai/<ID>` branch.

---

## 9. Validation checklist

- **CLI:** `python --version`, `git --version`, and `voxel-mode status` work.
- **Boundary tests:** `cd agent && python -m unittest -v test_voxel_agent` passes.
- **Godot:** the binary reports 4.x and lists `--headless`, `--path`, and `--script`.
- **Local model:** the server listens only on `127.0.0.1`, and a small model returns JSON without causing UI reloads.
- **REMOTE:** switching modes selects the remote endpoint, and `logs/` contains neither the key nor any headers.
- **OFF:** `voxel-mode off` while the agent is running stops it before its next step, and nothing else is affected.
- **Assets:** malformed coordinates are rejected, a valid spec builds `scenes/generated/<name>.tscn`, and `validate_voxel` returns exit code `0`.
- **Rollback:** `voxel-session discard` leaves the main project unchanged.
- **Cinder:** no adapter is enabled until its repository, Godot 4 compatibility, asset format, and license are verified.
