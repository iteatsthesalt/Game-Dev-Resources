This is the fact-checked digest of gamepad_input.md (gamepad input for Tactilume Desktop: Gamepad API, haptics, WebHID, motion and Steam Input in Electron 45 / Chromium 156, as of 2026-11-12).

**Verification status.** The Verification table covers 15 claims: 11 confirmed, 3 corrected, 1 unverifiable. Sources were read as GitHub raw files (Chromium at the 156.0.8078.96 tag and on main; Electron at v45.3.0; Linux; SDL; WICG; W3C; MDN BCD; Valve), the npm registry and developer.apple.com. GyroWiki, Steamworks docs, chromestatus, learn.microsoft.com and press sites were unreachable. No physical controller was tested.

**Tags.** [Verified]: re-read at source by the fact-check. [Verified correction]: corrected against a source. [Measured]: headless Chromium 153.0.8010.12 (Playwright 1.63.0, Linux) in this container, so not Electron 45 and no controller. [Cited]: from the linked source but not re-read by the fact-check. [Unverified]: search summary only. [Inference]: the notes' own conclusion.

## Bottom line
- Architecture [Inference]: the Gamepad API is the universal base layer for buttons, sticks and analog triggers (up to 8 pads, polled). A WebHID layer adds gyro, touchpads, lightbar and player LEDs, adaptive triggers, and DualSense rumble on Windows, for Sony and Nintendo pads. More than 8 simultaneous players need the phone controller.
- Corrections that matter:
  - Electron 45.3.1 is now npm `latest`, with the same Chromium 156.0.8078.96.
  - In Electron 45, a gamepad press counts as a user activation whenever the window is visible, focused or not. The focus requirement arrives with Chromium 159 (Electron 46).
  - SDL's name for the 2026 Steam Controller USB ID was off; this is a naming fix only.
- Gaps the fact-check closed:
  - The 4 ms poll interval and all per-OS mapping tables are identical at 156.
  - The multitouch switch string is `EnableGamepadMultitouch`.
  - An unhandled `select-hid-device` cancels the request.
  - Electron never applies Chrome's remote field trials.
  - Each Switch IMU report carries 3 samples.

## Versions
- Electron 45.3.0 was published 2026-11-10T21:11:56Z, and 45.3.1 became `latest` at 2026-11-12T02:09:19Z. Both pin Chromium 156.0.8078.96 and Node v24.22.2. Electron main (46) pins Chromium 159.0.8154.0 and Node v26.13.0. Chromium trunk is 160.0.8157.0. https://registry.npmjs.org/electron; https://github.com/electron/electron/blob/v45.3.1/DEPS; https://github.com/electron/electron/blob/main/DEPS; https://github.com/chromium/chromium/blob/main/chrome/VERSION [Verified correction]
- desktop_app_shell.md, webgpu_desktop_capabilities.md, audio_input_analysis.md and their digests still call 45.3.0 the latest. The Chromium pin is unchanged, so their findings stand. [Verified correction]
- The W3C Gamepad spec is still an Editor's Draft. https://github.com/w3c/gamepad/blob/gh-pages/index.html [Verified]

