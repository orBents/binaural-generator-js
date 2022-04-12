import { audioContext as context, audioContext }  from '../components/audioGraph';

class Player {
    constructor(){
        isPlaying = false;
    }
    onPlay() {
        this.isPlaying = true;
        this.isPlaying ? context.resume() : context.suspend()
    }
    stopPlay() {
        audioContext.suspend(); // invoke in case of error
        this.isPlaying = false;
    }
}

let player = new Player();

let btnPlay = document.querySelector("#play-btn");
let btnPause = document.querySelector("#pause-btn");

btnPlay.addEventListener("click", () => {
    player.onPlay();
    console.log("playfff");
});

btnPause.addEventListener("click", () => {
    player.stopPlay();
    console.log("pauseffff");
});