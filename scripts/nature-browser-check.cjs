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
      const select = kind => page.locator('button[data-scene="' + kind + '"]').click();
      const x = viewport.width * .48, y = viewport.height * .49;
      await select('snow'); assert.equal((await state()).scene, 'snow');
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
      await page.mouse.move(x - viewport.width * .2,y); await page.mouse.down(); await page.mouse.move(x + viewport.width * .2,y + 20,{steps:20}); await page.mouse.up();
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
      await page.mouse.move(x+viewport.width*.07,y-viewport.height*.10,{steps:18});await page.mouse.up();
      assert.equal((await state()).snow.balls.length,1);assert((await state()).snow.balls[0].radius>0);
      await page.mouse.move(x-viewport.width*.16,y+viewport.height*.12);await page.mouse.down();
      await page.mouse.move(x+viewport.width*.10,y+viewport.height*.12,{steps:18});await page.mouse.up();
      assert.equal((await state()).snow.balls.length,2,'a fresh stroke leaves a second ball');
      await ballButton.click();assert.equal((await state()).snow.balls.length,2,'reselecting the mode keeps every ball');
      if(viewport.width===390)await page.screenshot({path:path.join(out,'snow-multiple.png')});
      const ballPoint=await page.evaluate(()=>{const s=testSurface3D,p=s.camera.project(s.ballPosition(s.snow.balls[0]));return {x:p.u*innerWidth,y:p.v*innerHeight};});
      await page.mouse.move(ballPoint.x,ballPoint.y);await page.mouse.down();const radius=(await state()).snow.balls[0].radius;
      await page.mouse.move(ballPoint.x+60,ballPoint.y+30,{steps:12});await page.mouse.up();s=await state();assert.equal(s.snow.balls.length,2);assert(s.snow.balls[0].radius>radius);
      const merging=await page.evaluate(()=>{
        const surface=testSurface3D,balls=surface.snow.balls,a=balls[0],b=balls[1],screen=surface.camera.project(surface.ballPosition(a));
        const pick=surface.point(screen.u,screen.v,'snow',surface.clouds,true),u=b.u-(pick.u-pick.groundU),v=b.v-(pick.v-pick.groundV);
        const wx=(u-.5)*12*surface.aspect,wz=(v-.5)*12,target=surface.camera.project([wx,surface.height(wx,wz,'snow',surface.snow,surface.clouds),wz]);
        return {from:{x:screen.u*innerWidth,y:screen.v*innerHeight},to:{x:target.u*innerWidth,y:target.v*innerHeight},volume:a.radius**3+b.radius**3,max:Math.max(a.radius,b.radius)};
      });
      await page.mouse.move(merging.from.x,merging.from.y);await page.mouse.down();
      await page.mouse.move(merging.to.x,merging.to.y,{steps:24});await page.mouse.up();s=await state();
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
      await page.locator('#view-3d').click();assert.equal(await page.locator('#view-3d').getAttribute('aria-pressed'),'true');
      assert((await state()).snow.balls[0].rotation.some((v,i)=>Math.abs(v-[0,0,0,1][i])>.01),'drag rolls a 3D quaternion');
      if(viewport.width===390)await page.screenshot({path:path.join(out,'snow-oblique.png')});
      await page.locator('#view-3d').click();
      const saved = (await state()).snow;
      await select('cloud'); await select('snow'); assert.deepEqual((await state()).snow.balls,saved.balls,'scene switching preserves snowballs');assert((await state()).snow.depth>0);
      assert.equal(await page.locator('#rain').isVisible(),false); await page.waitForTimeout(250); assert((await state()).snow.depth < saved.depth);
      if(viewport.width===390)await page.screenshot({path:path.join(out,'snowfall-mobile.png')});
      await page.locator('[data-nature="1"]').click();
      const crushed=[];
      for(const low of [false,true])for(const oblique of [false,true]){
        const target=await page.evaluate(({low,oblique})=>{
          const surface=testSurface3D,snow=surface.snow;snow.clear();
          window.stompUpdate=snow.update;snow.update=function(){};
          window.stompSurface={width:surface.canvas.width,height:surface.canvas.height,low:surface.low,oblique:surface.oblique};
          surface.oblique=oblique;surface.resize(surface.canvas.width,surface.canvas.height,low);
          const radius=.075*Math.min(snow.aspect,1),ball=snow.ball(.5,.52,radius);snow.ball(.82,.72,.02*Math.min(snow.aspect,1));window.stompBall=ball;
          const near=Math.max(radius*.95,Math.min(innerWidth,innerHeight)/innerHeight*.07*1.6);
          window.stompNear=[(ball.u-.5)*12*surface.aspect+near*12,(ball.v-.5)*12];
          window.stompHeight=surface.height(stompNear[0],stompNear[1],'snow',snow,surface.clouds);
          window.stompFar=[[.06,.12],[.93,.18],[.89,.9]].map(([u,v])=>{const x=(u-.5)*12*surface.aspect,z=(v-.5)*12;return {x,z,height:surface.height(x,z,'snow',snow,surface.clouds)};});
          surface.draw('snow',0,snow,surface.clouds,0,true,false);
          const screen=surface.camera.project(surface.ballPosition(ball)),hit=surface.point(screen.u,screen.v,'snow',surface.clouds,true);
          return {x:screen.u*innerWidth,y:screen.v*innerHeight,picked:hit&&hit.ball===ball};
        },{low,oblique});
        assert(target.picked,'the foot targets the visible 3D sphere in both views and quality tiers');
        if(oblique){await page.mouse.move(target.x-60,target.y);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:12});await page.mouse.up();}
        else await page.touchscreen.tap(target.x,target.y);
        const result=await page.evaluate(()=>{
          const surface=testSurface3D,snow=surface.snow;
          surface.draw('snow',0,snow,surface.clouds,0,true,false);
          const empty={size:snow.size,origin:snow.origin,span:snow.span,depth:new Float32Array(snow.depth.length)},profile=[];let crest;
          for(let i=0;i<24;i++){const angle=i*Math.PI/12,d=stompBall.radius*1.9*.6,x=(stompBall.u-.5)*12*surface.aspect+Math.cos(angle)*d*12,z=(stompBall.v-.5)*12+Math.sin(angle)*d*12,height=surface.height(x,z,'snow',snow,surface.clouds),delta=height-surface.height(x,z,'snow',empty,surface.clouds);profile.push(delta);if(!crest||height>crest[1])crest=[x,height,z];}
          const reach=Math.max(stompBall.radius*1.9,Math.min(innerWidth,innerHeight)/innerHeight*.07*3);
          for(let j=-24;j<=24;j++)for(let i=-24;i<=24;i++){const x=(stompBall.u-.5)*12*surface.aspect+i/24*reach*12,z=(stompBall.v-.5)*12+j/24*reach*12,height=surface.height(x,z,'snow',snow,surface.clouds);if(height>crest[1])crest=[x,height,z];}
          const screen=surface.camera.project(crest),hit=surface.point(screen.u,screen.v,'snow',surface.clouds,false),pickError=hit?Math.hypot((hit.u-.5)*12*surface.aspect-crest[0],(hit.v-.5)*12-crest[2]):Infinity;
          let packingError=0,soleCut=0;const heights=snow.renderDepth(),footRadius=Math.min(innerWidth,innerHeight)/innerHeight*.07;
          for(let j=-10;j<=10;j++)for(let i=-10;i<=10;i++)if(i*i+j*j<=100)soleCut=Math.max(soleCut,snow.depth[snow.index(stompBall.u+i/10*footRadius/snow.aspect,stompBall.v+j/10*footRadius)]);
          for(let i=0;i<heights.length;i++){const decoded=(surface.pixels[i*4+1]+surface.pixels[i*4+2]/255)/255*16;packingError=Math.max(packingError,Math.abs(decoded-Math.max(0,-heights[i])));}
          return {balls:snow.balls.length,crushed:stompBall.crushed,footprints:snow.foot,sole:snow.depth[snow.index(stompBall.u,stompBall.v)],soleCut,raised:surface.height(stompNear[0],stompNear[1],'snow',snow,surface.clouds)-stompHeight,stale:snow.roll(stompBall,.6,.5)===null,profileRange:Math.max(...profile)-Math.min(...profile),peak:Math.max(...profile),farDelta:Math.max(...stompFar.map(p=>Math.abs(surface.height(p.x,p.z,'snow',snow,surface.clouds)-p.height))),packingError,pickError};
        });
        assert.equal(result.balls,1,'stepping crushes the target and keeps the other sphere');assert(result.crushed&&result.stale);assert(result.footprints>=1&&result.soleCut>.1,'a sole remains in the broken sphere pile: '+JSON.stringify({viewport,low,oblique,...result}));assert(result.raised>.03,'nearby snow rises in the real world mesh');
        assert(result.peak>.2&&result.profileRange>.1,'local heaps have visible high crests and lower gaps');assert.equal(result.farDelta,0,'distant terrain stays at exactly the same height');assert(result.packingError<.000124,'tall banks reach the GPU texture without clipping or byte wrap');assert(result.pickError<.03,'ray picking follows the local crest: '+JSON.stringify({viewport,low,oblique,...result}));
        crushed.push({low,oblique,...result});
        if(viewport.width===390&&oblique&&!low)await page.screenshot({path:path.join(out,'snow-crushed-footprint.png')});
        await page.evaluate(()=>{const s=testSurface3D;s.snow.update=stompUpdate;s.oblique=stompSurface.oblique;s.resize(stompSurface.width,stompSurface.height,stompSurface.low);});
      }
      reports.push({scenario:'footstep crushes sphere, raises terrain and leaves sole in both views and quality tiers',viewport,result:'passed',crushed});
      await page.locator('#reset').click(); assert.equal((await state()).snow.markedCells,0); assert.equal((await state()).snow.balls.length,0); assert.equal((await state()).weather,true);
      await select('cloud'); await page.locator('#reset').click();
      await page.waitForFunction(()=>testSurface3D.landReady);
      assert.equal(await page.evaluate(()=>testSurface3D.landMesh.count),6,'aerial terrain is a separate plane below the cloud mesh');
      if(viewport.width===390)await page.screenshot({path:path.join(out,'cloud-default.png')});
      const opacity = (await state()).cloud.opacity;
      await page.mouse.move(x,y); await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.move(x+70,y,{steps:15}); await page.mouse.up();
      s = await state(); assert(s.cloud.opacity <= opacity);
      assert(s.cloudCarve>10,'parting must deform the actual cloud surface');
      if (viewport.width === 390 || viewport.width === 1440) await page.screenshot({path:path.join(out,viewport.width===390?'cloud-mobile.png':'cloud-desktop.png')});
      const openDepth=(await state()).cloudCarve;
      await page.waitForTimeout(650);
      assert((await state()).cloudCarve<openDepth*.8,'released cloud gaps close quickly');
      if(viewport.width===390)await page.screenshot({path:path.join(out,'cloud-refilling.png')});
      await page.locator('[data-nature="1"]').click();
      const gatherPoint=await page.evaluate(({x,y})=>testSurface3D.point(x/innerWidth,y/innerHeight,'cloud',testSurface3D.clouds),{x,y});
      await page.mouse.move(x,y); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
      assert(await page.evaluate(p=>{const f=testSurface3D.clouds.field;return f.depth[f.index(p.u,p.v)]<0;},gatherPoint),'gather raises the touched cloud surface');
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
      await page.locator('#nature').focus(); await page.keyboard.press('Enter'); assert.equal((await state()).activePointers,0);
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
            budgets.push({low,snow:surface.count/3,calls:surface.drawCalls,balls:snow.balls.length,flakes:surface.flakeMesh.vertices,picked,depth:surface.gl.isEnabled(surface.gl.DEPTH_TEST),pixels:surface.canvas.width*surface.canvas.height});
            const snowfallCalls=surface.drawCalls;surface.draw('snow',0,snow,clouds,0,true,true);
            budgets[budgets.length-1].reducedHidesFlakes=surface.drawCalls===snowfallCalls-1;
            surface.draw('cloud',0,snow,clouds,0,false,false);budgets[budgets.length-1].cloud=surface.count/3;
          }
          snow.balls=saved;surface.resize(width,height,quality);surface.draw('cloud',0,snow,clouds,0,false,false);
          return {closed,budgets};
        });
        assert(geometry.closed,'cloud volume has two incident triangles at every edge');
        for(const b of geometry.budgets){assert.equal(b.flakes,b.low?300:720);assert(b.reducedHidesFlakes);assert(b.picked&&b.depth,'visible sphere is picked in the depth-tested world');assert(b.snow<=(b.low?50000:100000)&&b.cloud<=(b.low?50000:100000));assert(b.calls<=(b.low?50:100));assert(b.pixels<=(b.low?1000000:2000000));}
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
        await select('snow');await page.locator('[data-nature="0"]').click();const before=(await state()).snow.markedCells;await page.touchscreen.tap(240,530);assert((await state()).snow.markedCells>before);await select('cloud');
      }
      await page.locator('#reset').click(); assert.equal((await state()).weather,true); assert.equal((await state()).cloud.count,72);
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
    await page.locator('button[data-scene="snow"]').click(); await page.touchscreen.tap(195,410);assert(await page.evaluate(()=>NatureGarden.inspect().snow.markedCells>0));
    await page.waitForFunction(()=>window.offlineSurface && offlineSurface.snowMaps===2);
    await page.waitForFunction(()=>offlineSurface.landReady);
    assert.equal(await page.evaluate(()=>NatureGarden.inspect().renderer),'webgl');
    await page.locator('[data-nature="1"]').click();
    const offlineBall=await page.evaluate(()=>{const s=offlineSurface,b=s.snow.ball(.5,.52,.035),p=s.camera.project(s.ballPosition(b));return {x:p.u*innerWidth,y:p.v*innerHeight};});
    await page.touchscreen.tap(offlineBall.x,offlineBall.y);assert(await page.evaluate(()=>offlineSurface.snow.balls.length===0&&offlineSurface.snow.foot>0&&offlineSurface.snow.inspect().raised>0),'touch fallback can crush and leave snow plus a footprint offline');
    await page.locator('button[data-scene="cloud"]').click();await page.touchscreen.tap(195,410);assert(await page.evaluate(()=>NatureGarden.inspect().cloudCarve>0));
    await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>NatureGarden.inspect().cloud.time),0);assert.equal(requests,0);
    reports.push({scenario:'offline WebGL, touch fallback, reduced motion',result:'passed',networkRequests:requests});await context.close();
    const unavailable=await browser.newContext({viewport:{width:390,height:844}}),unsupported=await unavailable.newPage();
    unsupported.on('pageerror',e=>errors.push(e.message));
    await unsupported.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type){return type==='webgl'?null:original.apply(this,arguments);};});
    await unsupported.goto(pathToFileURL(path.join(root,'src/index.html')).href);await unsupported.waitForFunction(()=>window.NatureGarden);
    for(const kind of ['snow','cloud']){await unsupported.locator('button[data-scene="'+kind+'"]').click();assert.equal(await unsupported.evaluate(()=>NatureGarden.inspect().renderer),'unavailable');assert(await unsupported.locator('#render-status').isVisible());}
    assert.equal(await unsupported.evaluate(()=>NatureGarden.inspect().snow.markedCells),0);
    await unavailable.close();reports.push({scenario:'unsupported hardware shows explicit 3D unavailable state',result:'passed'});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'nature-browser-report.json'),JSON.stringify({date:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}),browser:await browser.version(),errors,reports},null,2)+'\n');
    console.log('Nature browser checks passed: snow, footprints, rolling balls, cloud part/gather, persistence, resize, audio, light, weather, reset, touch cancel, lifecycle, actual 3D geometry, offline WebGL and unsupported hardware.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);server.close();process.exitCode=1;});
