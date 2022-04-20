//import { AudioGraph } from "./modules/AudioGraph.mjs";

class RandomGenerator {
  constructor() {
    const BASE_FREQUENCIES = {    //interval of a min/max bineural frequency dict base 
      //'alpha': [8, 13],
      'beta': [13, 30],
      'gamma': [30, 100]
    };
    this.BASE_FREQUENCIES = BASE_FREQUENCIES;

    let currentFrequencies = {
      //'alpha': 0,
      'beta': 0,
      'gamma': 0
    };
    this.currentFrequencies = currentFrequencies; 
  }

  //FREQUENCY
  setBaseGen(currentFrequencies) {   //set random base to use in a incrementation
    for (const frequency in this.currentFrequencies) {
      currentFrequencies[frequency] = this.getRandomInterval(frequency);
    }
    return currentFrequencies;
  }

  setDirection() { //set direction to a random increment, decrement or sustain
    return Math.floor(Math.random() * 3) - 1;
  }

  getRandomInterval(frequency) {   //get random base frequency in interval for each dict insert on atenuateContinue
    let min = Math.ceil(this.BASE_FREQUENCIES[frequency][0]);
    let max = Math.floor(this.BASE_FREQUENCIES[frequency][1]);
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  getRandFrequency() {    //get a random frequency by index to increment in atenuateContinue
    let index = Math.floor(Math.random() * 3);
    return Object.keys(this.currentFrequencies)[index];
  }

  /*atenuateContinueFrequency(currentFrequencies) {    //increment or decrement to a base frequency
    setInterval(() => {
      //let frequency = Math.floor(Math.random() * 3); //choose any base frequency to increment
      let frequency = this.getRandFrequency();
      let increment = this.setDirection();
      //console.log(`frequency: ${frequency} ${currentFrequencies[frequency]} increment: ${increment} result: ${currentFrequencies[frequency] + increment}`);
      currentFrequencies[frequency] += increment;
    }, this.delay);
  }*/

  ///OFFSET
  setRandomOffset() { //set random base offset
    return Math.floor(Math.random() * 100) - 20;
  }

  //GAIN
  setRandomGain() { //set random base offset
    return Math.floor(Math.random());
  }

  //PLAY
  play() {
    this.currentFrequencies = this.setBaseGen(this.currentFrequencies);
    this.atenuateContinueFrequency(this.currentFrequencies);
  }
}
//TEST
/*let generator = new RandomGenerator();
generator.play();*/
//setRandomOffset();

export {
  RandomGenerator
};