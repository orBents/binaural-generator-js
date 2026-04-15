import { getVibe } from "../utils/presets.mjs";
import {
  AUDIO_LIMITS,
  AUDIO_RAMP,
  FILTER_DEFAULTS,
  BINAURAL_SWEEP,
  BINAURAL_TONE_BY_WAVE,
  COMPRESSOR_DEFAULTS,
  applyFade,
  getMaxBinauralMix,
} from "../config/audioConfig.mjs";

const AudioContextRef = window.AudioContext || window.webkitAudioContext;

class BinauralEngine {
  constructor(options = {}) {
    this.audioContext = options.audioContext || new AudioContextRef();
    this.minGain = 0.0001;
    this.maxMasterGain = 1;
    this.beatReferenceVolume = 0.82;

    this.isRunning = false;
    this.transportTargetGain = this._clamp(options.masterGain ?? 0.32, this.minGain, 0.9);
    this.masterVolumeTarget = this._clamp(options.masterVolume ?? 0.78, this.minGain, this.maxMasterGain);

    this.binauralMixGain = this.audioContext.createGain();
    this.noiseMixGain = this.audioContext.createGain();
    this.atmosphereInput = this.audioContext.createGain();
    this.toneFilter = this.audioContext.createBiquadFilter();
    this.noiseFilter = this.audioContext.createBiquadFilter();
    this.sessionGain = this.audioContext.createGain();
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.masterGain = this.audioContext.createGain();
    this.analyser = this.audioContext.createAnalyser();

    this.toneFilter.type = "lowpass";
    this.noiseFilter.type = "lowpass";
    this.toneFilter.Q.value = 0.7;
    this.noiseFilter.Q.value = 0.7;

    this.toneFilter.frequency.value = FILTER_DEFAULTS.binauralCutoff;
    this.noiseFilter.frequency.value = FILTER_DEFAULTS.noiseCutoff;

    this.binauralMixGain.gain.value = getMaxBinauralMix(this.beatReferenceVolume);
    this.noiseMixGain.gain.value = 0.02;
    this.atmosphereInput.gain.value = 1;
    this.sessionGain.gain.value = this.minGain;
    this.masterGain.gain.value = this.masterVolumeTarget;

    this.compressor.threshold.value = -20;
    this.compressor.knee.value = COMPRESSOR_DEFAULTS.knee;
    this.compressor.ratio.value = 8;
    this.compressor.attack.value = COMPRESSOR_DEFAULTS.attack;
    this.compressor.release.value = COMPRESSOR_DEFAULTS.release;

    this.binauralMixGain.connect(this.toneFilter);
    this.noiseMixGain.connect(this.noiseFilter);
    this.atmosphereInput.connect(this.sessionGain);
    this.toneFilter.connect(this.sessionGain);
    this.noiseFilter.connect(this.sessionGain);
    this.sessionGain.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    this.tracks = new Map();
    this.currentWaveType = "sine";
    this.currentVibeName = "Alpha";
    this.currentBaseFrequency = 72;
    this.currentOffsetHz = 8;

    this.sweepTimeout = null;
    this.sweepActive = false;
    this.sweepDirection = 1;
    this.sweepLow = BINAURAL_SWEEP.low;
    this.sweepHigh = BINAURAL_SWEEP.high;
    this.sweepDurationSec = BINAURAL_SWEEP.durationSec;

    this.brownNoiseBuffer = this._createBrownianNoiseBuffer();
    this.brownNoiseSource = null;

    this.breathRate = 6;
    this.breathDepth = 0.012;
    this.lfoOsc = null;
    this.lfoGain = null;

    this.createTrack("main", {
      leftFrequency: 68,
      rightFrequency: 76,
      gain: 1,
      waveType: "sine",
    });

    this.setVibe(this.currentVibeName, 0);
  }

