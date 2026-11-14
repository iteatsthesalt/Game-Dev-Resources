const VOICES_WAIT_MS = 1000;
const QUIET_ERRORS = new Set(['interrupted', 'canceled']);

const describe = v => ({ uri: v.voiceURI, name: v.name, lang: v.lang, local: v.localService });

/**
 * Text to speech over the Web Speech API. Without `speechSynthesis` it is silent: speak resolves
 * at once and there are no voices.
 * @param {SpeechSynthesis|undefined} speechSynthesis
 * @param {typeof SpeechSynthesisUtterance} [Utterance]
 * @returns {import('../core/types.js').Tts}
 */
export function createWebTts(speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance) {
  if (!speechSynthesis) {
    return { speak: async () => {}, cancel() {}, voices: async () => [] };
  }
  return {
    speak(text, opts = {}) {
      return new Promise((resolve, reject) => {
        const u = new Utterance(text);
        if (opts.voiceURI) {
          const voice = speechSynthesis.getVoices().find(v => v.voiceURI === opts.voiceURI);
          if (voice) u.voice = voice;
        }
        if (opts.rate !== undefined) u.rate = opts.rate;
        if (opts.volume !== undefined) u.volume = opts.volume;
        u.onend = () => resolve();
        u.onerror = event => (QUIET_ERRORS.has(event.error) ? resolve() : reject(new Error(event.error)));
        speechSynthesis.speak(u);
      });
    },
    cancel() { speechSynthesis.cancel(); },
    voices() {
      const now = speechSynthesis.getVoices();
      if (now.length) return Promise.resolve(now.map(describe));
      return new Promise(resolve => {
        let timer;
        const finish = () => resolve(speechSynthesis.getVoices().map(describe));
        const onChange = () => { clearTimeout(timer); finish(); };
        speechSynthesis.addEventListener('voiceschanged', onChange);
        timer = setTimeout(() => {
          speechSynthesis.removeEventListener('voiceschanged', onChange);
          finish();
        }, VOICES_WAIT_MS);
      });
    },
  };
}
