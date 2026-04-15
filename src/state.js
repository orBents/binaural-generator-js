import { DEFAULT_VOLUME_STATE, applyAudioPolicy } from "./config/audioConfig.mjs";

const DEFAULT_STATE = {
  playback: {
    isPlaying: false,
  },
  ui: {
    level: "simple",
    mood: "relax",
    activeModule: "binaural",
    modules: {
      binaural: true,
      rhythm: true,
      harmonics: true,
      noise: true,
    },
  },
  binaural: {
    vibe: "Alpha",
    waveType: "sine",
    mix: DEFAULT_VOLUME_STATE.binauralMix,
    noiseMix: DEFAULT_VOLUME_STATE.noiseMix,
    masterVolume: DEFAULT_VOLUME_STATE.masterVolume,
    offsetHz: 8,
  },
  lofi: {
    mode: "nostalgic",
    globalBpm: DEFAULT_VOLUME_STATE.globalBpm,
    volume: DEFAULT_VOLUME_STATE.beatVolume,
    intensity: DEFAULT_VOLUME_STATE.beatIntensity,
    timbre: "rhodes",
    pianoProbability: 0.4,
    beatDensity: "high",
    vinylEnabled: false,
    grooveEnabled: false,
    bassMode: "warm",
    pedalEnabled: false,
    harmonicMode: "dorian",
    progressionMotion: "fourths",
    hatMotion: "sixteenth",
    kickBody: 0.6,
    snareClap: 0.25,
    tapeHiss: 0.3,
    wowFlutter: 0.35,
    toneCutoff: 1200,
    resonance: 0.4,
    warmth: 0.28,
    space: 0.35,
    subOctaveEnabled: false,
  },
};

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function deepMerge(base, patch) {
  const output = { ...base };

  Object.keys(patch).forEach((key) => {
    const baseValue = base[key];
    const patchValue = patch[key];

    if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
      output[key] = deepMerge(baseValue, patchValue);
      return;
    }

    output[key] = patchValue;
  });

  return output;
}

function createState(initialPatch = {}) {
  let state = applyAudioPolicy(deepMerge(DEFAULT_STATE, initialPatch));
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(patch) {
    state = applyAudioPolicy(deepMerge(state, patch));
    listeners.forEach((listener) => listener(state));
    return state;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    getState,
    setState,
    subscribe,
  };
}

export { DEFAULT_STATE, createState };
