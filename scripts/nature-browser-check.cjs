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
      const depth = s.snow.depth; await page.waitForTimeout(150); assert.equal((await state()).snow.depth,depth);
      await page.locator('[data-nature="1"]').click(); await page.mouse.move(x-viewport.width*.2,y+viewport.height*.1); await page.mouse.down(); await page.mouse.move(x+viewport.width*.2,y+viewport.height*.14,{steps:15}); await page.mouse.up(); assert((await state()).snow.footprints >= 3);
      await page.locator('[data-nature="2"]').click(); await page.mouse.move(x,y-65); await page.mouse.down(); const radius = (await state()).snow.balls[0].radius;
      await page.mouse.move(x+80,y-35,{steps:12}); await page.mouse.up(); s = await state(); assert(s.snow.balls[0].radius > radius);
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
      await select('cloud'); await select('snow'); assert.deepEqual((await state()).snow,saved,'scene switching preserves snow');
      await page.locator('#rain').click(); await page.waitForTimeout(250); assert((await state()).snow.depth < saved.depth);
      await page.locator('#reset').click(); assert.equal((await state()).snow.markedCells,0); assert.equal((await state()).snow.balls.length,0); assert.equal((await state()).weather,false);
      await select('cloud'); await page.locator('#reset').click();
      const opacity = (await state()).cloud.opacity;
      await page.mouse.move(x,y); await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.move(x+70,y,{steps:15}); await page.mouse.up();
      s = await state(); assert(s.cloud.opacity < opacity - .5); assert(s.cloud.motion > 0);
      assert(s.cloudCarve>10,'parting must deform the actual cloud surface');
      if (viewport.width === 390 || viewport.width === 1440) await page.screenshot({path:path.join(out,viewport.width===390?'cloud-mobile.png':'cloud-desktop.png')});
      await page.locator('[data-nature="1"]').click(); await page.mouse.move(x,y); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up(); assert((await state()).cloud.motion > .02);
      await page.locator('[data-nature="2"]').click(); await page.mouse.move(x-60,y); await page.mouse.down(); await page.mouse.move(x+90,y-30,{steps:12}); await page.mouse.up(); assert((await state()).cloud.motion > .1);
      await page.locator('#rain').click(); assert.equal((await state()).weather,true);
      await page.locator('#light').click(); assert.equal(await page.evaluate(() => WaterGarden.inspect().light),1);
      await page.waitForFunction(() => NatureGarden.inspect().renderLight === 1);
      if (viewport.width===390) await page.screenshot({path:path.join(out,'cloud-sunset.png')});
      await page.locator('#light').click();
      await page.waitForFunction(() => NatureGarden.inspect().renderLight === 2);
      if (viewport.width===390) { await select('snow'); await page.screenshot({path:path.join(out,'snow-moon.png')}); await select('cloud'); }
      await page.locator('#sound').click(); assert.equal(await page.evaluate(() => WaterGarden.inspect().muted),false); await page.locator('#sound').click();
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
          snow.balls.length=0;for(let i=0;i<12;i++)snow.balls.push({u:.15+(i%4)*.23,v:.35+Math.floor(i/4)*.15,radius:.025,rotation:[0,0,0,1]});
          for(const low of [false,true]){
            const size=WaterCore.bufferSize(390,844,devicePixelRatio,low);surface.resize(size.width,size.height,low);surface.draw('snow',0,snow,clouds,0,true,false);
            const ball=snow.balls[5],position=surface.ballPosition(ball),screen=surface.camera.project(position),picked=surface.point(screen.u,screen.v,'snow',clouds,true);
            budgets.push({low,snow:surface.count/3,calls:surface.drawCalls,picked:!!picked&&picked.ball===ball,depth:surface.gl.isEnabled(surface.gl.DEPTH_TEST),pixels:surface.canvas.width*surface.canvas.height});
            surface.draw('cloud',0,snow,clouds,0,false,false);budgets[budgets.length-1].cloud=surface.count/3;
          }
          snow.balls=saved;surface.resize(width,height,quality);surface.draw('cloud',0,snow,clouds,0,false,false);
          return {closed,budgets};
        });
        assert(geometry.closed,'cloud volume has two incident triangles at every edge');
        for(const b of geometry.budgets){assert(b.picked&&b.depth,'visible sphere is picked in the depth-tested world');assert(b.snow<=(b.low?50000:100000)&&b.cloud<=(b.low?50000:100000));assert(b.calls<=(b.low?50:100));assert(b.pixels<=(b.low?1000000:2000000));}
        reports.push({scenario:'closed 3D cloud volume, 12 sphere meshes, ray picking, depth and both GPU budgets',result:'passed',geometry});
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:130,y:390,id:1},{x:260,y:460,id:2}]}); assert.equal((await state()).activePointers,2);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}); assert.equal((await state()).activePointers,0); await cdp.detach();
        await select('snow'); await page.locator('[data-nature="0"]').click(); await page.touchscreen.tap(x,y); const snow = (await state()).snow;
        await page.setViewportSize({width:844,height:390}); await page.waitForFunction(()=>WaterGarden.inspect().width===844); assert.deepEqual((await state()).snow,snow);
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
        await page.waitForFunction(()=>NatureGarden.inspect().triangles<=50000);
        await select('snow');await page.locator('[data-nature="0"]').click();const before=(await state()).snow.markedCells;await page.touchscreen.tap(240,530);assert((await state()).snow.markedCells>before);await select('cloud');
      }
      await page.locator('#reset').click(); assert.equal((await state()).weather,false); assert.equal((await state()).cloud.count,72);
      await select('water'); await page.mouse.click(x,y); assert(await page.evaluate(()=>WaterGarden.inspect().energy>0));
      reports.push({viewport,result:'passed'}); await context.close();
    }
    // Offline touch/reduced-motion remains real WebGL; separately test unavailable hardware.
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',hasTouch:true});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));let requests=0;
    page.on('request',r=>{if(/^https?:/.test(r.url()))requests++;});
    await page.addInitScript(()=>{window.PointerEvent=undefined;});
    await page.goto(pathToFileURL(path.join(root,'src/index.html')).href);await page.waitForFunction(()=>window.NatureGarden);
    await page.locator('button[data-scene="snow"]').click(); await page.touchscreen.tap(195,410);assert(await page.evaluate(()=>NatureGarden.inspect().snow.markedCells>0));
    assert.equal(await page.evaluate(()=>NatureGarden.inspect().renderer),'webgl');
    await page.locator('button[data-scene="cloud"]').click();await page.touchscreen.tap(195,410);assert(await page.evaluate(()=>NatureGarden.inspect().cloud.opacity<72));
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
    console.log('Nature browser checks passed: snow, footprints, rolling balls, cloud part/gather/wind, persistence, resize, audio, light, weather, reset, touch cancel, lifecycle, actual 3D geometry, offline WebGL and unsupported hardware.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);server.close();process.exitCode=1;});
