This is the fact-checked digest of webgpu_desktop_capabilities.md (WebGPU and WGSL on desktop Chrome and Electron, as of 2026-11-12).

**Status.** The Verification table has 17 claims: 6 confirmed, 10 corrected, 1 unverifiable. A later pass against container measurements corrected three sentences: there are 19 standard features, not 17, and tone mapping takes `{ mode: "extended" }`. developer.chrome.com, MDN, webgpureport.org, web3dsurvey, the Chromium tracker and Microsoft docs were unreachable, so there is no per-GPU fleet data.

**Tags.**
- [Verified]: re-read at the source.
- [Verified correction]: the original was wrong; the corrected text is given.
- [Unverified]: could not be checked.
- (search summary): snippet only.
- [Cited]: from the source, not re-checked.
- [Measured]: this container (headless Chromium 153.0.8010.12, Playwright 1.63.0, Linux, SwiftShader fallback, only `--enable-unsafe-webgpu`); software results, not GPU data, not Electron 45.
- Inference: the notes' conclusion. calc: the notes' arithmetic.

**Source keys.**
- CR153 / CR156 / CR157 / CRMAIN = https://github.com/chromium/chromium/blob/{153.0.8010.12 | 156.0.8078.96 | 157.0.8103.81 | main}/
- DEC = gpu/command_buffer/service/webgpu_decoder_impl.cc; RTE = third_party/blink/renderer/platform/runtime_enabled_features.json5
- DAWN = https://github.com/google/dawn/blob/main/
- GPUWEB = https://github.com/gpuweb/gpuweb/blob/main/ (SPEC = spec/index.bs, WGSL = wgsl/index.bs); WIKI = https://github.com/gpuweb/gpuweb/wiki/Implementation-Status
- BCD = https://github.com/mdn/browser-compat-data/blob/main/
- EL45 / ELMAIN = https://github.com/electron/electron/blob/{45-x-y | main}/; EWEB = https://github.com/electron/website/blob/main/blog/

## Bottom line
- **WebGPU compute is the primary path** on Windows (D3D12) and macOS (Metal). (Inference)
- **Keep the WebGL2 transform-feedback renderer** (2M particles, RGBA16F bloom) for non-allowlisted Linux GPUs, Windows ARM64 and unusual vendors, D3D11-only or CPU adapters (VMs, RDP), repeated device loss, and a safe mode. For small adapters, the notes prefer lowering the particle count. (Inference)
- **Electron 45 is Chromium 156.** Default `srgb-linear` canvases and default `atomic-vec2u-min-max` need Chromium 157, so Electron 46 has them only if it ships 157 or later. [Verified correction: CR156/CR157 DEC and RTE]
- **Feature-detect at runtime** (`adapter.features`, `adapter.limits`, `navigator.gpu.wgslLanguageFeatures`), never by version. (Inference)

## 1. Availability, switches, versions
- **Windows (D3D12).** On for NVIDIA, AMD, Intel and Microsoft adapters. Qualcomm is on through `kWebGPUQualcommWindows`, except for blocklisted drivers (Adreno 6xx, early 7xx, older than 31.0.117). Other vendors get "WindowsLimitedSupport", and D3D11 and CPU adapters are always blocked. [Verified: WIKI; CRMAIN/gpu/config/webgpu_blocklist_impl.cc; CR156/gpu/config/gpu_finch_features.cc] Electron 44 and later are 64-bit only, so the 32-bit NVIDIA block does not apply. [Verified: ELMAIN/docs/breaking-changes.md]
- **macOS (Metal).** On. [Verified: WIKI]
- **Linux.** Entry 186 ("Disable webgpu on vk via gl interop") excepts only Intel Gen12+ (Mesa 22.0 or newer) and NVIDIA 535.183.01 or newer. AMD and the rest get no adapter, at 156, 157 and main. [Verified: CR156/gpu/config/software_rendering_list.json]
  - The wiki says NVIDIA works on Wayland only, but the entry has no display-server condition. [Unverified]
  - Electron 38 and later run natively on Wayland by default; `--ozone-platform=x11` forces XWayland. [Verified: ELMAIN/docs/breaking-changes.md]
