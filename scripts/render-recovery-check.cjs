const assert = require('node:assert/strict');
const path = require('node:path'), fs = require('node:fs');
const out = path.join(__dirname, '../docs/evidence-v' + require('../package.json').version);
fs.mkdirSync(out,{recursive:true});
const reports=[];
let playwright; try { playwright = require('playwright'); } catch { playwright = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const server = require('./serve.cjs')();
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await playwright.chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  try {
    for (const kind of ['snow','cloud','water']) {
      const page = await browser.newPage({viewport:{width:320,height:568}});
      await page.addInitScript(() => {
        let queued = [], clock = 0;
        window.requestAnimationFrame = callback => {queued.push(callback); return queued.length;};
        window.advanceFrames = count => {for(let i=0;i<count;i++){clock+=60;const batch=queued;queued=[];batch.forEach(callback=>callback(clock));}};
      });
      await page.goto('http://127.0.0.1:'+server.address().port);
      const result = await page.evaluate(kind => {
        document.querySelector('[data-scene="'+kind+'"]').click();
        advanceFrames(400);
        const canvas=document.getElementById(kind==='water'?'water':'nature');
        const state=kind==='water'?WaterGarden.inspect():NatureGarden.inspect();
        return {kind,renderer:state.renderer,quality:WaterGarden.inspect().quality,lost:canvas.getContext('webgl').isContextLost(),status:document.getElementById('render-status').textContent,hidden:document.getElementById('render-status').hidden};
      },kind);
      console.log(result);
      assert.equal(result.lost,false);
      assert.equal(result.quality,'low');
      assert.equal(result.renderer,'webgl','slow callback delivery must not permanently disable a working WebGL scene');
      assert.equal(result.hidden,true);
      const continued = await page.evaluate(kind => {
        window.dispatchEvent(new Event('resize'));
        advanceFrames(1);
        const before=WaterGarden.inspect().steps;
        advanceFrames(5);
        const available=kind==='water'?WaterGarden.inspect().renderer:NatureGarden.inspect().renderer;
        return {available,stepsAdvanced:WaterGarden.inspect().steps>before};
      },kind);
      assert.equal(continued.available,'webgl','resize after slow delivery must render again');
      if(kind==='water')assert(continued.stepsAdvanced,'water physics must continue after slow delivery');
      reports.push({...result,...continued});
      if(kind==='snow'){
        await page.waitForFunction(()=>getComputedStyle(document.getElementById('loading')).opacity==='0',null,{polling:50});
        await page.evaluate(()=>advanceFrames(2));
        await page.screenshot({path:path.join(out,'slow-delivery-snow.png')});
      }
      await page.close();
    }
    fs.writeFileSync(path.join(out,'render-recovery-report.json'),JSON.stringify(reports,null,2)+'\n');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
