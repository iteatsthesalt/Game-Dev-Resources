This is the fact-checked digest of uzu_and_genre.md: Uzu, the interactive particle light-toy genre, and what Tactilume Desktop may and may not take from them, as of 2026-11-12.

**Status.** The Verification table in the notes covers 15 claims: 8 confirmed, 5 corrected, 2 unverifiable.
- Sources read:
  - raw GitHub files: w3c/wcag, mdn/content, jberg/butterchurn, projectM, WebGL-Fluid-Simulation, particle-life-app, compute.toys, jellybutter;
  - the npm registry;
  - developer.apple.com;
  - the SourceForge projectM mirror.
- Three web searches were used: XAG 118, the Uzu listing, and the CHI 2014 abstract.
- Blocked hosts:
  - apps.apple.com and learn.microsoft.com;
  - the latency-paper hosts;
  - Steam and Wikipedia;
  - github.com pages and the GitHub API.

**Tags.**
- [Verified] re-read at source.
- [Verified correction] rewritten to match a source.
- [Unverified] checked but not confirmed.
- (search summary) means only a search-engine summary of that page was seen.
- [Measured] means headless Chromium 153.0.8010.12 (Playwright 1.63.0, Linux, SwiftShader fallback adapter). These are software results, not GPU data.
- [Cited] comes from the notes' own source, not re-read.
- [Inference] is the notes' or this fact-check's conclusion.

**Source keys.**
- APP = https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723
- WCAG = https://github.com/w3c/wcag/blob/main/guidelines/terms/20/general-flash-and-red-flash-thresholds.html
- XAG = https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/118
- MDN = https://github.com/mdn/content/blob/main/files/en-us/web/accessibility/guides/seizure_disorders/index.md

## Bottom line
- **Flash safety is the one hard requirement this file produces.**
  - Cap flashes at 3 per second.
  - Judge flash area as a visual angle (WCAG: 0.006 sr in any 10° field) and as a share of the screen (XAG 118: about 20%).
  - Handle saturated red separately.
  - Check recordings with Harding FPA, not PEAT, whose terms exclude commercial games.
  - At desk distance the WCAG area limit is about 1% of a 27-inch screen, about 20 times stricter than XAG's 20%. WCAG; XAG; MDN [Verified correction]
- **Market position.**
  - No Uzu or Colordodge product exists for Windows or Linux.
  - On macOS, the iPad app may be offered on Apple-silicon Macs by Apple's default, so treat macOS as possibly contested. https://developer.apple.com/documentation/apple-silicon/running-your-ios-apps-in-macos [Verified correction]
- **Reference code licences.**
  - MIT: Butterchurn, WebGL Fluid, compute.toys.
  - LGPL-2.1-or-later: projectM.
  - GPL-3.0: the Particle Life app.
  - Only the MIT projects can be lifted into a closed-source product without licence obligations beyond attribution [Inference].
- **Corrections in brief.**
  - Uzu's newest version is 4.2 and it costs $3.99 in the US.
  - Butterchurn's stable release is from 2019.
  - Vision Pro and Mac presence come by default with being an iPad app.
  - PEAT is barred for games.

## Uzu: facts for positioning and the do-not-copy list
- Uzu is an indie iPad app by Jason Kent Smith (brand Colordodge Labs), App Store ID 376551723. It launched in 2010 at about $0.99, and its titles changed twice [Cited].
- The listing is still sold. It is "Designed for iPad" and requires iPadOS 17.6 or later. APP (search summary; the UK and Costa Rica listings agree) [Verified]
- The current US price is $3.99. Older snapshots show $2.49 (with an iPadOS 11.0 minimum), $2.99 and $4.99; the $4.99 one was not found again. The UK price is £3.99 and the Austrian €3.99. APP (search summary) [Verified correction]
- The newest version is 4.2, after a Metal and SwiftUI rebuild in 4.0. Earlier: universal app at v3.0 (2014), v3.2.1 on 2021-09-06. APP (search summary) [Verified correction]; 3.x dates [Cited]
- Dating:
  - The 17.6 minimum belongs to 4.2, so it shows 4.2 shipped after iPadOS 17.6 existed. 4.0's date is unknown.
  - Apple's 17.6 notes carry no date, so "mid-2024" is general knowledge. https://developer.apple.com/documentation/ios-ipados-release-notes/ios-ipados-17_6-release-notes [Verified correction] / date [Unverified]
