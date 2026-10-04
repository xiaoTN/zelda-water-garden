(function () {
  'use strict';
  function Renderer(canvas,snow,clouds) {
    this.canvas=canvas;this.snow=snow;this.clouds=clouds;this.surface=null;this.light=-1;this.blocked=false;
    this.status=document.getElementById('render-status');
    try{this.surface=new window.NatureSurface(canvas);}catch(error){this.error=error.message;}
  }
  Renderer.prototype.resize=function(width,height,low){
    var size=window.WaterCore.bufferSize(width,height,window.devicePixelRatio,low);
    this.width=width;this.height=height;this.snow.aspect=width/height;this.clouds.aspect=width/height;
    if(this.surface)this.surface.resize(size.width,size.height,low);
  };
  Renderer.prototype.fallback=function(){this.blocked=true;};
  Renderer.prototype.available=function(){return !!this.surface&&!this.surface.lost&&!this.blocked;};
  Renderer.prototype.draw=function(kind,light,time,weather,reduced){
    this.light=light;
    var available=this.available();this.status.hidden=available;
    if(!available){this.status.textContent=this.surface&&this.surface.lost?'3D 画面暂时中断，等待恢复；也可刷新重试。':'此设备暂时无法运行 3D 场景，请启用硬件加速后刷新重试。';return;}
    this.surface.draw(kind,light,this.snow,this.clouds,time,weather,reduced);
  };
  window.NatureRenderer=Renderer;
}());
