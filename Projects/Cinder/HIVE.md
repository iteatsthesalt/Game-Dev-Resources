# Hive: your devices build AoDJV for an hour

You type a goal, press **run ▸**, and your devices work on it together for an hour. Each one uses its own AI.
**halt** stops it at any time.

| Device | Role in the hive | What it does |
|---|---|---|
| **Old PC** | Root cell (hub) | Shows the page, keeps the task list, checks every feature with Godot, saves to GitHub. Also does work with its own AI. |
| **Old phone** | Worker cell | Plans, writes and heals features with a small AI (`qwen2.5-coder:1.5b`). |
| **New phone** | Worker cell | Same job, with a bigger AI if it has the memory (`qwen2.5-coder:3b`). |

DIGITALSALT isn't part of it yet. It can join later as a fourth cell when you're ready.

## Setup (once)

**1. On the old PC (Linux Mint).** Open a terminal and paste this line:

```
curl -fsSL https://raw.githubusercontent.com/iteatsthesalt/Game-Dev-Resources/ccr-031f1132-nxzsb1/Projects/Cinder/tools/hive/install-oldpc.sh | bash
```

- It asks for your password once, and for a GitHub sign-in.
- When it finishes it shows an **address** (like `192.168.1.50`) and a **pairing code** (like `K7QM2X`). Write both down.

**2. On each phone (Termux).** Paste this line, putting your address and code at the end:

```
curl -fsSL https://raw.githubusercontent.com/iteatsthesalt/Game-Dev-Resources/ccr-031f1132-nxzsb1/Projects/Cinder/tools/hive/install-phone.sh | bash -s -- 192.168.1.50 K7QM2X
```

The phone picks an AI size that fits its memory. Add the **Termux:Widget** widget to get the buttons **Hive Start**,
**Hive Stop** and **Hive Page**.

## Every time

1. Old PC: double-click **Hive Start** on the desktop.
2. Phones: tap **Hive Start**.
3. On any device, open the page at `http://<address>:8790`. It asks for the pairing code once.
4. Type a goal, for example: *"Add hidden ember banks: carry embers, find a bank, deposit them safely"*.
5. Pick **1 hour** and press **run ▸**.
6. When you're done, tap **Hive Stop** on each device. That frees the memory.

## How it works (the cellular system)

| Cell event | What happens |
|---|---|
| **Mitosis** | The goal splits into 3 small tasks. Each task is one new GDScript file. |
| **Growing** | A phone's AI writes the file from a Godot 4 template. |
| **Check** | The old PC runs Godot on the file. If Godot accepts it, it's saved. |
| **Wound** | Godot found an error. The next free device heals it, with the exact broken line and a hint. |
| **Necrosis** | After 3 failed heals the task dies. The file is removed and the failure is logged for you. |
| **Judge** | After each round an AI compares the results to your goal. It either picks the next focus or says the goal is done. |
| **Energy** | A device low on free memory rests instead of crashing, and rejoins when memory frees up. |
| **Conservation** | Every success is its own git commit on a new `hive/<date-time>` branch. Your main branch is never touched. |

The AI also auto-fixes common old-Godot mistakes before checking, such as `def`, `True`, `connect("x", self, "y")`
and mixed tabs and spaces.

## Honest limits

- **Small AI, small wins.** These phone-sized models write simple features. In testing (on one shared computer), a
  5-minute run saved about 1 working feature. Others needed several heals, and some were retired. Expect a handful of
  real features per hour across 3 devices, and read them before using them.
- **New files only.** It never edits your existing game files, so it can't break them. Features land in
  `Projects/Cinder/features/` on the `hive/...` branch. Wiring them into the game is a review step for you (or Claude).
- **Your AoDJV game code isn't on GitHub yet.** To have the hive build inside the real AoDJV project, put that project
  in a GitHub repo (private is best), then change `repo_dir` and `project_dir` in `~/.hive/config.json` on the old PC.
- **Same Wi-Fi.** The phones must be on the same Wi-Fi as the old PC. The pairing code stops other people on that
  Wi-Fi from using it.
