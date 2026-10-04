(function (root) {
  'use strict';
  // Reusable noise layers: a soft rush of water with irregular submerged bubbles.
  // No pitched drop oscillator and no new buffer for each pointer move.
  function StrokeAudio(context, output, random) {
    this.context = context; this.output = output; this.node = null; this.lastMove = -10; this.speed = 0;
    var r = random || Math.random, rate = context.sampleRate, length = Math.floor(rate * 2);
    this.rushBuffer = context.createBuffer(1, length, rate);
    this.bubbleBuffer = context.createBuffer(1, length, rate);
    var rush = this.rushBuffer.getChannelData(0), bubbles = this.bubbleBuffer.getChannelData(0), brown = 0, envelope = 0, remaining = 0, duration = 0, smooth = 0;
    for (var i = 0; i < length; i++) {
      brown = brown * .985 + (r() * 2 - 1) * .12;
      smooth = smooth * .997 + (r() * 2 - 1) * .003;
      // Close both loop seams to avoid a recurring click.
      var seam = Math.min(1, i / (rate * .025), (length - 1 - i) / (rate * .025));
      rush[i] = (brown * .7 + (r() * 2 - 1) * .14) * (.8 + smooth * 2) * seam;
      if (remaining <= 0 && r() < 22 / rate) { duration = Math.floor(rate * (.012 + r() * .04)); remaining = duration; }
      envelope = remaining > 0 ? Math.sin(Math.PI * (1 - remaining / duration)) : 0;
      bubbles[i] = (r() * 2 - 1) * envelope * seam;
      remaining--;
    }
  }
  StrokeAudio.prototype.stroke = function (speed) {
    var c = this.context; if (c.state !== 'running') return;
    this.lastMove = c.currentTime; this.speed = Math.max(0, Math.min(2.5, speed));
    if (!this.node) {
      var rush = c.createBufferSource(), bubbles = c.createBufferSource(), low = c.createBiquadFilter(), high = c.createBiquadFilter(), band = c.createBiquadFilter(), gain = c.createGain(), bubbleGain = c.createGain();
      rush.buffer = this.rushBuffer; bubbles.buffer = this.bubbleBuffer; rush.loop = bubbles.loop = true;
      low.type = 'lowpass'; low.Q.value = .55; high.type = 'highpass'; high.frequency.value = 90;
      band.type = 'bandpass'; band.Q.value = .65; gain.gain.value = bubbleGain.gain.value = 0;
      rush.connect(high); high.connect(low); low.connect(gain); gain.connect(this.output);
      bubbles.connect(band); band.connect(bubbleGain); bubbleGain.connect(this.output);
      rush.start(); bubbles.start();
      this.node = { rush: rush, bubbles: bubbles, low: low, high: high, band: band, gain: gain, bubbleGain: bubbleGain };
    }
    var n = this.node, amount = Math.min(1, this.speed / 1.4);
    n.low.frequency.setTargetAtTime(650 + amount * 1300, c.currentTime, .055);
    n.band.frequency.setTargetAtTime(380 + amount * 520, c.currentTime, .08);
    n.gain.gain.setTargetAtTime(.04 + amount * .27, c.currentTime, .035);
    n.bubbleGain.gain.setTargetAtTime(.018 + amount * .1, c.currentTime, .045);
  };
  StrokeAudio.prototype.release = function () {
    if (!this.node) return;
    var t = this.context.currentTime;
    this.node.gain.gain.setTargetAtTime(0, t, .055);
    this.node.bubbleGain.gain.setTargetAtTime(0, t, .055);
    this.speed = 0;
  };
  StrokeAudio.prototype.update = function () {
    if (!this.node) return;
    var idle = this.context.currentTime - this.lastMove;
    if (idle > .09 && this.speed > 0) this.release();
    if (idle > .4) this.stop();
  };
  StrokeAudio.prototype.stop = function () {
    if (!this.node) return;
    var n = this.node; this.node = null; this.speed = 0;
    try { n.rush.stop(); n.bubbles.stop(); } catch (error) {}
    n.rush.disconnect(); n.bubbles.disconnect(); n.low.disconnect(); n.high.disconnect(); n.band.disconnect(); n.gain.disconnect(); n.bubbleGain.disconnect();
  };
  root.WaterSound = { Stroke: StrokeAudio };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.WaterSound;
}(typeof window !== 'undefined' ? window : global));