- **Enabling blocked Linux GPUs:**
  - The gpuweb recipe is `--enable-unsafe-webgpu --ozone-platform=x11 --use-angle=vulkan --enable-features=Vulkan,VulkanFromANGLE`. [Verified: WIKI]
  - `--enable-unsafe-webgpu` disables the adapter blocklist, allows SwiftShader, exposes the unsafe-only features, sets `allow_unsafe_apis` and turns off timestamp quantization. Experimental WGSL needs `--enable-webgpu-developer-features`. [Verified correction: CRMAIN/gpu/command_buffer/service/dawn_instance.cc; CRMAIN/DEC]
  - Narrower options: `--enable-features=ForceEnableWebGpuInterop` opens only entry 186 and stays at the "safe" level; `--ignore-gpu-blocklist` skips the GPU blocklist. [Verified: CR156/gpu/config/gpu_util.cc and gpu_finch_features.cc; CRMAIN/gpu/config/gpu_switches.cc]
  - Rendering on AMD with RADV is untested, and entry 186 cites open crbug 442791440 and 475935650. [Unverified]
  - Inference: try `ForceEnableWebGpuInterop` first. The unsafe switch removes protection against known-bad drivers.
- **Main-process check.** `app.getGPUFeatureStatus()` has undocumented `webgpu` and (on Linux) `webgpu_on_vk_via_gl_interop` keys. They reflect the GPU blocklist and switches, not Dawn's adapter blocklist or limits, so `navigator.gpu?.requestAdapter()` stays the definitive test. [Verified correction: EL45/shell/browser/api/electron_api_app.cc; CR156/content/browser/gpu/compositor_util.cc]
- **Versions:**
  - Chrome ships stable every two weeks. [Verified: CRMAIN/docs/process/release_cycle.md] Current stable being about 157 is [Unverified].
  - Electron 45.3.0 is `latest` (2026-11-10), and 46.0.0-alpha.9 is out (2026-11-11). [Verified: https://registry.npmjs.org/electron]
  - Electron 45 shipped Chromium 156.0.8078.48 and now pins 156.0.8078.96; Electron main pins 159.0.8154.0. [Verified: EL45/DEPS; ELMAIN/DEPS; EWEB/electron-45-0.md] Chromium main is 160.0.8157.0. [Verified correction: CRMAIN/chrome/VERSION]
  - Electron 44 and later need macOS 13. [Verified: EWEB/electron-44-0.md]
- **Windows ARM64.** The wiki says it needs a flag, but main enables Qualcomm by default. Test on Snapdragon X. (Inference)

## 2. Features, WGSL, atomics
- **The spec has 25 optional features.** [Verified: SPEC]
- **Default exposure** [Verified correction: CR153/CR156/CR157 DEC]:
  - `texture-compression-unaligned` is unsafe-only in 153 and default from 156.
  - `atomic-vec2u-min-max` is absent in 153, needs a flag in 156, and is default from 157.
  - `texture-formats-tier1/2`, `primitive-index`, `texture-component-swizzle` and `subgroup-size-control` are default where supported.
  - BCD's first Chrome versions for the newer features run from 119 (float32-filterable) to 152 (subgroup-size-control), with subgroups at 134. [Verified: BCD/api/GPUSupportedFeatures.json]
- **Unsafe-only on main:** multi-draw-indirect, timestamps inside passes, subgroup matrix, the bindless "sampling resource table" and `SharedBufferMemoryD3D12Resource`. [Verified: CRMAIN/DEC]
- **Dawn's conditions, given as D3D12; Metal; Vulkan** [Verified: DAWN/src/dawn/native/{d3d12/PhysicalDeviceD3D12.cpp, metal/PhysicalDeviceMTL.mm, vulkan/PhysicalDeviceVk.cpp}; the subgroups line is a Verified correction]:
  - **shader-f16:** SM 6.2 + native 16-bit ops; always; shaderFloat16 + shaderInt16 + 16-bit storage.
  - **subgroups:** SM 6.0 wave ops; Apple6+ or Mac2; Vulkan 1.1 subgroup ops + `VK_EXT_subgroup_size_control`. With f16 on, Vulkan also needs `shaderSubgroupExtendedTypes`, or the device gets no subgroups (about 4% of devices). Off on Intel Gen-9.
  - **subgroup-size-control:** SM 6.6; only if min = max size; computeFullSubgroups.
  - **atomic-vec2u-min-max:** int64 atomics; Apple9, or Mac2 + Apple8 (M2 and later, not M1); int64 atomics + shaderInt64.
  - **timestamp-query:** if supported; counter sampling; timestampComputeAndGraphics.
  - **The rest:** float32-blendable, rg11b10ufloat-renderable, dual-source-blending, clip-distances and primitive-index are always on in D3D12 and Metal. float32-filterable needs supports32BitFloatFiltering on Metal. Vulkan needs per-format or per-feature bits.
  - **multi-draw-indirect:** unsafe-only; disabled; unsafe-only.
- Inference: on desktop GPUs, rely on float32-blendable, float32-filterable, rg11b10ufloat-renderable, dual-source-blending, clip-distances and indirect-first-instance (not verified per GPU). Keep f16, subgroups and 64-bit atomics optional.
- **Atomics.** WGSL has only `atomic<i32>` and `atomic<u32>`, plus `atomic<vec2<u32>>` for 64-bit min and max. There are no float atomics. [Verified: WGSL] Vulkan needs `VK_KHR_shader_atomic_int64`. [Verified: GPUWEB/proposals/atomic-64-min-max.md] Workarounds (background knowledge): fixed-point `atomicAdd`, compare-and-swap loops, additive blending, and workgroup or subgroup reductions.
- **WGSL language features.** The 13 measured in 153 are exactly Tint's shipped and kill-switch sets, so Electron 45 should have them all: packed_4x8_integer_dot_product, pointer_composite_access, readonly_and_readwrite_storage_textures, unrestricted_pointer_parameters, immediate_address_space, uniform_buffer_standard_layout, subgroup_id, subgroup_uniformity, texture_and_sampler_let, texture_formats_tier1, linear_indexing, buffer_view, swizzle_assignment. [Verified: DAWN/src/tint/lang/wgsl/feature_status.cc; Measured]
  - The unsafe-experimental ones (texel_buffers, sized_binding_array, multisampled_array_textures, fragment_depth) stayed hidden even with the unsafe flag (cause [Unverified]).
  - `linear_indexing` gives `global_invocation_index` for 2D dispatches. [Cited: WGSL]
- **Ray tracing.** There is none in the spec, `dawn.json` or Chrome. [Cited: SPEC; DAWN/src/dawn/dawn.json] Inference: use compute BVH or grid traversal, or screen-space approximations. Hardware ray tracing would need a native module, such as wgpu's experimental ray queries [Cited: https://github.com/gfx-rs/wgpu/blob/trunk/CHANGELOG.md], with no texture path into the canvas.

## 3. Limits and particle budget
- **Spec defaults:** binding 128 MiB, buffer 256 MiB, workgroup storage 16,384, 256 invocations, 65,535 workgroups per dimension, 8 storage buffers per stage, 32 colour-attachment bytes, `maxImmediateSize` 64. [Verified: SPEC]
- **Chrome rounds limits down to tiers** [Verified: DAWN/src/dawn/native/Limits.cpp]: workgroup storage 16/32/48/64 KiB; invocations 128/256/1,024; 65,535 workgroups per dimension in **every** tier; binding up to 1 GiB, then 2 GiB−4 and 4 GiB−4; buffer 256 MiB/1 GiB/2 GiB/4 GiB−4; storage buffers 8/10/16 (Metal is held at 10 because Dawn uses no argument buffers); colour bytes 64/128; 2D texture 4,096/8,192/16,384.
- **D3D12.** Dawn assumes 2 GiB (`kAssumedMaxBufferSize = 0x80000000`), so every Windows adapter gets a 2 GiB buffer and a 2 GiB−4 binding. Workgroup storage is 32 KiB. Qualcomm before Adreno 8xx binds only 2^28 bytes. [Verified correction: DAWN/src/dawn/common/Constants.h; DAWN d3d12/PhysicalDeviceD3D12.cpp]
- **NVIDIA on Vulkan.** The binding is capped at 2 GiB−4 ("OpArrayLength returns 0 for buffers >= 2GB", crbug.com/435684920). [Verified: DAWN vulkan/PhysicalDeviceVk.cpp]
- **Metal.** Buffer and binding are both min(UINT32_MAX, `maxBufferLength`). [Cited: DAWN metal/PhysicalDeviceMTL.mm] So 4 GiB−4 bindings exist only on Metal and non-NVIDIA Vulkan. [Verified correction: DAWN Constants.h, Limits.cpp] The tiers real AMD, Intel and Apple adapters reach are unverified.
- **Budget (calc), at 32 B per particle:** the default binding holds 4,194,304, 1 GiB holds 33,554,432, and 2 GiB−4 holds 67,108,863. 50M particles are 1.6e9 B (1.49 GiB), which needs buffer and binding limits of at least 1.6e9; ping-pong doubles that to 3.2 GB of VRAM. Today's 2M particles (64 MB) fit the defaults.
- **Inference:** request `requiredLimits` from `adapter.limits`, otherwise use SoA streams or fewer particles. Pack to about 16 B (`pack2x16float` or f16). 50M particles at 256 threads need 195,313 workgroups, so use a 2D dispatch. Use at most 8 storage buffers per stage (10 covers Metal), and keep each binding under 2 GiB. 32 KiB of workgroup storage is safe on Windows.

## 4. HDR and colour
- **The shipped route** is an rgba16float canvas with `toneMapping: { mode: "extended" }` and colorSpace `srgb` or `display-p3`. Chrome has it from 129 (ChromeOS, macOS, Windows) and 144 (Linux, Intel Gen12+); Firefox and Safari do not. [Verified: BCD/api/GPUCanvasContext.json] `configure()` accepts it and `getConfiguration()` reports it back [Measured]. Implementations without tone mapping leave it out there, so that is the feature test. [Verified: SPEC]
- **`GPUCanvasConfiguration`** has device, format, usage, viewFormats, colorSpace, toneMapping and alphaMode, and no present-mode, latency or desynchronized member. [Verified correction: SPEC]
- **Linear canvases** (`srgb-linear` and `display-p3-linear`, flag `ColorSpacePredefinedLinearSpaces`) are experimental in 153 and 156 and stable from 157. [Verified correction: CR156/CR157 RTE] In Electron 45, write sRGB-encoded extended values to `srgb`, or enable the flag through `webPreferences.enableBlinkFeatures`. (Inference)
- **PQ, HLG and rec2020** (`CanvasHDR`) and `rec2100-linear` are experimental. [Verified: CRMAIN/third_party/blink/renderer/core/html/canvas/predefined_color_space.idl; RTE]
- **There is no luminance or headroom API**, only the boolean `dynamic-range` query. [Cited: BCD/css/at-rules/media.json; https://github.com/w3c/ColorWeb-CG/blob/main/hdr_html_canvas_element.md] Inference: values above 1.0 exceed SDR white, up to the display's headroom, so offer a user HDR-peak slider. Real Windows (scRGB), macOS (EDR) and Wayland behaviour is unverified.
- **Linux.** There is no evidence that WebGPU canvases reach HDR. The display HDR features are ChromeOS-only, but an Ozone HDR10 video pass-through exists, so Linux HDR is untested, not ruled out. [Verified correction: CRMAIN/components/viz/common/features.cc; CRMAIN/ui/display/display_features.cc] Expect SDR. (Inference)
- **SDR.** Use `getPreferredCanvasFormat()`, because `rgba8unorm` canvases fail on macOS. [Verified: BCD/api/GPUCanvasContext.json]

## 5. Frame pacing
- **Frames follow vsync**: DXGI `WaitForVBlank` or the DirectComposition clock on Windows, DisplayLink on macOS. [Cited: CRMAIN/ui/gl/vsync_thread_win.cc]
- `--disable-frame-rate-limit` implies `--disable-gpu-vsync`. A TODO says VRR is not implemented on Windows (crbug.com/346931323). [Verified: CRMAIN/components/viz/common/switches.cc]
- There is no present-mode, latency, VRR or presentation-feedback API. [Cited: SPEC]
- Inference: run a fixed-timestep simulation with interpolation, and measure the real frame interval. The GPU budget is 2 ms at 500 Hz, 4.2 ms at 240 Hz and 8.3 ms at 120 Hz. Queue at most two frames, using `onSubmittedWorkDone`.

## 6. Robustness
- **Device loss** gives "unknown" or "destroyed". `requestDevice` consumes the adapter, so recovery needs a new `requestAdapter()`. [Verified: SPEC]
- **GPU watchdog**: 30 s on Windows, 25 s on macOS, 15 s elsewhere; `--gpu-watchdog-timeout-seconds` overrides it. [Verified: CRMAIN/gpu/ipc/common/gpu_watchdog_timeout.h] Windows TDR is far shorter (2 s, background knowledge).
- **Electron** emits `app` `'child-process-gone'` with type `GPU`. [Verified: ELMAIN/docs/api/app.md]
- **Recovery (Inference).** On loss, rebuild from a new adapter and re-seed from a compact snapshot of emitter and preset state. After repeated losses, use WebGL2. Keep each submit well under about 100 ms, and wrap large allocations in error scopes.

## 7. Profiling
- **Timestamps are quantized by default**: the mask 0xFFFF0000 on nanoseconds gives steps of about 65.5 µs. `--enable-webgpu-developer-features` or `--enable-unsafe-webgpu` removes this. Timestamps inside passes are unsafe-only. [Verified: CRMAIN/DEC; CRMAIN dawn_instance.cc; DAWN/src/dawn/common/Constants.h] Inference: use the developer flag in development builds; in shipping builds, use timestamps only for coarse adaptive quality, because passes under 0.1 ms read as noise.
- **Capture.** RenderDoc capture of Chrome works on Windows D3D12 only. On Metal, `DAWN_TRACE_FILE_BASE` with `MTL_CAPTURE_ENABLED=1` writes a `.gputrace`. [Verified: DAWN/docs/dawn/debugging.md]

## 8. Vendor issues
- **Only the gating in source code is documented:** the NVIDIA Vulkan `arrayLength` bug at 2 GB or more, the Linux allowlist, Metal without argument buffers, and the Qualcomm Windows blocklist (Adreno 7180, 7280, 8180, 8280 and 8340 blocked; the 8380 needs driver 31.0.117 or newer). [Verified or Cited: the sources above; CRMAIN/gpu/config/webgpu_blocklist_impl.cc] There is no 2025–2026 tracker evidence about compute or blending cliffs.
- Inference: additive overdraw is the main cliff, worst on integrated Intel and Apple GPUs. Use rg11b10ufloat or rgba16float accumulation (not rgba32float), half-resolution particle passes, and fixed-point splatting for dense regions.

## 9. CI in this container
- **Measured** (the feature list and count are Verified corrections): `navigator.gpu` works with only `--enable-unsafe-webgpu`. The adapter reports "google", "swiftshader", `isFallbackAdapter` true and an empty description, so gate on `vendor` and `architecture`. It has 19 standard features plus two `chromium-experimental-*` ones, and lacks shader-f16, dual-source-blending, primitive-index, texture-formats-tier1/2 and atomic-vec2u-min-max. Limits: 1 GiB buffer and binding, 32 KiB workgroup storage, 256 invocations, 10 storage buffers, 8,192 texture, 128 colour bytes, subgroup size 4. `WEBGL_debug_renderer_info` gives the unmasked renderer.
- **Presentation fails** headless and under Xvfb, with every flag set tried ("A valid external Instance reference no longer exists"). Offscreen rendering, compute and `copyTextureToBuffer` readback work. [Verified: Measured]
  - The likely cause is that `GetWebGPUOnVulkanViaGLInterop()` returns "disabled" on software GL. [Verified, code path only: CR156/gpu/config/gpu_util.cc]
  - Retest with the shipped Electron on a real Wayland GPU before assuming users are affected. [Unverified]
- **Software timing** (measured here and supplied with this pass, not in the notes; not GPU data): a 32 B-per-particle compute step plus a 1-pixel additive point draw took about 22 ms at 20k particles and 131 ms at 300k.
- **CI policy (Inference):**
  1. Headless Linux CI checks compute and offscreen correctness only, using `copyTextureToBuffer` readback and tolerance goldens.
  2. Real-GPU runners cover presentation, HDR, rAF cadence and device loss: Windows D3D12 (NVIDIA, AMD, Intel), macOS (M1 and M2+), and Linux (Intel Gen12+ or NVIDIA on Wayland, plus AMD).
  3. The unsafe flag bypasses the allowlist, so force "no adapter → WebGL2" with a test flag. Keep the unsafe switch out of production unless the Linux policy deliberately chooses it.
  4. A subgroup size of 4 breaks code that assumes 32-wide ballots.
  5. Cap test buffers at 1 GiB, and test that over-limit requests scale down. SwiftShader timings mean nothing for budgets, and HDR can be tested only at the API level.
  6. Run CI on the shipped Electron, since CI measured 153 and Electron 45 is 156.

## 10. Corrections the notes record for other files
- **gpu_particle_simulation.md.** "About 2 GiB binding on Windows/NVIDIA" is exact, since every D3D12 adapter tiers to 2 GiB−4. [Verified: DAWN Constants.h]
- **gpu_light_rendering.md.** 32 KiB of workgroup storage is safe on D3D12, linear values need sRGB encoding in Electron 45, and timestamp budgets must allow for 65.5 µs quantization.

## 11. Open gaps
- Does `ForceEnableWebGpuInterop` or the unsafe recipe render correctly on AMD with RADV?
- There is no fleet data on fallback shares, limit tiers or features per GPU.
- Real HDR output on each OS.
- rAF on mixed-refresh monitors, VRR, and Linux pacing.
- Whether Chrome blocks WebGPU after repeated GPU crashes.
- Vendor bugs from 2025–2026.
- Which Chromium Electron 46 ships.
