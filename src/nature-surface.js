(function () {
  'use strict';
  // A displaced, lit height surface shared by deep powder and a continuous cloud sea.
  var vertex = [
    'precision highp float; attribute vec2 aUV;',
    'uniform sampler2D uNoise; uniform sampler2D uTracks; uniform mediump float uAspect,uCloud; uniform float uTime,uDrift;',
    'varying mediump vec3 vNormal; varying mediump vec2 vUV; varying mediump float vHeight,vCut,vNoise;',
    'float noiseAt(vec2 uv){ vec2 p=vec2(uv.x*uAspect,uv.y);',
    ' vec2 flow=vec2(uTime,uDrift)*uCloud;',
    ' vec2 n=texture2D(uNoise,p*mix(.85,1.1,uCloud)+flow).rg; return n.r+n.g/255.; }',
    'float heightAt(vec2 uv){ float n=noiseAt(uv); vec2 t=texture2D(uTracks,uv).rg;',
    ' float base=mix(.017+n*.019,.035+pow(n,.85)*.12,uCloud);',
    ' return mix(base-t.r*.022,base*(1.-t.r*.65),uCloud)+t.g*mix(.040,.065,uCloud); }',
    'void main(){ vec2 uv=aUV; float h=heightAt(uv); float e=.004;',
    ' float dx=(heightAt(uv+vec2(e,0.))-heightAt(uv-vec2(e,0.)))/(e*2.*uAspect);',
    ' float dy=(heightAt(uv+vec2(0.,e))-heightAt(uv-vec2(0.,e)))/(e*2.);',
    ' vNormal=normalize(vec3(-dx,-dy,1.)); vUV=uv; vHeight=h; vCut=texture2D(uTracks,uv).r; vNoise=noiseAt(uv);',
    ' gl_Position=vec4(uv.x*2.-1.,1.-uv.y*2.+h*.95,.5-uv.y*.2-h,1.); }'
  ].join('\n');
  var fragment = [
    'precision mediump float; uniform sampler2D uNoise; uniform float uCloud,uLight,uAspect;',
    'varying vec3 vNormal; varying vec2 vUV; varying float vHeight,vCut,vNoise;',
    'void main(){ vec3 normal=normalize(vNormal); vec3 sun=normalize(vec3(-.55,-.65,.75));',
    ' float lit=max(0.,dot(normal,sun)); vec2 grain=texture2D(uNoise,vec2(vUV.x*uAspect,vUV.y)*12.).rg; float powder=grain.r+grain.g/255.;',
    ' float ao=clamp(1.-vCut*.065-(1.-vNoise)*uCloud*.12,.7,1.);',
    ' vec3 shade=mix(vec3(.48,.61,.80),vec3(.62,.65,.82),uCloud), white=vec3(1.,.995,.985);',
    ' if(uLight>.5&&uLight<1.5){shade=vec3(.48,.39,.64);white=vec3(1.,.86,.76);}',
    ' if(uLight>1.5){shade=vec3(.12,.22,.39);white=vec3(.63,.77,.91);}',
    ' float tone=mix(smoothstep(-.2,.84,lit)*.94+.06,smoothstep(.0,.92,lit)*.9+.08,uCloud); vec3 col=mix(shade,white,tone)*ao;',
    ' col+=(powder-.5)*mix(.026,.015,uCloud);',
    ' float spark=pow(max(0.,powder-.65)*2.85,9.)*pow(lit,12.)*.12*(1.-uCloud);',
    ' col+=vec3(spark); gl_FragColor=vec4(col,1.); }'
  ].join('\n');
  function noiseData() {
    var n=256, data=new Uint8Array(n*n*4), values=new Float32Array(n*n);
    function hash(x,y,period){ x=(x%period+period)%period; y=(y%period+period)%period; var a=Math.sin(x*127.1+y*311.7+17.3)*43758.5453; return a-Math.floor(a); }
    var sites={};
    function noise(x,y,period){
      if(!sites[period]){sites[period]=[];for(var sy=0;sy<period;sy++)for(var sx=0;sx<period;sx++)sites[period].push([.2+hash(sx,sy,period)*.6,.2+hash(sx+31,sy+19,period)*.6]);}
      var ix=Math.floor(x),iy=Math.floor(y),sum=0;
      for(var yy=-1;yy<=1;yy++)for(var xx=-1;xx<=1;xx++){var px=ix+xx,py=iy+yy,site=sites[period][((py+period)%period)*period+(px+period)%period],dx=x-px-site[0],dy=y-py-site[1];sum+=Math.exp(-(dx*dx+dy*dy)*4.2);}
      return 1-Math.exp(-sum*1.25);
    }
    for(var y=0;y<n;y++)for(var x=0;x<n;x++){
      var v=noise(x/n*10,y/n*10,10)*.85+noise(x/n*20,y/n*20,20)*.15;
      values[y*n+x]=v;var i=(y*n+x)*4,packed=Math.round(v*65025);data[i]=Math.floor(packed/255);data[i+1]=packed%255;data[i+2]=0;data[i+3]=255;
    }
    return {pixels:data,values:values};
  }
  function Surface(canvas) {
    this.canvas=canvas; this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:true});
    if(!this.gl)throw new Error('No WebGL surface');
    var gl=this.gl;
    if(gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)<2)throw new Error('Vertex textures unavailable');
    var shaders=[];this.program=null;this.buffers=[];this.textures=[];
    try {
      var sources=[vertex,fragment],types=[gl.VERTEX_SHADER,gl.FRAGMENT_SHADER];
      for(var s=0;s<2;s++){var shader=gl.createShader(types[s]);shaders.push(shader);gl.shaderSource(shader,sources[s]);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));}
      this.program=gl.createProgram();for(s=0;s<shaders.length;s++)gl.attachShader(this.program,shaders[s]);gl.linkProgram(this.program);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
      this.uv=gl.getAttribLocation(this.program,'aUV');this.uniforms={};
      var names=['uNoise','uTracks','uAspect','uCloud','uTime','uDrift','uLight'];
      for(s=0;s<names.length;s++)this.uniforms[names[s]]=gl.getUniformLocation(this.program,names[s]);
      this.noise=noiseData();
      for(s=0;s<2;s++){
        var tex=gl.createTexture();this.textures.push(tex);gl.bindTexture(gl.TEXTURE_2D,tex);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,s?gl.CLAMP_TO_EDGE:gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,s?gl.CLAMP_TO_EDGE:gl.REPEAT);
        if(!s)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,256,0,gl.RGBA,gl.UNSIGNED_BYTE,this.noise.pixels);
      }
      this.buffers=[gl.createBuffer(),gl.createBuffer()];this.revision=-1;this.kind='';this.low=null;this.trackSize=0;this.lost=false;
      var self=this;canvas.addEventListener('webglcontextlost',function(event){event.preventDefault();self.lost=true;});
    } catch(error){this.destroy();throw error;}
    finally{for(s=0;s<shaders.length;s++)gl.deleteShader(shaders[s]);}
  }
  Surface.prototype.resize=function(w,h,low){
    this.canvas.width=w;this.canvas.height=h;this.aspect=w/h;var gl=this.gl;
    if(this.low===low)return;this.low=low;
    var nx=low?144:220,ny=low?144:220,vertices=new Float32Array((nx+1)*(ny+1)*2),indices=new Uint16Array(nx*ny*6),k=0;
    for(var y=0;y<=ny;y++)for(var x=0;x<=nx;x++){vertices[k++]=x/nx;vertices[k++]=y/ny*1.15-.05;}
    k=0;for(y=0;y<ny;y++)for(x=0;x<nx;x++){var a=y*(nx+1)+x;indices[k++]=a;indices[k++]=a+1;indices[k++]=a+nx+1;indices[k++]=a+1;indices[k++]=a+nx+2;indices[k++]=a+nx+1;}
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[0]);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.buffers[1]);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);this.count=indices.length;
  };
  Surface.prototype.draw=function(kind,light,snow,clouds){
    if(this.lost)return false;var gl=this.gl,field=kind==='snow'?snow:clouds.field;
    gl.useProgram(this.program);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.enable(gl.DEPTH_TEST);gl.clearColor(.72,.80,.88,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.textures[0]);gl.uniform1i(this.uniforms.uNoise,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.textures[1]);
    if(this.revision!==field.revision||this.kind!==kind){
      if(!this.pixels||this.pixels.length!==field.depth.length*4)this.pixels=new Uint8Array(field.depth.length*4);
      for(var i=0;i<field.depth.length;i++){this.pixels[i*4]=Math.round(Math.max(0,field.depth[i])*255);this.pixels[i*4+1]=Math.round(Math.max(0,-field.depth[i])*255);this.pixels[i*4+3]=255;}
      if(this.trackSize!==field.size){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,field.size,field.size,0,gl.RGBA,gl.UNSIGNED_BYTE,this.pixels);this.trackSize=field.size;}
      else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,field.size,field.size,gl.RGBA,gl.UNSIGNED_BYTE,this.pixels);
      this.revision=field.revision;this.kind=kind;
    }
    gl.uniform1i(this.uniforms.uTracks,1);gl.uniform1f(this.uniforms.uAspect,this.aspect);gl.uniform1f(this.uniforms.uCloud,kind==='cloud'?1:0);
    gl.uniform1f(this.uniforms.uTime,clouds.flowX);gl.uniform1f(this.uniforms.uDrift,clouds.flowY);gl.uniform1f(this.uniforms.uLight,light);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers[0]);gl.enableVertexAttribArray(this.uv);gl.vertexAttribPointer(this.uv,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.buffers[1]);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0);return true;
  };
  Surface.prototype.point=function(u,v,kind,clouds){
    // Invert the height projection using the uncompressed surface; carving stays under the fingertip.
    var values=this.noise.values,aspect=this.aspect;
    function sample(x,y){x=((x%1)+1)%1*256;y=((y%1)+1)%1*256;var ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
      var a=values[iy*256+ix],b=values[iy*256+(ix+1)%256],c=values[((iy+1)%256)*256+ix],d=values[((iy+1)%256)*256+(ix+1)%256];return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;}
    var result=v;
    for(var i=0;i<3;i++){var freq=kind==='cloud'?1.1:.85,n=sample(u*aspect*freq+(kind==='cloud'?clouds.flowX:0),result*freq+(kind==='cloud'?clouds.flowY:0));var h=kind==='cloud' ? .035+Math.pow(n,.85)*.12 : .017+n*.019;result=v+h*.475;}
    return {u:u,v:result};
  };
  Surface.prototype.destroy=function(){var gl=this.gl;if(!gl)return;for(var i=0;i<(this.textures||[]).length;i++)gl.deleteTexture(this.textures[i]);for(i=0;i<(this.buffers||[]).length;i++)gl.deleteBuffer(this.buffers[i]);if(this.program)gl.deleteProgram(this.program);};
  window.NatureSurface=Surface;
}());
