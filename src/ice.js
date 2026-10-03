(function (root) {
  'use strict';
  var core = root.WaterCore, texture, textureAspect = 0;
  // R: branching white seams. G: small glints. B: broad blue crystal facets.
  function createTexture(aspect) {
    aspect = aspect || 1;
    if (texture && Math.abs(textureAspect - aspect) < .001) return texture;
    textureAspect = aspect; texture = document.createElement('canvas');
    texture.width = aspect >= 1 ? 1024 : Math.max(256, Math.round(1024 * aspect));
    texture.height = aspect >= 1 ? Math.max(256, Math.round(1024 / aspect)) : 1024;
    var c = texture.getContext('2d'), w = texture.width, h = texture.height, scale = Math.min(w,h), random = core.seededRandom(78342);
    var seeds = [], step = scale * .065;
    for (var y = -step; y < h + step; y += step) for (var x = -step; x < w + step; x += step) seeds.push([x + random()*step, y + random()*step]);
    c.fillStyle = 'rgb(0,0,120)'; c.fillRect(0,0,w,h);
    for (var i = 0; i < seeds.length; i++) {
      var seed = seeds[i], poly = [[0,0],[w,0],[w,h],[0,h]];
      for (var j = 0; j < seeds.length && poly.length; j++) {
        if (i === j) continue;
        var other = seeds[j], nx = other[0]-seed[0], ny = other[1]-seed[1];
        if (nx*nx+ny*ny > step*step*12) continue;
        var mid = (other[0]*other[0]+other[1]*other[1]-seed[0]*seed[0]-seed[1]*seed[1])*.5, clipped = [];
        for (var k = 0; k < poly.length; k++) {
          var a = poly[k], b = poly[(k+1)%poly.length], da = a[0]*nx+a[1]*ny-mid, db = b[0]*nx+b[1]*ny-mid;
          if (da <= 0) clipped.push(a);
          if ((da <= 0) !== (db <= 0)) { var t = da/(da-db); clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]); }
        }
        poly = clipped;
      }
      if (!poly.length) continue;
      c.beginPath(); c.moveTo(poly[0][0],poly[0][1]);
      for (j = 1; j < poly.length; j++) c.lineTo(poly[j][0],poly[j][1]);
      c.closePath();
      var shade = 60 + Math.floor(random()*110), gradient = c.createLinearGradient(seed[0]-step*.5,seed[1]-step,seed[0]+step*.6,seed[1]+step);
      gradient.addColorStop(0,'rgb(0,0,'+(shade+55)+')'); gradient.addColorStop(1,'rgb(0,0,'+shade+')');
      c.fillStyle = gradient; c.fill();
      c.beginPath();
      for (j = 0; j < poly.length; j++) {
        var pa = poly[j], pb = poly[(j+1)%poly.length], mx = (pa[0]+pb[0])*.5, my = (pa[1]+pb[1])*.5;
        var bend = Math.sin(mx*.17+my*.11)*step*.12;
        c.moveTo(pa[0],pa[1]); c.lineTo(mx+bend,my-bend*.7); c.lineTo(pb[0],pb[1]);
      }
      c.strokeStyle = 'rgba(235,0,200,.18)'; c.lineWidth = scale*.0055; c.stroke();
      c.strokeStyle = 'rgba(255,0,200,.32)'; c.lineWidth = scale*.0016; c.stroke();
      // A few interior slivers interrupt the cell pattern without a uniform tiled grid.
      if (i%3 === 0) {
        c.beginPath(); c.moveTo(poly[0][0],poly[0][1]); c.lineTo(seed[0],seed[1]); c.lineTo(poly[Math.floor(poly.length/2)][0],poly[Math.floor(poly.length/2)][1]);
        c.strokeStyle = 'rgba(220,0,180,.22)'; c.lineWidth = scale*.0015; c.stroke();
      }
    }
    c.globalCompositeOperation = 'lighter';
    for (i = 0; i < 75; i++) {
      var cx = random()*w, cy = random()*h, cr = scale*(.025+random()*.12);
      var mist = c.createRadialGradient(cx,cy,0,cx,cy,cr);
      mist.addColorStop(0,'rgba(70,0,255,.32)'); mist.addColorStop(1,'rgba(0,0,255,0)');
      c.fillStyle = mist; c.fillRect(cx-cr,cy-cr,cr*2,cr*2);
    }
    for (i = 0; i < 14; i++) {
      var vx = random()*w, vy = random()*h, heading = random()*6.28;
      c.beginPath(); c.moveTo(vx,vy);
      for (j = 0; j < 7; j++) { heading += (random()-.5)*1.2; vx += Math.cos(heading)*scale*.025; vy += Math.sin(heading)*scale*.025; c.lineTo(vx,vy); }
      c.strokeStyle = 'rgba(255,0,190,.24)'; c.lineWidth = scale*.007; c.stroke();
      c.strokeStyle = 'rgba(255,0,190,.6)'; c.lineWidth = scale*.0018; c.stroke();
    }
    for (i = 0; i < 60; i++) {
      var gx = random()*w, gy = random()*h, r = (.001+random()*.002)*scale;
      c.fillStyle = 'rgba(0,220,0,.48)'; c.beginPath(); c.moveTo(gx,gy-r*2);c.lineTo(gx+r*.5,gy);c.lineTo(gx,gy+r*2);c.lineTo(gx-r*.5,gy);c.closePath();c.fill();
    }
    return texture;
  }
  function makePaths(seed) {
    var random = core.seededRandom(seed), paths = [], count = 7 + Math.floor(random() * 4);
    for (var j = 0; j < count; j++) {
      var angle = (j + random() * .65) / count * 6.28, length = 1.3 + random() * 1.3, points = [[0, 0]], x = 0, y = 0, heading = angle;
      for (var n = 1; n <= 12; n++) {
        heading += (random() - .5) * .19;
        x += Math.cos(heading) * length / 12; y += Math.sin(heading) * length / 12;
        points.push([x, y]);
      }
      paths.push({ points: points, width: .55 + random() * .65 });
      if (j % 2 === 0) {
        var base = points[5 + Math.floor(random() * 4)], fork = [base], turn = heading + (random() > .5 ? .36 : -.45);
        for (n = 1; n < 5; n++) fork.push([base[0] + Math.cos(turn) * n * .10, base[1] + Math.sin(turn) * n * .10 + Math.sin(n) * .025]);
        paths.push({ points: fork, width: .4 });
      }
    }
    return paths;
  }
  function IceEffects() {
    this.blooms = []; this.fractures = []; this.shards = []; this.fallbackPixels = null;
    this.maskCanvas = document.createElement('canvas'); this.maskContext = this.maskCanvas.getContext('2d'); this.maskImage = null;
  }
  IceEffects.prototype.clear = function () { this.blooms.length = 0; this.fractures.length = 0; this.shards.length = 0; };
  IceEffects.prototype.freeze = function (u, v, radius, now) {
    if (this.blooms.length >= 24) this.blooms.shift();
    this.blooms.push({ u: u, v: v, radius: radius, born: now });
  };
  IceEffects.prototype.breakAt = function (u, v, radius, now) {
    for (var i = 0; i < this.fractures.length; i++) { var f = this.fractures[i], dx = u - f.u, dy = v - f.v; if (!f.open && dx * dx + dy * dy < .002) return; }
    if (this.fractures.length >= 24) return;
    var seed = Math.floor(Math.random() * 99999);
    this.fractures.push({ u: u, v: v, radius: radius, born: now, open: false, seed: seed, paths: makePaths(seed) });
  };
  IceEffects.prototype.update = function (ice, now, reduced, low, onBreak) {
    for (var i = this.fractures.length - 1; i >= 0; i--) {
      var f = this.fractures[i], age = now - f.born;
      if (age > 5) { this.fractures.splice(i, 1); continue; }
      if (!f.open && age > .18) {
        f.open = true; ice.paint(f.u, f.v, f.radius, false, false); onBreak(f.u, f.v);
        var random = core.seededRandom(f.seed), count = reduced ? 0 : (low ? 9 : 15), limit = low ? 40 : 90;
        for (var j = 0; j < count && this.shards.length < limit; j++) {
          var angle = (j + random() * .7) / count * 6.28, vertices = [], sides = random() > .65 ? 4 : 3;
          for (var n = 0; n < sides; n++) { var a = (n + random() * .35) / sides * 6.28, r = .5 + random() * .65; vertices.push([Math.cos(a) * r, Math.sin(a) * r]); }
          this.shards.push({ u: f.u, v: f.v, angle: angle, radius: f.radius, travel: .35 + random() * .5, spin: (random() - .5) * .8, size: .12 + random() * .19, born: now, life: 1.1 + random() * 1.2, tilt: random() * 6.28, points: vertices });
        }
      }
    }
  };
  IceEffects.prototype.drawFallback = function (ctx, ice, width, height, light) {
    if (this.maskCanvas.width !== ice.width || this.maskCanvas.height !== ice.height) {
      this.maskCanvas.width = ice.width; this.maskCanvas.height = ice.height;
      this.maskContext.drawImage(createTexture(ice.aspect),0,0,ice.width,ice.height);
      this.fallbackPixels = this.maskContext.getImageData(0,0,ice.width,ice.height).data;
      this.maskImage = this.maskContext.createImageData(ice.width, ice.height);
    }
    var data = this.maskImage.data;
    for (var i = 0; i < ice.current.length; i++) {
      var p = i * 4, facet = this.fallbackPixels[p+2]/255, seam = this.fallbackPixels[p]/255*.72;
      data[p] = ((69+facet*122)*(1-seam)+232*seam)*(light===2? .43:light===1?1.1:1);
      data[p+1] = ((153+facet*76)*(1-seam)+252*seam)*(light===2? .63:light===1? .86:1);
      data[p+2] = ((199+facet*46)*(1-seam)+255*seam)*(light===2? .83:light===1? .75:1);
      data[p + 3] = ice.current[i] * 238;
    }
    this.maskContext.putImageData(this.maskImage, 0, 0); ctx.drawImage(this.maskCanvas, 0, 0, width, height);
  };
  IceEffects.prototype.draw = function (ctx, ice, width, height, now, reduced, light) {
    var i, j, n, age, x, y, radius;
    ctx.save();
    for (i = this.blooms.length - 1; i >= 0; i--) {
      var bloom = this.blooms[i]; age = now - bloom.born;
      if (age > .9) { this.blooms.splice(i, 1); continue; }
      if (reduced) continue;
      radius = bloom.radius * height * Math.min(1, age / .55);
      ctx.strokeStyle = 'rgba(222,243,242,' + Math.max(0, 1 - age / .9) * .32 + ')'; ctx.lineWidth = .6; ctx.beginPath();
      for (j = 0; j < 28; j++) {
        var a = j * 2.39996, rr = radius * (.75 + .25 * Math.sin(j * 4.3)); x = bloom.u * width + Math.cos(a) * rr; y = bloom.v * height + Math.sin(a) * rr;
        if (ice.sample(x / width, y / height) < .2) continue;
        ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (2 + j % 4), y + Math.sin(a) * (2 + j % 4));
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(225,253,255,' + Math.max(0,1-age/.9)*.8 + ')'; ctx.lineWidth = 1;
      for (j = 0; j < 9; j++) {
        var sa = j*2.39996, sr = radius*(.4+.5*(j%3)/3), sx = bloom.u*width+Math.cos(sa)*sr, sy = bloom.v*height+Math.sin(sa)*sr-age*8;
        if (core.shore(sx/width,sy/height) >= -.02) continue;
        ctx.beginPath();
        for (n = 0; n < 3; n++) { var aa = n*Math.PI/3, sl = (3+j%3)*(1-age/.9); ctx.moveTo(sx-Math.cos(aa)*sl,sy-Math.sin(aa)*sl);ctx.lineTo(sx+Math.cos(aa)*sl,sy+Math.sin(aa)*sl); }
        ctx.stroke();
      }
    }
    for (i = 0; i < this.fractures.length; i++) {
      var f = this.fractures[i]; age = now - f.born; x = f.u * width; y = f.v * height; radius = f.radius * height;
      var opacity = Math.min(1, (5 - age) * .7), progress = Math.min(1, age / .18);
      for (j = 0; j < f.paths.length; j++) {
        var path = f.paths[j], points = path.points, count = (points.length - 1) * progress;
        ctx.beginPath();
        for (n = 1; n <= Math.ceil(count); n++) {
          var end = points[n], start = points[n - 1], t = Math.min(1, count - n + 1);
          var ax = x + start[0] * radius, ay = y + start[1] * radius, bx = ax + (end[0] - start[0]) * radius * t, by = ay + (end[1] - start[1]) * radius * t;
          if (f.open && (ice.sample(ax / width, ay / height) < .2 || ice.sample(bx / width, by / height) < .2)) continue;
          ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
        }
        ctx.shadowColor = 'rgba(14,50,55,' + opacity * .4 + ')'; ctx.shadowOffsetX = 1.3; ctx.shadowOffsetY = 2.1; ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(206,237,239,' + opacity * .18 + ')'; ctx.lineWidth = path.width * 4; ctx.stroke();
        ctx.shadowColor = 'transparent'; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        ctx.strokeStyle = 'rgba(232,250,249,' + opacity * .85 + ')'; ctx.lineWidth = path.width * .7; ctx.stroke();
      }
    }
    for (i = this.shards.length - 1; i >= 0; i--) {
      var shard = this.shards[i]; age = now - shard.born;
      if (age > shard.life) { this.shards.splice(i, 1); continue; }
      radius = shard.radius * height;
      var distance = radius * (shard.travel + (1 - Math.exp(-age * 3)) * .33), lift = age < .52 ? Math.sin(age / .52 * Math.PI) * radius * .28 : 0;
      x = shard.u * width + Math.cos(shard.angle) * distance; y = shard.v * height + Math.sin(shard.angle) * distance;
      var size = radius * shard.size, fade = Math.min(1, (shard.life - age) * 1.3), tilt = .67 + Math.sin(shard.tilt + age * 2) * .16;
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(x, y - lift); ctx.rotate(shard.angle + age * shard.spin); ctx.scale(1, tilt);
      ctx.beginPath();
      for (j = 0; j < shard.points.length; j++) { var px = shard.points[j][0] * size, py = shard.points[j][1] * size; if (!j) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.closePath();
      ctx.shadowColor = 'rgba(5,29,32,.48)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 2 + lift * .15;
      var gradient = ctx.createLinearGradient(-size, -size, size, size);
      gradient.addColorStop(0, light === 2 ? 'rgba(161,222,255,.9)' : 'rgba(231,253,255,.98)'); gradient.addColorStop(.28, 'rgba(133,215,252,.9)'); gradient.addColorStop(1, 'rgba(66,151,219,.8)');
      ctx.fillStyle = gradient; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(48,127,188,.65)'; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.strokeStyle = 'rgba(226,253,255,.98)'; ctx.lineWidth = .7; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(shard.points[0][0] * size, shard.points[0][1] * size); ctx.lineTo(shard.points[1][0] * size, shard.points[1][1] * size); ctx.strokeStyle = 'rgba(242,255,253,.6)'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };
  root.WaterIce = { createTexture: createTexture, Effects: IceEffects };
}(window));

