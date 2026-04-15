import {
  AUDIO_RAMP,
  GENERATIVE_CONFIG,
  LOFI_MODE_DEFAULTS,
  applyFade,
  clamp,
} from "../config/audioConfig.mjs";
import { BeatEngine } from "./BeatEngine.mjs";
import { PianoEngine } from "./PianoEngine.mjs";

class LofiEngine {
  constructor(audioContext, destinationNode, options = {}) {
    this.audioContext = audioContext;
    this.destinationNode = destinationNode;
    this.minGain = 0.0001;

    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.minGain;
    this.masterGain.connect(this.destinationNode);

    this.beatBus = this.audioContext.createGain();
    this.pianoBus = this.audioContext.createGain();
    this.vinylGain = this.audioContext.createGain();

    this.beatBus.gain.value = 1;
    this.pianoBus.gain.value = 0.7;
    this.vinylGain.gain.value = this.minGain;

    this.beatBus.connect(this.masterGain);
    this.pianoBus.connect(this.masterGain);
    this.vinylGain.connect(this.masterGain);

    this.beatEngine = new BeatEngine(this.audioContext, this.beatBus, {
      bpm: options.globalBpm ?? GENERATIVE_CONFIG.bpm,
      volume: options.volume ?? 0.82,
      kickBody: options.kickBody ?? 0.6,
      snareClap: options.snareClap ?? 0.25,
      hatMotion: options.hatMotion ?? "sixteenth",
      bassMode: options.bassMode ?? "warm",
    });

    this.pianoEngine = new PianoEngine(this.audioContext, this.pianoBus, {
      probability: options.pianoProbability ?? GENERATIVE_CONFIG.piano.probability,
      scaleName: options.scaleName ?? "dorian",
      bpm: options.globalBpm ?? GENERATIVE_CONFIG.bpm,
      timbre: options.timbre ?? GENERATIVE_CONFIG.piano.timbre,
      harmonicMode: options.harmonicMode ?? "dorian",
      progressionMotion: options.progressionMotion ?? "fourths",
      wowFlutter: options.wowFlutter ?? 0.35,
      toneCutoff: options.toneCutoff ?? 1200,
    });

    this.intensity = clamp(options.intensity ?? 0.62, 0, 1);
    this.volume = clamp(options.volume ?? 0.82, 0, 1);
    this.globalBpm = clamp(options.globalBpm ?? GENERATIVE_CONFIG.bpm, 48, 120);
    this.vinylEnabled = Boolean(options.vinylEnabled);
    this.grooveEnabled = Boolean(options.grooveEnabled);
    this.pedalEnabled = Boolean(options.pedalEnabled);
    this.rhythmEnabled = true;
    this.harmonicsEnabled = true;
    this.kickBody = clamp(options.kickBody ?? 0.6, 0, 1);
    this.snareClap = clamp(options.snareClap ?? 0.25, 0, 1);
    this.hatMotion = options.hatMotion === "eighth" ? "eighth" : "sixteenth";
    this.bassMode = ["off", "warm", "heavy"].includes(options.bassMode) ? options.bassMode : "warm";
    this.tapeHiss = clamp(options.tapeHiss ?? 0.3, 0, 1);
    this.wowFlutter = clamp(options.wowFlutter ?? 0.35, 0, 1);
    this.toneCutoff = clamp(options.toneCutoff ?? 1200, 800, 2600);

    this.mode = "nostalgic";
    this.running = false;
    this.vinylBuffer = this._createWhiteNoiseBuffer(3.2);
    this.vinylSource = null;
    this.vinylInterval = null;

    this.modeConfig = LOFI_MODE_DEFAULTS;

    this.beatEngine.setOnStep(({ time, step }) => {
      if (!this.harmonicsEnabled) {
        return;
      }
      this.pianoEngine.playStep({ time, step });
    });

    this.setMode(this.mode, { immediate: true });
    this.setGlobalBpm(this.globalBpm);
    this.setIntensity(this.intensity);
    this.setTimbre(options.timbre ?? GENERATIVE_CONFIG.piano.timbre);
    this.setPedalEnabled(this.pedalEnabled);
    this.setResonance(options.resonance ?? 0.45);
    this.setWarmth(options.warmth ?? 0.28);
    this.setSpace(options.space ?? 0.35);
    this.setSubOctaveEnabled(Boolean(options.subOctaveEnabled));
    this.setHarmonicMode(options.harmonicMode ?? "dorian");
    this.setProgressionMotion(options.progressionMotion ?? "fourths");
    this.setKickBody(this.kickBody);
    this.setSnareClap(this.snareClap);
    this.setHatMotion(this.hatMotion);
    this.setBassMode(this.bassMode);
    this.setTapeHiss(this.tapeHiss);
    this.setWowFlutter(this.wowFlutter);
    this.setToneCutoff(this.toneCutoff);
    this.setVolume(this.volume, 0);
    this.setVinylEnabled(this.vinylEnabled);
    this.setGrooveEnabled(this.grooveEnabled);
  }

