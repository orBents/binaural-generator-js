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

bar1.classList.toggle("paused");
bar2.classList.toggle("paused");
bar3.classList.toggle("paused");
console.log(audioContext.state);

let interval;
let generator = new RandomGenerator();

generator.setup();

let onPlay = () => {
  let delay = 100;
  
  audioContext.resume();
  
  interval = setInterval(() => {
    generator.update();
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
