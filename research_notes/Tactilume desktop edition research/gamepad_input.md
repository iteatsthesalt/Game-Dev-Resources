# Gamepad input for Tactilume Desktop: Gamepad API, haptics and WebHID in Chromium/Electron (as of 2026-11-12)

Baseline for these notes. Electron 45.3.0 (published 2026-11-10) was the latest release on npm when these notes were written, and it embeds Chromium 156.0.8078.96. Since 2026-11-12T02:09Z npm `latest` has been 45.3.1, which pins the same Chromium 156.0.8078.96 and Node v24.22.2, so every "@156" finding applies to it unchanged. [Verified correction: https://registry.npmjs.org/electron; https://github.com/electron/electron/blob/v45.3.1/DEPS] Chromium trunk was at 160.0.8157.0 when I read it on 2026-11-12. [Verified: https://github.com/chromium/chromium/blob/main/chrome/VERSION] A finding marked "@156" was checked at the tag Electron 45 ships. Every other Chromium finding comes from trunk source, so re-check it against whichever Electron version ships. Most facts come from primary source code and specs read as raw files from GitHub. In this session GyroWiki, the Steamworks docs, MDN pages, chromestatus, learn.microsoft.com and press sites were blocked, and the shared web-search budget ran out after three searches. Anything seen only in a search result is marked "search summary, not verified". The coordinator measured that headless Chromium 153.0.8010.12 (Playwright 1.63.0, Linux) exposes `navigator.hid`; no physical controller was available to test. [Verified: measured in this container]

## 1. Gamepad API in Chromium/Electron in 2026: standard mapping, counts, polling vs events, user gesture, maximum controllers and backends, connection events, haptics, touch/pose/light extensions, Electron differences

### Takeaway
In Electron 45 (Chromium 156) the Gamepad API is polled. It exposes up to 8 pads, and Chromium samples them internally at about 250 Hz. [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepads.h; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_provider.cc] It gives standard-mapped buttons, sticks and analog triggers for every controller family in scope. Dual-rumble works on most pads. Trigger-rumble works only on Xbox One, Series and Elite pads on Windows (via Windows.Gaming.Input), and on macOS only where Apple's GameController framework reports trigger haptics. [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_id_list.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/game_controller_gamepad.mm] The API has no gyro, no LEDs, no adaptive triggers and no battery. Two features exist only as experimental Blink switches that an Electron app would have to turn on: touchpads (`touchEvents`, which the spec calls `touches`) and the low-latency `gamepadrawinputchanged` event. [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/platform/runtime_enabled_features.json5] On Windows the default path no longer uses XInput, so XInput's 4-pad limit does not apply. Chromium's own cap of 8 is the binding limit. [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_platform_data_fetcher.h]

### Cited Findings

**Versions and spec status**
- Chromium trunk `chrome/VERSION` is 160.0.8157.0 (read 2026-11-12). — [Chromium chrome/VERSION](https://github.com/chromium/chromium/blob/main/chrome/VERSION) [Verified: https://github.com/chromium/chromium/blob/main/chrome/VERSION]
- Electron 45.3.0 was published to npm at 2026-11-10T21:11:56Z and was `latest` when these notes were written. Electron 45.3.1 replaced it as `latest` at 2026-11-12T02:09:19Z. — [npm registry: electron](https://registry.npmjs.org/electron) [Verified correction: https://registry.npmjs.org/electron]
- Electron v45.3.0 pins Chromium 156.0.8078.96 and Node v24.22.2, and v45.3.1 pins the same two. Electron `main` pins Chromium 159.0.8154.0 and Node v26.13.0. — [Electron v45.3.0 DEPS](https://github.com/electron/electron/blob/v45.3.0/DEPS); [Electron main DEPS](https://github.com/electron/electron/blob/main/DEPS) [Verified: https://github.com/electron/electron/blob/v45.3.0/DEPS; https://github.com/electron/electron/blob/v45.3.1/DEPS; https://github.com/electron/electron/blob/main/DEPS]
- The W3C Gamepad spec is still an Editor's Draft (respec `specStatus: "ED"`, previous maturity FPWD, WebApps WG). — [w3c/gamepad index.html (gh-pages)](https://github.com/w3c/gamepad/blob/gh-pages/index.html) [Verified: https://github.com/w3c/gamepad/blob/gh-pages/index.html]

**Standard mapping and data model**
- The spec's Standard Gamepad has 17 buttons and 4 axes:
  - Buttons 0–3: the right cluster (bottom, right, left, top).
  - Buttons 4–5: the top left and right front buttons (bumpers).
  - Buttons 6–7: the bottom left and right front buttons (triggers).
  - Buttons 8–9: left and right of the centre cluster.
  - Buttons 10–11: left and right stick presses.
  - Buttons 12–15: the left cluster (D-pad up, down, left, right).
  - Button 16: centre of the centre cluster (home/guide).
  - Axes 0–3: left stick X/Y and right stick X/Y. Negative is left or up, positive is right or down.
  - Source: [W3C Gamepad ED](https://github.com/w3c/gamepad/blob/gh-pages/index.html)
- The spec allows user agents to alter exposed device information to reduce fingerprinting. One example is exposing exactly the standard number of buttons and axes. — [W3C Gamepad ED](https://github.com/w3c/gamepad/blob/gh-pages/index.html)
- Chromium per-pad limits: 16 axes (`kAxesLengthCap`), 32 buttons (`kButtonsLengthCap`), 8 touch events (`kTouchEventsLengthCap`) and a 128-character id. An analog button counts as "pressed" above 30/255. Mapping is one of none/standard/xr-standard. — [Chromium gamepad.h](https://github.com/chromium/chromium/blob/main/device/gamepad/public/cpp/gamepad.h) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad.h]
- Chromium exposes at most 8 gamepads (`Gamepads::kItemsLengthCap = 8`). This is true on trunk and at the tag Electron 45 ships. — [gamepads.h (main)](https://github.com/chromium/chromium/blob/main/device/gamepad/public/cpp/gamepads.h); [gamepads.h @156.0.8078.96](https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepads.h) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepads.h]
- Chromium's GamepadProvider polls devices every 4 ms ("~250 Hz", `kPollingIntervalMilliseconds = 4`) on trunk and at the 156 tag. — [gamepad_provider.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_provider.cc) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_provider.cc]

**User gesture, security and visibility**
- Spec: `getGamepads()` returns an empty list until a "gamepad user gesture" has been seen. The `[[hasGamepadGesture]]` flag is set only when the document is a fully active descendant of a top-level traversable with user attention. Access is also governed by the `"gamepad"` permissions-policy feature. — [W3C Gamepad ED](https://github.com/w3c/gamepad/blob/gh-pages/index.html)
- Chromium treats any pressed button, or any axis with |value| > 0.5 (`kAxisMoveAmountThreshold`), as the gesture. — [gamepad_user_gesture.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_user_gesture.cc) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_user_gesture.cc]
- `getGamepads()` throws a SecurityError when the `gamepad` permissions-policy feature is disabled for the context. Insecure contexts only increment a UseCounter (`kGetGamepadsFromInsecureContext`) and are not blocked. — [navigator_gamepad.cc](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/gamepad/navigator_gamepad.cc) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/navigator_gamepad.cc]
- On trunk a gamepad button press counts as a user activation (`NotifyUserActivation`) only when the page is visible and focused. The focus condition comes from the `GamepadUserActivationFocus` runtime feature, which is "stable" on trunk and at 159.0.8154.0 (the Chromium that Electron `main` pins, so Electron 46). At 156 (Electron 45) and at 157 that feature does not exist and the code checks visibility only, so in Electron 45 a press in a visible but unfocused window also counts as a user activation. [Verified correction: https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/navigator_gamepad.cc; https://github.com/chromium/chromium/blob/157.0.8103.81/third_party/blink/renderer/platform/runtime_enabled_features.json5; https://github.com/chromium/chromium/blob/159.0.8154.0/third_party/blink/renderer/platform/runtime_enabled_features.json5] — [navigator_gamepad.cc](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/gamepad/navigator_gamepad.cc); [runtime_enabled_features.json5 (main)](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/runtime_enabled_features.json5)
- At @156 the Gamepad* runtime features are GamepadButtonTypes (experimental), GamepadMultitouch (experimental), GamepadRawInputChangeEvent (experimental, with an origin-trial name) and GamepadWindowEventHandlers (stable). GamepadUserActivationFocus does not appear in that list. — [runtime_enabled_features.json5 @156.0.8078.96](https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/platform/runtime_enabled_features.json5) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/platform/runtime_enabled_features.json5]
- Blink stops gamepad updates when the page becomes hidden and restarts them when it becomes visible (`PageVisibilityChanged` → `StopUpdating`/`StartUpdating`). — [navigator_gamepad.cc](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/gamepad/navigator_gamepad.cc) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/navigator_gamepad.cc]
- On Windows, Chromium registers Raw Input devices with `RIDEV_INPUTSINK`, so it keeps receiving input while not in the foreground. — [raw_input_data_fetcher_win.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/raw_input_data_fetcher_win.cc)

**Events: connection and the experimental raw-input event**
- Blink dispatches `gamepadconnected` and `gamepaddisconnected`. It also handles `gamepadrawinputchanged` when the runtime feature `GamepadRawInputChangeEvent` is enabled. That feature is "experimental" and carries `origin_trial_feature_name: "GamepadRawInputChangeEvent"`. The browser-side base feature `kGamepadRawInputChangeEvent` is enabled by default. — [navigator_gamepad.cc](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/gamepad/navigator_gamepad.cc); [runtime_enabled_features.json5](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/runtime_enabled_features.json5); [gamepad_features.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/public/cpp/gamepad_features.cc) Both hold at the 156 tag. [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/navigator_gamepad.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad_features.cc]
- Microsoft Edge's explainer (status "Active", expected venue the W3C WebApps WG) describes `gamepadrawinputchanged`:
  - It fires on `window` for every input frame, typically one per HID report, with no alignment or coalescing.
  - The event carries a `gamepad` snapshot plus index arrays `axesChanged`, `buttonsValueChanged`, `buttonsPressed`, `buttonsReleased` and `touchesChanged`.
  - The rationale: polling from `requestAnimationFrame` at about 60 Hz misses updates from controllers polled at about 250 Hz. At 60 Hz the average added delay is about 8.33 ms.
  - The polling API will not be deprecated.
  - Source: [Edge explainer: Gamepad Event-Driven Input API](https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/GamepadEventDrivenInputAPI/explainer.md) [Verified: https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/GamepadEventDrivenInputAPI/explainer.md]

**Platform backends (which code path a controller takes)**
- **Windows** (trunk and @156):
  - Chromium registers `GameInputDataFetcher` only on Windows 11 and only when `kEnableWindowsGameInputDataFetcher` is on. That feature is disabled by default. Otherwise it registers `WgiDataFetcherWin` (Windows.Gaming.Input).
  - It always adds `NintendoDataFetcher` and `RawInputDataFetcher`.
  - Sources: [gamepad_platform_data_fetcher.h](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_platform_data_fetcher.h); [@156](https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_platform_data_fetcher.h); [gamepad_features.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/public/cpp/gamepad_features.cc) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_platform_data_fetcher.h; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad_features.cc]
- The XInput fetcher source is still there: 4 slots (`XUSER_MAX_COUNT`), `xinput1_4.dll`, and undocumented `XInputGetStateEx` (ordinal 100) for the Guide button. It is not among the factories registered above. [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_platform_data_fetcher.h] — [xinput_data_fetcher_win.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/xinput_data_fetcher_win.cc); [gamepad_platform_data_fetcher.h](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_platform_data_fetcher.h)
- `kIgnorePS5GamepadsInWgi` is enabled by default. It makes WGI ignore the DualSense and DualSense Edge "to avoid double enumeration", so they arrive through Raw Input. — [gamepad_features.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/public/cpp/gamepad_features.cc) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad_features.cc]
- The GameInput fetcher is a new file (copyright 2026). It leaves Nintendo and DualShock 4 pads to their dedicated fetchers. It reports trigger-rumble when `supportedRumbleMotors` includes the left or right trigger motor. — [gameinput_data_fetcher.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/gameinput_data_fetcher.cc)
- WGI exposes Xbox Elite paddles as extra buttons. `buttons_length = BUTTON_INDEX_COUNT + GetPaddleNumber()`, using `Paddle1`–`Paddle4` detected through `IGamepad2::GetButtonLabel`. — [wgi_data_fetcher_win.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/wgi_data_fetcher_win.cc)
- **macOS**:
  - Chromium registers `GameControllerDataFetcherMac` (Apple GameController), `GamepadPlatformDataFetcherMac` (IOKit HID), `NintendoDataFetcher` and `XboxDataFetcher`.
  - `kXboxUseGameControllerDataFetcherMac` and `kPlayStationUseGameControllerDataFetcherMac` are both enabled by default, so Xbox and PlayStation pads go through GameController.
  - Sources: [gamepad_platform_data_fetcher.h](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_platform_data_fetcher.h); [gamepad_features.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/public/cpp/gamepad_features.cc)
- **Linux**:
  - Chromium registers `GamepadPlatformDataFetcherLinux` (udev/evdev/hidraw) and `NintendoDataFetcher`.
  - `kAllowlistHidrawGamepads` (enabled) checks device IDs before opening a hidraw node, to avoid interfering with non-gamepads.
  - Sources: [gamepad_platform_data_fetcher.h](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_platform_data_fetcher.h); [gamepad_features.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/public/cpp/gamepad_features.cc)

**Standard-mapping coverage per OS (Chromium trunk mapping tables)**
- Windows table: Microsoft 0b20/0b21/0b22; Nintendo 2006/2007/2009/200e; Sony 05c4, 09cc, 0ba0, 0ce6, 0df2, 0e5f. Xbox pads on the WGI path are mapped by WGI itself. — [gamepad_standard_mappings_win.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_standard_mappings_win.cc)
- macOS table: 8BitDo 301b and 6012; Microsoft 028e, 028f, 02d1, 02dd, 02e0, 02e3, 02ea, 02fd, 0719, 0b00, 0b05, 0b0a, 0b0c, 0b13, 0b20–0b22; Nintendo 2006/2007/2009/200e; Sony 0268, 05c4, 09cc, 0ba0, 0ce6, 0df2, 0e5f. — [gamepad_standard_mappings_mac.mm](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_standard_mappings_mac.mm)
- Linux table: Microsoft 02e0, 02fd, 0b05, 0b13, 0b20–0b22; Nintendo 2006/2007/2009/200e; Sony 0268, 05c4, 09cc, 0ba0, 0ce6, 0df2, 0e5f; Valve 1102, 1142, 1205, 1302, 1303, 1304, 1305. — [gamepad_standard_mappings_linux.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_standard_mappings_linux.cc)
- Kernel names for these IDs:
  - Sony 054c:0ce6 is the PS5 controller (DualSense) and 054c:0df2 is "PS5_CONTROLLER_2" (DualSense Edge). 05c4 and 09cc are PS4 controllers and 0ba0 is the PS4 dongle.
  - Nintendo 057e:2006/2007 are Joy-Con L/R, 2009 the Pro Controller and 200e the charging grip. Switch 2: 2066 Joy-Con R, 2067 Joy-Con L, 2069 Pro Controller, 2073 GameCube controller.
  - Valve 28de:1102/1142 are the Steam Controller (wired/wireless) and 1205 the Steam Deck. 1302 is `STEAM_CONTROLLER_IBEX`, 1303 `IBEX_BLE`, 1304 `PROTEUS` and 1305 `NEREID`.
  - Source: [Linux hid-ids.h](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-ids.h)
- SDL's names for the same IDs:
  - 28de:1302 "Valve Steam Triton Controller" (USB), 1303 "Valve Steam Triton Controller (BLE)", 1304 "Valve Steam Proteus Dongle (Proprietary)", 1305 "Valve Steam Nereid Dongle (Proprietary)", 28de:11ff "Steam Virtual Gamepad". [Verified correction: https://github.com/libsdl-org/SDL/blob/main/src/joystick/controller_list.h]
  - 2dc8:6012 "8BitDo Ultimate 2 Wireless Controller in Steam Mode (Bluetooth)", 2dc8:3106 "8BitDo Ultimate Wired Controller. Windows, Android, Switch", 2dc8:310a "8BitDo Ultimate 2C Wireless Controller".
  - Source: [SDL controller_list.h](https://github.com/libsdl-org/SDL/blob/main/src/joystick/controller_list.h)
- Chromium's ID list classifies 28de:11ff (Steam Virtual Gamepad) and 2dc8:3106 as `kXInputTypeXbox360`. It contains no Switch 2 IDs (057e:2066/2067/2069/2073). — [gamepad_id_list.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_id_list.cc) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_id_list.cc]

**Haptics in the Gamepad API**
- Spec effect types:
  - `"dual-rumble"` takes `startDelay`, `duration`, `strongMagnitude` (low-frequency) and `weakMagnitude` (high-frequency). Magnitudes run from 0 to 1 and everything defaults to 0.
  - `"trigger-rumble"` adds `leftTrigger` and `rightTrigger` intensities from 0 to 1 for the bottom front buttons.
  - The user agent may modify an effect for compatibility, for example turning a rumble effect into a waveform. It should use the `playEffect` timestamp for precise timing when `startDelay` is not 0.
  - Source: [W3C Gamepad ED](https://github.com/w3c/gamepad/blob/gh-pages/index.html)
- Chromium rejects negative durations or delays and magnitudes outside 0–1. It caps `duration + startDelay` at 5000 ms (`kMaxEffectDurationMillis`). A pad with trigger-rumble also lists dual-rumble in `effects`. — [gamepad_haptic_actuator.cc](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/gamepad/gamepad_haptic_actuator.cc); [gamepad.h](https://github.com/chromium/chromium/blob/main/device/gamepad/public/cpp/gamepad.h) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/gamepad_haptic_actuator.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad.h]
- Pads that get trigger-rumble through WGI: Xbox One USB (two firmwares), Xbox One S USB and Bluetooth (2016 and 2021 firmwares), Xbox Series X USB and Bluetooth, Xbox One Elite USB, and Xbox Elite Series 2 USB and Bluetooth (including 2021 Bluetooth firmware). — [gamepad_id_list.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_id_list.cc); [wgi_data_fetcher_win.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/wgi_data_fetcher_win.cc) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_id_list.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/wgi_data_fetcher_win.cc]
- The Windows Raw Input path supports haptics only for:
  - DualShock 4 (054c:05c4, 09cc, and a Scuf 7725 pad), through `Dualshock4Controller`, which writes output report 0x05 over USB and 0x11 over Bluetooth.
  - The three devices in the `HidHapticGamepad` table (0b43:0005, 6666:9401, 18d1:9400).
  - Sources: [raw_input_gamepad_device_win.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/raw_input_gamepad_device_win.cc); [dualshock4_controller.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/dualshock4_controller.cc); [hid_haptic_gamepad.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/hid_haptic_gamepad.cc) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/raw_input_gamepad_device_win.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/dualshock4_controller.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/hid_haptic_gamepad.cc]
- On macOS, haptics use CoreHaptics engines per `GCHapticsLocality`. Dual-rumble is offered when Left/Right Handle localities exist. Trigger-rumble is offered when the controller reports both LeftTrigger and RightTrigger localities. Otherwise the default locality is used. — [game_controller_gamepad.mm](https://github.com/chromium/chromium/blob/main/device/gamepad/game_controller_gamepad.mm) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/game_controller_gamepad.mm]
- On Linux, rumble uses evdev `FF_RUMBLE`. The Xbox Adaptive Controller (045e:0b0a) and SteelSeries Stratus Duo are excluded because they advertise force feedback but have no actuators. — [gamepad_device_linux.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_device_linux.cc)
- The Linux hid-playstation driver registers force-feedback rumble (`FF_RUMBLE` / `input_ff_create_memless` appear in the driver). — [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c)
- Nintendo pads on all desktop OSes emulate dual-rumble with HD-rumble tones: "strong" at 141 Hz (amplitude max 0.9) and "weak" at 182 Hz (max 0.1). A Joy-Con pair is merged into a composite "Joy-Con L+R" device. — [nintendo_controller.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/nintendo_controller.cc)
- MDN compatibility data:
  - `GamepadHapticActuator`: Chrome 68, Firefox 55, Safari 16.4.
  - `playEffect()` and `reset()`: Chrome 68 and Safari 16.4, not Firefox (Firefox has only the legacy `pulse()`).
  - `effects`, `trigger-rumble`, `leftTrigger` and `rightTrigger`: Chrome 126 only.
  - `Gamepad.vibrationActuator`: Chrome 68 and Safari 16.4.
  - Sources: [MDN BCD GamepadHapticActuator.json](https://github.com/mdn/browser-compat-data/blob/main/api/GamepadHapticActuator.json); [MDN BCD Gamepad.json](https://github.com/mdn/browser-compat-data/blob/main/api/Gamepad.json) [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/GamepadHapticActuator.json; https://github.com/mdn/browser-compat-data/blob/main/api/Gamepad.json]

**Touch, pose, light and button types**
- The spec now has `Gamepad.touches` (a FrozenArray of GamepadTouch). Each touch has:
  - a `touchId` that persists across frames;
  - a `surfaceId`;
  - a `position` normalised to [-1, 1], with x = 2·x/width − 1 and y = 2·y/height − 1, where −1 is left/top;
  - optional `surfaceDimensions` in device units.
  - Source: [W3C Gamepad ED](https://github.com/w3c/gamepad/blob/gh-pages/index.html)
- Chromium names the attribute `touchEvents` instead. It is gated by `[RuntimeEnabled=GamepadMultitouch]` ("experimental") and by the browser feature `kEnableGamepadMultitouch`, which is disabled by default (also @156). — [gamepad.idl](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/gamepad/gamepad.idl); [gamepad_features.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/public/cpp/gamepad_features.cc); [gamepad_features.cc @156](https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad_features.cc) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/gamepad.idl; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad_features.cc]
- Two places in Chromium produce touch data. The DualShock 4 parser reads 12-bit touch coordinates (Windows Raw Input path). The macOS GameController path uses Sony touchpad dimensions of 1920×942. — [dualshock4_controller.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/dualshock4_controller.cc); [game_controller_gamepad.mm](https://github.com/chromium/chromium/blob/main/device/gamepad/game_controller_gamepad.mm)
- `GamepadButton.type` ("non-standard" | "standard" | "trackpad") is behind the experimental `GamepadButtonTypes` feature. — [gamepad_button.idl](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/gamepad/gamepad_button.idl)
- The Gamepad Extensions draft defines `GamepadHand` (`hand`) and `GamepadPose` (`pose`). My search of it found no light-indicator interface. — [w3c/gamepad extensions.html](https://github.com/w3c/gamepad/blob/gh-pages/extensions.html)
- `Gamepad.pose`, `Gamepad.hand` and `Gamepad.hapticActuators` are supported in Firefox 55 only, not Chrome or Safari. — [MDN BCD Gamepad.json](https://github.com/mdn/browser-compat-data/blob/main/api/Gamepad.json) [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/Gamepad.json]

**Electron specifics**
- `webPreferences.enableBlinkFeatures` and `disableBlinkFeatures` take comma-separated Blink feature names. `backgroundThrottling` throttles animations and timers when the page is in the background. — [Electron web-preferences.md](https://github.com/electron/electron/blob/main/docs/api/structures/web-preferences.md) [Verified: https://github.com/electron/electron/blob/v45.3.0/docs/api/structures/web-preferences.md]

### Inferences

#### Capability matrix: Gamepad API path (Electron 45 / Chromium 156; per-device code checked on Chromium trunk)
Legend: **std** = standard mapping; **DR** = dual-rumble; **TR** = trigger-rumble; **touch** = `touchEvents` (needs flags). [I] = my inference from the code; [?] = not verified.

| Controller | Windows | macOS | Linux |
|---|---|---|---|
| Xbox Series X\|S, Xbox One / One S (USB, BT) | WGI path; std; DR; **TR** | GameController path; std; DR; TR only if GC reports trigger localities [?] | evdev; std for the Bluetooth IDs in the table (USB xpad path not checked [?]); DR; no TR code path found [I] |
| Xbox Elite Series 2 | As Xbox, plus **paddles as extra buttons after index 16** (WGI); DR; TR | As Xbox; paddles not evidenced [?] | As Xbox; paddles not evidenced [?] |
| DualSense / DualSense Edge | Raw Input (WGI ignores them); std; **no rumble** (the Raw Input haptics code covers only DS4 and three HID IDs) [I]; no DualSense touch parser found [I] | GameController; std; DR via CoreHaptics; touch code exists (Sony dimensions) [I]; TR only if GC reports trigger localities [?] | evdev via hid-playstation; std; DR (FF_RUMBLE) [I] |
| DualShock 4 (incl. 0ba0 dongle) | Raw Input + `Dualshock4Controller`; std; DR over USB and BT; touch parsed (flagged) | GameController; std; DR; touch (flagged) [I] | evdev; std; DR [I] |
| Switch Pro, Joy-Con L/R, charging grip | NintendoDataFetcher; std; DR (HD-rumble tones); Joy-Con pair merged into "Joy-Con L+R" | Same | Same |
| Switch 2 Pro, Joy-Con 2, NSO GameCube | Not recognised (no IDs). SDL needs a USB bulk-endpoint init, so probably unusable natively [I]. Usable through Steam Input over USB (search summary, not verified) | Not recognised [?] | The kernel's hid-nintendo now drives them, so they probably appear as generic evdev pads with mapping "" [I] |
| 8BitDo (mode-dependent) | X-input mode looks like an Xbox 360 pad (e.g. 2dc8:3106), so WGI and std [I]; Switch mode probably takes the Nintendo path [?] | 301b and 6012 are in the mac table, so std | No 8BitDo IDs in the Linux table, so mapping "" unless in X-input mode [I] |
| Steam Controller (2015) | No native mapping. Usable through the Steam Virtual Gamepad (28de:11ff, an Xbox 360 type) when Steam Input runs [I]; otherwise lizard mode (keyboard/mouse) | Same [I] | std (1102/1142 are in the table) through hid-steam's evdev device |
| Steam Controller 2026 ("Triton"/"Ibex", 1302–1305) | Not in the Windows table, so through the Steam Virtual Gamepad [I] | Not in the mac table [I] | std (1302–1305 are in the table) |
| Steam Deck built-in (1205) | n/a | n/a | std when hid-steam's gamepad device is active, or through the Steam Virtual Gamepad under Steam |
| Generic XInput | WGI; std; DR | XboxDataFetcher (USB) or GameController [I] | xpad evdev; mapping depends on the table [I] |
| Generic DirectInput/HID | Raw Input; mapping "" unless in the table; up to 32 buttons and 16 axes; no rumble | IOKit HID; same limits [I] | evdev/joydev; same limits [I] |

These limits apply on every OS: at most 8 pads, and no gyro, accelerometer, LEDs, adaptive triggers or battery through the Gamepad API.

#### Other inferences
- **Player count.** Chromium on Windows no longer registers the XInput fetcher, so XInput's 4-pad limit does not bind Tactilume. The hard cap is Chromium's 8 pads, on every OS. [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_platform_data_fetcher.h; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepads.h] More than 8 simultaneous gamepad players would need WebHID devices outside the Gamepad API, or the phone controller.
- **Latency.** Polling once per `requestAnimationFrame` gives roughly 60–144 Hz input, depending on the display. Chromium samples at about 250 Hz. For an Electron app the event-driven path is probably `webPreferences.enableBlinkFeatures: 'GamepadRawInputChangeEvent'`, because origin-trial tokens are awkward for `file://` or custom-scheme pages. This is experimental, so feature-detect it and fall back to rAF polling. Test it in Electron 45 before relying on it.
- **Touchpads.** To try Gamepad touch in Electron, enable both the Blink feature (`enableBlinkFeatures: 'GamepadMultitouch'`) and the browser feature (`app.commandLine.appendSwitch('enable-features', 'EnableGamepadMultitouch')`). The browser-feature string is confirmed: the two-argument `BASE_FEATURE(kEnableGamepadMultitouch, …)` form names a feature by dropping the leading `k`, so the switch value is `EnableGamepadMultitouch`. Its runtime effect in Electron 45 still needs testing. [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/base/feature.h; https://github.com/chromium/chromium/blob/156.0.8078.96/base/feature_internal.h] Read both `gamepad.touches` (spec name) and `gamepad.touchEvents` (Chromium's name). On Windows only the DualShock 4 path parses touch, so DualSense touch on Windows needs WebHID.
- **Gesture gating.** Show a "press any button to join" screen. Pads stay invisible until the first press or a stick deflection above 0.5. Because a gamepad press counts as a user activation when the window is visible (in Electron 45; from Chromium 159, so Electron 46, it must also be focused), a "press A to enable advanced features" prompt could start `navigator.hid.requestDevice()`, which needs transient activation. [Verified correction: https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/navigator_gamepad.cc; https://github.com/chromium/chromium/blob/159.0.8154.0/third_party/blink/renderer/platform/runtime_enabled_features.json5] In Electron, `setDevicePermissionHandler` can avoid the chooser entirely (see section 2).
- **Window visibility.** Gamepad updates stop while a page is hidden (for example a minimised or `show:false` window). Keep input handling in the visible main window. [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/navigator_gamepad.cc]
- **DualSense rumble on Windows.** Chromium's Raw Input path has no DualSense haptics, so rumble for DualSense on Windows needs WebHID output reports. [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/raw_input_gamepad_device_win.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad_features.cc]
- **Trigger-rumble scope.** Trigger-rumble through the Gamepad API is effectively Xbox-on-Windows only, with macOS a possible extra. Treat it as an optional enhancement, not a core mechanic.

### Gaps
- I could not read chromestatus, so the GamepadRawInputChangeEvent origin-trial milestones (start/end) are unknown.
- I did not confirm whether the Elite 2 paddles reach the Gamepad API on macOS or Linux, or whether WGI itself limits how many gamepads it reports.
- The 4 ms polling interval and the per-OS mapping tables were first read on trunk (160). The fact-check closed this: the interval is the same at the 156 tag, and the Windows, macOS and Linux mapping tables and `gamepad_id_list.cc` are byte-identical at 156.0.8078.96 and on trunk. [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_provider.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_standard_mappings_linux.cc]
- I did not verify which macOS GameController models report trigger haptic localities. That decides whether trigger-rumble works on Mac for Xbox Series pads or DualSense. The fact-check found that Apple documents `leftTrigger`, `rightTrigger` and `triggers` localities (macOS 11+) but does not say which controllers report them, so this stays open. [Verified: https://developer.apple.com/documentation/gamecontroller/gchapticslocality]
- The exact `Gamepad.id` string format, which an app would use to match Gamepad API pads to WebHID devices, was not verified in source.

## 2. WebHID in Chrome and Electron: availability, Electron handlers, blocklisted and protected usages, which controllers can be opened (USB/Bluetooth), OS-level conflicts

### Takeaway
WebHID works in Chromium-based browsers and in Electron through session handlers. Nothing in Chromium's static HID blocklist touches Sony, Nintendo, Microsoft or Valve gamepads. Chromium's always-protected usages cover keyboards, mice, pointers, keypads and system controls, not the Gamepad or Joystick usages. [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/services/device/public/cpp/hid/hid_blocklist.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/services/device/public/cpp/hid/hid_report_utils.cc] So DualSense, DualShock 4, Switch Pro and Joy-Con can be opened over USB and Bluetooth, with the caveats below. The practical blockers are elsewhere:
- Linux needs udev rules for hidraw access.
- Steam's client opens many controllers' hidraw nodes itself.
- Switch 2 controllers need a non-HID (bulk USB) initialisation.
- Xbox pads over USB are not HID devices.

### Cited Findings
- The coordinator measured that headless Chromium 153.0.8010.12 (Playwright 1.63.0, Linux) exposes `navigator.hid`; no physical pad was tested. MDN lists WebHID in Chrome 89+ (Edge mirrors Chrome) and not in Firefox or Safari. [Verified: measured in this container; https://github.com/mdn/browser-compat-data/blob/main/api/HID.json]
- WebHID spec:
  - `requestDevice()` rejects unless there is transient activation.
  - In an `inputreport` event, `data` is a DataView of the report **excluding the report-ID byte** whenever the interface uses report IDs, and `reportId` is given separately.
  - `receiveFeatureReport(reportId)` rejects with a TypeError if `reportId` is 0 on an interface that uses report IDs, or non-zero on one that does not.
  - Source: [WICG WebHID spec source (index.bs)](https://github.com/WICG/webhid/blob/main/index.bs) [Verified: https://github.com/WICG/webhid/blob/main/index.bs]
- Electron's WebHID hooks:
  - The session's `select-hid-device` event picks the device when `navigator.hid.requestDevice` is called.
  - `hid-device-added` and `hid-device-removed` fire only until the `select-hid-device` callback runs; they are not general device listeners.
  - `ses.setDevicePermissionHandler(handler)` grants devices without a `requestDevice` prompt, and is also how an app persists grants. By default Electron keeps a grant only for the lifetime of the WebContents.
  - `ses.setPermissionCheckHandler(handler)` can deny HID for specific origins (`permission === 'hid'`, `details.deviceType === 'hid'` in the examples).
  - Sources: [Electron devices tutorial](https://github.com/electron/electron/blob/main/docs/tutorial/devices.md); [Electron session.md](https://github.com/electron/electron/blob/main/docs/api/session.md) [Verified: https://github.com/electron/electron/blob/v45.3.0/docs/tutorial/devices.md; https://github.com/electron/electron/blob/v45.3.0/docs/api/session.md]
- Chromium's static HID blocklist (`kStaticEntries`) covers:
  - every top-level collection on the FIDO usage page;
  - a list of security keys (Yubikey, Feitian, HyperFIDO, Titan, Nitrokey, OnlyKey, and others);
  - "Jabra access to certain proprietary functionality".
  - There are no gamepad vendors in it. The same file also parses extra entries from a string in the form `vendor:product:usage_page:usage:report_id:report_type`.
  - Source: [hid_blocklist.cc](https://github.com/chromium/chromium/blob/main/services/device/public/cpp/hid/hid_blocklist.cc) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/services/device/public/cpp/hid/hid_blocklist.cc]
- `IsAlwaysProtected()` protects:
  - the Keyboard usage page;
  - Generic Desktop Pointer, Mouse, Keyboard and Keypad (input/output reports; feature reports allowed);
  - Generic Desktop System Control through System Warm Restart;
  - System Dock through System Display Swap.
  - Nothing else is protected, so Gamepad (0x05) and Joystick (0x04) collections are not.
  - Source: [hid_report_utils.cc](https://github.com/chromium/chromium/blob/main/services/device/public/cpp/hid/hid_report_utils.cc) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/services/device/public/cpp/hid/hid_report_utils.cc]
- Valve's `60-steam-input.rules` gives hidraw `uaccess` (82 occurrences) to Valve devices and to many pads:
  - DualShock 3; DualShock 4 (USB, Bluetooth, wireless adapter, Slim); DualSense and DualSense Edge (USB and Bluetooth); Switch Pro (USB and Bluetooth); Joy-Con L/R; many third-party Switch/PS4 pads.
  - Its comments mention a "Steam Controller 2026 receiver".
  - Source: [Valve steam-devices 60-steam-input.rules](https://github.com/ValveSoftware/steam-devices/blob/master/60-steam-input.rules) [Verified: https://github.com/ValveSoftware/steam-devices/blob/master/60-steam-input.rules]
- On Linux, Chromium's Gamepad API opens hidraw only for allowlisted IDs (`kAllowlistHidrawGamepads`). — [gamepad_features.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/public/cpp/gamepad_features.cc)
- The kernel's hid-steam driver notes that Steam Client and similar apps "use the hidraw interface directly to create input devices (XTest, uinput...)". The driver creates a layered hidraw device so it can tell when the client is running. — [hid-steam.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-steam.c)
- SDL drives Switch 2 controllers over libusb **bulk** endpoints (claiming an interface). Bluetooth returns "Nintendo Switch2 controllers not supported over Bluetooth" (a FIXME). — [SDL_hidapi_switch2.c](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_switch2.c)
- Chromium has a dedicated handler for "Bluetooth-connected Xbox One gamepads" over HID. SDL's driver list has a separate GIP driver (`SDL_HIDAPI_DriverGIP`). — [xbox_hid_controller.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/xbox_hid_controller.cc); [SDL_hidapijoystick_c.h](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapijoystick_c.h)
- Libraries claim WebHID support over USB and Bluetooth:
  - dualsense-ts: "supports wired and wireless connections in both node.js and the browser"; in browsers "only Chrome, Edge, and Opera are compatible".
  - WebHID-DS4: "USB and Bluetooth connectivity".
  - Sources: [dualsense-ts README](https://github.com/nsfm/dualsense-ts); [WebHID-DS4 README](https://github.com/TheBITLINK/WebHID-DS4)

### Inferences

#### Capability matrix: WebHID / native-protocol path (what WebHID adds beyond the Gamepad API)

| Controller | Open via WebHID? | Motion (scale; rate) | Touch | Outputs | JS library (licence) |
|---|---|---|---|---|---|
| DualSense / Edge | Yes, USB and BT (no blocklist entry; usage not protected) | gyro 1024 LSB per °/s (±2048 °/s), accel 8192 LSB/g (±4 g); 250 Hz USB, ~1000 Hz BT, Edge 1000 Hz USB (SDL) | 2 points, 1920×1080 | rumble (compatible or haptics mode), adaptive triggers, lightbar RGB, player LEDs, mute LED | dualsense-ts (**LGPL-3.0**); dualsense-tester (MIT, an app); nondebug/dualsense (docs plus an explorer; **no licence file**) |
| DualShock 4 | Yes, USB and BT | same scale; BT default poll 4 ms (about 250 Hz) | 2 points, 1920×942 | rumble, lightbar RGB and blink | webhid-ds4 (MIT) |
| Switch Pro / Joy-Con | Yes (the Pro over USB needs the 0x80 handshake/no-timeout commands) | accel 4096 LSB/g, gyro 14.247 LSB per °/s; IMU reports about every 15 ms, sensors at 200 Hz (SDL) | none | HD rumble, player lights, Home LED | joy-con-webhid (Apache-2.0) |
| Switch 2 Pro / Joy-Con 2 / NSO GC | USB init is a bulk (non-HID) transfer, so WebHID alone is probably insufficient; WebUSB untested [I]. BT unsupported in SDL | SDL reads gyro/accel after init | none | rumble | none found |
| Steam Controller 2015 / 2026, Steam Deck | HID with a vendor protocol. Steam's client opens hidraw and lizard mode must be disabled. The 2026 model needs rumble refreshed every 40 ms (SDL) | 2026 model and Deck: ±2000 °/s, ±2 g, about 250 Hz (SDL) | trackpads | rumble | none found |
| 8BitDo Ultimate 2 Wireless (fw ≥ 1.03) / Ultimate 3 | Possible (SDL has a HIDAPI driver) | sensors supported (SDL) | none | rumble | none found |
| Xbox (any) | BT HID only; USB is GIP, not HID [I] | none | none | none useful | not useful |

#### Other inferences
- **Recommended architecture.** Use the Gamepad API as the universal base layer for buttons and sticks. Add a WebHID enhancement layer for Sony and Nintendo pads (gyro, touch, LEDs, adaptive triggers and DualSense rumble on Windows). In Electron:
  - In `select-hid-device`, filter by vendor 054c or 057e and the Gamepad (0x05) usage, and call back with the chosen `deviceId`.
  - Use `setDevicePermissionHandler` to auto-grant known controller IDs, so returning players never see a chooser. Call `navigator.hid.getDevices()` at startup.
- **Linux.** On distros without Steam's udev rules, WebHID opens will fail for lack of hidraw permissions. Ship equivalent `uaccess` rules or document installing `steam-devices`.
- **Double input.** On Linux the Gamepad API reads Sony pads through evdev while WebHID uses hidraw, so both can probably run at once [I]. When both are active, the app must dedupe: treat the WebHID device and the Gamepad API pad with the same vendor/product (and matching timing of input changes) as one player.
- **Output-report conflicts.** If Steam, DS4Windows-type tools or the OS driver also write output reports, LEDs and rumble may fight. Re-assert lightbar state periodically and offer an "advanced features off" toggle.
- **Electron and remote config.** Electron builds do not receive Chrome's remote field-trial configuration. Electron 45 builds its feature list only from `--enable-features`/`--disable-features` plus a short hard-coded list, none of it gamepad- or HID-related, and creates field trials only from `--force-fieldtrials`. [Verified: https://github.com/electron/electron/blob/v45.3.0/shell/browser/feature_list.cc] So remotely pushed HID blocklist additions do not apply, and behaviour follows compiled-in defaults plus the app's own switches. Whether origin-trial tokens work in an Electron page was not checked. [Unverified]

### Gaps
- I found no source on whether Windows allows a HID gamepad to be opened by WebHID while another process (Steam, DS4Windows, HidHide) holds it. Exclusive-access behaviour on Windows and macOS is unverified.
- I did not verify whether macOS asks for an Input Monitoring (or other) permission before WebHID opens a gamepad, or how that interacts with the GameController framework holding the device.
- What Electron does if `select-hid-device` is not handled: the fact-check found that unless a listener calls `event.preventDefault()`, Electron runs the callback with no device, so `requestDevice()` resolves with an empty list. It never picks the first device. [Verified: https://github.com/electron/electron/blob/v45.3.0/shell/browser/hid/hid_chooser_controller.cc]
- I could not see the contents of any remotely pushed (Finch) HID blocklist.
- Whether WebUSB in Electron can claim the Switch 2 controllers' bulk interface on Windows (driver binding) is unknown.

## 3. DualSense / DualSense Edge over WebHID: input report layouts (USB 0x01, Bluetooth 0x31), gyro/accelerometer scaling and calibration (feature 0x05), sample rate, touchpad, battery; outputs (rumble, adaptive triggers, lightbar, player and mute LEDs); Bluetooth CRC32; libraries and licences

### Takeaway
The Linux kernel driver gives a complete, citable byte map. The input body is a 63-byte struct that starts right after the report ID on USB, and one byte later on Bluetooth (report 0x31, 78 bytes with a trailing CRC32). It carries sticks, triggers, buttons, gyro and accel as int16, a 32-bit sensor timestamp in 1/3 µs units, two touch points, and status (battery and charging). Output uses a 47-byte common block holding rumble, two 11-byte adaptive-trigger blocks, lightbar, player LEDs and mute LED. On Bluetooth that block sits inside report 0x31 with a sequence/tag header and a CRC32 seeded with 0xA2. Of the JavaScript libraries, dualsense-ts is the most complete, but it is LGPL-3.0.

### Cited Findings
**Reports and sizes**
- Input reports: USB 0x01 (64 bytes) and BT 0x31 (78 bytes).
- Output reports: USB 0x02 (63 bytes) and BT 0x31 (78 bytes).
- Feature reports: calibration 0x05 (41 bytes), pairing info 0x09 (20 bytes), firmware info 0x20 (64 bytes).
- CRC seeds: input 0xA1, output 0xA2, feature 0xA3.
- Source: [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c) [Verified: https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c]
- The kernel comment says "DualSense in USB uses the full HID report for reportID 1, but Bluetooth uses a minimal HID report for reportID 1 and reports the full report using reportID 49". On USB the struct starts at `&data[1]`; on BT it starts at `&data[2]`, and "Last 4 bytes of input report contain crc32". — [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c)
- SDL detects the mode from the first report:
  - 64 bytes means USB.
  - First byte 0x31 means "Bluetooth, using enhanced reports".
  - Anything else means "Bluetooth, using simple reports (DirectInput enabled)".
  - SDL's PS5 feature-report IDs are 0x03 capabilities, 0x05 calibration, 0x09 serial number and 0x20 firmware info.
  - Source: [SDL_hidapi_ps5.c](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_ps5.c)

**Input body layout** (`struct dualsense_input_report`, in byte order)
- Sticks: x, y, rx, ry.
- Analog L2/R2: z, rz.
- `seq_number`, then `buttons[4]`, then `reserved[4]`.
- `gyro[3]` and `accel[3]`, as little-endian int16.
- `sensor_timestamp`, little-endian uint32.
- One reserved byte, then two touch points: contact, x_lo, x_hi:4/y_lo:4, y_hi.
- `reserved3[12]`, `status[3]`, `reserved4[8]`.
- Source: [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c)

**Buttons, touch, timestamp and battery**
- buttons[0]: bits 0–3 hat, bit 4 Square, 5 Cross, 6 Circle, 7 Triangle.
- buttons[1]: L1, R1, L2, R2, Create, Options, L3, R3.
- buttons[2]: PS, touchpad click, mic mute.
- A touch point is inactive when bit 7 of `contact` is set (`DS_TOUCH_POINT_INACTIVE`).
- The sensor timestamp is converted to µs by dividing by 3.
- Battery capacity is `min(battery_data * 10 + 5, 100)`. `status[0]` bits 0–3 hold the capacity and bits 4–7 the charging state.
- Source: [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c)
- nondebug's USB map, counted with the report ID at byte 0:
  - Bytes 1–4: sticks (0x00 left/up, 0xff right/down, neutral about 0x80).
  - Bytes 5–6: L2/R2 (0x00–0xff).
  - Hat: neutral 0x8, N 0x0, NE 0x1, E 0x2, SE 0x3, S 0x4, SW 0x5, W 0x6, NW 0x7.
  - The repo also documents the Bluetooth simple 0x01 layout, which differs from USB, and links a "DualSense explorer" WebHID tool. It has no LICENSE file (LICENSE and LICENSE.md both returned 404; the fact-check also tried LICENSE.txt, LICENCE, COPYING and three other names, while the README itself loads). [Verified: https://github.com/nondebug/dualsense]
  - Source: [nondebug/dualsense README](https://github.com/nondebug/dualsense)

**Scaling and calibration**
- After calibration the kernel normalises to `DS_ACC_RES_PER_G = 8192` (range ±4 g) and `DS_GYRO_RES_PER_DEG_S = 1024` (range ±2048 °/s). The touchpad is 1920×1080. — [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c) [Verified: https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c]
- Calibration feature report 0x05, little-endian int16 fields, offsets counted from the report-ID byte at buf[0]:

  | Field | Offset (buf[]) |
  |---|---|
  | gyro pitch, yaw, roll bias | 1, 3, 5 |
  | gyro pitch +/− | 7, 9 |
  | gyro yaw +/− | 11, 13 |
  | gyro roll +/− | 15, 17 |
  | gyro speed +/− | 19, 21 |
  | accel x +/− | 23, 25 |
  | accel y +/− | 27, 29 |
  | accel z +/− | 31, 33 |

  Source: [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c)
- Calibration formulas in the kernel:
  - Gyro sensitivity = (speed+ + speed−) × 1024 / (|plus − bias| + |minus − bias|), per axis. The kernel sets the gyro `bias` term to 0.
  - Accel: range_2g = plus − minus; bias = plus − range_2g/2; sensitivity denominator = range_2g.
  - gyro[0], gyro[1] and gyro[2] map to pitch (ABS_RX), yaw (ABS_RY) and roll (ABS_RZ).
  - Source: [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c)

**Sample rate**
- SDL: "Standard DualSense sensor update rate is 250 Hz over USB". "Bluetooth sensor update rate appears to be 1000 Hz". "DualSense Edge sensor update rate is 1000 Hz over USB". SDL exposes a touchpad with 2 fingers. — [SDL_hidapi_ps5.c](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_ps5.c) [Verified: https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_ps5.c]

**Output reports**
- USB: report 0x02, then the 47-byte common block, then `reserved[15]`. BT: report 0x31, `seq_tag`, `tag` (= 0x10; "Tag must be set. Exact meaning is unclear."), the common block, `reserved[24]`, then a little-endian CRC32. — [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c)
- Common block offsets:

  | Offset | Field |
  |---|---|
  | 0, 1 | valid_flag0, valid_flag1 |
  | 2, 3 | motor right, motor left |
  | 4, 5, 6 | headphone, speaker, mic volume |
  | 7 | audio control |
  | 8 | mute-button LED |
  | 9 | power-save control |
  | 10–20 | **right trigger effect** (11 bytes) |
  | 21–31 | **left trigger effect** (11 bytes) |
  | 37 | audio control 2 |
  | 38 | valid_flag2 |
  | 41 | lightbar setup |
  | 42 | LED brightness |
  | 43 | player LEDs |
  | 44–46 | lightbar R, G, B |

  Sources: [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c) for the common struct; [SDL_hidapi_ps5.c](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_ps5.c) for the trigger offsets (`DS5EffectsState_t`)
- Valid-flag bits:
  - flag0: bit 0 compatible vibration, bit 1 haptics select, **bit 2 right trigger motor enable, bit 3 left trigger motor enable**, bit 4 headphone volume, bit 5 speaker volume, bit 6 mic volume, bit 7 audio control.
  - flag1: bit 0 mic-mute LED, bit 1 power save, bit 2 lightbar, bit 3 release LEDs, bit 4 player indicator, bit 7 audio control 2.
  - flag2: bit 1 lightbar setup, bit 2 "compatible vibration 2".
  - The kernel sets `lightbar_setup` to LIGHT_OUT ("Fade light out.") during setup.
  - Sources: [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c); [dualsensectl main.c](https://github.com/nowrep/dualsensectl/blob/HEAD/main.c)
- Each adaptive-trigger block is a mode byte plus 10 parameter bytes. Mode bytes: off 0x05, feedback 0x21, bow 0x22, galloping 0x23, weapon 0x25, vibration 0x26, machine 0x27. — [dualsensectl main.c](https://github.com/nowrep/dualsensectl/blob/HEAD/main.c)
- dualsensectl's command-line parameters per mode:
  - `feedback POSITION STRENGTH`
  - `weapon START STOP STRENGTH`
  - `bow START STOP STRENGTH SNAPFORCE`
  - `galloping START STOP FIRST_FOOT SECOND_FOOT FREQUENCY`
  - `machine START STOP STRENGTH_A STRENGTH_B FREQUENCY PERIOD`
  - `vibration POSITION AMPLITUDE FREQUENCY`
  - `feedback-raw STRENGTH[10]`
  - `vibration-raw AMPLITUDE[10] FREQUENCY`
  - a raw `MODE [PARAMS]` form (up to 9 parameters)
  - Source: [dualsensectl README](https://github.com/nowrep/dualsensectl)
- Other dualsensectl controls: rumble/trigger attenuation (0–7), lightbar RGB plus brightness (0–255), LED dimming (0–2), player-LED patterns 1–7 (0 = off), and mic LED on/off/pulse. — [dualsensectl README](https://github.com/nowrep/dualsensectl)

**Libraries and licences**
- **dualsense-ts**: npm 6.15.38 (2026-07-12), licence **LGPL-3.0**; the LICENSE file is GNU LGPL v3. It supports:
  - Bluetooth and USB, in the browser via WebHID (Chrome, Edge, Opera) or in Node via `node-hid`;
  - lightbar, player LEDs and mute LED;
  - left/right rumble and trigger effects;
  - two-touch touchpad normalised to −1…1;
  - factory-calibrated gyro and accel with orientation tracking and shake detection;
  - battery level and charging state;
  - DualSense Access controllers.
  - Sources: [npm: dualsense-ts](https://registry.npmjs.org/dualsense-ts); [dualsense-ts README and LICENSE](https://github.com/nsfm/dualsense-ts) [Verified: https://registry.npmjs.org/dualsense-ts; https://github.com/nsfm/dualsense-ts/blob/HEAD/LICENSE]
- **daidr/dualsense-tester**: MIT (© 2023 Xuezhou Dai). A browser tester for DualSense, DualSense Edge and DualShock 4: touchpad, gyro/accel, adaptive triggers, plus DualSense Edge profile customisation. — [dualsense-tester README and LICENSE](https://github.com/daidr/dualsense-tester) [Verified: https://github.com/daidr/dualsense-tester/blob/HEAD/LICENSE]
- **dualsensectl**: GPL-2.0, a C command-line tool. — [dualsensectl LICENSE](https://github.com/nowrep/dualsensectl) [Verified: https://github.com/nowrep/dualsensectl/blob/HEAD/LICENSE]
- **SDL**: the file header shows SDL's zlib-style "provided 'as-is'" licence text. — [SDL_hidapi_ps5.c](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_ps5.c)

### Inferences
- **WebHID offsets.** WebHID strips the report-ID byte, so the input body starts at `data` offset **0** on USB (reportId 0x01) and offset **1** on Bluetooth (reportId 0x31). Relative to that start:
  - LX 0, LY 1, RX 2, RY 3, L2 4, R2 5, seq 6, buttons 7–10;
  - gyro int16 LE at 15/17/19 (pitch/yaw/roll);
  - accel at 21/23/25;
  - timestamp uint32 at 27;
  - touch 0 at 32–35 and touch 1 at 36–39;
  - status at 52–54.
  - These are derived from the kernel struct and match nondebug's map, where USB byte 1 is LX when the ID is counted as byte 0. [Verified: https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c]
- **Touch decode.** x = x_lo | ((byte2 & 0x0F) << 8) and y = (byte2 >> 4) | (y_hi << 4). This matches Chromium's 12-bit DS4 parser. The low 7 bits of `contact` are probably a tracking ID [I, not verified].
- **Bluetooth CRC.** Compute standard CRC-32 over the seed byte (0xA2) followed by the report ID and the next 73 bytes, and write it little-endian into the last 4 bytes. With WebHID `sendReport(0x31, body)` the body is 77 bytes: `seq_tag`, `tag` 0x10, the 47-byte common block, 24 reserved bytes and the CRC. Input CRCs (seed 0xA1) can be checked the same way to drop corrupt BT frames. [Verified: https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c]
- **Rumble mapping.** Use compatible vibration (flag0 bit 0, plus flag2 bit 2 on newer firmware) for classic rumble. By the common convention, motor-left is the strong/low-frequency motor and motor-right the weak/high-frequency one [not verified in fetched code].
- **Sensor rate.** At 250–1000 Hz the sensor arrives faster than the render frame rate. Integrate gyro per report using timestamp deltas, not per animation frame.
- **Licences.** dualsense-ts is LGPL-3.0. For a commercial Electron app, dynamic linking or keeping it as a separately replaceable module is the usual way to comply with LGPL. Writing an in-house parser from the kernel's documented layout (GPL code read for facts, not copied) avoids the question. nondebug/dualsense has no licence, so treat it as reference only.

### Gaps
- I did not confirm how to force Bluetooth from simple (0x01) to full (0x31) reports. The kernel reads feature reports 0x05 and 0x20 at probe, and SDL only detects the mode; community code reportedly requests feature 0x05, but that was not verified here.
- Whether `receiveFeatureReport()` includes the report-ID byte as byte 0 in Chromium (which would shift the calibration offsets above by one) was not verified in Chromium. The WebHID spec says the returned data "may" start with the report ID, because it is whatever the OS returns, so a parser should check byte 0 and accept both layouts. [Verified: https://github.com/WICG/webhid/blob/main/index.bs]
- Parameter ranges for the trigger modes (zones 0–9, strength 0–8, and so on), the official-effect bit-packing details, Nielk1's TriggerEffectGenerator (gist unreachable) and its licence were not checked.
- DualSense Edge-specific reports (paddles, profiles) and the DualSense haptics-select (audio-driven) mode were not researched.

## 4. DualShock 4 and Switch Pro / Joy-Con (and Switch 2) over WebHID: enabling the IMU, report layouts, calibration; libraries and licences

### Takeaway
- **DualShock 4.** Over USB it always streams full 64-byte reports with IMU and touch. Over Bluetooth it starts in a 10-byte "minimal" report 0x01 and switches to the 78-byte 0x11 report, with CRC32, once it is driven, for example by an output/effects report. Calibration is feature 0x02 on USB and 0x05 on Bluetooth, and the gyro field order differs between the two.
- **Switch Pro and Joy-Con.** They need subcommands: 0x03 to set the 0x30 full report mode and 0x40 to enable the IMU. Calibration is read from SPI flash (0x6020 factory IMU, 0x8026 user magic). The Pro over USB first needs the 0x80 handshake.
- **Switch 2.** Pads are supported in the 2026 Linux kernel. SDL supports them only over USB after a bulk-endpoint initialisation, and not over Bluetooth, so they are not WebHID-ready.

### Cited Findings
**DualShock 4**
- Report IDs and sizes:
  - Input: USB 0x01 (64 bytes); BT minimal 0x01 (10 bytes); BT full 0x11 (78 bytes).
  - Output: USB 0x05 (32 bytes); BT 0x11 (78 bytes).
  - Feature: calibration 0x02 on USB (37 bytes) and 0x05 on BT (41 bytes); firmware 0xA3; pairing 0x12.
  - BT hardware-control byte: CRC flag 0x40, HID flag 0x80, poll-interval mask 0x3F, default BT poll interval 4 ms.
  - Source: [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c) [Verified: https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c]
- Input layout:
  - Common struct: x, y, rx, ry, `buttons[3]`, z, rz, `sensor_timestamp` (le16), temperature, `gyro[3]`, `accel[3]`, `reserved[5]`, `status[2]`, reserved.
  - BT 0x11 wrapper: `reserved[2]` before the common struct, then `num_touch_reports` and `touch_reports[4]` ("BT has 4 compared to 3 for USB"), then the CRC32.
  - The timestamp converts to µs as ×16/3.
  - Scaling 8192/g and 1024 per °/s; touchpad 1920×942.
  - Source: [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c) [Verified: https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c]
- Calibration:
  - Bias at buf[1], [3], [5].
  - USB order: pitch+, pitch−, yaw+, yaw−, roll+, roll− at buf[7..17].
  - BT/dongle order: pitch+, yaw+, roll+, pitch−, yaw−, roll− at buf[7..17].
  - Speed± at 19/21; accel± at 23–33.
  - Source: [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c)
- Output common block: `valid_flag0`, `valid_flag1`, reserved, `motor_right`, `motor_left`, lightbar R/G/B, blink on, blink off. — [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c)
- SDL warns: "We can't even send an invalid effects packet, or it will put the controller in enhanced mode". It exposes enhanced-report settings "0", "1" and "auto", and sets the sensor rate to `1000 / report_interval` Hz. — [SDL_hidapi_ps4.c](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_ps4.c)
- **WebHID-DS4** (npm `webhid-ds4` 1.0.5, 2026-02-16, **MIT**, © 2019 TheBITLINK): USB and Bluetooth, gyro and accel, touchpad, lightbar RGB, rumble motors. — [WebHID-DS4 README and LICENSE](https://github.com/TheBITLINK/WebHID-DS4); [npm: webhid-ds4](https://registry.npmjs.org/webhid-ds4) [Verified: https://registry.npmjs.org/webhid-ds4; https://github.com/TheBITLINK/WebHID-DS4/blob/HEAD/LICENSE]

**Switch Pro / Joy-Con**
- Report IDs:
  - Output: 0x01 rumble plus subcommand, 0x10 rumble only, 0x11 MCU data, 0x80 USB command.
  - Input: 0x3F button event (simple HID), 0x21 subcommand reply, **0x30 full report with IMU**, 0x31 MCU data, 0x81 USB response.
  - Source: [hid-nintendo.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c)
- Subcommands include 0x02 device info, **0x03 set report mode**, 0x10 SPI flash read, **0x30 set player lights**, **0x38 set Home light**, **0x40 enable IMU**, 0x41 IMU sensitivity, **0x48 enable vibration** and 0x50 regulated voltage. — [hid-nintendo.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c)
- Pro Controller USB commands (sent in report 0x80): 0x01 connection status, 0x02 handshake, 0x03 3 Mbit baud rate, 0x04 no timeout, 0x05 enable timeout, 0x06 reset. — [hid-nintendo.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c)
- SPI calibration addresses:
  - Factory stick calibration 0x603D (left) and 0x6046 (right).
  - User stick calibration magic at 0x8010 (data 0x8012) and 0x801B (data 0x801D).
  - Factory IMU calibration 0x6020–0x6037.
  - User IMU magic 0x8026 (data 0x8028).
  - Source: [hid-nintendo.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c)
- IMU scaling and timing:
  - Accel 4096 LSB/g; gyro 14.247 LSB per °/s (`JC_IMU_GYRO_RES_PER_DPS 14247` / 1000).
  - "Under most circumstances IMU reports are pushed every 15ms".
  - Valid report deltas are 8–17 ms.
  - Subcommand rate limit: 20 ms over USB, 60 ms over BT.
  - The driver's author also sees 11 ms report intervals on some set-ups, and each IMU input report carries 3 samples ("usually 5ms apart"), so 200 Hz at a 15 ms interval.
  - Source: [hid-nintendo.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c) [Verified: https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c]
- SDL registers Switch gyro and accel at 200 Hz, including separate left and right sensors for a combined Joy-Con pair. — [SDL_hidapi_switch.c](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_switch.c) [Verified: https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_switch.c]
- **joy-con-webhid** (npm 0.11.0, 2025-07-17, **Apache-2.0**):
  - reads buttons, sticks, LEDs, gyro and accelerometer;
  - `enableIMUMode()`;
  - `rumble(600, 600, 0.5)`.
  - Its README notes that the Gamepad API "does not have a concept of orientation", so "the Joy-Cons' accelerometer and gyroscope data cannot be accessed" that way.
  - Sources: [joy-con-webhid README and LICENSE](https://github.com/tomayac/joy-con-webhid); [npm: joy-con-webhid](https://registry.npmjs.org/joy-con-webhid) [Verified: https://registry.npmjs.org/joy-con-webhid; https://github.com/tomayac/joy-con-webhid/blob/HEAD/LICENSE]

**Switch 2**
- hid-nintendo's header now reads "Nintendo Switch 2 Joy-Cons, Pro Controller, and GameCube Controller". It carries "Copyright (c) 2026 Valve Software", cites ndeadly/switch2_controller_research, and has a "Switch 2 support" section with `NS2_*` button maps. — [hid-nintendo.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c) [Verified: https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c]
- SDL's Switch 2 driver covers the GameCube controller, Joy-Con L/R and Pro over USB via libusb bulk transfers. Bluetooth: "FIXME: Need to add Bluetooth support". It has gyro/accel bias calibration fields, rumble sent every 12 ms (`RUMBLE_INTERVAL`) and `RUMBLE_MAX 29000`. — [SDL_hidapi_switch2.c](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_switch2.c) [Verified: https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_switch2.c]
- Press, search summary only, not verified: the Steam client added Switch 2 Pro Controller (and GameCube controller) support in November 2025, wired USB on Windows, with Bluetooth not working in Steam. [Unverified] Primary-source support for the USB-only part: Valve's udev rules grant raw USB-device (not hidraw) access to the Switch 2 Joy-Con L/R, Pro and GameCube controllers over USB, and have no Bluetooth rule for them. [Verified: https://github.com/ValveSoftware/steam-devices/blob/master/60-steam-input.rules] — [Nintendo Life (Nov 2025)](https://nintendolife.com/news/2025/11/valves-steam-client-adds-switch-2-pro-controller-support); [Final Weapon (2025-11-26)](https://finalweapon.net/2025/11/26/steam-nintendo-switch-2-pro-controller-gamecube-controller/); [TechRadar](https://www.techradar.com/gaming/the-nintendo-switch-2-pro-controller-is-now-supported-on-steam); [PC Gamer](https://www.pcgamer.com/uk/how-to-use-a-nintendo-switch-pro-controller-on-pc)

### Inferences
- **DS4 offsets in WebHID.** The common body starts at `data` offset 0 for USB 0x01 and at offset 2 for BT 0x11 (after two reserved bytes; the report ID is stripped). Relative to the body start: gyro int16 at 12/14/16 and accel at 18/20/22.
- **Getting DS4 Bluetooth full reports.** Send one valid output report 0x11 (lightbar colour plus zero rumble, with CRC seed 0xA2) or request feature 0x05. The SDL comment shows that any effects packet switches the pad into enhanced mode.
- **Switch IMU start-up sequence.** For a Pro over USB, first send 0x80 0x02 and then 0x80 0x04 (no timeout). Then send subcommand 0x40 with argument 0x01 (IMU on) and 0x03 with 0x30 (full mode), and read calibration through 0x10 SPI reads. Respect the 20/60 ms subcommand spacing. Each 0x30 report carries 3 IMU samples (200 Hz at a 15 ms report interval), so integrate every sample. [Verified: https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c]
- **Switch 2.** Plan on Steam Input (USB) or the Linux kernel driver. Do not plan on WebHID for Switch 2 in 2026.

### Gaps
- The exact 0x30 input layout (stick packing and the byte offsets of the 3 IMU samples) and the HD-rumble encoding were not extracted. The kernel driver and dekuNukem's notes (cited by the kernel) are the references.
- Whether Joy-Con 2 or Pro 2 expose any HID path on Windows or macOS without the bulk init, or whether Chrome's WebUSB can do the init, is unknown.

## 5. Gyro best practice: player, world and local space, calibration, tightening, smoothing, acceleration; sensor fusion (Madgwick/Mahony); gyro as a 2D pointer vs 3D orientation

### Takeaway
GyroWiki itself was unreachable. Jibb Smart's own GitHub documentation (the JoyShockMapper README and the GamepadMotionHelpers README, which link the GyroWiki articles) gives the same doctrine:
- Calibrate bias while the pad is still, and offer manual recalibration.
- Map angular velocity to cursor velocity ("gyro is a mouse") at a real-world sensitivity.
- Use player space (gravity-aware yaw with a relax factor of 1.41) as the default space.
- Use two-threshold acceleration rather than cutoffs.
- Smooth only very slow motion, and use tightening sparingly.

Absolute 3D orientation needs sensor fusion, and its yaw drifts without a magnetometer.

### Cited Findings
- **Calibration** (JoyShockMapper README):
  - Gyros need a "zero". Calibrate by leaving the controller still and averaging velocity over a short time to cancel noise.
  - Temperature changes the zero, so recalibration after warm-up can help.
  - Every auto-calibration "will sometimes interpret slow and steady movement as the controller being held still".
  - Manual calibration is a restart/finish pair, or tapping or holding the PS, touchpad, Home or Capture button.
  - Source: [JoyShockMapper README](https://github.com/Electronicks/JoyShockMapper/blob/HEAD/README.md)
- **Sensitivity** (JoyShockMapper README):
  - `GYRO_SENS` 1 means the in-game angle equals the controller angle.
  - For an on-screen cursor, "you'll be better off with a GYRO_SENS of 8 or more", meaning a 45° turn crosses the screen.
  - Acceleration is set with `MIN/MAX_GYRO_THRESHOLD` (real-world °/s) and `MIN/MAX_GYRO_SENS`, linearly interpolated between the two thresholds.
  - Source: [JoyShockMapper README](https://github.com/Electronicks/JoyShockMapper/blob/HEAD/README.md)
- **Space and axes** (JoyShockMapper README):
  - `GYRO_SPACE` defaults to LOCAL, where one controller axis drives horizontal and one drives vertical. This "can feel off as you tilt your controller".
  - PLAYER_TURN combines gyro with the accelerometer "to more naturally handle different controller positions". A lean variant also exists.
  - `MOUSE_X_FROM_GYRO_AXIS` selects yaw (Y) or roll (Z) for horizontal motion, for example for a sideways Joy-Con.
  - Source: [JoyShockMapper README](https://github.com/Electronicks/JoyShockMapper/blob/HEAD/README.md)
- **Cutoff, tightening and smoothing** (JoyShockMapper README):
  - `GYRO_CUTOFF_SPEED`: "It's never good. Don't use it."
  - `GYRO_CUTOFF_RECOVERY` (tightening) smooths the transition and "does a good job of reducing shakiness", but the author uses it only "as a last resort".
  - Smoothing "unavoidably introduces latency", so it should never apply to "any input faster than a very small threshold". Smoothing is full below half of `GYRO_SMOOTH_THRESHOLD` and fades to none at the threshold. `GYRO_SMOOTH_TIME` defaults to 0.125 s.
  - Source: [JoyShockMapper README](https://github.com/Electronicks/JoyShockMapper/blob/HEAD/README.md)
- **GamepadMotionHelpers** (MIT, header-only C++ library for sensor fusion and calibration) [Verified: https://github.com/JibbSmart/GamepadMotionHelpers/blob/HEAD/LICENSE]:
  - `GetCalibratedGyro` returns °/s minus bias.
  - `GetGravity` returns about (0, −1, 0) when flat.
  - `GetProcessedAcceleration` returns acceleration with gravity removed.
  - `GetWorldSpaceGyro(…, sideReductionThreshold = 0.125)` and `GetPlayerSpaceGyro(…, yawRelaxFactor = 1.41)`.
  - Calibration modes: Manual (the default), Stillness and SensorFusion (corrections from the accelerometer-derived angular velocity).
  - Sensor fusion "cannot be used to correct the controller's orientation around the gravity vector (the yaw axis)" without a magnetometer.
  - Source: [GamepadMotionHelpers README and LICENSE](https://github.com/JibbSmart/GamepadMotionHelpers)
- JoyShockMapper is MIT-licensed (© 2018–2021 Julian "Jibb" Smart; © 2021– Nicolas Lessard). — [JoyShockMapper LICENSE](https://github.com/Electronicks/JoyShockMapper) [Verified: https://github.com/Electronicks/JoyShockMapper/blob/HEAD/LICENSE.md]
- The JavaScript AHRS library `ahrs` (psiphi75; Madgwick and Mahony filters) is at npm 1.3.3 (2023-10-28). Its LICENSE file is **Apache-2.0**, but the npm metadata says "APSL-2.0", so the two sources conflict. — [psiphi75/ahrs LICENSE](https://github.com/psiphi75/ahrs); [npm: ahrs](https://registry.npmjs.org/ahrs) [Verified: https://github.com/psiphi75/ahrs/blob/HEAD/LICENSE; https://registry.npmjs.org/ahrs]
- SDL normalises raw IMU data:
  - Steam Deck and the 2026 Steam Controller: gyro = raw/32768 × 2000 °/s (in rad/s) and accel = raw/32768 × 2 g. SDL reorders axes as (X, Z, −Y) into its convention. The Deck updates every 4 ms (250 Hz) and the 2026 controller every 4.032 ms.
  - Sources: [SDL_hidapi_steamdeck.c](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_steamdeck.c); [SDL_hidapi_steam_triton.c](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_steam_triton.c) [Verified: https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_steamdeck.c; https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_steam_triton.c]
- dualsense-ts ships built-in "orientation tracking" and "shake detection". — [dualsense-ts README](https://github.com/nsfm/dualsense-ts)

### Inferences
Recommended gyro pipeline for Tactilume, per controller:
1. Normalise every device to one frame: °/s, g, and right-handed axes with Y up. Each source (DualSense, DS4, Switch, Steam) needs an explicit axis remap table.
2. Calibration:
   - Run a 1–2 s "hold still or put it down" calibration when a player joins.
   - Run continuous Stillness auto-calibration only while the cursor is idle.
   - Offer a "recalibrate" button (for example a touchpad-click hold).
3. Use player-space yaw/pitch for 2D cursor ("virtual finger") control. Set sensitivity to about 8–12 (a 30–45° turn crosses the screen) and add two-threshold acceleration so slow motion stays precise.
4. Avoid cutoffs. Apply optional light tightening and threshold smoothing (below about 5 °/s, over 0.1 s) only as accessibility options.
5. Add a ratchet ("gyro off while held") button, so players can re-centre their hands without moving the cursor.

Separate pointer use from orientation use:
- Use **angular velocity** for pointing. It is drift-free once calibrated and needs no fusion.
- For orientation-like effects (tilt to steer a particle "flow" or gravity direction), use the **gravity vector** from a complementary, Madgwick or Mahony filter. It is drift-free for pitch and roll. Avoid absolute yaw, which drifts.
- GamepadMotionHelpers (MIT, C++) can be ported to JS. Alternatively use the `ahrs` npm package after checking its licence conflict.

### Gaps
- gyrowiki.jibbsmart.com was blocked in this sandbox. The player-space and world-space formulas, the GyroWiki smoothing and acceleration articles, and their dates were read only indirectly through the JoyShockMapper and GamepadMotionHelpers READMEs.
- Madgwick and Mahony parameter guidance (beta, Kp/Ki) was not sourced.

## 6. Steam Input: effects on Chromium/Electron apps (overlay, controller virtualisation), the Steam Deck in desktop mode, recommended settings

### Takeaway
When Steam Input is active it presents controllers to applications as a "Steam Virtual Gamepad" (28de:11ff). Chromium classifies that as an Xbox 360-type pad, which gives a standard mapping but drops gyro, touch, LEDs and adaptive triggers at the Gamepad API level. Steam's client also opens controllers' raw HID (hidraw) itself. Steam Controllers emulate keyboard and mouse ("lizard mode") unless a driver or Steam disables it. On a Steam Deck the built-in controls are a Valve HID device (28de:1205). Chromium on Linux has a standard mapping for it.

### Cited Findings
- 28de:11ff is the "Steam Virtual Gamepad" (SDL), and Chromium's ID list types it as `kXInputTypeXbox360`. — [SDL controller_list.h](https://github.com/libsdl-org/SDL/blob/main/src/joystick/controller_list.h); [gamepad_id_list.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_id_list.cc) [Verified: https://github.com/libsdl-org/SDL/blob/main/src/joystick/controller_list.h; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_id_list.cc]
- The kernel's hid-steam driver (Steam Controller and Steam Deck):
  - "This controller has a builtin emulation of mouse and keyboard … known as the 'lizard mode'".
  - The driver disables lizard mode when its input device is opened and re-enables it on close.
  - "Disabling lizard mode automatically is only done on the Steam Controller. On the Steam Deck, this is toggled manually by holding the options button". The new Ibex controller quirk is excluded from automatic toggling, like the Deck.
  - Steam Client uses hidraw directly. The driver uses a layered hidraw device to detect the client and drops its own input device while the client runs.
  - It has IMU-mode settings to send raw accel and gyro.
  - Source: [hid-steam.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-steam.c) [Verified: https://github.com/torvalds/linux/blob/master/drivers/hid/hid-steam.c]
- SDL's driver for the new controller ("Triton", 28de:1302 USB, 1303 BLE, 1304/1305 proprietary dongles):
  - re-sends "disable lizard mode" every 3 s;
  - re-sends rumble every 40 ms because of a "hardware safety timeout … around 50ms";
  - reads ±2000 °/s and ±2 g IMU data about every 4 ms;
  - parses touchpad data.
  - Source: [SDL_hidapi_steam_triton.c](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_steam_triton.c) [Verified: https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_steam_triton.c]
- Valve's udev rules name a "Steam Controller 2026 receiver" and a "Steam Controller 2015 receiver". — [steam-devices 60-steam-input.rules](https://github.com/ValveSoftware/steam-devices/blob/master/60-steam-input.rules) [Verified: https://github.com/ValveSoftware/steam-devices/blob/master/60-steam-input.rules]
- Chromium's Linux mapping table includes the Steam Deck (1205), Steam Controller 2015 (1102, 1142) and the 2026 family (1302–1305). The Windows and macOS tables do not. — [gamepad_standard_mappings_linux.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_standard_mappings_linux.cc); [gamepad_standard_mappings_win.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_standard_mappings_win.cc) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_standard_mappings_linux.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_standard_mappings_win.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_standard_mappings_mac.mm]
- Steam Deck IMU (SDL): 250 Hz, ±2000 °/s, ±2 g. — [SDL_hidapi_steamdeck.c](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_steamdeck.c) [Verified: https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_steamdeck.c]
- Press, search summary only, not verified: Steam added Switch 2 Pro Controller support over USB on Windows in November 2025. — [Nintendo Life](https://nintendolife.com/news/2025/11/valves-steam-client-adds-switch-2-pro-controller-support); [PC Gamer](https://www.pcgamer.com/uk/how-to-use-a-nintendo-switch-pro-controller-on-pc) [Unverified] (Valve's udev rules do give Steam raw USB access to Switch 2 pads on Linux, USB only; see section 4.)

### Inferences
Two strategies when Tactilume ships on Steam, or when players have Steam running:
- **(a) Let Steam Input virtualise.** Every pad becomes a standard Xbox-like pad, including Switch 2, Steam Controllers and the Deck. That is the simplest route to "any controller works", but gyro and touch then reach Tactilume only as Steam's mouse/stick emulation.
- **(b) Opt out of Steam Input for the app.** Use the native Gamepad API plus WebHID for Sony and Nintendo extras.

Recommendation: default to native (b) for PlayStation and Switch pads, because gyro, touch and adaptive triggers are core to Tactilume. Accept Steam virtualisation for Steam Controllers, the Deck and Switch 2. Detect 28de:11ff, and warn about double input when the same physical pad appears both virtually and natively.

Other inferences:
- **Desktop use.** Steam's desktop configuration and the Steam Controller's lizard mode can inject mouse and keyboard events, for example trackpad to cursor. Tactilume should ignore synthetic pointer input while a gamepad cursor is active, or tell users to disable desktop layouts.
- **Steam Deck desktop mode without Steam Input.** Players can hold Options to toggle lizard mode off so hid-steam exposes a gamepad that Chromium maps as standard. Gyro and trackpads then need WebHID with Valve's protocol, and no JS library was found for that.

### Gaps
- partner.steamgames.com was blocked, so I could not verify Valve's Steam Input documentation: per-app Steam Input settings, "PlayStation/Switch configuration support", the desktop and Big Picture layouts, how the overlay interacts with Chromium windows, and the Steamworks options for opting out.
- No source covered the Steam overlay's effect on Electron rendering or input focus.
- The release date, price and specification of the 2026 Steam Controller (beyond driver support) were not verified, because web search was exhausted.

## 7. Input design: mapping sticks, triggers, bumpers, gyro and touchpad onto multi-touch-style manipulation; per-player colours; accessibility (remapping, hold vs toggle, one-handed modes, Xbox Adaptive Controller, deadzones, response curves)

### Takeaway
Treat each gamepad as one or two "virtual fingers":
- Sticks or gyro move cursors.
- Analog triggers (0–1) set touch pressure or strength.
- Bumpers switch tools or create a second finger for pinch and rotate.
- A DualSense or DS4 touchpad maps directly to normalised multi-touch.

Design for up to 8 pads at once with colour plus shape identity, mirrored on the controller's own lights where possible. Build in remapping, hold/toggle options, one-handed presets and tunable deadzones and curves from day one.

### Cited Findings
- Standard indices: bumpers are 4 and 5 (top front), analog triggers 6 and 7 (bottom front), sticks are axes 0–3 with their clicks at 10 and 11, the D-pad is 12–15 and home is 16. — [W3C Gamepad ED](https://github.com/w3c/gamepad/blob/gh-pages/index.html)
- Chromium reports analog `value` for triggers and treats a button as pressed above 30/255. — [gamepad.h](https://github.com/chromium/chromium/blob/main/device/gamepad/public/cpp/gamepad.h)
- At most 8 pads and up to 8 touch points per pad. — [gamepads.h](https://github.com/chromium/chromium/blob/main/device/gamepad/public/cpp/gamepads.h); [gamepad.h](https://github.com/chromium/chromium/blob/main/device/gamepad/public/cpp/gamepad.h)
- Spec touches are normalised to [−1, 1] with persistent `touchId`s. — [W3C Gamepad ED](https://github.com/w3c/gamepad/blob/gh-pages/index.html)
- Hardware touch surfaces: DualSense has 2 points at 1920×1080 and DS4 has 2 points at 1920×942. — [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c)
- Lights a host can set per player:
  - DualSense: lightbar RGB, player LEDs (patterns 1–7), mute LED.
  - DS4: lightbar RGB and blink.
  - Switch: player lights (subcommand 0x30) and Home light (0x38).
  - Sources: [dualsensectl README](https://github.com/nowrep/dualsensectl); [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c); [hid-nintendo.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c)
- The Xbox Adaptive Controller (045e:0b0a) reports force feedback but "does not have any vibration actuators" (Chromium excludes it from rumble on Linux). It is listed as an Xbox One-type pad. — [gamepad_device_linux.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_device_linux.cc); [gamepad_id_list.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_id_list.cc)
- Gyro guidance: use real-world sensitivity, acceleration through two thresholds, no cutoff, minimal smoothing, and a gyro on/off button (see section 5). — [JoyShockMapper README](https://github.com/Electronicks/JoyShockMapper/blob/HEAD/README.md)

### Inferences
**Default mapping (proposal)**
- **Left stick**: moves the player's primary "finger" cursor. Velocity control with a radial deadzone and a response curve; hold L3 for precision (×0.3).
- **Right stick**: places a second finger relative to the first, for two-finger pinch, spread and rotate on particles. Alternatively it is a "flow" direction emitter.
- **R2**: touch pressure of finger 1 (attract or paint strength from 0 to 1). **L2**: finger 2, or the inverse force (repel).
- **R1/L1**: cycle tool or colour. Holding both enters "two-finger mode", so the right stick then drives finger 2.
- **Face buttons**: burst/spawn (A/Cross), freeze or hold (B/Circle), and palette or brush (X/Y). Destructive "clear" requires a 1 s hold with a visible ring.
- **Gyro**, where available (DualSense, DS4, Switch, Steam): optional pointer for finger 1 in player space, with ratcheting while holding a "clutch" (for example touching the touchpad or holding R1). Or "tilt = gravity/flow direction" from the accelerometer gravity vector, which is drift-free.
- **Touchpad** (DualSense and DS4 via WebHID, or the flagged Gamepad API touch): a direct absolute map of 2 touch points onto 2 screen-region fingers, using 1920×1080 and 1920×942 normalisation.

**Multiplayer identity**
- Assign each of up to 8 player slots a colour plus a cursor shape plus a number. Shape and number keep players distinguishable for people with colour-vision deficiency.
- Mirror the colour on the DualSense or DS4 lightbar and the player number on the DualSense player LEDs or Switch player lights, via WebHID.
- Xbox and Steam pads cannot be lit from the browser, so show an on-screen badge for them.
- "Press any button to join": the gesture requirement doubles as a join flow. Slot order follows `gamepad.index`, plus your own persistent mapping by device for re-joins.

**Accessibility**
- Full remapping per player, including on/off for analog triggers. Hold vs toggle for every "held" action (clutch, freeze, precision).
- One-handed presets:
  - Left-only: left stick for the cursor, L2 for strength, L1 for tool, D-pad for actions.
  - Right-only: right stick, R2, R1 and face buttons.
  - Gyro-only: gyro cursor with a single press button.
- Support the Xbox Adaptive Controller as a standard XInput pad that has no rumble.
- Deadzones: per-stick radial (circular) deadzone with re-scaling so output still runs smoothly from 0 to 1 past the deadzone. Offer an optional anti-deadzone outward offset, a response-curve exponent from 1.0 to 3.0, and separate outer-edge saturation.
- Haptics: a global and per-player intensity slider and an off switch. Every haptic cue also needs a visual and audio twin.

### Gaps
- learn.microsoft.com was blocked, so the Xbox Accessibility Guidelines (XAG) were not read.
- No fetched source supports specific deadzone or curve numbers. The deadzone and curve recommendations above are design inferences, not sourced facts.
- Accessibility guidance specific to multi-player shared-screen toys was not found.

## 8. Haptic design: syncing rumble and trigger effects with visuals and audio, limits (durations, magnitudes, update rates), comfort

### Takeaway
- **Gamepad API haptics are coarse.** Effects are fixed-duration and constant-intensity, with magnitudes from 0 to 1 and at most 5 s per call. Trigger-rumble is Xbox-on-Windows only, plus macOS where supported. [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/gamepad_haptic_actuator.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_id_list.cc]
- **Richer effects need WebHID**, mainly on the DualSense: adaptive-trigger resistance and vibration modes, attenuation, and rumble on Windows.
- **Treat haptics as short, event-locked accents** with renewable continuous layers, keep them personal to each player, and make them optional.

### Cited Findings
- `dual-rumble` and `trigger-rumble` are "fixed-duration, constant-intensity" effects. The user agent may alter an effect for compatibility and should use the `playEffect` timestamp for timing when `startDelay` is not 0. — [W3C Gamepad ED](https://github.com/w3c/gamepad/blob/gh-pages/index.html)
- Chromium enforces magnitudes in [0, 1] and `duration + startDelay` ≤ 5000 ms. — [gamepad_haptic_actuator.cc](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/gamepad/gamepad_haptic_actuator.cc); [gamepad.h](https://github.com/chromium/chromium/blob/main/device/gamepad/public/cpp/gamepad.h) [Verified: https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/gamepad_haptic_actuator.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad.h]
- Which pads get trigger-rumble: on Windows the Xbox One, Series and Elite IDs through WGI; on macOS only controllers whose GameController haptics report trigger localities. — [gamepad_id_list.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_id_list.cc); [game_controller_gamepad.mm](https://github.com/chromium/chromium/blob/main/device/gamepad/game_controller_gamepad.mm)
- Nintendo dual-rumble in Chromium plays fixed tones: 141 Hz strong (≤ 0.9) and 182 Hz weak (≤ 0.1). — [nintendo_controller.cc](https://github.com/chromium/chromium/blob/main/device/gamepad/nintendo_controller.cc)
- Native rumble timing constraints:
  - The 2026 Steam Controller has a rumble "hardware safety timeout … around 50ms", so SDL re-sends every 40 ms. — [SDL_hidapi_steam_triton.c](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_steam_triton.c) [Verified: https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_steam_triton.c]
  - SDL sends Switch 2 rumble every 12 ms. — [SDL_hidapi_switch2.c](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_switch2.c) [Verified: https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_switch2.c]
  - Switch subcommands are rate-limited to 20 ms (USB) and 60 ms (BT). — [hid-nintendo.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c) [Verified: https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c]
- DualSense extras:
  - Adaptive-trigger modes: feedback, weapon, bow, galloping, machine, vibration, and raw per-zone strength or amplitude.
  - Attenuation 0–7 for rumble and triggers.
  - A "haptics select" flag alongside "compatible vibration" (and "compatible vibration 2").
  - Sources: [dualsensectl README](https://github.com/nowrep/dualsensectl); [dualsensectl main.c](https://github.com/nowrep/dualsensectl/blob/HEAD/main.c); [hid-playstation.c](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c)
- Apple's Human Interface Guidelines on haptics:
  - "Avoid overusing haptics."
  - "Use haptics consistently throughout your app or game."
  - "Doing user testing can help you discover a balance that most people appreciate."
  - Game controllers on Apple platforms "can provide haptic feedback". The impact of "a collision or a hit" should feel different from "subtle experiences like the approach of footsteps or a looming danger".
  - Source: [Apple HIG: Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)

### Inferences
**Sync model**
- Drive haptics from the same simulation event bus as audio and visuals:
  - Particle bursts and collisions become 30–120 ms dual-rumble pulses scaled by event energy.
  - Sustained interactions (holding R2 to attract a swarm) become a low continuous layer, renewed in chunks of 200–500 ms well under the 5 s cap, with magnitude following the trigger value.
- Re-issue at most about 10–20 times per second. The Gamepad API has no streaming haptics, and there is no evidence that faster calls are useful.
- For audio alignment, schedule `playEffect` with `startDelay` computed from the audio clock (convert `AudioContext.currentTime` to `performance.now`), since the spec says the user agent should honour the timestamp.

**Trigger effects as "pressure"**
- On DualSense via WebHID, map a tool's force to feedback-mode resistance: more particles held means more resistance.
- Use vibration mode at low amplitude for "texture" while painting.
- Release effects (mode 0x05, off) on tool switch, pause or blur, so a trigger never stays stiff.
- On Xbox (Windows), use `trigger-rumble` with `leftTrigger` and `rightTrigger` as the analogue.

**Comfort and multiplayer**
- Use a global intensity setting (wired to DualSense attenuation when available) and an off switch.
- Cap any continuous rumble at a few seconds, then decay.
- Avoid simultaneous strong rumble on all pads for shared events. Keep haptics to the player whose finger caused the event.
- Stop all effects on window blur or hide. Blink stops gamepad updates on hidden pages, and stale effects could keep playing.

**Output arbitration**
- Never mix Gamepad API rumble and WebHID output reports on the same DualSense. Both write the same output report, and the last writer wins.
- Pick one owner per device: WebHID when available, otherwise the Gamepad API.

### Gaps
- I found no source on the effective `playEffect` update rate or latency in Chromium per backend (WGI, GameController, evdev, Nintendo).
- No source covered recommended durations or magnitudes for comfort, or safety limits, from Sony, Microsoft or Nintendo.
- The DualSense "haptics select" (voice-coil, audio-driven) path over WebHID and USB audio was not researched.
- Sony's official adaptive-trigger design guidance is not public, and none was found.

## Verification

Fact-check of 12 November 2026. Sources were read as raw files from GitHub (raw.githubusercontent.com), from the npm registry and from developer.apple.com. Chromium files were read both on `main` and at the 156.0.8078.96 tag that Electron 45.3.0 and 45.3.1 pin, plus 157.0.8103.81 and 159.0.8154.0 where a feature's arrival mattered. Electron files were read at the v45.3.0 tag. "Coordinator measurement" means the in-container headless Chromium 153.0.8010.12 run (Playwright 1.63.0, Linux, SwiftShader); it has no URL. No web searches were used, and no physical controller was tested.

| # | Claim | Verdict | Source |
|---|---|---|---|
| 1 | Electron 45.3.0 (2026-11-10) is the latest npm release and pins Chromium 156.0.8078.96 and Node v24.22.2; Electron `main` pins 159.0.8154.0 and Node v26.13.0; Chromium trunk is 160.0.8157.0 | Corrected: 45.3.1 became `latest` at 2026-11-12T02:09:19Z, after the notes were written. It pins the same Chromium and Node, so every @156 finding still applies. The rest is confirmed | https://registry.npmjs.org/electron; https://github.com/electron/electron/blob/v45.3.0/DEPS; https://github.com/electron/electron/blob/v45.3.1/DEPS; https://github.com/electron/electron/blob/main/DEPS; https://github.com/chromium/chromium/blob/main/chrome/VERSION |
| 2 | The Gamepad API exposes at most 8 pads, 16 axes, 32 buttons, 8 touch points and a 128-character id; a button counts as pressed above 30/255; Chromium polls every 4 ms (~250 Hz) | Confirmed at 156 and on trunk. This closes the gap that the 4 ms figure was read only on trunk; the mapping tables and ID list are also byte-identical at 156 | https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepads.h; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad.h; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_provider.cc |
| 3 | Windows uses Windows.Gaming.Input by default (GameInput only on Windows 11 behind a disabled-by-default feature), plus the Nintendo and Raw Input fetchers; the XInput fetcher is not registered, so XInput's 4-pad cap does not apply | Confirmed | https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_platform_data_fetcher.h; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad_features.cc |
| 4 | DualSense on Windows comes through Raw Input (WGI ignores PS5 pads by default), and Raw Input haptics cover only DS4 (05c4, 09cc, Scuf 7725) and three HID-haptic IDs, so there is no DualSense rumble through the Gamepad API | Confirmed | https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad_features.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/raw_input_gamepad_device_win.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/dualshock4_controller.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/hid_haptic_gamepad.cc |
| 5 | `gamepadrawinputchanged` (experimental Blink feature with an origin-trial name, browser feature on) and touch (`touchEvents`, behind experimental `GamepadMultitouch` and disabled `kEnableGamepadMultitouch`) need explicit opt-in; the switch string is probably `EnableGamepadMultitouch`; Electron gets no remote field-trial config | Confirmed. The switch string follows from the two-argument `BASE_FEATURE` naming rule, and Electron 45 builds features only from command-line switches plus a short hard-coded list, with field trials only from `--force-fieldtrials` | https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/platform/runtime_enabled_features.json5; https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/gamepad.idl; https://github.com/chromium/chromium/blob/156.0.8078.96/base/feature_internal.h; https://github.com/electron/electron/blob/v45.3.0/shell/browser/feature_list.cc |
| 6 | A gamepad press counts as a user activation only when the page is visible and focused | Corrected: that holds on trunk and from Chromium 159 (Electron 46). In Electron 45 (156), and in 157, `GamepadUserActivationFocus` does not exist and visibility alone suffices | https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/navigator_gamepad.cc; https://github.com/chromium/chromium/blob/157.0.8103.81/third_party/blink/renderer/platform/runtime_enabled_features.json5; https://github.com/chromium/chromium/blob/159.0.8154.0/third_party/blink/renderer/platform/runtime_enabled_features.json5 |
| 7 | Haptics: magnitudes 0–1 and `duration + startDelay` ≤ 5000 ms; trigger-rumble only for 13 Xbox One/Series/Elite IDs via WGI, and on macOS only when a pad reports both trigger localities. MDN: `GamepadHapticActuator` is in Chrome 68, Firefox 55 and Safari 16.4; `playEffect` is in Chrome 68 and Safari 16.4; `trigger-rumble` is Chrome 126 only | Confirmed | https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/gamepad_haptic_actuator.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad.h; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_id_list.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/game_controller_gamepad.mm; https://github.com/mdn/browser-compat-data/blob/main/api/GamepadHapticActuator.json |
| 8 | WebHID: `requestDevice()` needs transient activation; `inputreport` data excludes the report-ID byte; WebHID is Chromium-only (Chrome 89+); `navigator.hid` exists in Chromium 153 | Confirmed. The spec adds that feature-report data "may" include the report ID as byte 0 | https://github.com/WICG/webhid/blob/main/index.bs; https://github.com/mdn/browser-compat-data/blob/main/api/HID.json; coordinator measurement |
| 9 | Electron: `select-hid-device` picks the device; `hid-device-added`/`-removed` fire only until its callback runs; `setDevicePermissionHandler` grants without a chooser; grants last for the WebContents lifetime by default | Confirmed. Also found: without `event.preventDefault()` the request resolves with no device | https://github.com/electron/electron/blob/v45.3.0/docs/tutorial/devices.md; https://github.com/electron/electron/blob/v45.3.0/docs/api/session.md; https://github.com/electron/electron/blob/v45.3.0/shell/browser/hid/hid_chooser_controller.cc |
| 10 | Gamepads can be opened through WebHID: no gamepad vendor is in the static HID blocklist, Gamepad and Joystick usages are not always-protected, and on Linux Valve's udev rules (82 `uaccess` entries) cover DualSense/Edge, DS4, Switch Pro and Joy-Con | Confirmed | https://github.com/chromium/chromium/blob/156.0.8078.96/services/device/public/cpp/hid/hid_blocklist.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/services/device/public/cpp/hid/hid_report_utils.cc; https://github.com/ValveSoftware/steam-devices/blob/master/60-steam-input.rules |
| 11 | DualSense: input USB 0x01 (64 B) and BT 0x31 (78 B); output 0x02 (63 B) and 0x31 (78 B); CRC seeds 0xA1/0xA2/0xA3; 8192 LSB/g, 1024 LSB per °/s, touchpad 1920×1080; derived WebHID offsets; sensors at 250 Hz USB, ~1000 Hz BT and 1000 Hz for the Edge over USB | Confirmed (struct offsets and the CRC recipe re-derived from the kernel source) | https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c; https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_ps5.c |
| 12 | Nintendo: Switch IMU at 4096 LSB/g and 14.247 LSB per °/s, reports every 15 ms (valid 8–17 ms), subcommands limited to 20/60 ms, SDL at 200 Hz. Switch 2: supported by the kernel driver, by SDL only over USB bulk transfers (no Bluetooth), and absent from Chromium's ID list | Confirmed, with detail added: each IMU report carries 3 samples, and 11 ms intervals also occur | https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c; https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_switch.c; https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_switch2.c; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_id_list.cc |
| 13 | The Steam client added Switch 2 Pro (and GameCube) controller support over wired USB on Windows in November 2025 | Unverifiable (press search summaries only; Steam pages are blocked). Partial support: Valve's udev rules grant raw USB access to the four Switch 2 IDs over USB only | https://github.com/ValveSoftware/steam-devices/blob/master/60-steam-input.rules |
| 14 | Steam: the Steam Virtual Gamepad (28de:11ff) is typed as Xbox 360 by Chromium; Valve standard mappings exist only on Linux; the 2026 controller needs rumble re-sent every 40 ms (~50 ms timeout) and IMU arrives about every 4 ms; SDL calls 1302/1303 "Steam Triton Controller (BLE)" | Corrected (naming only): SDL names only 1303 "(BLE)"; 1302 is the plain USB "Valve Steam Triton Controller". The rest is confirmed | https://github.com/libsdl-org/SDL/blob/main/src/joystick/controller_list.h; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_id_list.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_standard_mappings_linux.cc; https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_steam_triton.c |
| 15 | Licences and versions: dualsense-ts LGPL-3.0 (npm 6.15.38, 2026-07-12); webhid-ds4 MIT (1.0.5, 2026-02-16); joy-con-webhid Apache-2.0 (0.11.0, 2025-07-17); GamepadMotionHelpers, JoyShockMapper and dualsense-tester MIT; dualsensectl GPL-2.0; `ahrs` LICENSE Apache-2.0 against npm "APSL-2.0"; nondebug/dualsense has no licence | Confirmed | https://registry.npmjs.org/dualsense-ts; https://github.com/nsfm/dualsense-ts/blob/HEAD/LICENSE; https://registry.npmjs.org/webhid-ds4; https://registry.npmjs.org/joy-con-webhid; https://github.com/JibbSmart/GamepadMotionHelpers/blob/HEAD/LICENSE; https://github.com/psiphi75/ahrs/blob/HEAD/LICENSE; https://registry.npmjs.org/ahrs; https://github.com/nondebug/dualsense |

Totals: 15 claims checked; 11 confirmed, 3 corrected, 1 unverifiable.

**Measured facts.** The only overlap with the container measurements is `navigator.hid`, which exists in headless Chromium 153.0.8010.12, as the notes say. The WebGPU, `deviceMemory` and timing measurements do not bear on gamepad input. Nothing in this file was measured with a real controller.

**Gaps closed by the fact-check.** The 4 ms polling interval and the per-OS mapping tables are identical at the 156 tag. `EnableGamepadMultitouch` is the correct switch string. An unhandled `select-hid-device` cancels the request. Each Switch IMU report carries 3 samples.

**Other notes.** desktop_app_shell.md, webgpu_desktop_capabilities.md, audio_input_analysis.md and their digests also call Electron 45.3.0 the latest release. That is now out of date in the same way, but the Chromium 156.0.8078.96 pin is unchanged, so their findings stand.
