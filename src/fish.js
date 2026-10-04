(function (root) {
  'use strict';
  var core=root.WaterCore,asset=root.WaterFishAsset;
  function System() {
    this.aspect=1;this.scale=1;this.clock=0;this.quiet=0;this.items=[];
    var starts=[[.32,.38,.4],[.64,.40,2.3],[.40,.64,-.5],[.69,.60,3.5],[.49,.31,1.2]];
    for(var i=0;i<starts.length;i++)this.items.push({u:starts[i][0],v:starts[i][1],angle:starts[i][2],phase:i*1.73,swim:i*.23,size:.095+i*.006,y:-.085-i*.006,kind:i%3,fear:0,threatU:0,threatV:0,speed:.030+i*.002,flowX:0,flowZ:0,bank:0,wake:0});
    this.vertices=new Float32Array(this.items.length*asset.indices.length*11);
    this.palettes=[[[.91,.86,.70],[.84,.28,.12],[.82,.77,.55],[.025,.048,.038]],[[.91,.68,.29],[.98,.87,.60],[.82,.65,.31],[.025,.048,.038]],[[.84,.88,.78],[.24,.38,.35],[.72,.79,.65],[.025,.048,.038]]];
  }
  System.prototype.attach=function(aspect){this.aspect=aspect;this.scale=Math.sqrt(Math.min(aspect,1));};
  System.prototype.calm=function(){
    this.quiet=1.5;
    for(var i=0;i<this.items.length;i++){var f=this.items[i];f.fear=0;f.flowX=0;f.flowZ=0;f.wake=0;f.speed=(.030+i*.002)*this.scale;}
  };
  System.prototype.scare=function(u,v,power,u0,v0){
    if(!Number.isFinite(u)||!Number.isFinite(v))return;
    u0=Number.isFinite(u0)?u0:u;v0=Number.isFinite(v0)?v0:v;
    var dx=(u-u0)*2*this.aspect,dz=(v-v0)/.4330127,len=dx*dx+dz*dz,radius=(.23+power*.16)*this.scale;
    for(var i=0;i<this.items.length;i++){
      var f=this.items[i],px=(f.u-u0)*2*this.aspect,pz=(f.v-v0)/.4330127;
      var t=len?core.clamp((px*dx+pz*dz)/len,0,1):0;
      var x=px-dx*t,z=pz-dz*t,d=Math.sqrt(x*x+z*z);
      var fear=core.clamp(power*(1-d/radius)*1.7,0,1);
      if(fear>f.fear){f.fear=fear;f.threatU=u0+(u-u0)*t;f.threatV=v0+(v-v0)*t;}
    }
  };
  System.prototype.clearAt=function(u,v,r,bed){
    for(var i=0;i<9;i++){
      var a=i*Math.PI/4,du=i?Math.cos(a)*r/(2*this.aspect):0,dv=i?Math.sin(a)*r*.4330127:0;
      if(core.shore(u+du,v+dv)>-.18||(bed&&bed.heightAt(u+du,v+dv)>-.145))return false;
    }
    return true;
  };
  System.prototype.anticipate=function(stones){
    for(var i=0;i<stones.length;i++){
      var stone=stones[i];if(stone.entered||stone.settled||stone.y<=0)continue;
      var velocity=stone.body.velocity,vy=velocity.y;
      var untilImpact=Math.min(1.2,(vy+Math.sqrt(vy*vy+13*stone.y))/6.5);
      var u=stone.u+velocity.x*untilImpact/(2*this.aspect),v=stone.v+velocity.z*untilImpact*.4330127;
      this.scare(u,v,1.7+Math.max(0,.6-untilImpact));
    }
  };
  System.prototype.update=function(dt,bed,reduced,field){
    if(reduced)return;
    dt=Math.min(.08,Math.max(0,dt));this.clock+=dt;this.quiet=Math.max(0,this.quiet-dt);
    for(var i=0;i<this.items.length;i++){
      var fish=this.items[i],r=fish.size*this.scale,wave=0,gx=0,gz=0,liquid=1;
      fish.fear*=Math.exp(-dt/1.65);
      if(field){
        liquid=1-field.ice.sample(fish.u,fish.v);
        var ex=.014*this.scale/(2*this.aspect),ez=.014*this.scale*.4330127;
        wave=field.sample(fish.u,fish.v)*liquid;
        gx=(field.sample(fish.u+ex,fish.v)-field.sample(fish.u-ex,fish.v))*liquid;
        gz=(field.sample(fish.u,fish.v+ez)-field.sample(fish.u,fish.v-ez))*liquid;
        // Strong external waves startle fish; their own small wakes stay below this threshold.
        if(Math.abs(wave)>.24&&Math.abs(gx)+Math.abs(gz)>.07&&fish.fear<.35){
          fish.fear=.35;fish.threatU=fish.u+gx*.3/this.aspect;fish.threatV=fish.v+gz*.3;
        }
      }
      var follow=1-Math.exp(-dt*4);
      fish.flowX+=(core.clamp(-gx*1.5,-.09,.09)*this.scale-fish.flowX)*follow;
      fish.flowZ+=(core.clamp(-gz*1.5,-.09,.09)*this.scale-fish.flowZ)*follow;
      var cruise=(.030+i*.002+.009*Math.sin(this.clock*.6+fish.phase))*this.scale;
      fish.speed+=(cruise+fish.fear*.36*this.scale-fish.speed)*(1-Math.exp(-dt*(5+fish.fear*9)));
      var depth=-.085-i*.004+Math.sin(this.clock*.45+fish.phase)*.016-fish.fear*.065+core.clamp(wave*.028,-.012,.012);
      fish.y+=(depth-fish.y)*(1-Math.exp(-dt*3));
      var target=fish.angle+Math.sin(this.clock*.31+fish.phase)*.32*dt;
      if(fish.fear>.035){
        var awayX=(fish.u-fish.threatU)*2*this.aspect,awayZ=(fish.v-fish.threatV)/.4330127;
        target=Math.abs(awayX)+Math.abs(awayZ)<.0001?fish.angle+1.4:Math.atan2(awayZ,awayX);
      }
      // Keep a small personal space instead of letting the school overlap indefinitely.
      var separateX=0,separateZ=0;
      for(var other=0;other<this.items.length;other++)if(other!==i){
        var peer=this.items[other],sx=(fish.u-peer.u)*2*this.aspect,sz=(fish.v-peer.v)/.4330127,dist=Math.sqrt(sx*sx+sz*sz);
        if(dist>0&&dist<r*1.3){var force=(1-dist/(r*1.3))*.025*this.scale;separateX+=sx/dist*force;separateZ+=sz/dist*force;}
      }
      // Look ahead using the same world-space footprint used to guard the actual move.
      var clearHere=this.clearAt(fish.u,fish.v,r,bed);
      if(!this.clearAt(fish.u+Math.cos(target)*r*.9/(2*this.aspect),fish.v+Math.sin(target)*r*.9*.4330127,r,bed)){
        var best=-Infinity,bestAngle=target;
        for(var k=0;k<12;k++){
          var reach=clearHere?1.3:4,a=fish.angle+k*Math.PI/6,u=fish.u+Math.cos(a)*r*reach/(2*this.aspect),v=fish.v+Math.sin(a)*r*reach*.4330127;
          var score=(this.clearAt(u,v,r,bed)?10:0)-core.shore(u,v)-Math.abs(Math.atan2(Math.sin(a-target),Math.cos(a-target)))*.12;
          if(score>best){best=score;bestAngle=a;}
        }
        target=bestAngle;
      }
      var turn=Math.atan2(Math.sin(target-fish.angle),Math.cos(target-fish.angle));
      var maxTurn=dt*(1.25+fish.fear*9),turned=core.clamp(turn,-maxTurn,maxTurn);
      fish.angle+=turned;
      fish.bank+=(core.clamp(-turn*.16,-.16,.16)-fish.bank)*follow;
      var vx=Math.cos(fish.angle)*fish.speed+fish.flowX+separateX,vz=Math.sin(fish.angle)*fish.speed+fish.flowZ+separateZ;
      var nu=fish.u+vx*dt/(2*this.aspect),nv=fish.v+vz*dt*.4330127,moved=false;
      // If a new rock lands on this footprint, swim out while hidden by its depth, never teleport.
      if(this.clearAt(nu,nv,r,bed)||(!clearHere&&this.clearAt(nu,nv,r,null))){fish.u=nu;fish.v=nv;moved=true;}
      fish.swim+=dt*(.65+fish.speed/(.035*this.scale)*.45+fish.fear*1.2);
      fish.wake+=dt;
      // Fast strokes and abrupt turns transmit a stronger wake even during an escape dive.
      var fast=core.clamp((fish.speed/this.scale-.055)/.28,0,1),turning=core.clamp(Math.abs(turned)/Math.max(dt,.001)/7,0,1)*fast;
      if(field&&(moved||turning>.15)&&fish.wake>=.12-fast*.055&&(this.quiet===0||fish.fear>.4)&&liquid>.8){
        fish.wake=0;
        var nearSurface=core.clamp((fish.y+.13)/.065,0,1),strength=(.006+fish.speed/this.scale*.06)*nearSurface*nearSurface+(.10*fast*fast+.09*turning)*(.35+.65*nearSurface);
        var ox=Math.cos(fish.angle)*r*.42/(2*this.aspect),oz=Math.sin(fish.angle)*r*.42*.4330127;
        var radius=(.011+fast*.010)*this.scale;
        field.disturb(fish.u+ox,fish.v+oz,strength,radius);
        field.disturb(fish.u-ox,fish.v-oz,-strength,radius);
        if(turning>.15){
          var side=turned>0?1:-1,sx=-Math.sin(fish.angle)*r*.65/(2*this.aspect),sz=Math.cos(fish.angle)*r*.65*.4330127;
          field.disturb(fish.u+sx,fish.v+sz,strength*side*.7,radius);
          field.disturb(fish.u-sx,fish.v-sz,-strength*side*.7,radius);
        }
      }
    }
  };
  System.prototype.geometry=function(field){
    var out=this.vertices,at=0;
    for(var i=0;i<this.items.length;i++){
      var fish=this.items[i],s=fish.size*this.scale,c=Math.cos(fish.angle),sn=Math.sin(fish.angle);
      var frame=fish.swim*asset.fps,base=Math.floor(frame),blend=frame-base;
      var pose=asset.poses[base%asset.poses.length],next=asset.poses[(base+1)%asset.poses.length];
      var cx=(fish.u-.5)*2*this.aspect,cz=(fish.v-.5)/.4330127;
      var refract=field?(field.sample(fish.u+.008,fish.v)-field.sample(fish.u-.008,fish.v))*.008:0;
      for(var j=0;j<asset.indices.length;j++){
        var index=asset.indices[j]*3;
        var x=(pose[index]*(1-blend)+next[index]*blend)/asset.scale;
        var y=(pose[index+1]*(1-blend)+next[index+1]*blend)/asset.scale;
        var z=(pose[index+2]*(1-blend)+next[index+2]*blend)/asset.scale;
        var wx=cx+(x*c-z*sn)*s+refract,wy=fish.y+(y+z*fish.bank)*s,wz=cz+(x*sn+z*c)*s;
        out[at]=wx;out[at+1]=wy;out[at+2]=wz;
        out[at+3]=.5+wx/(2*this.aspect);out[at+4]=.5+wz*.4330127-wy*.25;
        var color=this.palettes[fish.kind][asset.materials[Math.floor(j/3)]];
        out[at+8]=color[0];out[at+9]=color[1];out[at+10]=color[2];at+=11;
      }
    }
    // Recompute face normals after bending; reuse the packed array for both renderers.
    for(at=0;at<out.length;at+=33){
      var ax=out[at+11]-out[at],ay=out[at+12]-out[at+1],az=out[at+13]-out[at+2];
      var bx=out[at+22]-out[at],by=out[at+23]-out[at+1],bz=out[at+24]-out[at+2];
      var nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,len=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;
      for(var n=0;n<3;n++){out[at+n*11+5]=nx/len;out[at+n*11+6]=ny/len;out[at+n*11+7]=nz/len;}
    }
    return out;
  };
  System.prototype.drawFallback=function(ctx,width,height,field,light){
    var data=this.geometry(field);
    for(var at=0;at<data.length;at+=33){
      var ny=data[at+6],nz=data[at+7];if(ny*.866-nz*.5<0)continue;
      var u=(data[at+3]+data[at+14]+data[at+25])/3,v=(data[at+4]+data[at+15]+data[at+26])/3;
      if(field.bathymetry&&field.bathymetry.heightAt(u,v)>data[at+1])continue;
      var alpha=1-field.ice.sample(u,v);if(alpha<.02)continue;
      var shade=.72+Math.max(0,-data[at+5]*.4+ny*.8-nz*.3)*.25;
      // Lightweight projection of the same shallow/deep water palette over the actual fish surface.
      var depth=Math.max(0,-(data[at+1]+data[at+12]+data[at+23])/3),t=core.clamp((depth-.012)/.063,0,1);t=t*t*(3-2*t);
      var wr=.63+(.24-.63)*t,wg=.90+(.72-.90)*t,wb=.82+(.73-.82)*t;
      t=core.clamp((depth-.12)/.08,0,1);t=t*t*(3-2*t);wr+=(.16-wr)*t;wg+=(.59-wg)*t;wb+=(.68-wb)*t;
      t=core.clamp((depth-.008)/.172,0,1);t=t*t*(3-2*t);var waterAlpha=.62+.32*t;
      var r=(data[at+8]*shade*(1-waterAlpha)+wr*waterAlpha)*255,g=(data[at+9]*shade*(1-waterAlpha)+wg*waterAlpha)*255,b=(data[at+10]*shade*(1-waterAlpha)+wb*waterAlpha)*255;
      if(light===1){r*=1.05;g*=.88;b*=.8;}if(light===2){r*=.43;g*=.63;b*=.83;}
      ctx.fillStyle='rgba('+Math.round(r)+','+Math.round(g)+','+Math.round(b)+','+alpha+')';ctx.beginPath();
      for(var j=0;j<3;j++){var k=at+j*11;if(!j)ctx.moveTo(data[k+3]*width,data[k+4]*height);else ctx.lineTo(data[k+3]*width,data[k+4]*height);}
      ctx.closePath();ctx.fill();
    }
  };
  root.WaterFish={System:System};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.WaterFish;
}(typeof window!=='undefined'?window:global));
