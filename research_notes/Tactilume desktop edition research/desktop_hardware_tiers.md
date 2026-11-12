# Desktop and laptop hardware tiers for Tactilume Desktop (as of 2026-11-12)

> **How these notes were made (read first).**
> - **First pass.** WebFetch could not reach any external host (session DNS allowlist). Most market and spec figures therefore come from WebSearch result summaries and the URLs those searches returned.
> - **Steam figures.** I could not open Valve's survey tables, so every Steam Hardware Survey number is labelled *(search summary, not verified — month)*. Treat each one as a secondary report, not Valve's table.
> - **Second pass (after the coordinator's network note).** I verified runtime-detection facts against primary sources on GitHub and developer.apple.com: Chromium source (`chromium/chromium` mirror), MDN `browser-compat-data`, the gpuweb spec source (`spec/index.bs`), Dawn's `gpu_info.json`, Electron's docs and release-branch `DEPS` files, and Apple Metal documentation. All were fetched on 2026-11-12. These items are marked **(primary source)**.
> - **Correction.** The old claim that `navigator.deviceMemory` is capped at 8 is wrong for current Chrome. Since Chrome 147, desktop values are 2–32. See Section 6. [Verified: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Navigator.json; https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/common/device_memory/approximated_device_memory.cc; measured 16 on a 16 GB machine in Chromium 153]
> - **Fact-check pass (2026-11-12).** Decision-critical claims carry [Verified], [Verified correction] or [Unverified] tags, and a Verification table is at the end. Measured facts come from this container (headless Chromium 153.0.8010.12 with a SwiftShader adapter); Electron 45 ships Chromium 156.
> - **Other labels.** Spec-sheet figures were retrieved on 2026-11-12. My own arithmetic is marked **calc**. Planning recommendations appear only under "Inferences".

## 1. What the latest Steam Hardware & Software Survey shows (October 2026)

### Takeaway
According to secondary reports of the **October 2026** survey, which I could not verify against Valve's tables, the typical Steam PC has:
- Windows 11 (about 72.5%);
- a 6- or 8-core CPU;
- 16 GB or 32 GB of RAM;
- an 8 GB or 16 GB NVIDIA GPU of RTX 3060, 4060, 5060 Ti or 5070 class;
- a 1080p primary display (about 50%), with 1440p at about 22 to 27% and 4K at about 5%.

Valve publishes no refresh-rate or HDR data. Month-to-month swings of up to 5 points, driven by changes in the respondents' language mix, make any single month noisy.

### Cited Findings

**Operating systems**
- Windows 93.70%, Linux 3.95%, macOS 2.35% of all respondents *(search summary, not verified — Oct 2026)*. [Unverified: Valve's table is not reachable. One fact-check search found the same three figures reported independently by Phoronix (https://phoronix.com/news/Steam-Survey-October-2026) and PBX Science, and Windows Central reports Windows 11 at 72.51%.] — [Windows Forum](https://windowsforum.com/news/october-2026-steam-survey-linux-at-3-95-windows-11-leads-as-revised-data-clouds-monthly-gains.450633/); [VideoCardz](https://videocardz.com/newz/geforce-rtx-3060-retakes-top-spot-on-steam-as-linux-approaches-4-share)
- Windows 11 rose 1.17 points to 72.51%. Windows 10 fell 2.50 points to 21.11%, about a year after its October 2025 end of support *(search summary, not verified — Oct 2026)*. — [Etalongame](https://etalongame.com/en/steam-hardware-survey-october-2026/); [Shattered.io](https://shattered.io/steam-hardware-survey-october-2026-windows-11-72-51-linux-3-95-2026/); [Tech-Insider](https://tech-insider.org/steam-hardware-survey-august-2026/)
- Linux at 3.95% is only about 0.05 points above September's revised 3.90%. The widely reported "+0.90" gain compares against September's originally published 3.05% *(search summary, not verified — Sept/Oct 2026)*. — [PBX Science](https://pbxscience.com/linux-climbs-back-to-3-95-on-steam-as-amd-holds-two-thirds-of-linux-gamers/)
- Linux had already passed 4% earlier in 2026, so 3.95% is not a record *(search summary, not verified — 2026, month not given)*. The fact-check search summary gives the 2026 peak as about 5.33% in March and 4.52% in April [Unverified: search summary only]. — [VideoCardz](https://videocardz.com/newz/geforce-rtx-3060-retakes-top-spot-on-steam-as-linux-approaches-4-share)
- Linux distributions as a share of Linux respondents: CachyOS 16.39%, SteamOS Holo 13.89%, Arch Linux 8.92%. One outlet separately lists "SteamOS" at 8.09% *(search summary, not verified — Oct 2026)*. — [ESReality](https://www.esreality.com/post/2975437/linuxreaches395inoctobersteamsurvey); [daily.dev](https://daily.dev/posts/steam-on-linux-just-under-4-for-october-2026-ndlqewx4a)
- AMD hardware accounts for about two-thirds of Linux gamers (headline claim) *(search summary, not verified — Oct 2026)*. — [PBX Science](https://pbxscience.com/linux-climbs-back-to-3-95-on-steam-as-amd-holds-two-thirds-of-linux-gamers/)
- Mac chips on Steam: Apple M4 19.60%, M1 18.06%, M2 13.08%, Intel Macs 14.36%, which implies about 85% Apple Silicon *(search summary, not verified — Dec 2025 data, reported Jan 2026)*. — [AppleInsider](https://appleinsider.com/articles/26/01/12/forget-m1-m4-is-the-dominant-apple-silicon-chip-on-steam); [MacTrast](https://www.mactrast.com/2026/01/m4-is-the-top-apple-silicon-chip-among-mac-gamers-on-steam/amp/)
- macOS Tahoe 26 ran on more than 25% of Steam Macs. A French outlet cites nearly 30% for macOS 26.1 without a date *(search summary, not verified — Dec 2025)*. I found no 2026 macOS version split. — [It's FOSS](https://itsfoss.com/news/macos-steam-dip-25/); [Mac4Ever](https://www.mac4ever.com/gaming/194090-fin-de-regne-pour-le-m1-la-puce-m4-devient-officiellement-la-preferee-des-joueurs-mac)

**CPU**
- Eight-core CPUs lead at 28.68%, with six-core at 27.29%. A Valve Windows-table excerpt shows 28.63% for eight cores *(search summary, not verified — Oct 2026)*. — [Wccftech](https://wccftech.com/october-2026-steam-hardware-survey-16-gb-ram-reclaims-top-spot-intel-gains-cpu-share-linux-approaches-4/); [Valve survey page (excerpt via search)](https://store.steampowered.com/hwsurvey/Steam-Hardware-Software-Survey-Welcome-to-Steam)
- Eight-core CPUs became the most common configuration *(search summary, not verified — July 2026)*. — [Club386](https://www.club386.com/steam-hardware-survey-july-2026/); [Tom's Hardware](https://www.tomshardware.com/pc-components/16gb-gpus-and-8-core-cpus-officially-become-the-most-popular-configs-on-steam-latest-hardware-survey-shows-modern-gamings-growing-hunger-for-more-resources)
- Windows CPU vendors: Intel 53.48% and AMD 46.51%, reversing September's AMD 47.41% *(search summary, not verified — Oct 2026; outlet attribution also unverified)*. — [Wccftech ("Intel Gains CPU Share")](https://wccftech.com/october-2026-steam-hardware-survey-16-gb-ram-reclaims-top-spot-intel-gains-cpu-share-linux-approaches-4/); [Hardware Busters](https://hwbusters.com/news/steam-hardware-survey-october-undoes-september-putting-16gb-and-the-rtx-3060-back-on-top/)

**System RAM**
- 16 GB at 41.42%, ahead of 32 GB at 37.06% *(search summary, not verified — Oct 2026)*. — [Guru3D](https://www.guru3d.com/story/steam-hardware-survey-october-2026-16-gb-ram-regains-lead-over-32-gb/); [Hardware Busters](https://hwbusters.com/news/steam-hardware-survey-october-undoes-september-putting-16gb-and-the-rtx-3060-back-on-top/)
- 32 GB had briefly led with 42.22% *(search summary, not verified — Sept 2026)*. — [ShiftDelete](https://shiftdelete.net/en/steam-hardware-survey)

**GPU models**
- Combined table: GeForce RTX 3060 3.62%, up from 3.54%. RTX 5070 3.56%, down from 5.86% in September, when it was #1 *(search summary, not verified — Oct 2026 vs Sept 2026)*. — [TweakTown](https://www.tweaktown.com/news/114454/rtx-5070-loses-its-steam-gpu-crown-after-just-one-month-as-rtx-3060-returns-to-the-top/index.html); [Digital Citizen](https://www.digitalcitizen.life/nvidia-rtx-5070-most-popular-gpu-steam-hardware-survey-september-2026/)
- In Valve's PC-only GPU table, the RTX 3060 and RTX 5070 are tied at 3.78% *(search summary, not verified — Oct 2026)*. — [Guru3D](https://www.guru3d.com/story/steam-october-survey-puts-the-rtx-3060-back-at-the-a-sampling-caveat/)
- The top six cards sit within 0.65 points of each other *(search summary, not verified — Oct 2026; outlet attribution unverified)*. — [TweakTown](https://www.tweaktown.com/news/114454/rtx-5070-loses-its-steam-gpu-crown-after-just-one-month-as-rtx-3060-returns-to-the-top/index.html); [BottleneckPC ranking](https://bottleneckpc.com/blog/most-popular-gpus-steam-survey)
- RTX 5060 Ti reached 3.87% *(search summary, not verified — Sept 2026)*. — [Tech-Insider](https://tech-insider.org/steam-hardware-survey-rtx-5070-32gb-ram-2026/)
- Laptop GPUs are listed separately and can top the chart: the RTX 4060 Laptop GPU took the lead *(search summary, not verified — an earlier 2026 month; exact month not confirmed)*. — [Windows Report](https://windowsreport.com/steam-survey-shows-windows-11-growing-as-rtx-4060-laptop-gpu-takes-lead/)

**VRAM**
- 8 GB is the most common capacity at 26.92% (+0.21), with 16 GB close behind at 26.35% *(search summary, not verified — Oct 2026)*. — [Wccftech](https://wccftech.com/october-2026-steam-hardware-survey-16-gb-ram-reclaims-top-spot-intel-gains-cpu-share-linux-approaches-4/); [Valve survey page (excerpt via search)](https://store.steampowered.com/hwsurvey/Steam-Hardware-Software-Survey-Welcome-to-Steam)
- 16 GB overtook 8 GB *(search summary, not verified — around July 2026)*. — [Club386](https://www.club386.com/steam-hardware-survey-july-2026/); [tbreak](https://tbreak.com/steam-hardware-survey-16gb-vram-overtakes-8gb/); [PC Guide](https://www.pcguide.com/news/16gb-vram-continues-to-grow-in-latest-steam-survey-widening-the-gap-to-12gb-and-8gb-graphics-card-owners/)
- 12 GB was about 13.01%, the only 12 GB figure I found *(search summary, not verified — June 2026)*. — [Guru3D](https://www.guru3d.com/story/steam-june-survey-16gb-ram-gains-ground-as-32gb-adoption-slows/)
- Conflicts *(search summaries, not verified — Aug/Sept 2026)*:
  - One outlet gives 26.92% for 16 GB in August, which is suspiciously identical to the October 8 GB figure.
  - Another quotes 35.78% for 8 GB in a September Windows-only table.
  - One headline says 16 GB overtook 8 GB, which contradicts the October figures.

  — [Tech-Insider](https://tech-insider.org/steam-hardware-survey-august-2026/); [Wccftech](https://wccftech.com/october-2026-steam-hardware-survey-16-gb-ram-reclaims-top-spot-intel-gains-cpu-share-linux-approaches-4/)

**Primary display resolution**
- 1920×1080 50.23% (+2.32), 2560×1440 21.82% (−5.22), 3840×2160 5.05% (+0.26) *(search summary, not verified — Oct 2026)*. — [Hardware Busters](https://hwbusters.com/news/steam-hardware-survey-october-undoes-september-putting-16gb-and-the-rtx-3060-back-on-top/); [Wccftech](https://wccftech.com/october-2026-steam-hardware-survey-16-gb-ram-reclaims-top-spot-intel-gains-cpu-share-linux-approaches-4/); [ShiftDelete](https://shiftdelete.net/en/steam-hardware-survey)
- 1080p 47.91%, 1440p 27.04%, 4K 4.79% *(search summary, not verified — Sept 2026)*. 1080p 50.52% *(search summary, not verified — Aug 2026)*. — [Tech-Insider (rolling article)](https://tech-insider.org/steam-hardware-survey-august-2026/); [ShiftDelete](https://shiftdelete.net/en/steam-hardware-survey)

**Refresh rate**
- Valve publishes no refresh-rate statistics. Users have asked for them on the Steam forums, and a 2018 post reports a 144 Hz G-Sync monitor showing as 60 Hz in the survey. — [Steam Community thread](https://steamcommunity.com/discussions/forum/10/3004430047194521857/?l=japanese); [Steam Community (2018)](https://steamcommunity.com/discussions/forum/1/1696043806576133044)
- A third-party claim that 58.4% of Steam users have displays above 60 Hz has no Steam source. I treat it as unreliable. — [VoxBooster](https://voxbooster.com/blog/monitor-refresh-rate-statistics-2026)

**Biases and caveats**
- The survey is voluntary, anonymous and opt-in. It is a snapshot of participating Steam users, not a census. — [PBX Science](https://pbxscience.com/linux-climbs-back-to-3-95-on-steam-as-amd-holds-two-thirds-of-linux-gamers/); [Guru3D](https://www.guru3d.com/story/steam-october-survey-puts-the-rtx-3060-back-at-the-a-sampling-caveat/)
- The language mix drives the swings. Simplified Chinese respondents fell 9.41 points to 21.98% and English rose 4.84 points to 39.04%, and outlets cite this as the main cause of the September-to-October reversals *(search summary, not verified — Oct 2026)*. — [daily.dev](https://daily.dev/posts/steam-on-linux-just-under-4-for-october-2026-ndlqewx4a); [Hardware Busters](https://hwbusters.com/news/steam-hardware-survey-october-undoes-september-putting-16gb-and-the-rtx-3060-back-on-top/)
- Valve revises published numbers (September Linux went from 3.05% to 3.90%). The combined, PC-only and Windows-only tables give different values for the same item. — [PBX Science](https://pbxscience.com/linux-climbs-back-to-3-95-on-steam-as-amd-holds-two-thirds-of-linux-gamers/); [Guru3D](https://www.guru3d.com/story/steam-october-survey-puts-the-rtx-3060-back-at-the-a-sampling-caveat/)

### Inferences
All of these rest on the unverified search summaries above.
- **The median Steam desktop or laptop** is Windows 11 with 6 to 8 cores, 16 to 32 GB RAM, an 8 to 16 GB NVIDIA GPU around RTX 3060, 4060 or 5060 Ti class, and a 1920×1080 display. This should anchor the **Recommended** tier, not the Minimum.
- Combining October's 8 GB (26.92%) and 16 GB (26.35%) with June's 12 GB (about 13%) gives about two-thirds of respondents with at least 8 GB of dedicated VRAM, before counting the 24 GB+ buckets. This is rough because it mixes months.
- Windows 10 still has about 21% share. Supporting Windows 10 22H2 x64 at Minimum costs little, and Electron 45 still supports it: its README lists "Windows (Windows 10 and up)" and "macOS (Ventura and up)" [Verified: https://raw.githubusercontent.com/electron/electron/v45.3.0/README.md]. Label it "unsupported by Microsoft". macOS 12 and older cannot run Electron 45 at all.
- Linux (about 4%) and macOS (about 2.4%) are small but distinct audiences. Part of the SteamOS share is Steam Deck handhelds, which are out of scope. Linux skews to AMD GPUs on Mesa drivers. (Cross-file note: desktop_app_shell.md plans for Steam Deck/SteamOS, so scope is a product decision. Either way, AMD GPUs on Linux are blocked from WebGPU by default in Chromium 156, so this audience runs the WebGL2 renderer unless WebGPU is force-enabled; see Section 5.)
- Use a 3 to 6 month average and the PC-only tables for tier decisions. The 1440p share alone swung 5 points in one month.
- Steam's population is gamers. A creative "light toy" audience probably includes more non-gaming laptops (integrated GPUs) and Macs, so keep the Minimum tier achievable on integrated graphics.

### Gaps
- Valve's tables were unreachable, and every Steam figure above needs checking against store.steampowered.com/hwsurvey once that host is allowed.
- Missing for October 2026: the full top-20 GPU list (including RTX 4060, RTX 4060 Laptop, RTX 3050 and the AMD and Intel rows), the 8 GB RAM share, 12 GB and 24 GB+ VRAM, the logical-processor (thread) distribution, ultrawide (3440×1440), 16:10 laptop resolutions (1920×1200, 2560×1600), 1366×768, and the 2026 macOS and Apple Silicon splits.
- The survey does not report laptop vs desktop share, and it has no refresh-rate or HDR fields.

## 2. GPU families in active use, their specs, and representative GPUs per tier

### Takeaway
Paper FP32 TFLOPS are not comparable across vendors. RDNA 3/4 "dual-issue" figures are roughly 2× the useful rate. For a particle toy, **memory bandwidth and VRAM are the better tier keys**.

The installed base is stable. No new desktop GPU generation shipped in 2026, and the next refresh (RTX 50 Super, RDNA 5) is expected in 2027 or later.

Integrated GPUs range from about 68 GB/s (Iris Xe) to 256 GB/s (Strix Halo) and 614 GB/s (M5 Max). A few integrated or SoC parts therefore reach discrete-class tiers.

### Cited Findings

**Market context (2026)**
- NVIDIA reportedly plans no new RTX gaming GPUs in 2026. RTX 50 Super is expected at CES 2027 at the earliest, and RTX 60 likely in 2028. — [Tom's Hardware](https://www.tomshardware.com/pc-components/gpus/report-claims-nvidia-will-not-be-releasing-any-new-rtx-gaming-gpus-in-2026-rtx-60-series-likely-debuting-in-2028); [Notebookcheck](https://www.notebookcheck.net/Nvidia-RTX-50-Super-series-launch-tipped-once-again-later-than-expected.1317926.0.html)
- AMD RDNA 5 is expected in the second half of 2027, possibly early 2028. — [PCGH](https://www.pcgameshardware.de/Grafikkarten-Grafikkarte-97980/News/GPU-Rumors-RDNA-5-RTX-50-Super-Intel-Arc-Analysis-1545000/)
- June 2026: RTX 50 supply was cut by about 20% and prices were climbing, with no desktop refresh confirmed. — [TechTimes](https://www.techtimes.com/articles/318772/20260621/nvidia-rtx-50-gpu-shortage-supply-cut-20-prices-climbing-no-desktop-refresh-confirmed.htm)
- 2026 launches were minor revisions, for example the RX 9070 GRE and a 12 GB RTX 5070 for laptops. — [Tech-Insider](https://tech-insider.org/nvidia-skips-2026-gaming-gpus/)

**NVIDIA**
- RTX 50 (Blackwell, 2025), from NVIDIA's comparison table:

  | GPU | CUDA cores | Boost clock | Bandwidth |
  |---|---|---|---|
  | RTX 5090 | 21,760 | 2.41 GHz | 1,792 GB/s |
  | RTX 5080 | 10,752 | 2.62 GHz | 960 GB/s |
  | RTX 5070 Ti | 8,960 | 2.45 GHz | 896 GB/s |
  | RTX 5070 | 6,144 | 2.51 GHz | 672 GB/s |
  | RTX 5060 Ti | 4,608 | 2.57 GHz | 448 GB/s (128-bit) |

  — [NVIDIA compare](https://www.nvidia.com/en-us/geforce/graphics-cards/compare/); [BestGPUsForAI](https://www.bestgpusforai.com/gpu-comparison/5060-ti-vs-5070) [Unverified: nvidia.com was not reachable in the fact-check pass; the figures match NVIDIA's launch specifications as the checker knows them, but no source was re-read]
- FP32 (calc: cores × 2 × boost clock): 5090 about 104.9, 5080 about 56.3, 5070 Ti about 43.9, 5070 about 30.9, 5060 Ti about 23.7 TFLOPS. Notebookcheck lists the 5090 at 104.88 TFLOPS. — [Notebookcheck](https://www.notebookcheck.com/GeForce-RTX-5070-vs-GeForce-RTX-5070-Ti-vs-GeForce-RTX-5090_12952_12932_12931.247532.0.html)
- RTX 5060: 8 GB GDDR7, 128-bit, 448 GB/s. — [HMC-Tech](https://hmc-tech.com/gpu/nvidia-geforce-rtx-5060-vs-intel-arc-a750)
- RTX 4060: 8 GB, 128-bit, 272 GB/s, 15.11 TFLOPS. One site's 20.28 TFLOPS / 288 GB/s is an outlier. — [FPSBench](https://fpsbench.com/compare/gpu/nvidia-geforce-rtx-4060-vs-nvidia-geforce-gtx-1650); [AskGeek (outlier)](https://askgeek.io/en/gpus/vs/NVIDIA_NVIDIA-GeForce-RTX-4060-vs-NVIDIA_GeForce-GTX-1650)
- RTX 3060 (12 GB): 12.74 TFLOPS, 360 GB/s. — [Sysrqmts](https://sysrqmts.com/gpus/compare/nvidia-geforce-gtx-1650-tu106-vs-nvidia-geforce-rtx-3060); [GPU-Monkey](https://www.gpu-monkey.com/en/compare_gpu-nvidia_geforce_gtx_1650_gddr5-vs-nvidia_geforce_rtx_3060)
- RTX 2060 (6 GB): 6.451 TFLOPS, 336 GB/s. — [FPSBench](https://fpsbench.com/compare/gpu/nvidia-geforce-gtx-1650-vs-nvidia-geforce-rtx-2060)
- GTX 1650 (4 GB): the GDDR5 version has 2.984 TFLOPS and 128.1 GB/s; the GDDR6 version about 2.85 TFLOPS and 192 GB/s. — [FPSBench](https://fpsbench.com/compare/gpu/nvidia-geforce-rtx-4060-vs-nvidia-geforce-gtx-1650); [Sysrqmts](https://sysrqmts.com/gpus/compare/nvidia-geforce-gtx-1650-tu106-vs-nvidia-geforce-rtx-3060)
- Laptop parts:
  - RTX 4060 Laptop: 8 GB GDDR6, 128-bit at 16 to 17 Gbps, giving 256 to 272 GB/s.
  - RTX 5070 Laptop: 8 GB GDDR7, 128-bit at 28 Gbps, giving 448 GB/s, and about 47% faster than the 4060 Laptop.
  - Laptop TFLOPS figures conflict between sources (22.06 vs 30.87 vs 43.94).
  - NVIDIA lists 8 GB and 12 GB configurations for Blackwell laptop SKUs.

  — [ChipVersus](https://chipversus.com/compare/geforce-rtx-4060-laptop-gpu-vs-geforce-rtx-5070-laptop-gpu); [GPUPrix](https://gpuprix.com/us/compare/geforce-rtx-4060-laptop-vs-geforce-rtx-5070-laptop); [NVIDIA laptop compare](https://nvidia.com/en-us/geforce/laptops/compare/)

**AMD**
- RDNA 4: RX 9070 XT has 16 GB GDDR6, 256-bit, up to 640 GB/s (AMD's figure) and 48.7 TFLOPS (dual-issue). — [Nanoreview](https://nanoreview.net/en/gpu/radeon-rx-9070-xt); [VideoCardz DB](https://videocardz.net/amd-radeon-rx-9070-xt)
- RX 9060 XT 16 GB: 128-bit at 20 Gbps (calc about 320 GB/s), "26 TFLOPS" (dual-issue). — [Notebookcheck](https://www.notebookcheck.net/Radeon-RX-9070-XT-vs-Radeon-RX-9060-XT_12956_13070.247598.0.html)
- RDNA 3: RX 7600 has 8 GB GDDR6, 128-bit, 18 Gbps, 288 GB/s and about 21.75 TFLOPS (dual-issue). — [GPU-Monkey](https://www.gpu-monkey.com/en/compare_gpu-amd_radeon_rx_9070_xt-vs-amd_radeon_rx_7600)
- Strix Halo Radeon 8060S (RDNA 3.5, 4 nm): 40 CUs and 2,560 shaders. About 14.85 TFLOPS at 2.9 GHz single-issue, or about 29.7 to 30 TFLOPS dual-issue. 256-bit LPDDR5X at 256 GB/s (one outlier says 273.1). — [CPU-Monkey](https://www.cpu-monkey.com/en/igpu-amd_radeon_8060s_graphics); [Flopper](https://flopper.io/gpu/amd-ryzen-ai-max-plus-395-128gb); [Nanoreview](https://nanoreview.net/en/gpu/radeon-8060s); [HMC-Tech (outlier)](https://hmc-tech.com/gpus/amd-radeon-8060s)
- Radeon 780M: 768 shaders. About 8.9 TFLOPS (dual-issue, 2.8 GHz) vs 4.51 TFLOPS (single-issue, 2.9 GHz) depending on the site. It is only about 5 to 10% faster than the 680M at best in synthetics. — [UltrabookReview](https://www.ultrabookreview.com/64396-amd-radeon-780m-benchmarks); [CPU-Monkey](https://www.cpu-monkey.com/en/igpu-amd_radeon_780m)
- Radeon 680M (RDNA 2): about 3.4 to 4.3 TFLOPS depending on the source. — [Deltia's Gaming](https://deltiasgaming.com/?p=391821); [UltrabookReview](https://www.ultrabookreview.com/64396-amd-radeon-780m-benchmarks)
- Radeon 890M (RDNA 3.5, 1,024 shaders): about 15 to 28% faster than the 780M. — [Nanoreview](https://nanoreview.net/en/gpu-compare/radeon-890m-vs-intel-iris-xe-graphics-g7-96eu); [Notebookcheck](https://www.notebookcheck.net/AMD-Zen-5-Strix-Point-iGPU-analysis-Radeon-890M-versus-Intel-Arc-Graphics-Apple-M3-and-Qualcomm-Adreno-X1-85.868475.0.html)
- Steam Machine (Valve, 2026; SteamOS 3, Arch-based with KDE Plasma):
  - CPU and memory: 6-core Zen 4, 16 GB DDR5.
  - GPU: semi-custom RDNA 3 with 28 CUs, 8 GB GDDR6, 2.45 GHz maximum sustained clock and 110 W.
  - Performance: Valve claims 4K60 "with FSR". One outlet estimates it below an RX 7600.
  - Launch status: one guide (23 June 2026) says it has launched (512 GB at £879); older sources describe it as pre-launch.

  — [Engadget](https://www.engadget.com/gaming/pc/everything-we-know-about-valves-new-steam-machine-200458817.html); [Box.co.uk](https://box.co.uk/blog/steam-machine-price-specs-features); [Tom's Guide](https://tomsguide.com/gaming/pc-gaming/valve-steam-machine-console-just-announced-6x-more-powerful-than-steam-deck)

**Intel**
- Arc B580 (Xe2): 12 GB GDDR6, 192-bit, 456 GB/s. FP32 is 13.67 TFLOPS on one site and 14.6 TFLOPS in Tom's launch coverage. — [Tom's Hardware review](https://www.tomshardware.com/pc-components/gpus/intel-arc-b580-review-the-new-usd249-gpu-champion-has-arrived); [FPSBench](https://fpsbench.com/gpu/intel-arc-b580)
- Arc B570: 10 GB, 380 GB/s, $219 at launch. — [Tom's Hardware](https://tomshardware.com/pc-components/gpus/intel-announces-the-arc-b580-and-arc-b570-gpus)
- Arc A750 (Alchemist): 8 GB, 256-bit, 512 GB/s, 17.20 TFLOPS. — [FPSBench](https://fpsbench.com/compare/gpu/intel-arc-a750-vs-intel-arc-b580)
- Arc B770 status is disputed. The VideoCardz database says it was never released (a rumoured 16 GB, 256-bit part), while other pages call it "launch imminent". — [VideoCardz DB](https://videocardz.net/intel-arc-b770); [TechPowerUp](https://www.techpowerup.com/344664/intel-arc-battlemage-b770-spotted-in-more-software-libraries-launch-imminent)
- Panther Lake (Core Ultra Series 3, January 2026), Arc B390:
  - 12 Xe3 cores (96 EUs, 1,536 ALUs).
  - 7.68 TFLOPS at a 2.5 GHz peak; PC Gamer estimates 7 to 8.
  - Panther Lake supports up to 96 GB of LPDDR5X-9600.
  - PC Gamer says the B390 "theoretically tops out at 74 GB/s". That conflicts with my calc of 153.6 GB/s for 128-bit LPDDR5X-9600 and is unresolved.
  - Notebookcheck finds it 6 to 25% slower than an RTX 4050 Laptop and 20 to 35% behind a Radeon 8050S.

  — [Notebookcheck](https://www.notebookcheck.net/Intel-Arc-B390-12-Xe3-Panther-Lake-iGPU-Benchmarks-and-Specs.1169503.0.html); [CPU-Monkey](https://www.cpu-monkey.com/en/igpu-intel_arc_b390); [PC Gamer](https://www.pcgamer.com/hardware/graphics-cards/digging-a-little-deeper-into-intels-xe3-architecture-shows-exactly-why-panther-lakes-igpu-is-good-its-basically-an-arc-a770-graphics-card-jammed-into-a-mobile-chip/)
- Lunar Lake Arc 140V (Xe2): about 4.2 TFLOPS by Tom's figure vs a 6.56 TFLOPS theoretical peak at 2.05 GHz, with on-package LPDDR5X-8533. It is faster and more efficient than the Radeon 890M. — [Tom's Hardware](https://www.tomshardware.com/pc-components/gpus/intel-takes-down-amd-in-our-integrated-graphics-battle-royale); [CPU-Monkey](https://www.cpu-monkey.com/en/igpu-intel_arc_140v); [Notebookcheck](https://www.notebookcheck.net/Intel-Lunar-Lake-iGPU-analysis-Arc-Graphics-140V-is-faster-and-more-efficient-than-Radeon-890M.894167.0.html)
- Iris Xe G7 (96 EU, 768 shaders) trails the 780M by about 48% in Fire Strike in one pairing. — [Nanoreview](https://nanoreview.net/en/gpu-compare/radeon-780m-vs-intel-iris-xe-graphics-g7-96eu); [Notebookcheck](https://www.notebookcheck.net/Radeon-780M-vs-Iris-Xe-G7-80EUs-vs-Iris-Xe-G7-96EUs_11564_10395_10364.247598.0.html)

**Apple (unified memory)**
- **(primary source)** "Systems with Apple silicon only have one GPU, which removes the need to choose a GPU." A GPU with unified memory "is typically an integrated GPU". — [Apple: MTLDevice.isLowPower](https://developer.apple.com/documentation/metal/mtldevice/islowpower); [Apple: hasUnifiedMemory](https://developer.apple.com/documentation/metal/mtldevice/hasunifiedmemory)
- M1: about 68 GB/s and about 2.6 TFLOPS. M2: 100 GB/s. M1 Pro and M2 Pro: 200 GB/s. M3 Pro: 150 GB/s. M1, M2 and M3 Max: about 400 GB/s. — [MacRumors buyer's guide](https://macrumors.com/guide/apple-silicon-buyers-guide/)
- M4: 120 GB/s, with a measured FP32 peak of about 2.9 TFLOPS. M4 Pro: 273 GB/s. M4 Max: up to 546 GB/s, about 18.43 TFLOPS with 40 GPU cores (about 13.7 with 32). — [PetaPixel](https://petapixel.com/2024/10/30/apples-m4-m4-pro-and-m4-max-chips-promise-huge-performance-gains-and-ai-prowess); [arXiv 2502.05317](https://arxiv.org/pdf/2502.05317v2); [HMC-Tech list](https://hmc-tech.com/lists/gpu/apple/family/m-series)
- M5 family:
  - M5 (October 2025): up to a 10-core GPU, 153.6 GB/s, up to 32 GB.
  - M5 Pro (3 March 2026): 16- or 20-core GPU, 307 GB/s, up to 64 GB.
  - M5 Max: 32-core at 460 GB/s or 40-core at 614 GB/s, up to 128 GB.
  - Apple publishes no TFLOPS. An M5 Ultra figure of about 1.2 TB/s comes only from a secondary source.
  - [Unverified: apple.com and support.apple.com were not reachable in the fact-check pass, so none of the M5-family bandwidth figures were re-read]

  — [Wikipedia: Apple M5](https://en.wikipedia.org/wiki/Apple_M5); [MacRumors](https://www.macrumors.com/2026/03/03/apple-debuts-m5-pro-and-m5-max-chips/); [Apple MacBook Pro specs](https://support.apple.com/en-au/126318); [PromptQuorum (secondary)](https://www.promptquorum.com/local-llms/apple-silicon-m5-local-llm)

**Qualcomm (Windows on Arm)**
- Adreno X2-90:
  - Snapdragon X2 Elite: 6.96 TFLOPS at 1.70 GHz, 152 GB/s.
  - X2 Elite Extreme: 7.58 TFLOPS at 1.85 GHz, 228 GB/s (192-bit LPDDR5X-9523).
  - The two variants differ by about 15%, and the 1.85 GHz X2-90 is slightly faster than the Apple M5 GPU.

  — [CPU-Monkey](https://www.cpu-monkey.com/en/igpu-qualcomm_adreno_x2_90); [VideoCardz](https://videocardz.com/newz/snapdragon-x2-elite-trails-ryzen-ai-9-hx-370-in-two-of-three-games-intel-ultra-x9-388h-leads); [Notebookcheck](https://www.notebookcheck.net/Qualcomm-Snapdragon-X2-Elite-Extreme-Analysis-Benchmarks-Efficiency-Serious-rival-for-Apple-and-a-problem-for-AMD-Intel.1266974.0.html)
- In games, the X2 Elite trails the Ryzen AI 9 HX 370 (Radeon 890M) in two of three titles, and the Panther Lake Core Ultra X9 388H leads. — [VideoCardz](https://videocardz.com/newz/snapdragon-x2-elite-trails-ryzen-ai-9-hx-370-in-two-of-three-games-intel-ultra-x9-388h-leads)
- **(primary source, fact-check pass)** WebGPU on Snapdragon Windows laptops is on by default in Chromium 156 (Electron 45): `kWebGPUQualcommWindows` is `FEATURE_ENABLED_BY_DEFAULT`, so Qualcomm D3D12 adapters are not vendor-blocked. The built-in adapter blocklist still rejects driver versions `31.0.110`–`31.0.116` on one Adreno device ID, `0x36334330`, which Dawn maps to the Adreno 7xx family (X1 generation, not the X2-90). Snapdragon X1 laptops on those drivers lose WebGPU until the driver is updated. [Verified: https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/gpu_finch_features.cc; https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/webgpu_blocklist_impl.cc]

### Inferences

**Compact table of representative GPUs per tier.** "SI/DI" means single-issue/dual-issue TFLOPS for RDNA 3/4.

| Tier (bandwidth key) | Discrete GPUs (peak BW GB/s · FP32 TFLOPS · VRAM) | Integrated / SoC GPUs (peak BW GB/s · FP32 TFLOPS) |
|---|---|---|
| **Minimum** (≥ ~60 GB/s, ≥ ~2 TFLOPS, ≥ 2 GB) | GTX 1650 (128–192 · ~2.9 · 4 GB) | Iris Xe 96EU (~51–68 calc, DDR4-3200/LPDDR4X-4266 · ~2); Radeon 680M/780M (~90–120 calc, DDR5-5600/LPDDR5X-7500 · 3.4–4.5 SI); Radeon 890M (~1.2–1.3× 780M); Arc 140V (~136 calc · ~4.2); Arc B390 (BW disputed · ~7.7); Apple M1–M5 base (68–153.6 · 2.6 M1, ~2.9 measured M4, no M5 figure); Adreno X2-90 (152–228 · 7.0–7.6) |
| **Recommended** (≥ ~250 GB/s, ≥ ~10 TFLOPS, ≥ 8 GB) | RTX 3060 12 GB (360 · 12.7 · 12); RTX 4060 (272 · 15.1 · 8); RTX 4060 Laptop (256–272 · 8 GB); RX 7600 (288 · ~10.9/21.75 · 8); RX 9060 XT (~320 calc · ~13/26 · 8/16); Arc B570 (380 · 10 GB); Arc B580 (456 · 13.7–14.6 · 12); Arc A750 (512 · 17.2 · 8). RTX 2060 6 GB (336 · 6.5) is a borderline Minimum+ | Radeon 8060S Strix Halo (256 · 14.85/29.7); Apple M4 Pro (273); M5 Pro (307) |
| **High** (≥ ~440 GB/s, ≥ ~20 TFLOPS, ≥ 12 GB) | RTX 5070 (672 · 30.9 · 12); RTX 5060 Ti 16 GB (448 · 23.7 · 16); RX 9070 XT (640 · ~24/48.7 · 16). RTX 5070 Laptop (448 · 8 GB) has High bandwidth but Recommended VRAM | Apple M4 Max (up to 546 · ~13.7–18.4); M5 Max (460–614) |
| **Ultra** (≥ ~880 GB/s, ≥ ~40 TFLOPS, ≥ 16 GB) | RTX 5070 Ti (896 · 43.9 · 16); RTX 5080 (960 · 56.3 · 16); RTX 5090 (1,792 · 104.9 · 32) | M5 Ultra (~1.2 TB/s, unverified) |

- **Use bandwidth as the primary tier key and FP32 as a secondary key.** Halve RDNA 3/4 marketing TFLOPS before comparing. The 780M is only 5 to 10% faster than the 680M despite about 2× the paper TFLOPS.
- **Integrated GPU bandwidth follows the laptop's RAM speed and channel count**, so two "780M" laptops can differ by about 30%. Laptop discrete GPUs vary with power limit (TGP) and memory speed (for example the RTX 4060 Laptop's 256 vs 272 GB/s). **Benchmark rather than trust the model name** for laptops.
- **Apple Silicon has one GPU (Apple's own documentation)**, so the integrated-vs-discrete selection problem does not exist on M-series Macs. Tier follows the M-chip variant and GPU-core count: base M is Minimum, Pro is Recommended, Max is High.
- **The installed base will not shift much before 2027**: no new desktop generation in 2026, supply cuts and rising prices. Tiers built on RTX 30/40/50, RDNA 2 to 4 and Arc A/B should hold through 2027.

### Gaps
- Not verified in this session: RTX 5060 FP32, RTX 4050 Laptop specs, RX 6600 (224 GB/s not confirmed), Radeon 890M and Iris Xe FP32 (only my calcs), Adreno X1-85, RTX 4070/4080/4090, RX 7800 XT, Steam Machine memory bandwidth, and RDNA 4 Infinity Cache sizes.
- The B390 bandwidth conflict (74 vs 153.6 GB/s) and the Arc B770 status remain unresolved. I found nothing on Intel discrete GPUs newer than Battlemage.
- RTX 50-series VRAM capacities (5090 32 GB; 5080, 5070 Ti and 5060 Ti 16 GB; 5070 12 GB) come from NVIDIA family pages that the search listed, but the result summaries did not re-state them.

## 3. Estimating particle budgets from memory bandwidth and fill rate (worked example)

### Takeaway
A GPU-simulated, additively blended particle toy is usually limited by memory bandwidth (simulation buffer traffic) and fill (blended fragments), not FLOPs. The budget rule is:

**N × bytes-per-particle-per-frame × frame rate ≤ usable bandwidth − resolution-dependent overhead.**

At a typical 128 B per particle per frame:
- 1M particles at 240 Hz fits all but the weakest integrated GPUs.
- 10M at 144 Hz needs an RTX 5070-class GPU.
- 50M at 60 Hz needs an RTX 5080 or 5090.
- 50M at 144 Hz needs an RTX 5090 with a lean data layout.
- 50M at 240 Hz is out of reach on any single GPU.

Apple GPUs blend in on-chip tile memory, so the fill-traffic part of the model is pessimistic on Macs.

### Cited Findings
- Overdraw is the main driver of particle fill-rate and bandwidth cost: every transparent overlap forces a read, blend and write-back of the existing pixel. — [Realtime Collision Detection](https://realtimecollisiondetection.net/blog/?p=91); [Bugnet](https://bugnet.io/blog/debugging-particle-system-performance-issues)
- Additive particles are argued to be cheaper than alpha-blended ones, and fill cost scales roughly with particle area. — [Bugnet](https://bugnet.io/blog/debugging-particle-system-performance-issues)
- Once simulation moves to the GPU, the CPU-to-GPU transfer bottleneck largely disappears, and fill rate dominates when particles are large and overlap heavily (Latta, "Building a Million Particle System"). — [Latta paper (UFPE copy)](https://www.cin.ufpe.br/~sbm/CG/Artigo5.pdf)
- Tile-based compute rendering for heavy overdraw can exhaust group-shared memory at around 1M particles (forum report). — [GameDev.net thread](https://gamedev.net/forums/topic/692435-tile-based-particle-rendering?page=1)
- **(primary source)** Apple silicon GPUs use tile-based deferred rendering. Fragments are processed into on-GPU tile memory with "bandwidth that's many times faster than device memory", and the final result is written to device memory after each tile finishes. — [Apple: Tailor your apps for Apple GPUs and TBDR](https://developer.apple.com/documentation/metal/tailor-your-apps-for-apple-gpus-and-tile-based-deferred-rendering) [Verified: https://developer.apple.com/documentation/metal/tailor-your-apps-for-apple-gpus-and-tile-based-deferred-rendering]
- **(primary source)** Metal's `recommendedMaxWorkingSetSize` is "an approximation of how much memory, in bytes, this GPU device can allocate without affecting its runtime performance". — [Apple: recommendedMaxWorkingSetSize](https://developer.apple.com/documentation/metal/mtldevice/recommendedmaxworkingsetsize) [Verified: https://developer.apple.com/documentation/metal/mtldevice/recommendedmaxworkingsetsize]
- WebGPU default limits are `maxStorageBufferBindingSize` = 134,217,728 B (128 MiB) and `maxBufferSize` = 268,435,456 B (256 MiB). Higher adapter limits must be requested at device creation. — [MDN GPUSupportedLimits](https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedLimits); [Babylon.js forum](https://forum.babylonjs.com/t/question-about-the-maximum-maxstoragebufferbindingsize-of-webgpu-storagebuffer-array/50678) [Verified: https://raw.githubusercontent.com/gpuweb/gpuweb/main/spec/index.bs] Measured: even the SwiftShader fallback adapter in this container offers 1,073,741,824 B (1 GiB) for both limits, so the 128 MiB default is purely a request-time cap.
- **(primary source)** "A user agent must not reveal more than 32 distinguishable configurations or buckets" of capabilities (features plus limits), so reported limits are coarse buckets, not raw hardware values. — [gpuweb spec source](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs) [Verified: https://raw.githubusercontent.com/gpuweb/gpuweb/main/spec/index.bs]
- Real-world adapter-limit distributions are tracked by Web3DSurvey. — [Web3DSurvey](https://web3dsurvey.com/webgpu/limits/maxStorageBufferBindingSize/platform/Windows)
- Peak bandwidth figures used below are from Section 2.

### Inferences

**Method (all formulas and numbers are calc; assumptions are flagged).**
1. **Bytes per particle per frame (B):**
   - Lean, about 80 B: a 32 B state read and written once (64 B) plus a 16 B render fetch.
   - Typical, about 128 B: a 48 B state read and written (96 B) plus 32 B render fetch.
   - Heavy, about 256 B: adds binning or sorting and neighbour reads.
2. **Required traffic** = N × B × f.
3. **Usable bandwidth** ≈ η × φ × peak. η is the achievable fraction of peak, assumed about 0.8 (unsourced). φ is the share of the frame given to particles, assumed about 0.5. Together that is **about 0.4 × peak**. Calibrate η with the in-app copy probe (Section 6).
4. **Subtract resolution overhead.** Assume RGBA16F post-processing costs about 4 full-resolution read+write passes, about 64 B per pixel per frame:

   | Resolution | Per frame | 60 Hz | 144 Hz | 240 Hz |
   |---|---|---|---|---|
   | 1080p | 133 MB | 8.0 GB/s | 19.1 GB/s | 31.9 GB/s |
   | 1440p | 236 MB | 14.2 GB/s | 34.0 GB/s | 56.6 GB/s |
   | 4K | 531 MB | 31.9 GB/s | 76.4 GB/s | 127.4 GB/s |

5. **Fill check.** Fragments per second = N × A × f, where A is the average number of covered pixels per particle including overdraw. On immediate-mode GPUs (NVIDIA, AMD, Intel), assume about 16 B of DRAM traffic per blended RGBA16F fragment (8 B for RGBA8) before ROP caches and compression. **On Apple TBDR GPUs, blending stays in tile memory within a render pass**, so the per-fragment DRAM term mostly disappears and fill becomes a shading and tiling cost there.
6. **Memory footprint check.** Footprint ≈ N × state size × 2 (ping-pong) + sort buffers + render targets. Check each binding against `maxStorageBufferBindingSize`. On Macs, keep the total under Metal's `recommendedMaxWorkingSetSize`.
7. **FLOP check (rarely binding).** For example, 10M × 1,000 FLOPs × 144 Hz = 1.44 TFLOP/s, against about 15 TFLOPS on an RTX 4060.

**Worked example A: required particle traffic (GB/s, calc).**

| N | Hz | Lean (80 B) | Typical (128 B) | Heavy (256 B) |
|---|---|---|---|---|
| 1M | 60 | 4.8 | 7.7 | 15.4 |
| 1M | 144 | 11.5 | 18.4 | 36.9 |
| 1M | 240 | 19.2 | 30.7 | 61.4 |
| 10M | 60 | 48 | 76.8 | 153.6 |
| 10M | 144 | 115.2 | 184.3 | 368.6 |
| 10M | 240 | 192 | 307.2 | 614.4 |
| 50M | 60 | 240 | 384 | 768 |
| 50M | 144 | 576 | 921.6 | 1,843 |
| 50M | 240 | 960 | 1,536 | 3,072 |

**Worked example B: does it fit? (Typical 128 B profile, usable ≈ 0.4 × peak, particle traffic only.)**

| GPU (peak → usable GB/s) | 1M @60/144/240 | 10M @60/144/240 | 50M @60/144/240 |
|---|---|---|---|
| Iris Xe (68 → 27) | ✓ / ✓ / ✗ | ✗ / ✗ / ✗ | ✗ |
| Apple M5 (153.6 → 61) | ✓ / ✓ / ✓ | ✗ (needs 77) / ✗ / ✗ | ✗ |
| RTX 4060 (272 → 109) | ✓ / ✓ / ✓ | ✓ / ✗ / ✗ | ✗ |
| RTX 3060 (360 → 144) | ✓ / ✓ / ✓ | ✓ / ✗ / ✗ | ✗ |
| RTX 5070 (672 → 269) | ✓ / ✓ / ✓ | ✓ / ✓ / ✗ | ✗ |
| RTX 5080 (960 → 384) | ✓ / ✓ / ✓ | ✓ / ✓ / ✓ | ✓ (exactly at limit) / ✗ / ✗ |
| RTX 5090 (1,792 → 717) | ✓ / ✓ / ✓ | ✓ / ✓ / ✓ | ✓ / ✗ (lean 80 B fits: 576) / ✗ (lean needs 960) |

**Maximum particle count**, N_max = (usable − overhead) / (B × f), with B = 128 at native resolution (calc):

| Representative GPU | Scenario | Particle budget |
|---|---|---|
| Iris Xe (Minimum) | 1080p60 | **~2.5M** (matches the mobile/web edition's 2M) |
| RTX 4060 (Recommended) | 1080p144 | **~4.9M** |
| RTX 4060 (Recommended) | 1440p60 | **~12M** |
| RTX 5070 (High) | 1440p144 | **~12.7M** |
| RTX 5070 (High) | 1440p240 | **~6.9M** |
| RTX 5080 (Ultra entry) | 4K144 | **~16.7M** |
| RTX 5090 (Ultra) | 4K144 | **~35M** |
| RTX 5090 (Ultra) | 4K60 | **~89M** |

[Verified: arithmetic in worked examples A–D and in the resolution-overhead table recomputed in the fact-check pass from the stated inputs. All match to rounding: for example Iris Xe 1080p60 (27.2 − 8.0) / 7,680 ≈ 2.5M; RTX 5090 4K144 (716.8 − 76.4) / 18,432 ≈ 34.7M. The inputs remain assumptions (η, φ, bytes per particle) and the peak-bandwidth figures are unverified.]

Measured floor, for contrast (software, not GPU data): in this container the SwiftShader fallback adapter took about 22 ms per frame for 20k particles and 131 ms for 300k (32 B per particle compute step plus a 1-pixel additive point draw). That is about 0.9M particle-updates per second at 20k and 2.3M at 300k (calc; a two-point fit puts about 14 ms of the 22 ms in fixed per-frame cost), roughly 65 to 165 times (about two orders of magnitude) below the Iris Xe Minimum budget of about 150M updates per second (2.5M × 60 Hz); counted in particles held at 60 Hz, the gap is more than 125× (under 20k against about 2.5M). [Verified correction: measured in this container] A fallback adapter cannot hold 60 Hz even at 20k particles.

**Worked example C: fill traffic on immediate-mode GPUs (calc).**
- 10M × 4 px × 144 Hz = 5.76 G fragments/s, or about 92 GB/s at 16 B. This adds to the 184 GB/s of simulation traffic.
- 1M glow sprites × 64 px × 60 Hz = 3.84 G fragments/s, or about 61 GB/s. That already exceeds an Iris Xe's whole usable budget.
- 50M one-pixel points × 60 Hz = 3 G fragments/s, or about 48 GB/s.
- Design consequence: expose **particle count, sprite size and glow radius, and internal render scale** as separate tier knobs.

**Worked example D: memory footprint and WebGPU limits (calc).**
- Ping-pong state at 32 or 48 B per particle: 1M takes 64 or 96 MB, 10M takes 0.64 or 0.96 GB, 50M takes 3.2 or 4.8 GB. So 50M needs at least an 8 GB GPU, and 16 GB is better.
- At the default 128 MiB binding limit, one binding holds only about 2.8M particles at 48 B (array of structs), about 4.2M at 32 B, or about 8.4M for a 16 B struct-of-arrays position buffer. Beyond the mobile edition's 2M, request the adapter's higher limits at device creation, or split buffers.

### Gaps
- I found no source measuring achievable-vs-peak bandwidth for WebGPU compute on these GPUs. η and φ are assumptions to calibrate in the app.
- I found no source on per-architecture FP16 vs 8-bit blend rates, on compute "atomic splat" rendering vs ROP blending (an algorithm question, out of scope), or on the binning cost of millions of tiny primitives on Apple TBDR.
- The budgets ignore caches (for example AMD Infinity Cache or Apple SLC), which can help small working sets a lot. Treat the tables as conservative for 1M-class scenes.

## 4. The monitor landscape (resolution, refresh, HDR, laptops)

### Takeaway
1080p is still about half of Steam primary displays, 1440p is about 22 to 27%, and 4K is about 5% (Oct 2026, from search summaries). The growth segment is 27-inch 1440p at 240 Hz, driven by OLED: OLED monitor shipments nearly doubled year on year in Q2 2026, and more than 4M units are forecast for 2026. Shipping monitors reach 480 to 520 Hz, and 1,000 Hz panels were shown in 2026. HDR capability is common on new premium monitors, but no reliable data on how many users have HDR exists. Laptops are mostly LCD, with OLED at about 6% of notebook panels in 2026.

### Cited Findings
- Steam primary display: 1920×1080 50.23%, 2560×1440 21.82%, 3840×2160 5.05% *(search summary, not verified — Oct 2026)*. 47.91%, 27.04% and 4.79% *(search summary, not verified — Sept 2026)*. — [Hardware Busters](https://hwbusters.com/news/steam-hardware-survey-october-undoes-september-putting-16gb-and-the-rtx-3060-back-on-top/); [ShiftDelete](https://shiftdelete.net/en/steam-hardware-survey)
- OLED monitors: 2.735M units in 2025, +92% year on year. — [PC Gamer](https://www.pcgamer.com/hardware/gaming-monitors/say-what-you-want-about-burn-in-sales-of-oled-pc-monitors-surged-by-92-percent-in-2025/)
- Q1 2026: +78% year on year, helped by QD-OLED supply, with ASUS leading at 24%. — [TweakTown](https://www.tweaktown.com/news/111788/oled-monitor-shipments-saw-a-78-percent-year-over-year-increase-in-q1-2026/index.html); [PC Gamer](https://www.pcgamer.com/hardware/gaming-monitors/oled-gaming-monitor-sales-are-booming-as-shipments-increase-78-percent-in-the-first-quarter-of-2026/)
- Q2 2026 (TrendForce, 13 August 2026):
  - Shipments +26.1% quarter on quarter and +98% year on year.
  - Unit shares: ASUS 23.1%, Samsung 13.1%, MSI 12.8%.
  - 27-inch QHD is the dominant segment, and 27-inch 240 Hz QHD models "gained considerable popularity".
  - More than 4M units are forecast for 2026 and 6.893M by 2028.
  - 27-inch 240 Hz OLED prices fell more than 40%.

  — [TrendForce](https://www.trendforce.com/insights/oled-monitor); [PC Gamer](https://www.pcgamer.com/hardware/gaming-monitors/oled-monitors-more-popular-than-ever-says-analyst-firm-which-makes-sense-as-one-of-the-few-good-deals-left-in-pc-gaming/); [Yahoo Tech](https://tech.yahoo.com/computing/articles/m-seeing-oled-monitor-shipments-135944463.html)
- A secondary source cites an Omdia forecast of 6.1M OLED monitors in 2026 (+79%). I could not verify it. — [VoxBooster](https://voxbooster.com/blog/monitor-market-statistics-2026/)
- Refresh-rate mix from low-confidence aggregators: 144 Hz about 38.2% and 240 Hz+ about 22.6% of gaming monitors in 2025; another report gives 240 Hz 24.3%. Directional only. — [Dataintelo (27-inch)](https://dataintelo.com/report/27-gaming-monitor-market); [Dataintelo (4K)](https://dataintelo.com/report/4k-gaming-monitors-market)
- Top end in 2026:
  - PC Gamer's speed pick is the Sony Inzone M10S at 480 Hz.
  - ViewSonic says its XG2737 reaches 520 Hz and that the fastest monitors exceed 500 Hz.
  - Manufacturers showed 1,000 Hz panels around Computex 2026.
  - Claims of a 720 Hz ASUS and a 1,100 Hz Samsung monitor are unverified.

  — [PC Gamer](https://www.pcgamer.com/best-high-refresh-rate-monitor-for-gaming); [ViewSonic](https://www.viewsonic.com/library/gaming/highest-refresh-rate-monitors); [Tom's Guide](https://www.tomsguide.com/computing/monitors/gaming-monitors-are-hitting-1-000hz-in-2026-but-you-dont-need-one-heres-what-you-should-get-instead); [Tech-Insider (unverified)](https://tech-insider.org/?p=18905)
- VESA tiers: DisplayHDR 400 requires 400 nits peak, a 0.4-nit maximum black and 90% DCI-P3. DisplayHDR 1000 requires 1,000 nits, 0.05-nit black, 30,000:1 contrast and 95% DCI-P3. OLED True Black tiers now reach True Black 1400. — [VESA DisplayHDR](https://displayhdr.org/); [TechRadar](https://www.techradar.com/computing/monitors/what-displayhdr-true-black-1400-means-for-the-future-of-gaming-and-productivity-displays)
- HDR monitor market (low confidence): gaming was 55.3% of HDR monitor revenue in 2025, and Mini-LED was 51.29% of HDR monitor value. There is no split by DisplayHDR tier. Buyer guides often advise skipping HDR400. — [PMarketResearch](https://pmarketresearch.com/?p=2577158); [KTC guide](https://us.ktcplay.com/blogs/product-comparisons/displayhdr-400-vs-1000-vs-1400-which-matters)
- The CSS `dynamic-range: high` media query reports HDR *capability*, not whether HDR is active. It has been widely available since 3 November 2024. — [MDN](https://developer.mozilla.org/docs/Web/CSS/@media/dynamic-range); [Web Features Explorer](https://web-platform-dx.github.io/web-features-explorer/features/dynamic-range)
- Laptops: TrendForce expects OLED notebook penetration of about 6% in 2026 (about 12.6M units), rising to 22.4% (46.6M) by 2030, with about +40% growth in 2026 and more than +40% in 2027. An older forecast was 3% (2024) rising to more than 5% (2027). — [TrendForce press center (29 Oct 2026)](https://www.trendforce.com/presscenter/news/20261029-13287.html); [TweakTown](https://www.tweaktown.com/news/114417/oled-market-shipments-projected-to-grow-by-over-40-percent-year-over-year-in-2027/index.html); [Evertiq (older)](https://evertiq.com/news/56962)
- 2026 notebook shipments are forecast down 5.4% to about 173M, and notebook panel shipments down about 7.9% on memory prices. TCL CSOT's entry OLED notebook panel is a 14-inch WUXGA (1920×1200) inkjet-printed OLED. — [iConnect007](https://iconnect007.com/article/148268/revises-down-2026-global-notebook-shipments-to-a-54-yoy-decline/148265/ein); [iConnect007 (TCL CSOT)](https://iconnect007.com/article/150455/tcl-csots-ijp-oled-to-enter-branded-monitor-and-notebook-products-in-2h26/150452/ein)
- **(primary source)** Electron's `Display` exposes `displayFrequency`, `colorDepth`, `depthPerComponent`, `colorSpace`, `scaleFactor` and `internal` (true for a built-in panel), so refresh, bit depth and laptop-panel status can be read directly in the app. — [Electron docs: Display (GitHub)](https://github.com/electron/electron/blob/main/docs/api/structures/display.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/structures/display.md]

### Inferences
- **Display targets by tier:**
  - Minimum: 1920×1080 or 1920×1200 at 60 Hz, SDR.
  - Recommended: 1080p at 144 Hz or 1440p at 60 Hz.
  - High: 1440p at 144 to 240 Hz, the dominant new OLED segment, with HDR optional.
  - Ultra: 4K at 120 to 144 Hz or 1440p at 360 to 480 Hz, with HDR on OLED (True Black) or DisplayHDR 1000 Mini-LED.
- **HDR:** treat DisplayHDR 400 as "HDR-signalling but SDR-like". Offer HDR output when `dynamic-range: high` matches and/or Electron reports more than 8 bits per component, but keep SDR as the default look. The WebGPU output path exists: `GPUCanvasContext.configure` with `rgba16float` and `toneMapping: {mode: "extended"}` is in Chrome from 129 (BCD) and was accepted and reported back by `getConfiguration()` in Chromium 153 in this container. Measured on a software adapter, so this proves the API, not real HDR output. [Verified: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/GPUCanvasContext.json]
- **At 240 Hz and above**, cap simulation at a fixed rate (for example 120 or 240 Hz) and interpolate rendering. Otherwise the particle budget at 480 Hz is half of the 240 Hz budget.
- **Ultrawide (3440×1440)** is about 4.95 MP, about 34% more pixels than 1440p. Scale fill and post-processing budgets to match.
- **Laptop panels** are mostly LCD in 2026, and new OLED panels are 16:10. Expect 16:10 native resolutions and read the refresh rate from `displayFrequency` rather than assuming it.

### Gaps
- I found no trustworthy unit-share data for refresh rates (60 Hz through 500 Hz+); no Omdia, DSCC or Runto data surfaced, and Valve publishes none.
- I found no data on HDR prevalence among PC users, no DisplayHDR 400 vs 1000 sales split, and no Steam ultrawide or 16:10 shares.
- I found no source on typical laptop refresh rates or 16:10 share. MacBook Pro ProMotion at 120 Hz is general knowledge and was not verified here.
- Electron documents `colorSpace` and `depthPerComponent`, but not which values indicate HDR.

## 5. How comparable indie and creative GPU apps word their Steam requirements

### Takeaway
Comparable titles:
- name one or two **reference GPUs "or equivalent"**;
- state **VRAM explicitly**;
- often add **an integrated-graphics line** ("not supported", "may see issues", "dedicated GPU highly recommended");
- give an API floor (DX11, DX12 SM 6.0, OpenGL 3.0);
- sometimes attach a **mode or resolution condition** ("non-VR mode", "on Full HD").

Web-tech titles use vaguer wording ("any graphics", "hardware accelerated graphics"). Tactilume should give, per tier, a reference GPU, VRAM, a resolution × refresh × particle target, and "WebGPU-capable (D3D12/Vulkan/Metal) GPU".

### Cited Findings
- **Tetris Effect: Connected**:
  - Minimum: Windows 10, i3-4340, 4 GB RAM, "NVIDIA GTX 750 Ti equivalent or greater" (non-VR).
  - Recommended: i5-4590, 8 GB RAM, "GTX 970 equivalent" (required for VR).
  - 5 GB storage.

  — [Steam store](https://store.steampowered.com/app/1003590/Tetris_Effect_Connected/); [Epic Games Store](https://store.epicgames.com/p/tetris-effect-kiwidlc1-77df8a)
- **Rez Infinite**:
  - Minimum: i3-3220, 4 GB RAM, GTX 750 class (1 GB) per third-party sites, DirectX 11, 64-bit, non-VR.
  - Recommended: i5-4590, 8 GB RAM, "GTX 970 equivalent or greater (required for VR)".

  — [Steam store](https://store.steampowered.com/app/636450/Rez_Infinite/); [GameRequirementsLab](https://www.gamerequirementslab.com/rez-infinite-system-requirements)
- **Universe Sandbox**:
  - Minimum: Windows 10 21H1+ 64-bit, 1.6 GHz dual-core, 4 GB RAM, "4 GB Video Memory†, Shader Model 6.0", DirectX 12. The footnote warns that integrated-graphics computers "may see issues… even if they meet the video memory requirement".
  - Recommended: Windows 11, 3.6 GHz quad-core, 8 GB RAM, "8+ GB Video Memory".
  - macOS: M1+.
  - The VRAM minimum was raised from 2 to 4 GB.

  — [Steam store](https://store.steampowered.com/app/230290/Universe_Sandbox/); [Epic Games Store](https://store.epicgames.com/p/universe-sandbox)
- **Wallpaper Engine**: Minimum: Windows 10/11, "NVIDIA GeForce GTX 660, AMD HD7870, 2 GB VRAM or above", DirectX 11. "Dedicated GPU is highly recommended, but not required". Older mirrors list Intel HD 4000. — [Steam store](https://store.steampowered.com/app/431960/Wallpaper_Engine/); [Can I Run It](https://can-i-run-it.com/wallpaper-engine)
- **Teardown**: Minimum: 8 GB RAM, "NVIDIA GeForce GTX 1060 or similar, 4 Gb VRAM", "Integrated graphics cards not supported". Third-party sites give a GTX 1080 as recommended. — [Steam store](https://store.steampowered.com/app/1167630); [Teardown docs](https://get-teardown.readthedocs.io/en/latest/tech/system-requirements.html)
- **Noita**:
  - Minimum: dual-core i5, 4 GB RAM, "512MB VRAM, OpenGL 3.0 support".
  - Recommended: "The more cores the better", 8 GB RAM, "1024MB VRAM".

  — [Noita Wiki](https://noita.wiki.gg/wiki/System_Requirements); [Steam store](https://store.steampowered.com/app/881100)
- **Ultimate Epic Battle Simulator 2**:
  - Minimum: i5-4590 or Ryzen 3 1200, 8 GB RAM, "3 GB graphics card – DX 11.1 compatible".
  - Recommended: i5-6600 or Ryzen 5 1400, 16 GB RAM; one source names a GTX 970/1070.

  — [Steam store](https://store.steampowered.com/app/1468720/); [GamePressure](https://www.gamepressure.com/S013-amp.asp?ID=11368)
- **shapez** (2020): Minimum: 2 GHz, 2 GB RAM, "any" graphics, Windows 10 64-bit, macOS Catalina+. Recommended: dedicated GPU and 4 GB RAM. **shapez 2**: "Intel UHD Graphics 630, 1GB VRAM… on Full HD"; another listing names an RTX 2060. — [Steam: shapez](https://store.steampowered.com/app/1318690); [Steam: shapez 2](https://store.steampowered.com/app/2162800/shapez_2/)
- **CrossCode**: 2 GHz dual-core, 2 GB RAM minimum and 4 GB recommended, "Hardware Accelerated Graphics with dedicated memory, 1GB memory recommended". — [SystemRequirementsLab](https://www.systemrequirementslab.com/cyri/requirements/crosscode/14749); [GameRequirementsLab](https://gamerequirementslab.com/crosscode-system-requirements)

### Inferences
- **Suggested Tactilume wording:**
  - **Minimum (1080p · 60 Hz · ~1–2M particles):** Windows 10 22H2 64-bit / macOS on Apple Silicon (M1) / 64-bit Linux with Vulkan drivers; 4-core CPU; 8 GB RAM (16 GB with integrated graphics); WebGPU-capable GPU (DirectX 12/Vulkan/Metal) such as Intel Iris Xe, AMD Radeon 680M, Apple M1 or NVIDIA GTX 1650 (4 GB); 2 GB video memory (shared OK); "Integrated graphics supported at reduced particle counts."
  - **Recommended (1080p · 144 Hz or 1440p · 60 Hz · ~5–10M):** Windows 11; 6-core/12-thread CPU; 16 GB RAM; RTX 3060 / RTX 4060, RX 7600 / RX 9060 XT, Arc B580, Apple M4 Pro or M5 Pro, or Ryzen AI Max (Radeon 8060S); 8 GB VRAM.
  - **High (1440p · 144–240 Hz · ~10–15M, HDR optional):** 8-core/16-thread CPU; 16–32 GB RAM; RTX 5070 / RX 9070 XT / RTX 5060 Ti 16 GB / Apple M4 Max or M5 Max; 12 GB VRAM; HDR10 display recommended (OLED or DisplayHDR 600+).
  - **Ultra (4K · 120–144 Hz or 1440p · 360–480 Hz · 20–50M+, HDR):** 8+ cores; 32 GB RAM; RTX 5080 / RTX 5090 (RTX 5070 Ti entry); 16 GB+ VRAM; OLED (True Black) or DisplayHDR 1000.
- CPU lines can follow Steam's core-count distribution because the workload is GPU-bound. Illustrative CPU models were not benchmarked.
- Add a footnote in the style of Universe Sandbox and Teardown: "Laptops with switchable graphics must run Tactilume on the discrete GPU". See Section 6.
- **Linux line:** state the WebGPU backend requirement explicitly. MDN's compat data lists Chrome's Linux WebGPU support as covering Intel Gen12+ GPUs only (see Section 6). Chromium's own Linux blocklist is wider. Since Chromium 148 it also exempts NVIDIA proprietary drivers ≥ 535.183.01 (with Intel Gen12+ on Mesa ≥ 22.0). AMD GPUs stay blocked by default in Electron 45. That covers Valve's AMD-based Steam Deck and Steam Machine and, per the unverified headline in Section 1, about two-thirds of Linux Steam users. A truthful Linux line is "Intel Gen12+ (Mesa 22+) or NVIDIA (driver 535.183.01+) for WebGPU; other GPUs run the WebGL2 renderer" unless forced enabling is adopted and tested. [Verified correction: https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/software_rendering_list.json]

### Gaps
- I could not open Steam store pages. Requirement text comes from search excerpts and mirrors, which sometimes conflict with older store snapshots.
- I found no requirement text for dedicated music visualisers on Steam (projectM, Vibralizer, IKANDY, Plane9) or for a WebGPU-based Steam title. The engine attribution of CrossCode and shapez as web-tech games is general knowledge and was not verified here.

## 6. Identifying hardware at runtime, discrete-GPU selection, and first-run calibration

### Takeaway
Primary sources checked on 2026-11-12 show three things:
- **Chrome still ignores `powerPreference` on Windows.** Current Chromium source logs a console warning and uses the GPU Chrome was allocated, usually the integrated one on laptops. [Verified: https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/modules/webgpu/gpu.cc] On Windows, Dawn is handed the LUID of ANGLE's D3D11 adapter, so WebGPU always follows whichever GPU the Chromium GPU process runs on. [Verified: https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/command_buffer/service/webgpu_decoder_impl.cc]
- **WebGPU adapter info carries only `vendor`, `architecture`, subgroup sizes and `isFallbackAdapter` by default.** `device` and `description` stay empty unless the WebGPU Developer Features flag is on. [Verified: https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/modules/webgpu/gpu_adapter.cc; measured in Chromium 153: vendor "google", architecture "swiftshader", `isFallbackAdapter` true, description empty]
- **`navigator.deviceMemory` is no longer capped at 8.** Since Chrome 147 desktop reports 2/4/8/16/32 (Electron 42+ ships Chromium 148). It is still a coarse power of two. [Verified: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Navigator.json; measured 16 on a 16 GB machine]

In Electron, combine three sources:
- WebGPU `adapter.info` and `adapter.limits`, which are bucketed.
- Electron main-process APIs:
  - `app.getGPUInfo('basic')`: PCI IDs of every GPU, plus `optimus` and `amdSwitchable` hybrid flags.
  - `screen` Display: `displayFrequency`, `internal`, `colorDepth` and `depthPerComponent`.
  - `powerMonitor`: battery, thermal state, CPU speed limit.
  - `process.getSystemMemoryInfo()`: exact RAM.
- A short GPU-timed benchmark, re-validated when power, thermal state or display changes.

### Cited Findings

**WebGPU adapter information (primary sources)**
- Spec: for each of `vendor`, `architecture`, `device` and `description`, "to preserve privacy, the user agent may instead set" the field "to the empty string or a reasonable approximation". `device` is "a vendor-specific identifier" and `description` is the adapter description "as reported by the driver". — [gpuweb spec source](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs)
- **Chromium source (main):** without `WebGPUDeveloperFeatures`, `GPUAdapterInfo` is built from `vendor_, architecture_, subgroup_min_size_, subgroup_max_size_, is_fallback_adapter` only, so `device` and `description` are empty. With the flag, Chrome adds:
  - `device` as the PCI device ID formatted `0x%04x`;
  - `description` as the driver's device name;
  - non-standard `driver`, backend, adapter `type`, `d3dShaderModel`, `vkDriverVersion`, `powerPreference` and memory heaps.

  `isFallbackAdapter` is true when the adapter type is CPU. — [Chromium gpu_adapter.cc](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/webgpu/gpu_adapter.cc) [Verified: https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/modules/webgpu/gpu_adapter.cc]
- MDN compat data: `GPUAdapterInfo.isFallbackAdapter` arrived in Chrome 136. The current Chrome support statement for WebGPU reads "Supported on ChromeOS, macOS, Windows, and Linux (Intel Gen12+ GPUs only)" (Chrome 144 entry). — [mdn/browser-compat-data GPUAdapterInfo.json](https://github.com/mdn/browser-compat-data/blob/main/api/GPUAdapterInfo.json); [GPU.json](https://github.com/mdn/browser-compat-data/blob/main/api/GPU.json) [Verified: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/GPUAdapterInfo.json] The BCD note is narrower than Chromium's code, whose Linux blocklist also exempts NVIDIA ≥ 535.183.01 from Chromium 148 on. [Verified correction: https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/software_rendering_list.json]
- **Dawn `gpu_info.json`:** the architecture name is reported "made lower-case and with spaces converted to hyphens", derived from PCI device-ID ranges:

  | Vendor (PCI ID) | Architecture strings |
  |---|---|
  | NVIDIA (0x10DE) | `fermi`, `kepler`, `maxwell`, `pascal`, `turing`, `ampere`, `lovelace`, `blackwell` |
  | AMD (0x1002) | `gcn-1` to `gcn-5`, `rdna-1`, `rdna-2`, `rdna-3`, `rdna-4` (RDNA 4 sets 0x7550, 0x7590) |
  | Intel (0x8086) | `gen-9`, `gen-11`, `gen-12-lp`, `gen-12-hp` (set 0x5600, Arc A-series), `xe-lpg`, `xe-2-lpg` (0x6400), `xe-2-hpg` (0xE200), `xe-3-lpg` (0xB000), `xe-3-lpg-xs` |
  | Qualcomm | `adreno-6xx`, `adreno-7xx`, `adreno-8xx` |
  | Apple | No device IDs: "Apple GPUs do not report a DeviceID via the Metal API". Architecture is the highest Metal "common" family, for example `common-3`. |
  | Software adapters | SwiftShader (Google 0x1AE0), WARP (Microsoft 0x1414), Mesa software (0x10005) |

  — [Dawn gpu_info.json](https://github.com/google/dawn/blob/main/src/dawn/gpu_info.json) [Verified: https://raw.githubusercontent.com/google/dawn/main/src/dawn/gpu_info.json — the file also lists Intel `gen-7`/`gen-8` and Qualcomm Windows device IDs for Adreno 6xx–8xx]
- Spec: "A user agent must not reveal more than 32 distinguishable configurations or buckets" of capabilities. — [gpuweb spec source](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs) [Verified: https://raw.githubusercontent.com/gpuweb/gpuweb/main/spec/index.bs]

**Discrete vs integrated GPU selection**
- **Chromium source (main, `gpu.cc`):** on Windows, "Chrome always uses the same GPU adapter that's been allocated for other Chrome workloads on Windows, which for laptops is generally the integrated graphics card". If `powerPreference` is passed, Chrome logs "The powerPreference option is currently ignored when calling requestAdapter() on Windows. See https://crbug.com/369219127". — [Chromium gpu.cc](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/webgpu/gpu.cc) [Verified: https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/modules/webgpu/gpu.cc]
- Chrome's docs give two workarounds: the Windows per-app Graphics setting (System → Display → Graphics → High performance) or chrome://flags/#force-high-performance-gpu. — [Chrome WebGPU troubleshooting](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips) [Unverified: developer.chrome.com blocked. Chromium 156 does define a hyphenated `force-high-performance-gpu` switch — https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/gpu_switches.cc — but its Windows effect was not tested.]
- **MDN compat data:** `requestAdapter` "discrete adapter default on AC" arrived in Chrome 115 (partial), "Supported on dual GPU macOS devices only". Without `powerPreference`, Chrome picks the discrete GPU only on AC power on those Macs. — [mdn/browser-compat-data GPU.json](https://github.com/mdn/browser-compat-data/blob/main/api/GPU.json); [MDN requestAdapter](https://developer.mozilla.org/docs/Web/API/GPU/requestAdapter) [Verified: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/GPU.json; the battery → low-power / AC → high-performance default is in https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/command_buffer/service/webgpu_decoder_impl.cc]
- **Spec:** `powerPreference` is a hint. The user agent "may select different adapters given the same power preference" depending on "battery status and attached displays or removable GPUs". With "high-performance", "user agents are more likely to force device loss, in order to save power by switching to a lower-power adapter". — [gpuweb spec source](https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs) [Verified: https://raw.githubusercontent.com/gpuweb/gpuweb/main/spec/index.bs]
- **Apple:** "Systems with Apple silicon only have one GPU". — [Apple: isLowPower](https://developer.apple.com/documentation/metal/mtldevice/islowpower) [Verified: https://developer.apple.com/documentation/metal/mtldevice/islowpower]
- **Electron docs:** `--force_high_performance_gpu` is described as "Force using discrete GPU when there are multiple GPUs available", with `--force_low_power_gpu` as the reverse [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/command-line-switches.md]. Note the spelling difference: Chromium 156's own switch is the hyphenated `force-high-performance-gpu`. Users report the switch does nothing on Windows, and a Chromium developer reportedly read it as macOS-only [Unverified: user reports not re-read]. — [Electron docs: command-line switches (GitHub)](https://github.com/electron/electron/blob/main/docs/api/command-line-switches.md); [Electron #31355](https://github.com/electron/electron/issues/31355); [Foundry VTT #12489](https://github.com/foundryvtt/foundryvtt/issues/12489)

**Electron system APIs (current docs on GitHub)**
- `app.getGPUInfo('basic' | 'complete')`:
  - The documented `basic` example contains `auxAttributes.optimus` and `auxAttributes.amdSwitchable`, a `gpuDevice` array of `{active, vendorId, deviceId}` for every GPU (decimal PCI IDs, for example 4098 = AMD 0x1002 and 32902 = Intel 0x8086), and `machineModelName`/`machineModelVersion`.
  - The docs recommend "Using `basic` … if only basic information like `vendorId` or `deviceId` is needed".
  - `complete` returns Chromium's full GPUInfo, the same data as chrome://gpu.
  - The promise is rejected if the GPU is completely disabled.
  - The `gpu-info-update` event fires on changes, and `app.getGPUFeatureStatus()` is usable only after it.

  — [Electron docs: app.md](https://github.com/electron/electron/blob/main/docs/api/app.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/app.md]
- `Display` documents `displayFrequency`, `colorDepth`, `depthPerComponent`, `colorSpace`, `scaleFactor`, `size`, `internal` ("`true` for an internal display"), `label` and `detected`. — [Electron docs: Display](https://github.com/electron/electron/blob/main/docs/api/structures/display.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/structures/display.md]
- `powerMonitor`:
  - `isOnBatteryPower()` and the `onBatteryPower` property.
  - `on-ac` / `on-battery` events (*macOS, Windows* only).
  - `thermal-state-change` and `getCurrentThermalState()` (*macOS*): unknown, nominal, fair, serious or critical.
  - `speed-limit-change` (*macOS, Windows*): "Values below 100 indicate that the system is impairing processing power due to thermal management".

  — [Electron docs: power-monitor.md](https://github.com/electron/electron/blob/main/docs/api/power-monitor.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/power-monitor.md]
- `process.getSystemMemoryInfo()` returns `total`, "the total amount of physical memory in Kilobytes available to the system", plus `free` and, on Linux, `available`. — [Electron docs: process.md](https://github.com/electron/electron/blob/main/docs/api/process.md) [Verified: https://raw.githubusercontent.com/electron/electron/main/docs/api/process.md]
- Electron release branches pin these Chromium versions: 41-x-y = 146.0.7680, **42-x-y = 148.0.7778**, 43-x-y = 150.0.7871, main = 159.0.8154. — [Electron 42-x-y DEPS](https://github.com/electron/electron/blob/42-x-y/DEPS); [Electron 41-x-y DEPS](https://github.com/electron/electron/blob/41-x-y/DEPS) [Verified: https://raw.githubusercontent.com/electron/electron/42-x-y/DEPS (148.0.7778.280); 45-x-y pins 156.0.8078.96 — https://raw.githubusercontent.com/electron/electron/45-x-y/DEPS]
- An Electron test hit "GPU access is disabled due to frequent crashes", so GPU access can be disabled at runtime. — [Electron PR #52072](https://releases.electronjs.org/pr/52072) [Verified: https://github.com/electron/electron/pull/52072 — merged 2026-06-19; the error text appears in the failing Linux test output]

**Browser-level signals**
- **Correction: `navigator.deviceMemory` (primary sources).**
  - MDN compat data: "From Chrome 147, reported values are 2, 4, 8, 16, and 32. Before Chrome 147, reported values were 0.25, 0.5, 1, 2, 4, and 8." Chrome Android 147+ reports 1, 2, 4 and 8. Firefox and Safari do not support it.
  - Chromium source rounds physical RAM (in MiB) to the nearest power of two, then clamps to `kMinMemory = 2.0f` and `kMaxMemory = 32.0f` on desktop (1 and 8 on Android), citing crbug.com/454354290.
  - The coordinator measured Chrome 153 reporting `navigator.deviceMemory = 16` on a 16 GB machine in this research container, which matches.
  - The older 8 GB cap described by fingerprinting write-ups applies only to Chrome ≤146.
  - [Verified: BCD notes, Chromium's `kMinMemory = 2.0f` / `kMaxMemory = 32.0f` (1 and 8 on Android), and the measured value 16 all agree — https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Navigator.json; https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/common/device_memory/approximated_device_memory.cc]

  — [mdn/browser-compat-data Navigator.json](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json); [Chromium approximated_device_memory.cc](https://github.com/chromium/chromium/blob/main/third_party/blink/common/device_memory/approximated_device_memory.cc); [Castle.io (pre-147 behaviour)](https://blog.castle.io/deep-dive-how-navigator-devicememory-can-be-used-for-fingerprinting-and-bot-detection/)
- `requestAnimationFrame` usually runs at the display refresh rate while visible, and Chrome and Firefox do not cap it. No direct web API for refresh rate has shipped. — [Flavio Copes](https://flaviocopes.com/requestanimationframe/); [WebKit bug 173434](https://bugs.webkit.org/show_bug.cgi?id=173434); [W3C public-web-perf](https://lists.w3.org/Archives/Public/public-web-perf/2024Sep/0005.html)
- `matchMedia('(dynamic-range: high)')` reports HDR capability, not whether HDR is active. — [MDN dynamic-range](https://developer.mozilla.org/docs/Web/CSS/@media/dynamic-range); [W3C HDR explainer](https://github.com/w3c/media-capabilities/blob/main/hdr_explainer.md)
- `timestamp-query` is an optional WebGPU feature for GPU timing. Higher limits must be requested at device creation. (Measured: even the SwiftShader adapter in this container exposes `timestamp-query` and `subgroups`, with subgroup size 4, but not `shader-f16`.) — [MDN GPUSupportedLimits](https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedLimits); [WebGPU limits guide](https://cdn.jsdelivr.net/npm/claude-code-skills@0.5.0/data/skills/webgpu-threejs-tsl/docs/limits-and-features.md)

### Inferences

**Detection layer (startup, about 100 ms, without `complete` GPU info).**

| Signal | Source | Use |
|---|---|---|
| GPU identity | `app.getGPUInfo('basic')`: every GPU's PCI vendorId/deviceId with `active`, plus `optimus`/`amdSwitchable`; `adapter.info.vendor`/`architecture` (Dawn strings above). In the renderer, the unmasked WebGL renderer string via `WEBGL_debug_renderer_info` is still available (measured in Chromium 153), so a model string exists even where WebGPU's `description` is empty. | Look up bandwidth, single-issue FP32, VRAM and iGPU/dGPU in a local table keyed by PCI ID. Detect "hybrid laptop, WebGPU on the iGPU" when a non-active NVIDIA or AMD dGPU exists. |
| Software adapter | `adapter.info.isFallbackAdapter` (Chrome 136+), or vendor/architecture = SwiftShader, WARP or Mesa software. Without `--enable-unsafe-webgpu`, Chromium blocklists CPU adapters, so users normally get no adapter at all and the app must fall back to WebGL2 | Below Minimum: warn and skip the benchmark. Measured SwiftShader: ~22 ms/frame at 20k particles, ~131 ms at 300k |
| Apple chip | `architecture` is only `common-N`, with no device ID; use `machineModelName`/`Version`, the OS CPU model string (for example via `os.cpus()`, unverified) and the benchmark | Apple tiering needs the chip variant and GPU-core count, which WebGPU does not expose |
| GPU limits | `adapter.limits` (bucketed; ≤32 configurations) and features (`timestamp-query`, `shader-f16`, `subgroups`) | Hard caps on buffer size and algorithm. Do not use limits as a speed proxy. |
| RAM | `process.getSystemMemoryInfo().total` (KB, exact). `navigator.deviceMemory` is only a fallback: on Chromium ≥147 it gives 2–32 (24 GB shows as 16, 64 GB+ as 32, calc); on ≤146 it caps at 8. | Unified-memory and iGPU budget; RAM tier |
| CPU | `os.cpus()` / `navigator.hardwareConcurrency` | CPU tier; worker threads for phone and gamepad I/O |
| Display | `screen.getAllDisplays()`: `size × scaleFactor`, `displayFrequency`, `internal`, `colorDepth`, `depthPerComponent`; `display-metrics-changed`, `display-added` and `display-removed` events | Resolution and refresh target; laptop panel detection; re-calibrate on change |
| HDR | `matchMedia('(dynamic-range: high)')` and `depthPerComponent > 8` (heuristic); output via canvas `rgba16float` + `toneMapping: {mode: "extended"}` (Chrome 129+, accepted in measured Chromium 153) | Offer the HDR toggle; do not assume HDR is active |
| Power and thermal | `powerMonitor.isOnBatteryPower()`, `on-battery`/`on-ac` (macOS/Windows), `speed-limit-change`, `thermal-state-change` (macOS) | Battery preset; throttle detection. Linux gets no battery events, so poll `isOnBatteryPower()`. |
| Form factor | an `internal` display plus a battery means a laptop | Laptop-aware defaults |

**Mapping method (spec prior, then measurement, then tier).**
1. **Spec prior from the PCI-ID table.**
   - Minimum: at least 60 GB/s and 2 TFLOPS.
   - Recommended: at least 250 GB/s, 10 TFLOPS and 8 GB.
   - High: at least 440 GB/s, 20 TFLOPS and 12 GB.
   - Ultra: at least 880 GB/s, 40 TFLOPS and 16 GB.

   For integrated GPUs, derive bandwidth from RAM speed when known. Unknown or Apple GPUs start at Minimum (Apple: Pro chip Recommended, Max chip High, when the chip is identified).
2. **Bandwidth probe (about 1 s).** Time a 256 MB (or the largest allowed) buffer copy with `timestamp-query`, falling back to `queue.onSubmittedWorkDone()` timing. This gives measured GB/s, from which η is calibrated.
3. **Particle ramp (about 10 to 15 s, after a 2 to 3 s warm-up that absorbs shader and pipeline compilation).**
   - At native resolution and `displayFrequency`, start at 0.5× the prior's budget and multiply the count by about 1.4 every 1 to 1.5 s.
   - Measure GPU time for the simulation and render passes.
   - Stop when p90 exceeds about 75% of the refresh period (5.2 ms at 144 Hz), or at the binding or VRAM cap.
   - Refine with 2 to 3 bisection steps.
4. **Soak (about 15 to 20 s) at about 85% of the found count.** Cut 15% and flag the machine as thermal-limited if any of these occur:
   - the last 3 s run more than 10% slower than the first 3 s;
   - `speed-limit-change` reports < 100;
   - the thermal state reaches serious or worse.
5. **Tier and profile.** The tier is the highest one whose Section 3 target the measured budget meets, so the measurement can move the tier up or down from the prior. Store the profile keyed by GPU PCI IDs, driver, display ID, size, refresh and power source. Re-run on `gpu-info-update`, display changes or a power-source change, and handle `device.lost` (the spec warns that high-performance devices may be lost so the browser can switch to a lower-power adapter) by re-detecting and re-calibrating.
6. **Make the user's own machine the default target.** The default preset should be "Auto (this machine)", meaning the measured tier with its particle count, sprite size and render scale. Keep the public Minimum to Ultra floors anchored to market data (Sections 1 and 2) so a developer's RTX 5090 does not become the Recommended spec. Use the developer's measured tier as the preset to tune first, and test Minimum on an Iris Xe or 780M-class laptop.

**Pitfalls to design for:**
- **Wrong GPU on Windows hybrid laptops (confirmed in current Chromium source).** If `getGPUInfo` shows `optimus`/`amdSwitchable` or an inactive dGPU while the WebGPU adapter is the iGPU, prompt once to set Windows Graphics → High performance for Tactilume (or the NVIDIA Control Panel equivalent), then re-benchmark. Do not rely on `--force_high_performance_gpu` on Windows. Because Dawn on Windows takes ANGLE's adapter LUID (verified in Chromium 156 source), only something that moves the whole GPU process to the dGPU can help. Chromium 156's hyphenated `--force-high-performance-gpu` is the switch to test first on a hybrid laptop (untested).
- **Battery and power-saver modes.** Only Intel-era dual-GPU Macs swap GPUs on AC/battery; Apple silicon has one GPU. Windows battery saver and macOS Low Power Mode can lower clocks or refresh. Benchmark on AC, keep a battery profile, and switch on `powerMonitor` events.
- **Thermal throttling.** Laptops lose clocks over minutes, so keep a runtime governor that sheds particles or render scale after more than 2 s over budget.
- **Refresh and VRR quirks.** VRR, driver frame caps and occluded windows distort rAF-based timing. Measure GPU time with timestamp queries and read the refresh rate from `displayFrequency`.
- **Background load.** Streaming software, launchers, browsers and the phone-control server compete for the GPU. Record focus and fullscreen state and offer "re-calibrate".
- **First-run shader and pipeline compilation.** Exclude the warm-up window from measurements.
- **Blank adapter info.** `device` and `description` are empty by default in Chrome, and Apple exposes no device ID. Key the GPU lookup on Electron's PCI IDs and use the benchmark as the final word.
- **Coarse limits.** Limits are bucketed, and unrequested limits stay at the 128 MiB default, which silently caps particles at about 2.8M (48 B array of structs). Request the adapter maximum at device creation.

### Gaps
- ~~I did not verify the exact command-line switch an Electron app would use to turn on `WebGPUDeveloperFeatures` for itself.~~ Resolved: in Chromium 156 the switch is `--enable-webgpu-developer-features`, mapped to the `WebGPUDeveloperFeatures` runtime feature, which is off by default. [Verified: https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/gpu_switches.cc; https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/content/child/runtime_features.cc] It is still not needed if PCI IDs come from `getGPUInfo`, and it is a developer flag that adds fingerprinting surface, so do not ship it.
- Whether `os.cpus()` reports the Apple chip variant string (for example "Apple M4 Pro") was not verified here.
- I found no source quantifying laptop throttling time constants or the effect of Windows battery saver on WebGPU. Those pitfalls are engineering inferences.
- Linux hybrid-GPU selection (PRIME offload, `DRI_PRIME`, NVIDIA offload variables) under Electron was not researched. Linux WebGPU enablement beyond Intel Gen12+ belongs to the WebGPU-support researcher. (Fact-check: Chromium's default Linux allowlist is Intel Gen12+ on Mesa ≥ 22.0 plus NVIDIA ≥ 535.183.01; see Section 5.)
- Electron does not document which `colorSpace` or `depthPerComponent` values mean an HDR mode is active.

## 7. Spec details to request from a user to place their machine

### Takeaway
Ask for:
- the exact GPU model(s), including the laptop GPU's power rating and whether the laptop has hybrid graphics;
- VRAM;
- CPU;
- RAM amount, type and speed;
- OS version;
- every monitor's native resolution, refresh rate and HDR capability;
- laptop or desktop, and whether it usually runs on battery.

For Macs, ask for the exact chip and GPU-core count, because WebGPU reports only a generic `common-N` architecture and no device ID. The in-app detector and benchmark should still confirm the answers.

### Cited Findings
- Laptop GPU configurations vary: the RTX 4060 Laptop ships with 16 or 17 Gbps memory (256 vs 272 GB/s), and NVIDIA lists 8 GB and 12 GB Blackwell laptop SKUs. — [ChipVersus](https://chipversus.com/compare/geforce-rtx-4060-laptop-gpu-vs-geforce-rtx-5070-laptop-gpu); [NVIDIA laptop compare](https://nvidia.com/en-us/geforce/laptops/compare/)
- Integrated GPU bandwidth is set by system RAM: Panther Lake supports up to LPDDR5X-9600, Lunar Lake uses on-package LPDDR5X-8533, and Strix Halo uses 256-bit LPDDR5X. — [PC Gamer](https://www.pcgamer.com/hardware/graphics-cards/digging-a-little-deeper-into-intels-xe3-architecture-shows-exactly-why-panther-lakes-igpu-is-good-its-basically-an-arc-a770-graphics-card-jammed-into-a-mobile-chip/); [CPU-Monkey 140V](https://www.cpu-monkey.com/en/igpu-intel_arc_140v); [CPU-Monkey 8060S](https://www.cpu-monkey.com/en/igpu-amd_radeon_8060s_graphics)
- Apple bandwidth depends on the chip and GPU-core variant: the M5 Max has 460 GB/s with 32 cores and 614 GB/s with 40. — [Apple MacBook Pro specs](https://support.apple.com/en-au/126318)
- **(primary source)** Apple GPUs do not report a device ID via Metal; Dawn reports the highest Metal "common" family (for example `common-3`) as the architecture. — [Dawn gpu_info.json](https://github.com/google/dawn/blob/main/src/dawn/gpu_info.json)
- **(primary source)** On Windows hybrid laptops, Chrome/Electron WebGPU uses the GPU Chrome was allocated, generally the integrated one, and ignores `powerPreference`. — [Chromium gpu.cc](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/webgpu/gpu.cc)
- **(primary source)** Electron's `getGPUInfo('basic')` exposes `optimus`/`amdSwitchable` flags and every GPU's PCI IDs with an `active` flag, so many answers can be auto-filled and checked. — [Electron docs: app.md](https://github.com/electron/electron/blob/main/docs/api/app.md)
- HDR capability (`dynamic-range: high`) is not the same as HDR being enabled. — [MDN dynamic-range](https://developer.mozilla.org/docs/Web/CSS/@media/dynamic-range)

### Inferences

**Questionnaire.** Field, then why it matters, then where the user finds it.
1. **Form factor and model.** Desktop, laptop, mini PC or Mac, with the exact model (for example "MacBook Pro 14-inch, M5 Pro 20-core GPU" or "ASUS ROG Zephyrus G14 2025"). Sets thermal and power assumptions and lets you look up panel and GPU configuration. Find it on the device label, Settings → System → About, or About This Mac.
2. **OS and version.** Windows 11 24H2 or 25H2 / Windows 10 22H2; macOS version; Linux distribution, kernel, session (Wayland or X11) and GPU driver (Mesa or NVIDIA version). Sets the OS tier and WebGPU backend. Find it with `winver`, About This Mac, or `uname -a` and `vulkaninfo --summary`.
3. **Every GPU, exactly.** The integrated plus any discrete GPU (for example "Radeon 780M + RTX 4060 Laptop"). For a laptop discrete GPU, also ask its maximum power (TGP, watts), whether it has a MUX switch or Advanced Optimus, and the driver version. This is the primary tier key, and it tells you whether the Windows "High performance" setting is needed. Find it in Task Manager → Performance → GPU 0/1, `dxdiag`, the NVIDIA app → System Information, System Information → Graphics/Displays on a Mac, or `lspci -nn | grep -E "VGA|3D"` on Linux.
4. **For Macs: the exact chip and GPU-core count** (for example "M4 Max, 32-core GPU"). WebGPU reports only `common-N` for Apple. Find it in About This Mac or System Information → Graphics/Displays.
5. **VRAM.** Dedicated GPU memory in GB; for integrated and Apple GPUs, total RAM instead. Needed for the particle buffer footprint. Find it in Task Manager → GPU → "Dedicated GPU memory", or `dxdiag`.
6. **CPU.** Exact model with core and thread count. Find it in Task Manager → CPU, About This Mac, or `lscpu`.
7. **RAM.** Total GB, type and speed (for example "16 GB LPDDR5X-8533"), and whether it is dual-channel. Critical for integrated-GPU bandwidth. Find it in Task Manager → Memory, or `sudo dmidecode -t memory` on Linux.
8. **Each monitor.** Model; native resolution; refresh rate as currently set; VRR (G-Sync or FreeSync); HDR capability (DisplayHDR tier or OLED) and whether HDR is on in the OS; connection (DisplayPort or HDMI version); OS scaling percentage; which monitor is primary. Sets the resolution × refresh target and the fill budget. Find it in Settings → Display → Advanced display, or System Settings → Displays.
9. **Usage context.** AC or battery; usual background apps (streaming, browser, launchers); fullscreen or windowed, and on which monitor. Sets the battery and thermal profile and the benchmark conditions.
10. **Optional shortcut.** Steam users can paste the Steam client's "Help → System Information" report, which covers most fields above (general knowledge, not verified here). A Tactilume diagnostics button can auto-fill most fields from `getGPUInfo('basic')`, `screen.getAllDisplays()`, `process.getSystemMemoryInfo()` and `os.cpus()`, and ask the user only for what software cannot read: laptop TGP, MUX status, monitor HDR tier and the Apple GPU-core count.

**Placing the machine** once the answers are in:
- Look up bandwidth, single-issue FP32 and VRAM (Section 2) and apply the tier floors (Section 6).
- Compute budgets for the user's native resolution and refresh rate with the Section 3 formula.
- Assign the highest tier whose target fits, and set it as the default authoring and test target.
- Confirm with the in-app benchmark, which takes priority whenever it disagrees with the spec prior.

### Gaps
- I did not verify Steam's "System Information" dump format or how to export it.
- Tools for reading a laptop GPU's TGP (NVIDIA app vs `nvidia-smi`) were not researched.
- I did not research how to read memory speed on macOS, where Apple does not expose it, so the chip variant must be used instead.

## Verification

Fact-check pass on 2026-11-12. Sources: raw GitHub (Chromium mirror at the tags Electron pins, Dawn, gpuweb, MDN BCD, Electron docs), github.com pages through a fetch tool, developer.apple.com, and one web search for the Steam survey. Measured facts come from this container: headless Chromium 153.0.8010.12 with a SwiftShader adapter.

| Claim | Verdict | Source |
|---|---|---|
| `navigator.deviceMemory` reports 2/4/8/16/32 on desktop from Chrome 147 (not capped at 8) | confirmed (measured 16 on 16 GB) | https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Navigator.json; https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/common/device_memory/approximated_device_memory.cc |
| Chrome ignores `powerPreference` on Windows and uses the GPU it was allocated (usually the iGPU) | confirmed; added: Dawn takes ANGLE's adapter LUID on Windows | https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/modules/webgpu/gpu.cc; https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/command_buffer/service/webgpu_decoder_impl.cc |
| Adapter info defaults to vendor, architecture, subgroup sizes and `isFallbackAdapter`; `device`/`description` empty without WebGPUDeveloperFeatures | confirmed (measured: "google" / "swiftshader" / true / empty) | https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/modules/webgpu/gpu_adapter.cc |
| `isFallbackAdapter` in Chrome 136; Chrome's WebGPU on Linux limited to Intel Gen12+ | first part confirmed; Linux part corrected: NVIDIA ≥ 535.183.01 also exempt from Chromium 148, AMD and older Intel blocked | https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/GPUAdapterInfo.json; https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/software_rendering_list.json |
| Dawn architecture strings by PCI ID; Apple reports only `common-N`, no device ID | confirmed | https://raw.githubusercontent.com/google/dawn/main/src/dawn/gpu_info.json |
| WebGPU default limits 128 MiB binding / 256 MiB buffer; limits bucketed (≤ 32 configurations) | confirmed (measured SwiftShader adapter offers 1 GiB for both) | https://raw.githubusercontent.com/gpuweb/gpuweb/main/spec/index.bs |
| Electron `getGPUInfo('basic')` PCI IDs + `optimus`/`amdSwitchable`; `Display` fields; `powerMonitor` events per OS; `getSystemMemoryInfo` in KB | confirmed | https://raw.githubusercontent.com/electron/electron/main/docs/api/app.md; https://raw.githubusercontent.com/electron/electron/main/docs/api/structures/display.md; https://raw.githubusercontent.com/electron/electron/main/docs/api/power-monitor.md; https://raw.githubusercontent.com/electron/electron/main/docs/api/process.md |
| Electron branch pins: 41 = 146.0.7680, 42 = 148.0.7778, 43 = 150.0.7871, main = 159.0.8154 | confirmed | https://raw.githubusercontent.com/electron/electron/42-x-y/DEPS; https://raw.githubusercontent.com/electron/electron/main/DEPS |
| Snapdragon (Adreno X2-90) laptops listed at Minimum | confirmed usable: Qualcomm WebGPU on Windows is on by default in Chromium 156, but driver versions 31.0.110–116 on one Adreno 7xx (X1-generation) device ID are blocklisted | https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/gpu_finch_features.cc; https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/webgpu_blocklist_impl.cc |
| Windows 10 support at Minimum depends on Electron (open question) | confirmed: Electron 45 supports Windows 10+ and macOS 13+ | https://raw.githubusercontent.com/electron/electron/v45.3.0/README.md |
| Apple silicon has one GPU; TBDR blends in tile memory; `recommendedMaxWorkingSetSize` definition | confirmed | https://developer.apple.com/documentation/metal/mtldevice/islowpower; https://developer.apple.com/documentation/metal/tailor-your-apps-for-apple-gpus-and-tile-based-deferred-rendering |
| Particle-budget arithmetic (worked examples A–D, N_max table) | confirmed (recomputed); inputs are assumptions | recomputed by the fact-checker |
| Section 3 measured software floor: SwiftShader ~22 ms at 20k and ~131 ms at 300k, "roughly 2–3M particle-updates per second, two to three orders of magnitude below" Iris Xe | timings confirmed; derived figures corrected (later pass): ~0.9M/s at 20k, ~2.3M/s at 300k, ~65–165× below Iris Xe's ~150M/s | measured in this container (headless Chromium 153.0.8010.12, SwiftShader); calc |
| Steam Oct 2026: Windows 93.70%, Linux 3.95%, macOS 2.35%, Windows 11 72.51% | unverifiable (Valve table blocked; corroborated independently by Phoronix and Windows Central) | https://phoronix.com/news/Steam-Survey-October-2026 |
| GPU spec figures (RTX 50 table, RTX 40/30, RDNA, Arc, Apple M4/M5 bandwidths) | unverifiable (vendor sites blocked) | — |
| WebGPUDeveloperFeatures switch name (open question) | confirmed: `--enable-webgpu-developer-features` | https://raw.githubusercontent.com/chromium/chromium/156.0.8078.96/gpu/config/gpu_switches.cc |
| Electron `--force_high_performance_gpu` does nothing on Windows (user reports) | unverifiable (reports not re-read); noted that Chromium's own switch is spelled `force-high-performance-gpu` | https://raw.githubusercontent.com/electron/electron/main/docs/api/command-line-switches.md |
| Electron PR #52072: "GPU access is disabled due to frequent crashes" | confirmed | https://github.com/electron/electron/pull/52072 |

**Contradictions noted and how they were resolved**
- Notes vs measured facts: consistent except one derived figure, corrected in a later pass. The Section 3 measured-floor sentence gave the SwiftShader rate as 2–3M particle-updates per second, two to three orders of magnitude below Iris Xe, but 22 ms at 20k and 131 ms at 300k give about 0.9M and 2.3M per second, about 65–165× below Iris Xe's ~150M. [Verified correction: measured in this container] Measured deviceMemory = 16 confirms the file's own correction. The SwiftShader limits (1 GiB) agree with "request adapter limits at device creation". The SwiftShader timings (22 ms at 20k, 131 ms at 300k) confirm that a fallback adapter sits far below Minimum, and are added to the detection table.
- With desktop_app_shell.md: both files quoted MDN's "Intel Gen12+ only" for Linux; both are now corrected to Chromium's blocklist (Intel Gen12+/Mesa 22 + NVIDIA 535.183.01). Steam Deck scope differs between the files (out of scope here, planned for there); left as a product decision.
- Within this file: the Section 1 open question about Windows 10 support is answered from Electron's README (supported).
