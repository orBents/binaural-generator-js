import { AUDIO_RAMP, GENERATIVE_CONFIG, applyFade, clamp } from "../config/audioConfig.mjs";

class PianoEngine {
  constructor(audioContext, destinationNode, options = {}) {
    this.audioContext = audioContext;
    this.destinationNode = destinationNode;
    this.minGain = 0.0001;

    this.outputGain = this.audioContext.createGain();
    this.outputGain.gain.value = this.minGain;
    this.colorFilter = this.audioContext.createBiquadFilter();
    this.warmthShaper = this.audioContext.createWaveShaper();

    this.reverbSend = this.audioContext.createGain();
    this.reverbSend.gain.value = 0.18;

    this.reverb = this.audioContext.createConvolver();
    this.reverb.buffer = this._createRoomImpulse(2.6, 2.4);

    this.reverbReturnGain = this.audioContext.createGain();
    this.reverbReturnGain.gain.value = 0.24;

    this.colorFilter.type = "lowpass";
    this.colorFilter.frequency.value = 1900;
    this.colorFilter.Q.value = 1.1;

    this.outputGain.connect(this.colorFilter);
    this.colorFilter.connect(this.warmthShaper);
    this.warmthShaper.connect(this.destinationNode);
    this.warmthShaper.connect(this.reverbSend);
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.reverbReturnGain);
    this.reverbReturnGain.connect(this.destinationNode);

    this.scales = options.scales || GENERATIVE_CONFIG.scales;
    this.scaleName = options.scaleName || "dorian";
    this.activeScale = this.scales[this.scaleName] || this.scales.dorian;
    this.bpm = clamp(options.bpm ?? GENERATIVE_CONFIG.bpm, 48, 120);

    this.probability = clamp(options.probability ?? GENERATIVE_CONFIG.piano.probability, 0, 1);
    this.humanization = clamp(options.humanization ?? GENERATIVE_CONFIG.piano.humanization, 0, 0.06);
    this.release = clamp(options.release ?? GENERATIVE_CONFIG.piano.release, 0.4, 4);
    this.timbre = "rhodes";
    this.pedalEnabled = false;
    this.subOctaveEnabled = false;
    this.resonance = 0.45;
    this.warmth = 0.28;
    this.space = 0.35;
    this.wowFlutter = clamp(options.wowFlutter ?? 0.35, 0, 1);
    this.tapeWear = clamp(options.tapeWear ?? 0.22, 0, 1);
    this.onNote = null;

    this.attackNoiseBuffer = this._createWhiteNoiseBuffer(0.08);
    this.periodicWaves = {
      rhodes: this._createPeriodicWave([1, 0.58, 0.3, 0.2, 0.12, 0.06, 0.04]),
      chords: this._createPeriodicWave([1, 0.66, 0.36, 0.2, 0.1, 0.06]),
    };

    this.stepsPerBar = 8;
    this.currentBar = -1;
    this.currentChordKey = "i";
    this.lastPhraseDirection = 1;
    this.harmonicMode = "dorian";
    this.progressionMotion = "fourths";
    this.activeVoices = new Set();

    this.modeProfiles = {
      dorian: {
        progression: ["i", "iv", "bVII", "i", "v", "iv", "bVII", "i"],
        formulas: {
          i: [0, 3, 7, 10, 14],
          iv: [5, 8, 12, 15, 19],
          v: [7, 10, 14, 17],
          bVII: [10, 14, 17, 21],
        },
      },
      lydian: {
        progression: ["I", "II", "V", "I", "VII", "II", "V", "I"],
        formulas: {
          I: [0, 4, 7, 11, 14],
          II: [2, 6, 9, 13],
          V: [7, 11, 14, 18],
          VII: [11, 14, 18, 21],
        },
      },
    };
    this.progression = this.modeProfiles.dorian.progression;

