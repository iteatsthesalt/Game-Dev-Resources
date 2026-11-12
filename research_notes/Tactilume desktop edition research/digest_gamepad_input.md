This is the fact-checked digest of gamepad_input.md (gamepad input for Tactilume Desktop: Gamepad API, haptics, WebHID, motion and Steam Input in Electron 45 / Chromium 156, as of 2026-11-12).

**Status.** The Verification table covers 15 claims: 11 confirmed, 3 corrected, 1 unverifiable. Sources were read as GitHub raw files (Chromium at the 156.0.8078.96 tag and main, Electron v45.3.0, Linux, SDL, WICG, W3C, MDN BCD, Valve), npm and developer.apple.com. GyroWiki, Steamworks, chromestatus, learn.microsoft.com and press sites were unreachable. No controller was tested.

**Tags.** [Verified] re-read at source; [Verified correction] corrected against a source; [Measured] headless Chromium 153.0.8010.12 (Playwright 1.63.0, Linux) here, not Electron 45; [Cited] from the source, not re-read; [Unverified] press only; [Inference] the notes' conclusion.

**Source keys.** CR = https://github.com/chromium/chromium/blob/156.0.8078.96/ (the tag Electron 45.3.0 and 45.3.1 pin); EL = https://github.com/electron/electron/blob/v45.3.0/; LNX = https://github.com/torvalds/linux/blob/master/drivers/hid/; SDL = https://github.com/libsdl-org/SDL/blob/main/src/joystick/; BCD = https://github.com/mdn/browser-compat-data/blob/main/api/

## Bottom line
- Architecture [Inference]: the Gamepad API is the base layer for buttons, sticks and analog triggers on every pad (max 8, polled). A WebHID layer adds gyro, touchpads, LEDs, adaptive triggers and DualSense rumble on Windows, for Sony and Nintendo pads. More than 8 players need the phone controller.
- Corrections:
  - Electron 45.3.1 is now npm `latest`, with the same Chromium 156.0.8078.96.
  - In Electron 45 a gamepad press is a user activation whenever the window is visible; the "and focused" rule arrives in Chromium 159 (Electron 46).
  - SDL's naming of the 2026 Steam Controller USB ID.

## Versions
- Electron 45.3.0 was published 2026-11-10; 45.3.1 became `latest` at 2026-11-12T02:09Z. Both pin Chromium 156.0.8078.96 and Node v24.22.2. Electron main (46) pins Chromium 159.0.8154.0 and Node v26.13.0. Chromium trunk is 160.0.8157.0. https://registry.npmjs.org/electron; https://github.com/electron/electron/blob/v45.3.1/DEPS; https://github.com/electron/electron/blob/main/DEPS; https://github.com/chromium/chromium/blob/main/chrome/VERSION [Verified correction]
- desktop_app_shell, webgpu_desktop_capabilities, audio_input_analysis and their digests still call 45.3.0 the latest. The Chromium pin is unchanged, so their findings stand. [Verified correction]
- The W3C Gamepad spec is an Editor's Draft. https://github.com/w3c/gamepad/blob/gh-pages/index.html [Verified]

