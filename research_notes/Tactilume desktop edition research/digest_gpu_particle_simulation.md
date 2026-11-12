# Fact-checked digest of gpu_particle_simulation.md

Source: `gpu_particle_simulation.md`, fact-checked on 2026-11-12 in two passes (the first was interrupted). Its Verification table has 15 rows: 6 confirmed, 6 corrected, 3 unverifiable.

**Tags.** [Verified]: re-read in the named primary source. [Verified correction]: the original was wrong or incomplete; corrected fact given. [Unverified]: source unreachable. (search summary): web-search summary only. (untagged): read from the primary source during research, not re-checked. calc: the notes' arithmetic. Inference: planning advice. Measured: this container (headless Chromium 153.0.8010.12, Playwright 1.63.0, Linux, SwiftShader fallback adapter, only `--enable-unsafe-webgpu`); software results, not GPU data.

**Source keys.** BCD = https://github.com/mdn/browser-compat-data/blob/main/ ; SPEC = https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs ; WGSL = https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs ; SGP = https://github.com/gpuweb/gpuweb/blob/main/proposals/subgroups.md ; DAWN = https://github.com/google/dawn/blob/main/src/dawn/ ; CR156 = https://github.com/chromium/chromium/blob/156.0.8078.96/ ; CR157 = https://github.com/chromium/chromium/blob/157.0.8103.81/ ; GW = https://github.com/gridwise-webgpu/gridwise/blob/HEAD/ ; PC = https://github.com/playcanvas/engine/blob/HEAD/src/scene/graphics/radix-sort/

## 1. Runtime and API availability