  createTrack(name, config = {}) {
    if (this.tracks.has(name)) {
      return this.tracks.get(name);
    }

    const leftOsc = this.audioContext.createOscillator();
    const rightOsc = this.audioContext.createOscillator();
    const channelMerger = this.audioContext.createChannelMerger(2);
    const trackGain = this.audioContext.createGain();

    const waveType = this._sanitizeWaveType(config.waveType || "sine");
    const leftFrequency = this._sanitizeFrequency(config.leftFrequency ?? 110);
    const rightFrequency = this._sanitizeFrequency(config.rightFrequency ?? 120);
    const gain = this._clamp(config.gain ?? 1, 0, 1);

    leftOsc.type = waveType;
    rightOsc.type = waveType;
    leftOsc.frequency.value = leftFrequency;
    rightOsc.frequency.value = rightFrequency;
    trackGain.gain.value = gain;

    leftOsc.connect(channelMerger, 0, 0);
    rightOsc.connect(channelMerger, 0, 1);
    channelMerger.connect(trackGain);
    trackGain.connect(this.binauralMixGain);

    const track = {
      name,
      leftOsc,
      rightOsc,
      channelMerger,
      trackGain,
      waveType,
      started: false,
    };

    this.tracks.set(name, track);
    return track;
  }

  async start() {
    this._ensureTrackSourcesStarted();
    this._ensureBrownNoiseStarted();
    this._ensureBreathLfoStarted();

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    this.isRunning = true;
    this._rampGain(this.masterGain.gain, this.masterVolumeTarget, AUDIO_RAMP.fast);
    this._rampGain(this.sessionGain.gain, this.transportTargetGain, AUDIO_RAMP.normal);
    this._updateSweepState();
  }

  async stop() {
    await this.stopAll(0.2);
  }

  async stopAll(fadeDuration = 0.4) {
    this.isRunning = false;
    this._stopCutoffSweep();

    const safeFade = this._clamp(Number(fadeDuration), 0.08, 4);
    this._rampGain(this.sessionGain.gain, 0, Math.min(AUDIO_RAMP.normal, safeFade));
    this._rampGain(this.masterGain.gain, 0, safeFade);

    window.setTimeout(async () => {
      if (this.audioContext.state === "running" && !this.isRunning) {
        await this.audioContext.suspend();
      }
    }, (safeFade + 0.08) * 1000);
  }

  setVibe(vibeName, transitionSeconds = 2.5) {
    const vibe = getVibe(vibeName);
    this.currentVibeName = vibeName;
    this.currentBaseFrequency = this._sanitizeFrequency(vibe.baseFrequency);

    if (!Number.isFinite(this.currentOffsetHz) || this.currentOffsetHz <= 0) {
      this.currentOffsetHz = this._sanitizeOffset(vibe.beatFrequency);
    }

    this._setMainByBaseAndOffset(this.currentBaseFrequency, this.currentOffsetHz, transitionSeconds);
    this._applyToneShaping(this.currentWaveType);
  }

  setPreset(presetName, transitionSeconds = 2.5) {
    this.setVibe(presetName, transitionSeconds);
  }

  setBinauralOffset(offsetHz, rampSeconds = 0.9) {
    this.currentOffsetHz = this._sanitizeOffset(offsetHz);
    this._setMainByBaseAndOffset(this.currentBaseFrequency, this.currentOffsetHz, rampSeconds);
  }

  setTrackFrequencies(name, leftFrequency, rightFrequency, rampSeconds = 1.8) {
    const track = this._getTrack(name);
    const left = this._sanitizeFrequency(leftFrequency);
    const right = this._sanitizeFrequency(rightFrequency);

    this._rampFrequencyLinear(track.leftOsc.frequency, left, rampSeconds);
    this._rampFrequencyLinear(track.rightOsc.frequency, right, rampSeconds);
  }

