import { AudioGraph } from "./AudioGraph.mjs";

class RandomGenerator {
  constructor() {
    let frequencies = {
      alpha: {
        interval: [8, 13],
        frequency: null,
        offset: null,
      },
      beta: {
        interval: [30, 60],
        frequency: null,
        offset: null,
        gain: null,
      },
      gamma: {
        interval: [70, 100],
        frequency: null,
        offset: null,
        gain: null,
      },
    };
    this.frequencies = frequencies;

    let beta = new AudioGraph();
    let gamma = new AudioGraph();

    this.beta = beta;
    this.gamma = gamma;

    this.beta.changeGain(0.02)
    this.gamma.changeGain(0.02)
  }

  changeBetaGain(ganho){
    this.beta.changeGain(ganho);
  }

  changeGammaGain(ganho){
    this.gamma.changeGain(ganho);
  }

  //FREQUENCY
  setInitialFrequencies() {
    //set random base to use in a incrementation
    for (const item in this.frequencies) {
      this.frequencies[item].frequency = this.getRandomInterval(item);
      this.frequencies[item].offset = this.setRandomOffset();
    }
  }

  setDirection() {
    //set direction to a random increment, decrement or sustain, 1 ,-1 ,0
    return Math.floor(Math.random() * 3) - 1;
  }

  getMinMax(frequency) {
    //get random base frequency in interval for each dict insert on atenuateContinue
    let min = Math.ceil(this.frequencies[frequency].interval[0]);
    let max = Math.floor(this.frequencies[frequency].interval[1]);
    let values = {
      min: min,
      max: max,
    };
    return values;
  }

  getRandomInterval(frequency) {
    //get random base frequency in interval for each dict insert on atenuateContinue
    let min = Math.ceil(this.frequencies[frequency].interval[0]);
    let max = Math.floor(this.frequencies[frequency].interval[1]);
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  getRandFrequency() {
    //get a random frequency by index to increment in atenuateContinue
    let index = Math.floor(Math.random() * 3);
    return Object.keys(this.currentFrequencies)[index];
  }

  ///OFFSET
  setRandomOffset() {
    //set random base offset
    return Math.floor(Math.random() * 40);
  }

  setup(){
    this.setInitialFrequencies();
    this.beta.updateOscillators(this.frequencies.beta.frequency, this.frequencies.beta.offset);
    this.gamma.updateOscillators(this.frequencies.gamma.frequency, this.frequencies.gamma.offset);
  }

  update(){
    let limit = 40; //offset limit

    let beta = this.frequencies.beta;
    let gamma = this.frequencies.gamma;

    let bKey = "beta";
    let gKey = "gamma";

    console.log(
      `Beta: ${beta.frequency} bOffset: ${beta.offset} Gamma: ${gamma.frequency} gOffset: ${gamma.offset}`
    );

    //verify and update on limits of dict frequency beta
    if (beta.frequency < Object.values(this.getMinMax(bKey))[0]) {
      beta.frequency += 1;
    } else if (beta.frequency > Object.values(this.getMinMax(bKey))[1]) {
      beta.frequency += -1;
    } else beta.frequency += this.setDirection();

    //verify and update on limits of dict frequency gamma
    if (gamma.frequency < Object.values(this.getMinMax(gKey))[0]) {
      gamma.frequency += 1;
    } else if (gamma.frequency > Object.values(this.getMinMax(gKey))[1]) {
      gamma.frequency += -1;
    } else gamma.frequency += this.setDirection();

    //verify and update in beta offset limits
    if (beta.offset < beta.frequency - limit || beta.offset == 0) {
      beta.offset += 1;
    } else if (beta.offset > beta.frequency + limit) {
      beta.offset += -1;
    } else beta.offset += this.setDirection();

    //verify and update in gamma offset limits
    if (gamma.offset < gamma.frequency - limit || gamma.offset == 0) {
      gamma.offset += 1;
    } else if (gamma.offset > gamma.frequency + limit) {
      gamma.offset += -1;
    } else gamma.offset += this.setDirection();

    this.beta.updateOscillators(beta.frequency, beta.offset);
    this.gamma.updateOscillators(gamma.frequency, gamma.offset);
  }

}

export { RandomGenerator };