- **Versions.** Electron 45 pins Chromium 156.0.8078.96. Chrome 157 has been the stable channel since 2026-11-03. [Verified: https://github.com/electron/electron/blob/45-x-y/DEPS; BCD browsers/chrome.json]
- **WebGPU by OS.** Chrome 113 covers ChromeOS, macOS and Windows only. Chrome has WebGPU on Linux from 144. BCD says "Intel Gen12+ only", but Chromium 156's GPU blocklist (entry 186, "Disable webgpu on vk via gl interop") exempts Intel Gen12+ with Mesa 22.0+ and NVIDIA drivers 535.183.01+. **AMD and older Intel Linux GPUs get no WebGPU by default**, so they need WebGPU force-enabled or a WebGL2 fallback. Firefox: 141 on Windows; Apple-silicon Macs from 145 (Tahoe) or 147 (older macOS); not Linux, not Intel Macs. Safari: 26. [Verified correction: BCD api/GPU.json; CR156 gpu/config/software_rendering_list.json]
- **Optional features** (Chrome's Linux entries all start at 144):
  - `shader-f16`: Chrome 120, Safari 26, no Firefox; absent on SwiftShader. [Verified: BCD api/GPUSupportedFeatures.json; Measured]
  - `subgroups`: Chrome 134; no Firefox. Safari has it only in 27.3, which is **beta**; the stable Safari 27.2 lacks it. [Verified correction: BCD api/GPUSupportedFeatures.json; BCD browsers/safari.json]
  - `subgroup-size-control`: Chrome 152 only. [Verified: BCD]
  - `float32-blendable`: Chrome 132, Safari 26, Firefox 158 (partial). `float32-filterable`: Chrome 119 only. Dawn enables both on every D3D12 adapter, `float32-blendable` on every Metal adapter, and both per format on Vulkan. [Verified: BCD; DAWN native/{d3d12/PhysicalDeviceD3D12.cpp, metal/PhysicalDeviceMTL.mm, vulkan/PhysicalDeviceVk.cpp}]
  - WGSL `subgroup_id` (Chrome 144) and `subgroup_uniformity` (Chrome 145) have shipped (the notes said "intent to ship"); Chromium 153 lists both in `wgslLanguageFeatures`. [Verified correction: BCD api/WGSLLanguageFeatures.json; Measured]
- **`atomic-vec2u-min-max`** (64-bit `atomicStoreMin`/`atomicStoreMax` on `atomic<vec2<u32>>`, storage buffers only, no return value):
  - Chrome exposes it by default from Chromium 157. In Electron 45 (Chromium 156) it appears only at a raised WebGPU safety level, with `--enable-webgpu-developer-features` or `--enable-unsafe-webgpu`. [Verified correction: CR156 and CR157 gpu/command_buffer/service/webgpu_decoder_impl.cc]
  - Hardware: on D3D12 it needs int64 atomics plus DXC with shader model 6.6; on Vulkan, `shaderBufferInt64Atomics` and `shaderInt64`; on Metal, Apple9, or Mac2 with Apple8 (M2 and later, **not M1**). It is not in BCD. [Verified: DAWN native/{d3d12/PhysicalDeviceD3D12.cpp, vulkan/PhysicalDeviceVk.cpp, metal/PhysicalDeviceMTL.mm}; WGSL]
- **Atomics.** `atomic<T>` takes only u32 or i32, so float accumulation must use fixed point. [Verified: WGSL] f32 atomics (gpuweb #4894) are still an open proposal (Milestone 3); a reported compare-and-swap polyfill is slow. [Unverified: issue page returned 403]
- **Packing.** `pack4x8unorm`, `pack2x16float` and their unpack forms are core WGSL; f16 arithmetic needs `shader-f16` plus `enable f16;`. (untagged: WGSL) Claimed f16 speed-ups are (search summary) [Unverified].
- **Subgroup size is not fixed.** Vulkan reports the driver's range, Metal 4 to 64 and D3D12 WaveLaneCountMin to 128. Sizes can differ between kernels. SwiftShader reports 4. [Verified: SGP; GW docs/subgroup-strategy.md; Measured]
- **Adapter identity.** Chrome fills `adapter.info.vendor` and `architecture` but may leave `description` empty, so gate on vendor and architecture. SwiftShader reports "google", "swiftshader" and `isFallbackAdapter` true. [Verified: Measured]

## 2. Limits and memory sizing

- **Core defaults** (guaranteed minimums): 128 MiB per storage binding, 256 MiB per buffer, 65,535 workgroups per dimension, 256 invocations per workgroup (128 in compatibility mode), 16 KiB workgroup storage, 8 storage buffers per stage. Higher limits must be requested in `requiredLimits`. [Verified: SPEC]
- **Per-OS caps in Chrome** (from Dawn's tiers):
  - Windows/D3D12: `maxBufferSize` 2 GiB and binding 2,147,483,644 B on every adapter, except pre-Adreno 8xx Qualcomm (bindings capped at 2^28). No Windows adapter reaches 4 GiB−4.
  - Vulkan: NVIDIA bindings are capped at 2 GiB−4; other drivers can reach the 4 GiB−4 tier.
  - Metal: up to min(UINT32_MAX, maxBufferLength) for both limits.
  - [Verified: DAWN common/Constants.h, native/Limits.cpp, native/d3d12/PhysicalDeviceD3D12.cpp, native/vulkan/PhysicalDeviceVk.cpp, native/metal/PhysicalDeviceMTL.mm]
- web3dsurvey reports that 92% of surveyed Windows systems, and 100% of NVIDIA ones, expose ≥ 2,147,483,644 B. [Unverified: host blocked; consistent with Dawn]
- **What fits.** 100M × 16 B = 1.6 GB fits one binding everywhere above. 100M × 32 B = 3.2 GB fits nowhere on Windows, so split SoA arrays under the binding limit. [calc; Verified: DAWN]
- **Dispatch.** 100M ÷ 256 = 390,625 workgroups, more than 65,535, so use a 2D dispatch (for example 65,535 × 6) with a flat index, or a grid-stride loop. [calc; limit Verified: SPEC]
- **Workgroup storage.** D3D12 reports 32,768 B, as does SwiftShader. Gridwise's sort requires `maxComputeWorkgroupStorageSize: 32768`. [Verified: DAWN d3d12; GW README.md; Measured]
- The default 8 storage buffers per stage caps how many SoA arrays one kernel binds. [Verified: SPEC]

## 3. Measured performance data

- **Largest WebGPU particle figure:** 10M particles simulated and rendered at about 63 fps on a GTX 1060 (TU Wien thesis, 2023), about 1.6 ns per particle per frame. [Unverified: cg.tuwien.ac.at blocked; calc] No 100M WebGPU benchmark exists in the sources.
- **Dawn copy-kernel bandwidth:** Apple M1 Max 360–370 GB/s, NVIDIA V100 808 GB/s. [Verified: GW docs/sort.md]
- **Rated bandwidth:** RTX 4090 1,008 GB/s and M1 Max 400 GB/s [Verified: https://github.com/PWhiddy/webgpu-atomics-benchmark/blob/HEAD/README.md]. RTX 5090 1,792, RTX 5070 672 and RX 9070 XT about 640 GB/s. [Unverified: search summaries]
- **Gridwise OneSweep per pass at 2^24 keys (Dawn in Node):**
  - M1 Max: 32-bit keys take 2.6 ms at 15 keys/thread, 1.8 ms at 11; 64-bit key-value runs at about 100 GB/s (29% of copy).
  - V100: 32-bit keys take 0.585 ms (230 GB/s, 28%); 64-bit key-value about 1.31 ms (308 GB/s, 38%).
  - On the V100, look-back costs ≤5% of a 64-bit pass and about 22% of a 32-bit pass.
  - [Verified: GW docs/sort.md]
- **wgpu_sort key-value radix sort** (native wgpu, average of 1,000 runs, not a browser): RTX A5000 0.317 / 1.64 / 3.98 ms for 1M / 8M / 20M pairs; R9 380 2.76 / 18.8 / 46.1 ms; Intel HD 4600 38.7 / 295 / 732 ms. [Verified correction: https://github.com/KeKsBoTer/wgpu_sort/blob/HEAD/README.md]
- **Prefix sums (Vulkan):** GTX 1080 decoupled look-back, 64Mi u32 in 2.05 ms (31.2 G elements/s). [Verified: https://github.com/raphlinus/raphlinus.github.io/blob/main/_posts/2020-04-21-prefix-sum.md]
- **Neighbour and grid methods in WebGPU:**
  - WebGPU-Ocean: SPH about 30k particles on iGPUs; MLS-MPM about 100k on iGPUs and about 300k on "decent GPUs". [Verified: https://github.com/matsuoka-601/webgpu-ocean/blob/HEAD/README.md]
  - Splash's `million` branch reaches 1.6M, "very close to the memory limit of the buffer size". [Verified: https://github.com/matsuoka-601/Splash/blob/HEAD/README.md]
  - three.js MLS-MPM: up to 131,072 particles, 64³ grid, fixed-point multiplier 1e7. [Verified: https://github.com/mrdoob/three.js/blob/master/examples/webgpu_compute_particles_fluid.html]
  - About 400k particles on an RTX 3060 laptop GPU. (search summary, Codrops)
- **CUDA Barnes-Hut** (RTX 500 Ada laptop): 524,288 particles at about 37 fps; 2M at about 150 ms per step; 4M at about 430 ms. So tree codes will not reach 10M+ in real time. (untagged: https://github.com/lechebs/nbody)
- **Software only:** a 32 B-per-particle compute step plus a 1-pixel additive point draw took about 22 ms for 20k particles and 131 ms for 300k on SwiftShader (4-core container). This says nothing about GPU cost. [Verified: Measured]

## 4. Cost model and recommended architecture (Inference unless tagged)

- **Bandwidth budget:** bytes per frame ≈ N × (bytes read + written) × substeps. [calc]
  - 10M at 32 B (64 B moved per step): about 38 GB/s at 60 fps, 154 GB/s at 240 fps.
  - 100M at 32 B: about 384 GB/s at 60 fps and 1.5 TB/s at 240 fps, beyond any consumer GPU.
  - 100M at 16 B: about 192 GB/s at 60 fps and 768 GB/s at 240 fps.
  - One in-place 100M × 16 B step needs at least about 8.8 ms on an M1 Max (≤114 steps/s) and about 4 ms on a V100 (≤250 steps/s).
- **16 B state for the 100M tier:**
  - Position: 3 × 21-bit fixed point in 2 × u32 (about 1/2,000,000 of the world box per axis).
  - Velocity: 3 × f16 via `pack2x16float`, plus 16 bits for age, species and behaviour (8 B).
  - Colour: derived at render time, or `pack4x8unorm` only when needed.
  - The interactive tier keeps 3 × f32 positions.
- **Tiers:**

  | Tier | Count | Behaviours |
  |---|---|---|
  | Ambient | 10M–100M tracers | Field-only, O(1) per particle: ABC flow, curl noise baked into a 128³ rgba16float 3D texture (about 16 MB), splatted touch-force grid, fluid velocity grid, SDF and strange attractors |
  | Interactive | 0.5M–4M, binned | Particle Life matrix, boids, SPH/PBF-like separation |
  | Liquid | 0.1M–1.6M | MLS-MPM with fixed-point P2G atomics |

- **Memory layout:** a hot/cold SoA split (hot = position plus packed velocity). Field-only tracers update in place; ping-pong buffers only where kernels read neighbours. One buffer cannot be bound read-only and read-write in the same dispatch. (untagged: SPEC)
- **Behaviour mixing:** the 12 existing behaviours become weighted force terms; uniform branches skip zero weights.
- **Inputs:**
  - Per-particle loops only for ≤ 64 point sources (gamepad cursors, poles). 3,200 trail segments × 100M is about 3.2 × 10^11 tests per step, which is impossible.
  - Splat all inputs once per frame into a 2D rgba16float force/velocity texture (additive blending; 16-bit float blending is core, 32-bit needs `float32-blendable`) [Verified: SPEC], or use fixed-point atomics. Optionally run a stable-fluids step. Each particle samples once.
  - Cap primitives (about 4,096 per frame), timestamp phone events and interpolate per substep, and give each player a normalised strength and an emission slice.
- **Audio:** the CPU computes FFT bands into a 16–64-float uniform that modulates weights, splat strength, emission and attractors. The GPU cost is negligible.
- **Life cycle:**
  - Ambient: a fixed pool, always alive, respawned in place (no atomics or indirection), with an `activeCount` uniform per GPU tier.
  - Bursts: a ring buffer per emitter.
  - Dead and alive lists with GPU-written indirect arguments only where needed. A kickoff kernel clamps `emitCount = min(requested, deadCount)`.
- **Scans and sorts:**
  - Use portable multi-pass reduce-then-scan and counting-sort binning (16-bit keys when there are fewer than 65,536 cells). An 8M-pair sort at 1.64 ms implies about 1 ms to sort a 4M tier on a high-end GPU. [calc]
  - Decoupled look-back without fallback can lock up an entire Apple machine, because Apple and ARM GPUs give no forward-progress guarantee. [Verified: GW docs/scan-and-reduce.md]
  - Without hardware subgroups, Gridwise's `HierarchicalScan` ran 20–30× faster than its emulated DLDF on an M1 Max. [Verified: GW docs/scan-and-reduce.md]
  - PlayCanvas enables OneSweep only when `adapter.info.vendor` is "nvidia" and subgroups are ≤ 32 lanes (validated on Turing+ and Ampere). It cites Apple's missing forward progress and look-back bugs on Mali, Imagination and some Adreno. Its comments claim progress on AMD GCN+ and Intel Gen9+, but only NVIDIA is validated. [Verified: PC compute-radix-sort.js, compute-radix-sort-onesweep.js]
  - Always keep a no-subgroup path.
- **Determinism:** fixed-point integer atomic sums do not depend on order. At a 1e7 multiplier an i32 holds only ±214.7, so use per-quantity scales or high and low words. For replays, use a stable radix sort on (cell, id). Cross-vendor bit-exact results are unrealistic.
- **Stability:**
  - WGSL lets compilers assume no NaN or Inf, so an `x != x` check may be removed. [Verified: WGSL] Guard with `(bitcast<u32>(x) & 0x7f800000u) != 0x7f800000u` and respawn on failure.
  - Use a fixed dt (for example 1/240 s), with n = min(floor(acc/dt), nMax ≈ 8) substeps per frame, and discard excess time.
  - CFL: max|v|·dt ≤ C·dx with C about 0.5 to 1, or clamp velocity.
  - Encode all substeps in one command buffer, never read back synchronously, and rebuild on `device.lost`.

## 5. CI on software adapters (Measured unless tagged)

- **Adapter shape:** subgroup size 4, 32 KiB workgroup storage, 10 storage buffers per stage, 1 GiB buffers and bindings, 8,192-texel 2D textures. No `shader-f16` or `atomic-vec2u-min-max`. It does expose `subgroups`, `subgroup-size-control`, `float32-blendable`, `float32-filterable` and `timestamp-query`. [Verified: Measured]
- **Presentation:** presenting a WebGPU canvas fails, headless and headed under Xvfb ("A valid external Instance reference no longer exists."). Offscreen rendering, compute and `copyTextureToBuffer` readback work, so tests should render offscreen and compare pixels. Presentation, resize, HDR and frame pacing need real-GPU machines. [Verified: Measured]
- **Spin loops:** spin-waiting kernels starve on SwiftShader. Gridwise's `SPIN_TIMEOUT` turns the hang into a long stall and a wrong result. [Verified: GW docs/subgroup-strategy.md]
- **Gridwise sort on SwiftShader:** it is not refused (the notes said it might be). It uses hardware subgroups whenever `subgroups` exists and sizes tiles as if subgroups were ≥ 32 lanes, below its own rule for 4-lane subgroups. In CI, pass `disableSubgroups: true` or test a non-spinning sort. Correctness at width 4 is untested. [Verified correction: GW src/onesweep.mjs, src/primitive.mjs]

## 6. Licences for reuse

- **Permissive, confirmed from LICENSE files:**
  - webgpu-samples BSD-3-Clause; three.js MIT; Babylon.js Apache-2.0; PlayCanvas MIT; bevy_hanabi MIT OR Apache-2.0 (WebGPU on wasm since v0.13).
  - webgpu-ocean MIT; Splash MIT; EA pbmpm BSD-3-Clause; blub MIT.
  - Gridwise Apache-2.0 (npm `gridwise` 0.1.0); Vello Apache-2.0 OR MIT.
  - [Verified: each repository's LICENSE (first pass); GW LICENSE.txt]
- **Not re-checked:** WaterBall, holtsetio/flow, WebGL-Fluid-Simulation and SebLague/Fluid-Sim are MIT. (untagged) splatter, NBody-WebGPU, lechebs/nbody and GraphWaGu were not checked.
- **Mixed:** GPUSorting is MIT (© 2024 Thomas Smith), but its LICENSE also covers CUB (BSD-3-Clause), FidelityFX and DirectStorage (MIT) and **bb_segsort (LGPL-2.1)**. Check each file before vendoring. GPUPrefixSums is MIT plus CUB's BSD-3-Clause text. [Verified correction: https://github.com/b0nes164/GPUSorting/blob/HEAD/LICENSE; https://github.com/b0nes164/GPUPrefixSums/blob/HEAD/LICENSE]
- **Metadata only, no LICENSE file:** webgpu-radix-sort is MIT (package.json v1.0.7) and wgpu_sort is BSD-2-Clause (Cargo.toml, wgpu 0.20); confirm with the authors. [Verified: https://github.com/kishimisu/WebGPU-Radix-Sort/blob/main/package.json; https://github.com/KeKsBoTer/wgpu_sort/blob/master/Cargo.toml]
- **Policy** (Inference): re-implement from papers, keep copyright notices on vendored code (Apache-2.0 adds NOTICE and patent terms), and keep concept references out of the visual identity.

## 7. Open gaps that block numbers

- No measured WebGPU figures at 10M+ on current consumer GPUs (RTX 40/50, RX 7000/9000, Arc, M3/M4). Every tier target is modelled from bandwidth.
- No SoA-vs-AoS or f16-vs-f32 particle-state measurements.
- AMD and Intel forward-progress behaviour under WebGPU is undocumented. The PlayCanvas OneSweep path has no fallback.
- How Electron 45 should enable WebGPU on AMD and older Intel Linux GPUs (flags, stability) was not tested.
- WebGPU cost of dead and alive lists, force-grid splatting with many inputs, and jump flooding is unmeasured. GPU watchdog (TDR) limits under WebGPU were not researched.
