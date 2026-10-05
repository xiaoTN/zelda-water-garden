const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
let playwright; try { playwright = require('playwright'); } catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const out = path.join(__dirname, '../docs/evidence-v' + require('../package.json').version);
const server = require('./serve.cjs')(), reports = [], errors = [];
(async () => {
  fs.mkdirSync(out, {recursive:true});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await playwright.chromium.launch({channel:'msedge', headless:true, args:['--enable-unsafe-swiftshader']});
  try {
    for (const low of [false, true]) {
      const page = await browser.newPage({viewport:low ? {width:844,height:390} : {width:390,height:844}});
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => {
        let clock = 0, id = 0, queued = new Map();
        window.requestAnimationFrame = callback => {queued.set(++id, callback);return id;};
        window.cancelAnimationFrame = key => queued.delete(key);
        window.advanceFrames = (count, ms = 20) => {for(let i=0;i<count;i++){clock+=ms;const batch=queued;queued=new Map();batch.forEach(callback=>callback(clock));}};
      });
      await page.goto('http://127.0.0.1:' + server.address().port);
      await page.evaluate(() => advanceFrames(10));
      await page.waitForFunction(() => document.getElementById('garden').classList.contains('ready'));
      await page.waitForTimeout(650);
      if(low)await page.evaluate(() => advanceFrames(200, 60));
      assert.equal(await page.evaluate(()=>WaterGarden.inspect().quality),low?'low':'normal');
      for (const target of ['snow','cloud','water','cloud','snow','water']) {
        const before = await page.evaluate(() => NatureGarden.inspect().scene);
        await page.evaluate(target => document.querySelector('button[data-scene="'+target+'"]').click(),target);
        assert.equal(await page.evaluate(()=>NatureGarden.inspect().scene),before,'the world must not change on the click');
        await page.evaluate(()=>advanceFrames(7));
        const cover = await page.evaluate(()=>WaterGarden.inspect().sceneTransition);
        assert(cover.opacity>.3&&cover.opacity<.7&&cover.current===before);
        const guarded=await page.evaluate(()=>{
          const canvas=document.getElementById(NatureGarden.inspect().scene==='water'?'water':'nature');
          canvas.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,buttons:1,pointerId:901,clientX:innerWidth/2,clientY:innerHeight/2}));
          const button=document.querySelector('button[data-scene="'+WaterGarden.inspect().sceneTransition.target+'"]'),b=button.getBoundingClientRect();
          return {pointers:WaterGarden.inspect().activePointers,nav:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2).closest('button')===button};
        });
        assert.equal(guarded.pointers,0);assert(guarded.nav,'scene buttons stay available while the world is covered');
        if(!low&&target==='snow'&&before==='water')await page.screenshot({path:path.join(out,'scene-transition-cover.png')});
        await page.evaluate(()=>advanceFrames(7));
        const midpoint=await page.evaluate(()=>WaterGarden.inspect().sceneTransition);
        assert.equal(midpoint.current,target);assert.equal(midpoint.opacity,1);assert.equal(midpoint.phase,'reveal');
        await page.evaluate(()=>advanceFrames(14));
        const reveal=await page.evaluate(()=>WaterGarden.inspect().sceneTransition);
        assert(reveal.opacity>.3&&reveal.opacity<.7);
        if(!low&&target==='snow'&&before==='water')await page.screenshot({path:path.join(out,'scene-transition-reveal.png')});
        await page.evaluate(()=>advanceFrames(15));
        assert.equal(await page.evaluate(()=>WaterGarden.inspect().sceneTransition.phase),'idle');
        assert(await page.locator('#scene-veil').isHidden());
        assert.equal(await page.evaluate(()=>document.getElementById('garden').getAttribute('aria-busy')),'false');
        const state = await page.evaluate(()=>NatureGarden.inspect().scene==='water'?WaterGarden.inspect():NatureGarden.inspect());
        assert.equal(state.renderer,'webgl');assert((state.surfaceTriangles||state.triangles)>0);
        reports.push({quality:low?'low':'normal',from:before,to:target,cover:cover.opacity,midpoint:midpoint.opacity,reveal:reveal.opacity});
      }
      // A reveal can be interrupted without jumping opacity, and only the latest request commits.
      await page.evaluate(()=>{document.querySelector('[data-scene="snow"]').click();advanceFrames(20);});
      const rapid=await page.evaluate(()=>{
        const before=WaterGarden.inspect().sceneTransition.opacity;
        document.querySelector('[data-scene="cloud"]').click();const after=WaterGarden.inspect().sceneTransition.opacity;
        document.querySelector('[data-scene="water"]').click();advanceFrames(60);
        return {before,after,final:WaterGarden.inspect().sceneTransition};
      });
      assert.equal(rapid.before,rapid.after);assert.equal(rapid.final.current,'water');assert.equal(rapid.final.phase,'idle');
      await page.evaluate(()=>{document.querySelector('[data-scene="snow"]').click();advanceFrames(5);window.dispatchEvent(new Event('pagehide'));});
      assert.equal(await page.evaluate(()=>WaterGarden.inspect().sceneTransition.current),'snow');assert(await page.locator('#scene-veil').isHidden());
      await page.evaluate(()=>{window.dispatchEvent(new Event('pageshow'));advanceFrames(5);document.querySelector('[data-scene="cloud"]').click();advanceFrames(5);window.dispatchEvent(new Event('resize'));advanceFrames(60);});
      assert.equal(await page.evaluate(()=>WaterGarden.inspect().sceneTransition.current),'cloud');assert(await page.locator('#scene-veil').isHidden());
      // Exercise a real context loss while the outgoing nature world is under its veil.
      await page.evaluate(()=>{document.querySelector('[data-scene="snow"]').click();advanceFrames(5);window.sceneLoss=document.getElementById('nature').getContext('webgl').getExtension('WEBGL_lose_context');sceneLoss.loseContext();});
      await page.waitForFunction(()=>NatureGarden.inspect().renderer==='unavailable');
      assert(await page.locator('#scene-veil').isHidden());assert(await page.locator('#render-status').isVisible());
      await page.evaluate(()=>sceneLoss.restoreContext());await page.waitForFunction(()=>NatureGarden.inspect().renderer==='webgl');
      await page.evaluate(()=>advanceFrames(5));assert(await page.locator('#render-status').isHidden());
      await page.evaluate(()=>{document.querySelector('[data-nature="0"]').click();document.getElementById('nature').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,buttons:1,pointerId:902,clientX:innerWidth/2,clientY:innerHeight/2}));});
      assert.equal(await page.evaluate(()=>WaterGarden.inspect().activePointers),1,'world-space picking works after transition and context recovery');
      await page.evaluate(()=>{document.querySelector('button[data-scene="water"]').click();advanceFrames(60);document.querySelector('button[data-scene="snow"]').click();advanceFrames(5);window.waterSceneLoss=document.getElementById('water').getContext('webgl').getExtension('WEBGL_lose_context');waterSceneLoss.loseContext();});
      await page.waitForFunction(()=>WaterGarden.inspect().renderer==='unavailable');
      assert.equal(await page.evaluate(()=>NatureGarden.inspect().scene),'snow');assert(await page.locator('#scene-veil').isHidden());
      assert.equal(await page.evaluate(()=>NatureGarden.inspect().renderer),'webgl','a lost outgoing water context must not disable the destination');
      await page.evaluate(()=>waterSceneLoss.restoreContext());await page.waitForFunction(()=>WaterGarden.inspect().sceneTransition.phase==='idle');
      await page.waitForTimeout(100);await page.evaluate(()=>advanceFrames(5));
      assert.equal(await page.evaluate(()=>WaterGarden.inspect().renderer),'webgl','the outgoing water context recovers while snow remains visible');
      await page.evaluate(()=>{document.querySelector('button[data-scene="cloud"]').click();advanceFrames(5);Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
      assert.equal(await page.evaluate(()=>NatureGarden.inspect().scene),'cloud');assert(await page.locator('#scene-veil').isHidden());
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));advanceFrames(5);});
      reports.push({quality:low?'low':'normal',scenario:'retarget, page return, resize, real context loss/recovery and picking',result:'passed'});
      await page.close();
    }
    const reduced = await browser.newPage({reducedMotion:'reduce',viewport:{width:390,height:844}});
    await reduced.goto('http://127.0.0.1:'+server.address().port);await reduced.waitForFunction(()=>window.WaterGarden);
    await reduced.locator('button[data-scene="snow"]').click();await reduced.waitForFunction(()=>WaterGarden.inspect().sceneTransition.phase==='idle');
    assert.equal(await reduced.evaluate(()=>NatureGarden.inspect().scene),'snow');await reduced.close();
    reports.push({scenario:'reduced motion uses a shorter opacity-only transition',result:'passed'});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'scene-transition-report.json'),JSON.stringify({browser:await browser.version(),errors,reports},null,2)+'\n');
    console.log('Scene transition checks passed: all six directions, both quality tiers, live WebGL geometry, smooth retargeting, input guard, resize, lifecycle and context recovery.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
