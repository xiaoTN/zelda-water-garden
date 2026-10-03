(function (root) {
  'use strict';
  // Visual presets, not meteorological rainfall measurements. Timing uses simulation time.
  var profiles = [
    { name: '停雨', count: 0, speed: 0, length: 0, wind: 0, cloud: 0, impacts: 0, thunder: 0 },
    { name: '小雨', count: 48, speed: .85, length: .8, wind: .06, cloud: .035, impacts: 14, thunder: 0 },
    { name: '中雨', count: 95, speed: 1.1, length: 1, wind: .10, cloud: .075, impacts: 28, thunder: .38, interval: [18, 30] },
    { name: '大雨', count: 165, speed: 1.45, length: 1.35, wind: .16, cloud: .14, impacts: 46, thunder: .68, interval: [8, 14] },
    { name: '暴雨', count: 260, speed: 1.85, length: 1.7, wind: .24, cloud: .23, impacts: 68, thunder: 1, interval: [2.8, 5.6] }
  ];
  function Weather(random) {
    this.random = random || Math.random; this.level = 0; this.count = 0; this.cloud = 0; this.credit = 0;
    this.flashAge = 10; this.flash = 0; this.nextStrike = Infinity; this.pendingThunder = -1;
    this.hits = 0; this.strikes = 0; this.thunders = 0; this.particles = []; this.bolt = []; this.branch = [];
    for (var i = 0; i < 260; i++) this.particles.push({ u: 0, v: 0, y: 0, span: 0, speed: 0, depth: 0 });
    for (i = 0; i < 11; i++) this.bolt.push({ u: 0, v: 0 });
    for (i = 0; i < 5; i++) this.branch.push({ u: 0, v: 0 });
  }
  Weather.prototype.seed = function (p, warm) {
    var r = this.random, profile = profiles[this.level];
    p.u = r() * 1.2 - .1; p.v = r() * 1.12 - .06; p.depth = r(); p.span = .22 + r() * .5;
    p.y = p.v - p.span + (warm ? r() * p.span : 0); p.speed = profile.speed * (.6 + p.depth * .85);
  };
  Weather.prototype.setLevel = function (level) {
    if (level !== Math.floor(level) || level < 0 || level > 4) return;
    this.level = level; this.count = 0; this.credit = 0; this.flashAge = 10; this.flash = 0; this.pendingThunder = -1;
    var profile = profiles[level];
    this.nextStrike = profile.thunder ? (profile.interval[0] + (profile.interval[1] - profile.interval[0]) * this.random()) * .45 : Infinity;
  };
  Weather.prototype.clear = function () {
    this.setLevel(0); this.cloud = 0; this.hits = 0; this.strikes = 0; this.thunders = 0;
  };
  Weather.prototype.cancelThunder = function () { this.pendingThunder = -1; };
  Weather.prototype.strike = function () {
    var r = this.random, profile = profiles[this.level], u = .2 + r() * .6;
    this.strikes++; this.flashAge = 0;
    this.pendingThunder = .3 + r() * (this.level === 4 ? .45 : 1.3);
    this.nextStrike = profile.interval[0] + (profile.interval[1] - profile.interval[0]) * r();
    for (var i = 0; i < this.bolt.length; i++) {
      u += (r() - .5) * .085; this.bolt[i].u = u; this.bolt[i].v = -.02 + i * .028;
    }
    for (i = 0; i < this.branch.length; i++) {
      this.branch[i].u = this.bolt[4].u + i * .03 + (r() - .5) * .025;
      this.branch[i].v = this.bolt[4].v + i * .018;
    }
  };
  Weather.prototype.update = function (dt, low, reduced, impact, thunder) {
    dt = Math.max(0, Math.min(.08, dt));
    var profile = profiles[this.level], count = Math.round(profile.count * (low ? .45 : 1) * (reduced ? .65 : 1));
    this.cloud += (profile.cloud - this.cloud) * Math.min(1, dt * 3);
    for (var i = this.count; i < count; i++) this.seed(this.particles[i], true);
    this.count = count; this.credit = Math.min(2, this.credit + profile.impacts * (low ? .5 : 1) * dt);
    for (i = 0; i < count; i++) {
      var p = this.particles[i]; p.y += p.speed * dt;
      if (p.y >= p.v) {
        // Disturb the wave grid only when a visible streak lands, within a fixed CPU budget.
        if (this.credit >= 1 && impact) {
          this.credit--; if (impact(p.u, p.v, .065 + this.level * .018)) this.hits++;
        }
        this.seed(p, false);
      }
    }
    this.flashAge += dt;
    var age = this.flashAge;
    this.flash = Math.max(0, 1 - age / .18) + (this.level >= 3 ? Math.max(0, 1 - Math.abs(age - .25) / .09) * .55 : 0);
    if (this.pendingThunder >= 0) {
      this.pendingThunder -= dt;
      if (this.pendingThunder < 0) { this.thunders++; if (thunder) thunder(profile.thunder); }
    }
    if (profile.thunder) { this.nextStrike -= dt; if (this.nextStrike <= 0) this.strike(); }
    else this.flash = 0;
  };
  Weather.prototype.draw = function (ctx, width, height, reduced) {
    var profile = profiles[this.level];
    ctx.save(); ctx.shadowBlur = 0;
    if (this.cloud > .001) { ctx.fillStyle = 'rgba(9,24,45,' + this.cloud + ')'; ctx.fillRect(0, 0, width, height); }
    var scale = Math.min(1.6, Math.max(.7, Math.min(width, height) / 390));
    // Three depth layers: brighter, wider foreground streaks against fine distant rain.
    for (var layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      for (var i = 0; i < this.count; i++) {
        var p = this.particles[i]; if (Math.min(2, Math.floor(p.depth * 3)) !== layer) continue;
        var x = p.u * width + (p.y - p.v) * height * profile.wind, y = p.y * height;
        var length = Math.min((12 + p.depth * 17) * profile.length * scale, (p.v - p.y) * height);
        ctx.moveTo(x, y); ctx.lineTo(x - length * profile.wind, y - length);
      }
      ctx.lineWidth = (.65 + layer * .35) * scale; ctx.strokeStyle = 'rgba(13,46,61,.24)'; ctx.stroke();
      ctx.lineWidth *= .68; ctx.strokeStyle = 'rgba(220,242,255,' + (.34 + layer * .16) + ')'; ctx.stroke();
    }
    if (this.flash > 0) {
      ctx.fillStyle = 'rgba(222,237,255,' + this.flash * (reduced ? .035 : .12 + profile.thunder * .2) + ')'; ctx.fillRect(0, 0, width, height);
      if (!reduced) {
        ctx.beginPath();
        for (var part = 0; part < 2; part++) {
          var points = part ? this.branch : this.bolt;
          for (i = 0; i < points.length; i++) { x = points[i].u * width; y = points[i].v * height; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        }
        ctx.strokeStyle = 'rgba(231,244,255,' + this.flash * .85 + ')'; ctx.lineWidth = 1.3 * scale;
        ctx.shadowColor = '#bfdfff'; ctx.shadowBlur = 10; ctx.stroke();
      }
    }
    ctx.restore();
  };
  // Cached procedural buffers keep weather audio offline and avoid per-impact allocations.
  function WeatherAudio(context, output) {
    this.context = context; this.output = output; this.rain = null; this.nodes = []; this.played = 0;
    this.rainBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    this.thunderBuffer = context.createBuffer(1, Math.floor(context.sampleRate * 3.4), context.sampleRate);
    var values = this.rainBuffer.getChannelData(0), i;
    for (i = 0; i < values.length; i++) values[i] = Math.random() * 2 - 1;
    values = this.thunderBuffer.getChannelData(0); var rumble = 0;
    for (i = 0; i < values.length; i++) { rumble = rumble * .97 + (Math.random() * 2 - 1) * .03; values[i] = rumble * 3.5 + (Math.random() * 2 - 1) * .18; }
  }
  WeatherAudio.prototype.setLevel = function (level) {
    if (!level) { this.stopRain(); return; }
    var c = this.context;
    if (!this.rain) {
      var source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
      source.buffer = this.rainBuffer; source.loop = true; filter.type = 'lowpass'; gain.gain.value = 0;
      source.connect(filter); filter.connect(gain); gain.connect(this.output); source.start();
      this.rain = { source: source, filter: filter, gain: gain };
    }
    this.rain.filter.frequency.setTargetAtTime(1100 + level * 700, c.currentTime, .2);
    this.rain.gain.gain.setTargetAtTime(.025 + level * .022, c.currentTime, .2);
  };
  WeatherAudio.prototype.thunder = function (strength) {
    var c = this.context; if (c.state !== 'running' || this.nodes.length >= 2) return;
    var source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain(), t = c.currentTime;
    source.buffer = this.thunderBuffer; filter.type = 'lowpass'; filter.frequency.setValueAtTime(380 + strength * 700, t); filter.frequency.exponentialRampToValueAtTime(90, t + 3.2);
    gain.gain.setValueAtTime(.001, t); gain.gain.linearRampToValueAtTime(.24 + strength * .46, t + .055);
    gain.gain.exponentialRampToValueAtTime(.10 + strength * .18, t + .45); gain.gain.exponentialRampToValueAtTime(.001, t + 3.3);
    source.connect(filter); filter.connect(gain); gain.connect(this.output); source.start(t); source.stop(t + 3.4);
    var node = { source: source, filter: filter, gain: gain }, owner = this; this.nodes.push(node); this.played++;
    source.onended = function () { source.disconnect(); filter.disconnect(); gain.disconnect(); var index = owner.nodes.indexOf(node); if (index >= 0) owner.nodes.splice(index, 1); };
  };
  WeatherAudio.prototype.stopRain = function () {
    if (!this.rain) return;
    var node = this.rain; this.rain = null; try { node.source.stop(); } catch (error) {}
    node.source.disconnect(); node.filter.disconnect(); node.gain.disconnect();
  };
  WeatherAudio.prototype.stop = function () {
    this.stopRain();
    // A suspended context may defer onended indefinitely, so release stopped nodes now.
    for (var i = 0; i < this.nodes.length; i++) {
      var node = this.nodes[i]; node.source.onended = null;
      try { node.source.stop(); } catch (error) {}
      node.source.disconnect(); node.filter.disconnect(); node.gain.disconnect();
    }
    this.nodes.length = 0;
  };
  root.WaterWeather = { System: Weather, Audio: WeatherAudio, profiles: profiles };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.WaterWeather;
}(typeof window !== 'undefined' ? window : globalThis));
