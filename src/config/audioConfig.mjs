const AUDIO_LIMITS = {
  min: 0,
  max: 1,
  binauralToBeatRatio: 0.1,
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
      noiseMix: clamp(state.binaural.noiseMix, AUDIO_LIMITS.min, 0.35),
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
  DEFAULT_VOLUME_STATE,
  clamp,
  getMaxBinauralMix,
  applyAudioPolicy,
};