## Gamepad API in Electron 45 (Chromium 156)
- Limits: 8 pads (`kItemsLengthCap`), 16 axes, 32 buttons, 8 touch points and a 128-character id per pad. A button counts as pressed above 30/255. Mapping is none, standard or xr-standard. https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepads.h; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad.h [Verified]
- Chromium polls devices every 4 ms (~250 Hz). Pages poll `getGamepads()`, usually once per animation frame (60–144 Hz). https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_provider.cc [Verified]; frame rate [Inference]
- Standard mapping: buttons 0–3 are the face buttons, 4–5 bumpers, 6–7 analog triggers, 8–9 centre, 10–11 stick clicks, 12–15 D-pad and 16 home. Axes 0–3 are the sticks, negative left/up. https://github.com/w3c/gamepad/blob/gh-pages/index.html [Cited]
- Pads stay hidden until a gesture: any pressed button or an axis beyond 0.5. https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_user_gesture.cc [Verified]
- `getGamepads()` throws SecurityError when the `gamepad` permissions policy is disabled. Insecure contexts are not blocked. https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/navigator_gamepad.cc [Verified]
- User activation: at 156 a press counts as a user activation whenever the page is visible. `GamepadUserActivationFocus` (visible and focused) is absent at 156 and 157 and stable at 159.0.8154.0 and trunk. A "press to enable advanced features" flow that calls `navigator.hid.requestDevice()` must work under both rules. Same file; https://github.com/chromium/chromium/blob/157.0.8103.81/third_party/blink/renderer/platform/runtime_enabled_features.json5; https://github.com/chromium/chromium/blob/159.0.8154.0/third_party/blink/renderer/platform/runtime_enabled_features.json5 [Verified correction]
- Blink stops gamepad updates while the page is hidden, for example a minimised or `show:false` window. Same navigator_gamepad.cc [Verified]. So keep input in the visible main window, and stop haptics on blur or hide. [Inference]
- Windows Raw Input registers with `RIDEV_INPUTSINK`, so input arrives while the window is not in the foreground. https://github.com/chromium/chromium/blob/main/device/gamepad/raw_input_data_fetcher_win.cc [Cited]
- Opt-in features at 156 (none is on by default in Electron):
  - `gamepadrawinputchanged`: the Blink feature `GamepadRawInputChangeEvent` is "experimental" with an origin-trial name, and the browser feature `kGamepadRawInputChangeEvent` is on by default. https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/platform/runtime_enabled_features.json5; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad_features.cc [Verified]
    - Turn it on with `webPreferences.enableBlinkFeatures: 'GamepadRawInputChangeEvent'`. Feature-detect it and fall back to frame polling. https://github.com/electron/electron/blob/v45.3.0/docs/api/structures/web-preferences.md [Verified]; recipe untested [Inference]
  - Edge explainer: the event fires once per HID report with no coalescing, and carries index arrays (`axesChanged`, `buttonsPressed` and others). Polling at 60 Hz adds ~8.33 ms average latency against ~250 Hz device polling. Polling will not be deprecated. https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/GamepadEventDrivenInputAPI/explainer.md [Verified]
  - Touch: Chromium's attribute is `touchEvents` (the spec says `touches`). It sits behind `[RuntimeEnabled=GamepadMultitouch]` (experimental) and the browser feature `kEnableGamepadMultitouch` (disabled).
    - Enable both: `enableBlinkFeatures: 'GamepadMultitouch'` and `--enable-features=EnableGamepadMultitouch`. The feature name drops the leading `k`. Runtime behaviour is untested. https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/gamepad.idl; https://github.com/chromium/chromium/blob/156.0.8078.96/base/feature_internal.h [Verified]
  - `GamepadButtonTypes` is experimental at 156. Same json5 [Verified]
  - Electron 45 takes features only from command-line switches plus a short hard-coded list (nothing gamepad or HID), and field trials only from `--force-fieldtrials`. Chrome's remote configuration never applies. https://github.com/electron/electron/blob/v45.3.0/shell/browser/feature_list.cc [Verified]
- The Gamepad API gives no gyro, accelerometer, LEDs, adaptive triggers or battery on any OS. `pose`, `hand` and `hapticActuators` exist only in Firefox 55. https://github.com/mdn/browser-compat-data/blob/main/api/Gamepad.json [Verified]

## Backends and per-OS coverage
- Windows:
  - Windows.Gaming.Input (WGI) is the default. GameInput is used only on Windows 11 with `kEnableWindowsGameInputDataFetcher`, which is disabled.
  - The Nintendo and Raw Input fetchers always run.
  - The XInput fetcher is not registered, so XInput's 4-pad limit does not apply.
  - https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_platform_data_fetcher.h; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad_features.cc [Verified]
- `kIgnorePS5GamepadsInWgi` is on, so DualSense and DualSense Edge arrive through Raw Input. Same features file [Verified]
- macOS uses the GameController, IOKit HID, Nintendo and Xbox fetchers. Xbox and PlayStation pads go through GameController. Linux uses a udev/evdev/hidraw fetcher plus Nintendo, and opens hidraw only for allowlisted IDs. Same files [Verified]
- Mapping tables (identical at 156 and trunk):
  - Valve IDs appear only in the Linux table: Steam Controller 1102/1142, Deck 1205, the 2026 family 1302–1305.
  - Switch 2 IDs (057e:2066/2067/2069/2073) are in no table and not in the ID list.
  - 28de:11ff (Steam Virtual Gamepad) and 2dc8:3106 are typed as Xbox 360.
  - https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_standard_mappings_linux.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_id_list.cc [Verified]
