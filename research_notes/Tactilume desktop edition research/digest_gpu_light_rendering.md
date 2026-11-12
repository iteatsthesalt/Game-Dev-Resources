This is the fact-checked digest of gpu_light_rendering.md (WebGPU light rendering for Tactilume Desktop: additive HDR particles, post effects, HDR output, flash safety and capture, as of 2026-11-12).

**Status.** The Verification table has 15 claims: 8 confirmed, 5 corrected, 2 unverifiable. Sources were re-read on GitHub (raw) and developer.apple.com. aras-p.info, arXiv, NVIDIA and AMD pages, itu.int and developer.chrome.com were unreachable. Two web searches covered Aras's result and GPU bandwidth.

**Tags.**
- [Verified]: re-read at the source.
- [Verified correction]: the original was wrong; the corrected text is given.
- [Unverified]: could not be checked.
- (search summary): snippet only.
- [Cited]: from the notes' sources, not re-checked in this pass.
- [Measured]: this container (headless Chromium 153.0.8010.12, Playwright 1.63.0, Linux, SwiftShader fallback, only `--enable-unsafe-webgpu`). These are software results, not GPU data, and not Electron.
- Inference: the notes' conclusion. calc: arithmetic.

**Source keys** (GitHub `blob` URLs):
- SPEC = https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs; COPIES and PRIV = spec/sections/copies.bs and privacy-and-security.bs in the same repo; WGSL = https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs
- DAWN = https://github.com/google/dawn/blob/main/src/dawn/ (native/Limits.cpp, native/d3d12/PhysicalDeviceD3D12.cpp, native/metal/PhysicalDeviceMTL.mm, common/Constants.h)
- APPLE = https://developer.apple.com/metal/Metal-Feature-Set-Tables.pdf
- CR156 / CR157 = https://github.com/chromium/chromium/blob/{156.0.8078.96 | 157.0.8103.81}/. DEC = gpu/command_buffer/service/webgpu_decoder_impl.cc; RTE = third_party/blink/renderer/platform/runtime_enabled_features.json5
- EL45 = https://github.com/electron/electron/blob/45-x-y/DEPS
- BCD = https://github.com/mdn/browser-compat-data/blob/main/api/ (GPUCanvasContext.json, GPUSupportedFeatures.json)
- HTML = https://github.com/whatwg/html/blob/main/source; CSSC4 = https://github.com/w3c/csswg-drafts/blob/main/css-color-4/Overview.bs
- THREE = https://github.com/mrdoob/three.js/blob/dev/; SAMPLES = https://github.com/webgpu/webgpu-samples/blob/main/
- WCAG-T = https://github.com/w3c/wcag/blob/main/guidelines/terms/20/general-flash-and-red-flash-thresholds.html; WCAG-U = https://github.com/w3c/wcag/blob/main/understanding/20/three-flashes-or-below-threshold.html
- IRIS = https://github.com/electronicarts/IRIS/blob/main/; FLIP = https://github.com/NVlabs/flip/blob/main/
- KHR = https://github.com/KhronosGroup/ToneMapping/blob/main/; ACES = https://github.com/ampas/{aces-output, aces-core, aces-dev}/blob/main/LICENSE; OCIO = https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/main/docs/releases/ocio_2_4.rst; URP = https://github.com/aki-null/CustomToneMappingURP/blob/main/
- CRAST = https://github.com/m-schuetz/compute_rasterizer/blob/master/; PW = https://github.com/PWhiddy/webgpu-atomics-benchmark/blob/main/

