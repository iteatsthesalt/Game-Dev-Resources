# Next-generation real-time GPU particle simulation in WebGPU/WGSL for Tactilume Desktop (1M to 100M+ particles), as of 2026-11-12

Source-access note for the report writer: only GitHub (github.com and raw.githubusercontent.com, read directly from repository source) and the web-search tool were reachable from this research session. Pages on lisyarus.github.io, gridwise-webgpu.github.io, linebender.org, wickedengine.net, tympanus.net (Codrops), developer.chrome.com, arxiv.org, escholarship.org, research.nvidia.com and similar hosts were blocked by the session's network policy, and the shared web-search budget ran out before the last planned searches.

Findings tagged "(search summary, not verified)" were seen only in a search-result summary and were not checked against the source, so treat them as less certain. Untagged findings were read from the source files themselves: repository READMEs, LICENSE files, example code, the WebGPU/WGSL spec sources, the Gridwise docs sources, Raph Levien's blog-post sources and gpuweb issue pages on GitHub. A second pass, made after the coordinator's network note, verified several items directly that were snippet-only in the first pass.

One extra data point came from the research coordinator rather than a published source: a local SwiftShader (CPU software) measurement, which is not GPU performance data (see Q1).

Fact-check pass (12 November 2026): decision-critical claims were re-checked against primary sources read through raw.githubusercontent.com, including Chromium release tags for Electron 45 (156.0.8078.96) and 157.0.8103.81. Tags: [Verified: URL] means confirmed, [Verified correction: URL] means the sentence was changed, and [Unverified] means it could not be checked. The Verification section at the end lists the results. The first pass was interrupted; a second pass on the same day kept its tags, checked the remaining decision-critical claims (Linux availability, Safari's beta status, the shipped WGSL subgroup extensions, the atomic-vec2u-min-max flags, Gridwise on SwiftShader), added the container measurements and wrote the Verification section.

## 1. Scale: memory layout (SoA vs AoS, f16/unorm packing), per-particle update cost, and what 10M to 100M particles at 60 to 240 fps requires

### Takeaway
Simple per-particle updates (forces from a few poles, analytic flow fields) are bound by memory bandwidth. The best measured WebGPU figure found is about 10M particles at about 63 fps on a 2016 GTX 1060, including rendering. So 10M particles at 120 to 240 fps on current desktop GPUs is realistic once bytes per particle are cut. 100M particles is mainly a bandwidth and buffer-limit problem: it needs about 16 bytes per particle or less, arrays split under per-binding size limits, 2D dispatch, and no neighbour search across the full set.

### Cited Findings
- TU Wien bachelor thesis "Particle System in WebGPU" (Benedikt Peter, February 2023): using compute shaders, ten million particles are simulated and rendered at about 63 fps on a GTX 1060, drawn as textured quads. Vertex pulling performed notably better than instancing on recent high-end GPUs (rendering detail, out of scope) — [TU Wien PETER-2023-PSW](https://www.cg.tuwien.ac.at/research/publications/2023/PETER-2023-PSW/) (search summary, not verified) [Unverified: host blocked, no GitHub copy found]
- three.js `webgpu_compute_particles` (current master): 200,000 particles, with positions, velocities and colours as three separate `instancedArray(particleCount, 'vec3')` storage buffers. That is a structure-of-arrays (SoA) layout. The example also has a separate "Hit Particles" compute kernel over all particles, dispatched apart from the per-frame update — [three.js example source](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_compute_particles.html)
- three.js `webgpu_tsl_compute_attractors_particles`: count = 2^18 = 262,144 particles, with separate position and velocity buffers (SoA) — [three.js example source](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_tsl_compute_attractors_particles.html)
- three.js `webgpu_compute_points`: 300,000 2D particles with `vec2` position and `vec2` velocity buffers (SoA, 8 B per attribute) — [three.js example source](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_compute_points.html)
- three.js `webgpu_compute_particles_snow`: 100,000 particles. It uses separate position, scale and static-position buffers (`vec3`) and a data buffer (`vec4`), plus a 1024 × 1024 render target (`collisionPosRT`) for scene collision — [three.js example source](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_compute_particles_snow.html)
- Measured copy-kernel bandwidth through Dawn (Gridwise OneSweep probe at 2^24 keys, run in Node): Apple M1 Max 360–370 GB/s; NVIDIA V100 808 GB/s — [Gridwise docs/sort.md](https://github.com/gridwise-webgpu/gridwise/blob/main/docs/sort.md) [Verified: https://github.com/gridwise-webgpu/gridwise/blob/HEAD/docs/sort.md] The M1 Max figure is about 90% of its 400 GB/s rated bandwidth (see gpu_light_rendering.md section 1).
- Levien measured these prefix-sum rates:
  - GTX 1080, decoupled look-back prototype on Vulkan: 2.05 ms for 64Mi u32 values, or 31.2 billion elements/s — [Levien 2020 post source](https://github.com/raphlinus/raphlinus.github.io/blob/main/_posts/2020-04-21-prefix-sum.md) [Verified: same file]
  - AMD 5700 XT, Vulkan "compatibility mode" scan: about 48 billion elements/s, "basically the same as memcpy" — [Levien 2021 post source](https://github.com/raphlinus/raphlinus.github.io/blob/main/_posts/2021-11-04-prefix-sum-portable.md)
- **Software-renderer data point (not GPU data):** the research coordinator measured a 32-byte-per-particle compute step plus a 1-pixel additive point draw in headless Chromium 153.0.8010.12 (Playwright 1.63.0) on Linux, on a SwiftShader fallback adapter (`isFallbackAdapter` true) in a 4-core container, launched with only `--enable-unsafe-webgpu`. It took about 22 ms for 20k particles and about 131 ms for 300k. Source: coordinator's local measurement of 2026-11-12, not published. [Verified: coordinator measurement (no URL); this container reports 4 CPU cores via `nproc`] It only shows that the pipeline runs on a CPU implementation. Gridwise warns that spin-wait-based code (such as emulated subgroups) can stall on CPU-based WebGPU implementations — [Gridwise docs/scan-and-reduce.md](https://github.com/gridwise-webgpu/gridwise/blob/main/docs/scan-and-reduce.md) [Verified: Gridwise's subgroup-strategy page names SwiftShader CI runners as the case, https://github.com/gridwise-webgpu/gridwise/blob/HEAD/docs/subgroup-strategy.md]
- three.js `webgpu_compute_particles_fluid` (MLS-MPM) instead packs particles into one struct array (array of structures, AoS): `particleArray = new Float32Array(maxParticles * particleStructSize)` — [three.js example source](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_compute_particles_fluid.html)
- webgpu-samples "particles": 50,000 particles in one interleaved buffer whose per-particle struct includes a lifetime field — [webgpu-samples particles main.ts](https://github.com/webgpu/webgpu-samples/blob/main/sample/particles/main.ts)
- Babylon.js `GPUParticleSystem` uses a capacity of 1,000,000 as its documented example. `activeParticleCount` can limit GPU work below capacity, and the random-number texture defaults to the largest supported size (16K) — [Babylon.js docs source](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/particles/particle_system/gpu_particles.md). The docs page still describes only the WebGL2 transform-feedback path (since v3.2). The current source picks a `ComputeShaderParticleSystem` platform, a WGSL compute shader named `gpuUpdateParticles`, whenever the engine reports `supportComputeShaders` (WebGPU), and falls back to `WebGL2ParticleSystem` otherwise. `IsSupported` is `supportTransformFeedbacks || supportComputeShaders` — [gpuParticleSystem.pure.ts](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Particles/gpuParticleSystem.pure.ts); [computeShaderParticleSystem.pure.ts](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Particles/computeShaderParticleSystem.pure.ts) [Verified: https://github.com/BabylonJS/Babylon.js/blob/HEAD/packages/dev/core/src/Particles/gpuParticleSystem.pure.ts]
- Unity says VFX Graph can process millions of simultaneous particles, against thousands for the legacy Particle System — [Unity Learn](https://learn.unity.com/course/creative-core-vfx/tutorial/experiment-with-vfx-graph?version=6.0) (search summary, not verified). A third-party guide gives roughly 1M to 5M as a practical range on high-end PCs; this is unverified — [uhiyama-lab](https://uhiyama-lab.com/en/notes/unity/unity-vfx-graph-guide/) (search summary, not verified)
- Anecdotal browser figures (fluid simulation, not simple particles): about 36 fps at about 1.13M particles on an RTX 3080 Ti in Chrome on Windows. An M1 Max user estimated about 15 fps at 1M "by feel". Both come from comments on the Splash MLS-MPM thread — [Reddit r/GraphicsProgramming (mirror)](https://redlib.hackliberty.org/r/GraphicsProgramming/comments/1jh3pd2/splash_a_realtime_fluid_simulation_in_browsers/mjfn4ij/?context=3) (search summary, not verified)
- Splash's `million` branch has a "very large" mode of 1.6M particles, which the author says is "very close to the memory limit of the buffer size" — [Splash README](https://github.com/matsuoka-601/Splash)
- "How to simulate 30 million microbes in the browser" (HackerNoon) uses an 8192 × 4096 grid (about 33M positions). A single 32-bit value per position already takes about 128 MiB. Several compute passes remove dependence on the unpredictable execution order of parallel invocations, at the cost of temporary memory — [HackerNoon](https://hackernoon.com/how-to-simulate-30-million-microbes-in-the-browser) (search summary, not verified)
- WebGPU spec default limits (editor's draft source):
  - maxStorageBufferBindingSize: 134,217,728 bytes (128 MiB)
  - maxBufferSize: 268,435,456 bytes (256 MiB)
  - maxComputeWorkgroupsPerDimension: 65,535
  - maxComputeInvocationsPerWorkgroup: 256 (the table's second column, the compatibility-mode default, lists 128)
  - maxComputeWorkgroupStorageSize: 16,384 bytes
  - maxStorageBuffersPerShaderStage: 8

  [WebGPU spec source (gpuweb/gpuweb spec/index.bs)](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs) [Verified: same file]
- Spec defaults are guaranteed minimums. Adapters can expose more, but higher limits must be requested explicitly at device creation — [MDN GPUSupportedLimits](https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedLimits) (search summary, not verified) [Verified: the spec's `requiredLimits` rules, https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs]. web3dsurvey reports that 92% of surveyed Windows systems, and 100% of NVIDIA ones, expose maxStorageBufferBindingSize ≥ 2,147,483,644 bytes (about 2 GiB) — [web3dsurvey](https://web3dsurvey.com/webgpu/limits/maxStorageBufferBindingSize/platform/Windows) (search summary, not verified) [Unverified: survey host blocked] This fits Dawn's source: D3D12 has no documented limit, so Dawn assumes 2 GiB and Chrome's tiers report exactly 2,147,483,644 bytes on every Windows adapter except pre-Adreno 8xx Qualcomm chips (2^28). No Windows adapter can report 4 GiB−4. [Verified: https://github.com/google/dawn/blob/main/src/dawn/common/Constants.h; https://github.com/google/dawn/blob/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp; https://github.com/google/dawn/blob/main/src/dawn/native/Limits.cpp]
- With default limits, one buffer holds at most 67,108,864 u32 elements (maxBufferSize) and one storage binding at most 33,554,432 (maxStorageBufferBindingSize) — [webgpu-radix-sort README](https://github.com/kishimisu/WebGPU-Radix-Sort)
- Core WGSL, with no optional feature, provides packing built-ins: `pack4x8unorm`, `pack4x8snorm`, `pack2x16unorm`, `pack2x16snorm`, `pack2x16float` and their unpack counterparts, such as `unpack2x16float` — [WGSL spec source (gpuweb/gpuweb wgsl/index.bs)](https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs)
- f16 arithmetic needs the optional `"shader-f16"` device feature plus `enable f16;` in WGSL. Chrome's guidance for ML tensors: f16 halves the memory, and because GPU work is often bandwidth-bound this "can often mean shaders run twice as fast". Data can also be stored in low precision and expanded to f32 in the shader without f16 support. The intent-to-ship cited up to 25% gains for ALU-bound work and 50% for memory-bound work — [Chrome "New in WebGPU 120"](https://developer.chrome.com/blog/new-in-webgpu-120) (search summary, not verified); [Intel: Revving up WebGPU applications with f16](https://intel.com/content/www/us/en/developer/articles/community/revving-up-webgpu-applications-with-power-of-f16.html) (search summary, not verified) [Verified (version only): BCD gives `shader-f16` in Chrome 120 and Safari 26, not Firefox, https://github.com/mdn/browser-compat-data/blob/main/api/GPUSupportedFeatures.json; the speed-up figures remain Unverified]
- Measured throughput of a bandwidth-heavy WebGPU primitive, the wgpu_sort key-value radix sort:

  | GPU | 1M pairs | 8M pairs | 20M pairs |
  |---|---|---|---|
  | RTX A5000 | 0.317 ms | 1.64 ms | 3.98 ms |
  | AMD R9 380 | 2.76 ms | 18.8 ms | 46.1 ms |
  | Intel HD 4600 | 38.7 ms | 295 ms | 732 ms |

  [wgpu_sort README](https://github.com/KeKsBoTer/wgpu_sort) [Verified correction: https://github.com/KeKsBoTer/wgpu_sort/blob/HEAD/README.md (the Intel 20M cell was missing; the figures are averages of 1,000 runs in native wgpu, not a browser)]
- Tutorial sites claim 60 fps at 1M to 2M particles without showing benchmark data. Treat them as unreliable — [markaicode](https://www.markaicode.com/webgpu-physics-simulation-1m-particles/) (search summary, not verified)

### Inferences
- **Derived per-particle cost:**
  - The thesis figure (10M at 63 fps on a GTX 1060, simulation plus rendering in about 15.9 ms) is at most about 1.6 ns per particle per frame on a 2016 mid-range GPU.
  - The wgpu_sort figure (20M pairs in 3.98 ms on an RTX A5000) is about 0.2 ns per element for a whole multi-pass sort.
  - A simple field-driven update on a current high-end GPU should therefore cost well under 1 ns per particle.
- **Bandwidth budget:** bytes moved per frame ≈ N × (bytes read + bytes written) × substeps. Today's 32 B layout moves 64 B per particle per step (one read, one write).
  - 10M: 0.64 GB per step, about 38 GB/s at 60 fps and about 154 GB/s at 240 fps. Comfortable on any discrete GPU.
  - 100M at 32 B: 6.4 GB per step, about 384 GB/s at 60 fps and about 1.5 TB/s at 240 fps. 240 fps is beyond any single consumer GPU.
  - 100M at 16 B (32 B moved per step): about 192 GB/s at 60 fps and about 768 GB/s at 240 fps. 60 fps is plausible on upper-mid and high-end GPUs; 240 fps only on the very top end, or with fewer substeps.
  - Measured Dawn copy bandwidth gives a floor for one in-place 100M × 16 B step (3.2 GB moved):
    - Apple M1 Max (about 365 GB/s): at least about 8.8 ms, so at most about 114 steps/s.
    - NVIDIA V100 (808 GB/s): at least about 4 ms, so at most about 250 steps/s.
  - Read-only passes add to this: binning, field sampling, and any extra substeps.
  - Current consumer GPU bandwidths should still be checked (see Gaps).
- **Suggested state packing, about 16 B per particle for the 100M tier:**
  - Position: 3 × 21-bit fixed point in 2 × u32 (8 B), relative to the world box, giving about 1/2,000,000 of the box per axis. Keep 3 × f32 (12 B) for the interactive tier.
  - Velocity: 3 × f16 via `pack2x16float` (6 B), plus a 16-bit slot for age, species and behaviour bits (8 B total).
  - Colour: derive at render time from species, speed and age instead of storing it (0 B), or use `pack4x8unorm` (4 B) only when a particle truly needs its own colour.
  - Size check: 100M × 16 B = 1.6 GB per copy, which fits a single about 2 GiB binding on most Windows/NVIDIA adapters. 100M × 32 B = 3.2 GB does not. On Windows the limits are exact: every D3D12 adapter reports a 2 GiB `maxBufferSize` and a 2,147,483,644-byte binding, so 1.6 GB fits but no single array above 2 GiB does; 4 GiB−4 bindings exist only on Metal and non-NVIDIA Vulkan. [Verified: https://github.com/google/dawn/blob/main/src/dawn/common/Constants.h; https://github.com/google/dawn/blob/main/src/dawn/native/Limits.cpp]
- **SoA vs AoS:**
  - SoA, as the three.js examples use it, lets partial passes (cell binning, hashing, grid splats) read only positions (8 to 12 B) instead of the whole struct. Each array also stays under the per-binding size limit.
  - The cost: each array uses one of the 8 default storage-buffer slots per shader stage.
  - AoS with 16-byte aligned structs gives single vec4 loads in an update kernel that reads everything.
  - Recommended: a hot/cold SoA split. Hot is position plus packed velocity, read every step. Cold is attributes read only by emitters or the renderer.
- **Dispatch limits:** 100M particles / 256 threads per workgroup = 390,625 workgroups, more than the 65,535 per-dimension limit. Use a 2D dispatch (for example 65,535 × 6) with a flat index computed in the shader, or a grid-stride loop where each thread updates several particles.
- **In-place updates:** independent per-particle updates (no neighbour reads) can read and write their own element in place. That halves memory at 100M; only the neighbour-reading tier needs ping-pong buffers.
- **Two-tier architecture, recommended:**
  - An "interactive" tier of about 0.5M to 4M particles with neighbour-based behaviours (Particle Life, boids, SPH/PBF-like separation, MLS-MPM liquid).
  - An "ambient" tier of 10M to 100M tracers moved only by fields: ABC flow, curl noise, a splatted touch-force grid, a fluid velocity grid, SDF and strange attractors. These cost O(1) per particle.
  - The existing 12 crossfaded behaviours map onto the ambient tier as weighted sums of force terms. Uniform branches skip terms whose weight is 0, which causes no divergence because the branch is the same for all threads.

### Gaps
- No primary WebGPU benchmark at 100M particles was found. The largest measured WebGPU figure found is the thesis's 10M at about 63 fps on a GTX 1060, read only as a search summary because the thesis host was blocked.
- Only two measured WebGPU (Dawn) copy bandwidths were found: Apple M1 Max at 360–370 GB/s and NVIDIA V100 at 808 GB/s, both from the Gridwise docs. Bandwidths for current consumer desktop GPUs (GeForce RTX 40/50, Radeon RX 7000/9000, Intel Arc, Apple M3/M4) could not be retrieved before the search budget ran out. gpu_light_rendering.md has rated figures: RTX 4090 1,008 GB/s and M1 Max 400 GB/s [Verified: https://github.com/PWhiddy/webgpu-atomics-benchmark/blob/HEAD/README.md], and RTX 5090 1,792, RTX 5070 672 and RX 9070 XT about 640 GB/s [Unverified: search summaries]. The bandwidth arithmetic above needs checking against vendor spec sheets or a copy-kernel probe on the target GPUs.
- The coordinator's SwiftShader timings (about 22 ms for 20k and about 131 ms for 300k particles) are CPU-software numbers. They say nothing about GPU cost.
- No measured WebGPU comparison of SoA vs AoS, or of f16-packed vs f32 particle state, was found.
- Practical limits for Unreal Niagara GPU particles were not researched.

## 2. Interaction-rich simulations and their costs in WebGPU

### Takeaway
Methods that read neighbours (SPH/PBF, boids, Particle Life) top out at roughly 10^4 to 10^6 particles in browser WebGPU, even with binning by counting sort plus prefix sum. Grid-transfer methods avoid neighbour lists by scattering with fixed-point integer atomics: MLS-MPM, splatted force grids, stable fluids, reaction-diffusion. Measured MLS-MPM figures run from about 100k particles on iGPUs to 300k to 400k on mid-range GPUs, and an experimental branch reaches 1.6M. Field-only behaviours (curl noise, ABC flow, SDF and strange attractors, grid sampling) cost O(1) per particle and are the only kind that scales to 10M to 100M.

### Cited Findings

**Neighbour search (binning, counting sort, prefix sums)**
- Hoetzlein (GTC 2014), "Fast Fixed-Radius Nearest Neighbors: Interactive Million-Particle Fluids":
  - Bins space into a uniform grid and uses a counting sort ("1-radix" sort) instead of a full radix sort, because order inside a bin does not matter.
  - Needs fewer kernel launches (5 per frame for Fluids v.3).
  - Reports 8 million points at 400 million queries/s on a GeForce GTX Titan, and a 4,194,304-particle ocean at 4.2 fps.
  - [Hoetzlein slides (PDF)](https://ramakarl.com/pdfs/2014_Hoetzlein_FastFixedRadius_Neighbors.pdf) (search summary, not verified)
- The classic pattern sorts particles by cell index, then finds where each bucket starts in the sorted list — [Simon Green, NVIDIA GDC 2008 "Particle Fluids"](https://developer.download.nvidia.com/presentations/2008/GDC/GDC08_ParticleFluids.pdf) (search summary, not verified). NVIDIA's CUDA particles sample sorts by hash with a radix sort — [NVIDIA CUDA particles doc](https://developer.download.nvidia.com/compute/cuda/1.1-Beta/x86_website/projects/particles/doc/particles.pdf) (search summary, not verified)
- WebGPU-Ocean (matsuoka-601, MIT):
  - Its optional SPH mode uses Hoetzlein's method for neighbour search.
  - Because neighbour search is expensive, SPH maxed out at about 30,000 particles on integrated graphics.
  - MLS-MPM, which needs no neighbour search, raised that to about 100,000 on integrated graphics and about 300,000 on "decent GPUs".
  - SPH mode is a known crash on Mac.
  - [WebGPU-Ocean README](https://github.com/matsuoka-601/webgpu-ocean) [Verified: https://github.com/matsuoka-601/webgpu-ocean/blob/HEAD/README.md]
- blub (Andreas Reich, MIT), a GPU-driven 3D hybrid Lagrangian/Eulerian fluid using wgpu (PIC/FLIP/APIC; implements APIC) — [Wumpf/blub README](https://github.com/wumpf/blub):
  - Particle-to-grid is "tricky & costly to do in parallel". The options are 8 atomic adds per particle, or a gather in which particles form per-cell linked lists via atomic exchange into a "linked list head pointer grid" and each grid cell walks 8 neighbouring lists.
  - Particles drift apart in memory over time, which slows sampling, so every n steps they are re-binned to cells.
  - "Strict sorting is not necessary": the re-binning counts particles per cell and prefix-sums the counts.
  - It uses a staggered grid and an Incomplete Poisson preconditioner for the pressure solve.
- On lisyarus's WebGPU Particle Life, a commenter proposed atomic linked lists per cell instead of prefix-sum binning. Another commenter expected linked lists to be slower because of poorer memory coherence — [Reddit thread (mirror)](https://redlib.hbubli.cc/r/GraphicsProgramming/comments/1kr3u9i/i_made_an_inbrowser_particle_life_simulation_with) (search summary, not verified)
- Sebastian Lague's "Coding Adventure: Simulating Fluids" covers spatial grids for neighbour lookups and a parallel GPU sort — [transcript summary](https://rosetta.to/u/sebastianlague/coding-adventure-simulating-fluids) (search summary, not verified). His Fluid-Sim repo targets Unity 2022.3 and is MIT-licensed. It cites Müller et al. 2003 SPH, Clavet et al. 2005 viscoelastic fluids, the SPH tutorial and NVIDIA's CUDA particles document — [SebLague/Fluid-Sim](https://github.com/SebLague/Fluid-Sim)
- WebGPU Unleashed has a WebGPU prefix-sum tutorial — [WebGPU Unleashed: Prefix Sum](https://shi-yan.github.io/webgpuunleashed/Compute/prefix_sum.html) (search summary, not verified)

**MLS-MPM / PB-MPM (grid transfer instead of neighbour lists)**
- WebGPU-Ocean details:
  - Particle-to-grid (P2G) uses `atomicAdd`. Because WGSL atomics exist only for 32-bit integers, values are stored as fixed point and decoded by multiplying by a constant such as 1e-7. The technique comes from EA's pbmpm.
  - Recomputing volume every step allows a larger timestep.
  - It needs 2 simulation steps per frame, and the timestep is "a bit too large", so the simulation occasionally explodes.
  - [WebGPU-Ocean README](https://github.com/matsuoka-601/webgpu-ocean)
- Splash (same author, MIT):
  - Needs only 1 simulation step per frame. Pressure uses the Tait equation with γ = 1 instead of 5, which is more stable, and stiffness k is raised a lot to compensate for lower incompressibility.
  - An extra P2G pass builds a density grid. The author says its overhead is "not that much" because only one float is scattered per particle.
  - The `million` branch reaches 1.6M particles.
  - [Splash README](https://github.com/matsuoka-601/Splash) [Verified: https://github.com/matsuoka-601/Splash/blob/HEAD/README.md]
- three.js `webgpu_compute_particles_fluid` ("MLS-MPM particle simulation running in compute shaders"):
  - Five kernels: clearGrid, p2g1, p2g2, updateGrid, g2p.
  - 64³ grid with `fixedPointMultiplier = 1e7`. Cell structs hold atomic i32 x, y, z and mass; the code comments that "webgpu only supports int atomics".
  - Up to 131,072 particles (8192 × 16); the default is 32,768.
  - [three.js example source](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_compute_particles_fluid.html) [Verified: grid, multiplier, comment and maximum read from the same file]
- EA SEED PB-MPM ("A Position Based Material Point Method", Chris Lewin, SIGGRAPH 2024) has a WebGPU reference implementation under BSD-3-Clause. The main branch is heavily optimized; the `siggraph2024` branch is more readable. The README says Firefox did not work at the time of writing — [electronicarts/pbmpm](https://github.com/electronicarts/pbmpm)
- holtsetio "Flow" is MLS-MPM on the three.js WebGPURenderer, started from WebGPU-Ocean and styled after Refik Anadol's artworks. It is MIT-licensed — [holtsetio/flow](https://github.com/holtsetio/flow). The author notes that TSL is young, bugs are common, and hand-written WGSL/GLSL will likely outperform it — [three.js forum](https://discourse.threejs.org/t/mls-mpm-simulation-with-webgpu-and-threejs/77686) (search summary, not verified)
- matsuoka-601's Codrops write-up: about 100,000 particles in real time on an iGPU, and about 400,000 on an RTX 3060 mobile laptop GPU — [Codrops article](https://tympanus.net/codrops/2025/02/26/webgpu-fluid-simulations-high-performance-real-time-rendering/) (search summary, not verified); [Codrops author page](https://tympanus.net/codrops/author/matsuoka_601) (search summary, not verified)
- Algorithm references linked from WebGPU-Ocean: Hu et al. 2018 MLS-MPM — [paper](https://yzhu.io/publication/mpmmls2018siggraph/paper.pdf); nialltl's MPM guide — [guide](https://nialltl.neocities.org/articles/mpm_guide); Müller et al. 2003 SPH — [paper](https://matthias-research.github.io/pages/publications/sca03.pdf). Sources: [WebGPU-Ocean README](https://github.com/matsuoka-601/webgpu-ocean), [WaterBall README](https://github.com/matsuoka-601/WaterBall)

**Boids / flocking**
- webgpu-samples `computeBoids` has 1,500 particles at workgroup size 64. The update shader loops over every particle (`for (var i = 0u; i < arrayLength(&particlesA.particles); i++)`), which is O(N²). Simulation parameters (deltaT 0.04, three rule distances and scales) are passed as uniforms — [main.ts](https://github.com/webgpu/webgpu-samples/blob/main/sample/computeBoids/main.ts); [updateSprites.wgsl](https://github.com/webgpu/webgpu-samples/blob/main/sample/computeBoids/updateSprites.wgsl)
- three.js `webgpu_compute_birds` has 8,192 birds with an all-pairs `Loop` over every bird — [three.js example source](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_compute_birds.html)
- three.js `webgpu_tsl_vfx_linkedparticles` has 2^13 = 8,192 particles. Each particle loops over all others to find its two closest live neighbours for link quads, which is brute-force O(N²) — [three.js example source](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_tsl_vfx_linkedparticles.html)

**Particle Life (multi-species attraction matrices)**
- lisyarus published an in-browser WebGPU Particle Life write-up, but it could not be read here — [lisyarus blog](https://lisyarus.github.io/blog/posts/particle-life-simulation-in-browser-using-webgpu.html)
- hzy/ParticleLife (WebGPU compute, MIT): 8,000 particles of 6 types in toroidal space. At close range particles always repel; at medium range they attract or repel by the matrix; at far range they ignore each other — [hzy/ParticleLife](https://github.com/hzy/ParticleLife)
- A 2024 write-up, "Optimizing the particle life — from 400 to 4 million particles", goes from Python to JavaScript to WebGPU — [Bill Mill link blog](https://notes.billmill.org/link_blog/2024/03/Optimizing_the_particle_life_-_from_400_to_4_million_particles.html) (search summary, not verified; only the description was available)

**Vortex particle methods**
- Meldgaard, Darkner and Erleben (Graphics Interface 2022) present a purely vortex-particle fluid model for games, with real-time collisions against moving characters. The game simulation runs at about 250 fps on an RTX 2080 Max-Q laptop GPU — [GI 2022 paper](https://graphicsinterface.org/proceedings/gi2022/gi2022-10) (search summary, not verified)
- Remeshed vortex particle methods have run on GPUs, using particle-grid operations and an FFT Poisson solver — [Rossinelli & Koumoutsakos, The Visual Computer 2008](https://doi.org/10.1007/s00371-008-0250-z) (search summary, not verified). VorteGrid is a vorton-based simulation for games with a 30 fps or faster target — [CedricGuillemet/VorteGrid](https://github.com/CedricGuillemet/VorteGrid) (search summary, not verified)

**Grid-based stable fluids with advected particles (hybrid Eulerian-Lagrangian)**
- rreusser's WebGPU Stable Fluids notebook uses semi-Lagrangian advection and FFT-based pressure projection on a collocated, cell-centred grid — [notebook](https://rreusser.github.io/notebooks/stable-fluids) (search summary, not verified)
- Other WebGPU grid-fluid code:
  - isjackwild's stable-fluids-in-webgpu (2023) — [repo](https://github.com/isjackwild/stable-fluids-in-webgpu) (search summary, not verified)
  - kishimisu's WebGPU-Fluid-Simulation, which uses compute shaders instead of fragment shaders — [ecosyste.ms entry](https://awesome.ecosyste.ms/projects/github.com%2Fkishimisu%2FWebGPU-Fluid-Simulation) (search summary, not verified)
  - pngine's 96×96 example, whose compute shader back-traces velocity and dye each frame — [pngine fluid sample](https://hugodaniel.com/pages/pngine/docs/samples/fluid-simulation/) (search summary, not verified)
  - roquefort, a 3D WebGPU fluid with a multigrid solver for high grid resolutions — [link to bercon.github.io/roquefort](https://frontendfoc.us/link/163294/web) (search summary, not verified)
- Pavel Dobryakov's widely used WebGL fluid with touch splats (MIT) cites GPU Gems chapter 38, "Fast Fluid Dynamics Simulation on the GPU" — [PavelDoGreat/WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation); [GPU Gems ch. 38](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu)

**Reaction-diffusion**
- Codrops published "Reaction-Diffusion Compute Shader in WebGPU"; only the title was available — [Codrops](https://tympanus.net/codrops/?p=77056) (search summary, not verified)

**3D curl noise and divergence-free fields**
- Bridson, Hourihan and Nordenstam, "Curl-Noise for Procedural Fluid Flow" (SIGGRAPH 2007): the curl of a smooth noise potential is automatically divergence-free. That avoids the sinks where particles bunch up in plain random velocity fields, and the paper also handles boundaries and amplitude modulation — [paper PDF](https://www.dneg.com/wp-content/uploads/2022/11/2007.pdf) (search summary, not verified); [SIGGRAPH history archive](https://history.siggraph.org/?p=115355) (search summary, not verified)
- GPU particle implementations exist — [kbladin/Curl_Noise](https://github.com/kbladin/Curl_Noise) (search summary, not verified). Storing the noise in a 3D RGB texture is suggested for GPU particles — [prideout blog](https://prideout.net/blog/old/blog/index.html@p=63.html) (search summary, not verified)

**Attractors (gravity-like, images and shapes)**
- three.js attractors example — [three.js example source](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_tsl_compute_attractors_particles.html):
  - 262,144 particles and 3 attractors.
  - Gravity strength is mass × mass × G / distance², plus a "spinning force" along each attractor's rotation axis.
  - Speed is clamped to `maxSpeed` (8), velocity is damped (0.1), and positions wrap into bounds with `mod`.
- webgpu-samples "particles" spawns particles from an image with a probability map built as a mip pyramid. Mip 0 holds colour plus spawn probability in alpha; mips 1 to N accumulate probabilities up to 1×1 — [webgpu-samples particles main.ts](https://github.com/webgpu/webgpu-samples/blob/main/sample/particles/main.ts)

**Gravity-like N-body (tree or grid)**
- GraphWaGu (WebGPU graph visualisation) runs Barnes-Hut in compute shaders without recursion or pointers, at interactive rates up to 100,000 nodes and 2,000,000 edges — [GraphWaGu paper (PDF)](https://par.nsf.gov//servlets/purl/10384648) (search summary, not verified)
- CUDA Barnes-Hut reference figures (not WebGPU), lechebs/nbody on an RTX 500 Ada laptop GPU. Its bibliography cites Karras 2012 on parallel octree construction — [lechebs/nbody](https://github.com/lechebs/nbody):
  - 524,288 particles: about 37 fps (θ = 0.75)
  - 2,097,152 particles: about 150 ms per step (θ = 0.6)
  - 4,194,304 particles: about 430 ms per step (θ = 0.6)
- Burtscher and Pingali's CUDA Barnes-Hut takes about 5.2 s per step for 5M bodies on a 2009 Quadro FX 5800 — [GPU Computing Gems ch. 6](https://www.oreilly.com/library/view/gpu-computing-gems/9780123849885/B9780123849885000061.xhtml) (search summary, not verified)
- jrprice/NBody-WebGPU, by a Dawn developer, is a simple WebGPU N-body simulation; the README gives no figures — [jrprice/NBody-WebGPU](https://github.com/jrprice/NBody-WebGPU)

### Inferences
- **Cost model per simulation step:**
  - Neighbour methods: about N × average neighbour count × bytes read per neighbour, plus 4 to 5 binning passes over N (count, scan over cells, scatter, optional reorder of particle data).
  - Grid transfer: about N × 27 (3D quadratic B-spline) or N × 9 (2D) atomic adds and loads, plus a fixed grid update.
  - Field-only: about N × (a few texture samples or some ALU work).
- **Recommended behaviour tiers for Tactilume Desktop:**

  | Tier | Particle count | Behaviours |
  |---|---|---|
  | Ambient | 10M to 100M tracers | ABC flow; curl noise precomputed into an animated 3D texture; splatted touch-force grid; fluid velocity grid; SDF attractors; strange attractors |
  | Interactive | 0.5M to 4M, binned | Particle Life species matrix; boids; SPH/PBF-like separation |
  | Liquid | 0.1M to 1.6M | MLS-MPM, following the WebGPU-Ocean, Splash and three.js pattern |

- **Flocking without neighbour lists:**
  - Splat velocity and count into a coarse grid with the same fixed-point P2G code as MLS-MPM.
  - Each agent then steers toward the grid's local average velocity (alignment) and along its density gradient (cohesion or separation).
  - This costs O(N) and reuses the MLS-MPM code path. Exact neighbour rules stay for the interactive tier only.
- **Particle Life:**
  - Keep the species × species matrix (16 × 16 f32 = 1 KB) and the radii in a uniform buffer, or cache them in workgroup memory.
  - Set the interaction radius r_max to the cell size, so each particle reads 9 cells in 2D or 27 in 3D.
  - Reorder particle data by cell each frame with the counting-sort scatter, so neighbour loads stay coherent. The Reddit comment above points the same way.
- **Hybrid Eulerian-Lagrangian:**
  - A 2D 512² or 3D 128³ velocity grid fed by touch splats (GPU Gems ch. 38 style) costs the same each frame regardless of particle count.
  - Each particle does one bilinear or trilinear sample, so 100M particles can respond to fluid-like touches.
  - Semi-Lagrangian grid advection is unconditionally stable; the particle integration still needs a CFL-style limit (see Q6).
- **Gravity-like N-body at 10M+:**
  - Prefer a particle-mesh approach: splat mass into a grid with fixed-point atomics, solve the Poisson equation with FFT or multigrid (both appear in WebGPU fluid code above), and sample the gradient.
  - A handful of explicit attractor bodies, as in the three.js example, is cheaper still.
  - The CUDA Barnes-Hut figures (about 0.5M particles at about 37 fps on a laptop GPU, about 150 ms per step at 2M) suggest a tree code will not reach 10M+ in real time. Building the tree in WGSL would also need Morton codes plus a radix sort.
- **Vortex particles:**
  - A small set of vortons (10^3 to 10^4) can induce a velocity field, through a grid splat plus Poisson solve or direct Biot-Savart on a coarse grid. That field can advect millions of tracers.
  - This suits the "currents" and "weaving" behaviours. The GI 2022 result (about 250 fps on a laptop GPU) supports feasibility at game scale.
- **Reaction-diffusion:** a 1024² Gray-Scott field updated several times per frame costs the same regardless of particle count. Particles can read it as a potential (follow its gradient) or as colour and emission probability.
- **SDF attractors for text, logos and images:**
  - Bake an SDF texture when the content changes (jump flooding was not researched here).
  - Apply force = −k · sdf · ∇sdf / |∇sdf|, plus tangential noise so particles "breathe" on the shape.
  - For images, pick target positions with the probability-map mip-pyramid technique from webgpu-samples.
- **Strange attractors (Lorenz, Aizawa, Thomas, Halvorsen):** these are pure per-particle ODE steps (RK2 or RK4), ALU-bound and trivially parallel, so they are viable at 100M. Crossfade between the attractor velocity and the other behaviours with the existing weight mixer.
- **3D curl noise cost:** an analytic curl needs three noise gradients per particle, which is heavy ALU work at 100M. The existing ABC flow needs about 6 sin/cos per particle. Baking curl noise into a 128³ rgba16float 3D texture (about 16 MB), refreshed in slices or animated by blending two volumes, cuts the per-particle cost to one filtered sample.

### Gaps
- lisyarus's Particle Life post could not be read because the host was blocked. Its code repository could not be found either: github.com/lisyarus/webgpu-particle-life returns 404, and the first page of his GitHub repositories lists WebGPU projects (webgpu-raytracer, webgpu-shallow-water, webgpu-demo, all MIT) but no Particle Life repository. Its binning code and timings are therefore unknown, and no RTX or Radeon figures for WebGPU Particle Life were found.
- No WebGPU Position Based Fluids (Macklin and Müller 2013) implementation or benchmark was researched before the search budget ran out.
- No WebGPU benchmark figures were found for reaction-diffusion, vortex methods or particles forming SDF text or shapes. The cost of jump flooding in WebGPU was not researched.
- The author and figures of the "4 million particles" Particle Life write-up were not verified.
- No WebGPU implementation of a 3D boids spatial hash at 1M+ was confirmed. One search summary mentioned "up to 4 million agents" without a verifiable source, so it is omitted.

## 3. GPU building blocks in WebGPU: prefix sum, radix sort, stream compaction, indirect dispatch, double buffering, determinism

### Takeaway
WebGPU gives no forward-progress guarantee between workgroups, so classic decoupled look-back is not portable. Gridwise reports it can lock up Apple machines, and PlayCanvas enables its OneSweep sort only on NVIDIA. Use multi-pass reduce-then-scan or Decoupled Fallback for scans (Gridwise DLDF, Apache-2.0), and a portable radix sort with OneSweep gated by vendor. Prefer counting sort for cell binning, and fixed-point integer atomics for order-independent, deterministic accumulation. Subgroups are available in Chromium 134+, but a fallback path is still needed. [Verified: BCD gives `subgroups` in Chrome 134 and Safari 27.3, not Firefox, https://github.com/mdn/browser-compat-data/blob/main/api/GPUSupportedFeatures.json] Chrome's Linux entry starts at 144, and Safari 27.3 is still a beta (the stable Safari is 27.2), so no shipping Safari has subgroups yet. [Verified correction: https://github.com/mdn/browser-compat-data/blob/main/browsers/safari.json]

### Cited Findings
- **Forward progress and Apple (Gridwise docs, verified):**
  - The forward-progress guarantee NVIDIA GPUs make "is necessary for the correctness of Merrill and Garland's implementation of decoupled lookback".
  - "Apple and ARM GPUs do not" make it; the docs cite ACM DOI 10.1145/3485508.
  - Without it, "the computing tiles may be fully blocked by waiting tiles and never make progress… On Apple hardware, as we found during the development of our scan primitive, this locks up the entire machine. Deploying a WebGPU implementation that depends on a forward-progress guarantee is thus not a viable option."
  - Gridwise adds a fallback so that a stalled tile processor redundantly computes per-tile reductions, and claims scans run "at full memory bandwidth, even on hardware without forward-progress guarantees".
  - Without hardware subgroups, the non-chained `HierarchicalScan` ran roughly 20–30× faster than `DLDFScan` with emulated subgroups on an Apple M1 Max.
  - Gridwise's subgroup emulation spin-waits on flags in workgroup memory, and "it can stall on implementations that do not guarantee forward progress between the invocations of a workgroup, such as CPU-based WebGPU renderers".
  - [Gridwise docs/scan-and-reduce.md](https://github.com/gridwise-webgpu/gridwise/blob/main/docs/scan-and-reduce.md); [Merrill & Garland 2016](https://research.nvidia.com/publication/2016-03_single-pass-parallel-prefix-scan-decoupled-look-back) [Verified: https://github.com/gridwise-webgpu/gridwise/blob/HEAD/docs/scan-and-reduce.md]
- **WebGPU ordering between dispatches (Gridwise docs):**
  - WebGPU inserts the needed barriers between compute passes.
  - Within one pass, "each dispatch is its own synchronization scope, so a dispatch sees the storage writes of the dispatches before it".
  - Invocations within one dispatch are not synchronized; that is what workgroup barriers and atomics are for.
  - Primitives can be chained in one command encoder with no CPU waits between them.
  - [Gridwise docs/ordering-guarantees.md](https://github.com/gridwise-webgpu/gridwise/blob/main/docs/ordering-guarantees.md)
- **Decoupled Fallback paper (UC Davis):**
  - A work-stealing technique that lets single-pass chained scans run without forward-progress guarantees while avoiding starvation.
  - Near-memcpy speed for inclusive prefix sum on Apple M1 Max and M3, using native Dawn.
  - Approaches the theoretical 50% speedup over reduce-then-scan, and stays robust under simulated blocking rates up to 50%.
  - [eScholarship record](https://escholarship.org/uc/item/0bk9z4bt) (search summary, not verified)
- **GPUPrefixSums (b0nes164, MIT):**
  - Decoupled Fallback lets a workgroup spin for a fixed number of cycles on its predecessor tile, then compute the missing reduction itself.
  - Several workgroups may fall back on the same tile; atomic compare-and-swap ensures only one result is broadcast.
  - Wave-size agnostic, tested on wave sizes 4, 16, 32 and 64. The WGPU version is "testing only, not fully portable".
  - As of 2024-09-22 the most up-to-date development was in Vello.
  - [GPUPrefixSums README](https://github.com/b0nes164/GPUPrefixSums)
- **Raph Levien (post sources, verified):**
  - 2020, "Prefix sum on Vulkan" — [post source](https://github.com/raphlinus/raphlinus.github.io/blob/main/_posts/2020-04-21-prefix-sum.md):
    - A decoupled look-back prototype computed 64Mi u32 values in 2.05 ms on a GTX 1080 (31.2 billion elements/s).
    - It "depends on other workgroups making forward progress while it's waiting for the aggregate to be published", and Vulkan's "limited forward progress guarantee" is not strong enough for that.
    - Proposed fix: "instead of simply spinning waiting" for another partition's aggregate, do some fallback work, which "restores correct operation even on devices with the weakest forward progress properties". This is the idea later built as Decoupled Fallback.
  - 2021, "Prefix sum on portable compute shaders" (published at [raphlinus.github.io](https://raphlinus.github.io/gpu/2021/11/17/prefix-sum-portable.html)) — [post source](https://github.com/raphlinus/raphlinus.github.io/blob/main/_posts/2021-11-04-prefix-sum-portable.md):
    - Decoupled look-back runs "about 1.5x" faster than tree reduction.
    - "WebGPU in its present form cannot run the decoupled look-back algorithm at all", because "Metal is simply missing an atomic barrier type that is necessary". The WebGPU spec was changed to reflect the weaker barrier (gpuweb PR #2297). [Verified: same file]
    - Uniformity analysis (FXC on DX12) also rejected the shader.
    - On an AMD 5700 XT under Vulkan, the barrier-based "compatibility mode" scan reached about 48 G elements/s, "basically the same as memcpy".
    - He concluded that piet-gpu (now Vello) would "focus on tree reduction".
    - These conclusions date from 2021, before the Decoupled Fallback and Gridwise work.
  - His reading list says WebGPU lacks device-scoped barriers, which makes single-pass prefix sum impossible — [Bill Mill's notes on Levien's resources](https://notes.billmill.org/programming/graphics_programming/Raph_Levien_s_resources_for_learning_compute_shaders.html) (search summary, not verified)
- **GPUSorting (b0nes164, MIT, © 2024 Thomas Smith):** "DeviceRadixSort" and "OneSweep" follow CUB and differ only in the inter-threadblock prefix sum of digit counts. DeviceRadixSort uses the older reduce-then-scan; OneSweep uses a chained scan with decoupled look-back. Both are wave-size agnostic. The README lists D3D12, CUDA and Unity implementations and no WebGPU port — [GPUSorting README](https://github.com/b0nes164/GPUSorting); [LICENSE](https://github.com/b0nes164/GPUSorting/blob/main/LICENSE)
- **Gridwise (Apache-2.0)** — [Gridwise README](https://github.com/gridwise-webgpu/gridwise); [Gridwise docs/sort.md](https://github.com/gridwise-webgpu/gridwise/blob/main/docs/sort.md):
  - Scope and features:
    - WebGPU scan, reduce and radix sort in JavaScript, for browsers and for Node via Dawn.
    - Scan and reduce use Decoupled Lookback / Fallback (DLDF). Radix sort uses Adinets and Merrill's OneSweep with a chained scan and fallback.
    - Uses subgroup instructions where supported and emulates them otherwise. Scan supports u32, i32 and f32 with Add, Min, Max and Multiply; sort supports u32, i32, f32 and u64 keys.
    - Ascending key-value sort is stable.
    - The sort requires `maxComputeWorkgroupStorageSize: 32768`, above the 16,384 default. [Verified: https://github.com/gridwise-webgpu/gridwise/blob/HEAD/README.md] Windows D3D12 adapters report 32,768 and the SwiftShader CI adapter measured 32,768. [Verified: https://github.com/google/dawn/blob/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp; coordinator measurement]
    - Licence: Apache-2.0 (LICENSE.txt; package.json `license` "Apache-2.0", version 0.1.0). [Verified: https://github.com/gridwise-webgpu/gridwise/blob/HEAD/LICENSE.txt]
  - Limits:
    - At most 2^30 items, because the two most significant bits are status bits.
    - Input lengths must be a multiple of 4.
    - 8 bits per pass.
    - Works with subgroups up to 128 lanes. The warp-level multisplit (WLMS) mask is one u32 when `subgroupMaxSize` ≤ 32 (Apple, NVIDIA), and a `vec4<u32>` on AMD RDNA (32 to 64 lanes).
    - Each pass's tile must hold (256 ÷ subgroup width) × 256 digit-histogram entries, so it needs at least 8 keys per thread with 32-lane subgroups; tiles that do not fit workgroup memory are refused. [Verified: https://github.com/gridwise-webgpu/gridwise/blob/HEAD/docs/sort.md] At SwiftShader's measured subgroup width of 4 the rule would need 64 keys per thread, a 64 KiB tile against the 32 KiB limit. Gridwise does not refuse that case: it uses hardware subgroups whenever the device has the `subgroups` feature (SwiftShader has it), and it sizes the tile as if subgroups were at least 32 lanes wide, so it builds an ordinary tile of at most 15 keys per thread, below what its own rule asks for 4-lane subgroups. In CI, pass `disableSubgroups: true` (32-wide emulation, whose spin loops can stall on CPU renderers) or test a non-spinning sort instead. Whether the hardware-subgroup path sorts correctly at width 4 was not tested. [Verified correction: https://github.com/gridwise-webgpu/gridwise/blob/HEAD/src/onesweep.mjs; https://github.com/gridwise-webgpu/gridwise/blob/HEAD/src/primitive.mjs]
  - Measured per-pass times at 2^24 keys, through Dawn in Node:
    - Apple M1 Max (copy kernel 360–370 GB/s): 32-bit keys take 2.6 ms at the default 15 keys/thread, and 1.8 ms at 11. 64-bit key-value runs at about 100 GB/s, 29% of copy.
    - NVIDIA V100 (copy 808 GB/s): 32-bit keys take 0.585 ms, 230 GB/s or 28% of copy. 64-bit key-value takes about 1.31 ms, 308 GB/s or 38%.
  - Where the V100's 64-bit key-value pass time goes: 38% moving the bytes, about 38% work inside each tile, 20% scattered writes, and ≤5% decoupled look-back (fallbacks on 4–6% of tiles). For 32-bit keys, look-back was about 22% of a pass. [Verified: https://github.com/gridwise-webgpu/gridwise/blob/HEAD/docs/sort.md]
- **PlayCanvas WebGPU radix sort (MIT)** — [compute-radix-sort.js](https://github.com/playcanvas/engine/blob/main/src/scene/graphics/radix-sort/compute-radix-sort.js); [compute-radix-sort-onesweep.js](https://github.com/playcanvas/engine/blob/main/src/scene/graphics/radix-sort/compute-radix-sort-onesweep.js):
  - A "portable" backend that needs no subgroups and runs on every WebGPU device.
  - A OneSweep backend (8-bit digits, single sweep) enabled only for NVIDIA, validated on Turing+ and Ampere.
  - The code comments say other vendors "either lack forward-progress guarantees (Apple) or have shown correctness issues in the lookback (Mali / Imagination / some Adreno)".
  - OneSweep needs subgroups with a runtime size ≤ 32, because the binning shader uses 32-bit ballot masks. Dawn/D3D12 may report a maximum of 128, and some Chrome/Dawn builds on Windows report 0.
  - The OneSweep backend's `sort()` defaults to 16-bit keys, so 2 passes.
  - [Verified: https://github.com/playcanvas/engine/blob/HEAD/src/scene/graphics/radix-sort/compute-radix-sort.js; https://github.com/playcanvas/engine/blob/HEAD/src/scene/graphics/radix-sort/compute-radix-sort-onesweep.js] Two details the first pass missed: the OneSweep file says the lookback can make progress on "NVIDIA Turing+, AMD GCN+, Intel Gen9+", but the selector still enables it only when `adapter.info.vendor` is "nvidia"; and its WGSL is a port of b0nes164/GPUSorting (MIT), so a WebGPU OneSweep port does exist, inside PlayCanvas.
- **linebender GPU sorting wiki:** Onesweep depends on a hardcoded subgroup size of 32 and is hard to port. The wiki points to Lichtso's Onesweep-inspired sort in splatter — [linebender wiki](https://linebender.org/wiki/gpu/sorting/) (search summary, not verified)
- **Other WebGPU sorts:**
  - webgpu-radix-sort (npm, MIT per its package.json `license` field; WebGPU-Ocean's package.json lists it as a dependency, `^1.0.7`) — [README](https://github.com/kishimisu/WebGPU-Radix-Sort); [package.json](https://github.com/kishimisu/WebGPU-Radix-Sort/blob/main/package.json); [WebGPU-Ocean package.json](https://github.com/matsuoka-601/webgpu-ocean/blob/main/package.json):
    - A 4-way radix sort after Ha et al. 2009, with a recursive work-efficient scan.
    - Optional "order checking" can exit early for nearly sorted data.
    - It switches to `dispatchWorkgroupsIndirect` only when order checking is on, because for the same dispatch size the indirect call was "slightly slower".
  - wgpu_sort (Rust; BSD-2-Clause per its Cargo.toml `license` field, wgpu 0.20): a port of Fuchsia's Vulkan radix sort for 32-bit key-value pairs. It guesses the subgroup size, supports indirect dispatch, and NaN/Inf float keys sort incorrectly — [README](https://github.com/KeKsBoTer/wgpu_sort); [Cargo.toml](https://github.com/KeKsBoTer/wgpu_sort/blob/master/Cargo.toml)
  - splatter (Rust/wgpu): Onesweep radix sort, with the block sort not WLMS because WebGPU lacked subgroups, plus stream compaction via indirect drawing — [README](https://github.com/Lichtso/splatter)
  - A three.js bitonic sort example on 16,384 elements — [three.js example source](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_compute_sort_bitonic.html)
- **Subgroups status:**
  - Chrome "New in WebGPU 134" (2025-02-26): the subgroups feature is now available. Request `"subgroups"` at device creation, plus `"shader-f16"` to use f16 with subgroups — [Chrome blog](https://developer.chrome.com/blog/new-in-webgpu-134) (search summary, not verified) [Verified (version): BCD gives Chrome 134, https://github.com/mdn/browser-compat-data/blob/main/api/GPUSupportedFeatures.json]
  - Subgroup size control appears in Chrome's 151–152 notes (published 2026-08-12) — [Chrome blog](https://developer.chrome.com/blog/new-in-webgpu-151-152) (search summary, not verified) [Verified (version): BCD gives `subgroup-size-control` in Chrome 152, same file]
  - Chromium has shipped the `subgroup_id` and `subgroup_uniformity` WGSL language extensions: BCD gives Chrome 144 and Chrome 145, with no Firefox or Safari support, and Chromium 153 in this container lists both in `navigator.gpu.wgslLanguageFeatures`. [Verified correction: https://github.com/mdn/browser-compat-data/blob/main/api/WGSLLanguageFeatures.json; coordinator measurement, 12 November 2026 (no URL)] Intents to ship — [blink-dev subgroup_id](https://groups.google.com/a/chromium.org/g/blink-dev/c/SV75BHCUJz0) (search summary, not verified); [blink-dev subgroup_uniformity](https://groups.google.com/a/chromium.org/g/blink-dev/c/ifPjq5LNyOA) (search summary, not verified)
  - caniuse lists Firefox as unsupported through version 156. Its desktop Chrome data looked inconsistent in the summary — [caniuse](https://caniuse.com/wf-webgpu-subgroups) (search summary, not verified) [Verified: BCD lists no Firefox support for `subgroups` and gives Safari 27.3, https://github.com/mdn/browser-compat-data/blob/main/api/GPUSupportedFeatures.json] BCD's release table lists Safari 27.3 as beta; the current Safari, 27.2, lacks subgroups. [Verified correction: https://github.com/mdn/browser-compat-data/blob/main/browsers/safari.json]
- **WGSL spec (editor's draft):** includes `subgroupAdd`, `subgroupExclusiveAdd`, `subgroupInclusiveAdd`, `subgroupBallot` and `subgroupShuffle`, plus a `subgroup_size_control` extension with an `@subgroup_size` attribute — [WGSL spec source](https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs)
- **Subgroups proposal (gpuweb):**
  - Adapters expose `subgroupMinSize` and `subgroupMaxSize`. Vulkan reports the driver's values; on Metal, which has no query before pipeline compilation, the proposal uses fixed bounds of 4 and 64; on D3D12 the minimum is `WaveLaneCountMin` and the maximum is 128. No shader may launch with a `subgroup_size` outside that range. [Verified correction: https://github.com/gpuweb/gpuweb/blob/main/proposals/subgroups.md (the earlier text read the Metal column as "Vulkan-class")] The SwiftShader CI adapter measured a subgroup size of 4. [Verified: coordinator measurement]
  - In compute shaders, `subgroup_size` is uniform.
  - A `subgroup_uniformity` diagnostic flags subgroup calls that uniformity analysis cannot prove to be in uniform control flow.
  - [gpuweb proposals/subgroups.md](https://github.com/gpuweb/gpuweb/blob/main/proposals/subgroups.md)
  - Gridwise notes that WebGPU does not fix a subgroup size, and that some hardware may use different sizes in different kernels of the same application. Its emulation uses 32-wide virtual subgroups — [Gridwise docs/subgroup-strategy.md](https://github.com/gridwise-webgpu/gridwise/blob/main/docs/subgroup-strategy.md)
- **Atomics in WGSL:**
  - `atomic<T>` requires T to be u32 or i32.
  - An `atomic_vec2u_min_max` extension (feature `"atomic-vec2u-min-max"`) adds `atomic<vec2<u32>>`, an unsigned 64-bit value. It supports only `atomicStoreMin` and `atomicStoreMax`, which return nothing, and only in the storage address space (not workgroup memory).
  - [WGSL spec source](https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs) [Verified: same file]
  - Availability: Dawn enables the feature on D3D12 with int64 atomics (device creation also needs DXC and shader model 6.6), on Vulkan with `shaderBufferInt64Atomics` and `shaderInt64`, and on Metal on Apple9, or Mac2 with Apple8 (M2 and later). Chrome exposes it by default from Chromium 157, the stable channel since 3 November 2026; Electron 45 (Chromium 156) exposes it only at a raised WebGPU safety level, that is with `--enable-webgpu-developer-features` or `--enable-unsafe-webgpu`. [Verified correction: `IsFeatureExposed` in https://github.com/chromium/chromium/blob/156.0.8078.96/gpu/command_buffer/service/webgpu_decoder_impl.cc lists both levels; https://github.com/mdn/browser-compat-data/blob/main/browsers/chrome.json; https://github.com/google/dawn/blob/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp] [Verified: https://github.com/google/dawn/blob/main/src/dawn/native/metal/PhysicalDeviceMTL.mm; https://github.com/google/dawn/blob/main/src/dawn/native/vulkan/PhysicalDeviceVk.cpp; https://github.com/chromium/chromium/blob/156.0.8078.96/gpu/command_buffer/service/webgpu_decoder_impl.cc; https://github.com/chromium/chromium/blob/157.0.8103.81/gpu/command_buffer/service/webgpu_decoder_impl.cc]
  - gpuweb issue #4894, "wgsl: support atomics on f32 (in workgroup and storage buffer)" — [gpuweb issue #4894](https://github.com/gpuweb/gpuweb/issues/4894):
    - Opened 2024-09-24; still open, in Milestone 3.
    - The proposed polyfill uses `bitcast` and a u32 `atomicCompareExchangeWeak` loop. A spec editor warned that "the polyfill is dubious when you don't have forward progress guarantee".
    - November 2025 WGSL committee resolution: "Move forward with a proposal doc which lists available features", at least as an optional `enable` feature.
    - An October 2026 comment reported no hangs with the polyfill, but a compare-and-swap loop on global memory much slower than an integer workgroup-memory path.
    - Read via WebFetch's model-generated summary of the issue page, so the quotes may be inexact. [Unverified: the issue page and GitHub API were not reachable during the fact-check; the WGSL spec still allows only u32 and i32 atomic types]
- **Indirect dispatch and usage scopes:**
  - A culling or compaction pass writes the workgroup count into a buffer, and an indirect dispatch reads it; a barrier is needed in between — [Vulkan tutorial: indirect dispatch](https://docs.vulkan.org/tutorial/latest/Advanced_Vulkan_Compute/07_GPU_Driven_Pipelines/02_indirect_dispatch.html) (search summary, not verified)
  - WebGPU exposes `dispatchWorkgroupsIndirect(indirectBuffer, indirectOffset)`. In a compute pass, each dispatch is its own usage scope — [WebGPU spec source](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs)
- **Fixed-point P2G atomics in practice** (WebGPU-Ocean; three.js multiplier 1e7) — [WebGPU-Ocean README](https://github.com/matsuoka-601/webgpu-ocean); [three.js fluid example](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_compute_particles_fluid.html)

### Inferences
- **Scan strategy:**
  - For cell counts up to a few million, a 3-dispatch reduce-then-scan is portable and never spins across workgroups: tile reduce, then scan the tile sums in one workgroup, then downsweep. It costs about 2 reads and 1 write per element.
  - DLDF (Gridwise) saves about a third of that traffic. Adopt it only if profiling shows scans matter; for cell grids of about 10^5 to 10^6 entries, scans are small next to particle passes.
  - On adapters without the `subgroups` feature, prefer a non-chained hierarchical scan. Gridwise's own `HierarchicalScan` was 20–30× faster than DLDF with emulated subgroups on an M1 Max, and does not spin-wait.
  - In Gridwise's V100 measurements the look-back was only 5–22% of a sort pass. The portable multi-pass route therefore costs little on desktop GPUs compared with the risk of hangs.
- **Binning:**
  - Counting sort beats a full 32-bit radix sort for cell keys: atomicAdd per particle into its cell count while keeping the returned slot, then an exclusive scan, then a scatter.
  - If a radix sort is used, cell indices under 65,536 need only 16-bit keys (2 OneSweep passes, PlayCanvas's default).
  - wgpu_sort's 8M pairs in 1.64 ms on an RTX A5000 implies about 1 ms per frame to fully sort a 4M interactive tier on a high-end GPU.
- **Runtime choice:**
  - If Tactilume Desktop ships as a native app (Dawn or wgpu) or inside a Chromium shell such as Electron, subgroups are available on Chromium 134+ wherever WebGPU itself is enabled. On Linux it is not enabled everywhere: Chromium 156 (Electron 45) blocks WebGPU over Vulkan with GL interop (blocklist entry 186) except on Intel Gen12+ with Mesa 22.0 or newer and on NVIDIA drivers 535.183.01 or newer, so AMD and older Intel Linux machines need WebGPU force-enabled or a WebGL2 fallback. [Verified correction: https://github.com/chromium/chromium/blob/156.0.8078.96/gpu/config/software_rendering_list.json; https://github.com/mdn/browser-compat-data/blob/main/api/GPU.json]
  - Firefox and Safari targets cannot count on them, nor can native wgpu without checking its feature support.
  - Always keep a no-subgroup path. Gridwise's emulation shows how.
- **Vendor gating:**
  - Enable single-pass look-back scans and OneSweep only when `adapter.info.vendor` is NVIDIA, as PlayCanvas does. Everywhere else, use multi-pass portable kernels or DLDF.
  - Chrome fills `adapter.info.vendor` and `architecture` (SwiftShader reports "google" and "swiftshader") but may leave `description` empty, so gate on vendor and architecture, not on the description string. [Verified: coordinator measurement, 12 November 2026 (no URL)]
  - AMD and Intel desktop behaviour under WebGPU was not documented in the sources found, so treat them as non-validated until tested. PlayCanvas's OneSweep notes claim lookback progress on AMD GCN+ and Intel Gen9+, but PlayCanvas has validated only NVIDIA. [Verified: https://github.com/playcanvas/engine/blob/HEAD/src/scene/graphics/radix-sort/compute-radix-sort-onesweep.js]
- **Stream compaction:**
  - Atomic append (atomicAdd on a counter) is cheapest but gives a nondeterministic order.
  - Scan-based compaction (flag, exclusive scan, scatter) is stable and deterministic.
  - For a light toy, order rarely matters outside sorting-dependent blending, which is the renderer's concern.
- **Indirect dispatch:**
  - Compute workgroup counts on the GPU with a tiny single-thread kernel. Clamp them to 65,535 per dimension and spill into a 2D dispatch when larger.
  - Avoid `mapAsync` readbacks in the frame loop.
  - The extra cost of indirect over direct dispatch reported by webgpu-radix-sort is small, but use direct dispatch whenever the CPU already knows the count (for example, the fixed-size ambient pool).
- **Double buffering:**
  - Ping-pong buffers are mandatory when a kernel reads other particles' current state (SPH, boids, Particle Life).
  - Field-advected tracers can be updated in place.
  - A buffer cannot be bound for both read-only and read-write storage in the same dispatch, since each dispatch is one usage scope. Swap bind groups between steps instead.
- **Determinism:**
  - Fixed-point integer atomic sums do not depend on order, because integer addition is associative. Grid accumulation therefore repeats bit for bit on one machine; float atomics would not, even if they existed.
  - The slot order from atomic counting sort is nondeterministic. Where replays or multi-screen sync need determinism, use a stable radix sort on (cell, particle id).
  - Expect float results to differ between GPU vendors and drivers, so bit-exact behaviour across machines is unrealistic.
- **Fixed-point range:**
  - With a 1e7 multiplier, an i32 holds only about ±214.7. Dense cells accumulating mass × velocity can overflow.
  - Choose a scale per quantity (mass versus momentum), clamp contributions, or split values into high and low i32 words.
- **64-bit min/max atomics:** where `"atomic-vec2u-min-max"` is available, `atomicStoreMax` on a packed (priority, payload) value could implement "winner-takes-all" grid writes, for example the dominant species per cell. Availability is now known (see the atomics findings above): not on M1 Macs, storage buffers only, and in Electron 45 only behind the developer or unsafe-WebGPU flag. [Verified correction: https://github.com/chromium/chromium/blob/156.0.8078.96/gpu/command_buffer/service/webgpu_decoder_impl.cc]

### Gaps
- The linebender sorting wiki could not be read because the host was blocked; the Gridwise docs were read from their GitHub sources instead.
- Gridwise's interactive benchmark results (examples/scan_sort_perf) were not run here. The only Gridwise numbers available are the M1 Max and V100 sort-probe tables above.
- No measured WebGPU prefix-sum or radix-sort timings were found on current AMD Radeon, Intel Arc or recent GeForce desktop GPUs. The exceptions are the dated GPUs in the wgpu_sort table and Gridwise's V100 and M1 Max figures.
- Forward-progress behaviour on AMD and Intel under WebGPU is undocumented in the sources found. Gridwise's fallback makes the scan safe regardless, but the PlayCanvas OneSweep path has no fallback.
- Not determined as of November 2026:
  - Safari's subgroup support. Partly resolved: BCD gives Safari 27.3, which is still in beta, so no stable Safari (27.2 is current) has subgroups yet. [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/GPUSupportedFeatures.json] [Verified correction: https://github.com/mdn/browser-compat-data/blob/main/browsers/safari.json]
  - The browser shipping status of `"atomic-vec2u-min-max"`. Now resolved for Chrome: default from Chromium 157, developer or unsafe-WebGPU flag in 156. [Verified: Chromium release tags 156.0.8078.96 and 157.0.8103.81]
  - Whether Vello's current shaders use Decoupled Fallback. The Vello README was checked, but not the shader tree.
- No LICENSE file was found at the default path for webgpu-radix-sort or wgpu_sort. Their licences above come from the package.json and Cargo.toml metadata fields. [Verified: LICENSE and LICENSE.md return 404 for both; package.json says MIT and Cargo.toml says BSD-2-Clause]

## 4. Emission and life cycle at scale: ring buffers, dead lists, atomic counters

### Takeaway
The standard GPU-only life cycle uses a dead-list stack of free indices and atomic counters, and the GPU drives the next pass with indirect dispatch:
1. Emission pops indices from the dead list.
2. Simulation pushes dying particles back onto the dead list and appends survivors to the next alive list.
3. Indirect arguments, written on the GPU, launch the next pass.

At 10M to 100M particles, a fixed pool where each particle respawns in place, or a ring buffer per emitter, avoids compaction and indirection entirely and suits a light toy.

### Cited Findings
- **Wicked Engine (2017)** — [Wicked Engine: GPU-based particle simulation](https://wickedengine.net/2017/11/gpu-based-particle-simulation) (search summary, not verified):
  - Ping-pong alive lists.
  - A counter buffer holding the alive count, dead count and "real emit count".
  - Emission takes indices from the dead list with an atomic decrement.
  - Simulation reads one alive list, writes survivors to the other, and returns killed particles to the dead list. Last frame's alive list plus this frame's emitted particles form the current input.
  - Drawing uses indirect arguments written by the simulation shader.
- **AMD (Gareth Thomas, GDC 2014):** a persistent dead list, an alive list rebuilt each frame, and an emit shader that consumes free indices from the dead list. Because the alive count exists only on the GPU, drawing uses indirect APIs — [slides](https://www.slideshare.net/slideshow/holy-smoke-faster-particle-rendering-using-direct-compute-by-gareth-thomas/35656271) (search summary, not verified)
- **Bevy Hanabi:**
  - In WGSL, emission claims a free slot with an atomic subtract on the dead count and appends the particle to the alive list with an atomic add — [Medium: GPU Particle Research — Bevy Hanabi, Part 1](https://medium.com/@Sou1gh0st/gpu-particle-research-bevy-hanabi-part-1-9797d3f08535) (search summary, not verified)
  - Hanabi is a GPU particle system for Bevy built on compute shaders, running on wasm through WebGPU since v0.13 (Bevy 0.14), dual-licensed MIT OR Apache-2.0 — [djeedai/bevy_hanabi](https://github.com/djeedai/bevy_hanabi) [Verified: https://github.com/djeedai/bevy_hanabi/blob/HEAD/README.md; LICENSE-MIT and LICENSE-APACHE2 present]
- **No-compaction alternative:** dead particles are marked by zero alpha and every particle is processed every frame, because the CPU does not know the alive count — [Juan Diego Montoya: Particles I](https://juandiegomontoya.github.io/particles.html) (search summary, not verified)
- **Indirect counts:** a compute pass collects live IDs into a buffer, and a second dispatch is sized from the counter with vkCmdDispatchIndirect — [Vulkan tutorial](https://docs.vulkan.org/tutorial/latest/Advanced_Vulkan_Compute/07_GPU_Driven_Pipelines/02_indirect_dispatch.html) (search summary, not verified)
- **Image-weighted spawn positions** come from a probability-map mip pyramid — [webgpu-samples particles](https://github.com/webgpu/webgpu-samples/blob/main/sample/particles/main.ts)
- **Babylon.js:** `activeParticleCount` caps the active particles below capacity to limit GPU use. Sub-emitters are not supported in GPU particles — [Babylon.js GPU particles docs](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/particles/particle_system/gpu_particles.md). On WebGPU the update runs in a WGSL compute shader. Its uniform block carries `currentCount`, `timeDelta`, `stopFactor`, `lifeTime`, `emitPower` and `emitIndex` — [computeShaderParticleSystem.pure.ts](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Particles/computeShaderParticleSystem.pure.ts)
- **Ring-buffer emission in three.js** (`webgpu_tsl_vfx_linkedparticles`, 8,192 particles) — [three.js example source](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_tsl_vfx_linkedparticles.html):
  - A spawn kernel dispatched over `nbToSpawn` threads writes particle `(spawnIndex + instanceIndex) mod nbParticles`, overwriting the oldest particles. It uses no atomics or free lists.
  - The `w` component of the `vec4` position stores life; it is set to 1 on spawn, and a value > 0 means alive.
  - Spawn positions are interpolated between the previous and current cursor positions across the batch being spawned.

### Inferences
- **Kickoff kernel (one thread per frame or substep):**
  - Compute `emitCount = min(requested, deadCount)`, Wicked's "real emit count", so `atomicSub` on a u32 counter can never wrap below zero.
  - Write the indirect arguments for the emit and simulate passes, clamped and split across 2D dispatch dimensions.
- **Emit kernel:** `slot = atomicSub(&deadCount, 1u) - 1u; idx = deadList[slot];` then initialise particle `idx` and append it to the alive list.
- **Simulate kernel:**
  - If the particle has expired: `deadList[atomicAdd(&deadCount, 1u)] = idx`.
  - Otherwise: `aliveNext[atomicAdd(&aliveCountNext, 1u)] = idx`.
  - The last thread, or the next kickoff, writes the indirect arguments.
- **For the 100M ambient tier, skip lists entirely:**
  - Allocate the whole pool and treat every particle as always alive.
  - When age exceeds lifetime, or a particle leaves bounds or fails the NaN check, respawn it in place at an emitter, a touch, an SDF surface sample or an image sample.
  - Cost stays constant, with no atomics and no indirection. An `activeCount` uniform (like Babylon's `activeParticleCount`) scales quality per GPU tier.
- **Ring buffers:** for bursts and fountains with equal lifetimes, each emitter writes new particles at `head = (head + k) mod capacity` and overwrites the oldest ones. No atomics are needed, and live particles stay in a contiguous range, which keeps memory access coherent.
- **Per-player budgets:** with 10+ phones and gamepads, give each player or emitter its own contiguous slice of the pool, so a burst from one player cannot starve the others. A global dead list is only needed when slices must share capacity.
- **Indirection cost:** alive-list indirection (`idx → particle`) breaks coalesced loads. Either re-compact particle storage itself now and then with a stable scan-based compaction, or prefer in-place pools for large counts.

### Gaps
- No measured WebGPU cost of dead-list and alive-list management at 10M+ particles was found.
- The Wicked Engine and AMD material was read only as search summaries, because the hosts were blocked.

## 5. Interaction at scale: many force sources, splatting forces into grids, audio-driven forces, responsiveness with 10+ inputs

### Takeaway
Looping over every force source per particle costs O(N·K), which is fine for 32 poles at 2M particles but not for 100M particles times thousands of touch-trail segments. Splat or rasterise all inputs once per frame into a low-resolution force/velocity grid, which can also drive a stable-fluids solve (O(K + grid cells)). Each particle then samples the grid once (O(1)). Exact per-primitive forces are kept only for gamepad cursors and the interactive tier, using tile-binned primitive lists.

### Cited Findings
- Grid fluids driven by user splats: Pavel Dobryakov's WebGL fluid (MIT) is based on GPU Gems chapter 38 — [PavelDoGreat/WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation); [GPU Gems ch. 38](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu)
- WebGPU grid-fluid solvers use semi-Lagrangian advection with FFT pressure projection, or multigrid — [rreusser Stable Fluids notebook](https://rreusser.github.io/notebooks/stable-fluids) (search summary, not verified); [roquefort link](https://frontendfoc.us/link/163294/web) (search summary, not verified)
- Scattering one scalar per particle into a grid each frame (Splash's density P2G) has "not that much" overhead — [Splash README](https://github.com/matsuoka-601/Splash)
- Fixed-point integer atomic splatting into grid cells works in WGSL — [three.js fluid example](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_compute_particles_fluid.html); [WebGPU-Ocean README](https://github.com/matsuoka-601/webgpu-ocean)
- three.js keeps a small set of force sources (attractor positions and axes) in a `uniformArray`, looped over per particle — [three.js attractors example](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_tsl_compute_attractors_particles.html)
- Fast cursor motion: three.js linked particles spreads each frame's spawned particles along the segment from the previous to the current cursor position, using `mix(previousSpawnPosition, spawnPosition, i / (nbToSpawn - 1))`. This avoids gaps when the pointer moves quickly — [three.js example source](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_tsl_vfx_linkedparticles.html)
- Audio to GPU (three.js `webgpu_compute_audio`): a Web Audio `AnalyserNode` with `fftSize = 2048` fills a `Uint8Array(1024)` via `getByteFrequencyData` each frame. The array is uploaded as a 1024 × 1 `DataTexture` (`needsUpdate = true`) and sampled in a shader as a spectrum. The same example also runs audio processing itself in a compute shader — [three.js example source](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_compute_audio.html)
- Per-stage binding counts limit how many separate input buffers a kernel can see (default maxStorageBuffersPerShaderStage = 8) — [WebGPU spec source](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs)

### Inferences
- **Input budget arithmetic:**
  - 10 players × 10 touches × a 32-segment trail is 3,200 segments.
  - Evaluating every segment per particle at 100M is about 3.2 × 10^11 tests per step, which is impossible.
  - The current 32 poles at 2M particles is about 6.4 × 10^7 tests, which is fine.
  - Exact per-particle loops therefore stay for ≤ 64 point-like sources (gamepad cursors, poles) and for the interactive tier.
- **Force-grid splat pipeline, once per frame or substep:**
  1. Upload all inputs in one `queue.writeBuffer` into a single storage buffer (struct array plus count).
  2. Splat each point or capsule-shaped trail segment as a soft brush into a 2D rgba16float force/velocity texture (screen or world plane), or into a 3D volume. Use either a render pass with additive blending (16-bit float blending is core; 32-bit needs the "float32-blendable" feature) or a compute pass with fixed-point atomics. [Verified: the spec's texture-format table marks rgba16float blendable with no feature and the 32-bit float formats blendable only with "float32-blendable", https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs]
  3. Decay and blur the field, which gives lingering wakes, or feed it into a stable-fluids step (advect, divergence, pressure, project) for incompressible "currents". The result stays divergence-free, like the existing ABC flow.
  4. Each particle samples the field once with bilinear or trilinear filtering.
- **Tile-binned primitives (like clustered lighting):** for exact near-field effects on the interactive tier, bin primitives into screen or world tiles (for example 32 × 32 px) with count, scan and scatter. Each particle then tests only the primitives in its own tile.
- **Gamepads:** with few primitives (about 8 players × 2 sticks), evaluate them exactly per particle, like today's poles, for sharp "cursor" feel, and also splat them for far-field influence.
- **Audio:**
  - Compute FFT band energies on the CPU (Web Audio `AnalyserNode` in a browser shell, or a native FFT) as 16 to 64 floats per frame in a uniform buffer.
  - Use them to modulate behaviour weights, curl-noise amplitude, splat strength, emission rate and attractor strength.
  - The GPU cost is negligible.
- **Responsiveness with 10+ remote inputs:**
  - Never read GPU results back synchronously.
  - Timestamp network events from phones (WebSocket or WebRTC) on arrival, and interpolate trail points to each substep's time, so Wi-Fi jitter does not turn into jagged trails.
  - Cap primitives per frame (for example 4,096) and drop the oldest trail points first.
  - Process input on the CPU in a separate ring buffer, so a slow GPU frame never blocks input intake.
- **Fairness:** use per-player strength normalisation, so one player with many touches does not dominate, and split per-player emission budgets as in Q4.

### Gaps
- No published WebGPU benchmark of force-grid splatting with many simultaneous inputs was found.
- No sources on audio-reactive GPU particle systems, or on phone-to-desktop input latency, were retrieved before the search budget ran out.
- The availability of the "float32-blendable" and "float32-filterable" features across browsers and GPUs in November 2026 was not verified. Now resolved for browsers: BCD gives `float32-blendable` in Chrome 132, Safari 26 and Firefox 158, and `float32-filterable` in Chrome 119 only. Dawn enables both on every D3D12 adapter, `float32-blendable` on every Metal adapter, and both per format on Vulkan (webgpu_desktop_capabilities.md Q2). [Verified: https://github.com/mdn/browser-compat-data/blob/main/api/GPUSupportedFeatures.json; https://github.com/google/dawn/blob/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp; https://github.com/google/dawn/blob/main/src/dawn/native/metal/PhysicalDeviceMTL.mm; https://github.com/google/dawn/blob/main/src/dawn/native/vulkan/PhysicalDeviceVk.cpp]

## 6. Stability and safety: NaN guards, CFL limits, timestep control and sub-stepping at variable refresh (60 to 480 Hz)

### Takeaway
WGSL lets compilers assume that NaN and Inf never occur. A NaN check written as `x != x` may therefore be optimised away. Guards should prevent bad values (clamp speeds and forces, soften singularities) and detect them through integer bit patterns. Run the simulation on a fixed timestep, sub-stepped from a time accumulator and decoupled from the 60 to 480 Hz display rate. Size substeps from a CFL-style bound for grid and MPM modes, as WebGPU MLS-MPM demos show.

### Cited Findings
- WGSL "Finite Math Assumption" — [WGSL spec source](https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs):
  - Implementations may assume that overflow, infinities and NaNs are not present during shader execution.
  - If a runtime expression produces one anyway, the result is an indeterminate value.
  - Const-expressions or override-expressions that overflow or evaluate to NaN or Inf are shader-creation or pipeline-creation errors.
  - [Verified: same file; the spec adds that `min` and `max` "may not return the expected result" because of this assumption]
- WebGPU-Ocean needs 2 substeps per frame and still occasionally explodes because the timestep is "a bit too large". Recomputing volume each step is what allows the large timestep — [WebGPU-Ocean README](https://github.com/matsuoka-601/webgpu-ocean)
- Splash reaches 1 substep per frame by lowering the Tait exponent γ from 5 to 1 and raising stiffness, trading incompressibility for stability — [Splash README](https://github.com/matsuoka-601/Splash)
- The three.js attractors example clamps speed to `maxSpeed`, damps velocity every step, and wraps positions with `mod` to keep particles in bounds — [three.js attractors example](https://github.com/mrdoob/three.js/blob/master/examples/webgpu_tsl_compute_attractors_particles.html)
- webgpu-samples boids pass a fixed `deltaT` (0.04) as a uniform — [computeBoids main.ts](https://github.com/webgpu/webgpu-samples/blob/main/sample/computeBoids/main.ts)
- Semi-Lagrangian advection in WebGPU Stable Fluids — [rreusser notebook](https://rreusser.github.io/notebooks/stable-fluids) (search summary, not verified)
- NaN and Inf float keys give wrong results in GPU radix sorts — [wgpu_sort README](https://github.com/KeKsBoTer/wgpu_sort)

### Inferences
- **NaN/Inf guard that survives the Finite Math Assumption:** test the exponent bits with integer operations, which the assumption does not cover:

  ```wgsl
  fn isFiniteF(x: f32) -> bool {
      return (bitcast<u32>(x) & 0x7f800000u) != 0x7f800000u;
  }
  ```

  Apply it to position and velocity at the end of the integrate kernel. On failure, respawn the particle rather than let the bad value spread through grids or neighbours. Optionally count resets with `atomicAdd` into a debug counter.
- **Prevention:**
  - Soften inverse-square forces as 1/(r² + ε²).
  - Normalise only when length > ε, and use `select()` for safe division.
  - Clamp acceleration and velocity per step (as the three.js `maxSpeed` does) and clamp dt.
  - Clamp fixed-point contributions before integer atomics, so overflow cannot wrap.
  - Treat Particle Life matrix values and user-tunable stiffness as bounded parameters.
- **Fixed-timestep loop:**
  - Use a fixed simulation dt, for example 1/240 s, and accumulate real frame time.
  - Each frame, run `n = min(floor(acc / dt), nMax)` substeps.
  - At a 480 Hz display, most frames run 0 or 1 step; on fast GPUs, dt = 1/480 s is an option. At 60 Hz, run 4 substeps per frame.
  - Cap nMax (about 8) so one hitch cannot trigger a spiral of death. When the cap is hit, discard the excess time and let the simulation slow down briefly rather than carry debt forward.
  - Render either the latest state or, if the renderer wants it, an interpolation between the last two states, which needs positions double-buffered.
- **Substep encoding:** encode all substeps for a frame into one command buffer to avoid CPU overhead per substep; WebGPU dispatches are cheap to encode.
- **CFL limits:**
  - For particles advected through a grid, and for MPM, choose substeps so that max|v| · dt ≤ C · dx, with C about 0.5 to 1.
  - Get max|v| from a GPU reduction one frame late (no readback stall), or simply clamp velocity to C · dx / dt, which is the cheap, toy-friendly option.
  - Semi-Lagrangian grid advection itself is unconditionally stable, but particle integration and MPM are not.
- **Variable refresh:**
  - Drive the simulation from measured time (`requestAnimationFrame` timestamps, or native present timing) rather than frame counts.
  - Smooth dt, for example with the median of the last 5 frames, so VRR jitter does not change the force response.
  - Behaviours tuned per frame (the current WebGL2 edition) should be converted to per-second units.
- **Device-loss and timeout hygiene:** split huge passes (100M particles in one dispatch is fine; multi-second dispatches are not), handle `device.lost` by rebuilding resources, and keep a lower-quality preset ready.
- **Testing on software adapters:**
  - Headless Chromium with SwiftShader is useful for correctness tests in CI. NaN guards, dead-list counters, determinism of fixed-point P2G and indirect-argument clamping can all be checked there; the coordinator's run of a 32-byte-per-particle step shows the pipeline executes on SwiftShader.
  - Presenting a WebGPU canvas does not work there. In this container it failed both headless and headed under Xvfb, with every flag set tried, and pending promises rejected with "A valid external Instance reference no longer exists." Offscreen render targets, compute and `copyTextureToBuffer` readback all work, so CI tests should render offscreen and compare read-back pixels; presentation, resize, HDR output and frame pacing need machines with real GPUs. [Verified: coordinator measurement, 12 November 2026 (no URL)]
  - Any kernel that spin-waits on other invocations should be kept out of those runs, or given a non-spinning path. Gridwise warns that its subgroup emulation can stall on CPU-based WebGPU implementations, and decoupled look-back without fallback can hang where forward progress isn't guaranteed.
  - The CI adapter's shape differs from desktop GPUs: subgroup size 4, 32 KiB workgroup storage, 10 storage buffers per stage, 1 GiB buffers, 8,192-texel 2D textures and no `shader-f16` or `atomic-vec2u-min-max`. It does expose `subgroups`, `subgroup-size-control`, `float32-blendable`, `float32-filterable` and `timestamp-query`. Kernels that assume 32-wide subgroups, including the Gridwise sort's hardware-subgroup path (Q3), can misbehave there for that reason rather than because of a bug. [Verified: coordinator measurement, 12 November 2026 (no URL)]

### Gaps
- Glenn Fiedler's "Fix Your Timestep!" and other canonical timestep references could not be retrieved before the search budget ran out. The accumulator pattern above is standard practice but is not cited here.
- No sources were found on how often Tint (Dawn), Naga (wgpu) or WebKit's WGSL compiler actually remove `x != x` NaN checks; the bitcast guard is a precaution derived from the spec text.
- GPU watchdog timeouts (TDR) under WebGPU were not researched.
- No WebGPU source was found that quantifies MPM or SPH CFL constants for these demos.

## 7. Open-source WebGPU references and their licences

### Takeaway
Most of the useful WebGPU particle, fluid and sorting references are permissively licensed (MIT, BSD-3-Clause or Apache-2.0). They are safe to study, or to vendor with attribution. A few sort libraries and fluid demos still need a licence check before any code is reused.

### Cited Findings
Licence status was read directly from each repository's LICENSE file or README, unless marked "not confirmed".

**Official samples and engines**

| Reference | What it contains | Licence |
|---|---|---|
| [webgpu/webgpu-samples](https://github.com/webgpu/webgpu-samples) | computeBoids (1,500 boids, O(N²), workgroup 64); particles (50,000, probability-map spawning); bitonicSort | BSD-3-Clause (LICENSE.txt includes the "Neither the name…" clause) |
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | WebGPU/TSL compute examples: compute_particles (200,000); tsl_compute_attractors_particles (262,144); compute_particles_fluid (MLS-MPM, ≤131,072, 64³ grid); compute_birds (8,192); compute_particles_rain (50,000); compute_sort_bitonic (16,384) | MIT, "© 2010-2026 three.js authors" |
| [BabylonJS/Babylon.js](https://github.com/BabylonJS/Babylon.js) | GPUParticleSystem; 1M-capacity example; WebGL2 transform feedback | Apache-2.0 |
| [playcanvas/engine](https://github.com/playcanvas/engine) | WebGPU portable radix sort, plus NVIDIA-gated OneSweep | MIT-style text ("Permission is hereby granted, free of charge…", © 2011-2026 PlayCanvas Ltd.) |
| [djeedai/bevy_hanabi](https://github.com/djeedai/bevy_hanabi) | Rust/Bevy GPU particles in WGSL; WebGPU on wasm | MIT OR Apache-2.0 |

[Verified: every licence in this table re-read from the repository's LICENSE file on 12 November 2026 (webgpu-samples LICENSE.txt, three.js LICENSE, Babylon.js license.md, PlayCanvas LICENSE, bevy_hanabi LICENSE-MIT and LICENSE-APACHE2)]

**MPM and fluid simulations**

| Reference | What it contains | Licence |
|---|---|---|
| [matsuoka-601/webgpu-ocean](https://github.com/matsuoka-601/webgpu-ocean) | MLS-MPM plus SPH; about 100k particles on iGPU, about 300k on discrete GPUs | MIT |
| [matsuoka-601/WaterBall](https://github.com/matsuoka-601/WaterBall) | MLS-MPM on a sphere | MIT |
| [matsuoka-601/Splash](https://github.com/matsuoka-601/Splash) | MLS-MPM, 1 substep; `million` branch reaches 1.6M | MIT |
| [holtsetio/flow](https://github.com/holtsetio/flow) | MLS-MPM in three.js TSL | MIT |
| [electronicarts/pbmpm](https://github.com/electronicarts/pbmpm) | PB-MPM WebGPU reference (SIGGRAPH 2024) | BSD-3-Clause |
| [wumpf/blub](https://github.com/wumpf/blub) | wgpu 3D APIC fluid; atomic or linked-list P2G; count-and-prefix-sum re-binning | MIT (© 2020 Andreas Reich) |
| [PavelDoGreat/WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) | Touch-splat stable fluids (WebGL; concept reference) | MIT |
| [SebLague/Fluid-Sim](https://github.com/SebLague/Fluid-Sim) | Unity compute-shader SPH; concept reference with development videos | MIT (© 2023 Sebastian Lague) |

[Verified: webgpu-ocean (MIT, © 2025 matsuoka-601), Splash (MIT), pbmpm (BSD-3-Clause, LICENSE.md, © 2024 Electronic Arts) and blub (MIT, © 2020 Andreas Reich) re-read from their LICENSE files; WaterBall, flow, WebGL-Fluid-Simulation and Fluid-Sim were not re-checked]

**Prefix sums and sorting**

| Reference | What it contains | Licence |
|---|---|---|
| [gridwise-webgpu/gridwise](https://github.com/gridwise-webgpu/gridwise) | DLDF scan/reduce, OneSweep radix sort, subgroup emulation; npm `gridwise` | Apache-2.0 |
| [b0nes164/GPUPrefixSums](https://github.com/b0nes164/GPUPrefixSums) | Decoupled Fallback; survey of scans; WGPU testbed | MIT (© 2024 Thomas Smith), and the same LICENSE file also carries CUB's BSD-3-Clause text for CUB-derived code [Verified correction: https://github.com/b0nes164/GPUPrefixSums/blob/HEAD/LICENSE] |
| [b0nes164/GPUSorting](https://github.com/b0nes164/GPUSorting) | DeviceRadixSort and OneSweep in D3D12, CUDA and Unity; no WebGPU port in the README (PlayCanvas ships a WGSL port of its OneSweep) | MIT (© 2024 Thomas Smith) for its own code, but the LICENSE file also covers bundled FidelityFX SDK and DirectStorage code (MIT), CUB code (BSD-3-Clause) and bb_segsort code under LGPL-2.1, so check which licence covers each file before vendoring [Verified correction: https://github.com/b0nes164/GPUSorting/blob/HEAD/LICENSE] |
| [linebender/vello](https://github.com/linebender/vello) | GPU 2D renderer where Decoupled Fallback development continued (per GPUPrefixSums) | Apache-2.0 OR MIT; research shader files also Unlicense |
| [kishimisu/WebGPU-Radix-Sort](https://github.com/kishimisu/WebGPU-Radix-Sort) | 4-way radix sort and scan; npm `webgpu-radix-sort`; used by WebGPU-Ocean | MIT per package.json `license` field (no LICENSE file found) |
| [KeKsBoTer/wgpu_sort](https://github.com/KeKsBoTer/wgpu_sort) | Rust key-value radix sort with benchmarks | BSD-2-Clause per Cargo.toml `license` field (no LICENSE file found) |
| [Lichtso/splatter](https://github.com/Lichtso/splatter) | Rust/wgpu Onesweep-style sort | Not checked |

[Verified: Gridwise (Apache-2.0, LICENSE.txt), Vello (LICENSE-MIT and LICENSE-APACHE present), webgpu-radix-sort (MIT in package.json v1.0.7, no LICENSE file) and wgpu_sort (BSD-2-Clause in Cargo.toml, no LICENSE file) re-read on 12 November 2026]

**Smaller demos and N-body**

| Reference | What it contains | Licence |
|---|---|---|
| [hzy/ParticleLife](https://github.com/hzy/ParticleLife) | WebGPU Particle Life, 8,000 particles | MIT |
| [jrprice/NBody-WebGPU](https://github.com/jrprice/NBody-WebGPU) | Simple WebGPU N-body | Not checked |
| [lechebs/nbody](https://github.com/lechebs/nbody) | CUDA Barnes-Hut; performance reference only | Not checked |

- **WebGPU and WGSL specifications** (editor's drafts on GitHub, used here for limits, atomics, packing and floating-point rules): W3C documents — [gpuweb/gpuweb](https://github.com/gpuweb/gpuweb)
- **Browser support:** WebGPU is available in all major browsers, per Khronos's SIGGRAPH 2026 WebGL/WebGPU slides — [Khronos SIGGRAPH 2026](https://www.khronos.org/developers/linkto/webgl-and-webgpu-sigg26) (search summary, not verified) [Verified with limits: BCD gives Chrome 113, Firefox 141 (Windows; Apple-silicon Macs from 145/147; not Linux or Intel Macs) and Safari 26, https://github.com/mdn/browser-compat-data/blob/main/api/GPU.json] Chrome 113 covers only ChromeOS, macOS and Windows. Chrome has WebGPU on Linux only from 144: BCD says "Intel Gen12+ GPUs only", and Chromium 156's GPU blocklist (entry 186) allows Intel Gen12+ with Mesa 22.0 or newer and NVIDIA drivers 535.183.01 or newer, which leaves AMD and older Intel Linux GPUs blocked by default. [Verified correction: https://github.com/mdn/browser-compat-data/blob/main/api/GPU.json; https://github.com/chromium/chromium/blob/156.0.8078.96/gpu/config/software_rendering_list.json]

### Inferences
- **Reuse policy:** for an original commercial product, prefer re-implementing algorithms from the papers. The key ones are:
  - Hoetzlein counting-sort binning
  - Hu et al. MLS-MPM and Lewin PB-MPM
  - Bridson curl noise
  - GPU Gems ch. 38 stable fluids
  - Merrill/Garland and Adinets/Merrill scans and sorts
  - Decoupled Fallback

  Use Gridwise (Apache-2.0) or PlayCanvas-style sorts as dependencies or references. Code vendored from MIT or BSD sources needs its copyright notice kept. Apache-2.0 code also carries NOTICE and patent terms. Do not copy files from GPUSorting without checking them: its LICENSE includes LGPL-2.1 code (bb_segsort), whose terms differ from MIT. [Verified: https://github.com/b0nes164/GPUSorting/blob/HEAD/LICENSE]
- **Best starting points per subsystem:**
  - Simple compute particles: webgpu-samples (computeBoids, particles) and the three.js compute examples.
  - MLS-MPM: WebGPU-Ocean, Splash and the three.js fluid example. All three show fixed-point P2G at 10^5 to 10^6 particles.
  - Scans and sorts: Gridwise and PlayCanvas's radix sort, both with portability gating.
  - Life cycle in WGSL: Bevy Hanabi.
- **Concept references:** Sebastian Lague's fluid videos, and the Refik Anadol-like look of holtsetio/flow, should inform technique only, not visual identity, given Tactilume's goal of being original.

### Gaps
- Licence files not found or not checked:
  - isjackwild/stable-fluids-in-webgpu (no LICENSE file at the default path)
  - kishimisu's WebGPU-Fluid-Simulation (raw README and LICENSE not found under kishimisu or indiana-dev)
  - splatter
  - rreusser's notebook
  - jrprice/NBody-WebGPU
  - lechebs/nbody
  - GraphWaGu
  - lisyarus's Particle Life code (repository not located)
- webgpu-radix-sort (MIT) and wgpu_sort (BSD-2-Clause) have licences declared only in package metadata, with no LICENSE file. Confirm them with the authors before vendoring.
- The official wgpu (gfx-rs) examples were not reviewed.
- Blocked hosts that would have to be allowed in the session's network settings to read the primary pages: lisyarus.github.io, gridwise-webgpu.github.io (its docs were read from GitHub source instead), linebender.org, wickedengine.net and tympanus.net.

## Verification

Checked on 12 November 2026 against primary sources on GitHub (raw files read through raw.githubusercontent.com and cited in their github.com form) and against measurements from this container: headless Chromium 153.0.8010.12 (Playwright 1.63.0) on Linux, SwiftShader fallback adapter, only `--enable-unsafe-webgpu`. Rows marked "first pass" were corrected in the interrupted first pass and re-read in the second. Inline tags elsewhere (example particle counts, READMEs, other licences) are not repeated here.

| Claim | Verdict | Source |
|---|---|---|
| Electron 45 pins Chromium 156.0.8078.96; Chrome 157 has been the stable channel since 3 November 2026 | confirmed | https://github.com/electron/electron/blob/45-x-y/DEPS; https://github.com/mdn/browser-compat-data/blob/main/browsers/chrome.json |
| Limits: core defaults of 128 MiB per storage binding, 256 MiB per buffer, 65,535 workgroups per dimension, 256 invocations per workgroup (128 in compatibility mode), 16 KiB workgroup storage and 8 storage buffers per stage; every D3D12 adapter gets a 2 GiB buffer and a 2,147,483,644-byte binding (pre-Adreno 8xx Qualcomm 2^28), NVIDIA Vulkan is capped at 2 GiB−4, and 4 GiB−4 is possible only on Metal or other Vulkan drivers; so 100M × 16 B fits one binding and 100M × 32 B does not | confirmed | https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs; https://github.com/google/dawn/blob/main/src/dawn/common/Constants.h; https://github.com/google/dawn/blob/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp; https://github.com/google/dawn/blob/main/src/dawn/native/vulkan/PhysicalDeviceVk.cpp; https://github.com/google/dawn/blob/main/src/dawn/native/metal/PhysicalDeviceMTL.mm; https://github.com/google/dawn/blob/main/src/dawn/native/Limits.cpp |
| WebGPU availability: Chrome 113, Firefox 141 (Windows; Apple-silicon Macs from 145/147), Safari 26 | corrected: Chrome 113 covers only ChromeOS, macOS and Windows. Linux starts at 144, and Chromium 156 allows it there only on Intel Gen12+ with Mesa 22.0+ and NVIDIA 535.183.01+, so AMD and older Intel are blocked by default | https://github.com/mdn/browser-compat-data/blob/main/api/GPU.json; https://github.com/chromium/chromium/blob/156.0.8078.96/gpu/config/software_rendering_list.json |
| Optional features and WGSL extensions: shader-f16 in Chrome 120 and Safari 26; subgroups in Chrome 134 and Safari 27.3; subgroup-size-control in Chrome 152; float32-blendable in Chrome 132, Safari 26 and Firefox 158; float32-filterable in Chrome 119 only; `subgroup_id` and `subgroup_uniformity` only at "intent to ship" | corrected: the versions hold (Chrome's Linux entries start at 144), but Safari 27.3 is a beta (stable 27.2 has no subgroups), and both WGSL extensions shipped, in Chrome 144 and 145; Chromium 153 here reports both | https://github.com/mdn/browser-compat-data/blob/main/api/GPUSupportedFeatures.json; https://github.com/mdn/browser-compat-data/blob/main/api/WGSLLanguageFeatures.json; https://github.com/mdn/browser-compat-data/blob/main/browsers/safari.json; coordinator measurement |
| atomic-vec2u-min-max: on by default from Chromium 157; Electron 45 (Chromium 156) only with `--enable-webgpu-developer-features`; Dawn needs int64 atomics (D3D12, Vulkan) or an M2 or later GPU (Metal) | corrected: Chromium 156 also exposes it with `--enable-unsafe-webgpu`, and D3D12 also needs DXC with shader model 6.6 | https://github.com/chromium/chromium/blob/156.0.8078.96/gpu/command_buffer/service/webgpu_decoder_impl.cc; https://github.com/chromium/chromium/blob/157.0.8103.81/gpu/command_buffer/service/webgpu_decoder_impl.cc; https://github.com/google/dawn/blob/main/src/dawn/native/d3d12/PhysicalDeviceD3D12.cpp; https://github.com/google/dawn/blob/main/src/dawn/native/metal/PhysicalDeviceMTL.mm; https://github.com/google/dawn/blob/main/src/dawn/native/vulkan/PhysicalDeviceVk.cpp |
| WGSL rules: atomics only on u32 and i32, plus `atomic<vec2<u32>>` min/max stores (storage only, no return value) behind the extension; the Finite Math Assumption lets compilers drop `x != x` NaN checks; rgba16float blending is core, 32-bit float blending needs float32-blendable | confirmed | https://github.com/gpuweb/gpuweb/blob/main/wgsl/index.bs; https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs |
| No fixed subgroup size: Vulkan reports the driver's range, Metal uses 4 to 64, D3D12 uses WaveLaneCountMin to 128; SwiftShader measured 4 | confirmed | https://github.com/gpuweb/gpuweb/blob/main/proposals/subgroups.md; coordinator measurement |
| Gridwise sort: needs `maxComputeWorkgroupStorageSize` 32,768 (D3D12 and SwiftShader both report it), at most 2^30 keys, length a multiple of 4, Apache-2.0; on SwiftShader's 4-lane subgroups it "may be refused" | corrected: the requirements and licence hold, but on SwiftShader the sort is not refused. It sizes tiles as if subgroups were at least 32 lanes, so CI should pass `disableSubgroups: true` or use a non-spinning sort. Correctness at width 4 was not tested | https://github.com/gridwise-webgpu/gridwise/blob/HEAD/README.md; https://github.com/gridwise-webgpu/gridwise/blob/HEAD/docs/sort.md; https://github.com/gridwise-webgpu/gridwise/blob/HEAD/src/onesweep.mjs; https://github.com/gridwise-webgpu/gridwise/blob/HEAD/src/primitive.mjs; https://github.com/gridwise-webgpu/gridwise/blob/HEAD/docs/subgroup-strategy.md |
| Measured throughput behind the cost model: Dawn copy kernels at 360–370 GB/s (M1 Max) and 808 GB/s (V100), Gridwise per-pass sort times and the V100 look-back share (≤5% for 64-bit, about 22% for 32-bit keys), and the wgpu_sort table | corrected (first pass): the wgpu_sort table lacked its Intel 20M cell and is native wgpu averaged over 1,000 runs, not a browser; the Gridwise figures hold | https://github.com/gridwise-webgpu/gridwise/blob/HEAD/docs/sort.md; https://github.com/KeKsBoTer/wgpu_sort/blob/HEAD/README.md |
| PlayCanvas enables OneSweep only when `adapter.info.vendor` is "nvidia" and subgroups are at most 32 wide, and uses its portable sort elsewhere | confirmed | https://github.com/playcanvas/engine/blob/HEAD/src/scene/graphics/radix-sort/compute-radix-sort.js |
| Licences for reuse: GPUSorting and GPUPrefixSums are MIT; webgpu-radix-sort is MIT and wgpu_sort is BSD-2-Clause | corrected (first pass): GPUSorting's LICENSE also covers CUB (BSD-3-Clause), FidelityFX and DirectStorage (MIT) and bb_segsort (LGPL-2.1); GPUPrefixSums also carries CUB's BSD-3-Clause text; the last two licences appear only in package metadata, with no LICENSE file | https://github.com/b0nes164/GPUSorting/blob/HEAD/LICENSE; https://github.com/b0nes164/GPUPrefixSums/blob/HEAD/LICENSE; https://github.com/kishimisu/WebGPU-Radix-Sort/blob/main/package.json; https://github.com/KeKsBoTer/wgpu_sort/blob/master/Cargo.toml |
| SwiftShader CI adapter: vendor "google", architecture "swiftshader", empty description; 32 KiB workgroup storage, 10 storage buffers per stage, 1 GiB buffers, 8,192-texel 2D textures, subgroup size 4, no shader-f16; canvas presentation fails but offscreen rendering, compute and readback work; the 32 B step took about 22 ms at 20k and 131 ms at 300k particles | confirmed | coordinator measurement, 12 November 2026 (no URL) |
| TU Wien thesis: 10M particles simulated and rendered at about 63 fps on a GTX 1060 (the largest measured WebGPU figure found) | unverifiable | https://www.cg.tuwien.ac.at/research/publications/2023/PETER-2023-PSW/ (host blocked; no GitHub copy found) |
| web3dsurvey: 92% of surveyed Windows systems and 100% of NVIDIA ones expose a storage binding of at least 2,147,483,644 bytes | unverifiable | https://web3dsurvey.com/webgpu/limits/maxStorageBufferBindingSize/platform/Windows (host blocked; consistent with Dawn's D3D12 code) |
| gpuweb #4894 (f32 atomics): still open in Milestone 3, a November 2025 resolution to write a proposal, and an October 2026 report that the CAS polyfill does not hang but is slow | unverifiable | https://github.com/gpuweb/gpuweb/issues/4894 (the page returned HTTP 403 and the GitHub API is not enabled for this repository in this session) |

Totals: 15 claims checked; 6 confirmed, 6 corrected, 3 unverifiable.