- On WGI, Elite paddles become extra buttons after index 16. https://github.com/chromium/chromium/blob/main/device/gamepad/wgi_data_fetcher_win.cc [Cited]
- Matrix highlights [Inference from code]:
  - Xbox: Windows has standard mapping plus dual and trigger rumble. macOS has trigger rumble only if trigger localities are reported. Linux has no trigger rumble.
  - DualSense: on Windows, standard mapping but no rumble and no touch parser. On macOS and Linux, dual rumble works.
  - DS4: dual rumble everywhere; touch is parsed but needs flags.
  - Switch Pro and Joy-Con: the Nintendo fetcher on every OS; HD-rumble tones; a Joy-Con pair is merged.
  - Switch 2: not recognised.
  - Steam Controllers and the Deck: standard mapping on Linux only, otherwise through the Steam Virtual Gamepad.

## Haptics
- Gamepad API effects are `dual-rumble` (strong and weak, 0–1) and `trigger-rumble` (adds leftTrigger and rightTrigger). Both are fixed-duration and constant-intensity. Chromium rejects magnitudes outside 0–1 and `duration + startDelay` above 5000 ms. https://github.com/w3c/gamepad/blob/gh-pages/index.html; https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/gamepad_haptic_actuator.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepad.h [Verified]
- Trigger-rumble:
  - Windows: only 13 Xbox One, One S, Series, Elite and Elite 2 IDs, through WGI.
  - macOS: only if the pad reports both trigger localities.
  - https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_id_list.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/game_controller_gamepad.mm [Verified]
  - Apple documents trigger localities (macOS 11+) but not which pads report them. https://developer.apple.com/documentation/gamecontroller/gchapticslocality [Verified]
- Windows Raw Input haptics cover only the DS4 (05c4, 09cc, Scuf 7725) and three HID-haptic IDs. So DualSense has no rumble on Windows without WebHID. https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/raw_input_gamepad_device_win.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/dualshock4_controller.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/hid_haptic_gamepad.cc [Verified]
- Linux rumble uses evdev `FF_RUMBLE`; the Adaptive Controller and Stratus Duo are excluded. Nintendo dual rumble is emulated with tones, 141 Hz strong and 182 Hz weak. https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_device_linux.cc; https://github.com/chromium/chromium/blob/main/device/gamepad/nintendo_controller.cc [Cited]
- MDN support data:
  - `GamepadHapticActuator`: Chrome 68, Firefox 55, Safari 16.4.
  - `playEffect` and `reset`: Chrome 68 and Safari 16.4; Firefox has only the legacy `pulse`.
  - `effects`, `trigger-rumble`, `leftTrigger` and `rightTrigger`: Chrome 126 only.
  - https://github.com/mdn/browser-compat-data/blob/main/api/GamepadHapticActuator.json [Verified]
- Native timing limits: the 2026 Steam Controller's rumble times out after ~50 ms, so SDL re-sends it every 40 ms. SDL sends Switch 2 rumble every 12 ms. Switch subcommands must be 20 ms (USB) or 60 ms (BT) apart. https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_steam_triton.c; https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_switch2.c; https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c [Verified]
- Design [Inference]:
  - One haptics owner per device: WebHID when it is open, otherwise the Gamepad API. Never both on a DualSense.
  - Events get 30–120 ms pulses. Continuous layers are renewed in 200–500 ms chunks, at no more than 10–20 calls per second.
  - Schedule `startDelay` from the audio clock. Keep haptics to the player who caused the event.
  - Offer global and per-player intensity and an off switch. Give every cue a visual or audio twin.
  - Stop all effects on blur or hide. Release DualSense trigger effects (mode 0x05) on tool switch, pause or blur.

## WebHID in Electron
- WebHID is in Chrome 89+ (Edge mirrors Chrome), not Firefox or Safari. https://github.com/mdn/browser-compat-data/blob/main/api/HID.json [Verified]. `navigator.hid` exists in Chromium 153. [Measured]
- Spec rules:
  - `requestDevice()` rejects with SecurityError without transient activation.
  - `inputreport` `data` excludes the report-ID byte, which arrives as `reportId`.
  - `receiveFeatureReport()` throws a TypeError on a report-ID mismatch.
  - Feature-report data "may" start with the report ID.
  - https://github.com/WICG/webhid/blob/main/index.bs [Verified]
