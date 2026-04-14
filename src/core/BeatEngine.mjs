import { GENERATIVE_CONFIG, applyFade, clamp } from "../config/audioConfig.mjs";

class BeatEngine {
  constructor(audioContext, destinationNode, options = {}) {
    this.audioContext = audioContext;
    this.destinationNode = destinationNode;
    this.minGain = 0.0001;

    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.minGain;

    this.lowPass = this.audioContext.createBiquadFilter();
    this.lowPass.type = "lowpass";
    this.lowPass.frequency.value = options.lowPassHz ?? GENERATIVE_CONFIG.beat.lowPassHz;
    this.lowPass.Q.value = 0.85;

    this.masterGain.connect(this.lowPass);
    this.lowPass.connect(this.destinationNode);

    this.patterns = {
      kick: [...GENERATIVE_CONFIG.beat.patterns.kick],
      snare: [...GENERATIVE_CONFIG.beat.patterns.snare],
      hat: [...GENERATIVE_CONFIG.beat.patterns.hat],
    };

    this.bpm = options.bpm ?? GENERATIVE_CONFIG.bpm;
    this.swing = options.swing ?? GENERATIVE_CONFIG.beat.swing;
    this.grooveEnabled = false;
    this.stepIndex = 0;
    this.nextStepTime = 0;
    this.schedulerInterval = null;
    this.running = false;

    this.kickBuffer = null;
    this.snareBuffer = null;
    this.hatBuffer = null;

    this.volume = clamp(options.volume ?? 0.82, 0, 1);
    this._setVolumeImmediate(this.volume);

    this.samplePaths = options.samplePaths || {
      kick: "./assets/samples/kick.wav",
      snare: "./assets/samples/snare.wav",
      hat: "./assets/samples/hat.wav",
    };

    this.onStep = null;
  }

  async init() {
    const [kick, snare, hat] = await Promise.all([
      this._loadSample(this.samplePaths.kick).catch(() => this._createKickBuffer()),
      this._loadSample(this.samplePaths.snare).catch(() => this._createSnareBuffer()),
      this._loadSample(this.samplePaths.hat).catch(() => this._createHatBuffer()),
    ]);

    this.kickBuffer = kick;
    this.snareBuffer = snare;
    this.hatBuffer = hat;
  }

  start() {
    if (this.running) {
      return;
    }

    if (!this.kickBuffer || !this.snareBuffer || !this.hatBuffer) {
      this.kickBuffer = this.kickBuffer || this._createKickBuffer();
      this.snareBuffer = this.snareBuffer || this._createSnareBuffer();
      this.hatBuffer = this.hatBuffer || this._createHatBuffer();
    }

    this.running = true;
    this.stepIndex = 0;
    this.nextStepTime = this.audioContext.currentTime + 0.06;

    this.schedulerInterval = window.setInterval(() => {
      this._scheduleLoop();
    }, 25);
  }

