# Many hands conduct light on WebGPU

Tactilume Desktop should be an original **many-handed light instrument**, not a bigger Uzu. It is a custom WebGPU compute engine inside an **Electron 45** shell. Every phone and up to eight gamepads each own a colour, a tool and a sound, music bends what the hands are doing rather than taking over, and HDR highlights at 120–240 Hz, held in check by an always-on flash limiter, are the visual signature. Electron is the only web runtime that ships one Chromium engine (version 156) on Windows, macOS and Linux, so WebGPU, the Gamepad API, WebHID, system-audio capture and a Node server for the phones all live in one codebase. The existing WebGL2 renderer stays as the fallback for Linux AMD machines, virtual machines and repeated GPU failures. No browser engine offers hardware ray tracing, but additive light barely needs it: floor pools, reflections and volumetric glow from emitters that never block each other reduce to blurs and second splats that compute shaders already do, so a native rewrite pays off only if ray tracing or DLSS-class upscaling become hard requirements. Public system requirements should come in **four tiers keyed on memory bandwidth**, from Minimum on an Iris Xe, Radeon 780M, Apple M1 or GTX 1650 at 1080p and 60 Hz with about 1–2 million particles, to Ultra on an RTX 5080 or 5090 at 4K. The default preset on every machine should be **"Auto (this machine)"**, set by a half-minute first-run measurement, so the user's own PC, and any PC with the same GPU, display and power profile, starts at its measured tier. The biggest risks are that every particle budget is modelled rather than measured, that HDR output, phone-to-screen latency and Linux audio capture are untested, and that Android 17 now blocks the Tactilume app's local-network traffic unless it uses the system's device picker. Uzu's finger-count modes made it a 2010 hit, and its users then spent a decade asking for video capture, sharing, colour control and stability. A desktop successor can deliver all of that without borrowing Uzu's names, mode ladder, presets or look.

## Uzu turned ten fingers into a light show, then stalled

