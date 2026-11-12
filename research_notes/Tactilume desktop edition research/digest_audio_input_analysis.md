This is the fact-checked digest of audio_input_analysis.md (Tactilume Desktop system audio, microphone, music files, analysis, sync, flash safety and MIDI/OSC on Electron 45; state as of 2026-11-12).

**Status.** The Verification table has 18 rows: 14 confirmed, 2 corrected, 2 unverifiable. A later check against this container's measurements found no conflict, so no sentence was changed. Official doc sites were blocked; sources are raw GitHub files, npm and developer.apple.com.

**Tags.** [Verified] re-read at source by the fact-check (inline tag or table row). [Verified correction] corrected against a source. [Cited] from the linked file, not re-read. [Unverified] not checked or unreachable. [Inference] the notes' own conclusion or arithmetic. [Measured] this container: headless Chromium 153.0.8010.12 (Playwright 1.63.0), Linux, SwiftShader fallback adapter, `--enable-unsafe-webgpu` only; not GPU data.

**Source keys.**
- ED = https://raw.githubusercontent.com/electron/electron/main/docs/
- EBC = https://raw.githubusercontent.com/electron/electron/main/shell/browser/electron_browser_context.cc
- CR = https://raw.githubusercontent.com/chromium/chromium/main/
- CR156 = https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/
- MDN = https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/
- BCD = https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/ (8.1.8, 2026-11-02)
- NPM = https://registry.npmjs.org/
- GH = https://raw.githubusercontent.com/
- WCAG = https://raw.githubusercontent.com/w3c/wcag/main/
- APPLE = https://developer.apple.com/documentation/

## Decisions the notes support [Inference]
- System audio: the renderer calls `getDisplayMedia({video: true, audio: true})`; the main process answers in `setDisplayMediaRequestHandler` with `{video: <source>, audio: 'loopback'}` (never `'loopbackWithMute'`, which mutes the speakers); the renderer drops the video track. Documented for Windows and macOS 14.2+; Linux needs testing and a fallback.
- Mic: `getUserMedia` with a chosen `deviceId`, speech processing off, stereo and 48 kHz as `ideal`, checked with `track.getSettings()`.
- Files: play through `<audio>` + `MediaElementAudioSourceNode`; decode separately for offline beat and feature curves.
- Analysis on the CPU in an AudioWorklet at a fixed hop; the GPU only holds spectrogram textures. Write the DSP in house; borrow only permissive code.
- Audio modulates hand-controlled parameters within bounds; an always-on flash limiter enforces WCAG 2.3.1. DAW sync through MIDI clock and OSC.

## 1. Versions
- Latest stable Electron is 45.3.0 (2026-11-10); 45.0.0 shipped 2026-10-21, 44.0.0 2026-08-25, 43.0.0 2026-06-30; alpha 46.0.0-alpha.9. NPM/electron [Verified]
- Electron 45 pins Chromium 156.0.8078.96; main (Electron 47 work) is on 159.0.8154.0. https://raw.githubusercontent.com/electron/electron/45-x-y/DEPS; .../main/DEPS [Verified]
- Electron 45 needs Windows 10+ or macOS 13 Ventura+. https://raw.githubusercontent.com/electron/electron/v45.3.0/README.md [Verified]

## 2. System audio loopback

**API**
- Handler `audio` is `'loopback'` or `'loopbackWithMute'`: "supported on Windows and on macOS 14.2 and later". A `WebFrameMain` as `audio` captures that webContents. `video` is optional: a DesktopCapturerSource or a `WebFrameMain`. `null` rejects with `AbortError`. ED/api/session.md [Verified]
- Electron turns the string into a "System audio" device with no Linux check; `restrictOwnAudio` swaps in `loopbackWithoutChrome` on macOS, Windows and ChromeOS only; any other string throws. EBC; CR/media/audio/audio_device_description.h [Verified]. So Chromium's `applicationLoopback:<id>` and `loopbackAllDevices` are unreachable, and per-app capture needs native code. [Inference]
- `getDisplayMedia` without video rejects with TypeError; `systemAudio: "include"` is only a hint, so a stream may lack audio. MDN/mediadevices/getdisplaymedia/index.md [Verified]. Chrome: audio 74, `systemAudio` 105, `windowAudio` 141 (partial); not Firefox or Safari. BCD/MediaDevices.json [Verified]
- Electron 45 breaking change: capture requests reach `setPermissionRequestHandler` as `display-capture`, not `media`. ED/breaking-changes.md [Verified]
- electron-audio-loopback (1.0.6, MIT) is unnecessary from Electron 39. GH/alectrocute/electron-audio-loopback/HEAD/README.md [Verified]

