# GPU light rendering for Tactilume Desktop: millions of additive HDR particles and "ray-traced" looks in WebGPU without hardware ray tracing (research notes, as of 2026-11-12)

How claims are marked:
- Untagged findings come from a primary source read during this session: a github.com page, a raw.githubusercontent.com file, or the gpuweb or w3c/wcag source repositories.
- Findings tagged "(search summary, not verified)" were seen only in a search-engine summary or snippet, and should be checked against the original before publication.

## 1. Drawing 10M to 100M additive particles: hardware points/quads vs compute rasterization with atomics into fixed-point HDR buffers (precision, overflow, contention), tile binning, overdraw. Which approach draws the most particles at the highest quality, with measured numbers?

### Takeaway
For particles whose screen footprint is about 2 px or less, compute rasterization wins clearly:
- Each thread splats one particle with 32-bit integer `atomicAdd` into fixed-point R/G/B storage buffers, and a resolve pass converts the result.
- Reported speedups are about 5x over WebGPU's built-in point rasterization (across 30+ GPUs; a search summary ties the 5x to the dense case of 4M points in a 5x5 px area) [Unverified]. In native code they are 10x to 100x over GL_POINTS per the authors' README (5.3x to 10x in their 2019 paper), for example about 1 billion opaque points in about 8 ms on an RTX 3090 [Verified: https://github.com/m-schuetz/compute_rasterizer/blob/master/README.md].
- It is also more accurate for additive light, because integer sums are exact where fp16 blending silently drops faint contributions. [Verified: recomputed in this session with numpy float16; 10,000 additions of 0.001 stall at exactly 4.0]

Hardware instanced quads remain the right tool for large, soft or defocused sprites, since WebGPU has no point size. The best design is a hybrid chosen per particle by footprint. At 100M particles, especially at 240 Hz, the limit is memory bandwidth rather than rasterization.

### Cited Findings
- **WGSL rules (primary source).** Atomic built-in functions "must not be used in a vertex shader stage". The address space of `atomic_ptr` "must be either storage or workgroup", and "Unless otherwise specified, T must be either u32 or i32", so there are no float atomics in core. Compute and fragment stages can therefore accumulate into storage-buffer atomics — [WGSL spec source, gpuweb/gpuweb wgsl/index.bs](https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs) [Verified: https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs]
  - The spec now also defines an optional `atomic_vec2u_min_max` extension (feature `"atomic-vec2u-min-max"`). It gives 64-bit `atomicStoreMin` and `atomicStoreMax` on `atomic<vec2<u32>>` in storage buffers only, with no 64-bit or float add, so it helps opaque depth+colour packing but not additive light. Electron 45 (Chromium 156) exposes it only at the experimental or unsafe safety level, and the measured Chromium 153 adapter did not list it. [Verified: https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs; https://github.com/chromium/chromium/blob/156.0.8078.96/gpu/command_buffer/service/webgpu_decoder_impl.cc]
- **WebGPU spec (primary source).** `"point-list"` is defined only as "Each vertex defines a point primitive", with no point-size control in the topology. The default `maxComputeWorkgroupStorageSize` limit is 16384 bytes, which bounds tile-binning accumulators and FFT rows — [WebGPU spec source, gpuweb/gpuweb spec/index.bs](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs) [Verified: https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs]
  - Point rasterization selects "a single FragmentDestination ... within the pixel containing" the point, so a WebGPU point is exactly one pixel. [Verified: https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs]
  - The 16,384 bytes is only what a device gets without `requiredLimits`. Dawn reports 32,768 bytes on D3D12, and on Metal it reports `maxTotalThreadgroupMemory`, which is 32 KB on Apple4 to Apple11 GPUs (every Apple-silicon Mac). The measured SwiftShader adapter also reports 32,768. A device that requests 32 KiB therefore has twice the budget the notes assume below. [Verified correction: https://github.com/google/dawn/blob/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp; https://github.com/google/dawn/blob/main/src/dawn/native/metal/PhysicalDeviceMTL.mm; https://developer.apple.com/metal/Metal-Feature-Set-Tables.pdf; measured in this container]
- **Schütz compute rasterizer README** (all points below re-read) — [GitHub m-schuetz/compute_rasterizer](https://github.com/m-schuetz/compute_rasterizer) [Verified: https://github.com/m-schuetz/compute_rasterizer/blob/master/README.md; https://github.com/m-schuetz/compute_rasterizer/blob/master/LICENSE.md]:
  - It "can be 10 to 100 times faster than GL_POINTS" and "renders up to one billion points in about 8 milliseconds" on an RTX 3090. These are the authors' own benchmarks.
  - Memory is about 1.6 GB per 100M points plus 1 to 2 GB overhead.
  - Depth and colour are packed into one 64-bit integer and resolved per pixel with 64-bit `atomicMin`.
  - Batches are about 10k points, at 128 threads per workgroup and about 80 points per thread.
  - Adaptive coordinate precision is typically 10 bits per axis.
  - Variants include "prefetch" (4 points per thread, the fastest) and "hqs" (high-quality shading).
  - It runs on Windows and NVIDIA only.
  - Its LICENSE.md is MIT ("Copyright 2022 Markus Schütz"), with some files adapted from three.js under MIT.
- **Schütz, Kerbl and Wimmer, HPG 2022, "Software Rasterization of 2 Billion Points in Real Time"** brute-force renders up to two billion points at 60 fps. It states compute shaders can render "up to 144.7 billion points per second" (about 2.3B points at 60 fps), with 10,240 points per 128-thread workgroup — [arXiv 2204.01287](https://arxiv.org/pdf/2204.01287); [TU Wien page](https://www.cg.tuwien.ac.at/research/publications/2022/SCHUETZ-2022-PCC/) (search summary, not verified)
- **Schütz and Wimmer 2019** measured, on an RTX 2080 Ti, the Retz dataset 5.3x faster and Morro Bay 10x faster than GL_POINTS. The approach is "ideal for point sizes of 1 pixel, but less suited for sizes larger than 2 pixels" — [arXiv 1908.02681](https://arxiv.org/pdf/1908.02681) (search summary, not verified). A later paper reports compute approaches up to an order of magnitude faster than the hardware pipeline — [arXiv 2104.07526](https://arxiv.org/pdf/2104.07526.pdf) (search summary, not verified)
- **Aras Pranckevičius, August 2025, WebGPU test** — [blog](https://aras-p.info/blog/2025/08/24/This-many-points-is-surely-out-of-scope/); [test page](https://aras-p.info/files/temp/webgpu/20250823_webgpu-point-raster.html) (search summary, not verified: host blocked):
  - Setup: millions of 1-px, alpha-blended points in regions from about 500x500 px down to 5x5 px. Built-in point rasterization is compared with compute atomic writes into screen-sized R, G, B buffers "using fixed point colors", followed by a resolve pass.
  - Result: across 30+ GPU models, compute was about 5x faster "across the board". A 2026-11-12 search summary attributes the 5x specifically to the case of 4M points in a 5x5 px area, and says the compute version deliberately used no subgroup tricks. So treat 5x as the dense-case figure, not a general speedup. [Unverified: aras-p.info is unreachable; search summary only]
  - Hypothesis: "contended atomics are not great, they perhaps are still better than contended blending units".
  - Caveat: Firefox reported incorrect GPU timings for some users.
- **Blender's GPU scopes work:** drawing many points at one location is "very very slow" on some GPUs, and the compute rasterizer is several times faster on desktop GPUs too — [Blender PR #144867](https://projects.blender.org/blender/blender/pulls/144867) (search summary, not verified)
- **WebGPU contended-atomics benchmark** (MIT, "Copyright (c) 2024 Peter Whidden"). All threads `atomicAdd` one global address (32 adds per thread, 15M threads): 20B ops/s on an M1 Max and 62B ops/s on an RTX 4090. Aggregation of contended atomics evidently works through WebGPU on non-NVIDIA hardware too — [GitHub PWhiddy/webgpu-atomics-benchmark](https://github.com/PWhiddy/webgpu-atomics-benchmark) [Verified: https://github.com/PWhiddy/webgpu-atomics-benchmark/blob/main/README.md; https://github.com/PWhiddy/webgpu-atomics-benchmark/blob/main/LICENSE]
- **WebGPU compute-rasterizer tutorial** (MIT, "Copyright (c) 2021 Omar Shehata"). It uses a storage buffer of `atomic<u32>` per channel as the framebuffer, writes with `atomicMin`, and displays via a fullscreen pass. It cites Schütz's roughly 10x speedup — [GitHub OmarShehata/webgpu-compute-rasterizer](https://github.com/OmarShehata/webgpu-compute-rasterizer/blob/main/how-to-build-a-compute-rasterizer.md)
- **Schütz's early WebGPU demo** draws about 4M points as 1-px `point-list` primitives, with no timings and no licence stated — [GitHub m-schuetz/webgpu_pointcloud](https://github.com/m-schuetz/webgpu_pointcloud)
- **Float-add emulation is not portable.** A wgpu crate notes naga's MSL backend, at that version, did not emit `atomicCompareExchangeWeak`, so it fell back to serial accumulation — [rlx-wgpu scatter_add.wgsl](https://docs.rs/crate/rlx-wgpu/0.2.3/source/src/kernels/scatter_add.wgsl) (search summary, not verified). Integer `atomicAdd` accumulation is used in WebGPU demos such as a 3D Physarum — [Observable](https://observablehq.com/@miketahani/webgpu-3d-physarum) (search summary, not verified)
- **Points are 1 px in practice.** WebGPU points are always 1 px, because point size is not supported by D3D12, Vulkan or Metal, so sprites need instanced quads (three.js added InstancedPoints) — [three.js forum](https://discourse.threejs.org/t/working-around-the-low-aliased-pointsize-on-the-new-m1-macbook-pros/26819); [Babylon.js forum](https://forum.babylonjs.com/t/webgpu-and-point-size/45212/2) (search summary, not verified; consistent with the spec definition above). The 1-px behaviour itself is verified by the spec's point-rasterization rule; the stated D3D12, Vulkan and Metal reasons are not. [Verified: https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs]
- **AMD's MIT-licensed GPUParticles11 DirectX 11 sample** ("Copyright (c) 2016 Advanced Micro Devices") shows a GPU particle system with depth-buffer collisions and GPU sorting "for correct blending of rasterized billboards" — [GitHub GPUOpen-LibrariesAndSDKs/GPUParticles11](https://github.com/GPUOpen-LibrariesAndSDKs/GPUParticles11)
- **AMD tiled particle rendering in compute.** AMD's 2014 deck "Holy Smoke! Faster Particle Rendering using DirectCompute" (Gareth Thomas) describes tiled particle rendering in compute, inspired by Forward+, which bins particles into screen tiles instead of lights. It notes the system "cannot sort global list of particles" — [SlideShare](https://www.slideshare.net/slideshow/holy-smoke-faster-particle-rendering-using-direct-compute-by-gareth-thomas/35656271); [GDC 2014 session](https://gdcvault.com/play/1020002/Advanced-Visual-Effects-with-DirectX) (search summary, not verified). A practitioner found 32x32 tiles faster than 16x16 — [GameDev.net](https://gamedev.net/forums/topic/692435-tile-based-particle-rendering/?page=1) (search summary, not verified)
- **Prefix sums on WebGPU.**
  - GPUPrefixSums is MIT-licensed ("Copyright (c) 2024 Thomas Smith") — [GitHub b0nes164/GPUPrefixSums](https://github.com/b0nes164/GPUPrefixSums).
  - Decoupled look-back cannot run portably on WebGPU, because Apple and ARM GPUs lack forward-progress guarantees — [Levien](https://hacklines.com/en/editions/247180/click); [Levien, Vulkan post](https://hacklines.com/en/editions/183712/click) (search summary, not verified)
  - Gridwise provides a chained scan that needs no forward-progress guarantee — [Gridwise](https://gridwise-webgpu.github.io/gridwise/scan-and-reduce) (search summary, not verified)
  - "Decoupled Fallback" reaches near-memcpy prefix sums on M1 Max and M3 under Dawn — [GPUPrefixSums summary](https://feedbagel.com/post/gpuprefixsums-portable-gpu-prefix-sum-algorithms-for-cuda-d3d12-unity-and-wgpu) (search summary, not verified)
- **Conflicting claim.** WebSplatter (2026) says its sort "circumvents the lack of global atomics in WebGPU" — [arXiv 2602.03207](https://arxiv.org/html/2602.03207v1) (search summary, not verified). This conflicts with the verified WGSL rule that atomics are allowed in the storage address space. It probably refers to missing forward-progress guarantees, or missing 64-bit and float atomics.
- **CESCG 2026** has a non-peer-reviewed WebGPU point engine paper with no numbers found — [Kurtagić, CESCG 2026](https://cescg.org/wp-content/uploads/2026/04/Kurtagić-A-Data-Oriented-Point-Based-Rendering-Engine-on-WebGPU.pdf) (search summary, not verified)
- **Bandwidth figures:**
  - RTX 4090: 1,008 GB/s; M1 Max: 400 GB/s — [PWhiddy table](https://github.com/PWhiddy/webgpu-atomics-benchmark)
  - RTX 5090: 1,792 GB/s — [gpu-monkey](https://www.gpu-monkey.com/en/compare_gpu-gigabyte_geforce_rtx_5090_windforce_oc-vs-amd_radeon_rx_9070_xt) (search summary, not verified)
  - RTX 5070: 672 GB/s — [gpu-monkey](https://www.gpu-monkey.com/en/compare_gpu-gigabyte_geforce_rtx_5070_gaming-vs-amd_radeon_rx_9070) (search summary, not verified)
  - RX 9070 XT: about 640 to 644.6 GB/s — [technical.city](https://technical.city/en/video/GeForce-RTX-5090-vs-Radeon-RX-9070-XT) (search summary, not verified)
  - The RTX 5090, RTX 5070 and RX 9070 XT figures remain unverified at vendor level, because NVIDIA and AMD pages are unreachable. A 2026-11-12 search found spec aggregators agreeing on 1,792, 672 and 640 GB/s (644.6 GB/s in one), and 512-bit x 28 Gbps / 8 = 1,792 GB/s. [Unverified]

### Inferences
- **Quality: fp16 blending versus fixed point (arithmetic).** RGBA16F blending rounds every result to fp16, which has an 11-bit significand.
  - At 4.0 or above, adding 0.001 rounds to no change, because half an ulp is about 0.00195.
  - Between 2 and 4, the same addition rounds up to a full ulp.
  - So 10,000 particles of 0.001 settle near 4.0 instead of 10.0. [Verified: recomputed in this session with numpy float16, rounding after every add; the sum stops at exactly 4.0, and 3.0 + 0.001 gives 3.00195]
  - u32 fixed-point sums are exact, order-independent and deterministic. That is a quality argument for compute accumulation, and the current WebGL2 edition may already lose energy in dense regions.
- **Fixed-point design.**
  - Scale: choose S counts per unit of scene-linear radiance, for example 2^12 to 2^16.
  - Stochastic rounding: add hash noise before `floor`, so faint particles keep their energy in expectation.
  - Overflow: a carry happened exactly when `old > 0xFFFFFFFF - v`, using the old value that `atomicAdd` returns. Increment a high-word buffer on carry, which gives an exact 64-bit range.
  - Resolve: multiply by exposure/S, then clear in the same pass.
- **Atomic budget.**
  - Cost per particle: 3 atomics for a nearest-pixel RGB splat, 12 for a bilinear 2x2 splat.
  - Scale: 100M particles means 300M atomics per frame. The 62B ops/s figure is a single-address, aggregated best case, so expect several milliseconds: too slow for 240 Hz and borderline at 120 Hz.
  - Mitigations:
    - Per-tile workgroup accumulation, flushed once per pixel. A 32x32 tile with 3 u32 channels is 12,288 bytes, inside the verified 16,384-byte default limit. 4 channels would hit the default exactly, but on a device that requests the 32 KiB that D3D12, Apple-silicon Metal and the measured adapter expose, they fit with 16 KiB to spare. 3 channels plus 3 carry words (24 KiB) also fit. [Verified correction: https://github.com/google/dawn/blob/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp; https://developer.apple.com/metal/Metal-Feature-Set-Tables.pdf; measured in this container]
    - Morton-ordered particles for cache coherence.
    - Fewer channels, for example a luminance value plus a palette index.
    - Stochastic one-of-four bilinear splats.
    - Subgroup aggregation where the optional `subgroups` feature exists. It is in Chrome 134 and later on Windows, macOS and ChromeOS, on Linux from 144, and not in Firefox. The measured Chromium 153 SwiftShader adapter has it, with a subgroup size of 4. [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/GPUSupportedFeatures.json; measured in this container]
- **Speculative throughput range.** Schütz's figures are for opaque, depth-tested points that mostly skip their atomic. Additive splats must issue atomics for every particle, so plan on roughly 1B to 10B additive splats per second on high-end GPUs until benchmarked.
- **Bandwidth.**
  - 100M particles at 16 B each is 1.6 GB per frame to read, or 192 GB/s at 120 Hz and 384 GB/s at 240 Hz.
  - With full-precision simulation (about 64 B per particle per frame), 100M at 240 Hz needs about 1.92 TB/s, which exceeds an RTX 5090.
  - Buffer and dispatch limits also apply, not only bandwidth:
    - The spec defaults are 256 MiB per buffer and 128 MiB per storage binding. Dawn exposes 2 GiB on D3D12, and the measured adapter exposes 1 GiB. So 1.6 GB of state must be requested through `requiredLimits` and, for portability, split across at least two buffers or bindings.
    - One dispatch dimension is capped at 65,535 workgroups. 100M particles at 256 threads per workgroup need 390,625 workgroups, so dispatch in 2D or loop inside each thread.

    [Verified correction: https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs; https://github.com/google/dawn/blob/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp; https://github.com/google/dawn/blob/main/src/dawn/common/Constants.h; measured in this container]
  - Rough ceilings:

| GPU class | 240 Hz | 120 Hz |
|---|---|---|
| RTX 5070 / RX 9070 XT | about 10M to 30M particles | not estimated |
| RTX 5090 | about 50M or more | 100M, only with quantized state or with simulation and splatting fused in one kernel |

- **Hardware quads.** Quads of 1 to 2 px waste raster and shading work: two triangles and 2x2 shading quads per particle (background knowledge). Quads still suit sprites of about 3 to 4 px radius or more. They can accumulate into the same fixed-point buffer through fragment-shader storage atomics, which WGSL allows outside the vertex stage, to avoid fp16 swamping. [Verified: https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs]
- **Architecture.** This is a hybrid, chosen per particle by footprint:
  1. Classify each particle by its projected footprint, including circle of confusion and motion stretch.
  2. Send tiny particles to the compute splat.
  3. Send medium particles to tile-binned compute or to quads.
  4. Send large particles to quads.
  5. Resolve to RGBA16F, then run bloom and tone mapping.

  Because additive light is order-independent, nothing needs sorting.

### Gaps
- No measured numbers were found for WebGPU instanced-quad additive particles at the 10M to 100M scale.
- No measured numbers were found for scattered-address `atomicAdd` throughput in WebGPU on desktop GPUs.
- Aras's per-GPU tables were not retrievable (aras-p.info blocked), so the specific GPU models in his test are unknown.
- No source compares fixed-point against fp16 or fp32 blending quality; the swamping analysis is arithmetic.
- Process note:
  - This session's network policy blocked arxiv.org, w3.org, itu.int, aras-p.info, developer.chrome.com, github.io pages, Wikipedia and gpuopen.com.
  - The GitHub API and github.com HTML were refused for repositories outside the session; only raw.githubusercontent.com and some github.com pages worked.
  - The shared web-search budget was exhausted.

## 2. Anti-aliasing tiny particles, motion blur and streaks (velocity-stretched quads, line rasterization in compute, temporal accumulation), depth of field for particles, trails and persistence (feedback buffers)

### Takeaway
Because additive light is order-independent, anti-aliasing, motion blur and depth of field can all be done exactly per particle at splat time, with no occlusion artefacts:
- **Anti-aliasing:** filtered footprints.
- **Motion blur and streaks:** stretched quads or compute line splats, with intensity divided by length.
- **Depth of field:** splats sized by the circle of confusion, with intensity divided by area.

Feedback trails at 120 to 240 Hz need a frame-rate-independent fade and at least fp16 storage; 8-bit and 11/11/10-bit buffers stall and leave frozen ghosts at high refresh rates.

### Cited Findings
- **Velocity-stretched billboards:**
  - Project the position at t+1 as well, and stretch the quad along the screen-space difference — [MonoGame forum](https://community.monogame.net/t/gpu-stretched-particle/8464) (search summary, not verified)
  - Alternatively, offset quad vertices along the view-space projected velocity — [GameDev.net](https://comic.gamedev.net/forums/topic/696694-stretched-billboard-projected-particles) (search summary, not verified)
  - Unity-style stretched billboards suit sparks, with rotation computed on the GPU — [Urho3D forum](https://discourse-urho3d.github.io/t/particle-direction/1663) (search summary, not verified)
- **Gaia Sky motion trails (2025)** stretch billboards along camera-relative velocity in the vertex shader and compensate brightness so stretched particles do not get brighter — [Gaia Sky blog](https://tonisagrista.com/blog/2025/motion-trails/) (search summary, not verified)
- **Engine caveat:** Babylon.js GPU particles disappeared in stretched-billboard mode — [Babylon.js forum](https://forum.babylonjs.com/t/gpu-particles-disappeared-with-billboardmode-stretched/42199) (search summary, not verified)
- **Sprite bokeh** sizes a point sprite per pixel by its circle of confusion and shapes it like the aperture. Bandwidth and overdraw are concerns, energy conservation is "tricky", and a falloff parameter keeps energy roughly constant — [Matt Pettineo, How To Fake Bokeh](https://therealmjp.github.io/posts/bokeh) (search summary, not verified)
- **Scatter depth of field is hard** because of sorting cost, limited blending precision, and conserving total image energy — [Interactive DOF using simulated diffusion](https://typeset.io/pdf/interactive-depth-of-field-using-simulated-diffusion-on-a-z62z6hfrze.pdf) (search summary, not verified)
- **Related splatting work:**
  - Tiled particle accumulation for depth-of-field splatting with a per-fragment circle of confusion — [Selgrad et al. poster](https://diglib.eg.org/bitstream/handle/10.2312/egp20161056/poster-a4.pdf) (search summary, not verified)
  - Point splatting on per-pixel layers — [Kollmann thesis](https://www.cg.tuwien.ac.at/research/publications/2015/Kollmann-2015-DoF/Kollmann-2015-DoF-thesis.pdf) (search summary, not verified)
- **Real bokeh density is not uniform,** and DreamWorks suggests a particle renderer as future work — [Bühler et al.](https://research.dreamworks.com/wp-content/uploads/2018/07/142-buhler-Edited.pdf) (search summary, not verified)
- **Gather alternative:** Circular Separable Convolution DOF (EA) is faster than brute-force and sprite approaches — [Garcia, SIGGRAPH 2017](https://history.siggraph.org/wp-content/uploads/2022/09/2017-Talks-Garcia_Circular-Separable-Convolution-Depth-of-Field.pdf) (search summary, not verified)

### Inferences
- **Sub-pixel anti-aliasing.**
  - A bilinear (tent) splat to the 4 nearest pixels is exactly energy-conserving and removes "pixel crawl", at 4x the atomics.
  - Gaussian 3x3 footprints are smoother, at 9x.
  - A stochastic single-pixel pick, weighted by the bilinear weights, is unbiased at 1x; the eye integrates its noise at 240 Hz.
- **Motion blur in compute.**
  - Splat the segment from p(t-dt) to p(t) with energy E divided by its length (DDA or Wu-style lines). Cost scales with length, which shrinks 4x at 240 Hz compared with 60 Hz.
  - Draw long sparks as quads to bound per-thread work.
  - An analytic Gaussian-along-segment footprint (erf) in a quad fragment shader would combine anti-aliasing, blur and soft focus. This is unsourced.
- **Depth of field.**
  - Spread energy E over pi*r^2 for blur radius r; this is the existing "energy-preserving soft focus".
  - Move large-blur particles to quads, or use "mip splatting": splat into the pyramid level matching the blur size, then upsample. That makes cost independent of blur size and reuses the bloom pyramid.
  - Aperture-shaped bokeh as a quad texture is correct for additive content, because no sorting is needed.
- **Trails and persistence.**
  - Use m = exp(-dt/tau) with the measured frame interval, so the fade is safe with variable refresh. A fixed per-frame fade makes trails 4x shorter at 240 Hz than at 60 Hz.
  - Precision limits at 240 Hz by storage format:
    - **fp16:** stalls once the decrement falls below half an ulp (2^-12 to 2^-11 of the value), so fades are reliable up to tau of about 8 s.
    - **rg11b10ufloat:** red and green stall beyond tau of about 0.5 s and blue beyond about 0.27 s, so fading trails also shift hue.
    - **rgba8unorm:** stalls almost immediately, leaving frozen ghosts.
    - [Verified: recomputed in this session; at 240 Hz a stall becomes possible above tau of about 8.5 s for fp16, 0.53 s for the 6-bit-mantissa R11/G11 and 0.27 s for the 5-bit-mantissa B10 channel]
  - Use rgba16float with a blue-noise dither on the decay, or rgba32float for very long persistence. Fade in scene-linear, and consider storing persistence at reduced resolution.
  - rgba32float and rg11b10ufloat both need optional features:
    - Blending into rgba32float needs `float32-blendable` (Chrome 132 and later), and filtering it needs `float32-filterable`.
    - Rendering to rg11b10ufloat needs `rg11b10ufloat-renderable`.
    - A compute or full-screen fade pass that reads the previous frame and writes the next needs no blending.
    - All three features are present on the measured SwiftShader adapter.

    [Verified: https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs; https://github.com/mdn/browser-compat-data/blob/main/api/GPUSupportedFeatures.json; measured in this container]
- **Temporal accumulation.** At 240 Hz the display already shows 4 sub-frames per 60 Hz frame, so keep per-frame blur at or below the frame interval. Accumulate sub-frames only for offline capture (section 10).

### Gaps
- No source was found for compute line rasterization of particles specifically.
- No per-particle depth-of-field energy formula was found beyond Pettineo's falloff discussion.
- No measured costs were found comparing stretched quads with compute lines.

## 3. Bloom and glare: dual-filter (Jimenez, Call of Duty) and Kawase bloom vs FFT convolution bloom with aperture and lens kernels for starbursts; cost at 1440p and 4K

### Takeaway
Keep a pyramid bloom for the broad glow: either the current Call of Duty: Advanced Warfare style 13-tap downsample with tent upsample and Karis averaging, or ARM's dual-Kawase. By a bandwidth estimate it costs well under a millisecond at 4K on desktop GPUs; no published desktop timings were found.

FFT convolution adds physically shaped glare and diffraction starbursts, but Unreal positions it for cinematics and high-end hardware. A WebGPU implementation (luma.gl, MIT) uses a 1024x512 FFT, 48 MiB of buffers and 45 dispatches at 1080p.

For a light toy, pair the pyramid with starbursts drawn only for the brightest sources, either as sprites or as a low-resolution FFT.

### Cited Findings
- **Jimenez (SIGGRAPH 2014)** uses a 13-tap downsample with a weighted average, designed against "pulsating artifacts and temporal stability issues" — [iryoku.com](https://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare/); [scrapbox notes](https://scrapbox.io/0b5vr/Next_Generation_Post_Processing_in_Call_of_Duty:_Advanced_Warfare) (search summary, not verified). Unity and Blender EEVEE use this filter — [gist (laurelkeys)](https://gist.github.com/laurelkeys/452418c7a0d309db10976df860022fa2) (search summary, not verified). There is a practical walkthrough — [LearnOpenGL](https://learnopengl.com/Guest-Articles/2022/Phys.-Based-Bloom) (search summary, not verified)
- **Naming.** The "dual filter" is Bjørge's (ARM, SIGGRAPH 2015) variant of Kawase: it downsamples and upsamples with different kernels at a constant sampling distance. It is compared against a 5x5 Gaussian and Kawase on bandwidth, with a PSNR of 50.02 dB versus 49.78 dB — [ARM slides](https://community.arm.com:443/cfs-file/__key/communityserver-blogs-components-weblogfiles/00-00-00-20-66/siggraph2015_2D00_mmg_2D00_marius_2D00_slides.pdf); [notes](https://community.arm.com:443/cfs-file/__key/communityserver-blogs-components-weblogfiles/00-00-00-20-66/siggraph2015_2D00_mmg_2D00_marius_2D00_notes.pdf) (search summary, not verified). Some material conflates it with Jimenez's method — [forge-gpu skill page](https://www.skills.lc/RosyGameStudio/forge-gpu/rosygamestudio-forge-gpu-claude-skills-forge-bloom-skill-md) (search summary, not verified)
- **Arm case study:** dual filtering helped less than expected over a Gaussian that already ran downscaled — [Arm blog](https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/post-processing-effects-on-mobile-optimization-and-alternatives) (search summary, not verified)
- **Android study (2025), mean frame times:** mipmap bloom 10.29 ms, Kawase+HDR 11.49 ms, Gaussian 14.12 ms — [ETASR](https://etasr.com/index.php/ETASR/article/download/19101/6940) (search summary, not verified; mobile only)
- **Desktop data point:** on a GTX 1080 at 1920x1080, a sparse convolution filter took 0.74 ms versus 1.64 ms for a separated Gaussian — [RWTH preprint](https://www.graphics.rwth-aachen.de/media/papers/312/sparse_convolutions_preprint.pdf) (search summary, not verified)
- **Unreal Bloom Convolution (FFT)** is "designed for use with in-game or offline cinematics or on high-end hardware", and Standard bloom has "a significant performance advantage" — [Unreal docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/bloom-in-unreal-engine) (search summary, not verified). User reports:
  - The cost jumped from "a few ms a frame to over 500 ms a frame" just past 4K — [Unreal forum](https://forums.unrealengine.com/t/potential-bloom-performance-bug-on-certain-resolutions/223729) (search summary, not verified)
  - A cost of about 20 fps — [Unreal forum](https://forums.unrealengine.com/t/the-new-fft-convolution-bloom/91848) (search summary, not verified)
- **luma.gl's WebGPU FFT bloom** at 1920x1080, with quarter-resolution sampling and a 12.5% guard band, uses a 1024x512 FFT, 48 MiB of complex buffers and 45 dispatches — [luma.gl docs](https://luma.gl/docs/api-reference/shadertools/shader-passes/bloom) (search summary, not verified). luma.gl's LICENSE is MIT ("Copyright (c) 2020 vis.gl contributors") — [GitHub visgl/luma.gl](https://github.com/visgl/luma.gl)
- **iMMERSE's FFT bloom** produces diffraction-spike starbursts — [guide](https://guides-martysmods-com.pages.dev/shaders/immerseultimate/convolutionbloom) (search summary, not verified)
- **Ritschel et al. 2009, "Temporal Glare,"** simulates dynamic eye glare in real time on the GPU, and improves perceived brightness — [MPI](https://resources.mpi-inf.mpg.de/hdr/TemporalGlare); [dblp](https://dblp.uni-trier.de/rec/bibtex/journals/cgf/RitschelIFCMS09) (search summary, not verified)
- **Bevy's bloom** has an energy-conserving composite (intensity as scatter probability) and a "low-frequency boost", and recommends tonemappers that desaturate to white — [Bevy Bloom docs](https://docs.rs/bevy/0.15.1/bevy/core_pipeline/bloom/struct.Bloom.html); [Bevy WebGPU example](https://bevy.org/examples-webgpu/3d-rendering/bloom-3d/) (search summary, not verified). Bevy is dual-licensed MIT and Apache-2.0 (both LICENSE files read) — [GitHub bevyengine/bevy](https://github.com/bevyengine/bevy)

### Inferences
- **Pyramid bloom cost at 4K** (8.29 MP, RGBA16F):
  - Traffic is about 150 to 200 MB per frame.
  - That is about 0.08 to 0.11 ms at 1.79 TB/s, or 0.22 to 0.3 ms at 672 GB/s, plus about 16 to 20 dispatches.
  - Realistic totals: about 0.2 to 0.6 ms at 4K and 0.1 to 0.3 ms at 1440p on mid-range GPUs.
  - Dual-Kawase's tap savings are modest because the chain is bandwidth- and dispatch-bound (tap counts from background knowledge: 5 down and 8 up, versus 13 down and 9 up).
- **FFT bloom cost at 4K.**
  - Configuration: about 2048x1024 per transform, at about 16.8 MB per complex fp32 channel.
  - Traffic: forward FFT, pointwise multiply and inverse FFT come to 6 to 8 passes. Packing RGB into two complex FFTs gives 300 to 450 MB in total.
  - Theoretical time: 0.2 to 0.3 ms at 1.79 TB/s, or 0.5 to 0.7 ms at 672 GB/s.
  - Realistic budget: 1 to 3 ms on mid-range GPUs, because hand-written WGSL FFTs rarely reach peak bandwidth.
  - Workgroup memory: the verified 16 KiB default `maxComputeWorkgroupStorageSize` holds a 1024-point complex fp32 row (8 KiB), but a 2048-point fp32 row (16 KiB) leaves no headroom at the default. A device that requests the 32 KiB exposed by D3D12, Apple-silicon Metal and the measured adapter holds a 2048-point fp32 row with 16 KiB to spare. Only rows beyond that need multi-pass transforms. fp16 transforms need the optional `shader-f16` feature (Chrome 120 and later, adapter-dependent), which the measured SwiftShader adapter lacks. [Verified correction: https://github.com/google/dawn/blob/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp; https://developer.apple.com/metal/Metal-Feature-Set-Tables.pdf; https://github.com/mdn/browser-compat-data/blob/main/api/GPUSupportedFeatures.json; measured in this container]
  - Limits: full-resolution 4K FFT is not viable at 240 Hz.
- **Hybrid.**
  - Pyramid bloom for the broad glow.
  - For the brightest emitters only, draw precomputed starburst sprites (the aperture's FFT computed once) for the top-K bright pixels or particles; cost scales with K, not resolution.
  - An optional low-resolution FFT tier at 120 Hz.
  - Energy-conserving composites, so bloom does not disturb eye adaptation and the flash guard.

### Gaps
- No desktop millisecond timings were found for Advanced Warfare style or dual-Kawase bloom at 1440p or 4K, or for FFT bloom at 4K.
- Kawase's GDC 2003 light-streak filter was not sourced.
- Ritschel's FFT and pupil details were not retrieved.

## 4. Volumetric light (froxels, ray marching a particle-density volume, light shafts), GI-like light from particles (radiance cascades 2D/3D, light propagation volumes, voxel cone tracing, screen-space GI), and reflections on a virtual floor or water: what is feasible in WebGPU and at what cost?

### Takeaway
Ray-traced looks for abstract additive light are feasible in WebGPU compute. The particles are emitters that mostly do not occlude each other, so most effects reduce to convolutions or cheap re-splats:
- **Floor light pools:** a height-dependent blur through a pyramid.
- **Mirror and water reflections:** re-splat the particles mirrored across the plane.
- **Volumetric glow and shafts:** voxelize particles into a froxel grid as both emission and density, then ray-march it (Frostbite-style). Assassin's Creed IV's version cost about 1.1 ms on 2013 consoles.
- **Soft shadows around occluders:** only these need 2D radiance cascades. The holographic variant measured 1.85 ms at 512x512 on an RTX 3080 Laptop GPU, so it should run at reduced resolution.

3D radiance cascades, voxel cone tracing and light propagation volumes cost too much and risk too much for a 240 Hz target.

### Cited Findings
- **Wronski, Assassin's Creed IV volumetric fog:** about 1.1 ms in total — [Game Developer](https://gamedeveloper.com/programming/atmospheric-scattering-and-volumetric-fog-algorithm-part-1) (search summary, not verified). It uses a 3D texture with compute ray marching through slices — [AC4 GDC slides](https://bartwronski.com/wp-content/uploads/2014/03/ac4_gdc.pdf); [Scribd](https://www.scribd.com/doc/259208414/Assassin-s-Creed-4) (search summary, not verified). Engines call this a "froxel buffer" — [Godot](https://godotengine.org/article/fog-volumes-arrive-in-godot-4) (search summary, not verified)
- **Hillaire, Frostbite 2015** (search summary, not verified) — [Frostbite](https://www.frostbite.com/2015/08/physically-based-unified-volumetric-rendering-in-frostbite/); [SlideShare](https://www.slideshare.net/DICEStudio/physically-based-and-unified-volumetric-rendering-in-frostbite); [2016 PDF](https://media.contentapi.ea.com/content/dam/eacom/frostbite/files/s2016_pbs_frostbite_sky_clouds.pdf):
  - It uses an extinction volume into which particles are voxelized, a volumetric shadow map, and froxels aligned to 16x16 light tiles.
  - Per-froxel scattering and extinction are integrated along view rays.
  - It was designed to scale to 30 and 60 fps titles.
- **Radiance cascades, primary repository.** The paper repository's LICENSE.txt is MIT ("Copyright 2024 Alexander Sannikov"). A CC-BY-ND image in the repository suggests different terms may apply to the paper itself — [GitHub Raikiri/RadianceCascadesPaper](https://github.com/Raikiri/RadianceCascadesPaper)
- **Radiance cascades, secondary claims.** The cost is independent of scene complexity, light count and polygon count. Sannikov's 2D demo lit 2, 102 and 1002 particle lights in about 12 ms, hardware unstated — [80.lv](https://80.lv/articles/radiance-cascades-new-approach-to-calculating-global-illumination) (search summary, not verified). The core idea is higher linear resolution nearby and higher angular resolution far away — [m4xc](https://m4xc.dev/articles/fundamental-rc) (search summary, not verified)
- **Path of Exile 2** reportedly uses several hundred probes with 128x128 textures, for about 3 ms — [Habr](https://habr.com/en/articles/897956) (search summary, not verified; secondary)
- **Holographic Radiance Cascades** (Freeman, Sannikov and Margel, 2025), timed on an RTX 3080 Laptop GPU — [arXiv 2505.02041](https://arxiv.org/pdf/2505.02041); [EmergentMind](https://www.emergentmind.com/papers/2505.02041) (search summary, not verified):
  - It took 1.85 ms at 512x512 and 7.67 ms at 1024x1024.
  - Its RMSE was 10x lower than path tracing with equal samples.
  - Time complexity is O(X^2 log X), and memory limits scaling to 3D.
- **TypeGPU** is MIT-licensed ("Copyright (c) 2025 Software Mansion") — [GitHub software-mansion/TypeGPU](https://github.com/software-mansion/TypeGPU). Its `@typegpu/radiance-cascades` package computes 2D lighting from scenes described as GPU functions — [TypeGPU docs](https://docs.swmansion.com/TypeGPU/ecosystem/typegpu-radiance-cascades/) (search summary, not verified)
- **Other 2D implementations** (search summary, not verified):
  - Solis 2D (Bevy/WGSL) — [lib.rs](https://lib.rs/crates/solis_2d)
  - arcane-engine (wgpu) — [docs.rs](https://docs.rs/arcane-engine/0.8.0/arcane_engine/renderer/radiance)
  - A JFA-based tutorial — [lesson 037](https://infinite-canvas-tutorial.pages.dev/guide/lesson-037)
  - Jason McGhee's "noiseless GI" walkthrough — [gist](https://gist.github.com/jasonjmcghee/0c72d185830685f67d3b8d9c7f330c3a)
- **3D and screen-space radiance cascades** (search summary, not verified):
  - three-rc uses screen-space probes and a BVH — [GitHub CodyJasonBennett/three-rc](https://github.com/CodyJasonBennett/three-rc)
  - The Chalmers thesis (Abou Dan and Jensen) — [Chalmers](https://odr.chalmers.se/items/9e42007a-bb60-440f-ba28-04410822758f/full):
    - Method: screen-space radiance cascades combined with Visibility Bitmask GI.
    - Result: one-bounce GI with emissive lighting, using 0.03 to 3.9 GiB of memory.
    - Limitations: off-screen geometry neither contributes nor occludes.
  - World-space intervals for off-screen light — [Gavras 2025](https://odr.chalmers.se/items/3ee9fb4e-1880-46c2-802a-a660e38dc9ee/full)
  - Split radiance cascades — [GameDev.net](https://gamedev.net/news/4628-split-radiance-cascades-real-time-global-illumination-via-sparse-radiance-probes/)
  - Radiance cascades faster than screen-space GI in a Unity benchmark (relative results) — [DiGRA](https://dl.digra.org/index.php/dl/article/download/2775/2759/2819)
- **Light propagation volumes** (search summary, not verified):
  - CryEngine 3 budgeted about 10% of the frame, roughly 3.3 ms, for GI. That is a target, not a measurement — [LPV 2009](https://advances.realtimerendering.com/s2009/Light_Propagation_Volumes.pdf)
  - A 2024 cascaded LPV variant uses 3 cascades of 32^3 cells — [arXiv 2407.17336](https://arxiv.org/pdf/2407.17336)
- **Screen-space reflections** (search summary, not verified):
  - The reference is Stochastic SSR (Stachowiak and Uludag, 2015) — [Frostbite](https://frostbite.com/frostbite/news/stochastic-screen-space-reflections)
  - A Unity reimplementation on a GTX 1070 at 1080p costs 1.7 ms in one configuration and 4.15 ms at highest quality (ray casting 1.4, blur 0.73, temporal 0.67, resolve 0.55 ms) — [GitHub jorgemagic](https://github.com/jorgemagic/computestochasticreflections); [Unity Play](https://play.unity.com/p/compute-stochastic-screen-space-reflections-for-unity-post-processing)
  - AMD FidelityFX SSSR is an open reference — [GPUOpen](https://gpuopen.com/manuals/fidelityfx_sdk/samples/stochastic-screen-space-reflections/)
  - Pixel-projected reflections for planar reflectors — [SIGGRAPH 2017 PDF](https://www.advances.realtimerendering.com/s2017/PixelProjectedReflectionsAC_v_1.92.pdf) (content not retrieved)
- **WebGPU constraints relevant to voxelization (primary source):**
  - Atomics only in the storage and workgroup address spaces, with u32 and i32 only — [WGSL spec source](https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs)
  - The workgroup storage default is 16,384 bytes — [WebGPU spec source](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs) [Verified: https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs]. Desktop backends expose 32 KiB on request (see section 1).

### Inferences
- **Key insight.** Additive emitters do not occlude, so GI and volumetrics become convolutions. The costs below are estimates.
  - **Floor light.**
    - Irradiance on a plane from a point emitter at height h and horizontal distance r is proportional to h/(r^2+h^2)^(3/2).
    - Splat each particle into the mip level of a top-down floor texture whose texel size is about h (2 to 4 atomics), then upsample.
    - Estimated cost is about 0.1 to 0.3 ms.
  - **Reflections.**
    - Mirror the particles across the plane and splat them into a half-resolution buffer, at about +25% of the splat cost.
    - Blur by distance to the plane for gloss, and apply Fresnel. For water, perturb the lookup with ripples.
    - This is exact, and emitters off screen still reflect.
  - **Volumetric glow.**
    - Voxelize emission and density into a grid of about 160x90x64 cells (about 15 MB with four u32 channels). Voxelization must go to storage buffers, because WGSL has no texture atomics; then copy to a 3D texture for filtering. [Verified: WGSL defines atomics only on atomic types in storage buffers and workgroup memory, https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs]
    - Blur the emission in 3D, multiply by density, and integrate front to back along view rays.
    - Dense clouds of particles cast shafts.
    - Estimated cost is about 0.5 to 1.5 ms.
  - **Occluder-aware GI.**
    - Run 2D radiance cascades at 1/4 to 1/8 resolution.
    - Estimated cost is about 2 to 4 ms on the laptop GPU above, and about 1 to 2 ms on high-end desktop GPUs.
    - Amortize to 60 Hz for the 240 Hz tier. The method is noiseless, so no history is needed.
  - **Full 3D GI** (voxel cone tracing or 3D cascades) is expensive and adds little to occluder-free light art.
- **Overall.** The four "RTX-like" cues are light pools, glossy reflections, volumetric glow and shafts, and diffraction glare. Together they cost about 1.5 to 4 ms at 4K by estimate.

### Gaps
- No direct WebGPU desktop timings were found for froxels, 3D radiance cascades, light propagation volumes or voxel cone tracing; the voxel cone tracing search returned nothing.
- Hillaire's and Wronski's detailed numbers were not retrieved.
- The Path of Exile 2 figure is from a secondary source.

## 5. HDR and colour: scene-referred to display-referred mapping, tone mapping operators (AgX, ACES 2.0, Khronos PBR Neutral, GT7), paper white and peak brightness, wide gamut (display-p3, Rec.2020), perceptual mixing (OKLab/OKLCH), dithering, grain, chromatic aberration, eye adaptation

### Takeaway
Accumulate in scene-linear, and apply one display transform parameterised by paper white and peak brightness. The four operators differ as follows:
- **ACES 2.0** is the most complete parameterised family.
- **GT7's operator** is HDR-first, with an MIT sample.
- **AgX** has a path to white that suits hot cores.
- **Khronos PBR Neutral** (Apache-2.0) preserves hue but outputs sRGB only, with no gamut mapping.

WebGPU's spec-defined `"extended"` canvas tone-mapping mode leaves values above 1 unchanged up to what the screen can show. Even in `"standard"` mode, an `'srgb'` canvas can carry wider-gamut colours as negative values, which are converted for P3 screens. [Verified: https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs]

`toneMapping` is in Chrome 129 and later (Linux from 144), and in neither Firefox nor Safari. The spec says to feature-detect it through `getConfiguration()`. The measured Chromium 153 accepts `rgba16float` with `{mode: "extended"}` and reports it back there. [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/GPUCanvasContext.json; measured in this container]

Take peak and paper white from an in-app calibration in the style of HGIG. Use OKLab/OKLCH only for authoring, never for accumulation.

### Cited Findings
- **WebGPU spec, primary source** (all points below re-read) — [WebGPU spec source](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs) [Verified: https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs]:
  - `GPUCanvasToneMappingMode` is `"standard"` or `"extended"`, and the default is `"standard"`. The default `colorSpace` is `"srgb"`.
  - `"standard"`: values within the screen's standard range are unchanged and others are projected, often by clamping to [0, 1].
  - `"extended"`: "Color values in the extended dynamic range of the screen are unchanged", and others are projected to the screen's extended range, "which may include values greater than 1". The spec's example is a screen showing [0, 4] in sRGB space.
  - Example in the `"standard"` section: writing (1.035, -0.175, -0.140) to an `'srgb'` canvas presented on a Display P3 screen gives P3 (0.948, 0.106, 0.01) with no clamping.
- **three.js WebGPU backend:** when `outputType === HalfFloatType`, it configures the canvas with `toneMapping.mode = 'extended'`, otherwise `'standard'` — [three.js WebGPUBackend.js](https://github.com/mrdoob/three.js/blob/dev/src/renderers/webgpu/WebGPUBackend.js). three.js is MIT ("Copyright © 2010-2026 three.js authors"). [Verified: https://github.com/mrdoob/three.js/blob/dev/src/renderers/webgpu/WebGPUBackend.js; https://github.com/mrdoob/three.js/blob/dev/LICENSE]
- **webgpu-samples "particles" sample:** it uses `presentationFormat = 'rgba16float'`, a selectable `toneMapping: { mode }` (`'standard'` or `'extended'`), a `brightnessFactor` of 0 to 4, and `matchMedia('(dynamic-range: high)')` — [webgpu-samples sample/particles/main.ts](https://github.com/webgpu/webgpu-samples/blob/main/sample/particles/main.ts). The repository licence is BSD 3-clause ("Copyright 2019 WebGPU Samples Contributors").
- **Chrome 129** introduced canvas tone mapping, with `rgba16float` plus `"extended"` displaying values above SDR white — [Chrome blog](https://developer.chrome.com/blog/new-in-webgpu-129); [luma.gl guide](https://luma.gl/next/docs/api-guide/gpu/gpu-rendering) (search summary, not verified)
- **Khronos PBR Neutral** — [GitHub KhronosGroup/ToneMapping](https://github.com/KhronosGroup/ToneMapping/tree/main/PBR_Neutral). LICENSE.md is Apache-2.0.
  - **Properties:** hue-preserving, 1:1, analytically invertible, with continuous derivatives. Base colours with every channel in 0.08 to 0.8 are reproduced exactly.
  - **Output:** "Currently this tone mapper only supports output to sRGB (two flavors)". It applies no gamut mapping and assumes Rec.709.
  - **Parameters:** F90 = 0.04, Ks = 0.76, Kd = 0.15.
  - **Algorithm:**
    1. x = min(R,G,B).
    2. f = x - x^2/(4*F90) if x <= 2*F90, otherwise f = F90.
    3. p = max(c - f).
    4. pn = 1 - (1-Ks)^2/(p+1-2Ks).
    5. g = 1/(Kd*(p-pn)+1).
    6. Output is c-f if p <= Ks. Otherwise it is (c-f)*(pn/p)*g + pn*(1-g).
- **three.js TSL tone mapping** implements Linear, Reinhard, Cineon, ACESFilmic, AgX and Neutral. Neutral references model-viewer's tone-mapping page, which is also the write-up the Khronos README points to — [three.js ToneMappingFunctions.js](https://github.com/mrdoob/three.js/blob/dev/src/nodes/display/ToneMappingFunctions.js)
- **AgX in Blender:** Blender 4.0 made AgX the default, replacing Filmic, and both target 0..1 for SDR. It is based on Troy Sobotka's AgX, with development by Eary Chow and others — [Blender 4.0 notes](https://wiki.blender.org/release_notes/4.0/color_management/); [EaryChow/AgX](https://github.com/EaryChow/AgX); [BlenderNation](https://www.blendernation.com/2023/09/05/filmics-successor-new-agx-view-transform-in-blender-4-0/) (search summary, not verified)
- **AgX ports and Bevy:**
  - Ports differ between Troy's original and Blender 4's version — [unitycoder/AgX-Tonemapping-Unity](https://github.com/unitycoder/AgX-Tonemapping-Unity) (search summary, not verified)
  - Bevy calls AgX "very neutral, and somewhat desaturated" — [Bevy Tonemapping docs](https://doc.qu1x.dev/bevy_trackball/bevy/core_pipeline/tonemapping/enum.Tonemapping.html) (search summary, not verified)
- **ACES output transforms repository:** it provides presets for common output display setups and depends on the aces-core library. Its LICENSE.md is the Academy's ACES licence (royalty-free, with conditions), and so is aces-dev's — [GitHub ampas/aces-output](https://github.com/ampas/aces-output); [GitHub ampas/aces-dev](https://github.com/ampas/aces-dev)
- **ACES 2.0 via OCIO 2.4** (September 2024): preview Output Transforms parameterised by peak nits plus limiting-gamut chromaticities (nine parameters). Presets cover SDR at 100 nits (Rec.709, P3-D65), HDR at 500, 1000, 2000 and 4000 nits (Rec.2020, P3-D65), plus 108 and 300 nits — [OCIO 2.4](https://opencolorio.readthedocs.io/en/main/releases/ocio_2_4.html) (search summary, not verified). Any peak from 100 to 10,000 nits is supported — [ACES docs](https://draftdocs.acescentral.com/background/whats-new); [presets](https://docs.acescentral.com/system-components/output-transforms/parameters/) (search summary, not verified). Custom peaks such as 600 nits are possible — [ACES Central](https://community.acescentral.com/t/aces-2-0-dctl-in-resolve-20-1/5848) (search summary, not verified)
- **GT7 (Polyphony Digital)** (search summary, not verified):
  - The SIGGRAPH 2025 talk "Driving Toward Reality" presents "physically based tone mapping" — [slides](https://blog.selfshadow.com/publications/s2025-shading-course/pdi/s2025_pbs_pdi_slides.pdf); [GTPlanet](https://www.gtplanet.net/why-gran-turismo-7-graphics-look-20250902/)
  - Polyphony released an MIT C++ sample — [GTPlanet](https://www.gtplanet.net/beamng-drive-is-using-gran-turismo-7s-hdr-tone-mapping-technology-20260803/); [ACES Central](https://community.acescentral.com/t/ocio-implementation-of-gran-turismo-7-tonemapper/5922)
  - BeamNG 0.39 replaced ACES with it, to avoid clipped highlights and hue shifts — [BeamNG docs](https://docs.beamng.com/modding/lighting/tonemapping/)
  - CEDEC 2026 showed a prototype display sustaining more than 10,000 nits full-field — [GTPlanet](https://www.gtplanet.net/display-tech-is-finally-catching-up-to-gran-turismo-7-20260731/); [Final Boss](https://finalboss.io/gran-turismo-7-hdr-at-cedec-2026-why-10000-nit-specs-mislead)
  - A Unity URP package bakes GT7 into a 3D LUT on the CPU (description from a search summary). Its LICENSE.md is MIT ("Copyright (c) 2025 Akihiro Noguchi") — [GitHub aki-null/CustomToneMappingURP](https://github.com/aki-null/CustomToneMappingURP)
- **HGIG** (search summary, not verified) — [What Hi-Fi](https://www.whathifi.com/advice/hgig-explained-what-is-hgig-how-do-you-get-it-and-should-you-use-it); [MobilePixels](https://www.mobilepixels.us/pages/what-is-hgig); [Special K](https://discourse.special-k.info/t/new-hdr-calibration-procedure-sk-0-11-1-hgig/970):
  - The game tone-maps to the display's peak.
  - Calibration supplies MaxToneMapLuminance (10% window), MinToneMapLuminance and MaxFullFrameToneMapLuminance; paper white is separate.
  - It can look dimmer, because highlights above the panel's peak clip.
  - Vendor guides exist — [NVIDIA](https://developer.nvidia.com/rendering-game-hdr-display); [GPUOpen VDR](https://gpuopen.com/learn/vdr-follow-up-tonemapping-for-hdr-signals/).
- **OKLab** (Ottosson, December 2020) aims for even blends without hue drift. Oklab and OKLCH are in CSS Color, and Photoshop's perceptual gradients use Oklab — [Ottosson](https://bottosson.github.io/posts/oklab/); [Smashing](https://shop.smashingmagazine.com/2024/10/interview-bjorn-ottosson-creator-oklab-color-space/); [Wikiwand](https://www.wikiwand.com/en/articles/OKLab); [Levien review](https://hacklines.com/en/editions/220579/click) (search summary, not verified)
- **Dithering:** Gjøl uses TPDF dithering (the sum of two uniforms) at 8-bit scale, which must not be quantized away and is limited near black and white. His Playdead talk "Banding in Games" pairs grain with TAA — [Linelight](https://pixelmager.github.io/linelight/banding); [GPUOpen](https://gpuopen.com/?p=2565) (search summary, not verified)
- **Eye adaptation** (search summary, not verified):
  - Use a histogram over a fixed log range rather than a geometric mean — [Bruop](https://bruop.github.io/exposure)
  - Bevy uses a 64-bin histogram with workgroup-to-global merging — [Bevy commit](https://git.adamlamers.com/PublicArchive/bevy/commit/d3904200939ee6b2c0ee5f9293ad35ba8315cbfc)
  - Unity trims percentiles, and a wider EV range lowers precision — [Unity docs](https://docs.unity3d.com/Packages/com.unity.postprocessing@3.4/manual/Auto-Exposure.html)

### Inferences
- **Pipeline.**
  1. Accumulate in scene-linear, where 1.0 is SDR paper white at exposure 0.
  2. Apply bloom and volumetrics.
  3. Apply exposure.
  4. Apply the display transform. For SDR, use AgX, ACES 2.0 SDR or GT7 SDR. For HDR, use ACES 2.0 or GT7 with the user-calibrated peak and paper white. On an `"extended"` canvas, the written value equals nits divided by the SDR-white nits.
  5. Dither and encode.
- **Operator choice.** Hot overlaps should go to white, which AgX, ACES 2.0 and TonyMcMapface do. PBR Neutral suits keeping brand and UI colours exact. GT7's MIT sample is the most practical HDR-first operator. For ACES 2.0, bake a 3D LUT (33^3 to 65^3 with a log2 or PQ shaper) and rebuild it whenever the calibration changes.
- **Wide gamut.** The spec's P3 example shows an `'srgb'` `rgba16float` canvas can carry out-of-sRGB colours as negative or above-1 components, so a linear-Rec.709-primaries pipeline with extended values can reach P3 screens without a separate P3 canvas. For gamut-limited tone mapping of saturated laser-like emitters, author and accumulate in a wider space (for example linear Rec.2020), then map with ACES 2.0's limiting gamut. PBR Neutral has no gamut mapping.
- **OKLab and OKLCH** are for palettes with equal perceived lightness, ramps by particle age or speed, and gamut mapping by chroma reduction. Never accumulate in them.
- **Dithering.** Use about ±1 LSB TPDF at the final bit depth: 1/255 for SDR, and about 1/1023 in the encoded domain for 10-bit HDR. Animated blue noise helps at 240 Hz.
- **Grain and chromatic aberration.** Apply grain in log or PQ space. Chromatic aberration can be done physically, by offsetting each particle's per-channel splat positions.
- **Eye adaptation.** Smooth with exp(-dt*k), slew-limit it so exposure never creates flashes (section 6), and build the histogram from the 1/16-resolution bloom mip.

### Gaps
- The GT7 operator's maths and parameters were not retrieved.
- The sobotka/AgX repository was not found at common raw paths, so Troy Sobotka's original AgX was not read directly.
- No authoritative AgX HDR variant reference was found.
- The ACES 2.0 peak range and presets come only from search summaries; the aces-output README does not state them.
- Film-grain and chromatic-aberration practice for HDR was not sourced.

## 6. Photosensitive safety: flash and red-flash thresholds (WCAG 2.3.1, ITU-R BT.1702, the Harding test), and automatic enforcement in a real-time renderer

### Takeaway
WCAG's own text, verified here, is a complete, machine-checkable specification:
- **Limit:** no more than 3 general and/or red flashes in any 1 s, unless the concurrent flash area is at most 0.006 sr (25% of any 10-degree field).
- **General flash:** an opposing relative-luminance change of 10% or more where the darker state is below 0.80.
- **Red (WCAG 2.2):** a transition to or from R/(R+G+B) >= 0.8 with a chromaticity change above 0.2 in CIE 1976 UCS.
- **HDR:** 20 cd/m^2 when the darker state is below 160 cd/m^2, and a Michelson contrast of 1/17 or more when the darker state is at or above 160 cd/m^2, following BT.1702.

EA's IRIS (BSD-3-Clause) shows that detection is practical. A renderer can enforce the limits with a final-frame guard costing under 0.1 ms: per-tile luminance and red measurement, time-based transition counting, and attenuation of offending regions.

### Cited Findings
- **WCAG term "general flash and red flash thresholds" (primary source)** — [w3c/wcag guidelines/terms/20/general-flash-and-red-flash-thresholds.html](https://github.com/w3c/wcag/blob/main/guidelines/terms/20/general-flash-and-red-flash-thresholds.html); repository licence: W3C Document License:
  - **Passing condition:** content passes if there are "no more than three general flashes and / or no more than three red flashes within any one-second period", or if "the combined area of flashes occurring concurrently occupies no more than a total of .006 steradians within any 10 degree visual field on the screen (25% of any 10 degree visual field on the screen) at typical viewing distance".
  - **General flash:** "a pair of opposing changes in relative luminance of 10% or more of the maximum relative luminance (1.0) where the relative luminance of the darker image is below 0.80".
  - **Exception:** "Flashing that is a fine, balanced, pattern such as white noise or an alternating checkerboard pattern with 'squares' smaller than 0.1 degree... on a side does not violate the thresholds".
  - **Reference geometry:** a 341x256 px rectangle at 1024x768 estimates a 10-degree field "for standard screen sizes and viewing distances (e.g., 15-17 inch screen at 22-26 inches)".
  - **Transitions:** a transition is the change between adjacent peaks and valleys of luminance over time; "A flash consists of two opposing transitions".
  - **Red flash (WCAG 2.2):** "one transition is either to or from a state with a value R/(R + G + B) that is greater than or equal to 0.8, and the difference between states is more than 0.2 (unitless) in the CIE 1976 UCS chromaticity diagram" [ISO 9241-391].
- **WCAG Understanding 2.3.1 (primary source)** — [w3c/wcag understanding/20/three-flashes-or-below-threshold.html](https://github.com/w3c/wcag/blob/main/understanding/20/three-flashes-or-below-threshold.html):
  - **HDR clause:** "Where video content is provided in color spaces other than sRGB, the version provided with the highest dynamic range should be tested. In such cases the industry standard definition of a general flash is a change in luminance of 20 cd/m2 or more where the darker image is below 160 cd/m2. (ITU-R BT.1702.) This is applicable for standard dynamic range (SDR) and high dynamic range (HDR) content. For HDR content when the darker state is 160 cd/m2 or more, a general flash is one where the Michelson contrast is 1/17 or greater... (LHigh - LLow) / (LHigh + LLow)".
  - **Colour values:** R, G and B "range from 0-1 as specified in 'relative luminance' definition", which is the linearised sRGB definition.
  - **Tools:** it lists the Harding FPA and Trace Center's PEAT.
- **Older red-flash definition:** R/(R+G+B) >= 0.8 with a change in (R-G-B)x320 above 20, negative values set to zero — [W3C WCAG 2.1 Understanding](https://w3c.github.io/wcag21/understanding/three-flashes-or-below-threshold.html); [WCAG 2.0 Understanding](https://www.w3.org/WAI/WCAG20/Understanding/three-flashes-or-below-threshold) (search summary, not verified; superseded by the 2.2 definition above)
- **ITU-R BT.1702** (search summary, not verified; itu.int blocked):
  - BT.1702-2 (10/2019) gives the 20 cd/m^2 rule below 160 cd/m^2 for SDR and HDR, and 1/17 Michelson above it. HDR is measured assuming HLG peak white of 1,000 cd/m^2 — [BT.1702-2 English](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-2-201910-S!!PDF-E.pdf); [Chinese](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-2-201910-S!!PDF-C.pdf). The 20 and 160 cd/m^2 and 1/17 values match WCAG's verified HDR clause above.
  - BT.1702-3 (11/2023) has HDR-only guidance, and treats saturated-red transitions as potentially harmful irrespective of luminance — [BT.1702-3](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-3-202311-I!!PDF-E.pdf)
- **Harding FPA** (search summary, not verified):
  - It fails a flash only when the area exceeds 25% of the frame; smaller areas may give "Pass with Caution".
  - It flags patterns of alternating light and dark bars with at least 20 cd/m^2 contrast.
  - Two opposing transitions make one flash, and its trace flags activity above 1.0 Hz — [HardingFPA](https://hardingfpa.com/technical-support/how-to-interpret-hardingfpa-results)
  - UK advertising expects a Harding pass or equivalent — [ASA](https://www.asa.org.uk/news/flashing-images-in-advertising.html)
- **EA IRIS** — [GitHub electronicarts/IRIS](https://github.com/electronicarts/IRIS). LICENSE.txt is BSD-3-Clause ("Copyright (c) 2023 Electronic Arts Inc.").
  - **Detects:** luminance flashes, red-saturation flashes and patterns.
  - **Failure rules:**
    - Flash failure: more than 3 flashes in any 1 s.
    - Extended failure: 2 to 3 flashes per second across 5 consecutive seconds.
    - Pattern failure: a harmful pattern lasting 0.5 s or more.
  - **Triggers:** accumulated luminance difference of plus or minus 0.1, or accumulated red difference of plus or minus 20.
  - **Warning level:** more than 2 flashes (4 transitions) per second.
  - **Method:** per-frame analysis with a 1 s lookback. Thresholds live in `appsettings.json`, and the example app analyses a video file (`-v`).
  - **Status:** it is not a certification.
- **IRIS ecosystem:** a UE5 plugin analyses frames in real time while the game runs, and IRIS has been used in Madden NFL 24, EA SPORTS FC 24 and WRC — [EA news](https://www.ea.com/news/electronic-arts-continues-to-move-inclusive-gaming-forward); [MCV/UK](https://mcvuk.com/business-news/from-the-industry-electronic-arts-opens-up-23-more-accessibility-patents-for-wider-use-and-open-sources-photosensitivity-analysis-plugin/) (search summary, not verified). There is a Python port — [PyPI](https://pypi.org/project/iris-pse-detection/1.0.0/) (search summary, not verified)

### Inferences
- **Real-time guard.** This is original design, not taken from any source.
  1. **Measure the final displayed frame,** after tone mapping, bloom and grain.
  2. **Downsample** to about 1/32 resolution using the bloom pyramid. For each cell compute:
     - Luminance. For SDR, use relative luminance from linearised values. For HDR, use absolute cd/m^2 (value times the user's SDR-white nits) and apply the WCAG/BT.1702 rules of 20 cd/m^2 below 160 cd/m^2 and Michelson 1/17 at or above it.
     - R/(R+G+B) on linear values, and the CIE 1976 u'v' chromaticity change for red (WCAG 2.2).
  3. **Detect transitions** using IRIS-style accumulated differences with sign changes. Keep a ring buffer of timestamps by time, not frame count.
  4. **Test area** in a sliding 10-degree window computed from physical screen size and viewing distance. WCAG's 341x256 at 1024x768 is calibrated for a 15 to 17 inch screen at 22 to 26 inches. On a 27-inch 16:9 monitor at 60 cm, 10 degrees is about 10.5 cm, or about 450 px at 1440p, so the rule is much stricter than Harding's "25% of the frame".
  5. **Enforce** at IRIS's warning level (2 flashes per second):
     - Low-pass each cell's luminance toward a slow history value (tau of at least about 0.33 s), or damp the brightness of emitters spawning there.
     - Apply the result as a full-resolution gain map, so a fade replaces the strobe.
     - Desaturate red where red transitions accumulate.
  6. **Guard the content side:** limit how fast spawn bursts ramp brightness, and offer a stricter user mode.
  7. **Cost:** under 0.05 ms on a grid of 10,000 cells or fewer.
  8. **CI regression:** run IRIS on captured video (section 10).
- **Spatial noise.** WCAG's "fine, balanced pattern" exception (squares under 0.1 degree) suggests a dense sparkle field of tiny particles is not a "flash", but its slowly varying envelope is. Analysing at coarse resolution naturally measures the envelope.
- **HDR.** Absolute thresholds mean a scene can pass in SDR and fail in HDR, so the guard must run in absolute nits. Consider capping the peak for large-area changes.

### Gaps
- BT.1702-3's exact HDR text was not read (itu.int blocked).
- Ofcom's guidance note was not retrieved.
- Whether platforms require Harding testing for PC or web games was not established.
- No published real-time enforcement technique, as opposed to detection, was found.

## 7. Temporal techniques (TAA, temporal accumulation for noisy volumetrics) for points and additive content, and their ghosting pitfalls

### Takeaway
TAA fits additive particles badly: they lack valid motion vectors, sub-pixel emitters flicker under history clamping, and sparks ghost. The standard workarounds, rendering after TAA or using anti-ghosting masks, each have costs. Keep the particle layer out of TAA and anti-alias at splat time. Use time-based temporal accumulation only for low-resolution, low-frequency buffers, or use noiseless techniques that need no history.

### Cited Findings
- **TAA and particles:** TAA handles transparency, particles and reflections poorly because of incorrect velocity vectors — [Wikipedia](https://en.wikipedia.org/wiki/Temporal_anti-aliasing) (search summary, not verified)
- **Unreal:** translucency writes no motion vectors. Rendering it after motion blur removes the artefacts but loses anti-aliasing and occlusion correctness — [Unreal AnswerHub](https://answers.unrealengine.com/questions/249580/view.html) (search summary, not verified)
- **Unity HDRP:** particle butterflies ghost even with motion vectors, and SMAA looked better on them — [Unity discussions](https://discussions.unity.com/t/particles-vs-taa/837558) (search summary, not verified)
- **Trade-offs in TAA variants:** a newer Unreal TAA reduced spark ghosting but caused jaggies — [Unreal forum](https://forums.unrealengine.com/t/gen-5-temporal-anti-aliasing/152107) (search summary, not verified). Lower feedback is more responsive but less smooth — [threepipe](https://threepipe.org/plugin/TemporalAAPlugin.html) (search summary, not verified)
- **Grain with TAA:** Gjøl pairs grain with TAA to remove banding — [GPUOpen](https://gpuopen.com/?p=2565) (search summary, not verified)
- **Temporal pass cost:** 0.67 ms at 1080p on a GTX 1070 for a stochastic SSR temporal pass — [GitHub jorgemagic](https://github.com/jorgemagic/computestochasticreflections) (search summary, not verified)
- **Noiseless alternatives:** radiance cascades are "noiseless" — [McGhee gist](https://gist.github.com/jasonjmcghee/0c72d185830685f67d3b8d9c7f330c3a) (search summary, not verified). The holographic variant is visually indistinguishable from the reference — [arXiv 2505.02041](https://arxiv.org/pdf/2505.02041) (search summary, not verified)
- **Further reading:** an Activision TAA paper exists — [CoD TAA PDF](https://www.activision.com/cdn/research/Dynamic_Temporal_Antialiasing_and_Upsampling_in_Call_of_Duty_v4.pdf) (content not retrieved)

### Inferences
- **Particles.** Do not jitter the particle splat. Give any opaque geometry FXAA, SMAA or MSAA.
- **If TAA is used for a scene layer,** composite particles after the resolve, with only a depth test where geometry should occlude them.
- **Blend factor.** It must be time-based: alpha = 1 - exp(-dt/tau). A fixed alpha tuned at 60 Hz quadruples the effective history at 240 Hz.
- **Moving lights.** Prefer amortized updates, such as updating a quarter of the froxel slices per frame, over long history. Clamp history to the current neighbourhood in the low-resolution volume.
- **Trails.** Feedback trails are themselves temporal accumulation; keep them out of TAA history to avoid double smearing.

### Gaps
- No source was found on TAA with additive or emissive point content specifically.
- No source was found on the cost of froxel temporal reprojection.

## 8. Budgets: what fits in a frame at 1440p and 4K at 120 and 240 Hz on mid and high-end GPUs?

### Takeaway
A 240 Hz frame is 4.17 ms and a 120 Hz frame is 8.33 ms. Full-screen fp16 passes cost 0.03 to 0.2 ms each, so the whole post stack fits in about 0.5 to 1 ms at 4K on mid-range GPUs. Particle count is limited by bandwidth and atomics. Indicative ranges:
- about 10M to 30M particles at 240 Hz on RTX 5070 or RX 9070 XT class GPUs;
- about 50M at 240 Hz, or 100M at 120 Hz, on RTX 4090 or 5090 class GPUs, the latter with compressed state.

These are estimates, not measurements.

### Cited Findings
- **Bandwidth:**
  - RTX 4090: 1,008 GB/s; M1 Max: 400 GB/s — [PWhiddy](https://github.com/PWhiddy/webgpu-atomics-benchmark)
  - RTX 5090: 1,792 GB/s — [gpu-monkey](https://www.gpu-monkey.com/en/compare_gpu-gigabyte_geforce_rtx_5090_windforce_oc-vs-amd_radeon_rx_9070_xt) (search summary, not verified)
  - RTX 5070: 672 GB/s — [gpu-monkey](https://www.gpu-monkey.com/en/compare_gpu-gigabyte_geforce_rtx_5070_gaming-vs-amd_radeon_rx_9070) (search summary, not verified)
  - RX 9070 XT: about 640 to 644.6 GB/s — [technical.city](https://technical.city/en/video/GeForce-RTX-5090-vs-Radeon-RX-9070-XT) (search summary, not verified)
- **Throughput anchors:**
  - About 1B points in about 8 ms on an RTX 3090 (native) — [compute_rasterizer](https://github.com/m-schuetz/compute_rasterizer)
  - Contended atomics at 62B ops/s on an RTX 4090 and 20B on an M1 Max — [PWhiddy](https://github.com/PWhiddy/webgpu-atomics-benchmark)
  - 144.7B points per second — [Schütz 2022](https://arxiv.org/pdf/2204.01287) (search summary, not verified)
  - About 5x over WebGPU's built-in point rasterization on 30+ GPUs — [Aras](https://aras-p.info/blog/2025/08/24/This-many-points-is-surely-out-of-scope/) (search summary, not verified)
- **Particle example scale:** three.js's `webgpu_compute_particles` example uses `particleCount = 200000` — [three.js example](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles.html)
- **Effect anchors** (search summary, not verified):

| Effect | Cost | Source |
|---|---|---|
| Holographic radiance cascades | 1.85 ms at 512^2, 7.67 ms at 1024^2 (RTX 3080 Laptop) | [arXiv 2505.02041](https://arxiv.org/pdf/2505.02041) |
| Assassin's Creed IV volumetric fog | about 1.1 ms | [Game Developer](https://gamedeveloper.com/programming/atmospheric-scattering-and-volumetric-fog-algorithm-part-1) |
| Stochastic SSR at 1080p (GTX 1070) | 1.7 to 4.15 ms | [GitHub jorgemagic](https://github.com/jorgemagic/computestochasticreflections) |
| Path of Exile 2 radiance cascades | about 3 ms | [Habr](https://habr.com/en/articles/897956) |
| luma.gl FFT bloom at 1080p | 1024x512 FFT, 48 MiB, 45 dispatches | [luma.gl](https://luma.gl/docs/api-reference/shadertools/shader-passes/bloom) |

### Inferences
- **Frame budgets:** 120 Hz = 8.33 ms; 144 Hz = 6.94 ms; 240 Hz = 4.17 ms; 360 Hz = 2.78 ms.
- **Pixel counts:** 1440p = 3.69 MP; 4K = 8.29 MP.
- **Bandwidth-only lower bounds per pass:**

| Traffic | Size at 1440p / 4K | 672 GB/s (1440p / 4K) | 1,792 GB/s (1440p / 4K) |
|---|---|---|---|
| RGBA16F read+write pass | 59 / 133 MB | 0.09 / 0.20 ms | 0.03 / 0.07 ms |
| Fixed-point buffer (12 B/px) clear + resolve | 88 / 199 MB | 0.13 / 0.30 ms | 0.05 / 0.11 ms |

- **Particle bandwidth:**

| Traffic | Data per frame | 672 GB/s | 1,792 GB/s |
|---|---|---|---|
| Reads, 10M at 16 B | 160 MB | 0.24 ms | 0.09 ms |
| Reads, 100M at 16 B | 1.6 GB | 2.4 ms | 0.9 ms |
| Full-float simulation read+write, 100M (about 64 B per particle) | 6.4 GB | 9.5 ms | 3.6 ms |

- **Indicative 4K budget, mid-range at 240 Hz (4.17 ms)** (estimates):

| Item | Estimated ms |
|---|---|
| Simulation + splat, about 15M particles (compressed state, fused kernel) | 1.5 to 2.5 |
| Resolve + persistence (trails) | about 0.3 |
| Bloom pyramid | 0.3 to 0.5 |
| Top-K starburst glare sprites | about 0.1 |
| Floor light + mirrored reflection at half resolution | 0.3 to 0.6 |
| Tone map, grain, chromatic aberration and dither (one pass) + histogram + flash guard | 0.2 to 0.3 |
| Browser, compositor and present slack | about 0.5 |

- **Scaling and tiers.**
  - At 1440p, about 25M to 30M particles fit.
  - Froxel volumetrics (0.5 to 1.5 ms) and radiance-cascade GI (1 to 3 ms) fit at 120 Hz, or at 240 Hz only when amortized or on high-end GPUs.
  - On an RTX 5090: about 50M particles at 240 Hz with full effects, or 100M at 120 Hz with quantized state of 8 to 12 B per particle.
  - Suggested tiers: "Fidelity 120" and "Motion 240".
  - Use dynamic resolution for effect buffers only, never for the particle splat.
- **Measurement.** Use WebGPU timestamp queries and cross-check them, since Aras noted some browsers misreport GPU timings.

### Gaps
- No measured end-to-end WebGPU frame budgets for a comparable renderer on named desktop GPUs were found.
- RTX 4060 class bandwidth was not verified.
- Scattered-address atomic throughput is unknown.
- Compositor overhead at 240 Hz is out of scope.

## 9. Open-source WebGPU renderers and demos to learn from, with licences

### Takeaway
Most of the key references have permissive licences, verified from their LICENSE files this session:

| Licence | Projects |
|---|---|
| MIT | three.js; compute_rasterizer; Sannikov's radiance-cascades paper repository; luma.gl; TypeGPU; GPUPrefixSums; Shehata's tutorial; the PWhiddy benchmark; AMD GPUParticles11 |
| MIT and Apache-2.0 (dual) | Bevy |
| Apache-2.0 | Khronos ToneMapping |
| BSD 3-clause | webgpu-samples; EA IRIS; NVIDIA FLIP |

Two references carry document or Academy terms rather than software licences: the ACES repositories (Academy terms) and the WCAG and WebGPU spec repositories (W3C document licences). The licences for three-rc, the AgX repositories, FidelityFX, and Aras's test page remain unverified.

### Cited Findings
- **Licences read from LICENSE files on raw.githubusercontent.com this session:**

| Project | What it offers Tactilume | Licence (as read) |
|---|---|---|
| [webgpu/webgpu-samples](https://github.com/webgpu/webgpu-samples) | Official samples, including the HDR `particles` sample (`rgba16float`, `toneMapping` standard/extended) | BSD 3-clause text, "Copyright 2019 WebGPU Samples Contributors" |
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | WebGPURenderer and TSL; compute particle examples; AgX/Neutral/ACES tone mapping; HalfFloat output with `'extended'` canvas mode; `copyTextureToBuffer` readback | MIT |
| [m-schuetz/compute_rasterizer](https://github.com/m-schuetz/compute_rasterizer) | Compute point rasterizer (native, Windows/NVIDIA) | MIT, "Copyright 2022 Markus Schütz"; some files adapted from three.js under MIT |
| [Raikiri/RadianceCascadesPaper](https://github.com/Raikiri/RadianceCascadesPaper) | Radiance cascades paper repository | MIT, "Copyright 2024 Alexander Sannikov"; a CC-BY-ND image suggests the paper's own terms may differ (not verified) |
| [KhronosGroup/ToneMapping](https://github.com/KhronosGroup/ToneMapping) | PBR Neutral reference | Apache-2.0 |
| [ampas/aces-output](https://github.com/ampas/aces-output), [ampas/aces-dev](https://github.com/ampas/aces-dev) | ACES output-transform presets and core CTL | Academy (A.M.P.A.S.) ACES licence terms, royalty-free with conditions |
| [w3c/wcag](https://github.com/w3c/wcag) | Normative flash-threshold text | W3C Document License |
| [gpuweb/gpuweb](https://github.com/gpuweb/gpuweb) | WebGPU and WGSL spec sources | W3C Software and Document licence for documents; code contributions under "GPU for the Web 3-Clause BSD License" |
| [GPUOpen-LibrariesAndSDKs/GPUParticles11](https://github.com/GPUOpen-LibrariesAndSDKs/GPUParticles11) | DX11 GPU particle sample with collisions and sorting | MIT, "Copyright (c) 2016 Advanced Micro Devices" |
| [bevyengine/bevy](https://github.com/bevyengine/bevy) | WebGPU-capable engine: bloom, tonemappers, auto exposure | MIT and Apache-2.0 (both files present) |
| [djeedai/bevy_hanabi](https://github.com/djeedai/bevy_hanabi) | GPU particle system for Bevy | MIT, "Copyright (c) 2021 Jerome Humbert" (other licence files not checked) |
| [visgl/luma.gl](https://github.com/visgl/luma.gl) | WebGPU FFT convolution bloom and HDR canvas guide | MIT |
| [software-mansion/TypeGPU](https://github.com/software-mansion/TypeGPU) | `@typegpu/radiance-cascades` | MIT, "Copyright (c) 2025 Software Mansion" |
| [OmarShehata/webgpu-compute-rasterizer](https://github.com/OmarShehata/webgpu-compute-rasterizer) | WebGPU compute rasterizer tutorial | MIT |
| [electronicarts/IRIS](https://github.com/electronicarts/IRIS) | Photosensitivity analysis | BSD-3-Clause, "Copyright (c) 2023 Electronic Arts Inc." |
| [PWhiddy/webgpu-atomics-benchmark](https://github.com/PWhiddy/webgpu-atomics-benchmark) | WebGPU atomics measurements | MIT |
| [NVlabs/flip](https://github.com/NVlabs/flip) | Image-difference evaluator for render tests (README not read; from background knowledge it has an HDR mode) | BSD 3-Clause |
| [b0nes164/GPUPrefixSums](https://github.com/b0nes164/GPUPrefixSums) | Portable prefix sums including wgpu | MIT |
| [BabylonJS/Babylon.js](https://github.com/BabylonJS/Babylon.js) | WebGPU engine | Apache-2.0 |
| [playcanvas/engine](https://github.com/playcanvas/engine) | WebGPU engine | MIT text |
| [gfx-rs/wgpu](https://github.com/gfx-rs/wgpu) | WebGPU implementation (Rust) | MIT file present (Apache file not checked) |
| [linebender/vello](https://github.com/linebender/vello) | GPU compute 2D renderer; prefix-sum development | MIT file present (Apache file not checked) |
| [aki-null/CustomToneMappingURP](https://github.com/aki-null/CustomToneMappingURP) | GT7 tone mapping baked into a LUT (Unity) | MIT, "Copyright (c) 2025 Akihiro Noguchi" |

- **Licences not verified.** No LICENSE file was found at the usual raw paths, and the github.com HTML and API were refused for these:
  - sobotka/AgX and sobotka/SB2383-Configuration-Generation
  - [EaryChow/AgX](https://github.com/EaryChow/AgX)
  - [CodyJasonBennett/three-rc](https://github.com/CodyJasonBennett/three-rc)
  - FidelityFX SDK and SSSR
  - [jorgemagic/computestochasticreflections](https://github.com/jorgemagic/computestochasticreflections)
  - [Makio64/advanced-threejs-tsl-webgpu-rendering](https://github.com/Makio64/advanced-threejs-tsl-webgpu-rendering)
  - [MrLixm/AgXc](https://www.github.com/MrLixm/AgXc)
  - [unitycoder/AgX-Tonemapping-Unity](https://github.com/unitycoder/AgX-Tonemapping-Unity)
  - Solis 2D and arcane-engine
  - [m-schuetz/webgpu_pointcloud](https://github.com/m-schuetz/webgpu_pointcloud), whose README states no licence
  - Aras's single-file test page
  - Jason McGhee's gist
- **Descriptions and other resources** (search summary, not verified):
  - Bevy's bloom, tonemapping and exposure features — [Bevy docs](https://docs.rs/bevy/0.15.1/bevy/core_pipeline/bloom/struct.Bloom.html)
  - three.js manual post-processing — [three.js manual](https://threejs.org/manual/en/webgpu-postprocessing.html)
  - luma.gl's FFT bloom — [luma.gl](https://luma.gl/docs/api-reference/shadertools/shader-passes/bloom)
  - Gridwise — [Gridwise](https://gridwise-webgpu.github.io/gridwise/scan-and-reduce)
  - kiss3d WGSL bloom — [docs.rs](https://docs.rs/crate/kiss3d/0.45.1/source/src/builtin/hdr_bloom.wgsl)
  - WebSplatter — [arXiv](https://arxiv.org/html/2602.03207v1)
  - lisyarus Particle Life in WebGPU — [blog](https://lisyarus.github.io/blog/posts/particle-life-simulation-in-browser-using-webgpu.html)
  - AMD FidelityFX SSSR — [GPUOpen](https://gpuopen.com/manuals/fidelityfx_sdk/samples/stochastic-screen-space-reflections/)

### Inferences
- **Suggested learning path:**
  1. Start the fixed-point splat from Aras's test page (licence unknown, so learn from it rather than copy) and Shehata's MIT tutorial.
  2. Add tile binning following AMD's approach, with GPUPrefixSums or Gridwise for scans that are safe on WebGPU.
  3. Adapt Bevy's MIT/Apache bloom and exposure WGSL.
  4. Evaluate tone mappers using three.js TSL (MIT), Khronos PBR Neutral (Apache-2.0), the GT7 MIT sample, and ACES 2.0 LUTs baked offline under the Academy terms.
  5. Build 2D floor GI with TypeGPU (MIT).
  6. Gate releases on IRIS (BSD-3-Clause) and FLIP (BSD-3-Clause) in CI (section 10).
- **Licence diligence.** Apache-2.0 code (Khronos, Babylon.js) requires keeping NOTICE and licence text. The Academy ACES terms carry their own conditions, so read the full LICENSE.md before shipping LUTs derived from the CTL.

### Gaps
- The licences listed above as not verified remain open.
- The GT7 sample's MIT text was not read; it is reported by press only.
- No single open-source WebGPU project combining 10M+ additive particles, HDR output, radiance-cascade GI and a flash guard was found.

## 10. Building the renderer so frames can be captured offscreen for tests and video recording

### Takeaway
Treat the canvas as one optional sink. Every frame should be rendered into renderer-owned textures: a scene-linear `rgba16float` target and a display-encoded output target. The frame is then either copied or blitted to the canvas, or copied with `copyTextureToBuffer` into mappable staging buffers. Rows must be padded to multiples of 256 bytes, and frames should be pipelined through a ring of buffers.

Drive time from an injected deterministic clock rather than `requestAnimationFrame`. With fixed-point integer accumulation, captured frames become reproducible for golden-image tests (FLIP), flash regression (IRIS on rendered video), and offline video at any frame rate. In this environment, canvas presentation fails while offscreen `rgba16float` rendering with readback works, so offscreen capture is the only viable test path here.

### Cited Findings
- **Coordinator measurement in this research environment** (no URL; a first-party observation): presenting a WebGPU canvas fails both headless and headed under Xvfb, with "A valid external Instance reference no longer exists". Offscreen rendering to `rgba16float` with `copyTextureToBuffer` readback works.
- **three.js readback (primary source).** `WebGPUTextureUtils.copyTextureToBuffer()` does three things — [three.js WebGPUTextureUtils.js](https://github.com/mrdoob/three.js/blob/dev/src/renderers/webgpu/utils/WebGPUTextureUtils.js):
  - It computes `bytesPerRow = Math.ceil(unpaddedBytesPerRow / 256) * 256`, commented "copyTextureToBuffer() requires a multiple of 256".
  - It sizes the buffer as `height * bytesPerRow`, "so it also meets the 4-byte size alignment required by mapAsync()".
  - It awaits `readBuffer.mapAsync(GPUMapMode.READ)`, then de-pads each row using `row * bytesPerRow` offsets.
- **three.js HDR output selection (primary source):** `outputType` is the "Texture type for output to canvas", and `HalfFloatType` selects canvas `toneMapping` `'extended'` — [three.js WebGPUBackend.js](https://github.com/mrdoob/three.js/blob/dev/src/renderers/webgpu/WebGPUBackend.js)
- **WebGPU spec (primary source).** The canvas tone-mapping modes `"standard"` and `"extended"` define how presented values are projected to the screen's range — [WebGPU spec source](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs). The offscreen copy therefore holds the values the app wrote, before this compositor projection.
- **WGSL (primary source):** atomics are u32 or i32 only, in the storage or workgroup address spaces — [WGSL spec source](https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs). Integer addition is associative, which is the basis for reproducible accumulation.
- **IRIS** analyses a video file via its example app's `-v` option — [GitHub electronicarts/IRIS](https://github.com/electronicarts/IRIS). **NVIDIA FLIP** is BSD 3-Clause — [GitHub NVlabs/flip](https://github.com/NVlabs/flip). Its HDR-capable image-difference purpose is background knowledge; the README was not read.
- **The webgpu-samples particles sample** shows HDR output configuration with `rgba16float` and `toneMapping` (BSD 3-clause) — [webgpu-samples particles main.ts](https://github.com/webgpu/webgpu-samples/blob/main/sample/particles/main.ts)

### Inferences
- **Architecture.**
  1. **`FrameTarget` abstraction.** The renderer core never calls `getCurrentTexture()` itself. It receives a `FrameTarget` holding the output texture, size, colour encoding (SDR sRGB, extended linear, or PQ for capture) and a sink type (canvas or capture).
  2. **Final pass into an owned texture.** The output transform (tone map, grain, dither and flash-guard gain) always writes into an owned output texture. Give it `RENDER_ATTACHMENT` or `STORAGE_BINDING` usage, plus `COPY_SRC`.
  3. **Canvas sink.** A trivial blit, or `copyTextureToTexture` when formats match and the canvas is configured with copy usage (not verified this session), puts the frame on the canvas. The captured bits are then the presented bits, before compositor projection.
  4. **Capture sink.** Copy to a ring of 3 to 4 `MAP_READ` staging buffers, with bytes per row padded to 256 as three.js does. Submit, call `mapAsync` without awaiting on the frame path, and consume buffers in order as they resolve.
  5. **Backpressure.** In real-time capture, drop a frame and count it when all buffers are busy. In offline capture, block.
- **Deterministic time and state.**
  - Inject a clock: real-time (`performance.now`) for play, or fixed (frame index x 1/fps) for tests and recording.
  - Simulation substeps, RNG seeds (hashed from frame index and particle id), trail fade, eye adaptation and the flash guard all read dt from this clock, never from the wall clock.
  - Record input events with timestamps, so a recorded session can be replayed bit-for-bit into the offline recorder.
- **Reproducibility.**
  - u32 fixed-point splatting is order-independent, so it is bit-exact across runs regardless of thread scheduling.
  - Float simulation is deterministic on the same GPU, driver and browser build if it has no data races, but not across vendors.
  - So keep per-platform golden baselines with exact comparison where possible. Use tolerance comparisons (FLIP or PSNR) across platforms.
  - Also test invariants that hold on any GPU:
    - The sum of resolved pixel energy equals emitted energy within fixed-point tolerance.
    - Bloom in energy-conserving mode preserves total energy.
    - Tone mappers are monotonic.
    - The flash guard holds synthetic strobe inputs under the thresholds.
- **Readback cost.**
  - 4K `rgba16float` is 66.4 MB per frame, about 4.0 GB/s at 60 fps. 1440p is 29.5 MB per frame, about 7.1 GB/s at 240 fps.
  - For real-time recording, convert on the GPU first. Pack to `rgb10a2unorm` (4 B/px, PQ- or sRGB-encoded) to halve traffic, or convert to 10-bit YUV 4:2:0 in a compute pass (about 1.5 samples per pixel).
  - Offline recording at fixed dt avoids the problem entirely, and can render 240 fps or sub-frame motion blur on slow machines (section 2).
- **Video outputs.**
  - SDR deliverables: sRGB/BT.709, 8-bit.
  - HDR deliverables: PQ with BT.2020 primaries, 10-bit HEVC or AV1, with a fixed capture mapping (for example a 1000-nit peak and a fixed reference white). Treat the reference-white choice as a project decision; the BT.2408 value was not verified this session.
  - Archive: half-float EXR sequences of both the scene-linear and display-encoded buffers, for re-grading and debugging.
  - Encoding: ffmpeg, or WebCodecs where available. Encoder availability is out of scope.
- **Test harness.**
  - Run the same renderer core with the capture sink in headless environments where presentation fails, as here.
  - Golden-image tests per feature, using fixed scenes with seeded particles.
  - Flash regression: render scripted stress sequences offline to video, run IRIS, and fail CI on any flash or extended failure.
  - Performance smoke tests with timestamp queries, treated as indicative, since browsers can misreport.
- **Avoid canvas-based capture** (`toDataURL`, `drawImage` of a WebGPU canvas, or screen recording) as the primary path. It depends on presentation, which fails here, and on compositor colour handling.

### Gaps
- No source was retrieved on WebGPU readback throughput, `mapAsync` latency on desktop GPUs, or canvas texture `COPY_DST` usage.
- HDR video encoding support (WebCodecs or ffmpeg PQ metadata) and the BT.2408 reference white were not researched; they are partly out of scope.
- FLIP's README was not read, so its suitability is from background knowledge.
