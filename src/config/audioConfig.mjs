const AUDIO_LIMITS = {
  min: 0,
  max: 1,
  binauralToBeatRatio: 0.1,
  maxNoiseMix: 0.35,
};

const AUDIO_RAMP = {
  fast: 0.12,
  normal: 0.25,
  slow: 0.45,
  startFade: 3,
  stopFade: 0.8,
};

const FILTER_DEFAULTS = {
  binauralCutoff: 420,
  noiseCutoff: 320,
  lofiLowPass: 1500,
};

const BINAURAL_SWEEP = {
  low: 180,
  high: 620,
  durationSec: 7,
};

const BINAURAL_TONE_BY_WAVE = {
  sine: 420,
  triangle: 360,
  square: 260,
  sawtooth: 220,
};

const COMPRESSOR_DEFAULTS = {
  threshold: -16,
  knee: 20,
  ratio: 5,
  attack: 0.003,
  release: AUDIO_RAMP.normal,
};

const LOFI_MODE_DEFAULTS = {
  soft: { bpm: 72, scale: "dreamy", lowPass: 1500, swing: 0.008 },
  jazzy: { bpm: 76, scale: "zen", lowPass: 1750, swing: 0.015 },
  deep: { bpm: 68, scale: "zen", lowPass: 1450, swing: 0.004 },
  space: { bpm: 80, scale: "dreamy", lowPass: 1900, swing: 0.02 },
};

const GENERATIVE_CONFIG = {
  bpm: 72,
  scales: {
    dreamy: ["C3", "D3", "Eb3", "F3", "G3", "Ab3", "Bb3", "C4", "D4"],
    zen: ["F3", "G3", "Ab3", "Bb3", "C4", "Db4", "Eb4", "F4", "G4"],
  },
  piano: {
    probability: 0.4,
    humanization: 0.02,
    release: 1.5,
    timbre: "classico",
  },
  beat: {
    swing: 0.012,
    lowPassHz: 1700,
    patterns: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 1, 0, 0, 0, 1, 0],
      hat: [1, 1, 1, 1, 1, 1, 1, 1],
    },
  },
};

const DEFAULT_VOLUME_STATE = {
  binauralMix: 0.08,
  noiseMix: 0.02,
  masterVolume: 0.78,
  beatVolume: 0.82,
  beatIntensity: 0.62,
};

/**
 * Clamp a numeric value into a safe range.
 * @param {number} value Numeric value.
 * @param {number} min Lower bound.
 * @param {number} max Upper bound.
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

/**
 * Smoothly fade a gain parameter.
 * @param {BaseAudioContext} context Audio context.
 * @param {AudioParam} audioParam Target AudioParam.
 * @param {number} targetValue Target value.
 * @param {number} duration Fade duration in seconds.
 * @param {boolean} exponential Use exponential ramp.
 * @param {number} minGain Minimum floor for exponential ramps.
 * @returns {void}
 */
function applyFade(context, audioParam, targetValue, duration, exponential = true, minGain = 0.0001) {
  const now = context.currentTime;
  const safeDuration = Math.max(0.01, Number(duration));
  const startValue = Math.max(audioParam.value, minGain);
  const safeTarget = Math.max(Number(targetValue), exponential ? minGain : 0);

  audioParam.cancelScheduledValues(now);
  audioParam.setValueAtTime(startValue, now);

  if (exponential) {
    audioParam.exponentialRampToValueAtTime(safeTarget, now + safeDuration);
    if (targetValue <= 0) {
      audioParam.setValueAtTime(0, now + safeDuration + 0.001);
    }
    return;
  }

  audioParam.linearRampToValueAtTime(safeTarget, now + safeDuration);
}

/**
 * Convert a note name (e.g. A4, C#3, Eb5) to Hz.
 * @param {string} note Musical note.
 * @returns {number}
 */
function noteToFrequency(note) {
  if (typeof note !== "string") {
    return 440;
  }

  const parsed = note.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!parsed) {
    return 440;
  }

  const [, rawLetter, accidental, rawOctave] = parsed;
  const letter = rawLetter.toUpperCase();
  const octave = Number(rawOctave);

  const semitoneByLetter = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };

  let semitone = semitoneByLetter[letter];
  if (accidental === "#") {
    semitone += 1;
  }
  if (accidental === "b") {
    semitone -= 1;
  }

  const midi = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Compute the maximum binaural mix allowed for a given beat volume.
 * @param {number} beatVolume Beat volume in 0..1.
 * @returns {number}
 */
function getMaxBinauralMix(beatVolume) {
  const safeBeat = clamp(beatVolume, AUDIO_LIMITS.min, AUDIO_LIMITS.max);
  return clamp(safeBeat * AUDIO_LIMITS.binauralToBeatRatio, AUDIO_LIMITS.min, AUDIO_LIMITS.max);
}

/**
 * Apply central audio policy so beat remains the primary layer.
 * @param {object} state Partial or full app state.
 * @returns {object}
 */
function applyAudioPolicy(state) {
  const beatVolume = clamp(state.lofi.volume, AUDIO_LIMITS.min, AUDIO_LIMITS.max);
  const maxBinaural = getMaxBinauralMix(beatVolume);
  const intensity = clamp(state.lofi.intensity, AUDIO_LIMITS.min, AUDIO_LIMITS.max);
  const highIntensity = intensity >= 0.55;

  const allowedPianoTimbres = ["classico", "nylon", "8bits", "synth"];
  const normalizedPianoTimbre = state.lofi.pianoTimbre === "digital"
    ? "nylon"
    : state.lofi.pianoTimbre;
  const pianoTimbre = allowedPianoTimbres.includes(normalizedPianoTimbre)
    ? normalizedPianoTimbre
    : "classico";

  return {
    ...state,
    binaural: {
      ...state.binaural,
      mix: clamp(Math.min(state.binaural.mix, maxBinaural), AUDIO_LIMITS.min, AUDIO_LIMITS.max),
      noiseMix: clamp(state.binaural.noiseMix, AUDIO_LIMITS.min, AUDIO_LIMITS.maxNoiseMix),
      masterVolume: clamp(state.binaural.masterVolume, AUDIO_LIMITS.min, AUDIO_LIMITS.max),
    },
    lofi: {
      ...state.lofi,
      volume: beatVolume,
      intensity,
      pianoProbability: highIntensity ? 0.7 : 0.2,
      beatDensity: highIntensity ? "high" : "low",
      pianoTimbre,
      bpmBoostEnabled: Boolean(state.lofi.bpmBoostEnabled),
    },
  };
}

export {
  AUDIO_LIMITS,
  AUDIO_RAMP,
  FILTER_DEFAULTS,
  BINAURAL_SWEEP,
  BINAURAL_TONE_BY_WAVE,
  COMPRESSOR_DEFAULTS,
  LOFI_MODE_DEFAULTS,
  GENERATIVE_CONFIG,
  DEFAULT_VOLUME_STATE,
  clamp,
  applyFade,
  noteToFrequency,
  getMaxBinauralMix,
  applyAudioPolicy,
};

