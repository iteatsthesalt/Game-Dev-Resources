# Uzu (Colordodge Labs) and the Interactive Particle Light-Toy Genre: Dossier for Tactilume Desktop

*Researched 2026-11-12.*

*What "Uzu" means here: every Uzu finding refers to the single App Store product with ID 376551723, [Uzu, An Interactive Light Show](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723) (the coordinator wrote it "Uzu - an interactive light show"). Its earlier titles were "Uzu" and "Uzu: A Generative Design Playground", and the developer is Colordodge Labs. "Little Uzu" (ID 386764406) appears only as this product's iPhone spin-off from its own version history. I left out unrelated products with the same name, such as the "uzu" AI inference engine on GitHub.*

*How this was gathered: this session's network allowlist blocked direct fetches of apps.apple.com, web.archive.org, macstories.net and apppricinglab.com. Every App Store fact below therefore comes from search-engine summaries, 2010-era press and third-party mirrors (AppAdvice, AppFollow, soft112 and others), and the snapshot dates and storefronts are unknown. The shared web-search budget ran out before I could check archived copies of the listing, so that check is still open. Re-check prices, ratings, version dates and screenshots on the live listing before relying on them. Items tagged **[DISTINCTIVE]** are specific to Uzu and feed list (a) in §7.*

*Fact-check of 2026-11-12. The 15 claims that could change a design or requirement decision were re-checked:*
- *[Verified: source] means re-read at that source.*
- *[Verified correction: source] means the sentence was rewritten to match the source.*
- *[Unverified] means it was checked but could not be confirmed, because the host was blocked or no source was found.*
- *"(search summary)" after a source means only a search-engine summary of that page was seen. apps.apple.com and learn.microsoft.com stayed blocked.*
- *"Measured in this container" means headless Chromium 153.0.8010.12 (Playwright 1.63.0) on Linux with a SwiftShader fallback adapter. It gives software results, not GPU data.*
- *The summary table is the Verification section at the end. Untagged findings were not re-checked.*

## 1. Who made Uzu, when was it released and updated, at what price and for which devices? Did it support external displays, AirPlay or Apple TV? Is it still sold?

### Takeaway
- Uzu is a one-person indie app by designer-engineer Jason Kent Smith. His App Store seller name is "Jason K Smith" and his brand is Colordodge Labs.
- It launched for the original iPad on 12 June 2010 at about US$0.99 and reached #1 on the App Store during the iPad's launch window.
- Its later history:
  - an iPhone spin-off, "Little Uzu", in 2010;
  - a universal iPad/iPhone app with v3.0 in 2014;
  - updates up to v3.2.1 in September 2021;
  - a rebuild as v4.0 on Apple's Metal graphics engine, date unknown;
  - further 4.x updates: the current listing's newest version is 4.2 [Verified correction: https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723 (search summary)].
