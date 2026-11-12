This is the fact-checked digest of webgpu_desktop_capabilities.md (WebGPU and WGSL on desktop Chrome and Electron, state as of 2026-11-12).

**Verification status.** The Verification table covers 17 claims: 6 confirmed, 10 corrected, 1 unverifiable. A later pass against container measurements corrected three more sentences: 19 standard features were measured (the notes said 17), and the accepted tone-mapping value is the dictionary `{ mode: "extended" }`, not a string. The notes could not reach developer.chrome.com, MDN, webgpureport.org, web3dsurvey, the Chromium issue tracker or Microsoft docs. So every "What's New in WebGPU" post is a search summary, and there is no per-GPU fleet data.

**Tags.** [Verified]: re-read in the named primary source. [Verified correction]: the original was wrong, and the corrected text is given. [Unverified]: could not be checked. (search summary): seen only in a search snippet. [Cited]: from the linked source, not re-read by the fact-check. [Measured]: this container (headless Chromium 153.0.8010.12, Playwright 1.63.0, Linux, SwiftShader fallback adapter, `--enable-unsafe-webgpu` only); software results, not GPU data, not Electron 45. Inference: the notes' own conclusion. calc: the notes' arithmetic.

**Source keys.** CR153 / CR156 / CR157 / CRMAIN = https://github.com/chromium/chromium/blob/{153.0.8010.12 | 156.0.8078.96 (Electron 45's pin) | 157.0.8103.81 | main}/. DECODER = gpu/command_buffer/service/webgpu_decoder_impl.cc. RTE = third_party/blink/renderer/platform/runtime_enabled_features.json5. DAWN = https://github.com/google/dawn/blob/main/. SPEC / WGSL = https://github.com/gpuweb/gpuweb/blob/main/{spec,wgsl}/index.bs. WIKI = https://github.com/gpuweb/gpuweb/wiki/Implementation-Status. BCD = https://github.com/mdn/browser-compat-data/blob/main/. EL45 / ELMAIN = https://github.com/electron/electron/blob/{45-x-y | main}/. NPM = https://registry.npmjs.org/electron.

## Bottom line
- **Primary path: WebGPU compute** in Electron on Windows (D3D12: NVIDIA, AMD, Intel) and macOS (Metal). **Keep the WebGL2 transform-feedback renderer** (2M particles, RGBA16F bloom) for these cases: Linux GPUs outside the allowlist, Windows ARM64 or unusual vendors, D3D11-only or CPU adapters (VMs, RDP), repeated device loss, and a "safe mode" launch. When an adapter is small, scale the particle count to its limits instead of falling back. (Inference)
- **Electron 45 is Chromium 156, not main.** Two features become default only in Chromium 157: `srgb-linear` canvases and `atomic-vec2u-min-max`. Expect them in Electron 46 if it ships 157 or later. [Verified correction: CR156/CR157 DECODER and RTE]
- **Feature-detect at runtime** with `adapter.features`, `adapter.limits` and `navigator.gpu.wgslLanguageFeatures`. Never key on version numbers. (Inference)

## 1. Availability, switches, versions
- **Windows.** WebGPU is on by default on D3D12 for NVIDIA, AMD, Intel and Microsoft adapters.
  - Qualcomm is allowed through `kWebGPUQualcommWindows` (on by default), with a driver blocklist covering Adreno 6xx, early 7xx and drivers older than 31.0.117.
  - Other vendors get "WindowsLimitedSupport". The D3D11 backend and CPU adapters are always blocklisted.
  - [Verified: WIKI; CRMAIN/gpu/config/webgpu_blocklist_impl.cc; CR156/gpu/config/gpu_finch_features.cc]
  - The 32-bit NVIDIA block does not matter: Electron 44 and later ship 64-bit builds only. [Verified: ELMAIN/docs/breaking-changes.md]
- **macOS.** On by default on Metal. [Verified: WIKI]
- **Linux.** Blocklist entry 186 ("Disable webgpu on vk via gl interop") makes only two exceptions: Intel Gen12+ on Mesa 22.0 or newer, and NVIDIA driver 535.183.01 or newer. AMD and every other GPU get no adapter by default. This is unchanged at 156.0.8078.96, 157.0.8103.81 and main. [Verified: CR156/gpu/config/software_rendering_list.json]
  - The wiki says NVIDIA works on Wayland only, but the entry has no display-server condition. [Unverified]
  - WebGPU runs on Vulkan while the rest of Chromium stays on GL. (search summary)