## Bottom line
- **Compute splat for small particles, quads for large ones.** Splat particles of about 2 px or less in a compute shader, with u32 fixed-point `atomicAdd` into storage buffers and then a resolve. Use instanced quads for large, soft or defocused sprites, chosen per particle by footprint. Additive light needs no sorting. (Inference)
- **Request limits at device creation.** Desktop adapters offer far more than the spec defaults: 32 KiB workgroup storage, large buffers and more storage buffers. [Verified correction: SPEC; DAWN; APPLE; Measured]
- **sRGB-encode HDR output** on the default `'srgb'` canvas. Linear writes need `'srgb-linear'`, which is Chromium 157+ and not in Electron 45. [Verified correction: HTML; CSSC4; CR156/CR157 RTE; EL45]
- **Guard flashes on the final frame.** Measure in absolute nits against WCAG 2.3.1 / BT.1702 [Verified: WCAG-T; WCAG-U], and gate releases with IRIS on rendered video [Verified: IRIS]. The guard design is an Inference.
- **Render into owned textures** and treat the canvas as one sink; capture with `copyTextureToBuffer`. In CI the canvas does not present, but offscreen rendering works. [Verified: COPIES; Measured]
- **Per-pass timing** needs unquantized timestamps (developer flag) on real GPUs. [Verified correction: DAWN Constants.h; CR156 DEC; Measured]

## 1. Splatting: compute vs hardware points
- **WGSL atomics.** Atomics are banned in vertex shaders, work only in storage or workgroup memory, and T is u32 or i32. There are no float atomics and no texture atomics, so voxelization goes to storage buffers. Fragment shaders may use storage atomics, so quads can share the fixed-point buffer. [Verified: WGSL]
- **Optional `atomic-vec2u-min-max`.** It adds 64-bit `atomicStoreMin`/`atomicStoreMax` on `atomic<vec2<u32>>` (storage only), with no 64-bit add, so it suits only opaque depth+colour packing. Chromium 156 (Electron 45) exposes it only at the experimental or unsafe safety level, and the measured adapter lacks it. [Verified: WGSL; CR156 DEC; Measured]
- **Points are exactly 1 px.** Rasterization picks "a single FragmentDestination ... within the pixel containing" the point, and there is no point size. [Verified: SPEC]
- **Schütz compute rasterizer:**
  - "10 to 100 times faster than GL_POINTS"; about 1B points in about 8 ms on an RTX 3090.
  - 64-bit depth+colour `atomicMin`; about 10k-point batches at 128 threads, about 80 points per thread.
  - 1.6 GB per 100M points plus 1 to 2 GB overhead; Windows and NVIDIA only; MIT.
  - These are opaque points, not additive.

  [Verified: CRAST README.md, LICENSE.md]
- **Contended WebGPU atomics:** 62B ops/s on an RTX 4090 and 20B ops/s on an M1 Max, all to a single address (15M threads x 32 adds), so aggregated; MIT. [Verified: PW]
- **Aras (August 2025):** compute is about 5x faster than built-in points on 30+ GPUs. A search summary ties the 5x to the dense case of 4M points in 5x5 px, with no subgroup tricks. [Unverified]
- **Earlier Schütz papers:** up to 144.7B points/s (2022), and 5.3x to 10x over GL_POINTS (2019). (search summary)
- **Additive cost.** Additive splats issue an atomic for every particle, unlike depth-tested points. Plan on 1B to 10B additive splats/s on high-end GPUs until benchmarked. 100M particles x 3 atomics is 300M atomics per frame, several milliseconds and too slow for 240 Hz. Mitigations: per-tile workgroup accumulation, Morton order, fewer channels, stochastic bilinear splats, subgroups. (Inference)
- **`subgroups`:** Chrome 134+ (Linux 144+), not Firefox; present on the measured adapter with size 4. [Verified: BCD; Measured]

## 2. Limits and features to request (spec default, then desktop)
- **`maxComputeWorkgroupStorageSize`:** 16,384 B by default. D3D12 gives 32,768; Metal gives `maxTotalThreadgroupMemory`, 32 KB on Apple4 to Apple11; measured 32,768. [Verified correction: SPEC; DAWN; APPLE; Measured]
  - calc: a 32x32 tile x 3 u32 is 12,288 B and x4 is 16,384 B. 3 channels + 3 carry words (24 KiB) fit in 32 KiB.
  - calc: a 2048-point complex fp32 FFT row (16 KiB) fits in 32 KiB with headroom.
  - fp16 rows need the optional `shader-f16` (Chrome 120+, adapter-dependent, absent on SwiftShader). [Verified: BCD; Measured]