  async start() {
    if (this.running) {
      return;
    }

    await this.beatEngine.init();

    this.running = true;
    this._ensureVinylSourceStarted();
    this.beatEngine.start();

    if (this.vinylEnabled) {
      this._startVinylAutomation();
    }

    const target = this._intensityToMaster(this.intensity);
    applyFade(this.audioContext, this.masterGain.gain, target, AUDIO_RAMP.startFade, true, this.minGain);
  }

  stop() {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.beatEngine.stop();
    this.pianoEngine.stopAllVoices();
    this._stopVinylAutomation();
    applyFade(this.audioContext, this.masterGain.gain, this.minGain, AUDIO_RAMP.stopFade, true, this.minGain);
  }

  setGlobalBpm(value) {
    this.globalBpm = clamp(Number(value), 48, 120);
    this.beatEngine.setBpm(this._getEffectiveBpm());
    this.pianoEngine.setBpm(this._getEffectiveBpm());
  }

  setIntensity(value) {
    this.intensity = clamp(Number(value), 0, 1);

    const isHigh = this.intensity >= 0.55;
    this.pianoEngine.setProbability(isHigh ? 0.7 : 0.2);

    this._applyRhythmIdentity();
    this._applyBeatDynamics(AUDIO_RAMP.normal);
    this._applyVinylBase(AUDIO_RAMP.normal);
  }

  setVolume(value, rampSeconds = AUDIO_RAMP.normal) {
    this.volume = clamp(Number(value), 0, 1);
    this.beatEngine.setVolume(this.volume, rampSeconds);
    this.pianoEngine.setOutputLevel(this._volumeToPianoLevel(this.volume), rampSeconds);
  }

  setVinylEnabled(enabled) {
    this.vinylEnabled = Boolean(enabled);

    if (!this.running) {
      this._applyVinylBase(AUDIO_RAMP.normal);
      return;
    }

    if (this.vinylEnabled && this.rhythmEnabled) {
      this._startVinylAutomation();
    } else {
      this._stopVinylAutomation();
      this._applyVinylBase(AUDIO_RAMP.normal);
    }
  }

  setGrooveEnabled(enabled) {
    this.grooveEnabled = Boolean(enabled);
    const config = this.modeConfig[this.mode] || this.modeConfig.nostalgic;

    this.beatEngine.setGrooveEnabled(this.grooveEnabled);
    this.beatEngine.setSwing(this.grooveEnabled ? Math.max(0.038, config.swing) : config.swing);
    this.beatEngine.setShuffle(this.grooveEnabled ? Math.max(0.6, config.shuffle) : config.shuffle);
    this.beatEngine.setLaidBack(this.grooveEnabled ? Math.max(0.012, config.laidBack) : config.laidBack * 0.6);

    this._applyRhythmIdentity();
    this.setGlobalBpm(this.globalBpm);
  }