- **Electron 38 and later run natively on Wayland by default** (`--ozone-platform=auto`). `=x11` forces XWayland. [Verified: ELMAIN/docs/breaking-changes.md]
- **Switch routes for blocklisted Linux GPUs:**
  - The gpuweb recipe is `--enable-unsafe-webgpu --ozone-platform=x11 --use-angle=vulkan --enable-features=Vulkan,VulkanFromANGLE`. [Verified: WIKI]
  - `--enable-unsafe-webgpu` sets the "unsafe" level. That disables the whole adapter blocklist, allows the SwiftShader fallback, exposes the unsafe-only features, sets Dawn's `allow_unsafe_apis` and turns off timestamp quantization. Experimental WGSL features need the developer level (`--enable-webgpu-developer-features`) instead. [Verified correction: CRMAIN/gpu/command_buffer/service/dawn_instance.cc; CRMAIN/DECODER]
  - There are narrower options. `--enable-features=ForceEnableWebGpuInterop` forces only entry 186 open and keeps the "safe" level. `--ignore-gpu-blocklist` skips the whole GPU blocklist. [Verified: CR156/gpu/config/gpu_util.cc and gpu_finch_features.cc; CRMAIN/gpu/config/gpu_switches.cc]
  - Whether either option renders correctly on AMD with Mesa RADV is untested. Entry 186 cites open bugs crbug 442791440 and 475935650. [Unverified]
  - Inference: append switches with `app.commandLine.appendSwitch` before the `ready` event. The unsafe switch suits only trusted local content, because it removes Chromium's protection against known-bad drivers. Test `ForceEnableWebGpuInterop` first.
