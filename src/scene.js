(function (root) {
  'use strict';
  var core = root.WaterCore;
  function makeScene(aspect, flatRocks) {
    var canvas = document.createElement('canvas');
    canvas.width = aspect >= 1 ? 1024 : Math.max(256, Math.round(1024 * aspect));
    canvas.height = aspect >= 1 ? Math.max(256, Math.round(1024 / aspect)) : 1024;
    var ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, unit = Math.min(w, h), random = core.seededRandom(73283);
    var data = ctx.createImageData(w, h), pixels = data.data, noise = new Float32Array(33 * 33);
    for (var i = 0; i < noise.length; i++) noise[i] = random();
    function softNoise(x, y) {
      x = x * 30; y = y * 30;
      var ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      var at = iy * 33 + ix;
      return (noise[at] * (1 - tx) + noise[at + 1] * tx) * (1 - ty) + (noise[at + 33] * (1 - tx) + noise[at + 34] * tx) * ty;
    }
    var bankPixel = Math.max(1 / (w * .465), 1 / (h * .35));
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var u = x / w, v = y / h, d = core.shore(u, v), n = softNoise(u, v), grain = 0, p = (y * w + x) * 4;
      var r, g, b;
      if (d < -bankPixel) {
        var shallow = Math.exp(d * 6.5), sand = 12 * n + grain;
        r = 108 + 53 * shallow + sand; g = 123 + 43 * shallow + sand; b = 91 + 38 * shallow + sand;
      } else {
        var bank = core.clamp(1 - d / 0.12, 0, 1), earth = core.clamp(1 - d / 0.21, 0, 1), variation = Math.floor(n * 4) * 7;
        r = 46 + 69 * bank + 12 * earth + variation * 0.68; g = 75 + 42 * bank + 9 * earth + variation; b = 37 + 31 * bank + 9 * earth + variation * 0.58;
        if (d < bankPixel) {
          var edge = core.clamp((d + bankPixel) / (2 * bankPixel), 0, 1); edge = edge * edge * (3 - 2 * edge);
          var wet = Math.exp(Math.min(0, d) * 6.5), wetSand = 12 * n + grain;
          r = (108 + 53 * wet + wetSand) * (1 - edge) + r * edge;
          g = (123 + 43 * wet + wetSand) * (1 - edge) + g * edge;
          b = (91 + 38 * wet + wetSand) * (1 - edge) + b * edge;
        }
      }
      pixels[p] = r; pixels[p + 1] = g; pixels[p + 2] = b; pixels[p + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    // The sand, pebbles and banks are original procedural artwork. No remote assets.
    for (i = 0; i < 500; i++) {
      var px = random() * w, py = random() * h, shore = core.shore(px / w, py / h);
      if (shore > 0.14 || (shore < -0.45 && random() > 0.1)) continue;
      var s = (0.6 + random() * 2.2) * unit / 600, shade = Math.floor(100 + random() * 44);
      ctx.fillStyle = shore < 0 ? 'rgba(' + shade + ',' + (shade + 7) + ',' + (shade - 13) + ',.48)' : 'rgba(186,180,138,.3)';
      ctx.beginPath(); ctx.ellipse(px, py, s * 1.7, s, random() * 3, 0, Math.PI * 2); ctx.fill();
    }
    function rock(px, py, size, angle, submerged) {
      var points = [], count = 7;
      for (var k = 0; k < count; k++) {
        var a = angle + k / count * Math.PI * 2, rr = size * (0.8 + random() * 0.35);
        points.push([px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.69]);
      }
      if (!flatRocks) return;
      ctx.save();
      ctx.shadowColor = submerged ? 'rgba(17,74,62,.28)' : 'rgba(8,24,18,.65)'; ctx.shadowBlur = size * .3; ctx.shadowOffsetY = size * .25;
      ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); for (k = 1; k < count; k++) ctx.lineTo(points[k][0], points[k][1]); ctx.closePath();
      var gradient = ctx.createLinearGradient(px - size, py - size, px + size, py + size);
      gradient.addColorStop(0, submerged ? '#a5af90' : '#acb19a'); gradient.addColorStop(.35, submerged ? '#8e9b7c' : '#828d75'); gradient.addColorStop(1, submerged ? '#536d59' : '#4a5c4c');
      ctx.fillStyle = gradient; ctx.fill(); ctx.shadowColor = 'transparent';
      for (k = 0; k < count; k++) {
        ctx.beginPath(); ctx.moveTo(px - size * .16, py - size * .15); ctx.lineTo(points[k][0], points[k][1]); ctx.lineTo(points[(k + 1) % count][0], points[(k + 1) % count][1]); ctx.closePath();
        ctx.fillStyle = k < 3 ? 'rgba(222,223,182,' + (0.04 + random() * .09) + ')' : 'rgba(12,44,31,' + (random() * .13) + ')'; ctx.fill();
      }
      if (!submerged && random() > .3) {
        ctx.fillStyle = 'rgba(104,134,66,.55)'; ctx.beginPath(); ctx.ellipse(px - size * .2, py - size * .31, size * .45, size * .18, -.4, 0, 6.28); ctx.fill();
      }
      ctx.restore();
    }
    for (i = 0; i < 145; i++) {
      var angle = random() * Math.PI * 2;
      var edge = 1 + .048 * Math.sin(angle * 5 + .7) + .024 * Math.sin(angle * 9 - .5) + .04 * Math.cos(angle * 3);
      var radius = edge + .025 + random() * .105;
      var ru = .5 + Math.cos(angle) * .465 * radius, rv = .49 + Math.sin(angle) * .35 * radius;
      rock(ru * w, rv * h, (4 + random() * 17) * unit / 500, random() * 6, false);
    }
    for (i = 0; i < 36; i++) {
      var su = .08 + random() * .84, sv = .16 + random() * .64, sd = core.shore(su, sv);
      if (sd < -.07 && sd > -.42) rock(su * w, sv * h, (2 + random() * 5) * unit / 500, random() * 6, true);
    }
    // Layered blades and fern fronds keep the bank lush without loading models.
    for (i = 0; i < 1200; i++) {
      var gu = random(), gv = random(), gd = core.shore(gu, gv);
      if (gd < .085 || gd > .7) continue;
      var gx = gu * w, gy = gv * h, length = (3 + random() * 13) * unit / 500;
      var lean = (random() - .5) * length;
      ctx.strokeStyle = ['#567249', '#6a8250', '#3b5d40', '#7b8c53', '#405d38'][Math.floor(random() * 5)];
      ctx.lineWidth = (.5 + random()) * unit / 700;
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.quadraticCurveTo(gx + lean * .2, gy - length * .7, gx + lean, gy - length); ctx.stroke();
    }
    function fern(u, v, scale, rotation) {
      ctx.save(); ctx.translate(u * w, v * h); ctx.rotate(rotation);
      for (var frond = -2; frond <= 2; frond++) {
        ctx.save(); ctx.rotate(frond * .48);
        var len = scale * unit / 500, segments = 9;
        ctx.strokeStyle = '#789759'; ctx.lineWidth = .65 * unit / 500;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * .3, -len * .55, len * .13, -len); ctx.stroke();
        for (var j = 1; j < segments; j++) {
          var yy = -len * j / segments, xx = len * .15 * Math.sin(j / segments * 3.14), leaf = len * .22 * Math.sin(j / segments * 3.14);
          for (var side = -1; side <= 1; side += 2) {
            ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + leaf * side * .85, yy + leaf * .13, xx + leaf * side, yy - leaf * .5); ctx.quadraticCurveTo(xx + leaf * side * .6, yy - leaf * .48, xx, yy - 1.5);
            ctx.fillStyle = side === -1 ? '#6b8c53' : '#3f6b44'; ctx.fill();
          }
        }
        ctx.restore();
      }
      ctx.restore();
    }
    fern(.07, .28, 70, -.4); fern(.95, .68, 76, .7); fern(.16, .88, 48, -.2); fern(.83, .12, 50, .7);
    // Soft canopy shadows are baked once, then the water refracts them in real time.
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    for (i = 0; i < 32; i++) {
      var sx = random() * w, sy = random() * h, sr = (.04 + random() * .07) * unit;
      if (core.shore(sx / w, sy / h) < -.2) continue;
      var shadow = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2);
      shadow.addColorStop(0, 'rgba(31,62,43,.34)'); shadow.addColorStop(1, 'rgba(31,62,43,0)');
      ctx.fillStyle = shadow; ctx.fillRect(sx - sr * 2, sy - sr * 2, sr * 4, sr * 4);
    }
    ctx.restore();
    return canvas;
  }
  var noiseCanvas = null;
  function makeNoise() {
    if (noiseCanvas) return noiseCanvas;
    var size = 256, random = core.seededRandom(57812), grids = [], frequencies = [4,8,16,32,64];
    for (var k = 0; k < frequencies.length; k++) {
      var n = frequencies[k], grid = new Float32Array(n * n);
      for (var i = 0; i < grid.length; i++) grid[i] = random();
      grids.push(grid);
    }
    function noise(u, v, level) {
      var n = frequencies[level], x = u * n, y = v * n, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, g = grids[level];
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      var a = g[(iy % n) * n + ix % n], b = g[(iy % n) * n + (ix + 1) % n], c = g[((iy + 1) % n) * n + ix % n], d = g[((iy + 1) % n) * n + (ix + 1) % n];
      return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    }
    var heights = new Float32Array(size * size);
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) heights[y * size + x] = noise(x / size, y / size, 1) * .58 + noise(x / size, y / size, 2) * .27 + noise(x / size, y / size, 3) * .11 + noise(x / size, y / size, 4) * .04;
    noiseCanvas = document.createElement('canvas'); noiseCanvas.width = size; noiseCanvas.height = size;
    var context = noiseCanvas.getContext('2d'), image = context.createImageData(size, size);
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
      var p = (y * size + x) * 4;
      var dx = heights[y * size + (x + 1) % size] - heights[y * size + (x + size - 1) % size];
      var dy = heights[((y + 1) % size) * size + x] - heights[((y + size - 1) % size) * size + x];
      image.data[p] = core.clamp(.5 + dx * 12, 0, 1) * 255; image.data[p + 1] = core.clamp(.5 + dy * 12, 0, 1) * 255;
      image.data[p + 2] = noise(x / size, y / size, 0) * 255; image.data[p + 3] = noise(x / size, y / size, 2) * 255;
    }
    context.putImageData(image, 0, 0);
    return noiseCanvas;
  }
  root.WaterScene = { create: makeScene, createNoise: makeNoise };
}(window));
