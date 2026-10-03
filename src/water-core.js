(function (root) {
  'use strict';
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function shore(u, v) {
    var x = (u - 0.5) / 0.465, y = (v - 0.49) / 0.35;
    var angle = Math.atan2(y, x);
    return Math.sqrt(x * x + y * y) - (1 + 0.048 * Math.sin(angle * 5 + 0.7) + 0.024 * Math.sin(angle * 9 - 0.5) + 0.04 * Math.cos(angle * 3));
  }
  function WaveField(width, height, aspect) {
    this.width = width; this.height = height; this.aspect = aspect || 1;
    this.current = new Float32Array(width * height);
    this.previous = new Float32Array(width * height);
    this.next = new Float32Array(width * height);
    this.mask = new Uint8Array(width * height);
    this.depthScale = new Float32Array(width * height); this.depthScale.fill(1);
    this.pixels = new Uint8Array(width * height * 4);
    this.steps = 0;
    this.ice = new IceField(width, height, this.aspect);
    for (var y = 0; y < height; y++) for (var x = 0; x < width; x++) this.mask[y * width + x] = shore(x / (width - 1), y / (height - 1)) < -0.007 ? 1 : 0;
    var ratio = height * this.aspect / width;
    this.cx = 0.46 / Math.max(1, ratio * ratio);
    this.cy = this.cx * ratio * ratio;
  }
  WaveField.prototype.setBathymetry = function (bed) {
    this.bathymetry=bed;this.ice.mask=this.mask;
    for(var y=0;y<this.height;y++)for(var x=0;x<this.width;x++) {
      var u=x/(this.width-1),v=y/(this.height-1),i=y*this.width+x,depth=-bed.heightAt(u,v);
      this.mask[i]=shore(u,v)<-.007&&depth>.002?1:0;
      this.depthScale[i]=clamp(depth/.16,.15,1);
      if(!this.mask[i]){this.current[i]=0;this.previous[i]=0;this.next[i]=0;this.ice.current[i]=0;this.ice.target[i]=0;this.ice.delay[i]=0;}
    }
  };
  WaveField.prototype.disturb = function (u, v, strength, radius) {
    if (!Number.isFinite(u) || !Number.isFinite(v) || !Number.isFinite(strength) || shore(u, v) >= -0.012 || this.ice.sample(u, v) > .45) return false;
    var centerX=Math.round(u*(this.width-1)),centerY=Math.round(v*(this.height-1));
    if(!this.mask[centerY*this.width+centerX])return false;
    radius = radius || 0.025;
    var rx = radius / this.aspect, ry = radius;
    var x0 = Math.max(1, Math.floor((u - rx * 2) * this.width)), x1 = Math.min(this.width - 2, Math.ceil((u + rx * 2) * this.width));
    var y0 = Math.max(1, Math.floor((v - ry * 2) * this.height)), y1 = Math.min(this.height - 2, Math.ceil((v + ry * 2) * this.height));
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var i = y * this.width + x;
      if (!this.mask[i] || this.ice.current[i] > .45) continue;
      // A finger's brush must not inject a second wave through the other side of a stone.
      var steps=Math.max(Math.abs(x-centerX),Math.abs(y-centerY)),blocked=false;
      for(var n=1;n<steps;n++)if(!this.mask[Math.round(centerY+(y-centerY)*n/steps)*this.width+Math.round(centerX+(x-centerX)*n/steps)]){blocked=true;break;}
      if(blocked)continue;
      var dx = (x / (this.width - 1) - u) / rx, dy = (y / (this.height - 1) - v) / ry;
      var d = dx * dx + dy * dy;
      if (d < 4) this.current[i] = clamp(this.current[i] + strength * Math.exp(-d * 2), -0.95, 0.95);
    }
    return true;
  };
  WaveField.prototype.stroke = function (u0, v0, u1, v1, strength) {
    var dx = (u1 - u0) * this.aspect, dy = v1 - v0;
    var distance = Math.sqrt(dx * dx + dy * dy);
    var count = Math.min(24, Math.max(1, Math.ceil(distance / 0.009)));
    for (var n = 1; n <= count; n++) this.disturb(u0 + (u1 - u0) * n / count, v0 + (v1 - v0) * n / count, strength, 0.015);
  };
  WaveField.prototype.step = function () {
    var w = this.width, h = this.height, a = this.current, b = this.previous, c = this.next, mask = this.mask, speed = this.depthScale;
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) {
      var i = y * w + x;
      if (!mask[i] || this.ice.current[i] > .7) { c[i] = 0; continue; }
      var center = a[i];
      var left = mask[i - 1] && this.ice.current[i - 1] < .7 ? a[i - 1] : center, right = mask[i + 1] && this.ice.current[i + 1] < .7 ? a[i + 1] : center;
      var top = mask[i - w] && this.ice.current[i - w] < .7 ? a[i - w] : center, bottom = mask[i + w] && this.ice.current[i + w] < .7 ? a[i + w] : center;
      var lapX=Math.min(speed[i],speed[i-1])*(left-center)+Math.min(speed[i],speed[i+1])*(right-center);
      var lapY=Math.min(speed[i],speed[i-w])*(top-center)+Math.min(speed[i],speed[i+w])*(bottom-center);
      c[i] = clamp((2 * center - b[i] + this.cx * lapX + this.cy * lapY) * 0.987, -0.97, 0.97);
    }
    this.previous = a; this.current = c; this.next = b; this.steps++;
  };
  WaveField.prototype.pack = function () {
    for (var i = 0; i < this.current.length; i++) {
      // Two bytes preserve small wave normals after the large splash has settled.
      var code = Math.round((clamp(this.current[i], -1, 1) * 0.5 + 0.5) * 65535), p = i * 4;
      this.pixels[p] = code >> 8; this.pixels[p + 1] = code & 255;
      this.pixels[p + 2] = Math.round(this.ice.current[i] * 255); this.pixels[p + 3] = 255;
    }
    return this.pixels;
  };
  WaveField.prototype.sample = function (u, v) {
    var x = clamp(u * (this.width - 1), 1, this.width - 2), y = clamp(v * (this.height - 1), 1, this.height - 2);
    var ix = Math.floor(x), iy = Math.floor(y), i = iy * this.width + ix, tx = x - ix, ty = y - iy;
    return (this.current[i] * (1 - tx) + this.current[i + 1] * tx) * (1 - ty) + (this.current[i + this.width] * (1 - tx) + this.current[i + this.width + 1] * tx) * ty;
  };
  WaveField.prototype.energy = function () {
    var total = 0;
    for (var i = 0; i < this.current.length; i++) { var v = this.current[i] - this.previous[i]; total += this.current[i] * this.current[i] + v * v; }
    return total;
  };
  WaveField.prototype.clear = function () { this.current.fill(0); this.previous.fill(0); this.next.fill(0); };
  // Fixed-size ice state shares the water grid. Delayed cells form a growing front;
  // cutting a cell cancels its scheduled freeze, so a broken hole cannot regrow.
  function IceField(width, height, aspect) {
    this.width = width; this.height = height; this.aspect = aspect;
    this.current = new Float32Array(width * height);
    this.target = new Uint8Array(width * height);
    this.delay = new Float32Array(width * height);
  }
  IceField.prototype.sample = function (u, v, planned) {
    var x = clamp(Math.round(u * (this.width - 1)), 0, this.width - 1), y = clamp(Math.round(v * (this.height - 1)), 0, this.height - 1);
    return (planned ? this.target : this.current)[y * this.width + x];
  };
  IceField.prototype.paint = function (u, v, radius, freeze, all) {
    if (!Number.isFinite(u) || !Number.isFinite(v) || !(radius > 0)) return;
    for (var y = 0; y < this.height; y++) for (var x = 0; x < this.width; x++) {
      var px = x / (this.width - 1), py = y / (this.height - 1), i = y * this.width + x;
      if (shore(px, py) >= -.007 || (this.mask && !this.mask[i])) continue;
      var dx = (px - u) * this.aspect, dy = py - v, angle = Math.atan2(dy, dx);
      var distance = Math.sqrt(dx * dx + dy * dy), phase = u * 72 + v * 43;
      var edge = radius * (1 + .13 * Math.cos(angle * 3 + phase) + .065 * Math.sin(angle * 7 - phase));
      if (!all) {
        var sector = (angle + Math.PI) / (Math.PI * 2) * 10, corner = Math.floor(sector), blend = sector - corner;
        var r0 = 1 + .18 * Math.sin(corner * 12.989 + phase), r1 = 1 + .18 * Math.sin(((corner + 1) % 10) * 12.989 + phase);
        edge = radius * (r0 + (r1 - r0) * blend) * .95106 / Math.cos((blend - .5) * Math.PI * .2);
      }
      if (!all && distance > edge) continue;
      if (freeze) {
        if (!this.target[i]) { this.target[i] = 1; this.delay[i] = all ? distance * .85 : distance / radius * .48; }
      } else { this.target[i] = 0; this.delay[i] = 0; if (!all) this.current[i] = 0; }
    }
  };
  IceField.prototype.update = function (dt) {
    dt = clamp(dt, 0, .1);
    for (var i = 0; i < this.current.length; i++) {
      if (this.delay[i] > 0) { this.delay[i] = Math.max(0, this.delay[i] - dt); continue; }
      var value = this.current[i], target = this.target[i];
      this.current[i] = target ? Math.min(1, value + dt * 2.8) : Math.max(0, value - dt * .85);
    }
  };
  IceField.prototype.coverage = function () {
    var wet = 0, frozen = 0;
    for (var y = 0; y < this.height; y++) for (var x = 0; x < this.width; x++) if (shore(x / (this.width - 1), y / (this.height - 1)) < -.007 && (!this.mask || this.mask[y*this.width+x])) { wet++; frozen += this.current[y * this.width + x]; }
    return frozen / Math.max(1, wet);
  };
  IceField.prototype.restore = function (old) {
    if (!old) return;
    for (var y = 0; y < this.height; y++) for (var x = 0; x < this.width; x++) {
      var u = x / (this.width - 1), v = y / (this.height - 1), i = y * this.width + x;
      if (shore(u, v) >= -.007) continue;
      var j = Math.round(v * (old.height - 1)) * old.width + Math.round(u * (old.width - 1));
      this.current[i] = old.current[j]; this.target[i] = old.target[j]; this.delay[i] = old.delay[j];
    }
  };
  IceField.prototype.clear = function () { this.current.fill(0); this.target.fill(0); this.delay.fill(0); };
  function bufferSize(width, height, dpr, low) {
    var scale = Math.min(dpr || 1, low ? 1 : 1.5), budget = low ? 1000000 : 2000000;
    scale = Math.min(scale, Math.sqrt(budget / Math.max(1, width * height)));
    return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale: scale };
  }
  function seededRandom(seed) {
    return function () { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function waterMesh(aspect, low) {
    var nx = low ? 64 : 128, ny = low ? 64 : 128;
    if (aspect < 1) nx = Math.max(32, Math.round(nx * aspect)); else ny = Math.max(32, Math.round(ny / aspect));
    var count = (nx + 1) * (ny + 1), vertices = new Float32Array(count * 5), dynamics = new Float32Array(count * 2), indices = new Uint16Array(nx * ny * 6), at = 0;
    for (var y = 0; y <= ny; y++) for (var x = 0; x <= nx; x++) {
      var i = y * (nx + 1) + x, u = x / nx, v = y / ny;
      vertices[i * 5] = (u - .5) * aspect * 2; vertices[i * 5 + 1] = 0;
      vertices[i * 5 + 2] = (v - .5) * 2 / .8660254; vertices[i * 5 + 3] = u; vertices[i * 5 + 4] = v;
      if (x < nx && y < ny) { indices[at++] = i; indices[at++] = i + nx + 1; indices[at++] = i + 1; indices[at++] = i + 1; indices[at++] = i + nx + 1; indices[at++] = i + nx + 2; }
    }
    return { nx: nx, ny: ny, vertices: vertices, dynamics: dynamics, indices: indices, count: count };
  }
  function updateMesh(mesh, field) {
    for (var i = 0; i < mesh.count; i++) {
      var u = mesh.vertices[i * 5 + 3], v = mesh.vertices[i * 5 + 4], ice = field.ice.sample(u,v);
      mesh.dynamics[i * 2] = field.sample(u,v) * (1 - ice); mesh.dynamics[i * 2 + 1] = ice;
    }
  }
  root.WaterCore = { WaveField: WaveField, IceField: IceField, shore: shore, clamp: clamp, bufferSize: bufferSize, seededRandom: seededRandom, waterMesh: waterMesh, updateMesh: updateMesh };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.WaterCore;
}(typeof window !== 'undefined' ? window : global));
