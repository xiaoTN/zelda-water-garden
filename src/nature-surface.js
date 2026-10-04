(function () {
  'use strict';
  var vertex = [
    'precision highp float; attribute vec3 aPosition; uniform mat4 uCamera;',
    'uniform sampler2D uNoise,uTracks; uniform float uAspect,uTime; uniform mediump float uCloud,uObject; uniform vec2 uFlow,uFieldDomain;',
    'uniform vec4 uBall;uniform mediump vec4 uRotation; varying mediump vec3 vNormal,vWorld,vLocal; varying mediump float vCut,vNoise,vBottom;',
    'float noiseAt(vec2 uv){vec2 n=texture2D(uNoise,vec2(uv.x*uAspect,uv.y)*mix(.85,1.9,uCloud)+uFlow*uCloud).rg;return n.r+n.g/255.;}',
    'vec2 trackAt(vec2 uv){vec2 p=(uv-vec2(uFieldDomain.x))/uFieldDomain.y;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.)return vec2(0.);return texture2D(uTracks,p).rg;}',
    'float heightAt(vec2 uv){float n=noiseAt(uv);vec2 t=trackAt(uv);float base=mix(.16+n*.045,.28+pow(n,1.3)*.65,uCloud);return base+(t.g-t.r)*mix(.38,.62,uCloud);}',
    'vec3 rotate(vec3 p){return p+2.*cross(uRotation.xyz,cross(uRotation.xyz,p)+uRotation.w*p);}',
    'void main(){vec3 p;vBottom=0.;vCut=0.;vNoise=.5;vLocal=aPosition;',
    'if(uObject<.5){vec2 uv=aPosition.xy;float h=heightAt(uv);float e=.0025;',
    'float dx=(heightAt(uv+vec2(e,0.))-heightAt(uv-vec2(e,0.)))/(24.*e*uAspect);float dz=(heightAt(uv+vec2(0.,e))-heightAt(uv-vec2(0.,e)))/(24.*e);',
    'vNormal=normalize(vec3(-dx,1.,-dz));vNoise=noiseAt(uv);vCut=trackAt(uv).r;',
    'if(aPosition.z<-.5){vBottom=1.;h=-.65-vNoise*.3;vNormal=vec3(0.,-1.,0.);}p=vec3((uv.x-.5)*12.*uAspect,h,(uv.y-.5)*12.);',
    '}else if(uObject<1.5){vec3 n=normalize(aPosition);float rough=1.+.018*sin(n.x*23.)*sin(n.y*19.)*sin(n.z*27.)+.008*sin(n.x*51.+n.z*39.);',
    'p=uBall.xyz+rotate(n*rough)*uBall.w;vNormal=rotate(n);',
    '}else if(uObject>3.5){p=aPosition;vNormal=vec3(0.,1.,0.);}else {p=aPosition;p.x*=uAspect;p.y=mod(p.y-uTime*(.5+fract(p.x)*.6),6.);p.z+=sin(uTime*.3+p.x)*.15;vNormal=vec3(0.,1.,0.);}',
    'vWorld=p;gl_Position=uCamera*vec4(p,1.);gl_PointSize=clamp(96./gl_Position.w,3.,9.);}'
  ].join('\n');
  var fragment = [
    'precision mediump float;uniform float uCloud,uLight,uObject,uShadowCount;uniform vec4 uShadows[12];',
    'varying vec3 vNormal,vWorld,vLocal;varying float vCut,vNoise,vBottom;',
    'uniform sampler2D uSnowColor,uSnowNormal,uLand;uniform float uLandAspect;uniform mediump vec4 uRotation;',
    'vec3 snowRotate(vec3 p){return p+2.*cross(uRotation.xyz,cross(uRotation.xyz,p)+uRotation.w*p);}',
    'vec3 snowColor(vec3 p,vec3 w){return texture2D(uSnowColor,p.yz).rgb*w.x+texture2D(uSnowColor,p.xz).rgb*w.y+texture2D(uSnowColor,p.xy).rgb*w.z;}',
    'vec3 snowBump(vec3 p,vec3 w){vec2 x=texture2D(uSnowNormal,p.yz).xy*2.-1.,y=texture2D(uSnowNormal,p.xz).xy*2.-1.,z=texture2D(uSnowNormal,p.xy).xy*2.-1.;return vec3(0.,x)*w.x+vec3(y.x,0.,y.y)*w.y+vec3(z,0.)*w.z;}',
    'void main(){if(uCloud>.5&&uObject<.5&&vBottom>.5)discard;if(uObject>3.5){vec2 uv=vWorld.xz/vec2(24.,24.)+.5;vec3 land=texture2D(uLand,clamp(uv,.001,.999)).rgb;vec3 tint=uLight>1.5?vec3(.35,.47,.65):uLight>.5?vec3(1.,.79,.63):vec3(1.);gl_FragColor=vec4(mix(land*tint,vec3(.68,.79,.83)*tint,.12),1.);return;}vec3 sun=normalize(vec3(-.6,1.,-.45));vec3 n=normalize(vNormal),albedo=vec3(1.);if(uCloud<.5&&uObject<1.5){vec3 bump;if(uObject>.5){vec3 w=pow(abs(normalize(vLocal)),vec3(4.));w/=w.x+w.y+w.z;vec3 p=vLocal*1.35;albedo=snowColor(p,w);bump=snowRotate(snowBump(p,w));}else{vec2 uv=vWorld.xz*.8;albedo=texture2D(uSnowColor,uv).rgb;vec2 detail=texture2D(uSnowNormal,uv).xy*2.-1.;bump=vec3(detail.x,0.,detail.y);}n=normalize(n+bump*.55);}float lit=max(0.,dot(n,sun));',
    'float grain=sin(vLocal.x*197.+sin(vLocal.y*171.))*sin(vLocal.z*187.+vLocal.y*93.);',
    'if(uObject>.5&&uObject<1.5)lit=clamp(lit+grain*.025,0.,1.);float shadow=1.,contact=1.;',
    'if(uObject<.5&&uCloud<.5){for(int i=0;i<12;i++){if(float(i)>=uShadowCount)break;vec3 d=uShadows[i].xyz-vWorld;float along=dot(d,sun);float perp=length(d-sun*along);float r=uShadows[i].w;float softness=r*.04+max(0.,along-r)*.12;if(along>0.)shadow*=smoothstep(r-softness,r+softness,perp);float gap=max(0.,length(d)-r);contact*=1.-.22*exp(-gap/max(.001,r*.12));}}',
    'vec3 shade=mix(vec3(.40,.53,.69),vec3(.61,.67,.80),uCloud),white=vec3(1.,.99,.96);',
    'if(uLight>.5&&uLight<1.5){shade=vec3(.41,.32,.53);white=vec3(1.,.85,.72);}if(uLight>1.5){shade=vec3(.10,.17,.29);white=vec3(.62,.75,.88);}',
    'lit=mix(lit,.25+.75*lit,uCloud);float ambient=mix(.20,.25,uCloud);vec3 col=mix(shade,white,ambient+lit*shadow*(1.-ambient))*contact;',
    'if(uCloud<.5&&uObject<1.5)col*=.48+albedo*.62;col*=1.-vCut*.1;col+=(grain*.003)*(1.-uCloud);',
    'if(uObject>1.5&&uObject<2.5){if(length(gl_PointCoord-.5)>.5)discard;col=white;}',
    'float fog=(1.-smoothstep(-13.,3.,vWorld.z))*.38;col=mix(col,mix(vec3(.76,.85,.89),vec3(.19,.29,.40),step(1.5,uLight)),fog);',
    'float alpha=1.;if(uCloud>.5&&uObject<.5){float fringe=sin(vWorld.x*19.+vWorld.z*23.)*sin(vWorld.z*17.-vWorld.x*11.);float opening=smoothstep(.015,.50,vCut*(.85+.30*vNoise)+fringe*.045*smoothstep(.01,.10,vCut));alpha=(.22+.78*smoothstep(.30,.44,vNoise))*(1.-opening*.985);if(alpha<.02)discard;}gl_FragColor=vec4(col,alpha);}'
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
    this.canvas=canvas;this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,depth:true});
    if(!this.gl)throw new Error('3D WebGL unavailable');
    if(this.gl.getParameter(this.gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)<2)throw new Error('3D vertex textures unavailable');
    this.noise=noiseData();this.lost=false;this.restoreCount=0;this.low=false;this.aspect=1;this.shadowData=new Float32Array(48);
    this.init();
    var self=this;
    canvas.addEventListener('webglcontextlost',function(e){e.preventDefault();self.lost=true;});
    canvas.addEventListener('webglcontextrestored',function(){
      if(self.restoreCount++>0)return;
      try{self.init();self.lost=false;self.resize(canvas.width,canvas.height,true);}catch(error){self.lost=true;}
    });
  }
  Surface.prototype.init=function(){
    var gl=this.gl,shaders=[];this.buffers=[];this.textures=[];this.program=null;
    try{
      var sources=[vertex,fragment];
      for(var i=0;i<2;i++){var s=gl.createShader(i?gl.FRAGMENT_SHADER:gl.VERTEX_SHADER);shaders.push(s);gl.shaderSource(s,sources[i]);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));}
      this.program=gl.createProgram();shaders.forEach(function(s){gl.attachShader(this.program,s);},this);gl.linkProgram(this.program);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
      this.attribute=gl.getAttribLocation(this.program,'aPosition');this.uniforms={};
      var names=['uCamera','uFieldDomain','uNoise','uTracks','uAspect','uCloud','uObject','uTime','uFlow','uBall','uRotation','uLight','uShadowCount','uShadows[0]','uSnowColor','uSnowNormal','uLand','uLandAspect'];
      names.forEach(function(n){this.uniforms[n]=gl.getUniformLocation(this.program,n);},this);
      for(i=0;i<2;i++){
        var texture=gl.createTexture();this.textures.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,i?gl.CLAMP_TO_EDGE:gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,i?gl.CLAMP_TO_EDGE:gl.REPEAT);
        if(!i)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,256,0,gl.RGBA,gl.UNSIGNED_BYTE,this.noise.pixels);
      }
      this.snowMaps=0;this.textureGeneration=(this.textureGeneration||0)+1;
      var self=this,generation=this.textureGeneration;
      ['snow-color.jpg','snow-normal.jpg'].forEach(function(file,index){
        var texture=gl.createTexture();self.textures.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(index?[128,128,255,255]:[235,235,235,255]));gl.generateMipmap(gl.TEXTURE_2D);
        var img=new Image();img.onload=function(){
          if(self.lost||generation!==self.textureGeneration)return;
          gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.generateMipmap(gl.TEXTURE_2D);self.snowMaps++;
        };img.onerror=function(){self.snowTextureError=file;};img.src=window.SnowTextures[index];
      });
      var land=gl.createTexture();this.textures.push(land);gl.bindTexture(gl.TEXTURE_2D,land);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([99,132,108,255]));gl.generateMipmap(gl.TEXTURE_2D);
      this.landReady=false;var landImage=new Image();landImage.onload=function(){if(self.lost||generation!==self.textureGeneration)return;gl.bindTexture(gl.TEXTURE_2D,land);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,landImage);gl.generateMipmap(gl.TEXTURE_2D);self.landReady=true;};landImage.src=window.HyruleBackground;
      this.meshQuality=null;this.revision=-1;this.kind='';this.trackSize=0;
    }catch(error){this.destroy();throw error;}finally{shaders.forEach(function(s){gl.deleteShader(s);});}
  };
  Surface.prototype.mesh=function(vertices,indices,stride){
    var gl=this.gl,v=gl.createBuffer(),e=gl.createBuffer();this.buffers.push(v,e);
    gl.bindBuffer(gl.ARRAY_BUFFER,v);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,e);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
    return {vertex:v,index:e,count:indices.length,vertices:vertices.length/(stride||3),stride:stride||3};
  };
  Surface.prototype.grid=function(n,closed){
    var vertices=[],indices=[],stride=n+1,layerSize=stride*stride;
    for(var layer=0;layer<(closed?2:1);layer++)for(var y=0;y<=n;y++)for(var x=0;x<=n;x++){
      var ray=this.camera.ray(x/n*1.36-.18,y/n*1.36-.18),t=-ray.origin[1]/ray.direction[1];
      vertices.push((ray.origin[0]+ray.direction[0]*t)/(12*this.aspect)+.5,(ray.origin[2]+ray.direction[2]*t)/12+.5,layer?-1:1);
    }
    for(layer=0;layer<(closed?2:1);layer++)for(y=0;y<n;y++)for(x=0;x<n;x++){
      var a=layer*layerSize+y*stride+x;indices.push(a,a+stride,a+1,a+1,a+stride,a+stride+1);
    }
    if(closed)for(var i=0;i<n;i++){
      var edges=[[i,i+1],[n*stride+i,n*stride+i+1],[i*stride,(i+1)*stride],[i*stride+n,(i+1)*stride+n]];
      edges.forEach(function(p){indices.push(p[0],p[1],p[0]+layerSize,p[1],p[1]+layerSize,p[0]+layerSize);});
    }
    return this.mesh(vertices,indices);
  };
  Surface.prototype.resize=function(w,h,low){
    this.canvas.width=w;this.canvas.height=h;this.aspect=w/h;this.camera=new window.Nature3D.Camera(this.aspect);this.low=!!low;
    if(this.lost||this.meshQuality===this.low&&this.meshAspect===this.aspect)return;
    var gl=this.gl;this.buffers.forEach(function(b){gl.deleteBuffer(b);});this.buffers=[];
    this.landMesh=this.mesh([-60,-5,-60,60,-5,-60,-60,-5,60,60,-5,60],[0,2,1,1,2,3]);
    this.snowMesh=this.grid(low?126:208,false);this.cloudMesh=this.grid(low?110:156,true);
    var vertices=[],indices=[],nx=low?20:28,ny=low?14:18;
    for(var y=0;y<=ny;y++)for(var x=0;x<=nx;x++){var a=x/nx*Math.PI*2,b=y/ny*Math.PI;vertices.push(Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a));}
    for(y=0;y<ny;y++)for(x=0;x<nx;x++){var k=y*(nx+1)+x;indices.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2);}
    this.ballMesh=this.mesh(vertices,indices);
    var rng=window.GardenNature.random(551),flakes=[];for(var i=0;i<(this.low?300:720);i++)flakes.push((rng()-.5)*14,rng()*6,(rng()-.5)*15);
    this.flakeMesh=this.mesh(flakes,[]);this.meshQuality=this.low;this.meshAspect=this.aspect;
  };
  Surface.prototype.sample=function(u,v){
    var x=((u%1)+1)%1*256-.5,y=((v%1)+1)%1*256-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,data=this.noise.values;
    function at(a,b){return data[((b+256)%256)*256+(a+256)%256];}
    return (at(ix,iy)*(1-fx)+at(ix+1,iy)*fx)*(1-fy)+(at(ix,iy+1)*(1-fx)+at(ix+1,iy+1)*fx)*fy;
  };
  Surface.prototype.height=function(x,z,kind,field,clouds){
    var u=x/(12*this.aspect)+.5,v=z/12+.5,cloud=kind==='cloud',freq=cloud?1.9:.85;
    var n=this.sample(u*this.aspect*freq+(cloud?clouds.flowX:0),v*freq+(cloud?clouds.flowY:0)),cut=0,rim=0;
    if(field&&u>=field.origin&&u<=field.origin+field.span&&v>=field.origin&&v<=field.origin+field.span){
      var heights=field.renderDepth?field.renderDepth():field.depth;var tx=(u-field.origin)/field.span*field.size-.5,ty=(v-field.origin)/field.span*field.size-.5,ix=Math.floor(tx),iy=Math.floor(ty),fx=tx-ix,fy=ty-iy;
      for(var j=0;j<2;j++)for(var i=0;i<2;i++){var val=heights[Math.max(0,Math.min(field.size-1,iy+j))*field.size+Math.max(0,Math.min(field.size-1,ix+i))],weight=(i?fx:1-fx)*(j?fy:1-fy);cut+=Math.max(0,val)*weight;rim+=Math.max(0,-val)*weight;}
    }
    var base=cloud ? .28+Math.pow(n,1.3)*.65 : .16+n*.045;
    return base+(rim-cut)*(cloud ? .62:.38);
  };
  Surface.prototype.point=function(u,v,kind,clouds,pickBall){
    var self=this,field=kind==='snow'?this.snow:clouds.field;
    var p=window.Nature3D.intersect(this.camera,u,v,function(x,z){return self.height(x,z,kind,field,clouds);});
    if(!p)return null;
    // Select the visible sphere before the snow behind it; dragging keeps its contact point.
    if(pickBall&&kind==='snow'&&this.snow){var ray=this.camera.ray(u,v),nearest=Math.hypot(p[0]-ray.origin[0],p[1]-ray.origin[1],p[2]-ray.origin[2]),selected=null;
      this.snow.balls.forEach(function(b){var center=self.ballPosition(b),q=ray.origin.map(function(x,i){return x-center[i];}),dot=q[0]*ray.direction[0]+q[1]*ray.direction[1]+q[2]*ray.direction[2],disc=dot*dot-(q[0]*q[0]+q[1]*q[1]+q[2]*q[2]-center[3]*center[3]);if(disc>=0){var t=-dot-Math.sqrt(disc);if(t>0&&t<nearest){nearest=t;selected=b;}}});
      if(selected)return {u:selected.u,v:selected.v,ball:selected,groundU:p[0]/(12*this.aspect)+.5,groundV:p[2]/12+.5};
    }
    return {u:p[0]/(12*this.aspect)+.5,v:p[2]/12+.5};
  };
  Surface.prototype.ballPosition=function(ball){
    var x=(ball.u-.5)*12*this.aspect,z=(ball.v-.5)*12,r=ball.radius*12;
    var center=this.height(x,z,'snow',this.snow,this.clouds)+r;
    // Support the sphere on the highest contact under its curved underside.
    for(var ring=1;ring<=3;ring++)for(var i=0;i<12;i++){
      var distance=r*(ring===1 ? .45 : ring===2 ? .8 : .97),angle=i*Math.PI/6;
      var h=this.height(x+Math.cos(angle)*distance,z+Math.sin(angle)*distance,'snow',this.snow,this.clouds);
      center=Math.max(center,h+Math.sqrt(r*r-distance*distance));
    }
    return [x,center-r*.025,z,r];
  };
  Surface.prototype.bind=function(mesh){
    var gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vertex);gl.enableVertexAttribArray(this.attribute);gl.vertexAttribPointer(this.attribute,3,gl.FLOAT,false,mesh.stride*4,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.index);
  };
  Surface.prototype.draw=function(kind,light,snow,clouds,time,weather,reduced){
    if(this.lost)return false;
    this.snow=snow;this.clouds=clouds;
    var gl=this.gl,U=this.uniforms,field=kind==='snow'?snow:clouds.field,mesh=kind==='snow'?this.snowMesh:this.cloudMesh;
    gl.useProgram(this.program);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
    gl.clearColor(.73,.82,.88,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.textures[0]);gl.uniform1i(U.uNoise,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.textures[1]);
    if(this.revision!==field.revision||this.kind!==kind){
      if(!this.pixels)this.pixels=new Uint8Array(field.depth.length*4);
      var heights=field.renderDepth();
      for(var i=0;i<heights.length;i++){this.pixels[i*4]=Math.round(Math.max(0,heights[i])*255);this.pixels[i*4+1]=Math.round(Math.max(0,-heights[i])*255);this.pixels[i*4+3]=255;}
      if(this.trackSize!==field.size){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,field.size,field.size,0,gl.RGBA,gl.UNSIGNED_BYTE,this.pixels);this.trackSize=field.size;}
      else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,field.size,field.size,gl.RGBA,gl.UNSIGNED_BYTE,this.pixels);
      this.revision=field.revision;this.kind=kind;
    }
    gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.textures[2]);gl.uniform1i(U.uSnowColor,2);
    gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.textures[3]);gl.uniform1i(U.uSnowNormal,3);
    gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,this.textures[4]);gl.uniform1i(U.uLand,4);gl.uniform1f(U.uLandAspect,this.aspect);
    gl.uniform1i(U.uTracks,1);gl.uniform2f(U.uFieldDomain,field.origin,field.span);gl.uniformMatrix4fv(U.uCamera,false,this.camera.matrix);gl.uniform1f(U.uAspect,this.aspect);gl.uniform1f(U.uCloud,kind==='cloud'?1:0);gl.uniform2f(U.uFlow,clouds.flowX,clouds.flowY);gl.uniform1f(U.uTime,time||0);gl.uniform1f(U.uLight,light);gl.uniform1f(U.uObject,0);
    this.shadowData.fill(0);if(kind==='snow')for(i=0;i<snow.balls.length;i++)this.shadowData.set(this.ballPosition(snow.balls[i]),i*4);
    gl.uniform4fv(U['uShadows[0]'],this.shadowData);gl.uniform1f(U.uShadowCount,kind==='snow'?snow.balls.length:0);
    this.count=0;this.drawCalls=0;
    if(kind==='cloud'){
      this.bind(this.landMesh);gl.uniform1f(U.uObject,4);gl.drawElements(gl.TRIANGLES,this.landMesh.count,gl.UNSIGNED_SHORT,0);this.count+=this.landMesh.count;this.drawCalls++;
      gl.uniform1f(U.uObject,0);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    }
    this.bind(mesh);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);this.count+=mesh.count;this.drawCalls++;
    gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
    if(kind==='snow'){
      this.bind(this.ballMesh);gl.uniform1f(U.uObject,1);
      for(i=0;i<snow.balls.length;i++){
        var ball=snow.balls[i];gl.uniform4fv(U.uBall,this.shadowData.subarray(i*4,i*4+4));gl.uniform4fv(U.uRotation,ball.rotation||[0,0,0,1]);gl.drawElements(gl.TRIANGLES,this.ballMesh.count,gl.UNSIGNED_SHORT,0);this.count+=this.ballMesh.count;this.drawCalls++;
      }
      if(weather&&!reduced){this.bind(this.flakeMesh);gl.uniform1f(U.uObject,2);gl.drawArrays(gl.POINTS,0,this.flakeMesh.vertices);this.drawCalls++;}
    }
    return true;
  };
  Surface.prototype.destroy=function(){this.textureGeneration=(this.textureGeneration||0)+1;var gl=this.gl;if(!gl)return;(this.buffers||[]).forEach(function(b){gl.deleteBuffer(b);});(this.textures||[]).forEach(function(t){gl.deleteTexture(t);});if(this.program)gl.deleteProgram(this.program);};
  window.NatureSurface=Surface;
}());
