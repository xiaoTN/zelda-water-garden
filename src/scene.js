(function (root) {
  'use strict';
  var core = root.WaterCore;
  function makeScene(aspect) {
    // This canvas supplies only the submerged sand texture. Water is a lit,
    // displaced WebGL mesh, with the same bed used by depth and physics.
    var canvas=document.createElement('canvas');
    canvas.width=aspect>=1?1024:Math.max(256,Math.round(1024*aspect));
    canvas.height=aspect>=1?Math.max(256,Math.round(1024/aspect)):1024;
    var ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    var data=ctx.createImageData(w,h),random=core.seededRandom(73283);
    for(var y=0;y<h;y++)for(var x=0;x<w;x++){
      var u=x/w,v=y/h,p=(y*w+x)*4;
      var sand=6*Math.sin(u*13+v*4)*Math.cos(v*11-u*3)+random()*3;
      data.data[p]=108+sand;data.data[p+1]=132+sand;data.data[p+2]=108+sand;data.data[p+3]=255;
    }
    ctx.putImageData(data,0,0);return canvas;
  }
  var noiseCanvas = null;
  function makeNoise() {
    if (noiseCanvas) return noiseCanvas;
    var size = 256, random = core.seededRandom(57812), grids = [], frequencies = [4,8,16,32,64];
    for (var k = 0; k < frequencies.length; k++) {
      var n = frequencies[k], grid = new Float32Array(n * n);
      for (var i = 0; i < grid.length; i++) grid[i] = random();
      grids.push(grid);
    }
    function noise(u, v, level) {
      var n = frequencies[level], x = u * n, y = v * n, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, g = grids[level];
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      var a = g[(iy % n) * n + ix % n], b = g[(iy % n) * n + (ix + 1) % n], c = g[((iy + 1) % n) * n + ix % n], d = g[((iy + 1) % n) * n + (ix + 1) % n];
      return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    }
    var heights = new Float32Array(size * size);
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) heights[y * size + x] = noise(x / size, y / size, 1) * .58 + noise(x / size, y / size, 2) * .27 + noise(x / size, y / size, 3) * .11 + noise(x / size, y / size, 4) * .04;
    noiseCanvas = document.createElement('canvas'); noiseCanvas.width = size; noiseCanvas.height = size;
    var context = noiseCanvas.getContext('2d'), image = context.createImageData(size, size);
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
      var p = (y * size + x) * 4;
      var dx = heights[y * size + (x + 1) % size] - heights[y * size + (x + size - 1) % size];
      var dy = heights[((y + 1) % size) * size + x] - heights[((y + size - 1) % size) * size + x];
      image.data[p] = core.clamp(.5 + dx * 12, 0, 1) * 255; image.data[p + 1] = core.clamp(.5 + dy * 12, 0, 1) * 255;
      image.data[p + 2] = noise(x / size, y / size, 0) * 255; image.data[p + 3] = noise(x / size, y / size, 2) * 255;
    }
    context.putImageData(image, 0, 0);
    return noiseCanvas;
  }
  root.WaterScene = { create: makeScene, createNoise: makeNoise };
}(window));