**Windows**
- System loopback is supported with no flag. CR/media/base/media_switches.cc; CR/chrome/browser/media/webrtc/desktop_media_picker_controller.cc [Verified]. Chromium has WASAPI endpoint and per-process loopback. CR/media/audio/win/audio_low_latency_input_win.cc [Cited]
- An OS prompt for loopback: none documented. [Unverified: learn.microsoft.com blocked]

**macOS**
- 14.2+ needs `NSAudioCaptureUsageDescription` and the "System Audio Recording" permission, held by the responsible process (the terminal or IDE in development). If missing or denied, the track arrives `ended`, delivers no samples and raises no error. CATap is the default since Electron 39 with "no automatic fallback" to ScreenCaptureKit; the opt-out flag worked only in 39–44. ED/api/desktop-capturer.md; ED/breaking-changes.md [Verified]
- Chromium: CATap needs 14.2+; SCK loopback runs only below 15.0 unless `MacSckSystemAudioLoopbackOverride`. CR/media/base/media_switches.cc [Verified]. On macOS 14, CATap does not handle sample-rate mismatches, so Chromium resamples internally (fixed in 15); `AudioDeviceCreateIOProcID()` triggers the prompt. CR/media/audio/mac/catap_audio_input_stream.mm [Verified]
- The tap API floor is 14.2, not AudioCap's 14.4. APPLE/coreaudio/audiohardwarecreateprocesstap(_:_:) [Verified correction]. No public API requests or checks the permission. GH/insidegui/AudioCap [Cited]
- The "macOS 12 → BlackHole" path is struck: Electron 45 needs macOS 13+. Coverage: 13.0–14.1 via SCK, best effort and undocumented; 14.2+ via CATap; BlackHole as a manual fallback. v45.3.0 README [Verified correction]
- A screen source needs Screen Recording consent; check `getMediaAccessStatus('screen')`. ED/api/desktop-capturer.md; ED/api/system-preferences.md [Cited]

**Linux**
- With PulseAudio, loopback opens "the monitor device of the default sink" and follows sink changes. CR/media/base/media_switches.cc; CR/media/audio/pulse/pulse_loopback_manager.cc [Verified]
- Electron passes `loopback` through, but its docs promise only Windows and macOS; Chrome's own picker needs the off-by-default `PulseaudioLoopbackForScreenShare`. EBC; ED/api/session.md; media_switches.cc [Verified]
- Monitors are hidden from input enumeration. CR/media/audio/pulse/audio_manager_pulse.cc [Verified]
- PipeWire: the system picker appears on every Wayland `getSources` call unless `persistMode: 'persistent'` and a stored `restoreToken` (experimental, portal v4+) are used; X11 ignores them. ED/api/desktop-capturer.md [Verified]
- Electron 45 loopback over pipewire-pulse: untested. [Unverified]

