# Audio input and real-time music analysis for Tactilume Desktop (Chromium/Electron), as of 2026-11-12

Method note: the shared web-search budget was used up before this task began, and most documentation sites (electronjs.org, developer.mozilla.org, developer.chrome.com, w3.org, learn.microsoft.com, chromestatus.com) were blocked in this session. So nothing below comes from search snippets. Every cited finding comes from a primary source read in full:
- shallow git clones of public GitHub repositories: the Electron docs and source (main at 2026-11-11, plus the 43-x-y, 44-x-y and 45-x-y branches); the Chromium mirror (main at 2026-11-11); mdn/content (main at 2026-11-11); the W3C, WebAudio and WCAG spec repos; and the library repos;
- npm registry metadata, including `@mdn/browser-compat-data` 8.1.8 (published 2026-11-02);
- developer.apple.com documentation, fetched as JSON.

GitHub links use the path read. The `HEAD` links point at each repository's default branch as of 2026-11-11/12. Anything not verifiable this way is listed under Gaps.

Fact-check pass (2026-11-12): decision-critical claims were re-read from the same primary sources (raw GitHub, npm, developer.apple.com) and tagged [Verified], [Verified correction] or [Unverified]. A Verification table is at the end.

## 1. System audio loopback per OS in Chromium and Electron (2026)