Uzu is a one-person indie app by designer-engineer Jason Kent Smith, published under the Colordodge Labs brand. It launched for the original iPad on **12 June 2010 at about US$0.99** ([AppAdvice](https://appadvice.com/app/uzu-an-interactive-light-show/376551723); [Tapscape](https://www.tapscape.com/?p=1320)). It reached #1 soon after Apple opened the iPad App Store ([MacStories](https://www.macstories.net/ipad/uzu-for-ipad-as-played-by-non-ipad-users-video/)). Smith's portfolio calls it the first iPad app to use all ten fingers, a claim nobody has checked independently ([jasonkentsmith.com](http://jasonkentsmith.com/colordodge/)). An iPhone spin-off, Little Uzu, followed in 2010, then a universal v3.0 in 2014 ([AppFollow](https://apps.appfollow.io/ios/uzu-an-interactive-light-show/376551723)) and v3.2.1 in September 2021 ([soft112](https://uzu-a-generative-design-playground-ios.soft112.com/)). Version 4.0 rebuilt the app on Metal with a SwiftUI interface. It added 67 "refreshed" presets, a ten-effect post-processing bundle, preset import and export, and "Low" to "Ultra" quality settings. The app is still on sale at **version 4.2 for US$3.99**. The listing says "Designed for iPad" and requires iPadOS 17.6 ([App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)). No Colordodge product exists for Windows or Linux. Apple does offer compatible iPad apps on Apple-silicon Macs unless the developer opts out, so macOS is possibly contested until someone checks the Mac App Store by hand ([Apple](https://developer.apple.com/documentation/apple-silicon/running-your-ios-apps-in-macos)). Smith's newer work, Kinetiform and the fluid toy Fluidium, stays on Apple platforms ([App Store](https://apps.apple.com/us/app/fluidium/id6745104628)).

The design was a vocabulary of finger chords. **The number of fingers on the glass, from zero to ten, chose one global animation mode.** Zero fingers gave Brownian drift. One finger radiated particles, two attracted them, and three and four made vortices. Five to nine fingers gave pseudo-3D freezes, spirals and springy ribbons, and ten fingers changed colour and particle size ([Digital Mom Blog](https://www.digitalmomblog.com/baby-and-the-ipad-app-uzu/); [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)). Nothing but the art appeared on screen. An auto-play mode added virtual touches of its own, and later versions reacted to the microphone. The listing pitched an **external display with the iPad as the controller** for social gatherings ([App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)), which is the direct precedent for Tactilume's idea of a handheld driving the big screen. The scheme needed no tutorial: it worked for a toddler's palm and for an expert's seven-finger chord, and the particles followed the fingers closely. Its weaknesses were built in. The mapping was invisible, so people found modes by accident, and lifting one finger changed the mode. None of it translates to a phone held in one hand or to a gamepad.

Reception was warm but shallow. Press coverage came as blurbs from Wired and Ars Technica. The listing reports Apple accolades that nobody has verified, and snapshots show **4.8–4.9 stars** ([App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)). The audiences that stayed were mostly not gamers:

- toddlers and families;
- therapists, who use it for fine motor skills, sensory needs and breathing-paced relaxation ([BridgingApps](https://bridgingapps.org/bridgingapps-reviewed-app-uzu-a-generative-design-playground/));
- autistic users, who seek it out because it soothes ([The Curated Culture](https://thecuratedculture.com/im-sharing-my-favorite-sensory-apps-because-everyone-needs-one-sometimes/));
- party crowds looking for "psychedelic fireworks".

A decade of user reviews complains about crashes after updates and gaps of several years between releases. The reviews ask for **video recording and export, an adjustable background colour, the return of hidden controls and "randomize all", and direct sharing** ([App Store reviews](https://apps.apple.com/us/app/376551723?see-all=reviews&platform=iphone)). A recent snapshot puts Uzu at #181 in the Entertainment chart: remembered fondly, but rarely discovered.

Uzu's lesson is an open slot in the market, not a template. The research covered touch toys, fluid toys, music visualisers, artificial-life simulations and professional tools. **None of them combines desktop-class GPU particles, several simultaneous phone and gamepad players, two-way audio and instant consumer play.** That absence is unproven but consistent across the survey.

Professional tools have the scale but not the play. TouchDesigner, for example, added GPU-accelerated point operators in 2025–26 ([Derivative](https://derivative.ca/release/202532460/74120)). Mobile toys have the play but not the scale. The closest new desktop analogue, Atomic Particle Engine (Steam, April 2026), takes only mouse and music input ([Steam](https://store.steampowered.com/app/4513520/Atomic_Particle_Engine/)).

Older works supply the missing pieces:

- Panoramical showed that gamepad or MIDI "dimensions" over curated audio-visual worlds work on desktop ([Engadget](https://www.engadget.com/2015-09-18-panoramical-finji-polytron-indie-fund.html)).
- Plasma Pong showed that a fluid can carry a two-player game. Atari's trademark objection, which pulled it in 2007, also showed that names in this genre carry legal risk ([Wikipedia](https://en.wikipedia.org/wiki/Plasma_Pong)).

Licences decide which reference code can be reused. Only MIT-licensed references, such as Butterchurn, can go into closed code with nothing more than attribution. projectM is LGPL-2.1, and the Particle Life desktop app is GPL-3.0 ([Butterchurn licence](https://github.com/jberg/butterchurn/blob/master/LICENSE); [projectM licence](https://github.com/projectM-visualizer/projectm/blob/master/COPYING); [Particle Life licence](https://github.com/tom-mohr/particle-life-app/blob/main/LICENSE.md)). The research never reviewed Uzu's preset names, screenshots or in-app screens. That review, and a trademark search, should come before any naming or interface freeze.

| Uzu element to leave alone | What Tactilume owns instead |
|---|---|
| "Uzu", swirl or whirlpool puns, "Colordodge", both subtitles, the "kinetic multitouch particle visualizer" tagline | An original name, cleared by a trademark search |
| One global mode ladder chosen by 0–10 simultaneous touches, its mode names, auto-play that adds virtual touches | Tools for each player and curated worlds, plus a generic drift or attract mode |
| The 55 and 67 factory presets, a "Legacy Presets" folder, the same ten-effect bundle in the same order, "Low to Ultra" labels | Worlds, scene codes, community presets and "Auto (this machine)" quality |
| The 2010 yellow-green-red palette, three-armed spirals and springy ribbons as hero looks | HDR light, fluids, flocks and particle-life ecologies |
| Its press blurbs, accolade list and pitch for an external display at parties | Several players, capture and sharing, and comfort features |

## Desktop GPUs stand still until 2027, so tiers key on bandwidth

The installed base of graphics cards will barely move before Tactilume ships. NVIDIA reportedly releases no new RTX gaming GPUs in 2026. The RTX 50 Super is expected at CES 2027 at the earliest and the RTX 60 around 2028 ([Tom's Hardware](https://www.tomshardware.com/pc-components/gpus/report-claims-nvidia-will-not-be-releasing-any-new-rtx-gaming-gpus-in-2026-rtx-60-series-likely-debuting-in-2028)). AMD's next architecture, RDNA 5, is expected in the second half of 2027 ([PCGH](https://www.pcgameshardware.de/Grafikkarten-Grafikkarte-97980/News/GPU-Rumors-RDNA-5-RTX-50-Super-Intel-Arc-Analysis-1545000/)).

Valve's own tables for the October 2026 Steam survey could not be opened, so the figures below come from secondary reports and are unverified:

| Measure | October 2026 share |
|---|---|
| Operating system ([Phoronix](https://phoronix.com/news/Steam-Survey-October-2026)) | Windows 93.70%, Linux 3.95%, macOS 2.35% |
| Primary display ([Hardware Busters](https://hwbusters.com/news/steam-hardware-survey-october-undoes-september-putting-16gb-and-the-rtx-3060-back-on-top/)) | 1080p 50.23%, 1440p 21.82%, 4K 5.05% |
| Graphics memory ([Wccftech](https://wccftech.com/october-2026-steam-hardware-survey-16-gb-ram-reclaims-top-spot-intel-gains-cpu-share-linux-approaches-4/)) | 8 GB 26.92% (most common), 16 GB 26.35% |
| Top GPUs ([TweakTown](https://www.tweaktown.com/news/114454/rtx-5070-loses-its-steam-gpu-crown-after-just-one-month-as-rtx-3060-returns-to-the-top/index.html)) | RTX 3060 3.62%, RTX 5070 3.56%; the top six cards sit within 0.65 points |
| Linux players on AMD hardware ([PBX Science](https://pbxscience.com/linux-climbs-back-to-3-95-on-steam-as-amd-holds-two-thirds-of-linux-gamers/)) | About two-thirds |
| Steam Macs on Apple silicon ([AppleInsider](https://appleinsider.com/articles/26/01/12/forget-m1-m4-is-the-dominant-apple-silicon-chip-on-steam)) | About 85% |

The typical Steam PC runs Windows 11 with six to eight CPU cores, 16–32 GB of RAM, an 8–16 GB RTX 3060- or 4060-class card and a 1080p screen. That PC should anchor the **Recommended** tier, not Minimum, because a light toy's audience leans towards laptops with integrated graphics and towards Macs. The survey swings by several points a month as the language mix of its respondents changes, so tier decisions should use three-to-six-month averages.

Displays are changing faster than GPUs. OLED monitor shipments grew **98% year on year in Q2 2026**, with more than 4 million forecast for the year. The growth segment is 27-inch 1440p monitors at 240 Hz ([TrendForce](https://www.trendforce.com/insights/oled-monitor)). OLED is still only about 6% of laptop panels ([TrendForce](https://www.trendforce.com/presscenter/news/20261029-13287.html)). Nobody publishes how many players have high-refresh or HDR screens. DisplayHDR 400 looks close to SDR in practice, while DisplayHDR 1000 means 1,000 nits peak and 0.05-nit black ([VESA](https://displayhdr.org/)). SDR should therefore stay the default look, with HDR offered where the display supports it.

For a particle toy simulated on the GPU and drawn with additive blending, **memory bandwidth and graphics memory are better tier keys than FP32 TFLOPS** (the usual headline compute figure). Paper TFLOPS mislead across vendors. AMD's "dual-issue" figures roughly double the useful rate, and the Radeon 780M is only 5–10% faster than the 680M despite about twice the paper number ([UltrabookReview](https://www.ultrabookreview.com/64396-amd-radeon-780m-benchmarks)). Integrated-GPU bandwidth follows the laptop's RAM, so two laptops with the same "780M" can differ by about 30%. Apple's GPUs blend inside on-chip tile memory, so blending traffic largely disappears on Macs ([Apple](https://developer.apple.com/documentation/metal/tailor-your-apps-for-apple-gpus-and-tile-based-deferred-rendering)).

The notes' budget rule is:

**particles × bytes per particle per frame × refresh rate ≤ 0.4 × peak bandwidth − resolution overhead**

The 0.4 combines two assumptions: that about 80% of peak bandwidth is achievable, and that particles get about half of each frame. Neither factor has a source, so the app must calibrate both. The tiers below follow from the rule. In the table, "or equivalent" applies to every reference GPU, and the particle counts are modelled, not measured.

| Tier | GPU floor (bandwidth, FP32, memory) | Reference GPUs | Display target | Particles (modelled) | CPU, RAM, OS |
|---|---|---|---|---|---|
| Minimum | ≥60 GB/s, 2 TFLOPS, 2 GB (shared memory is fine) | Intel Iris Xe, Radeon 680M/780M, Apple M1, GTX 1650 | 1080p or 1200p at 60 Hz, SDR | about 1–2M | 4 cores; 8 GB (16 GB with integrated graphics); Windows 10 22H2 64-bit, macOS 13 or later on Apple silicon, or 64-bit Linux with Vulkan |
| Recommended | ≥250 GB/s, 10 TFLOPS, 8 GB | RTX 3060/4060, RX 7600/9060 XT, Arc B580, Apple M4/M5 Pro, Radeon 8060S | 1080p at 144 Hz or 1440p at 60 Hz | about 5–10M | 6 cores/12 threads; 16 GB; Windows 11 |
| High | ≥440 GB/s, 20 TFLOPS, 12 GB | RTX 5070, RX 9070 XT, RTX 5060 Ti 16 GB, Apple M4/M5 Max | 1440p at 144–240 Hz, HDR optional | about 10–15M | 8 cores/16 threads; 16–32 GB |
| Ultra | ≥880 GB/s, 40 TFLOPS, 16 GB | RTX 5080, RTX 5090 (RTX 5070 Ti as entry) | 4K at 120–144 Hz, or 1440p at 360–480 Hz; OLED or DisplayHDR 1000 | about 20–50M+ | 8+ cores; 32 GB |

At a typical 128 bytes of memory traffic per particle per frame, the rule gives these budgets (the notes' arithmetic, re-checked in the fact-check):

| GPU | Resolution and refresh | Particle budget |
|---|---|---|
| Iris Xe | 1080p, 60 Hz | about 2.5M (close to the mobile edition's 2M) |
| RTX 4060 | 1080p, 144 Hz | about 4.9M |
| RTX 5070 | 1440p, 144 Hz | about 12.7M |
| RTX 5070 | 1440p, 240 Hz | about 6.9M |
| RTX 5090 | 4K, 144 Hz | about 35M |

**50 million particles at 240 Hz fit on no single GPU.** The peak bandwidths behind these numbers come from spec aggregators and [NVIDIA's comparison page](https://www.nvidia.com/en-us/geforce/graphics-cards/compare/), and were not verified at vendor level.

Blending can use up bandwidth before simulation does. On NVIDIA, AMD and Intel GPUs, which blend in main memory, a million 64-pixel glow sprites at 60 Hz move about 61 GB/s. That is more than an Iris Xe's whole usable budget. **Particle count, sprite size and glow radius, and internal render scale must therefore be separate quality settings.**

The light-rendering notes estimate 10–30 million particles at 240 Hz on RTX 5070-class cards. They assume 16-byte packed particle state and one compute kernel that both simulates and draws. The gap between that estimate and the 6.9 million above comes from data layout, which makes **bytes per particle the single largest lever in the engine**. None of these numbers has been measured on a real GPU.

Comparable creative and simulation titles phrase their store requirements the same way. They name one or two reference GPUs "or equivalent", state graphics memory explicitly, add a line about integrated graphics and give a graphics-API floor, as Universe Sandbox ([Steam](https://store.steampowered.com/app/230290/Universe_Sandbox/)), Teardown ([Steam](https://store.steampowered.com/app/1167630)) and Wallpaper Engine ([Steam](https://store.steampowered.com/app/431960/Wallpaper_Engine/)) do. Tactilume's store page should add three things:

- "a WebGPU-capable GPU (DirectX 12, Vulkan or Metal)";
- a footnote that laptops with switchable graphics must run the app on the discrete GPU;
- an honest Linux line: "Intel Gen12+ (Mesa 22+) or NVIDIA (driver 535.183.01+) for WebGPU; other GPUs run the WebGL2 renderer". Chromium's Linux blocklist exempts only those two ([Chromium](https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/software_rendering_list.json)).

Electron 45 itself needs Windows 10 or macOS 13 Ventura or later ([Electron](https://raw.githubusercontent.com/electron/electron/v45.3.0/README.md)). About a fifth of Steam PCs still run Windows 10, so supporting Windows 10 22H2 at Minimum costs little, labelled "unsupported by Microsoft". The two sets of notes disagree on whether the AMD-based Steam Deck and Steam Machine are in scope, and that remains a product decision.

## "Auto (this machine)" makes the user's own system the default

The answer to "make a system like the user's own the default" has two layers. The public Minimum-to-Ultra floors stay anchored to market data, so a developer's high-end card never becomes the advertised Recommended spec. Separately, **the default preset on every machine is "Auto (this machine)"**: the tier the machine measures itself into, with its own particle count, sprite size and render scale. The developer's own machine is the first preset to tune, and Minimum is tested on an Iris Xe or Radeon 780M laptop. The research did not record the user's hardware, so the same detector and benchmark, plus a short questionnaire, place it.

Detection takes about 100 ms and combines several sources:

- **Every GPU in the machine.** Electron's `app.getGPUInfo('basic')` returns each GPU's PCI vendor and device IDs with an `active` flag, plus flags for hybrid NVIDIA and AMD laptops and the machine model ([Electron](https://raw.githubusercontent.com/electron/electron/main/docs/api/app.md)).
- **The WebGPU adapter.** By default, WebGPU's `adapter.info` carries only the vendor, the architecture, subgroup sizes and whether it is a software fallback. The device ID and description stay empty unless a developer flag is set ([Chromium](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/modules/webgpu/gpu_adapter.cc)).
- **Architecture names.** Dawn, Chrome's WebGPU engine, derives names such as `lovelace`, `rdna-3` or `xe-2-lpg` from PCI ID ranges. Apple reports only a Metal family such as `common-3` ([Dawn](https://raw.githubusercontent.com/google/dawn/main/src/dawn/gpu_info.json)).
- **Displays.** Electron's `Display` gives the refresh rate, colour depth and whether a panel is built in ([Electron](https://raw.githubusercontent.com/electron/electron/main/docs/api/structures/display.md)).
- **Power.** `powerMonitor` reports battery state, thermal state and CPU speed limits ([Electron](https://raw.githubusercontent.com/electron/electron/main/docs/api/power-monitor.md)).
- **Memory.** `process.getSystemMemoryInfo()` gives exact RAM ([Electron](https://raw.githubusercontent.com/electron/electron/main/docs/api/process.md)).

WebGPU limits are deliberately coarse: a browser may expose no more than 32 distinguishable capability buckets ([WebGPU spec](https://raw.githubusercontent.com/gpuweb/gpuweb/main/spec/index.bs)). Limits are therefore hard caps, never a measure of speed. The PCI IDs feed a local table of bandwidth, real FP32 rate and graphics memory, which supplies the starting estimate (the "spec prior"). The developer flag that fills in the adapter description should not ship, because it adds fingerprinting surface and Electron's PCI IDs make it unnecessary.

The measurement then runs as follows:

| Step | Time | What happens |
|---|---|---|
| Spec prior | Instant | Look up the tier floor in the PCI ID table. Unknown and Apple GPUs start at Minimum unless the chip variant is known. |
| Bandwidth probe | About 1 s | Time a 256 MB buffer copy to calibrate achievable bandwidth. |
| Particle ramp | 10–15 s, after a 2–3 s warm-up | At native resolution and refresh rate, start at half the prior's budget. Multiply the count by 1.4 every 1–1.5 s until the 90th-percentile GPU time exceeds 75% of the refresh period (5.2 ms at 144 Hz) or a memory cap. Then narrow it down by bisection. |
| Soak | 15–20 s at 85% of the result | Cut 15% and flag the machine as heat-limited if the last 3 s run more than 10% slower, the OS speed limit falls below 100, or the thermal state reaches "serious". |
| Profile | Stored | Pick the highest tier whose target fits. Key the profile by GPU IDs, driver, display, refresh rate and power source. Re-run after GPU, display or power changes and after the GPU device is lost. |

The measurement overrides the prior in both directions. In shipping builds, WebGPU timestamps are rounded to steps of about 65.5 µs ([Dawn](https://github.com/google/dawn/blob/main/src/dawn/common/Constants.h)). That is fine for timing whole frames but too coarse for timing individual passes. Because laptops slow down as they heat up over minutes, a runtime governor should shed particles or render scale whenever a frame stays over budget for more than two seconds.

Hybrid laptops are the main trap. **Chrome ignores `powerPreference` on Windows** and uses the GPU it was allocated, which on laptops "is generally the integrated graphics card" ([Chromium](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/modules/webgpu/gpu.cc)). WebGPU also follows the adapter that Chrome's whole GPU process uses, so nothing short of moving that process to the other GPU helps ([Chromium](https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/command_buffer/service/webgpu_decoder_impl.cc)).

When `getGPUInfo` shows an inactive discrete GPU beside an active integrated one, the app should prompt once for Windows Settings → Graphics → High performance, then benchmark again. Chromium's own `force-high-performance-gpu` switch exists but is untested. Apple silicon has a single GPU ([Apple](https://developer.apple.com/documentation/metal/mtldevice/islowpower)), but Macs need the chip variant and GPU-core count to be placed, and WebGPU hides both.

A diagnostics button can fill in nearly everything automatically. It should ask the user only for what software cannot read: the laptop GPU's power limit (TGP), whether the laptop has a MUX switch, the monitor's HDR tier and the Apple GPU-core count.

This report recommends one further step. Profiles are keyed by GPU, driver, display, refresh rate and power source, so the developer's measured profile can ship as the prior for that hardware class. **Any machine like the user's then starts from a measured tier rather than a modelled one**, and the ramp only confirms it. Over time, anonymous opt-in calibration results from players can replace the unsourced 0.8 and 0.5 factors in the budget rule with fleet data, which the research could not find anywhere.

## WebGPU in Electron 45 delivers compute and HDR, not ray tracing

WebGPU is on by default in Chrome and Electron on **Windows through Direct3D 12 for NVIDIA, AMD and Intel GPUs, and on macOS through Metal**. Qualcomm's Windows-on-Arm GPUs need a recent enough driver ([gpuweb](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status); [Chromium](https://github.com/chromium/chromium/blob/main/gpu/config/webgpu_blocklist_impl.cc)).

Linux is the exception. Chromium 156 exempts only **Intel Gen12+ on Mesa 22.0 or newer, and NVIDIA on driver 535.183.01 or newer**, from the blocklist entry that disables WebGPU on Linux ([Chromium](https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/software_rendering_list.json)). AMD users therefore get no WebGPU by default, including the Steam Deck and the Steam Machine. Two overrides exist:

- The narrowest is the `ForceEnableWebGpuInterop` feature, which opens only that blocklist entry and keeps Chromium's "safe" level.
- `--enable-unsafe-webgpu` turns off the whole adapter blocklist, including its protection against known-bad drivers ([Chromium](https://github.com/chromium/chromium/blob/156.0.8078.96/gpu/config/gpu_util.cc)).

Neither has been tested on AMD's open-source Linux driver (RADV). Software-only adapters in virtual machines and remote sessions are always blocked ([Chromium](https://raw.githubusercontent.com/chromium/chromium/main/gpu/config/webgpu_blocklist_impl.cc)), which is one more reason to keep the WebGL2 renderer.

Electron 45 (45.3.x) pins Chromium 156.0.8078.96. Chrome now ships a new major version every two weeks while Electron keeps an eight-week cycle, so each Electron major jumps four Chromium versions ([Chromium](https://github.com/chromium/chromium/blob/main/docs/process/release_cycle.md); [Electron](https://github.com/electron/electron/blob/45-x-y/DEPS)). The app should therefore detect features at runtime rather than key on version numbers, and plan to move up one Electron major every 8–16 weeks. Electron 46 is in alpha on Chromium 159 ([npm](https://registry.npmjs.org/electron)) and will bring linear canvas colour spaces and 64-bit atomics by default.

Memory limits must be requested explicitly when the GPU device is created. The spec's defaults are 128 MiB per storage binding and 256 MiB per buffer, which would quietly cap particle counts near the mobile edition's scale. In practice:

- **Every Windows adapter offers a 2 GiB buffer and a binding of 2 GiB minus 4 bytes**, because Dawn assumes 2 GiB on Direct3D 12 ([Dawn](https://github.com/google/dawn/blob/main/src/dawn/common/Constants.h)).
- NVIDIA's Vulkan driver is capped at 2 GiB minus 4 bytes after a buffer-length bug ([Dawn](https://github.com/google/dawn/blob/main/src/dawn/native/vulkan/PhysicalDeviceVk.cpp)).
- Only Metal and non-NVIDIA Vulkan drivers reach 4 GiB.

At 32 bytes per particle, one 2 GiB binding holds about 67 million particles, and 50 million need about 1.5 GiB per copy. Every device keeps the limit of 65,535 workgroups per dispatch dimension ([Dawn](https://github.com/google/dawn/blob/main/src/dawn/native/Limits.cpp)), so 50 million particles at 256 threads per workgroup need a 2D dispatch.

WGSL, WebGPU's shading language, still has **no floating-point atomics**. It has only 32-bit integer atomics plus an optional 64-bit minimum/maximum ([WGSL](https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs)). Electron 45 exposes that 64-bit feature only behind a developer flag, and M1 Macs lack the hardware for it ([Chromium](https://github.com/chromium/chromium/blob/156.0.8078.96/gpu/command_buffer/service/webgpu_decoder_impl.cc)). Half-precision shaders, subgroup operations and 64-bit atomics must all stay optional code paths.

HDR is reachable today. A half-float (`rgba16float`) canvas configured with **`toneMapping: { mode: "extended" }` shows values brighter than SDR white**. Chrome supports this from version 129 on Windows and macOS and from 144 on Linux; Firefox and Safari do not ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/GPUCanvasContext.json)). Browsers without tone mapping leave the setting out of `getConfiguration()`, which doubles as the feature test ([WebGPU spec](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs)).

Two details bite in Electron 45:

- **Linear colour space.** The linear `srgb-linear` canvas colour space is still experimental in Chromium 156 and stable only from 157 ([Chromium 156](https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/platform/runtime_enabled_features.json5); [Chromium 157](https://github.com/chromium/chromium/blob/157.0.8103.81/third_party/blink/renderer/platform/runtime_enabled_features.json5)). The final pass must therefore write sRGB-encoded values: four times SDR white is written as about 1.82, not 4.0.
- **No brightness information.** **No API reports the display's peak brightness or its SDR-white level.** The only signal is the yes-or-no `dynamic-range` media query, which reports what the screen can do, not whether HDR is switched on ([W3C Color on the Web CG](https://github.com/w3c/ColorWeb-CG/blob/main/hdr_html_canvas_element.md)). The app needs an in-game calibration screen for peak brightness and paper white.

PQ and HLG canvases, the HDR video formats, are still experimental. Chromium's HDR display features are ChromeOS-only, so Linux users should expect SDR ([Chromium](https://github.com/chromium/chromium/blob/main/components/viz/common/features.cc)). Real HDR output has not yet been seen on any OS.

High refresh rates work, but the app gets no controls over them. Chromium paces frames from the display's refresh signal: DXGI or the DirectComposition clock on Windows, and DisplayLink on macOS ([Chromium](https://github.com/chromium/chromium/blob/main/ui/gl/vsync_thread_win.cc)). The WebGPU canvas has **no option for present mode, latency or variable refresh rate (VRR), and no presentation-timing feedback** ([WebGPU spec](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs)). Chromium's own source notes that VRR support is not implemented on Windows. Its `--disable-frame-rate-limit` switch also turns off vsync, so it is useful only for benchmarks ([Chromium](https://github.com/chromium/chromium/blob/main/components/viz/common/switches.cc)).

The engine therefore runs the simulation on a fixed timestep, separate from the display, and interpolates between steps when rendering. It measures the real frame interval and keeps at most two frames queued. The GPU budget per frame is 8.3 ms at 120 Hz, 4.2 ms at 240 Hz and 2 ms at 500 Hz. Above 240 Hz, the simulation should stay at 120 or 240 Hz and only rendering should follow the panel.

**Hardware ray tracing does not exist in WebGPU.** It is missing from the spec's 25 optional features, from Dawn's API definition and from Chrome, even as an experiment ([WebGPU spec](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs); [Dawn](https://github.com/google/dawn/blob/main/src/dawn/dawn.json)). The native Rust library wgpu, at version 30, has experimental ray queries and ray-tracing pipelines. It has supported Metal acceleration structures since version 29, and its newest additions work only on Vulkan ([wgpu](https://github.com/gfx-rs/wgpu/blob/trunk/CHANGELOG.md)). Using it would mean a native module with no shared texture path into the WebGPU canvas. For Tactilume, ray-traced looks must therefore come from compute shaders, as the light-rendering section below explains.

Robustness also needs design:

- A lost device must be rebuilt from a fresh adapter, because adapters are single-use ([WebGPU spec](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs)).
- Chrome's GPU watchdog fires after 30 s on Windows, 25 s on macOS and 15 s elsewhere ([Chromium](https://github.com/chromium/chromium/blob/main/gpu/ipc/common/gpu_watchdog_timeout.h)).
- The app should keep each GPU submission short.
- It should rebuild after a loss from a compact snapshot of emitter and preset settings, not from gigabytes of particle data.
- It should drop to WebGL2 after repeated losses.

## Electron is the only shell that runs one engine everywhere

Electron 45 shipped on 21 October 2026 with Chromium 156, V8 15.6 and Node 24.22 ([Electron](https://github.com/electron/website/blob/main/blog/electron-45-0.md)). It adds **121–158 MB of compressed runtime** per platform ([GitHub release assets](https://github.com/electron/electron/releases/expanded_assets/v45.3.0)). It runs on Windows 10 or later and macOS 13 or later, with x64 and arm64 builds for all three operating systems.

Each alternative breaks something Tactilume needs:

- **Tauri 2** uses each operating system's own web view. WebKitGTK on Linux has no WebGPU build option even at version 2.54 ([WebKit](https://raw.githubusercontent.com/WebKit/WebKit/webkitglib/2.54/Source/cmake/OptionsGTK.cmake)). The macOS web view gets WebGPU only on macOS 26 or later ([Tauri](https://github.com/tauri-apps/tauri/issues/6381)). WebHID exists only in Windows' WebView2.
- **An installable web app** cannot listen on the local network for phones.
- **Native code**, such as Rust with wgpu or SDL3 over Vulkan, Direct3D 12 and Metal, is the only route to several things. It reaches hardware ray tracing and DLSS through NVIDIA Streamline, which needs DirectX 11 or Vulkan 1.2 ([NVIDIA](https://raw.githubusercontent.com/NVIDIA-RTX/Streamline/main/README.md)). It reaches Intel's XeSS 3 upscaling, frame generation and low-latency mode ([Intel](https://raw.githubusercontent.com/intel/xess/main/README.md)). And SDL3 has built-in gyro, touchpad, trigger-rumble and LED support ([SDL](https://raw.githubusercontent.com/libsdl-org/SDL/main/include/SDL3/SDL_gamepad.h)). The price is rewriting the WebGL2 renderer and the JavaScript module bundle, writing a separate network server and losing the web developer tools.

The sensible middle path is **Electron for version 1, revisiting native code only if ray tracing or vendor upscalers become product requirements**.

The shell should follow Electron's own security checklist ([Electron](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/security.md)):

- one sandboxed, context-isolated window with a typed bridge to the main process;
- the app served from an `app://` custom protocol rather than `file://`, under a `default-src 'self'` content security policy;
- navigation and `window.open` denied;
- Electron's build-time "fuses" set to turn off `runAsNode`, `nodeOptions`, `nodeCliInspect` and extra `file://` privileges, and to turn on archive integrity checks ([Electron](https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/fuses.md)).

The phone server belongs in a separate `utilityProcess`, which passes decoded input to the renderer over a `MessagePort` ([Electron](https://raw.githubusercontent.com/electron/electron/main/docs/api/utility-process.md)). It should listen only while pairing or phone control is on. It should check the `Origin` and `Host` headers on every WebSocket connection, validate and rate-limit every message, and never let a message from the network reach the app's privileged internal channels.

Operating-system network prompts shape the protocol. On macOS 15 and later, **listening for and accepting incoming TCP connections needs no Local Network permission**. Outgoing TCP, any UDP send, multicast reception and every Bonjour operation do need it, through every API ([Apple TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)). Apps launched from Terminal are allowed automatically, so developers never see the prompt their users will see.

A desktop app that only accepts phone connections over HTTP and WebSocket therefore raises no macOS prompt. The phone-link design below, however, also uses a WebRTC data channel, UDP for the Android app and a Bonjour advertisement for Android's device picker. Under Apple's rules, each of these needs the Local Network permission. This report recommends asking for it when a user first turns on phone control, with an `NSLocalNetworkUsageDescription` string in the app. Without that string, developers report silent denial. The app should also keep a TCP-only path that works if the user declines.

On Windows, an installer that installs for all users can create a firewall rule limited to private networks and the local subnet. Per-user installs cannot. The app should notice when no phone has connected after a while and explain how to mark the network as Private.

Code signing is a fixed cost worth paying.

On macOS:

- Apple's Developer Program costs **US$99 a year** ([Apple](https://developer.apple.com/programs/whats-included/)).
- Every macOS build should be notarized with `notarytool` and the hardened runtime ([Apple](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)).
- macOS Sequoia removed the Control-click route around Gatekeeper ([Apple](https://developer.apple.com/news/?id=saqachfa)).
- The build keeps the audio-input entitlement and adds `NSAudioCaptureUsageDescription` for system audio.

On Windows, Microsoft's April 2026 guidance lists these options ([Microsoft](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/package-and-deploy/code-signing-options.md)):

| Option | Cost | Notes |
|---|---|---|
| Microsoft Store (MSIX package) | Free | Microsoft re-signs the app |
| Azure Artifact Signing | About US$9.99 a month | Organisations in the US, Canada, the EU and the UK; individuals only in the US and Canada |
| OV certificate | US$150–300 a year | |
| EV certificate | US$400+ a year | Since 2024, gets the same SmartScreen treatment as OV |

Electron's own docs still say an EV certificate is required, but Microsoft's newer guidance should win. Even signed apps show as "unrecognized" until they build reputation, which takes "several weeks and hundreds of clean installs" ([Microsoft](https://raw.githubusercontent.com/MicrosoftDocs/windows-dev-docs/docs/hub/apps/package-and-deploy/smartscreen-reputation.md)).

For direct distribution, electron-builder can produce an NSIS installer for Windows, a notarized DMG and ZIP for macOS and an AppImage for Linux, kept current by `electron-updater` from GitHub Releases ([electron-builder](https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/electron-updater/README.md)). A Flatpak needs the `--device=input` permission (Flatpak 1.15.6 or later) to see game controllers ([Flatpak](https://raw.githubusercontent.com/flatpak/flatpak-docs/master/docs/sandbox-permissions.rst)). AppImages need FUSE 2, packaged as `libfuse2t64` on Ubuntu 24.04 ([AppImage](https://raw.githubusercontent.com/AppImage/docs.appimage.org/master/source/user-guide/troubleshooting/fuse.rst)). Update checks must fail silently when offline, and a build marker should turn in-app updates off for Steam, Store and Flatpak builds, which update through their stores.

Steam is feasible but fragile. The usual Steam library for Electron, steamworks.js, last published version 0.4.0 in August 2024 and has no arm64 builds for Windows or Linux ([npm](https://registry.npmjs.org/steamworks.js)). Its helper for the Steam overlay forces Chromium to run GPU work inside the main browser process, turns off DirectComposition and adds a 60 Hz repaint timer ([steamworks.js](https://raw.githubusercontent.com/ceifa/steamworks.js/main/index.js)). The overlay works on Windows only if Steam starts before the app's window is ready, and it remains broken on macOS ([issue #102](https://github.com/ceifa/steamworks.js/issues/102)). Running GPU work in the main process removes the crash isolation a GPU-heavy toy relies on, so the overlay should be an optional switch in Steam builds only.

Automated testing splits in two. GitHub's hosted test machines have no GPUs ([GitHub](https://raw.githubusercontent.com/actions/runner-images/main/README.md)). In the research team's own headless test, a software WebGPU adapter ran compute, offscreen rendering and buffer readback correctly but could not show a canvas on screen, even though `configure()` succeeded. That fits Chromium routing Linux WebGPU output through a graphics path that is disabled under software rendering ([Chromium](https://github.com/chromium/chromium/blob/156.0.8078.96/gpu/config/gpu_util.cc)). The split is:

- **On hosted machines, every push:** check shader compilation, compare compute results with CPU reference values, and compare offscreen frames with reference images, allowing small tolerances.
- **On real GPUs, before each release:** check on-screen output, frame pacing, HDR, multiple monitors, physical gamepads and the Steam overlay. Use a Windows PC with a discrete GPU, an Apple-silicon Mac and a Linux AMD machine.

The same finding shapes the app's fallback check. At startup, the app should present a few frames while a WebGPU promise is pending. A rejection or a lost device within a timeout means WebGPU output is broken and the app should fall back to WebGL2, because a successful `configure()` proves nothing.

## Phones join over one protocol split by the secure-context line

The phone link has two client routes and one protocol, whose messages are the same bytes on every transport.

**Browser phones** (any iPhone, and Android phones without the app) load the controller page from the desktop's own server and connect back to it:

- **WebSocket** works everywhere, including `ws://` from a plain-HTTP page. Because it is ordered, one lost packet delays every message behind it. The Node `ws` library at least turns off Nagle's algorithm, which would otherwise batch small messages ([ws](https://github.com/websockets/ws/blob/8.22.2/lib/websocket.js)).
- **WebRTC data channel**, set to `{ordered: false, maxRetransmits: 0}`, **drops stale samples instead of stalling**, which suits the continuous touch and motion stream. It exists in iOS Safari, Chrome for Android and Android WebView, and is not limited to secure (HTTPS) pages ([MDN](https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/secure_contexts/features_restricted_to_secure_contexts/index.md); [W3C](https://github.com/w3c/webrtc-pc/blob/main/webrtc.html)). On a home network without a STUN server, the desktop must advertise its raw IP addresses. Safari shows its own addresses only as random `.local` names and ignores remote `.local` names that are not in that random form ([WebKit](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/mediastream/PeerConnectionBackend.cpp)). On the desktop, `node-datachannel` (MPL-2.0, with prebuilt binaries for all three desktop OSes) handles the other end ([npm](https://registry.npmjs.org/node-datachannel)). Neither phone browser has been tested against it yet.
- **WebTransport** now ships in every browser engine, in Safari since 26.4. It requires a secure page and certificates valid for at most two weeks, and Node needs a native HTTP/3 add-on for it, which Node's experimental QUIC module does not replace ([W3C](https://github.com/w3c/webtransport/blob/main/index.bs); [Node](https://github.com/nodejs/node/blob/main/doc/api/quic.md)). It is deferred.
- **Web Bluetooth** does not exist on iOS and is ruled out ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/Bluetooth.json)).

Whether the page counts as a "secure context" decides what a browser controller can do. A page at an address like `http://192.168.x.x` is not secure ([MDN](https://github.com/mdn/content/blob/main/files/en-us/web/security/defenses/secure_contexts/index.md)), so it **loses tilt and motion entirely**. Safari 26.4 and Chromium no longer even expose the motion interfaces there ([Chromium](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/device_orientation/device_motion_event.idl); [Apple](https://developer.apple.com/documentation/safari-release-notes/safari-26_4-release-notes)). The page also loses full-rate touch samples, the screen-wake lock, the cryptography API, WebTransport and the video codec API. It keeps touch and pointer events, predicted touch samples, WebSocket, WebRTC and vibration.

A trusted HTTPS page needs the approach Plex uses. A vendor-owned domain gives each install its own name that resolves to the desktop's private IP address, with a wildcard certificate obtained through a DNS challenge. This needs internet access. It also breaks behind routers that filter DNS answers pointing at private addresses, a failure the browser makers' own Local Network Access proposal acknowledges ([WICG](https://github.com/WICG/local-network-access/blob/main/explainer.md)). Let's Encrypt issues at most 50 certificates per registered domain per week, so the vendor domain must be added to the Public Suffix List to give each install its own allowance ([Let's Encrypt](https://github.com/letsencrypt/website/blob/main/content/en/docs/rate-limits.md)).

**A plain-HTTP, touch-only mode is therefore unavoidable offline**, and the phone should say so. Browser rules for local networks do not get in the way:

- Requests from a page loaded from a home-network address back to that same address are local-to-local, which the Local Network Access proposal exempts ([WICG](https://github.com/WICG/local-network-access/blob/main/explainer.md)).
- Chrome does not yet apply its local-network checks to WebRTC ([Chromium](https://github.com/chromium/chromium/blob/157.0.8103.81/services/network/public/cpp/features.cc)).
- iOS exempts Safari and in-app web views from its Local Network permission ([Apple TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)).

Hosting the controller page on a public website instead would run into permission prompts and mixed-content blocking.

The **Tactilume Android app** avoids most of these compromises, but Android 17 changed the rules. For apps targeting SDK 37, the local network **"is blocked by default"**. TCP in both directions, UDP and `.local` name lookups all fail, through every networking API: TCP times out and UDP returns a permission error. The fix is either the new `ACCESS_LOCAL_NETWORK` permission, or the user picking the desktop in the NsdManager system device picker. A picker grant needs no permission and survives reboots ([Android](https://developer.android.com/privacy-and-security/local-network-permission)).

Networking belongs in the app's Kotlin code, not in its web page. The app's page origin, `https://appassets.androidplatform.net`, is secure, which is good for full-rate touch samples and motion. But `ws://` connections from it are blocked as both mixed content and unencrypted traffic ([Android SDK 37.2 sources](https://dl.google.com/android/repository/source-37.2_r01.zip)). The recommended app transport is:

- **TLS over TCP for control**, pinned to the desktop's self-signed key after a one-time six-digit code derived from both sides' TLS fingerprints;
- **UDP for the realtime stream**, authenticated with a key from that TLS session.

Native sensors run at up to 200 Hz without a special permission, so a 100 Hz orientation stream is easy. The app also gets native vibration effects, orientation lock and full-screen immersive mode. Android browsers will fall under the same permission once they target SDK 37; Chrome 157 still targets SDK 36, and whether a page loaded from a home-network address then triggers a prompt is untested.

Latency is where phones are weakest, and nobody has measured it rigorously for phone browsers on a home network.

- A 2014 study on stylus lag found that people can tell 1 ms from 2 ms of lag when dragging, while commercial devices of the time took 65–120 ms end to end ([CHI 2014](https://webdocs.cs.ualberta.ca/~wfb/publications/C-2014-SIGCHI-Latency.pdf)). Any phone-to-screen path will be noticeable.
- Wi-Fi power saving can add up to hundreds of milliseconds in the worst case ([USPTO 9210656](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9210656), search summary only).
- AirConsole, the best-known phone-controller platform, targets under 100 ms ([AirConsole](https://developers.airconsole.com/best-practices-for-web-games-on-airconsole), search summary only).

A finger-driven light toy should aim for 20–40 ms and hide the rest with prediction and with instant local ripples on the phone itself.

The protocol stamps every sample with the time it was taken on the phone. It syncs clocks every 2–5 seconds using the samples with the shortest round trip, the game-industry method that the `timesync` library implements ([npm](https://registry.npmjs.org/timesync)). Input then passes through an adaptive buffer that delays it by 0–25 ms to absorb jitter, with interpolation and at most about 1.5 frames of extrapolation. Messages are packed binary: an 8-byte header, 8 bytes per touch sample and 12 bytes for motion. Ten fingers plus motion, each sent twice for redundancy, come to about 180 bytes per message, or **about 22 KB/s per phone at 120 Hz**. Ten phones need under 3 Mbit/s.

Haptics differ sharply by route:

- Android browsers can vibrate only right after the user touches the screen ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json)).
- iPhone web pages get haptics only as a side effect of real taps on an HTML toggle switch ([ios-haptics](https://github.com/tijnjh/ios-haptics/blob/main/README.md)).
- The app has full vibration control.

The desktop therefore sends meaningful haptic cues ("tick", "thud") and each phone plays what it can. Pairing uses a QR code carrying the HTTPS address and a 128-bit join code in the URL fragment, with a join notice on the big screen and a PIN as fallback.

## Gamepads add two analog hands each, and WebHID adds the gyro

The browser's standard Gamepad API is the base layer for every controller, and in Electron 45 it is generous:

- **Up to 8 pads with 16 axes and 32 buttons each** ([Chromium](https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/public/cpp/gamepads.h)).
- Chromium reads the devices every 4 ms ([Chromium](https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_provider.cc)), and the page reads the state once per frame.
- On Windows, the older XInput backend is not used at all, so XInput's four-pad limit does not apply ([Chromium](https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_platform_data_fetcher.h)).
- Pads stay invisible until a button press, which doubles as a "press any button to join" screen.
- Updates stop while the window is hidden.
- From Chromium 159, which Electron 46 will carry, a button press counts as a user action only when the window also has focus. This matters for flows that open a WebHID connection from a button press.

The API has **no gyro, accelerometer, lights, adaptive triggers or battery level on any OS** ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/Gamepad.json)). Its rumble is coarse: a fixed duration at constant strength, with strength from 0 to 1 and at most 5 seconds per call ([Chromium](https://github.com/chromium/chromium/blob/156.0.8078.96/third_party/blink/renderer/modules/gamepad/gamepad_haptic_actuator.cc)). Trigger rumble is effectively Xbox-on-Windows only. On Windows, the DualSense gets no rumble at all through this API, because Chromium's Windows rumble code covers only the DualShock 4 ([Chromium](https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/raw_input_gamepad_device_win.cc)).

An experimental event-driven input mode can be switched on, but the app should check that it exists and fall back to reading the state each frame. Reading at 60 Hz adds about 8 ms of average latency ([Microsoft Edge explainer](https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/GamepadEventDrivenInputAPI/explainer.md)).

**WebHID**, which gives web code raw access to HID devices, supplies what the Gamepad API lacks for PlayStation and Nintendo controllers. Chromium's HID blocklist contains no Sony, Nintendo, Microsoft or Valve devices and does not protect gamepads ([Chromium](https://github.com/chromium/chromium/blob/156.0.8078.96/services/device/public/cpp/hid/hid_blocklist.cc)).

Electron, however, provides no device chooser. The app must handle the `select-hid-device` event, call `preventDefault()` and pick the device itself. It can re-grant known controllers silently with `setDevicePermissionHandler` ([Electron](https://github.com/electron/electron/blob/v45.3.0/docs/tutorial/devices.md)). Without `preventDefault()`, the request quietly returns nothing ([Electron](https://github.com/electron/electron/blob/v45.3.0/shell/browser/hid/hid_chooser_controller.cc)).

What WebHID unlocks per controller:

- **DualSense:** a gyro reading 1,024 units per degree per second (up to ±2,048 °/s), an accelerometer reading 8,192 units per g, a two-finger 1920×1080 touchpad, rumble, adaptive triggers, the light bar and the player lights ([Linux hid-playstation](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-playstation.c)). Its sensors report at 250 Hz over USB and about 1,000 Hz over Bluetooth ([SDL](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_ps5.c)).
- **Switch Pro and Joy-Con:** a 200 Hz motion sensor, but commands must be spaced 20 ms apart over USB and 60 ms over Bluetooth ([Linux hid-nintendo](https://github.com/torvalds/linux/blob/master/drivers/hid/hid-nintendo.c)).
- **Switch 2 controllers:** none. They need a non-HID USB start-up step and are unsupported over Bluetooth even in SDL ([SDL](https://github.com/libsdl-org/SDL/blob/main/src/joystick/hidapi/SDL_hidapi_switch2.c)).
- **Xbox pads over USB:** none. They are not HID devices.

Linux needs device permissions for this, which Valve's udev rules already grant for most of these pads ([Valve](https://github.com/ValveSoftware/steam-devices/blob/master/60-steam-input.rules)). The best-known DualSense library is LGPL-3.0, so a closed-source app must ship it as a replaceable module or write its own parser. The DualShock 4 and Joy-Con libraries are MIT and Apache-2.0 ([npm dualsense-ts](https://registry.npmjs.org/dualsense-ts); [npm webhid-ds4](https://registry.npmjs.org/webhid-ds4); [npm joy-con-webhid](https://registry.npmjs.org/joy-con-webhid)). Each controller needs exactly one owner for haptics, because Gamepad API rumble and WebHID commands overwrite each other on a DualSense.

Steam Input complicates this whenever Steam is running. It presents controllers as a **"Steam Virtual Gamepad", which Chromium treats as an Xbox 360 pad**. That gives a standard button layout but strips the gyro, touchpad, lights and adaptive triggers ([SDL](https://github.com/libsdl-org/SDL/blob/main/src/joystick/controller_list.h); [Chromium](https://github.com/chromium/chromium/blob/156.0.8078.96/device/gamepad/gamepad_id_list.cc)). Gyro and touch are core verbs, so Tactilume should:

- default to the native Gamepad API plus WebHID for PlayStation and Switch pads;
- accept Steam's virtual pad for Steam Controllers, the Steam Deck and Switch 2 pads;
- detect the virtual pad and warn about double input.

How Steam Input interacts with WebHID inside an Electron build is still unknown.

Gyro aiming has a settled set of practices, written up in Jibb Smart's JoyShockMapper ([JoyShockMapper](https://github.com/Electronicks/JoyShockMapper/blob/HEAD/README.md)):

- calibrate the sensor's drift while the pad is still, and offer recalibration;
- turn rotation speed into cursor speed, with a sensitivity of 8 or more for an on-screen cursor;
- work in "player space", relative to how the player holds the pad, rather than raw sensor axes;
- speed up between two thresholds, and never use cut-offs or heavy smoothing.

Absolute left-right heading drifts without a compass ([GamepadMotionHelpers](https://github.com/JibbSmart/GamepadMotionHelpers)). Pointing therefore uses rotation speed, with a clutch button for re-centring. Tilt effects, such as steering gravity or flow, use only the accelerometer's gravity direction, which does not drift.

The input design treats each pad as **one or two "virtual fingers"**:

- the left stick moves finger one;
- the right stick places finger two, for pinching and rotating;
- the analog triggers set pressure or push particles away;
- the shoulder buttons switch tools;
- a DualSense or DualShock touchpad maps straight to two fingers.

Eight player slots each carry a colour, a cursor shape and a number, so colour-blind players can tell them apart. The colour is mirrored on DualSense light bars and player lights where WebHID allows. Accessibility needs full remapping, hold-or-toggle options, one-handed presets and support for the Xbox Adaptive Controller, which has no rumble motors ([Chromium](https://github.com/chromium/chromium/blob/main/device/gamepad/gamepad_device_linux.cc)).

Haptics should be short personal accents of 30–120 ms, triggered by an event one player caused and felt only by that player. Sustained effects are renewed in chunks of 200–500 ms. All haptics are timed from the audio clock and always paired with a visual or audio equivalent, in line with Apple's advice to avoid overusing haptics ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)).

## Music should bend the light that hands are making

System audio, meaning whatever the computer is playing, is the input users expect from visualisers like MilkDrop and Wallpaper Engine. Electron 45 covers Windows and macOS with one code path:

1. The page calls `getDisplayMedia({video: true, audio: true})`. It must ask for video, or the call fails ([MDN](https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/mediadevices/getdisplaymedia/index.md)).
2. The main process answers with **`audio: 'loopback'`, documented as supported on Windows and on macOS 14.2 and later** ([Electron](https://raw.githubusercontent.com/electron/electron/main/docs/api/session.md)). It never uses the variant that mutes the speakers.
3. The page drops the video track.

Electron 45 now sends these requests to the permission handler as `display-capture` rather than `media` ([Electron](https://raw.githubusercontent.com/electron/electron/main/docs/breaking-changes.md)).

On macOS, system-audio capture needs an `NSAudioCaptureUsageDescription` entry in the app and the "System Audio Recording" permission. **If the permission is missing or denied, capture fails silently: the audio track arrives already ended and never delivers sound** ([Electron](https://raw.githubusercontent.com/electron/electron/main/docs/api/desktop-capturer.md)). An ended track, or silence in the first second, must trigger setup help. Apple's capture API starts at macOS 14.2 ([Apple](https://developer.apple.com/documentation/coreaudio/capturing-system-audio-with-core-audio-taps)), so macOS 13.0–14.1 is best effort.

On Linux, the same request reaches Chromium's PulseAudio capture, which records the default output device ([Chromium](https://raw.githubusercontent.com/chromium/chromium/main/media/audio/pulse/pulse_loopback_manager.cc)). Electron only promises Windows and macOS, though, so Linux desktops running PipeWire need testing, and a native capture helper should be kept in reserve.

Microphones and line-in come through `getUserMedia` with echo cancellation, noise suppression and automatic gain turned off. Electron builds include the patent-encumbered codecs, so MP3, AAC, FLAC, Opus and WAV files all play ([Electron](https://raw.githubusercontent.com/electron/electron/main/build/args/all.gn)). That matters because files can be analysed ahead of playback.

Analysis belongs on the CPU, in an AudioWorklet running at a fixed step, not on the GPU and not in the render loop:

1. **Frequency bands.** A 2048-point FFT every 256–512 samples (5.3–10.7 ms at 48 kHz) feeds 24–32 frequency bands spaced evenly in pitch. Each band rises fast and falls slowly, and is normalised to its own long-term average. projectM's bass, mid and treble values work the same way, hovering around 1.0, below 0.7 for quiet passages and above 1.3 for loud ones ([projectM](https://raw.githubusercontent.com/projectM-visualizer/projectm/HEAD/src/libprojectM/Audio/Loudness.hpp)).
2. **Onsets.** The change in each group of bands gives kick, snare and hi-hat hits.
3. **Tempo.** Comparing the onset pattern with itself over 6–8 seconds gives the tempo.
4. **Beats.** A real-time tracker predicts the next beat, as BTrack does ([BTrack](https://raw.githubusercontent.com/adamstark/BTrack/HEAD/README.md)). The first beat of each bar is set by a tap or by MIDI clock.

All of this costs tens of microseconds per step. A GPU FFT would add milliseconds of overhead for nothing, so the GPU only stores the spectrum history for visual effects.

Driving visuals from the browser's built-in `AnalyserNode` inside the render loop is a trap. The spec blends each smoothing step with the output of the previous call ([Web Audio spec](https://github.com/WebAudio/web-audio-api/blob/HEAD/index.bs)), so the smoothing probably changes with the screen's refresh rate. Every smoother should use time constants in seconds, so a 60 Hz and a 480 Hz display look the same.

The best existing libraries for this are copyleft: Essentia.js is AGPL-3.0, aubio is GPL-3.0 or later, BTrack is GPLv3, and madmom's trained models are for non-commercial use only ([Essentia.js](https://raw.githubusercontent.com/MTG/essentia.js/HEAD/LICENSE); [aubio](https://raw.githubusercontent.com/aubio/aubio/HEAD/COPYING); [madmom](https://raw.githubusercontent.com/CPJKU/madmom/HEAD/LICENSE)). The few hundred lines of core signal processing should therefore be written in house, borrowing only permissively licensed code.

Live audio features arrive **about 30–60 ms after the sound**:

| Delay source | Time |
|---|---|
| Capture buffering | 10–21 ms |
| One audio processing block | 2.7 ms |
| Half of the 2048-point analysis window | about 21 ms |
| Presenting a frame | up to 17 ms |

For live input, the engine hides this by firing beat pulses at the predicted next beat minus that delay, and by running a shorter 512-point analysis for sharp hits. For files, it analyses ahead and fires each event when its sound reaches the speakers, using `getOutputTimestamp()` ([MDN](https://github.com/mdn/content/blob/main/files/en-us/web/api/audiocontext/getoutputtimestamp/index.md)). An audio-visual offset slider from −150 to +150 ms, with tap-along calibration, covers Bluetooth headphones whose delay the app cannot see.

Musicians get exact sync two ways:

- **MIDI clock**, at 24 ticks per quarter note ([WebMidi.js](https://github.com/djipco/webmidi/blob/HEAD/src/Enumerations.js)). In Electron it needs a secure page and an explicit grant ([MDN](https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/navigator/requestmidiaccess/index.md)).
- **OSC** (Open Sound Control), received on a UDP socket in the main process that listens only on the local machine by default.

Ableton Link is GPL or proprietary ([Ableton](https://raw.githubusercontent.com/Ableton/link/HEAD/LICENSE.md)) and can wait.

The mapping rule is what makes Tactilume an instrument rather than a visualiser. **Audio scales and offsets settings the players already control, within about ±30%, and its effect drops by 50–80% while someone is steering**, so hands always feel in charge. One "Music reactivity" control (off, subtle, normal, wild), plus a sensitivity per band, sets how strong the effect is:

- slow bass drives large, slow effects;
- hits drive bursts at the players' touch points;
- treble drives fine shimmer, never full-screen brightness;
- the beat times automatic events, such as colour changes at the start of a bar;
- the musical key drives slow palette drift.

Safety arithmetic belongs here too. Sixteenth-note hi-hats at 128 BPM arrive about 8.5 times a second. Flashing the whole screen on every hit would therefore break the limit of three flashes per second, while one pulse per beat stays within it up to 180 BPM.

## Ten million particles at 240 Hz needs fields, not neighbours

Particle simulation at this scale is a memory-bandwidth problem. The best measured WebGPU result the research found is **10 million particles simulated and drawn at about 63 fps on a 2016 GTX 1060** ([TU Wien](https://www.cg.tuwien.ac.at/research/publications/2023/PETER-2023-PSW/), search summary only). That is about 1.6 ns per particle per frame, so 10 million particles at 120–240 Hz on current cards is realistic once each particle uses fewer bytes. No WebGPU benchmark at 100 million particles exists anywhere.

Methods where each particle reads its neighbours reach far lower counts:

- WebGPU-Ocean's SPH fluid mode reached about 30,000 particles on integrated graphics. Its grid-based MLS-MPM mode reached about 100,000 on integrated graphics and 300,000 on decent GPUs ([WebGPU-Ocean](https://github.com/matsuoka-601/webgpu-ocean/blob/HEAD/README.md)).
- Splash's experimental branch reached 1.6 million ([Splash](https://github.com/matsuoka-601/Splash/blob/HEAD/README.md)).
- A CUDA tree-based gravity simulation (Barnes–Hut) takes about 150 ms per step at 2 million particles ([nbody](https://github.com/lechebs/nbody)).

That evidence supports three tiers within one engine:

| Tier | Particles | Behaviours | Cost per particle |
|---|---|---|---|
| Ambient | 10M–100M tracers | ABC flow, curl noise baked into a 128³ half-float 3D texture (about 16 MB), the touch-force grid, a fluid velocity grid, shape and strange attractors | Fixed: a few texture samples or arithmetic steps |
| Interactive | 0.5M–4M, sorted into grid cells | Particle Life species rules, boids, SPH-style separation | Reads neighbours in 9 (2D) or 27 (3D) cells |
| Liquid | 0.1M–1.6M | MLS-MPM with fixed-point atomic adds into a grid | About 9 (2D) or 27 (3D) atomic adds |

For the 100-million tier, each particle's state should shrink to about 16 bytes:

- position: three 21-bit fixed-point coordinates packed into two 32-bit words;
- velocity: half-precision values;
- 16 bits of age and species;
- colour: derived at render time, not stored.

The arrays should be split by field ("structure of arrays"), with frequently and rarely used data apart, so that each array stays under the binding limit.

Many inputs must never mean many loops. Ten players with ten touches each and 32-segment trails produce 3,200 segments. Testing each against 100 million particles would take 3.2 × 10¹¹ tests per step. Instead, **every input is drawn once per frame into a low-resolution half-float force and velocity texture**; 16-bit float blending is core WebGPU ([WebGPU spec](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs)). That texture can optionally run through a "stable fluids" step, the classic GPU Gems technique ([NVIDIA GPU Gems](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu)), and each particle samples it once.

Only the handful of gamepad cursors and fixed attractors, up to about 64 point sources, are tested exactly against every particle, so they feel crisp. Each player's strength is normalised, so one ten-finger phone cannot dominate.

This is also the case for writing custom WGSL rather than building on a general engine. The techniques that matter here are not what general engines optimise for: fixed-point atomic splats, force-grid input and choosing the drawing method per particle by size. three.js and Babylon.js remain permissively licensed references to learn from.

Stability and portability need deliberate code:

- **Fixed timestep.** The simulation runs at a fixed 1/240 s step, with at most about eight steps per frame. Excess time is discarded rather than allowed to spiral.
- **NaN guard.** WGSL lets compilers assume that NaN and infinity never occur, so an `x != x` check may be optimised away ([WGSL](https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs)). The guard tests the number's bit pattern through a `bitcast` instead, and respawns any bad particle.
- **Sorting and scanning.** These must avoid the fastest single-pass technique ("decoupled look-back") unless it has a fallback. **It can lock up an entire Apple machine, because Apple and ARM GPUs do not guarantee that waiting threads make progress** ([Gridwise](https://github.com/gridwise-webgpu/gridwise/blob/main/docs/scan-and-reduce.md)). PlayCanvas enables its fastest sort only on NVIDIA for the same reason ([PlayCanvas](https://github.com/playcanvas/engine/blob/HEAD/src/scene/graphics/radix-sort/)). The portable path is multi-pass scanning with counting-sort binning that does not depend on subgroup operations.
- **Licences.** Most useful references are permissively licensed, including EA's PB-MPM sample under BSD-3-Clause ([EA](https://github.com/electronicarts/pbmpm)). One popular GPU sorting repository bundles LGPL-2.1 code under its MIT label, so every file needs checking before it is copied in ([GPUSorting](https://github.com/b0nes164/GPUSorting/blob/HEAD/LICENSE)).

## Fixed-point splats and convolutions stand in for ray tracing

WebGPU points are exactly one pixel, with no size control ([WebGPU spec](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs)), so the renderer chooses a drawing method per particle by its size on screen. For particles about two pixels across or smaller, a compute shader "splats" each one: it adds the particle's light into fixed-point red, green and blue buffers with 32-bit integer `atomicAdd`, and a final pass converts the sums into an image. The evidence for this approach:

- Markus Schütz's native compute rasterizer is **10–100 times faster than built-in point drawing in OpenGL, drawing about a billion opaque points in about 8 ms on an RTX 3090** ([compute_rasterizer](https://github.com/m-schuetz/compute_rasterizer/blob/master/README.md)).
- Aras Pranckevičius reports about a fivefold gain over WebGPU's built-in points across more than 30 GPUs, but only from a search summary of the densest test case ([Aras](https://aras-p.info/blog/2025/08/24/This-many-points-is-surely-out-of-scope/)).
- When many threads hit the same memory address, WebGPU atomics still reach 62 billion operations a second on an RTX 4090 and 20 billion on an M1 Max ([PWhiddy](https://github.com/PWhiddy/webgpu-atomics-benchmark/blob/main/README.md)).

Fixed point is also more correct. **Half-float blending drops faint light: 10,000 additions of 0.001 stall at exactly 4.0 instead of reaching 10.** Integer sums are exact and do not depend on order, which suggests the current WebGL2 edition already loses brightness in dense regions.

Large, soft or blurred sprites stay as instanced quads (small textured rectangles). They can write into the same fixed-point buffer from their fragment shaders ([WGSL](https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs)). Because additive light does not depend on drawing order, nothing needs sorting.

At 100 million particles, three atomic adds per particle become 300 million per frame, which is too slow for 240 Hz. Several techniques reduce that cost:

- adding up light per screen tile in fast shared workgroup memory first (a 32×32 tile with three colour channels needs 12 KB, well inside the 32 KiB that Direct3D 12 and Apple-silicon Metal expose);
- ordering particles so neighbours in space sit together in memory;
- combining adds across a subgroup of threads where the hardware supports it.

The "ray-traced" look for this kind of art does not need ray tracing. **Light sources that only add light and never block each other turn global illumination into simple blurs and second splats:**

- **Pools of light on a virtual floor** become a blur whose width depends on each particle's height.
- **Mirror and water reflections** become a second splat of the particles flipped across the floor, at about a quarter more splat cost.
- **Volumetric glow and light shafts** come from sorting particles into a coarse 3D grid that records both light and density, then stepping a ray through it. Assassin's Creed IV used this approach in about 1.1 ms on 2013 consoles ([Game Developer](https://gamedeveloper.com/programming/atmospheric-scattering-and-volumetric-fog-algorithm-part-1), search summary only).
- **Soft shadows around solid shapes** are the only effect that needs a lighting technique: 2D radiance cascades. Their holographic variant took 1.85 ms at 512×512 on an RTX 3080 laptop GPU ([arXiv](https://arxiv.org/pdf/2505.02041)), so they should run at reduced resolution.

Full 3D global illumination, by voxel cone tracing or light propagation volumes, costs too much for 240 Hz.

The notes estimate the budget for a mid-range card at 4K and 240 Hz, where a frame lasts 4.17 ms. These figures are untimed estimates:

| Work | Estimated time |
|---|---|
| Simulating and splatting about 15M particles | 1.5–2.5 ms |
| Converting the splat buffers and drawing trails | 0.3 ms |
| Bloom glow | 0.3–0.5 ms |
| Floor light and reflection at half resolution | 0.3–0.6 ms |
| Tone mapping, dithering and the flash guard | 0.2–0.3 ms |
| Browser and compositor overhead | about 0.5 ms |

Temporal anti-aliasing, which blends each frame with the last, suits additive particles badly, so edges are smoothed at splat time instead. Trails need half-float buffers with dithering. At 240 Hz, an 8-bit fade freezes almost immediately, and an 11-bit fade stalls beyond about half a second.

Colour is processed in linear light, with 1.0 meaning SDR paper white. Bloom and exposure come next, then one display transform set by the calibrated peak brightness and paper white, then dithering and encoding. Three tone-mapping operators fit:

- **ACES 2.0**, available as a preview in OpenColorIO 2.4, takes the peak brightness and colour-gamut limits as parameters ([OCIO](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/main/docs/releases/ocio_2_4.rst)).
- **Gran Turismo 7's operator**, from Polyphony Digital, is designed for HDR first and is MIT-licensed ([CustomToneMappingURP notices](https://github.com/aki-null/CustomToneMappingURP/blob/main/THIRD_PARTY_NOTICES.md)).
- **Khronos PBR Neutral** preserves hue but outputs SDR only ([Khronos](https://github.com/KhronosGroup/ToneMapping/blob/main/PBR_Neutral/README.md)).

The OKLab colour space belongs in palette design, never in adding light together.

Capture, the feature Uzu users asked for most, comes almost free: the renderer draws into its own textures, and the on-screen canvas is just one destination. Copying a frame out to memory requires each row to be a multiple of 256 bytes ([WebGPU spec](https://github.com/gpuweb/gpuweb/blob/main/spec/sections/copies.bs)), and a 4K half-float frame is 66.4 MB. Real-time recording should therefore compress frames on the GPU first, and high-quality clips can be rendered offline at a fixed timestep.

### The flash guard is the one hard requirement

Protecting people with photosensitive epilepsy is the one hard requirement the research produced, and HDR makes it harder.

WCAG 2.3.1 allows **no more than three general or red flashes in any second, unless the flashing area stays within 0.006 steradians (about a quarter of any 10° patch of vision)** ([WCAG](https://github.com/w3c/wcag/blob/main/guidelines/terms/20/general-flash-and-red-flash-thresholds.html)). Its definitions:

- **General flash:** a pair of opposite changes of at least 10% in relative brightness, where the darker state is below 0.80.
- **Red flash:** a change to or from saturated red, meaning red makes up at least 80% of the colour, with a colour shift above 0.2 on the CIE 1976 chart.

For HDR, WCAG adopts the absolute rule from the broadcast standard ITU-R BT.1702 ([WCAG Understanding](https://github.com/w3c/wcag/blob/main/understanding/20/three-flashes-or-below-threshold.html)):

- below 160 cd/m², a flash is a change of 20 cd/m² or more;
- above 160 cd/m², it is a contrast ratio (Michelson contrast) of 1/17 or more.

The limiter must therefore work in absolute brightness (nits), and a scene can pass in SDR and fail in HDR.

Flashing area must be measured as an angle of vision, not a share of the screen. At a 60 cm desk distance, 0.006 steradians is about 22 cm². That is **roughly 1% of a 27-inch screen, about twenty times stricter than the Xbox guideline's 20% of the screen** ([Xbox Accessibility Guideline 118](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/118)). At 2.5 m from a 65-inch TV it is about 3%. The app therefore needs the screen size and viewing distance, with a cautious desk-distance default.

The guard works on the final displayed frame:

1. It measures brightness and redness on a coarse grid.
2. It counts brightness changes over real time rather than frame counts.
3. It acts at 2 flashes per second, the warning level of EA's open-source IRIS checker, by fading the offending regions.
4. It reduces red saturation where red changes pile up.

Its estimated cost is under 0.05 ms per frame. IRIS (BSD-3-Clause) runs on recorded video in automated tests ([EA IRIS](https://github.com/electronicarts/IRIS/blob/main/README.md)). Release trailers and recorded sessions need the commercial Harding test, because the terms of the free PEAT tool exclude commercial games ([MDN](https://github.com/mdn/content/blob/main/files/en-us/web/accessibility/guides/seizure_disorders/index.md)). The research found no studies of photosensitivity thresholds specific to HDR, which is a reason to cap peak brightness for large changes.

## Design a many-handed instrument, not a bigger Uzu

Put together, the research points to a clear product: an instrument for a room. **Many hands play it, each belonging to a player with their own colour family, tool and sound**, acting on curated "worlds" instead of a ladder of modes. Uzu's finger-count chords cannot survive the move anyway, because a phone held in one hand offers one to three fingers and a gamepad offers two sticks. The organising principle becomes who is playing and which world they are in.

Worlds come from the three simulation tiers: an ambient field, a Particle Life ecology, a liquid, an attractor sculpture. Each has its own settings, and worlds are the unit of curation, sharing and seasonal updates, in the spirit of Panoramical's curated landscapes and Electroplankton's many small toys with one idea each.

A few verbs (push, pull, swirl, emit, freeze, paint) work on every controller:

- phone fingers become strokes in the force grid;
- phone tilt steers gravity or flow, in the HTTPS mode and the app;
- gamepad sticks drive attractor cursors and triggers set strength;
- the gyro is a pointer with a clutch;
- rumble marks collisions and beats.

The phone's own screen solves Uzu's discoverability problem without putting controls on the big screen. It shows each player's tool, palette and hints, and offers a one-tap "surprise me" that answers Uzu users' request for "randomize all".

The "next generation" promise rests on four things that no surveyed toy advertises together:

- HDR highlights that read as real light above SDR white, set by an in-game brightness calibration and capped for large changes;
- 120–240 Hz motion with smooth trails;
- several players at once on phones and gamepads;
- two-way audio that reacts to whatever is playing and, as a later step, gives each player a generated sound.

Comfort is a feature for the audiences that adopted Uzu informally: children, therapy users and autistic users. The defaults are a calm profile, "reduce flashing" switched on, a photosensitivity notice before the first music-reactive session, no strobe presets, session timers, a caregiver lock and colour-blind-safe palettes.

Capture and sharing ship in version 1: short looping clips, high-resolution and HDR stills, and scene codes that reproduce a world's settings. Ambient modes (drift, attract, wallpaper and second screen) serve the passive use that apps like Reflection and Wallpaper Engine proved. An optional VJ mode, with clean output, MIDI clock and OSC, opens club use. Video-sharing outputs such as NDI, Spout and Syphon were not researched and need their own investigation. A visible update rhythm answers Uzu's multi-year gaps, and Electron's eight-week major releases enforce one anyway.

Underneath, one design carries everything. Every phone and every gamepad becomes a "session" that sends timestamped virtual fingers into one input queue. One simulation event stream drives visuals, audio cues and haptics, so a burst a player causes lights up, sounds and rumbles for that player alone.

| Layer | Choice | Fallback | Biggest open risk |
|---|---|---|---|
| Shell | Electron 45 (Chromium 156), electron-builder, `app://` protocol, phone server in a separate process | None | Upgrading a major version every 8–16 weeks |
| GPU | WebGPU compute, splats or quads chosen by particle size, higher memory limits requested | Existing WebGL2 renderer (2M particles) | Budgets unmeasured; forced WebGPU on Linux AMD untested |
| HDR | Half-float canvas with extended tone mapping, sRGB-encoded, user brightness calibration | SDR default look | HDR output not yet seen on any OS |
| Browser phones | WebSocket plus WebRTC data channel; HTTPS mode with motion | Plain-HTTP touch-only mode | Real-device latency; behaviour after accepting a self-signed certificate |
| Android app | Kotlin TLS with a pinned key plus UDP; system device picker | QR code or typed IP, TCP only | Scope of the picker grant; web-to-native bridge latency |
| Gamepads | Gamepad API plus WebHID for Sony and Nintendo pads | Steam Input's virtual pad | Steam Input with WebHID; exclusive device access |
| Audio | System audio via `getDisplayMedia`; in-house analysis in an AudioWorklet; MIDI clock and OSC | Microphone, line-in, files | Linux capture under PipeWire; measured latency |
| Safety | Final-frame flash guard in nits; IRIS in automated tests; Harding test for release | Calm profile | HDR thresholds unresearched |
| Distribution | GitHub Releases with electron-updater; Flathub; signed and notarized builds | Microsoft Store for free Windows signing | Artifact Signing eligibility; Steam overlay |

## Conclusion

The research changes where Tactilume's ambition should go. Particle count, the obvious "next-gen" metric, is the least certain number in the plan. It is modelled from unsourced factors, capped by bandwidth on the median 8 GB, 1080p Steam PC, and swings two- to fourfold with data layout. The features that make the product distinctive are cheap and well understood: drawing every player's input into one force grid, smoothing out network jitter, giving each player an identity and their own haptics, and a limiter that lets HDR ship safely. **The competitive edge is many hands, not many particles.** An engine that fills a 240 Hz frame with six million particles and eight responsive players beats one that reaches fifty million for a single mouse. The same logic answers the requirements question. Requirements stop being a guess once the machine measures itself, the developer's measured profile becomes the starting point for every similar machine, and opt-in calibration results become the fleet data the research could not find.

The first milestone should therefore measure, not add features. Nearly every open risk can be settled within a few weeks on three computers (a Windows PC with a discrete GPU, an Apple-silicon Mac and a Linux AMD machine) and two phones (an iPhone and the user's Moto G Stylus):

- real-GPU particle and splat throughput;
- HDR output;
- phone-to-screen latency over Wi-Fi;
- Linux audio capture and forced WebGPU on AMD;
- Android 17's device picker in practice;
- Steam Input's effect on WebHID.

Until those numbers exist, every tier, default and protocol choice above is a hypothesis.
