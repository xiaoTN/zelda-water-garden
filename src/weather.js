(function (root) {
  'use strict';
  // Visual presets, not meteorological rainfall measurements. Timing uses simulation time.
  var profiles = [
    { name: '停雨', count: 0, speed: 0, length: 0, wind: 0, cloud: 0, impacts: 0, thunder: 0 },
    { name: '小雨', count: 48, speed: .85, length: .8, wind: .02, cloud: .035, impacts: 20, thunder: 0 },
    { name: '中雨', count: 168, speed: 1.1, length: 1, wind: .035, cloud: .075, impacts: 100, thunder: .38, interval: [18, 30] },
    { name: '大雨', count: 420, speed: 1.45, length: 1.2, wind: .05, cloud: .14, impacts: 280, thunder: .68, interval: [8, 14] },
    { name: '暴雨', count: 840, speed: 1.85, length: 1.4, wind: .07, cloud: .23, impacts: 640, thunder: 1, interval: [2.8, 5.6] }
  ];
  function Weather(random) {
    this.random = random || Math.random; this.level = 0; this.count = 0; this.cloud = 0; this.credit = 0;
    this.flashAge = 10; this.flash = 0; this.nextStrike = Infinity; this.pendingThunder = -1;
    this.hits = 0; this.strikes = 0; this.thunders = 0; this.particles = [];
    for (var i = 0; i < profiles[4].count; i++) this.particles.push({ u: 0, v: 0, altitude: 0, span: 0, speed: 0, depth: 0 });
  }
  Weather.prototype.seed = function (p, warm) {
    var r = this.random, profile = profiles[this.level];
    p.u = r() * 1.08 - .04; p.v = r() * 1.08 - .04; p.depth = r(); p.span = .3 + r() * .4;
    p.altitude = p.span * (warm ? r() : 1); p.speed = profile.speed * (.8 + p.depth * .6);
  };
  // Looking down: height magnifies distance from the optical center. At height zero,
  // every ray meets its exact water-space landing coordinate, in any viewport aspect.
  function project(u, v, altitude, wind, out) {
    var perspective = 1 / (1 - Math.min(.88, Math.max(0, altitude)) * .58);
    out.u = .5 + (u - .5) * perspective + wind * altitude;
    out.v = .49 + (v - .49) * perspective;
    return out;
  }
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
    var r = this.random, profile = profiles[this.level];
    this.strikes++; this.flashAge = 0;
    this.pendingThunder = .3 + r() * (this.level === 4 ? .45 : 1.3);
    this.nextStrike = profile.interval[0] + (profile.interval[1] - profile.interval[0]) * r();
  };
  Weather.prototype.update = function (dt, low, reduced, impact, thunder) {
    dt = Math.max(0, Math.min(.08, dt));
    var profile = profiles[this.level], count = Math.round(profile.count * (low ? .4 : 1) * (reduced ? .45 : 1));
    this.cloud += (profile.cloud - this.cloud) * Math.min(1, dt * 3);
    for (var i = this.count; i < count; i++) this.seed(this.particles[i], true);
    // Cover the maximum .08s update without throttling dense storms at slower frame rates.
    this.count = count; this.credit = Math.min(low ? 24 : 56, this.credit + profile.impacts * (low ? .4 : 1) * dt);
    for (i = 0; i < count; i++) {
      var p = this.particles[i]; p.altitude -= p.speed * dt;
      if (p.altitude <= 0) {
        // Every accepted landing adds a local, short-lived ripple to the water surface.
        if (this.credit >= 1 && impact) {
          if (impact(p.u, p.v, .075 + this.level * .018 + p.depth * .025)) {
            this.credit--; this.hits++;
          }
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
  var head = { u: 0, v: 0 }, tail = { u: 0, v: 0 };
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
        project(p.u, p.v, p.altitude, profile.wind, head);
        project(p.u, p.v, p.altitude + p.speed * .022 * profile.length, profile.wind, tail);
        var x = head.u * width, y = head.v * height, tx = tail.u * width, ty = tail.v * height;
        // Near the optical center, a vertically falling drop is a bead rather than a side-view line.
        if (Math.abs(tx - x) + Math.abs(ty - y) < 1.4) { ctx.moveTo(x + .55 * scale, y); ctx.arc(x, y, .55 * scale, 0, Math.PI * 2); }
        else { ctx.moveTo(x, y); ctx.lineTo(tx, ty); }
      }
      ctx.lineWidth = (.65 + layer * .35) * scale; ctx.strokeStyle = 'rgba(13,46,61,.24)'; ctx.stroke();
      ctx.lineWidth *= .68; ctx.strokeStyle = 'rgba(220,242,255,' + (.34 + layer * .16) + ')'; ctx.stroke();
    }
    if (this.flash > 0) {
      ctx.fillStyle = 'rgba(222,237,255,' + this.flash * (reduced ? .035 : .12 + profile.thunder * .2) + ')'; ctx.fillRect(0, 0, width, height);
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
  root.WaterWeather = { System: Weather, Audio: WeatherAudio, profiles: profiles, project: project };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.WaterWeather;
}(typeof window !== 'undefined' ? window : globalThis));