- **Detection in the main process.** `app.getGPUFeatureStatus()` returns Chromium's feature dictionary, which has a `webgpu` key and, on Linux, a `webgpu_on_vk_via_gl_interop` key; Electron's docs omit both. The keys reflect the GPU blocklist and switches, not Dawn's adapter blocklist or the adapter's limits. The definitive test is still `navigator.gpu?.requestAdapter()` in the renderer. [Verified correction: EL45/shell/browser/api/electron_api_app.cc; CR156/content/browser/gpu/compositor_util.cc]
- **Versions:**
  - Chrome ships a new stable milestone every two weeks and an Extended Stable every eight. [Verified: CRMAIN/docs/process/release_cycle.md] The start with Chrome 153 on 8 September 2026 is [Unverified], and current stable being about 157 is a calculation [Unverified].
  - On npm, Electron 45.3.0 is `latest` (2026-11-10). 45.0.0 shipped on 2026-10-21, and 46.0.0-alpha.9 on 2026-11-11. [Verified: NPM]
  - Electron 45 pins Chromium 156.0.8078.96 (156.0.8078.48 at release, with V8 15.6 and Node 24.22.0). Electron 44 is Chromium 152, Electron main pins 159.0.8154.0, and Chromium main is 160.0.8157.0. [Verified correction: EL45/DEPS; ELMAIN/DEPS; CRMAIN/chrome/VERSION]
  - Electron 44 and later require macOS 13 and link ANGLE statically. [Verified: https://github.com/electron/website/blob/main/blog/electron-44-0.md]
  - Inference: each Electron major (about every eight weeks) now skips four Chromium milestones.
- **Windows ARM64.** The wiki says WebGPU is behind a flag there, but main enables Qualcomm by default with driver gating. Test on Snapdragon X hardware. (Inference)
- **Other browsers, for reference.** Firefox has WebGPU from 141 on Windows, and on Apple silicon from 145 (macOS Tahoe) or 147 (older macOS); on Linux it is Nightly only. [Verified correction: BCD/api/GPU.json] Safari has it from 26 on macOS, iOS and visionOS 26. [Verified: WIKI; BCD]

## 2. Features, WGSL, atomics
- **The spec defines 25 optional features.** [Verified: SPEC]
- **Chrome exposure by release** [Verified correction: CR153/CR156/CR157 DECODER]:

  | Chromium | `texture-compression-unaligned` | `atomic-vec2u-min-max` |
  |---|---|---|
  | 153.0.8010.12 | unsafe-only | not exposed |
  | 156.0.8078.96 (Electron 45) | default | developer or unsafe flag |
  | 157.0.8103.81 and main | default | default |

  `texture-formats-tier1/2`, `primitive-index`, `texture-component-swizzle` and `subgroup-size-control` are exposed by default where the hardware supports them.
- **Unsafe-only on every release:** multi-draw-indirect, timestamps inside passes, subgroup matrix, the bindless "sampling resource table", and `SharedBufferMemoryD3D12Resource`. [Verified: CRMAIN/DECODER]
- **First Chrome version per feature (BCD):** `float32-filterable` 119, `shader-f16` 120, `timestamp-query` 121, `dual-source-blending` 130, `clip-distances` 131, `float32-blendable` 132, `subgroups` 134, `primitive-index` and `texture-formats-tier1/2` 142, `texture-component-swizzle` 143, `subgroup-size-control` 152. [Verified: BCD/api/GPUSupportedFeatures.json]
- **Dawn's per-backend conditions** [Verified: DAWN/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp, metal/PhysicalDeviceMTL.mm, vulkan/PhysicalDeviceVk.cpp; the Vulkan `subgroups` cell is a Verified correction]:

  | Feature | D3D12 | Metal | Vulkan |
  |---|---|---|---|
  | `shader-f16` | DXC 1.4+, SM 6.2, native 16-bit ops | always | `shaderFloat16` + `shaderInt16` + 16-bit storage |
  | `subgroups` | SM 6.0 wave ops | Apple6+ or Mac2 | 1.1 subgroup ops + `VK_EXT_subgroup_size_control`; with f16 on, also `shaderSubgroupExtendedTypes`, or no subgroups (~4% of devices); off on Intel Gen-9 |
  | `subgroup-size-control` | SM 6.6 | only if min = max size | `computeFullSubgroups` |
  | `atomic-vec2u-min-max` | int64 atomics | Apple9, or Mac2 + Apple8 (M2+, not M1) | 64-bit atomics + `shaderInt64` |
  | `timestamp-query` | if supported | counter sampling | `timestampComputeAndGraphics` |
  | `float32-filterable` / `float32-blendable` | always / always | `supports32BitFloatFiltering` / always | per format |
  | `rg11b10ufloat-renderable`, `dual-source-blending`, `clip-distances`, `primitive-index` | always | always | per format; `dualSrcBlend`; `shaderClipDistance` (not Adreno 6xx); `geometryShader` |
  | multi-draw-indirect | unsafe-only | disabled (no argument buffers) | unsafe-only |

- Inference: on desktop GPUs, rely on `float32-blendable`, `float32-filterable`, `rg11b10ufloat-renderable`, `dual-source-blending`, `clip-distances` and `indirect-first-instance` (not verified per GPU). `timestamp-query` is very likely. Keep `shader-f16`, `subgroups` and 64-bit atomics on optional code paths.
- **Atomics.** WGSL has only `atomic<i32>` and `atomic<u32>`, plus `atomic<vec2<u32>>` as a 64-bit type for min and max only. There are no float atomics. [Verified: WGSL] On Vulkan, 64-bit atomics need `VK_KHR_shader_atomic_int64`. [Verified: https://github.com/gpuweb/gpuweb/blob/main/proposals/atomic-64-min-max.md]
  - Workarounds (background knowledge): fixed-point `atomicAdd`; compare-and-swap loops on bit-cast u32; order-preserving float encoding for min and max; additive blending into rgba16float; workgroup or subgroup reductions.
  - 64-bit min/max is an optional fast path for depth-plus-payload point-sprite rasterization. (Inference)
- **WGSL language features.** Tint ships `packed_4x8_integer_dot_product`, `pointer_composite_access`, `readonly_and_readwrite_storage_textures`, `unrestricted_pointer_parameters`, `immediate_address_space` and `uniform_buffer_standard_layout`. It also ships, with a kill-switch, `subgroup_id`, `subgroup_uniformity`, `texture_and_sampler_let`, `texture_formats_tier1`, `linear_indexing`, `buffer_view` and `swizzle_assignment`. These 13 are exactly the set measured in Chromium 153, so Electron 45 should have them. [Verified: DAWN/src/tint/lang/wgsl/feature_status.cc; Measured]
  - The unsafe-experimental features (`sized_binding_array`, `texel_buffers`, `multisampled_array_textures`, `fragment_depth`) were absent even with the unsafe flag. Only the developer level sets `expose_wgsl_experimental_features` [Verified: CRMAIN/gpu/command_buffer/service/dawn_instance.cc]; whether that explains the absence is [Unverified].
- `linear_indexing` adds `global_invocation_index`, which flattens a 2D dispatch. `immediate_address_space` adds `var<immediate>`, set with `setImmediates()`; `maxImmediateSize` defaults to 64 B. [Cited: WGSL; https://github.com/gpuweb/gpuweb/blob/main/proposals/immediate-data.md]
- **Ray tracing.** There is none in the spec's features, Dawn's `dawn.json` or Chrome, not even experimentally, and no gpuweb proposal file was found. [Cited: SPEC; DAWN/src/dawn/dawn.json]
  - Native wgpu has experimental ray queries: Vulkan, Metal acceleration structures since v29, and `spirv-out` ray-tracing pipelines in v30. [Cited: https://github.com/gfx-rs/wgpu/blob/trunk/CHANGELOG.md]
  - Inference: in Electron, use compute-shader BVH or grid traversal, or screen-space and voxel approximations. Hardware ray tracing would need a native module, with no shared device or texture path into the WebGPU canvas.

## 3. Limits and particle budget
- **Spec defaults:** `maxStorageBufferBindingSize` 128 MiB, `maxBufferSize` 256 MiB, `maxComputeWorkgroupStorageSize` 16,384, `maxComputeInvocationsPerWorkgroup` 256, `maxComputeWorkgroupsPerDimension` 65,535, `maxStorageBuffersPerShaderStage` 8, `maxColorAttachmentBytesPerSample` 32, `maxImmediateSize` 64, `maxUniformBufferBindingSize` 65,536. [Verified: SPEC]
- **Chrome rounds adapter limits down to tiers** [Verified: DAWN/src/dawn/native/Limits.cpp]:
  - workgroup storage: 16, 32, 48 or 64 KiB;
  - invocations per workgroup: 128, 256 or 1,024;
  - workgroups per dimension: 65,535 in **every** tier;
  - storage binding: 128 MiB up to 1 GiB, then 2 GiB−4 and 4 GiB−4;
  - `maxBufferSize`: 256 MiB, 1 GiB, 2 GiB or 4 GiB−4;
  - storage buffers per stage: 8, 10 or 16 (Metal is held at 10 until Dawn uses argument buffers);
  - colour-attachment bytes: effectively 64 or 128;
  - `maxTextureDimension2D`: 4,096, 8,192 or 16,384;
  - `maxBindGroups`: 4.
- **D3D12.** Dawn assumes a 2 GiB buffer limit (`kAssumedMaxBufferSize = 0x80000000`), so every Windows adapter gets a 2 GiB buffer and a 2 GiB−4 binding. Workgroup storage is fixed at 32 KiB. Qualcomm GPUs before Adreno 8xx can bind only 2^28 bytes. [Verified correction: DAWN/src/dawn/common/Constants.h; DAWN/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp]
- **NVIDIA on Vulkan.** Bindings are capped at 2 GiB−4, because "OpArrayLength returns 0 for buffers >= 2GB" (crbug.com/435684920). [Verified: DAWN vulkan/PhysicalDeviceVk.cpp]
- **Metal.** `maxBufferSize` is min(UINT32_MAX, `maxBufferLength`), and the binding limit equals the buffer limit. [Cited: DAWN metal/PhysicalDeviceMTL.mm] So 4 GiB−4 bindings exist only on Metal and non-NVIDIA Vulkan. [Verified correction] The tiers that real AMD, Intel and Apple adapters reach were not verified.
- **Budget (calc).** At 32 B per particle:
  - the default binding holds 4,194,304 particles, a 1 GiB binding 33,554,432, and the 2 GiB−4 tier 67,108,863;
  - 50M particles take 1.6e9 B (1.49 GiB), which needs `maxBufferSize` and binding limits of at least 1.6e9, and ping-pong buffering doubles that to 3.2 GB of VRAM;
  - today's 2M-particle dataset (64 MB) fits the defaults.
- **Inference:**
  - Request `requiredLimits` from `adapter.limits`. If they are not available, split into SoA streams or lower the count.
  - Pack with `pack2x16float` or f16 to about 16 B per particle.
  - 50M particles at 256 threads need 195,313 workgroups, so use a 2D dispatch, or the 1,024 tier (48,829 workgroups).
  - Use at most 8 storage buffers per stage (10 covers Metal).
  - Keep each binding under 2 GiB, even where 4 GiB is reported.
  - Requesting 32 KiB of workgroup storage is safe on Windows.

## 4. HDR and colour
- **The shipped HDR route** is an rgba16float canvas with `toneMapping: { mode: "extended" }` and colorSpace `srgb` or `display-p3`. Chrome has it from 129 (ChromeOS, macOS, Windows) and 144 (Linux, Intel Gen12+). Firefox and Safari do not support it. [Verified: BCD/api/GPUCanvasContext.json]
  - Measured: `configure()` accepts it, and `getConfiguration()` reports it back.
  - The spec says implementations without tone mapping omit it from `getConfiguration()`, so this works as the feature test. [Verified: SPEC; Measured]
- `GPUCanvasConfiguration` has `device`, `format`, `usage`, `viewFormats`, `colorSpace`, `toneMapping` and `alphaMode`. There is no present-mode, latency or desynchronized member. [Verified correction: SPEC]
- **Linear canvases** (`srgb-linear` and `display-p3-linear`, flag `ColorSpacePredefinedLinearSpaces`) are experimental in Chromium 153 and 156 (Electron 45) and stable from 157 and on main. [Verified correction: CR156/CR157 RTE]
  - Electron 45 options: write sRGB-encoded extended values to an `srgb` canvas, or turn the flag on through `webPreferences.enableBlinkFeatures`. (Inference)
- **PQ, HLG and rec2020** (`rec2100-pq`, `rec2100-hlg` and `rec2020` under `CanvasHDR`) and `rec2100-linear` are experimental. [Verified: CRMAIN/third_party/blink/renderer/core/html/canvas/predefined_color_space.idl; RTE at 156 and main] Turning them on with `enableBlinkFeatures` is possible but fragile. (Inference)
- **There is no luminance or headroom API**, only the boolean `dynamic-range` media query (Chrome 98). `Screen.colorInfo` is only a community-group proposal. [Cited: BCD/css/at-rules/media.json; https://github.com/w3c/ColorWeb-CG/blob/main/hdr_html_canvas_element.md]
  - Inference: values above 1.0 are brighter than SDR white, up to the OS and display headroom. Offer a user HDR-peak slider, and treat `matchMedia('(dynamic-range: high)')` only as a hint.
- **Windows.** The Windows-only `kUseDisplaySDRMaxLuminanceNits` feature changes how PQ content is handled. [Verified: CRMAIN/components/viz/common/features.cc] Windows HDR needs the OS HDR toggle, and macOS EDR headroom varies with brightness (general knowledge). Chrome's real behaviour on Windows (scRGB), macOS (EDR) and Linux Wayland is unverified.
- **Linux.** No evidence was found that WebGPU canvases reach HDR there. The HDR display features are ChromeOS-only, but an Ozone HDR10 video pass-through (`kHdrVideoMetadataPassthrough`) exists, so Linux HDR is untested rather than ruled out. [Verified correction: CRMAIN/components/viz/common/features.cc; CRMAIN/ui/display/display_features.cc] Expect SDR. (Inference)
- **SDR.** Use `navigator.gpu.getPreferredCanvasFormat()`, because `rgba8unorm` canvases are unsupported on macOS. [Verified: BCD/api/GPUCanvasContext.json]

## 5. Frame pacing
- Frames follow GPU vsync: DXGI `WaitForVBlank` or the DirectComposition clock on Windows, and DisplayLink on macOS. [Cited: CRMAIN/ui/gl/vsync_thread_win.cc; CRMAIN/components/viz/common/features.cc]
- `--disable-frame-rate-limit` removes begin-frame limiting and implies `--disable-gpu-vsync`. A TODO in the code says VRR support is not implemented on Windows (crbug.com/346931323). [Verified: CRMAIN/components/viz/common/switches.cc] Use it only for benchmarks, and expect tearing. (Inference)
- WebGPU has no present-mode, latency, VRR or presentation-feedback API. [Cited: SPEC]
- Inference:
  - Run a fixed-timestep simulation with interpolation, and measure the real frame interval.
  - The GPU budget is 2 ms at 500 Hz, 4.2 ms at 240 Hz and 8.3 ms at 120 Hz; beyond that, accept skipped frames.
  - Queue at most one or two frames, with `onSubmittedWorkDone` for backpressure.

## 6. Robustness
- `GPUDeviceLostReason` is "unknown" or "destroyed". `requestDevice` consumes the adapter, so recovery needs a new `requestAdapter()`. [Verified: SPEC] The error-scope filters are "validation", "out-of-memory" and "internal". [Cited: SPEC]
- **Chrome's GPU watchdog** waits 30 s on Windows, 25 s on macOS and 15 s elsewhere. The timeout doubles after power resume and under software rendering, and `--gpu-watchdog-timeout-seconds` overrides it. [Verified: CRMAIN/gpu/ipc/common/gpu_watchdog_timeout.h] Windows TDR is much shorter (default `TdrDelay` 2 s; background knowledge).
- **Electron.** `app` emits `'child-process-gone'` with type `GPU`; `gpu-process-crashed` was removed. [Verified: ELMAIN/docs/api/app.md]
- **Recovery recipe (Inference):**
  1. On loss with reason "unknown", stop the frame loop.
  2. Request a new adapter and device, and rebuild all resources.
  3. Re-seed from a compact CPU or IndexedDB snapshot of emitter and preset state, not from the particle buffers.
  4. After repeated losses, switch to WebGL2.
  5. Log `'child-process-gone'` in the main process and decide whether to relaunch with a safer configuration.

  Also keep any single submit well under about 100 ms on the slowest GPU, and split large steps across dispatches, submits and frames. Wrap large allocations ("out-of-memory") and pipeline creation ("validation") in error scopes.

## 7. Profiling
- **Timestamps are quantized by default**, with mask 0xFFFF0000 on nanosecond values, which gives steps of about 65.5 µs. `--enable-webgpu-developer-features` or `--enable-unsafe-webgpu` turns quantization off. Timestamps inside passes are unsafe-only. [Verified: CRMAIN/DECODER; CRMAIN/gpu/command_buffer/service/dawn_instance.cc; DAWN/src/dawn/common/Constants.h]
- Inference:
  - Development builds add `enable-webgpu-developer-features` and `enable-dawn-features=use_user_defined_labels_in_backend`, and label every pass.
  - Shipping builds use quantized timestamps only for coarse adaptive quality: a 4.17 ms frame reads to within about 2%, but passes under 0.1 ms read as noise.
- **Capture tools** [Verified: DAWN/docs/dawn/debugging.md]:
  - RenderDoc capture of Chrome works only on Windows D3D12, with sandbox-off flags plus `enable_renderdoc_process_injection`.
  - On Metal, a `.gputrace` comes from `DAWN_TRACE_FILE_BASE` with `MTL_CAPTURE_ENABLED=1`. D3D12, Vulkan and GL tracing are not implemented.
  - `--enable-dawn-features=dump_shaders,disable_symbol_renaming` dumps the translated shaders.

## 8. Vendor issues
- Only the gating in source code is documented: the NVIDIA Vulkan `arrayLength` bug on bindings of 2 GB or more, the Linux allowlist, Metal without argument buffers, and the Qualcomm Windows blocklist (Adreno 7180, 7280, 8180, 8280 and 8340 blocked; the 8380 needs driver 31.0.117 or newer). [Verified or Cited: sources above; CRMAIN/gpu/config/webgpu_blocklist_impl.cc]
- There is no 2025–2026 bug-tracker evidence about compute or blending cliffs.
- Inference: additive overdraw is the main cliff on every vendor, worst on integrated Intel and Apple GPUs. Use rg11b10ufloat or rgba16float accumulation (not rgba32float), half-resolution particle passes into the bloom chain, and u32 fixed-point compute splatting for dense regions.

## 9. CI in this container
- **Measured:**
  - `navigator.gpu` works with only `--enable-unsafe-webgpu`.
  - Adapter info: vendor "google", architecture "swiftshader", `isFallbackAdapter` true, empty description. Gate vendor paths on `vendor` and `architecture`, not on `description`.
  - Features: 19 standard features plus `chromium-experimental-timestamp-query-inside-passes` and `chromium-experimental-sampling-resource-table`. `shader-f16`, `dual-source-blending`, `primitive-index`, `texture-formats-tier1/2` and `atomic-vec2u-min-max` are absent. BC, ASTC, ETC2, `indirect-first-instance`, `subgroups`, `subgroup-size-control` and `timestamp-query` are present.
  - Limits: buffer and binding 1 GiB, workgroup storage 32 KiB, 256 invocations per workgroup, 65,535 workgroups per dimension, 10 storage buffers per stage, 8,192 maximum 2D texture, 128 colour-attachment bytes. Subgroup size 4.
  - `WEBGL_debug_renderer_info` gives the unmasked renderer string.
  - [Verified correction: Measured]
- **Presentation fails** headless and headed under Xvfb, with every flag set tried: "A valid external Instance reference no longer exists". Offscreen rendering, compute and `copyTextureToBuffer` readback work. [Verified: Measured]
  - The likely cause is that `GetWebGPUOnVulkanViaGLInterop()` returns "disabled" on software GL. [Verified, code path only: CR156/gpu/config/gpu_util.cc]
  - Retest with the shipped Electron on a real Wayland GPU before assuming users are affected. [Unverified]
- **Software timing** (measured in this container, supplied with this pass, not in the notes; not GPU data): a 32 B-per-particle compute step plus a 1-pixel additive point draw took about 22 ms for 20k particles and 131 ms for 300k.
- **CI policy (Inference):**
  1. Headless Linux CI covers compute and offscreen correctness only: render to a `GPUTexture`, `copyTextureToBuffer`, `mapAsync`, and compare against tolerance-based golden images.
  2. Real-GPU runners are needed for presentation, resize, HDR appearance, rAF cadence and device-loss recovery: Windows D3D12 (NVIDIA, AMD, Intel), macOS (M1 and M2+), and Linux (Intel Gen12+ or NVIDIA on Wayland, plus AMD for the fallback path).
  3. The unsafe flag bypasses the Linux allowlist, so force the "no adapter → WebGL2" path with a test flag. Keep the unsafe switch out of production unless the Linux policy chooses it.
  4. A subgroup size of 4, against 32 or 64 on desktop GPUs, breaks code that assumes 32-wide ballots. CI exercises only the paths without f16 and without 64-bit atomics.
  5. Cap test buffers at 1 GiB (33.5M particles at 32 B, far fewer in practice for CPU speed). Test that an over-limit request scales down instead of crashing.
  6. SwiftShader timings say nothing about performance budgets, and HDR can be tested only at the API level.
  7. Run CI on the exact Electron version being shipped: CI measured Chromium 153, and Electron 45 is 156.

## 10. Cross-file corrections recorded by the notes
- **gpu_particle_simulation.md.** "About 2 GiB binding on most Windows/NVIDIA adapters" is exact: every D3D12 adapter tiers to 2 GiB−4. Subgroups in Chrome 134 is confirmed. [Verified: DAWN Constants.h; BCD]
- **gpu_light_rendering.md:**
  - Its budgets assume 16 KiB of workgroup storage, but 32 KiB is safe on D3D12.
  - Its linear-to-extended-canvas plan needs sRGB encoding in Electron 45.
  - Its timestamp budgets must allow for the 65.5 µs quantization.

## 11. Open gaps
- Does `ForceEnableWebGpuInterop` or the unsafe recipe render correctly on AMD with Mesa RADV? AMD rollout news after April 2026 was not read.
- There is no fleet data: neither the share of users in each fallback category nor the real limit tiers and features per GPU.
- Real HDR behaviour on each OS, and whether any headroom API exists.
- rAF on mixed-refresh monitors, G-Sync/FreeSync, Linux pacing, and measured cadence at 240–500 Hz.
- Whether Chrome blocks WebGPU after repeated GPU crashes, and how it handles TDR.
- Vendor bugs from 2025–2026, ETC2/ASTC on desktop backends, PIX and tracing steps, and wgpu ray queries on DX12.
- Which Chromium Electron 46 ships, which decides default `srgb-linear` and `atomic-vec2u-min-max`.
