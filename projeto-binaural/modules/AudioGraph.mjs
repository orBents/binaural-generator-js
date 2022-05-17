const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
const destination = audioContext.destination;

let initialised = false; // flag to store singleton state init

class AudioGraph {
  constructor() {
   
    const baseNode = audioContext.createOscillator();
    const beatNode = audioContext.createOscillator();

    this.baseNode = baseNode;
    this.beatNode = beatNode;

    const lPanner = new StereoPannerNode(audioContext, { pan: -1 });
    baseNode.connect(lPanner);

    const rPanner = new StereoPannerNode(audioContext, { pan: +1 });
    beatNode.connect(rPanner);

    const gainNode = audioContext.createGain();
    this.gainNode = gainNode;

    lPanner.connect(gainNode);
    rPanner.connect(gainNode);
    gainNode.connect(destination);

    if (!initialised) {
      audioContext.suspend(); // prevent the context from starting
      initialised = true;
    }
    baseNode.start(); // until a user action triggers it.
    beatNode.start();
  }

  updateOscillators(frequency, offset) {
    try {
      frequency = parseInt(frequency);
      offset = parseInt(offset);
      if (Math.abs(frequency > 180)) frequency = 180;
      if (Math.abs(offset) > frequency + 40) offset = frequency + 40;
      if (Math.abs(offset) < frequency - 40) offset = frequency - 40;
      this.baseNode.frequency.value = frequency; // number input in hertz
      this.beatNode.frequency.value = frequency + offset; // offset in current frequency
    } catch (e) {
      this.audioContext.suspend();
      throw e;
    }
    return { frequency, offset };
  }
  changeGain(gain) {
    gain = parseFloat(gain);
    if (gain > 0.5) {
      gain = 0.5;
    } else if(gain < 0){
      gain = 0;
    }
    return (this.gainNode.gain.value = gain); //volume input slider in index
  }
}

export { audioContext, AudioGraph };