- Electron has no built-in chooser:
  - Handle `select-hid-device`, call `event.preventDefault()`, then `callback(deviceId)`. Without `preventDefault()`, the request resolves with no device.
  - `hid-device-added` and `hid-device-removed` fire only while the chooser is open.
  - `setDevicePermissionHandler` grants known devices without a prompt, and is how grants persist; by default a grant lasts for the WebContents' lifetime.
  - `setPermissionCheckHandler` can deny HID per origin.
  - https://github.com/electron/electron/blob/v45.3.0/docs/tutorial/devices.md; https://github.com/electron/electron/blob/v45.3.0/docs/api/session.md; https://github.com/electron/electron/blob/v45.3.0/shell/browser/hid/hid_chooser_controller.cc [Verified]
- Blocklist: the static entries are FIDO, security keys and Jabra, with no Sony, Nintendo, Microsoft, Valve or 8BitDo IDs. Always-protected usages are the keyboard page; pointer, mouse, keyboard and keypad (feature reports allowed); and system controls. Gamepad (0x05) and Joystick (0x04) are not protected. https://github.com/chromium/chromium/blob/156.0.8078.96/services/device/public/cpp/hid/hid_blocklist.cc; https://github.com/chromium/chromium/blob/156.0.8078.96/services/device/public/cpp/hid/hid_report_utils.cc [Verified]
- Linux needs hidraw permissions. Valve's `60-steam-input.rules` gives `uaccess` (82 entries) to Valve devices, DS3, DS4, DualSense and Edge, Switch Pro, Joy-Con and many third-party pads. https://github.com/ValveSoftware/steam-devices/blob/master/60-steam-input.rules [Verified]. Ship equivalent rules or require `steam-devices`. [Inference]
- Other blockers [Inference]: Steam's client opens hidraw itself; Xbox pads over USB use GIP, not HID; Switch 2 needs a USB bulk init. Exclusive access on Windows and macOS, and any macOS Input Monitoring prompt, are unknown.
- Flow [Inference]:
  - In `select-hid-device`, filter vendors 054c and 057e with usage page 0x01, usage 0x05.
  - Auto-grant known IDs through `setDevicePermissionHandler`, and call `navigator.hid.getDevices()` at startup.
  - Dedupe a WebHID device and its Gamepad API twin by vendor/product and correlated input.

## DualSense over WebHID
- Reports:
  - Input: USB 0x01 (64 B); BT 0x31 (78 B, CRC32 last).
  - Output: USB 0x02 (63 B); BT 0x31 (78 B).
  - Feature: calibration 0x05 (41 B), pairing 0x09 (20 B), firmware 0x20 (64 B).
  - CRC seeds: input 0xA1, output 0xA2, feature 0xA3.
  - https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c [Verified]
- After calibration: 8192 LSB/g (±4 g) and 1024 LSB per °/s (±2048 °/s). The touchpad is 1920×1080 with 2 points. Same [Verified]
- Sensor rate is 250 Hz over USB, ~1000 Hz over Bluetooth, and 1000 Hz for the Edge over USB. https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_ps5.c [Verified]
- WebHID body offsets: the body starts at `data` offset 0 on USB and 1 on BT 0x31. hid-playstation.c [Verified]
  - Sticks and triggers: LX 0, LY 1, RX 2, RY 3, L2 4, R2 5; seq 6; buttons 7–10.
  - Motion: gyro int16 LE at 15/17/19, accel at 21/23/25, timestamp u32 at 27.
  - Touch at 32–35 and 36–39; status at 52–54.
- Details read from the source but not re-read:
  - The timestamp is in 1/3 µs.
  - A touch point is inactive when bit 7 of contact is set; x = lo | (hi & 0x0F) << 8, y = (hi >> 4) | y_hi << 4.
  - Battery = min(level × 10 + 5, 100).
  - hid-playstation.c [Cited]
- BT output CRC: standard CRC-32 over seed 0xA2, then the report from its ID byte, excluding the last 4 bytes, written little-endian into those 4 bytes. The `sendReport(0x31, body)` body is 77 bytes: seq_tag, tag 0x10, the 47-byte common block, 24 reserved bytes and the CRC. hid-playstation.c [Verified]
- Common output block: flags 0/1; motors right/left 2/3; mute LED 8; right trigger effect 10–20; left trigger effect 21–31; flag2 38; lightbar setup 41; brightness 42; player LEDs 43; RGB 44–46. Trigger modes: off 0x05, feedback 0x21, bow 0x22, galloping 0x23, weapon 0x25, vibration 0x26, machine 0x27. hid-playstation.c; SDL_hidapi_ps5.c; https://github.com/nowrep/dualsensectl/blob/HEAD/main.c [Cited]