  setMode(mode, options = {}) {
    if (!this.modeConfig[mode]) {
      return;
    }

    const immediate = Boolean(options.immediate);
    const config = this.modeConfig[mode];
    this.mode = mode;

    this.beatEngine.setBpm(this._getEffectiveBpm());
    this.beatEngine.setLowPassHz(config.lowPass);
    this.beatEngine.setSwing(this.grooveEnabled ? Math.max(0.028, config.swing) : config.swing);
    this.beatEngine.setShuffle(this.grooveEnabled ? Math.max(0.57, config.shuffle) : config.shuffle);
    this.beatEngine.setLaidBack(this.grooveEnabled ? Math.max(0.008, config.laidBack) : config.laidBack * 0.6);
    this.pianoEngine.setScale(config.scale);

    this._applyRhythmIdentity();

    const ramp = immediate ? 0.02 : AUDIO_RAMP.slow;
    applyFade(this.audioContext, this.pianoBus.gain, 0.72, ramp, true, this.minGain);
  }

  setTimbre(timbre) {
    this.pianoEngine.setTimbre(timbre);
  }

  setPedalEnabled(enabled) {
    this.pedalEnabled = Boolean(enabled);
    this.pianoEngine.setPedalEnabled(this.pedalEnabled);
  }

  setRhythmEnabled(enabled) {
    this.rhythmEnabled = Boolean(enabled);
    this._applyBeatDynamics(AUDIO_RAMP.fast);
    if (!this.rhythmEnabled) {
      this._stopVinylAutomation();
    } else if (this.running && this.vinylEnabled) {
      this._startVinylAutomation();
    }
    this._applyVinylBase(AUDIO_RAMP.fast);
  }

  setHarmonicsEnabled(enabled) {
    this.harmonicsEnabled = Boolean(enabled);
    this._applyBeatDynamics(AUDIO_RAMP.fast);
    if (!this.harmonicsEnabled) {
      this.pianoEngine.stopAllVoices();
    }
  }

  setResonance(value) {
    this.pianoEngine.setResonance(value);
  }

  setWarmth(value) {
    this.pianoEngine.setWarmth(value);
  }

  setSpace(value) {
    this.pianoEngine.setSpace(value);
  }

  setSubOctaveEnabled(enabled) {
    this.pianoEngine.setSubOctaveEnabled(enabled);
  }

  setHarmonicMode(mode) {
    this.pianoEngine.setHarmonicMode(mode);
  }

  setProgressionMotion(motion) {
    this.pianoEngine.setProgressionMotion(motion);
  }

  setKickBody(value) {
    this.kickBody = clamp(Number(value), 0, 1);
    this.beatEngine.setKickBody(this.kickBody);
  }

  setSnareClap(value) {
    this.snareClap = clamp(Number(value), 0, 1);
    this.beatEngine.setSnareClap(this.snareClap);
  }

  setHatMotion(mode) {
    this.hatMotion = mode === "eighth" ? "eighth" : "sixteenth";
    this.beatEngine.setHatMotion(this.hatMotion);
  }

  setBassMode(mode) {
    this.bassMode = ["off", "warm", "heavy"].includes(mode) ? mode : "warm";
    this.beatEngine.setBassMode(this.bassMode);
  }

  setTapeHiss(value) {
    this.tapeHiss = clamp(Number(value), 0, 1);
    this._applyVinylBase(AUDIO_RAMP.normal);
  }

  setWowFlutter(value) {
    this.wowFlutter = clamp(Number(value), 0, 1);
    this.pianoEngine.setWowFlutter(this.wowFlutter);
  }

  setToneCutoff(value) {
    this.toneCutoff = clamp(Number(value), 800, 2600);
    this.beatEngine.setLowPassHz(this.toneCutoff);
    this.pianoEngine.setToneCutoff(this.toneCutoff);
  }

  setOnPianoNote(callback) {
    this.pianoEngine.setOnNote(callback);
  }

  _getEffectiveBpm() {
    const grooveOffset = this.grooveEnabled ? -1 : 0;
    return clamp(this.globalBpm + grooveOffset, 42, 180);
  }

