class Visualizer {
  constructor(canvas, analyserNode) {
    this.canvas = canvas;
    this.analyser = analyserNode;
    this.ctx = canvas.getContext("2d");
    this.animationFrame = null;

    this.analyser.fftSize = 2048;
    this.bufferLength = this.analyser.fftSize;
    this.dataArray = new Uint8Array(this.bufferLength);
    this.strokeColor = "rgba(15, 255, 243, 0.95)";
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
    const centerY = height / 2;

    this.analyser.getByteTimeDomainData(this.dataArray);

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.lineWidth = 2.2;
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.shadowColor = this.strokeColor;
    this.ctx.shadowBlur = 8;
    this.ctx.beginPath();

    const sliceWidth = width / this.bufferLength;
    let energy = 0;

    for (let i = 0; i < this.bufferLength; i += 1) {
      const normalized = (this.dataArray[i] - 128) / 128;
      energy += normalized * normalized;
    }

    const rms = Math.sqrt(energy / this.bufferLength);
    const dynamicScale = Math.min(1.2, 0.24 + rms * 3.4);
    const points = [];

    for (let i = 0; i < this.bufferLength; i += 1) {
      const raw = (this.dataArray[i] - 128) / 128;
      const y = centerY + (raw * centerY * 0.85 * dynamicScale);
      points.push({ x: i * sliceWidth, y });
    }

    if (points.length > 0) {
      this.ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length - 2; i += 1) {
        const cx = (points[i].x + points[i + 1].x) / 2;
        const cy = (points[i].y + points[i + 1].y) / 2;
        this.ctx.quadraticCurveTo(points[i].x, points[i].y, cx, cy);
      }

      const penultimate = points[points.length - 2];
      const last = points[points.length - 1];
      this.ctx.quadraticCurveTo(penultimate.x, penultimate.y, last.x, last.y);
    }

    this.ctx.stroke();
    this.ctx.shadowBlur = 0;

    this.animationFrame = requestAnimationFrame(this._draw);
  };
}

export { Visualizer };