## Gamepad API in Electron 45
- Limits: 8 pads, 16 axes, 32 buttons, 8 touch points and a 128-character id per pad. A button counts as pressed above 30/255. CR device/gamepad/public/cpp/gamepads.h, device/gamepad/public/cpp/gamepad.h [Verified]
- Chromium polls devices every 4 ms (~250 Hz). Pages poll `getGamepads()`, typically per animation frame (60–144 Hz). The 4 ms value and the per-OS mapping tables are identical at 156 and trunk. CR device/gamepad/gamepad_provider.cc [Verified]; frame rate [Inference]
- Standard mapping: buttons 0–3 face, 4–5 bumpers, 6–7 analog triggers, 10–11 stick clicks, 12–15 D-pad, 16 home; axes 0–3 sticks (negative = left/up). https://github.com/w3c/gamepad/blob/gh-pages/index.html [Cited]
- Pads stay hidden until any button press or an axis beyond 0.5. CR device/gamepad/gamepad_user_gesture.cc [Verified]
- `getGamepads()` throws SecurityError if the `gamepad` permissions policy is off. Insecure contexts are not blocked. CR third_party/blink/renderer/modules/gamepad/navigator_gamepad.cc [Verified]
- User activation: at 156 a press is a user activation whenever the page is visible. `GamepadUserActivationFocus` (which adds a focus check) is absent at 156 and 157, and stable at 159.0.8154.0 and trunk. A "press to enable advanced features" flow that calls `navigator.hid.requestDevice()` must work under both rules. CR navigator_gamepad.cc; https://github.com/chromium/chromium/blob/159.0.8154.0/third_party/blink/renderer/platform/runtime_enabled_features.json5 [Verified correction]
- Updates stop while the page is hidden (minimised or `show:false`). CR navigator_gamepad.cc [Verified]. Keep input in the visible main window, and stop haptics on hide. [Inference]
- Opt-in features, none on by default in Electron:
  - `gamepadrawinputchanged`: the Blink feature is "experimental" with an origin-trial name; the browser feature is on by default. CR third_party/blink/renderer/platform/runtime_enabled_features.json5, device/gamepad/public/cpp/gamepad_features.cc [Verified]
    - Enable it with `webPreferences.enableBlinkFeatures: 'GamepadRawInputChangeEvent'`, feature-detect, and fall back to polling. EL docs/api/structures/web-preferences.md [Verified]; recipe untested [Inference]
  - The Edge explainer says the event fires once per HID report, uncoalesced, with index arrays (`axesChanged`, `buttonsPressed`…). 60 Hz polling adds ~8.33 ms average latency. Polling stays. https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/GamepadEventDrivenInputAPI/explainer.md [Verified]
  - Touch: the attribute is `touchEvents` (the spec says `touches`). It is behind experimental `GamepadMultitouch` and the disabled browser feature `kEnableGamepadMultitouch`.
    - Enable both: `enableBlinkFeatures: 'GamepadMultitouch'` and `--enable-features=EnableGamepadMultitouch`. The name drops the `k`. Runtime behaviour is untested. CR third_party/blink/renderer/modules/gamepad/gamepad.idl, base/feature_internal.h [Verified]
  - Electron takes features only from command-line switches plus a short hard-coded list (nothing gamepad or HID). It takes field trials only from `--force-fieldtrials`, so Chrome's remote configuration never applies. EL shell/browser/feature_list.cc [Verified]
- The Gamepad API has no gyro, accelerometer, LEDs, adaptive triggers or battery on any OS. `pose`, `hand` and `hapticActuators` are Firefox-only. BCD Gamepad.json [Verified]

## Backends and coverage
- Windows:
  - Windows.Gaming.Input (WGI) is the default. GameInput is used only on Windows 11 with a disabled feature.
  - The Nintendo and Raw Input fetchers always run.
  - The XInput fetcher is not registered, so there is no 4-pad XInput cap.
  - `kIgnorePS5GamepadsInWgi` is on, so DualSense pads arrive through Raw Input.
  - CR device/gamepad/gamepad_platform_data_fetcher.h, device/gamepad/public/cpp/gamepad_features.cc [Verified]
- macOS uses GameController (Xbox and PlayStation pads), IOKit HID, Nintendo and Xbox fetchers. Linux uses udev/evdev/hidraw plus Nintendo, and opens hidraw only for allowlisted IDs. Same files [Verified]
- Mapping tables and IDs:
  - Valve IDs (Steam Controller 1102/1142, Deck 1205, 2026 family 1302–1305) are mapped on Linux only.
  - Switch 2 IDs (057e:2066/2067/2069/2073) appear nowhere.
  - 28de:11ff (Steam Virtual Gamepad) and 2dc8:3106 are typed as Xbox 360.
  - CR device/gamepad/gamepad_standard_mappings_linux.cc, device/gamepad/gamepad_id_list.cc [Verified]
- Matrix [Inference from code]: Xbox has trigger rumble on Windows only. DualSense has no rumble or touch on Windows. DS4 and Switch pads have dual rumble everywhere. Switch 2 is unrecognised. Steam pads are standard-mapped on Linux only. Elite paddles become extra WGI buttons. [Cited]

