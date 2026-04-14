class LofiEngine {
  constructor(audioContext, destinationNode, options = {}) {
    this.audioContext = audioContext;
    this.destinationNode = destinationNode;

    this.minGain = 0.0001;

    this.masterGain = this.audioContext.createGain();
    this.volumeGain = this.audioContext.createGain();
    this.beatBusGain = this.audioContext.createGain();
    this.beatLowPass = this.audioContext.createBiquadFilter();

    this.reverbSendGain = this.audioContext.createGain();
    this.reverb = this.audioContext.createConvolver();
    this.reverbReturnGain = this.audioContext.createGain();

    this.crackleGain = this.audioContext.createGain();
    this.crackleHighPass = this.audioContext.createBiquadFilter();
    this.crackleLowPass = this.audioContext.createBiquadFilter();

    this.masterGain.gain.value = this.minGain;
    this.volumeGain.gain.value = 0.92;
    this.beatBusGain.gain.value = 1.15;
    this.reverbSendGain.gain.value = 0.08;
    this.reverbReturnGain.gain.value = 0.16;
    this.crackleGain.gain.value = this.minGain;

    this.beatLowPass.type = "lowpass";
    this.beatLowPass.frequency.value = 1500;
    this.beatLowPass.Q.value = 0.9;

    this.crackleHighPass.type = "highpass";
    this.crackleHighPass.frequency.value = 1700;
    this.crackleLowPass.type = "lowpass";
    this.crackleLowPass.frequency.value = 3400;

    this.reverb.buffer = this._createImpulseBuffer(2.4, 2.2);

    this.beatBusGain.connect(this.beatLowPass);
    this.beatLowPass.connect(this.volumeGain);

    this.beatBusGain.connect(this.reverbSendGain);
    this.reverbSendGain.connect(this.reverb);
    this.reverb.connect(this.reverbReturnGain);
    this.reverbReturnGain.connect(this.volumeGain);

    this.crackleGain.connect(this.crackleHighPass);
    this.crackleHighPass.connect(this.crackleLowPass);
    this.crackleLowPass.connect(this.volumeGain);

    this.volumeGain.connect(this.masterGain);
    this.masterGain.connect(this.destinationNode);

    this.kickBuffer = this._createKickBuffer();
    this.subKickBuffer = this._createDeepKickBuffer();
    this.rimBuffer = this._createRimBuffer();
    this.hatBuffer = this._createHatBuffer();
    this.crackleBuffer = this._createWhiteNoiseBuffer(2.8);

    this.intensity = this._clamp(options.intensity ?? 0.62, 0, 1);
    this.volume = this._clamp(options.volume ?? 0.82, 0, 1);
    this.vinylEnabled = Boolean(options.vinylEnabled);
    this.grooveEnabled = false;

    this.mode = "soft";
    this.bpm = 78;
    this.swingAmount = 0;

    this.stepIndex = 0;
    this.nextStepTime = 0;
    this.schedulerInterval = null;
    this.crackleInterval = null;
    this.crackleSource = null;
    this.running = false;

    this.modeConfig = {
      soft: {
        bpm: 78,
        lowPass: 1400,
        lowPassQ: 0.95,
        reverbSend: 0.08,
        swing: 0,
      },
      jazzy: {
        bpm: 82,
        lowPass: 1600,
        lowPassQ: 1.2,
        reverbSend: 0.12,
        swing: 0.02,
      },
      deep: {
        bpm: 70,
        lowPass: 950,
        lowPassQ: 0.75,
        reverbSend: 0.35,
        swing: 0,
      },
      space: {
        bpm: 80,
        lowPass: 1750,
        lowPassQ: 2.2,
        reverbSend: 0.2,
        swing: 0.008,
      },
    };

    this.setMode(this.mode, { immediate: true });
    this.setIntensity(this.intensity);
    this.setVolume(this.volume, 0);
    this.setVinylEnabled(this.vinylEnabled);
  }

  async start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this._ensureCrackleSourceStarted();

    this.stepIndex = 0;
    this.nextStepTime = this.audioContext.currentTime + 0.05;

    this.schedulerInterval = window.setInterval(() => {
      this._scheduleLoop();
    }, 25);

    if (this.vinylEnabled) {
      this._startCrackleAutomation();
    }

    const now = this.audioContext.currentTime;
    const target = this._intensityToMaster(this.intensity);
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.minGain, now);
    this.masterGain.gain.linearRampToValueAtTime(target, now + 3);
  }

  stop() {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }

    this._stopCrackleAutomation();

    const now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(this.masterGain.gain.value, this.minGain), now);
    this.masterGain.gain.linearRampToValueAtTime(this.minGain, now + 0.8);
  }

  setIntensity(value) {
    this.intensity = this._clamp(Number(value), 0, 1);
    this._applyBeatDynamics(0.25);
    this._applyCrackleBase(0.2);
  }

  setVolume(value, rampSeconds = 0.2) {
    this.volume = this._clamp(Number(value), 0, 1);
    const now = this.audioContext.currentTime;
    const target = this._clamp(this.volume, this.minGain, 1);

    this.volumeGain.gain.cancelScheduledValues(now);
    this.volumeGain.gain.setValueAtTime(Math.max(this.volumeGain.gain.value, this.minGain), now);
    this.volumeGain.gain.linearRampToValueAtTime(target, now + rampSeconds);
  }

  setVinylEnabled(enabled) {
    this.vinylEnabled = Boolean(enabled);

    if (!this.running) {
      this._applyCrackleBase(0.15);
      return;
    }

    if (this.vinylEnabled) {
      this._startCrackleAutomation();
    } else {
      this._stopCrackleAutomation();
      this._applyCrackleBase(0.15);
    }
  }

  setGrooveEnabled(enabled) {
    this.grooveEnabled = Boolean(enabled);
  }

  setMode(mode, options = {}) {
    if (!this.modeConfig[mode]) {
      return;
    }

    const immediate = Boolean(options.immediate);
    this.mode = mode;

    const config = this.modeConfig[mode];
    this.bpm = config.bpm;
    this.swingAmount = config.swing;

    const now = this.audioContext.currentTime;
    const rampDownEnd = now + (immediate ? 0 : 0.12);
    const rampUpEnd = now + (immediate ? 0.01 : 0.45);
    const targetBeat = this._intensityToHit(this.intensity);

    this.beatBusGain.gain.cancelScheduledValues(now);
    this.beatBusGain.gain.setValueAtTime(Math.max(this.beatBusGain.gain.value, this.minGain), now);
    this.beatBusGain.gain.linearRampToValueAtTime(this.minGain, rampDownEnd);
    this.beatBusGain.gain.linearRampToValueAtTime(Math.max(targetBeat, this.minGain), rampUpEnd);

    this.beatLowPass.frequency.cancelScheduledValues(now);
    this.beatLowPass.frequency.setValueAtTime(this.beatLowPass.frequency.value, now);
    this.beatLowPass.frequency.linearRampToValueAtTime(config.lowPass, now + 0.35);

    this.beatLowPass.Q.cancelScheduledValues(now);
    this.beatLowPass.Q.setValueAtTime(this.beatLowPass.Q.value, now);
    this.beatLowPass.Q.linearRampToValueAtTime(config.lowPassQ, now + 0.35);

    this.reverbSendGain.gain.cancelScheduledValues(now);
    this.reverbSendGain.gain.setValueAtTime(this.reverbSendGain.gain.value, now);
    this.reverbSendGain.gain.linearRampToValueAtTime(config.reverbSend, now + 0.35);
  }

  _scheduleLoop() {
    const scheduleAheadTime = 0.14;

    while (this.nextStepTime < this.audioContext.currentTime + scheduleAheadTime) {
      this._scheduleStep(this.stepIndex, this.nextStepTime);
      this._advanceStep();
    }
  }

  _scheduleStep(step, baseTime) {
    const time = this._applyTimingFeel(step, baseTime);

    if (this.mode === "soft") {
      this._scheduleSoft(step, time);
      return;
    }

    if (this.mode === "jazzy") {
      this._scheduleJazzy(step, time);
      return;
    }

    if (this.mode === "deep") {
      this._scheduleDeep(step, time);
      return;
    }

    this._scheduleSpace(step, time);
  }

  _scheduleSoft(step, time) {
    if (step === 0 || step === 8) {
      this._triggerBuffer(this.kickBuffer, time, 0.78);
    }

    if (step === 4 || step === 12) {
      this._triggerBuffer(this.rimBuffer, time, 0.45);
    }
  }

  _scheduleJazzy(step, time) {
    const human = 0.82 + (Math.random() * 0.35);

    if (step === 0 || step === 8) {
      this._triggerBuffer(this.kickBuffer, time, 0.7 * human);
    }

    if (step === 4 || step === 12) {
      this._triggerBuffer(this.rimBuffer, time + (Math.random() - 0.5) * 0.008, 0.42 * human);
    }

    if ((step === 3 || step === 11 || step === 14) && Math.random() > 0.46) {
      this._triggerBuffer(this.rimBuffer, time, 0.2 + Math.random() * 0.12);
    }
  }

  _scheduleDeep(step, time) {
    if (step === 0 || step === 8) {
      this._triggerBuffer(this.subKickBuffer, time, 0.9, 0.8);
    }

    if (step === 12 && Math.random() > 0.7) {
      this._triggerBuffer(this.subKickBuffer, time, 0.42, 0.7);
    }
  }

  _scheduleSpace(step, time) {
    if (step === 0 || step === 8) {
      this._triggerBuffer(this.kickBuffer, time, 0.66);
    }

    if (step === 12) {
      this._triggerBuffer(this.rimBuffer, time, 0.36);
    }

    if (step % 4 === 0) {
      const beatDuration = 60 / this.bpm;
      const triplet = beatDuration / 3;

      for (let i = 0; i < 3; i += 1) {
        const offset = i * triplet;
        const vel = 0.16 + (i === 2 ? 0.05 : 0);
        this._triggerBuffer(this.hatBuffer, time + offset, vel, 0.08);
      }
    }
  }

  _advanceStep() {
    const stepDuration = (60 / this.bpm) / 4;
    this.nextStepTime += stepDuration;
    this.stepIndex = (this.stepIndex + 1) % 16;
  }

  _applyTimingFeel(step, time) {
    let shifted = time;

    if (this.mode === "jazzy" || this.mode === "space") {
      if (step % 2 === 1) {
        shifted += this.swingAmount;
      }
    }

    if (this.grooveEnabled) {
      if (step === 3 || step === 11) {
        shifted += 0.012;
      }
      if (step === 6 || step === 14) {
        shifted -= 0.007;
      }
    }

    return Math.max(this.audioContext.currentTime, shifted);
  }

  _triggerBuffer(buffer, time, velocity, decay = 0.22) {
    const source = this.audioContext.createBufferSource();
    const hitGain = this.audioContext.createGain();

    source.buffer = buffer;

    const safeVelocity = this._clamp(velocity, 0.01, 1);
    const scaled = safeVelocity * this._intensityToHit(this.intensity);

    hitGain.gain.setValueAtTime(this.minGain, time);
    hitGain.gain.linearRampToValueAtTime(Math.max(scaled, this.minGain), time + 0.003);
    hitGain.gain.exponentialRampToValueAtTime(this.minGain, time + decay);

    source.connect(hitGain);
    hitGain.connect(this.beatBusGain);

    source.start(time);
    source.stop(time + Math.max(decay + 0.08, buffer.duration + 0.04));
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
      const base = this._intensityToCrackle(this.intensity) * 0.16;
      const peak = base + (Math.random() * base * 1.05);
      const hold = 0.04 + Math.random() * 0.06;

      this.crackleGain.gain.cancelScheduledValues(now);
      this.crackleGain.gain.setValueAtTime(Math.max(base, this.minGain), now);
      this.crackleGain.gain.linearRampToValueAtTime(Math.max(peak, this.minGain), now + 0.014);
      this.crackleGain.gain.linearRampToValueAtTime(Math.max(base, this.minGain), now + hold);
    }, 120);
  }

  _stopCrackleAutomation() {
    if (this.crackleInterval) {
      clearInterval(this.crackleInterval);
      this.crackleInterval = null;
    }
  }

  _applyBeatDynamics(rampSeconds = 0.2) {
    const now = this.audioContext.currentTime;
    const beatTarget = this._intensityToHit(this.intensity);

    this.beatBusGain.gain.cancelScheduledValues(now);
    this.beatBusGain.gain.setValueAtTime(Math.max(this.beatBusGain.gain.value, this.minGain), now);
    this.beatBusGain.gain.linearRampToValueAtTime(Math.max(beatTarget, this.minGain), now + rampSeconds);

    if (this.running) {
      const masterTarget = this._intensityToMaster(this.intensity);
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(Math.max(this.masterGain.gain.value, this.minGain), now);
      this.masterGain.gain.linearRampToValueAtTime(Math.max(masterTarget, this.minGain), now + rampSeconds);
    }
  }

  _applyCrackleBase(rampSeconds = 0.2) {
    const now = this.audioContext.currentTime;
    const baseTarget = this.vinylEnabled ? this._intensityToCrackle(this.intensity) : this.minGain;

    this.crackleGain.gain.cancelScheduledValues(now);
    this.crackleGain.gain.setValueAtTime(Math.max(this.crackleGain.gain.value, this.minGain), now);
    this.crackleGain.gain.linearRampToValueAtTime(Math.max(baseTarget, this.minGain), now + rampSeconds);
  }

  _createKickBuffer() {
    const duration = 0.48;
    const length = Math.floor(this.audioContext.sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / this.audioContext.sampleRate;
      const sweep = 92 * Math.exp(-t * 15) + 44;
      const envelope = Math.exp(-t * 10.5);
      data[i] = Math.sin(2 * Math.PI * sweep * t) * envelope;
    }

    return buffer;
  }

  _createDeepKickBuffer() {
    const duration = 1.1;
    const length = Math.floor(this.audioContext.sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / this.audioContext.sampleRate;
      const sweep = 55 * Math.exp(-t * 7) + 28;
      const envelope = Math.exp(-t * 4.6);
      data[i] = Math.sin(2 * Math.PI * sweep * t) * envelope;
    }

    return buffer;
  }

  _createRimBuffer() {
    const duration = 0.2;
    const length = Math.floor(this.audioContext.sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / this.audioContext.sampleRate;
      const envelope = Math.exp(-t * 24);
      const noise = (Math.random() * 2 - 1) * 0.55;
      const tone = Math.sin(2 * Math.PI * 210 * t) * 0.24;
      data[i] = (noise + tone) * envelope;
    }

    return buffer;
  }

  _createHatBuffer() {
    const duration = 0.08;
    const length = Math.floor(this.audioContext.sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / this.audioContext.sampleRate;
      const envelope = Math.exp(-t * 46);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    return buffer;
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

  _createImpulseBuffer(seconds, decay) {
    const length = Math.floor(this.audioContext.sampleRate * seconds);
    const buffer = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }

    return buffer;
  }

  _intensityToMaster(intensity) {
    return this._clamp(0.08 + intensity * 0.34, this.minGain, 0.52);
  }

  _intensityToHit(intensity) {
    return this._clamp(0.16 + intensity * 0.34, this.minGain, 0.56);
  }

  _intensityToCrackle(intensity) {
    return this._clamp(0.0012 + intensity * 0.012, this.minGain, 0.02);
  }

  _clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
}

export { LofiEngine };