  stop() {
    this.running = false;

    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  setBpm(bpm) {
    this.bpm = clamp(Number(bpm), 40, 180);
  }

  setSwing(amount) {
    this.swing = clamp(Number(amount), 0, 0.06);
  }

  setGrooveEnabled(enabled) {
    this.grooveEnabled = Boolean(enabled);
  }

  setLowPassHz(value) {
    const target = clamp(Number(value), 900, 3000);
    const now = this.audioContext.currentTime;
    this.lowPass.frequency.cancelScheduledValues(now);
    this.lowPass.frequency.setValueAtTime(this.lowPass.frequency.value, now);
    this.lowPass.frequency.linearRampToValueAtTime(target, now + 0.35);
  }

  setVolume(value, rampSeconds = 0.25) {
    this.volume = clamp(Number(value), 0, 1);
    const target = clamp(this.volume, this.minGain, 1);
    applyFade(this.audioContext, this.masterGain.gain, target, rampSeconds, true, this.minGain);
  }

  setPatterns(patterns = {}) {
    if (Array.isArray(patterns.kick) && patterns.kick.length === 8) {
      this.patterns.kick = patterns.kick.map((step) => (step ? 1 : 0));
    }
    if (Array.isArray(patterns.snare) && patterns.snare.length === 8) {
      this.patterns.snare = patterns.snare.map((step) => (step ? 1 : 0));
    }
    if (Array.isArray(patterns.hat) && patterns.hat.length === 8) {
      this.patterns.hat = patterns.hat.map((step) => (step ? 1 : 0));
    }
  }

  setOnStep(callback) {
    this.onStep = typeof callback === "function" ? callback : null;
  }

  _scheduleLoop() {
    const ahead = 0.14;
    while (this.nextStepTime < this.audioContext.currentTime + ahead) {
      this._scheduleStep(this.stepIndex, this.nextStepTime);
      this._advanceStep();
    }
  }

  _scheduleStep(step, time) {
    const kickHit = this.patterns.kick[step] === 1;
    const snareHit = this.patterns.snare[step] === 1;
    const hatHit = this.patterns.hat[step] === 1;

    const groovePull = this.grooveEnabled && step % 2 === 1 ? 0.008 : 0;
    const groovePush = this.grooveEnabled && step % 4 === 2 ? -0.004 : 0;
    const swungTime = time + groovePull + groovePush;

    if (kickHit) {
      this._trigger(this.kickBuffer, swungTime, this.grooveEnabled ? 0.92 : 0.88, 0.36);
    }

    if (snareHit) {
      this._trigger(this.snareBuffer, swungTime, this.grooveEnabled ? 0.58 : 0.5, 0.24);
    }

    if (hatHit) {
      const hatTime = step % 2 === 1 ? swungTime + this.swing : swungTime;
      const hatVelocity = this.grooveEnabled
        ? (step % 2 === 1 ? 0.31 : 0.2)
        : 0.22;
      this._trigger(this.hatBuffer, hatTime, hatVelocity, 0.1);
    }

    if (this.onStep) {
      this.onStep({ step, time, kickHit, snareHit, hatHit });
    }
  }

  _advanceStep() {
    const stepDuration = (60 / this.bpm) / 2;
    this.nextStepTime += stepDuration;
    this.stepIndex = (this.stepIndex + 1) % 8;
  }

  _trigger(buffer, time, velocity, decay) {
    if (!buffer) {
      return;
    }

    const source = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();

    source.buffer = buffer;

    const safeVelocity = clamp(velocity, 0.01, 1);
    gain.gain.setValueAtTime(this.minGain, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(this.minGain, safeVelocity), time + 0.002);
    gain.gain.exponentialRampToValueAtTime(this.minGain, time + decay);

    source.connect(gain);
    gain.connect(this.masterGain);

    source.start(time);
    source.stop(time + Math.max(buffer.duration + 0.03, decay + 0.08));
  }

  _setVolumeImmediate(value) {
    this.masterGain.gain.value = clamp(value, this.minGain, 1);
  }

  async _loadSample(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Sample not found: ${path}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return await this.audioContext.decodeAudioData(arrayBuffer);
  }

  _createKickBuffer() {
    const duration = 0.48;
    const length = Math.floor(this.audioContext.sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / this.audioContext.sampleRate;
      const sweep = 96 * Math.exp(-t * 14) + 42;
      const envelope = Math.exp(-t * 10.5);
      data[i] = Math.sin(2 * Math.PI * sweep * t) * envelope * 1.6;
    }

    return buffer;
  }

  _createSnareBuffer() {
    const duration = 0.22;
    const length = Math.floor(this.audioContext.sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / this.audioContext.sampleRate;
      const noise = (Math.random() * 2 - 1) * Math.exp(-t * 20);
      const tone = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 16) * 0.35;
      data[i] = (noise + tone) * 0.95;
    }

    return buffer;
  }

  _createHatBuffer() {
    const duration = 0.09;
    const length = Math.floor(this.audioContext.sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / this.audioContext.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 42);
    }

    return buffer;
  }
}

export { BeatEngine };