## Haptics
- `dual-rumble` (strong and weak, 0–1) and `trigger-rumble` (adds left and right trigger) are fixed-duration, constant-intensity effects. Chromium rejects magnitudes outside 0–1 and `duration + startDelay` over 5000 ms. CR third_party/blink/renderer/modules/gamepad/gamepad_haptic_actuator.cc, device/gamepad/public/cpp/gamepad.h [Verified]
- Trigger-rumble works only on 13 Xbox One, Series and Elite IDs via WGI, and on macOS only if a pad reports both trigger localities. CR device/gamepad/gamepad_id_list.cc, device/gamepad/game_controller_gamepad.mm [Verified]. Apple documents trigger localities (macOS 11+) but not which pads have them. https://developer.apple.com/documentation/gamecontroller/gchapticslocality [Verified]
- Windows Raw Input haptics cover only the DS4 (05c4, 09cc, Scuf 7725) and three HID-haptic IDs, so DualSense rumble on Windows needs WebHID. CR device/gamepad/raw_input_gamepad_device_win.cc, device/gamepad/hid_haptic_gamepad.cc [Verified]
- Linux rumble uses evdev `FF_RUMBLE`. Nintendo dual rumble is emulated with tones, 141 Hz strong and 182 Hz weak. [Cited]
- MDN: `GamepadHapticActuator` is in Chrome 68, Firefox 55 and Safari 16.4. `playEffect` and `reset` are in Chrome 68 and Safari 16.4. `effects` and `trigger-rumble` are Chrome 126 only. BCD GamepadHapticActuator.json [Verified]
- Native timing: the 2026 Steam Controller's rumble times out after ~50 ms, so SDL re-sends every 40 ms. Switch 2 rumble is sent every 12 ms. Switch subcommands must be 20 ms (USB) or 60 ms (BT) apart. SDL hidapi/SDL_hidapi_steam_triton.c, hidapi/SDL_hidapi_switch2.c; LNX hid-nintendo.c [Verified]
- Design [Inference]:
  - One haptics owner per device: WebHID if open, else the Gamepad API.
  - 30–120 ms pulses for events; continuous layers renewed in 200–500 ms chunks, at most 10–20 calls per second.
  - Schedule `startDelay` from the audio clock. Keep haptics personal to the player who caused the event.
  - Intensity sliders and an off switch, plus a visual or audio twin for every cue.
  - Stop effects and release DualSense triggers (mode 0x05) on blur, pause or tool switch.