    this.setTimbre(options.timbre ?? GENERATIVE_CONFIG.piano.timbre);
    this.setHarmonicMode(options.harmonicMode ?? "dorian");
    this.setProgressionMotion(options.progressionMotion ?? "fourths");
    this.setToneCutoff(options.toneCutoff ?? 1200);
    this.setWowFlutter(options.wowFlutter ?? this.wowFlutter);
    this.setResonance(options.resonance ?? this.resonance);
    this.setWarmth(options.warmth ?? this.warmth);
    this.setSpace(options.space ?? this.space);
    this.setTapeWear(options.tapeWear ?? this.tapeWear);
  }

  setProbability(value) {
    this.probability = clamp(value, 0, 1);
  }

  setScale(scaleName) {
    if (this.scales[scaleName]) {
      this.scaleName = scaleName;
      this.activeScale = this.scales[scaleName];
      this.currentBar = -1;
    }
  }

  setBpm(value) {
    this.bpm = clamp(Number(value), 48, 120);
  }

  setOutputLevel(level, rampSeconds = AUDIO_RAMP.normal) {
    const target = clamp(level, this.minGain, 1);
    applyFade(this.audioContext, this.outputGain.gain, target, rampSeconds, true, this.minGain);
    if (target <= this.minGain * 1.5) {
      this.stopAllVoices();
    }
  }

  setOnNote(callback) {
    this.onNote = typeof callback === "function" ? callback : null;
  }

  setTimbre(value) {
    const legacyMap = {
      classico: "rhodes",
      nylon: "flute",
      "8bits": "blend",
      synth: "blend",
      digital: "blend",
      chords: "blend",
      lead: "blend",
      bass: "rhodes",
    };
    const normalized = legacyMap[value] || value;
    const allowed = ["rhodes", "flute", "blend"];
    this.timbre = allowed.includes(normalized) ? normalized : "rhodes";
    this._applySpaceByTimbre();
  }

  setPedalEnabled(enabled) {
    this.pedalEnabled = Boolean(enabled);
  }

  setResonance(value) {
    this.resonance = clamp(Number(value), 0, 1);
    const now = this.audioContext.currentTime;
    const freq = 1200 + this.resonance * 3200;
    const q = 0.8 + this.resonance * 6.8;
    this.colorFilter.frequency.cancelScheduledValues(now);
    this.colorFilter.Q.cancelScheduledValues(now);
    this.colorFilter.frequency.setValueAtTime(this.colorFilter.frequency.value, now);
    this.colorFilter.Q.setValueAtTime(this.colorFilter.Q.value, now);
    this.colorFilter.frequency.linearRampToValueAtTime(freq, now + 0.2);
    this.colorFilter.Q.linearRampToValueAtTime(q, now + 0.2);
  }

  setWarmth(value) {
    this.warmth = clamp(Number(value), 0, 1);
    this.warmthShaper.curve = this._createWarmthCurve(this.warmth);
    this.warmthShaper.oversample = "4x";
  }

  setSpace(value) {
    this.space = clamp(Number(value), 0, 1);
    this._applySpaceByTimbre();
  }

  setSubOctaveEnabled(enabled) {
    this.subOctaveEnabled = Boolean(enabled);
  }

  setHarmonicMode(mode) {
    const safe = ["dorian", "lydian"].includes(mode) ? mode : "dorian";
    this.harmonicMode = safe;
    this.setScale(safe);
    this.progression = this.modeProfiles[safe].progression;
    this.currentBar = -1;
  }

  setProgressionMotion(motion) {
    this.progressionMotion = motion === "fifths" ? "fifths" : "fourths";
    this.currentBar = -1;
  }

  setToneCutoff(value) {
    const cutoff = clamp(Number(value), 800, 2600);
    const now = this.audioContext.currentTime;
    this.colorFilter.frequency.cancelScheduledValues(now);
    this.colorFilter.frequency.setValueAtTime(this.colorFilter.frequency.value, now);
    this.colorFilter.frequency.linearRampToValueAtTime(cutoff, now + 0.18);
  }

  setWowFlutter(value) {
    this.wowFlutter = clamp(Number(value), 0, 1);
  }

  setTapeWear(value) {
    this.tapeWear = clamp(Number(value), 0, 1);
  }

  _applySpaceByTimbre() {
    const base = {
      rhodes: { send: 0.1, ret: 0.14 },
      flute: { send: 0.16, ret: 0.2 },
      blend: { send: 0.15, ret: 0.19 },
    }[this.timbre] || { send: 0.1, ret: 0.14 };

    const depth = 0.35 + this.space * 1.35;
    this.reverbSend.gain.value = clamp(base.send * depth, 0.02, 0.6);
    this.reverbReturnGain.gain.value = clamp(base.ret * depth, 0.02, 0.65);
  }

  stopAllVoices() {
    this.activeVoices.forEach((voice) => {
      try {
        voice.stop(this.audioContext.currentTime + 0.01);
      } catch (_error) {
        // noop
      }
    });
    this.activeVoices.clear();
  }

  _getStepDuration() {
    return (60 / this.bpm) / 2;
  }

  _getProgressionRootOffset() {
    const cycle = this.progressionMotion === "fifths" ? 7 : 5;
    return (this.currentBar * cycle) % 12;
  }

  _getSyncopationOffset(step) {
    const stepDuration = this._getStepDuration();
    const swingBase = 0.018 + this.wowFlutter * 0.016;
    if (step === 0) {
      return stepDuration * (0.2 + Math.random() * 0.18);
    }
    if (step !== null && step % 2 === 1) {
      return swingBase + Math.random() * 0.006;
    }
    return (Math.random() * 2 - 1) * 0.004;
  }

  _computeDurationScale() {
    return clamp((60 / this.bpm) / 0.58, 0.7, 1.5);
  }

  _isStrongStep(step) {
    return step === null ? Math.random() > 0.56 : (step === 0 || step === 3 || step === 6);
  }

  _shouldPlayStrongVoicing(step) {
    return step === 3 || step === 6 || (step === 0 && Math.random() > 0.72);
  }

  _getDensityBoost(step) {
    return this._isStrongStep(step) ? 0.2 : 0;
  }

  playStep(input) {
    if (!this.activeScale || this.activeScale.length === 0) {
      return;
    }

    const payload = typeof input === "number"
      ? { time: input, step: null }
      : input || {};

    const step = Number.isInteger(payload.step) ? payload.step : null;
    const time = Number.isFinite(payload.time) ? payload.time : this.audioContext.currentTime;

    if (step !== null && step === 0) {
      this.currentBar += 1;
      this.currentChordKey = this.progression[this.currentBar % this.progression.length];
    }

    const strongStep = this._isStrongStep(step);
    const densityBoost = this._getDensityBoost(step);

    if (Math.random() > clamp(this.probability + densityBoost, 0, 0.94)) {
      return;
    }

    const harmonicContext = this._buildHarmonicContext();
    const syncopationOffset = this._getSyncopationOffset(step);
    const durationScale = this._computeDurationScale();
    const startTime = time + syncopationOffset;

    if (strongStep && this._shouldPlayStrongVoicing(step)) {
      this._playChordVoicing(startTime, harmonicContext, step, durationScale);
      return;
    }

    this._playMelodicTone(startTime, harmonicContext, durationScale);
  }

  _playChordVoicing(time, harmonicContext, step, durationScale) {
    const notes = harmonicContext.chordMidis;
    if (notes.length < 3) {
      return;
    }

    const start = Math.max(
      this.audioContext.currentTime,
      time + (Math.random() * 2 - 1) * this.humanization
    );

    const voicing = [];
    voicing.push(notes[0]);
    voicing.push(notes[2]);
    voicing.push(notes[3] ?? notes[1]);

    if (Math.random() > 0.42) {
      voicing.push((notes[1] ?? notes[0]) + 12);
    }

    const velocity = step === 0 ? 0.84 : 0.74;

    voicing.forEach((midi, idx) => {
      const stagger = idx * 0.012;
      this._triggerNoteByFrequency(this._midiToFrequency(midi), start + stagger, velocity, 0.95 * durationScale);
    });
  }

  _playMelodicTone(time, harmonicContext, durationScale) {
    const start = Math.max(
      this.audioContext.currentTime,
      time + (Math.random() * 2 - 1) * this.humanization
    );

    const phrasePool = [
      ...harmonicContext.chordMidis,
      ...harmonicContext.scaleMidis.filter((midi) => midi >= harmonicContext.tonicMidi - 2 && midi <= harmonicContext.tonicMidi + 19),
    ];

    if (phrasePool.length === 0) {
      return;
    }

    const sorted = [...new Set(phrasePool)].sort((a, b) => a - b);

    const direction = Math.random() > 0.58 ? -this.lastPhraseDirection : this.lastPhraseDirection;
    this.lastPhraseDirection = direction;

    const anchor = harmonicContext.chordMidis[Math.floor(Math.random() * harmonicContext.chordMidis.length)] || sorted[0];
    let index = sorted.findIndex((value) => value >= anchor);
    if (index < 0) {
      index = Math.floor(sorted.length / 2);
    }

    index = clamp(index + direction * (Math.random() > 0.62 ? 1 : 0), 0, sorted.length - 1);

    const midi = sorted[index];
    const velocity = 0.64 + Math.random() * 0.2;
    this._triggerNoteByFrequency(this._midiToFrequency(midi), start, velocity, 0.72 * durationScale);
  }

  _buildHarmonicContext() {
    const tonicMidi = this._noteToMidi(this.activeScale[0] || "C3") + this._getProgressionRootOffset();
    const formula = this._getChordFormula(this.currentChordKey);
    const chordMidis = formula.map((interval) => tonicMidi + interval);
    const scaleMidis = this.activeScale.map((note) => this._noteToMidi(note) + this._getProgressionRootOffset());

    return {
      tonicMidi,
      chordMidis,
      scaleMidis,
    };
  }

  _getChordFormula(chordKey) {
    const formulas = this.modeProfiles[this.harmonicMode]?.formulas || this.modeProfiles.dorian.formulas;
    const keys = Object.keys(formulas);
    if (formulas[chordKey]) {
      return formulas[chordKey];
    }
    return formulas[keys[Math.floor(Math.random() * keys.length)]];
  }

  _triggerNoteByFrequency(frequency, start, velocity = 0.85, durationScale = 1) {
    const timbreSettings = this._getTimbreSettings(this.timbre);
    const attack = timbreSettings.attack;
    const decay = timbreSettings.decay;
    const sustainGain = timbreSettings.sustain * velocity;
    const sustainBoost = this.pedalEnabled ? 1.75 : 1;
    const releaseBoost = this.pedalEnabled ? 2.4 : 1;
    const sustainHold = (0.16 + Math.random() * 0.2) * durationScale * sustainBoost;
    const release = (timbreSettings.release ?? this.release) * durationScale * releaseBoost;
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
    noteGain.gain.linearRampToValueAtTime(timbreSettings.peak * velocity, start + attack);
    noteGain.gain.linearRampToValueAtTime(sustainGain, start + attack + decay);
    noteGain.gain.setValueAtTime(sustainGain, start + attack + decay + sustainHold);
    noteGain.gain.exponentialRampToValueAtTime(this.minGain, endTime);

    noteFilter.connect(noteGain);
    noteFilter.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(noteGain);
    noteGain.connect(this.outputGain);

    const rootFrequency = frequency;

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

    if (this.subOctaveEnabled) {
      this._spawnOscVoice({
        wave: "sine",
        periodicWave: null,
        frequency: rootFrequency * 0.5,
        detuneCents: (Math.random() * 2 - 1) * 1.5,
        gain: timbreSettings.mainVoiceGain * 0.19,
        start,
        endTime: start + attack + decay + sustainHold + release * 0.92,
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
    const lfo = this.audioContext.createOscillator();
    const lfoGain = this.audioContext.createGain();

    osc.type = config.wave;
    if (config.periodicWave) {
      osc.setPeriodicWave(config.periodicWave);
    }

    osc.frequency.setValueAtTime(config.frequency, config.start);
    osc.detune.setValueAtTime(config.detuneCents, config.start);
    const tapeDrift = (Math.random() * 2 - 1) * (1.2 + this.tapeWear * 8.5);
    osc.detune.linearRampToValueAtTime(config.detuneCents + tapeDrift, config.endTime);
    lfo.type = "sine";
    const wowRate = 0.12 + this.wowFlutter * 2.2;
    const wowDepthCents = 0.9 + this.wowFlutter * 24 + this.tapeWear * 3.2;
    lfo.frequency.setValueAtTime(wowRate, config.start);
    lfoGain.gain.setValueAtTime(wowDepthCents, config.start);
    gain.gain.setValueAtTime(Math.max(this.minGain, config.gain), config.start);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);
    osc.connect(gain);
    gain.connect(config.destination);

    osc.start(config.start);
    lfo.start(config.start);
    osc.stop(config.endTime + 0.06);
    lfo.stop(config.endTime + 0.06);

    this.activeVoices.add(osc);
    osc.onended = () => {
      this.activeVoices.delete(osc);
      lfo.disconnect();
      lfoGain.disconnect();
      osc.disconnect();
      gain.disconnect();
    };
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
    if (timbre === "flute") {
      return {
        wave: "triangle",
        periodicWave: null,
        attack: 0.08,
        decay: 0.18,
        sustain: 0.065,
        release: 1.65,
        peak: 0.18,
        lowPassMin: 1050,
        lowPassSpan: 360,
        qMin: 0.8,
        qSpan: 0.3,
        bodyFreq: 420,
        bodyQ: 1.1,
        bodyGainDb: 2.8,
        bodyMix: 0.2,
        mainVoiceGain: 0.58,
        unisonCount: 2,
        unisonSpreadCents: 3.4,
        inharmonicity: 0.00005,
        inharmonicMix: 0.01,
        attackNoise: 0.003,
        attackNoiseFreq: 2100,
        attackNoiseQ: 0.8,
        attackNoiseDecay: 0.06,
      };
    }

    if (timbre === "blend") {
      return {
        wave: "triangle",
        periodicWave: this.periodicWaves.chords,
        attack: 0.05,
        decay: 0.2,
        sustain: 0.08,
        release: 1.3,
        peak: 0.19,
        lowPassMin: 1200,
        lowPassSpan: 520,
        qMin: 0.9,
        qSpan: 0.4,
        bodyFreq: 340,
        bodyQ: 1.2,
        bodyGainDb: 2.9,
        bodyMix: 0.26,
        mainVoiceGain: 0.64,
        unisonCount: 2,
        unisonSpreadCents: 2.4,
        inharmonicity: 0.0001,
        inharmonicMix: 0.03,
        attackNoise: 0.005,
        attackNoiseFreq: 2300,
        attackNoiseQ: 1.1,
        attackNoiseDecay: 0.02,
      };
    }

    return {
      wave: "triangle",
      periodicWave: this.periodicWaves.rhodes,
      attack: 0.02,
      decay: 0.2,
      sustain: 0.078,
      release: Math.max(1.1, this.release),
      peak: 0.21,
      lowPassMin: 1500,
      lowPassSpan: 780,
      qMin: 0.7,
      qSpan: 0.3,
      bodyFreq: 330,
      bodyQ: 1.2,
      bodyGainDb: 3.2,
      bodyMix: 0.28,
      mainVoiceGain: 0.68,
      unisonCount: 2,
      unisonSpreadCents: 1.8,
      inharmonicity: 0.0002,
      inharmonicMix: 0.04,
      attackNoise: 0.007,
      attackNoiseFreq: 2400,
      attackNoiseQ: 1.05,
      attackNoiseDecay: 0.03,
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

  _createWarmthCurve(amount) {
    const drive = 1 + amount * 26;
    const samples = 2048;
    const curve = new Float32Array(samples);

    for (let i = 0; i < samples; i += 1) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
    }

    return curve;
  }

  _noteToMidi(note) {
    if (typeof note !== "string") {
      return 60;
    }

    const parsed = note.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
    if (!parsed) {
      return 60;
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

    return (octave + 1) * 12 + semitone;
  }

  _midiToFrequency(midi) {
    const clamped = clamp(Number(midi), 24, 108);
    return 440 * Math.pow(2, (clamped - 69) / 12);
  }
}

export { PianoEngine };
