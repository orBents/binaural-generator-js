import { AudioGraph } from "./modules/AudioGraph.mjs";
//import { RandomGenerator } from './modules/RandomGenerator.js';

let isPlaying = false;

let btnPlay = document.querySelector("#play-btn");

let bar = document.querySelector("bar");
let bar1 = document.querySelector("#bar-1");
let bar2 = document.querySelector("#bar-2");
let bar3 = document.querySelector("#bar-3");

let audioGraph = new AudioGraph();
let audioContext = audioGraph.audioContext;
//let generator = new RandomGenerator;

bar1.classList.toggle("paused");
bar2.classList.toggle("paused");
bar3.classList.toggle("paused");


let onPlay = () => {
  isPlaying = true;
  isPlaying ? audioContext.resume() : audioContext.suspend();
};

let stopPlay = () => {
  audioContext.suspend(); // invoke in case of error
  isPlaying = false;
};

let init = (event) => {
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
};

btnPlay.addEventListener("click", init);
