(function(root){
  'use strict';
  var size=256,tau=Math.PI*2,cache={};
  var waves=[[2,3,.43,.2],[4,-2,.21,2.4],[-5,7,.11,1.2],[8,5,.05,4.4],[13,-9,.018,2.1]];
  function height(u,v){var h=0;for(var i=0;i<waves.length;i++){var w=waves[i];h+=Math.sin(tau*(u*w[0]+v*w[1])+w[3])*w[2];}return h;}
  function pixels(kind){
    var data=new Uint8ClampedArray(size*size*4),cells=[],seed=84392;
    function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    for(var cy=0;cy<8;cy++)for(var cx=0;cx<8;cx++)cells.push([(cx+.15+random()*.7)/8,(cy+.15+random()*.7)/8]);
    for(var y=0;y<size;y++)for(var x=0;x<size;x++){
      var u=x/size,v=y/size,p=(y*size+x)*4;
      if(kind==='normal'){
        var e=1/size,dx=(height(u+e,v)-height(u-e,v))*4,dy=(height(u,v+e)-height(u,v-e))*4,l=Math.sqrt(dx*dx+dy*dy+1);
        data[p]=Math.round((.5-dx/l*.5)*255);data[p+1]=Math.round((.5-dy/l*.5)*255);data[p+2]=Math.round((.5+.5/l)*255);
      }else{
        var wu=u+Math.sin(v*tau*3)*.012,wv=v+Math.sin(u*tau*2)*.012,a=10,b=10;
        for(var i=0;i<cells.length;i++){
          var xx=Math.abs(wu-cells[i][0]),yy=Math.abs(wv-cells[i][1]);xx=Math.min(xx,Math.abs(1-xx));yy=Math.min(yy,Math.abs(1-yy));var d=Math.sqrt(xx*xx+yy*yy);
          if(d<a){b=a;a=d;}else if(d<b)b=d;
        }
        data[p]=Math.round(Math.exp(-(b-a)*125)*255);data[p+1]=Math.round((.5+height(u,v)*.55)*255);data[p+2]=Math.round(Math.min(1,a*13)*255);
      }
      data[p+3]=255;
    }
    return data;
  }
  function canvas(kind){
    if(cache[kind])return cache[kind];
    var c=document.createElement('canvas');c.width=size;c.height=size;
    var ctx=c.getContext('2d'),image=ctx.createImageData(size,size);image.data.set(pixels(kind));ctx.putImageData(image,0,0);cache[kind]=c;return c;
  }
  root.WaterMaps={pixels:pixels,canvas:canvas};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.WaterMaps;
}(typeof window!=='undefined'?window:global));
