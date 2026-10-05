(function (root) {
  'use strict';
  var core = typeof module !== 'undefined' && module.exports ? require('./water-core.js') : root.WaterCore;
  var slope = .4330127, limit = 12;
  // Folded hull, inner paper and the raised central fold are all world-space triangles.
  var points = [[-1,.18,0],[-.58,.18,-.44],[.58,.18,-.44],[1,.18,0],[.58,.18,.44],[-.58,.18,.44],[-.65,0,0],[.65,0,0],[-.55,.22,0],[.55,.22,0],[0,1.5,0],[0,.22,-.13],[0,.22,.13]];
  var faces = [[0,6,1],[1,6,7],[1,7,2],[2,7,3],[3,7,4],[4,7,6],[4,6,5],[5,6,0],[0,1,8],[1,2,9],[1,9,8],[2,3,9],[3,4,9],[4,5,8],[4,8,9],[5,0,8],[8,11,10],[11,9,10],[8,10,12],[12,10,9]];
  function value(t,key,fallback) { return typeof t[key] === 'number' ? t[key] : fallback; }
  function System(tuning) {
    this.tuning = tuning || {}; this.items = []; this.aspect = 1; this.field = null; this.obstacle = function(){return false;}; this.clock = 0; this.serial = 0;
    this.vertices = new Float32Array(limit * faces.length * 33);
    this.shadowVertices = new Float32Array(limit * 66);
    this.work = new Float32Array(points.length * 3);
    this.hullA=new Float32Array(12);this.hullB=new Float32Array(12);
  }
  System.prototype.attach = function (aspect, field, obstacle) { this.aspect=aspect; this.field=field; this.obstacle=obstacle; this.stopMotion(); };
  System.prototype.size = function () { return .16 * Math.min(1,this.aspect) * value(this.tuning,'boatSize',1); };
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
      var other=this.items[i];if(other===ignore || Math.hypot((u-other.u)*2*this.aspect,(v-other.v)/slope)>s*2.05)continue;
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
    var angle=-.2;
    if(this.items.length>=limit || !this.clearAt(u,v,angle,null))return null;
    var b={id:++this.serial,u:u,v:v,angle:angle,vx:0,vz:0,held:false,pitch:0,roll:0};this.items.push(b);this.pose(b);return b;
  };
  System.prototype.stopMotion = function () { for(var i=0;i<this.items.length;i++){this.items[i].vx=0;this.items[i].vz=0;this.items[i].held=false;} };
  System.prototype.clear = function () { this.items.length=0; };
  System.prototype.drag = function (b,u,v) {
    var dx=(u-b.u)*2*this.aspect,dz=(v-b.v)/slope,distance=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(distance/(this.size()*.22))),startU=b.u,startV=b.v;
    b.vx=0;b.vz=0;
    for(var i=1;i<=steps;i++){var a=startU+(u-startU)*i/steps,d=startV+(v-startV)*i/steps;if(!this.clearAt(a,d,b.angle,b))break;b.u=a;b.v=d;}
    this.pose(b);return Math.hypot((b.u-startU)*2*this.aspect,(b.v-startV)/slope);
  };
  System.prototype.launch = function (b,vx,vz) {
    b.held=false;var speed=Math.hypot(vx,vz),strength=value(this.tuning,'boatInertia',1.1),max=value(this.tuning,'boatMaxSpeed',1.5);
    if(speed<value(this.tuning,'boatThrowThreshold',.15) || !isFinite(speed)){b.vx=0;b.vz=0;return;}
    var factor=Math.min(speed*strength,max)/speed;b.vx=vx*factor;b.vz=vz*factor;
  };
  System.prototype.update = function (dt,time) {
    this.clock=time;dt=Math.min(.08,Math.max(0,dt));
    for(var i=0;i<this.items.length;i++){
      var b=this.items[i],speed=Math.hypot(b.vx,b.vz);
      var max=value(this.tuning,'boatMaxSpeed',1.5);if(speed>max){b.vx*=max/speed;b.vz*=max/speed;speed=max;}
      if(!b.held && speed>0){
        var oldU=b.u,oldV=b.v,decay=Math.exp(-value(this.tuning,'boatFriction',1.25)*dt),vx=b.vx,vz=b.vz;
        var length=speed*dt*(1+decay)/2;
        var moved=this.drag(b,b.u+vx/speed*length/(2*this.aspect),b.v+vz/speed*length*slope);
        // Swept hull contact stops the boat without passing through rocks or jittering on shore.
        if(moved<length-.00001 || speed*decay<.012){b.vx=0;b.vz=0;}else{b.vx=vx*decay;b.vz=vz*decay;}
        if(moved>.0001 && this.field)this.field.stroke(oldU,oldV,b.u,b.v,Math.min(.07,speed*.035));
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
        var nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,len=Math.hypot(nx,ny,nz),shade=j<8 ? .90:j<16 ? .97:1;
        for(var k=0;k<3;k++){var v=f[k]*3;out[at++]=p[v];out[at++]=p[v+1];out[at++]=p[v+2];out[at++]=0;out[at++]=0;out[at++]=nx/len;out[at++]=ny/len;out[at++]=nz/len;out[at++]=shade;out[at++]=shade*(b.id%3===0 ? .88:.96);out[at++]=shade*.84;}
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
    return this.items.map(function(b){return {id:b.id,u:b.u,v:b.v,x:b.x,y:b.y,z:b.z,angle:b.angle,pitch:b.pitch,roll:b.roll,speed:Math.hypot(b.vx,b.vz),held:b.held,screenU:.5+b.x/(2*this.aspect),screenV:.5+b.z*slope-(b.y+this.size()*.25)*.25};},this);
  };
  var api={System:System,limit:limit,triangles:faces.length};root.WaterBoats=api;
  if(typeof module!=='undefined' && module.exports)module.exports=api;
}(typeof window!=='undefined'?window:global));
