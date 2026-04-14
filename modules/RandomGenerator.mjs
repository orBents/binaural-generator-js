class RandomGenerator {
  constructor(engine) {
    this.engine = engine;

    this.frequencies = {
      alpha: {
        interval: [8, 13],
        frequency: null,
        offset: null,
      },
      beta: {
        interval: [30, 50],
        frequency: null,
        offset: null,
      },
      gamma: {
        interval: [70, 80],
        frequency: null,
        offset: null,
      },
    };
  }

  setup() {
    this.setInitialFrequencies();

    this.engine.createTrack("beta", {
      leftFrequency: this.frequencies.beta.frequency,
      rightFrequency: this.frequencies.beta.frequency + this.frequencies.beta.offset,
      gain: 0.03,
      waveType: "sine",
    });

    this.engine.createTrack("gamma", {
      leftFrequency: this.frequencies.gamma.frequency,
      rightFrequency: this.frequencies.gamma.frequency + this.frequencies.gamma.offset,
      gain: 0.03,
      waveType: "sine",
    });
  }

  changeBetaGain(gain) {
    this.engine.setTrackGain("beta", gain);
  }

  changeGammaGain(gain) {
    this.engine.setTrackGain("gamma", gain);
  }

  setWaveType(waveType) {
    this.engine.selectTimbre(waveType);
  }

  setLowPassFrequency(cutoff) {
    this.engine.setLowPassFrequency(cutoff);
  }

  setBrownNoiseLevel(level) {
    this.engine.setBrownNoiseLevel(level);
  }

  setInitialFrequencies() {
    for (const band in this.frequencies) {
      this.frequencies[band].frequency = this.getRandomInterval(band);
      this.frequencies[band].offset = this.setRandomOffset();
    }
  }

  setDirection() {
    return Math.floor(Math.random() * 3) - 1;
  }

  getMinMax(band) {
    const min = Math.ceil(this.frequencies[band].interval[0]);
    const max = Math.floor(this.frequencies[band].interval[1]);
    return { min, max };
  }

  getRandomInterval(band) {
    const min = Math.ceil(this.frequencies[band].interval[0]);
    const max = Math.floor(this.frequencies[band].interval[1]);
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  setRandomOffset() {
    return Math.floor(Math.random() * 40);
  }

  update() {
    const limit = 30;

    const beta = this.frequencies.beta;
    const gamma = this.frequencies.gamma;

    const betaBounds = this.getMinMax("beta");
    const gammaBounds = this.getMinMax("gamma");

    if (beta.frequency < betaBounds.min) {
      beta.frequency += 1;
    } else if (beta.frequency > betaBounds.max) {
      beta.frequency -= 1;
    } else {
      beta.frequency += this.setDirection();
    }

    if (gamma.frequency < gammaBounds.min) {
      gamma.frequency += 1;
    } else if (gamma.frequency > gammaBounds.max) {
      gamma.frequency -= 1;
    } else {
      gamma.frequency += this.setDirection();
    }

    if (beta.offset < beta.frequency - limit || beta.offset === 0) {
      beta.offset += 1;
    } else if (beta.offset > beta.frequency + limit) {
      beta.offset -= 1;
    } else {
      beta.offset += this.setDirection();
    }

    if (gamma.offset < gamma.frequency - limit || gamma.offset === 0) {
      gamma.offset += 1;
    } else if (gamma.offset > gamma.frequency + limit) {
      gamma.offset -= 1;
    } else {
      gamma.offset += this.setDirection();
    }

    this.engine.setTrackFrequencies("beta", beta.frequency, beta.frequency + beta.offset);
    this.engine.setTrackFrequencies("gamma", gamma.frequency, gamma.frequency + gamma.offset);
  }
}

export { RandomGenerator };