### Takeaway
A single Electron code path covers Windows and macOS 14.2+. The renderer calls `getDisplayMedia({video: true, audio: true})`; the main process answers in `session.setDisplayMediaRequestHandler` with `audio: 'loopback'` (never `'loopbackWithMute'`); the renderer then stops the video track.
- **Windows:** no OS prompt is documented.
- **macOS 14.2+:** the app must ship `NSAudioCaptureUsageDescription` and the user must grant the "System Audio Recording" permission. A missing or denied permission fails silently: the track arrives already `ended`.
- **Linux:** the same `loopback` ID reaches Chromium's PulseAudio loopback, which opens the monitor of the default sink. Electron passes it through, but Electron's docs only promise Windows and macOS, so Linux must be tested (for example on PipeWire's PulseAudio compatibility layer) and needs a fallback plan.

### Cited Findings
**Versions (as of 2026-11-12)**
- The latest stable Electron is 45.3.0 (published 2026-11-10). The alpha tag is 46.0.0-alpha.9. First stable releases: 43.0.0 on 2026-06-30, 44.0.0 on 2026-08-25, 45.0.0 on 2026-10-21 — [npm registry: electron](https://registry.npmjs.org/electron) [Verified: https://registry.npmjs.org/electron]
- Electron 45 pins Chromium 156.0.8078.96, Electron 44 pins 152.0.7977.169 and Electron 43 pins 150.0.7871.250. Electron main (the Electron 47 work) is on 159.0.8154.0 — [45-x-y DEPS](https://github.com/electron/electron/blob/45-x-y/DEPS); [44-x-y DEPS](https://github.com/electron/electron/blob/44-x-y/DEPS); [43-x-y DEPS](https://github.com/electron/electron/blob/43-x-y/DEPS); [main DEPS](https://github.com/electron/electron/blob/main/DEPS) [Verified: https://raw.githubusercontent.com/electron/electron/45-x-y/DEPS; https://raw.githubusercontent.com/electron/electron/main/DEPS]
- Electron 45 runs on macOS 13 Ventura and later and Windows 10 and later. [Verified: https://raw.githubusercontent.com/electron/electron/v45.3.0/README.md]

**Electron API (all platforms)**
- In `ses.setDisplayMediaRequestHandler(handler[, opts])`, the callback's `audio` may be a string, `loopback` or `loopbackWithMute`: "Specifying a loopback device will capture system audio, and is supported on Windows and on macOS 14.2 and later". If `audio` is a `WebFrameMain`, the handler captures that webContents' audio. `video` is optional and is either a DesktopCapturerSource `{id, name}` or a `WebFrameMain`. Passing `null` denies the request, which rejects the page's promise with `AbortError` — [Electron session.md](https://github.com/electron/electron/blob/main/docs/api/session.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/session.md]
- In Chromium, `loopbackWithMute` is "Similar to kLoopbackInputDeviceId, with only difference that this ID will mute system audio during capturing". Chromium also defines:
  - `loopbackWithoutChrome`: "without audio from Chrome. Only supported on Windows, Mac and ChromeOS";
  - `loopbackAllDevices`: captures from all output devices;
  - `applicationLoopback:<application id>`.
  — [Chromium audio_device_description.h](https://github.com/chromium/chromium/blob/main/media/audio/audio_device_description.h); [audio_device_description.cc](https://github.com/chromium/chromium/blob/main/media/audio/audio_device_description.cc) [Verified: https://raw.githubusercontent.com/chromium/chromium/main/media/audio/audio_device_description.h]
- Electron's native code turns the handler's `audio` string straight into a "System audio" stream device. If the page asked for `restrictOwnAudio`, it swaps `loopback` for `loopbackWithoutChrome` on macOS, Windows and ChromeOS only; elsewhere it keeps plain `loopback`. Any other string throws "audio must be a WebFrameMain, "loopback" or "loopbackWithMute"" — [Electron shell/browser/electron_browser_context.cc](https://github.com/electron/electron/blob/main/shell/browser/electron_browser_context.cc) [Verified: https://raw.githubusercontent.com/electron/electron/main/shell/browser/electron_browser_context.cc]
- `getDisplayMedia()` always needs video: "if this option is set to false the promise will reject with a TypeError". `audio` defaults to `false` — [MDN getDisplayMedia](https://github.com/mdn/content/blob/main/files/en-us/web/api/mediadevices/getdisplaymedia/index.md) [Verified: https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/mediadevices/getdisplaymedia/index.md]
- `systemAudio: "include"` is only a hint: "the returned stream might contain no audio track even when audio is true and systemAudio is include" — [MDN getDisplayMedia](https://github.com/mdn/content/blob/main/files/en-us/web/api/mediadevices/getdisplaymedia/index.md); the spec likewise says "The user agent MAY ignore this hint" — [W3C mediacapture-screen-share](https://github.com/w3c/mediacapture-screen-share/blob/HEAD/index.html)
- Browser support: getDisplayMedia audio capture from Chrome 74, `systemAudio` from Chrome 105 and `windowAudio` from Chrome 141; Firefox and Safari support none of these — [@mdn/browser-compat-data 8.1.8](https://registry.npmjs.org/@mdn/browser-compat-data) [Verified: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/MediaDevices.json — `windowAudio` is partial, "Only supports values "exclude" and "system", not "window""]
- `desktopCapturer.getSources`: setting `thumbnailSize` width or height to 0 "will save the processing time required for capturing the content of each window and screen" — [Electron desktop-capturer.md](https://github.com/electron/electron/blob/main/docs/api/desktop-capturer.md)
- Electron 45 breaking change: screen, window and tab capture requests now reach `setPermissionRequestHandler` as `display-capture`, no longer as `media`. A handler that grants only `media` must now also grant `display-capture`. `details.mediaTypes` lists `video` and/or `audio` — [Electron breaking-changes.md (45.0)](https://github.com/electron/electron/blob/main/docs/breaking-changes.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/breaking-changes.md; also stated in https://raw.githubusercontent.com/electron/website/main/blog/electron-45-0.md]
- The electron-audio-loopback package (1.0.6, 2025-08-03, MIT) states: "Between Electron versions 31 and 39, the Chromium shipped inside required hacks to get system audio loopback working properly", and "Electron 39 and up … you won't require electron-audio-loopback". Its README also says "getDisplayMedia will fail if you don't request video: true" and advises removing the video tracks. For Electron 31–38 it turned on these Chromium features: `PulseaudioLoopbackForScreenShare` and `MacLoopbackAudioForScreenShare`, plus either `MacSckSystemAudioLoopbackOverride` or `MacCatapSystemAudioLoopbackCapture` — [electron-audio-loopback README](https://github.com/alectrocute/electron-audio-loopback); [src/config.ts](https://github.com/alectrocute/electron-audio-loopback/blob/HEAD/src/config.ts); [npm](https://registry.npmjs.org/electron-audio-loopback) [Verified: https://raw.githubusercontent.com/alectrocute/electron-audio-loopback/HEAD/README.md; https://registry.npmjs.org/electron-audio-loopback (1.0.6, 2025-08-03, MIT); config.ts not re-read]

**Windows**
- Chromium's `IsSystemLoopbackCaptureSupported()` returns `true` on Windows, and Chrome's own picker offers system audio there with no extra flag — [Chromium media_switches.cc](https://github.com/chromium/chromium/blob/main/media/base/media_switches.cc); [desktop_media_picker_controller.cc](https://github.com/chromium/chromium/blob/main/chrome/browser/media/webrtc/desktop_media_picker_controller.cc) [Verified: https://raw.githubusercontent.com/chromium/chromium/main/media/base/media_switches.cc; https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/media/webrtc/desktop_media_picker_controller.cc]
- WASAPI capture in Chromium:
  - endpoint (whole-device) loopback sets `AUDCLNT_STREAMFLAGS_LOOPBACK`;
  - a code comment notes that endpoint loopback "does not support event-" driven mode, so Chromium sets the event handle on a render client instead;
  - process loopback uses `AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK` with the include or exclude target-process-tree modes.
  — [Chromium audio_low_latency_input_win.cc](https://github.com/chromium/chromium/blob/main/media/audio/win/audio_low_latency_input_win.cc)
- `kApplicationAudioCaptureWin` is enabled by default: "Enables application audio capture for getDisplayMedia (gDM) window capture in Windows" — [Chromium media_switches.cc](https://github.com/chromium/chromium/blob/main/media/base/media_switches.cc)
- OBS turns on per-process audio capture from Windows 10 build 19041 ("MS says 20348, but process filtering seems to work earlier") — [OBS win-wasapi plugin-main.cpp](https://github.com/obsproject/obs-studio/blob/HEAD/plugins/win-wasapi/plugin-main.cpp); [win-wasapi.cpp](https://github.com/obsproject/obs-studio/blob/HEAD/plugins/win-wasapi/win-wasapi.cpp)
- projectMSDL (the projectM SDL front end) has a WASAPI capture backend. Its Core Audio tap header calls the macOS path "the macOS equivalent of the WASAPI loopback" — [frontend-sdl2 src](https://github.com/projectM-visualizer/frontend-sdl2/tree/HEAD/src); [AudioCaptureImpl_CoreAudioTap.h](https://github.com/projectM-visualizer/frontend-sdl2/blob/HEAD/src/AudioCaptureImpl_CoreAudioTap.h)

**macOS**
- On macOS 14.2+, the `NSAudioCaptureUsageDescription` Info.plist key "must be added in order for audio to be captured by desktopCapturer". Electron's docs explain:
  - Chromium uses Apple's CoreAudio Tap API, "which is gated behind the 'System Audio Recording' privacy permission";
  - macOS gives that permission to the responsible process, so an unpackaged app run from a terminal or IDE needs the terminal or IDE to hold the permission;
  - "If the permission is missing or has been denied, desktopCapturer still produces an audio track, but it is created in the ended state and never delivers samples. No warning or error is surfaced to JavaScript."
  — [Electron desktop-capturer.md](https://github.com/electron/electron/blob/main/docs/api/desktop-capturer.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/desktop-capturer.md]
- "Since Electron 39, Chromium uses the CoreAudio Tap API by default" on macOS 14.2+. There is "no automatic fallback" to the older ScreenCaptureKit "Screen & System Audio Recording" path. Electron 45 removed the `MacCatapLoopbackAudioForScreenShare` opt-out flag upstream, so it "no longer has any effect" — [Electron desktop-capturer.md](https://github.com/electron/electron/blob/main/docs/api/desktop-capturer.md); [breaking-changes.md (39.0)](https://github.com/electron/electron/blob/main/docs/breaking-changes.md) [Verified: same sources; the 39.0 entry says the opt-out worked "Electron 39 through 44 only"]
- Chromium's macOS version gates:
  - `IsMacCatapSystemLoopbackCaptureSupported()` requires macOS 14.2 or later;
  - `IsMacSckSystemLoopbackCaptureSupported()` is true only below macOS 15.0 ("Disabled on macOS 15.0 due to problems with permission prompt"), unless the `MacSckSystemAudioLoopbackOverride` feature is on;
  - `AudioManagerMac` builds a CATap stream when CATap is available and an SCK stream otherwise (`CreateSCKAudioInputStream`);
  - the SCK path logs "Missing screen capture permissions" when permission fails.
  — [Chromium media_switches.cc](https://github.com/chromium/chromium/blob/main/media/base/media_switches.cc); [audio_manager_mac.cc](https://github.com/chromium/chromium/blob/main/media/audio/mac/audio_manager_mac.cc); [audio_loopback_input_mac_impl.mm](https://github.com/chromium/chromium/blob/main/media/audio/mac/audio_loopback_input_mac_impl.mm) [Verified: version gates `MacOSVersion() >= 14'02'00` and `< 15'00'00` re-read in https://raw.githubusercontent.com/chromium/chromium/main/media/base/media_switches.cc; the SCK log line was not re-read]
- Chrome's own picker offers system audio for screen sharing on macOS only when CATap is supported (14.2+) — [Chromium desktop_media_picker_controller.cc](https://github.com/chromium/chromium/blob/main/chrome/browser/media/webrtc/desktop_media_picker_controller.cc)
- CATap details in Chromium:
  - the code is marked `API_AVAILABLE(macos(14.2))`;
  - "On macOS 14, CATap does not handle sample rate mismatches, making internal resampling necessary. This issue is resolved in macOS 15+";
  - calling `AudioDeviceCreateIOProcID()` "will trigger the macOS permission" prompt;
  - Chromium probes the tap permission and fails with `kFailedSystemPermissions` when it is missing.
  — [Chromium catap_audio_input_stream.mm](https://github.com/chromium/chromium/blob/main/media/audio/mac/catap_audio_input_stream.mm) [Verified: https://raw.githubusercontent.com/chromium/chromium/main/media/audio/mac/catap_audio_input_stream.mm]
- On macOS 12.7.6 and older, system audio capture does not work because it would need a signed kernel extension. "Only in macOS 13 and onwards does Apple provide APIs to capture desktop audio". Electron's suggested workaround is a virtual input device (BlackHole or Soundflower) read through `getUserMedia` — [Electron desktop-capturer.md](https://github.com/electron/electron/blob/main/docs/api/desktop-capturer.md) [Verified: same source. The case is moot for Tactilume: Electron 45 itself requires macOS 13 Ventura or later — https://raw.githubusercontent.com/electron/electron/v45.3.0/README.md]
- "Capturing the screen contents requires user consent on macOS 10.15 Catalina or higher". You can check it with `systemPreferences.getMediaAccessStatus('screen')` — [Electron desktop-capturer.md](https://github.com/electron/electron/blob/main/docs/api/desktop-capturer.md); [system-preferences.md](https://github.com/electron/electron/blob/main/docs/api/system-preferences.md)
- `useSystemPicker` (macOS 15+, experimental): when the system picker is available, the handler is not invoked. Per Electron's 47.0 breaking-changes entry (47 is still in development), the picker will follow `displaySurface` and include system audio unless the page opts out with `systemAudio: 'exclude'` (screens) or `windowAudio: 'exclude'` (windows). "Previously the stream was video only". Per-window audio "isn't supported", and the picker needs `NSAudioCaptureUsageDescription` — [Electron session.md](https://github.com/electron/electron/blob/main/docs/api/session.md); [breaking-changes.md (47.0)](https://github.com/electron/electron/blob/main/docs/breaking-changes.md)
- Apple's Core Audio taps documentation:
  - "ensure that you're using macOS 14.2 or later";
  - you must include `NSAudioCaptureUsageDescription`;
  - "The first time you start recording from an aggregate device that contains a tap, the system prompts you to grant the app system audio recording permission";
  - taps can target processes, mix down to mono or stereo, be public or private, and "mute the process output".
  — [Apple: Capturing system audio with Core Audio taps](https://developer.apple.com/documentation/coreaudio/capturing-system-audio-with-core-audio-taps) [Verified: https://developer.apple.com/documentation/coreaudio/capturing-system-audio-with-core-audio-taps]
- ScreenCaptureKit's `SCStreamConfiguration.capturesAudio` is available from macOS 13.0 and is off by default. Related properties include `excludesCurrentProcessAudio`, `sampleRate` and `channelCount` — [Apple: capturesAudio](https://developer.apple.com/documentation/screencapturekit/scstreamconfiguration/capturesaudio)
- Conflicting dates for the tap API: the AudioCap sample says "With macOS 14.4, Apple introduced new API in CoreAudio that allows any app to capture audio from other apps or the entire system", and that "There's no public API to request audio recording permission or to check if the app has that permission" (AudioCap optionally uses private TCC calls) — [AudioCap README](https://github.com/insidegui/AudioCap). This contradicts the 14.2 minimum given by [Apple](https://developer.apple.com/documentation/coreaudio/capturing-system-audio-with-core-audio-taps) and used by [Chromium](https://github.com/chromium/chromium/blob/main/media/base/media_switches.cc). Resolved: Apple's API reference lists `AudioHardwareCreateProcessTap` as introduced in macOS 14.2. AudioCap's "14.4" is wrong as an API minimum; 14.2 is the floor, as Chromium and Electron assume. [Verified correction: https://developer.apple.com/documentation/coreaudio/audiohardwarecreateprocesstap(_:_:)] The "no public API to request or check the permission" part is consistent with Electron's warning that a denied tap fails silently.
- projectMSDL attaches a global Core Audio tap to a private aggregate device on macOS 14.4+ (its stated minimum). On older macOS it falls back to SDL microphone capture — [frontend-sdl2 AudioCaptureImpl_macOS.h](https://github.com/projectM-visualizer/frontend-sdl2/blob/HEAD/src/AudioCaptureImpl_macOS.h); [AudioCaptureImpl_CoreAudioTap.h](https://github.com/projectM-visualizer/frontend-sdl2/blob/HEAD/src/AudioCaptureImpl_CoreAudioTap.h)
- OBS's macOS audio capture uses ScreenCaptureKit, marked `API_AVAILABLE(macos(13.0))` — [OBS mac-sck-audio-capture.m](https://github.com/obsproject/obs-studio/blob/HEAD/plugins/mac-capture/mac-sck-audio-capture.m)

**Linux**
- Chromium's `IsSystemLoopbackCaptureSupported()` returns `true` on Linux builds with PulseAudio — [Chromium media_switches.cc](https://github.com/chromium/chromium/blob/main/media/base/media_switches.cc)
- `AudioManagerPulse::MakeInputStream` sends any loopback device ID to a `PulseLoopbackManager`. `loopbackWithMute` sets "should_mute_system_audio" — [Chromium audio_manager_pulse.cc](https://github.com/chromium/chromium/blob/main/media/audio/pulse/audio_manager_pulse.cc)
- `PulseLoopbackManager` opens "the monitor device of the default sink" (`@DEFAULT_SINK@`). When the default sink changes, it switches "to the monitor of the new default sink" — [Chromium pulse_loopback_manager.cc](https://github.com/chromium/chromium/blob/main/media/audio/pulse/pulse_loopback_manager.cc) [Verified: https://raw.githubusercontent.com/chromium/chromium/main/media/audio/pulse/pulse_loopback_manager.cc]
- Chrome's own picker offers Linux system audio only when `PulseaudioLoopbackForScreenShare` is on [Verified: https://raw.githubusercontent.com/chromium/chromium/main/media/base/media_switches.cc]. It is `FEATURE_DISABLED_BY_DEFAULT` and appears in chrome://flags as "Linux System Audio Loopback for Screen Sharing (pulseaudio)" — [Chromium desktop_media_picker_controller.cc](https://github.com/chromium/chromium/blob/main/chrome/browser/media/webrtc/desktop_media_picker_controller.cc); [media_switches.cc](https://github.com/chromium/chromium/blob/main/media/base/media_switches.cc); [flag_descriptions.h](https://github.com/chromium/chromium/blob/main/chrome/browser/flag_descriptions.h)
- Electron's handler passes the `loopback` ID through with no Linux check ([electron_browser_context.cc](https://github.com/electron/electron/blob/main/shell/browser/electron_browser_context.cc)). But Electron's API docs list loopback support only for "Windows and … macOS 14.2 and later" ([session.md](https://github.com/electron/electron/blob/main/docs/api/session.md)).
- Chromium hides PulseAudio monitor sources from input-device enumeration ("Exclude output monitor (i.e. loopback) devices"). When the default source is itself a monitor, Chromium returns invalid parameters for the default device: "We don't want to accidentally open a monitor device" — [Chromium audio_manager_pulse.cc](https://github.com/chromium/chromium/blob/main/media/audio/pulse/audio_manager_pulse.cc)
- Choosing a screen or window on Linux:
  - On Linux with PipeWire, `getSources` returns a single source picked in the system picker, and on Wayland the picker appears on every call.
  - `persistMode: 'persistent'` with a stored `restoreToken` (Linux, experimental; needs xdg-desktop-portal ScreenCast version 4+) lets the app reuse that choice: "With a valid token nothing asks the user before capture starts".
  - Under X11 these options are ignored.
  — [Electron desktop-capturer.md](https://github.com/electron/electron/blob/main/docs/api/desktop-capturer.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/desktop-capturer.md]
- projectMSDL's SDL backend sets `SDL_HINT_AUDIO_INCLUDE_MONITORS` to "1" so that monitor sources are listed as capture devices — [frontend-sdl2 AudioCaptureImpl_SDL.cpp](https://github.com/projectM-visualizer/frontend-sdl2/blob/HEAD/src/AudioCaptureImpl_SDL.cpp)
- OBS on Linux captures audio through a PulseAudio input plugin that handles monitor sources. Its PipeWire plugin holds the screencast and camera portal sources — [OBS linux-pulseaudio pulse-input.c](https://github.com/obsproject/obs-studio/blob/HEAD/plugins/linux-pulseaudio/pulse-input.c); [OBS linux-pipewire](https://github.com/obsproject/obs-studio/tree/HEAD/plugins/linux-pipewire)
- Discord on Linux: venmic ("screenshare support for pipewire") "is not intended for standalone usage. You need a modified discord client" (Vesktop) — [venmic README](https://github.com/Vencord/venmic)

### Inferences
- **Recommended path (all OSes):**
  1. A UI button runs `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })`.
  2. The main-process handler answers `{ video: <source>, audio: 'loopback' }`.
  3. The renderer stops and removes the video track and feeds the audio track into `AudioContext.createMediaStreamSource`.
  4. Use `thumbnailSize: {width: 0, height: 0}` when listing sources.
  5. Never use `loopbackWithMute`: it silences the user's speakers.
- **Worth testing first:** grant `video: request.frame` (the app's own `WebFrameMain`) instead of a screen source. If Chromium accepts it, this could avoid the macOS Screen Recording prompt and the Wayland portal picker, because only the audio would come from the OS. The docs allow a `WebFrameMain` for `video` and mark `video` optional, but nothing documents the prompt behaviour.
- **What the user does on each OS:**
  - **Windows 10/11:** clicks the app's own "Listen to this computer" button. The handler can grant without a picker, and no OS privacy prompt for loopback is documented.
  - **macOS 14.2+:** clicks the button, then answers a one-time System Audio Recording prompt. If a screen source is used for the dummy video, Screen Recording consent is also needed.
  - **macOS 13.0–14.1:** Chromium's ScreenCaptureKit fallback suggests loopback may work with Screen Recording permission. Electron doesn't document this, so treat it as best effort.
  - ~~**macOS 12 and older:** a virtual device (BlackHole) through the microphone path.~~ Not applicable: Electron 45 does not run below macOS 13 Ventura, so the supported macOS range is 13.0–14.1 (SCK, best effort) and 14.2+ (CATap). A virtual device such as BlackHole remains a manual fallback for any macOS version. [Verified correction: https://raw.githubusercontent.com/electron/electron/v45.3.0/README.md]
  - **Linux/Wayland:** the portal picker appears each time unless a restore token is stored.
- **macOS onboarding:** check `track.readyState === 'ended'` right after `getDisplayMedia` resolves. Also watch for zero RMS over the first second. Either one is the only signal that the permission is missing, so show instructions to enable the permission in System Settings. Ship the app signed, with the Info.plist key. In development, grant the permission to the terminal or IDE.
- **Linux fallbacks:**
  - If `loopback` fails or captures the wrong sink, tell the user to reroute the app's recording stream to "Monitor of …" in pavucontrol. This works server-side because Chromium itself refuses monitors as the default input.
  - Alternatively, have the main process capture with a native helper, such as a PipeWire or PulseAudio addon or a spawned `pw-record`/`parec`, and stream the PCM to the renderer through a MessagePort.
- **How other apps do it:**
  - OBS and projectMSDL use native APIs per OS: WASAPI loopback on Windows, ScreenCaptureKit or Core Audio taps on macOS, PulseAudio monitors on Linux.
  - A native Node addon on that pattern is the main alternative to Chromium loopback. It adds build and signing work per OS, so keep it in reserve for Linux or for per-application capture.

### Gaps
- How Wallpaper Engine, NestDrop and Plane9 capture audio: their sites were blocked and the apps are closed source. Not verified.
- How the official Discord client captures audio on Windows and macOS: not verified.
- Whether Electron 45's `loopback` works on current PipeWire distributions through pipewire-pulse: the code path exists (Chromium's PulseAudio loopback), but nothing was tested and there is no Electron documentation.
- Whether Windows ever shows a privacy prompt for loopback capture: no source found (Microsoft Learn was blocked).
- The exact current System Settings wording on macOS ("Screen & System Audio Recording" and any "System Audio Recording Only" subsection): Electron's docs name the "System Audio Recording" permission and the "Screen & System Audio Recording" path. The subsection name was not verified.
- Whether `getDisplayMedia` in Electron needs a user gesture: the handler receives `request.userGesture`, but the requirement was not verified.

## 2. Microphone and line-in

### Takeaway
Use `getUserMedia` with a chosen `deviceId` and echo cancellation, noise suppression and auto gain control all off. Request stereo and 48 kHz as `ideal` values and confirm them with `track.getSettings()`.
- **Electron:** grant the `media` permission (camera and microphone only, as of Electron 45).
- **macOS:** the app needs `NSMicrophoneUsageDescription`, the hardened-runtime Audio Input entitlement and a consent prompt (`systemPreferences.askForMediaAccess('microphone')`).
- **Windows:** consent follows the OS privacy settings, which `getMediaAccessStatus` reports.

### Cited Findings
- Constraint types:
  - `echoCancellation` is a `ConstrainBooleanOrDOMString`;
  - `autoGainControl` and `noiseSuppression` are `ConstrainBoolean`;
  - `sampleRate` and `channelCount` are `ConstrainULong`;
  - `latency` is a `ConstrainDouble`;
  - support can be checked with `MediaDevices.getSupportedConstraints()`.
  — [MDN echoCancellation](https://github.com/mdn/content/blob/main/files/en-us/web/api/mediatrackconstraints/echocancellation/index.md); [autoGainControl](https://github.com/mdn/content/blob/main/files/en-us/web/api/mediatrackconstraints/autogaincontrol/index.md); [noiseSuppression](https://github.com/mdn/content/blob/main/files/en-us/web/api/mediatrackconstraints/noisesuppression/index.md); [sampleRate](https://github.com/mdn/content/blob/main/files/en-us/web/api/mediatrackconstraints/samplerate/index.md); [channelCount](https://github.com/mdn/content/blob/main/files/en-us/web/api/mediatrackconstraints/channelcount/index.md); [latency](https://github.com/mdn/content/blob/main/files/en-us/web/api/mediatrackconstraints/latency/index.md)
- Chromium's macOS and Windows "EnforceSystemEchoCancellation" feature has parameters for running WebRTC noise suppression and auto gain control "in tandem" with the OS canceller. A source comment notes that "system NS will still be on due to system echo cancellation running" — [Chromium media_switches.cc](https://github.com/chromium/chromium/blob/main/media/base/media_switches.cc)
- Electron's `media` permission covers "media devices such as camera, microphone and speakers. Screen, window and tab capture is reported as display-capture instead". `details.mediaTypes` lists which devices were requested — [Electron session.md](https://github.com/electron/electron/blob/main/docs/api/session.md); [breaking-changes.md (45.0)](https://github.com/electron/electron/blob/main/docs/breaking-changes.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/session.md]
- `systemPreferences.askForMediaAccess('microphone')` is macOS only and returns a `Promise<boolean>`. You "must set the NSMicrophoneUsageDescription" string. `getMediaAccessStatus('microphone' | 'camera' | 'screen')` works on Windows and macOS and returns `not-determined`, `granted`, `denied`, `restricted` or `unknown`. macOS 10.14+ requires consent for the microphone — [Electron system-preferences.md](https://github.com/electron/electron/blob/main/docs/api/system-preferences.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/system-preferences.md]
- The hardened-runtime entitlement `com.apple.security.device.audio-input` "indicates whether the app may record audio using the built-in microphone and access audio input using Core Audio". It is enabled under Hardened Runtime → Resource Access → Audio Input — [Apple: audio-input entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.device.audio-input) [Verified: https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.device.audio-input. It is also in `@electron/osx-sign`'s default entitlements (https://raw.githubusercontent.com/electron/osx-sign/main/entitlements/default.darwin.plist), so it must not be trimmed away; desktop_app_shell.md has been corrected to match.]
- On Linux, Chromium's PulseAudio input uses a default buffer of `kDefaultInputBufferSize = 1024` frames unless the user sets a buffer size, and it excludes monitor sources from enumeration — [Chromium audio_manager_pulse.cc](https://github.com/chromium/chromium/blob/main/media/audio/pulse/audio_manager_pulse.cc) [Verified: https://raw.githubusercontent.com/chromium/chromium/main/media/audio/pulse/audio_manager_pulse.cc]
- On Windows, Chromium creates `IAudioClient3` objects and calls `GetSharedModeEnginePeriod`, the API for low-latency shared-mode periods — [Chromium core_audio_util_win.cc](https://github.com/chromium/chromium/blob/main/media/audio/win/core_audio_util_win.cc)

### Inferences
- **Constraints to request:**
  ```js
  {
    audio: {
      deviceId: { exact: id },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 2 },
      sampleRate: { ideal: 48000 }
    }
  }
  ```
  Then read `track.getSettings()`. If `echoCancellation` comes back `true`, or `channelCount` comes back 1, warn the user that the OS or browser is processing the input. Speech processing pumps gain and gates quiet passages, which ruins music dynamics.
- **Device picker:** fill it from `enumerateDevices()` after the first permission grant. Remember the `deviceId` per machine.
- **Linux:** monitor sources never appear as microphones in Chromium, so the "use the monitor as a mic" trick is not available from the web layer.
- **Electron permissions:** in `setPermissionRequestHandler`, grant `media` only when `details.mediaTypes` includes `audio` and the request comes from the app's own origin. Also grant `display-capture` for the loopback path (Electron 45+).
- **Latency:** Chromium's default PulseAudio input buffer of 1024 frames is about 21 ms at 48 kHz. Windows and macOS shared-mode periods are typically shorter. Treat live input as roughly 10–25 ms of capture latency, before any analysis window.

### Gaps
- The Windows privacy settings path and behaviour for desktop (non-Store) apps ("Let desktop apps access your microphone"): Microsoft Learn was blocked, so this is not verified.
- Whether Chromium keeps two channels from a stereo line-in when processing is off: not verified in Blink's constraint code, which was not checked out.
- ASIO or exclusive-mode WASAPI from Chromium: not researched. It is presumably unavailable without a native addon.

## 3. Local music files

### Takeaway
Electron is built with proprietary codecs, so MP3, AAC (MP4/M4A), FLAC, Opus/Vorbis and WAV are all practical inputs.
- **Playback:** stream through `<audio>` + `MediaElementAudioSourceNode` so memory stays low.
- **Analysis:** decode with `decodeAudioData` (or in a Worker) to precompute a beat grid and feature curves ahead of playback.
- **Drag and drop:** use `webUtils.getPathForFile()`; `File.path` was removed in Electron 32.
- **Streaming services (Spotify, Apple Music):** they play through their own apps, so only system loopback can hear them.

### Cited Findings
- Electron's common build arguments set `proprietary_codecs = true` and `ffmpeg_branding = "Chrome"`. A separate `ffmpeg.gn` builds a variant with `proprietary_codecs = false` — [Electron build/args/all.gn](https://github.com/electron/electron/blob/main/build/args/all.gn); [build/args/ffmpeg.gn](https://github.com/electron/electron/blob/main/build/args/ffmpeg.gn) [Verified: https://raw.githubusercontent.com/electron/electron/main/build/args/all.gn; ffmpeg.gn not re-read]
- MDN says "AAC is not available in Chromium builds", which are the open-source builds without proprietary codecs. MDN's FLAC support table shows "Yes" for Chrome. MDN calls Opus "a good all-around audio codec for use in your web applications" — [MDN audio codecs guide](https://github.com/mdn/content/blob/main/files/en-us/web/media/guides/formats/audio_codecs/index.md) [Verified: https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/media/guides/formats/audio_codecs/index.md]
- `decodeAudioData` resamples the decoded `AudioBuffer` to the AudioContext's sample rate — [MDN decodeAudioData](https://github.com/mdn/content/blob/main/files/en-us/web/api/baseaudiocontext/decodeaudiodata/index.md)
- "Removed: File.path" (Electron 32.0). Use `webUtils.getPathForFile(file)` instead, and "It's best not to expose the full file path to the web content if possible" — [Electron breaking-changes.md (32.0)](https://github.com/electron/electron/blob/main/docs/breaking-changes.md); [web-utils.md](https://github.com/electron/electron/blob/main/docs/api/web-utils.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/breaking-changes.md; https://raw.githubusercontent.com/electron/electron/main/docs/api/web-utils.md]
- realtime-bpm-analyzer 5.6.1 (2026-11-03) analyses "files, streams, microphone, or any audio/video node". It has a full-buffer analysis mode, and `realtime-bpm-analyzer/node` "returns the same candidates as analyzeFullBuffer for the same samples" — [realtime-bpm-analyzer readme](https://github.com/dlepaux/realtime-bpm-analyzer/blob/HEAD/readme.md); [npm](https://registry.npmjs.org/realtime-bpm-analyzer)
- web-audio-beat-detector's `analyze()` "expects an AudioBuffer" and resolves with the tempo. It also exports `guess()`. It is based on Joe Sullivan's beat-detection article — [web-audio-beat-detector README](https://github.com/chrisguttandin/web-audio-beat-detector)
- The File System Access `showOpenFilePicker` is available from Chrome 86 (marked experimental) — [@mdn/browser-compat-data 8.1.8](https://registry.npmjs.org/@mdn/browser-compat-data)

### Inferences
- **Memory cost:** a 5-minute stereo track decoded to float32 at 48 kHz takes about 115 MB (300 s × 48,000 × 2 × 4 bytes). So decode only for the offline analysis pass, or analyse in chunks. Play through a media element: `createMediaElementSource(audioEl)` → analyser/worklet → destination.
- **Look-ahead:** because the whole file is available, Tactilume can run offline beat and downbeat tracking (dynamic programming, see section 4) and section and drop detection before playback starts. At playback time it then schedules visual events against the audio clock (section 6). This is the main quality advantage of files over live input.
- **Drag and drop:** read dropped files in the preload script with `webUtils.getPathForFile`. Sort by extension: `.mp3 .m4a .aac .flac .ogg .opus .wav .webm`. Keep the playlist (M3U or a JSON order) in the main process.
- **Streaming services:** Spotify and Apple Music play inside their own native apps and protect their streams, so loopback is the only general way to visualise them. This is not verified against those services' terms.

### Gaps
- ALAC (Apple Lossless in .m4a) decoding in Chromium/Electron: not verified.
- Spotify and Apple Music developer-policy status in 2026, such as whether any track-analysis or tempo API remains: not verified (sites blocked).
- Whether `decodeAudioData` handles very long FLAC files efficiently: not benchmarked.

## 4. Analysis for visuals: features, onsets, beats and where they run

### Takeaway
Everything visuals need can run on the CPU inside an AudioWorklet, or a Worker fed by it, at well under 1 ms per hop:
- an FFT of 1024–4096 points;
- log-spaced bands with per-band attack/release envelopes;
- RMS and loudness;
- spectral centroid, rolloff and flatness;
- onset strength from spectral flux.

A causal beat tracker (BTrack-style, which predicts the next beat from the onset curve) suits live input. The more accurate offline trackers, Ellis-style dynamic programming and madmom/BeatNet neural networks, suit files analysed ahead of playback. The GPU is not worth it for FFTs this small, but it is a good place for spectrogram history textures.

### Cited Findings
- AnalyserNode basics:
  - `fftSize` "Must be a power of 2 between 2^5 and 2^15" (32 to 32768);
  - `smoothingTimeConstant` defaults to 0.8;
  - the node applies a Blackman window, then smooths over time.
  — [MDN fftSize](https://github.com/mdn/content/blob/main/files/en-us/web/api/analysernode/fftsize/index.md); [MDN smoothingTimeConstant](https://github.com/mdn/content/blob/main/files/en-us/web/api/analysernode/smoothingtimeconstant/index.md) [Verified: https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/analysernode/fftsize/index.md; https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/analysernode/smoothingtimeconstant/index.md]
- In the spec, "smoothing over time" blends with the "previous block", defined as "the buffer computed by the previous smoothing over time operation" — [Web Audio API spec index.bs](https://github.com/WebAudio/web-audio-api/blob/HEAD/index.bs)
- AudioWorklet `process()` receives blocks that are "always 128 frames long" — [MDN AudioWorkletProcessor.process](https://github.com/mdn/content/blob/main/files/en-us/web/api/audioworkletprocessor/process/index.md) [Verified: https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/audioworkletprocessor/process/index.md — MDN's wording is "Currently, audio data blocks are always 128 frames", i.e. unless `renderSizeHint` changes it]
- `renderSizeHint` sets the render quantum size:
  - `"default"` means 128 frames;
  - `"hardware"` means "The User-Agent picks a render quantum size that is best for the current configuration";
  - a number is also accepted (MDN: an integer from 1 to 6 × the sample rate).
  It shipped in Chrome 153 (experimental), together with `BaseAudioContext.renderQuantumSize` — [Web Audio spec](https://github.com/WebAudio/web-audio-api/blob/HEAD/index.bs); [MDN AudioContext()](https://github.com/mdn/content/blob/main/files/en-us/web/api/audiocontext/audiocontext/index.md); [@mdn/browser-compat-data 8.1.8](https://registry.npmjs.org/@mdn/browser-compat-data) [Verified: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/AudioContext.json; https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/BaseAudioContext.json. In Chromium 156 (Electron 45) the backing runtime feature `WebAudioConfigurableRenderQuantum` has `status: "stable"`, i.e. on by default — https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/third_party/blink/renderer/platform/runtime_enabled_features.json5. MDN adds that with `"hardware"`, `renderQuantumSize` reads 0 until the context is running.]
- projectM (MilkDrop-compatible) audio features:
  - it keeps 512 spectrum samples and 576 waveform samples;
  - its bass, middles and treble bands are the first, second and third sixths of the spectrum: "Only the first half of the spectrum is used for these bands, each using one third of this half";
  - band loudness is "relative to the previous frame(s)" and "will revolve around 1.0, with <0.7 being very silent and >1.3 very loud audio";
  - `bass_att`, `mid_att` and `treb_att` are the attenuated averages;
  - `vol` is the mean of bass, mid and treb;
  - each update takes `secondsSinceLastFrame`.
  — [projectM Loudness.hpp](https://github.com/projectM-visualizer/projectm/blob/HEAD/src/libprojectM/Audio/Loudness.hpp); [AudioConstants.hpp](https://github.com/projectM-visualizer/projectm/blob/HEAD/src/libprojectM/Audio/AudioConstants.hpp); [PCM.cpp](https://github.com/projectM-visualizer/projectm/blob/HEAD/src/libprojectM/Audio/PCM.cpp) [Verified: https://raw.githubusercontent.com/projectM-visualizer/projectm/HEAD/src/libprojectM/Audio/Loudness.hpp; sample counts in AudioConstants.hpp not re-read]
- Meyda's feature extractors: chroma, energy, loudness, melBands, mfcc, perceptualSharpness, perceptualSpread, powerSpectrum, rms, spectralCentroid, spectralCrest, spectralFlatness, spectralFlux, spectralKurtosis, spectralRolloff, spectralSkewness, spectralSlope, spectralSpread and zcr. Meyda "supports both offline feature extraction as well as real-time feature extraction using the Web Audio API" — [Meyda src/extractors](https://github.com/meyda/meyda/tree/HEAD/src/extractors); [Meyda README](https://github.com/meyda/meyda)
- aubio's onset methods are `energy`, `hfc` (the default), `complex`, `phase`, `wphase`, `specdiff`, `kl`, `mkl` and `specflux` — [aubio src/onset/onset.c](https://github.com/aubio/aubio/blob/HEAD/src/onset/onset.c). Its beat tracking uses "a context dependant model" from Davies & Plumbley ("Causal tempo tracking of audio") — [aubio src/tempo/beattracking.h](https://github.com/aubio/aubio/blob/HEAD/src/tempo/beattracking.h)
- Essentia.js exposes, among others:
  - onset and beat: `OnsetDetection`, `SuperFluxExtractor`, `BeatTrackerMultiFeature`, `BeatTrackerDegara`, `RhythmExtractor2013`, `PercivalBpmEstimator`;
  - loudness: `LoudnessEBUR128` (default `hopSize` 0.1 s);
  - harmony: `HPCP` (chroma), `KeyExtractor`.
  The repo ships real-time AudioWorklet demos (`melspectrogram-rt`, `pitchmelodia-rt`) — [Essentia.js core_api.ts](https://github.com/MTG/essentia.js/blob/HEAD/src/typescript/core_api.ts); [examples](https://github.com/MTG/essentia.js/tree/HEAD/examples)
- BTrack "is a causal beat tracking algorithm intended for real-time use". It is described in Stark, Davies & Plumbley, "Real-Time Beat-Synchronous Analysis of Musical Audio" (DAFx-09) and Stark's 2011 PhD thesis. Its onset function is the complex spectral difference, fixed in 1.0.3. The latest version is 1.0.7 (2025-12-31) — [BTrack README](https://github.com/adamstark/BTrack) [Verified: https://raw.githubusercontent.com/adamstark/BTrack/HEAD/README.md]
- BeatNet combines a CRNN with "two-stage cascade particle filtering" for "joint music beat, downbeat, tempo, and meter tracking" (ISMIR 2021). It has streaming (microphone), real-time, online (same causal algorithm, run faster) and offline modes. It expects 22,050 Hz input and works at 50 frames per second ("8 seconds at 50fps") — [BeatNet README](https://github.com/mjhydri/BeatNet)
- madmom programs can "operate on live audio" in `online` mode (for example `DBNBeatTracker online`). The README cites Böck et al.:
  - "Online Real-time Onset Detection with Recurrent Neural Networks" (DAFx 2012);
  - "Evaluating the Online Capabilities of Onset Detection Methods" (ISMIR 2012);
  - "Maximum Filter Vibrato Suppression for Onset Detection" (SuperFlux, DAFx 2013);
  - "Accurate Tempo Estimation based on Recurrent Neural Networks and Resonating Comb Filters" (ISMIR 2015);
  - "An Efficient State Space Model for Joint Tempo and Meter Tracking" (ISMIR 2015);
  - "Joint Beat and Downbeat Tracking with Recurrent Neural Networks" (ISMIR 2016).
  — [madmom README](https://github.com/CPJKU/madmom) [Unverified: README downloaded, paper list not re-read]
- librosa's `beat_track` is a "Dynamic programming beat tracker" citing Ellis, "Beat tracking by dynamic programming". Its HPSS is "Median-filtering harmonic percussive source separation" citing Fitzgerald — [librosa beat.py](https://github.com/librosa/librosa/blob/HEAD/librosa/beat.py); [decompose.py](https://github.com/librosa/librosa/blob/HEAD/librosa/decompose.py)

### Inferences
- **Recommended live pipeline, all inside one AudioWorklet (or a Worker fed by a SharedArrayBuffer ring):**
  1. Mix to mono for spectral features and keep L/R for stereo features.
  2. Use a 2048-point FFT (about 43 ms at 48 kHz) with a Hann window and a hop of 256–512 samples (5.3–10.7 ms, about 94–188 analysis frames per second).
  3. Group bins into 24–32 log-spaced bands (third-octave from about 40 Hz to 16 kHz), or 40 mel or 24 Bark bands, from fft.js or a small WASM FFT.
  4. Give each band an envelope with fast attack (about 5–15 ms) and slower release (about 80–300 ms), and normalise each band against its own long-term average, like projectM's "relative to previous frames, ~1.0 = normal" scheme. That gives quiet and loud tracks similar visual energy.
  5. Compute log-compressed spectral flux per band group: kick from 30–120 Hz, snare/clap from 150 Hz–2 kHz plus broadband, hats from 6 kHz and up. Detect onsets with an adaptive threshold (moving median plus k × MAD) and a minimum gap of about 50–80 ms.
  6. Estimate tempo by autocorrelation or a comb-filter bank over the onset-strength curve (about 6–8 s window). Track beats causally, predicting the next beat from period and phase, as BTrack and aubio do.
  7. Downbeats and bars are weak in causal trackers. Offer tap-to-set-downbeat, or use MIDI clock or Song Position Pointer when available (section 8).
- **Cost:** a 2048-point real FFT plus 32 band sums, centroid, rolloff, flatness and flux comes to roughly tens of microseconds per hop in optimised JS or WASM, a tiny load. A WebGPU FFT would add dispatch and readback latency of milliseconds per frame for no gain at these sizes. Use the GPU for history textures: upload band arrays each frame into a ring texture for spectrogram-style visuals.
- **Other features:**
  - *Chroma, key and harmony:* 12-bin chroma (Meyda chroma, or Essentia HPCP) smoothed over 1–2 s can drive hue. Key detection (Essentia `KeyExtractor`) is only reliable over many seconds, so use it for slow palette drift, not reactions.
  - *Stereo width and panning:* per-band mid/side energy ratio, L/R correlation and L/R energy balance. This needs a stereo source; loopback normally provides one.
  - *Harmonic/percussive separation:* median-filter HPSS needs future frames along time (half the time-kernel). Run it in the file look-ahead path, or approximate it live with a "percussive = flux, harmonic = smoothed spectrum" split.
  - *Builds and drops (heuristic):* rising energy and spectral centroid over 4–16 bars, falling low-band energy (filter sweeps), a rising onset rate (snare rolls), then a sudden return of sub-bass energy with broadband flux is a "drop". Do this in the file look-ahead path; live, accept a lag of a beat or two.
- **Loudness:** RMS in dBFS per hop is enough for live drive. For calibrated loudness, Essentia's `LoudnessEBUR128` is available but AGPL (section 5), and a BS.1770 K-weighting filter plus 400 ms and 3 s windows is straightforward to write yourself (window lengths from EBU R128, not verified in this session).

### Gaps
- Published latency and accuracy figures for BTrack, BeatNet and madmom's online trackers, and for IBT or multi-agent trackers such as BeatRoot: the papers were not reachable, so no figures are given.
- WebGPU FFT libraries and benchmarks: none were found or verified.
- Mel, Bark and third-octave band-edge formulas and EBU R128 window definitions: from domain knowledge, not verified against standards this session.

## 5. Libraries and licences

### Takeaway
For a distributable, possibly closed-source app:
- **Permissive (fine to bundle):** Meyda (MIT), fft.js (MIT), realtime-bpm-analyzer (Apache-2.0), web-audio-beat-detector (MIT), Tone.js (MIT), aubiojs's wrapper code (MIT), node-osc (Apache-2.0), osc.js (MIT or GPL-2.0, your choice).
- **Copyleft (avoid unless Tactilume is released under a compatible licence or a commercial licence is bought):** Essentia.js (AGPL-3.0), aubio (GPL-3.0+), BTrack (GPLv3), Ableton Link (GPLv2+ or proprietary).
- **Not for commercial use by default:** madmom's trained models (CC BY-NC-SA 4.0).

The likely plan is to write the core DSP in house and borrow only permissive code.

### Cited Findings
- **Meyda** 5.6.3 (published 2024-04-21), MIT. The repository's last commit is also dated 2024-04-21 — [npm meyda](https://registry.npmjs.org/meyda); [Meyda LICENSE.md](https://github.com/meyda/meyda/blob/HEAD/LICENSE.md) [Verified: https://registry.npmjs.org/meyda; https://raw.githubusercontent.com/meyda/meyda/HEAD/LICENSE.md; last-commit date not re-read]
- **Essentia.js** 0.1.3 on npm (published 2021-06-24), AGPL-3.0. The repository's last commit is 2022-07-19. The README links Essentia's licensing page — [npm essentia.js](https://registry.npmjs.org/essentia.js); [Essentia.js LICENSE](https://github.com/MTG/essentia.js/blob/HEAD/LICENSE); [Essentia.js README](https://github.com/MTG/essentia.js) [Verified: https://registry.npmjs.org/essentia.js; https://raw.githubusercontent.com/MTG/essentia.js/HEAD/LICENSE (GNU AGPL v3)]
- **aubio** is under the GNU GPL "version 3 of the License, or (at your option) any later version". Its last commit is 2026-04-10 — [aubio README](https://github.com/aubio/aubio); [COPYING](https://github.com/aubio/aubio/blob/HEAD/COPYING) [Verified: https://raw.githubusercontent.com/aubio/aubio/HEAD/README.md; https://raw.githubusercontent.com/aubio/aubio/HEAD/COPYING; last-commit date not re-read]
- **aubiojs** 0.2.1 (2022-11-08): the npm `license` field is empty, and the repo's `license` file is an MIT-style permission notice ("Copyright (c) 2021 7c00"). It wraps aubio, which is GPL-3.0+, and provides pitch and tempo detection — [npm aubiojs](https://registry.npmjs.org/aubiojs); [aubiojs license](https://github.com/qiuxiang/aubiojs/blob/HEAD/license); [aubiojs readme](https://github.com/qiuxiang/aubiojs) [Verified: https://registry.npmjs.org/aubiojs; https://raw.githubusercontent.com/qiuxiang/aubiojs/HEAD/license]
- **BTrack** is licensed under GPLv3; version 1.0.7 dates from 2025-12-31 — [BTrack README](https://github.com/adamstark/BTrack) [Verified: https://raw.githubusercontent.com/adamstark/BTrack/HEAD/README.md — the README's licence text says "version 3 of the License, or (at your option) any later version"]
- **realtime-bpm-analyzer** 5.6.1 (2026-11-03), Apache-2.0. Its worklet loads from a `blob:` URL by default; a `processorUrl` option exists for strict Content Security Policies — [npm realtime-bpm-analyzer](https://registry.npmjs.org/realtime-bpm-analyzer); [readme](https://github.com/dlepaux/realtime-bpm-analyzer/blob/HEAD/readme.md) [Verified: https://registry.npmjs.org/realtime-bpm-analyzer; https://raw.githubusercontent.com/dlepaux/realtime-bpm-analyzer/HEAD/readme.md]
- **web-audio-beat-detector** 8.2.39 (2026-08-26), MIT — [npm](https://registry.npmjs.org/web-audio-beat-detector) [Verified: https://registry.npmjs.org/web-audio-beat-detector]
- **Tone.js**: latest is 15.1.22, with 15.5.66 on the `next` tag; MIT. Its analysis components are Analyser, DCMeter, FFT, Follower, Meter and Waveform — [npm tone](https://registry.npmjs.org/tone); [Tone.js component/analysis](https://github.com/Tonejs/Tone.js/tree/HEAD/Tone/component/analysis) [Verified: https://registry.npmjs.org/tone — `latest` 15.1.22 dates from 2025-04-27; `next` 15.5.66 from 2026-10-31]
- **madmom**: "all source code files are published under the BSD license", but "all model and data files are distributed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0" licence. Commercial use of the models requires contacting Gerhard Widmer — [madmom README](https://github.com/CPJKU/madmom) [Verified: https://raw.githubusercontent.com/CPJKU/madmom/HEAD/LICENSE]
- **BeatNet**: the LICENSE file is Creative Commons Attribution 4.0 International; it is a Python library — [BeatNet LICENSE](https://github.com/mjhydri/BeatNet/blob/HEAD/LICENSE); [README](https://github.com/mjhydri/BeatNet) [Verified: https://raw.githubusercontent.com/mjhydri/BeatNet/HEAD/LICENSE]
- **librosa**: ISC licence — [librosa LICENSE.md](https://github.com/librosa/librosa/blob/HEAD/LICENSE.md) [Verified: https://raw.githubusercontent.com/librosa/librosa/HEAD/LICENSE.md]
- **fft.js** 4.0.4, MIT — [npm fft.js](https://registry.npmjs.org/fft.js) [Verified: https://registry.npmjs.org/fft.js]
- **osc.js (npm `osc`)** 2.4.5, "(MIT OR GPL-2.0)". **node-osc** 11.7.1 (2026-09-14), Apache-2.0 — [npm osc](https://registry.npmjs.org/osc); [npm node-osc](https://registry.npmjs.org/node-osc) [Verified: https://registry.npmjs.org/osc; https://registry.npmjs.org/node-osc]
- **Ableton Link**: GPL "version 2 of the License, or (at your option) any later version". "If you would like to incorporate Link into a proprietary software application, please contact link-devs@ableton.com" — [Ableton Link LICENSE.md](https://github.com/Ableton/link/blob/HEAD/LICENSE.md) [Verified: https://raw.githubusercontent.com/Ableton/link/HEAD/LICENSE.md]

### Inferences
- **Copyleft obligations:**
  - Bundling AGPL-3.0 (Essentia.js) or GPL-3.0 (aubio WASM, BTrack) code in a distributed Electron app generally makes the whole app a covered work: complete source must be offered under the same licence.
  - AGPL adds a network-interaction clause, which matters little for an offline desktop toy.
  - If Tactilume is closed source or sold through stores, buy commercial licences (Essentia's licensing page; Ableton for Link) or reimplement the algorithms from the papers. Algorithms are not copyrighted, code is.
  - This is not legal advice; confirm with counsel.
- **aubiojs:** the MIT notice covers the wrapper, but the compiled aubio inside is GPL-3.0+. Treat aubiojs as GPL.
- **Maintenance:** Meyda (no commits since April 2024) and Essentia.js (no npm release since 2021) are effectively dormant. realtime-bpm-analyzer, web-audio-beat-detector and Tone.js are active in 2026. An in-house feature extractor of a few hundred lines (FFT, bands, flux, centroid, rolloff, flatness, RMS, chroma) avoids both dependency risk and licence risk.
- **Python libraries:** madmom, BeatNet and librosa need a Python runtime. Use them only as offline references or for training. Porting a small CNN/CRNN beat model to ONNX or WebGPU is possible, but madmom's models are non-commercial; BeatNet's CC BY 4.0 permits commercial use with attribution.

### Gaps
- Essentia's commercial licence terms and prices: the licensing page (essentia.upf.edu) was not reachable.
- Whether any WebAssembly build of BTrack or of madmom-style online trackers exists on npm: not searched (search budget exhausted).

## 6. Latency and sync

### Takeaway
Treat live input as about 30–60 ms "late" by the time features are ready:
- capture buffer, about 10–21 ms;
- render quantum, 2.7 ms;
- FFT window centre, about 21 ms for a 2048-point window;
- frame presentation, 2–17 ms.

For live input, hide that delay with prediction: beat phase extrapolation, plus a fast transient path from a short window. For files, use true look-ahead: analyse ahead of the playhead and fire each visual when its audio reaches the speakers, measured with `outputLatency` and `getOutputTimestamp`. Compute audio features at a fixed audio-driven rate and make every visual smoother depend on elapsed time `dt`, so 60–480 Hz displays behave the same.

### Cited Findings
- `baseLatency` is "the number of seconds of processing latency incurred by the AudioContext passing an audio buffer from the AudioDestinationNode … into the host system's audio subsystem" — [MDN baseLatency](https://github.com/mdn/content/blob/main/files/en-us/web/api/audiocontext/baselatency/index.md)
- `outputLatency` is the "estimation of the output latency", meaning the time "between the browser passing an audio buffer out of an audio graph over to the host system's audio subsystem to play, and the time at which the first sample in the buffer is actually processed by the audio output device" — [MDN outputLatency](https://github.com/mdn/content/blob/main/files/en-us/web/api/audiocontext/outputlatency/index.md)
- `getOutputTimestamp()` returns `contextTime` (the output stream position) and a matching `performanceTime` — [MDN getOutputTimestamp](https://github.com/mdn/content/blob/main/files/en-us/web/api/audiocontext/getoutputtimestamp/index.md)
- `AudioContext.playbackStats` returns an `AudioPlaybackStats` object "providing access to duration, underrun, and latency statistics", including "average, minimum, and maximum latency" — [MDN playbackStats](https://github.com/mdn/content/blob/main/files/en-us/web/api/audiocontext/playbackstats/index.md)
- Chrome support:
  - `baseLatency` from Chrome 58;
  - `outputLatency` from Chrome 102 (also Firefox 70, Safari 18.4);
  - `getOutputTimestamp` from Chrome 57;
  - `playbackStats` from Chrome 146 (experimental);
  - `renderSizeHint` and `renderQuantumSize` from Chrome 153 (experimental);
  - `latencyHint` from Chrome 58.
  — [@mdn/browser-compat-data 8.1.8](https://registry.npmjs.org/@mdn/browser-compat-data) [Verified: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/AudioContext.json; https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/BaseAudioContext.json; BCD 8.1.8 published 2026-11-02 per https://registry.npmjs.org/@mdn/browser-compat-data. Both `playbackStats` and the render-quantum feature are `status: "stable"` (on by default) in Chromium 156.]
- "If omitted, latencyHint defaults to interactive" — [MDN AudioContext()](https://github.com/mdn/content/blob/main/files/en-us/web/api/audiocontext/audiocontext/index.md)
- Electron 45 ships Chromium 156 — [Electron 45-x-y DEPS](https://github.com/electron/electron/blob/45-x-y/DEPS)
- Platform capture details:
  - Chromium's PulseAudio input defaults to 1024-frame buffers — [Chromium audio_manager_pulse.cc](https://github.com/chromium/chromium/blob/main/media/audio/pulse/audio_manager_pulse.cc);
  - on macOS, Chromium raises the minimum buffer size by multiples above 48 kHz and 96 kHz to avoid glitches — [audio_manager_mac.cc](https://github.com/chromium/chromium/blob/main/media/audio/mac/audio_manager_mac.cc);
  - on macOS 14, CATap needs internal resampling when sample rates differ ("resolved in macOS 15+") — [catap_audio_input_stream.mm](https://github.com/chromium/chromium/blob/main/media/audio/mac/catap_audio_input_stream.mm).
- projectM's per-frame loudness update takes "(Fractional) seconds passed since the last frame" and uses a different damping factor for the first few frames "to avoid 'jumpy' behaviour" — [projectM Loudness.hpp](https://github.com/projectM-visualizer/projectm/blob/HEAD/src/libprojectM/Audio/Loudness.hpp)
- In the spec, `getByteFrequencyData()` and `getFloatFrequencyData()` write the "current frequency data", where "The most recent fftSize frames are used in computing the frequency data". Smoothing over time blends with the "previous block", which is "the buffer computed by the previous smoothing over time operation" — [Web Audio API spec index.bs](https://github.com/WebAudio/web-audio-api/blob/HEAD/index.bs)

### Inferences
- **Do not drive visuals from `AnalyserNode.getFloatFrequencyData()` called in `requestAnimationFrame`.** The spec ties smoothing to the previous smoothing operation, so the effective time constant probably changes with how often you call it (60 vs 144 vs 480 Hz). This reading is inferred from the spec text, not tested. Run analysis in the AudioWorklet at a fixed hop. Publish feature frames, each with its audio timestamp (`currentFrame / sampleRate`), into a SharedArrayBuffer ring or post them over a MessagePort. The render loop then interpolates to "now minus an alignment offset". SharedArrayBuffer needs cross-origin isolation (COOP/COEP headers on the app's pages), not verified here; MessagePort is the simpler fallback.
- **Frame-rate-independent smoothing:** `y += (x - y) * (1 - exp(-dt / tau))`, with separate `tau` for attack and release. Express decays as half-lives in seconds and pulse widths in milliseconds, never in frames. Limit per-frame luminance change by a rate in units per second (section 7).
- **Files (look-ahead):**
  1. Precompute onsets, beats and sections offline, or analyse a buffered copy ahead of the playhead.
  2. Each frame, compute the audible position: `audibleTime ≈ getOutputTimestamp().contextTime` (or `ctx.currentTime - outputLatency` where the timestamp is not available), mapped to the media position.
  3. Fire visual events when `eventTime <= audibleTime + displayLatency`, so the pixels and the sound arrive together.
- **Live input (prediction):**
  - Captured audio is already late compared with what the user hears from the speakers (for loopback) or from the room (for a mic).
  - Fast transients: use a short, separate path (512-point window, about 10.7 ms) for kick and snare flashes.
  - Steady-tempo music: schedule beat pulses from the tracker's predicted next-beat time minus the pipeline latency, as BTrack does by predicting beats. This cancels most of the delay.
- **Calibration:** provide an "AV offset" slider (−150 to +150 ms) and a tap-along calibration. Bluetooth headphones on loopback can add large output delays the app cannot see.

### Gaps
- Measured end-to-end capture latency per OS for Chromium's loopback paths (WASAPI loopback, CATap, PulseAudio monitor): no measurements found. Measure with a loopback test signal.
- Perceptual audio-visual sync tolerances (for example ITU-R BT.1359): not verified this session.
- ~~Whether Chrome 153's `renderSizeHint` is enabled by default in Electron 45~~ — resolved: `WebAudioConfigurableRenderQuantum` is `status: "stable"` in Chromium 156.0.8078.96, the version Electron 45 pins [Verified: https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/third_party/blink/renderer/platform/runtime_enabled_features.json5]. How it affects capture latency is still unmeasured.

## 7. Mapping sound to visuals and photosensitive safety

### Takeaway
Follow the MilkDrop/projectM pattern: a few normalised drives (bass, mid and treble, each around 1.0, plus smoothed "_att" versions and a volume) are mapped onto existing hand-controlled parameters as bounded modulation. Audio never fully takes over. Enforce WCAG 2.3.1 in the engine: no more than three large luminance flashes per second, and extra caution with saturated red. Make "calm" the default, so the light toy stays playable by hand while music plays.

### Cited Findings
- MilkDrop-style audio variables in projectM:
  - `bass`, `mid` and `treb` are each band's current loudness relative to recent frames, revolving "around 1.0, with <0.7 being very silent and >1.3 very loud audio";
  - `bass_att`, `mid_att` and `treb_att` are attenuated averages that do "not change as much";
  - `vol` and `vol_att` are the means of the three bands.
  — [projectM Loudness.hpp](https://github.com/projectM-visualizer/projectm/blob/HEAD/src/libprojectM/Audio/Loudness.hpp); [PCM.cpp](https://github.com/projectM-visualizer/projectm/blob/HEAD/src/libprojectM/Audio/PCM.cpp)
- WCAG 2.3.1 Three Flashes or Below Threshold (Level A): "Web pages do not contain anything that flashes more than three times in any one second period, or the flash is below the general flash and red flash thresholds" — [WCAG SC 2.3.1](https://github.com/w3c/wcag/blob/HEAD/guidelines/sc/20/three-flashes-or-below-threshold.html). WCAG 2.3.2 (Level AAA) forbids more than three flashes per second outright — [WCAG SC 2.3.2](https://github.com/w3c/wcag/blob/HEAD/guidelines/sc/20/three-flashes.html) [Verified 2.3.1: https://raw.githubusercontent.com/w3c/wcag/main/guidelines/sc/20/three-flashes-or-below-threshold.html; 2.3.2 not re-read]
- WCAG thresholds:
  - content passes if "there are no more than three general flashes and / or no more than three red flashes within any one-second period", or if the combined flashing area is "no more than a total of .006 steradians within any 10 degree visual field … (25% of any 10 degree visual field on the screen)";
  - a general flash is "a pair of opposing changes in relative luminance of 10% or more of the maximum relative luminance (1.0) where the relative luminance of the darker image is below 0.80";
  - a red flash is "any pair of opposing transitions involving a saturated red";
  - exception: fine, balanced patterns (such as a checkerboard with squares under 0.1 degree) do not count.
  — [WCAG term: general flash and red flash thresholds](https://github.com/w3c/wcag/blob/HEAD/guidelines/terms/20/general-flash-and-red-flash-thresholds.html) [Verified: https://raw.githubusercontent.com/w3c/wcag/main/guidelines/terms/20/general-flash-and-red-flash-thresholds.html. The definition also gives the working test for "saturated red": a transition to or from a state with R/(R+G+B) ≥ 0.8, and a chromaticity difference > 0.2 in CIE 1976 UCS.]
- The Understanding document says a 341 × 256 pixel block "represents a 10 degree viewport at a typical viewing distance". For content in colour spaces other than sRGB, "the industry standard definition of a general flash is a change in luminance of 20 cd/m2 or more where the darker image is below 160 cd/m2". It notes that users closer to the screen, or using zoom, are affected more than the idealised criteria assume — [WCAG Understanding 2.3.1](https://github.com/w3c/wcag/blob/HEAD/understanding/20/three-flashes-or-below-threshold.html) [Verified: https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/three-flashes-or-below-threshold.html]
- **Added in the fact-check pass (decision-relevant for the HDR output path):** the same Understanding document says the 20 cd/m² / 160 cd/m² rule "is applicable for standard dynamic range (SDR) and high dynamic range (HDR) content". For HDR content where the darker state is 160 cd/m² or more, a general flash is a Michelson contrast (L_high − L_low)/(L_high + L_low) of 1/17 or greater. It also restates the area block as 341 × 256 CSS pixels (87,296 CSS px²), analysed at the largest scale the content can be viewed, i.e. full screen. An HDR mode therefore needs the flash limiter to work in absolute luminance, not 0–1 relative luminance. [Verified: https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/three-flashes-or-below-threshold.html]

### Inferences
- **Mapping rules for Tactilume:**
  - Audio scales and offsets the parameters the player already controls: emission rate, particle size, glow, colour temperature, turbulence, attraction strength. Keep each within a bounded range, for example ±30%.
  - Touch, motion and gamepad input set the base values. While the user is actively touching or steering, duck the audio modulation depth by 50–80% with a smooth release, so hands always feel in control.
  - Provide one "Music reactivity" master slider (off / subtle / normal / wild), plus per-band sensitivity.
- **What drives what:**
  - Bass (`_att`) drives slow, large effects: global pulse, zoom, attraction.
  - Onsets drive short, local events: spark bursts at the touch point, ripples.
  - Treble and flux drive fine-grain shimmer, not full-screen brightness.
  - Tempo and beat phase quantise automatic events (colour changes on bars, motifs on downbeats).
  - Chroma and key drive slow palette drift.
- **Flash limiter (engine-level, always on):**
  - Track mean luminance and red saturation over the 10°-equivalent regions (about a 341 × 256 px grid at 1080p, scaled for resolution and DPI).
  - Count opposing luminance transitions of 10% or more where the darker frame is below 0.8 relative luminance.
  - Cap at 3 per second per region, capping the total flashing area as well.
  - When over budget, clamp the per-frame luminance delta and convert flashes into hue or size changes.
- **Why the limiter is needed:** 16th-note hi-hats at 128 BPM come at about 8.5 per second and an onset detector fires on every one, so per-onset full-field strobing breaks the limit. Beats at 128 BPM (2.13 per second) are within it.
- **Safety defaults:** make "Reduce flashing" the default, and respect `prefers-reduced-motion`. Show a photosensitivity notice before the first audio-reactive session. Avoid saturated red flashes entirely.

### Gaps
- Resolume, TouchDesigner, Wallpaper Engine and NestDrop audio-mapping documentation (Resolume's FFT/BPM sync, TouchDesigner's Audio Analysis component, Wallpaper Engine's audio listener and value ranges): the sites were blocked and nothing was verified.
- Harding FPA / ITU-R BT.1702 test procedures, and how MilkDrop presets typically handle strobing: not accessed.

## 8. Audio-adjacent inputs: Web MIDI, MIDI clock, OSC (and Ableton Link)

### Takeaway
- **Web MIDI** works in Electron's renderer behind the `midi` permission (and `midiSysex` for SysEx), so grant them in the permission handlers.
- **MIDI clock** (24 ticks per quarter note, plus Start, Stop, Continue and Song Position) gives exact tempo and bar position from a DAW or drum machine, better than audio beat tracking when it is available.
- **OSC** from a DAW, TouchOSC or similar should be received on a UDP socket in the Node main process (node-osc, Apache-2.0, or osc.js) and forwarded to the renderer.
- **Ableton Link** is GPL or proprietary and needs native code, so treat it as optional.

### Cited Findings
- Electron's permission types include "`midi` - Request MIDI access in the Web MIDI API" and "`midiSysex` - Request the use of system exclusive messages". Both appear in the request and check handlers — [Electron session.md](https://github.com/electron/electron/blob/main/docs/api/session.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/session.md]
- `requestMIDIAccess()` "must be called in a secure context". Access "may be gated by the midi … Permission Policy", and "The user must explicitly grant permission to use the API though a user-agent specific mechanism, or have previously granted permission". Permission status can be queried with `navigator.permissions.query()` using `midi` and an optional `sysex` property — [MDN requestMIDIAccess](https://github.com/mdn/content/blob/main/files/en-us/web/api/navigator/requestmidiaccess/index.md) [Verified: https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/navigator/requestmidiaccess/index.md]
- The Web MIDI spec defines `MidiPermissionDescriptor` with `sysex = false`. `{name: "midi", sysex: true}` is "stronger than" `{name: "midi", sysex: false}`, and the spec defines a `"midi"` permission-policy feature — [Web MIDI API spec](https://github.com/WebAudio/web-midi-api/blob/HEAD/index.html)
- Browser support for `requestMIDIAccess`: Chrome 43+, Firefox 108+, Safari none — [@mdn/browser-compat-data 8.1.8](https://registry.npmjs.org/@mdn/browser-compat-data) [Verified: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Navigator.json]
- MIDI clock: "According to the standard, there are 24 MIDI clocks for every quarter note" — [WebMidi.js src/Output.js](https://github.com/djipco/webmidi/blob/HEAD/src/Output.js). Status bytes: clock `0xF8`, start `0xFA`, continue `0xFB`, stop `0xFC`, song position `0xF2`, active sensing `0xFE` — [WebMidi.js src/Enumerations.js](https://github.com/djipco/webmidi/blob/HEAD/src/Enumerations.js)
- osc.js "works in both Node.js and in a web browser". It offers UDP transport for Node.js and Chrome Apps (plus WebSocket, serial and TCP), and has a section on "Installing osc.js for use in Electron Applications", because its native dependencies (such as node-serialport) must match Electron's Node — [osc.js README](https://github.com/colinbdclark/osc.js)
- node-osc sends and receives OSC messages and bundles (`Client`, `Server`, `Bundle`). Version 11.7.1 (2026-09-14), Apache-2.0 — [node-osc README](https://github.com/MylesBorins/node-osc); [npm node-osc](https://registry.npmjs.org/node-osc)
- Ableton Link is GPLv2-or-later, and proprietary use requires contacting Ableton — [Ableton Link LICENSE.md](https://github.com/Ableton/link/blob/HEAD/LICENSE.md)

### Inferences
- **Web MIDI in Electron:**
  - Grant `midi` (and `midiSysex` only if needed) in `setPermissionRequestHandler` and `setPermissionCheckHandler`, for the app's own origin only.
  - Call `navigator.requestMIDIAccess({ sysex: false })` from the renderer.
  - Listen for `statechange` to handle hot-plugging.
  - `file://` and custom protocol pages need to count as secure contexts; register the app's custom scheme as secure/standard. Partly verified: `protocol.registerSchemesAsPrivileged` has a `secure` privilege (default false), and Electron's own `registerSource` example registers `app` with `{ standard: true, secure: true, supportFetchAPI: true }` [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/structures/custom-scheme.md; https://raw.githubusercontent.com/electron/electron/main/docs/api/protocol.md]. That Web MIDI then accepts the page as a secure context was not tested.
- **MIDI clock to tempo:**
  - Each clock tick is `quarter / 24`, so BPM = 60 / (24 × mean tick interval). Average over 24–96 ticks with outlier rejection to remove USB/OS jitter.
  - Use Start/Stop/Continue to reset or pause the beat phase, and Song Position Pointer (in 16th notes) to set the bar position. When clock is present, override the audio tempo tracker with it and use audio only for dynamics.
- **OSC:**
  - Create the UDP socket (node-osc or `dgram`) in the main process. Validate the address patterns (a whitelist such as `/tactilume/*`) and forward compact messages to the renderer through `MessagePortMain`.
  - Bind to localhost by default and make LAN binding opt-in, because the phone link (covered elsewhere) shares the network.
  - Typical DAW-to-visuals messages: tempo, bar/beat, section markers, per-track levels.
- **Ableton Link:** it needs a native addon and carries GPL obligations. Skip it for v1, or license it. MIDI clock and OSC cover the DAW-sync use case without native code.

### Gaps
- Whether Chromium in 2026 shows a permission prompt for non-SysEx MIDI in Electron when no permission handler is set: not verified (the default behaviour without a handler was not checked).
- Maintained Node bindings for Ableton Link compatible with Electron 45: not researched (search budget exhausted).
- The secure-context status of Electron custom protocols for Web MIDI: partly resolved. A `secure: true` privilege exists and is used in Electron's own example (see Inferences above), but Web MIDI on such a page was not tested.

## Verification

Fact-check pass on 2026-11-12, against the same classes of primary source the notes used: raw GitHub (Electron docs and source, the Chromium mirror including the 156.0.8078.96 tag Electron 45 pins, MDN content and BCD, WCAG), npm and developer.apple.com.

| Claim | Verdict | Source |
|---|---|---|
| Electron loopback: handler `audio: 'loopback'` captures system audio, "supported on Windows and on macOS 14.2 and later"; `loopbackWithMute` mutes speakers; `null` → `AbortError` | confirmed | https://raw.githubusercontent.com/electron/electron/main/docs/api/session.md; https://raw.githubusercontent.com/chromium/chromium/main/media/audio/audio_device_description.h |
| Electron passes `loopback` through on Linux with no OS check; `restrictOwnAudio` swaps to `loopbackWithoutChrome` only on Windows/macOS/ChromeOS | confirmed | https://raw.githubusercontent.com/electron/electron/main/shell/browser/electron_browser_context.cc |
| `getDisplayMedia` must request video (TypeError otherwise); `systemAudio` is a hint; Chrome 74 / 105 / 141 for audio / systemAudio / windowAudio | confirmed (windowAudio partial: no `"window"` value) | https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/mediadevices/getdisplaymedia/index.md; https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/MediaDevices.json |
| Electron 45: screen/window capture now reaches the permission handler as `display-capture` | confirmed | https://raw.githubusercontent.com/electron/electron/main/docs/breaking-changes.md |
| macOS 14.2+: `NSAudioCaptureUsageDescription` required; CATap default since Electron 39; denied permission → silent `ended` track; no SCK fallback; opt-out flag dead in 45 | confirmed | https://raw.githubusercontent.com/electron/electron/main/docs/api/desktop-capturer.md |
| Chromium gates: CATap ≥ macOS 14.2; SCK loopback only below macOS 15; Windows and Linux-PulseAudio loopback supported; Chrome's Linux picker flag off by default | confirmed | https://raw.githubusercontent.com/chromium/chromium/main/media/base/media_switches.cc; https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/media/webrtc/desktop_media_picker_controller.cc |
| Core Audio tap API minimum: 14.2 (Apple sample) vs 14.4 (AudioCap) | corrected/resolved: Apple's API reference lists `AudioHardwareCreateProcessTap` as macOS 14.2 | https://developer.apple.com/documentation/coreaudio/audiohardwarecreateprocesstap(_:_:) |
| macOS ≤ 12 users need BlackHole through the mic path | corrected: Electron 45 does not run below macOS 13 Ventura, so this case cannot occur | https://raw.githubusercontent.com/electron/electron/v45.3.0/README.md |
| Linux loopback opens the default sink's monitor and follows sink changes; monitors hidden from input enumeration; Wayland portal picker + restore token | confirmed | https://raw.githubusercontent.com/chromium/chromium/main/media/audio/pulse/pulse_loopback_manager.cc; https://raw.githubusercontent.com/chromium/chromium/main/media/audio/pulse/audio_manager_pulse.cc; https://raw.githubusercontent.com/electron/electron/main/docs/api/desktop-capturer.md |
| Mic permissions: Electron `media` type; `askForMediaAccess` macOS-only; `getMediaAccessStatus` Windows+macOS; hardened-runtime `device.audio-input` entitlement | confirmed | https://raw.githubusercontent.com/electron/electron/main/docs/api/system-preferences.md; https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.device.audio-input |
| Electron builds with proprietary codecs (AAC/MP3 available); `File.path` removed in 32 → `webUtils.getPathForFile` | confirmed | https://raw.githubusercontent.com/electron/electron/main/build/args/all.gn; https://raw.githubusercontent.com/electron/electron/main/docs/breaking-changes.md |
| AnalyserNode `fftSize` 32–32768, smoothing 0.8; AudioWorklet blocks 128 frames; `renderSizeHint` Chrome 153 (experimental) | confirmed; added: on by default ("stable") in Chromium 156 / Electron 45 | https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/analysernode/fftsize/index.md; https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/third_party/blink/renderer/platform/runtime_enabled_features.json5 |
| Latency APIs: `baseLatency` 58, `outputLatency` 102 (Safari 18.4), `getOutputTimestamp` 57, `playbackStats` 146 | confirmed | https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/AudioContext.json |
| Licences: Meyda MIT; Essentia.js AGPL-3.0; aubio GPL-3.0+; aubiojs MIT wrapper (empty npm field); BTrack GPLv3(+); realtime-bpm-analyzer Apache-2.0; web-audio-beat-detector MIT; Tone.js MIT; madmom BSD code + CC BY-NC-SA models; BeatNet CC BY 4.0; librosa ISC; fft.js MIT; osc MIT OR GPL-2.0; node-osc Apache-2.0; Ableton Link GPLv2+ or proprietary | confirmed (versions and dates also match npm) | LICENSE files and npm metadata listed inline in section 5 |
| WCAG 2.3.1: ≤ 3 flashes per second or below the general/red thresholds; 10 % relative-luminance pairs with darker < 0.80; 341 × 256 px area block | confirmed; added: HDR rule (20 cd/m², or Michelson ≥ 1/17 when darker ≥ 160 cd/m²) | https://raw.githubusercontent.com/w3c/wcag/main/guidelines/terms/20/general-flash-and-red-flash-thresholds.html; https://raw.githubusercontent.com/w3c/wcag/main/understanding/20/three-flashes-or-below-threshold.html |
| Web MIDI: Electron `midi`/`midiSysex` permissions; secure context required; Chrome 43, Firefox 108, no Safari | confirmed | https://raw.githubusercontent.com/electron/electron/main/docs/api/session.md; https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Navigator.json |
| Custom app scheme counts as a secure context for Web MIDI | unverifiable (the `secure` privilege exists; behaviour untested) | https://raw.githubusercontent.com/electron/electron/main/docs/api/structures/custom-scheme.md |
| Whether Windows shows a privacy prompt for loopback capture | unverifiable (learn.microsoft.com blocked) | — |

**Contradictions noted and how they were resolved**
- Notes vs measured facts: no conflict. The measured browser is Chromium 153, the version where `renderSizeHint` shipped; Electron 45 (Chromium 156) has it on by default.
- Within this file: the AudioCap 14.4 vs Apple 14.2 conflict is resolved in favour of 14.2 using Apple's API reference.
- With desktop_app_shell.md: that file advised dropping the microphone entitlement from the default osx-sign set, but this file needs mic/line-in. Resolved in both files: keep `com.apple.security.device.audio-input`. Both files agree on Electron 45 = Chromium 156.0.8078.96.
- With Electron's platform floor: the "macOS 12 and older" user path is struck because Electron 45 requires macOS 13+.