**Inferences**
- Test `video: request.frame` (the app's own frame) as the dummy video, to avoid the Screen Recording prompt and the Wayland picker; undocumented.
- macOS onboarding: an `ended` track or zero RMS over the first second is the only permission signal; then show System Settings help. Ship signed with the usage key.
- Linux fallback: reroute to "Monitor of …" in pavucontrol, or a native helper (PipeWire/PulseAudio addon, `pw-record`/`parec`) streaming PCM over a MessagePort. Keep a per-OS native addon (the OBS/projectMSDL pattern) in reserve.
- Open: whether `getDisplayMedia` needs a user gesture in Electron (the handler sees `request.userGesture`); how Wallpaper Engine, NestDrop, Plane9 and Discord capture audio. [Unverified]

## 3. Microphone and line-in
- Electron's `media` permission covers camera, microphone and speakers. ED/api/session.md [Verified]
- `askForMediaAccess('microphone')` is macOS-only and needs `NSMicrophoneUsageDescription`; `getMediaAccessStatus` works on Windows and macOS. ED/api/system-preferences.md [Verified]
- Keep the hardened-runtime `com.apple.security.device.audio-input` entitlement, an `@electron/osx-sign` default; desktop_app_shell.md was corrected to match. APPLE/bundleresources/entitlements/com.apple.security.device.audio-input; GH/electron/osx-sign/main/entitlements/default.darwin.plist [Verified]
- Linux PulseAudio input defaults to 1024-frame buffers (about 21 ms at 48 kHz). CR/media/audio/pulse/audio_manager_pulse.cc [Verified]
- Under Chromium's "EnforceSystemEchoCancellation" (macOS, Windows), "system NS will still be on due to system echo cancellation running". CR media_switches.cc [Cited]
- Inference: request `{deviceId: {exact: id}, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: {ideal: 2}, sampleRate: {ideal: 48000}}`; warn if `getSettings()` shows processing or mono. Grant `media` only for audio from the app's origin, plus `display-capture` for loopback. Budget 10–25 ms of capture latency.
- Open: Windows microphone privacy for desktop apps; stereo line-in fidelity; ASIO/exclusive WASAPI. [Unverified]

## 4. Music files
- Electron builds with proprietary codecs, so MP3, AAC/M4A, FLAC, Opus/Vorbis and WAV are practical inputs. MDN: "AAC is not available in Chromium builds" (open-source builds without them). https://raw.githubusercontent.com/electron/electron/main/build/args/all.gn; https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/media/guides/formats/audio_codecs/index.md [Verified]
- `File.path` was removed in Electron 32; use `webUtils.getPathForFile`. ED/breaking-changes.md; ED/api/web-utils.md [Verified]
- Inference: a decoded 5-minute stereo float32 48 kHz track is about 115 MB, so decode only for the offline pass. Offline beat, downbeat and drop detection before playback is the files' main quality edge. Streaming apps are reachable only through loopback.
- Open: ALAC decoding; long-FLAC decode cost. [Unverified]

## 5. Analysis
- AnalyserNode: `fftSize` is a power of 2 from 32 to 32768, `smoothingTimeConstant` 0.8, Blackman window. MDN/analysernode/fftsize/index.md; MDN/analysernode/smoothingtimeconstant/index.md [Verified]
- AudioWorklet: "Currently, audio data blocks are always 128 frames". MDN/audioworkletprocessor/process/index.md [Verified]
- `renderSizeHint` (`"default"` = 128, `"hardware"`, or 1 to 6 × sample rate) and `renderQuantumSize`: Chrome 153, experimental; `status: "stable"` (on) in Chromium 156, so Electron 45 has it. With `"hardware"`, `renderQuantumSize` reads 0 until running. BCD/AudioContext.json; CR156/third_party/blink/renderer/platform/runtime_enabled_features.json5 [Verified]
- projectM: bass, mid and treb come from the first three sixths of the spectrum, relative to recent frames, "around 1.0, with <0.7 being very silent and >1.3 very loud", plus smoothed `_att` versions. GH/projectM-visualizer/projectm/HEAD/src/libprojectM/Audio/Loudness.hpp [Verified]
- BTrack is a causal real-time beat tracker (1.0.7). GH/adamstark/BTrack/HEAD/README.md [Verified]
- Other options [Cited]: Meyda extractors; aubio onsets and causal tracking; Essentia.js SuperFlux, multi-feature beat tracking, EBU R128, HPCP and key; BeatNet (beat, downbeat, tempo, meter; 22,050 Hz); librosa dynamic-programming beats and HPSS. madmom online mode [Unverified].
- Live pipeline [Inference]:
  - 2048-point Hann FFT with a 256–512-sample hop (5.3–10.7 ms); mono for spectra, L/R for stereo width.
  - 24–32 log bands (40 Hz to 16 kHz); attack 5–15 ms, release 80–300 ms; each band normalised to its long-term average.
  - Log spectral flux per group (kick 30–120 Hz, snare 150 Hz–2 kHz, hats 6 kHz+); threshold median + k × MAD; minimum gap 50–80 ms.
  - Tempo by autocorrelation or comb filters over 6–8 s; causal next-beat prediction; downbeats by tap or MIDI clock.
- Cost [Inference]: tens of microseconds per hop in JS or WASM. A WebGPU FFT adds milliseconds of dispatch and readback for no gain.
- Other features [Inference]: chroma over 1–2 s drives hue; key only drives slow palette drift; HPSS and build/drop detection belong in the file look-ahead.
- Open: no latency or accuracy figures for BTrack, BeatNet or madmom online; no WebGPU FFT library. [Unverified]

## 6. Libraries and licences
All versions, dates and licences match npm and the licence files (table row) [Verified]. Sources: NPM/<package>; GH/meyda/meyda/HEAD/LICENSE.md; GH/MTG/essentia.js/HEAD/LICENSE; GH/aubio/aubio/HEAD/COPYING; GH/qiuxiang/aubiojs/HEAD/license; GH/adamstark/BTrack/HEAD/README.md; GH/CPJKU/madmom/HEAD/LICENSE; GH/mjhydri/BeatNet/HEAD/LICENSE; GH/librosa/librosa/HEAD/LICENSE.md; GH/Ableton/link/HEAD/LICENSE.md.
- Permissive: Meyda 5.6.3 (MIT, last release 2024-04-21); fft.js 4.0.4 (MIT); realtime-bpm-analyzer 5.6.1 (2026-11-03, Apache-2.0; worklet from a `blob:` URL, `processorUrl` for strict CSP); web-audio-beat-detector 8.2.39 (2026-08-26, MIT); Tone.js 15.1.22 (MIT; `next` 15.5.66 of 2026-10-31); librosa (ISC, Python); node-osc 11.7.1 (Apache-2.0); osc.js 2.4.5 (MIT OR GPL-2.0).
- Copyleft: Essentia.js 0.1.3 (AGPL-3.0, last release 2021-06-24); aubio (GPL-3.0+); aubiojs 0.2.1 (MIT-style wrapper around GPL aubio, so treat as GPL); BTrack (GPLv3+); Ableton Link (GPLv2+, or proprietary via link-devs@ableton.com).
- Models: madmom code BSD, models CC BY-NC-SA 4.0 (non-commercial; commercial use via Gerhard Widmer); BeatNet CC BY 4.0 (commercial use with attribution).
- Inference: bundling AGPL or GPL code makes the distributed app a covered work; closed-source or store builds must reimplement or license. Not legal advice.
- Open: Essentia commercial terms; WASM builds of BTrack-style trackers. [Unverified]

## 7. Latency and sync
- Chrome: `baseLatency` 58, `outputLatency` 102, `getOutputTimestamp` 57, `playbackStats` 146 (experimental; stable in Chromium 156), `latencyHint` 58. BCD/AudioContext.json; CR156 runtime_enabled_features.json5 [Verified]
- `getOutputTimestamp()` returns `contextTime` and a matching `performanceTime`; `playbackStats` reports underruns and latency. MDN/audiocontext/getoutputtimestamp/index.md; MDN/audiocontext/playbackstats/index.md [Cited]
- The spec's AnalyserNode smoothing blends with the previous smoothing call's output. GH/WebAudio/web-audio-api/HEAD/index.bs [Cited]
- Budget [Inference]: live features arrive about 30–60 ms late (capture 10–21 ms, render quantum 2.7 ms, half a 2048 window 21 ms, presentation 2–17 ms).
- Design [Inference]:
  - Never drive visuals from `AnalyserNode` in `requestAnimationFrame`: its smoothing probably varies with call rate (untested).
  - Analyse at a fixed hop in the worklet and publish timestamped frames over a SharedArrayBuffer ring (needs COOP/COEP isolation, unverified) or a MessagePort; the renderer interpolates.
  - Smooth with `y += (x - y) * (1 - exp(-dt / tau))`, time constants in seconds, so 60–480 Hz displays match.
  - Files: `audibleTime ≈ getOutputTimestamp().contextTime`; fire when `eventTime <= audibleTime + displayLatency`.
  - Live: a 512-point transient path; beat pulses from the predicted next beat minus pipeline latency.
  - An AV offset slider (−150 to +150 ms) with tap calibration; Bluetooth adds unseen delay.
- Open: measured capture latency per path; AV-sync tolerances. [Unverified]

## 8. Mapping and photosensitive safety
- WCAG 2.3.1 (Level A): nothing "flashes more than three times in any one second period, or the flash is below the general flash and red flash thresholds". WCAG/guidelines/sc/20/three-flashes-or-below-threshold.html [Verified]
- Thresholds: at most three general and/or three red flashes per second, or a combined area within 0.006 sr of any 10° field (25%). General flash: opposing changes of 10% or more relative luminance with the darker below 0.80. Red flash: opposing transitions involving saturated red (R/(R+G+B) ≥ 0.8, CIE 1976 UCS chromaticity difference > 0.2). Fine balanced patterns are exempt. WCAG/guidelines/terms/20/general-flash-and-red-flash-thresholds.html [Verified]. WCAG 2.3.2 (AAA) forbids more than three flashes per second outright. [Cited]
- The 10° block is 341 × 256 CSS px, analysed at full screen. A 20 cd/m² change with the darker below 160 cd/m² counts for SDR and HDR; for HDR with the darker at 160 cd/m² or more, Michelson contrast ≥ 1/17 is a flash. An HDR mode therefore needs the limiter in absolute luminance. WCAG/understanding/20/three-flashes-or-below-threshold.html [Verified]
- [Measured] Chromium 153 accepts `rgba16float` with `toneMapping: {mode: "extended"}` in `configure()` and reports it back, so an HDR path is plausible and the HDR rule applies; presentation could not be tested here.
- Mapping [Inference]: touch, motion and gamepad set base values; audio scales them (emission, size, glow, colour, turbulence, attraction) within about ±30%, and its depth ducks 50–80% while the user steers. One "Music reactivity" master (off, subtle, normal, wild) plus per-band sensitivity. Bass `_att` drives slow large effects; onsets drive local bursts; treble drives shimmer, never full-screen brightness; beat phase quantises automatic events.
- Flash limiter [Inference]: always on. Track luminance and red saturation per 10° region (a 341 × 256 px grid at 1080p, scaled for DPI); cap opposing 10%+ transitions at three per second per region, plus total area; over budget, clamp per-frame change and turn flashes into hue or size changes. 16th-note hats at 128 BPM come about 8.5 times per second; beats (2.13) fit.
- Defaults [Inference]: "Reduce flashing" on; respect `prefers-reduced-motion`; a photosensitivity notice first; no saturated red flashes.

## 9. MIDI, OSC and Ableton Link
- Electron permissions `midi` and `midiSysex` appear in both the request and check handlers. ED/api/session.md [Verified]
- `requestMIDIAccess()` needs a secure context and an explicit grant. MDN/navigator/requestmidiaccess/index.md [Verified]. Chrome 43+, Firefox 108+, no Safari. BCD/Navigator.json [Verified]
- `registerSchemesAsPrivileged` has a `secure` privilege (default false), used in Electron's own `app` scheme example. ED/api/structures/custom-scheme.md [Verified]. Whether Web MIDI then sees a secure context is untested. [Unverified, table row]
- MIDI clock is 24 per quarter note (`0xF8`; start `0xFA`, continue `0xFB`, stop `0xFC`, song position `0xF2`). GH/djipco/webmidi/HEAD/src/Enumerations.js [Cited]
- Inference: grant `midi` for the app origin (`midiSysex` only if needed) and handle `statechange` for hot-plugging. BPM = 60 / (24 × mean tick interval) over 24–96 ticks with outlier rejection; Start, Stop, Continue and Song Position set phase and bar; clock overrides audio tempo. OSC on a main-process UDP socket with a `/tactilume/*` whitelist, forwarded over `MessagePortMain`, localhost by default, LAN opt-in. Skip Link for v1 or license it.
- Open: whether MIDI prompts when no permission handler is set; Link bindings for Electron 45. [Unverified]

## Open questions that shape decisions
- Does Electron 45's `loopback` capture system audio on current PipeWire distributions (pipewire-pulse, X11 and Wayland), or must Linux ship a native capture helper?
- Which prompts does loopback raise on each OS? Can `video: request.frame` replace a screen source, and does Windows prompt at all?
- What is the measured end-to-end latency of each live path in Electron 45? It sets the default AV offset and how much prediction is needed.
