(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports ? require('./nature-3d.js') : root.Nature3D);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GardenNature = api;
}(typeof window !== 'undefined' ? window : this, function (math) {
  'use strict';
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function random(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function Snow() {
    this.size = 320; this.depth = new Float32Array(this.size * this.size);
    this.balls = []; this.revision = 0; this.foot = 0; this.aspect = 1;
  }
  Snow.prototype.clear = function () { this.depth.fill(0); this.balls.length = 0; this.foot = 0; this.revision++; };
  // Reused brush workspace: one synchronous transfer moves material, including old berms.
  var cutIndices=new Int32Array(320*320),cutAmounts=new Float32Array(320*320);
  var bankIndices=new Int32Array(320*320),bankWeights=new Float32Array(320*320);
  Snow.prototype.stamp = function (u, v, radius, strength, angle, narrow, gather, rate, flowAngle) {
    if (!(radius > 0) || !isFinite(u+v+radius+strength)) return;
    var n=this.size,aspect=this.aspect,reach=radius*1.8,direction=gather?-1:1;
    var x0=Math.max(0,Math.floor((u-reach/aspect)*n)),x1=Math.min(n-1,Math.ceil((u+reach/aspect)*n));
    var y0=Math.max(Math.ceil(.29*n),Math.floor((v-reach)*n)),y1=Math.min(Math.floor(.86*n),Math.ceil((v+reach)*n));
    var ca=Math.cos(angle||0),sa=Math.sin(angle||0),cuts=0,banks=0,removed=0,capacity=0;
    strength=clamp(strength,0,1);
    for(var y=y0;y<=y1;y++)for(var x=x0;x<=x1;x++){
      var dx=(x/n-u)*aspect,dy=y/n-v;
      var xx=(dx*ca+dy*sa)/(radius*(narrow||1)),yy=(-dx*sa+dy*ca)/radius;
      var d=Math.hypot(xx,yy),at=y*n+x;
      if(d<1){
        var edge=clamp((1-d)/.55,0,1),target=strength*edge*edge*(3-2*edge);
        if(this.soft)target=strength*Math.pow(1-d*d,2);
        var amount=Math.max(0,target-direction*this.depth[at])*(gather?clamp(rate===undefined?1:rate,0,1):1);
        if(amount>0){cutIndices[cuts]=at;cutAmounts[cuts++]=amount;removed+=amount;}
      }else if(d<1.8){
        var weight=Math.pow(Math.sin((d-1)/.8*Math.PI),2),room=1+direction*this.depth[at];
        if(flowAngle!==undefined){var side=(dx*Math.sin(flowAngle)-dy*Math.cos(flowAngle))/Math.max(1e-8,Math.hypot(dx,dy));weight*=.02+.98*side*side;}
        if(weight>1e-5&&room>0){bankIndices[banks]=at;bankWeights[banks++]=weight;capacity+=room;}
      }
    }
    if(!cuts||!banks||capacity<1e-7)return;
    // A full berm limits further excavation instead of deleting excess material.
    var fraction=Math.min(1,capacity/removed),volume=0,i;
    for(i=0;i<cuts;i++){var index=cutIndices[i],before=this.depth[index];this.depth[index]+=direction*cutAmounts[i]*fraction;volume+=(this.depth[index]-before)*direction;}
    // Redistribute into the surrounding ring even if that ring was already carved.
    // Saturated cells stop receiving; remaining material spreads to available cells.
    for(var pass=0;pass<5&&volume>1e-6;pass++){
      var total=0;
      for(i=0;i<banks;i++)if(1+direction*this.depth[bankIndices[i]]>1e-7)total+=bankWeights[i];
      if(total<=0)break;
      var budget=volume;
      for(i=0;i<banks;i++){
        index=bankIndices[i];before=this.depth[index];var space=1+direction*before;
        var moved=Math.min(space,budget*bankWeights[i]/total);
        this.depth[index]=clamp(before-direction*moved,-1,1);volume-=(before-this.depth[index])*direction;
      }
    }
    if(volume>1e-6){
      var available=0;for(i=0;i<banks;i++)available+=1+direction*this.depth[bankIndices[i]];
      var ratio=Math.min(1,volume/available);
      for(i=0;i<banks;i++){index=bankIndices[i];this.depth[index]-=direction*(1+direction*this.depth[index])*ratio;}
    }
    this.revision++;
  };
  Snow.prototype.stroke = function (u, v, x, y, radius, strength) {
    var distance = Math.sqrt(Math.pow((u - x) * this.aspect, 2) + Math.pow(v - y, 2));
    var count = Math.min(160, Math.max(1, Math.ceil(distance / (radius * .35))));
    var flowAngle=Math.atan2(y-v,(x-u)*this.aspect);
    for (var i = 1; i <= count; i++) this.stamp(u + (x - u) * i / count, v + (y - v) * i / count, radius, strength,0,1,false,1,flowAngle);
  };
  Snow.prototype.footprint = function (u, v, angle, radius) {
    this.foot++;
    var side = this.foot % 2 ? -1 : 1;
    u += Math.cos(angle) * radius * .65 * side / this.aspect;
    v += Math.sin(angle) * radius * .65 * side;
    this.stamp(u, v, radius, .88, angle, .48);
  };
  Snow.prototype.ball = function (u, v, radius) {
    for (var i = this.balls.length - 1; i >= 0; i--) {
      var b = this.balls[i];
      if (Math.hypot((u - b.u) * this.aspect, v - b.v) < b.radius * 1.7) return b;
    }
    if (this.balls.length >= 12) return null;
    var item = { u: u, v: v, radius: radius, turn: 0, rotation: [0,0,0,1] }; this.balls.push(item); return item;
  };
  Snow.prototype.roll = function (ball, u, v) {
    u = clamp(u, ball.radius / this.aspect, 1 - ball.radius / this.aspect); v = clamp(v, .31, .83);
    var distance = Math.hypot((u - ball.u) * this.aspect, v - ball.v);
    this.stroke(ball.u, ball.v, u, v, ball.radius * .65, .65);
    ball.radius = Math.min(Math.min(this.aspect, 1) * .085, ball.radius + distance * .025);
    ball.rotation = math.rotation(ball.rotation, (u-ball.u)*this.aspect, v-ball.v, ball.radius);
    ball.turn += distance / ball.radius; ball.u = u; ball.v = v;
  };
  Snow.prototype.update = function (dt, falling) {
    if (!falling) return;
    var changed = false, amount = dt * .022;
    for (var i = 0; i < this.depth.length; i++) {
      var d = this.depth[i];
      if (d !== 0) { this.depth[i] = d > 0 ? Math.max(0, d - amount) : Math.min(0, d + amount); changed = true; }
    }
    if (changed) this.revision++;
  };
  Snow.prototype.inspect = function () {
    var cells = 0, depth = 0, raised = 0, raisedCells = 0;
    for(var j=0;j<this.depth.length;j++)if(this.depth[j]<0){raised-=this.depth[j];if(this.depth[j]<-.01)raisedCells++;}
    for (var i = 0; i < this.depth.length; i++) if (this.depth[i] > .01) { cells++; depth += this.depth[i]; }
    return { markedCells: cells, depth: depth, raised: raised, raisedCells: raisedCells, footprints: this.foot, balls: this.balls.map(function (b) { return { u: b.u, v: b.v, radius: b.radius, rotation: b.rotation.slice() }; }) };
  };
  function Clouds() { this.aspect = 1; this.items = []; this.time = 0; this.field = new Snow(); this.field.soft = true; this.drift = 0; this.clear(); }
  Clouds.prototype.clear = function () {
    this.items.length = 0; this.time = 0; this.field.clear(); this.drift = 0; this.driftY = 0; this.flowX = 0; this.flowY = 0;
    var rng = random(10426);
    for (var i = 0; i < 72; i++) {
      var u = rng(), v = .27 + rng() * .58;
      this.items.push({ u: u, v: v, homeU: u, homeV: v, vx: 0, vy: 0, opacity: 1, size: .065 + rng() * .09, seed: i % 4, phase: rng() * 6.28 });
    }
  };
  Clouds.prototype.touch = function (u, v, mode, dx, dy, dt) {
    var radius = Math.min(this.aspect, 1) * .32;
    this.field.aspect = this.aspect;
    if (mode === 'part' || mode === 'wind') this.field.stamp(u, v, radius * (mode === 'part' ? .27 : .20), mode === 'part' ? .98 : .55,0,1,false,1,Math.hypot(dx,dy)>1e-5?Math.atan2(dy,dx*this.aspect):undefined);
    else this.field.stamp(u,v,radius*.36,.65,0,1,true,dt*3);
    if(mode==='wind') { this.drift = clamp(this.drift + dx * 1.8,-.6,.6); this.driftY = clamp(this.driftY + dy * 1.8,-.6,.6); }
    for (var i = 0; i < this.items.length; i++) {
      var p = this.items[i], x = (p.u - u) * this.aspect, y = p.v - v, d = Math.hypot(x, y);
      if (d > radius) continue;
      var force = Math.pow(1 - d / radius, 2), safe = Math.max(.008, d);
      if (mode === 'part') {
        p.vx += x / safe * force * dt * .6; p.vy += y / safe * force * dt * .6;
        p.opacity = Math.max(.08, p.opacity - force * dt * 3.5);
      } else if (mode === 'gather') {
        p.vx -= x * force * dt * 6; p.vy -= y * force * dt * 6;
        p.opacity = Math.min(1, p.opacity + dt * force * 3);
      } else {
        p.vx += clamp(dx * this.aspect, -.12, .12) * force * 5;
        p.vy += clamp(dy, -.12, .12) * force * 5;
      }
      p.vx = clamp(p.vx, -.32, .32); p.vy = clamp(p.vy, -.32, .32);
    }
  };
  Clouds.prototype.update = function (dt, breeze, reduced) {
    if (!reduced) this.time += dt;
    var decay=Math.exp(-dt*.32);for(var k=0;k<this.field.depth.length;k++)this.field.depth[k]*=decay;this.field.revision++; this.drift *= Math.exp(-dt*.7); this.driftY *= Math.exp(-dt*.7);
    this.flowX += dt * ((reduced ? 0 : breeze ? .009 : .003) + this.drift*.035);
    this.flowY += dt * ((reduced ? 0 : .0015) + this.driftY*.035);
    for (var i = 0; i < this.items.length; i++) {
      var p = this.items[i], friction = Math.exp(-dt * 1.7);
      p.vx *= friction; p.vy *= friction;
      p.u += (p.vx + (reduced ? 0 : breeze ? .018 : .002)) * dt / this.aspect;
      p.v += p.vy * dt;
      p.vy += (p.homeV - p.v) * dt * .028;
      p.opacity = Math.min(1, p.opacity + dt * .045);
      if (p.u > 1.28) p.u = -.28;
      if (p.u < -.28) p.u = 1.28;
      p.v = clamp(p.v, .22, .88);
    }
  };
  Clouds.prototype.inspect = function () {
    var speed = 0, opacity = 0, spread = 0;
    for (var i = 0; i < this.items.length; i++) { var p = this.items[i]; speed += Math.hypot(p.vx, p.vy); opacity += p.opacity; spread += Math.hypot((p.u - .5) * this.aspect, p.v - .5); }
    return { count: this.items.length, opacity: opacity, motion: speed, spread: spread, time: this.time };
  };
  return { Snow: Snow, Clouds: Clouds, random: random };
}));