- Apple's defaults:
  - The App Store offers compatible iPhone and iPad apps on Apple-silicon Macs (macOS 11 or later) and on Apple Vision Pro, unless the developer opts out.
  - Apple suggests opting out when an app depends on custom multi-finger touch with no practical alternative.
  - Fluidium's Vision Pro page is therefore not evidence of a visionOS edition.
  - Sources: https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-macs-with-apple-silicon; https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-apple-vision-pro [Verified correction]
- A 3.x update reportedly ran Uzu at 120 fps on iPad Pro [Unverified]. iPad Pro ProMotion switches between 24 and 120 Hz. https://developer.apple.com/documentation/quartzcore/optimizing-iphone-and-ipad-apps-to-support-promotion-displays [Verified]
- Interaction model:
  - the finger count (0–10) selects a global animation mode;
  - ten fingers act as a colour and size gesture;
  - an auto-play mode adds virtual touches;
  - later versions added microphone reactivity, factory presets (55, then 67 "refreshed" in 4.0), a ten-effect post-process bundle, Low-to-Ultra quality tiers and preset export/import.
  - Sources [Cited]
- External display with the iPad as controller is advertised for social gatherings. This is the direct precedent for "the handheld controls the big screen" [Cited].
- Unmet user requests: video recording/export, background colour, randomise-all, the old hidden controls, direct sharing, and more settings [Cited]. 4.2 added a colour panel whose scope was not seen [Unverified].
- Audiences that adopted it:
  - toddlers and families;
  - therapy and special education (fine motor, sensory, relaxation);
  - autism sensory lists;
  - "trippy" party use.
  - Sources [Cited]

## Do not copy (full lists in the notes, §7a)
- **Names.** "Uzu", "Little Uzu", anything punning on or evoking it (including Japanese swirl/whirlpool words), "Colordodge", the two subtitles and the "kinetic multitouch particle visualizer" tagline [Inference]
- **Structure.**
  - a single global mode ladder chosen by simultaneous touch count;
  - its mode names and assignments;
  - auto-play that adds virtual touches and wraps past 10;
  - sub-modes that cycle when all fingers lift.
  - [Inference]
- **Content sets.**
  - its preset names and counts;
  - a "Legacy Presets" folder;
  - the same ten-effect bundle in the same order;
  - "Low to Ultra" labels presented the same way.
  - Generic effect words alone are fine. [Inference]
- **Look and copy.**
  - the 2010 yellow-green-red palette;
  - tri-arm spirals and springy ribbons as hero presets;
  - "psychedelic fireworks" as the promise;
  - its screenshots, press blurbs and accolade-list style.
  - [Inference]
- Run a trademark check before any swirl-themed naming. Plasma Pong was pulled in 2007 over the Pong trademark [Cited].

## Genre references: versions and licences
- **Butterchurn** (MilkDrop in WebGL) is MIT.
  - npm `latest` is 2.6.7, published 2019-03-12.
  - The `beta` tag carries 3.0.0-beta.5 (2025-07-13), which `master` declares.
  - The "last push April 2026" is [Unverified].
  - Sources: https://registry.npmjs.org/butterchurn; https://github.com/jberg/butterchurn/blob/master/LICENSE [Verified correction]
- **butterchurn-presets** 2.4.7 is MIT, but each preset carries its author's name. https://registry.npmjs.org/butterchurn-presets [Verified]
- **jellybutter** (Jellyfin plugin, MIT) is TV and controller friendly: D-pad, remote or gamepad. It pins Butterchurn 2.6.7 and presets 2.4.7. https://github.com/rappo/jellybutter/blob/main/README.md [Verified]. Cider and the Chrome extension embeds are [Unverified].
- **libprojectM** is LGPL-2.1-or-later.
  - 4.1.4 (2025-01-24) fixed systems with only core OpenGL 4.1 or lower (mainly macOS, also older Linux).
  - Later releases: 4.1.5 (2025-11-03), 4.1.6 (2025-11-28), 4.1.7 (2026-07-14) and 4.1.8 (2026-10-06).
  - `master` is at 4.2.0, unreleased.
  - Sources: https://sourceforge.net/projects/projectm.mirror/files/; https://github.com/projectM-visualizer/projectm/blob/master/COPYING [Verified]
