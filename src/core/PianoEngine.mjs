import { AUDIO_RAMP, GENERATIVE_CONFIG, applyFade, clamp, noteToFrequency } from "../config/audioConfig.mjs";

class PianoEngine {
  constructor(audioContext, destinationNode, options = {}) {
    this.audioContext = audioContext;
    this.destinationNode = destinationNode;
    this.minGain = 0.0001;

    this.outputGain = this.audioContext.createGain();
    this.outputGain.gain.value = this.minGain;

    this.reverbSend = this.audioContext.createGain();
    this.reverbSend.gain.value = 0.18;

    this.reverb = this.audioContext.createConvolver();
    this.reverb.buffer = this._createRoomImpulse(2.6, 2.4);

    this.reverbReturnGain = this.audioContext.createGain();
    this.reverbReturnGain.gain.value = 0.24;

    this.outputGain.connect(this.destinationNode);
    this.outputGain.connect(this.reverbSend);
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.reverbReturnGain);
    this.reverbReturnGain.connect(this.destinationNode);

    this.scales = options.scales || GENERATIVE_CONFIG.scales;
    this.scaleName = options.scaleName || "dreamy";
    this.activeScale = this.scales[this.scaleName] || this.scales.dreamy;

    this.probability = clamp(options.probability ?? GENERATIVE_CONFIG.piano.probability, 0, 1);
    this.humanization = clamp(options.humanization ?? GENERATIVE_CONFIG.piano.humanization, 0, 0.06);
    this.release = clamp(options.release ?? GENERATIVE_CONFIG.piano.release, 0.4, 4);
    this.timbre = "classico";
    this.onNote = null;

    this.attackNoiseBuffer = this._createWhiteNoiseBuffer(0.08);
    this.periodicWaves = {
      classico: this._createPeriodicWave([1, 0.62, 0.34, 0.22, 0.12, 0.08, 0.05]),
      nylon: this._createPeriodicWave([1, 0.52, 0.28, 0.12, 0.06, 0.04]),
      synth: this._createPeriodicWave([1, 0.78, 0.64, 0.49, 0.32, 0.2, 0.11]),
    };

