(function () {
  'use strict';
  var palettes = [
    { sky: '#7299af', horizon: '#dce7dc', snow: '#e8f0ed', shade: '#acc4d1', pine: '#486871', sun: '#fff6d4', cloud: '#f7f4df', cloudShade: '#98b5c5' },
    { sky: '#887b9d', horizon: '#edbc9c', snow: '#eedad1', shade: '#afa3bf', pine: '#625e7b', sun: '#ffe4b2', cloud: '#ffdfbd', cloudShade: '#ab8fa9' },
    { sky: '#152942', horizon: '#496481', snow: '#8aa4bc', shade: '#4a6483', pine: '#283f58', sun: '#e0e9de', cloud: '#b7cad7', cloudShade: '#4b6486' }
  ];
  function surface(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function ellipse(ctx, x, y, rx, ry, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  function Renderer(canvas, snow, clouds) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.snow = snow; this.clouds = clouds;
    this.background = surface(1, 1); this.tracks = surface(snow.size, snow.size);
    this.trackContext = this.tracks.getContext('2d'); this.trackPixels = this.trackContext.createImageData(snow.size, snow.size);
    this.sprites = []; this.kind = ''; this.light = -1; this.revision = -1; this.width = 1; this.height = 1;
    this.surface = null; this.surfaceCanvas = surface(1, 1);
    try { this.surface = new window.NatureSurface(this.surfaceCanvas); } catch (error) { this.surface = null; }
  }
  Renderer.prototype.resize = function (width, height, low) {
    var size = window.WaterCore.bufferSize(width, height, window.devicePixelRatio, low);
    this.width = width; this.height = height; this.canvas.width = size.width; this.canvas.height = size.height;
    this.scale = size.scale; this.background.width = size.width; this.background.height = size.height;
    this.snow.aspect = width / height; this.clouds.aspect = width / height;
    this.kind = ''; this.revision = -1;
    if(this.surface)this.surface.resize(size.width,size.height,low);
  };
  Renderer.prototype.fallback = function () { if(this.surface)this.surface.destroy();this.surface=null;this.kind=''; };
  Renderer.prototype.prepare = function (kind, light) {
    this.kind = kind; this.light = light;
    if(this.surface&&!this.surface.lost)return;
    var w = this.width, h = this.height, p = palettes[light], c = this.background.getContext('2d'), rng = window.GardenNature.random(5148);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    var sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, p.sky); sky.addColorStop(.35, p.horizon); sky.addColorStop(1, p.shade);
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    var glow = c.createRadialGradient(w * .72, h * .22, 0, w * .72, h * .22, h * .28);
    glow.addColorStop(0, light === 2 ? 'rgba(221,235,255,.13)' : 'rgba(255,240,192,.45)'); glow.addColorStop(1, 'rgba(255,240,192,0)');
    c.fillStyle = glow; c.fillRect(0, 0, w, h); ellipse(c, w * .72, h * .22, 18, 18, p.sun);
    if (light === 2) for (var s = 0; s < 55; s++) ellipse(c, rng() * w, rng() * h * .48, .5 + rng(), .5 + rng(), 'rgba(235,245,248,.6)');
    // Distant layered peaks leave the central field open for touch.
    for (var layer = 0; layer < (kind === 'snow' ? 3 : 0); layer++) {
      c.beginPath(); c.moveTo(-w * .1, h * .42);
      for (var i = 0; i <= 12; i++) c.lineTo(i / 10 * w - w * .1, h * (.23 + layer * .055 - rng() * .10));
      c.lineTo(w * 1.1, h); c.lineTo(-w * .1, h); c.closePath();
      c.fillStyle = [p.shade, p.horizon, p.snow][layer]; c.fill();
    }
    if (kind === 'snow') {
      var snow = c.createLinearGradient(w * .2, h * .3, w * .8, h);
      snow.addColorStop(0, p.snow); snow.addColorStop(.5, p.snow); snow.addColorStop(1, p.shade);
      c.fillStyle = snow; c.beginPath(); c.moveTo(0, h * .34); c.bezierCurveTo(w * .3, h * .29, w * .65, h * .36, w, h * .30); c.lineTo(w, h); c.lineTo(0, h); c.fill();
      for (i = 0; i < 8; i++) {
        var y = h * (.35 + i * .095), x = (i % 2 ? .8 : .1) * w;
        var drift = c.createRadialGradient(x, y, 0, x, y, w * .65);
        drift.addColorStop(0, light === 2 ? 'rgba(181,208,226,.12)' : 'rgba(255,255,247,.45)'); drift.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = drift; c.beginPath(); c.ellipse(x, y, w * .75, h * .09, -.12, 0, Math.PI * 2); c.fill();
      }
      for (i = 0; i < 19; i++) {
        var side = i % 2, ty = h * (.31 + rng() * .49), tx = side ? w * (1 - rng() * .08) : w * rng() * .08;
        var tall = (20 + rng() * 36) * (.4 + ty / h), tw = tall * .48;
        c.fillStyle = light === 2 ? 'rgba(19,40,63,.15)' : 'rgba(67,103,126,.13)';
        c.beginPath(); c.moveTo(tx - tw, ty); c.lineTo(tx + tall * 1.5, ty + tall * .25); c.lineTo(tx + tw, ty + 3); c.fill();
        c.fillStyle = p.pine; c.fillRect(tx - 1.5, ty - tall * .6, 3, tall * .6);
        for (var branch = 0; branch < 4; branch++) {
          var by = ty - tall + branch * tall * .2, spread = tw * (.35 + branch * .21);
          c.beginPath(); c.moveTo(tx, by); c.lineTo(tx - spread, by + tall * .4); c.quadraticCurveTo(tx, by + tall * .34, tx + spread, by + tall * .4); c.closePath(); c.fillStyle = p.pine; c.fill();
          c.beginPath(); c.moveTo(tx, by); c.lineTo(tx - spread * .78, by + tall * .3); c.quadraticCurveTo(tx, by + tall * .22, tx + spread * .78, by + tall * .3); c.closePath(); c.fillStyle = p.snow; c.fill();
        }
      }
      for (i = 0; i < 3600; i++) { c.fillStyle = i % 3 ? 'rgba(255,255,255,.19)' : 'rgba(64,103,135,.055)'; c.fillRect(rng() * w, (.33 + rng() * .67) * h, .6 + rng(), .6); }
    } else {
      // A deep blue gap below the cloud sea makes opening the clouds legible.
      var depth = c.createLinearGradient(0, h * .3, 0, h); depth.addColorStop(0, p.horizon); depth.addColorStop(.6, p.sky); depth.addColorStop(1, p.shade);
      c.fillStyle = depth; c.fillRect(0, h * .36, w, h * .64);
      this.sprites.length = 0;
      for (s = 0; s < 4; s++) {
        var sprite = surface(256, 180), sc = sprite.getContext('2d'), sr = window.GardenNature.random(310 + s * 51);
        // Bake a continuous density volume, so overlapping lobes have no dark circular outlines.
        var lobes = [], density = new Float32Array(256 * 180);
        for (i = 0; i < 10; i++) lobes.push({ x: 49 + sr() * 156, y: 66 + sr() * 42, r: 23 + sr() * 25 });
        for (var py = 0; py < 180; py++) for (var px = 0; px < 256; px++) {
          var value = 0;
          for (var li = 0; li < lobes.length; li++) {
            var lobe = lobes[li], lx = (px - lobe.x) / lobe.r, ly = (py - lobe.y) / (lobe.r * .8);
            value += Math.exp(-(lx * lx + ly * ly) * 2);
          }
          density[py * 256 + px] = value;
        }
        var pixels = sc.createImageData(256, 180), high = p.cloud.match(/\w\w/g).map(function (v) { return parseInt(v, 16); }), low = p.cloudShade.match(/\w\w/g).map(function (v) { return parseInt(v, 16); });
        for (py = 1; py < 179; py++) for (px = 1; px < 255; px++) {
          var at = py * 256 + px, den = density[at], alpha = Math.max(0, Math.min(1, (den - .07) / .5));
          var slope = density[at + 256] - density[at - 256] + (density[at + 1] - density[at - 1]) * .55;
          var lit = Math.max(.3, Math.min(1, .72 + slope * 1.7 + Math.min(.14, den * .08) - (py - 85) * .002));
          for (var channel = 0; channel < 3; channel++) pixels.data[at * 4 + channel] = low[channel] + (high[channel] - low[channel]) * lit;
          pixels.data[at * 4 + 3] = alpha * alpha * (3 - 2 * alpha) * 255;
        }
        sc.putImageData(pixels, 0, 0);
        this.sprites.push(sprite);
      }
    }
    this.revision = -1;
  };
  Renderer.prototype.drawTracks = function () {
    var n = this.snow.size, d = this.snow.depth, pixels = this.trackPixels.data, moon = this.light === 2;
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var at = y * n + x, z = d[at], normal = (d[y * n + Math.max(0, x - 1)] - d[y * n + Math.min(n - 1, x + 1)]) * .65 + (d[Math.max(0, y - 1) * n + x] - d[Math.min(n - 1, y + 1) * n + x]);
      var shade = z * .25 - normal * 1.05, k = at * 4, bright = shade < 0;
      pixels[k] = bright ? 255 : moon ? 31 : 68;
      pixels[k + 1] = bright ? 255 : moon ? 53 : 112;
      pixels[k + 2] = bright ? 245 : moon ? 86 : 148;
      pixels[k + 3] = Math.min(190, Math.abs(shade) * 255);
    }
    this.trackContext.putImageData(this.trackPixels, 0, 0); this.revision = this.snow.revision;
  };
  Renderer.prototype.draw = function (kind, light, time, weather, reduced) {
    if (kind !== this.kind || light !== this.light) this.prepare(kind, light);
    var c = this.ctx, w = this.width, h = this.height, p = palettes[light];
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0); c.globalAlpha = 1;
    var solid=this.surface&&this.surface.draw(kind,light,this.snow,this.clouds);
    if(this.surface&&!solid){this.surface.destroy();this.surface=null;this.prepare(kind,light);}
    if(solid)c.drawImage(this.surfaceCanvas,0,0,w,h);
    else c.drawImage(this.background, 0, 0, w, h);
    if (kind === 'snow') {
      if(!solid){if (this.revision !== this.snow.revision) this.drawTracks();c.drawImage(this.tracks, 0, 0, w, h);}
      for (var i = 0; i < this.snow.balls.length; i++) {
        var ball = this.snow.balls[i], r = ball.radius * h, x = ball.u * w, y = ball.v * h;
        ellipse(c, x + r * .4, y + r * .25, r * 1.3, r * .45, 'rgba(39,69,98,.22)');
        var g = c.createRadialGradient(x - r * .35, y - r * .62, r * .05, x, y - r * .25, r * 1.1);
        g.addColorStop(0, p.snow); g.addColorStop(.5, p.snow); g.addColorStop(1, p.shade);
        ellipse(c, x, y - r * .45, r, r * .96, g);
        c.strokeStyle = light === 2 ? 'rgba(215,237,246,.2)' : 'rgba(255,255,255,.55)'; c.lineWidth = 1;
        c.beginPath(); c.ellipse(x, y - r * .45, r * .67, r * .85, ball.turn, .6, 2.2); c.stroke();
      }
      if (weather && !reduced) for (i = 0; i < 70; i++) {
        var fx = ((i * 127.1 + Math.sin(time * .4 + i) * 24 + time * 10) % (w + 30) + w + 30) % (w + 30) - 15;
        var fy = (i * 91.3 + time * (13 + i % 5 * 5)) % h;
        ellipse(c, fx, fy, .8 + i % 3 * .55, .8 + i % 3 * .55, 'rgba(255,255,249,.75)');
      }
    } else if(!solid) {
      var items = this.clouds.items, clock = this.clouds.time;
      for (i = 0; i < items.length; i++) {
        var cloud = items[i], size = cloud.size * Math.min(w, h) * 3.1;
        c.globalAlpha = cloud.opacity * .82;
        c.drawImage(this.sprites[cloud.seed], cloud.u * w - size * .5, cloud.v * h - size * .35 + Math.sin(clock * .25 + cloud.phase) * (reduced ? 0 : 4), size, size * .7);
      }
      c.globalAlpha = 1;
    }
  };
  window.NatureRenderer = Renderer;
}());
