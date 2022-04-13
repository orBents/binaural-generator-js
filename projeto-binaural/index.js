import { AudioGraph }  from './modules/AudioGraph.mjs';

let isPlaying = false;
let btnPlay = document.querySelector("#play-btn");
let audioGraph = new AudioGraph;
let audioContext = audioGraph.audioContext;

let onPlay = () => {
    isPlaying = true;
    isPlaying ? audioContext.resume() : audioContext.suspend()
}

let stopPlay = () => {
    audioContext.suspend(); // invoke in case of error
    isPlaying = false;
}

let init = (event) => {
    console.log("executou");
    event.preventDefault();
    
    if(isPlaying){
        stopPlay();
        btnPlay.innerHTML = "Pause";
    }else{
        onPlay();
        btnPlay.innerHTML = "Play";
    }
    console.log(`State: ${isPlaying}`);
}

btnPlay.addEventListener("click", init);