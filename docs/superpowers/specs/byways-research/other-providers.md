## other-providers
- [verified] OpenAI: base URL https://api.openai.com/v1, header 'Authorization: Bearer <key>', endpoints POST /chat/completions, POST /responses, GET /models. Chat Completions is the de-facto OpenAI-compatible format.
  => Use one 'openai-chat' wire adapter shared by OpenAI, Groq, DeepSeek, Mistral chat, OpenRouter, Ollama /v1, LM Studio /v1 and custom endpoints; add a separate 'openai-responses' adapter for web search.
- [likely] OpenAI API accepts browser (CORS) calls in practice; the official SDK blocks browser use unless dangerouslyAllowBrowser:true. There have been short outages where preflight returned 404 / missing Allow-Origin.
  => PWA may call OpenAI directly with raw fetch (no SDK needed). Treat a fetch TypeError as 'network/CORS problem, retry later' rather than 'bad key'.
- [verified] OpenAI web search: Responses API body tools:[{type:'web_search'}] (also 'web_search_2025_08_26'; legacy 'web_search_preview'), options filters.allowed_domains, search_context_size low|medium|high, user_location, external_web_access. Chat Completions only searches with gpt-4o-search-preview / gpt-4o-mini-search-preview via web_search_options.
  => For OpenAI AI Search, always use POST /v1/responses with the web_search tool; do not rely on Chat Completions web_search_options for GPT-5-class models.
- [likely] OpenAI web_search tool costs about $10 per 1,000 calls plus tokens; one response can trigger several billable searches.
  => Show a per-provider search cost hint in the model picker and count searches per session.
- [verified] OpenAI structured output: Chat response_format {type:'json_schema', json_schema:{name, schema, strict:true}}; Responses text.format {type:'json_schema', name, schema, strict}.
  => Define one Byways 'find' JSON schema (title, url, why, tags) and send it in the right slot per adapter.
- [verified] OpenAI model IDs change fast (SDK ChatModel list now starts gpt-6-astra, gpt-6.1-sol, gpt-6-luna, gpt-5.6-*, gpt-5.5 ...).
  => Model picker must fetch GET /models live and cache it; ship only a small default per provider that the user can change.
- [likely] OpenAI may require Organization Verification before streaming some reasoning models (o3, GPT-5 family reported) or returning reasoning summaries; unverified orgs get HTTP 400.
  => Default to non-streaming calls for AI Search, and on a 400 that mentions verification retry once without stream.
- [verified] Gemini native API: base https://generativelanguage.googleapis.com/v1beta, header x-goog-api-key, POST /models/{model}:generateContent and /models/{model}:streamGenerateContent?alt=sse, GET /models. Not OpenAI-compatible.
  => Write a dedicated 'gemini-native' adapter; it is the only Gemini path that supports google_search grounding.
- [verified] Gemini also has an OpenAI-compatible endpoint: base https://generativelanguage.googleapis.com/v1beta/openai/ with Authorization: Bearer <AI Studio key>; GET /v1beta/openai/models lists models.
  => The compat endpoint can serve the model list or plain chat, but use the native endpoint for search and JSON.
- [likely] CORS: plain browser fetch to native generateContent with x-goog-api-key works; the OpenAI-compat chat/completions preflight has been reported to lack Access-Control-Allow-Origin; 503/overload replies come back without CORS headers, so they look like CORS errors.
  => PWA calls Gemini via the native endpoint only. Retry once on a fetch TypeError, because it may be an overload.
- [verified] Gemini grounding request shape: tools:[{google_search:{}}] (SDK field googleSearch), optional searchTypes and timeRangeFilter; excludeDomains is not supported on the Gemini API (Vertex only). The google_search tool is supported on the 2.5, 3.x and 4 model families.
  => Gemini adapter sends {google_search:{}} and reads candidates[0].groundingMetadata.groundingChunks[].web.uri as the source URLs.
- [likely] Grounding pricing: Gemini 3 and newer get 5,000 free grounded requests per month (shared), then $14 per 1,000. Gemini 2.5 Flash got 1,500 requests/day, then $35 per 1,000 prompts.
  => With an AI Studio key, Gemini is the cheapest 'search' teammate. Make it the default AI-team search member.