- **Buffer sizes:** `maxBufferSize` defaults to 256 MiB and `maxStorageBufferBindingSize` to 128 MiB. D3D12 assumes 2 GiB (binding tier 2 GiB-4); measured 1 GiB for both. [Verified: SPEC; DAWN Limits.cpp, PhysicalDeviceD3D12.cpp, Constants.h; Measured]
  - calc: 100M x 16 B = 1.6 GB, so split it across 2 or more buffers. 100M x 8-12 B = 0.8-1.2 GB.
- **Dispatch size:** `maxComputeWorkgroupsPerDimension` is 65,535. 100M particles at 256 threads need 390,625 workgroups (calc), so use 2D dispatch or per-thread loops. [Verified: SPEC; Measured]
- **Storage buffers:** `maxStorageBuffersPerShaderStage` defaults to 8 (measured 10), so interleave R/G/B and the carry words in one buffer. `maxComputeInvocationsPerWorkgroup` is 256. [Verified: SPEC; Measured]
- **Format features:**
  - `float32-blendable` (Chrome 132+) is needed to blend into rgba32float.
  - `float32-filterable` is needed to filter it.
  - `rg11b10ufloat-renderable` is needed to render to rg11b10ufloat.
  - All three are present on the measured adapter.

  [Verified: SPEC; BCD; Measured]

## 3. Precision
- **fp16 swamping.** 10,000 x 0.001 stops at exactly 4.0 (the true sum is 10). At 4.0 or above, +0.001 rounds to no change; in [2, 4) it rounds up to 0.00195. [Verified: recomputed with numpy float16]
- **u32 fixed-point sums** are exact, order-independent and deterministic. The WebGL2 edition may already lose energy in dense regions. (Inference)
- **Fixed-point design** (Inference):
  - Use S = 2^12 to 2^16 counts per unit radiance, with stochastic rounding.
  - A carry happened when `old > 0xFFFFFFFF - v`; add it to a high-word buffer.
  - Resolve by multiplying by exposure/S, then clear.
- **Trail fade.** Use m = exp(-dt/tau). At 240 Hz, fades stall above tau of about 8.5 s (fp16), 0.53 s (R11/G11) and 0.27 s (B10), and rgba8unorm freezes almost at once. Use rgba16float with a blue-noise dither, or rgba32float for longer trails. [Verified: recomputed]

## 4. Anti-aliasing, blur, depth of field, TAA (Inference)
- **Anti-aliasing.** A bilinear tent splat (4 atomics) conserves energy; a stochastic single-pixel pick is unbiased at 1x.
- **Motion blur.** Use a segment splat with energy divided by length, and draw long sparks as quads.
- **Depth of field.** Spread energy over pi*r^2, and move large blurs to quads or mip-splatting.
- **TAA.** Keep particles out of TAA. Any temporal blend uses alpha = 1 - exp(-dt/tau).

## 5. Bloom and glare (estimates)
- **Pyramid bloom** (CoD AW 13-tap down / tent up, or dual-Kawase): about 0.2 to 0.6 ms at 4K and 0.1 to 0.3 ms at 1440p on mid-range GPUs. These are calc; no desktop timings were found.
- **luma.gl WebGPU FFT bloom at 1080p:** a 1024x512 FFT, 48 MiB and 45 dispatches. (search summary) A 4K FFT is estimated at 1 to 3 ms on mid-range GPUs. (Inference)
- **Plan:** pyramid bloom plus top-K starburst sprites, with an optional low-resolution FFT tier at 120 Hz. (Inference)

## 6. Volumetrics, GI, reflections (estimates)
- **Estimated costs** (Inference):
  - Floor light pools by mip splat: 0.1 to 0.3 ms.
  - Mirrored re-splat reflections: about +25% of the splat cost.
  - Froxel volume of 160x90x64 (about 15 MB with 4 u32 channels): 0.5 to 1.5 ms.
  - 2D radiance cascades at 1/4 to 1/8 resolution: 1 to 2 ms on high-end GPUs.
  - 3D cascades, voxel cone tracing and light propagation volumes are too costly for 240 Hz.
