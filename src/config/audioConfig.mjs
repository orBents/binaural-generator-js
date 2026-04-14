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
  soft: { bpm: 78, lowPass: 1400, lowPassQ: 0.95, reverbSend: 0.08, swing: 0 },
  jazzy: { bpm: 82, lowPass: 1600, lowPassQ: 1.2, reverbSend: 0.12, swing: 0.02 },
  deep: { bpm: 70, lowPass: 950, lowPassQ: 0.75, reverbSend: 0.35, swing: 0 },
  space: { bpm: 80, lowPass: 1750, lowPassQ: 2.2, reverbSend: 0.2, swing: 0.008 },
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
      intensity: clamp(state.lofi.intensity, AUDIO_LIMITS.min, AUDIO_LIMITS.max),
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
  DEFAULT_VOLUME_STATE,
  clamp,
  applyFade,
  getMaxBinauralMix,
  applyAudioPolicy,
};