- **Dobryakov's WebGL Fluid** is MIT, copyright 2017, and builds on the GPU Gems fluid chapter.
  - Its timestep is wall-clock time capped at 1/60 s, so it is refresh-rate independent.
  - The cited 2019 post decodes to 2019-08-06.
  - Sources: https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/master/script.js; https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/master/LICENSE [Verified]
  - Adopt the same capped wall-clock step [Inference].
- **Particle Life app** (Tom Mohr) is GPL-3.0, v1.3.1, Java.
  - It installs on Windows and runs from source with JDK 17–25 on a Java 21 runtime.
  - Reusing its code would make Tactilume GPL-3.0.
  - Sources: https://github.com/tom-mohr/particle-life-app/blob/main/LICENSE.md; https://github.com/tom-mohr/particle-life-app/blob/main/README.md [Verified]
  - Community GPU and WebGPU ports exist [Cited].
- **compute.toys** is MIT. It is a WebGPU compute-shader playground in the browser, with shaders now in Slang compiled to WGSL. https://github.com/compute-toys/compute.toys/blob/master/README.md [Verified]
- Others, not re-checked [Cited]:
  - Ions: 20k particles; Ions 2+ up to 100k.
  - Particle Simulation – Flow Sim: NDI output to MadMapper and Resolume.
  - Synesthesia Pro: Syphon, Spout and NDI (aggregator claim).
  - TouchDesigner POPs: build 2025.32460 (2026-03-10), docs at 2025.33230.
  - Atomic Particle Engine: Steam, April 2026, mouse- and music-driven; the closest new desktop analogue.
  - Panoramical (2015): mouse, gamepad or MIDI "dimensions".
  - Wallpaper Engine: audio-responsive Workshop items.

## Photosensitivity limits (design inputs)
- **WCAG 2.3.1** (level A) allows no more than 3 flashes in any one second, unless below both thresholds:
  - General flash: opposing changes of at least 10% of maximum relative luminance, with the darker state below 0.80.
  - Red flash: a transition to or from R/(R+G+B) ≥ 0.8 with a chromaticity change above 0.2 (CIE 1976 UCS).
  - Area: concurrent flashes no more than 0.006 sr, or 25% of any 10° visual field. A 10° field is about a 341×256 px rectangle at 1024×768 on a 15–17-inch screen at 22–26 inches.
  - WCAG 2.3.2 (AAA) removes the threshold exception.
  - Sources: WCAG; https://github.com/w3c/wcag/blob/main/guidelines/sc/20/three-flashes-or-below-threshold.html [Verified]
- **XAG 118** fails above about 3 flashes per second or flashes over about 20% of the screen.
  - Flash: a 10% luminance change of full white, darker state below 0.8 (since version 3.0, May 2022).
  - Red: either extreme R/(R+G+B) ≥ 0.8, with a (R−G−B)×320 change above 20.
  - Long low-intensity flashing can fail.
  - Harding FPA is listed.
  - The guidelines are best practice, not a compliance checklist.
  - The page moved from /gaming/ to /xbox/. XAG (search summary) [Verified]
- **Epilepsy Foundation consensus** (quoted by MDN): a flash is a hazard at 20 cd/m² or more, 3 Hz or more and 0.006 sr or more. That is about 10% of the central field, or 25% of a TV screen at 2 m or more. A saturated-red transition is a risk on its own. MDN [Verified]
  - "65% response at 10 flashes per second" and the ITC 25% attribution are [Unverified].
- **Checking tools.** PEAT's terms forbid use on material made commercially for TV, film, home entertainment or gaming. Use the Harding test or another commercial tool. MDN (quoting PEAT) [Verified correction]
- **Area arithmetic** (A ≈ 0.006 × d²) [Inference]:

  | Setup | 0.006 sr on screen | Share of screen |
  |---|---|---|
  | 24-inch 16:9 at 60 cm | ~22 cm² | ~1.4% |
  | 27-inch 16:9 at 60 cm | ~22 cm² | ~1.1% |
  | 32-inch 16:9 at 70 cm | ~29 cm² | ~1.0% |
  | 55-inch 16:9 at 2.5 m | ~375 cm² | ~4.5% |
  | 65-inch 16:9 at 2.5 m | ~375 cm² | ~3.2% |

  - The limiter needs screen size and viewing distance, with a conservative default (desk distance) [Inference].