- **Anchors** (search summary): Holographic RC took 1.85 ms at 512^2 and 7.67 ms at 1024^2 (RTX 3080 Laptop). AC4 fog took about 1.1 ms. SSR took 1.7 to 4.15 ms at 1080p (GTX 1070).

## 7. HDR output and tone mapping
- **Tone-mapping modes.** `GPUCanvasToneMappingMode` is `"standard"` (default) or `"extended"`. Extended leaves values in the screen's extended range unchanged, possibly above 1, and the default `colorSpace` is `"srgb"`. In the spec's P3 example, (1.035, -0.175, -0.140) on an `'srgb'` canvas becomes P3 (0.948, 0.106, 0.01). [Verified: SPEC]
- **Support.** Chrome 129+ on ChromeOS, macOS and Windows, Linux from 144; not Firefox or Safari. Detect it through `getConfiguration()`. Chromium 153 accepts `rgba16float` + extended and reports it back. [Verified: BCD; SPEC; Measured]
- **Encoding.**
  - On an `'srgb'` canvas, values are gamma-encoded and sign-mirrored outside [0, 1]. Write sRGB_encode(L), where L = nits / SDR-white nits (L = 4 is written as 1.82).
  - Only `'srgb-linear'` takes linear values. Its flag `ColorSpacePredefinedLinearSpaces` is experimental in Chromium 153 and 156 and stable in 157, and Electron 45 pins Chromium 156.0.8078.96.

  [Verified correction: HTML; CSSC4; CR156/CR157 RTE; EL45]
- **three.js:** HalfFloat output sets canvas tone mapping to `'extended'` with RENDER_ATTACHMENT|COPY_SRC usage; MIT. [Verified: THREE]
- **webgpu-samples particles:** `rgba16float`, standard or extended, brightness 0 to 4, `(dynamic-range: high)`; BSD-3. [Verified: SAMPLES]
- **Khronos PBR Neutral:**
  - Apache-2.0 and hue-preserving.
  - sRGB output only, with no gamut mapping and Rec.709 input.
  - Output is linear in [0, 1], so it is SDR-only.
  - F90 0.04, Ks = 0.8 - F90 = 0.76, Kd 0.15.

  [Verified: KHR]
- **ACES 2.0 in OCIO 2.4** (September 2024, "Preview Release"):
  - Its output transform takes 9 parameters: peak nits plus 8 limiting-gamut chromaticities, marked work in progress.
  - Presets: SDR 100 nit (Rec.709, P3-D65); HDR 108, 300, 500, 1000, 2000 and 4000 nit (P3-D65); HDR 500 to 4000 nit (Rec.2020).

  [Verified: OCIO] Any peak from 100 to 10,000 nits [Unverified].
- **GT7 tone mapping:** MIT, "Copyright (c) 2025 Polyphony Digital Inc."; the original download was not seen. [Verified: URP THIRD_PARTY_NOTICES.md]
- **AgX** is Blender 4.0's default (search summary); its repository licences are unknown [Unverified].
- **Pipeline** (Inference):
  1. Accumulate scene-linear, with 1.0 = SDR paper white.
  2. Apply bloom and volumetrics, then exposure.
  3. Apply the display transform: AgX, ACES 2.0 or GT7 for SDR; ACES 2.0 or GT7 with the calibrated peak and paper white for HDR.
  4. Dither (±1 LSB TPDF), then encode.

  Take peak and paper white from an HGIG-style in-app calibration, and use OKLab/OKLCH for authoring only.

