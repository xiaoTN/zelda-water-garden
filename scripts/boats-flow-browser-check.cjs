const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const out=path.join(__dirname,'../docs/evidence-v'+require('../package.json').version),reports=[],errors=[],server=require('./serve.cjs')();
(async()=>{
  fs.mkdirSync(out,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await playwright.chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  try{
    for(const low of [false,true]){
      const context=await browser.newContext({viewport:low?{width:844,height:390}:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();
      page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(()=>{const raf=requestAnimationFrame;let virtual=0,offset=0;window.requestAnimationFrame=callback=>raf(time=>{if(window.forceSlow){virtual=Math.max(virtual,time)+60;offset=virtual-time;callback(virtual);}else callback(time+offset);});});
      await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.WaterGarden&&WaterGarden.inspect().steps>5);
      if(low){await page.evaluate(()=>window.forceSlow=true);await page.waitForFunction(()=>WaterGarden.inspect().quality==='low');await page.evaluate(()=>window.forceSlow=false);}
      // Capture the real wave solver for clearing fixture waves; all driving inputs use the game UI.
      await page.evaluate(()=>{const sample=WaterCore.WaveField.prototype.sample;WaterCore.WaveField.prototype.sample=function(u,v){window.boatFlowField=this;return sample.call(this,u,v);};});
      const setFlow=async value=>{
        if(!await page.locator('#tuning-boatFlow').isVisible())await page.locator('.dev-toggle').click();
        await page.locator('#tuning-boatFlow').fill(String(value));await page.locator('#tuning-boatFlow').dispatchEvent('input');await page.locator('#tuning-boatFlow').dispatchEvent('change');
        await page.locator('.dev-toggle').click();await page.waitForTimeout(100);
      };
      const fixture=async()=>{
        await setFlow(0);await page.locator('#reset').click();await page.locator('[data-mode="boat"]').click();
        await page.mouse.click(page.viewportSize().width*.5,page.viewportSize().height*.49);await page.locator('[data-mode="touch"]').click();
        await page.evaluate(()=>boatFlowField.clear());await setFlow(1);
        return page.evaluate(()=>WaterGarden.inspect().boats[0]);
      };
      const start=await fixture();assert.equal(start.driftSpeed,0,'reduced motion has no ambient drift in a calm fixture');
      await page.mouse.click(page.viewportSize().width*.5,page.viewportSize().height*.43);
      const samples=[];for(let i=0;i<10;i++){await page.waitForTimeout(70);samples.push(await page.evaluate(()=>WaterGarden.inspect().boats[0]));}
      const waveTravel=Math.max(...samples.map(b=>Math.hypot(b.u-start.u,b.v-start.v)));
      assert(waveTravel>.00001,'a nearby real tap ripple pushes a resting boat without a finger-flow impulse');
      assert(samples.some(b=>b.driftSpeed>.0001));assert(samples.every(b=>b.speed===0&&!b.held));
      await page.screenshot({path:path.join(out,'paper-boat-wave-flow-'+(low?'low':'normal')+'.png')});
      const beforeSwipe=await fixture();
      const swiped=await page.evaluate(async()=>{
        const c=document.getElementById('water'),b=WaterGarden.inspect().boats[0],x=b.screenU*innerWidth-20,y=b.screenV*innerHeight-35;
        function send(type,dx){c.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,buttons:type==='pointerup'?0:1,pointerId:881,clientX:x+dx,clientY:y}));}
        send('pointerdown',0);for(const dx of [10,20,30,40]){await new Promise(resolve=>setTimeout(resolve,20));send('pointermove',dx);}send('pointerup',40);
        return WaterGarden.inspect().boats[0];
      });
      assert(!swiped.held&&swiped.speed===0&&swiped.flowX>.001,'nearby finger flow pushes the free boat in the swipe direction');
      await page.waitForTimeout(160);const drift=await page.evaluate(()=>WaterGarden.inspect().boats[0]);assert(drift.u>beforeSwipe.u);
      // Holding the rendered mesh must stop both drift and independent fling immediately.
      const held=await page.evaluate(()=>{const c=document.getElementById('water'),b=WaterGarden.inspect().boats[0];c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,buttons:1,pointerId:882,clientX:b.screenU*innerWidth,clientY:b.screenV*innerHeight}));return WaterGarden.inspect().boats[0];});
      assert(held.held);assert.equal(held.driftSpeed,0);await page.waitForTimeout(180);const still=await page.evaluate(()=>WaterGarden.inspect().boats[0]);assert.equal(still.u,held.u);assert.equal(still.v,held.v);
      await page.evaluate(()=>document.getElementById('water').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:882})));
      await setFlow(0);const disabled=await page.evaluate(()=>WaterGarden.inspect().boats[0]);assert.equal(disabled.driftSpeed,0);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>WaterGarden.inspect().boats[0].u),disabled.u);
      await setFlow(1);await page.waitForTimeout(80);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
      const paused=await page.evaluate(()=>WaterGarden.inspect().boats[0]);assert.equal(paused.speed,0);assert.equal(paused.driftSpeed,0);
      reports.push({quality:low?'low':'normal',waveTravel,wavePeakSpeed:Math.max(...samples.map(b=>b.driftSpeed)),swipeFlowX:swiped.flowX,swipeTravel:drift.u-beforeSwipe.u,heldStationary:true,tuningDisabled:true,pageExitStopped:true});
      await context.close();
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'paper-boat-flow-report.json'),JSON.stringify({browser:await browser.version(),errors,reports},null,2)+'\n');
    console.log('Paper boat flow checks passed: actual ripple and nearby swipe carry free boats in both tiers, mesh grab stops drift, live strength disables flow and page exit stops motion.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