  setWaveType(waveType, trackName = null) {
    const safeType = this._sanitizeWaveType(waveType);
    this.currentWaveType = safeType;

    if (trackName) {
      const track = this._getTrack(trackName);
      track.waveType = safeType;
      track.leftOsc.type = safeType;
      track.rightOsc.type = safeType;
      this._updateSweepState();
      return;
    }

    this.tracks.forEach((track) => {
      track.waveType = safeType;
      track.leftOsc.type = safeType;
      track.rightOsc.type = safeType;
    });

    this._applyToneShaping(safeType);
    this._updateSweepState();
  }

  setBinauralMix(value, rampSeconds = 0.15) {
    const requested = this._clamp(Number(value), AUDIO_LIMITS.min, AUDIO_LIMITS.max);
    const cap = getMaxBinauralMix(this.beatReferenceVolume);
    const level = Math.min(requested, cap);
    this._rampGain(this.binauralMixGain.gain, level, rampSeconds);
  }

  setBeatReferenceVolume(value) {
    this.beatReferenceVolume = this._clamp(Number(value), AUDIO_LIMITS.min, AUDIO_LIMITS.max);
    this.setBinauralMix(this.binauralMixGain.gain.value, AUDIO_RAMP.fast);
  }

  setNoiseMix(value, rampSeconds = 0.15) {
    const level = this._clamp(Number(value), 0, AUDIO_LIMITS.maxNoiseMix);
    this._rampGain(this.noiseMixGain.gain, level, rampSeconds);
    this._updateSweepState();
  }

  setMasterGain(value, rampSeconds = 0.15) {
    this.setMasterVolume(value, rampSeconds);
  }

  setMasterVolume(value, rampSeconds = 0.15) {
    this.masterVolumeTarget = this._clamp(Number(value), this.minGain, this.maxMasterGain);
    this._rampGain(this.masterGain.gain, this.masterVolumeTarget, rampSeconds);
  }

  setBreathingRate(breathsPerMinute = 6) {
    this.breathRate = this._clamp(Number(breathsPerMinute), 3, 12);
    if (this.lfoOsc) {
      const hz = this.breathRate / 60;
      this._rampFrequencyLinear(this.lfoOsc.frequency, hz, 0.4);
    }
  }

  setBreathingDepth(depth = 0.02) {
    this.breathDepth = this._clamp(Number(depth), 0, 0.07);
    if (this.lfoGain) {
      this._rampGain(this.lfoGain.gain, this.breathDepth, 0.4);
    }
  }

  getAnalyserNode() {
    return this.analyser;
  }

  getAudioContext() {
    return this.audioContext;
  }

  getAtmosphereInputNode() {
    return this.atmosphereInput;
  }

  _setMainByBaseAndOffset(baseFrequency, offsetHz, rampSeconds) {
    const base = this._sanitizeFrequency(baseFrequency);
    const offset = this._sanitizeOffset(offsetHz);

    const half = offset / 2;
    const left = this._sanitizeFrequency(base - half);
    const right = this._sanitizeFrequency(base + half);

    this.currentBaseFrequency = (left + right) / 2;
    this.currentOffsetHz = right - left;

    this.setTrackFrequencies("main", left, right, rampSeconds);
  }

  _ensureTrackSourcesStarted() {
    this.tracks.forEach((track) => {
      if (track.started) {
        return;
      }

      track.leftOsc.start();
      track.rightOsc.start();
      track.started = true;
    });
  }

  _ensureBrownNoiseStarted() {
    if (this.brownNoiseSource) {
      return;
    }

    this.brownNoiseSource = this.audioContext.createBufferSource();
    this.brownNoiseSource.buffer = this.brownNoiseBuffer;
    this.brownNoiseSource.loop = true;
    this.brownNoiseSource.connect(this.noiseMixGain);
    this.brownNoiseSource.start();
  }