## DualShock 4
- Reports: input USB 0x01 (64 B), BT minimal 0x01 (10 B), BT full 0x11 (78 B). Output USB 0x05 (32 B), BT 0x11 (78 B). Calibration 0x02 on USB (37 B), 0x05 on BT (41 B). The default BT poll is 4 ms. Scaling is 8192/g and 1024 per °/s; the touchpad is 1920×942. hid-playstation.c [Verified]
- Any valid effects report switches Bluetooth to full reports. https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_ps4.c [Cited]. The calibration field order differs between USB and BT. hid-playstation.c [Cited]

## Switch Pro, Joy-Con and Switch 2
- IMU and timing: https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c; https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_switch.c [Verified]
  - Scaling: 4096 LSB/g and 14.247 LSB per °/s.
  - Reports arrive every 15 ms (11 ms on some set-ups); 8–17 ms is valid. Each carries 3 samples, so 200 Hz.
  - Subcommands must be 20 ms (USB) or 60 ms (BT) apart. SDL registers 200 Hz sensors.
- Start-up sequence: hid-nintendo.c [Cited]
  - A Pro over USB first needs 0x80 0x02 (handshake) and 0x80 0x04 (no timeout).
  - Then subcommands 0x40 0x01 (IMU on) and 0x03 0x30 (full reports).
  - Calibration comes from SPI reads (0x10) at 0x6020 (factory IMU) and 0x8026 (user).
- Switch 2 driver support: https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c; https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_switch2.c [Verified]
  - The kernel's hid-nintendo supports Joy-Con 2, Pro 2 and GameCube pads.
  - SDL supports them only over USB, using libusb bulk transfers; Bluetooth is "not supported".
  - Chromium has no Switch 2 IDs.
- Valve's udev rules grant raw USB (not hidraw) access to these four IDs, over USB only. https://github.com/ValveSoftware/steam-devices/blob/master/60-steam-input.rules [Verified]. Steam's Windows USB support for the Switch 2 Pro (November 2025) is reported by press only. [Unverified]
- Decision [Inference]: no WebHID plan for Switch 2 in 2026. Rely on Steam Input over USB, or the Linux kernel driver.

## Steam Input and Steam hardware
- Steam Input presents a "Steam Virtual Gamepad" (28de:11ff), which Chromium types as Xbox 360. Players get standard mapping, but no gyro, touch, LEDs or adaptive triggers through the Gamepad API. https://github.com/libsdl-org/SDL/blob/main/src/joystick/controller_list.h; https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_id_list.cc [Verified]
- hid-steam turns lizard mode (keyboard and mouse emulation) off automatically only on the Steam Controller; on the Deck the user holds Options. Steam's client uses hidraw directly. https://github.com/torvalds/linux/blob/master/drivers/hid/hid-steam.c [Verified]
- The 2026 Steam Controller ("Triton" in SDL: 1302 USB, 1303 BLE, 1304/1305 dongles) needs "disable lizard mode" re-sent every 3 s and rumble every 40 ms. Its IMU gives ±2000 °/s and ±2 g every ~4.03 ms. The Deck gives ±2000 °/s and ±2 g at 250 Hz. https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_steam_triton.c; https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_steamdeck.c [Verified correction: 1302 naming]
- Strategy [Inference]:
  - Native Gamepad API plus WebHID for PlayStation and Switch pads, because gyro, touch and triggers are core.
  - Accept Steam virtualisation for Steam Controllers, the Deck and Switch 2.
  - Detect 28de:11ff and warn about double input. Ignore synthetic pointer input while a gamepad cursor is active.

## Gyro pipeline (sourced doctrine, not re-checked)
- JoyShockMapper: https://github.com/Electronicks/JoyShockMapper/blob/HEAD/README.md [Cited]
  - Calibrate when the pad is still and offer manual recalibration. Auto-calibration can mistake slow motion for stillness.
  - Use GYRO_SENS ≥ 8 for a cursor, with two-threshold acceleration.
  - Never use a cutoff. Use tightening only as a last resort.
  - Smooth only below a small threshold (default smooth time 0.125 s).
  - Player space handles controller positions most naturally.
