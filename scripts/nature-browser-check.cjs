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
      await page.mouse.move(x - viewport.width * .2,y); await page.mouse.down(); await page.mouse.move(x + viewport.width * .2,y + 20,{steps:20}); await page.mouse.up();
      let s = await state(); assert(s.snow.markedCells > 100); assert.equal(s.activePointers,0); assert(s.bufferWidth*s.bufferHeight <= 2000000);
      assert.equal(await page.evaluate(() => WaterGarden.inspect().steps), steps, 'inactive water simulation pauses');
      const depth = s.snow.depth; await page.waitForTimeout(150); assert((await state()).snow.depth<depth);
      await page.locator('[data-nature="1"]').click(); await page.mouse.move(x-viewport.width*.2,y+viewport.height*.1); await page.mouse.down(); await page.mouse.move(x+viewport.width*.2,y+viewport.height*.14,{steps:15}); await page.mouse.up(); assert((await state()).snow.footprints >= 3);
      const ballButton=page.locator('[data-nature="2"]');
      await ballButton.click();assert.equal((await state()).snow.balls.length,1,'button immediately places one ball');
      await ballButton.click();assert.equal((await state()).snow.balls.length,0,'same button removes it');
      assert.equal(await ballButton.getAttribute('aria-pressed'),'false');
      await page.touchscreen.tap(x,y);assert.equal((await state()).snow.balls.length,0,'ground taps never create balls');
      await ballButton.click();assert.equal(await ballButton.getAttribute('aria-pressed'),'true');
      const ballPoint=await page.evaluate(()=>{const s=testSurface3D,p=s.camera.project(s.ballPosition(s.snow.balls[0]));return {x:p.u*innerWidth,y:p.v*innerHeight};});
      await page.mouse.move(ballPoint.x,ballPoint.y);await page.mouse.down();const radius=(await state()).snow.balls[0].radius;
      await page.mouse.move(ballPoint.x+60,ballPoint.y+30,{steps:12});await page.mouse.up();s=await state();assert.equal(s.snow.balls.length,1);assert(s.snow.balls[0].radius>radius);
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
          snow.balls.length=0;snow.ball(.5,.5,.025);
          for(const low of [false,true]){
            const size=WaterCore.bufferSize(390,844,devicePixelRatio,low);surface.resize(size.width,size.height,low);surface.draw('snow',0,snow,clouds,0,true,false);
            if(surface.drawCalls!==3||surface.count!==surface.snowMesh.count+surface.ballMesh.count)throw new Error('Snow must draw only the surface, one snowball and snowfall, without decorative trees');
            const ball=snow.balls[0],position=surface.ballPosition(ball),screen=surface.camera.project(position),picked=surface.point(screen.u,screen.v,'snow',clouds,true);
            budgets.push({low,snow:surface.count/3,calls:surface.drawCalls,flakes:surface.flakeMesh.vertices,picked:!!picked&&picked.ball===ball,depth:surface.gl.isEnabled(surface.gl.DEPTH_TEST),pixels:surface.canvas.width*surface.canvas.height});
            const snowfallCalls=surface.drawCalls;surface.draw('snow',0,snow,clouds,0,true,true);
            budgets[budgets.length-1].reducedHidesFlakes=surface.drawCalls===snowfallCalls-1;
            surface.draw('cloud',0,snow,clouds,0,false,false);budgets[budgets.length-1].cloud=surface.count/3;
          }
          snow.balls=saved;surface.resize(width,height,quality);surface.draw('cloud',0,snow,clouds,0,false,false);
          return {closed,budgets};
        });
        assert(geometry.closed,'cloud volume has two incident triangles at every edge');
        for(const b of geometry.budgets){assert.equal(b.flakes,b.low?300:720);assert(b.reducedHidesFlakes);assert(b.picked&&b.depth,'visible sphere is picked in the depth-tested world');assert(b.snow<=(b.low?50000:100000)&&b.cloud<=(b.low?50000:100000));assert(b.calls<=(b.low?50:100));assert(b.pixels<=(b.low?1000000:2000000));}
        reports.push({scenario:'closed 3D cloud volume, single sphere mesh, ray picking, depth and both GPU budgets',result:'passed',geometry});
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:130,y:390,id:1},{x:260,y:460,id:2}]}); assert.equal((await state()).activePointers,2);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}); assert.equal((await state()).activePointers,0); await cdp.detach();
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
    await page.locator('button[data-scene="snow"]').click(); await page.touchscreen.tap(195,410);assert(await page.evaluate(()=>NatureGarden.inspect().snow.markedCells>0));
    await page.waitForFunction(()=>window.offlineSurface && offlineSurface.snowMaps===2);
    await page.waitForFunction(()=>offlineSurface.landReady);
    assert.equal(await page.evaluate(()=>NatureGarden.inspect().renderer),'webgl');
    await page.locator('button[data-scene="cloud"]').click();await page.touchscreen.tap(195,410);assert.equal(await page.evaluate(()=>NatureGarden.inspect().cloudCarve),0);
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
    for(const kind of ['snow','cloud']){await unsupported.locator('button[data-scene="'+kind+'"]').click();assert.equal(await unsupported.evaluate(()=>NatureGarden.inspect().renderer),'unavailable');assert(await unsupported.locator('#render-status').isVisible());}
    assert.equal(await unsupported.evaluate(()=>NatureGarden.inspect().snow.markedCells),0);
    await unavailable.close();reports.push({scenario:'unsupported hardware shows explicit 3D unavailable state',result:'passed'});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'nature-browser-report.json'),JSON.stringify({date:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}),browser:await browser.version(),errors,reports},null,2)+'\n');
    console.log('Nature browser checks passed: snow tools, cloud swipe-only interaction without a toolbar, persistence, resize, audio, light, touch cancel, lifecycle, actual 3D geometry, offline WebGL and unsupported hardware.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);server.close();process.exitCode=1;});
