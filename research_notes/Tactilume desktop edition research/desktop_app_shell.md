# Desktop app shell for Tactilume Desktop: runtimes, packaging, signing, updates, Steam and CI (state as of 2026-11-12)

_Research constraints: these hosts could not be reached from this session: electronjs.org, learn.microsoft.com, tauri.app, electron.build, electronforge.io, partner.steamgames.com (Steamworks docs), webkit.org, webkitgtk.org, support.apple.com, azure.microsoft.com, docs.github.com, wiki.libsdl.org, nwjs.io and docs.flathub.org. The shared web-search budget also ran out after the first round of searches. Where possible, the same documents were read from their GitHub source repositories (raw.githubusercontent.com), the npm registry, developer.apple.com (DocC JSON) and GitHub pages. Claims that come only from search-result snippets are labeled "search summary, not verified"._

## Objective: how the candidate runtimes compare (WebGPU, ray tracing, input APIs, LAN server, size/startup/memory, packaging, Linux formats)

### Takeaway
Electron is the only web-technology runtime that ships the same Chromium engine on Windows, macOS and Linux. It gives WebGPU, the Gamepad API, WebHID and a Node.js HTTP/WebSocket server everywhere, at a cost of roughly 120–160 MB of compressed runtime. Tauri 2 is far smaller, but it depends on each OS's webview: there is no WebGPU on Linux (WebKitGTK), WebGPU on macOS only from macOS 26, and no WebHID on macOS or Linux. An installable PWA cannot host the phone controller's local server. Only native code (wgpu/SDL3, C++ on Vulkan/D3D12/Metal, or a native engine) reaches hardware ray tracing and the DLSS/XeSS-class upscalers, and only by giving up reuse of the existing web codebase.

