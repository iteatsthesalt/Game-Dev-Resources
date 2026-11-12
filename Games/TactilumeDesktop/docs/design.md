# Tactilume Desktop: design

Tactilume Desktop is the desktop-only edition of Tactilume. It is a GPU light engine you play with three kinds of input:
- **Phones over the local network**: each phone is a multi-touch pad, and several phones can play at once.
- **Gamepads**: each pad is a player with two cursors.
- **Sound**: what the computer is playing, a microphone, or a music file.

It is an original work in the genre of the 2010 iPad light-show apps. Nothing is taken from those apps: not the names, finger-count modes, presets, look or words. The research behind these decisions is in `research_notes/Tactilume desktop edition research/` at the repository root.

This document records the decisions for the first milestone, M1. `CONTRACTS.md` gives the exact interfaces that each part is built against.

## What M1 delivers

- An installable app for Windows, macOS and Linux, built by CI. It works offline.
- A new WebGPU engine:
  - Millions to tens of millions of particles. The count is set by a first-run benchmark, so whatever machine it runs on becomes its own default.
  - The 12 Tactilume behaviours, ported from the mobile GLSL so the two editions match.
  - Additive light with trails, bloom, eye adaptation, a flash guard (on by default), AgX tone mapping, and HDR output where the display and the browser support it.
- **Phone link**: the app serves a controller page on the local network and shows a QR code. A phone that scans it becomes a player whose touches steer the light. The phone needs no app install and no internet.
- **Gamepads** through the Gamepad API. The left and right sticks each drive a cursor pole. The triggers set strength. Buttons change behaviour, palette and scene, and rumble answers bursts.
- **Audio**:
  - **Sources:** microphone or line-in, system audio (loopback) where the OS allows it, or a dropped music file.
  - **Measures:** level, bass, mid, treble, onsets and beat. These drive forces, size and colour.
- **The mobile engine as fallback**: when WebGPU is unavailable or blocked, the app runs the mobile WebGL2 engine (its built `Tactilume.html`). Linux on AMD GPUs is the main case, because Chromium's blocklist turns WebGPU off there. The user can force WebGPU in Settings.
- **Shared scenes**: scenes, palettes, presets and share codes are the mobile edition's. The app imports its `src/js/core` modules, so a scene made on the phone opens on the desktop.

Later milestones, not M1:
- Motion control from the Tactilume Android app, over a native bridge.
- DualSense gyro, touchpad and adaptive triggers through WebHID.
- MIDI and OSC input.
- Video output to VJ tools (Spout, Syphon, NDI).
- Distribution through Steam.

## Architecture

```
Electron main (Node)                         Renderer (Chromium, sandboxed)
 ├─ window.js   window, GPU flags            ├─ main.js       boot and frame loop
 ├─ link-server.js  HTTP + WebSocket (LAN)   ├─ bridge.js     preload API, or a shim in tests
 │    serves src/phone/ to phones            ├─ engine/       WebGPU engine (or fallback)
 │    validates every message                ├─ input/        hub, pointer, gamepad, phone
 ├─ audio-capture.js  loopback handler       ├─ audio/        sources and features
 └─ settings.js                              └─ ui/           overlay, pairing panel (QR)
        ▲  IPC (preload: contextBridge, no Node in the renderer)  │
        └─────────────────────────────────────────────────────────┘
Phone browser ── WebSocket (JSON, protocol v1) ──► link-server ──► IPC ──► input/phone.js ──► hub ──► engine
```

**Inputs and players.** Every input becomes a pole: a point of force in world units, the same `Pole` as the mobile edition. Each pole belongs to a player, and each player has a colour. The input hub combines the poles from every source each frame. It caps the total at 64, and when there are too many it keeps the newest, so every player always keeps at least one pole. The engine receives the poles in `frame(f)`.

**Phone link security.**
- The server listens on every interface but refuses any peer outside the private ranges: 10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, fc00::/7 and fe80::/10.
- A phone must present the session token from the QR code. Tokens are 128-bit, random and compared in constant time.
- New phones are only accepted while "Allow new phones" is on.
- Limits: at most 8 phones, 4 KB per message, 240 messages per second per phone.
- Every field is validated and clamped before it reaches the renderer.
- The renderer never touches the network. Electron's security settings are on: context isolation, sandbox, no Node integration, and a strict CSP.

**Phone limits.** The controller page is plain HTTP on the LAN, so phone browsers do not treat it as a secure context. That rules out motion sensors and wake lock. Touch, which is all M1 needs, works without HTTPS. Motion arrives later through the Tactilume Android app.

**Rendering.**
- Particles are 32 bytes each (position and heat, velocity and life), the same layout as mobile. A compute pass moves them.
- They are drawn as instanced quads with soft falloff, blended additively into an rgba16float accumulation texture. Trails fade with a blend constant.
- Post-processing: a 13-tap downsample and tent upsample for bloom, then eye adaptation and the flash guard (both in a 1×1 state texture), then the composite.
- The composite uses AgX for SDR. For HDR it uses extended output: the canvas is rgba16float with `toneMapping: {mode: 'extended'}`.
- Every frame is first drawn to an offscreen texture, then presented. That gives tests, photos and video a readback path. In headless test browsers, which cannot present a WebGPU canvas at all, the engine renders offscreen only.
- Shader rules carried over from mobile: no `isnan`/`isinf` (test float bits instead), and `pow` only on bases that cannot be negative.

**Quality.**
- A first-run benchmark of about 10 s runs the compute and draw passes at increasing particle counts. It picks the count that fits 70% of a frame at the display's refresh rate, and the result is stored.
- While the app runs, a governor steps the count down after sustained misses and back up after sustained headroom.
- The Settings panel shows the detected GPU, the tier and the particle count, and lets the user override them.

**System requirements** (to be checked against the research report and the desktop check):

| | OS | GPU (examples) | Memory |
|---|---|---|---|
| Minimum | Windows 10 64-bit, macOS 13, Ubuntu 22.04 | WebGPU-capable integrated: Intel Iris Xe, Radeon 680M, Apple M1 | 8 GB |
| Recommended | Windows 11, macOS 14 | RTX 3060 / RX 6600 / Apple M2 Pro class, 1440p 144 Hz | 16 GB |
| Ultra | | RTX 4070 Ti / RX 7900 class or better, HDR display | 16 GB+ |

## Testing

- **Unit tests** (`node --test`) cover the protocol, the LAN address checks and tokens, the link server (tested with a real WebSocket client), the input hub and gamepad mapping (with fake pads), the audio features (with synthetic spectra), and the calibration maths.
- **Browser tests**: the built renderer runs in Playwright's Chromium with `--enable-unsafe-webgpu` on the software adapter. A shim stands in for the preload bridge. The tests check:
  - boot;
  - the light rendering, through the offscreen readback;
  - poles from mouse, fake gamepads and fake phone messages moving the light;
  - behaviour switching;
  - audio features changing the picture;
  - the fallback when WebGPU is missing;
  - the absence of WebGPU validation errors.
- **Electron smoke test** in CI, under xvfb: the app boots, the renderer reports ready, the link server answers, and the app quits cleanly.
- **CI** runs the tests on Linux. It then packages unsigned builds on Windows, macOS and Linux runners: NSIS, dmg and AppImage, each kept as an artifact.

## Open questions for the user

- Your computer's specs. The desktop check page, or the app's own first-run benchmark, measures them. If you paste them in, I can tighten the requirement tiers.
- Code signing. Unsigned builds show OS warnings: SmartScreen on Windows, Gatekeeper on macOS. Signing needs your developer accounts.