- It was never pulled in the 32-bit purge and is **still sold as of 2026-11-12**. The listing is "Designed for iPad" and requires iPadOS 17.6 or later. The current US listing costs US$3.99. Older snapshots show $2.49 to $4.99, and the UK and Austrian listings show £3.99 and €3.99 [Verified correction: https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723 (search summary; the page itself is blocked here)].
- The listing advertises an external-display mode in which the iPad acts as the controller. I found no Apple TV, Mac or visionOS edition and no AirPlay-specific feature.
  - That is not the same as being unavailable. Apple offers compatible iPad apps on Apple-silicon Macs and on Apple Vision Pro by default, unless the developer opts out in App Store Connect. So Uzu may well run on Macs without any Mac edition [Verified correction: https://developer.apple.com/documentation/apple-silicon/running-your-ios-apps-in-macos; https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-apple-vision-pro].

### Cited Findings
**Creator and studio**
- The App Store lists the developer as "Colordodge Labs" and the seller as "Jason K Smith" — [App Store listing (via search)](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723); [AppGrooves](https://appgrooves.com/ios/376551723/uzu-an-interactive-light-show/jason-k-smith)
- Smith's portfolio calls him a "design engineer" and lists Uzu and Kinetiform among his iOS apps. Colordodge.com started as his personal site for visual experiments, and its particle-engine and animation techniques came before Uzu — [jasonkentsmith.com: Colordodge.com](http://jasonkentsmith.com/colordodge/); [colordodge.com](https://www.colordodge.com/)
- The portfolio claims Uzu was the first iPad app to use all 10 fingers. This is an unverified self-claim — [jasonkentsmith.com](http://jasonkentsmith.com/colordodge/)
- A 2010 write-up names "Jason Smith… behind ColorDodge Labs' Uzu" and quotes his tagline "a kinetic multitouch particle visualizer" **[DISTINCTIVE]** — [Tapscape (2010)](https://www.tapscape.com/?p=1320)
- A video interview exists: "This Week in iPad – Jason Smith of Uzu App" — [YouTube](https://www.youtube.com/watch?v=zmyy6yzzwxE)

**Names over time [DISTINCTIVE]**
- The app has had three titles:
  - originally just "Uzu";
  - then "Uzu: A Generative Design Playground", still visible in old iTunes URLs and in the title of a 2018 review;
  - now "Uzu, An Interactive Light Show".
- Sources: [old iTunes URL](https://itunes.apple.com/us/app/uzu-a-generative-design-playground/id376551723?mt=8); [BridgingApps 2018](https://bridgingapps.org/bridgingapps-reviewed-app-uzu-a-generative-design-playground/); [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)
- The listing calls it a "generative design playground" and a "math-physics-art toy" — [App Store (via search)](https://apps.apple.com/us/app/uzu/id376551723)

**Release and versions (dates as reported; several conflict)**
- **First release:** 12 June 2010, App Store ID 376551723 — [AppAdvice](https://appadvice.com/app/uzu-an-interactive-light-show/376551723); [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)
- **Chart peak:** Uzu climbed to #1 soon after Apple opened the iPad App Store in 2010 — [MacStories](https://www.macstories.net/ipad/uzu-for-ipad-as-played-by-non-ipad-users-video/). The listing also claims "#1 on the App Store" — [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)
- **Little Uzu:** an iPhone/iPod touch spin-off (App Store ID 386764406), described as based on "the award winning Uzu for the iPad". An Uzu version-history entry, 1.1.1 dated 2010-09-23, refers to it — [AppAdvice: Little Uzu](https://appadvice.com/app/little-uzu/386764406); [SFGate: App of the Week: Little Uzu](https://www.sfgate.com/tech/article/app-of-the-week-little-uzu-5282839.php)
- **v3.0:** made Uzu universal (iPad, iPhone, iPod touch) and added Retina support, a redesigned UI, and new modes and presets. Mirrors disagree on the date: 2014-08-07 vs 2014-12-29 — [AppFollow](https://apps.appfollow.io/ios/uzu-an-interactive-light-show/376551723); [AppAdvice](https://appadvice.com/app/uzu-an-interactive-light-show/376551723)
- **Later 3.x updates:**
  - one restored the v3.0 factory presets into a "Legacy Presets" section — [AppFollow](https://apps.appfollow.io/ios/uzu-an-interactive-light-show/376551723)
  - one made Uzu run at the device's maximum frame rate: 60 fps on iPhone/iPad and 120 fps on iPad Pro — [AppAdvice listing mirror](https://appadvice.com/app/uzu-an-interactive-light-show/376551723); [AppFollow](https://apps.appfollow.io/ios/uzu-an-interactive-light-show/376551723) [Unverified]. The Uzu release note itself could not be read. The hardware part holds: iPad Pro ProMotion displays switch between 24 Hz and 120 Hz [Verified: https://developer.apple.com/documentation/quartzcore/optimizing-iphone-and-ipad-apps-to-support-promotion-displays]
- **v3.2.1:** released 2021-09-06; the latest version shown on third-party mirrors — [soft112](https://uzu-a-generative-design-playground-ios.soft112.com/); [UpdateStar](https://uzu-an-interactive-light-show.updatestar.com/)
- **v4.0 (release date not found)** — [App Store listing (via search)](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723):
  - an all-new Metal rendering engine;
  - a redesigned SwiftUI interface;
  - nine new shader effects;
  - 67 refreshed factory presets;
  - preset export and import;
  - render-quality settings from Low to Ultra.
- The listing names ten effects: Glow, Warp, Kaleidoscope, Sparkle, Feedback, Color, Gradient, Pixelate, Scanlines and Vignette **[DISTINCTIVE as a set]** — [App Store listing (via search)](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)
- An earlier listing snapshot claimed "21 unique animation modes" tied to touch counts, 55 factory presets, and animation that responds to the microphone — [App Store (via search)](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)
- **Current status, as of 2026-11-12:** still listed and sold. It requires iPadOS 17.6 or later and is "Designed for iPad". The newest listed version is 4.2. One US snapshot shows no in-app purchases — [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723) [Verified: https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723 (search summary; the UK and Costa Rica listings show the same requirement)]. The in-app-purchase detail was not re-checked.
- **Price history:**
  - about $0.99 in 2010 reviews — [Tapscape](https://www.tapscape.com/?p=1320)
  - $1.99 for the iPad app and $0.99 for Little Uzu — [SFGate](https://www.sfgate.com/tech/article/app-of-the-week-little-uzu-5282839.php)
  - $1.99 in a YouTube video description — [YouTube](https://www.youtube.com/watch?v=KuD5ZPrmztw)
  - $1.99 in an autism-apps chart — [Enabling Devices](https://enablingdevices.com/apps-charts-for-the-disabled/apps-for-autism-spectrum/)
  - later snapshots of $2.49 (with an iPadOS 11.0 minimum), $2.99 and $4.99. The current US listing is $3.99, with £3.99 in the UK and €3.99 in Austria — [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723); [SearchMan](https://searchman.com/ios/app/us/376551723/en/colordodge-labs/uzu-an-interactive-light-show/) [Verified correction: https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723 (search summary). The $4.99 snapshot was not found again]

**External display, AirPlay and Apple TV**
- The listing says Uzu appears on an external display while the iPad is used as the controller. It recommends this for social gatherings together with auto-play. This is a **direct precedent for the Tactilume "handheld controls the big screen" idea** — [App Store (via search)](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)
- A rival of that era, Tesla Toy, was singled out for "video out support", which suggests TV-out was a selling point at the time — [AppAdvice AppGuide](https://appadvice.com/appguides/show/light-particle-manipulation-apps-for-the-ipad)
- No Apple TV (tvOS), Mac or visionOS edition of Uzu turned up. A targeted search returned nothing relevant (see Gaps).

**The 32-bit transition**
- A user review passes on Apple's warning that Uzu would stop working on future iOS versions unless updated. This is the iOS 10.3-era 32-bit warning — [App Store reviews](https://apps.apple.com/us/app/376551723?see-all=reviews&platform=iphone)
- Later updates (3.2.1 in 2021, then 4.0) and the live listing show that it survived — [soft112](https://uzu-a-generative-design-playground-ios.soft112.com/); [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)

**Later apps by the same developer**
- **Kinetiform** (App Store ID 1599140822, ©2022): a generative-design iOS app built in Swift. It uses Core Graphics for patterns and Metal for output and its effects shader — [App Store](https://apps.apple.com/us/app/kinetiform/id1599140822); [Smith on LinkedIn](https://www.linkedin.com/posts/jason-smith-00884346_kinetiform-activity-6896940983636901889-40k_)
- **Fluidium** (App Store ID 6745104628): a free interactive fluid-art app "Designed for iPad", with in-app purchases.
  - It is rated 5.0★ from 21 ratings, and an App Store page variant for Apple Vision Pro exists — [App Store](https://apps.apple.com/us/app/fluidium/id6745104628); [Vision Pro page variant](https://apps.apple.com/us/app/fluidium/id6745104628?platform=vision); [colordodge.com](https://www.colordodge.com/)
  - Third-party directories cite about 130 presets, Metal, an Auto-Play mode, and recording and sharing (low-quality sources) — [Beam Tools directory](https://beamtools.com/tool/fluidium)

### Inferences
- **The 4.x line is recent.** The current build, 4.2, requires iPadOS 17.6 or later, so it shipped after iPadOS 17.6 existed. Apple's 17.6 release notes exist (apps for 17.6 are built with the 17.5 SDK in Xcode 15.4) but carry no date, so "mid-2024" remains general knowledge [Unverified].
  - The 17.6 minimum belongs to the current build, not necessarily to 4.0. Older snapshots required iPadOS 11.0, and 4.0's own date is still unknown.
  - The app is therefore maintained in the mid-2020s, after a gap from 2021 to at least 2024 [Verified correction: https://developer.apple.com/documentation/ios-ipados-release-notes/ios-ipados-17_6-release-notes; https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723 (search summary)].
- **Colordodge stays on Apple platforms.** Fluidium's App Store ID range points to registration around 2025 (low confidence).
  - A Vision Pro page variant is not evidence of a visionOS edition. The App Store lists iPhone and iPad apps on Apple Vision Pro unless the developer opts out [Verified correction: https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-apple-vision-pro].
  - So the evidence shows the line moving into fluids on Apple platforms, not into spatial computing.
  - **No Colordodge product exists for Windows or Linux.**
- **Uzu is now a premium legacy title.** The price rose from about $0.99 to about $3–5 with no in-app purchases. It now lives on brand recognition, not chart position (see the #181 Entertainment snapshot in §3).
- **The second-screen idea is not new.** Uzu's external display with the iPad as controller already did "a handheld controls the big screen". Tactilume's novelty has to come from **several simultaneous phone controllers and gamepads, desktop-class scale and social play**.

### Gaps
- The exact v4.0 release date and full version history: the App Store page could not be fetched.
- Archived copies of listing 376551723 on web.archive.org could not be read: the fetch was blocked and the search budget was used up. So the pre-4.0 description, the launch price as listed, and the early "What's New" notes are rebuilt from 2010-era coverage and third-party mirrors, not from the archive.
- Whether Little Uzu (ID 386764406) is still sold, or was folded into the universal app at v3.0.
- Whether the external display used screen mirroring or a dedicated second-screen output. Also when external display, auto-play and microphone input were each added.
- Whether the iPad build is offered on Apple-silicon Macs. By default it would be: the App Store makes compatible iPhone and iPad apps available on Apple-silicon Macs unless the developer opts out.
  - Apple suggests opting out when an app relies heavily on custom multi-finger touch with no practical alternative, which fits Uzu's finger-count modes [Verified correction: https://developer.apple.com/documentation/apple-silicon/running-your-ios-apps-in-macos].
  - Check the Mac App Store by hand.
- No AirPlay-specific or Apple TV feature was found, but that absence is not proven.
- The name's meaning: "Uzu" is Japanese for swirl or whirlpool. This is general knowledge and was not sourced in this research.

## 2. How did Uzu's interaction work, and what made it feel distinctive?

### Takeaway
- **The core mechanic:** the number of fingers on the glass selects the animation mode. Each count from 0 to 10 had its own named particle behaviour, so the hand was the whole interface.
- Ten fingers worked as a parameter gesture that changed colour and particle size.
- An auto-play mode added virtual touches of its own.
- Later versions added microphone reactivity, presets, screenshots, post-process shader effects and render-quality tiers.
- **What made it feel distinctive:** no visible UI, full-hand multitouch on a big glass surface, instant response, and pseudo-3D swirls.

### Cited Findings
- **Mode table [DISTINCTIVE: do not copy the names, the numbering or the mapping]**, as reported by reviewers and the listing:

  | Touches | Mode |
  |---|---|
  | 0 | Brownian motion with boundary wrap |
  | 1 | emanate and radiate |
  | 2 | pinch attraction with boundary bounce |
  | 3 | tri-point vortex |
  | 4 | quad-point inverted vortex |
  | 5 | 3D freeze and translate |
  | 6 | 3D oscillating mass |
  | 7 | 3D tri-arm spiral |
  | 8 | 3D warp and inverted translate |
  | 9 | springy space ribbons |
  | 10 | change colour and particle size |

  Sources: [Digital Mom Blog](https://www.digitalmomblog.com/baby-and-the-ipad-app-uzu/); [iPadHelp](https://ipadhelp.com/entertainment-apps/uzu-visualizer/); [AppSafari](https://appsafari.com/games/12286/uzu/); [App Store (via search)](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)
- The marketing described this as switching between "10 different modes of real-time animation" just by changing how many fingers you use — [App Store (via search)](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723); [BridgingApps](https://bridgingapps.org/bridgingapps-reviewed-app-uzu-a-generative-design-playground/)
- **Auto-play [DISTINCTIVE]:** Uzu adds its own touches to the user's touches. If the combined count goes above 10, the mode wraps back to 1 Touch — [App Store (via search)](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)
- **Little Uzu differed [DISTINCTIVE].** Its 3-touch slot held eight sub-modes that cycled each time all fingers lifted. Named examples are vortex, inverted vortex, radial vortex, dual oscillator, spiral, spring points and radial spokes — [AppAdvice: Little Uzu](https://appadvice.com/app/little-uzu/386764406)
- **Reviews describe freezing differently.** One 2010-era review says 5 fingers partly suspend motion and 10 fingers freeze it, while the mode list puts "3D freeze" at 5. The search summary did not say which of these two pages carries which wording — [iPadHelp](https://ipadhelp.com/entertainment-apps/uzu-visualizer/); [iPad App A Day](https://ipadappaday.wordpress.com/2010/08/01/uzu-psychedelic-fireworks/)
- **2010 observations** — [iPad App A Day, 2010-08-01](https://ipadappaday.wordpress.com/2010/08/01/uzu-psychedelic-fireworks/) (attribution via search summary):
  - colour stayed within yellow, green and red shifts until many fingers were down;
  - the app worked best with the iPad lying flat on a table.
- **Later features:**
  - animation that reacts to the microphone — [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)
  - factory presets: 55 in a 3.x snapshot, 67 "refreshed" in 4.0, plus the "Legacy Presets" folder — [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723); [AppFollow](https://apps.appfollow.io/ios/uzu-an-interactive-light-show/376551723)
  - screenshot saving; the version notes mention a crash fix for it — [App Store reviews (via search)](https://apps.apple.com/us/app/376551723?see-all=reviews&platform=iphone)
  - in 4.0: shader effects, preset export and import, and Low-to-Ultra render quality — [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)
- **Hidden controls.** Earlier versions had "hidden controls" and a "randomize all" function, and later users asked for them back. This suggests a settings layer revealed by gesture that a redesign removed or changed — [App Store reviews (via search)](https://apps.apple.com/us/app/376551723?see-all=reviews&platform=iphone)
- The developer's portfolio presents the use of all 10 fingers as the key innovation — [jasonkentsmith.com](http://jasonkentsmith.com/colordodge/)
- Therapists compared it to a spirograph on your device, used by moving between its 10 modes with your fingers — [BridgingApps, Oct 2018](https://bridgingapps.org/bridgingapps-reviewed-app-uzu-a-generative-design-playground/)

### Inferences
- **What made it distinctive:**
  - **A chord vocabulary.** Choosing the mode by finger count needs no tutorial. It works for a toddler slapping a palm and for an expert holding a precise seven-finger chord.
  - **Nothing on screen but the art.** With no visible controls, it suited projection and parties.
  - **Physical feel.** Fingers and particles were tightly coupled, so it felt tactile.
  - **Depth.** The pseudo-3D modes (freeze, translate, spiral, ribbons) went beyond flat 2-D fluid toys.
  - **Ambient use.** Auto-play turned it into an ambient display.
- **Weaknesses built into the scheme:**
  - The mapping is invisible, so people find modes by accident.
  - Lifting fingers changes the mode without meaning to.
  - Colour stayed narrow until more fingers were down (2010).
  - None of it translates to a phone held in one hand, where 1–3 thumbs or fingers is realistic, or to gamepads.
- **Tactilume needs a different organising principle anyway.** Candidates: per-player tools, gesture shape and speed, stick and trigger verbs, or scene-level "worlds". Avoiding Uzu's structure is legally prudent and also functionally right.

### Gaps
- The exact menu and settings UI, the parameter list (particle count, speed, trails, symmetry) and how presets were browsed. Screenshots could not be fetched.
- Whether Uzu ever produced sound. I found no evidence of sound output, only microphone input.
- What "21 unique animation modes" means: 21 in total, or several per touch count.
- Particle counts per device.

## 3. What did reviewers and users say? Ratings, articles, awards, videos and community uses, plus recurring complaints and feature requests.

### Takeaway
- Uzu was a hit of the 2010 iPad launch window. It drew short, enthusiastic press blurbs (Wired, Ars Technica), blog reviews, chart success and self-reported Apple editorial features.
- Its lasting audiences were toddlers and families, special education and sensory therapy, and people using it as a "trippy" party visual.
- User ratings stay high, about 4.8–4.9★ in snapshots.
- Complaints centre on crashes after updates, long gaps between updates, and missing capture, sharing and customisation features.

### Cited Findings
**Press and awards (mostly self-reported through the listing)**
- A Wired blurb sits in the listing title. Paraphrased, it calls Uzu doodling for digital natives and "mind blowing" **[marketing copy: do not reuse]** — [App Store UK](https://apps.apple.com/gb/app/id376551723)
- An Ars Technica blurb calls it "endlessly complicated, simply fun". One search summary credited this line to Wired, but the listing and a download mirror credit Ars Technica — [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723); [soft112](https://uzu-a-generative-design-playground-ios.soft112.com/)
- The listing claims these accolades — [App Store (via search)](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723):
  - Apple "App of the Week";
  - #1 on the App Store;
  - "Apple Rewind: Best Generative Art and Sound App";
  - "App Store Essentials Hall of Fame".
  - All are self-reported and not independently verified.
- MacStories covered its fast climb to #1 after the iPad App Store opened, and posted a video of people without iPads trying it — [MacStories](https://www.macstories.net/ipad/uzu-for-ipad-as-played-by-non-ipad-users-video/)
- **2010 coverage:**
  - Mario Armstrong's "Appsauce" (2010-07-05) called it the most fun eye candy in the store — [marioarmstrong.com](https://www.marioarmstrong.com/2010/07/05/eyeuzu-appsauce/)
  - iPad App A Day (2010-08-01) described it as "psychedelic fireworks" — [ipadappaday](https://ipadappaday.wordpress.com/2010/08/01/uzu-psychedelic-fireworks/)
  - Tapscape rated it 8/10 at $0.99 — [Tapscape](https://www.tapscape.com/?p=1320)
  - AppAdvice ran a head-to-head with Midnight HD (September 2010) — [AppAdvice](https://appadvice.com/appnn/2010/09/midnight-hd-uzu-particle-visualizer-head-head.amp)
- SFGate's "App of the Week" covered Little Uzu. The search index dates it 2014, but it may be an older column re-dated — [SFGate](https://www.sfgate.com/tech/article/app-of-the-week-little-uzu-5282839.php)
- **Demo videos:**
  - "Uzu – a kinetic multitouch particle visualizer for the iPad" — [YouTube](https://www.youtube.com/watch?v=etEqfBrVp1w)
  - a video titled for iPhone, iPod touch and iPad that lists it at $1.99 — [YouTube](https://www.youtube.com/watch?v=KuD5ZPrmztw)

**Ratings and commercial snapshots (dates unknown; vary by region)**
- One snapshot shows 4.8★ from 266 ratings and another 4.9★ from 26. The search summary did not say which page carries which figure — [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723); [AppFollow](https://apps.appfollow.io/ios/uzu-an-interactive-light-show/376551723)
- AppGrooves aggregates 3,662 reviews — [AppGrooves](https://appgrooves.com/ios/376551723/uzu-an-interactive-light-show/jason-k-smith)
- A recent snapshot places it #181 in Entertainment — [App Store (via search)](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)
- A third-party estimator claims about 22.7k downloads and about $9.3k revenue "last month". These figures are undated and of low reliability — [appstor.io](https://appstor.io/app/uzu-generative-design-playground)

**Community uses**
- **Toddlers and families:**
  - a blogger had his 23-month-old "review" it (2010-08-13) — [Jeffrey Friedl's Blog](https://regex.info/blog/2010-08-13/1606)
  - a parenting blog features babies using it — [Digital Mom Blog](https://www.digitalmomblog.com/baby-and-the-ipad-app-uzu/)
- **Therapy and special needs:**
  - A BridgingApps review (Easter Seals Greater Houston, October 2018) recommends it for fine motor and finger-isolation skills, visual and sensory needs, group turn-taking and sequencing, and relaxation by focusing on an animation while breathing — [BridgingApps](https://bridgingapps.org/bridgingapps-reviewed-app-uzu-a-generative-design-playground/)
  - It is listed under "Sensory/Relaxation" in an autism-apps chart — [Enabling Devices](https://enablingdevices.com/apps-charts-for-the-disabled/apps-for-autism-spectrum/)
  - A sensory-apps blog likens it to a blend of drawing, light sabers, lava lamps and a rave, and recommends it for autistic users with sensory needs — [The Curated Culture](https://thecuratedculture.com/im-sharing-my-favorite-sensory-apps-because-everyone-needs-one-sometimes/)
- **Trippy and party use:**
  - reviewers call it psychedelic or trippy, and one App Store reviewer says they found it via Reddit — [App Store (via search)](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723); [ipadappaday](https://ipadappaday.wordpress.com/2010/08/01/uzu-psychedelic-fireworks/)
  - the listing itself pitches external display plus auto-play for social gatherings — [App Store (via search)](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)

**Complaints and feature requests** (App Store reviews from roughly 2014–2024, via search) — [App Store reviews](https://apps.apple.com/us/app/376551723?see-all=reviews&platform=iphone); [App Store CA](https://itunes.apple.com/ca/app/uzu-an-interactive-light-show/id376551723?mt=8)
- **Crashes:**
  - crashes on tap after an update; one user said the app would not open after a February update;
  - crashes on older iOS versions and on an iOS 4.2 beta;
  - crashes when saving a screenshot, which the notes say was fixed but some users said persisted.
- **Gaps between updates:**
  - one reviewer noted it had not been updated in over three years;
  - users asked for iPhone X and new iPad screen sizes;
  - one review passed on Apple's 32-bit warning.
- **Requests:**
  - an Apple Watch version, which one user offered to pay extra for;
  - an adjustable background colour;
  - **video recording and export, not just photos**;
  - the return of the hidden controls and "randomize all";
  - direct sharing to Twitter;
  - more settings.
- **Praise:** the visuals and touch response. Reviewers also welcomed the sound-reactive mode and the 120 Hz iPad Pro update.

### Inferences
- **Mood, not goals.** Uzu's lasting value was as a calming or sensory tool and a social spectacle more than as a game, and people kept using it for mood rather than goals.
- **Easy wins on desktop.** The most-requested features are exactly what desktop hardware makes easy: video capture, sharing, colour control, randomise, and stability. They are low-risk ways to stand apart.
- **Fond memory without staying power.** Press coverage was blurb-sized, so the app was remembered fondly yet still slid to #181. Without new content and updates, people stop finding a toy.

### Gaps
- The full Wired and Ars Technica articles were not found. Apple's editorial awards could not be verified independently.
- No Reddit, MacRumors or TouchArcade threads were retrieved because fetches were blocked. Evidence of professional VJ use is anecdotal: only the listing's pitch.
- No authoritative sales figures.

## 4. Which apps and tools define the genre today, what does each do best, and are there direct successors or clones of Uzu?

### Takeaway
Six overlapping families define the 2026 landscape:
1. **Touch particle and light toys:** Uzu and its iPad peers, plus Silk.
2. **Fluid toys:** Pavel Dobryakov's WebGL Fluid, Magic Fluids, Fluidium, and Plasma Pong as the fluid *game*.
3. **Generative audio-visual instruments:** Eno and Chilvers' apps, Electroplankton, Panoramical, and Jeff Minter's light synths.
4. **Music visualisers:** MilkDrop and its successors projectM and Butterchurn, the Virtual Light Machine (VLM) and Neon, Synesthesia, and Wallpaper Engine's audio wallpapers.
5. **Emergent artificial-life simulations:** Clusters and Particle Life.
6. **Professional real-time tools:** TouchDesigner and its new POPs, Notch, and Shadertoy and compute.toys.

I found **no direct Uzu clone or "Uzu 2"**. Its lineage continues only through the same developer's Kinetiform and Fluidium. The closest new desktop analogue is Atomic Particle Engine (Steam, April 2026).

### Cited Findings
**Touch light toys (Uzu's peers)**
- **Ions (iPad):** praised as more controllable than Uzu — [MacStories](https://www.macstories.net/ipad/ions-impressive-particle-visualizer-for-ipad/)
  - you place emitters and negative fields;
  - a slider controls gravity;
  - it ran up to 20,000 particles at $0.99;
  - a later "Ions 2+" allows up to 100k particles on fast devices — [iPhoneness roundup](https://www.iphoneness.com/iphone-apps/particle-visualizers-iphone-ipad/)
- **Other iPad peers** listed in roundups — [AppAdvice AppGuide](https://appadvice.com/appguides/show/light-particle-manipulation-apps-for-the-ipad); [iPhoneness](https://www.iphoneness.com/iphone-apps/particle-visualizers-iphone-ipad/):
  - Gravitarium and Gravitarium2: particle art that visualises music and can be shared. Gravitarium Live is still listed — [App Store](https://apps.apple.com/us/app/gravitarium-live-music-visualizer/id438667778)
  - Particlescape: up to 10 simultaneous touches.
  - Tesla Toy: 10 ways to interact, plus video out.
  - Midnight HD.
  - "1000+": draws lines instead of particles.
- **Modern iPad entrants:**
  - Particle Simulation – Flow Sim: free with in-app purchases, with **NDI output to MadMapper and Resolume** — [App Store](https://apps.apple.com/us/app/particle-simulation-flow-sim/id6467405758)
  - Particle Generator: $2.99, custom effects and video recording — [App Store](https://apps.apple.com/us/app/particle-generator/id1617577097)
- **Silk / Weavesilk (Yuri Vishnevsky):** a browser toy that draws generative "light lattice" strokes — [Creative Bloq](https://www.creativebloq.com/art/weave-beautiful-patterns-light-awesome-tool-2132002); [ScreenWise](https://screenwiseapp.com/media/silk-website); [App Store](https://apps.apple.com/us/app/silk-legacy-for-older-devices-interactive-generative-art/id436590129); [National Math Festival](https://www.nationalmathfestival.org/resources/silk-interactive-generative-art)
  - mirror and rotational symmetry, later up to 6-way plus a spiral mode;
  - Web Audio sound design by Mat Jarvis;
  - iPad apps "Silk Legacy" and "Silk 2";
  - used in maths classes to teach symmetry.
  - *Best at:* instant beauty from a single stroke, with symmetry and gentle sound.

**Fluid toys**
- **Pavel Dobryakov's WebGL Fluid Simulation (October 2017):** a GPU fluid based on the GPU Gems article "Fast Fluid Dynamics Simulation on the GPU". It was featured on Google Experiments and has iOS and Android apps — [Google Experiments](https://experiments.withgoogle.com/fluid-simulation); [Kottke](https://kottke.org/19/05/webgl-fluid-dynamics-simulator)
  - The README cites that GPU Gems chapter, and the code is MIT-licensed, copyright 2017 [Verified: https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/master/README.md; https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/master/LICENSE]. The month (October), the Google Experiments feature and the apps were not re-checked.
  - A 2019 update improved bloom, made behaviour consistent across resolutions and **improved handling of high-refresh-rate displays** — [X post](https://x.com/paveldogreat/status/1158862042964602882)
    - The post's ID decodes to 2019-08-06, because X post IDs encode their posting time. The current code steps the simulation by wall-clock time capped at 1/60 s (`calcDeltaTime`), so speed does not depend on refresh rate [Verified: https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/master/script.js].
    - The post's own wording could not be read.
  - *Best at:* instant delight in the browser with nothing to install; widely forked.
- **Magic Fluids** (developer "Mad Scientist"): a "relaxing" fluid app with 70+ presets, video recording, an Android live-wallpaper mode and a Lite tier. It requires iOS 15.6 or later — [App Store](https://apps.apple.com/us/app/magic-fluids-visual-art-fun/id1437510558); [Google Play](https://play.google.com/store/apps/details?id=com.magicfluids&hl=en); [magicfluids.net](https://magicfluids.net/)
- **Fluidium** (Colordodge Labs): see §1.
- **Plasma Pong** (Steve Taylor, a George Mason University student, around 2006–07) — [Wikipedia](https://en.wikipedia.org/wiki/Plasma_Pong); [MobyGames](https://www.mobygames.com/game/windows/plasma-pong); [Fun-Motion](https://www.fun-motion.com/?p=44); [SIGGRAPH history](https://history.siggraph.org/?p=47815):
  - Pong played inside a stable-fluids field based on Jos Stam's method;
  - players inject plasma, create a vacuum from the paddle, and blast shockwaves;
  - pulled in 2007 after Atari Interactive objected on Pong-trademark grounds;
  - listed in the SIGGRAPH history archive.
  - *Best at:* proving that fluid particles can carry a competitive two-player game.

**Generative audio-visual instruments**
- **Brian Eno and Peter Chilvers:**
  - their apps: Bloom (2008), Trope (2009), Scape (2012; Chilvers' site says 2013 in one place), Reflection (1 January 2017) and Bloom: 10 Worlds (2018);
  - Reflection is an album plus a "completely passive" generative app on iOS and **Apple TV**;
  - Bloom: Open World was an augmented-reality installation with Microsoft in Denmark;
  - the work grew out of Eno's Spore score, and Scape took two years to develop;
  - no releases from 2025–26 were found.
  - Sources: [Wikipedia: Bloom](https://en.wikipedia.org/wiki/Bloom_%28software%29); [Tape Op interview](https://tapeop.com/interviews/137/peter-chilvers); [Eno shop](https://enoshop.co.uk/blogs/news/brian-eno-peter-chilvers-release-new-app-bloom-10-worlds); [TapSmart](https://www.tapsmart.com/features/classics-reflection/); [Chilvers' apps page](http://www.peterchilvers.com/?page_id=122)
  - *Best at:* sound-first generative calm and an ambient TV mode.
- **Toshio Iwai's Electroplankton** (Nintendo DS; 2005 in Japan, 2006 in Europe and North America) — [Wikipedia: Toshio Iwai](https://en.wikipedia.org/wiki/Toshio_Iwai):
  - ten audio-visual toys using the touchscreen and microphone;
  - its roots are a 1994–95 ZKM project in which **several participants made visuals and music together**;
  - Iwai's Otocky (1987) was a precursor of Rez.
- **Tetsuya Mizuguchi's synaesthesia line:** Rez, Lumines, Child of Eden and Tetris Effect, plus Rez Infinite in VR (2016) and the "Synesthesia Suit" (2015) — [Wikipedia: Mizuguchi](https://en.wikipedia.org/wiki/Tetsuya_Mizuguchi); [Keio KMD](https://www.kmd.keio.ac.jp/?p=10333)
- **Panoramical** (2015; Fernando Ramallo and David Kanaga; published by Finji with Polytron and Indie Fund):
  - 15 abstract audio-visual landscapes;
  - each "dimension" maps to the mouse, a gamepad, a joystick or MIDI knobs;
  - $10 on PC and Mac, plus a $125 limited-run dedicated MIDI controller;
  - Engadget framed it as musical meditation and Kill Screen as an interactive visualiser.
  - Sources: [Engadget](https://www.engadget.com/2015-09-18-panoramical-finji-polytron-indie-fund.html); [Venus Patrol](https://venuspatrol.com/2012/09/fernando-ramallo-david-kanaga-tease-their-midi-controlled-musical-landscape-paranormical); [SIGGRAPH 2015 Labs PDF](https://history.siggraph.org/wp-content/uploads/2022/06/2015-Labs-Ramallo_Panoramical.pdf); [Kill Screen](https://www.killscreen.com/panoramical-turns-sound-magical-color-and-back-again/)
  - *Best at:* exploring curated audio-visual worlds with a controller on desktop. It is the **closest precedent for gamepad play**.
- **Jeff Minter's light synths:**
  - Psychedelia (1984, Commodore 64): the joystick launches bursts of coloured blocks. Reviews were mixed, and one magazine called it boring.
  - Colourspace (1985).
  - Trip-a-Tron (1987).
  - Virtual Light Machine (VLM; the summarised Wikipedia text dates it 1990):
    - the first in the line to react to music;
    - shipped with the Atari Jaguar CD and with Nuon DVD players;
    - had an interactive mode for changing visuals live;
    - VLM-2 appeared on Nuon, and VLM-3 was never released.
  - Neon: built on the VLM engine and shipped on Xbox 360. The same engine was used in Space Giraffe.
  - Psychedelia and Colourspace were re-released in *Llamasoft: The Jeff Minter Story* (2024).
  - Minter says he did not know about Atari's earlier Video Music hardware when he started.
  - Sources: [Wikipedia: Psychedelia](https://en.wikipedia.org/wiki/Psychedelia_%28light_synthesizer%29); [Wikipedia: VLM](https://en.wikipedia.org/wiki/Virtual_Light_Machine); [Wikipedia: Llamasoft Story](https://en.wikipedia.org/wiki/Llamasoft:_The_Jeff_Minter_Story); [Time Extension on Atari Video Music](https://www.timeextension.com/features/most-of-my-engineers-were-stoned-nolan-bushnell-on-the-failure-of-atari-video-music)

**Music visualisers**
- **The MilkDrop lineage:**
  - libprojectM 4.1.4 (2025-01-24) fixed an issue on systems with only core OpenGL 4.1 or lower: mainly macOS, but also some older Linux distributions [Verified: https://sourceforge.net/projects/projectm.mirror/files/v4.1.4/].
  - Releases continued with 4.1.5 (2025-11-03), 4.1.6 (2025-11-28), 4.1.7 (2026-07-14) and 4.1.8 (2026-10-06).
    - The mirror's dates are consistent, and the v4.1.4 to v4.1.8 tags exist on GitHub.
    - `master` is at 4.2.0, which is not yet released.
    - libprojectM is LGPL-2.1-or-later.
    - [Verified: https://sourceforge.net/projects/projectm.mirror/files/; https://github.com/projectM-visualizer/projectm/blob/v4.1.8/CMakeLists.txt; https://github.com/projectM-visualizer/projectm/blob/master/CMakeLists.txt; https://github.com/projectM-visualizer/projectm/blob/master/COPYING]
  - Butterchurn, a WebGL port of MilkDrop, is MIT-licensed.
    - Its npm `latest` is still 2.6.7, published 2019-03-12.
    - A 3.0 line has been in beta since 2021. 3.0.0-beta.5, published 2025-07-13 under the `beta` tag, is what `master`'s package.json declares.
    - [Verified correction: https://registry.npmjs.org/butterchurn; https://github.com/jberg/butterchurn/blob/master/package.json; https://github.com/jberg/butterchurn/blob/master/LICENSE]
    - The last push in April 2026 could not be checked, because the GitHub API is blocked here [Unverified].
  - It is embedded in a Jellyfin plugin **with TV and controller support**.
    - The plugin, jellybutter, takes a D-pad, remote or gamepad and is MIT-licensed. It pins Butterchurn 2.6.7 and butterchurn-presets 2.4.7.
    - The presets package is MIT too, though each preset carries its author's name [Verified: https://github.com/rappo/jellybutter/blob/main/README.md; https://registry.npmjs.org/butterchurn-presets].
    - It also appears in the Cider music player and in a Chrome extension [Unverified].
  - Sources: [projectM discussion](https://github.com/orgs/projectM-visualizer/discussions/867); [SourceForge mirror](https://sourceforge.net/projects/projectm.mirror/files/); [jsDelivr: butterchurn](https://www.jsdelivr.com/package/npm/butterchurn); [jellybutter](https://github.com/rappo/jellybutter); [Cider plugin](https://marketplace.cider.sh/plugins/4); [Wikipedia: MilkDrop](https://en.wikipedia.org/wiki/MilkDrop)
  - *Best at:* a huge preset library and audio reactivity you can set and forget.
- **Synesthesia (Gravity Current; out of beta around 2015):** shader-based, audio-reactive VJ software whose scenes draw on Shadertoy-style GLSL shaders.
  - Its controls can be mapped to MIDI and OSC.
  - An aggregator claims the Pro tier adds Syphon, Spout and NDI output.
  - Sources: [developer blog](https://victor-shepardson.github.io/blog/posts/synthesthesia); [aggregator listing](https://eliteai.tools/tool/synesthesia)
  - Peers: Magic Music Visuals, and Imaginando VS, which is driven by audio and MIDI and imports ISF, GLSL Sandbox and Shadertoy shaders — [Magic Music Visuals](https://magicmusicvisuals.com/); [Imaginando VS](https://www.imaginando.pt/products/vs)
- **Wallpaper Engine (Steam):** its editor includes a particle-system editor and scripting. "Audio responsive" is a common Workshop tag, and a retailer claims more than 1 million mostly free Workshop wallpapers — [Wikipedia](https://en.wikipedia.org/wiki/Wallpaper_Engine); [gg.deals](https://gg.deals/application/wallpaper-engine/); [gHacks review](https://www.ghacks.net/?p=131064)
  - *Best at:* an always-on ambient presence on the desktop, plus a creator ecosystem.

**Steam and desktop particle toys (2026)**
- **Atomic Particle Engine** (Steam, April 2026): an interactive particle sandbox and music-reactive visualiser. You draw particle trails and bursts with the mouse, and it is marketed for relaxation and experimentation — [Steam](https://store.steampowered.com/app/4513520/Atomic_Particle_Engine/)
- **Also on Steam:**
  - Sand:box, a falling-sand sandbox — [Steam](https://store.steampowered.com/app/2179380/)
  - Particulate, a VR particle sandbox tagged music and relaxing — [Steam](https://store.steampowered.com/app/1196940/Particulate/)
  - "Interactive 3D Particle Playground (+Binaural Audio)", a Wallpaper Engine item that has since been removed — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=884494327)

**Emergent artificial life**
- Jeffrey Ventrella's "Clusters" inspired Tom Mohr's Particle Life, which simplified the rules — [Ventrella: Clusters](https://www.ventrella.com/Clusters/); [particle-life.com project](https://particle-life.com/about/project.html); [implementations list](https://particle-life.com/about/implementations.html)
  - Mohr ships a Java desktop app for Windows, with source on GitHub.
    - It is at version 1.3.1. It installs on Windows and runs from source with JDK 17–25, using a Java 21 runtime.
    - It is licensed GPL-3.0, so reusing its code would put Tactilume under GPL-3.0 too.
    - [Verified: https://github.com/tom-mohr/particle-life-app/blob/main/README.md; https://github.com/tom-mohr/particle-life-app/blob/main/LICENSE.md; https://github.com/tom-mohr/particle-life-app/blob/main/gradle.properties]
  - Ventrella's iOS app is no longer on the App Store.
  - Community ports exist for the GPU and WebGPU, plus a browser version with generative audio.
  - *Best at:* lifelike emergence from a few sliders, and endless novelty.

**Professional real-time tools**
- **TouchDesigner (Derivative):**
  - its new **POPs (Point Operators)** family is GPU-accelerated and started in alpha;
  - build 2025.32460 (2026-03-10) added four POPs, including Text and Trace;
  - the docs list build 2025.33230, with notes dated 2026-09-01;
  - the third-party POPX extends POPs for real-time simulation.
  - Sources: [Derivative release](https://derivative.ca/release/202532460/74120); [docs](https://docs.derivative.ca/?title=Palette); [Interactive & Immersive HQ](https://interactiveimmersive.io/blog/touchdesigner-3d/pops-the-new-operator-family-in-touchdesigner/); [POPX](https://www.popx.tools/)
- **Notch:** evidence is limited to an InfoComm 2026 session on building interactive systems with TouchDesigner and Notch (19 June 2026) — [InfoComm 2026](https://www.infocommshow.org/2026-sessions/build-it-live-interactive-systems-with-touchdesigner-notch)
- **Shadertoy:** an online community for GLSL shaders, with no evidence found of a move to WebGPU.
  - compute.toys is described as "Shadertoy for WebGPU compute shaders".
    - Its README calls it a WebGPU compute-shader playground that runs in the browser.
    - Shaders are now written in Slang, which is compiled to WGSL.
    - The code is MIT-licensed.
    - [Verified: https://github.com/compute-toys/compute.toys/blob/master/README.md; https://github.com/compute-toys/compute.toys/blob/master/LICENSE]
  - wgshadertoy and Rust GPU ports of Shadertoy shaders (April 2025) also exist.
  - Sources: [Wikipedia: Shadertoy](https://en.wikipedia.org/wiki/Shadertoy); [compute.toys](https://awesome.ecosyste.ms/projects/github.com%2Fcompute-toys%2Fcompute.toys); [Rust GPU blog](https://rust-gpu.github.io/blog/2025/04/10/shadertoys)

**Direct Uzu successors or clones**
- No product presenting itself as an Uzu successor or clone turned up. "Apps like Uzu" lists point to the peers above — [Appfelstrudel](https://appfelstrudel.com/a/376551723/alternative-to-uzu-an-interactive-light-show.html); [AppAdvice AppGuide](https://appadvice.com/appguides/show/light-particle-manipulation-apps-for-the-ipad)
- The developer's own continuation is Kinetiform (2022) and Fluidium — [App Store: Kinetiform](https://apps.apple.com/us/app/kinetiform/id1599140822); [App Store: Fluidium](https://apps.apple.com/us/app/fluidium/id6745104628)

### Inferences
- **What each does best, and what Tactilume can borrow:**

  | Product | Strength worth borrowing |
  |---|---|
  | Uzu | instant hand control with nothing on screen |
  | Ions | emitters and fields you place, so you can compose |
  | Silk | symmetry and sound make anyone look talented |
  | Dobryakov's fluid | zero-friction start, distributed on the web |
  | Magic Fluids, Fluidium | presets, recording, ambient and wallpaper modes |
  | Plasma Pong | fluid as a shared competitive arena |
  | Eno and Chilvers | sound-first calm and a passive TV mode |
  | Electroplankton | many small toys, one idea each |
  | Panoramical | controller "dimensions" over curated worlds |
  | Minter | live performance and music reactivity from a joystick light synth |
  | MilkDrop / projectM | huge preset libraries, hands-off audio reactivity |
  | Synesthesia, Flow Sim | NDI, Spout or Syphon output, plus MIDI and OSC control |
  | Wallpaper Engine | always-on ambient mode and a creator economy |
  | Particle Life | emergent "creatures" |
  | TouchDesigner, Notch, Shadertoy | power and community, at the cost of being expert tools |

- **The open slot.** No surveyed product combines all four of:
  1. desktop-class GPU particles;
  2. several simultaneous players on phones and gamepads;
  3. audio reactivity plus generated sound;
  4. instant, consumer-grade play.

  Professional tools have (1) and professional outputs but lack (2) and (4). Mobile toys have (4) but lack (1) and (2).

### Gaps
- A "Fluidity" app could not be identified, and a Particle Life release on Steam could not be confirmed. Notch's 2026 status was not researched in depth.
- No sales or engagement data were found for any of these toys.
- Atomic Particle Engine's details come from a search summary of its Steam page. How players received it is unknown.

## 5. What design principles make particle light toys compelling, and what pitfalls matter?

### Takeaway
Particle toys work when:
- touching produces light that responds instantly and physically;
- simple rules produce emergent surprise;
- sound and image are coupled;
- the toy supports both active play and passive calm;
- people can capture and share what they make.

The big pitfalls are:
- photosensitive flashing, which has hard numeric limits;
- sensory overload for exactly the audiences that love these toys;
- hidden mappings that hurt discoverability;
- novelty wearing off without content, goals or updates;
- borrowing protected names, as Plasma Pong did.

### Cited Findings
- **Latency:**
  - Microsoft Research reported that typical touchscreens lag about 100 ms and demonstrated a 1 ms prototype in 2012 — [Microsoft blog](https://blogs.microsoft.com/next/2012/03/12/taking-touch-screens-from-100-millisecond-lag-to-1-millisecond/) [Unverified]. The host is blocked. The CHI 2014 paper below gives 65–120 ms end-to-end latency for commercial devices, which is consistent.
  - A 2014 stylus study found people could tell about 1 ms from 2 ms when dragging, but only about 7 ms from 40 ms when scribbling. Dragging is the most latency-sensitive gesture — [CHI 2014 stylus-latency paper](https://webdocs.cs.ualberta.ca/~wfb/publications/C-2014-SIGCHI-Latency.pdf) [Verified: https://webdocs.cs.ualberta.ca/~wfb/publications/C-2014-SIGCHI-Latency.pdf (search summary of the abstract; the host is blocked here)]
  - For inking, the noticeable latency is about 50 ms, against about 2–7 ms for tasks other than inking — [GI 2014 inking paper](https://webdocs.cs.ualberta.ca/%7Ewfb/publications/C-2014-GI-Latency.pdf) [Unverified]
  - A related patent reports thresholds of about 2.4–11.4 ms (mean about 6 ms) against a 1 ms reference — [US patent 9836313](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9836313) [Unverified]
- **Frame rate matters to users:**
  - Uzu reviewers welcomed the 120 Hz iPad Pro update — [App Store reviews (via search)](https://apps.apple.com/us/app/376551723?see-all=reviews&platform=iphone)
  - Dobryakov updated his fluid simulation specifically for high-refresh displays — [X](https://x.com/paveldogreat/status/1158862042964602882)
- **Emergence:** Particle Life produces lifelike structures from a few attraction rules, which Mohr simplified for elegance — [Ventrella](https://www.ventrella.com/Clusters/); [VakeyLabs ParticleLife](https://github.com/VakeyLabs/ParticleLife)
- **Sound coupling:**
  - the VLM's key step forward was reacting to music, not just to input — [Wikipedia: VLM](https://en.wikipedia.org/wiki/Virtual_Light_Machine)
  - Uzu added microphone reactivity, and reviewers praised it — [App Store reviews](https://apps.apple.com/us/app/376551723?see-all=reviews&platform=iphone)
  - Electroplankton combined touch and microphone — [Wikipedia](https://en.wikipedia.org/wiki/Toshio_Iwai)
  - Mizuguchi built his design career on synaesthesia — [Wikipedia](https://en.wikipedia.org/wiki/Tetsuya_Mizuguchi)
- **Calm, flow and passive modes:**
  - Reflection is completely passive — [Tape Op](https://tapeop.com/interviews/137/peter-chilvers)
  - Panoramical was framed as musical meditation — [Engadget](https://www.engadget.com/2015-09-18-panoramical-finji-polytron-indie-fund.html)
  - therapists use Uzu for relaxation and breathing — [BridgingApps](https://bridgingapps.org/bridgingapps-reviewed-app-uzu-a-generative-design-playground/)
  - Magic Fluids and Atomic Particle Engine both market relaxation — [App Store](https://apps.apple.com/us/app/magic-fluids-visual-art-fun/id1437510558); [Steam](https://store.steampowered.com/app/4513520/Atomic_Particle_Engine/)
- **Composition and control:** Ions was praised for letting users place emitters and fields, going beyond Uzu's freeform play — [MacStories](https://www.macstories.net/ipad/ions-impressive-particle-visualizer-for-ipad/)
- **Discoverability:**
  - in 2010, Uzu's colour stayed narrow until many fingers were down — [ipadappaday](https://ipadappaday.wordpress.com/2010/08/01/uzu-psychedelic-fireworks/)
  - users asked for the hidden controls and "randomize all" to come back — [App Store reviews](https://apps.apple.com/us/app/376551723?see-all=reviews&platform=iphone)
- **Sharing:**
  - Uzu users asked for video export and Twitter sharing — [App Store reviews](https://apps.apple.com/us/app/376551723?see-all=reviews&platform=iphone)
  - competitors ship video recording: Magic Fluids and Particle Generator — [App Store](https://apps.apple.com/us/app/magic-fluids-visual-art-fun/id1437510558); [App Store](https://apps.apple.com/us/app/particle-generator/id1617577097)
  - Uzu 4.0 added preset export and import — [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)
  - creator communities keep toys alive: Wallpaper Engine's Workshop and Shadertoy — [Wikipedia: Wallpaper Engine](https://en.wikipedia.org/wiki/Wallpaper_Engine); [Wikipedia: Shadertoy](https://en.wikipedia.org/wiki/Shadertoy)
- **Photosensitivity: hard constraints:**
  - **Xbox Accessibility Guideline 118** — [Xbox AG 118](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/118). The page now lives at https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/118. It:
    - fails flashing above about 3 flashes per second;
    - fails flashes covering about 20% or more of the screen;
    - counts a flash as a luminance change of 10% of full white, where the darker state is below 0.8 (definition since XAG version 3.0, May 2022);
    - sets a lower threshold for transitions to or from saturated red. The test applies when either extreme has R/(R+G+B) ≥ 0.8, and a flash counts when (R−G−B)×320 changes by more than 20;
    - can fail even low-intensity flashing that lasts a long time;
    - lists Harding FPA testing;
    - is offered as best practice, not as a compliance checklist.
    - [Verified: https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/118 (search summary; learn.microsoft.com is blocked here); https://learn.microsoft.com/en-us/xbox/accessibility/xag-version-history (search summary)]
  - **WCAG 2.3.1** (level A) allows no more than three flashes in any one-second period, unless the flashing stays below the general and red flash thresholds. The thresholds:
    - A general flash is a pair of opposing changes of at least 10% of maximum relative luminance, where the darker state is below 0.80.
    - A red flash is a pair of opposing transitions to or from saturated red, meaning R/(R+G+B) ≥ 0.8 with a chromaticity change above 0.2 in CIE 1976 UCS.
    - The area test passes if the combined concurrent flash area is at most 0.006 sr, or 25% of any 10° visual field.
      - WCAG estimates a 10° field as a 341×256 px rectangle on a 1024×768 screen (15–17 inches viewed at 22–26 inches).
      - So the limit is a quarter of that rectangle.
    - WCAG 2.3.2 (level AAA) drops the threshold exception.
    - [Verified: https://github.com/w3c/wcag/blob/main/guidelines/sc/20/three-flashes-or-below-threshold.html; https://github.com/w3c/wcag/blob/main/guidelines/terms/20/general-flash-and-red-flash-thresholds.html; https://github.com/w3c/wcag/blob/main/guidelines/sc/20/three-flashes.html]
  - **Checking tools.** Guides point to PEAT and the Harding test for checking video — [MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Seizure_disorders); [TAMUCC WCAG 2.3](https://www.tamucc.edu/information-technology/accessibility/wcag/2-3.php)
    - PEAT's terms forbid its use on material made commercially for television, film, home entertainment or gaming.
    - So a commercial game like Tactilume must use the Harding test or another commercial tool [Verified correction: https://github.com/mdn/content/blob/main/files/en-us/web/accessibility/guides/seizure_disorders/index.md (quoting the PEAT page)].
  - **The Epilepsy Foundation working-group consensus paper** (attribution of the figures via search summary) — [consensus paper copy](https://puc.sd.gov/commission/dockets/electric/2019/el19-027/prefiledexhibits/CRWII/A178.pdf):
    - the paper's hazard definition: a flash is a potential hazard at a luminance of 20 cd/m² or more, a frequency of 3 Hz or more, and a solid angle of 0.006 sr or more. That is about 10% of the central visual field, or 25% of screen area at the viewing distances of the time (2 m or more from a TV). A transition to or from saturated red is a risk on its own [Verified: https://github.com/mdn/content/blob/main/files/en-us/web/accessibility/guides/seizure_disorders/index.md (MDN's quotation of the paper)];
    - the chance of a photoparoxysmal (seizure-related brain) response rises steeply above 3 flashes per second, reaching 65% at 10 per second [Unverified];
    - the UK broadcast regulator ITC restricted bright flashes above 3 per second covering more than 25% of the screen [Unverified]. The 25%-of-screen figure matches the consensus text quoted by MDN, but the ITC attribution was not re-checked;
    - games have nearly limitless paths through them, which makes frame-by-frame certification hard.
  - An Epilepsy Australia factsheet from May 2026 gives current guidance — [Epilepsy Australia](https://www.epilepsy.org.au/wp-content/uploads/2026/05/Factsheet_Photosensitive-epilepsy_May2026.pdf)
  - Strobe "party" apps that flash to the beat exist on the App Store. That is the exact anti-pattern to avoid — [App Store: Strobe Light DJ](https://apps.apple.com/us/app/-/id6745205521)
- **Sensory overload:** autistic users often have sensory sensitivities. These toys are recommended to them *because* they soothe, so overload betrays the core audience — [The Curated Culture](https://thecuratedculture.com/im-sharing-my-favorite-sensory-apps-because-everyone-needs-one-sometimes/)
- **Novelty wears off:**
  - Psychedelia got mixed reviews, and one called it boring — [Wikipedia](https://en.wikipedia.org/wiki/Psychedelia_%28light_synthesizer%29)
  - Uzu went from #1 in 2010 to #181 in Entertainment in a recent snapshot — [MacStories](https://www.macstories.net/ipad/uzu-for-ipad-as-played-by-non-ipad-users-video/); [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)
- **Naming and IP:** Plasma Pong was pulled over the Pong trademark — [Wikipedia](https://en.wikipedia.org/wiki/Plasma_Pong)

### Inferences: design principles for Tactilume
1. **Response first.** Keep the delay from input to visible light as short as possible on the big screen, and predict or extrapolate input. Dragging is the gesture most sensitive to lag.
2. **Simple verbs, deep systems.** Give players a few verbs (push, pull, swirl, emit, freeze) acting on systems that behave emergently: fields, flocking, and particle-life rules.
3. **Two tempos.** Support active play and a passive "drift" mode, which can serve as an attract mode, screensaver, wallpaper or TV display.
4. **Two-way sound.** React to music or the microphone, *and* make sound from gestures, as Silk, Bloom and Electroplankton do. Sound is the strongest emotional amplifier.
5. **Progressive disclosure.** Play starts instantly with nothing on the main screen. Hints and controls live on the phone. Depth (presets, parameters, randomise) is one tap away.
6. **Capture and share by default.** Build in clip recording, stills, and sharing of presets and scenes.
7. **Safe by construction.**
   - Run a global limiter on flashes and luminance change: at most 3 flashes per second, aware of screen area and of red.
     - Measure area as a visual angle, not only as a share of the screen.
     - WCAG's limit is 0.006 sr of concurrent flashing within any 10° field. At distance d that is about 0.006 × d² of screen surface.
     - At a 60 cm desk distance that is about 22 cm², about 1% of a 27-inch 16:9 monitor. At 2.5 m it is about 375 cm², about 3% of a 65-inch TV. Both are far stricter than XAG 118's whole-screen ~20%.
     - So the limiter needs the screen size and viewing distance, with a conservative default, and should treat saturated-red transitions separately.
     - [Verified correction: https://github.com/w3c/wcag/blob/main/guidelines/terms/20/general-flash-and-red-flash-thresholds.html; https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/118 (search summary)]. The arithmetic is this fact-check's own.
     - Beat-synced pulses that exceed the luminance and area thresholds count as flashes. One pulse per beat stays within 3 per second up to 180 BPM, but eighth-note pulses at 120 BPM (4 per second) do not (inference from the WCAG definition).
   - Offer a "calm" profile.
   - Cap brightness, which becomes critical with HDR.
   - Ship no strobe presets.
   - Run Harding FPA checks on trailers and recorded sessions. PEAT's terms exclude commercial games, so it cannot be used here [Verified correction: https://github.com/mdn/content/blob/main/files/en-us/web/accessibility/guides/seizure_disorders/index.md (quoting the PEAT page)].
8. **Fight fading novelty.** Use curated "worlds" (the Panoramical and Electroplankton model), light goals and multiplayer games (the Plasma Pong model), seasonal content and community presets.

### Gaps
- No controlled studies were found on engagement or retention for light toys specifically.
- No research was found on photosensitivity thresholds for HDR. The Xbox AG 118 and WCAG thresholds assume standard-dynamic-range (SDR) luminance. How "luminance change" scales with HDR brightness levels needs specialist input.
  - WCAG and XAG measure change relative to SDR white. The consensus paper's criterion is absolute (20 cd/m² or more), so it is the less ambiguous reference for HDR output. This is an inference, not a cited finding.

## 6. What would "next gen" plausibly mean for this genre on desktop?

(Assumes a large high-refresh HDR screen, a phone as controller, gamepads, and several people playing at once.)

### Takeaway
"Next gen" means more than extra particles. It means six things together:
1. **Desktop-scale fidelity:** millions of particles, HDR highlights that read as real "light", and 120–240 Hz motion.
2. **Many-handed social play:** several phones and gamepads, each owning a colour, a sound and a tool.
3. **Audio as a full partner:** reacting to system audio *and* generating sound.
4. **Professional interoperability:** NDI, Spout or Syphon output and MIDI or OSC control, for VJ and party use.
5. **A loop of creating and sharing.**
6. **Comfort and photosensitivity safety as a feature.**

Each has a precedent somewhere on its own. Nobody yet combines them.

### Cited Findings
- **Handheld controls the big screen:** Uzu's external-display mode with the iPad as controller — [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)
- **Controller-driven audio-visual play on desktop:** Panoramical, played with gamepad, joystick or MIDI on PC and Mac — [Engadget](https://www.engadget.com/2015-09-18-panoramical-finji-polytron-indie-fund.html)
- **Several people creating together:**
  - Iwai's ZKM project aimed for several participants making visuals and music together — [Wikipedia: Iwai](https://en.wikipedia.org/wiki/Toshio_Iwai)
  - Bloom: Open World was an augmented-reality installation — [Wikipedia: Bloom](https://en.wikipedia.org/wiki/Bloom_%28software%29)
- **Competitive fluid play:** Plasma Pong — [Wikipedia](https://en.wikipedia.org/wiki/Plasma_Pong)
- **High refresh is valued:**
  - Uzu users welcomed its 120 Hz update — [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723)
  - Dobryakov fixed his fluid for high-refresh displays — [X](https://x.com/paveldogreat/status/1158862042964602882)
- **GPU particles are mainstream in professional tools:** TouchDesigner POPs (2025–26) — [Derivative](https://derivative.ca/release/202532460/74120)
- **VJ output standards in consumer-adjacent apps:**
  - Flow Sim sends NDI output to MadMapper and Resolume — [App Store](https://apps.apple.com/us/app/particle-simulation-flow-sim/id6467405758)
  - Synesthesia Pro adds Syphon, Spout and NDI — [aggregator](https://eliteai.tools/tool/synesthesia)
- **Visualisers made for TV and controllers already exist:** jellybutter for Jellyfin — [GitHub](https://github.com/rappo/jellybutter)
- **Ambient desktop presence as a mass market:** Wallpaper Engine's audio-responsive and particle wallpapers — [Wikipedia](https://en.wikipedia.org/wiki/Wallpaper_Engine); [gg.deals](https://gg.deals/application/wallpaper-engine/)
- **New desktop competition in 2026:** Atomic Particle Engine, driven by mouse and music — [Steam](https://store.steampowered.com/app/4513520/Atomic_Particle_Engine/)
- **Spatial and premium directions:**
  - Fluidium has a Vision Pro App Store page — [App Store](https://apps.apple.com/us/app/fluidium/id6745104628?platform=vision)
  - Rez Infinite is playable in VR — [Wikipedia: Mizuguchi](https://en.wikipedia.org/wiki/Tetsuya_Mizuguchi)
  - Particulate is a VR particle sandbox — [Steam](https://store.steampowered.com/app/1196940/Particulate/)

### Inferences
- **Scale and light:**
  - HDR lets particle cores glow brighter than standard white while the background stays deep black. This is the most visible "next gen" upgrade, and no surveyed toy advertises it.
    - Measured in this container, Chromium 153's WebGPU canvas accepts `rgba16float` with `toneMapping: {mode: "extended"}`, and `getConfiguration()` reports it back, so an HDR swap chain can be configured.
    - Presenting a WebGPU canvas failed here, both headless and under Xvfb, so the on-screen HDR result is untested.
  - It must be paired with limits on luminance change, because brighter peaks raise the risk of harmful flashes.
  - Particle scale ("millions") is a target, not a measurement. In this container only a software adapter was available: about 22 ms per step for 20k particles and 131 ms for 300k. That is software timing, not GPU data, so GPU budgets are still unmeasured.
- **Motion:** at 120–240 Hz, with trails that don't smear, swirls feel liquid. Users notice, as the Uzu reviews show.
- **Many hands:**
  - Uzu's ten-finger ceiling becomes "ten-plus players": each phone is a multitouch surface, and each gamepad offers two analog "hands".
  - Each player needs an identity (a hue family, a sound timbre, an emitter shape) so a crowd stays readable.
  - Mode ideas:
    - co-operative: everyone paints one field;
    - competitive: arenas in the spirit of Plasma Pong;
    - call-and-response: one player "conducts" the music while the others paint.
- **The phone as a smart controller:**
  - Its own screen can show context, hints and each player's palette. That solves Uzu's discoverability problem without putting UI on the big screen.
  - Its motion sensors add tilt and fling verbs. (How the phone connects is out of scope here.)
- **Gamepads:**
  - analog sticks map naturally to the position of attractors or repulsors and the strength of a swirl;
  - triggers map to emission and intensity;
  - rumble can mark collisions or beats.
  - Panoramical shows that controller "dimensions" work for audio-visual exploration.
- **Audio:**
  - Capturing the desktop's own audio lets the toy react to whatever music is playing, which people expect from MilkDrop and Wallpaper Engine.
  - Generated sound output (as in Silk and Bloom) turns the toy into an instrument.
  - Sound from several players at once needs careful mixing.
- **A bridge to professional use:** an optional "VJ mode" offers clean output, NDI, Spout or Syphon, MIDI or OSC mapping, and BPM (tempo) sync. It captures the party and club use that Uzu hinted at but never served.
- **Persistence:**
  - scenes or "worlds" with their own parameters;
  - community presets and clip export;
  - ambient, wallpaper and second-monitor modes.
- **Comfort and safety:**
  - photosensitivity-safe defaults;
  - a "calm/sensory" profile for therapy and children, matching the BridgingApps uses;
  - session timers and caregiver locks.

### Gaps
- No sourced example was found of a consumer particle toy that outputs HDR or supports several phone controllers at once. That absence suggests an opportunity but is unverified.
- Party-game platforms that use phones as controllers (Jackbox, AirConsole) were not researched, because phone linking is out of scope. Their lessons on getting many players started quickly may still be relevant.

## 7. Closing lists: what must a new work NOT copy from Uzu, and what can a desktop successor own?

### Takeaway
- Treat Uzu as genre history, not a template.
- **Avoid:**
  - its family of names;
  - its ladder of modes selected by touch count, and the mode names;
  - its preset and effect set;
  - its marketing language;
  - the "kinetic multitouch particle visualizer" framing.
- **Build instead around:**
  - multiplayer at desktop scale;
  - verbs designed for controllers;
  - two-way audio;
  - capture and sharing;
  - professional output;
  - safety.
- Uzu never offered any of these, and its users explicitly asked for several of them.

### Cited Findings
- **Uzu's names and copy:**
  - "Uzu", "Little Uzu", "Uzu: A Generative Design Playground", "Uzu, An Interactive Light Show";
  - "a kinetic multitouch particle visualizer" and "math-physics-art toy";
  - the Wired and Ars Technica blurbs.
  - Sources: [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723); [Tapscape](https://www.tapscape.com/?p=1320); [AppAdvice: Little Uzu](https://appadvice.com/app/little-uzu/386764406)
- **Mode structure:** the ladder of modes and their names for 0–10 touches, and Little Uzu's sub-modes that cycle when fingers lift — [Digital Mom Blog](https://www.digitalmomblog.com/baby-and-the-ipad-app-uzu/); [AppSafari](https://appsafari.com/games/12286/uzu/); [AppAdvice: Little Uzu](https://appadvice.com/app/little-uzu/386764406)
- **Rules, presets and effects:** the auto-play wraparound rule; the 55 and 67 factory presets and the "Legacy Presets" folder; the 10-effect set; the Low-to-Ultra tiers — [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723); [AppFollow](https://apps.appfollow.io/ios/uzu-an-interactive-light-show/376551723)
- **Trademark risk is real in this genre:** Plasma Pong was pulled over "Pong" — [Wikipedia](https://en.wikipedia.org/wiki/Plasma_Pong)
- **Requests Uzu users made that went unmet:** video export, background colour, randomise-all, hidden controls, sharing, and new platforms such as Apple Watch — [App Store reviews](https://apps.apple.com/us/app/376551723?see-all=reviews&platform=iphone)
  - Version 4.2 added a new colour panel, so the colour request may now be partly met. What the panel covers was not seen [Unverified].
- **Apple-only:** Uzu and the rest of the developer's line run only on Apple platforms — Uzu is "Designed for iPad", and Fluidium is on iPad and Vision Pro — [App Store](https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723); [App Store: Fluidium](https://apps.apple.com/us/app/fluidium/id6745104628)
  - Vision Pro, and Apple-silicon Macs too, come by default with being an iPad app unless the developer opts out. So neither implies a dedicated edition [Verified correction: https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-apple-vision-pro; https://developer.apple.com/documentation/apple-silicon/running-your-ios-apps-in-macos].

### Inferences

**(a) Uzu-specific elements Tactilume must NOT copy**
1. **Names and branding:**
   - "Uzu", "Little Uzu", or any name derived from Uzu, punning on it or evoking it, including swirl/whirlpool words in Japanese;
   - "Colordodge" or "Colordodge Labs";
   - the subtitles "An Interactive Light Show" and "A Generative Design Playground";
   - the tagline "kinetic multitouch particle visualizer" and close variants such as "kinetic particle visualizer".
2. **Mode architecture:** do not use one global animation-mode ladder selected by the number of simultaneous touches (0–10), or the labels "0 Touch … 10 Touch". In particular, do not reproduce Uzu's assignments:

   | Touches | Uzu's behaviour (do not reproduce) |
   |---|---|
   | 0 | Brownian drift as the idle state |
   | 1 | emanate and radiate |
   | 2 | pinch attraction with boundary bounce |
   | 3 | three-point vortex |
   | 4 | four-point inverted vortex |
   | 5 | 3D freeze and translate |
   | 6 | oscillating mass |
   | 7 | three-armed spiral |
   | 8 | 3D warp with inverted translate |
   | 9 | springy ribbons |
   | 10 | change colour and size |

3. **Mode names from Uzu or Little Uzu:** "tri-point vortex", "quad-point inverted vortex", "3D tri-arm spiral", "springy space ribbons", "3D oscillating mass", "3D warp and inverted translate", "emanate and radiate", "pinch attraction with boundary bounce", "Brownian motion with boundary wrap", "radial spokes", "spring points" and "dual oscillator". Also avoid the trick of cycling sub-modes when all fingers lift.
4. **Auto-play arithmetic:** do not copy auto-play that adds virtual touches to the user's count and wraps past 10. A generic attract or ambient mode is fine; the touch-count arithmetic is Uzu's.
5. **Presets and effects:**
   - do not reuse Uzu's preset names, its 55/67 preset counts, or a "Legacy Presets" folder;
   - do not reproduce the ten-effect bundle with the same names (Glow, Warp, Kaleidoscope, Sparkle, Feedback, Color, Gradient, Pixelate, Scanlines, Vignette);
   - do not present "Low to Ultra" quality labels the way Uzu does.
   - The individual generic terms are fine. Avoid mirroring the set, its order and its UI.
6. **Signature looks:**
   - the 2010 palette that cycled through yellow, green and red;
   - three-armed spiral galaxies and springy ribbons as hero presets;
   - "psychedelic fireworks" as the brand promise;
   - Uzu's App Store screenshot and video compositions.
7. **Marketing copy:**
   - the Wired and Ars Technica blurbs, "math-physics-art toy", and the "doodling…" and "endlessly complicated…" lines;
   - its style of accolade list ("App of the Week", "Apple Rewind…", "Hall of Fame");
   - the wording of its pitch for external display plus auto-play at social gatherings.
8. **UI layout:**
   - Uzu's hidden-control layer and its settings and preset screens were not reviewed here (see Gaps).
   - Someone should check the live App Store screenshots before Tactilume's UI is finalised, so the design doesn't drift toward them by accident.

**(b) Open opportunities Tactilume Desktop can own**
1. **Desktop platforms at all.** There is no Uzu or Colordodge product for Windows or Linux. On desktop, the genre is professional tools, visualisers or small Steam toys.
   - On macOS the iPad app may still be offered on Apple-silicon Macs, which is Apple's default. This was not checked by hand, so treat macOS as possibly contested [Verified correction: https://developer.apple.com/documentation/apple-silicon/running-your-ios-apps-in-macos].
2. **Many players at once.**
   - Several phones and gamepads, each with its own colour, sound and tool.
   - Co-op painting; competitive arenas, an original fluid sport in the spirit of Plasma Pong; conductor and painter roles.
3. **A vocabulary built for controllers,** designed for thumbs and sticks rather than ten fingers:
   - sticks as attractors;
   - triggers as emission;
   - rumble on beats and collisions;
   - phone tilt and fling.
4. **Discoverability through the phone screen.**
   - contextual hints;
   - a live legend of each player's tool;
   - a one-tap "surprise me" randomiser.
   - This answers Uzu's hidden-mapping problem and its users' requests for "randomize all".
5. **Capture and share.**
   - instant clip recording, including short loops;
   - high-resolution and HDR stills;
   - shareable scene codes and preset packs.
   - These were the most-requested missing features in Uzu, and mobile rivals already record.
6. **Two-way audio.**
   - React to system audio, line-in or the microphone, with beat and tempo (BPM) detection.
   - Generate sound per player, so play becomes an ensemble instrument.
7. **HDR light and high refresh.**
   - True "light" highlights brighter than standard white, with trails at 120–240 Hz.
   - No surveyed toy markets this.
   - Pair it with brightness caps.
8. **New behaviours that scale makes possible.** Millions of particles allow fluids, flocks and particle-life ecologies as playable "worlds". These hold novelty longer than Uzu-style abstract modes.
9. **Ambient and second-screen modes.**
   - a "drift" mode for screensaver, wallpaper or TV use (the territory of Wallpaper Engine and Reflection);
   - a smart attract mode for parties;
   - output to several monitors or a projector.
10. **A bridge to professional use** (an optional "VJ mode"):
    - clean full-screen output and Spout, Syphon or NDI;
    - MIDI and OSC mapping and BPM sync.
    - It serves the party and club use that Uzu only hinted at.
11. **Safety and comfort as a feature.**
    - flash limiting to certification-style standards:
      - at most 3 flashes per second;
      - flash area judged as a visual angle at the expected viewing distance (WCAG: 0.006 sr in any 10° field, about 1% of a 27-inch monitor at 60 cm) as well as a share of the screen (XAG 118: about 20%);
      - red handled separately;
      - Harding FPA, not PEAT, for checking;
      - [Verified correction: https://github.com/w3c/wcag/blob/main/guidelines/terms/20/general-flash-and-red-flash-thresholds.html; https://github.com/mdn/content/blob/main/files/en-us/web/accessibility/guides/seizure_disorders/index.md];
    - a calm/sensory profile, session timers, a caregiver lock, and palettes safe for colour-blind players.
    - These are aimed at the therapy, children's and autism audiences that adopted Uzu informally.
12. **A living product.**
    - a visible update cadence;
    - seasonal or curated worlds;
    - a community hub for presets.
    - Uzu's three-year gaps between updates and its crash-after-update reviews show the cost of neglect.

### Gaps
- Uzu's preset names, App Store screenshots and in-app UI layout could not be reviewed because fetches were blocked. Review the live listing and recent YouTube captures by hand before finalising the "do not copy" list.
- There was no legal review of trademarks on "Uzu" or related names. Do one if any swirl- or whirlpool-themed naming is considered.

## Verification

Fact-check of 12 November 2026. These are the 15 claims in this file that could change a design or requirement decision: platform reach, versions and dates, prices, licences, latency figures and photosensitivity limits.

How the sources were read:
- Raw files from GitHub (raw.githubusercontent.com).
- The npm registry.
- developer.apple.com pages and DocC JSON.
- The SourceForge projectM mirror.

Hosts that stayed blocked:
- apps.apple.com, itunes.apple.com and support.apple.com;
- learn.microsoft.com;
- webdocs.cs.ualberta.ca, blogs.microsoft.com and patents.google.com;
- w3.org, which was not needed because w3c/wcag is on GitHub;
- the github.com web pages, API and feeds. Only raw files worked, so push dates could not be read.

Three web searches were used: XAG 118, the Uzu listing, and the CHI 2014 abstract. Their results are marked "(search summary)".

Nothing in these notes contradicted the container measurements (headless Chromium 153.0.8010.12, SwiftShader). Two measured facts were added in §6:
- the HDR canvas configuration is accepted;
- particle timing here is software-only.

Counts: 15 checked, 8 confirmed, 5 corrected and 2 unverifiable.

| # | Claim | Verdict | Source |
|---|---|---|---|
| 1 | Uzu is still sold, "Designed for iPad", requires iPadOS 17.6 or later and costs about US$2.99–4.99. The latest version is the v4.0 Metal rebuild | **Corrected.** Still sold, "Designed for iPad" and iPadOS 17.6 or later are confirmed (UK and Costa Rica listings agree). The current US price is $3.99, with older snapshots at $2.49–$4.99, £3.99 in the UK and €3.99 in Austria. The newest version is 4.2, not 4.0 | https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723 (search summary; page blocked) |
| 2 | v4.0 dates from 2024 or later, because it requires iPadOS 17.6, which shipped in mid-2024 | **Corrected.** The 17.6 minimum belongs to the current build (4.2), so it dates 4.2, not 4.0; an older snapshot required iPadOS 11.0. The 17.6 release notes exist (17.5 SDK, Xcode 15.4) but carry no date, so "mid-2024" stays general knowledge | https://developer.apple.com/documentation/ios-ipados-release-notes/ios-ipados-17_6-release-notes; https://apps.apple.com/us/app/uzu-an-interactive-light-show/id376551723 (search summary) |
| 3 | There is no Mac or visionOS edition, and Fluidium's Vision Pro page suggests a move into spatial computing. Whether the iPad build runs on Apple-silicon Macs was a gap | **Corrected.** The App Store offers compatible iPhone and iPad apps on Apple-silicon Macs and on Vision Pro by default, unless the developer opts out. Apple suggests opting out for custom multi-finger input with no alternative. A Vision Pro page is therefore not a visionOS edition, and Uzu may be on Macs: macOS is possibly contested | https://developer.apple.com/documentation/apple-silicon/running-your-ios-apps-in-macos; https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-macs-with-apple-silicon; https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-apple-vision-pro; https://developer.apple.com/documentation/visionos/making-your-app-compatible-with-visionos |
| 4 | A 3.x update made Uzu run at 120 fps on iPad Pro | **Unverifiable** for Uzu, because the release notes could not be read. The hardware part is confirmed: iPad Pro ProMotion displays switch between 24 Hz and 120 Hz | https://developer.apple.com/documentation/quartzcore/optimizing-iphone-and-ipad-apps-to-support-promotion-displays |
| 5 | CHI 2014 stylus study: people tell about 1 ms from 2 ms when dragging, and about 7 ms from 40 ms when scribbling | **Confirmed** from the abstract. The paper also puts commercial end-to-end latency at 65–120 ms | https://webdocs.cs.ualberta.ca/~wfb/publications/C-2014-SIGCHI-Latency.pdf (search summary; host blocked) |
| 6 | Other latency figures: Microsoft Research 2012 (about 100 ms typical, a 1 ms prototype); GI 2014 (inking about 50 ms against 2–7 ms); US patent 9836313 (2.4–11.4 ms, mean about 6 ms) | **Unverifiable.** The hosts are blocked and no search was spent. The 100 ms figure fits CHI 2014's 65–120 ms | https://blogs.microsoft.com/next/2012/03/12/taking-touch-screens-from-100-millisecond-lag-to-1-millisecond/; https://webdocs.cs.ualberta.ca/%7Ewfb/publications/C-2014-GI-Latency.pdf (both blocked) |
| 7 | WCAG 2.3 sets a three-flash limit with general and red flash thresholds | **Confirmed**, with the numbers added. A general flash is an opposing change of at least 10% of relative luminance, with the darker state below 0.80. A red flash has R/(R+G+B) ≥ 0.8 with a chromaticity change above 0.2. The area limit is 0.006 sr, or 25% of any 10° field (341×256 px at 1024×768). 2.3.2 (AAA) drops the exception | https://github.com/w3c/wcag/blob/main/guidelines/sc/20/three-flashes-or-below-threshold.html; https://github.com/w3c/wcag/blob/main/guidelines/terms/20/general-flash-and-red-flash-thresholds.html; https://github.com/w3c/wcag/blob/main/guidelines/sc/20/three-flashes.html |
| 8 | XAG 118 fails more than about 3 flashes per second and flashes over about 20% of the screen. It has a stricter red test, can fail long low-intensity flashing and lists Harding FPA | **Confirmed.** Added: the 10%-of-white luminance definition (since version 3.0, May 2022), the red formula ((R−G−B)×320 change above 20), the moved URL (/xbox/ instead of /gaming/), and Microsoft's statement that the XAGs are best practice, not a compliance checklist | https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/118; https://learn.microsoft.com/en-us/xbox/accessibility/xag-version-history (search summary; host blocked) |
| 9 | Guides point to PEAT for checking video, and the design rule is "Harding/PEAT-style checks" | **Corrected.** PEAT's terms forbid its use on material made commercially for TV, film, home entertainment or gaming. Tactilume must use the Harding test or another commercial tool | https://github.com/mdn/content/blob/main/files/en-us/web/accessibility/guides/seizure_disorders/index.md (quoting the PEAT page) |
| 10 | Epilepsy Foundation consensus: risk rises above 3 flashes per second (65% at 10 per second), and ITC restricted flashes over 25% of the screen | **Confirmed** for the thresholds. A flash is a hazard at 20 cd/m² or more, 3 Hz or more and 0.006 sr or more (about 25% of a TV screen at 2 m or more). A saturated-red transition is a risk on its own. The 65% figure and the ITC attribution remain unverifiable | https://github.com/mdn/content/blob/main/files/en-us/web/accessibility/guides/seizure_disorders/index.md (quoting the paper) |
| 11 | Butterchurn is on npm at 2.6.7 under MIT, with a last push in April 2026, and is embedded in a Jellyfin plugin with TV and controller support | **Corrected.** MIT and npm `latest` 2.6.7 are confirmed, but 2.6.7 dates from 2019-03-12. 3.0.0-beta.5 (2025-07-13, `beta` tag) is what `master` declares. The April 2026 push is unverifiable. The jellybutter part is confirmed: D-pad, remote or gamepad, pins Butterchurn 2.6.7 and presets 2.4.7, MIT | https://registry.npmjs.org/butterchurn; https://github.com/jberg/butterchurn/blob/master/package.json; https://github.com/jberg/butterchurn/blob/master/LICENSE; https://github.com/rappo/jellybutter/blob/main/README.md; https://registry.npmjs.org/butterchurn-presets |
| 12 | libprojectM 4.1.4 (2025-01-24) fixed systems with only core OpenGL 4.1 or lower, mainly macOS, and releases continued to 4.1.8 on 2026-10-06 | **Confirmed.** Also 4.1.5 (2025-11-03), 4.1.6 (2025-11-28) and 4.1.7 (2026-07-14); the tags exist on GitHub. `master` is at 4.2.0, not yet released. The licence is LGPL-2.1-or-later. The fix also covers older Linux distributions | https://sourceforge.net/projects/projectm.mirror/files/; https://sourceforge.net/projects/projectm.mirror/files/v4.1.4/; https://github.com/projectM-visualizer/projectm/blob/v4.1.8/CMakeLists.txt; https://github.com/projectM-visualizer/projectm/blob/master/COPYING |
| 13 | Dobryakov's WebGL Fluid (2017) builds on the GPU Gems fluid chapter, and a 2019 update improved handling of high-refresh displays | **Confirmed.** The README cites the chapter, and the code is MIT, copyright 2017. The cited post's ID decodes to 2019-08-06. The code steps by wall-clock time capped at 1/60 s. The month (October) was not checked | https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/master/README.md; https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/master/LICENSE; https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/master/script.js |
| 14 | Tom Mohr ships a Java desktop Particle Life app for Windows, with source on GitHub | **Confirmed.** Version 1.3.1 installs on Windows and runs from source with JDK 17–25 on a Java 21 runtime. Added: the licence is GPL-3.0 | https://github.com/tom-mohr/particle-life-app/blob/main/README.md; https://github.com/tom-mohr/particle-life-app/blob/main/LICENSE.md; https://github.com/tom-mohr/particle-life-app/blob/main/gradle.properties |
| 15 | compute.toys is "Shadertoy for WebGPU compute shaders" | **Confirmed.** The README describes a WebGPU compute-shader playground that runs in the browser. Shaders are now written in Slang and compiled to WGSL, and the code is MIT | https://github.com/compute-toys/compute.toys/blob/master/README.md; https://github.com/compute-toys/compute.toys/blob/master/LICENSE |

Not re-checked, and still resting on the original sources:
- the 12 June 2010 release date and the 2010 chart peak;
- the 2010–2021 version dates;
- Atomic Particle Engine's April 2026 Steam release;
- the TouchDesigner build numbers;
- the Plasma Pong takedown;
- prices other than Uzu's.
