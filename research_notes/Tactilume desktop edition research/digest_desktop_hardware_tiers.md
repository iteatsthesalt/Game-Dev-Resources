# Fact-checked digest of desktop_hardware_tiers.md

Source: `desktop_hardware_tiers.md`, fact-checked 2026-11-12, plus one later correction from measured container facts. Its Verification table has 18 rows: 13 confirmed, 2 corrected, 3 unverifiable.

**Tags.** [Verified]: re-read in the named primary source. [Verified correction]: the original was wrong; corrected text given. [Unverified]: source unreachable. (search summary): WebSearch summary only; Valve's tables were never opened. [Untagged]: not fact-checked. calc: the notes' arithmetic. Inference: planning advice. Measured: this container (headless Chromium 153.0.8010.12, Playwright 1.63.0, Linux, SwiftShader fallback adapter, only `--enable-unsafe-webgpu`); software results, not GPU data.

**Source keys.** CR156 = https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/ (pinned by Electron 45); CRMAIN = https://raw.githubusercontent.com/chromium/chromium/main/; BCD = https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/; SPEC = https://raw.githubusercontent.com/gpuweb/gpuweb/main/spec/index.bs; DAWN = https://raw.githubusercontent.com/google/dawn/main/src/dawn/gpu_info.json; EDOCS = https://raw.githubusercontent.com/electron/electron/main/docs/api/; METAL = https://developer.apple.com/documentation/metal/.

## 1. Runtime platform facts

