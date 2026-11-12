# WebGPU and WGSL on desktop Chromium (Chrome and Electron), as of 12 November 2026

How these notes were made:
- **Main sources.** Most findings come from primary source files read on 12 November 2026 through raw.githubusercontent.com: the gpuweb spec and proposals, the Dawn (Chrome's WebGPU engine) repository, the Chromium GitHub mirror, Electron's docs, blog and DEPS file, the browser-compat-data (BCD) package and caniuse data.
- **Sources I could not reach.** The session's network allowlist blocked developer.chrome.com, MDN, webgpureport.org, web3dsurvey, the Chromium issue tracker and the Microsoft docs. The shared web-search budget also ran out partway through. Anything seen only in a search-result snippet is marked "(search summary, not verified)"; this applies to every "What's New in WebGPU" post cited.
- **In-container measurements.** The coordinator ran headless Chromium 153 with the SwiftShader fallback adapter in this container. Results are cited as "coordinator measurement" (no URL); their meaning for CI is covered in Q10.
- **Chromium main runs ahead of stable.** Files read from Chromium and Dawn `main` describe code about two to four milestones newer than stable Chrome and Electron 45, which uses Chromium 156. Treat "present on main" as "shipping in stable or shipping very soon" unless a milestone is cited.

## Q1. Is WebGPU on by default in Chrome and Electron on Windows, macOS and Linux? Versions, GPUs, drivers and switches (with Safari and Firefox for reference)

### Takeaway
- **Where it is on by default.** In Chrome and Electron, WebGPU is on by default on Windows (D3D12, NVIDIA, AMD and Intel) and on macOS (Metal).
- **Linux.** It is on by default only for Intel Gen12+ with Mesa 22.0 or newer, and for NVIDIA with driver 535.183.01 or newer. The gpuweb status page says NVIDIA is supported on Wayland only. AMD and all other Linux GPUs are still blocklisted and need command-line switches.
- **Versions.** Chrome switched to two-week releases starting with Chrome 153 on 8 September 2026, so stable is about Chrome 157 on 12 November 2026. Electron 45, the current stable line (45.3.0, released 10 November 2026), ships Chromium 156.

### Cited Findings

**Chrome: platform status and blocklists**
- **gpuweb implementation status: Chromium.**
  - On by default since Chrome 113 on Mac, Windows (x86/x64) and ChromeOS.
  - On Android since 121.
  - On Linux: "Intel Gen12+: 144" and "NVIDIA (driver 535.183.01+) Wayland: 147". Other Linux GPUs are "Behind a flag" and need `--enable-unsafe-webgpu --ozone-platform=x11 --use-angle=vulkan --enable-features=Vulkan,VulkanFromANGLE`, with up-to-date drivers.
  - Windows ARM64 is "Behind a flag" (`chrome://flags/#enable-unsafe-webgpu` or `--enable-unsafe-webgpu`).
  - Source: [gpuweb wiki: Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)
- **Chromium GPU blocklist entry 186 (Linux).** It is titled "Disable webgpu on vk via gl interop" (feature `webgpu_on_vk_via_gl_interop`). It has only two exceptions:
  - vendor 0x8086 (Intel) with `intel_gpu_generation >= 12`, driver vendor Mesa, driver version 22.0 or newer;
  - vendor 0x10de (NVIDIA) with driver version 535.183.01 or newer.

  AMD is not excepted, so it stays blocked by default. Source: [Chromium gpu/config/software_rendering_list.json](https://github.com/chromium/chromium/blob/main/gpu/config/software_rendering_list.json)
- **Chrome 144 post (published 7 January 2026; search summary, not verified).** It began a staged rollout of WebGPU on Linux, starting with Intel Gen12+ and a "tentative plan" to add AMD and NVIDIA. On Linux, WebGPU runs on Vulkan while the rest of Chromium stays on OpenGL. Source: [What's New in WebGPU (Chrome 144)](https://developer.chrome.com/blog/new-in-webgpu-144)
- **Chrome 147–148 post (published 22 April 2026; search summary, not verified).** It extends Linux support to newer NVIDIA drivers on Wayland. Source: [What's New in WebGPU (Chrome 147–148)](https://developer.chrome.com/blog/new-in-webgpu-147-148)
- **Service gating in Chromium.** The `kWebGPUService` feature is enabled by default on Apple, Windows, ChromeOS, Android, and builds with `USE_WEBGPU_ON_VULKAN_VIA_GL_INTEROP` (the Linux path). Finer gating is done by the blocklists. Source: [Chromium gpu/config/gpu_finch_features.cc](https://github.com/chromium/chromium/blob/main/gpu/config/gpu_finch_features.cc)
- **Windows adapter blocklist.**
  - On D3D12, NVIDIA, AMD, Intel and Microsoft (0x1414) adapters are allowed.
  - Qualcomm is allowed only when `kWebGPUQualcommWindows` is on (it is enabled by default), and the driver-string blocklist covers Adreno 6xx and early 7xx and drivers older than 31.0.117.
  - Any other vendor gets "WindowsLimitedSupport".
  - The D3D11 backend and CPU adapters are always blocklisted.
  - 32-bit x86 builds on NVIDIA are blocked ("IndirectComputeRootConstants").

  Source: [Chromium gpu/config/webgpu_blocklist_impl.cc](https://github.com/chromium/chromium/blob/main/gpu/config/webgpu_blocklist_impl.cc)
- **What `--enable-unsafe-webgpu` does.** It sets the "unsafe" safety level. That disables the adapter blocklist (the same as `--disable-dawn-features=adapter_blocklist`), allows the SwiftShader fallback adapter, and exposes experimental features. Source: [Chromium gpu/command_buffer/service/webgpu_decoder_impl.cc](https://github.com/chromium/chromium/blob/main/gpu/command_buffer/service/webgpu_decoder_impl.cc)
- **WebGPU switches defined in Chromium:** `enable-unsafe-webgpu`, `enable-webgpu-developer-features`, `enable-dawn-backend-validation`, `use-webgpu-adapter`, `use-webgpu-power-preference`, `force-webgpu-compat`, `force-high-performance-gpu`. Source: [Chromium gpu/config/gpu_switches.cc](https://github.com/chromium/chromium/blob/main/gpu/config/gpu_switches.cc)

**Chrome: release versions**
- **Two-week release cycle (search summary, not verified).** Google announced on 3 March 2026 that Chrome would move to two-week major releases, starting with Chrome 153 (stable 8 September 2026). Chrome 154 was expected on 22 September 2026. Extended Stable stays on an eight-week cycle. Sources: [Chrome blog: two-week release cycle](https://developer.chrome.com/blog/chrome-two-week-release); [TechCrunch, 2026-03-03](https://techcrunch.com/2026/03/03/amid-new-competition-chrome-speeds-up-its-release-schedule/)
- **caniuse.** Chrome 155–160 are listed as "y" with note 9: "Support on Linux depends on hardware and drivers". Source: [caniuse webgpu.json](https://github.com/Fyrd/caniuse/blob/main/features-json/webgpu.json)

**Electron**
- **Current versions (npm).** The `latest` tag is 45.3.0 (published 2026-11-10). Electron 45.0.0 was published 2026-10-21, and the alpha line is 46.0.0-alpha.9 (2026-11-11). Earlier first-stable dates:

  | Electron | First stable |
  |---|---|
  | 40.0.0 | 2026-01-16 |
  | 41.0.0 | 2026-03-11 |
  | 42.0.0 | 2026-05-06 |
  | 43.0.0 | 2026-06-30 |
  | 44.0.0 | 2026-08-25 |

  Source: [npm registry: electron](https://registry.npmjs.org/electron)
- **Chromium version per Electron major (from the release posts):**

  | Electron | Chromium |
  |---|---|
  | 42 | 148.0.7778.96 |
  | 43 | 150.0.7871.46 |
  | 44 | 152.0.7977.54 |
  | 45 | 156.0.8078.48 (also V8 15.6 and Node v24.22.0) |

  Sources: [Electron 45 post](https://github.com/electron/website/blob/main/blog/electron-45-0.md); [Electron 44 post](https://github.com/electron/website/blob/main/blog/electron-44-0.md); [Electron 43 post](https://github.com/electron/website/blob/main/blog/electron-43-0.md); [Electron 42 post](https://github.com/electron/website/blob/main/blog/electron-42-0.md)
- **Electron `main` branch.** Its DEPS file pins `chromium_version` 159.0.8154.0. Source: [electron/electron DEPS](https://github.com/electron/electron/blob/main/DEPS)
- **Electron 44 changes.**
  - It requires macOS 13 (Ventura) or later.
  - ANGLE is now statically linked on all platforms, so `libEGL` and `libGLESv2` can no longer be swapped.

  Source: [Electron 44 post](https://github.com/electron/website/blob/main/blog/electron-44-0.md)
- **Electron 38: Wayland by default.** `ELECTRON_OZONE_PLATFORM_HINT` was removed and `--ozone-platform` now defaults to `auto`. Electron runs as a native Wayland app in a Wayland session; `--ozone-platform=x11` forces XWayland. Source: [Electron breaking-changes.md](https://github.com/electron/electron/blob/main/docs/breaking-changes.md)
- **Electron switches documentation.** It lists `--force_high_performance_gpu` and `--force_low_power_gpu` for dual-GPU systems, and mentions no WebGPU-specific switch. Source: [Electron command-line-switches.md](https://github.com/electron/electron/blob/main/docs/api/command-line-switches.md)

**Firefox and Safari (for reference)**
- **Firefox (gpuweb status).**
  - Windows: Firefox 141.
  - macOS Apple Silicon: Firefox 145 on macOS 26+, and Firefox 147 on all macOS versions.
  - Linux and Intel Macs: Nightly only. "Mozilla expects to ship on Linux in 2026."
  - Android: behind a flag.

  Source: [gpuweb wiki: Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)
- **caniuse on Firefox.** It marks Firefox as partial, "Only enabled by default on Windows as well as macOS 26 Tahoe or later on Apple Silicon". This conflicts with the gpuweb statement about Firefox 147 on all macOS versions. Source: [caniuse webgpu.json](https://github.com/Fyrd/caniuse/blob/main/features-json/webgpu.json)
- **Safari.** WebGPU is supported and on by default in macOS Tahoe 26, iOS/iPadOS 26 and visionOS 26. Source: [gpuweb wiki: Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status). caniuse lists Safari 26.6, 27, 27.x and TP as partial: on by default only on macOS 26 Tahoe or later. Source: [caniuse webgpu.json](https://github.com/Fyrd/caniuse/blob/main/features-json/webgpu.json)
- **BCD note on canvas formats.** BCD's WebGPU note reads "Supported on ChromeOS, macOS, Windows, and Linux (Intel Gen12+ GPUs only)", and it notes that the `rgba8unorm` canvas format is not supported on macOS (crbug.com/40823053). Source: [BCD api/GPUCanvasContext.json](https://github.com/mdn/browser-compat-data/blob/main/api/GPUCanvasContext.json)

### Inferences
- **Current Chrome stable (calculated).** With 153 on 8 September and a release every two weeks: 155 around 6 October, 156 around 20 October, 157 around 3 November, and 158 due around 17 November. So Chrome 157 is the most likely current stable.
- **Electron lags Chrome and jumps four milestones per release.** Electron 45 (Chromium 156) is about one milestone behind Chrome stable. Electron still ships a major every eight weeks or so, but since Chrome moved to two-week releases each Electron major skips four Chromium milestones (152 to 156).
- **Electron behaves like Chrome on the same Chromium.** It bundles the same Chromium GPU blocklists, so a Tactilume Desktop user on Linux with AMD, pre-Gen12 Intel or old NVIDIA drivers gets no WebGPU adapter by default.
- **Turning WebGPU on for Linux in the shell.** The app could add `enable-unsafe-webgpu`, `enable-features=Vulkan,VulkanFromANGLE` and `use-angle=vulkan` (and possibly `ozone-platform=x11`) with `app.commandLine.appendSwitch` before the `ready` event. This disables the whole blocklist and exposes experimental APIs. It is acceptable only for a renderer that loads trusted local content, and it removes Chromium's protection against known-bad drivers.
- **Wayland is now the default for Electron on Linux (since 38).** That helps on NVIDIA, because the default WebGPU path on NVIDIA is Wayland-only. The gpuweb flag recipe for other GPUs, however, uses X11.
- **Windows ARM64 is uncertain.** The gpuweb wiki says behind a flag, but Chromium `main` code enables Qualcomm Windows by default with driver gating. Snapdragon X machines with current drivers may get WebGPU by default on recent milestones. Test on hardware.

### Gaps
- I could not read the "What's New in WebGPU" posts for 149–150 and 153–154 (developer.chrome.com is blocked here), so Linux AMD rollout news after April 2026 is unconfirmed. On Chromium `main` in November 2026, AMD on Linux is still not on the allowlist.
- No authoritative release page confirmed the exact current Chrome stable version and date; 157 is calculated from the published schedule.
- The exact current Firefox and Safari release numbers were not verified. caniuse lists Safari 27.x entries, which suggests Safari 27 has shipped.

## Q2. Optional features in practice on NVIDIA, AMD, Intel and Apple; WGSL language extensions; atomics

### Takeaway
- **Features.** The spec now defines 25 optional features. Chrome exposes every hardware-supported core feature by default, including the newer `texture-formats-tier1/2`, `primitive-index`, `texture-component-swizzle`, `subgroup-size-control`, `texture-compression-unaligned` and `atomic-vec2u-min-max`. Multi-draw-indirect, timestamps inside passes, subgroup matrix and the bindless "sampling resource table" stay unsafe-only.
- **Atomics.** Only `atomic<i32>` and `atomic<u32>` exist, plus `atomic<vec2<u32>>` as a 64-bit type for min and max only, behind `atomic-vec2u-min-max`. There are still no float atomics.

### Cited Findings

**Feature list and Chrome exposure**
- **The spec's `GPUFeatureName` list:**
  - `core-features-and-limits`, `depth-clip-control`, `depth32float-stencil8`
  - `texture-compression-bc`, `texture-compression-bc-sliced-3d`, `texture-compression-etc2`, `texture-compression-astc`, `texture-compression-astc-sliced-3d`, `texture-compression-unaligned`
  - `timestamp-query`, `indirect-first-instance`, `shader-f16`
  - `rg11b10ufloat-renderable`, `bgra8unorm-storage`, `float32-filterable`, `float32-blendable`
  - `clip-distances`, `dual-source-blending`
  - `subgroups`, `subgroup-size-control`
  - `texture-formats-tier1`, `texture-formats-tier2`, `primitive-index`, `texture-component-swizzle`
  - `atomic-vec2u-min-max`

  Source: [gpuweb spec index.bs](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs) (rendered at gpuweb.github.io/gpuweb)
- **What the newest features do:**
  - `atomic-vec2u-min-max`: "64-bit atomic minimum and maximum operations on `atomic`"; enables WGSL `atomic_vec2u_min_max`.
  - `subgroup-size-control`: enables `subgroups` and the WGSL `subgroup_size` attribute.
  - `texture-component-swizzle`: adds `GPUTextureViewDescriptor.swizzle`.
  - `texture-compression-unaligned`: allows block-compressed textures whose size is not a multiple of the block size.
  - `primitive-index`: enables the `primitive_index` builtin.

  Source: [gpuweb spec index.bs](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs)
- **Chrome's exposure rules.** Chrome's WebGPU decoder exposes these when Dawn supports them, unless a remote kill-switch list (`UnsafeFeatures`) names them:
  - the core features (BC/ETC2/ASTC and the sliced-3D variants, `timestamp-query`, `indirect-first-instance`, `shader-f16`, `rg11b10ufloat-renderable`, `bgra8unorm-storage`, `float32-filterable`, `float32-blendable`);
  - `ClipDistances`, `DualSourceBlending`, `Subgroups`, `TextureFormatsTier1/2`, `PrimitiveIndex`, `TextureComponentSwizzle`, `SubgroupSizeControl`, `TextureCompressionUnaligned`, `AtomicVec2uMinMax`.

  Only in unsafe mode (`--enable-unsafe-webgpu`): `ChromiumExperimentalTimestampQueryInsidePasses`, `ChromiumExperimentalSamplingResourceTable`, `MultiDrawIndirect`, `SharedBufferMemoryD3D12Resource`, `ChromiumExperimentalSubgroupMatrix`. Source: [Chromium webgpu_decoder_impl.cc](https://github.com/chromium/chromium/blob/main/gpu/command_buffer/service/webgpu_decoder_impl.cc)

**Per-backend conditions in Dawn**
- **D3D12 (Windows).**
  - Always enabled: BC, `IndirectFirstInstance`, `RG11B10UfloatRenderable`, `DepthClipControl`, `Float32Filterable`, `Float32Blendable`, `DualSourceBlending`, `MultiDrawIndirect`, `ClipDistances`, `TextureFormatsTier1`, `TextureComponentSwizzle`, `PrimitiveIndex`.
  - Conditional:

    | Feature | D3D12 condition |
    |---|---|
    | `ShaderF16` | DXC 1.4+, shader model 6.2 or higher, and native 16-bit shader ops |
    | `Subgroups` | SM 6.0 wave ops |
    | `SubgroupSizeControl` | SM 6.6 (`[WaveSize]`) |
    | `AtomicVec2uMinMax` | int64 atomics |
    | `BGRA8UnormStorage` | typed-UAV support for BGRA8 |
    | `TextureFormatsTier2` | R8 typed UAV load and store |
    | `TimestampQuery` | `AreTimestampQueriesSupported()` |

  Source: [Dawn d3d12/PhysicalDeviceD3D12.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp)
- **Vulkan (Linux).**

  | Feature | Vulkan condition |
  |---|---|
  | `ShaderF16` | `shaderFloat16`, `shaderInt16` and `storageBuffer16BitAccess` (disabled on Huawei Maleoon) |
  | `Subgroups` | base subgroup support **and** the required F16 support, with subgroup size ranges allowed |
  | `SubgroupSizeControl` | also needs `computeFullSubgroups` |
  | `AtomicVec2uMinMax` | 64-bit atomics and `shaderInt64` |
  | `DualSourceBlending` | `dualSrcBlend` |
  | `ClipDistances` | `shaderClipDistance` (not on Adreno 6xx) |
  | `PrimitiveIndex` | the `geometryShader` feature |
  | `TimestampQuery` | `timestampComputeAndGraphics` |
  | `MultiDrawIndirect` | `DrawIndirectCount` and `multiDrawIndirect` |
  | `TextureComponentSwizzle` | always |
  | `Float32Filterable`, `Float32Blendable`, `RG11B10UfloatRenderable`, `BGRA8UnormStorage`, tiers 1 and 2 | per-format properties |

  Source: [Dawn vulkan/PhysicalDeviceVk.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/vulkan/PhysicalDeviceVk.cpp)
- **Metal (macOS).**
  - Always enabled: `IndirectFirstInstance`, `ShaderF16`, `RG11B10UfloatRenderable`, `BGRA8UnormStorage`, `DualSourceBlending`, `ClipDistances`, `Float32Blendable`, `TextureFormatsTier1`, `PrimitiveIndex`.
  - Conditional:

    | Feature | Metal condition |
    |---|---|
    | `Float32Filterable` | `supports32BitFloatFiltering` (or the Mac2 family) |
    | BC compression | `supportsBCTextureCompression` |
    | `TimestampQuery` | GPU timestamp counter support; timestamps *inside* passes only with command-boundary sampling |
    | `Subgroups` | Apple6+ or Mac2 |
    | `SubgroupSizeControl` | only when min subgroup size equals max subgroup size |
    | `AtomicVec2uMinMax` | Apple9, or Mac2 together with Apple8 |
    | `TextureFormatsTier2` | `MTLReadWriteTextureTier2` |
    | `MultiDrawIndirect` | disabled ("Re-enable this feature when we use argument buffers") |

  Source: [Dawn metal/PhysicalDeviceMTL.mm](https://github.com/google/dawn/blob/main/src/dawn/native/metal/PhysicalDeviceMTL.mm)

**WGSL language extensions and atomics**
- **WGSL language-extension status in Tint (Dawn's WGSL compiler):**
  - **Shipped:** `packed_4x8_integer_dot_product`, `pointer_composite_access`, `readonly_and_readwrite_storage_textures`, `unrestricted_pointer_parameters`, `immediate_address_space`, `uniform_buffer_standard_layout`.
  - **Shipped with kill-switch:** `subgroup_id`, `subgroup_uniformity`, `texture_and_sampler_let`, `texture_formats_tier1`, `linear_indexing`, `buffer_view`, `swizzle_assignment`.
  - **Unsafe experimental:** `sized_binding_array`, `texel_buffers`, `multisampled_array_textures`, `fragment_depth` (and `chromium_print`).

  Source: [Dawn src/tint/lang/wgsl/feature_status.cc](https://github.com/google/dawn/blob/main/src/tint/lang/wgsl/feature_status.cc)
- **What some of these extensions do:**
  - `linear_indexing` adds the `global_invocation_index` and `workgroup_index` builtins.
  - `immediate_address_space` adds `var<immediate>` for small data set from the encoder.
  - `buffer_view` adds buffer types and buffer_view builtins.
  - `swizzle_assignment` lets one assignment update several vector components.
  - `subgroup_id` adds `subgroup_id` and `num_subgroups`.
  - `readonly_and_readwrite_storage_textures` also adds `textureBarrier`.

  Source: [gpuweb WGSL index.bs](https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs)
- **WGSL atomic types.** "`atomic<T>`: T must be either u32 or i32". `atomic<vec2<u32>>` "denotes an unsigned 64-bit integer type". Source: [gpuweb WGSL index.bs](https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs)
- **The 64-bit atomics proposal.** Status Merged; created 2025-09-15; spec PR #5610. "The WGSL spec does not have a 64 bit integer type and there are no near term plans to do support it", so `vec2u` is used as a surrogate. Vulkan needs `VK_KHR_shader_atomic_int64`. Source: [gpuweb proposals/atomic-64-min-max.md](https://github.com/gpuweb/gpuweb/blob/main/proposals/atomic-64-min-max.md)

**Proposals, Chrome milestones and runtime flags**
- **Other proposals:**

  | Proposal | Status | Notes |
  |---|---|---|
  | `subgroup-size-control` | Merged | created 2026-01-28 |
  | `immediate-data` | Merged | spec PR #5423; `setImmediates()`, `maxImmediateSize` default 64 bytes |
  | `primitive-index` | Merged | — |
  | `bindless` | Draft | created 2025-10-13 |
  | `texel-buffers` | Draft | created 2024-10-07 |

  Sources: [subgroup-size-control.md](https://github.com/gpuweb/gpuweb/blob/main/proposals/subgroup-size-control.md); [immediate-data.md](https://github.com/gpuweb/gpuweb/blob/main/proposals/immediate-data.md); [bindless.md](https://github.com/gpuweb/gpuweb/blob/main/proposals/bindless.md); [texel-buffers.md](https://github.com/gpuweb/gpuweb/blob/main/proposals/texel-buffers.md); [primitive-index.md](https://github.com/gpuweb/gpuweb/blob/main/proposals/primitive-index.md)
- **Chrome milestones (search summary, not verified):**

  | Chrome | Published | Changes |
  |---|---|---|
  | 144 | 7 Jan 2026 | WGSL `subgroup_id` and `uniform_buffer_standard_layout` |
  | 145 | 28 Jan 2026 | WGSL `subgroup_uniformity`; experimental `GPUBuffer.mapSync()` in workers |
  | 146 | 25 Feb 2026 | opt-in compatibility mode through `featureLevel`; `TRANSIENT_ATTACHMENT` usage |
  | 151–152 | 12 Aug 2026 | invalid `setImmediates()` arguments now throw `OperationError` |
  | 155–156 | — | WGSL `fragment_depth` extension, texture compression unaligned, `srgb-linear` and `display-p3-linear` canvas color spaces |

  Sources: [Chrome 144](https://developer.chrome.com/blog/new-in-webgpu-144); [Chrome 145](https://developer.chrome.com/blog/new-in-webgpu-145); [Chrome 146](https://developer.chrome.com/blog/new-in-webgpu-146); [Chrome 151–152](https://developer.chrome.com/blog/new-in-webgpu-151-152); [WebGPU news index](https://developer.chrome.com/docs/web-platform/webgpu/news)
- **Blink runtime flags.** `WebGPUDeveloperFeatures`, `WebGPUExperimentalFeatures` (experimental), `WebGPUExperimentalResourceTable` (implied by experimental features), `WebGPUExternalImageHDRHeadroom` (experimental), `WebGPUMapSyncOnWorkers` (experimental). Source: [Chromium runtime_enabled_features.json5](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/runtime_enabled_features.json5)
- **Measured in this container (headless Chromium 153, SwiftShader fallback adapter, `--enable-unsafe-webgpu` only).**
  - Adapter features: `subgroups`, `subgroup-size-control`, `timestamp-query`, `float32-filterable`, `float32-blendable`, `rg11b10ufloat-renderable`, `bgra8unorm-storage`, `clip-distances`, `texture-component-swizzle`, `core-features-and-limits`.
  - `wgslLanguageFeatures`: `buffer_view`, `immediate_address_space`, `linear_indexing`, `packed_4x8_integer_dot_product`, `pointer_composite_access`, `readonly_and_readwrite_storage_textures`, `subgroup_id`, `subgroup_uniformity`, `swizzle_assignment`, `texture_and_sampler_let`, `texture_formats_tier1`, `uniform_buffer_standard_layout`, `unrestricted_pointer_parameters`.

  Source: coordinator measurement, 12 November 2026 (no URL)

### Inferences
- **What a Tactilume particle renderer can rely on:**
  - Everywhere on desktop: `float32-blendable`, `float32-filterable`, `rg11b10ufloat-renderable`, `dual-source-blending`, `clip-distances` and `indirect-first-instance`. These are always on in Dawn's D3D12 and Metal backends and depend on per-format or per-feature bits on Vulkan, which current desktop drivers normally report (not verified per GPU).
  - Very likely: `timestamp-query` (needed for profiling).
- **`shader-f16` and `subgroups` are the risky ones.**
  - On D3D12 they depend on shader model 6.2 with native 16-bit ops, and on SM 6.0 wave ops.
  - On Vulkan, Dawn ties `subgroups` to f16 support.
  - Background knowledge, not verified here: some older GPUs (for example NVIDIA Pascal on D3D12) may lack native 16-bit ops.
  - Keep f16 and subgroup code paths optional.
- **`atomic-vec2u-min-max` is not on M1 Macs.** It needs Apple9, or Apple8 plus Mac2, which means M2 and newer. It also needs int64 atomics on D3D12 and Vulkan. Treat it as an optional fast path, for example 64-bit depth-plus-payload software rasterization of point sprites. Its first stable milestone is unknown, so it may not be in Electron 45.
- **Standard workarounds for missing float atomics** (background knowledge, not from a fetched source):
  - fixed-point accumulation with `atomicAdd` on u32/i32, with per-channel scale and saturation handling;
  - `atomicCompareExchangeWeak` loops on bit-cast u32 for float add, min and max;
  - order-preserving float-to-uint encoding for `atomicMin`/`atomicMax`;
  - avoiding atomics altogether with additive blending into an rgba16float target (core-blendable) or with per-workgroup reductions through subgroups or workgroup memory.
- **`linear_indexing` helps very large particle counts.** Its `global_invocation_index` builtin simplifies flattening a 2D dispatch grid (see Q3).
- **The measured WGSL list matches Tint's shipped sets exactly.** The 13 language features measured in Chromium 153 are Tint's "shipped" plus "shipped with kill-switch" sets. So all 13 were already exposed by Chromium 153, and Electron 45 (Chromium 156) should have them.
- **Unsafe-experimental WGSL features did not appear.** None of Tint's "unsafe experimental" language features (`texel_buffers`, `sized_binding_array`, `multisampled_array_textures`, `fragment_depth`) showed up, even with `--enable-unsafe-webgpu`. They probably need a further switch (for example developer or experimental Blink features) or were not in 153 yet. Not verified.
- **The 153 measurement does not prove default exposure.** It shows `subgroup-size-control` and `texture-component-swizzle` existed by Chromium 153. Because it ran in unsafe mode, it does not prove they were exposed by default in 153.

### Gaps
- No per-GPU feature statistics were available (webgpureport.org and web3dsurvey are blocked), so "available in practice" is derived from Dawn's backend conditions, not measured fleet data.
- The stable milestones for `subgroup-size-control`, `atomic-vec2u-min-max`, `texture-component-swizzle`, `texture-formats-tier1/2` and `primitive-index` were not confirmed.
- ETC2 and ASTC support on desktop backends was not checked in Dawn's code.

## Q3. Typical desktop adapter limits compared with defaults; a 50M-particle buffer; how to request higher limits

### Takeaway
- **Chrome reports bucketed limits.** Chrome rounds each adapter limit down to a fixed tier.
- **What is achievable on desktop:** 1024 invocations per workgroup, 32–64 KiB of workgroup storage, a maximum of 65,535 workgroups per dimension in every tier, `maxBufferSize` up to 4 GiB−4, and storage bindings up to 2 GiB−4 (capped there on NVIDIA Vulkan) or 4 GiB−4.
- **50M particles at 32 bytes is 1.6 GB.** That needs a device requested with about 2 GiB buffer and binding limits. It works on most discrete and Apple GPUs, but plan an SoA split, f16 packing and a 2D dispatch.

### Cited Findings
- **Spec defaults:**

  | Limit | Default |
  |---|---|
  | `maxStorageBufferBindingSize` | 134,217,728 (128 MiB) |
  | `maxBufferSize` | 268,435,456 (256 MiB) |
  | `maxComputeWorkgroupStorageSize` | 16,384 |
  | `maxComputeInvocationsPerWorkgroup` | 256 (compat mode 128) |
  | `maxComputeWorkgroupsPerDimension` | 65,535 |
  | `maxStorageBuffersPerShaderStage` | 8 |
  | `maxColorAttachmentBytesPerSample` | 32 |
  | `maxImmediateSize` | 64 |
  | `maxStorageBuffersInVertexStage` | 8 (compat 0) |
  | `maxStorageBuffersInFragmentStage` | 8 (compat 4) |
  | `maxUniformBufferBindingSize` | 65,536 |

  Source: [gpuweb spec index.bs](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs)
- **Chrome/Dawn limit tiers (adapters are rounded down to these):**

  | Limit | Tiers |
  |---|---|
  | `maxComputeWorkgroupStorageSize` | 16,384 / 16,384 / 32,768 / 49,152 / 65,536 |
  | `maxComputeInvocationsPerWorkgroup` (and `maxComputeWorkgroupSizeX/Y`) | 128 / 256 / 1,024 |
  | `maxComputeWorkgroupSizeZ` | 64 in all tiers |
  | `maxComputeWorkgroupsPerDimension` | 65,535 in **all** tiers |
  | `maxStorageBufferBindingSize` | 128 MiB / 128 MiB / 256 MiB / 512 MiB / 1 GiB / 2 GiB−4 / 4 GiB−4 |
  | `maxBufferSize` | 256 MiB / 256 MiB / 1 GiB / 2 GiB / 4 GiB−4 |
  | `maxStorageBuffersPerShaderStage` | 8 / 8 / 10 / 16 |
  | `maxColorAttachmentBytesPerSample` | 32 / 32 / 64 / 128 |
  | `maxTextureDimension2D` | 4,096 / 8,192 / 16,384 |
  | `maxInterStageShaderVariables` | 15 / 16 / 28 |
  | `maxBindGroups` | 4 |

  Notes in the code:
  - The 8/10/16 storage-buffer tiers exist because Metal does not yet use argument buffers: "would result in all Metal devices dropping down to tier0".
  - For `maxColorAttachmentBytesPerSample`: "All Chrome platforms support 64 (iOS is 32) so there's are really only two exposed buckets: 64 and 128".
  - Values better than a tier are "degraded" to that tier.

  Source: [Dawn src/dawn/native/Limits.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/Limits.cpp)
- **D3D12 raw limits.**
  - `maxComputeWorkgroupStorageSize` is fixed at 32,768.
  - `maxComputeInvocationsPerWorkgroup` is `D3D12_CS_THREAD_GROUP_MAX_THREADS_PER_GROUP`.
  - `maxComputeWorkgroupsPerDimension` is `D3D12_CS_DISPATCH_MAX_THREAD_GROUPS_PER_DIMENSION`.
  - `maxBufferSize` is `kAssumedMaxBufferSize`, because "D3D12 has no documented limit".
  - `maxStorageBufferBindingSize` is `kAssumedMaxBufferSize`, except on Qualcomm ACPI GPUs before Adreno 8xx, where it is 2^28 because their raw buffers can address only 2^28 bytes.
  - `maxColorAttachmentBytesPerSample` is 8 × 16 = 128.
  - Storage buffers get half of the UAV slots.

  Source: [Dawn PhysicalDeviceD3D12.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp)
- **Vulkan raw limits.**
  - `maxBufferSize` comes from `maintenance4.maxBufferSize`, or else `maintenance3.maxMemoryAllocationSize`.
  - On NVIDIA, `maxStorageBufferBindingSize` is capped at 2 GiB−4 because "OpArrayLength returns 0 for buffers >= 2GB for some NVIDIA devices" (crbug.com/435684920).
  - `maxComputeInvocationsPerWorkgroup` is clamped to `maxComputeWorkgroupSubgroups × subgroup size`.
  - `maxColorAttachmentBytesPerSample` is 32 × `maxColorAttachments`.

  Source: [Dawn PhysicalDeviceVk.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/vulkan/PhysicalDeviceVk.cpp)
- **Metal raw limits.**
  - `maxBufferSize` is min(UINT32_MAX, `MTLDevice` maxBufferLength), "because we pass storage (and vertex) buffer sizes to MSL as u32".
  - `maxStorageBufferBindingSize` equals `maxBufferSize`.
  - `maxComputeWorkgroupStorageSize` is `maxTotalThreadgroupMemory`.
  - `maxComputeInvocationsPerWorkgroup` is `maxThreadsPerThreadgroup`.
  - `maxColorAttachmentBytesPerSample` is `maxTotalRenderTargetSize`.

  Source: [Dawn PhysicalDeviceMTL.mm](https://github.com/google/dawn/blob/main/src/dawn/native/metal/PhysicalDeviceMTL.mm)
- **Measured SwiftShader limits.** The SwiftShader fallback adapter in headless Chromium 153 reports `maxStorageBufferBindingSize` and `maxBufferSize` of 1 GiB. Source: coordinator measurement, 12 November 2026 (no URL)
- **Requesting limits.** The adapter becomes "consumed" once a device is requested from it. BCD lists support for passing `undefined` values in `requiredLimits` and for the duplicate-`requestDevice()` behaviour. Sources: [gpuweb spec index.bs](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs); [BCD api/GPUAdapter.json](https://github.com/mdn/browser-compat-data/blob/main/api/GPUAdapter.json)

### Inferences
- **Arithmetic for 50M × 32 B = 1,600,000,000 B (about 1.49 GiB):**

  | Limit | Bytes | Particles at 32 B |
  |---|---|---|
  | Default `maxBufferSize` | 256 MiB | 8,388,608 |
  | Default `maxStorageBufferBindingSize` | 128 MiB | 4,194,304 per binding |
  | 1 GiB binding tier | 1 GiB | 33,554,432 |
  | 2 GiB−4 tier | 2,147,483,644 | 67,108,863 |

  - The current 2M-particle WebGL2 dataset (64 MB) fits the defaults.
  - 50M particles do not fit a 1 GiB binding but do fit the 2 GiB−4 tier.
- **Request explicitly.** Pass `maxBufferSize` and `maxStorageBufferBindingSize` of at least 1.6e9, taken from `adapter.limits`, through `requestDevice({ requiredLimits })`. If they are not available, fall back to several bindings (SoA streams such as position, velocity and colour) or a lower particle count.
- **SoA with f16 packing halves the footprint.** Packing with `pack2x16float` or `shader-f16`, for example to 16 bytes per particle, also cuts bandwidth. This matters because ping-pong double buffering of 1.6 GB would need 3.2 GB of VRAM.
- **Dispatch shape.** At 256 threads per workgroup, 50M needs 195,313 workgroups, which is more than 65,535, so use a 2D dispatch (for example 65,535 × 3) and flatten the index. `global_invocation_index` from `linear_indexing` does the flattening. Alternatively, with 1024 threads (after requesting the 1024 tier), 48,829 workgroups fit in one dimension.
- **Keep bind groups portable.** Use 8 or fewer storage buffers per stage for maximum portability, or 10 or fewer to cover Metal's tier. Larger MRT bloom chains may need `maxColorAttachmentBytesPerSample` of 64 requested (rgba16float is 8 bytes per attachment).

### Gaps
- The numeric value of `kAssumedMaxBufferSize` on D3D12, and the actual tiers real NVIDIA, AMD, Intel and Apple adapters land in, were not verified (no fleet data was reachable).

## Q4. HDR output: rgba16float with toneMapping "extended", colorSpace values, Windows HDR, macOS EDR, Linux, CSS media queries, display luminance, Electron

### Takeaway
- **How to get HDR today.** Use an rgba16float canvas with `toneMapping: { mode: "extended" }` and colorSpace `srgb` or `display-p3`. The linear `srgb-linear` and `display-p3-linear` spaces are stable on Chromium main. A search summary, not verified, places them in Chrome 155–156.
- **Not available by default.** PQ, HLG and rec2020 (`rec2100-pq`, `rec2100-hlg`, `rec2020`), and `rec2100-linear`, are behind experimental flags.
- **No luminance information.** There is no shipped API that reports peak luminance or the SDR white level, only the boolean `dynamic-range` media query.
- **Linux.** I found no evidence of HDR output in desktop Chrome on Linux.

### Cited Findings
- **Canvas configuration in the spec and in Chrome.** `GPUCanvasConfiguration` has `device`, `format`, `usage`, `viewFormats`, `colorSpace` (`PredefinedColorSpace`, default "srgb") and `toneMapping` (default `{}`). There is no present-mode or desynchronized member. Under "extended", "Color values in the extended dynamic range of the screen are unchanged, and all other color values are projected to the extended dynamic range of the screen", for example by clamping, "which may include values greater than 1". Sources: [gpuweb spec index.bs](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs); [Chromium gpu_canvas_configuration.idl](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/webgpu/gpu_canvas_configuration.idl)
- **Chromium's `PredefinedColorSpace` values:**
  - `"srgb"` (default) and `"display-p3"`;
  - `"rec2020"`, `"rec2100-hlg"` and `"rec2100-pq"`, all "Enabled only in CanvasHDR";
  - `"srgb-linear"` and `"display-p3-linear"`, enabled by `ColorSpacePredefinedLinearSpaces`;
  - `"rec2100-linear"`, enabled by `ColorSpaceRec2100Linear`.

  Source: [Chromium predefined_color_space.idl](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/html/canvas/predefined_color_space.idl)
- **Flag status on Chromium main:**
  - `CanvasHDR`: experimental
  - `ColorSpacePredefinedLinearSpaces`: stable
  - `ColorSpaceDisplayP3Linear`: stable
  - `ColorSpaceRec2100Linear`: experimental
  - `CanvasFloatingPoint`: stable
  - `CSSDynamicRangeLimit`: stable
  - `CSSVideoDynamicRangeMediaQueries`: experimental
  - `WebGPUExternalImageHDRHeadroom`: experimental

  Source: [Chromium runtime_enabled_features.json5](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/runtime_enabled_features.json5)
- **Shared tone-mapping type and experimental HDR metadata.** Chromium defines `CanvasToneMapping { mode: "standard" | "extended" }`, shared across canvas types. It also defines an experimental `CanvasHighDynamicRangeOptions` with mode `"default"`/`"extended"` and SMPTE ST 2086 metadata (primaries, white point, min and max luminance). Source: [Chromium canvas_tone_mapping.idl](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/html/canvas/canvas_tone_mapping.idl)
- **Measured canvas configuration.** Headless Chromium 153 on SwiftShader accepts canvas configuration with `format: "rgba16float"` and `toneMapping: { mode: "extended" }`. Presenting the canvas then fails (see Q10). Source: coordinator measurement, 12 November 2026 (no URL)
- **Other browsers.** BCD lists `GPUCanvasContext.configure` `toneMapping` as unsupported in both Firefox and Safari. Source: [BCD api/GPUCanvasContext.json](https://github.com/mdn/browser-compat-data/blob/main/api/GPUCanvasContext.json)
- **CSS support (BCD):**

  | CSS feature | Chrome | Firefox | Safari |
  |---|---|---|---|
  | `dynamic-range` media query | 98 | 100 | 13.1 |
  | `video-dynamic-range` media query | 98, behind a flag | 100 | no |
  | `dynamic-range-limit` property | 136 | no | 26 (partial values) |

  Sources: [BCD css/at-rules/media.json](https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/media.json); [BCD css/properties/dynamic-range-limit.json](https://github.com/mdn/browser-compat-data/blob/main/css/properties/dynamic-range-limit.json)
- **Display brightness API (proposal only).** The W3C Color on the Web CG HDR canvas explainer proposes `Screen.colorInfo` with `colorVolume` (min and max luminance, chromaticities) and `referenceWhiteLuminance`. "The ratio of maximumLuminance to referenceWhiteLuminance effectively specifies the headroom." When these are absent, it says to use the `dynamic-range` media query. Source: [ColorWeb-CG hdr_html_canvas_element.md](https://github.com/w3c/ColorWeb-CG/blob/main/hdr_html_canvas_element.md)
- **Windows PQ behaviour.** Chromium's `kUseDisplaySDRMaxLuminanceNits` is enabled by default only on Windows. It uses the display's SDR maximum luminance as HDR metadata for PQ content, "opting out" PQ content from the OS SDR-white setting to avoid overlay flicker. Source: [Chromium components/viz/common/features.cc](https://github.com/chromium/chromium/blob/main/components/viz/common/features.cc)
- **HDR display features are ChromeOS-only.** In `ui/display`, the HDR-related features (`kUseHDRTransferFunction`, `kEnableExternalDisplayHDR10Mode`) sit under `BUILDFLAG(IS_CHROMEOS)`. Source: [Chromium ui/display/display_features.cc](https://github.com/chromium/chromium/blob/main/ui/display/display_features.cc)
- **Electron docs.** Electron's docs (switches, app, breaking changes) and its release posts for 42–45 mention no HDR-specific setting. Sources: [Electron command-line-switches.md](https://github.com/electron/electron/blob/main/docs/api/command-line-switches.md); [Electron 45 post](https://github.com/electron/website/blob/main/blog/electron-45-0.md)

### Inferences
- **Recommended Tactilume HDR path.**
  - Keep the existing RGBA16F bloom chain.
  - Present through an rgba16float canvas with toneMapping "extended". In Electron 45 (Chromium 156), colorSpace `srgb-linear` should be available so linear values can be written directly; with `srgb`, apply the sRGB-encoded extended range yourself.
  - Values above 1.0 mean brighter than SDR white, clamped to whatever headroom the OS and display give.
  - Expose a user "HDR brightness / peak" slider, because there is no headroom API.
  - Use `matchMedia('(dynamic-range: high)')` only as a hint.
- **Electron can enable PQ/HLG, but it is fragile.** Electron can enable Blink features (for example `CanvasHDR`) through `webPreferences.enableBlinkFeatures` to try `rec2100-pq`. These are experimental and not covered by any spec.
- **OS behaviour.** On Windows, HDR needs the OS HDR toggle on. On macOS, EDR headroom varies with the brightness setting. Both points come from general platform knowledge, not verified here.
- **Linux.** WebGPU there runs through a Vulkan–GL interop path into a GL compositor, and the HDR display features are ChromeOS-only. Expect SDR output on Linux.

### Gaps
- The actual Chrome behaviour on Windows (scRGB via DirectComposition), on macOS (CAMetalLayer EDR) and on Linux Wayland color management could not be verified: Chrome posts, crbug and the Chromium HDR docs were unreachable.
- I did not verify whether Chromium implements any experimental `Screen` HDR-headroom API.

## Q5. Frame pacing on 120–500 Hz displays: requestAnimationFrame cadence, --disable-gpu-vsync and --disable-frame-rate-limit, VRR, low-latency options, mixed-refresh monitors, presentation timing

### Takeaway
- **Chrome's frame clock.** Chromium drives frames from a GPU-side vsync source: DXGI `WaitForVBlank` or the DirectComposition compositor clock on Windows, and DisplayLink on macOS.
- **The debug switches.** `--disable-frame-rate-limit` removes begin-frame limiting and implies `--disable-gpu-vsync` (no vblank sync). Both are for testing and benchmarking, not pacing.
- **What WebGPU lacks.** There is no present-mode, low-latency or desynchronized option, and no presentation-timing feedback.
- **VRR.** Chromium's own source says VRR support is not implemented on Windows.

### Cited Findings
- **`--disable-frame-rate-limit`.** "Disables begin frame limiting in both cc scheduler and display scheduler. Also implies --disable-gpu-vsync". A TODO (crbug.com/346931323) says: "We should remove or change this once VRR support is implemented for Windows and other platforms potentially." Source: [Chromium components/viz/common/switches.cc](https://github.com/chromium/chromium/blob/main/components/viz/common/switches.cc)
- **`--disable-gpu-vsync`.** "Stop the GPU from synchronizing presentation with vblank." Source: [Chromium ui/gl/gl_switches.cc](https://github.com/chromium/chromium/blob/main/ui/gl/gl_switches.cc)
- **The `kGpuVsync` feature** is disabled by default on Apple platforms and enabled elsewhere. `kUseCompositorClockVSyncInterval` lets `VSyncThreadWin` derive the vsync interval from the compositor clock. Source: [Chromium ui/gl/gl_features.cc](https://github.com/chromium/chromium/blob/main/ui/gl/gl_features.cc)
- **Windows vsync thread.** It uses either "VSyncThreadWinDXGI's vblank wait or VSyncThreadWinDComp's compositor" clock. It notes that `WaitForVBlank` and `DCompositionWaitForCompositorClock` return early when the monitor sleeps. Source: [Chromium ui/gl/vsync_thread_win.cc](https://github.com/chromium/chromium/blob/main/ui/gl/vsync_thread_win.cc)
- **macOS viz features:** `kUseDisplayRefreshRateForTimer` enabled; `kVSyncAlignedPresentationForScrolling` enabled (presentation waits for the next DisplayLink callback for interaction frames); `kVSyncAlignedPresentation` disabled. On all platforms, `kAllowMultipleSwapsPerVsync` is disabled. Source: [Chromium components/viz/common/features.cc](https://github.com/chromium/chromium/blob/main/components/viz/common/features.cc)
- **No present-mode control.** `GPUCanvasConfiguration` has no present-mode or latency member (see Q4). Source: [gpuweb spec index.bs](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs)

### Inferences
- **rAF follows the display's vblank.** The begin-frame source is tied to the display's vblank or compositor clock (Windows) and to the display refresh rate (macOS timer feature), so rAF should run at 120, 144, 240 Hz and so on. This is not verified with measurements here.
- **Design the simulation to be refresh-independent.** Use a fixed-timestep simulation with interpolation, driven by rAF timestamps, and measure the actual frame interval at runtime instead of assuming 60 Hz. Keep GPU work per frame under the shortest expected interval: 2 ms at 500 Hz, 4.2 ms at 240 Hz, 8.3 ms at 120 Hz. Otherwise accept frame skipping.
- **Use the debug switches only in benchmarks.** In Electron, `app.commandLine.appendSwitch('disable-frame-rate-limit')` (or `'disable-gpu-vsync'`) gives uncapped frame rates for profiling, but expect tearing and uneven pacing.
- **Latency.** With no WebGPU present-mode control, latency levers are limited to keeping the GPU queue shallow: do not submit more than one or two frames ahead, and use `onSubmittedWorkDone` for backpressure.
- **Measuring presentation timing.** The options are rAF deltas, `performance.now()` and GPU timestamp queries. There is no presentation-feedback API.

### Gaps
- I did not establish whether rAF follows the window's monitor or the primary monitor on mixed-refresh multi-monitor setups (Windows and Linux). The vsync code did not show the output-selection logic in the lines inspected.
- How G-Sync and FreeSync behave with Chrome or Electron fullscreen windows was not verified (only the "VRR not implemented" TODO).
- Linux (Wayland or X11) frame pacing at high refresh rates was not checked.
- Measured rAF cadence at 240–500 Hz was not verified (search budget exhausted).

## Q6. Ray tracing: any hardware ray-tracing access in WebGPU as of 2026? What native wgpu offers

### Takeaway
- **WebGPU has no hardware ray tracing.** It is not in the spec's feature list, not in Dawn's API definition, and not in Chrome or Electron, even experimentally.
- **wgpu (native Rust) has it experimentally.** It offers ray queries on Vulkan, with Metal acceleration structures since v29. Ray-tracing pipelines are experimental and limited to the SPIR-V backend.

### Cited Findings
- **The spec's 25 features include nothing for ray tracing or acceleration structures** (list in Q2). Source: [gpuweb spec index.bs](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs)
- **No obvious gpuweb proposal file.** Proposal files exist for subgroups, subgroup-size-control, atomic-64-min-max, immediate-data, texel-buffers, bindless and primitive-index. Requests for `proposals/ray-tracing.md`, `raytracing.md`, `ray-query.md` and `acceleration-structures.md` returned HTTP 404. Source: [gpuweb proposals directory](https://github.com/gpuweb/gpuweb/tree/main/proposals)
- **Dawn's API definition (`dawn.json`) contains no "ray tracing", "acceleration" or "ray query" entries.** Source: [Dawn src/dawn/dawn.json](https://github.com/google/dawn/blob/main/src/dawn/dawn.json)
- **wgpu releases:** v30.0.1 (2026-08-21), v30.0.0 (2026-07-01), v29.0.0 (2026-03-18), v28.0.0 (2025-12-17). Source: [wgpu CHANGELOG](https://github.com/gfx-rs/wgpu/blob/trunk/CHANGELOG.md)
- **wgpu ray-tracing history:**
  - v27.x: `EXPERIMENTAL_RAY_TRACING_ACCELERATION_STRUCTURE` was merged into `EXPERIMENTAL_RAY_QUERY`, "to help work around an AMD driver bug".
  - v28.0.0: the WGSL enable extensions `wgpu_ray_query` and `wgpu_ray_query_vertex_return` became required.
  - v29.0.0: "Implements ray-tracing acceleration structures for metal backend"; initial WGSL-in and WGSL-out ray-tracing pipelines; TLAS binding arrays.
  - v30.0.0: "Add `spirv-out` ray tracing pipelines".
  - Unreleased on trunk: `@builtin(hit_barycentrics)`, the `wgpu_ray_tracing_invocation_reorder` extension (hit objects and `reorderThread`; "Currently only supported with the SPIR-V backend"), and bind-group entries with ray-tracing stage visibility that require `EXPERIMENTAL_RAY_TRACING_PIPELINES`.

  Source: [wgpu CHANGELOG](https://github.com/gfx-rs/wgpu/blob/trunk/CHANGELOG.md)

### Inferences
- **For Tactilume Desktop in Chrome or Electron**, ray-traced effects (light shafts or reflections off particles) must use compute-shader BVH or grid traversal in WGSL, or screen-space and voxel approximations.
- **Native hardware ray tracing** would need a native module (for example wgpu through a Node addon, or a non-web renderer), with no shared device or texture path to the WebGPU canvas. That is a shell-architecture decision outside this scope.

### Gaps
- I could not search gpuweb issues or meeting minutes for 2025–2026 ray-tracing discussions (search budget exhausted; github.com HTML blocked), so an informal proposal or explainer under another filename cannot be ruled out.
- wgpu ray-query support on DX12 was not confirmed from the changelog lines inspected.

## Q7. Robustness: device loss and recovery, GPU process crashes, Windows TDR on long dispatches, Chrome's GPU watchdog, error scopes

### Takeaway
- **Device loss.** `device.lost` resolves with reason "unknown" or "destroyed". Recovery needs a fresh `requestAdapter()`, because adapters are single-use ("consumed").
- **Chrome's GPU watchdog** watches the GPU process threads with a timeout of 30 s on Windows, 25 s on macOS and 15 s on Linux/other. GPU execution timeouts (TDR) are an OS mechanism and are much shorter.
- **Long dispatches.** Split them into frame-sized chunks.
- **Electron** reports GPU process crashes through `app` `'child-process-gone'`.

### Cited Findings
- **Spec error and loss types.**
  - `enum GPUDeviceLostReason { "unknown", "destroyed" }`.
  - `GPUDevice.lost` is a `Promise<GPUDeviceLostInfo>`.
  - `onuncapturederror` is an event handler.
  - `enum GPUErrorFilter { "validation", "out-of-memory", "internal" }` for error scopes.
  - An adapter's `[[state]]` becomes "consumed" after `requestDevice`, and a consumed adapter cannot create another device.

  Source: [gpuweb spec index.bs](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs)
- **BCD on duplicate `requestDevice()` calls.** Chrome handles them, while Safari 26 is "partial: Duplicate calls don't reject; instead, lost GPUDevice is returned". Source: [BCD api/GPUAdapter.json](https://github.com/mdn/browser-compat-data/blob/main/api/GPUAdapter.json)
- **Watchdog timeouts.** `kGpuWatchdogTimeout` is 30 s on Windows, 25 s on macOS (50 s under ASAN) and 15 s otherwise. It is multiplied by `kRestartFactor` = 2 after power resume and by `kSoftwareRenderingFactor` = 2 for software rendering. Source: [Chromium gpu/ipc/common/gpu_watchdog_timeout.h](https://github.com/chromium/chromium/blob/main/gpu/ipc/common/gpu_watchdog_timeout.h)
- **Watchdog override and Windows allowance.** `--gpu-watchdog-timeout-seconds` overrides the timeout. On Windows, the GPU thread may continue through the timeout "at most 4 times" if its actual thread time was below the timeout (`kMaxCountOfMoreGpuThreadTimeAllowed` = 3). Sources: [Chromium gpu/ipc/service/gpu_watchdog_thread.cc](https://github.com/chromium/chromium/blob/main/gpu/ipc/service/gpu_watchdog_thread.cc); [gpu_watchdog_thread.h](https://github.com/chromium/chromium/blob/main/gpu/ipc/service/gpu_watchdog_thread.h)
- **Electron crash reporting.** `app` emits `'child-process-gone'` with type `GPU`; the older `gpu-process-crashed` event was removed. Electron's documented `GPUFeatureStatus` keys (2d_canvas, gpu_compositing, rasterization, webgl, webgl2, video_decode and so on) list no WebGPU key. Sources: [Electron app.md](https://github.com/electron/electron/blob/main/docs/api/app.md); [Electron breaking-changes.md](https://github.com/electron/electron/blob/main/docs/breaking-changes.md); [Electron gpu-feature-status.md](https://github.com/electron/electron/blob/main/docs/api/structures/gpu-feature-status.md)
- **Dawn robustness toggles and Chrome compiler settings.**
  - Dawn has a `disable_robustness` toggle ("Disable robust buffer access").
  - Chrome forces `disallow_spirv` ("we only ensure that WGSL is secure").
  - Chrome has Finch features `kWebGPUEnableRangeAnalysisForRobustness`, plus `kWebGPUUseSpirv14` and `kWebGPUUseHLSL2021` (both enabled by default).

  Sources: [Dawn Toggles.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/Toggles.cpp); [Chromium webgpu_decoder_impl.cc](https://github.com/chromium/chromium/blob/main/gpu/command_buffer/service/webgpu_decoder_impl.cc); [Chromium gpu_finch_features.cc](https://github.com/chromium/chromium/blob/main/gpu/config/gpu_finch_features.cc)

### Inferences
- **Recovery recipe.**
  1. On `device.lost` with reason "unknown", stop the frame loop.
  2. Call `navigator.gpu.requestAdapter()` again and recreate the device and all GPU resources.
  3. Re-seed particles from CPU-side state, so keep a compact CPU or IndexedDB snapshot of emitter and preset state, not the 1.6 GB particle buffers.
  4. After repeated losses, fall back to the WebGL2 renderer.
  5. In Electron, also listen for `'child-process-gone'` (type GPU) in the main process to log the crash and decide whether to relaunch with a safer configuration.
- **TDR** (background knowledge, not verified here: the Windows default `TdrDelay` is 2 s).
  - TDR is separate from Chrome's watchdog and much shorter.
  - Keep any single submit well under about 100 ms on the slowest supported GPU.
  - Split very large simulation steps across several dispatches and submits, and across frames if needed.
  - Use timestamp queries in development to set chunk sizes.
  - A TDR shows up as device loss ("unknown") or a GPU process restart.
- **Error scopes.** Use them around resource creation for large buffers (`"out-of-memory"`) and around pipeline creation (`"validation"`), with `onuncapturederror` as telemetry.

### Gaps
- The Microsoft TDR documentation and Chromium's handling of `DXGI_ERROR_DEVICE_REMOVED` for WebGPU (whether Chrome blocks WebGPU after repeated GPU crashes) could not be fetched or verified.

## Q8. Profiling: timestamp-query precision and quantization in Chrome, Chrome tracing, PIX, RenderDoc and Xcode with Dawn

### Takeaway
- **Timestamp quantization.** Chrome quantizes WebGPU timestamps by default for privacy. `--enable-webgpu-developer-features` disables quantization, which is the switch to set in development builds of the Electron app.
- **Timestamps inside passes** (writeTimestamp-style) are unsafe-only.
- **Native capture tools.** Dawn forwards object labels to RenderDoc, PIX and Instruments on request. RenderDoc capture of Chrome works on Windows D3D12, and Metal captures go to Xcode through `DAWN_TRACE_FILE_BASE`.

### Cited Findings
- **Quantization toggle.** Chrome enables Dawn's `timestamp_quantization` toggle "by default for privacy, unless --enable-webgpu-developer-features is used" (the "safe" safety level). The toggle is described as reducing "the precision of timers that can be created with timestamp queries" (crbug.com/dawn/1800). Sources: [Chromium webgpu_decoder_impl.cc](https://github.com/chromium/chromium/blob/main/gpu/command_buffer/service/webgpu_decoder_impl.cc); [Dawn Toggles.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/Toggles.cpp)
- **How quantization works.** Dawn converts timestamps to nanoseconds in a compute shader and applies a `quantization_mask` to the low 32 bits. The mask is `kTimestampQuantizationMask` when the toggle is on. A separate toggle, `disable_timestamp_query_conversion`, resolves raw ticks instead of nanoseconds. Sources: [Dawn QueryHelper.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/QueryHelper.cpp); [Dawn CommandEncoder.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/CommandEncoder.cpp); [Dawn Toggles.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/Toggles.cpp)
- **Timestamp support per backend.** `timestamp-query` needs `timestampComputeAndGraphics` on Vulkan and GPU timestamp counter sampling on Metal. `ChromiumExperimentalTimestampQueryInsidePasses` is exposed only in unsafe mode, and on Metal only with command-boundary sampling. Sources: [Dawn PhysicalDeviceVk.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/vulkan/PhysicalDeviceVk.cpp); [Dawn PhysicalDeviceMTL.mm](https://github.com/google/dawn/blob/main/src/dawn/native/metal/PhysicalDeviceMTL.mm); [Chromium webgpu_decoder_impl.cc](https://github.com/chromium/chromium/blob/main/gpu/command_buffer/service/webgpu_decoder_impl.cc)
- **Dawn debugging aids.**
  - Toggles: `dump_shaders` logs WGSL and translated MSL/HLSL/DXIL/SPIR-V, `disable_symbol_renaming`, and `use_user_defined_labels_in_backend` ("seen in native debugging tools like RenderDoc, PIX, or Mac Instruments").
  - In Chrome, toggles are set with `--enable-dawn-features=dump_shaders,disable_symbol_renaming`.
  - `DAWN_DEBUG_BREAK_ON_ERROR` stops at the point where an error is raised.
  - `DAWN_TRACE_FILE_BASE` with `MTL_CAPTURE_ENABLED=1` saves a `.gputrace` for Xcode's Metal Debugger. This is Metal-only; D3D12, Vulkan and GL tracing are "not yet implemented".
  - "Capturing with RenderDoc in Chrome" is "Currently only supported on Windows using the D3D12 backend": `RENDERDOC_HOOK_EGL=0` with `--no-sandbox --disable-gpu-sandbox --disable-direct-composition --gpu-startup-dialog --enable-dawn-features=enable_renderdoc_process_injection`, then inject RenderDoc into the "Google Chrome GPU" process.

  Source: [Dawn docs/dawn/debugging.md](https://github.com/google/dawn/blob/main/docs/dawn/debugging.md)
- **Backend validation.** `--enable-dawn-backend-validation` enables D3D12, Vulkan and Metal validation layers. Source: [Chromium gpu_switches.cc](https://github.com/chromium/chromium/blob/main/gpu/config/gpu_switches.cc)

### Inferences
- **Development builds of Tactilume Desktop.** Append `enable-webgpu-developer-features` (unquantized timestamps, adapter-property features) and optionally `enable-dawn-features=use_user_defined_labels_in_backend`, and label every pass and buffer.
- **Shipping builds.** Leave quantization on, and use timestamps only for coarse adaptive-quality decisions, such as adjusting particle count from GPU frame time.
- **The same Chrome flags should work in Electron**, which uses the same Chromium GPU process (not tested here).

### Gaps
- The numeric quantization granularity (the value of `kTimestampQuantizationMask`) was not read.
- PIX-specific steps beyond label forwarding, and Chrome tracing (`chrome://tracing` / Perfetto) categories for WebGPU, were not documented in the files reached.

## Q9. Known vendor-specific bugs or performance cliffs for heavy compute and additive blending (Intel, AMD, NVIDIA, Apple), 2025–2026

### Takeaway
- **What is documented.** The gating and workarounds in source are: an NVIDIA Vulkan ≥2 GB `arrayLength` bug (capped at 2 GiB−4), Linux allowlisting only Intel Gen12+ with Mesa ≥22 and NVIDIA ≥535.183.01 (AMD blocked), Metal without argument buffers (no multi-draw-indirect, fewer storage buffers), and the Qualcomm Windows driver blocklist.
- **What is missing.** I could not gather broad 2025–2026 bug-tracker evidence about compute or blending performance cliffs.

### Cited Findings
- **NVIDIA (Vulkan).** "OpArrayLength returns 0 for buffers >= 2GB for some NVIDIA devices" (crbug.com/435684920). Dawn caps `maxStorageBufferBindingSize` at 2 GiB−4 on NVIDIA. Source: [Dawn PhysicalDeviceVk.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/vulkan/PhysicalDeviceVk.cpp)
- **NVIDIA (D3D12, 32-bit x86 builds).** These are blocklisted ("IndirectComputeRootConstants"). D3D adapters with shader model ≥ 6.0 on x86 hit "Consteval22ndBit". Source: [Chromium webgpu_blocklist_impl.cc](https://github.com/chromium/chromium/blob/main/gpu/config/webgpu_blocklist_impl.cc)
- **Intel and NVIDIA on Linux.** Only Intel Gen12+ with Mesa ≥ 22.0 and NVIDIA ≥ 535.183.01 are excepted from the Linux WebGPU-on-Vulkan blocklist entry. Source: [Chromium software_rendering_list.json](https://github.com/chromium/chromium/blob/main/gpu/config/software_rendering_list.json)
- **AMD.**
  - The wgpu team merged its acceleration-structure feature flag "to help work around an AMD driver bug". Source: [wgpu CHANGELOG](https://github.com/gfx-rs/wgpu/blob/trunk/CHANGELOG.md)
  - ChromeOS AMD device 0x98e4 is blocked for a missing DRM format modifier, which is ChromeOS-only. Source: [Chromium webgpu_blocklist_impl.cc](https://github.com/chromium/chromium/blob/main/gpu/config/webgpu_blocklist_impl.cc)
- **Apple / Metal.**
  - `MultiDrawIndirect` is disabled until Dawn uses argument buffers.
  - The storage-buffer tier is held at 10 for the same reason.
  - The `rgba8unorm` canvas format is unsupported on macOS.
  - `atomic-vec2u-min-max` needs Apple9, or Mac2 together with Apple8.

  Sources: [Dawn PhysicalDeviceMTL.mm](https://github.com/google/dawn/blob/main/src/dawn/native/metal/PhysicalDeviceMTL.mm); [Dawn Limits.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/Limits.cpp); [BCD api/GPUCanvasContext.json](https://github.com/mdn/browser-compat-data/blob/main/api/GPUCanvasContext.json)
- **Qualcomm on Windows ARM.**
  - Adreno 7180, 7280, 8180, 8280 and 8340 are blocklisted.
  - The 8380 is allowed only with driver 31.0.117 or newer.
  - Pre-Adreno 8xx raw buffers address only 2^28 bytes.

  Sources: [Chromium webgpu_blocklist_impl.cc](https://github.com/chromium/chromium/blob/main/gpu/config/webgpu_blocklist_impl.cc); [Dawn PhysicalDeviceD3D12.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp)
- **Blending formats.** `float32-blendable` is always enabled on D3D12 and Metal and depends on per-format blend support on Vulkan. `rg11b10ufloat-renderable` follows the same pattern. Sources: [Dawn PhysicalDeviceD3D12.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp); [Dawn PhysicalDeviceMTL.mm](https://github.com/google/dawn/blob/main/src/dawn/native/metal/PhysicalDeviceMTL.mm); [Dawn PhysicalDeviceVk.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/vulkan/PhysicalDeviceVk.cpp)

### Inferences
- **Keep each particle binding under 2 GiB.** On NVIDIA Vulkan (Linux), `arrayLength()` on bindings of 2 GB or more misbehaves, so keep each binding below 2 GiB even when the adapter reports 4 GiB. Prefer several SoA bindings.
- **Overdraw from additive blending is the main cliff on every vendor.** It is fill-rate and bandwidth-bound, and worst on integrated Intel and Apple GPUs with shared memory (background knowledge). Budget with timestamp queries. Consider:
  - rg11b10ufloat or rgba16float (not rgba32float) accumulation targets;
  - half-resolution particle passes that are upsampled into the bloom chain;
  - compute-splatting with u32 fixed-point atomics for very dense regions.

### Gaps
- No Chromium or Dawn issue-tracker data (issues.chromium.org is blocked) or vendor driver release notes could be reviewed for 2025–2026 compute, atomics or blending regressions on Intel Arc/Xe, AMD RDNA 3/4, NVIDIA Ada/Blackwell or Apple M3/M4/M5.
- This vendor-bug coverage is incomplete and should be supplemented.

## Q10. When is a WebGL2 fallback still needed? Capability matrix and pitfalls for the renderer architect

### Takeaway
- **Make WebGPU compute the primary path** in Electron on Windows (D3D12: NVIDIA, AMD, Intel) and macOS (Metal: Apple Silicon and supported Intel Macs).
- **Keep the existing WebGL2 transform-feedback renderer as a fallback** for:
  - Linux machines outside the allowlist (AMD, Intel before Gen12, NVIDIA before 535.183.01, and NVIDIA on X11 per the gpuweb wiki);
  - Windows ARM64 or unusual vendors;
  - D3D11-only or CPU adapters (VMs, RDP);
  - repeated device loss;
  - adapters whose limits cannot hold the chosen particle budget.

### Cited Findings
- **Capability matrix (Chromium main / Electron 45, desktop).** Conditions come from Dawn's backend code; Chrome's exposure rules come from webgpu_decoder_impl.cc.

  | Capability | Windows (D3D12) | macOS (Metal) | Linux (Vulkan) | Source |
  |---|---|---|---|---|
  | WebGPU on by default | Yes: NVIDIA, AMD, Intel; Qualcomm gated; others no | Yes | Intel Gen12+ (Mesa ≥22.0), NVIDIA ≥535.183.01 (Wayland per wiki); others need flags | [blocklist_impl](https://github.com/chromium/chromium/blob/main/gpu/config/webgpu_blocklist_impl.cc), [software_rendering_list](https://github.com/chromium/chromium/blob/main/gpu/config/software_rendering_list.json), [gpuweb wiki](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status) |
  | shader-f16 | SM6.2 + native 16-bit ops | Always | shaderFloat16 + shaderInt16 + 16-bit storage | [D3D12](https://github.com/google/dawn/blob/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp), [MTL](https://github.com/google/dawn/blob/main/src/dawn/native/metal/PhysicalDeviceMTL.mm), [Vk](https://github.com/google/dawn/blob/main/src/dawn/native/vulkan/PhysicalDeviceVk.cpp) |
  | subgroups | SM6.0 wave ops | Apple6+/Mac2 | Subgroup ops + f16 support | same |
  | subgroup-size-control | SM6.6 | Only if one fixed size | computeFullSubgroups | same |
  | timestamp-query | If supported (quantized unless dev flag) | Counter sampling | timestampComputeAndGraphics | same + [decoder](https://github.com/chromium/chromium/blob/main/gpu/command_buffer/service/webgpu_decoder_impl.cc) |
  | float32-filterable / float32-blendable | Always / Always | supports32BitFloatFiltering / Always | Per format / per format | same |
  | rg11b10ufloat-renderable | Always | Always | Per format | same |
  | bgra8unorm-storage | Typed UAV support | Always | STORAGE_IMAGE bit | same |
  | dual-source-blending / clip-distances | Always / Always | Always / Always | dualSrcBlend / shaderClipDistance | same |
  | primitive-index | Always | Always | geometryShader | same |
  | atomic-vec2u-min-max (64-bit min/max) | Int64 atomics | Apple9, or Mac2+Apple8 (M2+) | int64 atomics + shaderInt64 | same |
  | multi-draw-indirect | Unsafe-only | Disabled | Unsafe-only | same + decoder |
  | Hardware ray tracing | None | None | None | [spec](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs), [dawn.json](https://github.com/google/dawn/blob/main/src/dawn/dawn.json) |
  | maxComputeWorkgroupStorageSize | 32 KiB | maxTotalThreadgroupMemory | Device value, rounded to 16/32/48/64 KiB | [Limits.cpp](https://github.com/google/dawn/blob/main/src/dawn/native/Limits.cpp) + backends |
  | maxStorageBufferBindingSize | kAssumedMaxBufferSize, rounded to tier | min(4 GiB−1, maxBufferLength), rounded to tier | min(maxBufferSize, 2 GiB−4) on NVIDIA, rounded to tier | same |
  | HDR canvas (rgba16float + extended) | Spec'd in Chrome; OS behaviour unverified | Same; EDR behaviour unverified | No evidence of HDR output | [spec](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs), [display_features](https://github.com/chromium/chromium/blob/main/ui/display/display_features.cc) |
  | Canvas colorSpace (default) | srgb, display-p3, srgb-linear, display-p3-linear | same | same | [predefined_color_space.idl](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/html/canvas/predefined_color_space.idl), [RTE](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/platform/runtime_enabled_features.json5) |
  | PQ / HLG / rec2020 canvas | Experimental (CanvasHDR) | same | same | same |
  | RenderDoc capture of Chrome | Yes (D3D12) | Xcode via DAWN_TRACE_FILE_BASE | Not documented | [Dawn debugging.md](https://github.com/google/dawn/blob/main/docs/dawn/debugging.md) |

- **The unsafe switch is broad.** `--enable-unsafe-webgpu` disables the whole adapter blocklist and enables the SwiftShader fallback and experimental features. It is the only switch-based way to get WebGPU on non-allowlisted Linux GPUs. Source: [Chromium webgpu_decoder_impl.cc](https://github.com/chromium/chromium/blob/main/gpu/command_buffer/service/webgpu_decoder_impl.cc)
- **Electron's GPU status API has no WebGPU entry.** Its documented `GPUFeatureStatus` keys do not include WebGPU, so detection must happen in the renderer with `navigator.gpu?.requestAdapter()`. Source: [Electron gpu-feature-status.md](https://github.com/electron/electron/blob/main/docs/api/structures/gpu-feature-status.md)
- **Measured CI-like environment** (this Linux container, no GPU, headless Chromium 153). All results are from the coordinator measurement, 12 November 2026 (no URL), apart from the last two points, which cite source code.
  - `navigator.gpu` works with only `--enable-unsafe-webgpu`, and the adapter is SwiftShader.
  - The features are the ten listed in Q2. `shader-f16`, `dual-source-blending`, `primitive-index`, `atomic-vec2u-min-max`, `texture-formats-tier1/2`, `indirect-first-instance` and BC compression are absent.
  - Maximum buffer and binding size is 1 GiB.
  - `toneMapping: "extended"` with rgba16float is accepted.
  - **Presenting a WebGPU canvas fails both headless and headed under Xvfb**, with the error "A valid external Instance reference no longer exists". Offscreen rendering plus readback works.
  - Consistent with this, Chromium allows the SwiftShader fallback adapter only in unsafe mode. Source: [Chromium webgpu_decoder_impl.cc](https://github.com/chromium/chromium/blob/main/gpu/command_buffer/service/webgpu_decoder_impl.cc)
  - A `use-webgpu-adapter` switch exists. Its accepted values were not checked. Source: [Chromium gpu_switches.cc](https://github.com/chromium/chromium/blob/main/gpu/config/gpu_switches.cc)

### Inferences
- **Pitfalls list.**
  1. **No adapter on Linux.** `navigator.gpu` exists but `requestAdapter()` returns null on blocklisted Linux GPUs (AMD!). Test on AMD with Mesa RADV, and decide whether to ship the unsafe-switch recipe or the WebGL2 fallback.
  2. **Adapters are single-use.** After loss, request a new adapter.
  3. **Limits are bucketed.** Request explicit `requiredLimits` taken from `adapter.limits`. Never assume 65,535 can be exceeded; use 2D dispatch or `linear_indexing`.
  4. **Bindings at 2 GB or more break on NVIDIA Vulkan.** Keep each binding at 2 GiB−4 or less and prefer SoA.
  5. **Timestamps are quantized in production.** Use the developer flag only in development builds.
  6. **No present-mode, VRR or latency control.** Design for refresh-independent simulation. `--disable-frame-rate-limit` implies no vsync.
  7. **HDR has no headroom query.** Offer a user calibration slider. PQ/HLG are experimental only. Expect SDR on Linux.
  8. **Optional features need fallbacks.** f16, subgroups and 64-bit atomics need code paths without them. Subgroup paths on Vulkan also depend on f16 support.
  9. **Metal binding budget.** Metal is limited to 10 storage buffers per stage in Chrome's tiering and has no multi-draw-indirect.
  10. **Use the preferred canvas format.** Use `navigator.gpu.getPreferredCanvasFormat()` for SDR (`rgba8unorm` is unsupported on macOS) and rgba16float for HDR.
  11. **Chromium main runs ahead of Electron.** Electron 45 is on Chromium 156 while Chrome stable is around 157 and main is around 159. Feature-detect at runtime (`adapter.features`, `navigator.gpu.wgslLanguageFeatures`) instead of keying on versions.
- **When to keep WebGL2.** The WebGL2 transform-feedback path (2M particles with an RGBA16F bloom) remains the right safety net:
  - on non-allowlisted Linux GPUs;
  - for VMs and remote sessions with CPU-only adapters;
  - after repeated WebGPU device loss in one session;
  - as a "safe mode" launch option.
- **Scaling on the WebGPU path.** Particle counts beyond what one binding allows should be handled by scaling particle count to the adapter's limits, not by falling back to WebGL2.
- **CI testing implications** (from the coordinator's measurements plus the code findings above):
  1. **Headless Linux CI is for compute and offscreen correctness only.** Render into a `GPUTexture`, then `copyTextureToBuffer` and `mapAsync`, and compare against tolerance-based golden images. Read compute results back the same way. Do not present to a canvas in CI: presentation fails headless and under Xvfb.
  2. **Some things need real-GPU runners.** Canvas presentation, swapchain resize, HDR appearance, rAF cadence and frame pacing, and device-loss recovery need self-hosted runners: Windows D3D12 (NVIDIA, AMD, Intel), macOS Metal (Apple Silicon M1 and M2+, because of 64-bit atomics) and a Linux GPU box (Intel Gen12+ or NVIDIA on Wayland, plus AMD for the fallback path).
  3. **CI bypasses the Linux allowlist.** SwiftShader needs `--enable-unsafe-webgpu`, which disables the blocklist, so CI cannot test real-world adapter gating. Test the "no adapter → WebGL2" path by forcing it (for example a test flag that hides `navigator.gpu`). Keep the unsafe switch out of production builds unless the Linux enablement policy deliberately chooses it.
  4. **Feature coverage.** SwiftShader exposes `subgroups` and `subgroup-size-control`, so subgroup code paths can run in CI. Log subgroup sizes, because they may differ from real GPUs. It lacks `shader-f16`, `atomic-vec2u-min-max`, `dual-source-blending`, `primitive-index` and BC, so CI naturally exercises the fallback paths, but the fast f16 and 64-bit-atomic paths are only tested on GPU runners.
  5. **Limits.** With a 1 GiB maximum buffer and binding in CI, cap test particle counts at 1 GiB per buffer (about 33.5M particles at 32 bytes; in practice far fewer for CPU speed). Add a test that requesting more than `adapter.limits` makes the app scale down instead of crashing.
  6. **Performance and HDR.** SwiftShader timings and timestamps are CPU-emulated and meaningless for performance budgets. HDR can only be unit-tested at the API level (`configure` and `getConfiguration` accept rgba16float with "extended"), not visually.
  7. **Version drift.** CI measured Chromium 153, while Electron 45 ships 156. Run CI with the exact Electron version being shipped, and gate code on runtime feature detection, not on version numbers.
  8. **Likely cause of the presentation failure (unverified).** It is probably tied to Linux's WebGPU-on-Vulkan-via-GL-interop presentation path needing a real display and GPU context. Retest with the shipped Electron and a real Wayland GPU session before assuming the failure affects end users.

### Gaps
- There is no fleet data on what share of Tactilume's likely desktop users fall into each fallback category; Steam Hardware Survey or web3dsurvey data was not reachable.
- WebGL2 performance and availability on the same blocklisted Linux configurations (ANGLE on GL vs Vulkan) was not verified.