    this.setTimbre(options.timbre ?? GENERATIVE_CONFIG.piano.timbre);
  }

  setProbability(value) {
    this.probability = clamp(value, 0, 1);
  }

  setScale(scaleName) {
    if (this.scales[scaleName]) {
      this.scaleName = scaleName;
      this.activeScale = this.scales[scaleName];
    }
  }

  setOutputLevel(level, rampSeconds = AUDIO_RAMP.normal) {
    const target = clamp(level, this.minGain, 1);
    applyFade(this.audioContext, this.outputGain.gain, target, rampSeconds, true, this.minGain);
  }

  setOnNote(callback) {
    this.onNote = typeof callback === "function" ? callback : null;
  }

  setTimbre(value) {
    const normalized = value === "digital" ? "nylon" : value;
    const allowed = ["classico", "nylon", "8bits", "synth"];
    this.timbre = allowed.includes(normalized) ? normalized : "classico";
  }

  playStep(time) {
    if (!this.activeScale || this.activeScale.length === 0) {
      return;
    }

    if (Math.random() > this.probability) {
      return;
    }

    const note = this.activeScale[Math.floor(Math.random() * this.activeScale.length)];
    const frequency = noteToFrequency(note);

    const start = Math.max(
      this.audioContext.currentTime,
      time + (Math.random() * 2 - 1) * this.humanization
    );

    const timbreSettings = this._getTimbreSettings(this.timbre);
    const attack = timbreSettings.attack;
    const decay = timbreSettings.decay;
    const sustainGain = timbreSettings.sustain;
    const sustainHold = 0.18 + Math.random() * 0.22;
    const release = timbreSettings.release ?? this.release;
    const endTime = start + attack + decay + sustainHold + release;

    const noteGain = this.audioContext.createGain();
    const noteFilter = this.audioContext.createBiquadFilter();
    const bodyFilter = this.audioContext.createBiquadFilter();
    const bodyGain = this.audioContext.createGain();

    noteFilter.type = "lowpass";
    noteFilter.frequency.setValueAtTime(
      timbreSettings.lowPassMin + Math.random() * timbreSettings.lowPassSpan,
      start
    );
    noteFilter.Q.setValueAtTime(
      timbreSettings.qMin + Math.random() * timbreSettings.qSpan,
      start
    );

    bodyFilter.type = "peaking";
    bodyFilter.frequency.setValueAtTime(timbreSettings.bodyFreq, start);
    bodyFilter.Q.setValueAtTime(timbreSettings.bodyQ, start);
    bodyFilter.gain.setValueAtTime(timbreSettings.bodyGainDb, start);

    bodyGain.gain.setValueAtTime(timbreSettings.bodyMix, start);

    noteGain.gain.setValueAtTime(this.minGain, start);
    noteGain.gain.linearRampToValueAtTime(timbreSettings.peak, start + attack);
    noteGain.gain.linearRampToValueAtTime(sustainGain, start + attack + decay);
    noteGain.gain.setValueAtTime(sustainGain, start + attack + decay + sustainHold);
    noteGain.gain.exponentialRampToValueAtTime(this.minGain, endTime);

    noteFilter.connect(noteGain);
    noteFilter.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(noteGain);
    noteGain.connect(this.outputGain);

    const rootFrequency = this.timbre === "8bits"
      ? Math.round(frequency / 4) * 4
      : frequency;

    const unisonCount = timbreSettings.unisonCount;
    for (let i = 0; i < unisonCount; i += 1) {
      const centered = i - (unisonCount - 1) / 2;
      const cents = centered * timbreSettings.unisonSpreadCents + (Math.random() * 2 - 1) * 0.45;
      const gain = timbreSettings.mainVoiceGain / unisonCount;
      this._spawnOscVoice({
        wave: timbreSettings.wave,
        periodicWave: timbreSettings.periodicWave,
        frequency: rootFrequency,
        detuneCents: cents,
        gain,
        start,
        endTime,
        destination: noteFilter,
      });
    }

    if (timbreSettings.inharmonicMix > 0) {
      const stiffRatio = 1 + timbreSettings.inharmonicity;
      this._spawnOscVoice({
        wave: "sine",
        periodicWave: null,
        frequency: rootFrequency * 2 * stiffRatio,
        detuneCents: (Math.random() * 2 - 1) * 4,
        gain: timbreSettings.inharmonicMix,
        start,
        endTime: start + attack + decay + sustainHold + release * 0.72,
        destination: noteFilter,
      });

      this._spawnOscVoice({
        wave: "sine",
        periodicWave: null,
        frequency: rootFrequency * 3 * (1 + timbreSettings.inharmonicity * 2.2),
        detuneCents: (Math.random() * 2 - 1) * 5,
        gain: timbreSettings.inharmonicMix * 0.56,
        start,
        endTime: start + attack + decay + sustainHold + release * 0.62,
        destination: noteFilter,
      });
    }

    if (timbreSettings.attackNoise > 0) {
      this._triggerAttackNoise(start, timbreSettings, noteGain);
    }

    if (this.onNote) {
      this.onNote({
        note,
        frequency,
        time: start,
        gain: sustainGain,
        timbre: this.timbre,
      });
    }
  }

  _spawnOscVoice(config) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = config.wave;
    if (config.periodicWave) {
      osc.setPeriodicWave(config.periodicWave);
    }

    osc.frequency.setValueAtTime(config.frequency, config.start);
    osc.detune.setValueAtTime(config.detuneCents, config.start);
    gain.gain.setValueAtTime(Math.max(this.minGain, config.gain), config.start);

    osc.connect(gain);
    gain.connect(config.destination);

    osc.start(config.start);
    osc.stop(config.endTime + 0.06);
  }

  _triggerAttackNoise(start, timbreSettings, destination) {
    const attackNoiseSource = this.audioContext.createBufferSource();
    const attackNoiseFilter = this.audioContext.createBiquadFilter();
    const attackNoiseGain = this.audioContext.createGain();

    attackNoiseSource.buffer = this.attackNoiseBuffer;
    attackNoiseFilter.type = "bandpass";
    attackNoiseFilter.frequency.setValueAtTime(timbreSettings.attackNoiseFreq, start);
    attackNoiseFilter.Q.setValueAtTime(timbreSettings.attackNoiseQ, start);

    attackNoiseGain.gain.setValueAtTime(this.minGain, start);
    attackNoiseGain.gain.linearRampToValueAtTime(timbreSettings.attackNoise, start + 0.003);
    attackNoiseGain.gain.exponentialRampToValueAtTime(this.minGain, start + timbreSettings.attackNoiseDecay);

    attackNoiseSource.connect(attackNoiseFilter);
    attackNoiseFilter.connect(attackNoiseGain);
    attackNoiseGain.connect(destination);

    attackNoiseSource.start(start);
    attackNoiseSource.stop(start + Math.max(0.05, timbreSettings.attackNoiseDecay + 0.02));
  }

  _getTimbreSettings(timbre) {
    if (timbre === "nylon") {
      this.reverbSend.gain.value = 0.09;
      this.reverbReturnGain.gain.value = 0.12;
      return {
        wave: "triangle",
        periodicWave: this.periodicWaves.nylon,
        attack: 0.018,
        decay: 0.22,
        sustain: 0.052,
        release: 1.1,
        peak: 0.24,
        lowPassMin: 1450,
        lowPassSpan: 950,
        qMin: 0.5,
        qSpan: 0.35,
        bodyFreq: 220,
        bodyQ: 1.2,
        bodyGainDb: 4.4,
        bodyMix: 0.34,
        mainVoiceGain: 0.9,
        unisonCount: 2,
        unisonSpreadCents: 2.8,
        inharmonicity: 0.00018,
        inharmonicMix: 0.052,
        attackNoise: 0.02,
        attackNoiseFreq: 2300,
        attackNoiseQ: 0.9,
        attackNoiseDecay: 0.04,
      };
    }

    if (timbre === "8bits") {
      this.reverbSend.gain.value = 0.03;
      this.reverbReturnGain.gain.value = 0.06;
      return {
        wave: "square",
        periodicWave: null,
        attack: 0.01,
        decay: 0.08,
        sustain: 0.05,
        release: 0.35,
        peak: 0.2,
        lowPassMin: 1400,
        lowPassSpan: 600,
        qMin: 0.4,
        qSpan: 0.4,
        bodyFreq: 440,
        bodyQ: 0.9,
        bodyGainDb: 1.2,
        bodyMix: 0.18,
        mainVoiceGain: 1,
        unisonCount: 1,
        unisonSpreadCents: 0,
        inharmonicity: 0,
        inharmonicMix: 0,
        attackNoise: 0,
        attackNoiseFreq: 2200,
        attackNoiseQ: 1,
        attackNoiseDecay: 0.03,
      };
    }

    if (timbre === "synth") {
      this.reverbSend.gain.value = 0.18;
      this.reverbReturnGain.gain.value = 0.24;
      return {
        wave: "sawtooth",
        periodicWave: this.periodicWaves.synth,
        attack: 0.065,
        decay: 0.24,
        sustain: 0.13,
        release: 1.8,
        peak: 0.33,
        lowPassMin: 1100,
        lowPassSpan: 1100,
        qMin: 1.05,
        qSpan: 0.8,
        bodyFreq: 360,
        bodyQ: 1.35,
        bodyGainDb: 3.1,
        bodyMix: 0.22,
        mainVoiceGain: 0.92,
        unisonCount: 2,
        unisonSpreadCents: 5.8,
        inharmonicity: 0.0001,
        inharmonicMix: 0.034,
        attackNoise: 0.004,
        attackNoiseFreq: 3200,
        attackNoiseQ: 1.4,
        attackNoiseDecay: 0.03,
      };
    }

    this.reverbSend.gain.value = 0.16;
    this.reverbReturnGain.gain.value = 0.22;
    return {
      wave: "triangle",
      periodicWave: this.periodicWaves.classico,
      attack: 0.028,
      decay: 0.24,
      sustain: 0.085,
      release: Math.max(1.4, this.release),
      peak: 0.3,
      lowPassMin: 1650,
      lowPassSpan: 850,
      qMin: 0.75,
      qSpan: 0.35,
      bodyFreq: 305,
      bodyQ: 1.25,
      bodyGainDb: 3.6,
      bodyMix: 0.31,
      mainVoiceGain: 0.94,
      unisonCount: 3,
      unisonSpreadCents: 2.1,
      inharmonicity: 0.00032,
      inharmonicMix: 0.08,
      attackNoise: 0.012,
      attackNoiseFreq: 2650,
      attackNoiseQ: 1.15,
      attackNoiseDecay: 0.036,
    };
  }

  _createPeriodicWave(harmonics) {
    const len = harmonics.length + 1;
    const real = new Float32Array(len);
    const imag = new Float32Array(len);

    for (let i = 1; i < len; i += 1) {
      imag[i] = harmonics[i - 1];
    }

    return this.audioContext.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  _createWhiteNoiseBuffer(seconds) {
    const length = Math.floor(this.audioContext.sampleRate * seconds);
    const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.8;
    }

    return buffer;
  }

  _createRoomImpulse(seconds, decay) {
    const length = Math.floor(this.audioContext.sampleRate * seconds);
    const buffer = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);

    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }

    return buffer;
  }
}

export { PianoEngine };
