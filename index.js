import { audioContext, AudioGraph } from "./modules/AudioGraph.mjs";
import { RandomGenerator } from "./modules/RandomGenerator.mjs";

let isPlaying = false;
audioContext.suspend();

let btnPlay = document.querySelector("#play-btn");
let volumeBeta = document.getElementById("volume-beta");
let volumeGamma = document.getElementById("volume-gamma");

let bar1 = document.querySelector("#bar-1");
let bar2 = document.querySelector("#bar-2");
let bar3 = document.querySelector("#bar-3");

bar1.classList.toggle("paused");
bar2.classList.toggle("paused");
bar3.classList.toggle("paused");

let interval;
let generator = new RandomGenerator();

generator.setup();

volumeBeta.addEventListener('change', function () {
  generator.changeBetaGain(volumeBeta.value);
});

volumeGamma.addEventListener('change', function () {
  generator.changeGammaGain(volumeGamma.value);
});

let onPlay = () => {
  let delay = 150;
  
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

function toggleMode() {
  var element = document.body;
  element.classList.toggle("light-mode");
}