  _applyRhythmIdentity() {
    const high = this.intensity >= 0.55;
    const patterns = {
      low: {
        kick: [1, 0, 0, 0, 1, 0, 0, 1],
        snare: [0, 0, 1, 0, 0, 0, 1, 0],
        hat: [1, 1, 1, 1, 1, 1, 1, 1],
      },
      high: {
        kick: [1, 0, 0, 1, 1, 0, 0, 1],
        snare: [0, 0, 1, 0, 0, 1, 1, 0],
        hat: [1, 1, 1, 1, 1, 1, 1, 1],
      },
    };

    const base = high ? patterns.high : patterns.low;

    if (!this.grooveEnabled) {
      this.beatEngine.setPatterns(base);
      return;
    }

    const groovedHat = base.hat.map((value, idx) => (idx % 2 === 1 ? 1 : value));
    const groovedKick = base.kick.map((value, idx) => (idx === 7 && high ? 1 : value));

    this.beatEngine.setPatterns({
      ...base,
      kick: groovedKick,
      hat: groovedHat,
    });
  }

  _ensureVinylSourceStarted() {
    if (this.vinylSource) {
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = this.vinylBuffer;
    source.loop = true;
    source.connect(this.vinylGain);
    source.start();
    this.vinylSource = source;
  }

  _startVinylAutomation() {
    if (this.vinylInterval) {
      return;
    }

    this.vinylInterval = window.setInterval(() => {
      if (!this.running || !this.vinylEnabled || !this.rhythmEnabled) {
        return;
      }

      const now = this.audioContext.currentTime;
      const base = this._intensityToVinyl(this.intensity) * 0.28;
      const peak = base + (Math.random() * base * 0.75);
      const hold = 0.05 + Math.random() * 0.08;

      this.vinylGain.gain.cancelScheduledValues(now);
      this.vinylGain.gain.setValueAtTime(Math.max(base, this.minGain), now);
      this.vinylGain.gain.exponentialRampToValueAtTime(Math.max(peak, this.minGain), now + 0.01);
      this.vinylGain.gain.exponentialRampToValueAtTime(Math.max(base, this.minGain), now + hold);
    }, 120);
  }

  _stopVinylAutomation() {
    if (this.vinylInterval) {
      clearInterval(this.vinylInterval);
      this.vinylInterval = null;
    }
  }

  _applyBeatDynamics(rampSeconds = AUDIO_RAMP.normal) {
    const beatTarget = this.rhythmEnabled ? this._intensityToHit(this.intensity) : this.minGain;
    const pianoTarget = this.harmonicsEnabled ? this._intensityToPiano(this.intensity) : this.minGain;

    applyFade(this.audioContext, this.beatBus.gain, beatTarget, rampSeconds, true, this.minGain);
    applyFade(this.audioContext, this.pianoBus.gain, pianoTarget, rampSeconds, true, this.minGain);

    if (this.running) {
      const masterTarget = this._intensityToMaster(this.intensity);
      applyFade(this.audioContext, this.masterGain.gain, masterTarget, rampSeconds, true, this.minGain);
    }
  }

  _applyVinylBase(rampSeconds = AUDIO_RAMP.normal) {
    const baseTarget = (this.vinylEnabled && this.rhythmEnabled)
      ? this._intensityToVinyl(this.intensity) * (0.35 + this.tapeHiss * 0.95)
      : this.minGain;
    applyFade(this.audioContext, this.vinylGain.gain, baseTarget, rampSeconds, true, this.minGain);
  }

  _createWhiteNoiseBuffer(seconds) {
    const length = Math.floor(this.audioContext.sampleRate * seconds);
    const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.7;
    }

    return buffer;
  }

  _volumeToPianoLevel(volume) {
    return clamp(0.22 + volume * 0.32, this.minGain, 0.62);
  }

  _intensityToMaster(intensity) {
    return clamp(0.18 + intensity * 0.33, this.minGain, 0.56);
  }

  _intensityToHit(intensity) {
    return clamp(0.2 + intensity * 0.32, this.minGain, 0.58);
  }

  _intensityToPiano(intensity) {
    return clamp(0.16 + intensity * 0.28, this.minGain, 0.52);
  }

  _intensityToVinyl(intensity) {
    return clamp(0.003 + intensity * 0.015, this.minGain, 0.03);
  }
}

export { LofiEngine };
