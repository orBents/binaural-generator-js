class Visualizer {
  constructor(canvas, analyserNode) {
    this.canvas = canvas;
    this.analyser = analyserNode;
    this.ctx = canvas.getContext("2d");
    this.animationFrame = null;

    this.analyser.fftSize = 2048;
    this.bufferLength = this.analyser.fftSize;
    this.dataArray = new Uint8Array(this.bufferLength);
    this.strokeColor = "rgba(194, 165, 255, 0.9)";
  }

  start() {
    if (this.animationFrame) {
      return;
    }
    this._draw();
  }

  stop() {
    if (!this.animationFrame) {
      return;
    }
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  setStrokeColor(color) {
    this.strokeColor = color;
  }

  _draw = () => {
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.analyser.getByteTimeDomainData(this.dataArray);

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.beginPath();

    const sliceWidth = width / this.bufferLength;
    let x = 0;

    for (let i = 0; i < this.bufferLength; i += 1) {
      const value = this.dataArray[i] / 128.0;
      const y = (value * height) / 2;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    this.ctx.lineTo(width, height / 2);
    this.ctx.stroke();

    this.animationFrame = requestAnimationFrame(this._draw);
  };
}

export { Visualizer };
