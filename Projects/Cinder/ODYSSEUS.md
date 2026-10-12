# Cinder in Odysseus: easy commands

You type simple commands in your normal Odysseus chat, in the browser or on your phone, and your own AI PC keeps
improving the Cinderdeep voxel models. Claude isn't needed for this.

## Setup (one time, on the AI PC)

1. Press **Win + R**, type `powershell`, and press **Enter**.
2. Paste this line and press **Enter**:
   ```
   irm https://raw.githubusercontent.com/iteatsthesalt/Game-Dev-Resources/ccr-031f1132-nxzsb1/Projects/Cinder/tools/odysseus/install-cinder.ps1 | iex
   ```
   If a GitHub sign-in window opens, sign in. Cinder needs that to save changes.
3. In **Odysseus settings**, where your **Bitez fleet** endpoint is listed, add a new endpoint:
   - **Name:** `Cinder`
   - **URL:** `http://127.0.0.1:8740/v1`
   - **API key:** `cinder` (any text works)
4. Start a chat, pick the model **cinder**, and type `help`.

✅ **It worked if** typing `help` in that chat lists the commands below.

## The commands (type them in the Odysseus chat)

| Type | What happens |
|---|---|
| `push` | Improves the next model a little and saves it to GitHub. |
| `push 5` | Does that 5 times in a row. |
| `ask make the hound glow more` | Makes the change you describe. Say the model's name. |
| `look` | Shows the newest picture of all the models. |
| `undo` | Takes back the last change. |
| `status` | Shows the recent changes. |
| `stop` | Unloads the AI so the PC's graphics memory is free again. |
| `help` | Shows this list. |

Anything else you type just shows the list again, so Cinder never guesses what you meant.

## How it works and why it's safe

- **Cinder is a small program on your PC.** It runs at `127.0.0.1:8740` and starts by itself when you log in. Odysseus
  talks to it like a model called `cinder`.
- **Odysseus on your phone works too.** Odysseus calls Cinder on the PC itself, so the phone needs nothing extra.
- **The thinking is done by your own `qwen3.5:9b` on Ollama** (port 11434). Cinder never changes Ollama, Bitez,
  Odysseus, the firewall or any security settings.
- **The AI can only change the safe look settings** in `assets/tuning/<model>.json`: size, glow, brightness, tint,
  colour strength, wear and variation. Each one has a safe limit, and unusable answers are thrown away.
- **GitHub rebuilds the 3D models and pictures automatically** about 5 minutes after each `push`.
- **Settings file:** `%USERPROFILE%\.cinder\config.json`. A backup is made whenever setup runs again. To use a
  different AI model, change `"model"` there.
- **To turn it off:** delete **Cinder for Odysseus** from your Startup folder (Win + R, type `shell:startup`).
