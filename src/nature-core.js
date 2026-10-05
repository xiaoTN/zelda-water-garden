(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports ? require('./nature-3d.js') : root.Nature3D);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GardenNature = api;
}(typeof window !== 'undefined' ? window : this, function (math) {
  'use strict';
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function random(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function setting(values,key,fallback){return typeof values[key]==='number'?values[key]:fallback;}
  function Fling(u,v,time,aspect,scaleX,scaleZ){this.samples=[];this.aspect=aspect;this.scaleX=scaleX===undefined?12*aspect:scaleX;this.scaleZ=scaleZ===undefined?12:scaleZ;this.sample(u,v,time);}
  Fling.prototype.sample=function(u,v,time){
    if(!isFinite(u+v+time))return;
    this.samples.push({x:u*this.scaleX,z:v*this.scaleZ,time:time});
    while(this.samples.length>2 && (this.samples.length>12 || time-this.samples[1].time>.12))this.samples.shift();
  };
  Fling.prototype.velocity=function(time){
    var samples=this.samples;if(samples.length<2)return [0,0];
    var last=samples[samples.length-1],first=samples[0];
    if(time-last.time>.10 || time<last.time)return [0,0];
    var dt=Math.max(.008,Math.min(.12,last.time-first.time));
    return [(last.x-first.x)/dt,(last.z-first.z)/dt];
  };
  function Snow(tuning) {
    this.tuning=tuning||{};this.motionOrder=new Array(12);
    this.size = 640; this.origin = -.6; this.span = 2; this.depth = new Float32Array(this.size * this.size);
    this.filtered=new Float32Array(this.depth.length);this.filterWork=new Float32Array(this.depth.length);this.filterRevision=-1;this.active=false;
    this.balls = []; this.ballLimit = 12; this.revision = 0; this.foot = 0; this.aspect = 1;
  }
  Snow.prototype.clear = function () { this.depth.fill(0); this.active=false; this.balls.length = 0; this.foot = 0; this.revision++; };
  Snow.prototype.index=function(u,v){var x=clamp(Math.floor((u-this.origin)/this.span*this.size),0,this.size-1),y=clamp(Math.floor((v-this.origin)/this.span*this.size),0,this.size-1);return y*this.size+x;};
  Snow.prototype.renderDepth=function(){
    if(this.filterRevision===this.revision)return this.filtered;
    var n=this.size,input=this.depth,work=this.filterWork,out=this.filtered;
    // Two separable, symmetric diffusion steps smooth the height itself and conserve its sum.
    for(var pass=0;pass<(this.soft?4:2);pass++){
      for(var y=0;y<n;y++)for(var x=0;x<n;x++){var at=y*n+x;work[at]=input[at]*.5+(input[y*n+Math.max(0,x-1)]+input[y*n+Math.min(n-1,x+1)])*.25;}
      for(y=0;y<n;y++)for(x=0;x<n;x++){at=y*n+x;out[at]=work[at]*.5+(work[Math.max(0,y-1)*n+x]+work[Math.min(n-1,y+1)*n+x])*.25;}
      input=out;
    }
    this.filterRevision=this.revision;return out;
  };
  // Reused brush workspace: one synchronous transfer moves material, including old berms.
  var cutIndices=new Int32Array(640*640),cutAmounts=new Float32Array(640*640);
  var bankIndices=new Int32Array(640*640),bankWeights=new Float32Array(640*640);
  Snow.prototype.stamp = function (u, v, radius, strength, angle, narrow, gather, rate, flowAngle, footSide) {
    if (!(radius > 0) || !isFinite(u+v+radius+strength)) return;
    if(this.soft&&gather)return;
    var n=this.size,origin=this.origin,scale=n/this.span,aspect=this.aspect,reach=radius*1.8,direction=gather?-1:1;
    var x0=Math.max(0,Math.floor((u-reach/aspect-origin)*scale)),x1=Math.min(n-1,Math.ceil((u+reach/aspect-origin)*scale));
    var y0=Math.max(0,Math.floor((v-reach-origin)*scale)),y1=Math.min(n-1,Math.ceil((v+reach-origin)*scale));
    var ca=Math.cos(angle||0),sa=Math.sin(angle||0),cuts=0,banks=0,removed=0,capacity=0;
    strength=clamp(strength,0,1);
    for(var y=y0;y<=y1;y++)for(var x=x0;x<=x1;x++){
      var dx=(origin+x/scale-u)*aspect,dy=origin+y/scale-v;
      var xx=(dx*ca+dy*sa)/(radius*(narrow||1)),yy=(-dx*sa+dy*ca)/radius;
      var d=Math.hypot(xx,yy),at=y*n+x;
      if(footSide){
        // Mirrored sole: broad forefoot, narrow heel and an inset medial arch.
        var fx=xx*footSide;
        var fore=Math.hypot((fx+.04)/.48,(yy+.40)/.60);
        var heel=Math.hypot(fx/.30,(yy-.57)/.36);
        var arch=Math.hypot((fx-.14)/.25,(yy-.08)/.57);
        d=Math.min(fore,heel,arch);
      }
      if(d<1){
        var target=strength*(.5+.5*Math.cos(d*Math.PI));
        if(footSide)target=strength*(1-Math.pow(clamp((d-.55)/.45,0,1),2));
        if(this.soft)target=strength*Math.pow(1-d*d,2);
        var amount=Math.max(0,target-direction*this.depth[at])*clamp(rate===undefined?1:rate,0,1);
        if(amount>0){
          if(this.soft){this.depth[at]=clamp(this.depth[at]+amount,0,1);cuts++;}
          else {cutIndices[cuts]=at;cutAmounts[cuts++]=amount;removed+=amount;}
        }
      }else if(d<1.8&&!this.soft){
        var weight=Math.pow(Math.sin((d-1)/.8*Math.PI),2),room=1+direction*this.depth[at];
        if(flowAngle!==undefined){var side=(dx*Math.sin(flowAngle)-dy*Math.cos(flowAngle))/Math.max(1e-8,Math.hypot(dx,dy));weight*=.02+.98*side*side;}
        if(weight>1e-5&&room>0){bankIndices[banks]=at;bankWeights[banks++]=weight;capacity+=room;}
      }
    }
    // Clouds thin locally and recover; only solid snow is displaced into raised banks.
    if(this.soft){if(cuts){this.active=true;this.revision++;}return;}
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
    this.active=true;this.revision++;
  };
  Snow.prototype.stroke = function (u, v, x, y, radius, strength) {
    var distance = Math.sqrt(Math.pow((u - x) * this.aspect, 2) + Math.pow(v - y, 2));
    var count = Math.min(160, Math.max(1, Math.ceil(distance / (radius * .20))));
    var flowAngle=Math.atan2(y-v,(x-u)*this.aspect);
    for (var i = 1; i <= count; i++) this.stamp(u + (x - u) * i / count, v + (y - v) * i / count, radius, strength,0,1,false,1,flowAngle);
  };
  Snow.prototype.footprint = function (u, v, angle, radius) {
    this.foot++;
    var side = this.foot % 2 ? -1 : 1;
    u += Math.cos(angle) * radius * .65 * side / this.aspect;
    v += Math.sin(angle) * radius * .65 * side;
    this.stamp(u, v, radius, .56, angle, 1, false, 1, undefined, side);
  };
  Snow.prototype.ball = function (u, v, radius) {
    if(!isFinite(u+v+radius)||radius<0)return null;
    if (this.balls.length >= this.ballLimit) return null;
    var item = { u: u, v: v, radius: radius, turn: 0, rotation: [0,0,0,1], vx:0, vz:0 }; this.balls.push(item); return item;
  };
  Snow.prototype.ballCenter = function (ball, position) {
    return position ? position(ball) : [(ball.u-.5)*12*this.aspect,ball.radius*12,(ball.v-.5)*12,ball.radius*12];
  };
  Snow.prototype.mergeBalls = function (ball, from, position) {
    if(this.balls.indexOf(ball)<0)return null;
    // Test sphere contact in the same world used for rendering. The swept center
    // catches a collision even when a quick pointer move crosses another ball.
    var merged=true;
    while(merged){
      merged=false;var center=this.ballCenter(ball,position),start=from||center;
      var dx=center[0]-start[0],dy=center[1]-start[1],dz=center[2]-start[2],length=dx*dx+dy*dy+dz*dz;
      for(var i=0;i<this.balls.length;i++){
        var other=this.balls[i];if(other===ball)continue;
        var at=this.ballCenter(other,position),t=length>1e-16?clamp(((at[0]-start[0])*dx+(at[1]-start[1])*dy+(at[2]-start[2])*dz)/length,0,1):0;
        var separation=Math.hypot(start[0]+dx*t-at[0],start[1]+dy*t-at[1],start[2]+dz*t-at[2]);
        if(separation>center[3]+at[3]+1e-8)continue;
        var mass=ball.radius*ball.radius*ball.radius,otherMass=other.radius*other.radius*other.radius,total=mass+otherMass;
        if(total>0){ball.vx=(ball.vx*mass+other.vx*otherMass)/total;ball.vz=(ball.vz*mass+other.vz*otherMass)/total;}
        ball.radius=Math.cbrt(total);
        other.mergedInto=ball;this.balls.splice(i,1);merged=true;break;
      }
    }
    return ball;
  };
  Snow.prototype.roll = function (ball, u, v, position) {
    if(this.balls.indexOf(ball)<0||!isFinite(u+v))return null;
    var startU=ball.u,startV=ball.v,distance=Math.hypot((u-startU)*this.aspect,v-startV);
    if(distance<1e-8)return ball;
    var steps=Math.min(128,Math.max(1,Math.ceil(distance/Math.max(.006,ball.radius*.45)))),maxRadius=Math.min(this.aspect,1)*.085;
    for(var i=1;i<=steps;i++){
      var x=clamp(startU+(u-startU)*i/steps,this.origin+ball.radius/this.aspect,this.origin+this.span-ball.radius/this.aspect);
      var y=clamp(startV+(v-startV)*i/steps,this.origin+ball.radius,this.origin+this.span-ball.radius);
      var dx=(x-ball.u)*this.aspect,dz=y-ball.v,travel=Math.hypot(dx,dz),nextRadius=Math.max(ball.radius,Math.min(maxRadius,ball.radius+travel*setting(this.tuning,'growth',.035))),near=false;
      // Distant spheres cannot touch. Avoid recomputing the filtered terrain
      // between brush steps unless a world-space contact is actually possible.
      for(var j=0;j<this.balls.length;j++){
        var other=this.balls[j];if(other===ball)continue;
        var bx=(other.u-ball.u)*this.aspect,bz=other.v-ball.v,t=travel>1e-8?clamp((bx*dx+bz*dz)/(travel*travel),0,1):0;
        if(Math.hypot(bx-dx*t,bz-dz*t)<=nextRadius+other.radius+1e-8){near=true;break;}
      }
      var from=near?this.ballCenter(ball,position):null;
      // A fresh gesture starts at radius zero; actual travel gathers its first snow.
      ball.radius=nextRadius;
      if(ball.radius>0){
        this.stroke(ball.u,ball.v,x,y,Math.max(.002,ball.radius*.65),.65);
        ball.rotation=math.rotation(ball.rotation,dx,dz,ball.radius);ball.turn+=travel/ball.radius;
      }
      ball.u=x;ball.v=y;if(near)this.mergeBalls(ball,from,position);
    }
    return ball;
  };
  Snow.prototype.stopBall=function(ball){if(ball){ball.vx=0;ball.vz=0;}};
  Snow.prototype.stopMotion=function(){for(var i=0;i<this.balls.length;i++)this.stopBall(this.balls[i]);};
  Snow.prototype.launch=function(ball,vx,vz){
    if(this.balls.indexOf(ball)<0 || ball.radius<=0 || !isFinite(vx+vz))return false;
    this.stopBall(ball);
    var speed=Math.hypot(vx,vz),gain=setting(this.tuning,'inertia',1.15);
    if(speed<setting(this.tuning,'throwThreshold',3.8)||gain<=0)return false;
    var level=Math.min(speed*gain,setting(this.tuning,'maxSpeed',10))/Math.max(speed,1e-8);
    ball.vx=vx*level;ball.vz=vz*level;return true;
  };
  Snow.prototype.advance=function(dt,position,held){
    if(!isFinite(dt)||dt<=0)return 0;
    var duration=Math.min(dt,.08),steps=Math.ceil(duration/.02),h=duration/steps,peak=0;
    var count=this.balls.length;
    for(var n=0;n<count;n++)this.motionOrder[n]=this.balls[n];
    for(n=0;n<count;n++){
      var ball=this.motionOrder[n];this.motionOrder[n]=null;
      if(this.balls.indexOf(ball)<0 || held && held(ball))continue;
      var travelled=0;
      for(var i=0;i<steps;i++){
        var speed=Math.hypot(ball.vx,ball.vz),limit=setting(this.tuning,'maxSpeed',10);
        if(speed>limit){ball.vx*=limit/speed;ball.vz*=limit/speed;speed=limit;}
        if(speed<.08){this.stopBall(ball);break;}
        // Exact constant-friction plus drag integration keeps throw distance stable across frame rates.
        var drag=.85,friction=setting(this.tuning,'friction',4.6),stop=Math.log(1+speed*drag/friction)/drag,t=Math.min(h,stop);
        var decay=Math.exp(-drag*t),distance=(speed+friction/drag)*(1-decay)/drag-friction/drag*t;
        var x=ball.u+ball.vx/speed*distance/(12*this.aspect),z=ball.v+ball.vz/speed*distance/12;
        var oldU=ball.u,oldV=ball.v;
        var endSpeed=Math.max(0,(speed+friction/drag)*decay-friction/drag);
        ball.vx*=endSpeed/speed;ball.vz*=endSpeed/speed;
        this.roll(ball,x,z,position);
        travelled+=Math.hypot((ball.u-oldU)*12*this.aspect,(ball.v-oldV)*12);
        if(Math.abs(ball.u-x)>1e-7)ball.vx=0;
        if(Math.abs(ball.v-z)>1e-7)ball.vz=0;
      }
      peak=Math.max(peak,travelled/duration);
    }
    return peak;
  };
  Snow.prototype.update = function (dt, falling) {
    if (!falling) return;
    var changed = false, amount = dt * .044 * setting(this.tuning,'snowfall',1);
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
    return { markedCells: cells, depth: depth, raised: raised, raisedCells: raisedCells, footprints: this.foot, balls: this.balls.map(function (b) { return { u: b.u, v: b.v, radius: b.radius, rotation: b.rotation.slice(), vx:b.vx, vz:b.vz, speed:Math.hypot(b.vx,b.vz) }; }) };
  };
  function Clouds(tuning) { this.tuning=tuning||{};this.aspect = 1; this.items = []; this.time = 0; this.field = new Snow(); this.field.soft = true; this.transport=new Float32Array(this.field.depth.length); this.currents=new Float32Array(this.field.size); this.pushX=new Float32Array(this.field.depth.length); this.pushY=new Float32Array(this.field.depth.length); this.drift = 0; this.clear(); }
  Clouds.prototype.clear = function () {
    this.items.length = 0; this.time = 0; this.field.clear(); this.drift = 0; this.driftY = 0; this.flowX = 0; this.flowY = 0;
    this.pushX.fill(0); this.pushY.fill(0); this.pushActive=false;
    var rng = random(10426);
    for (var i = 0; i < 72; i++) {
      var u = rng(), v = .27 + rng() * .58;
      this.items.push({ u: u, v: v, homeU: u, homeV: v, vx: 0, vy: 0, opacity: 1, size: .065 + rng() * .09, seed: i % 4, phase: rng() * 6.28 });
    }
  };
  Clouds.prototype.touch = function (u, v, mode, dx, dy, dt, speed) {
    if(mode!=='part'||!Number.isFinite(u)||!Number.isFinite(v)||!Number.isFinite(dt)||dt<=0)return;
    var scale=Math.min(this.aspect,1),radius=scale*setting(this.tuning,'cloudHalo',.18);
    this.field.aspect = this.aspect;
    var rush=clamp((speed===undefined?Math.hypot(dx*this.aspect,dy)/Math.max(.008,dt):speed)/.65,0,1);
    this.field.stamp(u, v, scale*setting(this.tuning,'cloudBrush',.065), .9+.1*rush,0,1,false,1-Math.exp(-dt*(9+65*rush)));
    // Move the continuous cloud material sideways across a wider, feathered halo.
    // Positive depth only thins it; lateral displacement never piles up a snow bank.
    var field=this.field,n=field.size,origin=field.origin,span=field.span;
    var x0=Math.max(0,Math.floor((u-radius/this.aspect-origin)/span*n)),x1=Math.min(n-1,Math.ceil((u+radius/this.aspect-origin)/span*n));
    var y0=Math.max(0,Math.floor((v-radius-origin)/span*n)),y1=Math.min(n-1,Math.ceil((v+radius-origin)/span*n));
    var rate=1-Math.exp(-Math.min(dt,.1)*(12+35*rush));
    for(var gy=y0;gy<=y1;gy++)for(var gx=x0;gx<=x1;gx++){
      var px=((gx+.5)/n*span+origin-u)*this.aspect,py=(gy+.5)/n*span+origin-v;
      var r2=(px*px+py*py)/(radius*radius);if(r2>=1)continue;
      var k=gy*n+gx,feather=Math.pow(1-r2,2),travel=scale*.055*setting(this.tuning,'cloudPush',2.6)*feather/radius;
      this.pushX[k]+=(px*travel-this.pushX[k])*rate;
      this.pushY[k]+=(py*travel-this.pushY[k])*rate;
    }
    this.pushActive=true;field.revision++;
    for (var i = 0; i < this.items.length; i++) {
      var p = this.items[i], x = (p.u - u) * this.aspect, y = p.v - v, d = Math.hypot(x, y);
      if (d > radius) continue;
      var force = Math.pow(1 - d / radius, 2), safe = Math.max(.008, d);
      p.vx += x / safe * force * dt * .6; p.vy += y / safe * force * dt * .6;
      p.opacity = Math.max(.08, p.opacity - force * dt * 3.5);
      p.vx = clamp(p.vx, -.32, .32); p.vy = clamp(p.vy, -.32, .32);
    }
  };
  Clouds.prototype.offset=function(u,v){
    var f=this.field;if(u<f.origin||v<f.origin||u>f.origin+f.span||v>f.origin+f.span)return [0,0];
    var x=(u-f.origin)/f.span*f.size-.5,y=(v-f.origin)/f.span*f.size-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ox=0,oy=0;
    // Match the signed eight-bit GPU channels, including bilinear texture filtering.
    for(var j=0;j<2;j++)for(var i=0;i<2;i++){
      var k=Math.max(0,Math.min(f.size-1,iy+j))*f.size+Math.max(0,Math.min(f.size-1,ix+i)),w=(i?fx:1-fx)*(j?fy:1-fy);
      ox+=Math.round(this.pushX[k]/.08*127)/127*.08*w;oy+=Math.round(this.pushY[k]/.08*127)/127*.08*w;
    }
    return [ox/this.aspect,oy];
  };
  Clouds.prototype.update = function (dt, breeze, reduced) {
    if (!reduced) this.time += dt;
    if(this.field.active)this.refill(dt,reduced);
    if(this.pushActive){
      var decay=Math.exp(-Math.max(0,dt)*.9),peak=0;
      for(var k=0;k<this.pushX.length;k++){this.pushX[k]*=decay;this.pushY[k]*=decay;peak=Math.max(peak,Math.abs(this.pushX[k]),Math.abs(this.pushY[k]));}
      if(peak<.0001){this.pushX.fill(0);this.pushY.fill(0);this.pushActive=false;}
      this.field.revision++;
    }
    this.drift *= Math.exp(-dt*.7); this.driftY *= Math.exp(-dt*.7);
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
  Clouds.prototype.refill=function(dt,reduced){
    var field=this.field,d=field.depth,out=this.transport,n=field.size,peak=0,k,x,y;
    // Thin openings diffuse and fade back to the undisturbed cloud surface.
    // The bounded coefficients keep this explicit transport stable even after a long pause.
    var step=Math.min(Math.max(dt,0),.04),diffusion=Math.min(.20,step*9),turn=reduced?0:step*.65;
    for(k=0;k<d.length;k++)peak=Math.max(peak,Math.abs(d[k]));
    for(k=0;k<n;k++)this.currents[k]=Math.sin(k*.19+this.time*1.8);
    out.set(d);
    for(y=0;y<n;y++)for(x=0;x<n;x++){
      k=y*n+x;var a=d[k],b,flux,velocity;
      if(x<n-1){b=d[k+1];if(a!==0||b!==0){velocity=turn*this.currents[y];flux=(a-b)*diffusion+velocity*(velocity>0?a:b);out[k]-=flux;out[k+1]+=flux;}}
      if(y<n-1){b=d[k+n];if(a!==0||b!==0){velocity=-turn*this.currents[x];flux=(a-b)*diffusion+velocity*(velocity>0?a:b);out[k]-=flux;out[k+n]+=flux;}}
    }
    // Deep fresh gaps close quickly; the remaining wisps settle more slowly.
    var decay=Math.exp(-dt*(.30+1.7*peak)*setting(this.tuning,'cloudRecovery',1));
    for(k=0;k<d.length;k++)d[k]=clamp(out[k],0,1)*decay;
    if(peak*decay<1e-5){d.fill(0);field.active=false;}
    field.revision++;
  };
  Clouds.prototype.inspect = function () {
    var speed = 0, opacity = 0, spread = 0;
    for (var i = 0; i < this.items.length; i++) { var p = this.items[i]; speed += Math.hypot(p.vx, p.vy); opacity += p.opacity; spread += Math.hypot((p.u - .5) * this.aspect, p.v - .5); }
    return { count: this.items.length, opacity: opacity, motion: speed, spread: spread, time: this.time };
  };
  return { Snow: Snow, Clouds: Clouds, Fling:Fling, random: random };
}));