- [likely] Gemini JSON: generationConfig {responseMimeType:'application/json', responseJsonSchema:{...}}. Using JSON together with google_search works only on Gemini 3+ (preview), with reported bugs: groundingChunks come back empty, and the JSON can be truncated.
  => For Gemini use two steps: a grounded search call (text), then a cheap JSON call that formats the result. Never trust URLs from the model text alone.
- [likely] AI Studio / Google Cloud API keys can be limited to specific APIs and to HTTP referrers.
  => Key-setup help should tell users to restrict their Gemini key to the Generative Language API and the https://iteatsthesalt.github.io/* referrer. Referrer limits block the extension and Android, so make this advice optional.
- [verified] OpenRouter: base https://openrouter.ai/api/v1, Bearer key, POST /chat/completions (OpenAI-compatible), POST /responses, GET /models, GET /key, POST /auth/keys.
  => OpenRouter can be the one-key fallback for every provider that cannot be reached from the PWA (Mistral, DeepSeek...).
- [verified] OpenRouter GET /models accepts filters such as supported_parameters (values include 'structured_outputs', 'web_search_options', 'tools'), q, max_price and sort.
  => Model picker can show capability badges (JSON, search) and filter OpenRouter models without hardcoding.
- [verified] OpenRouter attribution headers: HTTP-Referer (app URL) and X-OpenRouter-Title (X-Title still accepted). They are needed only for app attribution, not for the request to succeed.
  => Send HTTP-Referer: https://iteatsthesalt.github.io/Game-Dev-Resources/ and X-OpenRouter-Title: Byways. Both are custom header names, so browsers allow setting them.
- [likely] OpenRouter accepts CORS calls from web pages.
  => PWA can call OpenRouter directly.
- [verified] OpenRouter OAuth PKCE: send the user to https://openrouter.ai/auth?callback_url=...&code_challenge=...&code_challenge_method=S256, then POST /api/v1/auth/keys {code, code_verifier, code_challenge_method}; the code is single-use and expires after 10 minutes.
  => Offer a 'Connect OpenRouter' button so users and friends need not copy keys. Callback = the GitHub Pages URL; the extension can use chrome.identity.launchWebAuthFlow (needs checking).
- [verified] OpenRouter web search: new server tool tools:[{type:'openrouter:web_search', parameters:{engine:'auto'|'native'|'exa'|'firecrawl'|'parallel'|'perplexity', max_results (default 5), max_total_results (default 50), max_uses, allowed_domains | excluded_domains, search_context_size, mode}}]. An OpenAI-style {type:'web_search'} is converted to it automatically. The old plugins:[{id:'web'}] and the ':online' model suffix are deprecated.
  => Use the openrouter:web_search tool (engine 'auto', max_results 5, max_uses 2). Keep ':online' only as a fallback.
- [likely] OpenRouter search pricing: Exa $0.007 per request (instant/fast/auto), $0.012-0.015 for deep modes; Parallel $0.001-0.005 per request; native engines pass the provider price through. Older docs said $4 per 1,000 results (about $0.02 for the default 5).
  => Default engine 'parallel' or 'exa' with a low max_results for cheap Stumble searches.
- [likely] OpenRouter ':free' models: 20 requests/minute; 50 requests/day on accounts with under $10 lifetime credits, 1,000/day after buying $10.
  => A free OpenRouter key is a workable zero-cost AI option for friends. Show the daily cap in the UI.
- [verified] Groq: base https://api.groq.com/openai/v1, Bearer key, POST /chat/completions and GET /models, fully OpenAI-compatible.
  => Groq uses the shared openai-chat adapter. It is a fast choice for voice-command parsing and summaries.
- [likely] Groq answers CORS preflights with a wildcard Access-Control-Allow-Origin, so browser calls work; the page's CSP connect-src must still list api.groq.com.
  => PWA can call Groq directly.