### Cited Findings
**WebGPU / input availability by engine**
- Chromium (Chrome) has supported WebGPU on ChromeOS, macOS and Windows since Chrome 113. Since Chrome 144 it is "Supported on ChromeOS, macOS, Windows, and Linux (Intel Gen12+ GPUs only)". Edge mirrors Chrome. Safari has supported it since 26. Firefox support since 141 is partial: Windows since 141, macOS Tahoe on Apple silicon since 145, older Apple-silicon macOS since 147, no Intel Macs, no Linux. — [MDN browser-compat-data api/GPU.json](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/GPU.json) [Verified: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/GPU.json]
  - MDN's Linux note is narrower than Chromium's code. The Linux GPU blocklist entry that gates WebGPU (`software_rendering_list.json` entry 186, "Disable webgpu on vk via gl interop") exempts Intel Gen12+ on Mesa ≥ 22.0 and also NVIDIA drivers ≥ 535.183.01. The NVIDIA exemption is present at the Chromium 148.0.7778.280 tag and at every later tag checked (150, 152, 156, 159, main), and absent at 146.0.7680.216. AMD GPUs and pre-Gen12 Intel stay blocked by default. Linux desktop builds set `use_webgpu_on_vulkan_via_gl_interop = enable_vulkan && is_linux && use_dawn`, so this entry is the effective gate. [Verified correction: https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/software_rendering_list.json; https://raw.githubusercontent.com/chromium/chromium/main/ui/gl/BUILD.gn]
- WebHID: Chrome 89+, Edge mirrors Chrome, Firefox and Safari not supported. — [MDN BCD api/HID.json](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/HID.json) [Verified: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/HID.json] (Measured in this container: `navigator.hid` exists in headless Chromium 153.)
- Gamepad API: Chrome 21, Firefox 29, Safari 10.1, Edge 12. — [MDN BCD api/Gamepad.json](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Gamepad.json) [Verified: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Gamepad.json]
- Electron 45 (stable since 2026-10-21) ships Chromium 156.0.8078.48, V8 15.6 and Node v24.22.0. — [Electron 45 blog post (source)](https://raw.githubusercontent.com/electron/website/main/blog/electron-45-0.md) [Verified: https://raw.githubusercontent.com/electron/website/main/blog/electron-45-0.md]
- Electron 45 runs on macOS 13 Ventura and later and on Windows 10 and later, with x64 and arm64 binaries for Windows, macOS and Linux. [Verified: https://raw.githubusercontent.com/electron/electron/v45.3.0/README.md]
- Electron exposes WebHID. Apps must handle device choice through the Session `select-hid-device` event, since there is no built-in picker, and grant access with `ses.setDevicePermissionHandler()`. Electron uses Chromium's WebHID blocklist by default, which the `disable-hid-blocklist` switch can turn off. — [Electron docs: Device Access](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/devices.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/devices.md]
- Tauri maintainer comments, in chronological order. Mar 2023: on Windows, WebGPU could be enabled by passing `--enable-unsafe-webgpu` via `additionalBrowserArgs`, "Still, this is windows only!". Oct 2024: "You can't enable feature flags in WKWebView to our knowledge". Feb 2025: asked whether Electron is better for cross-OS WebGPU, the maintainer answered "yes". Sep 2025: WebGPU would come to Tauri automatically if Apple enabled it in WKWebView, but only for macOS 26+ users, because WKWebView updates are tied to OS updates. Nov 2025: it "should work out of the box on macos/ios 26+"; a user confirmed it works in a production build but failed to initialize in a development build. The issue is closed as "not planned". — [tauri-apps/tauri#6381](https://github.com/tauri-apps/tauri/issues/6381) [Verified: https://github.com/tauri-apps/tauri/issues/6381]
- In the WebKitGTK 2.52 build options, the Gamepad API is enabled by default (`ENABLE_GAMEPAD PUBLIC ON`) and requires libmanette. The GTK options file has no WebGPU option. — [WebKit OptionsGTK.cmake, webkitglib/2.52](https://raw.githubusercontent.com/WebKit/WebKit/webkitglib/2.52/Source/cmake/OptionsGTK.cmake) [Verified: https://raw.githubusercontent.com/WebKit/WebKit/webkitglib/2.52/Source/cmake/OptionsGTK.cmake]
- WebKitGTK 2.52 is no longer the newest stable line. The `webkitglib/2.54` branch exists and its NEWS file is at 2.54.2. The 2.54 and main `OptionsGTK.cmake` still have no WebGPU option (gamepad stays `PUBLIC ON` with libmanette), and the 2.54 release notes have no WebGPU entry, so "no WebGPU in WebKitGTK" still holds. [Verified correction: https://raw.githubusercontent.com/WebKit/WebKit/webkitglib/2.54/Source/cmake/OptionsGTK.cmake; https://raw.githubusercontent.com/WebKit/WebKit/webkitglib/2.54/Source/WebKit/gtk/NEWS]
- WebKit's `WebGPUEnabled` preference defaults to true only when the build defines `ENABLE(WEBGPU_BY_DEFAULT)`; otherwise it is false. It is also disabled in Lockdown Mode. — [WebKit UnifiedWebPreferences.yaml](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml)
- The WebKitGTK 2.52.x release notes (2.52.0 to 2.52.6) contain no WebGPU entry. — [WebKitGTK NEWS, webkitglib/2.52](https://raw.githubusercontent.com/WebKit/WebKit/webkitglib/2.52/Source/WebKit/gtk/NEWS)
- Safari 26.0 release notes: "Added support for WebGPU" and "Added HDR support in WebGPU Canvas". Safari 26 is available for macOS 26, macOS Sequoia and macOS Sonoma. — [Safari 26.0 Release Notes](https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes) [Verified: https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes]
- WebView2 is Edge-based, and "Most features work the same in WebView2 and Microsoft Edge". The only web platform features listed as unavailable are Push Notifications, the Web Payment API and Periodic Background Sync (doc dated 2025-11-14). — [Differences between Microsoft Edge and WebView2 (source)](https://raw.githubusercontent.com/MicrosoftDocs/edge-developer/main/microsoft-edge/webview2/concepts/browser-features.md) [Verified: https://raw.githubusercontent.com/MicrosoftDocs/edge-developer/main/microsoft-edge/webview2/concepts/browser-features.md]

**Size and startup**
- Download sizes of the Electron 45.3.0 runtime zips, measured from the GitHub release assets' Content-Length: win32-x64 158,018,881 bytes; darwin-arm64 121,100,277; darwin-x64 124,992,519; linux-x64 123,825,417. — [electron v45.3.0 release assets](https://github.com/electron/electron/releases/download/v45.3.0/electron-v45.3.0-win32-x64.zip) [Verified: https://github.com/electron/electron/releases/expanded_assets/v45.3.0 — GitHub shows 151, 115, 119 and 118 MiB, which match these byte counts; win32-arm64 is 149 MiB and linux-arm64 119 MiB]
- Tauri: "Tauri by default provides very small binaries". Its docs recommend a Cargo release profile with `lto = true`, `opt-level = "s"`, `panic = "abort"` and `strip = true`. — [Tauri docs: App Size (source)](https://raw.githubusercontent.com/tauri-apps/tauri-docs/v2/src/content/docs/concept/size.mdx)
- Tauri AppImages bundle their dependencies, so "the file size grows from the 2-6 MB range to 70+ MB". — [Tauri docs: AppImage (source)](https://raw.githubusercontent.com/tauri-apps/tauri-docs/v2/src/content/docs/distribute/appimage.mdx)
- Electron 45 startup work: it avoids loading Electron's JavaScript bootstrap bundle in sandboxed renderers unless `webviewTag` is enabled, prefetches framework files for faster cold launch on macOS, implements menus natively, and lowers IPC and native-call overhead. — [Electron 45 blog post](https://raw.githubusercontent.com/electron/website/main/blog/electron-45-0.md)

**Packaging / Linux formats**
- electron-builder targets. macOS: dmg, pkg, mas. Linux: AppImage, snap, deb, rpm, freebsd, pacman, p5p, apk. Windows: nsis, nsis-web, portable, AppX, MSI, Squirrel.Windows. It can publish to GitHub Releases, Amazon S3 and DigitalOcean Spaces, and offers Docker images for building Linux or Windows apps on any platform. — [electron-builder README](https://raw.githubusercontent.com/electron-userland/electron-builder/master/README.md)
- Flatpak packaging of Electron apps uses the base app `org.electronjs.Electron2.BaseApp`. The recommended permissions include `--device=dri`, `--socket=x11`, `--socket=pulseaudio` and `--share=network`. Native Wayland is still described as experimental (`--ozone-platform-hint=auto`). — [Flatpak docs: Electron (source)](https://raw.githubusercontent.com/flatpak/flatpak-docs/master/docs/electron.rst) [Verified: https://raw.githubusercontent.com/flatpak/flatpak-docs/master/docs/electron.rst]
- Flatpak device permissions: `dri` ("Necessary for GL"); `input` ("Input devices as exposed in /dev/input. This includes game controllers. Since Flatpak 1.15.6"); `usb` (since 1.15.11); `all`. — [Flatpak docs: Sandbox permissions (source)](https://raw.githubusercontent.com/flatpak/flatpak-docs/master/docs/sandbox-permissions.rst) [Verified: https://raw.githubusercontent.com/flatpak/flatpak-docs/master/docs/sandbox-permissions.rst]
- AppImages need FUSE 2. On Ubuntu 22.04 and later, which ship fuse3, users must install `libfuse2` alongside it, and in Ubuntu 24.04 the package was renamed `libfuse2t64`. AppImages can fall back to `--appimage-extract-and-run` or `APPIMAGE_EXTRACT_AND_RUN=1`. — [AppImage docs: FUSE troubleshooting (source)](https://raw.githubusercontent.com/AppImage/docs.appimage.org/master/source/user-guide/troubleshooting/fuse.rst) [Verified: https://raw.githubusercontent.com/AppImage/docs.appimage.org/master/source/user-guide/troubleshooting/fuse.rst]
- Tauri v2 on Linux requires WebKitGTK 4.1. Tauri recommends building on the oldest base system you support, such as Ubuntu 22.04 or Debian 12, to avoid glibc errors like `GLIBC_2.33 not found`. — [Tauri docs: AppImage](https://raw.githubusercontent.com/tauri-apps/tauri-docs/v2/src/content/docs/distribute/appimage.mdx)
- Tauri's Flathub manifest example uses the `org.gnome.Platform` runtime 47 with `--device=dri`. It mentions `WEBKIT_DISABLE_COMPOSITING_MODE=1` as an optional workaround for black webviews on Wayland. — [Tauri docs: Flathub (source)](https://raw.githubusercontent.com/tauri-apps/tauri-docs/v2/src/content/docs/distribute/flatpak.mdx)

**Versions of the alternatives (npm registry publish dates)**
- Tauri CLI `@tauri-apps/cli` latest stable is 2.12.4 (2026-10-21); the `next` tag is 3.0.0-alpha.6. — [npm @tauri-apps/cli](https://registry.npmjs.org/@tauri-apps/cli) [Verified: https://registry.npmjs.org/@tauri-apps/cli]
- NW.js `nw` latest is 0.119.2 (2026-10-23), with a separate `0.119.2-sdk` (developer tools) flavor. — [npm nw](https://registry.npmjs.org/nw) [Verified: https://registry.npmjs.org/nw]
- steamworks.js presents itself as "A steamworks implementation for nw.js/electron games" (repository tagline; search summary, not verified). — [ceifa/steamworks.js](https://github.com/ceifa/steamworks.js/)

**Native options**
- wgpu v30.0.1 (2026-08-21), following v30.0.0 (2026-07-01), has experimental hardware ray tracing: `Features::EXPERIMENTAL_RAY_QUERY` (the acceleration-structure feature was merged into it) and `Features::EXPERIMENTAL_RAY_TRACING_PIPELINES`. v29.0.0 added Metal-backend acceleration structures and v30 added SPIR-V output for ray-tracing pipelines. Several newer ray-tracing additions are "Currently only supported with the SPIR-V backend". Mesh shaders now have full support, including HLSL/DX12. — [wgpu CHANGELOG](https://raw.githubusercontent.com/gfx-rs/wgpu/trunk/CHANGELOG.md) [Verified: https://raw.githubusercontent.com/gfx-rs/wgpu/trunk/CHANGELOG.md — note that the SPIR-V-only `hit_barycentrics` entry sits under "Unreleased", i.e. it is not in v30.0.1]
- SDL 3.4.20 (stable bugfix release, 3 Nov 2026) adds HIDAPI support for more controllers and improves Switch controller IMU calibration. — [SDL releases](https://github.com/libsdl-org/SDL/releases/latest) [Verified: https://github.com/libsdl-org/SDL/releases/latest]
- SDL3's gamepad API includes `SDL_GamepadHasSensor`, `SDL_SetGamepadSensorEnabled`, `SDL_GetGamepadSensorData` and `SDL_GetGamepadSensorDataRate`, touchpad finger queries, `SDL_RumbleGamepad`, `SDL_RumbleGamepadTriggers`, `SDL_SetGamepadLED` and `SDL_GetGamepadSteamHandle`. — [SDL3 SDL_gamepad.h](https://raw.githubusercontent.com/libsdl-org/SDL/main/include/SDL3/SDL_gamepad.h)
- Godot's latest stable is 4.7.2 (maintenance release, 18 Aug). — [Godot releases](https://github.com/godotengine/godot/releases/latest) [Verified: https://github.com/godotengine/godot/releases/latest]

### Inferences
- Decision matrix synthesized from the findings in this file. "?" marks an item not verified in this session.

| | Electron 45 | Tauri 2.12 | NW.js 0.119 | Installable PWA (Chrome/Edge) | Native (wgpu/SDL3, C++, Godot/Unity/Unreal) |
|---|---|---|---|---|---|
| WebGPU | Bundled Chromium 156: on by default on Win/macOS; on Linux by default only for Intel Gen12+ (Mesa ≥ 22.0) and NVIDIA ≥ 535.183.01, while AMD and older Intel need flags or WebGL2 [Verified correction: https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/software_rendering_list.json] | Win: WebView2 (Edge-based, likely default-on, ?); macOS: only macOS 26+; Linux: none (WebKitGTK) | Chromium-based (version ?) | Same as Chrome/Edge; not Firefox on Linux | N/A: uses Vulkan/D3D12/Metal directly (wgpu implements WebGPU-style API natively) |
| HW ray tracing | No (not in WebGPU) | No | No | No | Yes (wgpu experimental; full in D3D12/Vulkan/Metal and engines) |
| Gamepad API | Yes | Yes on all three (WebKitGTK needs libmanette; focus-dependent) | Yes | Yes | SDL3 gamepad + sensors, touchpad, rumble, LED |
| WebHID | Yes (app must implement chooser) | Win only (?); not WKWebView/WebKitGTK | Probably (?) | Chrome/Edge only | Direct HID (SDL HIDAPI / hidapi) |
| LAN HTTP+WS server | Node in main or `utilityProcess` | Rust core (e.g., tokio) (?) | Node | Not possible (web pages can't listen) | Any |
| Compressed runtime size | ~121–158 MB zip | ~2–6 MB (AppImage 70+ MB) | ? | ~0 (browser) | Varies (?) |
| Engine consistency across OSes | Identical | Three different engines, OS-dependent versions | Identical | Depends on user's browser | Identical |

- Electron is the low-risk path for the existing WebGL2/ES-module bundle. It is the only option that keeps one engine version across Windows, macOS and Linux and also has Node for the phone-controller server. Tauri's three-webview split would break WebGPU on Linux and on macOS before 26, and WebHID on macOS and Linux.
- The Linux GPU gate does carry over to Electron 45: it is the `software_rendering_list.json` entry compiled into the Chromium 156.0.8078.96 that Electron 45 pins. It is wider than MDN says. NVIDIA proprietary drivers ≥ 535.183.01 are exempt along with Intel Gen12+ on Mesa ≥ 22.0. AMD Linux users, including Steam Deck and the AMD-based Steam Machine, and pre-Gen12 Intel users need a WebGL2 fallback or forced enabling. Chromium 156 has `--ignore-gpu-blocklist` and a `ForceEnableWebGpuInterop` feature that bypasses this check, but neither was tested here. [Verified correction: https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/software_rendering_list.json; https://raw.githubusercontent.com/chromium/chromium/main/gpu/config/gpu_util.cc; https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/gpu_switches.cc]
- Because the web edition is already a single offline HTML file, the desktop shell can load it from a custom protocol (Electron `protocol.handle`, or Electron 45's experimental `protocol.registerSource()`) rather than `file://`. See the security section.

### Gaps
- No reliable 2026 benchmarks were found for startup time or idle/GPU memory of Electron vs Tauri vs NW.js vs native.
- The NW.js 0.119 Chromium/Node versions and NW.js packaging, auto-update and signing tooling (nwjs.io unreachable) were not checked.
- Not verified whether WebView2 enables WebGPU by default without flags. The 2023 Tauri comment predates WebView2's current Chromium; the WebView2 differences doc does not list WebGPU as unavailable. Also not verified: whether WebHID's `requestDevice()` chooser works in WebView2 hosted by Tauri.
- Not verified: Safari 26 / WKWebView WebGPU on macOS Sequoia or Sonoma, which Safari 26 also supports. The Tauri maintainer assumed only macOS 26+.
- Unity 6.x and Unreal 5.x versions, licensing, export sizes and ray-tracing/upscaler details were not researched (docs not reachable, search budget exhausted). For Godot 4.7 only the version was found.
- The unverified PWA points (no source fetched) were: Chromium's Direct Sockets API (TCP server sockets) appears to be limited to Isolated Web Apps; installing a PWA needs an online first visit; Firefox desktop has no install support.

## 1. What is the current stable Electron (late 2026), with which Chromium and Node versions, release cadence and support window?

### Takeaway
The current stable is Electron 45.3.0, published 2026-11-10. Electron 45.0.0 shipped on 2026-10-21 with Chromium 156, V8 15.6 and Node 24.22. A new major arrives every 8 weeks, and only the latest three stable majors (45, 44, 43) get fixes. Each major is supported for about 24 weeks. Electron 46 is in alpha on Chromium 159 and Node 26.

### Cited Findings
- On the npm registry, the `latest` dist-tag is 45.3.0 (published 2026-11-10T21:11Z). The other supported lines' latest patches are 44.11.1 (2026-11-11) and 43.8.8 (2026-11-10). Electron 42's last patch was 42.11.18 (2026-10-21). The `alpha` tag is 46.0.0-alpha.9 (2026-11-11). — [npm registry: electron](https://registry.npmjs.org/electron) [Verified: https://registry.npmjs.org/electron]
- Stable x.0.0 publish dates in 2026: 40.0.0 Jan 16, 41.0.0 Mar 11, 42.0.0 May 6, 43.0.0 Jun 30, 44.0.0 Aug 25, 45.0.0 Oct 21. — [npm registry: electron](https://registry.npmjs.org/electron) [Verified: https://registry.npmjs.org/electron]
- Electron 45.0.0 (blog dated 2026-10-21) upgraded Chromium 152.0.7977.54 → 156.0.8078.48, Node v24.18.1 → v24.22.0 and V8 15.2 → 15.6. The post also announced "End of Support for 42.x.y". — [Electron 45 blog post (source of electronjs.org/blog/electron-45-0)](https://raw.githubusercontent.com/electron/website/main/blog/electron-45-0.md) [Verified: https://raw.githubusercontent.com/electron/website/main/blog/electron-45-0.md — its "Stack Changes" list links the release notes for Chromium 153, 154, 155 and 156]
- Electron 44 shipped Chromium 152.0.7977.54, V8 15.2 and Node v24.18.1, and ended support for 41.x.y. — [Electron 44 blog post (source)](https://raw.githubusercontent.com/electron/website/main/blog/electron-44-0.md) [Verified: https://raw.githubusercontent.com/electron/website/main/blog/electron-44-0.md — "upgrades Chromium from 150.0.7871.46 to 152.0.7977.54"; a two-milestone step under the old four-week Chromium cadence]
- Pinned dependency versions in each release tag's DEPS file:

  | Tag | Chromium | Node |
  |---|---|---|
  | v45.3.0 | 156.0.8078.96 | v24.22.2 |
  | v44.11.1 | 152.0.7977.169 | v24.22.2 |
  | v43.8.8 | 150.0.7871.250 | v24.22.1 |
  | v46.0.0-alpha.9 | 159.0.8153.0 | v26.13.0 |

  Sources: [v45.3.0](https://raw.githubusercontent.com/electron/electron/v45.3.0/DEPS), [v44.11.1](https://raw.githubusercontent.com/electron/electron/v44.11.1/DEPS), [v43.8.8](https://raw.githubusercontent.com/electron/electron/v43.8.8/DEPS), [v46.0.0-alpha.9](https://raw.githubusercontent.com/electron/electron/v46.0.0-alpha.9/DEPS) [Verified: all four DEPS files re-read; Electron `main` is at 159.0.8154.0 / Node v26.13.0 — https://raw.githubusercontent.com/electron/electron/main/DEPS]
- Cadence and policy, from Electron's release documentation:
  - "Electron's cadence between major version releases is 8 weeks long", with a four-week alpha phase and a four-week beta phase.
  - "Electron's official support policy is the latest 3 stable releases".
  - Only the latest minor of each supported line gets fixes, and the oldest supported line receives "only security fixes directly".
  - Electron upgrades to even-numbered Node.js versions when they enter Active LTS.
  - Breaking API changes keep the old behavior for at least two major versions when possible.
  - Beta, stable and end-of-life dates "are determined by Chromium, and may be subject to change".

  — [Electron Releases doc (source of electronjs.org/docs/latest/tutorial/electron-timelines)](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/electron-timelines.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/electron-timelines.md]
- The same doc's schedule diagram shows v41 (alpha from 2026-01-19, Chrome M146) and v42 (M148) "Supported until v45 release". It says "Electron targets Chromium even-number versions". The full release schedule now lives at releases.electronjs.org/schedule. — [Electron Releases doc](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/electron-timelines.md) [Verified: same source]
- The "even-number versions … in concert with Chromium's 4-week release schedule" sentence is out of date. Chromium's own release-cycle doc says "every four weeks" at the 152.0.7977.169 tag and "Chrome ships a new milestone (major version) to the stable channel every two weeks" at the 156.0.8078.96 tag and on main. Every fourth milestone also gets an 8-week extended-stable branch. Electron kept its 8-week cadence, so one Electron major now spans four Chromium milestones (Electron 44 = 152, Electron 45 = 156). [Verified correction: https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/docs/process/release_cycle.md; https://raw.githubusercontent.com/chromium/chromium/152.0.7977.169/docs/process/release_cycle.md]
- Other Electron 45 changes that matter here:
  - Sandboxed preloads no longer get `Buffer`, `setImmediate`, `clearImmediate` or the `events`/`timers`/`url` shims.
  - ASAR files are read directly from the archive.
  - An experimental `protocol.registerSource()` serves custom schemes from directories or ASAR without a JS handler (also in 44.6.0).
  - The macOS `autoUpdater` streams downloads, resumes them, and supports binary deltas (also in 44.7.0).
  - A Windows Error Reporting helper `electron_wer.dll` must be renamed to match a renamed executable.
  - The synchronous `safeStorage` methods are deprecated and will be removed in 46.

  — [Electron 45 blog post](https://raw.githubusercontent.com/electron/website/main/blog/electron-45-0.md) [Verified: https://raw.githubusercontent.com/electron/website/main/blog/electron-45-0.md]

### Inferences
- The support window is about 24 weeks per major. 42.0.0 (2026-05-06) reached end of support with 45.0.0 (2026-10-21). Tactilume Desktop should plan to move up at least one major roughly every 8–16 weeks to stay on a supported line.
- Electron 46 is due about 8 weeks after 2026-10-21, around mid-December 2026, if the schedule holds. That release would end support for 43.x. [Unverified: releases.electronjs.org/schedule not reachable; consistent with the 8-week cadence. With Chromium on two-week milestones, the 46 target is presumably M160, the next extended-stable milestone after 156 (inference). Its alpha is still on a trunk build, 159.0.8153.0.]
- Electron 45's Chromium (156) has had WebGPU on by default on Windows and macOS since Chromium 113, per MDN BCD for Chrome. Electron's bundled Chromium is pinned per release, so every user of the same app version gets the same engine.

### Gaps
- ~~Not explained: Electron 44 → 45 jumped four Chromium majors (152 → 156).~~ Resolved: Chromium moved from four-week to two-week stable milestones between M152 and M156 (see the correction above), and Electron's 8-week cadence now covers four milestones. [Verified correction: https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/docs/process/release_cycle.md]
- Exact planned dates for Electron 46/47 (releases.electronjs.org unreachable).

## 2. Does Tauri 2 offer WebGPU on each OS (WebView2, WKWebView on macOS 26, WebKitGTK), and the Gamepad API and WebHID in each webview?

### Takeaway
WebGPU in Tauri 2 depends on each OS's webview:
- Windows (WebView2): Chromium-based. A maintainer confirmed in 2023 that WebGPU can be enabled with a flag, and it is likely on by default today, though that was not verified.
- macOS (WKWebView): works out of the box only on macOS 26+, per Tauri maintainers and Safari 26 release notes.
- Linux (WebKitGTK 4.1): no WebGPU. The GTK build options have no WebGPU option and the 2.52 release notes don't mention it.

The Gamepad API exists in all three engines. WebHID exists only in Chromium-based WebView2; WebKit (WKWebView, WebKitGTK) doesn't implement it.

### Cited Findings
- Tauri renders with the system webview: WebView2 on Windows, WKWebView on macOS and WebKitGTK on Linux. Maintainers say they have "no control over" WebGPU on macOS and Linux "as long as we're 'stuck' with the OS webviews". Feature flags can't be enabled in WKWebView. A custom WebKit build would have to be bundled with the app. — [tauri-apps/tauri#6381](https://github.com/tauri-apps/tauri/issues/6381)
- Windows: in 2023 the maintainer first said WebGPU was only in non-stable WebView2 channels, then corrected that the same day: `--enable-unsafe-webgpu` via `additionalBrowserArgs` works in the stable channel. — [tauri-apps/tauri#6381](https://github.com/tauri-apps/tauri/issues/6381)
- macOS: WebGPU "should work out of the box on macos/ios 26+" (maintainer, Nov 2025). A user confirmed it in a production build; a development build failed to initialize WebGPU. WKWebView updates come with OS updates, so only macOS 26+ users get it. — [tauri-apps/tauri#6381](https://github.com/tauri-apps/tauri/issues/6381) [Verified: https://github.com/tauri-apps/tauri/issues/6381 — maintainer quotes of 2025-09-12 and 2025-11-24 re-read; the user's production/dev-build report was not re-checked]
- Safari 26.0 added WebGPU support and HDR in WebGPU canvas. — [Safari 26.0 Release Notes](https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes)
- WebKit's WebGPU preference is on by default only in builds that define `ENABLE(WEBGPU_BY_DEFAULT)`. — [UnifiedWebPreferences.yaml](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml)
- WebKitGTK 2.52: `ENABLE_GAMEPAD` defaults ON and libmanette is required. There is no WebGPU build option in the GTK port's options. — [OptionsGTK.cmake (2.52)](https://raw.githubusercontent.com/WebKit/WebKit/webkitglib/2.52/Source/cmake/OptionsGTK.cmake) [Verified: same source; also true of the newer 2.54 branch and main — https://raw.githubusercontent.com/WebKit/WebKit/webkitglib/2.54/Source/cmake/OptionsGTK.cmake]
- The WebKitGTK release notes record a fix for "gamepads detection by correctly handling focused window in GTK4". The 2.52.0–2.52.6 notes have no WebGPU entry. — [WebKitGTK NEWS (2.52 branch)](https://raw.githubusercontent.com/WebKit/WebKit/webkitglib/2.52/Source/WebKit/gtk/NEWS)
- Tauri v2 requires WebKitGTK 4.1, provided as `libwebkit2gtk-4.1-dev` on Ubuntu 22.04 and Debian 12. — [Tauri docs: AppImage](https://raw.githubusercontent.com/tauri-apps/tauri-docs/v2/src/content/docs/distribute/appimage.mdx)
- WebHID: Chrome 89+, Edge mirrors Chrome; not supported in Safari or Firefox. Gamepad API: Safari since 10.1, Chrome since 21. — [MDN BCD HID](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/HID.json); [MDN BCD Gamepad](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Gamepad.json)
- WebView2 lists only Push Notifications, Web Payment API and Periodic Background Sync as unavailable web platform features. — [WebView2 vs Edge differences (source)](https://raw.githubusercontent.com/MicrosoftDocs/edge-developer/main/microsoft-edge/webview2/concepts/browser-features.md)
- The latest Tauri CLI is 2.12.4 (2026-10-21); Tauri 3 is in alpha (3.0.0-alpha.6). — [npm @tauri-apps/cli](https://registry.npmjs.org/@tauri-apps/cli)

### Inferences
- Per-OS summary for Tauri 2:

  | | WebGPU | Gamepad API | WebHID |
  |---|---|---|---|
  | Windows (WebView2) | Likely yes (Chromium-based) | Yes | Likely yes, but the chooser flow is unverified |
  | macOS 26+ (WKWebView) | Yes | Yes | No |
  | macOS ≤15 | No | Yes | No |
  | Linux (WebKitGTK 2.52/2.54) | No | Yes, if built with libmanette; focus-dependent | No |

- WebHID on macOS and Linux would have to be replaced by a Rust plugin, for example hidapi, that forwards reports over Tauri IPC. That is a second input code path that Electron does not need.
- Tauri on Linux would force a WebGL2 fallback (the existing web renderer) for all Linux and Steam Deck users. The same applies on macOS before 26.

### Gaps
- No primary statement from Microsoft was found on WebGPU being on by default in WebView2 Runtime, or on WebHID device-chooser support in WebView2.
- Not found: whether Safari 26's WebGPU also applies to WKWebView on macOS Sequoia and Sonoma.
- WebKitGTK WebGPU work-in-progress status was not checked; webkitgtk.org and webkit.org were unreachable.

## 3. Electron security best practice in 2026, and how to run a Node HTTP/WebSocket server safely in the main process or a utilityProcess

### Takeaway
Keep Electron's defaults (context isolation on, sandbox on, no Node in renderers) and add a strict CSP. Serve the app from a custom protocol rather than `file://`. Validate every IPC sender's origin and expose only narrow preload APIs. Flip the risky fuses (`runAsNode`, `nodeOptions`, `nodeCliInspect`, `grantFileProtocolExtraPrivileges`) off and ASAR integrity on. Run the phone-controller HTTP+WebSocket server in a `utilityProcess`, which is Electron's supported replacement for `child_process.fork`, and treat everything arriving from the LAN as untrusted input.

### Cited Findings
- Electron's 20-item checklist:
  1. Only load secure content.
  2. Don't enable Node integration for remote content.
  3. Enable context isolation.
  4. Enable sandboxing.
  5. Use `ses.setPermissionRequestHandler()`.
  6. Don't disable `webSecurity`.
  7. Define a CSP with restrictive rules (e.g. `script-src 'self'`).
  8. Don't enable `allowRunningInsecureContent`.
  9. Don't enable experimental features.
  10. Don't use `enableBlinkFeatures`.
  11. Don't use `allowpopups` on webviews.
  12. Verify webview options and params.
  13. Limit navigation.
  14. Limit creation of new windows.
  15. Don't use `shell.openExternal` with untrusted content.
  16. Use a current Electron.
  17. Validate the `sender` of all IPC messages.
  18. Prefer custom protocols over `file://`.
  19. Check which fuses you can change.
  20. Don't expose Electron APIs to untrusted content.

  — [Electron docs: Security (source)](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/security.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/security.md — all 20 headings match]
- Context isolation has been the default since Electron 12.0.0, and sandboxing since 20.0.0. Disabling context isolation, for example by setting `nodeIntegration: true`, "also disables process sandboxing" for that renderer. — [Electron docs: Security](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/security.md) [Verified: same source]
- IPC: validate `event.senderFrame` against an origin allowlist, using "the origin, not the URL", because about:blank, blob: and sandboxed documents have misleading URLs. Don't pass `ipcRenderer.on` or raw callbacks through `contextBridge`; wrap them so the renderer never receives the `IpcRendererEvent`. — [Electron docs: Security](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/security.md)
- `file://` pages "have unilateral access to every file on your machine", so an XSS bug could read local files. Serve local pages from a custom protocol via `protocol.handle`. — [Electron docs: Security](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/security.md)
- Fuses are bits flipped at package time, before code signing, so that OS signature checks protect them. Fuse defaults and guidance:

  | Fuse | Default | Guidance |
  |---|---|---|
  | `runAsNode` | enabled | Disabling makes `child_process.fork` throw; use utility processes instead |
  | `cookieEncryption` | disabled | Most apps can safely enable it; needs code signing on macOS |
  | `nodeOptions` | enabled | Most apps can safely disable it |
  | `nodeCliInspect` | enabled | Most apps can safely disable it |
  | `embeddedAsarIntegrityValidation` | disabled | Most apps can safely enable it (macOS/Windows) |
  | `onlyLoadAppFromAsar` | disabled | Combined with integrity validation, makes it impossible to load non-validated code |
  | `loadBrowserProcessSpecificV8Snapshot` | disabled | — |
  | `grantFileProtocolExtraPrivileges` | enabled | Disable it if you don't serve from `file://` |
  | `wasmTrapHandlers` | enabled | — |

  `@electron/fuses` flips and reads fuses, and Forge's `@electron-forge/plugin-fuses` is preinstalled in its templates. — [Electron docs: Fuses (source)](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/fuses.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/fuses.md — all nine defaults match]
- `utilityProcess.fork(modulePath, args, options)` "creates a child process with Node.js and Message ports enabled". It "provides the equivalent of child_process.fork API from Node.js but instead uses Services API from Chromium". It can only be called after the app `ready` event. Options include:
  - `serviceName`
  - `stdio`
  - `session`/`partition` for network requests
  - `allowLoadingUnsignedLibraries` (macOS; uses the `Electron Helper (Plugin).app` with `disable-library-validation` and `allow-unsigned-executable-memory` entitlements; "best to leave this disabled")
  - `disclaim` (macOS; the child is treated as a separate entity for TCC)
  - `respondToAuthRequestsFromMainProcess`

  — [Electron API: utilityProcess (source)](https://raw.githubusercontent.com/electron/electron/main/docs/api/utility-process.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/utility-process.md]
- Electron 45 removed the Node shims and the `Buffer`/`setImmediate` globals from sandboxed preloads; their `require()` now loads only `electron`, `electron/renderer` and `electron/common`. A `window.open()` child of an unsandboxed window now gets its own sandboxed process. — [Electron 45 blog post](https://raw.githubusercontent.com/electron/website/main/blog/electron-45-0.md)
- Electron 45's experimental `protocol.registerSource()` serves custom schemes from directories on disk, including ASAR archives, "without a JavaScript handler or routing requests through the main thread". `protocol.handle()` was also made faster. — [Electron 45 blog post](https://raw.githubusercontent.com/electron/website/main/blog/electron-45-0.md)
- WebHID permission control: `select-hid-device`, `ses.setDevicePermissionHandler()` and `ses.setPermissionCheckHandler()`, which "can be used to disable HID access for specific origins". — [Electron docs: Device Access](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/devices.md)

### Inferences
- Suggested baseline for Tactilume Desktop:
  - Renderer: one `BrowserWindow` with `contextIsolation: true`, `sandbox: true` and `nodeIntegration: false`. A preload exposes only typed functions such as `onControllerEvent(cb)` and `getPairingInfo()`.
  - Content: the existing single HTML bundle served from an `app://` custom protocol, with a CSP like `default-src 'self'; script-src 'self'; connect-src 'self'`. Navigation and `window.open` are denied.
  - Permissions: a permission handler that allows only HID devices with gamepad usage pages.
  - Fuses: `runAsNode`, `nodeOptions`, `nodeCliInspect` and `grantFileProtocolExtraPrivileges` off; `embeddedAsarIntegrityValidation` and `onlyLoadAppFromAsar` on.
- LAN server placement: a `utilityProcess` keeps network parsing out of the main process. A malformed packet that crashes the server doesn't take down the window, and the process can be restarted. It also stays compatible with turning off `runAsNode`. Controller events can go straight from the utility process to the renderer over a `MessagePort`, avoiding main-process IPC hops.
- LAN server hardening. These are general web-security practices, not taken from Electron docs:
  - Listen only while pairing or controller mode is active.
  - Put a random per-session token in the QR-code URL.
  - Reject WebSocket upgrades whose `Origin`/`Host` doesn't match the served controller page.
  - Validate message schemas and rate-limit messages.
  - Never route LAN messages to privileged IPC such as file access or `shell.openExternal`.
  - Serve the phone's controller page from the same server, so the phone needs no internet.
- steamworks.js's README example disables context isolation and enables Node integration in the renderer, which conflicts with checklist items 2–4. Keep Steamworks calls in the main process behind narrow IPC (see section 7).

### Gaps
- No Electron-official guidance was found specifically on hosting HTTP or WebSocket servers. Electron docs don't cover the `ws` package, Origin checks or binding interfaces, so the hardening list above comes from general practice.
- Exact CSP syntax for WebGPU, WASM and workers in Electron 45 wasn't verified. For example, `'wasm-unsafe-eval'` may be needed if WASM is used.

## 4. What OS prompts appear when an app listens on the local network (Windows Defender Firewall, macOS application firewall and Local Network privacy, Linux firewalls)?

### Takeaway
On macOS 15+, Local Network privacy does NOT apply to listening for and accepting incoming TCP connections. A phone connecting to an HTTP/WebSocket server on the Mac triggers no prompt. Bonjour/mDNS advertising, resolving `.local` names, sending UDP (including WebRTC/ICE-style traffic) and connecting out to LAN addresses do require it.

On Windows, inbound connections are blocked by default. A program-scoped inbound rule created by an elevated installer, limited to the Private profile and local subnet, avoids the first-run firewall prompt.

On Linux, the firewalls (ufw, firewalld) don't prompt per app. Behavior depends on the distro's defaults, which were not verified here.

### Cited Findings
**macOS Local Network privacy (Apple TN3179, revised 2026-10-06)**
- Local network privacy was introduced on macOS in macOS 15 (iOS/iPadOS 14, visionOS 1). Users manage it in System Settings > Privacy & Security > Local Network, and it can't be configured by MDM. — [TN3179: Understanding local network privacy](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- Which operations require access:

  | Operation | Requires access |
  |---|---|
  | Making an outgoing TCP connection | yes |
  | Listening for and accepting incoming TCP connections | no |
  | Sending a UDP unicast | yes |
  | Sending a UDP multicast | yes |
  | Sending a UDP broadcast | yes |
  | Connecting a UDP socket | yes |
  | Receiving an incoming UDP unicast | no |
  | Receiving an incoming UDP multicast or broadcast | yes |

  These checks happen "deep in the networking stack", so they apply to all APIs, including BSD sockets. — [TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy) [Verified: https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy — table, "macOS 15" introduction and the no-MDM statement re-read]
- Exceptions: "Traffic originating from WKWebView, SFSafariViewController, and Safari doesn't require local network access". Traffic to a local DNS server or a local proxy is also exempt. Resolving a local DNS name (`.local`) requires access. All Bonjour operations (registering, browsing, resolving) require access. — [TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- Info.plist keys: if the app accesses the local network, add `NSLocalNetworkUsageDescription`. If it registers or browses specific Bonjour services, list the types in `NSBonjourServices`. The multicast entitlement "isn't required on macOS". — [TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- macOS automatically allows: daemons started by `launchd`, programs running as root, and "Command-line tools run from Terminal or over SSH, including any child processes they spawn". When a helper performs the operation, macOS attributes it to the "responsible code" (the app) and records the choice for the whole app. — [TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- Local network privacy tracks a program's identity by its code signature. Apple recommends signing with an Apple-issued identity rather than ad hoc. It "uses your main executable UUID", which can "behave weirdly" if the executable "shares a UUID with other programs". — [TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- Practical details:
  - There is no API to check or request access. A UDP `connect()` to a link-local address triggers the alert without sending traffic.
  - The system may deny the first operation before the user answers, so retry logic is advised.
  - macOS 27.2 added +/- buttons to reset an app's entry; earlier versions have no reset.
  - macOS 15.5+ supports `AllowedEthernetLocalNetworkAddresses` and `AllowedWiFiLocalNetworkAddresses` defaults, which exempt whole subnets and are "particularly useful for ... continuous integration (CI) systems".

  — [TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy) [Verified: same source — the revision history entry "2026-10-06 Updated the Reset local network state section to account for changes in macOS 27.2" and "debuted in macOS 15.5" re-read]
- Anecdotal developer reports, from GitHub issue titles (search summary, not verified): a missing `NSLocalNetworkUsageDescription` leads to silent denial with no prompt and no entry to grant ([getpaseo/paseo#2880](https://github.com/getpaseo/paseo/issues/2880); [NVIDIA/Personal-AI-Router#3](https://github.com/NVIDIA/Personal-AI-Router/issues/3)), and in one case "macOS 26 webview blank tabs" ([Snapmaker/OrcaSlicer PR #419](https://github.com/Snapmaker/OrcaSlicer/pull/419)).

**Windows Defender Firewall**
- "When you first install the Windows operating system, Windows Defender Firewall blocks all unsolicited inbound traffic" (Microsoft training module; search summary, not verified) [Unverified]. — [Microsoft Learn training: Explore Windows Defender Firewall with Advanced Security](https://learn.microsoft.com/en-us/training/modules/manage-defender-windows-client/6-explore-windows-defender-firewall-advanced-security)
- Points from third-party guides (search summary, not verified):
  - Rules are scoped to the Domain, Private and/or Public profiles, and a rule scoped to Private does not apply on a network classified as Public.
  - A narrow rule example is `netsh advfirewall firewall add rule name="..." dir=in action=allow protocol=TCP localport=8080 profile=private remoteip=localsubnet`.
  - Omitting `-Profile` on `New-NetFirewallRule` applies the rule to all three profiles.
  - Leave Public off for LAN-only apps.

  — [codezup](https://codezup.com/mastering-windows-defender-firewall-rules/), [simplified.guide](https://www.simplified.guide/microsoft-windows/firewall-command), [windowsforum](https://windowsforum.com/tutorials/how-to-create-a-secure-inbound-firewall-rule-in-windows-11-and-10.446821/)

### Inferences
- Phone-controller transport:
  - Use a TCP HTTP server plus WebSocket on the desktop, with the phone connecting in. On macOS this needs no Local Network permission at all.
  - Avoid Bonjour/mDNS advertising; show a QR code with `http://<LAN-IP>:<port>/?t=<token>` instead.
  - Avoid having the desktop originate WebRTC or UDP to the phone. Both send UDP unicast or multicast to LAN addresses, which triggers the macOS prompt.
  - Chromium's WebRTC typically registers mDNS `.local` candidate hostnames, which is a Bonjour/multicast operation. Using WebRTC in the Electron renderer would therefore probably trigger the prompt (not verified).
  - Adding `NSLocalNetworkUsageDescription` (for example via electron-builder `mac.extendInfo`) costs nothing and avoids silent denial if any UDP or mDNS path slips in.
- Developer-testing trap: launched from Terminal (`npm start`), the app's child processes are auto-allowed, so developers never see the prompt. Real users launching from Finder will.
- Electron apps ship the same prebuilt main executable, so they may share an executable UUID across apps of the same Electron version. Per TN3179 this can make local network privacy "behave weirdly". This matters only if Tactilume uses outgoing or UDP LAN traffic. It needs verification with `dwarfdump --uuid`.
- In Electron the listening socket lives in the main process or a utility-process helper. macOS attributes helpers to the app as responsible code. Avoid `disclaim: true` on the server's utility process.
- Windows: an NSIS installer running elevated (per-machine install) can add a program-scoped inbound allow rule, limited to TCP, the app's port, `profile=private` and `remoteip=localsubnet`, and remove it on uninstall. A per-user, non-elevated install can't add rules, so the user will see the firewall dialog. If Windows classified the Wi-Fi as Public, a Private-only rule won't apply. The app should detect "no phone connected after N seconds" and show help to switch the network to Private.

### Gaps
- Microsoft's own documentation on the interactive firewall prompt couldn't be read: learn.microsoft.com was unreachable and the GitHub source path was not found. The following points are recalled, not verified here:
  - The "Windows Defender Firewall has blocked some features of this app" dialog appears the first time a program without a matching rule listens on a non-loopback interface.
  - Allowing access requires administrator rights.
  - The dialog creates TCP and UDP rules for the selected profiles.
  - Cancelling may create block rules.
- Not verified (support.apple.com unreachable): the macOS application firewall (socketfilterfw) is off by default; when on, it prompts "accept incoming network connections?" for apps not automatically allowed; signed downloaded apps are allowed automatically by default.
- Linux defaults not verified: Ubuntu ships ufw inactive by default, and Fedora Workstation's firewalld zone allows inbound ports 1025–65535. Neither has per-app prompts; the firewalld zone file couldn't be fetched.
- Whether Electron 45's WebRTC mDNS candidate behavior triggers the macOS prompt was not tested.

## 5. Code signing and notarization in 2026 (Apple fee, notarytool, hardened-runtime entitlements for Electron; Windows OV/EV/Azure Artifact Signing, SmartScreen; unsigned behavior on each OS)

### Takeaway
macOS: notarization is effectively mandatory for non-technical users. It needs the Apple Developer Program ($99/year), a Developer ID certificate, the hardened runtime and `notarytool`. Since macOS Sequoia, unsigned or unnotarized apps can't be opened with Control-click; users must go to System Settings > Privacy & Security.

Windows: signing removes the "unknown publisher" status but not the SmartScreen warning, because reputation builds over time. Options:
- Microsoft's recommended path is Azure Artifact Signing at about $9.99/month, available to organizations in the US, Canada, EU and UK and to individuals in the US and Canada only.
- An OV certificate costs $150–300/year.
- EV ($400+) no longer bypasses SmartScreen (changed in 2024).
- The Microsoft Store (MSIX) is free and shows no SmartScreen warnings.

### Cited Findings
**Apple**
- "The Apple Developer Program is 99 USD per membership year, or in local currency where available." — [Apple Developer Program: What's included](https://developer.apple.com/programs/whats-included/) [Verified: https://developer.apple.com/programs/whats-included/]
- Notarization requirements:
  - Since 2023-11-01 the notary service "no longer accepts uploads from `altool` or Xcode 13 or earlier"; use `notarytool` or Xcode 14+.
  - Sign with a "Developer ID" certificate, enable the Hardened Runtime and link against the macOS 10.9+ SDK.
  - Staple the ticket with `stapler`; the notary service also publishes the ticket online for Gatekeeper.
  - Plug-ins inherit the host's hardened-runtime entitlements.

  — [Apple: Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution) [Verified: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution]
- The Hardened Runtime "disallow[s] certain less common capabilities, like just-in-time (JIT) compilation". An app needing such a capability adds a specific exception entitlement. — [Apple: Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime)
- "In macOS Sequoia, users will no longer be able to Control-click to override Gatekeeper when opening software that isn't signed correctly or notarized. They'll need to visit System Settings > Privacy & Security" (Apple, 2024-08-06). — [Apple Developer News: Updates to runtime protection in macOS Sequoia](https://developer.apple.com/news/?id=saqachfa) [Verified: https://developer.apple.com/news/?id=saqachfa]
- Electron's macOS signing prerequisites are: enroll in the Apple Developer Program, use Xcode on a Mac, and install signing certificates. Forge and `@electron/packager` use `@electron/osx-sign` and `@electron/notarize`. These APIs need a valid signature: `safeStorage` (Keychain prompts after every update otherwise), login items, the `cookieEncryption` fuse, and `autoUpdater` ("Squirrel.Mac requires the app to be signed for automatic updates to work at all"). — [Electron docs: Code Signing (source)](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/code-signing.md)
- The default entitlements in `@electron/osx-sign` are `com.apple.security.cs.allow-jit`, `device.audio-input`, `device.bluetooth`, `device.camera`, `device.print`, `device.usb`, `personal-information.location` and `personal-information.photos-library`. — [@electron/osx-sign default.darwin.plist](https://raw.githubusercontent.com/electron/osx-sign/main/entitlements/default.darwin.plist) [Verified: https://raw.githubusercontent.com/electron/osx-sign/main/entitlements/default.darwin.plist]
- A utility process with `allowLoadingUnsignedLibraries` runs via `Electron Helper (Plugin).app`, which can carry the `com.apple.security.cs.disable-library-validation` and `allow-unsigned-executable-memory` entitlements. — [Electron utilityProcess docs](https://raw.githubusercontent.com/electron/electron/main/docs/api/utility-process.md)

**Windows (Microsoft docs dated 2026-04-20 and 2026-05-04)**
- Options compared:

  | Option | Cost | Availability | SmartScreen |
  |---|---|---|---|
  | Microsoft Store (MSIX) | free; Microsoft re-signs | — | no warnings |
  | Azure Artifact Signing (formerly Trusted Signing) | ~$9.99/month | organizations: USA, Canada, EU, UK; individuals: USA and Canada only | reputation builds over time; initial warnings expected |
  | OV certificate | $150–300/year | worldwide | same as Artifact Signing |
  | EV certificate | $400+/year | worldwide | "Same as OV since 2024 — no longer instant bypass" |
  | Self-signed | free | — | blocks public users |
  | No signature | free | — | "Strong SmartScreen block" |

  — [Microsoft: Code signing options for Windows app developers (source)](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/package-and-deploy/code-signing-options.md) [Verified: https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/package-and-deploy/code-signing-options.md — ms.date 04/20/2026; all rows match]
- More details from the same page:
  - Artifact Signing needs no hardware token and integrates with GitHub Actions and Azure DevOps; identity validation takes "a few business days".
  - Since June 2023 the CA/Browser Forum has required OV private keys to be stored on an HSM or hardware token.
  - A Win32 MSI/EXE submitted to the Store must still be signed by a Trusted Root Program CA.
  - The Store developer account is free.
  - SignPath Foundation offers free signing for qualifying open-source projects.

  — [Microsoft: Code signing options](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/package-and-deploy/code-signing-options.md)
- SmartScreen behavior:
  - Unsigned apps show "Windows protected your PC", and users must choose "Run anyway"; enterprise policy can block entirely.
  - Signed apps (OV/EV) are flagged "unrecognized until reputation accumulates" but show the verified publisher name.
  - Building reputation "can take several weeks and hundreds of clean installs".
  - Reputation carries across versions only with the same signing identity; unsigned files start from zero every release.
  - On Windows 11, Smart App Control "will block execution of unsigned files unless the file has a positive reputation".

  — [Microsoft: SmartScreen reputation for Windows app developers (source)](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/package-and-deploy/smartscreen-reputation.md) [Verified: https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/package-and-deploy/smartscreen-reputation.md — ms.date 05/04/2026]
- Electron docs call Azure Artifact Signing "the cheapest option for code signing on Windows". `jsign` can sign with it from Linux or macOS, using timestamp URL `http://timestamp.acs.microsoft.com/`. Electron's own apps use DigiCert KeyLocker cloud signing. All tooling uses `@electron/windows-sign` via a `windowsSign` config. — [Electron docs: Code Signing](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/code-signing.md)
- **Conflict:** Electron's docs say that "since June 2023, Microsoft requires software to be signed with an 'extended validation' certificate" and that OV certificates make "Windows treat your app as completely unsigned" ([Electron docs: Code Signing](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/code-signing.md)). Microsoft's 2026 docs contradict this: OV is a valid, "functionally equivalent" option, and EV no longer gives an advantage ([Microsoft: Code signing options](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/package-and-deploy/code-signing-options.md)). The June 2023 change was the hardware key-storage rule, which applies to OV too. [Verified: both sides re-read — https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/code-signing.md; https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/package-and-deploy/code-signing-options.md]
  - A second conflict in the same Electron page: it says Artifact Signing "is the cheapest option for code signing on Windows, and it gets rid of SmartScreen warnings". Microsoft says the opposite: Artifact Signing "does **not** provide instant SmartScreen trust", and new files warn until reputation builds. Plan on Microsoft's version. [Verified correction: https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/package-and-deploy/code-signing-options.md]
- Third-party claims (search summary, not verified; none of these appear on the Microsoft pages read here):
  - Artifact Signing reached general availability in January 2026 ([devclass, 2026-01-14](https://www.devclass.com/security/2026/01/14/code-signing-windows-apps-may-be-easier-and-more-secure-with-new-azure-artifact-service/4079554)).
  - Basic tier: $9.99/month for 5,000 signatures. Premium: $99.99/month for 100,000 signatures and 10 certificate profiles. Extra signatures about $0.005 each.
  - It needs a pay-as-you-go subscription, not free or trial; individuals need an "Individual" billing account.
  - Billing starts at account creation even if identity validation fails.
  - Self-employed individuals no longer need the preview-era three-year history.

  [Unverified: none of these tier, billing or GA-date claims appear on the Microsoft pages that were read.] Sources for the tier and billing claims: [melatonin.dev](https://melatonin.dev/blog/code-signing-on-windows-with-azure-trusted-signing/), [gdgsoft](https://www.gdgsoft.com/faq/azure-trusted-signing-cost-effective-exe-code-signing), [itwriting](https://www.itwriting.com/blog/12462-getting-started-with-azure-artifact-signing.html), [4D forum](https://discuss.4d.com/t/windows-application-signing-with-ms-azure-artifact-signing-9-99-month/38154).
- Electron 45 ships a Windows Error Reporting helper DLL that must be packaged and renamed alongside a renamed executable (`myapp_wer.dll`). — [Electron 45 blog post](https://raw.githubusercontent.com/electron/website/main/blog/electron-45-0.md)

### Inferences
- What an unsigned release means for each OS:
  - macOS: since Sequoia, a non-technical user effectively can't open an unsigned or unnotarized download (System Settings detour). Squirrel.Mac auto-update and reliable Local Network privacy tracking also need a real Developer ID signature. Budget $99/year and notarize every build in CI.
  - Windows: unsigned means "Windows protected your PC" on every release, and Smart App Control blocks it on Windows 11. Signing with Artifact Signing or OV still shows "unrecognized app" until reputation builds, but with a verified publisher name.
  - Microsoft Store or Steam distribution sidesteps SmartScreen download warnings for the Store; for Steam, see Gaps.
- Developer location decides the Windows option. A US/Canada individual, or a company in the US, Canada, EU or UK, can use Artifact Signing (about $120/year). Others need an OV certificate on a token or cloud HSM ($150–300/year) or the Store.
- Trim the default `@electron/osx-sign` entitlements to what Tactilume needs. Keep `allow-jit` for V8, and keep `com.apple.security.device.audio-input`, because microphone and line-in are Tactilume inputs (see audio_input_analysis.md section 2). Drop camera, location and photos. System-audio capture on macOS 14.2+ needs the `NSAudioCaptureUsageDescription` Info.plist key, not an entitlement. Electron's helper apps may need additional entitlements; verify with the current osx-sign docs. [Verified correction: cross-file contradiction resolved against https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.device.audio-input and https://raw.githubusercontent.com/electron/electron/main/docs/api/desktop-capturer.md]

### Gaps
- Linux has no OS-level code-signing gate. Practices like GPG-signing AppImages and apt repo signing, and Flathub building from source, were not researched.
- Not verified: whether Steam distribution requires notarized macOS builds or signed Windows binaries. Steam-downloaded files are believed to lack quarantine or Mark-of-the-Web, so Gatekeeper and SmartScreen download checks wouldn't apply; Steamworks docs were unreachable.
- Exact `notarytool` flags for 2026 (keychain profile, App Store Connect API keys) and electron-builder's current notarization config keys weren't fetched; electron.build was unreachable.

## 6. Auto-update options (electron-updater, Squirrel, update.electronjs.org) and hosting on GitHub Releases

### Takeaway
There are two families:
- **Electron's built-in `autoUpdater`:** Squirrel.Mac, plus Squirrel.Windows or MSIX on Windows; no Linux. It pairs with the free update.electronjs.org service for public GitHub repos, or static storage via `update-electron-app`.
- **electron-builder's `electron-updater`:** macOS, NSIS on Windows, and AppImage/deb/rpm on Linux, fed from static files on GitHub Releases or S3.

For a non-technical audience on all three OSes, electron-builder (NSIS + DMG/ZIP + AppImage) with `electron-updater` and GitHub Releases is the simplest single pipeline. Steam builds are updated by Steam itself, and Flatpak builds by Flathub.

### Cited Findings
- Electron's `autoUpdater` supports only macOS and Windows: "There is no built-in support for auto-updater on Linux, so it is recommended to use the distribution's package manager". — [Electron API: autoUpdater (source)](https://raw.githubusercontent.com/electron/electron/main/docs/api/auto-updater.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/auto-updater.md]
- macOS (`autoUpdater`):
  - Built on Squirrel.Mac; "Your application must be signed for automatic updates on macOS", and App Transport Security applies to update requests.
  - The ZIP is streamed to disk and resumable with `ETag`/`Last-Modified` + `Range`; optional `sha256` and `size` are checked.
  - Optional `delta` patches made with Sparkle's `BinaryDelta`.

  — [Electron API: autoUpdater](https://raw.githubusercontent.com/electron/electron/main/docs/api/auto-updater.md)
- Windows (`autoUpdater`): it auto-selects the MSIX updater for MSIX packages (which can allow downgrades) or Squirrel.Windows for electron-winstaller/Forge installers. Squirrel.Windows apps must handle `--squirrel-firstrun` and the other launch events, and update checks fail for the first few seconds after install because of a file lock. — [Electron API: autoUpdater](https://raw.githubusercontent.com/electron/electron/main/docs/api/auto-updater.md)
- update.electronjs.org is free and open source. Its criteria: the app runs on macOS or Windows, has a public GitHub repository, publishes builds to GitHub Releases, and is code-signed (macOS only). `update-electron-app` checks at startup and then every 10 minutes, downloads in the background and prompts to restart. Static-storage mode reads `releases.json` (macOS) and `RELEASES` plus `.nupkg` (Windows) from S3-like storage. Self-hosted servers: Hazel, Nuts, electron-release-server, Nucleus. — [Electron docs: Updating Applications (source)](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/updates.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/updates.md]
- With Electron Forge, static updates are published through the ZIP maker's `macUpdateManifestBaseUrl` (macOS) and the Squirrel.Windows maker's `remoteReleases`. — [Electron docs: Updating Applications](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/updates.md)
- `electron-updater` supports macOS (Squirrel.Mac), Windows (NSIS) and Linux (AppImage, rpm, deb). It "does not require a dedicated server", only simple file hosting. — [electron-updater README](https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/electron-updater/README.md) [Verified: https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/electron-updater/README.md]
- electron-builder publishes to GitHub Releases, Amazon S3 and DigitalOcean Spaces. — [electron-builder README](https://raw.githubusercontent.com/electron-userland/electron-builder/master/README.md)
- Current versions: the npm `latest` tags are electron-builder 26.18.0 and electron-updater 6.8.11 (both 2026-10-20). The newer 26.18.1 and 6.8.12 (2026-10-26) are published under a separate `v26` tag, so a plain `npm install` gets 26.18.0 / 6.8.11. `next` is 27.0.0-alpha.14 / 7.0.0-alpha.13. — [npm electron-builder](https://registry.npmjs.org/electron-builder); [npm electron-updater](https://registry.npmjs.org/electron-updater) [Verified correction: https://registry.npmjs.org/electron-builder; https://registry.npmjs.org/electron-updater]
- Electron Forge `@electron-forge/cli` latest is 8.0.1 (2026-09-29); 8.0.0 was published the same day. — [npm @electron-forge/cli](https://registry.npmjs.org/@electron-forge/cli) [Verified: https://registry.npmjs.org/@electron-forge/cli]
- Tauri's updater "needs a signature to verify that the update is from a trusted source. This cannot be disabled". It produces `.sig` files for AppImage, `.app.tar.gz` (macOS), NSIS and MSI, can read a static `latest.json` from `https://github.com/user/repo/releases/latest/download/latest.json`, and offers a Windows `installMode` such as `passive`. — [Tauri docs: Updater plugin (source)](https://raw.githubusercontent.com/tauri-apps/tauri-docs/v2/src/content/docs/plugin/updater.mdx)

### Inferences
- Recommended mapping for Tactilume Desktop (direct download):

  | OS | Package | Updater |
  |---|---|---|
  | Windows | NSIS installer, signed | `electron-updater` |
  | macOS | DMG for first install + ZIP for updates, notarized, universal or separate arm64/x64 | `electron-updater` (Squirrel.Mac underneath) |
  | Linux | AppImage | `electron-updater`; deb/rpm optional |
  | Linux (Flathub) | Flatpak | Flathub, not in-app |

  All of it is hosted on GitHub Releases, with no server to run, which suits an offline-first app that checks only when online.
- The update check must fail silently when the machine is offline, which is the normal case for a toy used offline. It must never block startup.
- Keep in-app updates off for Steam, Microsoft Store, Flatpak and distro packages. Detect the channel at runtime, for example from an env var or file marker, to avoid fighting the store's own updater.

### Gaps
- Not verified: electron-builder's current auto-update docs (code-signature verification of Windows updates, differential/blockmap downloads, staged rollouts). electron.build was unreachable.
- Electron Forge 8.0 release notes, breaking changes and maker list weren't read; the GitHub release page wasn't found.

## 7. Steam distribution of Electron apps (steamworks.js or greenworks, overlay with Chromium, Steam Input vs Gamepad API/WebHID, Steam Deck/SteamOS)

### Takeaway
Shipping an Electron app on Steam is feasible. steamworks.js, a prebuilt native Node module for the main process, is the usual Steamworks binding, but its last npm release was 0.4.0 (2024-08-06). The Steam overlay with Chromium is fragile. steamworks.js forces `in-process-gpu`, disables DirectComposition and repaints every frame. Overlay reports are mixed: it works on Windows if Steam is initialized before `app.whenReady()`, it is unreliable on macOS, and one report says it works on Linux only under Proton. Steam Input interference with the Gamepad API and WebHID could not be verified in this session.

### Cited Findings
- steamworks.js describes itself as "a modern implementation of the Steamworks SDK for HTML/JS and Node.js applications". It is a replacement for greenworks, which the author found "unmaintained, outdated, and lacking TypeScript definitions", and ships prebuilt binaries with no local compilation. It "is a native module and cannot be used by default in the renderer process". Its README example enables renderer access with `contextIsolation: false` and `nodeIntegration: true`. Production builds must copy `sdk/redistributable_bin/{distro}` files into the build root. — [steamworks.js README](https://raw.githubusercontent.com/ceifa/steamworks.js/HEAD/README.md) [Verified: https://raw.githubusercontent.com/ceifa/steamworks.js/HEAD/README.md]
- `electronEnableSteamOverlay()` appends the Chromium switches `in-process-gpu` and `disable-direct-composition`. It also attaches a 60 Hz timer that calls `webContents.invalidate()` when not painting, "to be rendered each frame". The module loads prebuilt binaries only for win32-x64, linux-x64 and darwin x64/arm64, and throws on other platforms. `init()` runs Steam callbacks at 30 Hz, and `restartAppIfNecessary` is exposed. — [steamworks.js index.js](https://raw.githubusercontent.com/ceifa/steamworks.js/main/index.js) [Verified: https://raw.githubusercontent.com/ceifa/steamworks.js/main/index.js — Windows arm64 and Linux arm64 hit the `throw`; macOS on an unknown arch silently gets no binding]
- The npm `latest` is 0.4.0, published 2024-08-06; before it came 0.3.2 (2024-06-03). — [npm steamworks.js](https://registry.npmjs.org/steamworks.js) [Verified: https://registry.npmjs.org/steamworks.js]
- Overlay issue #102, opened 2023-06-22 and still open:
  - The reporter saw no overlay hint and Shift-Tab did nothing on Windows 11, Ubuntu 22 and macOS 13. They quoted the Steam docs: "The overlay will not be active in software-rasterized games".
  - Calling `init` and `electronEnableSteamOverlay()` before `app.whenReady()`/`createWindow()` fixed it on Windows (reports from May 2024 and Feb 2025; steamworks.js 0.3.1, Electron 30).
  - It stayed broken on macOS (Aug 2024).
  - One user said it worked "only on Linux under Proton" (Aug 2024).
  - `app.disableHardwareAcceleration()` may stop the overlay (Nov 2025).

  — [ceifa/steamworks.js#102](https://github.com/ceifa/steamworks.js/issues/102) [Verified: https://github.com/ceifa/steamworks.js/issues/102 — still open; the disableHardwareAcceleration comment (2025-11-26) is an untested suggestion, and the Proton report says it did not work natively on macOS or Windows for that user]
- Community notes (search summary, not verified) say the overlay requires launching through Steam, and list `--in-process-gpu` so "Steam [can] find the render process, to hook in the Overlay". These are greenworks-era notes. — [JamesMoulang/electron-steam-notes](https://github.com/JamesMoulang/electron-steam-notes)
- An alternative Koffi/FFI-based binding has its own overlay guide (search summary, not verified). — [steamworks-ffi-node: STEAM_OVERLAY_INTEGRATION.md](https://github.com/ArtyProf/steamworks-ffi-node/blob/main/docs/STEAM_OVERLAY_INTEGRATION.md)
- Native comparison: SDL3 exposes `SDL_GetGamepadSteamHandle()` for gamepads. — [SDL3 SDL_gamepad.h](https://raw.githubusercontent.com/libsdl-org/SDL/main/include/SDL3/SDL_gamepad.h)

### Inferences
- `in-process-gpu` moves Chromium's GPU work into the browser process. That removes the GPU-process isolation and crash recovery that a GPU-heavy WebGPU toy benefits from, and could make GPU driver crashes take down the whole app. Treat the overlay as optional: make it a Steam-build-only switch and test it with WebGPU on each OS.
- Keep steamworks.js in the main process (or a utility process) and expose achievements and other features to the renderer through narrow IPC. Don't follow the README's `contextIsolation: false` pattern; see section 3.
- steamworks.js hasn't published in about 27 months and has no Windows-ARM64 or Linux-ARM64 binaries. Check the GitHub main branch for unreleased fixes before committing, or consider the FFI-based alternative.
- Steam Deck/SteamOS: ship the native Linux Electron build. Proton (the Windows build) is an alternative and is where one report saw the overlay work. Chromium's Linux blocklist exempts only Intel Gen12+ (Mesa ≥ 22.0) and NVIDIA ≥ 535.183.01, so the Deck's AMD APU and the AMD-based Steam Machine are blocked by default. WebGPU there needs forced enabling (`--ignore-gpu-blocklist` or `ForceEnableWebGpuInterop`, untested) or the WebGL2 fallback. This needs on-device testing. [Verified correction: https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/software_rendering_list.json] Whether the Deck is in scope is a product call: the hardware-tiers notes treat Steam Deck handhelds as out of scope.

### Gaps
- **Steam Input vs Gamepad API/WebHID:** no source could be retrieved; Steamworks docs and search were unavailable. Questions to verify:
  - Does Steam Input, when enabled per game, present virtual XInput pads to Chromium in addition to or instead of the physical device?
  - Does it hide the physical HID device from WebHID?
  - What is recommended for browser-based games: opting out of Steam Input per controller type in the Steamworks app config, or using the Steam Input API via steamworks.js?
- Steam overlay with WebGPU (D3D12/Vulkan/Metal backends in Chromium) specifically has no reports in hand.
- Steam Deck Verified requirements and Steam Linux Runtime (container) behavior for Electron apps were not researched.
- The greenworks repository's current status wasn't verified; the README path was not found.
- The Steamworks SDK version supported by steamworks.js 0.4.0 is not stated in the README.

## 8. Building for Windows, macOS (arm64 and x64) and Linux on GitHub Actions: electron-builder vs Electron Forge, runners, caching, artifact sizes, headless GPU tests

### Takeaway
Use a three-OS matrix on GitHub-hosted runners: `windows-2025`, `macos-26` (arm64) plus `macos-26-intel` or `macos-15-intel` for x64 (or a universal build), and `ubuntu-22.04`/`24.04` with optional `-arm` variants. Electron Forge is the "official" Electron toolchain, built on `@electron/packager`, `osx-sign`, `notarize` and `windows-sign`. electron-builder covers more installer formats and Linux targets and has `electron-updater`. Expect 120–160 MB compressed runtime per platform before app assets.

GPU testing: GitHub-hosted runners have no GPUs. The research coordinator observed in this container, which is likely representative of hosted Linux runners, that WebGPU compute works on SwiftShader but presenting a WebGPU canvas fails, even headed under Xvfb. That splits CI into two tiers:
- Hosted runners can check GPU logic that never presents to the screen: WGSL compile, compute passes, and render-to-texture with readback. Render-to-texture with readback is now measured: in this container, headless Chromium 153 (SwiftShader, `--enable-unsafe-webgpu` only) runs offscreen rendering, compute and `copyTextureToBuffer` readback, while canvas presentation fails headless and under Xvfb with "A valid external Instance reference no longer exists." [Verified: measured in this container; Chromium 153, not Electron 45, and not on a GitHub-hosted runner]
- Hosted runners cannot check the canvas/swap-chain path. Presentation, frame pacing and performance need real-GPU machines, either self-hosted runners or manual QA.

Hosted Linux CI is also a free, repeatable way to test the "WebGPU present fails → fall back to WebGL2" path.

### Cited Findings
- GitHub-hosted runner labels:

  | Image | Labels |
  |---|---|
  | Ubuntu 24.04 | `ubuntu-latest`, `ubuntu-24.04`; arm64: `ubuntu-24.04-arm` |
  | Ubuntu 26.04 | `ubuntu-26.04`, `ubuntu-26.04-arm` |
  | Ubuntu 22.04 | `ubuntu-22.04`, `ubuntu-22.04-arm` |
  | macOS 26 arm64 | `macos-latest`, `macos-26`, `macos-26-xlarge` |
  | macOS 26 x64 | `macos-26-intel`, `macos-26-large`, `macos-latest-large` |
  | macOS 15 arm64 | `macos-15` |
  | macOS 15 x64 | `macos-15-intel`, `macos-15-large` |
  | macOS 14 | deprecated |
  | Windows Server 2025 (VS 2026) | `windows-latest`, `windows-2025`, `windows-2025-vs2026` |
  | Windows Server 2022 | `windows-2022` |
  | Windows 11 Arm64 (VS 2026) | `windows-11-arm` |

  GitHub supports "at maximum 2 GA images and 1 beta image at a time". — [actions/runner-images README](https://raw.githubusercontent.com/actions/runner-images/main/README.md) [Verified: https://raw.githubusercontent.com/actions/runner-images/main/README.md — the README also lists `ubuntu-slim`, `macos-15-xlarge` and `windows-11-vs2026-arm`]
- Arm64 hosted runners for public repositories became generally available in August 2025, and a typical Tauri build on them takes "~10 minutes". linuxdeploy can't cross-compile ARM AppImages. Build on the oldest base system you support, such as Ubuntu 22.04 or Debian 12, for glibc compatibility. — [Tauri docs: AppImage](https://raw.githubusercontent.com/tauri-apps/tauri-docs/v2/src/content/docs/distribute/appimage.mdx) [Verified: https://raw.githubusercontent.com/tauri-apps/tauri-docs/v2/src/content/docs/distribute/appimage.mdx]
- Electron Forge is described as "Electron's favorite build tool". It is "a collection of the official Electron tools, using `@electron/packager`, `@electron/osx-sign`, and `@electron/notarize`", and is "the recommended way to sign your app as well as your Squirrel.Windows and WiX MSI installers". macOS signing requires Xcode on a Mac. — [Electron docs: Code Signing](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/code-signing.md)
- electron-builder offers the widest target list (NSIS, MSI, AppX, Squirrel, portable; DMG/pkg/mas; AppImage/snap/deb/rpm/pacman and more), publishing to GitHub, S3 and DO Spaces, "Docker images to build Electron app for Linux or Windows on any platform", and on-demand download of signing tools. — [electron-builder README](https://raw.githubusercontent.com/electron-userland/electron-builder/master/README.md)
- Windows signing from non-Windows CI is possible with `jsign` plus Azure Artifact Signing. — [Electron docs: Code Signing](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/code-signing.md)
- Artifact Signing "integrates directly with CI/CD pipelines (GitHub Actions, Azure DevOps, and others)", with no physical USB token. — [Microsoft: Code signing options](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/package-and-deploy/code-signing-options.md)
- Electron 45.3.0 runtime zip sizes are 121–158 MB depending on platform (Windows x64 is the largest at 158 MB). — [Electron v45.3.0 release assets](https://github.com/electron/electron/releases/download/v45.3.0/electron-v45.3.0-win32-x64.zip)
- Local network privacy on macOS CI runners: `AllowedEthernetLocalNetworkAddresses`/`AllowedWiFiLocalNetworkAddresses` (macOS 15.5+, need sudo and a restart) exempt subnets, for example for LAN-server integration tests. — [Apple TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- On Linux, Chromium enables WebGPU by default only on Intel Gen12+ (Mesa ≥ 22.0) and, from Chromium 148, on NVIDIA drivers ≥ 535.183.01. AMD and pre-Gen12 Intel are blocked. MDN BCD's note mentions only Intel Gen12+. — [MDN BCD GPU](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/GPU.json) [Verified correction: https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/software_rendering_list.json]
- Observation reported by the research coordinator in this session's container: WebGPU compute works on SwiftShader, but presenting a WebGPU canvas fails, even headed under Xvfb. The coordinator expects GitHub-hosted Linux runners to behave the same. This researcher did not re-run the test, and runner equivalence is unverified. — source: research-coordinator message (no URL) [Verified: measured facts for this container — headless Chromium 153.0.8010.12 (Playwright 1.63.0), adapter vendor "google", architecture "swiftshader", `isFallbackAdapter` true; presentation fails headless and headed under Xvfb; offscreen, compute and readback work. Runner equivalence remains unverified.]
- Software adapters are blocklisted unless forced: Chromium's WebGPU adapter blocklist adds a `CPUAdapter` reason for any adapter of type CPU, which is why CI needs `--enable-unsafe-webgpu`. That single flag was enough to get the SwiftShader adapter in this container. [Verified: https://raw.githubusercontent.com/chromium/chromium/main/gpu/config/webgpu_blocklist_impl.cc]
- Electron's `--ozone-platform=headless` (Linux) makes Electron "not connect to any display server. No windows are shown on screen, which is useful for automated testing and CI". It must be passed on the command line, because `app.commandLine.appendSwitch` is too late. — [Electron docs: Supported Command Line Switches (source)](https://raw.githubusercontent.com/electron/electron/main/docs/api/command-line-switches.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/command-line-switches.md]
- The `GPUFeatureStatus` object returned by `app.getGPUFeatureStatus()` has no WebGPU field. Its fields are `2d_canvas`, `gpu_compositing`, `rasterization`, `video_decode`, `webgl`, `webgl2` and others, with values such as `unavailable_software` and `enabled`. It, like `app.getGPUInfo()`, is "only usable after the `gpu-info-update` event is emitted". — [Electron GPUFeatureStatus structure (source)](https://raw.githubusercontent.com/electron/electron/main/docs/api/structures/gpu-feature-status.md); [Electron API: app (source)](https://raw.githubusercontent.com/electron/electron/main/docs/api/app.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/structures/gpu-feature-status.md]
- Electron offscreen rendering has two GPU-accelerated modes and one software mode:
  - Shared GPU texture, which needs a native module.
  - CPU shared-memory bitmap (`useSharedTexture: false`, the default), which "supports GPU related functionalities".
  - Software output device, which requires `app.disableHardwareAcceleration()`.

  — [Electron docs: Offscreen Rendering (source)](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/offscreen-rendering.md)
- Electron's automated-testing guide covers WebdriverIO, Selenium with `electron-chromedriver`, and Playwright, whose Electron support is "experimental" and launched via `_electron.launch`. The guide was written against `@playwright/test@1.52.0`. — [Electron docs: Automated Testing (source)](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/automated-testing.md)

### Inferences
- **Suggested matrix:**
  - `windows-2025` (x64 NSIS, signed via Artifact Signing or OV cloud HSM).
  - `macos-26` (arm64) and `macos-26-intel` (x64), or one universal build on arm64, signed and notarized with an App Store Connect API key stored in secrets.
  - `ubuntu-22.04` for the widest glibc compatibility (AppImage/deb/rpm), plus optional `ubuntu-24.04-arm` for arm64.
  - Optional `windows-11-arm` if Windows-on-ARM builds are wanted.
- **Caching:** cache the npm cache plus the Electron and electron-builder download caches (`~/.cache/electron`, `~/.cache/electron-builder` on Linux; equivalents on macOS and Windows) so the ~120–160 MB runtime isn't downloaded every run. These paths are recalled and should be confirmed against current docs.
- **Builder vs Forge:** for Tactilume's goals (NSIS for non-technical Windows users, AppImage/deb for Linux, `electron-updater` with GitHub Releases), electron-builder is the more direct fit. Forge is preferable if you want the officially maintained toolchain, Squirrel.Windows/MSIX and Forge's Vite or webpack plugins.
- **What "compute works, canvas presentation fails" means for testing the Electron WebGPU app:**
  - **Tier 1, every push on hosted runners:** test GPU logic that never touches the canvas swap chain:
    - WGSL compilation and pipeline creation with no `uncapturederror`.
    - The particle-simulation compute passes, read back with `mapAsync` and compared to CPU reference values.
    - Render-to-texture tests: draw a frame into an offscreen `GPUTexture`, `copyTextureToBuffer` it, and compare with a tolerance against golden data.

    Render-to-texture does behave like compute: the measured run in this container rendered offscreen and read back with `copyTextureToBuffer` while canvas presentation failed [Verified: measured, Chromium 153]. Still confirm it once with Electron 45 on a hosted runner. SwiftShader output won't match hardware GPUs bit-for-bit, so keep separate SwiftShader goldens and compare with tolerances. SwiftShader is also slow: about 22 ms per frame for 20k particles and 131 ms for 300k (32 B per particle compute plus a 1-pixel additive point draw, measured). Keep CI scenes at a few thousand particles.
  - **No canvas screenshots as a test oracle on these runners.** Playwright, WebdriverIO or `webContents.capturePage()` screenshots of the WebGPU canvas will be blank, or the configure/present step will error, producing false failures. Instead, expose a test-only hook, compiled out of release builds, that renders one frame offscreen and returns a hash or pixel sample.
  - **Treat the failure as a test case.** Hosted Linux runners reliably reproduce "adapter available, presentation broken", which some real users will also hit (VMs, remote desktops, old drivers). Add an end-to-end test asserting the app detects this and switches to the existing WebGL2 renderer, or shows a clear message, instead of a black window. Detection signals include errors from `configure()`/`getCurrentTexture()`, device loss, or a blank offscreen readback.
  - **Tier 2, before each release on real GPUs:** canvas presentation, vsync and frame pacing, fullscreen and multi-monitor, HDR canvas, performance budgets, the Steam overlay, and physical gamepads and WebHID. Run these on self-hosted runners or a manual QA checklist. Suggested machines: one Windows PC with a discrete GPU, one Apple-silicon Mac, and one Linux AMD machine, which approximates Steam Deck and exercises Chromium's Linux WebGPU blocklist (AMD is blocked by default). NVIDIA ≥ 535.183.01 and Intel Gen12+ are exempt, so a Linux NVIDIA or Intel box would test the enabled path instead.
  - **Non-GPU tests run everywhere:**
    - LAN server and WebSocket protocol: pairing token, Origin checks, reconnects.
    - Controller-to-simulation mapping, fed by recorded Gamepad API snapshots.
    - Packaging smoke tests: the installed app launches, the window appears, and the update check fails quietly offline.

    On Linux these can use `--ozone-platform=headless` without Xvfb; keep `xvfb-run` for tests that need a real window.
  - **Make runs self-describing.** Electron's `GPUFeatureStatus` has no WebGPU entry, so log `navigator.gpu.requestAdapter()` and its adapter info from the renderer in every GPU job. Make the hardware-tier job fail if it ends up on a SwiftShader/CPU adapter, so a green hardware run can't silently be a software run.
  - **Characterize the other hosted OSes once.** Run a probe job on `windows-2025`, `macos-26` and `macos-26-intel` that records whether an adapter exists (for example WARP/D3D12, or paravirtualized Metal) and whether canvas presentation works. Then assign each runner to Tier 1 or Tier 2.
  - **Optional experiment:** offscreen rendering in CPU-bitmap mode is documented to support GPU functionality, so it might capture a WebGPU canvas without native presentation on Linux CI. This is untested; add it to the probe job. The software-output-device mode requires `app.disableHardwareAcceleration()` and would likely remove WebGPU entirely.

### Gaps
- Not verified: GitHub's GPU-equipped larger runners (availability, pricing, OS) and whether macOS hosted runners expose a usable Metal device for WebGPU; docs.github.com unreachable.
- Typical end-to-end build times and final installer sizes per format (NSIS, DMG, AppImage) for Electron 45 apps weren't measured.
- Forge 8 vs electron-builder 26 feature details (notarization config, Linux flatpak/snap makers) couldn't be read from their doc sites.
- The coordinator's "compute works, present fails" observation has not been reproduced with Electron 45 specifically or on actual GitHub-hosted runners. Also untested here:
  - ~~whether render-to-texture with readback works where canvas presentation fails~~ — resolved for Chromium 153: it works (measured in this container);
  - whether Electron offscreen rendering can capture a WebGPU canvas.
- The Chromium switches commonly used to force a software WebGPU adapter were not verified against Electron 45 / Chromium 156: `--enable-unsafe-webgpu`, `--use-webgpu-adapter=swiftshader` and `--enable-unsafe-swiftshader`, plus `--enable-features=Vulkan` on Linux. Partly resolved: in headless Chromium 153 on Linux, `--enable-unsafe-webgpu` alone produced the SwiftShader fallback adapter (measured). Chromium 156 still defines `enable-unsafe-webgpu` and `use-webgpu-adapter` [Verified: https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/gpu_switches.cc].

## 9. If the app were native instead (Rust + wgpu, or SDL3 + Vulkan/D3D12/Metal), what would be gained and lost?

### Takeaway
Gains:
- Hardware ray tracing (experimental in wgpu; full via D3D12/Vulkan/Metal).
- Vendor upscalers and frame generation: DLSS via NVIDIA Streamline needs DX11/Vulkan 1.2+; XeSS 3 offers SR, frame generation and XeLL low-latency.
- Direct HID and rich gamepad features via SDL3: sensors, touchpads, trigger rumble, LEDs, Steam Input handles.
- Small binaries without a browser engine.

Losses:
- Reuse of the existing WebGL2/ES-module codebase, and the web/Android parity it provides.
- The single-file portability of the web edition.
- The built-in Node/web stack for the phone server and controller page.
- Development speed: hot reload, devtools.

### Cited Findings
- wgpu ray tracing:
  - v30.0.1 (2026-08-21) is the latest release.
  - Ray tracing is exposed through experimental features `EXPERIMENTAL_RAY_QUERY` and `EXPERIMENTAL_RAY_TRACING_PIPELINES`.
  - Ray-tracing-pipeline shader stages are rejected unless that feature is enabled.
  - Metal acceleration structures were added in v29.0.0 (2026-03-18).
  - Recent additions (hit objects/invocation reorder, hit barycentrics) are "Currently only supported with the SPIR-V backend" (Vulkan).
  - A raw `VkAccelerationStructureKHR` handle is exposed for interop.

  — [wgpu CHANGELOG](https://raw.githubusercontent.com/gfx-rs/wgpu/trunk/CHANGELOG.md)
- wgpu mesh shaders: "Added full support for mesh shaders, including in WGSL shaders", and HLSL output completed DX12 mesh-shader support. — [wgpu CHANGELOG](https://raw.githubusercontent.com/gfx-rs/wgpu/trunk/CHANGELOG.md)
- NVIDIA Streamline (the integration layer for DLSS Super Resolution and DLSS Frame Generation) requires a "GPU supporting DirectX 11 and Vulkan 1.2 or higher". The DLSS-G plugin ships only as prebuilt DLLs; release binaries come from GitHub releases. — [NVIDIA-RTX/Streamline README](https://raw.githubusercontent.com/NVIDIA-RTX/Streamline/main/README.md) [Verified: https://raw.githubusercontent.com/NVIDIA-RTX/Streamline/main/README.md]
- The Intel XeSS 3 SDK includes:
  - XeSS Super Resolution, for "all GPUs with SM 6.4 (DP4a) support".
  - XeSS Frame Generation, for Arc and non-Intel GPUs with SM 6.4.
  - Xe Low Latency (XeLL), required by XeSS-FG.
  - Plugins for Unreal Engine and Unity.

  — [intel/xess README](https://raw.githubusercontent.com/intel/xess/main/README.md) [Verified: https://raw.githubusercontent.com/intel/xess/main/README.md]
- The SDL3 gamepad API covers sensors (`SDL_SetGamepadSensorEnabled`, `SDL_GetGamepadSensorData`, data rate), touchpads, `SDL_RumbleGamepadTriggers`, `SDL_SetGamepadLED` and `SDL_GetGamepadSteamHandle`. — [SDL3 SDL_gamepad.h](https://raw.githubusercontent.com/libsdl-org/SDL/main/include/SDL3/SDL_gamepad.h) [Verified: https://raw.githubusercontent.com/libsdl-org/SDL/main/include/SDL3/SDL_gamepad.h]
- SDL 3.4.20 (2026-11-03) improves Switch controller IMU calibration handling, adds HIDAPI controller support and rumble/trigger rumble for more pads, and includes Vulkan renderer fixes. — [SDL releases](https://github.com/libsdl-org/SDL/releases/latest)
- Web runtimes offer WebGPU (Chrome 113+/144+, Safari 26), WebHID (Chromium only) and the Gamepad API. None of the cited compat data lists ray-tracing or vendor-upscaler APIs for the web. — [MDN BCD GPU](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/GPU.json); [MDN BCD HID](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/HID.json)
- Godot's latest stable is 4.7.2. — [Godot releases](https://github.com/godotengine/godot/releases/latest)

### Inferences
- **Gained by going native:**
  - Hardware RT for light transport, such as ray-traced reflections or GI for a particle light toy. Note that wgpu RT is experimental, Vulkan-first for pipelines, and has no web counterpart.
  - DLSS/XeSS-class upscaling and frame generation, which need D3D11/D3D12/Vulkan integration not reachable from WebGPU.
  - Lower input-to-photon latency, through control of swapchain and present modes and no compositor hop through a browser.
  - Gyro/accelerometer and touchpad data from DualSense, Switch and similar pads via SDL3, without WebHID report parsing.
  - Steam Input integration through native Steamworks.
- **Lost:**
  - The existing WebGL2 renderer and the esbuild ES-module bundle would have to be rewritten in Rust/WGSL or C++/HLSL/MSL. wgpu's WGSL eases a later WebGPU port, but WebGL2 GLSL code doesn't carry over.
  - The phone controller page and the desktop would no longer share one JS codebase. The desktop would need a Rust or C++ HTTP/WebSocket server, though the phone page itself stays web.
  - The "one HTML file" portability and web devtools go away.
- **Middle path:** keep Electron for v1 and confine GPU work to WebGPU with a WebGL2 fallback. Revisit native, for example a Rust/wgpu core rendering into a native window with the same phone protocol, only if hardware RT or upscalers become product requirements.
- Engines (Godot/Unity/Unreal) add editor productivity and, for Unity and Unreal, vendor upscaler plugins (XeSS plugin listed). They share the "rewrite everything" cost and add engine licensing and runtime size, which were not researched here.

### Gaps
- No primary data was gathered on Unity 6.x and Unreal 5.x (versions, pricing, hardware RT and frame-generation support, empty-project build sizes), Godot 4.7 ray tracing, or AMD FSR SDK API/platform support. The FidelityFX SDK README path wasn't found and the search budget was exhausted.
- No measured latency comparisons (browser compositor vs native swapchain) were found.
- Whether a future WebGPU ray-tracing extension exists is out of scope here (covered by the WebGPU-features researcher).

## Verification

Fact-check pass on 2026-11-12. Sources were read raw from GitHub (raw.githubusercontent.com, plus github.com pages through a fetch tool), the npm registry and developer.apple.com. Measured facts come from this container: headless Chromium 153.0.8010.12 (Playwright 1.63.0) with a SwiftShader adapter. Electron 45 itself ships Chromium 156.

| Claim | Verdict | Source |
|---|---|---|
| WebGPU by browser: Chrome 113 (ChromeOS/macOS/Windows), Chrome 144 adds Linux; Safari 26; Firefox 141+ partial (Windows; Apple-silicon macOS from 145/147; no Linux) | confirmed | https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/GPU.json |
| Chromium/Electron on Linux enables WebGPU by default only on Intel Gen12+ | corrected: also NVIDIA ≥ 535.183.01 (present from the 148 tag, absent at 146); AMD and pre-Gen12 Intel blocked; applies to Electron 45 | https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/software_rendering_list.json; https://raw.githubusercontent.com/chromium/chromium/main/ui/gl/BUILD.gn |
| WebHID Chrome 89+ only (no Firefox/Safari); Gamepad API everywhere | confirmed (`navigator.hid` also present in measured Chromium 153) | https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/HID.json; https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Gamepad.json |
| Electron 45.0.0 (2026-10-21) = Chromium 156.0.8078.48, V8 15.6, Node 24.22.0; latest 45.3.0 (2026-11-10) pins Chromium 156.0.8078.96 / Node 24.22.2; 44.11.1, 43.8.8 and 46.0.0-alpha.9 as listed | confirmed | https://raw.githubusercontent.com/electron/website/main/blog/electron-45-0.md; https://registry.npmjs.org/electron; https://raw.githubusercontent.com/electron/electron/v45.3.0/DEPS |
| Electron: 8-week majors, latest 3 supported, targets even Chromium versions on a 4-week Chromium cadence; 44 → 45 jump unexplained | corrected: Chromium now ships a stable milestone every two weeks (changed between the 152 and 156 tags), so each Electron major spans four Chromium milestones | https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/docs/process/release_cycle.md; https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/electron-timelines.md |
| Electron 45 minimum OS (added): macOS 13 Ventura+, Windows 10+, x64 and arm64 | confirmed | https://raw.githubusercontent.com/electron/electron/v45.3.0/README.md |
| WebKitGTK (Tauri on Linux) has no WebGPU; latest line 2.52 | corrected: latest line is 2.54 (2.54.2), which still has no WebGPU option or release-note entry | https://raw.githubusercontent.com/WebKit/WebKit/webkitglib/2.54/Source/cmake/OptionsGTK.cmake; https://raw.githubusercontent.com/WebKit/WebKit/webkitglib/2.54/Source/WebKit/gtk/NEWS |
| Safari 26 adds WebGPU and HDR WebGPU canvas; Tauri maintainers: WebGPU in WKWebView only on macOS 26+, Windows needs `--enable-unsafe-webgpu` (2023) | confirmed | https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes; https://github.com/tauri-apps/tauri/issues/6381 |
| Electron security defaults (context isolation since 12, sandbox since 20), 20-item checklist, fuse defaults, `utilityProcess` options | confirmed | https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/security.md; https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/fuses.md; https://raw.githubusercontent.com/electron/electron/main/docs/api/utility-process.md |
| macOS Local Network privacy (macOS 15+): listening/accepting TCP needs no consent; outgoing TCP, UDP sends, Bonjour and `.local` need it; reset buttons from macOS 27.2; subnet defaults from 15.5; TN revised 2026-10-06 | confirmed | https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy |
| Apple Developer Program 99 USD/yr; notary service rejects altool/Xcode ≤13 since 2023-11-01; Sequoia removes Control-click Gatekeeper override | confirmed | https://developer.apple.com/programs/whats-included/; https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution; https://developer.apple.com/news/?id=saqachfa |
| Windows: Artifact Signing ~$9.99/month (orgs US/CA/EU/UK, individuals US/CA), OV $150–300/yr, EV no SmartScreen bypass since 2024, Store MSIX free and warning-free, reputation takes weeks | confirmed | https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/package-and-deploy/code-signing-options.md; https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/package-and-deploy/smartscreen-reputation.md |
| Electron's code-signing page: EV required since June 2023; Artifact Signing "gets rid of SmartScreen warnings" | corrected: Microsoft's 2026 docs contradict both | https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/code-signing.md vs the Microsoft page above |
| Artifact Signing tiers, billing and GA date (third-party) | unverifiable | Microsoft pages read do not state them |
| electron-builder 26.18.1 / electron-updater 6.8.12 are current | corrected: npm `latest` = 26.18.0 / 6.8.11 (2026-10-20); 26.18.1 / 6.8.12 sit on the `v26` tag | https://registry.npmjs.org/electron-builder; https://registry.npmjs.org/electron-updater |
| Electron `autoUpdater` has no Linux; update.electronjs.org criteria; electron-updater covers macOS/NSIS/AppImage/deb/rpm | confirmed | https://raw.githubusercontent.com/electron/electron/main/docs/api/auto-updater.md; https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/updates.md |
| steamworks.js last release 0.4.0 (2024-08-06); overlay helper forces `in-process-gpu` + `disable-direct-composition`; no Windows/Linux arm64 binaries; issue #102 reports | confirmed | https://registry.npmjs.org/steamworks.js; https://raw.githubusercontent.com/ceifa/steamworks.js/main/index.js; https://github.com/ceifa/steamworks.js/issues/102 |
| CI: WebGPU compute works but canvas presentation fails on SwiftShader; render-to-texture readback "probably" works; CPU adapters need `--enable-unsafe-webgpu` | confirmed (measured: offscreen render, compute and `copyTextureToBuffer` work; presentation fails headless and under Xvfb) | measured in this container; https://raw.githubusercontent.com/chromium/chromium/main/gpu/config/webgpu_blocklist_impl.cc |
| Trim osx-sign default entitlements, dropping microphone | corrected: keep `com.apple.security.device.audio-input` (mic/line-in is a feature) | https://raw.githubusercontent.com/electron/osx-sign/main/entitlements/default.darwin.plist; https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.device.audio-input |
| Windows Defender Firewall default block and first-run prompt behaviour | unverifiable | learn.microsoft.com blocked |
| Electron 45.3.0 runtime zips 121–158 MB | confirmed | https://github.com/electron/electron/releases/expanded_assets/v45.3.0 |
| GitHub runner labels (`windows-2025`, `macos-26`, `macos-26-intel`, `ubuntu-22.04/24.04(-arm)`, `windows-11-arm`) | confirmed | https://raw.githubusercontent.com/actions/runner-images/main/README.md |
| Native options: wgpu v30.0.1 (2026-08-21) experimental RT; SDL 3.4.20; Godot 4.7.2; Streamline needs DX11/Vulkan 1.2; XeSS 3 SR/FG/XeLL | confirmed | https://raw.githubusercontent.com/gfx-rs/wgpu/trunk/CHANGELOG.md; https://github.com/libsdl-org/SDL/releases/latest; https://github.com/godotengine/godot/releases/latest; https://raw.githubusercontent.com/NVIDIA-RTX/Streamline/main/README.md; https://raw.githubusercontent.com/intel/xess/main/README.md |

**Contradictions noted and how they were resolved**
- Notes vs measured facts: none of the notes' claims were contradicted. The measured facts settle two open items: render-to-texture readback works where presentation fails, and `--enable-unsafe-webgpu` alone yields a SwiftShader adapter.
- Within this file and with desktop_hardware_tiers.md: both relied on MDN's "Linux (Intel Gen12+ GPUs only)". Chromium's blocklist also admits NVIDIA ≥ 535.183.01; corrected in both files.
- With audio_input_analysis.md: this file said to drop the microphone entitlement, but the audio design needs mic and line-in. Resolved: keep `device.audio-input`.
- With desktop_hardware_tiers.md: that file calls Steam Deck handhelds out of scope, while this file plans for Steam Deck/SteamOS. Left as a product decision. Either way, AMD-based SteamOS devices (Deck and Steam Machine) are WebGPU-blocklisted by default.
