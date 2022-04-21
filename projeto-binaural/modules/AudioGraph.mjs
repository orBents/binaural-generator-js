const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
const destination = audioContext.destination;

let initialised = false; // flag to store singleton state init

class AudioGraph {
  constructor() {
    // each component will now have two oscillators,
    // one playing the base frequency,
    // and the other playing the offset frequency
    const baseNode = audioContext.createOscillator();
    const beatNode = audioContext.createOscillator();
    //this.audioContext = audioContext;
    //this.destination = destination;
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
      if (Math.abs(offset) > 40) offset = Math.sign(offset);
      if (offset < 0) offset = 0;
      this.baseNode.frequency.value = frequency; // use a number input, in hertz
      this.beatNode.frequency.value = frequency + offset; // use a range slider (+-60Hz)
    } catch (e) {
      this.audioContext.suspend();
      throw e;
    }
    return { frequency, offset };
  }
  changeGain(gain) {
    gain = parseFloat(gain);
    if (gain < 0 || gain > 0.5) gain = 0.5;
    return (this.gainNode.gain.value = gain); // use a volume slider for the entire component
  }
}

export { audioContext, AudioGraph };
