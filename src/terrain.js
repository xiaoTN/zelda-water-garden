(function (root) {
  'use strict';
  var core = root.WaterCore;
  function elevation(u,v) {
    var d=core.shore(u,v);
    return d<0 ? Math.max(-.22,d*.85) : Math.min(.075,d*.30);
  }
  function create(aspect,low) {
    var ground=[],stones=[],shadows=[],rocks=[],random=core.seededRandom(92841),unit=Math.min(aspect,1);
    function triangle(out,a,b,c,color) {
      var ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
      var nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,len=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;
      if(ny<0&&out===ground){nx=-nx;ny=-ny;nz=-nz;}
      [a,b,c].forEach(function(p){out.push(p[0],p[1],p[2],p[3],p[4],nx/len,ny/len,nz/len,color[0],color[1],color[2]);});
    }
    function groundPoint(u,v){return [(u-.5)*aspect*2,elevation(u,v),(v-.5)*2/.8660254,u,v];}
    var cells=low?48:80;
    for(var y=0;y<cells;y++)for(var x=0;x<cells;x++) {
      // Extend beyond the viewport so the elevated bank cannot expose the background.
      var u=x/cells*1.12-.06,v=y/cells*1.12-.06,s=1.12/cells;
      var a=groundPoint(u,v),b=groundPoint(u+s,v),c=groundPoint(u,v+s),d=groundPoint(u+s,v+s);
      triangle(ground,a,c,b,[1,1,1]);triangle(ground,b,c,d,[1,1,1]);
    }
    function rock(u,v,radius,tall,submerged) {
      var start=stones.length/11,cx=(u-.5)*aspect*2,cz=(v-.5)*2/.8660254;
      var base=elevation(u,v)-radius*.35,h=radius*tall,rotation=random()*6.28,n=7,lower=[],upper=[];
      var tint=.84+random()*.2,color=[.46*tint,.52*tint,.40*tint];
      for(var k=0;k<n;k++) {
        var a=rotation+k/n*Math.PI*2,r=radius*(.85+random()*.28),px=Math.cos(a)*r,pz=Math.sin(a)*r*.85;
        lower.push([cx+px,base,cz+pz,u,v]);
        upper.push([cx+px*.72,base+h*(.68+random()*.18),cz+pz*.72,u,v]);
      }
      var top=[cx-radius*.12,base+h,cz-radius*.08,u,v];
      for(k=0;k<n;k++) {
        var next=(k+1)%n;
        triangle(stones,lower[k],upper[k],lower[next],color);
        triangle(stones,lower[next],upper[k],upper[next],color);
        triangle(stones,upper[k],top,upper[next],color);
      }
      rocks.push({u:u,v:v,radius:radius,base:base,top:base+h,start:start,count:stones.length/11-start,submerged:submerged});
      for(k=0;k<12;k++) {
        var disk=[];
        for(var j=0;j<3;j++) {
          var angle=(k+j-1)/12*Math.PI*2,ox=j?Math.cos(angle)*radius*1.45:0,oz=j?Math.sin(angle)*radius*1.25:0;
          disk.push([cx+ox,elevation(u+ox/(aspect*2),v+oz*.4330127)+.004,cz+oz,j ? .5+Math.cos(angle)*.5 : .5,j ? .5+Math.sin(angle)*.5 : .5]);
        }
        triangle(shadows,disk[0],disk[1],disk[2],[1,1,1]);
      }
    }
    for(var i=0;i<112;i++) {
      var a=i/112*Math.PI*2+(random()-.5)*.065;
      var edge=1+.048*Math.sin(a*5+.7)+.024*Math.sin(a*9-.5)+.04*Math.cos(a*3);
      var r=edge+.008+random()*.12;
      rock(.5+Math.cos(a)*.465*r,.49+Math.sin(a)*.35*r,(.016+random()*.045)*unit,1.15+random()*.65,false);
    }
    // Larger shoreline stones deliberately cross the water plane, exposing wet feet and dry tops.
    for(i=0;i<8;i++) {
      a=i/8*Math.PI*2+.36;edge=1+.048*Math.sin(a*5+.7)+.024*Math.sin(a*9-.5)+.04*Math.cos(a*3);
      rock(.5+Math.cos(a)*.465*(edge-.025),.49+Math.sin(a)*.35*(edge-.025),(.055+random()*.02)*unit,1.65/Math.sqrt(unit),false);
    }
    for(i=0;i<24;i++) {
      a=random()*6.28;r=.74+random()*.11;
      rock(.5+Math.cos(a)*.465*r,.49+Math.sin(a)*.35*r,(.014+random()*.016)*unit,.85,true);
    }
    var stoneData=new Float32Array(stones);
    // Projected triangles let pointer interaction respect visible dry rock surfaces.
    function blocks(u,v) {
      for(var i=0;i<rocks.length;i++) {
        var rock=rocks[i];if(rock.top<=0)continue;
        if(Math.abs(u-rock.u)>rock.radius/aspect||Math.abs(v-rock.v)>rock.radius+rock.top*.25)continue;
        for(var at=rock.start*11;at<(rock.start+rock.count)*11;at+=33) {
          var ax=stoneData[at]/(2*aspect)+.5,ay=.5+stoneData[at+2]*.4330127-stoneData[at+1]*.25;
          var bx=stoneData[at+11]/(2*aspect)+.5,by=.5+stoneData[at+13]*.4330127-stoneData[at+12]*.25;
          var cx=stoneData[at+22]/(2*aspect)+.5,cy=.5+stoneData[at+24]*.4330127-stoneData[at+23]*.25;
          var det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(det)<1e-10)continue;
          var wa=((by-cy)*(u-cx)+(cx-bx)*(v-cy))/det,wb=((cy-ay)*(u-cx)+(ax-cx)*(v-cy))/det,wc=1-wa-wb;
          if(wa>=0&&wb>=0&&wc>=0&&wa*stoneData[at+1]+wb*stoneData[at+12]+wc*stoneData[at+23]>.004)return true;
        }
      }
      return false;
    }
    return {ground:new Float32Array(ground),stones:stoneData,shadows:new Float32Array(shadows),rocks:rocks,blocks:blocks};
  }
  // Rasterize the same 3D triangles from above. Heights describe real geometry, not a shore-color proxy.
  function bathymetry(mesh,aspect,low) {
    var size=low?256:512,w=aspect<1?Math.max(128,Math.round(size*aspect)):size,h=aspect<1?size:Math.max(128,Math.round(size/aspect));
    var heights=new Float32Array(w*h),stone=new Uint8Array(w*h),distance=new Float32Array(w*h),pixels=new Uint8Array(w*h*4);
    heights.fill(-1);
    function raster(data,isStone) {
      for(var at=0;at<data.length;at+=33) {
        var ax=(data[at]/(aspect*2)+.5)*w-.5,ay=(data[at+2]*.4330127+.5)*h-.5;
        var bx=(data[at+11]/(aspect*2)+.5)*w-.5,by=(data[at+13]*.4330127+.5)*h-.5;
        var cx=(data[at+22]/(aspect*2)+.5)*w-.5,cy=(data[at+24]*.4330127+.5)*h-.5;
        var det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(det)<1e-9)continue;
        var x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx))),x1=Math.min(w-1,Math.floor(Math.max(ax,bx,cx)));
        var y0=Math.max(0,Math.ceil(Math.min(ay,by,cy))),y1=Math.min(h-1,Math.floor(Math.max(ay,by,cy)));
        for(var y=y0;y<=y1;y++)for(var x=x0;x<=x1;x++) {
          var a=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det,b=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det,c=1-a-b;
          if(a<-.00001||b<-.00001||c<-.00001)continue;
          var i=y*w+x,value=a*data[at+1]+b*data[at+12]+c*data[at+23];
          if(value>heights[i]){heights[i]=value;if(isStone)stone[i]=255;}
        }
      }
    }
    raster(mesh.ground,false);raster(mesh.stones,true);
    var sx=aspect*2/w,sy=2/(.8660254*h),diagonal=Math.sqrt(sx*sx+sy*sy);
    for(var i=0;i<heights.length;i++)distance[i]=heights[i]>=-.002?0:.25;
    for(var y=0;y<h;y++)for(var x=0;x<w;x++) {
      i=y*w+x;
      if(x)distance[i]=Math.min(distance[i],distance[i-1]+sx);
      if(y)distance[i]=Math.min(distance[i],distance[i-w]+sy);
      if(x&&y)distance[i]=Math.min(distance[i],distance[i-w-1]+diagonal);
      if(x<w-1&&y)distance[i]=Math.min(distance[i],distance[i-w+1]+diagonal);
    }
    for(y=h-1;y>=0;y--)for(x=w-1;x>=0;x--) {
      i=y*w+x;
      if(x<w-1)distance[i]=Math.min(distance[i],distance[i+1]+sx);
      if(y<h-1)distance[i]=Math.min(distance[i],distance[i+w]+sy);
      if(x<w-1&&y<h-1)distance[i]=Math.min(distance[i],distance[i+w+1]+diagonal);
      if(x&&y<h-1)distance[i]=Math.min(distance[i],distance[i+w-1]+diagonal);
      var code=Math.round(core.clamp((heights[i]+.3)/.6,0,1)*65535),p=i*4;
      pixels[p]=code>>8;pixels[p+1]=code&255;pixels[p+2]=Math.round(distance[i]/.25*255);pixels[p+3]=stone[i];
    }
    function sample(data,u,v) {
      var x=core.clamp(u*w-.5,0,w-1),y=core.clamp(v*h-.5,0,h-1),ix=Math.floor(x),iy=Math.floor(y),jx=Math.min(ix+1,w-1),jy=Math.min(iy+1,h-1),tx=x-ix,ty=y-iy;
      return (data[iy*w+ix]*(1-tx)+data[iy*w+jx]*tx)*(1-ty)+(data[jy*w+ix]*(1-tx)+data[jy*w+jx]*tx)*ty;
    }
    return {width:w,height:h,pixels:pixels,heights:heights,stone:stone,distance:distance,heightAt:function(u,v){return sample(heights,u,v);},distanceAt:function(u,v){return sample(distance,u,v);}};
  }
  root.WaterTerrain={create:create,elevation:elevation,bathymetry:bathymetry};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.WaterTerrain;
}(typeof window!=='undefined'?window:global));
