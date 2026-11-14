// Browser-side fakes for speech recognition, speech synthesis and the screen wake lock.
// installFakeSpeech runs before the page's own scripts and exposes the window hooks specs drive.
export async function installFakeSpeech(page) {
  await page.addInitScript(() => {
    const fire = (target, type, init = {}) => {
      const event = Object.assign(new Event(type), init);
      target['on' + type]?.call(target, event);
      target.dispatchEvent(event);
    };

    window.__recognizers = [];
    window.__spoken = [];
    window.__wake = { requests: 0, releases: 0 };

    class FakeRecognition extends EventTarget {
      constructor() {
        super();
        this.lang = '';
        this.continuous = false;
        this.interimResults = false;
        this.maxAlternatives = 1;
        this.started = false;
        window.__recognizers.push(this);
      }
      start() {
        if (this.started) throw new DOMException('recognition has already started', 'InvalidStateError');
        this.started = true;
        fire(this, 'start');
      }
      stop() { this.started = false; fire(this, 'end'); }
      abort() { this.started = false; fire(this, 'end'); }
    }
    window.SpeechRecognition = window.webkitSpeechRecognition = FakeRecognition;
    window.__say = (text, final = true) => {
      const result = Object.assign([{ transcript: text, confidence: 0.9 }], { isFinal: final });
      for (const r of window.__recognizers.filter(x => x.started)) fire(r, 'result', { resultIndex: 0, results: [result] });
    };
    window.__voiceError = code => {
      for (const r of window.__recognizers.filter(x => x.started)) {
        r.started = false;
        fire(r, 'error', { error: code });
        fire(r, 'end');
      }
    };

    class FakeUtterance extends EventTarget {
      constructor(text = '') {
        super();
        this.text = String(text);
        this.voice = null;
        this.rate = 1;
        this.volume = 1;
        this.pitch = 1;
        this.lang = '';
      }
    }
    window.SpeechSynthesisUtterance = FakeUtterance;

    const voices = [
      { name: 'Local English', voiceURI: 'local-en', lang: 'en-US', localService: true, default: true },
      { name: 'Online English', voiceURI: 'net-en', lang: 'en-US', localService: false, default: false },
    ];
    class FakeSynthesis extends EventTarget {
      #queue = [];
      #current = null;
      #paused = false;
      get speaking() { return this.#current !== null; }
      get pending() { return this.#queue.length > 0; }
      get paused() { return this.#paused; }
      pause() { this.#paused = true; }
      resume() { this.#paused = false; }
      getVoices() { return voices.map(v => ({ ...v })); }
      speak(utterance) {
        this.#queue.push(utterance);
        this.#next();
      }
      cancel() {
        const current = this.#current;
        const queued = this.#queue;
        this.#current = null;
        this.#queue = [];
        if (current) fire(current, 'error', { error: 'interrupted' });
        for (const u of queued) fire(u, 'error', { error: 'canceled' });
      }
      #next() {
        if (this.#current || !this.#queue.length) return;
        const utterance = this.#current = this.#queue.shift();
        Promise.resolve().then(() => {
          if (this.#current !== utterance) return;
          window.__spoken.push(utterance.text);
          fire(utterance, 'start');
          Promise.resolve().then(() => {
            if (this.#current !== utterance) return;
            this.#current = null;
            fire(utterance, 'end');
            this.#next();
          });
        });
      }
    }
    Object.defineProperty(window, 'speechSynthesis', { value: new FakeSynthesis(), configurable: true });

    class FakeSentinel extends EventTarget {
      constructor(type) {
        super();
        this.type = type;
        this.released = false;
      }
      async release() {
        if (this.released) return;
        this.released = true;
        window.__wake.releases++;
        fire(this, 'release');
      }
    }
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: async type => { window.__wake.requests++; return new FakeSentinel(type); } },
      configurable: true,
    });
  });
}
