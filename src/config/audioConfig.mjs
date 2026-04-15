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
  nostalgic: { bpm: 102, scale: "dorian", lowPass: 1200, swing: 0.022, laidBack: 0.008, shuffle: 0.57 },
};

const GENERATIVE_CONFIG = {
  bpm: 102,
  scales: {
    dorian: ["C3", "D3", "Eb3", "F3", "G3", "A3", "Bb3", "C4", "D4", "Eb4", "F4"],
    lydian: ["C3", "D3", "E3", "F#3", "G3", "A3", "B3", "C4", "D4", "E4", "F#4"],
  },
  piano: {
    probability: 0.48,
    humanization: 0.02,
    release: 1.5,
    timbre: "rhodes",
  },
  beat: {
    swing: 0.02,
    lowPassHz: 1550,
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
  globalBpm: 102,
  beatVolume: 0.82,
  beatIntensity: 0.62,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

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

function getMaxBinauralMix(beatVolume) {
  const safeBeat = clamp(beatVolume, AUDIO_LIMITS.min, AUDIO_LIMITS.max);
  return clamp(safeBeat * AUDIO_LIMITS.binauralToBeatRatio, AUDIO_LIMITS.min, AUDIO_LIMITS.max);
}

function applyAudioPolicy(state) {
  const beatVolume = clamp(state.lofi.volume, AUDIO_LIMITS.min, AUDIO_LIMITS.max);
  const maxBinaural = getMaxBinauralMix(beatVolume);
  const intensity = clamp(state.lofi.intensity, AUDIO_LIMITS.min, AUDIO_LIMITS.max);
  const highIntensity = intensity >= 0.55;

  const allowedTimbres = ["rhodes", "flute", "blend"];
  const allowedHarmonicModes = ["dorian", "lydian"];
  const allowedProgressions = ["fourths", "fifths"];
  const allowedHatMotions = ["eighth", "sixteenth"];
  const allowedBassModes = ["off", "warm", "heavy"];
  const normalizedTimbre = state.lofi.timbre;
  const timbre = allowedTimbres.includes(normalizedTimbre)
    ? normalizedTimbre
    : "rhodes";
  const harmonicMode = allowedHarmonicModes.includes(state.lofi.harmonicMode)
    ? state.lofi.harmonicMode
    : "dorian";
  const progressionMotion = allowedProgressions.includes(state.lofi.progressionMotion)
    ? state.lofi.progressionMotion
    : "fourths";
  const hatMotion = allowedHatMotions.includes(state.lofi.hatMotion)
    ? state.lofi.hatMotion
    : "sixteenth";
  const bassMode = allowedBassModes.includes(state.lofi.bassMode)
    ? state.lofi.bassMode
    : "warm";

  return {
    ...state,
    binaural: {
      ...state.binaural,
      mix: clamp(Math.min(state.binaural.mix, maxBinaural), AUDIO_LIMITS.min, AUDIO_LIMITS.max),
      noiseMix: clamp(state.binaural.noiseMix, AUDIO_LIMITS.min, AUDIO_LIMITS.maxNoiseMix),
      masterVolume: clamp(state.binaural.masterVolume, AUDIO_LIMITS.min, AUDIO_LIMITS.max),
      offsetHz: clamp(state.binaural.offsetHz ?? 8, 0.5, 40),
    },
    lofi: {
      ...state.lofi,
      mode: "nostalgic",
      globalBpm: clamp(state.lofi.globalBpm, 48, 120),
      volume: beatVolume,
      intensity,
      pianoProbability: highIntensity ? 0.7 : 0.2,
      beatDensity: highIntensity ? "high" : "low",
      timbre,
      pedalEnabled: Boolean(state.lofi.pedalEnabled),
      harmonicMode,
      progressionMotion,
      hatMotion,
      bassMode,
      kickBody: clamp(state.lofi.kickBody ?? 0.6, 0, 1),
      snareClap: clamp(state.lofi.snareClap ?? 0.25, 0, 1),
      tapeHiss: clamp(state.lofi.tapeHiss ?? 0.3, 0, 1),
      wowFlutter: clamp(state.lofi.wowFlutter ?? 0.35, 0, 1),
      toneCutoff: clamp(state.lofi.toneCutoff ?? 1200, 800, 2600),
      resonance: clamp(state.lofi.resonance ?? 0.4, 0, 1),
      warmth: clamp(state.lofi.warmth ?? 0.28, 0, 1),
      space: clamp(state.lofi.space ?? 0.35, 0, 1),
      subOctaveEnabled: Boolean(state.lofi.subOctaveEnabled),
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