- [verified] Groq web search: set model 'groq/compound' (chains several tools) or 'groq/compound-mini' (one tool call). Built-in web_search, visit_website and code execution run on Groq's servers. Optional compound_custom:{tools:{enabled_tools:['web_search','visit_website']}} and search_settings:{include_domains, exclude_domains, country, include_images}. Custom user tools are not supported.
  => Groq compound can be a free-tier 'scout' member of the AI team. Ask for JSON in the prompt and parse it leniently.
- [verified] Groq also has tools:[{type:'browser_search'}], but only on openai/gpt-oss-20b and openai/gpt-oss-120b.
  => Use this as another Groq search option when the user picks a gpt-oss model.
- [likely] Groq structured outputs (response_format json_schema): strict mode only on gpt-oss-20b/120b (newer docs add qwen3.8-27b). Other models are best-effort. Streaming and tool use are not supported together with structured outputs.
  => Do not combine compound or search with json_schema on Groq. Run a second formatting call, or parse JSON from the text.
- [verified] Mistral: base https://api.mistral.ai/v1, Bearer key, POST /chat/completions (OpenAI-compatible), GET /models, beta POST /conversations and /agents.
  => Chat goes through the openai-chat adapter. Web search needs a small extra 'mistral-conversations' adapter.
- [verified] Mistral response_format types are text, json_object and json_schema.
  => Mistral chat can return the Byways find schema.
- [verified] Mistral web search works only in the Conversations/Agents API, with tools:[{type:'web_search'}] or {type:'web_search_premium'} (adds verified news). It is not available in Chat Completions. Price is about $30 per 1,000 calls.
  => Mistral search request: POST /v1/conversations {model, inputs, tools:[{type:'web_search'}]}. Mark it as an expensive teammate.
- [unverified] Mistral CORS from web pages is unclear: 2023-2024 reports show preflights without Access-Control-Allow-Origin (Obsidian plugin, Cursor/codestral), while one third-party 2026 list says browser calls work.
  => Mark Mistral as 'extension/Android only, or through OpenRouter' unless the PWA's runtime CORS probe succeeds.
- [verified] DeepSeek: base https://api.deepseek.com (https://api.deepseek.com/beta for prefix completion), Bearer key, POST /chat/completions (OpenAI-compatible), GET /models, and now POST /responses. Current models: deepseek-v4-flash, deepseek-v4-pro, deepseek-flash, deepseek-v4-flash-vision-exp; deepseek-chat and deepseek-reasoner are legacy.
  => DeepSeek fits the openai-chat adapter, and the openai-responses adapter when searching.
- [verified] DeepSeek web search: Responses API tools:[{type:'web_search'}] works only with deepseek-v4-pro (ignored on deepseek-flash). Each search and page read is billed separately. An older doc page said v4-pro Responses support would arrive in August 2026.
  => DeepSeek search request: POST /responses {model:'deepseek-v4-pro', input, tools:[{type:'web_search'}]}.
- [verified] DeepSeek JSON: Chat Completions supports only response_format {type:'json_object'} on v4-flash/v4-pro (json_schema only on the vision-exp model); Responses supports json_schema.
  => In chat mode, send json_object and put the schema in the prompt.
- [unverified] DeepSeek CORS is unclear: a Nov 2026 GoldenDict-ng issue found DeepSeek API requests were 'declined by CORS policy' while the app added an Origin header, and worked once it stopped; third-party posts conflict.
  => Treat DeepSeek as not callable from the PWA. In the extension, check whether the chrome-extension Origin header is rejected; Android should call it through native HTTP.
- [verified] xAI: base https://api.x.ai/v1, Bearer key. POST /v1/responses is the primary endpoint; POST /v1/chat/completions is documented as the legacy OpenAI-compatible endpoint. The Vercel AI SDK dropped xAI chat completions in @ai-sdk/xai v5.
  => Use the openai-responses adapter for xAI. Use chat only for plain prompts.
- [likely] xAI model lists: GET /v1/models, and GET /v1/language-models, which also returns modalities and pricing. Current IDs include grok-4.7, grok-4.6, grok-4.5, grok-4.20-(non-)reasoning, grok-4-1-fast-*.
  => Model picker calls /v1/language-models and falls back to /v1/models.
