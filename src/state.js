import { DEFAULT_VOLUME_STATE, applyAudioPolicy } from "./config/audioConfig.mjs";

const DEFAULT_STATE = {
  playback: {
    isPlaying: false,
  },
  ui: {
    activeTab: "tuning",
  },
  binaural: {
    preset: "Alpha",
    waveType: "sine",
    mix: DEFAULT_VOLUME_STATE.binauralMix,
    noiseMix: DEFAULT_VOLUME_STATE.noiseMix,
    masterVolume: DEFAULT_VOLUME_STATE.masterVolume,
  },
  lofi: {
    mode: "soft",
    volume: DEFAULT_VOLUME_STATE.beatVolume,
    intensity: DEFAULT_VOLUME_STATE.beatIntensity,
    vinylEnabled: false,
    grooveEnabled: false,
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
