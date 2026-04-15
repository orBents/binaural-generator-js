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
    this.shuffle = clamp(options.shuffle ?? 0.54, 0.5, 0.66);
    this.laidBack = clamp(options.laidBack ?? 0.004, 0, 0.02);
    this.grooveEnabled = false;
    this.kickBody = clamp(options.kickBody ?? 0.6, 0, 1);
    this.snareClap = clamp(options.snareClap ?? 0.25, 0, 1);
    this.hatMotion = options.hatMotion === "eighth" ? "eighth" : "sixteenth";
    this.bassMode = ["off", "warm", "heavy"].includes(options.bassMode) ? options.bassMode : "warm";
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
    this.swing = clamp(Number(amount), 0, 0.08);
  }

  setShuffle(amount) {
    this.shuffle = clamp(Number(amount), 0.5, 0.66);
  }

  setLaidBack(amount) {
    this.laidBack = clamp(Number(amount), 0, 0.02);
  }

  setGrooveEnabled(enabled) {
    this.grooveEnabled = Boolean(enabled);
  }

  setKickBody(value) {
    this.kickBody = clamp(Number(value), 0, 1);
  }

  setSnareClap(value) {
    this.snareClap = clamp(Number(value), 0, 1);
  }

  setHatMotion(value) {
    this.hatMotion = value === "eighth" ? "eighth" : "sixteenth";
  }

  setBassMode(mode) {
    this.bassMode = ["off", "warm", "heavy"].includes(mode) ? mode : "warm";
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
    const ahead = 0.16;
    while (this.nextStepTime < this.audioContext.currentTime + ahead) {
      this._scheduleStep(this.stepIndex, this.nextStepTime);
      this._advanceStep();
    }
  }

  _scheduleStep(step, time) {
    const kickHit = this.patterns.kick[step] === 1;
    const snareHit = this.patterns.snare[step] === 1;
    const hatHit = this.patterns.hat[step] === 1;

    const stepDuration = (60 / this.bpm) / 2;
    const isOffBeat = step % 2 === 1;
    const shuffleOffset = isOffBeat ? (this.shuffle - 0.5) * stepDuration : 0;
    const laidBackOffset = this.grooveEnabled ? this.laidBack : 0;
    const microJitter = this.grooveEnabled ? (Math.random() * 2 - 1) * 0.0032 : 0;
    const swungTime = time + shuffleOffset + laidBackOffset + microJitter;

    if (kickHit) {
      const kickWeight = 0.56 + this.kickBody * 0.26;
      const kickVel = this.grooveEnabled ? (step === 0 ? kickWeight + 0.04 : kickWeight - 0.08) : kickWeight;
      this._trigger(this.kickBuffer, swungTime, kickVel, 0.44 + this.kickBody * 0.18);
      this._triggerKickBass(swungTime, step === 0);
    }

    if (snareHit) {
      const snareTime = swungTime + (this.grooveEnabled ? 0.003 : 0);
      const snareVelocity = this.grooveEnabled ? 0.42 : 0.36;
      this._trigger(this.snareBuffer, snareTime, snareVelocity, 0.24);
      if (this.snareClap > 0.02) {
        const clapDelay = 0.006 + this.snareClap * 0.009;
        const clapVelocity = snareVelocity * (0.22 + this.snareClap * 0.5);
        this._trigger(this.snareBuffer, snareTime + clapDelay, clapVelocity, 0.1);
      }
    }

    if (hatHit) {
      const hatTime = isOffBeat ? swungTime + this.swing : swungTime;
      const hatVelocity = this.grooveEnabled
        ? (isOffBeat ? 0.22 : 0.14)
        : 0.16;
      this._trigger(this.hatBuffer, hatTime, hatVelocity, 0.12);

      if (this.hatMotion === "sixteenth" && Math.random() > 0.22) {
        const ghostOffset = stepDuration * (0.14 + Math.random() * 0.08);
        const ghostVel = hatVelocity * (0.45 + Math.random() * 0.25);
        this._trigger(this.hatBuffer, hatTime + ghostOffset, ghostVel, 0.08);
      }
    }

    if (this.onStep) {
      this.onStep({ step, time: swungTime, kickHit, snareHit, hatHit });
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
    const duration = 0.64;
    const length = Math.floor(this.audioContext.sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / this.audioContext.sampleRate;
      const sweep = 92 * Math.exp(-t * 8.8) + 46;
      const envelope = Math.exp(-t * 8.2);
      const softClip = Math.tanh(Math.sin(2 * Math.PI * sweep * t) * 1.4);
      data[i] = softClip * envelope * 1.2;
    }

    return buffer;
  }

  _triggerKickBass(time, isDownBeat) {
    if (this.bassMode === "off") {
      return;
    }

    const depth = this.bassMode === "heavy" ? 1 : 0.58;
    const freq = this.bassMode === "heavy" ? 47 : 58;
    const dur = this.bassMode === "heavy" ? 0.22 : 0.15;
    const gainAmount = (isDownBeat ? 0.12 : 0.08) * depth;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(28, freq * 0.62), time + dur);

    gain.gain.setValueAtTime(this.minGain, time);
    gain.gain.exponentialRampToValueAtTime(gainAmount, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(this.minGain, time + dur);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + dur + 0.03);
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
    const duration = 0.11;
    const length = Math.floor(this.audioContext.sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / this.audioContext.sampleRate;
      const shimmer = Math.sin(2 * Math.PI * 6900 * t) * 0.18;
      const noise = (Math.random() * 2 - 1) * Math.exp(-t * 34);
      data[i] = (noise + shimmer) * Math.exp(-t * 26) * 0.68;
    }

    return buffer;
  }
}

export { BeatEngine };