**Versions**
- Electron 45 pins Chromium 156.0.8078.96 (42 = 148.0.7778, 41 = 146.0.7680, 43 = 150.0.7871, main = 159.0.8154). [Verified: https://raw.githubusercontent.com/electron/electron/45-x-y/DEPS; .../42-x-y/DEPS; .../main/DEPS]
- Electron 45 runs on Windows 10+ and macOS 13+, not macOS 12. Windows 10 22H2 can be the Minimum OS, labelled "unsupported by Microsoft". [Verified: https://raw.githubusercontent.com/electron/electron/v45.3.0/README.md]

**GPU selection**
- **Windows ignores `powerPreference`.** Chrome logs a warning (crbug.com/369219127) and uses its allocated adapter, on laptops "generally the integrated graphics card". [Verified: CRMAIN/third_party/blink/renderer/modules/webgpu/gpu.cc]
- Dawn takes ANGLE's D3D11 adapter LUID, so only moving the whole GPU process to the dGPU helps. [Verified: CR156/gpu/command_buffer/service/webgpu_decoder_impl.cc]
- **Workarounds:** Windows Graphics → High performance, or chrome://flags/#force-high-performance-gpu [Unverified: developer.chrome.com blocked]. Chromium 156 has a `force-high-performance-gpu` switch [Verified it exists: CR156/gpu/config/gpu_switches.cc; Windows effect untested]. Electron's documented `--force_high_performance_gpu` [Verified: EDOCS/command-line-switches.md] reportedly does nothing on Windows [Unverified: electron#31355, foundryvtt#12489].
- Dual-GPU Intel Macs default to the discrete GPU on AC and the low-power GPU on battery. [Verified: BCD/GPU.json; CR156 webgpu_decoder_impl.cc] Apple silicon has one GPU. [Verified: METAL/mtldevice/islowpower]
- `powerPreference` is only a hint. With "high-performance", user agents are "more likely to force device loss", so handle `device.lost`. [Verified: SPEC]

**Adapter identity**
- **Default `GPUAdapterInfo`** carries `vendor`, `architecture`, subgroup sizes and `isFallbackAdapter`; `device`/`description` stay empty unless `--enable-webgpu-developer-features` (off by default) adds the PCI ID, driver name and heaps. Do not ship that flag: it adds fingerprinting surface, and Electron already supplies PCI IDs. [Verified: CRMAIN/third_party/blink/renderer/modules/webgpu/gpu_adapter.cc; CR156/gpu/config/gpu_switches.cc; CR156/content/child/runtime_features.cc] Measured: "google" / "swiftshader" / true / empty description.
- `isFallbackAdapter` arrived in Chrome 136. [Verified: BCD/GPUAdapterInfo.json]
- **Dawn architecture strings** by PCI-ID range: NVIDIA `turing`…`blackwell`; AMD `gcn-1`…`rdna-4`; Intel `gen-9`…`gen-12-hp`, `xe-lpg`, `xe-2-lpg`, `xe-2-hpg`, `xe-3-lpg`; Qualcomm `adreno-6xx/7xx/8xx`; software SwiftShader 0x1AE0, WARP 0x1414, Mesa 0x10005. Apple reports no device ID, only the Metal family `common-N`. [Verified: DAWN]
- The unmasked WebGL renderer string (`WEBGL_debug_renderer_info`) is available. Measured.
- **`app.getGPUInfo('basic')`** returns each GPU's decimal PCI vendorId/deviceId with `active`, plus `optimus`/`amdSwitchable` and `machineModelName`. It rejects if the GPU is disabled, and changes fire `gpu-info-update`. [Verified: EDOCS/app.md]
- Electron can disable GPU access after repeated crashes. [Verified: https://github.com/electron/electron/pull/52072]

**Default WebGPU availability**
- **Linux (Chromium 156):** allowed only for Intel Gen12+ on Mesa ≥ 22.0 and NVIDIA proprietary drivers ≥ 535.183.01 (since 148). AMD and older Intel are blocked. Steam Deck, Steam Machine and (unverified headline) about two-thirds of Linux Steam users therefore get WebGL2 unless WebGPU is force-enabled. BCD's "Intel Gen12+ only" is too narrow. [Verified correction: CR156/gpu/config/software_rendering_list.json]
- **Windows on Arm:** Qualcomm is on by default (`kWebGPUQualcommWindows`). Drivers 31.0.110–116 on Adreno 7xx device 0x36334330 (X1 generation) are blocklisted. [Verified: CR156/gpu/config/gpu_finch_features.cc; CR156/gpu/config/webgpu_blocklist_impl.cc]
- **CPU adapters** are blocklisted without `--enable-unsafe-webgpu`. Machines without a usable GPU get no adapter and need WebGL2. [Untagged]

**Limits and features**
- Defaults are `maxStorageBufferBindingSize` 128 MiB and `maxBufferSize` 256 MiB; request higher limits at device creation. [Verified: SPEC] Measured: SwiftShader offers 1 GiB for both.
- Browsers expose at most 32 capability buckets, so limits are caps, not a speed proxy. [Verified: SPEC]
- An unrequested 128 MiB binding holds about 2.8M particles at 48 B, 4.2M at 32 B, or 8.4M with a 16 B SoA layout. (calc)
- Measured: `timestamp-query` and `subgroups` (size 4) are present and `shader-f16` is absent, so keep f16 optional (Inference).

**Memory, display, power, HDR**
- `navigator.deviceMemory` on desktop reports 2/4/8/16/32 from Chrome 147; before that it was capped at 8. 24 GB reads as 16 and 64 GB+ as 32 (calc). Measured 16 on 16 GB. Prefer `process.getSystemMemoryInfo().total` (KB, exact). [Verified: BCD/Navigator.json; CRMAIN/third_party/blink/common/device_memory/approximated_device_memory.cc; EDOCS/process.md]
- `Display` exposes `displayFrequency`, `colorDepth`, `depthPerComponent`, `colorSpace`, `scaleFactor`, `size` and `internal`. No web refresh-rate API exists, so read `displayFrequency`. [Verified: EDOCS/structures/display.md]
- **`powerMonitor`:** `isOnBatteryPower()`; `on-ac`/`on-battery` on macOS and Windows only (Linux must poll); `thermal-state-change` on macOS; `speed-limit-change` on macOS and Windows (below 100 means throttling). [Verified: EDOCS/power-monitor.md]
- **HDR:** a canvas with `rgba16float` + `toneMapping: {mode: "extended"}` is in Chrome 129+ [Verified: BCD/GPUCanvasContext.json]. Measured: accepted and echoed by `getConfiguration()`; API only, since WebGPU canvas presentation fails in this container. `dynamic-range: high` reports capability, not active HDR [Untagged: MDN]. Electron does not document which `colorSpace`/`depthPerComponent` values mean HDR is on.

## 2. Tier model

- **Tier keys (Inference):** bandwidth first, then single-issue FP32, then VRAM. Halve RDNA 3/4 dual-issue TFLOPS: the 780M is only 5–10% faster than the 680M despite 2× the paper figure. Benchmark laptops: iGPU bandwidth follows RAM (two "780M" laptops differ by about 30%), and dGPUs vary with TGP.
- **Floors (Inference):** Minimum ≥ ~60 GB/s, 2 TFLOPS, 2 GB; Recommended ≥ 250 GB/s, 10 TFLOPS, 8 GB; High ≥ 440 GB/s, 20 TFLOPS, 12 GB; Ultra ≥ 880 GB/s, 40 TFLOPS, 16 GB.
- **Representative GPUs** (peak GB/s · FP32 · VRAM). [Unverified: secondary spec sites; nvidia.com and apple.com unreachable]
  - Minimum: GTX 1650 (128–192 · 2.9 · 4 GB); Iris Xe (~51–68 calc · ~2); Radeon 680M/780M (~90–120 calc · 3.4–4.5); 890M (~1.2–1.3× 780M); Arc 140V (~136 · 4.2); Arc B390 (74 vs 153.6, disputed · 7.7); Apple M1–M5 base (68–153.6); Adreno X2-90 (152–228 · 7.0–7.6).
  - Recommended: RTX 3060 12 GB (360 · 12.7); RTX 4060 (272 · 15.1 · 8); RTX 4060 Laptop (256–272); RX 7600 (288 · 10.9 · 8); RX 9060 XT (~320 · 13); Arc B570 (380 · 10 GB); Arc B580 (456 · 13.7–14.6 · 12); Arc A750 (512 · 17.2 · 8); Radeon 8060S (256 · 14.85); M4 Pro (273); M5 Pro (307).
  - High: RTX 5070 (672 · 30.9 · 12); RTX 5060 Ti 16 GB (448 · 23.7); RX 9070 XT (640 · ~24 · 16); M4 Max (≤ 546); M5 Max (460/614). The RTX 5070 Laptop has 448 GB/s but only 8 GB.
  - Ultra: RTX 5070 Ti (896 · 43.9 · 16); RTX 5080 (960 · 56.3 · 16); RTX 5090 (1,792 · 104.9 · 32); M5 Ultra ~1.2 TB/s (secondary only).
- **Macs (Inference):** base M chips are Minimum, Pro chips Recommended and Max chips High. This needs the chip variant and GPU-core count, which WebGPU hides.
- **Installed base** is stable through 2027: no new desktop GPUs in 2026; RTX 50 Super at CES 2027 at the earliest, RTX 60 ~2028, RDNA 5 2H 2027+. [Untagged: Tom's Hardware, PCGH]

## 3. Particle budget (calc; inputs are assumptions)

- **Rule:** N × bytes per particle per frame × Hz ≤ usable bandwidth − resolution overhead. Usable = η·φ·peak = 0.8 × 0.5 × peak (both unsourced; calibrate in the app). Lean/typical/heavy = 80/128/256 B.
- **Overhead** (RGBA16F post, ~64 B/px/frame), in GB/s at 60/144/240 Hz: 1080p 8.0/19.1/31.9; 1440p 14.2/34.0/56.6; 4K 31.9/76.4/127.4.
- **N_max at 128 B:** Iris Xe ~2.5M at 1080p60 (close to the mobile edition's 2M); RTX 4060 ~4.9M at 1080p144, ~12M at 1440p60; RTX 5070 ~12.7M at 1440p144, ~6.9M at 1440p240; RTX 5080 ~16.7M at 4K144; RTX 5090 ~35M at 4K144, ~89M at 4K60. [Verified: arithmetic recomputed; inputs assumed, peak bandwidths unverified]
- **What fits at 128 B:** 1M at 240 Hz fits all but the weakest iGPUs. 10M at 144 Hz needs RTX 5070 class. 50M at 60 Hz needs an RTX 5080/5090, and 50M at 144 Hz only an RTX 5090 with the lean layout. 50M at 240 Hz fits no single GPU.
- **Fill on immediate-mode GPUs:** about 16 B of DRAM per blended RGBA16F fragment; 1M glow sprites × 64 px × 60 Hz ≈ 61 GB/s, more than Iris Xe's whole usable budget. Apple TBDR blends in tile memory, so fill mostly vanishes on Macs. [Verified: METAL/tailor-your-apps-for-apple-gpus-and-tile-based-deferred-rendering] Ignoring caches makes the model conservative for 1M-class scenes.
- **Footprint** (ping-pong 32/48 B): 1M takes 64/96 MB, 10M 0.64/0.96 GB, 50M 3.2/4.8 GB, so 50M needs at least 8 GB VRAM. On Macs, stay under `recommendedMaxWorkingSetSize`. [Verified: METAL/mtldevice/recommendedmaxworkingsetsize]
- **FLOPs rarely bind:** 10M × 1,000 FLOPs × 144 Hz = 1.44 TFLOP/s, against about 15 TFLOPS on an RTX 4060.
- **Measured software floor:** SwiftShader took 22 ms per frame at 20k particles and 131 ms at 300k (32 B compute step + 1-px additive point draw, offscreen): about 0.9M and 2.3M particle-updates per second (a two-point fit gives ~14 ms fixed cost per frame), 65–165× below Iris Xe's ~150M per second. It cannot hold 60 Hz even at 20k. [Verified correction: measured in this container]
- **Design (Inference):** make particle count, sprite size/glow radius and render scale separate knobs. Above 240 Hz, run a fixed 120/240 Hz simulation and interpolate rendering. Ultrawide 3440×1440 has 34% more pixels than 1440p.

## 4. Steam survey, October 2026 (all search summaries, not verified)

- **OS:** Windows 93.70%, Linux 3.95%, macOS 2.35%. [Unverified; reported independently in https://phoronix.com/news/Steam-Survey-October-2026] Windows 11 72.51%, Windows 10 21.11%.
- **Linux:** flat against September's revised 3.90%, with a 2026 peak of about 5.33% in March. [Unverified] CachyOS 16.39%, SteamOS Holo 13.89%, Arch 8.92%. AMD has about two-thirds (headline). (PBX Science, ESReality)
- **Mac** (December 2025): about 85% Apple Silicon (M4 19.60%, M1 18.06%, M2 13.08%, Intel 14.36%). (AppleInsider)
- **CPU, RAM, VRAM:** 8-core 28.68%, 6-core 27.29%. RAM 16 GB 41.42%, 32 GB 37.06%. VRAM 8 GB 26.92%, 16 GB 26.35%, 12 GB ~13% (June), so about two-thirds have at least 8 GB (calc). (Wccftech, Guru3D)
- **GPUs:** RTX 3060 3.62% and RTX 5070 3.56% (the 5070 was #1 in September at 5.86%). The top six sit within 0.65 points, and the RTX 4060 Laptop led one earlier 2026 month. (TweakTown, Guru3D)
- **Displays:** 1080p 50.23%, 1440p 21.82%, 4K 5.05%. Valve publishes no refresh-rate or HDR data. (Hardware Busters, Wccftech)
- **Caveats (Inference):** opt-in survey; language-mix swings (Simplified Chinese down 9.41 points) drove the September-to-October reversals; Valve revises numbers. Use 3–6-month PC-only averages.
- **Median Steam PC (Inference):** Windows 11, 6–8 cores, 16–32 GB, an 8–16 GB RTX 3060/4060/5060 Ti-class GPU and 1080p. This anchors Recommended, not Minimum. A light-toy audience skews to iGPU laptops and Macs, so Minimum must work on integrated graphics.

## 5. Displays (secondary sources, untagged)

- **Monitors:** OLED monitors grew 98% year on year in Q2 2026 (TrendForce, 13 Aug 2026), and more than 4M are forecast for 2026. 27-inch 1440p 240 Hz is the growth segment. 480–520 Hz monitors ship, and 1,000 Hz panels were shown at Computex 2026. No trustworthy refresh-mix or HDR-prevalence data exists.
- **Laptops:** OLED is about 6% of notebook panels in 2026 (TrendForce, 29 Oct 2026), and new OLED notebook panels are 16:10.
- **HDR tiers:** DisplayHDR 400 is SDR-like (400 nits, 0.4-nit black). DisplayHDR 1000 means 1,000 nits and 0.05-nit black. (displayhdr.org)
- **Targets (Inference):** Minimum 1080p/1200p at 60 Hz, SDR; Recommended 1080p144 or 1440p60; High 1440p at 144–240 Hz, HDR optional; Ultra 4K at 120–144 Hz or 1440p at 360–480 Hz, OLED or DisplayHDR 1000. SDR is the default look; offer HDR when `dynamic-range: high` matches and/or `depthPerComponent` > 8.

## 6. Store requirement wording (Inference; comparables from search excerpts)

- **Comparables** (Tetris Effect, Universe Sandbox, Teardown, Wallpaper Engine and others) name reference GPUs "or equivalent", state VRAM, and add an iGPU line and an API floor.
- **Minimum (1080p60, ~1–2M):** Windows 10 22H2 64-bit, Apple Silicon M1 or 64-bit Linux with Vulkan; 4 cores; 8 GB RAM (16 with an iGPU); a WebGPU-capable GPU (DX12/Vulkan/Metal) such as Iris Xe, Radeon 680M, M1 or GTX 1650; 2 GB video memory, shared OK.
- **Recommended (1080p144 or 1440p60, ~5–10M):** Windows 11; 6C/12T; 16 GB; RTX 3060/4060, RX 7600/9060 XT, Arc B580, M4/M5 Pro or Ryzen AI Max; 8 GB VRAM.
- **High (1440p 144–240 Hz, ~10–15M):** 8C/16T; 16–32 GB; RTX 5070, RX 9070 XT, RTX 5060 Ti 16 GB or M4/M5 Max; 12 GB.
- **Ultra (4K 120–144 Hz or 1440p 360–480 Hz, 20–50M+):** 8+ cores; 32 GB; RTX 5080/5090 (5070 Ti entry); 16 GB+; OLED or DisplayHDR 1000.
- **Footnote and Linux line:** "Laptops with switchable graphics must run Tactilume on the discrete GPU." For Linux: "Intel Gen12+ (Mesa 22+) or NVIDIA (535.183.01+) for WebGPU; other GPUs run the WebGL2 renderer". [Verified correction: CR156/gpu/config/software_rendering_list.json]
- **Steam Deck/SteamOS scope** differs from desktop_app_shell.md. This is a product decision.

## 7. Detection and calibration (Inference on verified APIs)

- **Startup detection (~100 ms):** PCI IDs + `active`/`optimus`/`amdSwitchable` feed a local spec table, alongside `adapter.info`. A fallback adapter is below Minimum: warn and skip the benchmark. On Apple, use `machineModelName` plus the benchmark (whether `os.cpus()` gives the variant string is unverified). An internal display plus a battery means a laptop.
- **Hybrid laptops** (inactive dGPU, WebGPU on the iGPU): prompt once for Windows Graphics → High performance, then re-benchmark. Try Chromium's `--force-high-performance-gpu` first (untested).
- **Calibration:**
  1. Start from the spec prior; unknown and Apple GPUs start at Minimum.
  2. A ~1 s copy probe of 256 MB with `timestamp-query` (falling back to `onSubmittedWorkDone()`) calibrates η.
  3. Ramp for 10–15 s after a 2–3 s warm-up, at native resolution and `displayFrequency`: from 0.5× the prior, ×1.4 every 1–1.5 s, until p90 > 75% of the refresh period or the binding/VRAM cap; then bisect 2–3 times.
  4. Soak for 15–20 s at 85%. Cut 15% and flag the machine as thermal-limited if the last 3 s are > 10% slower, the speed limit drops below 100, or the thermal state reaches serious.
  5. Pick the highest tier whose target fits. Store the result per GPU PCI IDs, driver, display, refresh and power source. Re-run on `gpu-info-update`, a display or power change, or `device.lost`.
- **Defaults:** the default preset is "Auto (this machine)", public floors stay market-anchored, and Minimum is tested on an Iris Xe or 780M laptop.
- **Pitfalls:** battery saver (benchmark on AC, keep a battery profile); throttling (a governor sheds particles or render scale after more than 2 s over budget); VRR and occlusion distort rAF timing (use timestamps); background load; shader compilation (exclude it from measurements).
- **Ask users only** for laptop TGP, MUX status, monitor HDR tier and Apple GPU-core count.

## 8. Open gaps

- **No GPU measurements.** η, φ and bytes per particle are unsourced and the peak bandwidths unverified, so every tier particle target is modelled.
- **Windows dGPU forcing** from inside the app is untested.
- **Linux:** force-enabled WebGPU on AMD/Mesa and Linux PRIME offload were not researched.
- **HDR:** active-HDR detection is undocumented, and real HDR presentation is untested because presentation fails in this container.
- **Still open:** Steam figures need checking against Valve's tables; the B390 bandwidth and Arc B770 status are unresolved.
