class Visualizer {
  constructor(canvas, analyserNode) {
    this.canvas = canvas;
    this.analyser = analyserNode;
    this.ctx = canvas?.getContext("2d") || null;
    this.animationFrame = null;
    this.strokeColor = "rgba(64, 224, 208, 0.95)";
    this.phase = 0;

    this.analyser.fftSize = 2048;
    this.bufferLength = this.analyser.fftSize;
    this.dataArray = new Uint8Array(this.bufferLength);

    this._handleResize = () => this._resizeCanvas();
  }

  start() {
    if (this.animationFrame || !this.ctx) {
      return;
    }

    this._resizeCanvas();
    window.addEventListener("resize", this._handleResize);
    this._draw();
  }

  stop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    window.removeEventListener("resize", this._handleResize);
  }

  setStrokeColor(color) {
    this.strokeColor = color;
  }

  _resizeCanvas() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    const targetWidth = Math.max(1, Math.floor(rect.width * dpr));
    const targetHeight = Math.max(1, Math.floor(rect.height * dpr));

    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
    }
  }

  _draw = () => {
    if (!this.ctx) {
      return;
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerY = height / 2;

    this.analyser.getByteTimeDomainData(this.dataArray);

    let energy = 0;
    for (let i = 0; i < this.bufferLength; i += 1) {
      const n = (this.dataArray[i] - 128) / 128;
      energy += n * n;
    }

    const rms = Math.sqrt(energy / this.bufferLength);
    const dynamicScale = Math.min(1.1, 0.16 + rms * 3.1);

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.lineWidth = Math.max(1.6, width / 420);
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.shadowColor = this.strokeColor;
    this.ctx.shadowBlur = Math.max(5, width / 85);
    this.ctx.beginPath();

    const points = [];
    const sampleStep = 4;

    for (let i = 0; i < this.bufferLength; i += sampleStep) {
      const x = (i / (this.bufferLength - 1)) * width;
      let y;

      if (rms < 0.008) {
        y = centerY + Math.sin((x / width) * Math.PI * 3.2 + this.phase) * (height * 0.08);
      } else {
        const raw = (this.dataArray[i] - 128) / 128;
        y = centerY + (raw * centerY * 0.86 * dynamicScale);
      }

      points.push({ x, y });
    }

    if (points.length > 1) {
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

    this.phase += 0.045;
    this.animationFrame = requestAnimationFrame(this._draw);
  };
}

export { Visualizer };