## 8. Photosensitive safety
- **WCAG 2.3.1 passes** with no more than 3 general and/or 3 red flashes in any 1 s, or a concurrent flash area of no more than 0.006 sr (25% of any 10° field). [Verified: WCAG-T]
- **General flash:** opposing changes of 10% or more of maximum relative luminance, with the darker state below 0.80. [Verified: WCAG-T]
- **Red flash (WCAG 2.2):** one transition to or from R/(R+G+B) of 0.8 or more, with a chromaticity change above 0.2 in CIE 1976 UCS. [Verified: WCAG-T]
- **Exceptions and field size:** fine balanced patterns (squares under 0.1°) are exempt. A 10° field is about 341x256 px at 1024x768, for a 15 to 17 inch screen at 22 to 26 inches. [Verified: WCAG-T]
- **HDR / non-sRGB:**
  - Test the highest-dynamic-range version.
  - A flash is a change of 20 cd/m^2 or more with the darker state below 160 cd/m^2 (BT.1702).
  - With the darker state at 160 cd/m^2 or more, it is a Michelson contrast of 1/17 or more.
  - RGB values range 0 to 1, as in relative luminance.

  [Verified: WCAG-U] The BT.1702-2 and -3 texts were not read [Unverified].
- **IRIS** (BSD-3-Clause, © 2023 EA):
  - Failures: more than 3 flashes/s; 2 to 3 flashes/s across 5 consecutive seconds (extended); patterns lasting 0.5 s or more.
  - Transition triggers: ±0.1 luminance or ±20 red; the warning level is above 2 flashes (4 transitions) per second.
  - Takes a video via `-v`; thresholds live in `config/appsettings.json`; it is not a certification.

  [Verified: IRIS]
- **Guard** (Inference, original design):
  - Measure the final frame on a 1/32 grid, in absolute nits for HDR, with a time-based transition ring.
  - Use a 10° window from physical size and viewing distance. On a 27-inch screen at 60 cm, that is about 450 px at 1440p, stricter than Harding's 25% of frame.
  - Enforce at 2 flashes/s with a low-pass gain map and red desaturation, in under 0.05 ms.

## 9. Budgets (estimates unless tagged)
- **Frame and pixel budgets** (calc): 120 Hz is 8.33 ms, 144 Hz 6.94 ms, 240 Hz 4.17 ms and 360 Hz 2.78 ms. 1440p is 3.69 MP and 4K is 8.29 MP.
- **Bandwidth:** RTX 4090 1,008 GB/s and M1 Max 400 GB/s [Verified: PW README]. RTX 5090 1,792, RTX 5070 672 and RX 9070 XT 640 to 644.6 GB/s [Unverified].
- **Particle traffic** (calc): 100M x 16 B is 1.6 GB per frame, so 192 GB/s at 120 Hz and 384 GB/s at 240 Hz. A full-float simulation (about 64 B) at 240 Hz needs about 1.92 TB/s, more than an RTX 5090 has.
- **Indicative tiers** (Inference):
  - RTX 5070 / RX 9070 XT: 10M to 30M particles at 240 Hz.
  - RTX 5090: about 50M at 240 Hz, or 100M at 120 Hz with 8 to 12 B quantized state.
- **4K mid-range 240 Hz budget** (Inference):

  | Item | ms |
  |---|---|
  | Simulation + splat, 15M particles | 1.5 to 2.5 |
  | Resolve + trails | 0.3 |
  | Bloom | 0.3 to 0.5 |
  | Starbursts | 0.1 |
  | Floor + reflection | 0.3 to 0.6 |
  | Output pass + histogram + guard | 0.2 to 0.3 |
  | Slack | 0.5 |
- **Structural limits:** buffer and dispatch limits also bound particle count (section 2). [Verified correction]
- **Timestamps:**
  - Quantized by default: Dawn masks them with 0xFFFF0000 ns, about 65.5 µs.
  - Only `--enable-webgpu-developer-features` (or the unsafe switch) turns this off, and the spec requires reduced precision.

  [Verified correction: DAWN Constants.h; CR156 DEC; PRIV]
- **SwiftShader timing:** a 32 B/particle compute step plus a 1-px additive draw took about 22 ms for 20k and 131 ms for 300k particles. This is software only; draw no GPU conclusions from it. [Measured]

## 10. Licences
- **MIT** [Verified]:
  - three.js (© 2010-2026 three.js authors).
  - compute_rasterizer (© 2022 Markus Schütz).
  - PWhiddy (© 2024 Peter Whidden).
  - luma.gl (© 2020 vis.gl; parts © 2015 Uber).
  - TypeGPU (© 2025 Software Mansion).
  - CustomToneMappingURP (© 2025 Akihiro Noguchi).
  - GT7 tone mapping (© 2025 Polyphony Digital).