## WebHID in Electron
- WebHID is in Chrome 89+ and Edge, not Firefox or Safari. BCD HID.json [Verified]. `navigator.hid` exists in Chromium 153. [Measured]
- Spec rules (https://github.com/WICG/webhid/blob/main/index.bs [Verified]):
  - `requestDevice()` rejects with SecurityError without transient activation.
  - `inputreport` data excludes the report-ID byte.
  - `receiveFeatureReport()` throws a TypeError on a report-ID mismatch.
  - Feature-report data "may" start with the report ID.
- Electron has no chooser (EL docs/tutorial/devices.md, docs/api/session.md, shell/browser/hid/hid_chooser_controller.cc [Verified]):
  - Handle `select-hid-device`, call `event.preventDefault()`, then `callback(deviceId)`. Without `preventDefault()` the request resolves empty.
  - `hid-device-added` and `hid-device-removed` fire only while choosing.
  - `setDevicePermissionHandler` grants known devices silently and is how grants persist; the default lasts the WebContents' lifetime.
  - `setPermissionCheckHandler` can deny HID per origin.
- Blocklist: the static entries cover FIDO, security keys and Jabra, with no Sony, Nintendo, Microsoft, Valve or 8BitDo IDs. Protected usages are keyboard, pointer, mouse, keypad and system controls; Gamepad (0x05) and Joystick (0x04) are not protected. CR services/device/public/cpp/hid/hid_blocklist.cc, services/device/public/cpp/hid/hid_report_utils.cc [Verified]
- Linux needs hidraw access. Valve's rules give `uaccess` (82 entries) to Valve devices, DS3, DS4, DualSense and Edge, Switch Pro, Joy-Con and many third-party pads. https://github.com/ValveSoftware/steam-devices/blob/master/60-steam-input.rules [Verified]. Ship equivalent rules or require `steam-devices`. [Inference]
- Other blockers [Inference]: Steam opens hidraw itself; Xbox pads over USB use GIP, not HID; Switch 2 needs a USB bulk init. Exclusive access on Windows and macOS, and macOS permission prompts, are unknown.
- Flow [Inference]:
  - Filter `select-hid-device` by vendors 054c and 057e with usage 0x01/0x05.
  - Auto-grant known IDs, and call `navigator.hid.getDevices()` at startup.
  - Dedupe each WebHID device against its Gamepad API twin by vendor/product and correlated input.

## DualSense over WebHID
- Reports (LNX hid-playstation.c [Verified]):
  - Input: USB 0x01 (64 B); BT 0x31 (78 B, CRC32 last).
  - Output: USB 0x02 (63 B); BT 0x31 (78 B).
  - Feature: calibration 0x05 (41 B), pairing 0x09, firmware 0x20.
  - CRC seeds: input 0xA1, output 0xA2, feature 0xA3.
  - Scaling: 8192 LSB/g (±4 g), 1024 LSB per °/s (±2048 °/s).
  - Touchpad: 1920×1080, 2 points.
- Sensor rate: 250 Hz over USB, ~1000 Hz over BT, 1000 Hz for the Edge over USB. SDL hidapi/SDL_hidapi_ps5.c [Verified]
- WebHID body offsets (from `data[0]` on USB, `data[1]` on BT) (LNX hid-playstation.c [Verified]):
  - Sticks and triggers: LX 0, LY 1, RX 2, RY 3, L2 4, R2 5.
  - Buttons: 7–10.
  - Motion: gyro int16 LE at 15/17/19, accel at 21/23/25, timestamp u32 at 27.
  - Touch: 32–35 and 36–39. Status: 52–54.
- Not re-read: the timestamp unit is 1/3 µs; touch is inactive when contact bit 7 is set; 12-bit x/y packing; battery = min(level × 10 + 5, 100). LNX hid-playstation.c [Cited]
- BT output CRC: CRC-32 over seed 0xA2, then the report from its ID byte minus the last 4 bytes, stored little-endian there. The `sendReport(0x31, body)` body is 77 bytes: seq_tag, tag 0x10, a 47-byte common block, 24 reserved bytes and the CRC. LNX hid-playstation.c [Verified]
- Common block (LNX hid-playstation.c; SDL hidapi/SDL_hidapi_ps5.c; https://github.com/nowrep/dualsensectl/blob/HEAD/main.c [Cited]):
  - Offsets: flags 0/1, motors right/left 2/3, mute LED 8, right trigger 10–20, left trigger 21–31, player LEDs 43, RGB 44–46.
  - Trigger modes: off 0x05, feedback 0x21, bow 0x22, galloping 0x23, weapon 0x25, vibration 0x26, machine 0x27.

## DualShock 4
- Reports: input USB 0x01 (64 B), BT minimal 0x01 (10 B), BT full 0x11 (78 B). Output USB 0x05 (32 B), BT 0x11 (78 B). Calibration 0x02 on USB, 0x05 on BT. BT poll 4 ms. Scaling 8192/g and 1024 per °/s; touchpad 1920×942. LNX hid-playstation.c [Verified]
- Any effects (output) report, even an invalid one, switches BT to full reports. The calibration field order differs between USB and BT. SDL hidapi/SDL_hidapi_ps4.c; LNX hid-playstation.c [Cited]

## Switch Pro, Joy-Con and Switch 2
- IMU: 4096 LSB/g and 14.247 LSB per °/s. Reports arrive every 15 ms (11 ms on some set-ups); 8–17 ms is valid. Each carries 3 samples (200 Hz). Subcommands must be 20 ms (USB) or 60 ms (BT) apart. LNX hid-nintendo.c; SDL hidapi/SDL_hidapi_switch.c [Verified]
- Start-up: a Pro over USB sends 0x80 0x02, then 0x80 0x04. Then subcommands 0x40 0x01 (IMU on) and 0x03 0x30 (full reports), and SPI calibration reads at 0x6020 and 0x8026. LNX hid-nintendo.c [Cited]
- Switch 2: the kernel supports Joy-Con 2, Pro 2 and GameCube pads. SDL supports them only over USB, with libusb bulk transfers, and not over Bluetooth. Chromium has no Switch 2 IDs. LNX hid-nintendo.c; SDL hidapi/SDL_hidapi_switch2.c [Verified]
- Valve's udev rules grant raw USB access to the four Switch 2 IDs over USB only. https://github.com/ValveSoftware/steam-devices/blob/master/60-steam-input.rules [Verified]. Steam's Windows USB support (November 2025) is press-only. [Unverified]
- Decision [Inference]: no WebHID plan for Switch 2. Use Steam Input over USB, or the Linux driver.

## Steam
- Steam Input presents a "Steam Virtual Gamepad" (28de:11ff), which Chromium types as Xbox 360. It is standard-mapped, but has no gyro, touch, LEDs or triggers in the Gamepad API. SDL controller_list.h; CR device/gamepad/gamepad_id_list.cc [Verified]
- hid-steam disables lizard mode (keyboard and mouse emulation) automatically only on the Steam Controller; on the Deck the user holds Options. Steam's client reads hidraw directly. LNX hid-steam.c [Verified]
- The 2026 controller needs lizard-off re-sent every 3 s and rumble every 40 ms. Its IMU gives ±2000 °/s and ±2 g every ~4.03 ms. The Deck gives the same ranges at 250 Hz. SDL hidapi/SDL_hidapi_steam_triton.c, hidapi/SDL_hidapi_steamdeck.c [Verified]
- SDL names 28de:1302 "Valve Steam Triton Controller" (USB) and only 1303 "(BLE)"; 1304/1305 are dongles. SDL controller_list.h [Verified correction]
- Strategy [Inference]:
  - Native Gamepad API plus WebHID for PlayStation and Switch pads.
  - Accept Steam virtualisation for Steam pads, the Deck and Switch 2.
  - Detect 28de:11ff and warn about double input. Ignore synthetic pointer input while a gamepad cursor is active.

## Gyro (doctrine not re-checked)
- JoyShockMapper: calibrate when still and offer recalibration; GYRO_SENS ≥ 8 for a cursor; two-threshold acceleration; no cutoff; minimal smoothing. https://github.com/Electronicks/JoyShockMapper/blob/HEAD/README.md [Cited]
- GamepadMotionHelpers: player-space gyro (yaw relax 1.41); yaw drifts without a magnetometer. https://github.com/JibbSmart/GamepadMotionHelpers [Cited]
- Pipeline [Inference]: normalise units and axes; calibrate on join; use angular velocity for pointing and a gravity vector for tilt, never yaw; integrate per report.

## Libraries and licences
- dualsense-ts is LGPL-3.0 (npm 6.15.38, 2026-07-12). It covers WebHID, rumble, triggers, LEDs, touch and calibrated motion. https://registry.npmjs.org/dualsense-ts; https://github.com/nsfm/dualsense-ts/blob/HEAD/LICENSE [Verified]. A commercial app needs a replaceable module or an in-house parser. [Inference]
- webhid-ds4 is MIT (1.0.5, 2026-02-16), and joy-con-webhid is Apache-2.0 (0.11.0, 2025-07-17). https://registry.npmjs.org/webhid-ds4; https://registry.npmjs.org/joy-con-webhid [Verified]
- GamepadMotionHelpers, JoyShockMapper and dualsense-tester are MIT. dualsensectl is GPL-2.0, so read it for facts only. nondebug/dualsense has no licence. https://github.com/JibbSmart/GamepadMotionHelpers/blob/HEAD/LICENSE; https://github.com/nowrep/dualsensectl/blob/HEAD/LICENSE; https://github.com/nondebug/dualsense [Verified]
- `ahrs` (Madgwick and Mahony, 1.3.3) has an Apache-2.0 LICENSE, but npm says "APSL-2.0". Resolve this before use. https://github.com/psiphi75/ahrs/blob/HEAD/LICENSE; https://registry.npmjs.org/ahrs [Verified]

## Design proposals [Inference]
- Pads as "virtual fingers": sticks move fingers 1 and 2, R2/L2 give pressure, gyro is a clutched pointer, the touchpad maps to 2 fingers.
- 8 slots by colour, shape and number, mirrored on lightbars via WebHID. "Press any button to join".
- Accessibility: remapping, hold or toggle, one-handed presets, tunable deadzones (numbers unsourced).

## Open gaps
- macOS: which pads report trigger localities; WebHID permission prompts.
- Exclusive access when Steam, DS4Windows or HidHide hold a pad.
- Chromium's handling of the feature-report ID byte; switching the DualSense to full BT reports.
- Origin-trial dates for the raw-input event; `playEffect` latency; whether WGI caps the pad count.
- Steam Input per-app opt-out and overlay behaviour.
- The Switch 0x30 layout; the `Gamepad.id` format for matching pads to WebHID devices.
- Comfort and safety limits for haptics; the Xbox Accessibility Guidelines.