- GamepadMotionHelpers gives gravity, player-space gyro (yaw relax 1.41), world-space gyro, and Stillness and SensorFusion calibration. Yaw cannot be corrected without a magnetometer. https://github.com/JibbSmart/GamepadMotionHelpers [Cited]
- Tactilume pipeline [Inference]:
  - Normalise every device to °/s, g and right-handed Y-up axes.
  - Calibrate for 1–2 s on join, then auto-calibrate while idle.
  - Use player-space angular velocity as a 2D "virtual finger" (sensitivity 8–12), with a ratchet or clutch button.
  - Use a gravity vector (complementary, Madgwick or Mahony filter) for tilt effects, never absolute yaw.
  - Integrate per report using timestamps, not per frame.

## Libraries and licences
- dualsense-ts is LGPL-3.0 (npm 6.15.38, 2026-07-12). It covers WebHID and node-hid, LEDs, rumble, triggers, touch, calibrated motion and battery. https://registry.npmjs.org/dualsense-ts; https://github.com/nsfm/dualsense-ts/blob/HEAD/LICENSE [Verified]. A commercial app needs LGPL compliance (a separately replaceable module) or an in-house parser built from the kernel's documented layout. [Inference]
- webhid-ds4 is MIT (1.0.5, 2026-02-16). https://registry.npmjs.org/webhid-ds4 [Verified]
- joy-con-webhid is Apache-2.0 (0.11.0, 2025-07-17). https://registry.npmjs.org/joy-con-webhid [Verified]
- Other licences: https://github.com/JibbSmart/GamepadMotionHelpers/blob/HEAD/LICENSE; https://github.com/Electronicks/JoyShockMapper/blob/HEAD/LICENSE.md; https://github.com/daidr/dualsense-tester/blob/HEAD/LICENSE; https://github.com/nowrep/dualsensectl/blob/HEAD/LICENSE; https://github.com/nondebug/dualsense [Verified]
  - GamepadMotionHelpers, JoyShockMapper and daidr/dualsense-tester are MIT.
  - dualsensectl is GPL-2.0: read it for facts, never copy code.
  - nondebug/dualsense has no licence, so treat it as reference only.
- `ahrs` (Madgwick and Mahony filters, npm 1.3.3, 2023-10-28) has an Apache-2.0 LICENSE file, but npm says "APSL-2.0". Resolve this before using it. https://github.com/psiphi75/ahrs/blob/HEAD/LICENSE; https://registry.npmjs.org/ahrs [Verified]

## Input design and accessibility [Inference]
- Each pad acts as one or two "virtual fingers":
  - The left stick moves finger 1, with a radial deadzone and response curve; holding L3 gives ×0.3 precision.
  - The right stick places finger 2 for pinch and rotate.
  - R2 and L2 give analog pressure (attract and repel).
  - R1 and L1 cycle tools; holding both enters two-finger mode.
  - "Clear" needs a 1 s hold. Gyro is an optional pointer with a clutch, and the touchpad maps 2 points to 2 fingers.
- Up to 8 player slots, each with a colour, cursor shape and number. Mirror the colour on the DualSense or DS4 lightbar and the number on player LEDs (WebHID). Show on-screen badges for Xbox and Steam pads, and use "press any button to join".
- Accessibility:
  - Per-player remapping, and hold or toggle for every held action.
  - Left-only, right-only and gyro-only presets.
  - The Xbox Adaptive Controller works as a standard pad without rumble.
  - Radial deadzone with rescaling, an anti-deadzone, a curve exponent from 1.0 to 3.0, and outer saturation. These numbers are not sourced.

## Open gaps
- macOS: which pads report trigger haptic localities; whether WebHID triggers an Input Monitoring prompt; conflicts with GameController holding the device.
- Exclusive access on Windows and macOS when Steam, DS4Windows or HidHide hold a pad.
- Whether Chromium's `receiveFeatureReport()` includes the report-ID byte on each OS; how to switch the DualSense to full Bluetooth reports.
- `gamepadrawinputchanged` origin-trial dates; `playEffect` latency per backend; whether WGI caps the pad count.
- Steam Input per-app opt-out; overlay behaviour with Electron; Switch 2 support on Windows.
- The Switch 0x30 layout and HD-rumble encoding; Elite paddles on macOS and Linux; the `Gamepad.id` format for matching pads to WebHID devices.
- Platform-holder comfort and safety limits for haptics; the Xbox Accessibility Guidelines (unread).
