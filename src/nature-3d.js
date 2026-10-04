(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Nature3D = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  function unit(v) { var l = Math.hypot(v[0], v[1], v[2]); return v.map(function (x) { return x / l; }); }
  function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function dot(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function multiply(a, b) {
    var m = new Float32Array(16);
    for (var c=0;c<4;c++) for(var r=0;r<4;r++) for(var k=0;k<4;k++) m[c*4+r]+=a[k*4+r]*b[c*4+k];
    return m;
  }
  function Camera(aspect) {
    this.aspect=aspect; this.eye=[0,12,6]; this.tan=Math.tan(40*Math.PI/360);
    this.forward=unit(this.eye.map(function(x){return -x;})); this.right=unit(cross(this.forward,[0,1,0])); this.up=cross(this.right,this.forward);
    var r=this.right,u=this.up,f=this.forward,e=this.eye;
    var view=new Float32Array([r[0],u[0],-f[0],0,r[1],u[1],-f[1],0,r[2],u[2],-f[2],0,-dot(r,e),-dot(u,e),dot(f,e),1]);
    var near=.1,far=80,t=1/this.tan;
    this.matrix=multiply(new Float32Array([t/aspect,0,0,0,0,t,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]),view);
  }
  Camera.prototype.ray=function(u,v) {
    var x=(u*2-1)*this.tan*this.aspect,y=(1-v*2)*this.tan,self=this;
    return {origin:this.eye, direction:unit(this.forward.map(function(f,i){return f+self.right[i]*x+self.up[i]*y;}))};
  };
  Camera.prototype.project=function(p) {
    var a=this.matrix,w=a[3]*p[0]+a[7]*p[1]+a[11]*p[2]+a[15];
    return {u:((a[0]*p[0]+a[4]*p[1]+a[8]*p[2]+a[12])/w+1)/2,v:(1-(a[1]*p[0]+a[5]*p[1]+a[9]*p[2]+a[13])/w)/2};
  };
  function intersect(camera,u,v,height) {
    var ray=camera.ray(u,v),o=ray.origin,d=ray.direction,previous=0;
    // Find the first surface crossing, then refine: steep ridges still pick the visible face.
    for(var t=.2;t<55;t+=.2) {
      var x=o[0]+d[0]*t,z=o[2]+d[2]*t;
      if(o[1]+d[1]*t<=height(x,z)) {
        var lo=previous,hi=t;
        for(var k=0;k<14;k++){var mid=(lo+hi)/2;if(o[1]+d[1]*mid>height(o[0]+d[0]*mid,o[2]+d[2]*mid))lo=mid;else hi=mid;}
        return [o[0]+d[0]*hi,o[1]+d[1]*hi,o[2]+d[2]*hi];
      }
      previous=t;
    }
    return null;
  }
  function rotation(q,dx,dz,radius) {
    var distance=Math.hypot(dx,dz); if(distance<1e-8)return q;
    var a=distance/radius/2,s=Math.sin(a)/distance,x=dz*s,z=-dx*s,w=Math.cos(a);
    var result=[w*q[0]-z*q[1]+x*q[3],w*q[1]+z*q[0]-x*q[2],w*q[2]+x*q[1]+z*q[3],w*q[3]-x*q[0]-z*q[2]];
    var n=Math.hypot.apply(Math,result);return result.map(function(v){return v/n;});
  }
  return { Camera:Camera, intersect:intersect, rotation:rotation };
}));