- [verified] xAI search is the Agent Tools API on Responses: tools:[{type:'web_search', allowed_domains (max 5), excluded_domains (max 5), enable_image_search, enable_image_understanding}, {type:'x_search', allowed_x_handles, excluded_x_handles, from_date, to_date, enable_image_understanding, enable_video_understanding}]. The old Live Search (search_parameters) is deprecated.
  => xAI search request: POST /v1/responses {model, input, tools:[{type:'web_search'}]} with optional x_search for trending finds. Never send search_parameters.
- [likely] xAI tool pricing: web_search $5 per 1,000 calls and x_search $5 per 1,000 calls, plus tokens. A Sept 2026 change to per-post x_search billing is reported but not confirmed.
  => List the price next to xAI in the picker.
- [verified] xAI structured output: Responses text.format {type:'json_schema', strict:true, name, schema}, or {type:'json_object'}.
  => xAI can return the find schema directly.
- [likely] xAI api.x.ai accepts CORS calls from web pages.
  => Allow it in the PWA, but confirm with the runtime CORS probe.
- [verified] Ollama: default host http://127.0.0.1:11434. Native POST /api/chat and GET /api/tags (model list). OpenAI-compatible /v1/chat/completions, /v1/completions, /v1/models and /v1/responses (stateless only). No key needed locally.
  => Ollama uses the openai-chat adapter at http://127.0.0.1:11434/v1. Its model list comes from /api/tags (has sizes) or /v1/models.
- [verified] OLLAMA_ORIGINS: by default Ollama allows cross-origin requests only from loopback origins (localhost, 127.0.0.1, 0.0.0.0) plus app://, file://, tauri:// and vscode-webview:// style origins. Browser-extension and remote https origins must be added, e.g. OLLAMA_ORIGINS=chrome-extension://*,moz-extension://*,safari-web-extension://*. Requests from other origins get HTTP 403.
  => Setup text for Byways: OLLAMA_ORIGINS=https://iteatsthesalt.github.io,chrome-extension://*,moz-extension://* (add https://appassets.androidplatform.net for Android). Restart Ollama after setting it.
- [verified] Ollama structured output: native API takes a JSON schema in 'format'; the OpenAI-compatible API takes response_format json_schema. Ollama Cloud does not support structured outputs.
  => Local Ollama can return the find schema. Cloud models need JSON-in-prompt.
- [verified] Ollama web search is a separate hosted API: POST https://ollama.com/api/web_search {query, max_results (default 5, max 10)} and POST https://ollama.com/api/web_fetch {url}. Both need an ollama.com API key (Bearer); the free account has rate limits. CORS for ollama.com is unknown.
  => Local Ollama models cannot search by themselves. Give them search results from Byways' own sources, or the Ollama web_search API in the extension/Android.
- [verified] Chrome Local Network Access (Chrome 142+): a public https page that fetches http://localhost / 127.0.0.1 triggers a 'loopback network' permission prompt; a denied request looks like a CORS error. Android WebView does not use LNA (Android's own local-network permission applies instead).
  => The PWA must explain the Chrome 'devices on your local network' prompt before first contacting Ollama/LM Studio. Whether extensions are exempt is not confirmed.
- [likely] Mixed content: Chrome and Firefox treat http://localhost / 127.0.0.1 as trustworthy, so an https page may fetch them. Safari has historically blocked https-to-http-localhost requests, and its behaviour changed around Safari 18.
  => Mark local models as 'Chrome/Edge/Firefox only' in the PWA on Safari/iOS.
- [verified] LM Studio's local server defaults to port 1234 (http://127.0.0.1:1234).
  => Default LM Studio base URL: http://127.0.0.1:1234/v1.
- [verified] LM Studio OpenAI-compatible endpoints: GET /v1/models, POST /v1/chat/completions, POST /v1/responses (0.3.29+), POST /v1/embeddings. Structured output via response_format json_schema; support depends on the model.
  => LM Studio uses the openai-chat adapter.
