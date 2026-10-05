const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const out=path.join(__dirname,'../docs/evidence-v'+require('../package.json').version),reports=[],errors=[],server=require('./serve.cjs')();
(async()=>{
  fs.mkdirSync(out,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await playwright.chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  try{
    for(const low of [false,true]){
      const context=await browser.newContext({viewport:low?{width:844,height:390}:{width:390,height:844},hasTouch:true}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(()=>{const raf=requestAnimationFrame;let virtual=0,offset=0;window.requestAnimationFrame=callback=>raf(time=>{if(window.forceSlow){virtual=Math.max(virtual,time)+60;offset=virtual-time;callback(virtual);}else callback(time+offset);});});
      await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.WaterGarden&&WaterGarden.inspect().steps>5);
      if(low){await page.evaluate(()=>window.forceSlow=true);await page.waitForFunction(()=>WaterGarden.inspect().quality==='low');await page.evaluate(()=>window.forceSlow=false);}
      await page.locator('[data-mode="boat"]').click();await page.mouse.click(page.viewportSize().width*.38,page.viewportSize().height*.49);
      let state=await page.evaluate(()=>WaterGarden.inspect());assert.equal(state.boats.length,1);assert.equal(state.boatTriangles,20);assert.equal(state.boats[0].speed,0);
      const placed=state.boats[0];assert(placed.y>-.05);await page.waitForTimeout(1100);await page.screenshot({path:path.join(out,'paper-boat-'+(low?'low':'normal')+'.png')});
      // Catch the actually rendered folded mesh, then flick toward the clear centre.
      const thrown=await page.evaluate(async()=>{
        const c=document.getElementById('water'),b=WaterGarden.inspect().boats[0],x=b.screenU*innerWidth,y=b.screenV*innerHeight;
        function send(type,dx){c.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,buttons:type==='pointerup'?0:1,pointerId:711,clientX:x+dx,clientY:y}));}
        send('pointerdown',0);const grabbed=WaterGarden.inspect().boats[0].held;
        for(const dx of [9,18,27]){await new Promise(resolve=>setTimeout(resolve,20));send('pointermove',dx);}send('pointerup',27);
        return {grabbed,state:WaterGarden.inspect()};
      });
      assert(thrown.grabbed);assert.equal(thrown.state.boats.length,1,'dragging picks the existing paper mesh instead of placing another boat');assert(thrown.state.boats[0].speed>.1);assert.equal(thrown.state.activePointers,0);
      await page.waitForTimeout(120);state=await page.evaluate(()=>WaterGarden.inspect());assert(state.boats[0].u>thrown.state.boats[0].u);assert(state.boats[0].speed<thrown.state.boats[0].speed);assert(state.energy>0);
      // Grab in ordinary water mode too. A pause or cancelled gesture must not re-launch it.
      await page.locator('[data-mode="touch"]').click();
      const grab=await page.evaluate(()=>{const b=WaterGarden.inspect().boats[0],c=document.getElementById('water');c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,buttons:1,pointerId:712,clientX:b.screenU*innerWidth,clientY:b.screenV*innerHeight}));return WaterGarden.inspect();});
      assert(grab.boats[0].held);assert.equal(grab.boats[0].speed,0);
      await page.evaluate(()=>document.getElementById('water').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:712})));assert.equal(await page.evaluate(()=>WaterGarden.inspect().boats[0].held),false);
      await page.locator('.dev-toggle').click();await page.locator('#tuning-boatInertia').fill('0');await page.locator('#tuning-boatInertia').dispatchEvent('input');await page.locator('#tuning-boatInertia').dispatchEvent('change');assert.equal(await page.evaluate(()=>WaterGarden.inspect().tuning.boatInertia),0);
      await page.screenshot({path:path.join(out,'compact-boat-parameters-'+(low?'wide':'portrait')+'.png')});
      const rows=await page.locator('.dev-row').evaluateAll(rows=>rows.map(row=>{const [label,range,number]=Array.from(row.children).map(n=>n.getBoundingClientRect());return {height:row.getBoundingClientRect().height,aligned:Math.abs(label.top+label.height/2-number.top-number.height/2)<2&&Math.abs(range.top+range.height/2-number.top-number.height/2)<2};}));assert(rows.every(row=>row.aligned&&row.height<=30),'every parameter fits on one compact line');
      await page.locator('.dev-toggle').click();
      await page.locator('button[data-scene="snow"]').click();await page.waitForFunction(()=>WaterGarden.inspect().sceneTransition.phase==='idle');assert.equal(await page.evaluate(()=>WaterGarden.inspect().boats[0].speed),0);
      await page.locator('button[data-scene="water"]').click();await page.waitForFunction(()=>WaterGarden.inspect().sceneTransition.phase==='idle');assert.equal(await page.evaluate(()=>WaterGarden.inspect().boats.length),1);
      // Water context loss must retain boats and recover genuine WebGL meshes in low quality.
      await page.evaluate(()=>{window.boatLoss=document.getElementById('water').getContext('webgl').getExtension('WEBGL_lose_context');boatLoss.loseContext();});await page.waitForFunction(()=>WaterGarden.inspect().renderer==='unavailable');
      await page.waitForTimeout(100);await page.evaluate(()=>boatLoss.restoreContext());await page.waitForFunction(()=>WaterGarden.inspect().renderer==='webgl');assert.equal(await page.evaluate(()=>WaterGarden.inspect().boats.length),1);
      await page.locator('#reset').click();assert.equal(await page.evaluate(()=>WaterGarden.inspect().boats.length),0);
      await page.locator('[data-mode="boat"]').click();
      for(const v of [.32,.44,.56,.68])for(const u of [.26,.5,.74])await page.mouse.click(u*page.viewportSize().width,v*page.viewportSize().height);
      // Some nominal grid points meet a real shoreline rock; fill from clear gaps instead.
      for(const [u,v] of [[.38,.38],[.62,.38],[.38,.62],[.62,.62],[.5,.76]]){
        if(await page.evaluate(()=>WaterGarden.inspect().boats.length===12))break;
        await page.mouse.click(u*page.viewportSize().width,v*page.viewportSize().height);
      }
      await page.waitForTimeout(100);const fleet=await page.evaluate(()=>WaterGarden.inspect());assert.equal(fleet.boats.length,12);assert.equal(fleet.boatTriangles,240);
      await page.mouse.click(page.viewportSize().width*.62,page.viewportSize().height*.38);assert.equal(await page.evaluate(()=>WaterGarden.inspect().boats.length),12);
      await page.screenshot({path:path.join(out,'paper-boat-fleet-'+(low?'low':'normal')+'.png')});
      reports.push({quality:low?'low':'normal',placed,releaseSpeed:thrown.state.boats[0].speed,coast:state.boats[0],rows:rows.length,contextRecovery:true});await context.close();
    }
    const page=await browser.newPage({viewport:{width:320,height:568},hasTouch:true});page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(()=>window.PointerEvent=undefined);
    await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.WaterGarden);await page.locator('[data-mode="boat"]').click();
    const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:140,y:285,id:1}]});for(const x of [150,160,170]){await page.waitForTimeout(20);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:285,id:1}]});}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert((await page.evaluate(()=>WaterGarden.inspect().boats[0])).speed>0,'native touch fallback launches paper boats');
    await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.evaluate(()=>WaterGarden.inspect().boats[0].speed),0);await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
    await page.locator('.dev-toggle').click();const overflow=await page.locator('.dev-body').evaluate(n=>n.scrollWidth>n.clientWidth);assert.equal(overflow,false);await page.screenshot({path:path.join(out,'paper-boat-small-screen.png')});
    for(const b of await page.locator('[data-mode]').all()){const box=await b.boundingBox();assert(box.x>=0&&box.x+box.width<=320);}
    await page.reload();await page.waitForFunction(()=>window.WaterGarden);assert.equal(await page.evaluate(()=>WaterGarden.inspect().boats.length),0);await cdp.detach();await page.close();
    assert.deepEqual(errors,[]);reports.push({scenario:'native touch, page exit, compact rows and small-screen toolbar',result:'passed'});
    fs.writeFileSync(path.join(out,'paper-boats-report.json'),JSON.stringify({browser:await browser.version(),errors,reports},null,2)+'\n');console.log('Paper boat checks passed: real mesh picking, drag/fling, water wakes, both tiers, live tuning, compact layout, touch fallback, scene switching and context recovery.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
