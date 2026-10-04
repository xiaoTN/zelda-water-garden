(function (root) {
  'use strict';
  var core=root.WaterCore,asset=root.WaterFishAsset;
  function System() {
    this.aspect=1;this.scale=1;this.clock=0;this.items=[];
    var starts=[[.32,.38,.4],[.64,.40,2.3],[.40,.64,-.5],[.69,.60,3.5],[.49,.31,1.2]];
    for(var i=0;i<starts.length;i++)this.items.push({u:starts[i][0],v:starts[i][1],angle:starts[i][2],phase:i*1.73,size:.095+i*.006,y:-.085-i*.006,kind:i%3});
    this.vertices=new Float32Array(this.items.length*asset.indices.length*11);
    this.palettes=[[[.91,.86,.70],[.84,.28,.12],[.82,.77,.55],[.025,.048,.038]],[[.91,.68,.29],[.98,.87,.60],[.82,.65,.31],[.025,.048,.038]],[[.84,.88,.78],[.24,.38,.35],[.72,.79,.65],[.025,.048,.038]]];
  }
  System.prototype.attach=function(aspect){this.aspect=aspect;this.scale=Math.sqrt(Math.min(aspect,1));};
  System.prototype.clearAt=function(u,v,r,bed){
    for(var i=0;i<9;i++){
      var a=i*Math.PI/4,du=i?Math.cos(a)*r/(2*this.aspect):0,dv=i?Math.sin(a)*r*.4330127:0;
      if(core.shore(u+du,v+dv)>-.18||(bed&&bed.heightAt(u+du,v+dv)>-.145))return false;
    }
    return true;
  };
  System.prototype.update=function(dt,bed,reduced){
    if(reduced)return;
    dt=Math.min(.08,Math.max(0,dt));this.clock+=dt;
    for(var i=0;i<this.items.length;i++){
      var fish=this.items[i],speed=(.030+i*.002)*this.scale,r=fish.size*this.scale;
      var target=fish.angle+Math.sin(this.clock*.31+fish.phase)*.32*dt;
      // Look ahead using the same world-space footprint used to guard the actual move.
      if(!this.clearAt(fish.u+Math.cos(target)*r*.9/(2*this.aspect),fish.v+Math.sin(target)*r*.9*.4330127,r,bed)){
        var best=-Infinity,bestAngle=target;
        for(var k=0;k<12;k++){
          var a=fish.angle+k*Math.PI/6,u=fish.u+Math.cos(a)*r*1.3/(2*this.aspect),v=fish.v+Math.sin(a)*r*1.3*.4330127;
          var score=(this.clearAt(u,v,r,bed)?10:0)-core.shore(u,v)-Math.abs(Math.atan2(Math.sin(a-fish.angle),Math.cos(a-fish.angle)))*.12;
          if(score>best){best=score;bestAngle=a;}
        }
        target=bestAngle;
      }
      var turn=Math.atan2(Math.sin(target-fish.angle),Math.cos(target-fish.angle));
      fish.angle+=core.clamp(turn,-dt*1.25,dt*1.25);
      var nu=fish.u+Math.cos(fish.angle)*speed*dt/(2*this.aspect),nv=fish.v+Math.sin(fish.angle)*speed*dt*.4330127;
      if(this.clearAt(nu,nv,r,bed)){fish.u=nu;fish.v=nv;}
    }
  };
  System.prototype.geometry=function(field){
    var out=this.vertices,at=0;
    for(var i=0;i<this.items.length;i++){
      var fish=this.items[i],s=fish.size*this.scale,c=Math.cos(fish.angle),sn=Math.sin(fish.angle);
      var frame=(this.clock*(.78+i*.045)+fish.phase)*asset.fps,base=Math.floor(frame),blend=frame-base;
      var pose=asset.poses[base%asset.poses.length],next=asset.poses[(base+1)%asset.poses.length];
      var cx=(fish.u-.5)*2*this.aspect,cz=(fish.v-.5)/.4330127;
      var refract=field?(field.sample(fish.u+.008,fish.v)-field.sample(fish.u-.008,fish.v))*.008:0;
      for(var j=0;j<asset.indices.length;j++){
        var index=asset.indices[j]*3;
        var x=(pose[index]*(1-blend)+next[index]*blend)/asset.scale;
        var y=(pose[index+1]*(1-blend)+next[index+1]*blend)/asset.scale;
        var z=(pose[index+2]*(1-blend)+next[index+2]*blend)/asset.scale;
        var wx=cx+(x*c-z*sn)*s+refract,wy=fish.y+y*s,wz=cz+(x*sn+z*c)*s;
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
      var alpha=.75*(1-field.ice.sample(u,v));if(alpha<.02)continue;
      var shade=.72+Math.max(0,-data[at+5]*.4+ny*.8-nz*.3)*.25;
      var r=(data[at+8]*shade*.75+.04)*255,g=(data[at+9]*shade*.75+.14)*255,b=(data[at+10]*shade*.75+.16)*255;
      if(light===1){r*=1.05;g*=.88;b*=.8;}if(light===2){r*=.43;g*=.63;b*=.83;}
      ctx.fillStyle='rgba('+Math.round(r)+','+Math.round(g)+','+Math.round(b)+','+alpha+')';ctx.beginPath();
      for(var j=0;j<3;j++){var k=at+j*11;if(!j)ctx.moveTo(data[k+3]*width,data[k+4]*height);else ctx.lineTo(data[k+3]*width,data[k+4]*height);}
      ctx.closePath();ctx.fill();
    }
  };
  root.WaterFish={System:System};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.WaterFish;
}(typeof window!=='undefined'?window:global));