- [verified] LM Studio CORS: the server accepts same-origin requests only until the 'Enable CORS' switch in the server settings is turned on, or the server is started with 'lms server start --cors'.
  => Setup text: Developer tab, Server Settings, turn on Enable CORS (and 'Serve on Local Network' for phone use).
- [verified] Chrome Prompt API (Gemini Nano): stable for web pages from Chrome 148 desktop (released 5 May 2026) and in extensions since Chrome 138. Runs on Windows 10/11, macOS 13+, Linux and Chromebook Plus; not on Chrome for Android or iOS. The Android version (using the OS model) is still a prototype.
  => Offer 'Built-in (free, no key)' only when 'LanguageModel' in self. Hide it in the Android app and Firefox.
- [verified] Prompt API hardware needs: GPU with more than 4 GB VRAM, or CPU with 16 GB RAM and 4+ cores; 22 GB free disk; the model downloads on first use and needs a user gesture (click/tap/key) to start downloading.
  => Hands-free mode cannot silently start the download. Show a one-time 'Download on-device AI' button and track progress with the monitor callback.
- [verified] Prompt API shape: LanguageModel.availability() returns 'unavailable'|'downloadable'|'downloading'|'available'; LanguageModel.create({monitor, expectedInputs, expectedOutputs}); session.prompt(text, {responseConstraint: <JSON schema>}). Structured output has been supported since Chrome 137.
  => Use Nano for voice-command parsing, short read-aloud blurbs and re-ranking with responseConstraint; it cannot browse.
- [likely] Gemini Nano runs on the device and has no web search, so it can only work on text Byways passes to it.
  => In 'AI Search' mode Nano should rank and describe candidates from Byways' own sources, not invent URLs.
- [likely] Other browsers: Edge's Prompt API is still experimental (Canary/Dev, Phi-4-mini, Aion-1.0-Instruct behind a flag). Mozilla and WebKit formally opposed the API. Admins can turn it off with the BuiltInAIAPIsEnabled policy.
  => Always feature-detect at runtime; never assume Nano exists.
- [likely] Browser-extension and native requests are not subject to CORS, but a Chrome extension fetch still sends 'Origin: chrome-extension://<id>', which Ollama rejects unless it is listed in OLLAMA_ORIGINS, and DeepSeek may reject.
  => Extension provider code must handle a 403 from Ollama with setup help. Android should route non-CORS providers through a Kotlin native HTTP bridge.
