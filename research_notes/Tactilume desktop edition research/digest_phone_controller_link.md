This is the fact-checked digest of phone_controller_link.md, covering the link from phone browsers (iOS, Android) and the native Tactilume Android app to Tactilume Desktop over home Wi-Fi, as of 2026-11-12.

**Status.** The Verification table has 15 claims: 8 confirmed, 5 corrected, 2 unverifiable. Sources were re-read on GitHub (raw), developer.apple.com, developer.android.com, dl.google.com and the npm registry. The second pass used no web searches. Comparable-product and Wi-Fi latency evidence is search-summary only.

**Tags.**
- [Verified]: re-read at the source. [Verified correction]: the original was wrong, and the corrected text is given. [Unverified]: could not be checked. (search summary): a snippet only. Inference: the notes' own conclusion.
- [Measured]: this container's headless Chromium 153.0.8010.12 (Playwright 1.63.0, Linux). It loaded one page over plain HTTP from 192.0.2.2, which is not a secure context, and from 127.0.0.1, which is. This is desktop Chromium, not a phone.

**Source keys** (GitHub `blob` URLs):
- BCD = https://github.com/mdn/browser-compat-data/blob/main/ (browsers/, api/); MDN = https://github.com/mdn/content/blob/main/files/en-us/web/ (security/defenses/secure_contexts/…, security/defenses/mixed_content/…, api/…)
- CR = https://github.com/chromium/chromium/blob/{main | 157.0.8103.81}/ (services/network/public/cpp/features.cc, build/config/android/config.gni, Blink's pointer_event.idl, device_motion_event.idl, device_sensor_event_pump.h)
- WK = https://github.com/WebKit/WebKit/blob/main/Source/ (UnifiedWebPreferences.yaml, PointerEvent.idl, PeerConnectionBackend.cpp, WebCoreMotionManager.h)
- LNA = https://github.com/WICG/local-network-access/blob/main/explainer.md; WT = https://github.com/w3c/webtransport/blob/main/index.bs; DO = https://github.com/w3c/deviceorientation/blob/main/index.bs; RTC = https://github.com/w3c/webrtc-pc/blob/main/webrtc.html
- APPLE = https://developer.apple.com/documentation/ (TN3179; Safari 26.4, 26.5 and 27 release notes)
- ALNP = https://developer.android.com/privacy-and-security/local-network-permission (last updated 2026-11-03)
- SDK = https://dl.google.com/android/repository/source-37.2_r01.zip; API = https://dl.google.com/android/repository/platform-37.2_r02.zip (api-versions.xml); AXW = https://dl.google.com/android/maven2/androidx/webkit/webkit/1.19.0-alpha01/webkit-1.19.0-alpha01-sources.jar
- NPM = https://registry.npmjs.org/<package>; LE = https://github.com/letsencrypt/website/blob/main/content/en/docs/rate-limits.md; NODEQ = https://github.com/nodejs/node/blob/main/doc/api/quic.md

## Bottom line
- **Two routes, one protocol.** Browser phones use a WebSocket for control plus an unordered, zero-retransmit DataChannel for realtime, both to the desktop's own server. The Android app uses Kotlin TLS pinned to the desktop key, plus UDP. The binary messages, clock sync and jitter buffer are the same on every path. (Inference)
- **The secure-context boundary sets the browser feature set.** Offline, a plain-HTTP tier is unavoidable (Inference), and it loses tilt, coalesced samples and Wake Lock. [Verified correction; Measured]
- **Browser local-network gates do not affect** a page served from the desktop's LAN IP. [Verified]
- **Android 17 does block the app** at targetSdk 37, unless it uses the NsdManager picker or holds `ACCESS_LOCAL_NETWORK`. [Verified correction: ALNP]
- **Do the app's networking in Kotlin, not in the WebView page.** Defer WebTransport, and rule out Web Bluetooth. [Verified]

