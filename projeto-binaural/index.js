import { audioContext, AudioGraph } from "./modules/AudioGraph.mjs";
//import { AudioComponent } from "./modules/AudioComponent.mjs";
import { RandomGenerator } from "./modules/RandomGenerator.mjs";
//import { RandomGenerator } from './modules/RandomGenerator.js';

let isPlaying = false;
audioContext.suspend();

let btnPlay = document.querySelector("#play-btn");

//let bar = document.querySelector("bar");
let bar1 = document.querySelector("#bar-1");
let bar2 = document.querySelector("#bar-2");
let bar3 = document.querySelector("#bar-3");

//let audioGraph = new AudioGraph();
//let audioContext = audioGraph.audioContext;
//let generator = new RandomGenerator;
bar1.classList.toggle("paused");
bar2.classList.toggle("paused");
bar3.classList.toggle("paused");
console.log(audioContext.state);

let interval;
let generator = new RandomGenerator();

let beta = new AudioGraph();
let gamma = new AudioGraph();

beta.changeGain(0.015);
gamma.changeGain(0.018);

generator.setBaseGen(generator.currentFrequencies);
let currentBeta = generator.currentFrequencies["beta"];
let bKey = "beta";

let currentGamma = generator.currentFrequencies["gamma"];
let gkey = "gamma";

let currentBetaOffset = generator.setRandomOffset();
let currentGammaOffset = generator.setRandomOffset();

let onPlay = () => {
  let limit = 40; //offset limit
  let delay = 100;

  beta.updateOscillators(currentBeta, currentBetaOffset);
  gamma.updateOscillators(currentGamma, currentGammaOffset);

  audioContext.resume();
  interval = setInterval(() => {
    console.log(
      `Beta: ${currentBeta} bOffset: ${currentBetaOffset} Gamma: ${currentGamma} gOffset: ${currentGammaOffset}`
    );

    //verify and update on limits of dict frequency beta
    if (currentBeta < Object.values(generator.getMinMax(bKey))[0]) {
      currentBeta += 1;
    } else if (currentBeta > Object.values(generator.getMinMax(bKey))[1]) {
      currentBeta += -1;
    } else currentBeta += generator.setDirection();

    //verify and update on limits of dict frequency gamma
    if (currentGamma < Object.values(generator.getMinMax(gkey))[0]) {
      currentGamma += 1;
    } else if (currentGamma > Object.values(generator.getMinMax(gkey))[1]) {
      currentGamma += -1;
    } else currentGamma += generator.setDirection();

    //verify and update in beta offset limits
    if (currentBetaOffset < currentBeta - limit || currentBetaOffset == 0) {
      currentBetaOffset += 1;
    } else if (currentBetaOffset > currentBeta + limit) {
      currentBetaOffset += -1;
    } else currentBetaOffset += generator.setDirection();

    //verify and update in gamma offset limits
    if (currentGammaOffset < currentGamma - limit || currentGammaOffset == 0) {
      currentGammaOffset += 1;
    } else if (currentGammaOffset > currentGamma + limit) {
      currentGammaOffset += -1;
    } else currentGammaOffset += generator.setDirection();
  }, delay);
  console.log(audioContext.state);
  isPlaying = true;
};

let stopPlay = () => {
  audioContext.suspend(); // invoke in case of error
  clearInterval(interval);
  isPlaying = false;
  console.log(audioContext.state);
};

btnPlay.addEventListener("click", (event) => {
  event.preventDefault();
  if (isPlaying) {
    stopPlay();
    btnPlay.classList.remove("paused");
    bar1.classList.toggle("paused");
    bar2.classList.toggle("paused");
    bar3.classList.toggle("paused");
  } else {
    onPlay();
    btnPlay.classList.toggle("paused");
    bar1.classList.remove("paused");
    bar2.classList.remove("paused");
    bar3.classList.remove("paused");
  }
  console.log(`State: ${isPlaying}`);
});
