const fs = require('fs'), path = require('path'), assert = require('assert/strict'), { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs/evidence-v' + require('../package.json').version);
function runtime(name) {
  try { return require(name); } catch {
    const bundled = process.env.CODEX_NODE_MODULES || path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
    return require(path.join(bundled, name));
  }
}
const { chromium } = runtime('playwright');
const createServer = require('./serve.cjs');
async function run() {
  fs.mkdirSync(out, { recursive: true });
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); server.unref();
  const url = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const reports = [], errors = [];
  try {
    for (const viewport of [{ width:390, height:844 }, { width:1440, height:960 }, { width:320, height:568 }, { width:844, height:390 }]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      const before = Date.now(); await page.goto(url); await page.waitForFunction(() => window.WaterGarden && window.WaterGarden.inspect().steps > 10); await page.waitForTimeout(700);
      const inspect = () => page.evaluate(() => window.WaterGarden.inspect());
      assert.equal(await page.locator('#sound').count(),0);
      assert((await inspect()).audioEnabled);assert.equal((await inspect()).audioState,'uninitialized','audio waits for the first user gesture');
      assert.equal(await page.locator('[data-mode]').count(),3); assert.equal(await page.getByText('落石',{exact:true}).count(),1);
      assert.deepEqual(await page.locator('[data-mode]').evaluateAll(buttons=>buttons.map(b=>b.dataset.mode)),['touch','leaf','stone']);
      assert.equal(await page.locator('#ice-actions, #freeze-all, #thaw-all').count(),0);
      let state = await inspect(); assert.equal(state.renderer, 'webgl'); assert(state.bufferWidth * state.bufferHeight <= 2000000);
      if(viewport.width===390){
        const swipeSample=await page.evaluate(async()=>{
          const audio=new OfflineAudioContext(1,22050*14,22050);let original;
          await new Promise((resolve,reject)=>{
            const decode=audio.decodeAudioData.bind(audio);audio.decodeAudioData=(bytes,done,fail)=>decode(bytes,buffer=>{original=buffer;done(buffer);resolve();},reject);
            window.swipeSampleCheck=new WaterSound.Stroke(audio,audio.destination,WaterSwipeAsset);
          });
          const buffer=swipeSampleCheck.buffer,source=audio.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(audio.destination);source.start();
          const rendered=await audio.startRendering(),samples=rendered.getChannelData(0);let peak=0,afterLoop=0;
          for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));if(i>buffer.length)afterLoop=Math.max(afterLoop,Math.abs(samples[i]));}
          const data=buffer.getChannelData(0),seam=Math.abs(data[0]-data[data.length-1]),input=original.getChannelData(0),overlap=original.length-buffer.length;
          const adjacent=Math.abs(input[overlap]-input[overlap-1]);delete window.swipeSampleCheck;
          return {duration:original.duration,loopDuration:buffer.duration,channels:original.numberOfChannels,peak,afterLoop,seam,adjacent,bytes:WaterSwipeAsset.bytes};
        });
        assert(swipeSample.duration>6&&swipeSample.duration<7);assert(swipeSample.peak>.01&&swipeSample.afterLoop>.01);
        assert(Math.abs(swipeSample.duration-swipeSample.loopDuration-.12)<.001);assert(Math.abs(swipeSample.seam-swipeSample.adjacent)<1e-6,'loop boundary must retain the original adjacent-sample transition');
        reports.push({scenario:'supplied swipe sample renders continuously across two loop seams',...swipeSample,result:'passed'});
        const fades=await page.evaluate(async()=>{
          async function render(kind,resume){
            const c=new OfflineAudioContext(1,8000*3,8000);let time=0;
            const original=c.createBuffer(1,16000,8000);original.getChannelData(0).fill(1);
            const clock={state:'running',sampleRate:8000,get currentTime(){return time;},decodeAudioData(bytes,done){done(original);},createBuffer:c.createBuffer.bind(c),createBufferSource:c.createBufferSource.bind(c),createGain:c.createGain.bind(c),createBiquadFilter:c.createBiquadFilter.bind(c)};
            let controller,voice;
            if(kind==='swipe'){
              controller=new WaterSound.Stroke(clock,c.destination,WaterSwipeAsset);controller.stroke(1.4);voice=controller.node;
              time=1;controller.release();
              if(resume){time=1.25;controller.stroke(1.4);}
            }else{
              controller=new WaterWeather.Audio(clock,c.destination);controller.rainBuffer.getChannelData(0).fill(1);
              controller.setLevel(1);voice=controller.rain;time=1;controller.setLevel(4);time=2;controller.stopRain();
            }
            const sameVoice=(kind==='swipe'?controller.node:controller.rain)===voice;
            const data=(await c.startRendering()).getChannelData(0);
            function average(t){const at=Math.round(t*8000);let sum=0;for(let i=at;i<at+80;i++)sum+=Math.abs(data[i]);return sum/80;}
            function jump(t){const i=Math.round(t*8000);return Math.abs(data[i]-data[i-1]);}
            return {sameVoice,early:average(.01),settled:average(.8),tail:average(kind==='swipe'?1.15:2.2),end:average(kind==='swipe'?1.64:2.69),resumed:average(1.8),switchJump:jump(kind==='swipe'?(resume?1.25:1):1),stopJump:jump(kind==='swipe'?1:2)};
          }
          return {swipe:await render('swipe',false),resumed:await render('swipe',true),rain:await render('rain',false)};
        });
        for(const value of [fades.swipe,fades.rain]){
          assert(value.sameVoice);assert(value.early<value.settled*.3,'long sound fades in');
          assert(value.tail>value.end*8&&value.end<value.settled*.02,'long sound fades to a quiet finite tail');
          assert(value.switchJump<.001&&value.stopJump<.001,'transitions must preserve PCM continuity');
        }
        assert(fades.resumed.sameVoice&&fades.resumed.resumed>.85,'a resumed swipe reverses its fade without restarting the source');
        reports.push({scenario:'real WebAudio PCM validates long-sound fades, continuous rain level changes and swipe fade reversal',...fades,result:'passed'});
        const sceneFades=await page.evaluate(async()=>{
          const c=new OfflineAudioContext(3,8000*4,8000);let time=0;
          const clock={get currentTime(){return time;},createGain:c.createGain.bind(c)};
          const mixer=new WaterSound.SceneMixer(clock,c.destination);
          ['water','snow','cloud'].forEach((kind,channel)=>{
            const buffer=c.createBuffer(3,8000*4,8000);buffer.getChannelData(channel).fill(1);
            const source=c.createBufferSource();source.buffer=buffer;source.connect(mixer.output(kind));source.start();
          });
          const changes=[[1,'snow'],[1.2,'cloud'],[1.35,'water'],[2,'snow']];
          changes.forEach(([at,kind])=>{time=at;mixer.select(kind);});
          const data=await c.startRendering(),sample=t=>Array.from({length:3},(_,i)=>data.getChannelData(i)[Math.round(t*8000)]);
          const jumps=changes.map(([t])=>Math.max(...sample(t).map((value,i)=>Math.abs(value-sample(t-1/8000)[i]))));
          let sumError=0;for(let i=0;i<data.length;i+=8)sumError=Math.max(sumError,Math.abs([0,1,2].reduce((sum,ch)=>sum+data.getChannelData(ch)[i],0)-1));
          return {before:sample(.8),early:sample(1.01),tail:sample(1.1),end:sample(3),jumps,sumError};
        });
        assert(sceneFades.before[0]>.99&&sceneFades.before[1]===0);
        assert(sceneFades.early[1]>0&&sceneFades.early[1]<.1&&sceneFades.tail[0]>.4,'incoming and outgoing scenes overlap gently');
        assert(sceneFades.end[0]<.005&&sceneFades.end[1]>.995);
        assert(sceneFades.jumps.every(j=>j<.001)&&sceneFades.sumError<.0001,'rapid scene reversals preserve PCM continuity and stable combined gain within WebAudio float precision');
        reports.push({scenario:'real three-channel PCM validates scene fade-in/out and rapid reversals',...sceneFades,result:'passed'});
        const shortFade=await page.evaluate(async()=>{
          const c=new OfflineAudioContext(1,8000*3,8000);let time=0;
          const buffer=c.createBuffer(1,8000*3,8000);buffer.getChannelData(0).fill(1);
          const clock={state:'running',get currentTime(){return time;},decodeAudioData(bytes,done){done(buffer);},createGain:c.createGain.bind(c),createBufferSource:c.createBufferSource.bind(c)};
          const sound=new WaterSound.OneShot(clock,c.destination,StoneImpactAsset);sound.play(1);time=1;sound.fadeOut();
          const data=(await c.startRendering()).getChannelData(0),at=t=>data[Math.round(t*8000)];
          return {attack:at(0),before:at(.9),jump:Math.abs(at(1)-at(1-1/8000)),tail:at(1.15),end:at(1.64),stopped:at(1.7)};
        });
        assert(shortFade.attack===.5&&shortFade.before===.5,'ordinary short effects retain their direct attack');
        assert(shortFade.jump<.001&&shortFade.tail>.1&&shortFade.end<.003&&shortFade.stopped===0);
        reports.push({scenario:'real one-shot PCM preserves the ordinary attack and fades the interrupted scene tail',...shortFade,result:'passed'});
        await page.touchscreen.tap(195,410);await page.waitForFunction(()=>WaterGarden.inspect().tapReady&&WaterGarden.inspect().tapPlayed===1);
        assert.equal((await inspect()).audioState,'running','the first touch automatically unlocks sound');
        const sample=await page.evaluate(async()=>{
          const raw=atob(WaterTapAsset.base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
          const audio=new OfflineAudioContext(2,22050,22050),buffer=await audio.decodeAudioData(bytes.buffer);
          const source=audio.createBufferSource();source.buffer=buffer;source.connect(audio.destination);source.start();
          const rendered=await audio.startRendering();let peak=0;
          for(let channel=0;channel<rendered.numberOfChannels;channel++)for(const value of rendered.getChannelData(channel))peak=Math.max(peak,Math.abs(value));
          return {duration:buffer.duration,channels:buffer.numberOfChannels,peak,bytes:WaterTapAsset.bytes};
        });
        assert(sample.duration>.4&&sample.duration<.8&&sample.peak>.01,'supplied sample must decode and render non-silent PCM');
        assert.equal((await inspect()).tapPlayed,1);
        await page.waitForFunction(()=>WaterGarden.inspect().tapVoices===0);
        await page.mouse.move(120,410);await page.mouse.down();await page.mouse.move(270,410,{steps:12});await page.mouse.up();
        assert.equal((await inspect()).tapPlayed,1,'swipes use continuous water sound only');
        await page.touchscreen.tap(195,410);await page.locator('#reset').click();assert.equal((await inspect()).tapVoices,0);
        await page.locator('#reset').click();
        reports.push({scenario:'sound is enabled by default with no toggle; first touch plays the recorded tap, swipes use their own sound and reset releases voices',...sample,result:'passed'});
        const stoneSample=await page.evaluate(async()=>{
          const raw=atob(StoneImpactAsset.base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
          const audio=new OfflineAudioContext(1,22050*4,22050),buffer=await audio.decodeAudioData(bytes.buffer);
          const source=audio.createBufferSource();source.buffer=buffer;source.connect(audio.destination);source.start();
          const rendered=await audio.startRendering();let peak=0;
          for(const value of rendered.getChannelData(0))peak=Math.max(peak,Math.abs(value));
          return {duration:buffer.duration,channels:buffer.numberOfChannels,peak,bytes:StoneImpactAsset.bytes};
        });
        assert(stoneSample.duration>3&&stoneSample.duration<3.3&&stoneSample.peak>.01);
        assert.equal(stoneSample.channels,1);assert.equal(stoneSample.bytes,25805);
        reports.push({scenario:'supplied stone impact sample decodes and renders non-silent PCM',...stoneSample,result:'passed'});
        const rippleSample=await page.evaluate(async()=>{
          const c=new OfflineAudioContext(2,22050*17,22050);let original;
          await new Promise((resolve,reject)=>{
            const decode=c.decodeAudioData.bind(c);c.decodeAudioData=(bytes,done)=>decode(bytes,buffer=>{original=buffer;done(buffer);resolve();},reject);
            window.rippleSampleCheck=new WaterSound.Ripple(c,c.destination,WaterRipplesAsset);
          });
          const buffer=rippleSampleCheck.buffer,source=c.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(c.destination);source.start();
          const data=(await c.startRendering()).getChannelData(0);let peak=0,afterLoops=0;
          for(let i=0;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));if(i>2*buffer.length)afterLoops=Math.max(afterLoops,Math.abs(data[i]));}
          let seamError=0;for(let channel=0;channel<buffer.numberOfChannels;channel++){
            const loop=buffer.getChannelData(channel),input=original.getChannelData(channel),overlap=original.length-buffer.length;
            seamError=Math.max(seamError,Math.abs((loop[0]-loop[loop.length-1])-(input[overlap]-input[overlap-1])));
          }
          delete window.rippleSampleCheck;return {duration:original.duration,loopDuration:buffer.duration,channels:buffer.numberOfChannels,bytes:WaterRipplesAsset.bytes,peak,afterLoops,seamError};
        });
        assert(rippleSample.duration>7.9&&rippleSample.duration<8.2);assert.equal(rippleSample.bytes,64827);
        assert.equal(rippleSample.channels,2);assert(rippleSample.peak>.01&&rippleSample.afterLoops>.01&&rippleSample.seamError<1e-6);
        reports.push({scenario:'supplied ripple recording renders offline across two smooth loop boundaries',...rippleSample,result:'passed'});
        const rippleFades=await page.evaluate(async()=>{
          const c=new OfflineAudioContext(1,8000*5,8000);let time=0;
          const buffer=c.createBuffer(1,16000,8000);buffer.getChannelData(0).fill(1);
          const clock={state:'running',get currentTime(){return time;},decodeAudioData(bytes,done){done(buffer);},createBuffer:c.createBuffer.bind(c),createBufferSource:c.createBufferSource.bind(c),createGain:c.createGain.bind(c)};
          const sound=new WaterSound.Ripple(clock,c.destination,WaterRipplesAsset);sound.update(.003);const voice=sound.node;
          time=1;sound.update(.025);time=2;sound.update(.06);time=3;sound.update(.003);time=4;sound.update(0);
          const samples=(await c.startRendering()).getChannelData(0),at=t=>samples[Math.round(t*8000)];
          return {sameVoice:sound.node===voice,early:at(.01),quiet:at(.8),medium:at(1.8),strong:at(2.8),reduced:at(3.8),tail:at(4.15),end:at(4.64),jumps:[1,2,3,4].map(t=>Math.abs(at(t)-at(t-1/8000)))};
        });
        assert(rippleFades.sameVoice&&rippleFades.early<rippleFades.quiet*.2);
        assert(rippleFades.medium>rippleFades.quiet*4&&rippleFades.strong>rippleFades.medium*1.8);
        assert(rippleFades.reduced<rippleFades.strong*.12&&rippleFades.end<rippleFades.tail*.025);
        assert(rippleFades.jumps.every(j=>j<.001));
        reports.push({scenario:'real ripple PCM fades in, scales with wave strength and fades out continuously',...rippleFades,result:'passed'});
        await page.waitForFunction(()=>WaterGarden.inspect().rippleReady);
        await page.mouse.move(120,410);await page.mouse.down();await page.mouse.move(270,410,{steps:12});await page.mouse.up();
        await page.waitForTimeout(900);const remaining=await inspect();
        assert(!remaining.strokeAudio&&remaining.rippleAudio&&remaining.rippleLevel>.01&&remaining.activePointers===0,'released fingers leave audible moving water');
        await page.waitForFunction(level=>WaterGarden.inspect().rippleLevel>0&&WaterGarden.inspect().rippleLevel<level*.7,remaining.rippleLevel);
        const quieter=await inspect();assert(quieter.rippleAudio);
        await page.screenshot({path:path.join(out,'ripple-audio-after-release.png')});
        await page.locator('#reset').click();assert((await inspect()).rippleFading);
        await page.waitForFunction(()=>!WaterGarden.inspect().rippleAudio);
        reports.push({scenario:'pointer release leaves wave-driven sound which weakens as the water settles and fades on reset',remaining,quieter,result:'passed'});
        await page.touchscreen.tap(195,410);
        const tapSwitch=await page.evaluate(()=>{
          const before=WaterGarden.inspect();document.querySelector('button[data-scene="snow"]').click();return {before,after:WaterGarden.inspect()};
        });
        assert(tapSwitch.before.tapVoices>0&&tapSwitch.after.tapFading>0&&tapSwitch.after.audioScene==='snow');
        await page.waitForFunction(()=>WaterGarden.inspect().tapVoices===0);
        const natureTails=[];
        for(const next of ['cloud','water']){
          await page.waitForTimeout(250);
          // Dispatch both DOM events in one turn so the naturally brief (.22s) sound cannot finish between test commands.
          const transition=await page.evaluate(next=>{
            const surface=document.getElementById('nature');
            surface.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,buttons:1,pointerId:913,pointerType:'touch',clientX:195,clientY:410}));
            surface.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,button:0,buttons:1,pointerId:913,pointerType:'touch',clientX:225,clientY:410}));
            surface.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerId:913,pointerType:'touch',clientX:195,clientY:410}));
            const before=WaterGarden.inspect();document.querySelector('button[data-scene="'+next+'"]').click();return {before,after:WaterGarden.inspect()};
          },next);
          assert(transition.before.sceneSoundNodes>0&&transition.after.sceneSoundFading>0&&transition.after.audioScene===next,'nature sound retains a fading tail on '+next);
          natureTails.push({from:transition.before.audioScene,to:next,retained:transition.after.sceneSoundFading});
          await page.waitForFunction(()=>WaterGarden.inspect().sceneSoundNodes===0);
        }
        reports.push({scenario:'water tap, snow and cloud sounds retain fading tails across every scene boundary and release their nodes',tapRetained:tapSwitch.after.tapFading,natureTails,result:'passed'});
        await page.locator('#reset').click();
      }
      assert.equal(state.fish.length,5);assert.equal(state.fishTriangles,1175);
      const fishStart=state.fishTime;await page.waitForTimeout(220);assert((await inspect()).fishTime>fishStart);
      const beforeScare=(await inspect()).fish[0],fx=beforeScare.u*viewport.width,fy=(beforeScare.v-beforeScare.y*.25)*viewport.height;
      await page.mouse.move(fx-24,fy);await page.mouse.down();await page.mouse.move(fx+24,fy,{steps:8});await page.mouse.up();
      const alarm=(await inspect()).fish[0];assert(alarm.fear>.4,'a real pointer stroke near the fish must frighten it');
      await page.waitForTimeout(350);const fleeing=(await inspect()).fish[0];
      assert(fleeing.speed>beforeScare.speed*1.4,'nearby fish accelerate');assert(fleeing.y<beforeScare.y-.004,'nearby fish dive');
      assert.equal((await inspect()).rings,0,'swimming and fleeing must not add drawn rings');
      if(viewport.width===390)await page.screenshot({path:path.join(out,'fish-startled.png')});
      reports.push({scenario:'pointer stroke startles fish',viewport,before:beforeScare,alarm,fleeing,result:'passed'});
      await page.locator('#reset').click();assert((await inspect()).fish.every(f=>f.fear===0));
      await page.waitForFunction(() => WaterGarden.inspect().waterMaps === 2);
      assert(state.surfaceVertices > 4000 && state.surfaceVertices < 65536);
      assert(state.surfaceTriangles > 8000 && state.surfaceTriangles <= 32768);
      if(viewport.width === 390) {
        const fishCheck=await page.evaluate(()=>{
          const canvas=document.createElement('canvas'),field=new WaterCore.WaveField(96,96,1);
          const renderer=new WaterRenderer(canvas,WaterScene.create(1),field),school=new WaterFish.System();
          renderer.resize(480,480);school.attach(1);school.update(.08,field.bathymetry,false);
          const gl=renderer.gl,read=enabled=>{
            renderer.fishSystem=enabled?school:null;renderer.draw(0,0);
            const pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;
          };
          const difference=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>6)n++;return n;};
          try{
            const visible=difference(read(true),read(false));
            const solidDraw=renderer.drawSolid;
            renderer.drawSolid=function(buffer,count,pass){if(pass!==5)solidDraw.call(this,buffer,count,pass);};
            const shallowWater=difference(read(true),read(false));renderer.drawSolid=solidDraw;
            const poseA=read(true);for(let n=0;n<4;n++)school.update(.075,field.bathymetry,false);const animated=difference(poseA,read(true));
            // An opaque solid above all fish must fully occlude their underwater draw pass.
            const cover=[];for(const p of [[-1,-1],[-1,1],[1,-1],[1,-1],[-1,1],[1,1]])cover.push(p[0],.05,p[1],.5+p[0]/2,.5+p[1]*.433,0,1,0,.4,.5,.3);
            renderer.terrain.stones=new Float32Array(cover);gl.bindBuffer(gl.ARRAY_BUFFER,renderer.stones);gl.bufferData(gl.ARRAY_BUFFER,renderer.terrain.stones,gl.STATIC_DRAW);
            const occluded=difference(read(true),read(false));
            return {visible,shallowWater,animated,occluded,error:gl.getError()};
          }finally{renderer.destroy();}
        });
        assert(fishCheck.visible>100,'Blender fish must be visible underwater');
        assert(fishCheck.shallowWater>100,'fish geometry must change the existing water material even when its color pass is hidden');
        assert(fishCheck.animated>50,'the baked tail pose must change visible pixels');
        assert.equal(fishCheck.occluded,0,'rocks must hide fish');assert.equal(fishCheck.error,0);
        reports.push({scenario:'Blender fish animation, underwater visibility and occlusion',...fishCheck,result:'passed'});
        await page.screenshot({path:path.join(out,'fish-mobile.png')});
        const waveEdges=await page.evaluate(()=>{
          const canvas=document.createElement('canvas'),field=new WaterCore.WaveField(32,32,1);
          const proto=WebGLRenderingContext.prototype,source=proto.shaderSource;let renderer;
          try{
            proto.shaderSource=function(shader,text){return source.call(this,shader,text.replace('alpha=mix(.62,.94,smoothstep(.008,.18,depth));','col=vec3(heightAt(uv));alpha=1.;'));};
            renderer=new WaterRenderer(canvas,WaterScene.create(1),field);proto.shaderSource=source;renderer.resize(640,640);
            for(let y=0;y<32;y++)field.current[y*32+15]=.6;
            const gl=renderer.gl,measure=low=>{
              renderer.low=low;renderer.draw(4,0);const width=canvas.width,p=new Uint8Array(width*4);
              gl.readPixels(0,Math.floor(canvas.height/2),width,1,gl.RGBA,gl.UNSIGNED_BYTE,p);
              let kink=0,peak=0;
              for(let x=Math.floor(width*.4);x<width*.6;x++){
                peak=Math.max(peak,p[x*4]);kink=Math.max(kink,Math.abs(p[(x+1)*4]-2*p[x*4]+p[(x-1)*4]));
              }
              return {kink,peak};
            };
            return {linear:measure(true),smooth:measure(false),antialias:gl.getContextAttributes().antialias};
          }finally{proto.shaderSource=source;if(renderer)renderer.destroy();}
        });
        assert(waveEdges.linear.kink>4,'the fixture must expose the old interpolation corner');
        assert(waveEdges.smooth.kink<waveEdges.linear.kink*.5,'water reconstruction must smooth the visible wave corner');
        assert(waveEdges.smooth.peak>60,'smoothing must preserve a visible wave');
        reports.push({scenario:'smooth wave reconstruction',...waveEdges,result:'passed'});
        // Isolate the actual foam shader at a fixed time and fixed geometry.
        // A timer-only foam layer must fail even if the rest of the water reacts.
        const foamResponse = await page.evaluate(() => {
          const surface = document.createElement('canvas'), field = new WaterCore.WaveField(128,160,.8);
          const proto = WebGLRenderingContext.prototype, shaderSource = proto.shaderSource, updateMesh = WaterCore.updateMesh;
          let renderer;
          try {
            proto.shaderSource = function(shader,source) {
              source = source.replace('col=mix(col,vec3(.91,1.,.96),clamp(advancing*.82+lace*.6+wetRim,0.,.90));','col=vec3(clamp(advancing*.82+lace*.6+wetRim,0.,.90));');
              return shaderSource.call(this,shader,source);
            };
            renderer = new WaterRenderer(surface,WaterScene.create(.8),field);
            proto.shaderSource = shaderSource;
            renderer.resize(256,320); WaterCore.updateMesh = function() {};
            const gl=renderer.gl;
            gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D,renderer.textures[5]);
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,WaterMaps.canvas('foam'));
            const read=()=>{renderer.draw(4,0);const p=new Uint8Array(surface.width*surface.height*4);gl.readPixels(0,0,surface.width,surface.height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
            const before=read(); field.stroke(.11,.39,.12,.58,.25); const after=read();
            let changed=0, remote=0;
            for(let y=0;y<surface.height;y++)for(let x=0;x<surface.width;x++) {
              const u=x/surface.width,v=1-y/surface.height,d=WaterCore.shore(u,v),i=(y*surface.width+x)*4;
              if(d<-.02&&d>-.24&&Math.abs(after[i]-before[i])>5) { if(u<.25)changed++;if(u>.75)remote++; }
            }
            field.clear();const reset=read();let resetDifference=0;
            for(let i=0;i<before.length;i++)resetDifference=Math.max(resetDifference,Math.abs(before[i]-reset[i]));
            return {changed,remote,resetDifference};
          } finally {proto.shaderSource=shaderSource;WaterCore.updateMesh=updateMesh;if(renderer)renderer.destroy();}
        });
        assert(foamResponse.changed>80,'coastal foam must respond to wave data with the animation clock fixed');
        assert.equal(foamResponse.remote,0,'local interaction must not shake the opposite bank');
        // Multisample resolve can round a channel by one 8-bit unit between frames.
        assert(foamResponse.resetDifference<=1,'clearing waves must restore unperturbed foam within output rounding');
        reports.push({scenario:'isolated coastal foam coupling',...foamResponse,result:'passed'});
        // Color-code actual rock geometry by height, then compare before/after the water pass.
        const depthResult = await page.evaluate(() => {
          const canvas=document.createElement('canvas'),field=new WaterCore.WaveField(128,160,.8);
          const proto=WebGLRenderingContext.prototype,source=proto.shaderSource,drawElements=proto.drawElements;
          let renderer;
          try {
            proto.shaderSource=function(shader,text){
              text=text.replace('gl_FragColor=vec4(col,1.);return;','if(uPass>2.5)col=vHeight>.025?vec3(1.,0.,0.):(vHeight<-.01?vec3(0.,0.,1.):vec3(0.,1.,0.));gl_FragColor=vec4(col,1.);return;');
              return source.call(this,shader,text);
            };
            renderer=new WaterRenderer(canvas,WaterScene.create(.8),field);proto.shaderSource=source;renderer.resize(320,400);
            const gl=renderer.gl,read=()=>{renderer.draw(4,0);const pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
            proto.drawElements=function(){};const solid=read();proto.drawElements=drawElements;
            const water=read();
            let dry=0,dryCovered=0,wet=0,wetTinted=0;
            for(let i=0;i<solid.length;i+=4) {
              if(solid[i]===255&&solid[i+1]===0&&solid[i+2]===0) {
                dry++;if(water[i]<250||water[i+1]>5||water[i+2]>5)dryCovered++;
              }
              if(solid[i]===0&&solid[i+1]===0&&solid[i+2]===255) {
                wet++;if(water[i+1]>20&&water[i+2]<250)wetTinted++;
              }
            }
            return {dry,dryCovered,wet,wetTinted,error:gl.getError()};
          } finally {proto.shaderSource=source;proto.drawElements=drawElements;if(renderer)renderer.destroy();}
        });
        assert(depthResult.dry>100&&depthResult.wet>30,'scene must contain both exposed and submerged stone surfaces');
        assert(depthResult.dryCovered/depthResult.dry<.01,'water must not cover dry stone tops');
        assert(depthResult.wetTinted/depthResult.wet>.80,'underwater stone surfaces must show water tint');
        assert.equal(depthResult.error,0);reports.push({scenario:'3D stone and water depth occlusion',...depthResult,result:'passed'});
        const colorDepth = await page.evaluate(() => {
          const canvas=document.createElement('canvas'),field=new WaterCore.WaveField(128,160,.8);
          const proto=WebGLRenderingContext.prototype,source=proto.shaderSource;let renderer;
          try {
            // Inspect the depth actually consumed by the water material, without lighting/foam hiding the result.
            proto.shaderSource=function(shader,text){return source.call(this,shader,text.replace('alpha=mix(.62,.94,smoothstep(.008,.18,depth));','col=vec3(clamp(depth/.22,0.,1.));alpha=1.;'));};
            renderer=new WaterRenderer(canvas,WaterScene.create(.8),field);proto.shaderSource=source;renderer.resize(320,400);
            const gl=renderer.gl,bed=renderer.bed;
            const read=()=>{renderer.draw(4,0);const p=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
            const real=read(),flat=new Uint8Array(bed.pixels);
            for(let y=0;y<bed.height;y++)for(let x=0;x<bed.width;x++) {
              const i=y*bed.width+x;if(!bed.stone[i])continue;
              const bottom=WaterTerrain.elevation((x+.5)/bed.width,(y+.5)/bed.height),code=Math.round((bottom+.3)/.6*65535);
              flat[i*4]=code>>8;flat[i*4+1]=code&255;
            }
            gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,renderer.bedTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,bed.width,bed.height,0,gl.RGBA,gl.UNSIGNED_BYTE,flat);
            const withoutStoneDepth=read();let shallower=0;
            for(let i=0;i<real.length;i+=4)if(withoutStoneDepth[i]-real[i]>8)shallower++;
            return {shallowerPixels:shallower,error:gl.getError()};
          } finally {proto.shaderSource=source;if(renderer)renderer.destroy();}
        });
        assert(colorDepth.shallowerPixels>40,'water material must read shallower depth above the actual submerged stone surfaces');
        assert.equal(colorDepth.error,0);reports.push({scenario:'geometry-derived water material depth',...colorDepth,result:'passed'});
        const clip={x:16,y:345,width:54,height:85};
        const foamBefore=await page.screenshot({clip,path:path.join(out,'shoreline-phase-a.png')});
        await page.waitForTimeout(1000);
        const foamAfter=await page.screenshot({clip,path:path.join(out,'shoreline-phase-b.png')});
        assert(!foamBefore.equals(foamAfter),'shoreline foam must evolve while untouched');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true);
      const readyAndSettleMs = Date.now() - before;
      if (viewport.width === 390 || viewport.width === 1440) await page.screenshot({ path: path.join(out, viewport.width === 390 ? 'mobile-calm.png' : 'desktop-calm.png') });
      const x = viewport.width * .48, y = viewport.height * .48;
      await page.touchscreen.tap(x, y); await page.waitForTimeout(80);
      state = await inspect(); assert(state.energy > .01, 'touch tap must disturb water'); assert(state.rings > 0); assert.equal(state.drops,0,'touch tap must not spray water');
      await page.locator('#reset').click(); await page.waitForTimeout(70); assert((await inspect()).energy < .000001);
      await page.mouse.move(viewport.width * .3, y); await page.mouse.down(); await page.mouse.move(viewport.width * .7, y, { steps: 18 }); await page.mouse.up();
      state = await inspect(); assert(state.energy > .1, 'swipe must disturb water continuously'); assert.equal(state.activePointers, 0);
      assert.equal(state.drops,0,'swiping must not throw airborne water drops');
      assert.equal(state.rings,0,'swiping must not draw circular ripple outlines');
      if (viewport.width === 390) await page.screenshot({ path: path.join(out, 'mobile-ripples.png') });
      if (viewport.width === 390) {
        await page.locator('#reset').click();
        const sprayTouch = await context.newCDPSession(page);
        await sprayTouch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:120,y:405,id:1}]});
        // Smooth touch input and fast swipes move water without throwing droplets.
        for (let sx = 123; sx <= 180; sx += 3) await sprayTouch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx,y:405,id:1}]});
        state = await inspect(); assert.equal(state.drops,0); assert.equal(state.rings,0); assert(state.energy > .01);
        await sprayTouch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:280,y:415,id:1}]});
        await page.waitForTimeout(60); state = await inspect(); assert.equal(state.drops,0); assert.equal(state.rings,0);
        await page.screenshot({path:path.join(out,'mobile-swipe-no-spray.png')});
        await sprayTouch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
        assert.equal((await inspect()).activePointers,0);
        await page.waitForTimeout(1100); state = await inspect(); assert.equal(state.drops,0);
        await sprayTouch.detach();
      }
      await page.locator('#reset').click(); await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(850); await page.mouse.up();
      await page.waitForTimeout(60); state = await inspect(); assert.equal(state.drops,0,'long press release must not spray'); assert(state.energy > .1);
      await page.locator('[data-mode="leaf"]').click(); assert.equal((await inspect()).mode, 'leaf');
      const count = (await inspect()).leaves; await page.touchscreen.tap(x, y); assert.equal((await inspect()).leaves, count + 1);
      const leafBefore = (await inspect()).leafPositions[count];
      await page.mouse.move(x-20,y); await page.mouse.down(); await page.mouse.move(x+35,y,{steps:12}); await page.mouse.up(); await page.waitForTimeout(240);
      assert((await inspect()).leafPositions[count].u > leafBefore.u + .002, 'moving water should push a nearby leaf');
      await page.locator('#rain').click(); await page.waitForTimeout(400); assert.equal((await inspect()).rain, true);
      assert(await page.locator('#rain-options').isVisible());
      const rainStates=[];
      for(let level=1;level<=4;level++){
        const selector='[data-rain="'+level+'"]',box=await page.locator(selector).boundingBox();
        assert(box.x>=0&&box.x+box.width<=viewport.width&&box.y>=0&&box.y+box.height<=viewport.height,'rain selector fits viewport');
        assert(box.width>=44&&box.height>=44,'rain choices have touch-sized targets');
        await page.locator(selector).click();await page.waitForFunction(()=>!WaterGarden.inspect().rainTransition);state=await inspect();
        assert.equal(state.rainLevel,level);assert(state.rainStreaks>0);assert.equal(await page.locator(selector).getAttribute('aria-pressed'),'true');
        assert.equal(state.rainStreaks,Math.round([0,48,168,420,840][level]*(state.quality==='normal'?1:.4)),'each rain level uses the increased particle density');
        rainStates.push({level,streaks:state.rainStreaks,impacts:state.rainImpacts,energy:state.energy});
        if(viewport.width===390)await page.screenshot({path:path.join(out,'mobile-rain-'+level+'.png')});
      }
      for(let i=1;i<rainStates.length;i++)assert(rainStates[i].streaks>rainStates[i-1].streaks);
      assert((await inspect()).rainImpacts>0,'falling rain must disturb water');
      reports.push({scenario:'four rain levels',viewport,presets:rainStates,result:'passed'});
      if(viewport.width===390){
        await page.evaluate(()=>{
          const proto=WaterWeather.System.prototype,setLevel=proto.setLevel,update=proto.update;
          window.transitionProbe={setLevel,update,boundaries:[],frames:[]};
          proto.setLevel=function(level){
            function snapshot(w){return {count:w.count,current:{...w.current},particles:w.particles.slice(0,Math.min(20,w.count)).map(p=>({...p}))};}
            const before=snapshot(this);setLevel.call(this,level);transitionProbe.boundaries.push({target:level,before,after:snapshot(this)});
          };
          proto.update=function(...args){update.apply(this,args);transitionProbe.frames.push({level:this.level,count:this.count,speed:this.current.speed,scale:this.current.rippleScale,transition:!!this.transitionFrom});};
        });
        await page.locator('[data-rain="1"]').click();await page.waitForTimeout(320);
        state=await inspect();const rainFactor=state.quality==='normal'?1:.4;
        assert(state.rainTransition&&state.rainStreaks>Math.round(48*rainFactor)&&state.rainStreaks<Math.round(840*rainFactor),'storm softens toward light rain over multiple frames');
        await page.screenshot({path:path.join(out,'mobile-storm-to-light-transition.png')});
        await page.locator('[data-rain="3"]').click();await page.waitForTimeout(250);assert((await inspect()).rainTransition);
        await page.locator('[data-rain="1"]').click();await page.waitForFunction(()=>!WaterGarden.inspect().rainTransition);
        state=await inspect();assert.equal(state.rainStreaks,Math.round(48*(state.quality==='normal'?1:.4)));
        await page.locator('[data-rain="4"]').click();await page.waitForFunction(()=>!WaterGarden.inspect().rainTransition);
        state=await inspect();assert.equal(state.rainStreaks,Math.round(840*(state.quality==='normal'?1:.4)));
        const transitions=await page.evaluate(()=>{
          const p=transitionProbe;WaterWeather.System.prototype.setLevel=p.setLevel;WaterWeather.System.prototype.update=p.update;
          const result={boundaries:p.boundaries,frames:p.frames};delete window.transitionProbe;return result;
        });
        for(const boundary of transitions.boundaries)assert.deepEqual(boundary.after,boundary.before,'real button clicks must retain displayed particles and rain parameters');
        assert(transitions.frames.every(f=>f.count>0&&f.speed>0),'falling rain must never stop between presets');
        assert(transitions.frames.some(f=>f.transition&&f.scale>1&&f.scale<2));
        reports.push({scenario:'real rain buttons preserve falling streaks through gradual and interrupted transitions',...transitions,result:'passed'});
        await page.locator('#reset').click();
        await page.locator('[data-mode="touch"]').click();
        // Observe the application's short rain response and touch solver on the same rendered field.
        await page.evaluate(()=>{
          const proto=WaterCore.WaveField.prototype,disturb=proto.disturb,rainImpact=proto.rainImpact,stroke=proto.stroke,update=WaterWeather.System.prototype.update;
          window.rainProbe={fields:new Set(),scales:new Set(),impulses:0,strokes:0,disturb,rainImpact,stroke,update,inRain:false};
          WaterWeather.System.prototype.update=function(dt,low,reduced,impact,thunder){
            rainProbe.level=this.level;
            return update.call(this,dt,low,reduced,(...args)=>{rainProbe.inRain=true;try{return impact(...args);}finally{rainProbe.inRain=false;}},thunder);
          };
          proto.disturb=function(...args){const accepted=disturb.apply(this,args);if(accepted){rainProbe.fields.add(this);if(rainProbe.inRain)rainProbe.impulses++;}return accepted;};
          proto.rainImpact=function(...args){const accepted=rainImpact.apply(this,args);if(accepted){rainProbe.fields.add(this);if(rainProbe.level===4)rainProbe.scales.add(args[4]);rainProbe.impulses++;}return accepted;};
          proto.stroke=function(...args){rainProbe.fields.add(this);rainProbe.strokes++;return stroke.apply(this,args);};
        });
        await page.locator('#rain').click();await page.locator('[data-rain="4"]').click();
        await page.waitForTimeout(1800);state=await inspect();
        const rainWaves=await page.evaluate(()=>({hits:WaterGarden.inspect().rainImpacts,impulses:rainProbe.impulses,fields:rainProbe.fields.size,scales:Array.from(rainProbe.scales)}));
        assert(rainWaves.scales.length>1&&rainWaves.scales.every(scale=>scale>=1&&scale<=2),'new rain ripples grow smoothly during the transition');
        assert.equal(rainWaves.scales[rainWaves.scales.length-1],2,'settled storm landings must use twice the light-rain ripple radius');
        assert(rainWaves.hits>300,'storm must inject hundreds of actual water waves');
        assert.equal(rainWaves.impulses,rainWaves.hits,'every accepted rain drop must disturb the simulated water');
        assert.equal(rainWaves.fields,1);assert(state.energy>.001,'small rain ripples must move the real water surface');
        assert.equal(state.rings,0,'rain must not substitute decorative overlay rings for water waves');
        await page.screenshot({path:path.join(out,'mobile-topdown-storm.png')});
        await page.mouse.move(x-45,y);await page.mouse.down();await page.mouse.move(x+65,y,{steps:18});await page.mouse.up();
        const shared=await page.evaluate(()=>{
          const p=rainProbe,field=Array.from(p.fields)[0];
          const result={fields:p.fields.size,strokes:p.strokes,energy:field.energy(),finite:Array.from(field.current).every(Number.isFinite)};
          WaterCore.WaveField.prototype.disturb=p.disturb;WaterCore.WaveField.prototype.rainImpact=p.rainImpact;WaterCore.WaveField.prototype.stroke=p.stroke;WaterWeather.System.prototype.update=p.update;delete window.rainProbe;return result;
        });
        assert.equal(shared.fields,1,'rain and manual swipes must modify the very same wave field');
        assert(shared.strokes>0&&shared.energy>.1&&shared.finite);
        assert.equal((await inspect()).rings,0);
        await page.screenshot({path:path.join(out,'mobile-storm-swipe.png')});
        reports.push({scenario:'dense overhead storm and manual swipe share simulated water',rainWaves,shared,result:'passed'});
        // Measure actual streak pixels with cloud tint and flashes removed from this isolated canvas.
        const streakPixels=await page.evaluate(()=>{
          const surface=document.createElement('canvas');surface.width=390;surface.height=844;
          const ctx=surface.getContext('2d'),counts=[];
          for(let level=1;level<=4;level++){
            const w=new WaterWeather.System(WaterCore.seededRandom(3));
            w.setLevel(level);w.update(0,false,false);w.draw(ctx,390,844,false);
            const pixels=ctx.getImageData(0,0,390,844).data;let count=0;
            for(let i=3;i<pixels.length;i+=4)if(pixels[i]>12)count++;
            counts.push(count);ctx.clearRect(0,0,390,844);
          }
          return counts;
        });
        assert(streakPixels[0]>150,'light rain must contain visible airborne streaks');
        for(let i=1;i<4;i++)assert(streakPixels[i]>streakPixels[i-1],'higher rainfall must visibly cover more pixels');
        assert.equal((await inspect()).rainAudio,true);
        await page.waitForFunction(()=>WaterGarden.inspect().lightningFlash>.45);
        await page.screenshot({path:path.join(out,'mobile-storm-lightning.png')});
        await page.waitForFunction(()=>WaterGarden.inspect().thunderPlayed>0);
        const firstStrike=(await inspect()).lightningCount;
        await page.waitForFunction(count=>WaterGarden.inspect().lightningCount>count,firstStrike,{timeout:10000});
        reports.push({scenario:'visible rain streaks and repeated storm lightning with delayed WebAudio thunder',streakPixels,state:await inspect(),result:'passed'});
        await page.locator('[data-rain="0"]').click();assert((await inspect()).rainAudioFading);
        await page.waitForTimeout(120);await page.locator('#rain').click();
        assert((await inspect()).rainAudio&&!((await inspect()).rainAudioFading));
        await page.locator('[data-rain="2"]').click();await page.locator('[data-rain="4"]').click();
        await page.locator('[data-rain="0"]').click();await page.locator('#reset').click();
        await page.waitForFunction(()=>!WaterGarden.inspect().rainAudioFading&&WaterGarden.inspect().weatherAudioNodes===0);
        assert.equal((await inspect()).audioState,'running','reset leaves default audio available');
        reports.push({scenario:'default rain audio retains continuous playback across level changes and reverses a stopped-rain fade',result:'passed'});
        await page.waitForFunction(()=>WaterGarden.inspect().strokeReady&&WaterGarden.inspect().audioState==='running');
        await page.mouse.move(x-40,y);await page.mouse.down();
        for(let i=0;i<12;i++){await page.mouse.move(x-40+i*7,y);await page.waitForTimeout(25);}
        await page.mouse.move(x+45,y);
        state=await inspect();assert(state.strokeAudio&&state.strokeSpeed>0,'a real swipe must create continuous water sound: '+JSON.stringify(state));
        await page.waitForTimeout(160);assert.equal((await inspect()).strokeSpeed,0,'holding still must silence the swipe');
        await page.mouse.move(x+55,y);await page.waitForTimeout(35);assert((await inspect()).strokeSpeed>0);
        await page.mouse.up();await page.waitForTimeout(800);assert.equal((await inspect()).strokeAudio,false,'release must free the continuous sound graph after its fade');
        await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+25,y);await page.waitForTimeout(40);
        await page.mouse.up();await page.locator('#reset').click();assert.equal((await inspect()).strokeAudioFading,true,'reset retains the soft tail');
        await page.waitForFunction(()=>!WaterGarden.inspect().strokeAudio);
        reports.push({scenario:'continuous swipe sound follows motion, fades at rest and releases on reset',result:'passed'});
        // Scene switches keep the same soft water tails, then release them while water physics pauses.
        await page.locator('#rain').click();
        await page.mouse.move(x-25,y);await page.mouse.down();await page.mouse.move(x+25,y,{steps:8});
        assert((await inspect()).strokeAudio);await page.mouse.up();
        await page.locator('button[data-scene="snow"]').click();assert.equal(await page.evaluate(()=>NatureGarden.inspect().scene),'snow');
        assert((await inspect()).rainAudioFading);
        await page.waitForFunction(()=>!WaterGarden.inspect().strokeAudio&&!WaterGarden.inspect().rainAudioFading&&!WaterGarden.inspect().rippleAudio);
        assert.equal((await inspect()).audioState,'running','scene changes keep default audio available');
        await page.locator('button[data-scene="cloud"]').click();await page.locator('button[data-scene="water"]').click();assert((await inspect()).rainAudio);
        await page.locator('#reset').click();
        reports.push({scenario:'water audio tails fade and release across snow/cloud scene switches, then resume on return',result:'passed'});
      }
      await page.locator('#light').click(); assert.equal((await inspect()).light, 1); await page.locator('#light').click(); assert.equal((await inspect()).light, 2);
      if (viewport.width === 390) await page.screenshot({ path: path.join(out, 'mobile-moon-rain.png') });
      await page.touchscreen.tap(x,y);assert((await inspect()).audioEnabled);
      await page.locator('#reset').click(); state = await inspect(); assert.equal(state.rain, false); assert.equal(state.leaves, 3); assert(state.energy < .000001);
      assert.equal(state.rainStreaks,0);assert.equal(state.lightningFlash,0);assert.equal(state.thunderPending,false);assert.equal(state.rainAudio,false);
      assert.equal(await page.locator('#rain-options').isVisible(),false);
      await page.locator('#light').click();
      await page.locator('[data-mode="touch"]').click();
      await page.evaluate(() => { document.documentElement.style.setProperty('--safe-area-inset-top', '44px'); document.documentElement.style.setProperty('--safe-area-inset-bottom', '34px'); });
      const buttonBox = await page.locator('#reset').boundingBox(); assert(buttonBox.x >= 0 && buttonBox.x + buttonBox.width <= viewport.width); assert(buttonBox.y + buttonBox.height <= viewport.height - 34);
      if (viewport.width === 390) {
        await page.setViewportSize({width:844,height:390}); await page.waitForTimeout(600); assert.equal((await inspect()).width,844);
        await page.setViewportSize(viewport); await page.waitForTimeout(600);
        await page.locator('#rain').click();await page.locator('[data-rain="4"]').click();
        await page.waitForTimeout(250);const beforePause=await inspect();assert(beforePause.rainAudio);
        // A controlled visibility event checks the exact lifecycle path without OS focus assumptions.
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', {configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange')); });
        const pausedState=await inspect(),paused=pausedState.steps; await page.waitForTimeout(220); assert.equal((await inspect()).steps, paused);
        assert.equal((await inspect()).rainAudio,false);assert.equal((await inspect()).lightningNext,pausedState.lightningNext);
        assert.equal((await inspect()).tapVoices,0);
        assert.equal((await inspect()).rippleAudio,false);
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', {configurable:true,value:false}); document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForTimeout(170); assert((await inspect()).steps > paused);
        assert((await inspect()).rainAudio);assert.equal((await inspect()).rainLevel,4);
        await page.locator('#reset').click();
        // Lose the actual GL context, then restore it once and verify pause and recovery.
        await page.evaluate(() => { window.testLostContext = document.getElementById('water').getContext('webgl').getExtension('WEBGL_lose_context'); window.testLostContext.loseContext(); });
        await page.waitForTimeout(180); assert.equal((await inspect()).renderer, 'unavailable');
        assert(await page.locator('#render-status').isVisible());const pausedSteps=(await inspect()).steps;await page.waitForTimeout(150);assert.equal((await inspect()).steps,pausedSteps);
        await page.evaluate(() => window.testLostContext.restoreContext()); await page.waitForTimeout(500); assert.equal((await inspect()).renderer,'webgl');
        await page.touchscreen.tap(x,y); assert((await inspect()).energy > .001,'restored 3D water remains interactive');
        await page.locator('[data-mode="touch"]').click(); await page.locator('#reset').click();
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:130,y:380,id:1},{x:260,y:460,id:2}]});
        assert.equal((await inspect()).activePointers,2);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:150,y:390,id:1},{x:240,y:450,id:2}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}); assert.equal((await inspect()).activePointers,0);
        await cdp.detach();
      }
      await page.locator('#reset').click();await page.locator('[data-mode="stone"]').click();
      if(viewport.width===390){
        const target=(await inspect()).fish[0];
        await page.mouse.click(target.u*viewport.width,target.v*viewport.height);
        await page.waitForTimeout(300);const fleeing=await inspect(),fish=fleeing.fish[0];
        assert.equal(fleeing.stoneImpacts,0,'fish must react while the stone is still airborne');
        assert(fish.fear>.7&&fish.speed>.15,'nearby fish accelerate before impact');
        assert(Math.hypot(fish.u-target.u,fish.v-target.v)>.012,'fish leave the target position');
        assert(fleeing.energy>.001,'escaping fish disturb the water before stone impact');
        assert.equal(fleeing.rings,0);
        await page.screenshot({path:path.join(out,'fish-escape-airborne.png')});
        await page.locator('#reset').click();
      }
      if(viewport.width===390){
        await page.waitForFunction(()=>WaterGarden.inspect().stoneReady);
      }
      // Reuse a fixed varied rock sequence; weather/audio consume random values at
      // different rates, which must not change this independent physics fixture.
      await page.evaluate(()=>{
        const proto=WaterStones.System.prototype,add=proto.add,random=WaterCore.seededRandom(713);
        window.restoreStoneFixture=()=>{proto.add=add;delete window.restoreStoneFixture;};
        proto.add=function(u,v){return add.call(this,u,v,random);};
      });
      const beforeStoneAudio=await inspect();
      await page.mouse.click(x,y);state=await inspect();
      assert.equal(state.stones.length,1);assert(state.stones[0].y>1);assert.equal(state.stoneImpacts,0);
      assert.equal(state.stonePlayed,beforeStoneAudio.stonePlayed,'airborne stones must stay silent');
      await page.waitForFunction(()=>{const s=WaterGarden.inspect().stones[0];return s&&s.y<1&&s.y>.05;});
      if(viewport.width===390)await page.screenshot({path:path.join(out,'stone-airborne.png')});
      await page.waitForFunction(()=>WaterGarden.inspect().stoneImpacts===1);state=await inspect();assert(state.energy>.1,'impact must disturb water');
      assert.equal(state.rings,0,'stone waves must come from the water simulation without drawn rings');assert.equal(state.drops,0);
      if(viewport.width===390){
        assert.equal(state.stonePlayed,beforeStoneAudio.stonePlayed+1,'the supplied sample must play once at water entry');
        assert(state.stoneVoices>0);assert.equal(state.tapPlayed,beforeStoneAudio.tapPlayed,'stone impacts must not use the tap recording');
        reports.push({scenario:'stone recording starts automatically at physical water entry and uses its own sample',played:state.stonePlayed,result:'passed'});
        const stoneSwitch=await page.evaluate(()=>{
          document.querySelector('button[data-scene="snow"]').click();const leaving=WaterGarden.inspect();
          document.querySelector('button[data-scene="cloud"]').click();document.querySelector('button[data-scene="water"]').click();
          return {leaving,returning:WaterGarden.inspect()};
        });
        assert(stoneSwitch.leaving.stoneFading>0&&stoneSwitch.leaving.stoneVoices>0);
        assert.equal(stoneSwitch.returning.stonePlayed,state.stonePlayed,'a rapid return must not replay an interrupted impact');
        await page.waitForFunction(()=>WaterGarden.inspect().stoneVoices===0);
        reports.push({scenario:'recorded impact fades on scene exit and rapid three-scene return does not replay it',retained:stoneSwitch.leaving.stoneFading,result:'passed'});
        await page.screenshot({path:path.join(out,'stone-impact.png')});
        await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'stone-ripples.png')});
      }
      await page.waitForFunction(()=>WaterGarden.inspect().stones[0].settled);state=await inspect();
      assert(state.stoneDepth>-.21,'settled stone must update actual water depth');assert.equal(state.stoneImpacts,1);
      await page.mouse.click(x,y);await page.mouse.click(x,y);
      assert.equal((await inspect()).stones.length,3,'repeated positions must accept both settled and airborne stones');
      try{await page.waitForFunction(()=>WaterGarden.inspect().stones.every(s=>s.settled));}
      catch(error){console.error('Unsettled stones',viewport,(await inspect()).stones);throw error;}
      state=await inspect();
      assert(state.stones.every(s=>s.y>-.235&&s.speed<.07),'rigid stones must come to rest above the pool bed');
      assert(state.stones.some(s=>Math.abs(s.u-state.stones[0].u)>.005||Math.abs(s.v-state.stones[0].v)>.005),'collisions must allow rocks to roll aside');
      if(viewport.width===390){
        await page.screenshot({path:path.join(out,'stone-settled.png')});
        await page.setViewportSize({width:844,height:390});await page.waitForFunction(()=>WaterGarden.inspect().width===844);
        assert.equal((await inspect()).stones.length,3);
        await page.waitForFunction(()=>WaterGarden.inspect().stones.every(s=>s.settled));
        await page.setViewportSize(viewport);await page.waitForFunction(()=>WaterGarden.inspect().width===390);
      }
      for(let n=3;n<10;n++)await page.mouse.click(x,y);
      const fullQueue=(await inspect()).stones.map(s=>s.radius);
      assert.equal(fullQueue.length,10);
      await page.mouse.click(x,y);state=await inspect();
      assert.equal(state.stones.length,10,'capacity must recycle the oldest stone');
      assert.deepEqual(state.stones.slice(0,9).map(s=>s.radius),fullQueue.slice(1),'replacement must preserve insertion order');
      assert(state.stones[9].y>1,'the next click must still launch a new stone');
      await page.evaluate(()=>restoreStoneFixture());
      assert(!(await page.locator('#notice').textContent()).includes('石头已经够多了'));
      if(viewport.width===390)await page.screenshot({path:path.join(out,'stone-capacity.png')});
      await page.locator('#reset').click();assert.equal((await inspect()).stones.length,0);
      assert.equal((await inspect()).stoneVoices,0,'reset releases all stone voices');
      await page.mouse.click(x,y);await page.locator('#reset').click();await page.waitForTimeout(1100);assert.equal((await inspect()).stoneImpacts,0);
      await page.locator('#reset').click();await page.locator('[data-mode="touch"]').click();
      reports.push({viewport, readyAndSettleMs, result:'passed', state: await inspect()});
      await context.close();
    }
    // Older WebGL devices may lack derivative support and fragment highp.
    const edgeContext = await browser.newContext({viewport:{width:796,height:922}}), edgePage = await edgeContext.newPage();
    edgePage.on('pageerror', e => errors.push(e.message));
    edgePage.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await edgePage.addInitScript(() => {
      const proto = WebGLRenderingContext.prototype, extension = proto.getExtension, precision = proto.getShaderPrecisionFormat;
      proto.getExtension = function(name) { return name === 'OES_standard_derivatives' ? null : extension.call(this,name); };
      proto.getShaderPrecisionFormat = function(shader,type) { return shader === this.FRAGMENT_SHADER && type === this.HIGH_FLOAT ? {precision:0} : precision.call(this,shader,type); };
    });
    await edgePage.goto(url); await edgePage.waitForFunction(() => window.WaterGarden && WaterGarden.inspect().steps > 5);
    assert.equal(await edgePage.evaluate(() => WaterGarden.inspect().renderer),'webgl');
    await edgePage.mouse.click(380,440); assert(await edgePage.evaluate(() => WaterGarden.inspect().energy > .001));
    await edgePage.screenshot({path:path.join(out,'shoreline-compatibility.png')});
    reports.push({scenario:'shoreline without derivatives or fragment highp',result:'passed'}); await edgeContext.close();
    // Missing WebGL must explain unavailability and stop the game, never paint a 2D substitute.
    const fallbackContext=await browser.newContext({viewport:{width:390,height:844}}),fallbackPage=await fallbackContext.newPage();fallbackPage.on('pageerror',e=>errors.push(e.message));
    await fallbackPage.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type){return type==='webgl'?null:original.apply(this,arguments);};});
    await fallbackPage.goto(url);await fallbackPage.waitForFunction(()=>window.WaterGarden&&WaterGarden.inspect().ready);
    assert.equal(await fallbackPage.evaluate(()=>WaterGarden.inspect().renderer),'unavailable');assert(await fallbackPage.locator('#render-status').isVisible());
    await fallbackPage.waitForTimeout(200);assert.equal(await fallbackPage.evaluate(()=>WaterGarden.inspect().steps),0);
    await fallbackPage.screenshot({path:path.join(out,'3d-unavailable.png')});reports.push({scenario:'missing WebGL explicit unavailable state',result:'passed'});await fallbackContext.close();
    for(const gesture of ['keyboard','rain toolbar','legacy mouse','audio unavailable']){
      const activationContext=await browser.newContext({viewport:{width:390,height:844}}),activationPage=await activationContext.newPage();
      activationPage.on('pageerror',e=>errors.push(e.message));
      if(gesture==='legacy mouse')await activationPage.addInitScript(()=>{window.PointerEvent=undefined;});
      if(gesture==='audio unavailable')await activationPage.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});
      await activationPage.goto(url);await activationPage.waitForFunction(()=>window.WaterGarden&&WaterGarden.inspect().steps>5);
      assert.equal(await activationPage.locator('#sound').count(),0);
      assert.equal(await activationPage.evaluate(()=>WaterGarden.inspect().audioState),'uninitialized');
      if(gesture==='keyboard'){await activationPage.locator('#water').focus();await activationPage.keyboard.press('Enter');}
      else if(gesture==='rain toolbar')await activationPage.locator('#rain').click();
      else await activationPage.mouse.click(195,410);
      if(gesture==='audio unavailable'){
        assert(await activationPage.evaluate(()=>WaterGarden.inspect().energy>.001));assert((await activationPage.locator('#notice').textContent()).includes('无法播放声音'));
      }else{
        await activationPage.waitForFunction(()=>WaterGarden.inspect().audioState==='running');
        if(gesture==='rain toolbar')assert(await activationPage.evaluate(()=>WaterGarden.inspect().rainAudio&&WaterGarden.inspect().rainLevel===1));
        else await activationPage.waitForFunction(()=>WaterGarden.inspect().tapPlayed===1);
      }
      reports.push({scenario:'automatic sound activation: '+gesture,result:'passed'});await activationContext.close();
    }
    // A file URL needs no HTTP server, network permission, module loader or external asset.
    const offlineContext = await browser.newContext({viewport:{width:390,height:844}}), offlinePage = await offlineContext.newPage();
    let networkRequests = 0; offlinePage.on('request',request => { if (/^https?:/.test(request.url())) networkRequests++; });
    offlinePage.on('pageerror', e => errors.push(e.message));
    await offlinePage.goto(pathToFileURL(path.join(root, 'src/index.html')).href); await offlinePage.waitForFunction(() => window.WaterGarden && window.WaterGarden.inspect().steps > 5);
    await offlinePage.waitForFunction(() => WaterGarden.inspect().waterMaps === 2);
    await offlinePage.mouse.click(195,410); assert(await offlinePage.evaluate(() => WaterGarden.inspect().energy > .001)); assert.equal(networkRequests,0);
    await offlinePage.waitForFunction(()=>WaterGarden.inspect().tapReady&&WaterGarden.inspect().strokeReady&&WaterGarden.inspect().tapPlayed===1);
    assert.equal(await offlinePage.locator('#sound').count(),0);
    await offlinePage.mouse.move(120,410);await offlinePage.mouse.down();await offlinePage.mouse.move(270,410,{steps:12});
    assert(await offlinePage.evaluate(()=>WaterGarden.inspect().strokeAudio));await offlinePage.mouse.up();
    await offlinePage.locator('#reset').click();assert.equal(await offlinePage.evaluate(()=>WaterGarden.inspect().tapVoices),0);
    await offlinePage.locator('#rain').click();await offlinePage.locator('[data-rain="4"]').click();
    await offlinePage.waitForFunction(()=>WaterGarden.inspect().thunderPlayed>0);assert.equal(networkRequests,0);
    await offlinePage.locator('#reset').click();await offlinePage.locator('[data-mode="stone"]').click();
    await offlinePage.waitForFunction(()=>WaterGarden.inspect().stoneReady);await offlinePage.mouse.click(195,410);
    assert.equal(await offlinePage.evaluate(()=>WaterGarden.inspect().stonePlayed),0);
    await offlinePage.waitForFunction(()=>WaterGarden.inspect().stoneImpacts===1);
    assert.equal(await offlinePage.evaluate(()=>WaterGarden.inspect().stonePlayed),1);assert.equal(networkRequests,0);
    await offlinePage.waitForFunction(()=>WaterGarden.inspect().rippleAudio&&WaterGarden.inspect().rippleLevel>.01);assert.equal(networkRequests,0);
    await offlinePage.locator('#reset').click();assert.equal(await offlinePage.evaluate(()=>WaterGarden.inspect().stoneVoices),0);
    reports.push({scenario:'file URL offline', networkRequests, result:'passed'}); await offlineContext.close();
    const reducedContext = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}), reducedPage = await reducedContext.newPage();
    reducedPage.on('pageerror',e => errors.push(e.message));
    await reducedPage.goto(url); await reducedPage.waitForFunction(() => window.WaterGarden && WaterGarden.inspect().steps > 5);
    await reducedPage.mouse.move(120,410); await reducedPage.mouse.down(); await reducedPage.mouse.move(270,410,{steps:15}); await reducedPage.mouse.up();
    assert.equal(await reducedPage.evaluate(() => WaterGarden.inspect().drops),0);
    assert(await reducedPage.evaluate(() => WaterGarden.inspect().energy > .01));
    await reducedPage.locator('#rain').click();await reducedPage.locator('[data-rain="4"]').click();await reducedPage.waitForTimeout(300);
    assert(await reducedPage.evaluate(()=>WaterGarden.inspect().rainStreaks>0&&WaterGarden.inspect().rainStreaks<=378));
    reports.push({scenario:'reduced motion swipes and rain',result:'passed'}); await reducedContext.close();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({browser:await browser.version(),date:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}),errors,reports},null,2)+'\n');
    console.log('Browser checks passed: four viewports, rain transitions, recorded audio, falling stones, lifecycle, context recovery, unavailable state and offline file URL.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => {console.error(error);process.exitCode=1;});
