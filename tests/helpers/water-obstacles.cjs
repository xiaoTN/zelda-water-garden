// Synthetic solid geometry keeps depth/occlusion regressions independent of scenery.
(function(root){
  function geometry(aspect){
    var out=[];
    function vertex(u,v,y){return [(u-.5)*aspect*2,y,(v-.5)*2/.8660254,u,v,0,1,0,.4,.5,.3];}
    function top(u0,v0,u1,v1,y){
      var a=vertex(u0,v0,y),b=vertex(u1,v0,y),c=vertex(u0,v1,y),d=vertex(u1,v1,y);
      out.push.apply(out,a.concat(c,b,b,c,d));
    }
    top(.10,.38,.18,.62,.07);
    top(.58,.38,.72,.62,-.055);
    return new Float32Array(out);
  }
  root.waterObstacleFixture=geometry;
  root.installWaterObstacleFixture=function(renderer){
    renderer.terrain.stones=geometry(renderer.field.aspect);
    var gl=renderer.gl;gl.bindBuffer(gl.ARRAY_BUFFER,renderer.stones);gl.bufferData(gl.ARRAY_BUFFER,renderer.terrain.stones,gl.STATIC_DRAW);
    renderer.baseBed=root.WaterTerrain.bathymetry(renderer.terrain,renderer.field.aspect,renderer.low);renderer.refreshDrops();
  };
  if(typeof module!=='undefined')module.exports=geometry;
}(typeof window!=='undefined'?window:global));
