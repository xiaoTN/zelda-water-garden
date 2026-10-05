const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const out=path.join(__dirname,'../docs/evidence-v'+require('../package.json').version),reports=[],errors=[],server=require('./serve.cjs')();
(async()=>{
  fs.mkdirSync(out,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await playwright.chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  try{
    for(const low of [false,true]){
      const context=await browser.newContext({viewport:low?{width:844,height:390}:{width:390,height:844},hasTouch:true});
      const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(()=>{const raf=requestAnimationFrame;let virtual=0,offset=0;window.requestAnimationFrame=callback=>raf(time=>{if(window.forceSlow){virtual=Math.max(virtual,time)+60;offset=virtual-time;callback(virtual);}else callback(time+offset);});});
      await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.WaterGarden&&WaterGarden.inspect().steps>5);
      assert(await page.locator('#developer-panel').isVisible());assert.equal(await page.locator('.dev-toggle').getAttribute('aria-expanded'),'false');
      await page.locator('.dev-toggle').click();
      await page.locator('#tuning-friction').fill('3');await page.locator('#tuning-friction').dispatchEvent('input');await page.locator('#tuning-friction').dispatchEvent('change');
      assert.equal(await page.evaluate(()=>WaterGarden.inspect().tuning.friction),3);
      await page.locator('.dev-toggle').click();await page.reload();await page.waitForFunction(()=>window.WaterGarden);
      assert.equal(await page.evaluate(()=>WaterGarden.inspect().tuning.friction),3,'local settings survive reload');
      await page.evaluate(()=>{const draw=NatureSurface.prototype.draw;NatureSurface.prototype.draw=function(){window.inertiaSurface=this;return draw.apply(this,arguments);};});
      await page.locator('button[data-scene="snow"]').click();await page.waitForFunction(()=>WaterGarden.inspect().sceneTransition.phase==='idle');
      await page.waitForFunction(()=>WaterGarden.inspect().rollReady&&window.inertiaSurface);
      if(low){await page.evaluate(()=>window.forceSlow=true);await page.waitForFunction(()=>WaterGarden.inspect().quality==='low');await page.evaluate(()=>window.forceSlow=false);await page.waitForTimeout(80);}
      await page.locator('[data-nature="2"]').click();
      // A modest gathering gesture ends with a held pause, so only the next flick launches it.
      await page.evaluate(async()=>{
        const c=document.getElementById('nature'),x=innerWidth*.38,y=innerHeight*.46;
        function send(type,x){c.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,buttons:type==='pointerup'?0:1,pointerId:881,clientX:x,clientY:y}));}
        send('pointerdown',x);for(let i=1;i<=6;i++){await new Promise(resolve=>setTimeout(resolve,25));send('pointermove',x+i*8);}await new Promise(resolve=>setTimeout(resolve,140));send('pointerup',x+48);
      });
      let state=await page.evaluate(()=>NatureGarden.inspect());assert.equal(state.snow.balls.length,1);assert.equal(state.snow.balls[0].speed,0);
      const release=await page.evaluate(async()=>{
        const c=document.getElementById('nature'),b=inertiaSurface.snow.balls[0],p=inertiaSurface.camera.project(inertiaSurface.ballPosition(b)),x=p.u*innerWidth,y=p.v*innerHeight;
        function send(type,dx){c.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,buttons:type==='pointerup'?0:1,pointerId:882,clientX:x+dx,clientY:y}));}
        send('pointerdown',0);for(const dx of [15,30,45]){await new Promise(resolve=>setTimeout(resolve,20));send('pointermove',dx);}send('pointerup',45);
        return {ball:NatureGarden.inspect().snow.balls[0],audio:WaterGarden.inspect().rollAudio,pointers:WaterGarden.inspect().activePointers};
      });
      assert(release.ball.speed>1&&release.audio&&release.pointers===0,'fast release starts sphere inertia with recorded rolling audio');
      await page.waitForFunction(start=>{const b=NatureGarden.inspect().snow.balls[0];return Math.hypot((b.u-start.u)*12*innerWidth/innerHeight,(b.v-start.v)*12)>.12;},release.ball);state=await page.evaluate(()=>NatureGarden.inspect());
      const distance=Math.hypot((state.snow.balls[0].u-release.ball.u)*12*inertiaAspect(page.viewportSize()),(state.snow.balls[0].v-release.ball.v)*12);
      assert(distance>.12);assert(state.snow.balls[0].speed>0&&state.snow.balls[0].speed<release.ball.speed);assert(state.snow.balls[0].radius>=release.ball.radius);assert.notDeepEqual(state.snow.balls[0].rotation,release.ball.rotation);
      assert(await page.evaluate(()=>WaterGarden.inspect().rollAudio&&WaterGarden.inspect().activePointers===0),'sound continues during released rolling');
      const coast=state.snow.balls[0];
      // Grabbing the rendered sphere interrupts its inertia immediately; cancellation never launches it.
      const grab=await page.evaluate(()=>{const b=inertiaSurface.snow.balls[0],before=Math.hypot(b.vx,b.vz),p=inertiaSurface.camera.project(inertiaSurface.ballPosition(b));document.getElementById('nature').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,buttons:1,pointerId:883,clientX:p.u*innerWidth,clientY:p.v*innerHeight}));return Object.assign({beforeSpeed:before},NatureGarden.inspect());});
      assert(grab.beforeSpeed>0,'the sphere is still moving when caught');
      assert.equal(grab.snow.balls[0].speed,0);assert.equal(grab.activePointers,1);
      await page.screenshot({path:path.join(out,'snow-inertia-'+(low?'low':'normal')+'.png')});
      await page.evaluate(()=>document.getElementById('nature').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:883})));
      await page.waitForFunction(()=>!WaterGarden.inspect().rollAudio);
      const stopped=await page.evaluate(()=>NatureGarden.inspect().snow.balls[0]);await page.waitForTimeout(120);assert.deepEqual(await page.evaluate(()=>NatureGarden.inspect().snow.balls[0]),stopped);
      await page.locator('.dev-toggle').click();
      await page.getByRole('button',{name:'查看参数',exact:true}).click();assert(/"inertia"/.test(await page.locator('.dev-json').inputValue()));
      await page.getByRole('button',{name:'恢复默认',exact:true}).click();assert.equal(await page.evaluate(()=>WaterGarden.inspect().tuning.friction),4.6);
      const defaults=await page.evaluate(()=>WaterGarden.inspect().tuning);assert.equal(defaults.boatSize,.6);assert.equal(defaults.throwThreshold,3.8);assert.equal(defaults.growth,.035);
      await page.screenshot({path:path.join(out,'developer-panel-'+(low?'wide':'portrait')+'.png')});
      reports.push({quality:await page.evaluate(()=>WaterGarden.inspect().quality),released:release.ball,coast,distance,grabSpeed:grab.snow.balls[0].speed,persistentPanel:true,defaults});
      await context.close();
    }
    const legacy=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
    legacy.on('pageerror',error=>errors.push(error.message));await legacy.addInitScript(()=>window.PointerEvent=undefined);
    await legacy.goto('http://127.0.0.1:'+server.address().port);await legacy.waitForFunction(()=>window.WaterGarden);
    await legacy.locator('button[data-scene="snow"]').click();await legacy.waitForFunction(()=>WaterGarden.inspect().sceneTransition.phase==='idle');
    await legacy.locator('[data-nature="2"]').click();
    const touch=await legacy.context().newCDPSession(legacy);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:140,y:410,id:1}]});
    for(const x of [160,180,200]){await legacy.waitForTimeout(20);await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:410,id:1}]});}
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const thrown=await legacy.evaluate(()=>NatureGarden.inspect().snow.balls[0]);assert(thrown&&thrown.speed>0,'native touch fallback launches a real sphere');
    await legacy.waitForTimeout(150);assert((await legacy.evaluate(()=>NatureGarden.inspect().snow.balls[0])).u>thrown.u);
    await legacy.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await legacy.evaluate(()=>NatureGarden.inspect().snow.balls[0].speed),0,'leaving the page cancels released motion');
    await touch.detach();await legacy.close();reports.push({scenario:'native touch fallback and page exit',launchSpeed:thrown.speed,result:'passed'});
    const compact=await browser.newPage({viewport:{width:320,height:568}});
    await compact.goto('http://127.0.0.1:'+server.address().port);await compact.waitForFunction(()=>window.WaterGarden);
    for(const safeTop of [0,48]){
      await compact.evaluate(top=>document.getElementById('garden').style.setProperty('--safe-area-inset-top',top+'px'),safeTop);
      const nav=await compact.locator('.scene-switch').boundingBox(),toggle=await compact.locator('.dev-toggle').boundingBox();assert(toggle.y>=nav.y+nav.height,'the local panel does not cover scene selection on compact screens or safe areas');
      await compact.locator('button[data-scene="cloud"]').click();await compact.waitForFunction(()=>WaterGarden.inspect().sceneTransition.phase==='idle');
    }
    await compact.close();reports.push({scenario:'compact panel layout and safe area',result:'passed'});
    // Uploaded/offline tools and bridged containers never show or load the local debug panel.
    for(const bridge of [false,true]){
      const page=await browser.newPage({viewport:{width:390,height:844}});
      if(bridge)await page.addInitScript(()=>window.xhs={miniTool:{}});
      await page.goto(bridge?'http://127.0.0.1:'+server.address().port:pathToFileURL(path.join(__dirname,'../src/index.html')).href);
      await page.waitForFunction(()=>window.WaterGarden);assert(await page.locator('#developer-panel').isHidden());assert.equal(await page.evaluate(()=>WaterGarden.inspect().developer),false);
      await page.close();reports.push({scenario:bridge?'bridged container':'offline file URL',developerPanel:false});
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'snow-inertia-report.json'),JSON.stringify({browser:await browser.version(),errors,reports},null,2)+'\n');
    console.log('Snow inertia checks passed: world picking, release motion, rotation, growth, rolling audio, grab/cancel, both quality tiers, live persistent panel and offline/container exclusion.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
function inertiaAspect(viewport){return viewport.width/viewport.height;}