RISKS:
- CORS status could not be tested from this machine (all provider hosts blocked by the proxy). Mistral, DeepSeek and ollama.com are unconfirmed; OpenAI, Gemini native, Groq, xAI and OpenRouter rest on community evidence.
- GitHub Pages origin sharing: every repo page under https://iteatsthesalt.github.io shares one origin, so any other Pages project of that account can read Byways' IndexedDB/localStorage, including stored API keys.
- Model IDs and search prices change monthly (OpenAI gpt-6.*, Gemini 3.x/4, Grok 4.7, DeepSeek v4). Any hardcoded default will go stale.
- OpenRouter's ':online' and plugins:[{id:'web'}] are deprecated in favour of the openrouter:web_search server tool; the removal date is unknown.
- Gemini structured output combined with google_search is preview-only and buggy (empty groundingChunks, truncated JSON).
- Groq structured outputs do not work with tools or streaming, so compound and JSON cannot be combined.
- OpenAI organization verification may block streaming for some models with a fresh personal key.
- Chrome Local Network Access prompts and Safari mixed-content blocking can stop PWA access to Ollama/LM Studio. Whether extensions are exempt from LNA is unconfirmed.
- The Prompt API is missing on Android, Firefox and Safari and on low-spec machines. It needs a user gesture to download about 22 GB of free space worth of model, which conflicts with hands-free-by-default.
- Hands-free auto-advance could fire many paid search calls in a row (OpenAI $10/1k, Mistral $30/1k, xAI $5/1k, Gemini $14/1k after the free 5k).
- Using declarativeNetRequest to strip the Origin header for DeepSeek/Ollama from the extension has not been checked.
- Free-tier Gemini (unpaid AI Studio keys) may use prompts to improve Google products. This is a privacy point for a 'stays on device' app (not verified in this research).
RECS:
- Build the provider layer as small adapters over fetch (no vendor SDKs): openai-chat (OpenAI, Groq, DeepSeek, Mistral chat, OpenRouter, Ollama /v1, LM Studio /v1, custom), openai-responses (OpenAI, xAI, DeepSeek search, OpenRouter), gemini-native, mistral-conversations, chrome-prompt.
- Keep a capability table per provider: {baseURL, auth header, modelsPath, webSearch request shape, jsonMode: json_schema|json_object|none, corsFromPage: yes|no|probe}. Fill corsFromPage at runtime with a 'Test connection' call to the models endpoint, stored separately for the PWA, extension and Android.
- PWA defaults: allow OpenAI, Gemini (native), OpenRouter, Groq and xAI directly. Show Mistral and DeepSeek as 'available in the extension/Android app, or through OpenRouter' unless the probe passes.
- Make 'Connect OpenRouter' (OAuth PKCE, callback to the Pages URL) the recommended one-click setup. Send HTTP-Referer and X-OpenRouter-Title: Byways.
- Search request shapes for the spec. OpenAI: POST /v1/responses tools:[{type:'web_search'}]. Gemini: tools:[{google_search:{}}]. OpenRouter: tools:[{type:'openrouter:web_search', parameters:{engine:'auto', max_results:5, max_uses:2}}]. xAI: POST /v1/responses tools:[{type:'web_search'}] with optional x_search. Groq: model 'groq/compound-mini' or 'groq/compound'. Mistral: POST /v1/conversations tools:[{type:'web_search'}]. DeepSeek: POST /responses model 'deepseek-v4-pro' tools:[{type:'web_search'}]. Local models and Nano: no search, so pass in candidates.
- AI team mode: run members with Promise.allSettled, each with its own AbortController timeout (about 25 s). Give each member a role (scout = search model, curator = JSON/ranker, local/Nano = tie-break or describe). Merge results by canonical URL. Only accept URLs that came from grounding/citation metadata or Byways' own sources.
- Use a two-step 'search, then format' pipeline wherever search and json_schema cannot be combined (Gemini below 3, Groq compound, DeepSeek chat, Ollama Cloud). Always parse JSON leniently with a fallback.
- Model picker: fetch the models endpoint live and cache it for about 24 h (OpenRouter /models?supported_parameters=structured_outputs,web_search_options; xAI /v1/language-models; Ollama /api/tags). Ship one editable default model per provider only.
- Add cost guards: AI Search stays off in auto-advance/lean-back unless the user opts in; set a daily search-call cap per provider (default 50); show the per-1k search price beside each provider; cache AI results per query.
- Add Chrome built-in AI as the free no-key option. Feature-detect LanguageModel and check availability(); ask for one tap to download; use it for voice-command intent parsing, read-aloud blurbs and re-ranking with responseConstraint. Hide it where unavailable (Android app, Firefox, Safari).
- Local-model setup text: Ollama OLLAMA_ORIGINS=https://iteatsthesalt.github.io,chrome-extension://*,moz-extension://* (plus OLLAMA_HOST=0.0.0.0 and https://appassets.androidplatform.net for phone use over the LAN). LM Studio: turn on Enable CORS (lms server start --cors) on port 1234. Warn about Chrome's local-network prompt and Safari's localhost block.
- Set the PWA CSP connect-src to the provider hosts plus the custom endpoint. Because custom endpoints exist, connect-src needs 'https:' plus http://localhost:* and http://127.0.0.1:*.
- Key safety: send each key only to its own provider host; keep keys out of share links and collections; suggest restricted keys (Gemini API and referrer limits, OpenAI project keys with budgets, OpenRouter key credit limits); warn that all of the user's github.io Pages projects share one origin (or use a custom domain).
- Error mapping: a fetch TypeError means CORS, local-network, offline or overload, so show 'can't reach provider from this app version' help. 401/403 means a key problem, or a missing OLLAMA_ORIGINS entry for local models. 429/402 means quota. 400 mentioning 'verified' means OpenAI org verification, so retry without streaming.
