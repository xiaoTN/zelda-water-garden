const fs = require('fs'), path = require('path'), assert = require('assert/strict'), { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs/evidence-v' + require('../package.json').version);
let playwright; try { playwright = require('playwright'); } catch { playwright = require(path.join(process.env.CODEX_NODE_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'), 'playwright')); }
const server = require('./serve.cjs')();
async function run() {
  fs.mkdirSync(out, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await playwright.chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const reports = [], errors = [];
  try {
    for (const viewport of [{ width:390,height:844 },{ width:1440,height:960 },{ width:320,height:568 },{ width:844,height:390 }]) {
      const context = await browser.newContext({ viewport, hasTouch: true, deviceScaleFactor: 2 });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto('http://127.0.0.1:' + server.address().port); await page.waitForFunction(() => window.WaterGarden && WaterGarden.inspect().steps > 5);
      await page.evaluate(()=>{const original=NatureSurface.prototype.draw;NatureSurface.prototype.draw=function(){window.testSurface3D=this;return original.apply(this,arguments);};});
      const state = () => page.evaluate(() => NatureGarden.inspect());
      const select = async kind => { await page.locator('button[data-scene="' + kind + '"]').click(); await page.waitForFunction(kind => NatureGarden.inspect().scene === kind && WaterGarden.inspect().sceneTransition.phase === 'idle', kind); };
      // These geometry fixtures need stationary spheres; fling behavior has its own browser check.
      const releaseStationary = async () => { await page.waitForTimeout(140); await page.mouse.up(); };
      assert.equal(await page.locator('#view-3d').count(),0,'the camera toggle is removed from the page');
      const copyChecks = [];
      const checkCopy = async kind => {
        const copy = await page.evaluate(() => ({title:document.title, heading:document.querySelector('h1').innerText, label:document.getElementById('garden').getAttribute('aria-label'), subtitle:document.getElementById('scene-subtitle').textContent, visible:document.body.innerText}));
        assert(!/海拉鲁|塞尔达|hyrule|zelda/i.test(Object.values(copy).join('\n')), 'visible and accessible scene copy must use nature language');
        assert.equal(copy.label,copy.title,'scene title and accessible name stay in sync');
        copyChecks.push({scene:kind,title:copy.title,subtitle:copy.subtitle});
      };
      await checkCopy('water');
      const x = viewport.width * .48, y = viewport.height * .49;
      await select('snow'); assert.equal((await state()).scene, 'snow');
      await checkCopy('snow');
      await page.waitForFunction(()=>window.testSurface3D && testSurface3D.snowMaps===2);
      assert.equal((await state()).renderer,'webgl','the reference surface must compile and render, not silently fall back');
      assert((await state()).triangles<=100000 && (await state()).triangles>50000);
      assert.equal((await state()).camera,'perspective');
      assert.equal(await page.evaluate(()=>document.getElementById('nature').getContext('2d')),null,'main scene is a WebGL context, never a composited 2D canvas');
      assert(await page.locator('#nature').isVisible()); assert.equal(await page.locator('#water').isVisible(), false);
      for (const selector of ['button[data-scene="snow"]','[data-nature="0"]','[data-nature="1"]','[data-nature="2"]','#reset']) {
        const b = await page.locator(selector).boundingBox(); assert(b.x >= 0 && b.x + b.width <= viewport.width && b.y >= 0 && b.y + b.height <= viewport.height, selector + ' must fit viewport'); assert(b.width >= 44 && b.height >= 44);
      }
      const steps = await page.evaluate(() => WaterGarden.inspect().steps);
      await page.waitForFunction(()=>WaterGarden.inspect().rollReady);
      await page.mouse.move(x - viewport.width * .2,y); await page.mouse.down();await page.waitForTimeout(150);
      assert.equal(await page.evaluate(()=>WaterGarden.inspect().rollAudio),false,'stationary pressure on snow stays silent');
      await page.mouse.move(x + viewport.width * .2,y + 20,{steps:20});assert(await page.evaluate(()=>WaterGarden.inspect().rollAudio&&WaterGarden.inspect().rollSpeed>0),'snow swipes use the recorded motion sound');
      await page.waitForTimeout(160);assert.equal(await page.evaluate(()=>WaterGarden.inspect().rollSpeed),0,'stopping movement fades the sound even while holding');
      await page.waitForFunction(()=>!WaterGarden.inspect().rollAudio);await page.mouse.up();
      let s = await state(); assert(s.snow.markedCells > 100); assert.equal(s.activePointers,0); assert(s.bufferWidth*s.bufferHeight <= 2000000);
      assert.equal(await page.evaluate(() => WaterGarden.inspect().steps), steps, 'inactive water simulation pauses');
      const depth = s.snow.depth; await page.waitForTimeout(150); assert((await state()).snow.depth<depth);
      await page.locator('[data-nature="1"]').click(); await page.mouse.move(x-viewport.width*.2,y+viewport.height*.1); await page.mouse.down(); await page.mouse.move(x+viewport.width*.2,y+viewport.height*.14,{steps:15}); await page.mouse.up(); assert((await state()).snow.footprints >= 3);
      const ballButton=page.locator('[data-nature="2"]');
      assert.equal(await ballButton.innerText(),'滚雪球');
      await ballButton.click();assert.equal((await state()).snow.balls.length,0,'selecting rolling mode never places a ball');
      assert.equal((await state()).mode,2);assert.equal(await ballButton.getAttribute('aria-pressed'),'true');
      await page.touchscreen.tap(x,y);assert.equal((await state()).snow.balls.length,0,'ground taps never create balls');
      await page.mouse.move(x-viewport.width*.14,y-viewport.height*.10);await page.mouse.down();
      assert.equal((await state()).snow.balls.length,0,'pointer down waits for travel');
      await page.mouse.move(x+viewport.width*.07,y-viewport.height*.10,{steps:18});await releaseStationary();
      assert.equal((await state()).snow.balls.length,1);assert((await state()).snow.balls[0].radius>0);
      await page.mouse.move(x-viewport.width*.16,y+viewport.height*.12);await page.mouse.down();
      await page.mouse.move(x+viewport.width*.10,y+viewport.height*.12,{steps:18});await releaseStationary();
      assert.equal((await state()).snow.balls.length,2,'a fresh stroke leaves a second ball');
      await ballButton.click();assert.equal((await state()).snow.balls.length,2,'reselecting the mode keeps every ball');
      if(viewport.width===390)await page.screenshot({path:path.join(out,'snow-multiple.png')});
      const ballPoint=await page.evaluate(()=>{const s=testSurface3D,p=s.camera.project(s.ballPosition(s.snow.balls[0]));return {x:p.u*innerWidth,y:p.v*innerHeight};});
      await page.waitForFunction(()=>WaterGarden.inspect().rollReady);
      await page.waitForFunction(()=>!WaterGarden.inspect().rollAudio);
      await page.mouse.move(ballPoint.x,ballPoint.y);await page.mouse.down();const radius=(await state()).snow.balls[0].radius;
      await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>WaterGarden.inspect().rollAudio),false,'holding a stationary snowball stays silent');
      await page.mouse.move(ballPoint.x+60,ballPoint.y+30,{steps:12});
      const rolling=await page.evaluate(()=>WaterGarden.inspect());assert(rolling.rollAudio&&rolling.rollSpeed>0);
      await releaseStationary();s=await state();assert.equal(s.snow.balls.length,2);assert(s.snow.balls[0].radius>radius);
      await page.waitForFunction(()=>!WaterGarden.inspect().rollAudio);
      const paused=await page.evaluate(()=>WaterGarden.inspect().rollPosition);assert(paused>0);
      await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>WaterGarden.inspect().rollPosition),paused,'silence keeps the saved phase');
      if(viewport.width===390){
        const p=await page.evaluate(()=>{const s=testSurface3D,p=s.camera.project(s.ballPosition(s.snow.balls[0]));return {x:p.u*innerWidth,y:p.v*innerHeight};});
        await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x-40,p.y+10,{steps:8});
        const resumed=await page.evaluate(()=>WaterGarden.inspect());assert(resumed.rollAudio&&resumed.rollPosition>=paused&&resumed.rollPosition<paused+1);
        // Switch with a separate touch while the rolling mouse pointer remains held.
        // Moving that captured mouse to the scene button would also drag the sphere under the toolbar.
        const cloudControl=await page.locator('button[data-scene="cloud"]').boundingBox();
        await page.touchscreen.tap(cloudControl.x+cloudControl.width/2,cloudControl.y+cloudControl.height/2);
        assert(await page.evaluate(()=>WaterGarden.inspect().rollFading),'scene exit fades the shared snow recording');
        await page.mouse.up();await page.waitForFunction(()=>!WaterGarden.inspect().rollAudio);await select('snow');
        assert.equal(await page.evaluate(()=>WaterGarden.inspect().rollAudio),false,'returning to snow does not play a stationary ball');
        reports.push({scenario:'snow swipes and rolling share recorded motion audio; stationary holds and release become silent; later rolls resume phase and scene exits fade',paused,resumed:resumed.rollPosition,result:'passed'});
        const pcm=await page.evaluate(async()=>{
          const c=new OfflineAudioContext(1,22050*30,22050);let original;
          const controller=await new Promise((resolve,reject)=>{
            const decode=c.decodeAudioData.bind(c);c.decodeAudioData=(bytes,done)=>decode(bytes,b=>{original=b;done(b);resolve(a);},reject);
            const a=new WaterSound.Rolling(c,c.destination,SnowballRollAsset);
          });
          const b=controller.buffer,source=c.createBufferSource();source.buffer=b;source.loop=true;source.connect(c.destination);source.start();
          const samples=(await c.startRendering()).getChannelData(0),data=b.getChannelData(0),input=original.getChannelData(0);
          function rms(t){let sum=0;for(let i=Math.floor(t*22050);i<Math.floor((t+.05)*22050);i++)sum+=samples[i]*samples[i];return Math.sqrt(sum/1102);}
          const seams=[b.duration,b.duration*2].map(t=>({before:rms(t-.05),after:rms(t)}));
          const overlap=Math.floor(original.sampleRate*.6);
          const f=new OfflineAudioContext(1,8000*4,8000),constant=f.createBuffer(1,8000*10,8000);constant.getChannelData(0).fill(1);let time=0;
          // Keep offline graph connections until rendering; scheduled stops still end each voice.
          const clock={state:'running',get currentTime(){return time;},decodeAudioData(bytes,done){done(constant);},createBuffer:f.createBuffer.bind(f),createGain(){const g=f.createGain();g.disconnect=()=>{};return g;},createBufferSource(){const s=f.createBufferSource(),start=s.start.bind(s),stop=s.stop.bind(s);s.start=(when,offset)=>start(time,offset);s.stop=()=>stop(time);s.disconnect=()=>{};return s;}};
          const a=new WaterSound.Rolling(clock,f.destination,SnowballRollAsset);a.stroke(1.4);time=1;a.release();time=1.7;a.update();const paused=a.position();time=2.5;a.stroke(1.4);const phase=a.position();time=3.4;a.release();
          const fades=(await f.startRendering()).getChannelData(0);
          function level(t){let sum=0;for(let i=Math.round(t*8000);i<Math.round(t*8000)+80;i++)sum+=Math.abs(fades[i]);return sum/80;}
          return {duration:original.duration,loopDuration:b.duration,bytes:SnowballRollAsset.bytes,seam:Math.abs(data[0]-data[data.length-1]),adjacent:Math.abs(input[overlap]-input[overlap-1]),seams,fade:{early:level(.01),settled:level(.8),tail:level(1.2),silent:level(2),resumeStart:level(2.51),resumed:level(3.2),paused,phase}};
        });
        assert(Math.abs(pcm.duration-10)<.02&&Math.abs(pcm.loopDuration-9.4)<.002);assert(Math.abs(pcm.seam-pcm.adjacent)<1e-6);
        assert(pcm.seams.every(s=>s.before>.005&&s.after>.005),'two real loop seams remain audible');
        const f=pcm.fade;assert(f.early<f.settled*.3&&f.tail>0&&f.tail<f.settled*.3&&f.silent===0);assert(f.resumeStart<f.resumed*.3&&f.resumed>.85&&f.phase===f.paused);
        reports.push({scenario:'first ten seconds render across two seamless loop boundaries; real PCM fades to silence and resumes its saved phase',...pcm,result:'passed'});
      }
      const merging=await page.evaluate(()=>{
        // Roll the smaller sphere toward the larger one. A large sphere can bridge
        // a tiny sphere's snow hollow without physically touching it from above.
        const surface=testSurface3D,balls=surface.snow.balls,a=balls[0].radius<=balls[1].radius?balls[0]:balls[1],b=a===balls[0]?balls[1]:balls[0],screen=surface.camera.project(surface.ballPosition(a));
        const pick=surface.point(screen.u,screen.v,'snow',surface.clouds,true),u=b.u-(pick.u-pick.groundU),v=b.v-(pick.v-pick.groundV);
        const wx=(u-.5)*12*surface.aspect,wz=(v-.5)*12,target=surface.camera.project([wx,surface.height(wx,wz,'snow',surface.snow,surface.clouds),wz]);
        return {from:{x:screen.u*innerWidth,y:screen.v*innerHeight},to:{x:target.u*innerWidth,y:target.v*innerHeight},goalU:u,goalV:v,picked:pick.ball===a,volume:a.radius**3+b.radius**3,max:Math.max(a.radius,b.radius)};
      });
      assert(merging.picked,'merge gesture starts on the actual sphere mesh');
      await page.mouse.move(merging.from.x,merging.from.y);await page.mouse.down();
      await page.mouse.move(merging.to.x,merging.to.y,{steps:24});
      // Dragging deforms the snow under the target. Reproject the same world goal
      // against its current height; small balls must not rely on a stale endpoint.
      for(let correction=0;correction<3&&(await state()).snow.balls.length>1;correction++){
        const point=await page.evaluate(({goalU,goalV})=>{const surface=testSurface3D,x=(goalU-.5)*12*surface.aspect,z=(goalV-.5)*12,p=surface.camera.project([x,surface.height(x,z,'snow',surface.snow,surface.clouds),z]);return {x:p.u*innerWidth,y:p.v*innerHeight};},merging);
        await page.mouse.move(point.x,point.y,{steps:3});
      }
      await releaseStationary();s=await state();
      if(s.snow.balls.length!==1)console.log('Merge fixture diagnostic',JSON.stringify(await page.evaluate(goal=>({viewport:[innerWidth,innerHeight],goal,balls:testSurface3D.snow.balls.map(b=>({u:b.u,v:b.v,radius:b.radius,center:testSurface3D.ballPosition(b)}))}),merging)));
      assert.equal(s.snow.balls.length,1,'touching balls merge through actual 3D picking');
      assert(s.snow.balls[0].radius>merging.max&&s.snow.balls[0].radius**3>=merging.volume);
      if(viewport.width===390)await page.screenshot({path:path.join(out,'snow-merged.png')});
      const support=await page.evaluate(()=>{
        const surface=testSurface3D,ball=surface.snow.balls[0],p=surface.ballPosition(ball),r=p[3];
        let penetration=-Infinity,gap=Infinity;
        for(let ring=0;ring<=3;ring++)for(let i=0;i<12;i++){
          const d=r*[0,.45,.8,.97][ring],a=i*Math.PI/6;
          const ground=surface.height(p[0]+Math.cos(a)*d,p[2]+Math.sin(a)*d,'snow',surface.snow,surface.clouds);
          const clearance=p[1]-Math.sqrt(r*r-d*d)-ground;
          penetration=Math.max(penetration,-clearance);gap=Math.min(gap,clearance);
        }
        return {penetration,gap,r};
      });
      assert(support.penetration<=support.r*.026,'sphere rests on the displaced snow without crossing its banks');
      assert(support.gap<=.001,'sphere has terrain contact rather than floating');
      if (viewport.width === 390 || viewport.width === 1440) await page.screenshot({path:path.join(out,viewport.width===390?'snow-mobile.png':'snow-desktop.png')});
      assert((await state()).snow.balls[0].rotation.some((v,i)=>Math.abs(v-[0,0,0,1][i])>.01),'drag rolls a 3D quaternion');
      const saved = (await state()).snow;
      await select('cloud'); await select('snow'); assert.deepEqual((await state()).snow.balls,saved.balls,'scene switching preserves snowballs');assert((await state()).snow.depth>0);
      assert.equal(await page.locator('#rain').isVisible(),false); await page.waitForTimeout(250); assert((await state()).snow.depth < saved.depth);
      if(viewport.width===390)await page.screenshot({path:path.join(out,'snowfall-mobile.png')});
      await page.locator('#reset').click(); assert.equal((await state()).snow.markedCells,0); assert.equal((await state()).snow.balls.length,0); assert.equal((await state()).weather,true);
      await select('cloud');
      await checkCopy('cloud');
      if(viewport.width===390)reports.push({scenario:'poetic nature copy stays free of franchise references across all three scenes',copy:copyChecks,result:'passed'});
      assert.equal(await page.locator('.toolbar').isVisible(),false,'cloud has no mode or reset toolbar');
      assert.equal(await page.locator('#hint').textContent(),'滑动拨开云海');
      assert.equal((await state()).mode,'swipe');
      await page.waitForFunction(()=>testSurface3D.landReady);
      assert.equal(await page.evaluate(()=>testSurface3D.landMesh.count),6,'aerial terrain is a separate plane below the cloud mesh');
      if(viewport.width===390)await page.screenshot({path:path.join(out,'cloud-default.png')});
      const opacity = (await state()).cloud.opacity;
      await page.touchscreen.tap(x,y);assert.equal((await state()).cloudCarve,0,'a cloud tap must not carve');
      await page.mouse.move(x,y); await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.move(x+70,y,{steps:15}); await page.mouse.up();
      s = await state(); assert(s.cloud.opacity <= opacity);
      assert(s.cloudCarve>10,'parting must deform the actual cloud surface');
      assert(await page.evaluate(()=>testSurface3D.clouds.field.depth.every(d=>d>=0)),'actual pointer swipes must not pile clouds around the finger');
      if (viewport.width === 390 || viewport.width === 1440) await page.screenshot({path:path.join(out,viewport.width===390?'cloud-mobile.png':'cloud-desktop.png')});
      const openDepth=(await state()).cloudCarve;
      await page.waitForTimeout(650);
      assert((await state()).cloudCarve<openDepth*.8,'released cloud gaps close quickly');
      assert(await page.evaluate(()=>testSurface3D.clouds.field.renderDepth().every(d=>d>=0)),'cloud recovery stays below the original surface');
      if(viewport.width===390)await page.screenshot({path:path.join(out,'cloud-refilling.png')});
      const stationary=await page.evaluate(({x,y})=>{
        window.cloudGestureCalls=[];const touch=GardenNature.Clouds.prototype.touch;
        GardenNature.Clouds.prototype.touch=function(){cloudGestureCalls.push(arguments[2]);return touch.apply(this,arguments);};
        window.restoreCloudGesture=()=>{GardenNature.Clouds.prototype.touch=touch;};
        const before=NatureGarden.inspect().cloudCarve;
        document.querySelector('[data-nature="1"]').click();document.getElementById('reset').click();
        const surface=document.getElementById('nature');
        surface.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:920,clientX:x,clientY:y}));
        for(let i=0;i<4;i++)surface.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:920,clientX:x,clientY:y}));
        surface.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:920,clientX:x,clientY:y}));
        return {before,after:NatureGarden.inspect().cloudCarve,calls:cloudGestureCalls.length,mode: NatureGarden.inspect().mode};
      },{x,y});
      assert.equal(stationary.before,stationary.after);assert.equal(stationary.calls,0);assert.equal(stationary.mode,'swipe','hidden snow controls cannot activate cloud gathering');
      await page.mouse.move(x,y);await page.mouse.down();await page.waitForTimeout(800);
      assert.equal(await page.evaluate(()=>cloudGestureCalls.length),0,'holding must not keep parting or gathering');
      await page.mouse.move(x+70,y,{steps:15});await page.mouse.up();
      const calls=await page.evaluate(()=>{const calls=cloudGestureCalls.slice();restoreCloudGesture();return calls;});
      assert(calls.length>0&&calls.every(mode=>mode==='part'),'sliding is the only cloud interaction');
      assert.equal((await state()).activePointers,0);
      if(viewport.width===390)reports.push({scenario:'cloud toolbar removed; taps, stationary movement, holds and hidden controls do not interact; swipes alone part the cloud',stationary,swipeCalls:calls.length,result:'passed'});
      assert.equal(await page.locator('[data-nature="2"]').isVisible(),false,'cloud has no wind tool');
      assert.equal(await page.locator('#rain').isVisible(),false); assert.equal((await state()).weather,true);
      await page.locator('#light').click(); assert.equal(await page.evaluate(() => WaterGarden.inspect().light),1);
      await page.waitForFunction(() => NatureGarden.inspect().renderLight === 1);
      if (viewport.width===390) await page.screenshot({path:path.join(out,'cloud-sunset.png')});
      await page.locator('#light').click();
      await page.waitForFunction(() => NatureGarden.inspect().renderLight === 2);
      if (viewport.width===390) { await select('snow'); await page.screenshot({path:path.join(out,'snow-moon.png')}); await select('cloud'); }
      assert.equal(await page.locator('#sound').count(),0);assert(await page.evaluate(()=>WaterGarden.inspect().audioEnabled));
      await page.waitForFunction(()=>WaterGarden.inspect().audioState==='running');
      const keyboardDepth=(await state()).cloudCarve;
      await page.locator('#nature').focus();await page.keyboard.press('Enter');await page.keyboard.press('Space');
      assert.equal((await state()).activePointers,0);assert((await state()).cloudCarve<=keyboardDepth,'cloud keyboard taps cannot create a new gap');
      if (viewport.width===390) {
        const geometry=await page.evaluate(()=>{
          const surface=testSurface3D,snow=surface.snow,clouds=surface.clouds;
          const saved=snow.balls.slice(),width=surface.canvas.width,height=surface.canvas.height,quality=surface.low;
          const first=saved[0];
          // Test actual scene meshes, not a renderer-name diagnostic.
          const make=surface.mesh;let edges;
          surface.mesh=function(v,indices,stride){edges={};for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){let a=indices[i+j],b=indices[i+(j+1)%3];const key=Math.min(a,b)+':'+Math.max(a,b);edges[key]=(edges[key]||0)+1;}return make.call(this,v,indices,stride);};
          surface.grid(12,true);surface.mesh=make;
          const closed=Object.values(edges).every(count=>count===2),budgets=[];
          snow.balls.length=0;for(let i=0;i<12;i++)snow.ball(.18+i%4*.21,.30+Math.floor(i/4)*.20,.008);
          for(const low of [false,true]){
            const size=WaterCore.bufferSize(390,844,devicePixelRatio,low);surface.resize(size.width,size.height,low);surface.draw('snow',0,snow,clouds,0,true,false);
            if(surface.drawCalls!==14||surface.count!==surface.snowMesh.count+surface.ballMesh.count*12)throw new Error('Snow must draw the surface, all twelve sphere meshes and snowfall');
            const picked=snow.balls.every(ball=>{const screen=surface.camera.project(surface.ballPosition(ball)),hit=surface.point(screen.u,screen.v,'snow',clouds,true);return !!hit&&hit.ball===ball;});
            budgets.push({low,cameraEye:surface.camera.eye,snow:surface.count/3,calls:surface.drawCalls,balls:snow.balls.length,flakes:surface.flakeMesh.vertices,picked,depth:surface.gl.isEnabled(surface.gl.DEPTH_TEST),pixels:surface.canvas.width*surface.canvas.height});
            const snowfallCalls=surface.drawCalls;surface.draw('snow',0,snow,clouds,0,true,true);
            budgets[budgets.length-1].reducedHidesFlakes=surface.drawCalls===snowfallCalls-1;
            surface.draw('cloud',0,snow,clouds,0,false,false);budgets[budgets.length-1].cloud=surface.count/3;
          }
          snow.balls=saved;surface.resize(width,height,quality);surface.draw('cloud',0,snow,clouds,0,false,false);
          return {closed,budgets};
        });
        assert(geometry.closed,'cloud volume has two incident triangles at every edge');
        for(const b of geometry.budgets){assert.deepEqual(b.cameraEye,[0,12,6]);assert.equal(b.flakes,b.low?300:720);assert(b.reducedHidesFlakes);assert(b.picked&&b.depth,'visible sphere is picked in the depth-tested world');assert(b.snow<=(b.low?50000:100000)&&b.cloud<=(b.low?50000:100000));assert(b.calls<=(b.low?50:100));assert(b.pixels<=(b.low?1000000:2000000));}
        reports.push({scenario:'closed 3D cloud volume, twelve sphere meshes, ray picking, depth and both GPU budgets',result:'passed',geometry});
        const cdp = await context.newCDPSession(page);
        await select('snow');await page.locator('#reset').click();await ballButton.click();
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:130,y:390,id:1},{x:260,y:540,id:2}]}); assert.equal((await state()).activePointers,2);assert.equal((await state()).snow.balls.length,0);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:90,y:390,id:1},{x:300,y:540,id:2}]});assert.equal((await state()).snow.balls.length,2,'two fingers can roll two fresh spheres');
        await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}); assert.equal((await state()).activePointers,0);assert.equal((await state()).snow.balls.length,2); await cdp.detach();
        reports.push({scenario:'two-finger rolling starts only on travel and cancellation leaves both spheres',result:'passed'});
        await select('snow'); await page.locator('[data-nature="0"]').click(); await page.touchscreen.tap(x,y); const snow = (await state()).snow;
        await page.evaluate(()=>{window.snowBeforeResize=testSurface3D.snow.depth;});
        await page.setViewportSize({width:844,height:390}); await page.waitForFunction(()=>WaterGarden.inspect().width===844);
        assert.deepEqual(await page.evaluate(()=>testSurface3D.camera.eye),[0,12,6],'orientation changes keep the fixed camera');
        assert(await page.evaluate(()=>snowBeforeResize===testSurface3D.snow.depth),'resize preserves the height field while ambient snowfall continues');
        assert((await state()).snow.depth>0&&(await state()).snow.depth<=snow.depth);
        await page.setViewportSize(viewport); await page.waitForFunction(()=>WaterGarden.inspect().width===390);
        await select('cloud');
        await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
        const clock=(await state()).cloud.time; await page.waitForTimeout(120); assert.equal((await state()).cloud.time,clock);
        await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
        await page.waitForTimeout(130); assert((await state()).cloud.time>clock);
        await page.evaluate(()=>{window.natureLost=document.getElementById('nature').getContext('webgl').getExtension('WEBGL_lose_context');natureLost.loseContext();});
        await page.waitForFunction(()=>NatureGarden.inspect().renderer==='unavailable');
        await page.waitForFunction(()=>!document.getElementById('render-status').hidden);
        await page.evaluate(()=>natureLost.restoreContext());await page.waitForFunction(()=>NatureGarden.inspect().renderer==='webgl');
        await page.waitForFunction(()=>testSurface3D.snowMaps===2);
        await page.waitForFunction(()=>testSurface3D.landReady);
        await page.waitForFunction(()=>NatureGarden.inspect().triangles<=50000);
        assert.deepEqual(await page.evaluate(()=>testSurface3D.camera.eye),[0,12,6],'WebGL recovery keeps the fixed camera');
        await select('snow');await page.locator('[data-nature="0"]').click();const before=(await state()).snow.markedCells;await page.touchscreen.tap(240,530);assert((await state()).snow.markedCells>before);await select('cloud');
      }
      assert.equal(await page.locator('.toolbar').isVisible(),false);assert.equal((await state()).weather,true);assert.equal((await state()).cloud.count,72);
      await select('snow');assert(await page.locator('.toolbar').isVisible());assert.equal(await page.locator('[data-nature="0"] span').textContent(),'划雪');
      await page.locator('#reset').click();
      await select('water'); await page.mouse.click(x,y); assert(await page.evaluate(()=>WaterGarden.inspect().energy>0));
      reports.push({viewport,result:'passed'}); await context.close();
    }
    // Offline touch/reduced-motion remains real WebGL; separately test unavailable hardware.
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',hasTouch:true});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));let requests=0;
    page.on('request',r=>{if(/^https?:/.test(r.url()))requests++;});
    await page.addInitScript(()=>{window.PointerEvent=undefined;});
    await page.goto(pathToFileURL(path.join(root,'src/index.html')).href);await page.waitForFunction(()=>window.NatureGarden);
    await page.evaluate(()=>{const draw=NatureSurface.prototype.draw;NatureSurface.prototype.draw=function(){window.offlineSurface=this;return draw.apply(this,arguments);};});
    await page.locator('button[data-scene="snow"]').click(); await page.waitForFunction(()=>WaterGarden.inspect().sceneTransition.phase==='idle'); await page.touchscreen.tap(195,410);assert(await page.evaluate(()=>NatureGarden.inspect().snow.markedCells>0));
    await page.waitForFunction(()=>window.offlineSurface && offlineSurface.snowMaps===2);
    await page.waitForFunction(()=>offlineSurface.landReady);
    assert.equal(await page.evaluate(()=>NatureGarden.inspect().renderer),'webgl');
    await page.waitForFunction(()=>WaterGarden.inspect().rollReady);
    const snowTouch=await context.newCDPSession(page);
    await snowTouch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:145,y:410,id:1}]});
    await snowTouch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:205,y:430,id:1}]});
    assert(await page.evaluate(()=>WaterGarden.inspect().rollAudio&&WaterGarden.inspect().rollSpeed>0),'offline touch fallback plays the snow recording');
    await snowTouch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await snowTouch.detach();
    await page.waitForFunction(()=>!WaterGarden.inspect().rollAudio);
    await page.locator('button[data-scene="cloud"]').click();await page.waitForFunction(()=>WaterGarden.inspect().sceneTransition.phase==='idle');await page.touchscreen.tap(195,410);assert.equal(await page.evaluate(()=>NatureGarden.inspect().cloudCarve),0);
    assert.equal(await page.locator('.toolbar').isVisible(),false);
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:145,y:410,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y:410,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:245,y:410,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    assert(await page.evaluate(()=>NatureGarden.inspect().cloudCarve>0));
    await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>NatureGarden.inspect().cloud.time),0);assert.equal(requests,0);
    reports.push({scenario:'offline WebGL, touch fallback, reduced motion',result:'passed',networkRequests:requests});await context.close();
    const unavailable=await browser.newContext({viewport:{width:390,height:844}}),unsupported=await unavailable.newPage();
    unsupported.on('pageerror',e=>errors.push(e.message));
    await unsupported.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type){return type==='webgl'?null:original.apply(this,arguments);};});
    await unsupported.goto(pathToFileURL(path.join(root,'src/index.html')).href);await unsupported.waitForFunction(()=>window.NatureGarden);
    for(const kind of ['snow','cloud']){await unsupported.locator('button[data-scene="'+kind+'"]').click();await unsupported.waitForFunction(()=>WaterGarden.inspect().sceneTransition.phase==='idle');assert.equal(await unsupported.evaluate(()=>NatureGarden.inspect().renderer),'unavailable');assert(await unsupported.locator('#render-status').isVisible());}
    assert.equal(await unsupported.evaluate(()=>NatureGarden.inspect().snow.markedCells),0);
    await unavailable.close();reports.push({scenario:'unsupported hardware shows explicit 3D unavailable state',result:'passed'});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'nature-browser-report.json'),JSON.stringify({date:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}),browser:await browser.version(),errors,reports},null,2)+'\n');
    console.log('Nature browser checks passed: snow tools, cloud swipe-only interaction without a toolbar, persistence, resize, audio, light, touch cancel, lifecycle, actual 3D geometry, offline WebGL and unsupported hardware.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);server.close();process.exitCode=1;});
