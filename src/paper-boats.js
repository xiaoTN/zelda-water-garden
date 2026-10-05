(function (root) {
  'use strict';
  var core = typeof module !== 'undefined' && module.exports ? require('./water-core.js') : root.WaterCore;
  var slope = .4330127, limit = 12;
  // A classic folded rectangle: pointed ends, high side walls, open pockets and a peaked central fold.
  // Inner and outer sheets have a small physical thickness; the bright lip is actual geometry.
  var points=[[-1.18,.57,0],[-.52,.48,-.40],[.52,.48,-.40],[1.18,.57,0],[.52,.48,.40],[-.52,.48,.40],[-.78,.04,0],[-.46,.07,-.30],[.46,.07,-.30],[.78,.04,0],[.46,.07,.30],[-.46,.07,.30],[0,.025,0]];
  var faces=[],colors=[],paper=[.985,.978,.946],inside=[.925,.920,.884],edge=[1,.994,.966],fold=[.995,.987,.959];
  function face(a,b,c,color){faces.push([a,b,c]);colors.push(color||paper);}
  function vertex(x,y,z){points.push([x,y,z]);return points.length-1;}
  var inner=[],floor=[],i,j;
  for(i=0;i<6;i++){
    var rim=points[i],bottom=points[6+i];
    inner.push(vertex(rim[0]*.983,rim[1]-.016,rim[2]*.964));
    floor.push(vertex(bottom[0]*.976,bottom[1]+.027,bottom[2]*.94));
  }
  var well=vertex(0,.061,0);
  for(i=0;i<6;i++){
    j=(i+1)%6;
    face(i,6+i,6+j);face(i,6+j,j);
    face(6+i,12,6+j);
    face(i,j,inner[j],edge);face(i,inner[j],inner[i],edge);
    face(inner[i],inner[j],floor[j],inside);face(inner[i],floor[j],floor[i],inside);
    face(floor[i],floor[j],well,inside);
  }
  // The centre is a folded triangle, not a flat cap: two ridges meet at the high crease.
  var rear=vertex(-.70,.17,0),front=vertex(.70,.17,0),peak=vertex(.025,2.05,0);
  var nearFold=vertex(0,.20,.09),farFold=vertex(0,.20,-.09);
  face(rear,nearFold,peak,fold);face(nearFold,front,peak,paper);
  face(rear,peak,farFold,paper);face(farFold,peak,front,fold);
  face(rear,farFold,nearFold,inside);face(nearFold,farFold,front,inside);
  // Fine triangular tuck-ins at each bow, separated from the raised central triangle.
  face(inner[0],floor[0],rear,fold);face(inner[3],front,floor[3],fold);
  function value(t,key,fallback) { return typeof t[key] === 'number' ? t[key] : fallback; }
  function System(tuning) {
    this.tuning = tuning || {}; this.items = []; this.aspect = 1; this.field = null; this.obstacle = function(){return false;}; this.clock = 0; this.serial = 0;
    this.vertices = new Float32Array(limit * faces.length * 33);
    this.shadowVertices = new Float32Array(limit * 66);
    this.work = new Float32Array(points.length * 3);
    this.hullA=new Float32Array(12);this.hullB=new Float32Array(12);
  }
  System.prototype.attach = function (aspect, field, obstacle) { this.aspect=aspect; this.field=field; this.obstacle=obstacle; this.stopMotion(); };
  System.prototype.size = function () { return .105 * Math.min(1,this.aspect) * value(this.tuning,'boatSize',.6); };
  System.prototype.height = function (u,v) {
    var x=(u-.5)*2*this.aspect,z=(v-.5)/slope,wet=core.clamp((-core.shore(u,v)-.005)/.125,0,1);wet=wet*wet*(3-2*wet);
    return (Math.sin(x*5.5+z*7-this.clock*1.2)*.014+Math.sin(x*-8+z*3.5-this.clock*.9)*.009+Math.sin(x*11+z*9+this.clock*1.6)*.004+(this.field?this.field.sample(u,v)*.065:0))*wet;
  };
  System.prototype.surface = function (u,v) {
    // Intersect the renderer's orthographic camera ray with the animated water surface.
    var groundV=v;
    for(var i=0;i<4;i++)v=groundV+this.height(u,v)*.25;
    return {u:u,v:v};
  };
  System.prototype.pose = function (b) {
    b.x=(b.u-.5)*2*this.aspect;b.z=(b.v-.5)/slope;b.y=this.height(b.u,b.v)+.005;
    var s=this.size(),c=Math.cos(b.angle),n=Math.sin(b.angle),rock=value(this.tuning,'boatRocking',.7);
    function tilt(a){return core.clamp(a*rock,-.16,.16);}
    b.pitch=tilt((this.height(b.u+c*s/(2*this.aspect),b.v-n*s*slope)-this.height(b.u-c*s/(2*this.aspect),b.v+n*s*slope))/(2*s));
    b.roll=tilt((this.height(b.u+n*s/(2*this.aspect),b.v+c*s*slope)-this.height(b.u-n*s/(2*this.aspect),b.v-c*s*slope))/(2*s));
  };
  System.prototype.clearAt = function (u,v,angle,ignore) {
    var s=this.size(),c=Math.cos(angle),n=Math.sin(angle);
    var x0=(u-.5)*2*this.aspect,z0=(v-.5)/slope;
    for(var i=0;i<6;i++){var p=points[i];this.hullA[i*2]=x0+p[0]*s*c+p[2]*s*n;this.hullA[i*2+1]=z0-p[0]*s*n+p[2]*s*c;}
    // Probe the perimeter and interior so a small shoreline rock cannot sit between hull vertices.
    for(i=0;i<19;i++){
      var x=x0,z=z0;
      if(i<18){var at=Math.floor(i/3)*2,next=(at+2)%12,f=(i%3)/3;x=this.hullA[at]*(1-f)+this.hullA[next]*f;z=this.hullA[at+1]*(1-f)+this.hullA[next+1]*f;}
      var a=.5+x/(2*this.aspect),b=.5+z*slope;
      if(core.shore(a,b)>-.045 || this.obstacle(a,b))return false;
    }
    for(i=0;i<this.items.length;i++){
      var other=this.items[i];if(other===ignore || Math.hypot((u-other.u)*2*this.aspect,(v-other.v)/slope)>s*2.4)continue;
      var co=Math.cos(other.angle),no=Math.sin(other.angle),xo=(other.u-.5)*2*this.aspect,zo=(other.v-.5)/slope;
      for(var k=0;k<6;k++){p=points[k];this.hullB[k*2]=xo+p[0]*s*co+p[2]*s*no;this.hullB[k*2+1]=zo-p[0]*s*no+p[2]*s*co;}
      if(overlap(this.hullA,this.hullB,s*.02))return false;
    }
    return true;
  };
  function overlap(a,b,margin){
    for(var side=0;side<2;side++)for(var i=0;i<12;i+=2){
      var p=side?b:a,next=(i+2)%12,nx=p[next+1]-p[i+1],nz=p[i]-p[next],len=Math.hypot(nx,nz),amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
      for(var j=0;j<12;j+=2){var va=(a[j]*nx+a[j+1]*nz)/len,vb=(b[j]*nx+b[j+1]*nz)/len;amin=Math.min(amin,va);amax=Math.max(amax,va);bmin=Math.min(bmin,vb);bmax=Math.max(bmax,vb);}
      if(amax+margin<bmin || bmax+margin<amin)return false;
    }
    return true;
  }
  System.prototype.add = function (u,v) {
    var angle=-.2,oldest=this.items.length>=limit?this.items[0]:null;
    if(!isFinite(u+v) || !this.clearAt(u,v,angle,oldest))return null;
    if(oldest){oldest.vx=0;oldest.vz=0;oldest.flowX=0;oldest.flowZ=0;oldest.held=false;this.items.shift();}
    var b={id:++this.serial,u:u,v:v,angle:angle,vx:0,vz:0,flowX:0,flowZ:0,held:false,pitch:0,roll:0};this.items.push(b);this.pose(b);return b;
  };
  System.prototype.stopMotion = function () { for(var i=0;i<this.items.length;i++){this.items[i].vx=0;this.items[i].vz=0;this.items[i].flowX=0;this.items[i].flowZ=0;this.items[i].held=false;} };
  System.prototype.clear = function () { this.items.length=0; };
  System.prototype.limitFlow = function(b){
    var speed=Math.hypot(b.flowX,b.flowZ),max=Math.min(value(this.tuning,'boatMaxSpeed',1.5),.20*Math.min(1,this.aspect));
    if(speed>max){b.flowX*=max/speed;b.flowZ*=max/speed;}
  };
  System.prototype.push = function(u,v,du,dv,radius){
    var strength=value(this.tuning,'boatFlow',1);
    for(var i=0;i<this.items.length;i++){
      var b=this.items[i],distance=Math.hypot((b.u-u)*this.aspect,b.v-v);
      if(b.held || distance>=radius)continue;
      var force=(1-distance/radius)*3.5*strength;
      b.flowX+=du*2*this.aspect*force;b.flowZ+=dv/slope*force;
      this.limitFlow(b);
    }
  };
  System.prototype.drag = function (b,u,v,heading) {
    if(this.items.indexOf(b)<0)return 0;
    var dx=(u-b.u)*2*this.aspect,dz=(v-b.v)/slope,distance=Math.hypot(dx,dz),startU=b.u,startV=b.v,startAngle=b.angle;
    var target=typeof heading==='number'&&isFinite(heading)?heading:distance>this.size()*.006?Math.atan2(-dz,dx):startAngle,turn=angleDelta(startAngle,target);
    var steps=Math.max(1,Math.ceil(distance/(this.size()*.18)),Math.ceil(Math.abs(turn)/.10));
    b.vx=0;b.vz=0;
    for(var i=1;i<=steps;i++){var a=startU+(u-startU)*i/steps,d=startV+(v-startV)*i/steps,angle=startAngle+turn*i/steps;if(!this.clearAt(a,d,angle,b))break;b.u=a;b.v=d;b.angle=angle;}
    b.angle=Math.atan2(Math.sin(b.angle),Math.cos(b.angle));
    this.pose(b);return Math.hypot((b.u-startU)*2*this.aspect,(b.v-startV)/slope);
  };
  function angleDelta(from,to){return Math.atan2(Math.sin(to-from),Math.cos(to-from));}
  System.prototype.turn = function(b,target){
    var start=b.angle,delta=angleDelta(start,target),steps=Math.max(1,Math.ceil(Math.abs(delta)/.10));
    for(var i=1;i<=steps;i++){var angle=start+delta*i/steps;if(!this.clearAt(b.u,b.v,angle,b)){this.pose(b);return false;}b.angle=angle;}
    b.angle=Math.atan2(Math.sin(b.angle),Math.cos(b.angle));this.pose(b);return true;
  };
  System.prototype.launch = function (b,vx,vz) {
    if(this.items.indexOf(b)<0)return;
    b.held=false;var speed=Math.hypot(vx,vz),strength=value(this.tuning,'boatInertia',1.1),max=value(this.tuning,'boatMaxSpeed',1.5);
    if(speed<value(this.tuning,'boatThrowThreshold',.15) || !isFinite(speed)){b.vx=0;b.vz=0;return;}
    var factor=Math.min(speed*strength,max)/speed;
    if(!factor || !this.turn(b,Math.atan2(-vz,vx))){b.vx=0;b.vz=0;return;}
    b.vx=vx*factor;b.vz=vz*factor;
  };
  System.prototype.update = function (dt,time,reduced) {
    this.clock=time;dt=Math.min(.08,Math.max(0,dt));
    for(var i=0;i<this.items.length;i++){
      var b=this.items[i],speed=Math.hypot(b.vx,b.vz),strength=value(this.tuning,'boatFlow',1);
      var max=value(this.tuning,'boatMaxSpeed',1.5);if(speed>max){b.vx*=max/speed;b.vz*=max/speed;speed=max;}
      if(b.held){b.flowX=0;b.flowZ=0;this.pose(b);continue;}
      this.limitFlow(b);var oldFlowX=b.flowX,oldFlowZ=b.flowZ;
      var resistance=value(this.tuning,'boatFriction',1.25),flowDecay=Math.exp(-resistance*dt),flowStep=resistance>0?(1-flowDecay)/resistance:dt;
      if(this.field && strength>0){
        // Follow the same local wave-slope direction and gentle current as floating leaves.
        var gx=this.field.sample(b.u+.005,b.v)-this.field.sample(b.u-.005,b.v),gz=this.field.sample(b.u,b.v+.005)-this.field.sample(b.u,b.v-.005);
        var currentX=reduced?0:.0012*Math.sin(time*.3+i)*2*this.aspect*strength,currentZ=reduced?0:.0007/slope*strength;
        b.flowX=b.flowX*flowDecay-gx*.45*2*this.aspect*strength*flowStep+currentX*(1-flowDecay);
        b.flowZ=b.flowZ*flowDecay-gz*.45/slope*strength*flowStep+currentZ*(1-flowDecay);
      }else{b.flowX*=flowDecay;b.flowZ*=flowDecay;}
      if(strength<=0){b.flowX=0;b.flowZ=0;oldFlowX=0;oldFlowZ=0;}
      this.limitFlow(b);
      if(speed>0 || Math.hypot(b.flowX,b.flowZ)>.00001){
        var oldU=b.u,oldV=b.v,decay=Math.exp(-value(this.tuning,'boatFriction',1.25)*dt),vx=b.vx,vz=b.vz;
        var dx=vx*dt*(1+decay)/2+(oldFlowX+b.flowX)*dt/2,dz=vz*dt*(1+decay)/2+(oldFlowZ+b.flowZ)*dt/2,length=Math.hypot(dx,dz);
        if(length>max*dt){dx*=max*dt/length;dz*=max*dt/length;length=max*dt;}
        var heading=length>.000001?Math.atan2(-dz,dx):b.angle;
        // Slow drift gently turns the bow; a deliberate fling continues to face its travel.
        if(speed<.012)heading=Math.hypot(b.flowX,b.flowZ)>.004?b.angle+core.clamp(angleDelta(b.angle,heading),-dt*1.5,dt*1.5):b.angle;
        var moved=this.drag(b,b.u+dx/(2*this.aspect),b.v+dz*slope,heading);
        // Swept hull contact stops the boat without passing through rocks or jittering on shore.
        if(moved<length-.00001){b.vx=0;b.vz=0;b.flowX=0;b.flowZ=0;}
        else if(speed*decay<.012){b.vx=0;b.vz=0;}else{b.vx=vx*decay;b.vz=vz*decay;}
        // Passive drift does not generate its own driving waves or an endless audio tail.
        if(speed>.012 && moved>.0001 && this.field)this.field.stroke(oldU,oldV,b.u,b.v,Math.min(.07,speed*.035));
      }
      this.pose(b);
    }
  };
  System.prototype.transformed = function (b) {
    var out=this.work,s=this.size(),c=Math.cos(b.angle),n=Math.sin(b.angle),cp=Math.cos(b.pitch),sp=Math.sin(b.pitch),cr=Math.cos(b.roll),sr=Math.sin(b.roll);
    for(var i=0;i<points.length;i++){
      var p=points[i],x=p[0]*s,y=p[1]*s,z=p[2]*s,y1=y*cr-z*sr,z1=y*sr+z*cr,x1=x*cp-y1*sp,y2=x*sp+y1*cp;
      out[i*3]=b.x+x1*c+z1*n;out[i*3+1]=b.y+y2;out[i*3+2]=b.z-x1*n+z1*c;
    }
    return out;
  };
  System.prototype.geometry = function () {
    var at=0,out=this.vertices;
    for(var i=0;i<this.items.length;i++){
      var b=this.items[i],p=this.transformed(b);
      for(var j=0;j<faces.length;j++){
        var f=faces[j],a=f[0]*3,d=f[1]*3,e=f[2]*3,ax=p[d]-p[a],ay=p[d+1]-p[a+1],az=p[d+2]-p[a+2],bx=p[e]-p[a],by=p[e+1]-p[a+1],bz=p[e+2]-p[a+2];
        var nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,len=Math.hypot(nx,ny,nz),color=colors[j];
        for(var k=0;k<3;k++){var v=f[k]*3,local=points[f[k]];out[at++]=p[v];out[at++]=p[v+1];out[at++]=p[v+2];out[at++]=local[0]/2.36+.5;out[at++]=local[1]/2.05;out[at++]=nx/len;out[at++]=ny/len;out[at++]=nz/len;out[at++]=color[0];out[at++]=color[1];out[at++]=color[2];}
      }
    }
    return out.subarray(0,at);
  };
  System.prototype.shadows = function () {
    var out=this.shadowVertices,at=0,s=this.size(),uv=[[0,0],[1,0],[0,1],[1,0],[1,1],[0,1]];
    for(var i=0;i<this.items.length;i++){
      var b=this.items[i],c=Math.cos(b.angle),n=Math.sin(b.angle);
      for(var j=0;j<6;j++){var u=uv[j][0],v=uv[j][1],x=(u-.5)*s*2.5,z=(v-.5)*s*1.4;out[at++]=b.x+x*c+z*n;out[at++]=b.y-.002;out[at++]=b.z-x*n+z*c;out[at++]=u;out[at++]=v;out[at++]=0;out[at++]=1;out[at++]=0;out[at++]=.65;out[at++]=1;out[at++]=1;}
    }
    return out.subarray(0,at);
  };
  function rayTriangle(ox,oy,oz,p,a,b,c) {
    var dx=0,dy=-.8660254,dz=-.5,ex=p[b]-p[a],ey=p[b+1]-p[a+1],ez=p[b+2]-p[a+2],fx=p[c]-p[a],fy=p[c+1]-p[a+1],fz=p[c+2]-p[a+2];
    var px=dy*fz-dz*fy,py=dz*fx,pz=-dy*fx,det=ex*px+ey*py+ez*pz;if(Math.abs(det)<1e-9)return Infinity;
    var tx=ox-p[a],ty=oy-p[a+1],tz=oz-p[a+2],u=(tx*px+ty*py+tz*pz)/det;if(u<0||u>1)return Infinity;
    var qx=ty*ez-tz*ey,qy=tz*ex-tx*ez,qz=tx*ey-ty*ex,v=(dy*qy+dz*qz)/det;if(v<0||u+v>1)return Infinity;
    var distance=(fx*qx+fy*qy+fz*qz)/det;return distance>=0?distance:Infinity;
  }
  System.prototype.pick = function (u,v,includeHeld) {
    var ox=(u-.5)*2*this.aspect,oy=3,oz=(v-.5)/slope+3/Math.sqrt(3),nearest=Infinity,hit=null;
    for(var i=0;i<this.items.length;i++){
      var b=this.items[i];if(b.held&&!includeHeld)continue;var p=this.transformed(b);
      for(var j=0;j<faces.length;j++){var f=faces[j],distance=rayTriangle(ox,oy,oz,p,f[0]*3,f[1]*3,f[2]*3);if(distance<nearest){nearest=distance;hit=b;}}
    }
    return hit;
  };
  System.prototype.inspect = function () {
    return this.items.map(function(b){return {id:b.id,u:b.u,v:b.v,x:b.x,y:b.y,z:b.z,angle:b.angle,pitch:b.pitch,roll:b.roll,speed:Math.hypot(b.vx,b.vz),driftSpeed:Math.hypot(b.flowX,b.flowZ),flowX:b.flowX,flowZ:b.flowZ,held:b.held,screenU:.5+b.x/(2*this.aspect),screenV:.5+b.z*slope-(b.y+this.size()*.25)*.25};},this);
  };
  var api={System:System,limit:limit,triangles:faces.length};root.WaterBoats=api;
  if(typeof module!=='undefined' && module.exports)module.exports=api;
}(typeof window!=='undefined'?window:global));
