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
    this.crackleGain = this.audioContext.createGain();

    this.beatBus.gain.value = 1;
    this.pianoBus.gain.value = 0.7;
    this.crackleGain.gain.value = this.minGain;

    this.beatBus.connect(this.masterGain);
    this.pianoBus.connect(this.masterGain);
    this.crackleGain.connect(this.masterGain);

    this.beatEngine = new BeatEngine(this.audioContext, this.beatBus, {
      bpm: options.bpm ?? GENERATIVE_CONFIG.bpm,
      volume: options.volume ?? 0.82,
    });

    this.pianoEngine = new PianoEngine(this.audioContext, this.pianoBus, {
      probability: options.pianoProbability ?? GENERATIVE_CONFIG.piano.probability,
      scaleName: options.scaleName ?? "dreamy",
      timbre: options.pianoTimbre ?? GENERATIVE_CONFIG.piano.timbre,
    });

    this.intensity = clamp(options.intensity ?? 0.62, 0, 1);
    this.volume = clamp(options.volume ?? 0.82, 0, 1);
    this.vinylEnabled = Boolean(options.vinylEnabled);
    this.grooveEnabled = false;
    this.bpmBoostEnabled = Boolean(options.bpmBoostEnabled);
    this.bpmBoostMultiplier = 1.3;

    this.mode = "soft";
    this.running = false;
    this.crackleBuffer = this._createWhiteNoiseBuffer(3.2);
    this.crackleSource = null;
    this.crackleInterval = null;

    this.modeConfig = LOFI_MODE_DEFAULTS;

    this.beatEngine.setOnStep(({ time, step }) => {
      this.pianoEngine.playStep({ time, step });
    });

    this.setMode(this.mode, { immediate: true });
    this.setIntensity(this.intensity);
    this.setPianoTimbre(options.pianoTimbre ?? GENERATIVE_CONFIG.piano.timbre);
    this.setBpmBoostEnabled(options.bpmBoostEnabled);
    this.setVolume(this.volume, 0);
    this.setVinylEnabled(this.vinylEnabled);
  }

  async start() {
    if (this.running) {
      return;
    }

    await this.beatEngine.init();

    this.running = true;
    this._ensureCrackleSourceStarted();
    this.beatEngine.start();

    if (this.vinylEnabled) {
      this._startCrackleAutomation();
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
    this._stopCrackleAutomation();
    applyFade(this.audioContext, this.masterGain.gain, this.minGain, AUDIO_RAMP.stopFade, true, this.minGain);
  }

  setIntensity(value) {
    this.intensity = clamp(Number(value), 0, 1);

    const isHigh = this.intensity >= 0.55;
    const pianoProbability = isHigh ? 0.7 : 0.2;
    this.pianoEngine.setProbability(pianoProbability);

    if (isHigh) {
      this.beatEngine.setPatterns({
        kick: [1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 1, 0, 0, 0, 1, 1],
        hat: [1, 1, 1, 1, 1, 1, 1, 1],
      });
    } else {
      this.beatEngine.setPatterns({
        kick: [1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0],
        hat: [1, 0, 1, 0, 1, 0, 1, 0],
      });
    }

    this._applyBeatDynamics(AUDIO_RAMP.normal);
    this._applyCrackleBase(AUDIO_RAMP.normal);
  }

  setVolume(value, rampSeconds = AUDIO_RAMP.normal) {
    this.volume = clamp(Number(value), 0, 1);
    this.beatEngine.setVolume(this.volume, rampSeconds);
    this.pianoEngine.setOutputLevel(this._volumeToPianoLevel(this.volume), rampSeconds);
  }

  setVinylEnabled(enabled) {
    this.vinylEnabled = Boolean(enabled);

    if (!this.running) {
      this._applyCrackleBase(AUDIO_RAMP.normal);
      return;
    }

    if (this.vinylEnabled) {
      this._startCrackleAutomation();
    } else {
      this._stopCrackleAutomation();
      this._applyCrackleBase(AUDIO_RAMP.normal);
    }
  }

  setGrooveEnabled(enabled) {
    this.grooveEnabled = Boolean(enabled);
    this.beatEngine.setSwing(this.grooveEnabled ? 0.022 : this.modeConfig[this.mode]?.swing ?? 0.01);
  }

  setMode(mode, options = {}) {
    if (!this.modeConfig[mode]) {
      return;
    }

    const immediate = Boolean(options.immediate);
    const config = this.modeConfig[mode];
    this.mode = mode;

    const effectiveBpm = this.bpmBoostEnabled
      ? config.bpm * this.bpmBoostMultiplier
      : config.bpm;
    this.beatEngine.setBpm(effectiveBpm);
    this.beatEngine.setLowPassHz(config.lowPass);
    this.beatEngine.setSwing(this.grooveEnabled ? 0.022 : config.swing);
    this.pianoEngine.setScale(config.scale);

    const ramp = immediate ? 0.02 : AUDIO_RAMP.slow;
    applyFade(this.audioContext, this.pianoBus.gain, mode === "deep" ? 0.52 : 0.72, ramp, true, this.minGain);
  }

  setPianoTimbre(timbre) {
    this.pianoEngine.setTimbre(timbre);
  }

  setBpmBoostEnabled(enabled) {
    this.bpmBoostEnabled = Boolean(enabled);
    this.setMode(this.mode, { immediate: true });
  }

  setOnPianoNote(callback) {
    this.pianoEngine.setOnNote(callback);
  }

  _ensureCrackleSourceStarted() {
    if (this.crackleSource) {
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = this.crackleBuffer;
    source.loop = true;
    source.connect(this.crackleGain);
    source.start();
    this.crackleSource = source;
  }

  _startCrackleAutomation() {
    if (this.crackleInterval) {
      return;
    }

    this.crackleInterval = window.setInterval(() => {
      if (!this.running || !this.vinylEnabled) {
        return;
      }

      const now = this.audioContext.currentTime;
      const base = this._intensityToCrackle(this.intensity) * 0.12;
      const peak = base + (Math.random() * base * 0.75);
      const hold = 0.05 + Math.random() * 0.08;

      this.crackleGain.gain.cancelScheduledValues(now);
      this.crackleGain.gain.setValueAtTime(Math.max(base, this.minGain), now);
      this.crackleGain.gain.exponentialRampToValueAtTime(Math.max(peak, this.minGain), now + 0.014);
      this.crackleGain.gain.exponentialRampToValueAtTime(Math.max(base, this.minGain), now + hold);
    }, 170);
  }

  _stopCrackleAutomation() {
    if (this.crackleInterval) {
      clearInterval(this.crackleInterval);
      this.crackleInterval = null;
    }
  }

  _applyBeatDynamics(rampSeconds = AUDIO_RAMP.normal) {
    const beatTarget = this._intensityToHit(this.intensity);
    const pianoTarget = this._intensityToPiano(this.intensity);

    applyFade(this.audioContext, this.beatBus.gain, beatTarget, rampSeconds, true, this.minGain);
    applyFade(this.audioContext, this.pianoBus.gain, pianoTarget, rampSeconds, true, this.minGain);

    if (this.running) {
      const masterTarget = this._intensityToMaster(this.intensity);
      applyFade(this.audioContext, this.masterGain.gain, masterTarget, rampSeconds, true, this.minGain);
    }
  }

  _applyCrackleBase(rampSeconds = AUDIO_RAMP.normal) {
    const baseTarget = this.vinylEnabled ? this._intensityToCrackle(this.intensity) : this.minGain;
    applyFade(this.audioContext, this.crackleGain.gain, baseTarget, rampSeconds, true, this.minGain);
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
    return clamp(0.35 + volume * 0.44, this.minGain, 0.9);
  }

  _intensityToMaster(intensity) {
    return clamp(0.22 + intensity * 0.5, this.minGain, 0.82);
  }

  _intensityToHit(intensity) {
    return clamp(0.3 + intensity * 0.58, this.minGain, 0.9);
  }

  _intensityToPiano(intensity) {
    return clamp(0.22 + intensity * 0.46, this.minGain, 0.86);
  }

  _intensityToCrackle(intensity) {
    return clamp(0.0012 + intensity * 0.012, this.minGain, 0.02);
  }
}

export { LofiEngine };

