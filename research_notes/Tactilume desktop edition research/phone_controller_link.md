# Phone-as-controller link for Tactilume Desktop: phone browsers (iOS, Android) and the native Tactilume Android app → desktop app over home Wi-Fi, status November 2026

*Method note (2026-11-12).*

*Provenance tags:*
- **[primary]**: read directly from the primary source. That means one of:
  - raw files in mdn/browser-compat-data (BCD), mdn/content, WICG/local-network-access, w3c/deviceorientation or WebKit/WebKit on GitHub;
  - Apple's Safari release notes and TN3179 on developer.apple.com;
  - the Android SDK 37.2 framework sources (`source-37.2_r01.zip`) and `api-versions.xml` (`platform-37.2_r02.zip`) from dl.google.com;
  - androidx.webkit 1.19.0-alpha01 sources from Google Maven;
  - npm package tarballs.
- **[search summary, not verified]**: seen only in a web-search result summary; the page itself was not opened.

*Access limits: the shared web-search budget ran out mid-research. Direct fetches to developer.chrome.com, MDN (rendered), webkit.org, developer.android.com, Google Groups and the W3C/WICG github.io pages were blocked. Maven Central returned HTTP 429, so OkHttp sources could not be checked. Anything stated from prior knowledge without a source appears only under Gaps, marked unverified. Browser versions current on 2026-11-12, per BCD [primary]: Safari iOS 27.2 (released 2026-10-26; 27.3 in beta) and Chrome / Android WebView 157 (2026-11-03; 158 beta due 2026-11-17).* [Verified: https://github.com/mdn/browser-compat-data/blob/main/browsers/safari_ios.json; https://github.com/mdn/browser-compat-data/blob/main/browsers/chrome_android.json; https://github.com/mdn/browser-compat-data/blob/main/browsers/webview_android.json]

*Fact-check note (2026-11-12): developer.android.com and the dl.google.com SDK zips were reachable in the verification pass, so the Android claims below were re-read there. See the Verification section at the end.*

---

## 1. Transports: which suit, latency and jitter on home Wi-Fi, and what comparable products use

### Takeaway
For browser phones, the baseline that works everywhere is a WebSocket to the desktop app's own server. For the continuous touch and motion stream, a WebRTC DataChannel set to `{ordered:false, maxRetransmits:0}` is better, because a dropped Wi-Fi packet never stalls the samples behind it. WebRTC is not limited to secure contexts, so it is also available on a plain-HTTP offline page. [Verified: https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/secure_contexts/features_restricted_to_secure_contexts/index.md; https://github.com/w3c/webrtc-pc/blob/main/webrtc.html]

WebTransport is now in every engine (Safari added it in 26.4, March 2026), but it requires a secure context. On the server side it still needs a native HTTP/3 addon in Node: Node's own `node:quic` (added in v23.8.0, "Stability: 1.0 - Early development", behind `--experimental-quic`) speaks HTTP/3 but lists WebTransport as not built in. [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/WebTransport.json; https://developer.apple.com/documentation/safari-release-notes/safari-26_4-release-notes; https://github.com/nodejs/node/blob/main/doc/api/quic.md]

Web Bluetooth does not exist on iOS. [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/Bluetooth.json]

For the native Android app (section 8), plain UDP plus TCP/TLS from Kotlin is simpler than either browser option.

I found no rigorous published benchmark of phone-browser WebSocket against DataChannel on a LAN. The available evidence suggests that Wi-Fi power-save behaviour, not the transport, causes the worst spikes.

### Cited Findings
**Semantics and tuning**
- WebSocket is ordered and reliable over TCP, so one loss stalls every later message. A DataChannel can be unordered and unreliable, dropping stale data instead. — [websocket.org](https://websocket.org/comparisons/webrtc/); [BlogGeek glossary](https://bloggeek.me/webrtcglossary/data-channel/) [search summary, not verified]
- The Node `ws` library (8.22.2, published 2026-11-08) disables Nagle's algorithm: `lib/websocket.js:262` reads `if (socket.setNoDelay) socket.setNoDelay();`. — [ws on npm](https://www.npmjs.com/package/ws) [primary] Licence MIT. [Verified: https://github.com/websockets/ws/blob/8.22.2/lib/websocket.js; https://registry.npmjs.org/ws]
- RTCPeerConnection and RTCDataChannel are not on MDN's list of features restricted to secure contexts, and their MDN pages carry no secure-context banner. WebTransport is on the list and its page carries the banner. — [MDN: features restricted to secure contexts (source)](https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/secure_contexts/features_restricted_to_secure_contexts/index.md); [MDN WebTransport page (source)](https://github.com/mdn/content/blob/main/files/en-us/web/api/webtransport/index.md); [MDN RTCPeerConnection page (source)](https://github.com/mdn/content/blob/main/files/en-us/web/api/rtcpeerconnection/index.md) [primary] The WebRTC spec itself marks nothing `[SecureContext]`. [Verified: https://github.com/mdn/content/blob/main/files/en-us/web/api/rtcdatachannel/index.md; https://github.com/w3c/webrtc-pc/blob/main/webrtc.html]
- Safari 26.4 made `RTCDataChannelInit` enforce `[EnforceRange]` on `maxPacketLifeTime` and `maxRetransmits`, and fixed DataChannel close events not firing when the RTCPeerConnection closes. Safari 27 fixed "`RTCDataChannel` did not check the SCTP buffered amount synchronously". — [Safari 26.4 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-26_4-release-notes); [Safari 27 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes) [primary] [Verified: https://developer.apple.com/documentation/safari-release-notes/safari-26_4-release-notes; https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes]
- In a Mozilla bug, about 70 ms of latency was diagnosed as a TURN relay path while Chrome was going direct over the LAN, so benchmarks must confirm a host-to-host candidate pair. — [Mozilla bug 976115](https://bugzilla.mozilla.org/show_bug.cgi?id=976115) [search summary, not verified]
- Prefer RTT measured on one clock to one-way timestamps across machines. — [WebRTC for the Curious](https://webrtcforthecurious.com/docs/09-debugging/) [search summary, not verified]
- Vendor "WebRTC is faster" pages show no LAN data. — [Metered](https://metered.ca/blog/webrtc-vs-websocket); [VideoSDK](https://www.videosdk.live/developer-hub/webrtc/websocket-vs-webrtc-datachannel) [search summary, not verified]

**Desktop-side libraries**
- `node-datachannel` 0.33.6 (2026-10-27): "WebRTC For Node.js and Electron (with WebSocket)". It supports Electron, has an integrated WebSocket client and server usable for signaling, needs Node ≥ 18.20, and ships prebuilt binaries. — [npm](https://www.npmjs.com/package/node-datachannel) [primary] Licence MPL-2.0 (file-level copyleft); prebuilt packages cover x64 and arm64 on Linux, macOS and Windows. [Verified: https://registry.npmjs.org/node-datachannel; https://github.com/murat-dogan/node-datachannel/blob/master/README.md]
- `@geckos.io/server` 3.1.0 (2026-03-27): "Real-time client/server communication over UDP using WebRTC and Node.js". — [npm](https://www.npmjs.com/package/@geckos.io/server) [primary] Licence BSD-3-Clause. [Verified: https://registry.npmjs.org/@geckos.io/server]
- `@fails-components/webtransport` 1.6.11 (2026-10-18) is a libquiche binding that calls itself "a duct tape-style solution until a bulletproof native support of HTTP/3 and WebTransport is provided by node itself". Prebuilt binaries cover Windows, Linux and macOS on x64, and arm on Linux and macOS only. — [npm](https://www.npmjs.com/package/@fails-components/webtransport) [primary] Licence BSD-3-Clause; needs Node ≥ 20. [Verified: https://registry.npmjs.org/@fails-components%2Fwebtransport]

**WebRTC ICE in phone browsers (LAN, no STUN)**
- WebKit has documented that without camera or microphone permission it exposes only server-reflexive and TURN candidates. — [WebKit blog](https://webkit.org/?p=7763) [search summary, not verified]. IETF 103 slides say "Safari does not expose any host candidates by default". — [slides](https://datatracker.ietf.org/meeting/103/materials/slides-103-rtcweb-mdns-ice-candidates-00.pdf) [search summary, not verified]. WebKit later enabled mDNS candidates. — [WebKit bug 189503](https://bugs.webkit.org/show_bug.cgi?id=189503) [search summary, not verified]. Chrome replaced host IPs with mDNS names. — [Chromium PSA](https://groups.google.com/a/chromium.org/g/blink-dev/c/z5hSy6Rf_aE/m/amoojRkSAgAJ) [search summary, not verified]
- The WICG Local Network Access explainer proposes gating WebRTC too: when an ICE candidate has a loopback or local address, check or prompt for the permission, and drop the candidate if denied. — [WICG LNA explainer](https://github.com/WICG/local-network-access/blob/main/explainer.md) [primary]

**WebTransport**
- Safari 26.4 release notes: "Added support for WebTransport" and "improved `WebTransport` stream handling". — [Safari 26.4 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-26_4-release-notes) [primary]. BCD lists WebTransport datagrams in Chrome 97 and Safari 26.4, and `serverCertificateHashes` in Chrome 100 and Safari 26.4; iOS mirrors desktop Safari. — [BCD api/WebTransport.json](https://github.com/mdn/browser-compat-data/blob/main/api/WebTransport.json) [primary]. Safari iOS 26.4 shipped on 2026-03-24. — [BCD browsers/safari_ios.json](https://github.com/mdn/browser-compat-data/blob/main/browsers/safari_ios.json) [primary] [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/WebTransport.json; https://github.com/mdn/browser-compat-data/blob/main/browsers/safari_ios.json; https://developer.apple.com/documentation/safari-release-notes/safari-26_4-release-notes]
- WebKit's `WebTransportEnabled` flag carries `disableInLockdownMode: true`, so WebTransport is off when iOS Lockdown Mode is on. — [WebKit UnifiedWebPreferences.yaml](https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml) [primary] [Verified: https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml]
- `serverCertificateHashes` requires an X.509v3 certificate whose total validity period does not exceed two weeks (so 14 days is allowed), whose key uses an allowed algorithm (the list must include ECDSA P-256 and must not contain RSA keys), and it cannot be combined with `allowPooling`. — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport/WebTransport) [search summary, not verified] [Verified correction: https://github.com/w3c/webtransport/blob/main/index.bs]. Let's Encrypt's 90-day certificates therefore can't be used. — [LE community](https://community.letsencrypt.org/t/two-week-lasting-certificates-to-comply-with-webtransport-requirements/209345) [search summary, not verified]. Firefox enforced the 14-day rule only from 125. — [Mozilla bug 1873263](https://bugzilla.mozilla.org/show_bug.cgi?id=1873263) [search summary, not verified]

**Bluetooth**
- WebKit "continues to be opposed to generic peripheral access APIs such as Web Bluetooth". — [W3C list, Sep 2024](https://lists.w3.org/Archives/Public/public-web-bluetooth/2024Sep/0002.html) [search summary, not verified]. On iOS it is available only in separate browsers such as Bluefy, which means installing an app. — [BeaconZone](https://www.beaconzone.co.uk/blog/browser-support-for-web-bluetooth/) [search summary, not verified]. BCD records no Safari or iOS support and no Android WebView support. [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/Bluetooth.json] Web Bluetooth is secure-context-only. — [MDN list (source)](https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/secure_contexts/features_restricted_to_secure_contexts/index.md) [primary]

**Wi-Fi as the jitter source**
- 802.11 power save makes a phone wake at beacon intervals to collect buffered frames. With a 100 ms beacon and a listen interval of 5, worst-case added latency is 500 ms. — [USPTO 9210656](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9210656) [search summary, not verified]. Anecdote: a Galaxy S25 Ultra owner saw 20–80 ms ping spikes and says the phone enters Wi-Fi power saving after 2–3 s idle. — [Samsung Community](https://us.community.samsung.com/t5/Galaxy-S25/Samsung-S25-ultra-wifi-is-not-stable/td-p/3290660) [search summary, not verified]

**What comparable products use**
- **AirConsole**: its FAQ says WebRTC is used "when a browser supports it", and that developers should assume higher latency. — [FAQ](https://developers2.airconsole.com/faq-help) [search summary, not verified]. Its best-practices guide targets "input latency <100ms" and offers a `server-zone` parameter that routes traffic through a datacenter, i.e. a cloud relay. — [best practices](https://developers.airconsole.com/best-practices-for-web-games-on-airconsole) [search summary, not verified]; see also [BlogGeek](https://bloggeek.me/webrtc-gaming) [search summary, not verified]
- **Kahoot!**: cloud WebSocket at `wss://play.kahoot.it/cometd` and `wss://kahoot.it/cometd`. — [Kahoot support](https://support.kahoot.com/hc/en-us/articles/115003198708-How-to-avoid-connectivity-issues) [search summary, not verified]
- **Open Stage Control**: a Node/Electron web server that serves its browser clients and handles OSC/MIDI. — [GitHub fork](https://github.com/amilajack/open-stage-control) [search summary, not verified]
- **Deskreen**: an Electron app streaming over WebRTC to LAN browsers. It pairs via QR code and IP, asks the host to allow or deny each connection, and has a `--local-ip` flag for when the QR code shows the wrong address. — [README](https://cdn.jsdelivr.net/gh/pavlobu/deskreen@master/README.md) [search summary, not verified]

### Inferences
- **Transport options** (synthesis):

| Option | Availability (Nov 2026) | Loss behaviour | On a plain-HTTP offline page? | Desktop-side effort | Verdict |
|---|---|---|---|---|---|
| WebSocket (ws/wss) to the app's server | All browsers | Head-of-line stalls on loss | Yes (`ws://` from an `http://` page) | Trivial | Baseline for control, signaling and fallback input |
| WebRTC DataChannel, unordered, `maxRetransmits:0` | iOS Safari, Android Chrome and WebView | Losses dropped | Yes, per MDN and the WebRTC spec (device-test) | Moderate (`node-datachannel`) | Primary realtime path for browsers |
| WebTransport datagrams | Chrome 97+, Safari 26.4+ | Unreliable datagrams | No (secure-context-only) | High (HTTP/3 addon, certificates) | Defer |
| Native UDP + TCP/TLS (Android app only) | Kotlin `DatagramSocket` / TLS sockets | Losses dropped | n/a (not a web page) | Low (`node:dgram`) | Primary for the native app (section 8) |
| Web Bluetooth | Not on iOS | — | No (secure context) | High | Ruled out |
| Cloud relay | All | Adds a WAN round trip | n/a | Vendor service | Optional fallback only |

- Use unreliable delivery for "latest state wins" samples. Send discrete edges (touch down and up, buttons, join and leave) reliably, and repeat the active-touch set in every packet so a lost "up" event self-corrects.
- LAN-only WebRTC without STUN should work against a `node-datachannel` desktop that advertises a real host-IP candidate. The phone's connectivity checks arrive from its real address, which the desktop learns as a peer-reflexive candidate. This is ICE reasoning, not a test result, so prototype it first. If Chrome or WebKit later gate local ICE candidates behind LNA, as the WICG explainer proposes, a page served from the LAN device is local→local and should be unaffected.
- AirConsole's <100 ms target suits a party game. A finger-driven light toy should aim for roughly 20–40 ms end to end.

### Gaps
- No rigorous phone-browser LAN latency or jitter measurements were found. A 2018 FH Hagenberg thesis, "Web-Based Integration of Mobile Devices" ([PDF](https://theses.fh-hagenberg.at/system/files/pdf/Temper18.pdf)), could not be opened.
- **Unverified** (prior knowledge only): Jackbox uses a cloud WebSocket service ("ecast"); Steam Link, TouchOSC and Unified Remote are native apps (Steam Link streams over UDP; TouchOSC speaks OSC over UDP/TCP plus MIDI); HappyFunTimes is a Node WebSocket server for phone browsers.
- AirConsole's fallback logic and its measured latencies are undocumented in what was found. WebRTC setup time on a LAN and per-browser DataChannel message size limits were not researched.

---

## 2. Secure-context constraints, LAN HTTPS options, Chrome Local Network Access, iOS Local Network permission

### Takeaway
The secure-context boundary decides the feature set. An `http://192.168.x.x` page is not a secure context, so it loses:
- DeviceMotion/DeviceOrientation (on iOS the interfaces are not even exposed since Safari 26.4);
- Screen Wake Lock;
- **`getCoalescedEvents()`**;
- Web Crypto's `crypto.subtle` and `crypto.randomUUID()` (`crypto.getRandomValues()` stays available, so the HTTP tier can still make random tokens but cannot compute HMACs);
- WebTransport.

[Verified correction: https://github.com/mdn/content/blob/main/files/en-us/web/api/crypto/getrandomvalues/index.md; https://github.com/mdn/content/blob/main/files/en-us/web/api/crypto/subtle/index.md; https://github.com/mdn/browser-compat-data/blob/main/api/Crypto.json; https://developer.apple.com/documentation/safari-release-notes/safari-26_4-release-notes]

It keeps Pointer and Touch Events (including `getPredictedEvents()`, which is not `[SecureContext]`), WebSocket, WebRTC, `navigator.vibrate`, and the Fullscreen and Orientation APIs. [Verified correction: https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/events/pointer_event.idl; https://github.com/WebKit/WebKit/blob/main/Source/WebCore/dom/PointerEvent.idl]

For LAN HTTPS, the Plex model gives the best user experience: a vendor domain whose names embed the private IP, with a per-install wildcard certificate obtained via DNS-01. It needs internet for DNS and for certificate issuance, and it breaks on routers that filter DNS answers pointing at private IPs. The WICG LNA explainer itself acknowledges that failure mode.

Chrome's Local Network Access applies to public→local, public→loopback and local→loopback requests only. A page loaded from the desktop's LAN IP talking back to that IP is local→local and never prompts; WebSockets go through the same checks as fetch. WebKit has an LNA flag, but it is still "unstable" and off by default. [Verified: https://github.com/WICG/local-network-access/blob/main/explainer.md; https://github.com/mdn/browser-compat-data/blob/main/api/WebSocket.json; https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml] Chrome does not apply LNA to WebRTC yet (`kLocalNetworkAccessChecksWebRTC` is disabled by default in Chromium 157 and main), and Android WebView enforces no LNA at all. [Verified: https://github.com/chromium/chromium/blob/157.0.8103.81/services/network/public/cpp/features.cc; https://github.com/mdn/browser-compat-data/blob/main/api/Permissions.json]

iOS Local Network privacy exempts Safari and WKWebView (TN3179). [Verified: https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy]

### Cited Findings
**What needs a secure context**
- MDN's list of features restricted to secure contexts includes:
  - Device Orientation / Device Motion, the Generic Sensor API and the Screen Wake Lock API;
  - the Web Crypto API, WebTransport, Web Bluetooth and WebCodecs;
  - Service Workers, the Storage API and the Gamepad API;
  - plus `getUserMedia()` and `registerProtocolHandler()`.
  — [MDN list (source)](https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/secure_contexts/features_restricted_to_secure_contexts/index.md) [primary] [Verified: https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/secure_contexts/features_restricted_to_secure_contexts/index.md]
- These MDN pages carry the secure-context banner: `DeviceMotionEvent`, `devicemotion`, `DeviceOrientationEvent`, `requestPermission()`, the Screen Wake Lock API, WebTransport, `SubtleCrypto`, `crypto.randomUUID()` and **`PointerEvent.getCoalescedEvents()`**. These do not: `RTCPeerConnection`, `RTCDataChannel`, `navigator.vibrate`, `Element.requestFullscreen`, `screen.orientation.lock`, and also `crypto.getRandomValues()` and `PointerEvent.getPredictedEvents()`. — [mdn/content source files](https://github.com/mdn/content/tree/main/files/en-us/web/api) [primary] [Verified: https://github.com/mdn/content/tree/main/files/en-us/web/api]
- Secure contexts are `https`, `wss`, `file`, `localhost`, `*.localhost`, `127.0.0.0/8` and `::1`. `http://example.com` is not secure, and neither is a private-IP `http://` URL. — [MDN Secure contexts (source)](https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/secure_contexts/index.md) [primary] [Verified: https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/secure_contexts/index.md]
- W3C Device Orientation spec (current main):
  - the interfaces and `ondevicemotion`/`ondeviceorientation` are `[SecureContext]`;
  - `requestPermission()` checks for transient activation;
  - readings are limited to 0.1° / 0.1 m/s² / 0.1 deg/s precision;
  - `interval` is "implementation-defined", and a maximum sampling-frequency cap is still being discussed (issue #87);
  - the requestPermission integration is "at risk" because of low test pass rates.
  — [w3c/deviceorientation index.bs](https://github.com/w3c/deviceorientation/blob/main/index.bs) [primary] [Verified: https://github.com/w3c/deviceorientation/blob/main/index.bs]
- Safari 26.4 fixed "`DeviceMotionEvent` and `DeviceOrientationEvent` interfaces so that they only show up in secure contexts". — [Safari 26.4 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-26_4-release-notes) [primary]. BCD lists `DeviceMotionEvent.requestPermission()` and `DeviceOrientationEvent.requestPermission()` in Safari iOS from 14.5, and in Chrome from 152 (Chrome Android and Android WebView mirror it); in Chromium both are gated by the `DeviceOrientationRequestPermission` runtime flag, which is `stable`. Feature-detect and call it from a tap on every browser. — [BCD DeviceMotionEvent](https://github.com/mdn/browser-compat-data/blob/main/api/DeviceMotionEvent.json); [BCD DeviceOrientationEvent](https://github.com/mdn/browser-compat-data/blob/main/api/DeviceOrientationEvent.json) [primary] [Verified correction: https://github.com/mdn/browser-compat-data/blob/main/api/DeviceMotionEvent.json; https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/device_orientation/device_motion_event.idl; https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/runtime_enabled_features.json5]. Developers report the iOS prompt is silently denied on http, and that a `touchend` (not `touchstart`) or click is needed. — [SO mirror](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/61145076/devicemotionevent-requestpermission-throws-notallowederror); [yal.cc](https://yal.cc/?p=1395) [search summary, not verified]
- Mixed content: browsers auto-upgrade image, video and audio requests and "block insecure requests for all other resource types". Upgradable requests are blocked when the host is an IP address. Top-level navigations to insecure URLs are not mixed content. — [MDN Mixed content (source)](https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/mixed_content/index.md) [primary] [Verified: https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/mixed_content/index.md]

**LAN HTTPS approaches**
- Plex: `*.plex.direct` names resolve to the IP embedded in the name, and each server gets a `*.<hash>.plex.direct` wildcard certificate. — [Valsorda](https://words.filippo.io/how-plex-is-doing-https-for-all-its-users/) [search summary, not verified]. DNS-rebinding protection in routers and Pi-hole blocks these names; users fix it by whitelisting the domain (pfSense `private-domain: "plex.direct"`). — [Plex forum](https://forums.plex.tv/t/adding-plex-direct-to-dns-rebinding-protection-whitelist/754355); [Netgate](https://forum.netgate.com/topic/200853/dns-rebind-issue-maybe/13); [Pi-hole](https://discourse.pi-hole.net/t/add-plex-direct-to-dns-rebinding/74780.md) [search summary, not verified]. The WICG LNA explainer independently notes: "Some routers filter out DNS responses mapping public domain names to private IP addresses -- this means that fallback to direct (insecure) private IP addresses is required". — [WICG explainer](https://github.com/WICG/local-network-access/blob/main/explainer.md) [primary]
- Let's Encrypt allows 50 certificates per registered domain per 7 days, with the registered domain determined via the Public Suffix List; override availability is stated inconsistently between language versions. — [LE rate limits](https://letsencrypt.org/docs/rate-limits/) [search summary, not verified] The English page confirms the limit (refilling at one certificate every 202 minutes, counted across all accounts) and says overrides can be requested for a registered domain or an account. [Verified correction: https://github.com/letsencrypt/website/blob/main/content/en/docs/rate-limits.md]
- Home Assistant users report microphone access blocked on HTTP. Trusted HTTPS needs a real domain (Let's Encrypt or the DuckDNS add-on). Native self-signed HTTPS is only a 2025 feature request. — [HA community](https://community.home-assistant.io/t/connecting-to-ha-locally-using-https/566441); [HA LE docs](https://www.home-assistant.io/docs/ecosystem/certificates/lets_encrypt); [feature request](https://community.home-assistant.io/t/native-https-support-with-built-in-self-signed-certificate-management/895874) [search summary, not verified]
- Jellyfin: built-in HTTPS on port 8920 from a PKCS#12 file; self-signed certificates give warnings; a reverse proxy is the usual alternative. — [Jellyfin docs](https://jellyfin.org/docs/general/post-install/networking/advanced/letsencrypt); [forum](https://forum.jellyfin.org/t-mac-self-signed-cert-for-local-lan-only) [search summary, not verified]

**Local Network Access (WICG explainer, Chrome, WebKit)**
- Address spaces are `loopback`, `local` and `public`. `local` includes RFC 1918 and RFC 4193 addresses and RFC 6762 `.local` names.
  - A "local network request" is public→local, public→loopback or local→loopback. "Note that `local` -> `local` is not a local network request, as well as `loopback` -> anything."
  - A document's address space "is initialized from the IP address the document or worker was sourced from".
  - Requests from non-secure contexts are blocked; granted requests to known-local targets are exempted from mixed-content blocking (HTTP subresources only for private IP literals or `.local` names, or via `fetch(..., {targetAddressSpace})`).
  - WebSockets "should behave like other Fetch requests and trigger local network access prompts".
  — [WICG LNA explainer](https://github.com/WICG/local-network-access/blob/main/explainer.md) [primary] [Verified: https://github.com/WICG/local-network-access/blob/main/explainer.md]
- Chrome: permission prompt announced 2025-06-09. — [Chrome blog](https://developer.chrome.com/blog/local-network-access) [search summary, not verified]. Intent to ship for LNA. — [blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/cwu_RUmBpzY) [search summary, not verified]. Secondary sources say HTTP enforcement began in Chrome 142 (released 2025-10-28 per BCD) and WebSocket enforcement in Chrome 147 (2026-04-07); a WebSocket intent to ship was posted in February 2026. — [localtonet](https://localtonet.com/blog/chrome-local-network-access-apis-websockets); [blink-dev WebSockets intent](https://groups.google.com/a/chromium.org/g/Blink-dev/c/O6GMKt44Ups) [search summary, not verified]; release dates from [BCD chrome_android.json](https://github.com/mdn/browser-compat-data/blob/main/browsers/chrome_android.json) [primary]
  - BCD now records this directly: `fetch()`'s `targetAddressSpace` and the `local-network-access` permission from Chrome 142, LNA on WebSocket and on WebTransport from Chrome 147, and from Chrome 145 the permission split into `local-network` and `loopback-network` (the old name became an alias). Chrome Android mirrors Chrome; Android WebView has none of these. In Chromium 157.0.8103.81 `kLocalNetworkAccessChecks`, `…WebSockets` and `…WebTransport` are enabled by default and `kLocalNetworkAccessChecksWebRTC` is disabled. [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/WebSocket.json; https://github.com/mdn/browser-compat-data/blob/main/api/WebTransport.json; https://github.com/mdn/browser-compat-data/blob/main/api/_globals/fetch.json; https://github.com/mdn/browser-compat-data/blob/main/api/Permissions.json; https://github.com/chromium/chromium/blob/157.0.8103.81/services/network/public/cpp/features.cc]
- WebKit trunk has `LocalNetworkAccessEnabled` with `status: unstable`, `defaultValue: false`. — [WebKit UnifiedWebPreferences.yaml](https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml) [primary] [Verified: https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml]

**iOS Local Network privacy**
- TN3179: "Traffic originating from WKWebView, SFSafariViewController, and Safari doesn't require local network access." — [Apple TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy) [primary] [Verified: https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy]
- Chrome for iOS does prompt for local network access; Firefox for iOS needed the toggle re-enabled. — [Apple forum 788044](https://developer.apple.com/forums/thread/788044); [Mozilla support](https://support.mozilla.org/gl/questions/1546777) [search summary, not verified]

### Inferences
- **Feature set by tier** (synthesis of the cited secure-context data):

| Tier | Motion | Wake Lock | Coalesced touch samples | Web Crypto | WebRTC / WebSocket | Warnings |
|---|---|---|---|---|---|---|
| Trusted HTTPS (Plex-style name) | Yes | Yes | Yes | Yes | Yes / wss | None |
| Self-signed HTTPS on the IP, clicked through | ? (test) | ? | ? | ? | Yes / wss | One interstitial per phone |
| Plain `http://<ip>` | No | No | No (one sample per event) | No `subtle` or `randomUUID()`; `getRandomValues()` yes [Verified correction: https://github.com/mdn/browser-compat-data/blob/main/api/Crypto.json] | Yes / ws | None |

- The offline requirement and the Plex model conflict. With no internet the phone cannot resolve the vendor name (outside its cached TTL), and the certificate is tied to the name. A plain-HTTP fallback tier is therefore unavoidable.
- In that tier, touch remains fully usable, but with one sample per event instead of coalesced samples, and tilt is unavailable.
- LNA should not touch the recommended architecture. The phone loads the page from a private IP, which makes the document's address space local, and its WebSocket and WebRTC traffic to the same IP is local→local. This holds under the Plex model too: the name is public but the address it resolves to is private.
- Hosting the controller page on a public website and connecting to the LAN desktop would hit Chrome's LNA prompt, which can only be requested from secure contexts. Under the explainer's rules, http subresources would be limited to private IP literals or `.local` names. Safari would block it as mixed content. Avoid that architecture.
- For the desktop's own safety, Chrome's LNA adds friction for a malicious public page in the desktop user's browser. Safari lacks it. Firefox 153 and later recognise the `local-network` and `loopback-network` permissions, but BCD records no Firefox LNA enforcement for fetch or WebSocket. [Verified correction: https://github.com/mdn/browser-compat-data/blob/main/api/Permissions.json; https://github.com/mdn/browser-compat-data/blob/main/api/WebSocket.json] Either way, Origin and Host checks remain mandatory (section 5).
- Putting the vendor domain on the PSL makes each `<installId>.<vendor-domain>` its own registered domain for Let's Encrypt's 50-per-week limit.

### Gaps
- Whether a self-signed, clicked-through HTTPS page is a secure context with working motion permission on iOS Safari 27 and Chrome Android 157. This is the decisive test for an offline secure tier.
- The Chrome LNA rollout on Android, and whether WebRTC is gated in Chrome stable today [search summary, not verified]. Answered: Chrome Android mirrors desktop Chrome (fetch from 142, WebSocket and WebTransport from 147), and WebRTC is not gated (`kLocalNetworkAccessChecksWebRTC` is disabled by default in Chromium 157). [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/WebSocket.json; https://github.com/chromium/chromium/blob/157.0.8103.81/services/network/public/cpp/features.cc]
- New, from the fact-check: Android 17's own local network permission applies to browsers too, once they target SDK 37. Chrome 157 still targets SDK 36. Chromium main targets 37, declares `ACCESS_LOCAL_NETWORK` for that case, and requests it through its LNA site-permission flow ("Remove once targetSdkVersion 37 reaches Stable"). It is untested whether a local→local page load (which raises no LNA prompt) will then trigger the Android prompt or fail. [Verified: https://github.com/chromium/chromium/blob/157.0.8103.81/build/config/android/config.gni; https://github.com/chromium/chromium/blob/main/build/config/android/config.gni; https://github.com/chromium/chromium/blob/main/chrome/android/java/AndroidManifest.xml; https://github.com/chromium/chromium/blob/main/components/permissions/android/java/src/org/chromium/components/permissions/PermissionUtil.java; https://developer.android.com/privacy-and-security/local-network-permission]
- 2026–2029 certificate-lifetime reductions and Let's Encrypt short-lived and IP-address certificates were not researched. IP certificates would cover public IPs only (unverified).
- **Unverified**: sslip.io, nip.io, traefik.me and shared wildcard keys are not viable, because a published private key gets the certificate revoked.

---

## 3. Touch and motion handling on iOS Safari and Android Chrome

### Takeaway
Use Pointer Events (Safari 13+, Chrome 55+) on one full-screen surface with `touch-action: none` and non-passive touch listeners. Safari 26.5 fixed `preventDefault()` on `pointerdown` not stopping scroll when only passive touch listeners exist. Read `getCoalescedEvents()` (Chrome 58+, Safari 18.2+; secure context only) for full-rate samples. iOS exposes `Touch.force` and `Touch.radiusX/Y` (Safari iOS 10+), but current iPhones have no force hardware, so treat contact size as the "pressure" proxy. [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/PointerEvent.json; https://github.com/mdn/browser-compat-data/blob/main/api/Touch.json; https://developer.apple.com/documentation/safari-release-notes/safari-26_5-release-notes]

iPhone has no usable Fullscreen API. On iPad it shows an overlay button that cannot be disabled, and swiping down exits fullscreen. iOS has no orientation lock, and neither does Android WebView. Screen Wake Lock works in iOS Home Screen web apps from 18.4. [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/Element.json; https://github.com/mdn/browser-compat-data/blob/main/api/ScreenOrientation.json; https://github.com/mdn/browser-compat-data/blob/main/api/WakeLock.json] DeviceMotion runs at 60 Hz in both engines: Chromium's sensor pump uses `kDefaultPumpFrequencyHz = 60`, and WebKit on iOS sets `kMotionUpdateInterval = 1/60 s` for Core Motion and its update timer. The spec leaves the rate implementation-defined, so measure delivered rates on devices. [Verified correction: https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/device_orientation/device_sensor_event_pump.h; https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/ios/WebCoreMotionManager.h]

### Cited Findings
- `PointerEvent.pressure`: Chrome 55, Safari 13. `getCoalescedEvents()`: Chrome 58, Safari 18.2. `getPredictedEvents()`: Chrome 77, Safari 18.2 (iOS mirrors Safari). — [BCD api/PointerEvent.json](https://github.com/mdn/browser-compat-data/blob/main/api/PointerEvent.json) [primary] [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/PointerEvent.json]. Safari 18.2's coalesced events had a wrong `pointerId`/`target`, which Flutter worked around. — [Flutter commit](https://dart.googlesource.com/external/github.com/flutter/engine/+/23447c4674b0837ada66d29099147e05a695cec4) [search summary, not verified]. WebKit removed the coalesced/predicted feature flags in January 2026. — [WebKit bug 305840](https://bugs.webkit.org/show_bug.cgi?id=305840) [search summary, not verified] Consistent with current WebKit: no such flag remains in `UnifiedWebPreferences.yaml`, and `PointerEvent.idl` exposes `[SecureContext] getCoalescedEvents()` and an ungated `getPredictedEvents()`; the date and bug number stay unverified. [Verified: https://github.com/WebKit/WebKit/blob/main/Source/WebCore/dom/PointerEvent.idl]
- `Touch.force` and `Touch.radiusX` are supported in Safari iOS from 10 and in Chrome 38. — [BCD api/Touch.json](https://github.com/mdn/browser-compat-data/blob/main/api/Touch.json) [primary] [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/Touch.json]. Developers report `force` always 0 on non-3D-Touch iPhones. — [Meteor forum](https://forums.meteor.com/t/3d-touch-compatibility-on-ios/10618) [search summary, not verified]
- `navigator.maxTouchPoints`: Chrome 35, Safari 13. — [BCD api/Navigator.json](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json) [primary] [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json]. Reported iPhone limits conflict: 5 (iPad 11) — [iphone-ticker.de](https://www.iphone-ticker.de/multitouch-punkte-ipad-unterstutzt-11-iphone-nur-funf-10833/); 5 for both — [devpath500](https://devpath500.pages.dev/posts/2024-07-27-understanding-multi-touch-capabilities-in-modern-ios-devices); 10 on iPhone 11+ — [hardwaretest](https://hardwaretest.vercel.app/touchscreen-test/) [search summary, not verified]
- Safari fixes relevant to controllers:
  - 26.4: pointer events failing to dispatch after a parent gesture recognizer blocked `touchesEnded:`.
  - 26.5: "calling preventDefault() on pointerdown events did not prevent page scrolling when only passive touch event listeners are installed".
  - 27: "touch event properties values were sometimes swapped with neighboring values"; `preventDefault()` on `pointerdown` now suppresses `mousedown`/`mouseup` on iOS.
  — [26.4 notes](https://developer.apple.com/documentation/safari-release-notes/safari-26_4-release-notes); [26.5 notes](https://developer.apple.com/documentation/safari-release-notes/safari-26_5-release-notes); [27 notes](https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes) [primary] [Verified: https://developer.apple.com/documentation/safari-release-notes/safari-26_5-release-notes; https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes]
- `Element.requestFullscreen`: Safari iOS 16.4 is a partial implementation, "Only available on iPad, not on iPhone. Shows an overlay button which can not be disabled. Swiping down exits fullscreen mode, making it unsuitable for some use cases like games." (prefixed and partial since 12). Chrome 71 (Android mirrors). — [BCD api/Element.json](https://github.com/mdn/browser-compat-data/blob/main/api/Element.json) [primary]; screenfull 6.0.2: "Safari is supported on desktop and iPad, but not on iPhone." — [screenfull](https://www.npmjs.com/package/screenfull) [primary] [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/Element.json; https://registry.npmjs.org/screenfull]
- `screen.orientation.lock()`: Chrome Android 38; **Android WebView: not supported**; Safari not supported (iOS mirrors). — [BCD api/ScreenOrientation.json](https://github.com/mdn/browser-compat-data/blob/main/api/ScreenOrientation.json) [primary]. WebKit's `ScreenOrientationLockingAPIEnabled` is `status: testable`, `defaultValue: false`, and `FullscreenRequirementForScreenOrientationLockingEnabled` defaults to true. — [WebKit prefs](https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml) [primary] [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/ScreenOrientation.json; https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml]
- Screen Wake Lock: Safari iOS 18.4 has full support. 16.4–18.3 was partial: "Does not work in standalone Home Screen Web Apps" (WebKit bug 254545). — [BCD api/WakeLock.json](https://github.com/mdn/browser-compat-data/blob/main/api/WakeLock.json) [primary]. WebKit's `ScreenWakeLockAPIEnabled` is `stable`. — [WebKit prefs](https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml) [primary]. NoSleep.js (0.12.0) must be enabled within a user-input handler. — [npm](https://www.npmjs.com/package/nosleep.js) [primary] [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/WakeLock.json; https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml]
- Motion rates: Mozilla bugs record Chrome Android devicemotion at about 60 Hz (interval ≈ 16.6 ms). — [bug 1217942](https://bugzilla.mozilla.org/show_bug.cgi?id=1217942); [bug 1515780](https://bugzilla.mozilla.org/show_bug.cgi?id=1515780) [search summary, not verified]. Chromium's source confirms a 60 Hz pump (`kDefaultPumpFrequencyHz = 60`), also used for the reported `interval`. [Verified: https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/device_orientation/device_sensor_event_pump.h; https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/device_orientation/device_motion_event_pump.cc] In 2015 iOS delivered DeviceOrientation at 20 Hz. — [WebKit bug 145814](https://bugs.webkit.org/show_bug.cgi?id=145814) [search summary, not verified]. That figure is outdated: current WebKit on iOS requests Core Motion and accelerometer updates, and runs its update timer, at `kMotionUpdateInterval = 1.0f / 60.0f`, i.e. 60 Hz. [Verified correction: https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/ios/WebCoreMotionManager.h; https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/ios/WebCoreMotionManager.mm] The spec interval is implementation-defined, with a frequency cap under discussion. — [w3c/deviceorientation](https://github.com/w3c/deviceorientation/blob/main/index.bs) [primary]

### Inferences
- **Capability matrix** (cited data above; "?" = unverified):

| Capability | iPhone Safari / Home Screen app | iPad Safari | Android Chrome | Android WebView (in the Tactilume app) |
|---|---|---|---|---|
| Pointer Events, multi-touch | Yes; touch limit ? (5 reported) | Yes | Yes | Yes |
| `getCoalescedEvents` (HTTPS only) | 18.2+ | 18.2+ | Yes | Yes (secure `appassets` origin) |
| Pressure | Contact size only (radiusX/Y) | Apple Pencil | Device-dependent | Same as Chrome; native MotionEvent is better (section 8) |
| DeviceMotion | HTTPS plus `requestPermission()` from a tap; 60 Hz in WebKit source | Same | HTTPS, 60 Hz; `requestPermission()` also exists from Chrome 152 | HTTPS origin works (WebView mirrors Chrome 152+); native sensors up to 200 Hz (section 8) |
| Fullscreen | No | Partial (overlay, swipe-down exits) | Yes | Native immersive mode |
| Orientation lock | No | No | After fullscreen | Not via JS; native `setRequestedOrientation` |
| Wake Lock | Yes (Home Screen apps 18.4+) | Yes | Yes | Native `FLAG_KEEP_SCREEN_ON` |

- **Surface setup**:
  - `touch-action: none` and `overscroll-behavior: none`;
  - non-passive `touchstart`/`touchmove` listeners calling `preventDefault()` (needed on Safari before 26.5 even when using pointer events);
  - `setPointerCapture` per pointer;
  - `viewport-fit=cover` with safe-area insets;
  - dead zones of about 20–30 px at the edges and bottom, where iOS back-swipe, the home indicator and Android gesture navigation live.
- Send all coalesced samples per frame with their own timestamps, using the parent event's `pointerId` on Safari 18.2. In the plain-HTTP tier, design for one sample per event.
- Pressure: on iPhone and iPad touch, derive "intensity" from `width`/`height` (contact size) or speed. Use real pressure only for pen input or where values actually vary.

### Gaps
- An authoritative simultaneous-touch limit per iPhone and iPad model; test with `maxTouchPoints` and a 10-finger page. Web-visible touch sampling rates (120 Hz or more) are also unverified.
- The current iOS DeviceMotion rate (WebKit's source now asks for 60 Hz, so only the delivered rate on devices remains to measure [Verified: https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/ios/WebCoreMotionManager.h]); whether iOS remembers a granted motion permission across visits; whether Chrome's Generic Sensor API exceeds 60 Hz.
- **Unverified** (prior knowledge): iOS ignores `user-scalable=no`; `gesturestart` needs `preventDefault()`; iOS 26 opens Home Screen bookmarks as web apps by default; how iOS standalone mode treats manifest `orientation`.

---

## 4. Haptics and audio feedback from a phone web page

### Takeaway
`navigator.vibrate()` works in Chrome Android and Android WebView only after a user gesture (since Chrome 60). Safari has never supported it, and BCD still records no Safari support in November 2026. [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json] iOS web haptics exist only as the HTML switch's side effect, and per library evidence iOS 26.5 restricted them to real user taps on the switch. [Verified: https://registry.npmjs.org/ios-haptics/-/ios-haptics-3.1.1.tgz; https://github.com/tijnjh/ios-haptics/blob/main/README.md] Apple's Safari 26.5 notes do not mention the change, so this rests on library evidence only. So iOS web haptics can confirm button presses but cannot react to game events. Audio (Web Audio with `navigator.audioSession.type = "playback"` on iOS) and visuals carry feedback on both platforms. The native Android app gets full VibrationEffect control (section 8).

### Cited Findings
- BCD `Navigator.vibrate`:
  - Chrome Android 32, with notes "Beginning in Chrome 55, this is not supported in cross-origin iframes" and "Beginning in Chrome 60, this method requires a user gesture. Otherwise it returns `false`";
  - Android WebView 4.4.3, with the same notes;
  - Safari: not supported (iOS mirrors).
  — [BCD api/Navigator.json](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json) [primary] [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json]
- The W3C implementation report says WebKit never shipped vibrate and holds a formal "Oppose" position. — [W3C report](https://w3c.github.io/vibration/reports/implementation.html) [search summary, not verified]. A 2026 BCD issue claims it now works on iOS, but BCD data still says no. — [BCD issue #29166](https://github.com/mdn/browser-compat-data/issues/29166) [search summary, not verified]
- WebKit's `SwitchControlEnabled` ("HTML switch control") is `stable` and on by default on Cocoa platforms. — [WebKit prefs](https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml) [primary] [Verified: https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml]. Safari 27 adjusted the switch's native-appearance CSS behaviour. — [Safari 27 notes](https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes) [primary]. The switch haptic was introduced in iOS 18.0. — [WebKit bug 285120](https://bugs.webkit.org/show_bug.cgi?id=285120) [search summary, not verified]
- `ios-haptics` README history, from the npm tarballs:
  - v3.1.1 (2026-06-26): "only works on ios 17.4 to 26.4, as apple patched it in ios 26.5";
  - v3.2.0 (2026-09-22) and v3.3.0 (2026-10-25): a transparent `<label>` over the element "forwards the tap to the switch as a trusted click".
  — [ios-haptics](https://www.npmjs.com/package/ios-haptics) [primary]. The Safari 26.5 release notes don't mention it. — [26.5 notes](https://developer.apple.com/documentation/safari-release-notes/safari-26_5-release-notes) [primary] [Verified: https://registry.npmjs.org/ios-haptics; https://registry.npmjs.org/ios-haptics/-/ios-haptics-3.1.1.tgz; https://github.com/tijnjh/ios-haptics/blob/main/README.md; https://developer.apple.com/documentation/safari-release-notes/safari-26_5-release-notes]
- Audio Session API: BCD lists `AudioSession` and `AudioSession.type` from Safari 16.4 (experimental; no Chromium support). — [BCD api/AudioSession.json](https://github.com/mdn/browser-compat-data/blob/main/api/AudioSession.json) [primary] [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/AudioSession.json]. A WebKit engineer advises `navigator.audioSession.type = "playback"` (iOS 17+) so the silent switch doesn't mute Web Audio. — [WebKit bug 237322](https://lists.webkit.org/pipermail/webkit-unassigned/2024-September/1186593.html) [search summary, not verified]

### Inferences
- Android browser: short `navigator.vibrate(10–20)` pulses from within input handlers (user-gesture rule), rate-limited.
- iOS: the label-over-switch pattern only on real UI buttons. Never on the `preventDefault()`-ed canvas, and never for events the desktop originates.
- Everywhere: Web Audio cues (unlocked by the first tap) and local ripples under fingers.
- In the shared protocol, the desktop should send semantic "haptic cues". Each client then maps them to what it can do (section 9).

### Gaps
- Apple's own documentation of the iOS 26.5 haptics change; Web Audio output latency on phones; how `navigator.vibrate` in a WebView depends on the app's `VIBRATE` permission (unverified).

---

## 5. Pairing and security model

### Takeaway
Pair browser phones by QR code: the HTTPS URL plus a short-lived join token in the URL fragment, with a desktop join toast or approval (the Deskreen pattern) and an IP / `.local` + PIN fallback. `.local` resolves on iOS and on Android 12+, but not on older Android or on Knox-managed devices. [Unverified] On Android 17, resolving `.local` names from an app that targets SDK 37 also needs the local network permission. [Verified: https://developer.android.com/privacy-and-security/local-network-permission] The native app discovers via NsdManager instead (section 8), but mDNS is unauthenticated, so the app still needs a one-time pairing confirmation and should then pin the desktop's key.

On the desktop:
- bind to LAN interfaces only;
- check Origin and Host on every upgrade;
- rate-limit PINs;
- issue per-device resume tokens.

Client isolation, full-tunnel VPNs and cellular all make the LAN path impossible; detect them and explain.

### Cited Findings
- Deskreen: QR code plus IP, host allow/deny, and a `--local-ip` override for a wrong QR address. — [README](https://cdn.jsdelivr.net/gh/pavlobu/deskreen@master/README.md) [search summary, not verified]
- Android `.local`:
  - the Android resolver has supported mDNS `.local` since November 2021 — [Esper](https://blog.esper.io/android-dessert-bites-26-mdns-local-47912385); [AOSP commit](https://android.googlesource.com/platform/packages/modules/DnsResolver/+/ceb3c02582b565148db3ee0f595f6705543974d9);
  - it was not backported to Android 10/11 — [SO mirror](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/30449988/how-to-enable-mdns-support-in-android-browser-address-bar);
  - Chrome delegates `.local` to the OS — [chromium-discuss](https://groups.google.com/a/chromium.org/g/chromium-discuss/c/6b0vVreNTvQ);
  - it works on Android 14 (Pixel 6a) — [moOde forum](https://moodeaudio.org/forum/showthread.php?pid=49432);
  - Knox resolves `.local` via mDNS only — [Samsung Knox](https://docs.samsungknox.com/admin/knox-platform-for-enterprise/kbas/kba-665-devices-cant-reach-site-with-local-domain/).
  All [search summary, not verified].
- Client isolation blocks device-to-device traffic, typically on guest networks, and its behaviour varies by implementation. — [TP-Link](https://www.tp-link.com/us/blog/2586/); [Ruckus](https://dell.ruckuswireless.com/articles/000014743); [WatchGuard](https://www.watchguard.com/help/docs/help-center/en-US/Content/en-us/Fireware/wireless/ap_station_isolation_c.html); [How-To Geek](https://www.howtogeek.com/179089/lock-down-your-wi-fi-network-with-your-routers-wireless-isolation-option/); [Antamedia](https://explore.antamedia.com/explore/configure-wireless-client-isolation); [GL.iNet](https://forum.gl-inet.com/t/ap-isolation-for-guest-isnt-working/66700.md); [RaspAP](https://docs.raspap.com/features-insiders/ap-isolation/) [search summary, not verified]
- iOS VPN flags `includeAllNetworks` and `excludeLocalNetworks` decide whether LAN traffic bypasses the tunnel. — [Mullvad](https://mullvad.net/en/blog/2025/3/26/why-we-still-dont-use-includeallnetworks) [search summary, not verified]
- TN3179 exempts Safari and WKWebView from iOS local-network privacy. — [TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy) [primary] [Verified: https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy]
- The WICG LNA explainer treats `.local` names as the `local` address space. — [explainer](https://github.com/WICG/local-network-access/blob/main/explainer.md) [primary] [Verified: https://github.com/WICG/local-network-access/blob/main/explainer.md]

### Inferences
- **Threats and mitigations**:
  - (1) LAN intruders joining or injecting input → join token or PIN, a visible join toast, kick or approve.
  - (2) Cross-site WebSocket hijacking and DNS rebinding from malicious pages → Origin allowlist, Host check, token authentication before any input.
  - (3) PIN brute force → 6 digits, per-IP attempt limits, lockout, PIN expires with the lobby.
  - (4) Sniffing → TLS/DTLS where available; in the plain-HTTP tier, single-use short-lived tokens bound to the connection.
  - (5) Abuse of the desktop → input-only schema, size and rate caps, no privileged IPC, strict CSP, server listening only while "phone control" is on.
  - (6) Native app only: spoofed mDNS advertisements → the first connection must complete a short-authentication-string or code confirmation, and later connections must present the pinned desktop key.
- **Browser join flow**:
  1. QR code `https://<host>:<port>/#j=<128-bit token>`, valid about 5 minutes and multi-use while the lobby is open.
  2. Per-join toast, plus an optional "ask first" setting.
  3. The server issues a per-device resume token, stored in `localStorage`.
  4. Reconnect with jittered backoff (0.25–5 s) on close, on `visibilitychange`, or on the `online` event.
  5. The server holds the player slot for about 60 s.
  6. Re-acquire Wake Lock each time the page becomes visible.
- **Addressing**: advertise RFC 1918 or ULA addresses of physical interfaces, preferring the default-route interface and skipping virtual adapters (the reason Deskreen needs `--local-ip`). Put IPv4 in the QR code and avoid IPv6 link-local addresses.
- **Diagnosis**:
  - The page can't load → likely cellular, a guest or other SSID, or a VPN. Show the Wi-Fi name and a checklist on the desktop.
  - The page loads but realtime fails → firewall or WebRTC; fall back to the WebSocket.

### Gaps
- How the desktop app advertises its own `.local` name and DNS-SD service on Windows, macOS and Linux (desktop-OS topic). IPv6 literal and zone handling in browsers. How quickly sockets die on locked or backgrounded pages on iOS and Android. All not researched.

---

## 6. Timing: clock synchronisation, jitter buffers, timestamps, interpolation and prediction; message formats and send rates

### Takeaway
Use the game-industry stream-based clock-sync exchange (Zachary Booth Simpson's algorithm, as implemented in `timesync`) with minimum-RTT filtering. Stamp every sample at its source: the web `event.timeStamp`, or native `MotionEvent`/`SensorEvent` times in the app. Render through a small adaptive playout delay (p90–p95 lateness, clamped to about 0–25 ms) with interpolation and brief extrapolation. Use packed binary messages, about 8 bytes per touch sample, batched once per frame with ×2 redundancy. The byte layout should be identical across WebSocket, DataChannel, UDP and the WebView bridge (section 9).

### Cited Findings
- `timesync` 1.0.11: "Time synchronization between peers"; "a simple synchronization protocol aimed at the gaming industry"; quoting Simpson: "client subtracts current time from sent time and divides by two to compute latency. It subtracts current time from server time to determine client-server time delta and adds in the half-latency to get the correct clock delta. (So far this algorithm is very similar to SNTP)". Defaults: `repeat` 5, `delay` 1000 ms, `interval` 1 h. It is transport-agnostic and uses JSON-RPC messages. — [timesync](https://www.npmjs.com/package/timesync) [primary] Version 1.0.11 dates from 2022-09-05; licence MIT. [Verified: https://github.com/enmasseio/timesync/blob/master/README.md; https://registry.npmjs.org/timesync]
- Coalesced and predicted pointer samples are available in Chrome and Safari 18.2+ (predicted from Chrome 77). Only coalesced samples are secure-context-only: `getCoalescedEvents()` is `[SecureContext]` in both engines, while `getPredictedEvents()` is not, so the plain-HTTP tier keeps predicted samples for on-phone visuals. — [BCD PointerEvent](https://github.com/mdn/browser-compat-data/blob/main/api/PointerEvent.json); [MDN getCoalescedEvents (source)](https://github.com/mdn/content/blob/main/files/en-us/web/api/pointerevent/getcoalescedevents/index.md) [primary] [Verified correction: https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/events/pointer_event.idl; https://github.com/WebKit/WebKit/blob/main/Source/WebCore/dom/PointerEvent.idl; https://github.com/mdn/content/blob/main/files/en-us/web/api/pointerevent/getpredictedevents/index.md]
- Device-motion values are precision-limited to 0.1 units by spec, so 16-bit fixed-point fields lose nothing. — [w3c/deviceorientation](https://github.com/w3c/deviceorientation/blob/main/index.bs) [primary] [Verified: https://github.com/w3c/deviceorientation/blob/main/index.bs]
- Wi-Fi power save adds delays in multiples of the beacon interval (heavy-tailed jitter). — [USPTO 9210656](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9210656) [search summary, not verified]

### Inferences
- **Clock sync**: every 2–5 s, over the reliable channel, send `{t0}` and receive `{t0, ts}`. Compute `rtt = now − t0` and `offset = ts + rtt/2 − now`. Keep the median offset of the lowest-RTT samples in a window of 8–16. That is faster than `timesync`'s hourly default, to track drift and Wi-Fi changes.
- **Example packet layout** (little-endian; identical bytes on every transport):
  - Header, 8 bytes: u8 protocol version, u8 message type, u16 seq, u32 source time in 0.1 ms units.
  - Touch sample, 8 bytes: u8 pointer slot, u8 phase/flags (including a tool-type bit for finger or stylus), u16 x and u16 y normalised to 0–65535, u8 pressure or intensity, u8 dt in 0.5 ms units.
  - Motion, 12 bytes: i16 × 3 acceleration in milli-g and i16 × 3 rotation rate in 0.1 °/s, or i16 × 4 for a quaternion.
  - Ten fingers plus motion with ×2 redundancy is about 180 bytes per packet. At 120 Hz that is ≈ 22 KB/s per phone; ten phones need under 3 Mbit/s. JSON would be 4–6 times larger and costlier to parse.
- **Desktop playout**: track lateness per phone. Set the delay D to p90–p95 lateness (fast to rise, slow to fall, 0–25 ms). Sample each finger at T − D with linear or Catmull-Rom interpolation, and extrapolate for at most about 1.5 frames before holding. Offer a "snappy ↔ smooth" setting.
- Use predicted events for on-phone visuals only. The network stream carries measured samples.
- Run the desktop network endpoint off the Electron main thread, in a utility process, and hand decoded samples to the renderer over a `MessagePort`.

### Gaps
- No measured phone jitter distributions were found. Canonical references (Gaffer On Games on snapshot interpolation, Valve's Source networking article, the One Euro filter paper) were not fetched. It is unverified whether Safari's coalesced events carry their own timestamps.

---

## 7. Sending a preview back to the phone (low-resolution video of the desktop output)

### Takeaway
Feasible and now better supported. Electron can send `canvas.captureStream()` as a WebRTC video track. LAN glass-to-glass latency of about 30–90 ms is reported [search summary, not verified]. **Safari 27 (Sept 2026) added `RTCRtpReceiver.jitterBufferTarget` and `targetLatency`**, so playout delay can now be tuned on iPhones as well as Chrome and Firefox. [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/RTCRtpReceiver.json; https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes] Keep the preview optional and low resolution; its cost on the desktop is about one encode per receiving phone.

### Cited Findings
- `RTCRtpReceiver.jitterBufferTarget`: Chrome 124 (Android and WebView mirror), Safari 27 (iOS mirrors). — [BCD api/RTCRtpReceiver.json](https://github.com/mdn/browser-compat-data/blob/main/api/RTCRtpReceiver.json) [primary]. Safari 27 release notes: "Added support for the `targetLatency` attribute in WebRTC" and "Added support for `RTCRtpReceiver.jitterBufferTarget`". Safari 27 shipped on 2026-09-14. — [Safari 27 notes](https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes); [BCD safari_ios.json](https://github.com/mdn/browser-compat-data/blob/main/browsers/safari_ios.json) [primary] [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/RTCRtpReceiver.json; https://github.com/mdn/browser-compat-data/blob/main/browsers/safari_ios.json; https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes]. Firefox has it from 115. *(This corrects an earlier search summary that said Safari lacked it.)*
- About 40 ms WebRTC (WHEP) glass-to-glass on a LAN in a 2026 benchmark, rising to 87 ms with 40 ms added each way. — [ComputingForGeeks](https://computingforgeeks.com/?p=180693) [search summary, not verified; attribution uncertain]. Reports of 30–40 ms on wired LAN. — [W3C public-webrtc 2018](https://lists.w3.org/Archives/Public/public-webrtc/2018Jun/0207.html) [search summary, not verified]. In a robotics case, WebRTC's own jitter buffer was about 10 ms and the camera path about 100 ms. — [Open Robotics](https://discourse.openrobotics.org/t/where-does-latency-in-webrtc-video-streaming-come-from-an-analysis/54566) [search summary, not verified]
- Deskreen ships the Electron + WebRTC + browser-viewer pattern. — [README](https://cdn.jsdelivr.net/gh/pavlobu/deskreen@master/README.md) [search summary, not verified]
- WebCodecs is secure-context-only, so it is not available in the plain-HTTP tier. — [MDN list (source)](https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/secure_contexts/features_restricted_to_secure_contexts/index.md) [primary] [Verified: https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/secure_contexts/features_restricted_to_secure_contexts/index.md]

### Inferences
- **Option A, WebRTC video** (HTTPS or HTTP tier, since WebRTC is not secure-context-gated): 640×360 at 24–30 fps, `contentHint='motion'`, H.264 for iPhone hardware decode, 0.5–1.5 Mbit/s, `jitterBufferTarget` low where supported. It needs a media-capable WebRTC endpoint: Chromium in the renderer, or a native sender.
- **Option B, JPEG or WebP frames** at 10–15 fps over the reliable channel: simplest, and works over every transport, including Kotlin sockets for the app.
- **Option C, state mirror**: send a tiny summary and draw a stylised preview on the phone.
- A preview 60–100 ms late is acceptable for a controller, since the main feedback is the big screen.

### Gaps
- Canvas-`captureStream` latency and CPU/GPU cost in Electron; per-OS hardware encoders; whether `node-datachannel` media support suits a Node-side sender. None researched.

---

## 8. Native route: the user's own Tactilume Android app (Kotlin, compileSdk/targetSdk 37, minSdk 26; WebView page from `https://appassets.androidplatform.net` via WebViewAssetLoader; WebMessageListener bridge)

### Takeaway
On Android, the native app removes most browser compromises.

1. **Discovery without QR codes** via NsdManager. Under targetSdk 37 (Android 17), local-network access is restricted: the app either holds the new **runtime permission `ACCESS_LOCAL_NETWORK`** (API 37, Nearby devices group) or uses NsdManager's **system picker** (`DiscoveryRequest.FLAG_SHOW_PICKER`). The picker grants access to the chosen service without the broad permission, and the grant persists across reboots. A **Wi-Fi MulticastLock** is needed only on devices below Tiramisu (T) mainline extension 7 (Android 8–12 and unpatched 13), which minSdk 26 includes. [Verified: https://dl.google.com/android/repository/source-37.2_r01.zip; https://dl.google.com/android/repository/platform-37.2_r02.zip] Android's own documentation settles the enforcement question: for apps targeting API 37 the local network "is blocked by default", and "enforcement is mandatory". Without the permission or a picker grant, outgoing and incoming TCP, UDP send and receive, and `.local` resolution all fail. TCP typically times out and UDP returns `EPERM`. Connections to addresses obtained through the picker need no permission. [Verified: https://developer.android.com/privacy-and-security/local-network-permission; https://developer.android.com/about/versions/17/behavior-changes-17]
2. **Networking belongs in Kotlin, not in the page.** The `https://appassets.androidplatform.net` origin is a secure context, which is good for coalesced pointer events and DeviceMotion. But `ws://` from it is blocked mixed content (WebView defaults to `MIXED_CONTENT_NEVER_ALLOW`) and also blocked cleartext (WebView honors cleartext policy for targetSdk ≥ 26, and WebSockets count as cleartext). Kotlin can instead use **TLS pinned to the paired desktop's self-signed key**, which works offline with no public CA, plus **raw UDP datagrams** for the realtime stream. Raw sockets are outside cleartext policy. [Verified: https://dl.google.com/android/repository/source-37.2_r01.zip] They are not outside Android 17's local network permission, which sits below every networking API. [Verified: https://developer.android.com/privacy-and-security/local-network-permission]
3. **Native sensors** (`SensorManager`, up to 200 Hz without `HIGH_SAMPLING_RATE_SENSORS`; `TYPE_GAME_ROTATION_VECTOR`) beat WebView DeviceMotion. [Verified: https://dl.google.com/android/repository/source-37.2_r01.zip; https://dl.google.com/android/repository/platform-37.2_r02.zip]
4. **Native haptics** (VibrationEffect predefined effects, composition primitives, amplitude control, envelopes) can be triggered by desktop events.
5. **Native window control**: orientation lock (impossible from WebView JS), immersive mode, keep-screen-on, and gesture-exclusion edges.

The same binary protocol serves both routes (section 9).

### Cited Findings
**NsdManager discovery and the multicast lock** (Android SDK 37.2 sources, `android/net/nsd/NsdManager.java`, `DiscoveryRequest.java`, `android/net/wifi/WifiManager.java`)
- `registerServiceInfoCallback(DiscoveryRequest, Executor, ServiceInfoCallback)` is available "starting from 'T extensions 22' (which covers all Android 14+ devices)". It "combines discovery and resolution into a single operation" and reports when services are found, when their IPs or TXT records change, and when they become unavailable. Older devices use `discoverServices` plus `registerServiceInfoCallback(NsdServiceInfo, …)` or `resolveService`. — [Android SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip) (`android/net/nsd/NsdManager.java`) [primary]
- Multicast lock: "Performing mDNS operations on Wi-Fi requires the device to receive multicast packets."
  - "Before T extensions 7 (Android 12 and below devices, and Android 13 devices that have not received the T extensions 7 update): Apps must manually acquire a `WifiManager.MulticastLock` to receive mDNS packets, even when the app is in the foreground."
  - "Starting from T extensions 7: The system automatically manages multicast reception for apps in the foreground. Background apps should still avoid taking the lock unless absolutely necessary to minimize battery impact."
  - The official legacy sample acquires the lock only when `SdkExtensions.getExtensionVersion(TIRAMISU) < 7` and releases it in `finally`.
  — [SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip) (`NsdManager.java`) [primary]
- `MulticastLock` javadoc: "Normally the Wifi stack filters out packets not explicitly addressed to this device. Acquring a MulticastLock will cause the stack to receive packets addressed to multicast addresses. Processing these extra packets can cause a noticeable battery drain and should be disabled when not needed." — [SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip) (`WifiManager.java`) [primary]
- Apps targeting Android 14+ use "a platform-integrated mDNS implementation as backend"; older targets use the legacy daemon (`ENABLE_PLATFORM_MDNS_BACKEND`). — [SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip) (`android/net/connectivity/ConnectivityCompatChanges.java`) [primary]
- API levels from `api-versions.xml` (`platform-37.2_r02.zip`):
  - `DiscoveryRequest` class: API 35 (T-extension 12 on 33–34).
  - `registerServiceInfoCallback(NsdServiceInfo…)`: API 34 (T-ext 7).
  - `resolveService`: deprecated in 34.
  - `NsdServiceInfo.getHostAddresses()`: API 34 (T-ext 7).
  - `FLAG_SHOW_PICKER`, `FLAG_NO_PICKER`, `FLAG_USER_APPROVED_ONLY`, `checkPermissionForService`, `FAILURE_PERMISSION_DENIED` and `registerServiceInfoCallback(DiscoveryRequest…)`: API 37.0, or T-ext 22 on API 33–37.
  - `Manifest.permission.CHANGE_WIFI_MULTICAST_STATE`: API 4.
  — [SDK platform 37.2](https://dl.google.com/android/repository/platform-37.2_r02.zip) (`data/api-versions.xml`) [primary]

**Android 17 local network permission** (targetSdk 37)
- NsdManager class documentation, section "Local network permission (Android 17+)": "Starting with API 37, access to the local network is restricted. Applications targeting API 37 or higher generally require the `ACCESS_LOCAL_NETWORK` permission to communicate with local devices. However, `NsdManager` provides a way to gain access to specific services without this broad permission". The steps:
  1. discover with `FLAG_SHOW_PICKER`, which "triggers a system-provided UI";
  2. once the user selects a service, "the app is granted permission to communicate with that specific device through `NsdServiceInfo#getHostAddresses()` on `NsdServiceInfo#getNetwork()`… This grant persists across reboots";
  3. if the network reconnects or the addresses change, re-resolve with `registerServiceInfoCallback`, and "Apps should avoid storing service IP addresses";
  4. `checkPermissionForService` verifies access;
  5. `FLAG_USER_APPROVED_ONLY` rediscovers approved services without UI.
  — [SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip) (`NsdManager.java`) [primary]
- Advertising a service from the phone: "Note this always requires the ACCESS_LOCAL_NETWORK permission." — same source [primary]
- `DiscoveryRequest` flags:
  - `FLAG_SHOW_PICKER`: `onServiceFound` is called at most once, and "`ACCESS_LOCAL_NETWORK` permission is *not* necessary when discovering with this flag".
  - `FLAG_NO_PICKER`, without the permission and without `FLAG_USER_APPROVED_ONLY`, fails with `FAILURE_PERMISSION_DENIED` from targetSdk CINNAMON_BUN.
  - With neither flag, "the picker will be shown if the app does not have `ACCESS_LOCAL_NETWORK` permission".
  — [SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip) (`DiscoveryRequest.java`) [primary]
- `ConnectivityCompatChanges.USE_NSD_PICKER_WHEN_NO_LOCAL_NET_PERMISSION` (enabled after BAKLAVA, i.e. targetSdk ≥ 37): "Apps targeting B- typically get the permission granted by default, as it is a targetSdk-gated split-permission from `INTERNET`. However, the permission may still be revoked manually by the user (with a warning in Settings that the app may break), and the permission will also be revoked if the app requests it in its manifest regardless of targetSdk." — [SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip) (`ConnectivityCompatChanges.java`) [primary]
- `RESTRICT_LOCAL_NETWORK` (change ID 365139289): "Restrict local network access. Apps targeting a release after V will require permissions to access the local network. ToDo: Update the target SDK version once it's finalized." It is annotated **`@Disabled`** in the 37.2 sources. — same file [primary]
- `AppOpsManager`: `OP_ACCESS_LOCAL_NETWORK` ("Access local network devices", `android:access_local_network`) sits in `RUNTIME_PERMISSION_OPS` under "// Nearby devices", behind `Flags.accessLocalNetworkPermissionEnabled()`. `Manifest.permission.ACCESS_LOCAL_NETWORK` is API 37.0; the `NEARBY_DEVICES` group is API 31. — [SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip) (`android/app/AppOpsManager.java`); [api-versions.xml](https://dl.google.com/android/repository/platform-37.2_r02.zip) [primary]
- Already scheduled for targets after 37:
  - `ENFORCE_LOOPBACK_RESTRICTIONS`: apps "will require `USE_LOOPBACK_INTERFACE` to use the loopback interface to communicate with other apps. Loopback usage to communicate within the same app is not restricted."
  - `NETWORK_BLOCKED_WITHOUT_INTERNET_PERMISSION` applies to targets ≥ 38.
  — [SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip) (`ConnectivityCompatChanges.java`) [primary]

**WebView networking: mixed content and cleartext**
- `WebViewAssetLoader.DEFAULT_DOMAIN = "appassets.androidplatform.net"`; assets are hosted under `http(s)://appassets.androidplatform.net/assets/…`. — [androidx.webkit 1.19.0-alpha01 sources](https://dl.google.com/android/maven2/androidx/webkit/webkit/1.19.0-alpha01/webkit-1.19.0-alpha01-sources.jar) (`WebViewAssetLoader.java`) [primary]
- `WebSettings.setMixedContentMode` (API 21): "apps that target `KITKAT` or below default to `MIXED_CONTENT_ALWAYS_ALLOW`. Apps targeting `LOLLIPOP` default to `MIXED_CONTENT_NEVER_ALLOW`… use of `MIXED_CONTENT_ALWAYS_ALLOW` is strongly discouraged". `MIXED_CONTENT_COMPATIBILITY_MODE`: "Some insecure content may be allowed… The types of content are allowed or blocked may change release to release and are not explicitly defined." — [SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip) (`android/webkit/WebSettings.java`) [primary]
- `NetworkSecurityPolicy.isCleartextTrafficPermitted()`:
  - "cleartext network traffic (e.g. HTTP, FTP, WebSockets, XMPP, IMAP, SMTP -- without TLS or STARTTLS)";
  - platform components "will refuse this process's requests to use cleartext traffic. Third-party libraries are strongly encouraged to honor this setting";
  - "there's no expectation that the `java.net.Socket` API will honor this flag";
  - "`WebView` honors this flag for applications targeting API level 26 and up."
  — [SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip) (`android/security/NetworkSecurityPolicy.java`) [primary]
- Browsers block non-media mixed content, and upgradable requests to IP-address hosts. — [MDN Mixed content (source)](https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/mixed_content/index.md) [primary]

**WebMessageListener bridge**
- `WebViewCompat.addWebMessageListener(webView, jsObjectName, allowedOriginRules, listener)` "will inject the JavaScript object in any frame whose origin matches `allowedOriginRules` for every navigation after this call, and the JavaScript object will be available immediately when the page begins to load".
  - Rules take the form `SCHEME "://" [HOSTNAME_PATTERN [":" PORT]]`.
  - `onPostMessage` receives `(view, message, sourceOrigin, isMainFrame, replyProxy)`.
  - Binary messages need `WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER` (`WebMessageCompat.TYPE_ARRAY_BUFFER`; `JavaScriptReplyProxy.postMessage(byte[])`).
  — [androidx.webkit 1.19.0-alpha01 sources](https://dl.google.com/android/maven2/androidx/webkit/webkit/1.19.0-alpha01/webkit-1.19.0-alpha01-sources.jar) (`WebViewCompat.java`, `WebMessageCompat.java`, `JavaScriptReplyProxy.java`) [primary]

**Sensors: native versus WebView**
- `SensorManager`: "In order to access sensor data at high sampling rates (i.e. greater than 200 Hz for `SensorEventListener` and greater than `SensorDirectChannel#RATE_NORMAL` for `SensorDirectChannel`), apps must declare the `HIGH_SAMPLING_RATE_SENSORS` permission".
  - `Sensor.getMinDelay()` is "capped at 5000 microseconds (200 Hz)" without that permission.
  - Delay constants: `SENSOR_DELAY_FASTEST`=0, `GAME`=1, `UI`=2, `NORMAL`=3.
  - Direct channel: `RATE_NORMAL` ≈ 50 Hz, `RATE_FAST` ≈ 200 Hz ("expected to be between 55% to 220% of nominal rate, thus between 110Hz to 440Hz"), plus `RATE_VERY_FAST` ≈ 800 Hz.
  — [SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip) (`SensorManager.java`, `Sensor.java`, `SensorDirectChannel.java`) [primary]
- API levels: `HIGH_SAMPLING_RATE_SENSORS` 31; `TYPE_GAME_ROTATION_VECTOR` 18; `TYPE_ROTATION_VECTOR` and `TYPE_LINEAR_ACCELERATION` 9; `SensorDirectChannel` 26. — [api-versions.xml](https://dl.google.com/android/repository/platform-37.2_r02.zip) [primary]
- WebView DeviceMotion mirrors Chrome Android in BCD. Chromium has no `requestPermission()`. The spec limits precision to 0.1 units and leaves the rate implementation-defined, about 60 Hz in Chromium [search summary, not verified]. — [BCD DeviceMotionEvent](https://github.com/mdn/browser-compat-data/blob/main/api/DeviceMotionEvent.json); [w3c/deviceorientation](https://github.com/w3c/deviceorientation/blob/main/index.bs) [primary]
- `screen.orientation.lock()` is not supported in Android WebView. — [BCD ScreenOrientation](https://github.com/mdn/browser-compat-data/blob/main/api/ScreenOrientation.json) [primary]

**Native touch and window control**
- `MotionEvent.getPressure(int)` and `getHistoricalX(int,int)`: API 5; `TOOL_TYPE_STYLUS`: API 14. — [api-versions.xml](https://dl.google.com/android/repository/platform-37.2_r02.zip) [primary]
- `View.setSystemGestureExclusionRects` (API 29): "the system will put a limit of `200dp` on the vertical extent of the exclusions it takes into account. The limit does not apply while the navigation bar is… stickily hidden". `WindowInsetsController`: API 30. `FLAG_KEEP_SCREEN_ON`, `View.setKeepScreenOn` and `Activity.setRequestedOrientation`: API 1. — [SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip) (`View.java`); [api-versions.xml](https://dl.google.com/android/repository/platform-37.2_r02.zip) [primary]

**Haptics**
- `Vibrator.vibrate(VibrationEffect…)` is `@RequiresPermission(android.Manifest.permission.VIBRATE)`, and "The app should be in the foreground for the vibration to happen." — [SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip) (`android/os/Vibrator.java`) [primary]
- API levels:
  - API 26: `VibrationEffect.createOneShot`, `createWaveform` (with amplitudes) and `Vibrator.hasAmplitudeControl`.
  - API 29: `createPredefined` with `EFFECT_CLICK`, `EFFECT_TICK`, `EFFECT_HEAVY_CLICK`.
  - API 30: `startComposition`, `PRIMITIVE_CLICK` and `PRIMITIVE_TICK`, `Vibrator.areAllPrimitivesSupported`, `VibrationAttributes`, and `HapticFeedbackConstants.CONFIRM`/`REJECT`/`GESTURE_START`.
  - API 31: `PRIMITIVE_LOW_TICK` and `PRIMITIVE_THUD`, and `VibratorManager`.
  - API 33: `vibrate(VibrationEffect, VibrationAttributes)`.
  - API 34: `HapticFeedbackConstants.SEGMENT_TICK`, `SEGMENT_FREQUENT_TICK`, `DRAG_START`, `TOGGLE_ON`.
  - API 36: `VibrationEffect.BasicEnvelopeBuilder` and `Vibrator.areEnvelopeEffectsSupported`.
  - API 36.1: `View.performHapticFeedback(HapticFeedbackRequest)`.
  — [api-versions.xml](https://dl.google.com/android/repository/platform-37.2_r02.zip) [primary]
- Primitive semantics: `PRIMITIVE_CLICK` gives "a sharp, crisp click sensation"; `PRIMITIVE_TICK` and `PRIMITIVE_LOW_TICK` are "intended to be used repetitively for dynamic feedback"; others are `SPIN`, `QUICK_RISE`, `SLOW_RISE`, `QUICK_FALL`. — [SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip) (`VibrationEffect.java`) [primary]
- In-page `navigator.vibrate` works in WebView from 4.4.3, with the Chrome 60 user-gesture rule. — [BCD Navigator](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json) [primary]

### Inferences
**Discovery**

The desktop advertises a DNS-SD service, e.g. `_tactilume._tcp` on its control port, with TXT records for protocol version, a desktop ID, the UDP port, and a short key fingerprint for display only.

On the phone:
- **Android 14+ (T-ext ≥ 22)**:
  1. First run: `registerServiceInfoCallback(DiscoveryRequest(type).setFlags(FLAG_SHOW_PICKER))`. The user taps "Tactilume on <PC name>" in the system picker, and the per-service grant persists.
  2. Later launches: `FLAG_USER_APPROVED_ONLY`, giving a silent reconnect.
  3. Re-resolve addresses on every connect rather than caching IPs, as the docs require.
  4. Open sockets on `serviceInfo.network`, e.g. via `Network.socketFactory` or `bindSocket` (inference from "communicate… on `NsdServiceInfo#getNetwork()`").
- **Custom in-app list of all desktops instead**: declare `ACCESS_LOCAL_NETWORK` and request it at runtime with a rationale, handling `FAILURE_PERMISSION_DENIED`.
- **API 26–33 devices without T-ext 22**: `discoverServices` plus `resolveService` (or `registerServiceInfoCallback(NsdServiceInfo)` from T-ext 7). Take a MulticastLock only while discovering and only when T-ext < 7, then release it. Keep a typed-IP and QR fallback for networks that block multicast.

**Pairing on top of discovery**

mDNS proves nothing about identity. On first contact:
1. Run TLS to the desktop's self-signed certificate.
2. Both screens show a 6-digit code derived from the TLS key fingerprints and nonces; the user confirms, or the phone scans the desktop's QR code once.
3. The app pins the desktop public key and stores a device token.
4. Later connections are silent.

**Transport in the app (recommended)**
- **Control channel**: Kotlin TLS over TCP (or a WebSocket over TLS) with a custom trust manager that accepts only the pinned key. This works offline, needs no public CA, and never touches cleartext policy.
- **Realtime channel**: `DatagramSocket` UDP carrying the same binary packets as the browser DataChannel, authenticated with an HMAC or AEAD keyed from the TLS session, with the sequence number giving replay protection. Raw sockets are outside cleartext policy, and UDP gives drop-not-stall semantics without WebRTC.
- Keep `cleartextTrafficPermitted="false"` in network_security_config. Avoid `MIXED_CONTENT_ALWAYS_ALLOW` and loading the page over `http://appassets…`: the first weakens the whole app, and the second loses secure-context APIs such as DeviceMotion and getCoalescedEvents.

**Input path options**
- **(a) Shared web input**: the page uses the same Pointer Events code as the browser controller and posts binary ArrayBuffers via WebMessageListener (feature-check `WEB_MESSAGE_ARRAY_BUFFER`, restrict `allowedOriginRules` to `https://appassets.androidplatform.net`). Kotlin forwards them over UDP.
- **(b) Native input**: intercept `MotionEvent`s around the WebView (all pointers, historical samples, `getPressure`, `TOOL_TYPE_STYLUS` for the Moto G Stylus's pen), send them directly, and mirror visuals to the page.
- Recommendation: (a) first for code sharing; move to (b) if bridge latency or WebView input coalescing measures badly.

**Sensors**

`TYPE_GAME_ROTATION_VECTOR`, which uses no magnetometer and so suits steering, plus the gyroscope, at a requested period of 10,000 µs (100 Hz). Stay ≤ 200 Hz so `HIGH_SAMPLING_RATE_SENSORS` isn't needed. Timestamp from the event and batch into each frame's packet.

**Haptics**

The desktop sends semantic cues (tick, click or thud, with intensity 0–1); Kotlin maps them by capability:
1. Composition primitives `TICK`/`LOW_TICK`/`CLICK`/`THUD`, checked with `areAllPrimitivesSupported` (API 30/31+);
2. else `createPredefined(EFFECT_TICK/CLICK)` (API 29+);
3. else `createOneShot(10–20 ms, amplitude)` when `hasAmplitudeControl` (API 26+).

Rate-limit to about 30 per second. Use `VibrationAttributes` (API 33 overload) with touch usage so the user's touch-feedback setting applies (assumed behaviour; see Gaps). Use `performHapticFeedback(CONFIRM/REJECT/SEGMENT_TICK…)` for UI confirmations.

**Window**
- Lock orientation natively, use immersive mode via `WindowInsetsControllerCompat` with transient bars, and set keep-screen-on while a session is active.
- Add left and right gesture-exclusion rects (≤ 200 dp tall unless the navigation bar is stickily hidden), and disable WebView overscroll.

**Manifest for targetSdk 37**

| Entry | When |
|---|---|
| `INTERNET` | Always |
| `ACCESS_LOCAL_NETWORK` | Only if using a custom discovery list instead of the picker; runtime request |
| `CHANGE_WIFI_MULTICAST_STATE` | Legacy multicast lock on devices below T-ext 7 |
| `VIBRATE` | Always |
| `HIGH_SAMPLING_RATE_SENSORS` | Not needed |

Plan for a user revoking `ACCESS_LOCAL_NETWORK` in Settings: catch the failure and fall back to the picker.

### Gaps
- **Moto G Stylus (2026)**: Android version and update policy, T-extension level, touch sampling rate and `maxTouchPoints`, whether the pen reports pressure or only `TOOL_TYPE_STYLUS`, the haptic actuator and supported primitives. Not verified (search budget). Measure on the device:
  - `Build.VERSION.SDK_INT` and `SdkExtensions.getExtensionVersion(TIRAMISU)`;
  - `vibrator.areAllPrimitivesSupported(...)` and `hasAmplitudeControl()`;
  - `InputDevice` motion ranges for pressure;
  - `Sensor.getMinDelay()`.
- **Enforcement on shipping Android 17**: does Android 17 block plain socket traffic to the LAN for targetSdk-37 apps lacking `ACCESS_LOCAL_NETWORK`? The NsdManager docs say such apps "generally require" it, while `RESTRICT_LOCAL_NETWORK` is still `@Disabled` in the 37.2 sources. Test with the compat override; the exact `adb shell am compat enable RESTRICT_LOCAL_NETWORK <pkg>` usage is unverified.
- **Scope of the picker grant**: does it cover UDP to other ports on the same host, or only the advertised service? The docs say "communicate with that specific device", which suggests host-level. Verify.
- **WebView and LNA**: whether Android WebView enforces Chromium LNA, and which address space it assigns to a page intercepted by WebViewAssetLoader. Unverified. If it is "public", page-initiated LAN requests could be blocked, which is another reason to network in Kotlin.
- Bridge latency (renderer → app process IPC) was not measured.
- **Unverified** (prior knowledge; Maven Central rate-limited the source check):
  - OkHttp enforces cleartext policy for `ws://`;
  - Android 9+ disables cleartext by default;
  - network_security_config domain rules can't express IP ranges;
  - `MulticastLock.acquire()` needs `CHANGE_WIFI_MULTICAST_STATE`;
  - `VibrationAttributes` touch usage respects the touch-feedback setting;
  - which AEAD ciphers `javax.crypto` offers at API 26.

---

## 9. Recommended design for Tactilume Desktop: two client routes, one protocol

### Takeaway
1. **Desktop host**: the desktop app hosts one "link service". It serves the browser controller page (trusted HTTPS via a Plex-style per-install name when online; a labelled touch-only plain-HTTP tier offline) and accepts four transports:
   - (a) WebSocket for browser control, signaling and fallback;
   - (b) WebRTC DataChannel, unordered and zero-retransmit, for the browser realtime stream (`node-datachannel`);
   - (c) TLS over TCP with a pinned self-signed key for the Android app's control channel;
   - (d) UDP for the Android app's realtime stream.
2. **Browser phones** (iPhone and any other phone) pair by QR code with a token in the URL fragment, or PIN.
3. **The Tactilume Android app** discovers via NsdManager (system picker under targetSdk 37), confirms a one-time pairing code, then pins the desktop key.
4. **One protocol for every path**: the same binary messages, capability negotiation, clock sync, jitter buffer and semantic haptic cues, so the desktop treats every phone alike once the transport layer is past.

### Cited Findings
- LNA leaves local→local traffic alone, and a document's address space comes from the IP it was loaded from. — [WICG explainer](https://github.com/WICG/local-network-access/blob/main/explainer.md) [primary]
- Safari and WKWebView are exempt from iOS local-network privacy. — [TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy) [primary]
- Feature gating on secure contexts (motion, wake lock, coalesced events, Web Crypto, WebTransport). — [MDN list (source)](https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/secure_contexts/features_restricted_to_secure_contexts/index.md) [primary]
- WebRTC is not gated. — [MDN RTCPeerConnection (source)](https://github.com/mdn/content/blob/main/files/en-us/web/api/rtcpeerconnection/index.md) [primary]
- Desktop building blocks: `ws` 8.22.2 (Nagle off), `node-datachannel` 0.33.6 (Electron, built-in WebSocket), and the stopgap `@fails-components/webtransport`. — [ws](https://www.npmjs.com/package/ws); [node-datachannel](https://www.npmjs.com/package/node-datachannel); [@fails-components/webtransport](https://www.npmjs.com/package/@fails-components/webtransport) [primary]
- Android 17 NSD picker and `ACCESS_LOCAL_NETWORK`; the multicast lock below T-ext 7; WebView mixed-content and cleartext defaults; WebMessageListener ArrayBuffer support. — [SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip); [androidx.webkit 1.19.0-alpha01 sources](https://dl.google.com/android/maven2/androidx/webkit/webkit/1.19.0-alpha01/webkit-1.19.0-alpha01-sources.jar) [primary]
- The Plex model and its DNS-filtering failure mode. — [Valsorda](https://words.filippo.io/how-plex-is-doing-https-for-all-its-users/) [search summary, not verified]; [WICG explainer](https://github.com/WICG/local-network-access/blob/main/explainer.md) [primary]. Let's Encrypt's per-registered-domain limit. — [LE](https://letsencrypt.org/docs/rate-limits/) [search summary, not verified]
- AirConsole uses WebRTC when available. — [AirConsole FAQ](https://developers2.airconsole.com/faq-help) [search summary, not verified]

### Inferences
**A. Layering (shared by both routes)**

| Layer | Browser route (iPhone, any phone) | Android app route | Desktop |
|---|---|---|---|
| Discovery and pairing | QR code (`https://…/#j=token`) or IP/`.local` + PIN | NsdManager picker → one-time code confirmation → key pinning | mDNS/DNS-SD advertisement, QR/PIN display, join toast |
| Control (reliable) | WebSocket (wss in the trusted tier, ws offline) | TLS/TCP or WSS with the pinned key (Kotlin) | `ws` server plus TLS server, same handler |
| Realtime (unreliable) | DataChannel `{ordered:false, maxRetransmits:0}` | UDP datagrams with HMAC/AEAD (Kotlin) | `node-datachannel` plus `node:dgram`, same handler |
| Feature set | Tier-dependent (section 2 table) | Full: native sensors, haptics, window control | Capability-aware |

**B. One message schema**: version byte, type byte, seq, source time. Byte-identical across WebSocket binary frames, DataChannel messages, UDP datagrams and the WebView bridge's ArrayBuffers. Messages:
- `HELLO`: protocol version and `clientKind` (browser-ios, browser-android, app-android).
- `CAPS`: `maxTouches`, `pressureKind` (none / contact-size / stylus / force), `motionHz`, `hapticsKind` (none / ios-tap-only / web-vibrate / android-rich), `coalesced` (bool), `preview` options.
- `AUTH` and `RESUME`.
- `CLOCK_PING` and `CLOCK_PONG`.
- `INPUT_FRAME`: touch samples plus motion, ×2 redundancy.
- `EDGE`: touch down/up and buttons, reliable.
- `HAPTIC_CUE` (desktop→phone): kind, intensity and duration hint.
- `STATE` (desktop→phone): player colour, mode, kick.
- `PREVIEW`, optional.
- `BYE`.

The desktop accepts protocol versions N and N−1. Over TCP, add a length prefix; WebSocket and datagram transports already preserve message boundaries.

**C. Desktop handling**: after transport termination, every client becomes a `Session`. It runs the same clock sync, jitter buffer (adaptive 0–25 ms), interpolation, rate limits and per-player steering, so the particle engine never knows which route a phone used.

**D. Haptic cues map per client**:
- Android app: VibrationEffect primitives, predefined effects or amplitude one-shots.
- Android browser: `navigator.vibrate(ms)` (gesture-gated, so in practice only near touches).
- iOS browser: ignored, except tap-confirm buttons.
- All clients: optional Web Audio "tick".

**E. Security** (both routes):
- Origin and Host checks for browser upgrades; token or key authentication before any input; per-device revocable tokens.
- Size and rate caps; input-only message types; the server bound to LAN interfaces and enabled only while phone control is on.
- The Android app pins the desktop key; browsers rely on TLS in the trusted tier or short-lived tokens in the HTTP tier.

**F. Validation plan before committing**
1. Echo-RTT percentiles: WebSocket, DataChannel, app UDP and app TLS; iPhone (iOS 27.x), the user's Moto G Stylus (2026) and one other Android phone; three routers, power save on and off, 1 versus 8 phones.
2. WebRTC between a plain-HTTP page and `node-datachannel` without STUN.
3. Self-signed click-through secure-context behaviour.
4. On the Moto G Stylus with targetSdk 37: the picker flow, `FLAG_USER_APPROVED_ONLY` reconnect, UDP reachability after a picker grant, and behaviour with `RESTRICT_LOCAL_NETWORK` force-enabled.
5. WebMessageListener ArrayBuffer round-trip latency.
6. Haptic primitive support and feel.
7. Touch-point limits and coalesced sample rates per device.
8. Error UX behind DNS-rebinding-protected routers and client-isolated guest Wi-Fi.

**G. Deferred or optional**
- WebTransport (secure-context only; needs native HTTP/3 in Node).
- Cloud relay (opt-in, for isolation or cellular).
- Bluetooth: no.

### Gaps
- All latency targets are design goals pending the validation plan.
- Vendor-side services for the trusted tier (stateless DNS, an ACME DNS-01 broker, PSL submission, CA choice) need their own evaluation.
- Desktop-OS mDNS advertisement and firewall or macOS Local Network prompts are out of scope here but affect both routes' first-run experience.
- A 2026 Radboud thesis on LNA security ([PDF](https://www.cs.ru.nl/masters-theses/2026/S_van_Ieperen___Local_Network_Access_Standard_A_Security_Evaluation.pdf)) was not read.