- **MIT** [Cited]:
  - RadianceCascadesPaper (a CC-BY-ND image may mean other terms for the paper).
  - GPUPrefixSums, Shehata's tutorial, AMD GPUParticles11, PlayCanvas, bevy_hanabi.
  - Bevy is MIT + Apache-2.0; wgpu and vello have an MIT file.
- **Apache-2.0:**
  - Khronos ToneMapping [Verified: KHR].
  - ACES (aces-output, aces-core, aces-dev, now an Academy Software Foundation project), not Academy terms [Verified correction: ACES].
  - Babylon.js [Cited].
- **BSD-3-Clause:** webgpu-samples, IRIS, FLIP (© 2020-2025 NVIDIA). [Verified]
- **Unknown** [Unverified]:
  - EaryChow/AgX, sobotka/AgX, three-rc, FidelityFX SDK, jorgemagic SSR, Makio64, MrLixm/AgXc, unitycoder AgX.
  - Solis 2D, arcane-engine, m-schuetz/webgpu_pointcloud (no licence stated), Aras's test page, McGhee's gist.
- **Obligations:** Apache-2.0 (Khronos, Babylon.js, ACES) means keeping the licence and NOTICE and stating changes, including for LUTs or shader ports from the ACES CTL. (Inference)

## 11. Capture and test harness
- **Architecture** (Inference):
  - A `FrameTarget` abstraction, with the output written into an owned texture with COPY_SRC.
  - The canvas is one sink; capture uses a ring of 3 to 4 MAP_READ buffers.
  - An injected deterministic clock, seeded RNG and recorded inputs.
- **Readback rows:** `bytesPerRow` must be a multiple of 256 [Verified: COPIES]. three.js pads rows, sizes the buffer as height x bytesPerRow (which meets the 4-byte `mapAsync` alignment), awaits `mapAsync` and de-pads [Verified: THREE WebGPUTextureUtils.js].
- **Canvas copies:**
  - Canvas usage may include COPY_DST; only TRANSIENT_ATTACHMENT is rejected.
  - Copies need copy-compatible formats (equal, or differing only in `-srgb`).
  - Canvas formats are bgra8unorm, rgba8unorm and rgba16float.

  [Verified: SPEC; COPIES]
- **Container:** canvas presentation fails, headless and under Xvfb, with "A valid external Instance reference no longer exists." for every flag set. Offscreen rendering, compute and `copyTextureToBuffer` readback work. [Measured]
- **Readback traffic** (calc): 4K `rgba16float` is 66.4 MB per frame (4.0 GB/s at 60 fps), and 1440p is 29.5 MB (7.1 GB/s at 240 fps). So convert on the GPU (rgb10a2unorm or 10-bit YUV) for real-time recording, or record offline at a fixed dt.
- **Reproducibility** (Inference): u32 splats are bit-exact across runs, but floats are deterministic only per GPU, driver and browser build. So keep per-platform goldens and compare across platforms with FLIP, and run IRIS on rendered video in CI. FLIP provides LDR-FLIP and HDR-FLIP. [Verified: FLIP]
- **Performance gates** need real-GPU runners with unquantized timestamps. [Verified correction; Measured]

## Open questions
1. (Priority 2) What is the real-GPU throughput, in Chrome or Electron, of scattered-address additive `atomicAdd` splatting versus additive instanced quads at 10M to 100M particles, per vendor? The particle tiers and the footprint split point depend on it, and the only numbers are opaque or single-address ones.
2. (Priority 2) Does an `rgba16float` + `"extended"` canvas in Electron 45 actually present above SDR white on Windows (Advanced Color), macOS (EDR) and Linux? How will the app learn display peak and SDR-white nits? The tone mapper and the absolute-nits flash guard both need them.
3. (Priority 3) Which flash standard must a desktop release meet: WCAG 2.3.1, the unread BT.1702-3 HDR rule that treats saturated red as risky regardless of luminance, or Harding?
