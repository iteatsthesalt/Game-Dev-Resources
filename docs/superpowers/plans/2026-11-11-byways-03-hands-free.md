# Byways 03: Hands-Free and Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Start press turns Byways into a hands-free stumbler that reads each find aloud, moves on by itself and obeys voice commands and single keys, with the accessibility settings of §6.7.

**Architecture:** Three engine-agnostic core modules (`voice/grammar.js`, `voice/listener.js`, `voice/reader.js`) and one controller (`handsfree.js`) hold every rule and timer, and take a `VoiceEngine`, a `Tts` and a clock as parameters, so Plans 07 and 08 reuse them unchanged. The web shell supplies `createWebVoice`, a refined `createWebTts` and `createWebMedia`. A thin UI layer (`ui/handsfree-ui.js`, `ui/keymap.js`, two settings sections and one first-run step) wires them to the DOM.

**Tech Stack:** ES2022 modules, `node:test` with `fakeClock`, `@playwright/test@1.63.0` with `mockNet` and `installFakeSpeech`, `@axe-core/playwright@4.14.0`, `@fontsource/atkinson-hyperlegible@5.3.0` (vendored files only).

**Spec:** `docs/superpowers/specs/2026-11-11-byways-design.md` (§6 all, §2 items 1–2, §5.6 step 3, §4 voice rows). Research: `byways-research/hands-free.md`, `critic.md` (key map), `platform-shells.md` (WebView, for Plans 07–08).

## Global Constraints

- Every rule in the overview's "Global constraints" and "Working conventions" applies (`docs/superpowers/plans/2026-11-11-byways-00-overview.md`). These bite this plan most:
- "The engine is picked by a working test start, never by guessing from the browser name." (§6.2)
- "That cloud voice is turned on only after you agree to it on a screen that names the company." (§2.2)
- "Restart on `end`, `no-speech` and `aborted` when Byways did not stop it on purpose, at most 10 times a minute. Back off from 1 s up to 30 s on `network`. Stop and show help on `not-allowed`, `service-not-allowed`, `audio-capture` and `language-not-supported`. On `phrases-not-supported`, retry without phrases. After 10 minutes with no recognised command, stop listening and say so." (§6.2)
- "Act only on final results. Interim results count only for **stop** and **pause**." Half-duplex: "while Byways is speaking, and for 400 ms after, it ignores everything except stop and pause." (§6.2)
- "Match the whole utterance after trimming filler words. A command buried in a longer sentence never fires. The one exception is `search for <words>`." "Never send command parsing to an AI." (§6.2)
- "Command words are exactly the visible button labels (WCAG 2.5.3)." (§6.3)
- "Single-key shortcuts can be turned off, and they are ignored while a text field has focus (WCAG 2.1.4)." (§6.3)
- "Each sentence is a separate utterance. Pause works by cancelling and then resuming at the current sentence." (§6.4)
- "A **Stop/Mute** control is visible on every screen, together with Esc and "stop" (WCAG 1.4.2)." (§6.4)
- "Screen-reader mode (a manual toggle): built-in read-aloud goes quiet, and live regions carry the text instead." (§6.4)
- "The dwell time defaults to 20 s. It can be set from 5 to 300 s, or to **wait for me**. The countdown starts after reading ends." "The polite live region announces "Next find in 10 seconds" once per find." (§6.5)
- "Lean-back never opens tabs by itself." "AI never runs during lean-back unless **Let AI refill lean-back** is on. Even then, it makes at most one AI search per 10 finds." (§6.5)
- "One assertive region for errors only, such as "Microphone blocked" (WCAG 4.1.3)." (§6.7)
- "Every view is checked with axe-core in end-to-end tests. Any serious or critical issue fails the build." (§6.7)
- `src/core/**` never touches `window`, `document` or `chrome`; timers come from the injected clock.

## Review Focus

1. **An interim "pause" followed by the final "pause" of the same utterance.** The person expects one toggle, not pause-then-resume. Pinned by `an interim command does not fire again on its final result` (Task 2).
2. **Space pressed on a focused button, link or checkbox.** A keyboard user expects the focused control to activate, not a Stumble. Pinned by `Space on a focused control is left to the control` (Task 8).
3. **A cloud-only browser (Android Chrome, Safari) with no cloud opt-in.** The person expects that no audio leaves the device, even after pressing Start. Pinned by `start without allowCloud on a cloud-only browser never constructs a recogniser` (Task 6).
4. **The pool runs dry or the source fails during lean-back.** The person expects lean-back to stop and say why, not to spin on requests every dwell. Pinned by `an empty result pauses lean-back and announces the reason` (Task 5).
5. **A dwell shorter than 10 s (5–9 s).** The person expects one correct countdown announcement, not "Next find in 10 seconds" for a 5-second wait. Pinned by `a 5 s dwell announces Next find in 5 seconds once` (Task 5).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/voice/grammar.js` | `COMMANDS`, `FILLER_WORDS`, `parseUtterance`, `commandPhrases` |
| `src/core/voice/listener.js` | `createListener`: restart policy, backoff, idle stop, half-duplex, interim rules |
| `src/core/voice/reader.js` | `cardScript`, `createReader`: one utterance per sentence, pause = cancel + resume |
| `src/core/handsfree.js` | `createHandsFree` state machine and lean-back loop, `effectiveListenMode`, `clampDwell` |
| `src/platform/web-voice.js` | Modify: add `createWebVoice` and `vendorFromUA` next to Plan 01's `createNoVoice` |
| `src/platform/web-tts.js` | Modify: local voices first, `voiceschanged` plus polling, `lang` option |
| `src/platform/web-media.js` | Modify: Media Session handlers, `setActive`, silent-audio fallback behind a flag |
| `src/platform/pwa.js` | Modify: use `createWebVoice` and the media flag |
| `src/ui/keymap.js` | `keyToCommand` (pure) and `installKeymap` |
| `src/ui/handsfree-ui.js` | `installHandsFreeUi`: the bar on every screen, help card, captions, first-run step, `describeEngine` |
| `src/ui/views/settings/voice.js` | The Voice settings section, including the cloud opt-in screen |
| `src/ui/views/settings/access.js` | The Accessibility settings section |
| `src/ui/views/stumble.js` | Modify: tell hands-free when a find is shown, opened or read |
| `src/ui/boot.js`, `src/ui/views/index.js` | Modify: create `app.handsFree`; import the two settings sections |
| `src/ui/styles/app.css`, `src/ui/styles/themes.css` | Modify: bar styles, `@font-face`, contrast theme |
| `src/assets/fonts/` | Vendored Atkinson Hyperlegible woff2 (400, 700) and `OFL.txt` |
| `tests/e2e/helpers/fakes.js` | Modify: extra fake speech controls |
| `tests/unit/*.test.js`, `tests/e2e/*.spec.js` | Tests named in each task |

Unit tests that drive async code with `fakeClock` use this helper at the top of the file: `const flush = () => new Promise((r) => setImmediate(r));`. Call `await flush()` after each `clock.advance(ms)`.

<!-- PLAN CONTINUES -->
