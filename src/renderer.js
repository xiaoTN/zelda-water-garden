(function (root) {
  'use strict';
  var vertex = [
    'attribute vec3 aPosition; attribute vec2 aUV; attribute vec2 aDynamics;',
    'attribute vec3 aNormal; attribute vec3 aColor;',
    'uniform mat4 uViewProjection; uniform mediump float uTime; uniform mediump float uPass;',
    'varying mediump vec2 vUV; varying mediump vec3 vNormal;',
    'varying mediump vec3 vColor; varying mediump float vHeight;',
    'float shore(vec2 uv){vec2 p=(uv-vec2(.5,.49))/vec2(.465,.35);float a=atan(p.y,p.x);return length(p)-(1.+.048*sin(a*5.+.7)+.024*sin(a*9.-.5)+.04*cos(a*3.));}',
    'void main(){',
    ' vUV=aUV;vNormal=vec3(0.,1.,0.);vColor=aColor;vHeight=aPosition.y;',
    ' if(uPass<.5){gl_Position=vec4(aPosition.xy,.7,1.);return;}',
    ' if(uPass>1.5){vNormal=aNormal;gl_Position=uViewProjection*vec4(aPosition,1.);return;}',
    ' vec3 p=aPosition;float wet=smoothstep(.005,.13,-shore(aUV))*(1.-aDynamics.y);',
    ' float a=p.x*5.5+p.z*7.-uTime*1.2;',
    ' float b=p.x*-8.+p.z*3.5-uTime*.9;',
    ' float c=p.x*11.+p.z*9.+uTime*1.6;',
    ' float elevation=(sin(a)*.014+sin(b)*.009+sin(c)*.004)*wet;',
    ' p.y=elevation+aDynamics.x*.065*wet;',
    ' vHeight=p.y;',
    ' vNormal=normalize(vec3(-(cos(a)*.077-cos(b)*.072+cos(c)*.044)*wet,1.,-(cos(a)*.098+cos(b)*.0315+cos(c)*.036)*wet));',
    ' gl_Position=uViewProjection*vec4(p,1.);',
    '}'
  ].join('\n');
  // Toon color bands, shoreline foam and original Cryo-inspired ice.
  var fragment = [
    'precision mediump float;',
    'varying mediump vec2 vUV; varying mediump vec3 vNormal;',
    'varying mediump vec3 vColor; varying mediump float vHeight;',
    'uniform sampler2D uScene; uniform sampler2D uWave; uniform sampler2D uNoise; uniform sampler2D uIce; uniform sampler2D uNormal; uniform sampler2D uFoam; uniform sampler2D uBed;',
    'uniform vec2 uBedTexel;',
    'uniform vec2 uTexel; uniform float uShorePixel; uniform mediump float uTime; uniform float uAspect; uniform float uLight; uniform float uDetail; uniform mediump float uPass;',
    'float shore(vec2 uv){vec2 p=(uv-vec2(.5,.49))/vec2(.465,.35);float a=atan(p.y,p.x);return length(p)-(1.+.048*sin(a*5.+.7)+.024*sin(a*9.-.5)+.04*cos(a*3.));}',
    'float waveAt(vec2 uv){vec4 s=texture2D(uWave,uv);return (s.r*(256./257.)+s.g*(1./257.))*2.-1.;}',
    // Four bilinear taps reconstruct a smooth cubic B-spline without enlarging the simulation.
    'float heightAt(vec2 uv){',
    ' if(uDetail<.5)return waveAt(uv);',
    ' vec2 p=uv/uTexel-.5,i=floor(p),f=fract(p),f2=f*f,f3=f2*f;',
    ' vec2 w0=(1.-3.*f+3.*f2-f3)/6.,w1=(4.-6.*f2+3.*f3)/6.;',
    ' vec2 w2=(1.+3.*f+3.*f2-3.*f3)/6.,w3=f3/6.;',
    ' vec2 g0=w0+w1,g1=w2+w3,a=(i-.5+w1/g0)*uTexel,b=(i+1.5+w3/g1)*uTexel;',
    ' return mix(mix(waveAt(a),waveAt(vec2(b.x,a.y)),g1.x),mix(waveAt(vec2(a.x,b.y)),waveAt(b),g1.x),g1.y);',
    '}',
    'float iceAt(vec2 uv){vec2 t=uTexel*.65;return texture2D(uWave,uv).b*.5+(texture2D(uWave,uv+vec2(t.x,0.)).b+texture2D(uWave,uv-vec2(t.x,0.)).b+texture2D(uWave,uv+vec2(0.,t.y)).b+texture2D(uWave,uv-vec2(0.,t.y)).b)*.125;}',
    'void main(){',
    ' if(uPass>4.5){',
    '  float ice=iceAt(vUV);float sun=abs(dot(normalize(vNormal),normalize(vec3(-.45,1.,-.35))));',
    '  vec3 fish=mix(vColor*(.72+sun*.28),vec3(.18,.60,.65),.26);',
    '  if(uLight>.5&&uLight<1.5)fish*=vec3(1.08,.88,.78);if(uLight>1.5)fish*=vec3(.43,.63,.83);',
    '  gl_FragColor=vec4(fish,.78*(1.-smoothstep(.08,.75,ice)));return;',
    ' }',
    ' if(uPass>3.5){float opacity=(1.-smoothstep(.08,.5,length(vUV-.5)))*.30*vColor.r;gl_FragColor=vec4(.025,.055,.035,opacity);return;}',
    ' vec2 uv=vUV;float d=shore(uv);vec3 land=texture2D(uScene,uv).rgb;vec3 col=land;float alpha=1.;',
    ' if(uPass>1.5){',
    '  float sun=max(0.,dot(normalize(vNormal),normalize(vec3(-.55,1.,-.4))));',
    '  col=uPass>2.5?vColor*(.55+sun*.65):land*(.86+sun*.16);',
    '  if(uPass>2.5){float wet=1.-smoothstep(-.015,.035,vHeight);col*=1.-wet*.25;col=mix(col,vec3(.35,.48,.26),smoothstep(.70,.98,vNormal.y)*.18);}',
    '  if(uLight>.5&&uLight<1.5)col=col*vec3(1.1,.86,.75)+vec3(.035,.009,0.);',
    '  if(uLight>1.5)col*=vec3(.43,.63,.83);',
    '  gl_FragColor=vec4(col,1.);return;',
    ' }',
    ' float shorePixel=uShorePixel;',
    '#ifdef SHORE_DERIVATIVES',
    ' shorePixel=max(fwidth(d),uShorePixel*.5);',
    '#endif',
    ' float edgeStart=-.004-shorePixel;float edgeEnd=.012+shorePixel;',
    ' if(uPass>.5){ if(d>=edgeEnd)discard;',
    '  vec2 p=vec2(uv.x*uAspect,uv.y);',
    '  float dx=heightAt(uv+vec2(uTexel.x,0.))-heightAt(uv-vec2(uTexel.x,0.));',
    '  float dy=heightAt(uv+vec2(0.,uTexel.y))-heightAt(uv-vec2(0.,uTexel.y));',
    '  vec2 normalA=texture2D(uNormal,p*1.9+vec2(uTime*.021,-uTime*.014)).rg*2.-1.;',
    '  vec2 normalB=texture2D(uNormal,p*vec2(-2.7,2.7)+vec2(-uTime*.012,uTime*.023)).rg*2.-1.;',
    '  vec2 detail=(normalA+normalB*.65)*(.65+uDetail*.35);',
    '  vec2 grad=vec2(dx/uAspect,dy)+detail*.035;',
    '  vec3 surfaceNormal=normalize(vNormal+vec3(detail.x*.6-dx*3.,0.,detail.y*.6-dy*3.));',
    '  vec4 swell=texture2D(uNoise,p*vec2(.7,1.2)+vec2(uTime*.008,-uTime*.006));',
    '  vec4 bedSample=texture2D(uBed,uv);',
    '  float bedHeight=(bedSample.r*(256./257.)+bedSample.g*(1./257.))*.6-.3;',
    '  float depth=max(0.,vHeight-bedHeight);',
    '  col=mix(vec3(.63,.90,.82),vec3(.24,.72,.73),smoothstep(.012,.075,depth));',
    '  col=mix(col,vec3(.16,.59,.68),smoothstep(.12,.20,depth));',
    '  vec3 bed=texture2D(uScene,uv+grad*vec2(.022/uAspect,.018)).rgb;',
    '  col=mix(col,bed*vec3(.7,1.1,1.07),.08*(1.-smoothstep(.015,.08,depth)));',
    '  float lighting=dot(surfaceNormal,normalize(vec3(-.4,1.,-.3)));',
    '  col*=.91+smoothstep(.74,.91,lighting)*.12;',
    '  float wash=smoothstep(.55,.59,swell.b)*.06;',
    '  col+=vec3(.25,.65,.57)*wash;',
    '  float crest=smoothstep(.024,.09,length(grad))*smoothstep(-.01,.05,dx*.4+dy);',
    '  col=mix(col,vec3(.88,1.,.95),crest*.55);',
    '  vec2 radial=normalize(p-vec2(.5*uAspect,.49));',
    '  vec2 boundaryGradient=vec2((texture2D(uBed,uv+vec2(uBedTexel.x,0.)).b-texture2D(uBed,uv-vec2(uBedTexel.x,0.)).b)/(uBedTexel.x*uAspect),(texture2D(uBed,uv+vec2(0.,uBedTexel.y)).b-texture2D(uBed,uv-vec2(0.,uBedTexel.y)).b)/uBedTexel.y);',
    '  vec2 boundaryNormal=normalize(-boundaryGradient+radial*.0001);',
    '  float boundaryDistance=bedSample.b*.25/(.7*min(uAspect,1.));',
    '  float ice=iceAt(uv);float liquid=1.-smoothstep(.15,.75,ice);',
    '  float waterHeight=heightAt(uv)*liquid;',
    '  vec2 flow=vec2(dx/uAspect,dy)*liquid;flow=flow/(1.+length(flow)*3.);',
    '  vec2 foamPush=flow*.85+boundaryNormal*waterHeight*.15;',
    '  vec2 foamUV=p*2.8+vec2(uTime*.025,-uTime*.018)+detail*.06-foamPush;',
    '  vec4 foamMap=texture2D(uFoam,foamUV);',
    '  float drift=texture2D(uFoam,p*1.3+vec2(-uTime*.025,uTime*.018)-foamPush*.5).g;',
    // The same simulated wave that moves the mesh also compresses and bends coastal foam.
    // Pin only the contact line to the bank; the foam band remains free to move.
    '  float shorePush=clamp(waterHeight*.14+dot(flow,boundaryNormal)*.14,-.065,.065)*smoothstep(.006,.04,boundaryDistance);',
    '  float distanceToShore=max(0.,boundaryDistance-shorePush);',
    '  float phase=distanceToShore*28.+sin(uTime*.4)*.5+drift*3.4;',
    '  float waveFront=pow(.5+.5*sin(phase),10.);',
    '  float coastal=1.-smoothstep(.045,.24,distanceToShore);',
    '  float breakup=smoothstep(.27,.60,foamMap.g+drift*.25);',
    '  float foamCells=smoothstep(.15,.65,foamMap.r);',
    '  float agitation=smoothstep(.006,.10,length(flow)+abs(waterHeight)*.10);',
    '  float advancing=(waveFront*breakup+agitation*foamCells*.40)*coastal;',
    '  float lace=foamCells*coastal*(.20+.55*waveFront)*smoothstep(.15,.55,foamMap.g);',
    '  float wetRim=(1.-smoothstep(.005,.033,distanceToShore))*(.18+.55*breakup);',
    '  col=mix(col,vec3(.91,1.,.96),clamp(advancing*.82+lace*.6+wetRim,0.,.90));',
    '  if(ice>.01){',
    '   vec3 crystal=texture2D(uIce,uv).rgb;',
    '   vec3 frozen=mix(vec3(.27,.60,.78),vec3(.75,.90,.96),crystal.b);',
    '   float frost=texture2D(uNoise,p*vec2(1.4,1.8)).b; frozen=mix(frozen,vec3(.85,.96,1.),smoothstep(.40,.66,frost)*.34);',
    '   frozen+=vec3(.035,.035,.055)*sin((uv.x*uAspect+uv.y*.7)*9.);',
    '   frozen=mix(frozen,vec3(.91,.99,1.),crystal.r*.72);',
    '   frozen+=vec3(.12,.16,.18)*crystal.g;',
    '   float rim=1.-smoothstep(.45,.98,ice);',
    '   frozen=mix(frozen,vec3(.90,1.,1.),rim*.62);',
    '   frozen+=vec3(.08,.10,.10)*(1.-ice);',
    '   col=mix(col,frozen,smoothstep(.03,.78,ice));',
    '  }',
    '  alpha=mix(.62,.94,smoothstep(.008,.18,depth));',
    '  alpha=mix(alpha,1.,smoothstep(.03,.78,ice));',
    '  alpha*=1.-smoothstep(edgeStart,edgeEnd,d);',
    ' }',
    ' if(uLight>.5&&uLight<1.5){col=col*vec3(1.1,.86,.75)+vec3(.035,.009,0.);}',
    ' if(uLight>1.5){col=col*vec3(.43,.63,.83);if(d<0.)col+=vec3(.015,.055,.09);}',
    ' gl_FragColor=vec4(col,alpha);',
    '}'
  ].join('\n');
  function Renderer(canvas, scene, field) {
    this.canvas = canvas; this.scene = scene; this.field = field; this.low = false; this.gl = null; this.disposed = false; this.mapsLoaded = 0;
    var gl = canvas.getContext('webgl', { alpha:false, antialias:true, depth:true, stencil:false, preserveDrawingBuffer:false });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    var shaders = [], program, buffers = [], textures = [], self = this;
    try {
      function compile(type,source) {
        var shader = gl.createShader(type); shaders.push(shader); gl.shaderSource(shader,source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        return shader;
      }
      var precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
      var highPrecision = precision && precision.precision > 0;
      // Keep interpolated shoreline coordinates precise too, not only fragment arithmetic.
      var vertexSource = highPrecision ? vertex.replace('varying mediump vec2 vUV','varying highp vec2 vUV').replace(/uniform mediump float/g,'uniform highp float') : vertex;
      var fragmentSource = highPrecision ? fragment.replace('precision mediump float;','precision highp float;').replace('varying mediump vec2 vUV','varying highp vec2 vUV').replace(/uniform mediump float/g,'uniform highp float') : fragment;
      this.shoreDerivatives = !!gl.getExtension('OES_standard_derivatives');
      if (this.shoreDerivatives) fragmentSource = '#extension GL_OES_standard_derivatives : enable\n#define SHORE_DERIVATIVES\n' + fragmentSource;
      program=gl.createProgram(); gl.attachShader(program,compile(gl.VERTEX_SHADER,vertexSource)); gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentSource)); gl.linkProgram(program);
      if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program); this.program=program;
      this.attributes={ position:gl.getAttribLocation(program,'aPosition'), uv:gl.getAttribLocation(program,'aUV'), dynamics:gl.getAttribLocation(program,'aDynamics'), normal:gl.getAttribLocation(program,'aNormal'), color:gl.getAttribLocation(program,'aColor') };
      function buffer(target,data,usage) { var b=gl.createBuffer(); buffers.push(b);gl.bindBuffer(target,b);gl.bufferData(target,data,usage);return b; }
      this.quad=buffer(gl.ARRAY_BUFFER,new Float32Array([-1,1,0,0,0, 1,1,0,1,0, -1,-1,0,0,1, 1,-1,0,1,1]),gl.STATIC_DRAW);
      this.positions=buffer(gl.ARRAY_BUFFER,4,gl.STATIC_DRAW); this.dynamics=buffer(gl.ARRAY_BUFFER,4,gl.DYNAMIC_DRAW); this.indices=buffer(gl.ELEMENT_ARRAY_BUFFER,4,gl.STATIC_DRAW);
      this.ground=buffer(gl.ARRAY_BUFFER,4,gl.STATIC_DRAW);this.stones=buffer(gl.ARRAY_BUFFER,4,gl.STATIC_DRAW);
      this.shadows=buffer(gl.ARRAY_BUFFER,4,gl.STATIC_DRAW);
      this.fishBuffer=buffer(gl.ARRAY_BUFFER,4,gl.DYNAMIC_DRAW);
      this.dropped=buffer(gl.ARRAY_BUFFER,4,gl.DYNAMIC_DRAW);this.dropShadows=buffer(gl.ARRAY_BUFFER,4,gl.DYNAMIC_DRAW);this.dropRevision=-1;this.dropCount=0;this.dropShadowCount=0;
      this.buffers=buffers; this.uniforms={};
      var names=['uScene','uWave','uNoise','uIce','uNormal','uFoam','uBed','uBedTexel','uTexel','uShorePixel','uTime','uAspect','uLight','uDetail','uPass','uViewProjection'];
      for(var i=0;i<names.length;i++)this.uniforms[names[i]]=gl.getUniformLocation(program,names[i]);
      function texture(unit,source,repeat) {
        var value=gl.createTexture();textures.push(value);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,value);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);
        if(source)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
        return value;
      }
      this.sceneTexture=texture(0,scene,false);
      this.waveTexture=texture(1,null,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,field.width,field.height,0,gl.RGBA,gl.UNSIGNED_BYTE,field.pack());
      this.noiseTexture=texture(2,root.WaterScene.createNoise(),true);
      this.iceTexture=texture(3,root.WaterIce.createTexture(field.aspect),false);
      function map(unit,file,placeholder) {
        var t=texture(unit,null,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(placeholder));
        var img=new Image(),kind=unit===4?'normal':'foam';
        function upload(source){if(self.disposed||gl.isContextLost())return;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);self.mapsLoaded++;}
        img.onload=function(){try{upload(img);}catch(error){upload(root.WaterMaps.canvas(kind));}};
        img.onerror=function(){if(!self.disposed)upload(root.WaterMaps.canvas(kind));};img.src='./'+file;
      }
      map(4,'water-normal.png',[128,128,255,255]); map(5,'water-foam.png',[0,128,0,255]);
      this.bedTexture=texture(6,null,false);
      this.textures=textures;
      ['uScene','uWave','uNoise','uIce','uNormal','uFoam','uBed'].forEach(function(name,index){gl.uniform1i(self.uniforms[name],index);});
      gl.uniform2f(this.uniforms.uTexel,1/field.width,1/field.height);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
      for(i=0;i<shaders.length;i++)gl.deleteShader(shaders[i]);
    } catch(error) {
      this.disposed=true;for(var j=0;j<shaders.length;j++)gl.deleteShader(shaders[j]);for(j=0;j<textures.length;j++)gl.deleteTexture(textures[j]);for(j=0;j<buffers.length;j++)gl.deleteBuffer(buffers[j]);if(program)gl.deleteProgram(program);throw error;
    }
  }
  Renderer.prototype.resize=function(width,height){
    var gl=this.gl,size=root.WaterCore.bufferSize(width,height,root.devicePixelRatio,this.low),aspect=width/height;
    this.canvas.width=size.width;this.canvas.height=size.height;gl.viewport(0,0,size.width,size.height);gl.uniform1f(this.uniforms.uAspect,aspect);
    gl.uniform1f(this.uniforms.uShorePixel,Math.max(1/(size.width*.465),1/(size.height*.35)));
    // Orthographic camera tilted 30 degrees from overhead; ground UVs still match touch coordinates.
    gl.uniformMatrix4fv(this.uniforms.uViewProjection,false,new Float32Array([1/aspect,0,0,0, 0,.5,-.17320508,0, 0,-.8660254,-.1,0, 0,0,0,1]));
    this.mesh=root.WaterCore.waterMesh(aspect,this.low);
    this.terrain=root.WaterTerrain.create(aspect,this.low);
    this.baseBed=root.WaterTerrain.bathymetry(this.terrain,aspect,this.low);
    if(this.dropSystem)this.dropSystem.attach(aspect,this.baseBed,this.terrain);
    this.refreshDrops();
    gl.bindBuffer(gl.ARRAY_BUFFER,this.ground);gl.bufferData(gl.ARRAY_BUFFER,this.terrain.ground,gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.stones);gl.bufferData(gl.ARRAY_BUFFER,this.terrain.stones,gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.shadows);gl.bufferData(gl.ARRAY_BUFFER,this.terrain.shadows,gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.positions);gl.bufferData(gl.ARRAY_BUFFER,this.mesh.vertices,gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamics);gl.bufferData(gl.ARRAY_BUFFER,this.mesh.dynamics,gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,this.mesh.indices,gl.STATIC_DRAW);
  };
  Renderer.prototype.refreshDrops=function(){
    var gl=this.gl,extra=this.dropSystem?this.dropSystem.geometry(true):null;
    this.bed=this.baseBed;
    if(extra&&extra.length){
      var all=new Float32Array(this.terrain.stones.length+extra.length);all.set(this.terrain.stones);all.set(extra,this.terrain.stones.length);
      this.bed=root.WaterTerrain.bathymetry({ground:this.terrain.ground,stones:all},this.field.aspect,this.low);
    }
    this.field.setBathymetry(this.bed);
    gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,this.bedTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,this.bed.width,this.bed.height,0,gl.RGBA,gl.UNSIGNED_BYTE,this.bed.pixels);
    gl.uniform2f(this.uniforms.uBedTexel,1/this.bed.width,1/this.bed.height);
  };
  Renderer.prototype.bindVertices=function(buffer){
    var gl=this.gl,a=this.attributes;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(a.position);gl.vertexAttribPointer(a.position,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(a.uv);gl.vertexAttribPointer(a.uv,2,gl.FLOAT,false,20,12);
    gl.disableVertexAttribArray(a.normal);gl.vertexAttrib3f(a.normal,0,1,0);gl.disableVertexAttribArray(a.color);gl.vertexAttrib3f(a.color,1,1,1);
  };
  Renderer.prototype.drawSolid=function(buffer,count,pass){
    var gl=this.gl,a=this.attributes;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.enableVertexAttribArray(a.position);gl.vertexAttribPointer(a.position,3,gl.FLOAT,false,44,0);
    gl.enableVertexAttribArray(a.uv);gl.vertexAttribPointer(a.uv,2,gl.FLOAT,false,44,12);
    gl.enableVertexAttribArray(a.normal);gl.vertexAttribPointer(a.normal,3,gl.FLOAT,false,44,20);
    gl.enableVertexAttribArray(a.color);gl.vertexAttribPointer(a.color,3,gl.FLOAT,false,44,32);
    gl.disableVertexAttribArray(a.dynamics);gl.vertexAttrib2f(a.dynamics,0,0);
    gl.uniform1f(this.uniforms.uPass,pass);gl.drawArrays(gl.TRIANGLES,0,count);
  };
  Renderer.prototype.draw=function(time,light){
    var gl=this.gl;gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.waveTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,this.field.width,this.field.height,gl.RGBA,gl.UNSIGNED_BYTE,this.field.pack());
    if(this.dropSystem&&this.dropRevision!==this.dropSystem.revision){
      var rocks=this.dropSystem.geometry(false),shadows=this.dropSystem.shadows();this.dropCount=rocks.length/11;this.dropShadowCount=shadows.length/11;
      gl.bindBuffer(gl.ARRAY_BUFFER,this.dropped);gl.bufferData(gl.ARRAY_BUFFER,rocks,gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.dropShadows);gl.bufferData(gl.ARRAY_BUFFER,shadows,gl.DYNAMIC_DRAW);this.dropRevision=this.dropSystem.revision;
    }
    gl.uniform1f(this.uniforms.uTime,time);gl.uniform1f(this.uniforms.uLight,light);gl.uniform1f(this.uniforms.uDetail,this.low?0:1);
    gl.disable(gl.BLEND);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(this.uniforms.uPass,0);this.bindVertices(this.quad);gl.disableVertexAttribArray(this.attributes.dynamics);gl.vertexAttrib2f(this.attributes.dynamics,0,0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    this.drawSolid(this.ground,this.terrain.ground.length/11,2);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    this.drawSolid(this.shadows,this.terrain.shadows.length/11,4);gl.disable(gl.BLEND);gl.depthMask(true);
    this.drawSolid(this.stones,this.terrain.stones.length/11,3);
    if(this.dropCount)this.drawSolid(this.dropped,this.dropCount,3);
    root.WaterCore.updateMesh(this.mesh,this.field);
    this.bindVertices(this.positions);gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamics);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.mesh.dynamics);gl.enableVertexAttribArray(this.attributes.dynamics);gl.vertexAttribPointer(this.attributes.dynamics,2,gl.FLOAT,false,8,0);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);gl.uniform1f(this.uniforms.uPass,1);gl.drawElements(gl.TRIANGLES,this.mesh.indices.length,gl.UNSIGNED_SHORT,0);
    if(this.dropShadowCount)this.drawSolid(this.dropShadows,this.dropShadowCount,4);
    if(this.fishSystem){
      var fish=this.fishSystem.geometry(this.field);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.fishBuffer);gl.bufferData(gl.ARRAY_BUFFER,fish,gl.DYNAMIC_DRAW);
      // Underwater color is composed above the translucent water, but solid depth still occludes fish.
      gl.depthMask(true);this.drawSolid(this.fishBuffer,fish.length/11,5);
    }
    gl.depthMask(true);gl.disable(gl.BLEND);
  };
  Renderer.prototype.destroy=function(){
    this.disposed=true;if(!this.gl||this.gl.isContextLost())return;
    for(var i=0;i<this.textures.length;i++)this.gl.deleteTexture(this.textures[i]);for(i=0;i<this.buffers.length;i++)this.gl.deleteBuffer(this.buffers[i]);this.gl.deleteProgram(this.program);
  };
  root.WaterRenderer=Renderer;
}(window));