## 1. Baseline and transports
- **Current browsers.** Safari iOS 27.2 (2026-10-26), with 27.3 in beta. Chrome Android and WebView 157 (2026-11-03), with 158 in beta (due 2026-11-17). [Verified: BCD]
- **WebSocket** works everywhere, including `ws://` from an `http://` page, but it stalls on loss. `ws` 8.22.2 turns off Nagle (`setNoDelay()`). [Verified: NPM; https://github.com/websockets/ws/blob/8.22.2/lib/websocket.js]
- **DataChannel `{ordered:false, maxRetransmits:0}`** is in iOS Safari, Chrome Android and WebView, and it is not secure-context-gated. [Verified: MDN; RTC; Measured] Safari 26.4 enforces `[EnforceRange]` on `maxRetransmits`, and Safari 27 fixed the SCTP buffered-amount check. [Verified: APPLE]
- **LAN ICE with no STUN.**
  - The peer-reflexive path works between two Chromium 153 peers: the channel opened in about 8 ms, with a `prflx` remote candidate. [Measured]
  - WebKit exposes host candidates only as `<UUID>.local` names, and it ignores remote `.local` names that are not v4 UUIDs. So the desktop must advertise raw host IPs. [Verified correction: WK]
  - Prototype on real phones.
- **WebTransport.** Chrome 97, Firefox 114 and Safari 26.4 (2026-03-24). It is secure-context-only and off in iOS Lockdown Mode. [Verified: BCD; WK]
  - `serverCertificateHashes`: validity of at most two weeks; the algorithm list must include ECDSA P-256 and exclude RSA; it cannot be combined with `allowPooling`. [Verified correction: WT]
  - Node's `node:quic` (v23.8.0, experimental) has no WebTransport, and `@fails-components/webtransport` is a stopgap. [Verified: NODEQ; NPM]
  - Verdict: defer.
- **Web Bluetooth** is absent in Safari, iOS and WebView, and it is secure-context-only. [Verified: BCD]
- **Latency.** There is no rigorous phone-browser LAN benchmark. Wi-Fi power save can reportedly add up to 500 ms, or 20–80 ms spikes after 2–3 s idle. AirConsole targets < 100 ms. [Unverified] The notes' design goal is 20–40 ms end to end. (Inference)

## 2. Secure contexts and feature tiers
- **A plain `http://<LAN IP>` page loses:**
  - DeviceMotion/Orientation: the interfaces are absent in Safari 26.4+ and in Chromium, whose IDL marks them `SecureContext`;
  - Screen Wake Lock and `getCoalescedEvents()`;
  - `crypto.subtle` and `randomUUID()`;
  - WebTransport and WebCodecs.
- **It keeps:** Pointer and Touch Events (including `getPredictedEvents()`), `getRandomValues()`, WebSocket, WebRTC, `vibrate`, Fullscreen and Orientation.
- The split above is [Verified correction: MDN; BCD api/Crypto.json; CR and WK pointer IDL; CR device_motion_event.idl]. Chromium 153 matched it exactly. [Measured]
- **Secure contexts** are https, wss, file, localhost, `*.localhost`, 127.0.0.0/8 and ::1; a private-IP `http://` URL is not one. [Verified: MDN] So the HTTP tier can make tokens but not HMACs. (Inference)
- **Mixed content.** Non-media mixed content is blocked, and upgradable requests to IP-address hosts are blocked. Top-level navigations are not mixed content. [Verified: MDN]
- **Tiers** (Inference):
  - Trusted HTTPS uses a Plex-style per-install name with a DNS-01 wildcard. It needs internet, and it fails behind routers that filter private-IP DNS answers, as the LNA explainer itself notes. [Verified: LNA]
  - Self-signed HTTPS that the user clicks through: not known yet.
  - Plain HTTP: touch only.
- **Let's Encrypt** allows 50 certificates per registered domain (or IPv4 address, or IPv6 /64) per 7 days, refilling at one every 202 minutes. [Verified: LE] Putting the vendor domain on the PSL makes each install its own registered domain. (Inference)

## 3. Local-network gates (browser route)
- **Scope.** LNA covers public→local, public→loopback and local→loopback only. "`local` -> `local` is not a local network request", and a document's address space comes from the IP it was loaded from. [Verified: LNA]
- **Chrome.** `fetch` checks from 142 (2025-10-28) and WebSocket and WebTransport from 147 (2026-04-07); the permission split into `local-network` and `loopback-network` in 145. Chrome Android mirrors desktop Chrome, and WebView has none of this. [Verified: BCD]
- **Chromium 157** leaves `kLocalNetworkAccessChecksWebRTC` off, so WebRTC is not gated. [Verified: CR features.cc]
- **Other engines.** WebKit's LNA flag is `unstable` and off. Firefox 153+ knows the permissions, but BCD records no enforcement. [Verified: WK; BCD]
- **iOS.** "Traffic originating from WKWebView, SFSafariViewController, and Safari doesn't require local network access." [Verified: APPLE TN3179]
- **Android 17 and browsers.** Browsers fall under the local network permission once they target SDK 37. Chrome 157 targets 36; Chromium main targets 37 and requests `ACCESS_LOCAL_NETWORK` through its LNA flow. [Verified: CR config.gni; ALNP]
- **Avoid** a controller page hosted on a public website: it would hit LNA prompts and mixed-content blocking. The desktop still needs Origin and Host checks. (Inference)

## 4. Touch and motion in phone browsers
- **Pointer Events.** `pressure` is Chrome 55 / Safari 13. `getCoalescedEvents()` is Chrome 58 / Safari 18.2, secure contexts only. `getPredictedEvents()` is Chrome 77 / Safari 18.2. [Verified: BCD] On Safari 18.2, use the parent event's `pointerId` (search summary).
- **Scroll fix.** Safari 26.5 fixed `preventDefault()` on `pointerdown` failing to stop scrolling when only passive touch listeners exist. Keep non-passive touch listeners for older Safari. [Verified: APPLE]
- **Contact size, not force.** `Touch.force` and `radiusX` exist on iOS 10+. `force` reads 0 without 3D Touch (search summary), so use contact size as "intensity". [Verified: BCD]
- **Multi-touch limit.** The per-model iPhone limit is unknown: 5 and 10 are both reported. [Unverified]
- **Screen APIs.** [Verified: BCD; WK]
  - Fullscreen: none on iPhone; partial on iPad, with an overlay button, and swiping down exits.
  - Orientation lock: none on iOS or WebView.
  - Wake Lock: full from iOS 18.4, including Home Screen apps.
- **DeviceMotion.** It needs a secure context. `requestPermission()` exists on iOS 14.5+ and on Chrome, Chrome Android and WebView 152+ (present in Chromium 153), so feature-detect it and call it from a tap everywhere. [Verified correction: BCD; CR; Measured]
- **Motion rate.** 60 Hz in both engines (the old 20 Hz iOS figure is outdated). [Verified correction: CR device_sensor_event_pump.h; WK WebCoreMotionManager.h] The spec rate is implementation-defined, and 0.1-unit precision means 16-bit fixed point loses nothing. [Verified: DO]

## 5. Haptics and audio in browsers
- **`navigator.vibrate`.** Chrome Android 32+ and WebView 4.4.3+; it needs a user gesture since Chrome 60. Safari never shipped it. [Verified: BCD]
- **iOS.** The only web haptic is the HTML switch's side effect (`SwitchControlEnabled` is stable). [Verified: WK] ios-haptics says iOS 26.5 restricted it to real taps, and 3.2/3.3 forward a trusted click through a label over the switch. Apple's notes are silent. [Verified: NPM ios-haptics] So iOS web haptics can confirm button taps only.
- **Audio.** The Audio Session API is Safari 16.4+ only. [Verified: BCD] Use `type = "playback"` so the silent switch does not mute Web Audio (search summary).
- **Protocol.** The desktop sends semantic `HAPTIC_CUE` messages, and each client maps them. (Inference)

## 6. Pairing and security (Inference unless tagged)
- **Browser pairing.** A QR code carries the HTTPS URL and a 128-bit join token in the fragment (about 5 min, multi-use while the lobby is open). Each join shows a toast, with an optional approval. Fallback: IP or `.local` plus a 6-digit PIN. Each device gets a resume token, and its slot is held for about 60 s.
- **`.local`.** It reportedly resolves on iOS and Android 12+, but not on older Android or Knox. [Unverified] On Android 17, an app targeting SDK 37 needs the permission to resolve it. [Verified: ALNP]
- **Desktop.** Bind to LAN interfaces only, check Origin and Host, rate-limit PINs, authenticate before any input, accept input-only messages with size and rate caps, and listen only while phone control is on.
- **Native.** mDNS is unauthenticated, so confirm a short code from the TLS fingerprints once, then pin the desktop key.
- **Failure modes.** Guest-Wi-Fi isolation, full-tunnel VPNs and cellular block the LAN path; detect them and explain (search summary).

## 7. Timing and protocol (Inference)
- **Clock sync.** Use a `timesync`-style exchange every 2–5 s, taking the median offset of the lowest-RTT samples. `timesync` 1.0.11 is from 2022 and MIT-licensed. [Verified: NPM]
- **Playout.** An adaptive delay at p90–p95 lateness, clamped to 0–25 ms, with interpolation and at most about 1.5 frames of extrapolation.
- **Packets.** An 8-byte header, 8-byte touch samples and 12-byte motion. Ten fingers plus motion at ×2 redundancy is about 180 B, or about 22 KB/s per phone at 120 Hz (calc). The bytes are identical on every transport.
- **Process.** Run the endpoint in an Electron utility process, passing samples over a `MessagePort`.

## 8. Preview to the phone (optional)
- **`jitterBufferTarget`**: Chrome 124, Firefox 115 and Safari 27 (2026-09-14). [Verified: BCD; APPLE] WebCodecs is secure-context-only. [Verified: MDN; Measured]
- **WebGPU canvas capture.** Whether `canvas.captureStream()` works from a WebGPU canvas in Electron is [Unverified]. It is untestable here: presenting a WebGPU canvas fails both headless and under Xvfb, while offscreen rendering and `copyTextureToBuffer` readback work. [Measured]
- **Options:** WebRTC video (640×360, H.264), JPEG frames at 10–15 fps, or a state mirror. Glass-to-glass latency of 30–90 ms is reported (search summary). (Inference)

## 9. The Android app route (Kotlin, targetSdk 37, minSdk 26)
- **Android 17 enforcement.** "Local network is blocked by default" at targetSdk 37: TCP in and out, UDP send and receive, and `.local`, through every API including OkHttp. [Verified correction: ALNP]
  - TCP times out and UDP returns `EPERM`.
  - The DNS server on port 53 is exempt.
  - `ACCESS_LOCAL_NETWORK` is in the NEARBY_DEVICES group.
  - `RESTRICT_LOCAL_NETWORK` is only the deprecated Android 16 opt-in.
- **NSD picker.** [Verified: SDK; API; ALNP]
  - `FLAG_SHOW_PICKER` needs no permission, and the grant persists across reboots. `FLAG_USER_APPROVED_ONLY` reconnects silently.
  - Re-resolve addresses; don't store IPs.
  - "Connections to IP addresses obtained this way don't require the ACCESS_LOCAL_NETWORK permission", so the grant looks address-level.
  - API levels: 37.0, or T-ext 22 (all Android 14+). `getHostAddresses()` is API 34.
- **Multicast lock and advertising.** A MulticastLock is needed only below T-ext 7 (Android 8–12 and unpatched 13). [Verified: SDK] Whether `acquire()` needs `CHANGE_WIFI_MULTICAST_STATE` is [Unverified]. Advertising from the phone always needs `ACCESS_LOCAL_NETWORK`. [Verified: SDK]
- **The WebView page.** [Verified: SDK; AXW]
  - `https://appassets.androidplatform.net` is a secure context.
  - `ws://` from it is blocked as mixed content (default `MIXED_CONTENT_NEVER_ALLOW`) and as cleartext (WebView honours the policy at targetSdk ≥ 26, and WebSockets count).
  - `java.net.Socket` is outside cleartext policy, but not outside Android 17's rule.
  - Cleartext is off by default at targetSdk ≥ 28, by target SDK rather than device version. [Verified correction: SDK]
- **Bridge.** `addWebMessageListener` with `allowedOriginRules` carries ArrayBuffers (`WEB_MESSAGE_ARRAY_BUFFER`). Its latency is unmeasured. [Verified: AXW]
- **WebView LNA.** BCD shows none, and under Android 17 WebView traffic inherits the app's permission. [Verified: BCD; ALNP]
- **Sensors.** Rates above 200 Hz need `HIGH_SAMPLING_RATE_SENSORS` (API 31), so request 100 Hz. `TYPE_GAME_ROTATION_VECTOR` is API 18. [Verified: SDK; API]
- **Haptics.** `VIBRATE` and the foreground are required. One-shot and amplitude are API 26, predefined effects 29, composition 30, `LOW_TICK`/`THUD` 31, the attributes overload 33 and envelopes 36. [Verified: SDK; API]
- **Window and touch.** Gesture exclusion has a 200 dp vertical cap, and `WindowInsetsController` is API 30. `getPressure` and historical samples are API 5, and `TOOL_TYPE_STYLUS` is 14. [Verified: SDK; API]
- **Manifest** (Inference):
  - `INTERNET` and `VIBRATE`: always.
  - `ACCESS_LOCAL_NETWORK`: only for a custom discovery list; fall back to the picker if it is revoked.
  - `CHANGE_WIFI_MULTICAST_STATE`: for the legacy lock.
- **Transport** (Inference). Control runs over Kotlin TLS with the pinned key, and realtime over UDP with an HMAC or AEAD keyed from TLS. Keep `cleartextTrafficPermitted="false"`.

## 10. Desktop libraries and licences
- `ws` 8.22.2 (2026-11-08): MIT. [Verified: NPM]
- `node-datachannel` 0.33.6 (2026-10-27): MPL-2.0 (file-level copyleft). It needs Node ≥ 18.20, ships prebuilt x64 and arm64 binaries for all three desktop OSes, and has a built-in WebSocket. [Verified: NPM; README]
- `@geckos.io/server` 3.1.0 and `@fails-components/webtransport` 1.6.11 (Node ≥ 20): both BSD-3-Clause. [Verified: NPM]

## Open questions
1. (Priority 2) On iOS Safari 27 and Chrome Android 157, is a self-signed HTTPS page on the desktop's LAN IP a secure context once the user clicks through the warning, with motion permission and coalesced events working? The answer decides whether an offline tier with tilt exists, and whether the Plex-style DNS and certificate service is required.
2. (Priority 2) Does a no-STUN DataChannel connect from iOS Safari 27 and Chrome Android 157 to `node-datachannel` on real Wi-Fi? Does it beat WebSocket on p95/p99 latency, with power save on and off? Only a Chromium-to-Chromium container test exists. The answer decides whether to build the WebRTC path.
3. (Priority 3) Once Chrome Android targets SDK 37, does loading the page from a LAN IP (local→local, so no LNA prompt) raise an Android "Nearby devices" prompt, or fail? This sets the first-run guidance for Android users without the app.