- **Beat-synced pulses** that cross the luminance and area thresholds are flashes. One per beat is safe up to 180 BPM; eighth notes at 120 BPM (4 per second) are not [Inference].
- **HDR.** No HDR-specific thresholds were found (gap). WCAG and XAG are relative to SDR white, while the consensus criterion is absolute (20 cd/m²), the less ambiguous reference for HDR [Inference].

## Latency and refresh
- **CHI 2014 stylus study.** People discriminate about 1 ms from 2 ms when dragging and about 7 ms from 40 ms when scribbling. Commercial devices then ran 65–120 ms end to end. https://webdocs.cs.ualberta.ca/~wfb/publications/C-2014-SIGCHI-Latency.pdf (search summary) [Verified]
- Other figures [Unverified]:
  - Microsoft Research 2012: about 100 ms typical touch lag and a 1 ms prototype. This is consistent with 65–120 ms.
  - GI 2014: an inking threshold of about 50 ms against 2–7 ms for other tasks.
  - US patent 9836313: 2.4–11.4 ms, mean about 6 ms.
- **Consequence.** Dragging is the most lag-sensitive gesture. Any phone-to-screen path will be far above these thresholds, so design for prediction and extrapolation, and keep local feedback on the phone [Inference].
- High refresh is valued (Uzu's 120 Hz update, Dobryakov's refresh fix) [Cited]. The notes target 120–240 Hz motion [Inference].

## Measured in this container
- Chromium 153's WebGPU canvas accepts `rgba16float` with `toneMapping: {mode: "extended"}`, and `getConfiguration()` reports it back. So the HDR path is configurable [Measured].
- Presenting a WebGPU canvas failed headless and under Xvfb ("A valid external Instance reference no longer exists"). On-screen HDR is untested [Measured].
- A software-only step of about 22 ms for 20k and 131 ms for 300k particles (32 B per particle, 1-px additive points). This is not GPU data, so the "millions of particles" target is unmeasured [Measured].
- No claim in the notes contradicted these measurements.

## Design proposals from the notes [Inference]
- **The open slot.** No surveyed product combines all four of:
  - desktop-class GPU particles;
  - several simultaneous phone and gamepad players;
  - two-way audio (react and generate);
  - instant consumer play.
  - No surveyed consumer toy advertises HDR output or several phone controllers (unproven absence).
- **Own:**
  - many players, each with a hue family, timbre and tool: co-op painting, an original fluid sport, conductor and painter roles;
  - controller verbs: sticks as attractors, triggers as emission, rumble on beats and collisions, phone tilt and fling;
  - the phone screen as legend and hints, plus a one-tap randomiser;
  - clip and HDR-still capture, plus scene codes;
  - system-audio and microphone reactivity with BPM detection, plus per-player generated sound;
  - HDR highlights with brightness caps, and 120–240 Hz motion;
  - fluids, flocks and particle-life "worlds";
  - drift, attract, wallpaper and second-screen modes;
  - an optional VJ mode: clean output, NDI, Spout or Syphon, MIDI or OSC, BPM sync;
  - a calm/sensory profile, session timers, a caregiver lock and colour-blind-safe palettes;
  - visible update cadence and community presets.
- **Avoid** Uzu's invisible finger-count mapping. It does not translate to one-handed phones or gamepads anyway.

## Open gaps
- Whether Uzu and Fluidium are actually offered on the Mac App Store (check by hand on an Apple-silicon Mac).
- Uzu's preset names, screenshots and in-app UI were not reviewed. Do this before finalising the do-not-copy list.
- HDR photosensitivity thresholds, and the viewing distance and screen size the limiter should assume.
- The GI 2014, Microsoft Research and patent latency figures, the exact iPadOS 17.6 release date and 4.0's release date.
- No trademark review was done, and there are no sales or engagement data for any light toy.