  _ensureBreathLfoStarted() {
    if (this.lfoOsc) {
      return;
    }

    this.lfoOsc = this.audioContext.createOscillator();
    this.lfoGain = this.audioContext.createGain();

    this.lfoOsc.type = "sine";
    this.lfoOsc.frequency.value = this.breathRate / 60;
    this.lfoGain.gain.value = this.breathDepth;

    this.lfoOsc.connect(this.lfoGain);
    this.lfoGain.connect(this.sessionGain.gain);
    this.lfoOsc.start();
  }

  _createBrownianNoiseBuffer() {
    const buffer = this.audioContext.createBuffer(
      2,
      this.audioContext.sampleRate * 2,
      this.audioContext.sampleRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const output = buffer.getChannelData(channel);
      let lastOut = 0;

      for (let i = 0; i < output.length; i += 1) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        output[i] = this._clamp(lastOut * 3.5, -1, 1);
      }
    }

    return buffer;
  }

  _updateSweepState() {
    const noiseLevel = this.noiseMixGain.gain.value;
    const requiresSweep = this.currentWaveType === "sawtooth" || noiseLevel > 0.03;

    if (requiresSweep && this.isRunning) {
      this._startCutoffSweep();
      return;
    }

    this._stopCutoffSweep();
    this._applyToneShaping(this.currentWaveType);
    this._rampFrequencyLinear(this.noiseFilter.frequency, FILTER_DEFAULTS.noiseCutoff, 0.8);
  }

  _startCutoffSweep() {
    if (this.sweepActive) {
      return;
    }

    this.sweepActive = true;
    this._runCutoffSweepStep();
  }

  _runCutoffSweepStep() {
    if (!this.sweepActive) {
      return;
    }

    const target = this.sweepDirection > 0 ? this.sweepHigh : this.sweepLow;

    this._rampFrequencyLinear(this.toneFilter.frequency, target, this.sweepDurationSec);
    this._rampFrequencyLinear(this.noiseFilter.frequency, target * 0.85, this.sweepDurationSec);

    this.sweepDirection *= -1;

    this.sweepTimeout = window.setTimeout(() => {
      this._runCutoffSweepStep();
    }, this.sweepDurationSec * 1000);
  }

  _stopCutoffSweep() {
    this.sweepActive = false;
    if (this.sweepTimeout) {
      clearTimeout(this.sweepTimeout);
      this.sweepTimeout = null;
    }
  }

  _applyToneShaping(waveType) {
    const target = BINAURAL_TONE_BY_WAVE[waveType] || BINAURAL_TONE_BY_WAVE.triangle;
    this._rampFrequencyLinear(this.toneFilter.frequency, target, 0.8);
  }

  _getTrack(name) {
    const track = this.tracks.get(name);
    if (!track) {
      throw new Error(`Track nao encontrada: ${name}`);
    }
    return track;
  }

  _sanitizeWaveType(type) {
    const validTypes = ["sine", "triangle", "square", "sawtooth"];
    if (!validTypes.includes(type)) {
      throw new Error(`Tipo de onda invalido: ${type}`);
    }
    return type;
  }

  _sanitizeOffset(value) {
    const safe = Number(value);
    if (Number.isNaN(safe) || safe <= 0) {
      return 8;
    }
    return this._clamp(safe, 0.5, 40);
  }

  _sanitizeFrequency(value) {
    const safeValue = Number(value);
    if (Number.isNaN(safeValue) || safeValue <= 0) {
      return 1;
    }
    return this._clamp(safeValue, 1, 18000);
  }

  _rampGain(audioParam, target, rampSeconds) {
    applyFade(this.audioContext, audioParam, target, rampSeconds, true, this.minGain);
  }

  _rampFrequencyLinear(audioParam, target, rampSeconds) {
    const now = this.audioContext.currentTime;
    const safeTarget = Math.max(target, 1);

    audioParam.cancelScheduledValues(now);
    audioParam.setValueAtTime(audioParam.value, now);
    audioParam.linearRampToValueAtTime(safeTarget, now + rampSeconds);
  }

  _clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
}

export { BinauralEngine };
