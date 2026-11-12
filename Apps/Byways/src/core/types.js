/** @typedef {'site'|'article'|'image'|'game'|'video'|'audio'|'book'|'project'} FindKind */
/** @typedef {'curated'|'mostly'|'mixed'} Safety */
/** @typedef {Object} Find
 *  @property {string} id            e.g. 'ia:msdos_Whizz_1994', 'wiki:en:Ada_Lovelace', 'url:<hash64 of normalised url>'
 *  @property {string} source        adapter id
 *  @property {FindKind} kind
 *  @property {string} title         ≤ 200 chars, plain text
 *  @property {string} description   ≤ 400 chars, plain text
 *  @property {string} url           http(s) only; what Open goes to
 *  @property {string} [imageUrl]    http(s) only
 *  @property {string} [embedUrl]    only 'https://archive.org/embed/<id>'
 *  @property {string[]} tags        ids from data/tags.json
 *  @property {string} [author]
 *  @property {string} [licence]
 *  @property {string} [attribution]
 *  @property {string[]} why         reason chips shown on the card
 *  @property {string[]} [foundBy]   AI member labels, e.g. 'Scout · claude-opus-5-5'
 *  @property {boolean} [teamPick]
 *  @property {Safety} safety
 *  @property {Object} [meta]        source-specific extras (e.g. {downloads, year, platform})
 */
/** @typedef {'like'|'dislike'|'save'|'lessTopic'|'neverSite'|'broken'|'interest'} Reaction */
/** @typedef {{v:1, tags:Object<string,number>, sources:Object<string,number>, hiddenTags:string[], blockedDomains:string[], strangeness:number, interests:string[], reactions:number}} Taste */
/** @typedef {'tuned'|'fate'|'ai'} Mode */

/** @typedef {Object} Platform
 *  @property {'pwa'|'extension'|'android'} name
 *  @property {{fetch(url:string, init?:RequestInit & {privileged?:boolean}):Promise<Response>}} transport
 *  @property {VoiceEngine} voice
 *  @property {Tts} tts
 *  @property {(data:{title?:string,text?:string,url?:string}) => Promise<'shared'|'copied'|'cancelled'>} share
 *  @property {(find:Find, how?:'tab'|'current'|'inapp') => Promise<void>} openFind
 *  @property {{save(name:string, blob:Blob):Promise<void>, pick(accept:string, multiple?:boolean):Promise<File[]>}} files
 *  @property {{setHandlers(h:{next?:Function, previous?:Function, playPause?:Function}):void, setActive(on:boolean):void}} media
 *  @property {{on():Promise<void>, off():Promise<void>}} wakeLock
 *  @property {SecretStore} secrets
 *  @property {{privilegedFetch:boolean, localNetworkHttp:boolean, inAppSiteView:boolean, labHref:string, framesArchive:boolean, leanBack?:boolean}} caps
 *    caps.leanBack: absent means true. The extension sets it to false on the 'panel' surface.
 *    It lives in caps, NOT as a top-level platform.leanBack.
 *  @property {(kinds:Array<'searchTerms'|'browsingActivity'>) => Promise<boolean>} [requestDataCollection]
 *    optional. On Firefox it starts permissions.request({data_collection: kinds}) as its first statement and
 *    permissions.contains({data_collection: kinds}) in the same synchronous step, and resolves true when either
 *    resolves true; a throw from either, synchronous or not, counts as false for that one. So a use with no click
 *    (a voice "search for …", a Rabbit Hole) is covered by a stored grant. Absent or true elsewhere. Asked when
 *    AI Search, or "More like this page", is first used, inside the click.
 *  @property {() => Promise<boolean>} persistStorage
 *  @property {(origins:string[]) => Promise<boolean>} requestOrigins
 *    Called from a button when the user adds a custom endpoint or a model on the local network.
 *    PWA: resolves true (CORS decides). Extension: permissions.request for those origins.
 *    Android: the native per-host approval dialog for http hosts (https needs none).
 *  @property {(app:App) => Promise<void>} [attach]   optional; boot calls `await platform.attach?.(app)` once the app is built
 *  @property {{launchWebAuthFlow(opts:{url:string, interactive:boolean}):Promise<string>, getRedirectURL():Promise<string>}} [identity]
 *    (there is no redirectUrl property; getRedirectURL() must be the first await in the click)
 *    optional; Connect OpenRouter outside the PWA. Extension (Plan 07): chrome.identity / browser.identity,
 *    with the optional "identity" permission. Android (Plan 08): an in-app login WebView that catches the
 *    callback URL. The PWA has none, and uses a redirect to the Pages callback instead.
 *  @property {{version():Promise<{versionName:string, versionCode:number, sdk:number, micConsent:boolean}>,
 *              checkUpdate():Promise<{available:boolean, latest:string|null, url:string|null}>,
 *              openExternal(url:string):Promise<void>}} [app]   Android only
 */
/** @typedef {{get(id:string):Promise<string|null>, set(id:string, value:string):Promise<void>, delete(id:string):Promise<void>, list():Promise<string[]>}} SecretStore */
/** @typedef {{kind:'web-local'|'web-cloud'|'native'|'none', vendor:'google'|'apple'|'microsoft'|'mozilla'|'android'|null, needsDownload:boolean, continuous:boolean, reason:string|null}} VoiceStatus */
/*  VoiceStatus convention for a recogniser that only works in the cloud, before the user opts in:
 *    probe({allowCloud:false}) → {kind:'none', vendor:<the vendor>, reason:'cloud-only', …}.
 *  The UI shows the vendor-named opt-in for exactly this case. After opt-in, probe({allowCloud:true})
 *  returns 'web-cloud' (web) or 'native' with that vendor (Android). */
/** @typedef {'no-speech'|'aborted'|'audio-capture'|'network'|'not-allowed'|'service-not-allowed'|'language-not-supported'|'phrases-not-supported'|'busy'|'too-many-requests'} VoiceErrorCode */
/** @typedef {Object} VoiceEngine
 *  @property {(opts:{allowCloud:boolean}) => Promise<VoiceStatus>} probe
 *  @property {() => Promise<boolean>} install          call only from a user gesture
 *  @property {(opts:{lang:string, phrases:string[], allowCloud:boolean}) => Promise<void>} start
 *  @property {() => void} stop
 *  @property {(event:'result'|'state'|'error', fn:Function) => () => void} on
 *    result → {text:string, final:boolean}; state → {listening:boolean}; error → {code:VoiceErrorCode}
 */
/** @typedef {Object} Tts
 *  @property {(text:string, opts?:{voiceURI?:string, rate?:number, volume?:number}) => Promise<void>} speak   resolves at end of utterance
 *  @property {() => void} cancel
 *  @property {() => Promise<Array<{uri:string, name:string, lang:string, local:boolean}>>} voices
 */

/** @typedef {typeof import('./settings.js').DEFAULT_SETTINGS} Settings */

/** @typedef {Object} App
 *  @property {*} store
 *  @property {Settings} settings
 *  @property {() => Settings} getSettings
 *  @property {(patch:Partial<Settings>) => Promise<void>} saveSettings
 *  @property {*} http
 *  @property {*} clock
 *  @property {() => number} rand
 *  @property {Platform} platform
 *  @property {*} data
 *  @property {(path:string) => string} dataUrl
 *  Later plans add their own fields.
 */

export {};
