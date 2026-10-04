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
      assert.equal(await page.locator('[data-mode]').count(),4); assert.equal(await page.getByText('落石',{exact:true}).count(),1);
      let state = await inspect(); assert.equal(state.renderer, 'webgl'); assert(state.bufferWidth * state.bufferHeight <= 2000000);
      await page.waitForFunction(() => WaterGarden.inspect().waterMaps === 2);
      assert(state.surfaceVertices > 4000 && state.surfaceVertices < 65536);
      assert(state.surfaceTriangles > 8000 && state.surfaceTriangles <= 32768);
      if(viewport.width === 390) {
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
        assert.equal(foamResponse.resetDifference,0,'clearing waves must restore unperturbed foam');
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
            const water=read();field.ice.paint(.5,.49,2,true,true);for(let i=0;i<40;i++)field.ice.update(.1);const frozen=read();
            let dry=0,dryCovered=0,wet=0,wetTinted=0,iceCovered=0;
            for(let i=0;i<solid.length;i+=4) {
              if(solid[i]===255&&solid[i+1]===0&&solid[i+2]===0) {
                dry++;if(water[i]<250||water[i+1]>5||water[i+2]>5)dryCovered++;
                if(frozen[i]<250||frozen[i+1]>5||frozen[i+2]>5)iceCovered++;
              }
              if(solid[i]===0&&solid[i+1]===0&&solid[i+2]===255) {
                wet++;if(water[i+1]>20&&water[i+2]<250)wetTinted++;
              }
            }
            return {dry,dryCovered,wet,wetTinted,iceCovered,error:gl.getError()};
          } finally {proto.shaderSource=source;proto.drawElements=drawElements;if(renderer)renderer.destroy();}
        });
        assert(depthResult.dry>100&&depthResult.wet>30,'scene must contain both exposed and submerged stone surfaces');
        assert(depthResult.dryCovered/depthResult.dry<.01,'water must not cover dry stone tops');
        assert(depthResult.iceCovered/depthResult.dry<.01,'ice must not cover dry stone tops');
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
        await page.locator(selector).click();await page.waitForTimeout(450);state=await inspect();
        assert.equal(state.rainLevel,level);assert(state.rainStreaks>0);assert.equal(await page.locator(selector).getAttribute('aria-pressed'),'true');
        rainStates.push({level,streaks:state.rainStreaks});
        if(viewport.width===390)await page.screenshot({path:path.join(out,'mobile-rain-'+level+'.png')});
      }
      for(let i=1;i<rainStates.length;i++)assert(rainStates[i].streaks>rainStates[i-1].streaks);
      assert((await inspect()).rainImpacts>0,'falling rain must disturb water');
      reports.push({scenario:'four rain levels',viewport,presets:rainStates,result:'passed'});
      if(viewport.width===390){
        // Measure actual streak pixels with cloud tint and flashes removed from this isolated canvas.
        const streakPixels=await page.evaluate(()=>{
          const surface=document.createElement('canvas');surface.width=390;surface.height=844;
          const ctx=surface.getContext('2d'),w=new WaterWeather.System(WaterCore.seededRandom(3)),counts=[];
          for(let level=1;level<=4;level++){
            w.setLevel(level);w.update(0,false,false);w.draw(ctx,390,844,false);
            const pixels=ctx.getImageData(0,0,390,844).data;let count=0;
            for(let i=3;i<pixels.length;i+=4)if(pixels[i]>12)count++;
            counts.push(count);ctx.clearRect(0,0,390,844);
          }
          return counts;
        });
        assert(streakPixels[0]>150,'light rain must contain visible airborne streaks');
        for(let i=1;i<4;i++)assert(streakPixels[i]>streakPixels[i-1],'higher rainfall must visibly cover more pixels');
        await page.locator('#sound').click();assert.equal((await inspect()).rainAudio,true);
        await page.waitForFunction(()=>WaterGarden.inspect().lightningFlash>.45);
        await page.screenshot({path:path.join(out,'mobile-storm-lightning.png')});
        await page.waitForFunction(()=>WaterGarden.inspect().thunderPlayed>0);
        const firstStrike=(await inspect()).lightningCount;
        await page.waitForFunction(count=>WaterGarden.inspect().lightningCount>count,firstStrike,{timeout:10000});
        reports.push({scenario:'visible rain streaks and repeated storm lightning with delayed WebAudio thunder',streakPixels,state:await inspect(),result:'passed'});
        await page.locator('#sound').click();assert.equal((await inspect()).rainAudio,false);
        await page.waitForTimeout(80);assert.equal((await inspect()).weatherAudioNodes,0);
      }
      await page.locator('#light').click(); assert.equal((await inspect()).light, 1); await page.locator('#light').click(); assert.equal((await inspect()).light, 2);
      if (viewport.width === 390) await page.screenshot({ path: path.join(out, 'mobile-moon-rain.png') });
      await page.locator('#sound').click(); assert.equal((await inspect()).muted, false); await page.touchscreen.tap(x, y); await page.locator('#sound').click(); assert.equal((await inspect()).muted, true);
      await page.locator('#reset').click(); state = await inspect(); assert.equal(state.rain, false); assert.equal(state.leaves, 3); assert(state.energy < .000001);
      assert.equal(state.rainStreaks,0);assert.equal(state.lightningFlash,0);assert.equal(state.thunderPending,false);assert.equal(state.rainAudio,false);
      assert.equal(await page.locator('#rain-options').isVisible(),false);
      await page.locator('#light').click();
      await page.locator('[data-mode="ice"]').click(); assert.equal((await inspect()).mode, 'ice');
      assert(await page.locator('#ice-actions').isVisible());
      for (const selector of ['[data-mode="ice"]','#freeze-all','#thaw-all','#reset']) {
        const box = await page.locator(selector).boundingBox(); assert(box.x >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, 'ice controls must fit viewport'); assert(box.width >= 44 && box.height >= 44);
      }
      await page.touchscreen.tap(x,y); await page.waitForFunction(() => WaterGarden.inspect().iceCenter > .95);
      state = await inspect(); assert(state.iceCoverage > .01 && state.iceCoverage < .4); assert.equal(state.energy,0);
      if (viewport.width === 390) await page.screenshot({path:path.join(out,'mobile-local-ice.png')});
      await page.touchscreen.tap(x,y); await page.waitForTimeout(250);
      state = await inspect(); assert.equal(state.iceCenter,0); assert(state.iceShards > 0); assert(state.energy > .001);
      await page.locator('#freeze-all').click(); await page.waitForFunction(() => WaterGarden.inspect().iceCoverage > .995);
      const trappedLeaves = (await inspect()).leafPositions; await page.waitForTimeout(150); assert.deepEqual((await inspect()).leafPositions,trappedLeaves);
      if (viewport.width === 390 || viewport.width === 1440) await page.screenshot({path:path.join(out,viewport.width === 390 ? 'mobile-frozen.png' : 'desktop-frozen.png')});
      await page.touchscreen.tap(x,y); await page.waitForTimeout(240);
      state = await inspect(); assert(state.iceCoverage < .99 && state.iceCoverage > .6); assert.equal(state.iceCenter,0); assert(state.iceShards > 0);
      if (viewport.width === 390 || viewport.width === 1440) await page.screenshot({path:path.join(out,viewport.width === 390 ? 'mobile-shatter.png' : 'desktop-shatter.png')});
      await page.locator('#thaw-all').click(); await page.waitForFunction(() => WaterGarden.inspect().iceCoverage === 0);
      await page.mouse.move(viewport.width * .3,y); await page.mouse.down(); await page.mouse.move(viewport.width * .7,y,{steps:14}); await page.mouse.up();
      await page.waitForTimeout(1000); assert((await inspect()).iceCoverage > .02); assert.equal((await inspect()).activePointers,0);
      if (viewport.width === 390) {
        const coverage = (await inspect()).iceCoverage;
        await page.setViewportSize({width:844,height:390}); await page.waitForTimeout(350); assert(Math.abs((await inspect()).iceCoverage - coverage) < .025,'rotation preserves ice');
        await page.setViewportSize(viewport); await page.waitForTimeout(350);
      }
      await page.locator('#reset').click(); assert.equal((await inspect()).iceCoverage,0); assert.equal((await inspect()).iceShards,0);
      await page.locator('[data-mode="touch"]').click(); assert.equal(await page.locator('#ice-actions').isVisible(),false);
      await page.evaluate(() => { document.documentElement.style.setProperty('--safe-area-inset-top', '44px'); document.documentElement.style.setProperty('--safe-area-inset-bottom', '34px'); });
      const buttonBox = await page.locator('#reset').boundingBox(); assert(buttonBox.x >= 0 && buttonBox.x + buttonBox.width <= viewport.width); assert(buttonBox.y + buttonBox.height <= viewport.height - 34);
      if (viewport.width === 390) {
        await page.setViewportSize({width:844,height:390}); await page.waitForTimeout(600); assert.equal((await inspect()).width,844);
        await page.setViewportSize(viewport); await page.waitForTimeout(600);
        await page.locator('#rain').click();await page.locator('[data-rain="4"]').click();await page.locator('#sound').click();
        await page.waitForTimeout(250);const beforePause=await inspect();assert(beforePause.rainAudio);
        // A controlled visibility event checks the exact lifecycle path without OS focus assumptions.
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', {configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange')); });
        const pausedState=await inspect(),paused=pausedState.steps; await page.waitForTimeout(220); assert.equal((await inspect()).steps, paused);
        assert.equal((await inspect()).rainAudio,false);assert.equal((await inspect()).lightningNext,pausedState.lightningNext);
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', {configurable:true,value:false}); document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForTimeout(170); assert((await inspect()).steps > paused);
        assert((await inspect()).rainAudio);assert.equal((await inspect()).rainLevel,4);
        await page.locator('#sound').click();await page.locator('#reset').click();
        await page.locator('[data-mode="ice"]').click(); await page.locator('#freeze-all').click(); await page.waitForFunction(() => WaterGarden.inspect().iceCoverage > .995);
        // Lose the actual GL context, then restore it once and verify the usable fallback.
        await page.evaluate(() => { window.testLostContext = document.getElementById('water').getContext('webgl').getExtension('WEBGL_lose_context'); window.testLostContext.loseContext(); });
        await page.waitForTimeout(180); assert.equal((await inspect()).renderer, 'canvas2d');
        assert((await inspect()).iceCoverage > .99, 'context loss preserves frozen cells');
        await page.touchscreen.tap(x,y); await page.waitForTimeout(250); assert((await inspect()).energy > .001); assert.equal((await inspect()).iceCenter,0);
        await page.evaluate(() => window.testLostContext.restoreContext()); await page.waitForTimeout(500); assert.equal((await inspect()).renderer,'webgl');
        assert((await inspect()).iceCoverage > .6); assert.equal((await inspect()).iceCenter,0,'context restoration preserves broken hole');
        await page.locator('[data-mode="touch"]').click(); await page.locator('#reset').click();
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:130,y:380,id:1},{x:260,y:460,id:2}]});
        assert.equal((await inspect()).activePointers,2);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:150,y:390,id:1},{x:240,y:450,id:2}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}); assert.equal((await inspect()).activePointers,0);
        await cdp.detach();
      }
      await page.locator('#reset').click();await page.locator('[data-mode="stone"]').click();
      await page.mouse.click(x,y);state=await inspect();
      assert.equal(state.stones.length,1);assert(state.stones[0].y>1);assert.equal(state.stoneImpacts,0);assert.equal(state.energy,0,'water waits until the stone reaches it');
      await page.waitForFunction(()=>{const s=WaterGarden.inspect().stones[0];return s&&s.y<1&&s.y>.05;});
      if(viewport.width===390)await page.screenshot({path:path.join(out,'stone-airborne.png')});
      await page.waitForFunction(()=>WaterGarden.inspect().stoneImpacts===1);state=await inspect();assert(state.energy>.1,'impact must disturb water');
      assert.equal(state.rings,0,'stone waves must come from the water simulation without drawn rings');assert.equal(state.drops,0);
      if(viewport.width===390){
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
      assert(!(await page.locator('#notice').textContent()).includes('石头已经够多了'));
      if(viewport.width===390)await page.screenshot({path:path.join(out,'stone-capacity.png')});
      await page.locator('#reset').click();assert.equal((await inspect()).stones.length,0);
      await page.mouse.click(x,y);await page.locator('#reset').click();await page.waitForTimeout(1100);assert.equal((await inspect()).stoneImpacts,0);
      await page.locator('[data-mode="ice"]').click();await page.locator('#freeze-all').click();await page.waitForFunction(()=>WaterGarden.inspect().iceCoverage>.99);
      await page.locator('[data-mode="stone"]').click();await page.mouse.click(x,y);await page.waitForFunction(()=>WaterGarden.inspect().stoneImpacts===1);
      assert((await inspect()).iceCoverage<.999,'stone impact breaks through frozen water');
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
    // Failure to create WebGL must still produce an interactive water scene.
    const fallbackContext = await browser.newContext({ viewport:{width:390,height:844} });
    const fallbackPage = await fallbackContext.newPage(); fallbackPage.on('pageerror', e => errors.push(e.message));
    await fallbackPage.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type) { if(type === 'webgl') return null; return original.apply(this,arguments); }; });
    await fallbackPage.goto(url); await fallbackPage.waitForFunction(() => window.WaterGarden && window.WaterGarden.inspect().steps > 5);
    assert.equal(await fallbackPage.evaluate(() => WaterGarden.inspect().renderer), 'canvas2d');
    await fallbackPage.mouse.click(190,410); await fallbackPage.waitForTimeout(150); assert(await fallbackPage.evaluate(() => WaterGarden.inspect().energy > .001));
    await fallbackPage.mouse.move(120,410); await fallbackPage.mouse.down(); await fallbackPage.mouse.move(270,420,{steps:12}); await fallbackPage.mouse.up();
    assert(await fallbackPage.evaluate(() => WaterGarden.inspect().drops === 0 && WaterGarden.inspect().energy > .01));
    await fallbackPage.locator('[data-mode="ice"]').click(); await fallbackPage.locator('#freeze-all').click(); await fallbackPage.waitForFunction(() => WaterGarden.inspect().iceCoverage > .99);
    await fallbackPage.mouse.click(187.2,405.12); await fallbackPage.waitForTimeout(250); assert.equal(await fallbackPage.evaluate(() => WaterGarden.inspect().iceCenter),0); assert(await fallbackPage.evaluate(() => WaterGarden.inspect().iceShards > 0));
    await fallbackPage.locator('#reset').click();await fallbackPage.locator('[data-mode="stone"]').click();await fallbackPage.mouse.click(195,405);
    assert(await fallbackPage.evaluate(()=>WaterGarden.inspect().stones[0].y>1));await fallbackPage.waitForFunction(()=>WaterGarden.inspect().stones[0].settled);
    assert.equal(await fallbackPage.evaluate(()=>WaterGarden.inspect().stoneImpacts),1);
    await fallbackPage.screenshot({path:path.join(out,'mobile-fallback.png')}); reports.push({scenario:'no WebGL with falling stone',result:'passed'});
    await fallbackPage.locator('#reset').click();await fallbackPage.locator('[data-mode="ice"]').click();await fallbackPage.locator('#freeze-all').click();
    await fallbackPage.waitForFunction(()=>WaterGarden.inspect().iceCoverage>.995);
    await fallbackPage.locator('#rain').click();await fallbackPage.locator('[data-rain="4"]').click();await fallbackPage.waitForTimeout(700);
    assert.equal(await fallbackPage.evaluate(()=>WaterGarden.inspect().rainImpacts),0,'rain cannot create liquid ripples through full ice');
    assert(await fallbackPage.evaluate(()=>WaterGarden.inspect().rainStreaks>0),'airborne rain stays visible over ice');
    await fallbackPage.locator('#thaw-all').click();await fallbackPage.waitForFunction(()=>WaterGarden.inspect().rainImpacts>0);
    await fallbackPage.screenshot({path:path.join(out,'mobile-fallback-storm.png')});
    await fallbackPage.locator('[data-rain="0"]').click();assert.equal(await fallbackPage.evaluate(()=>WaterGarden.inspect().rain),false);
    reports.push({scenario:'Canvas rain over ice, thaw and stop',result:'passed'});await fallbackContext.close();
    // A file URL needs no HTTP server, network permission, module loader or external asset.
    const offlineContext = await browser.newContext({viewport:{width:390,height:844}}), offlinePage = await offlineContext.newPage();
    let networkRequests = 0; offlinePage.on('request',request => { if (/^https?:/.test(request.url())) networkRequests++; });
    offlinePage.on('pageerror', e => errors.push(e.message));
    await offlinePage.goto(pathToFileURL(path.join(root, 'src/index.html')).href); await offlinePage.waitForFunction(() => window.WaterGarden && window.WaterGarden.inspect().steps > 5);
    await offlinePage.waitForFunction(() => WaterGarden.inspect().waterMaps === 2);
    await offlinePage.mouse.click(195,410); assert(await offlinePage.evaluate(() => WaterGarden.inspect().energy > .001)); assert.equal(networkRequests,0);
    await offlinePage.locator('[data-mode="ice"]').click(); await offlinePage.locator('#freeze-all').click(); await offlinePage.waitForFunction(() => WaterGarden.inspect().iceCoverage > .99); assert.equal(networkRequests,0);
    await offlinePage.locator('#rain').click();await offlinePage.locator('[data-rain="4"]').click();await offlinePage.locator('#sound').click();
    await offlinePage.waitForFunction(()=>WaterGarden.inspect().thunderPlayed>0);assert.equal(networkRequests,0);
    reports.push({scenario:'file URL offline', networkRequests, result:'passed'}); await offlineContext.close();
    const reducedContext = await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}), reducedPage = await reducedContext.newPage();
    reducedPage.on('pageerror',e => errors.push(e.message));
    await reducedPage.goto(url); await reducedPage.waitForFunction(() => window.WaterGarden && WaterGarden.inspect().steps > 5);
    await reducedPage.mouse.move(120,410); await reducedPage.mouse.down(); await reducedPage.mouse.move(270,410,{steps:15}); await reducedPage.mouse.up();
    assert.equal(await reducedPage.evaluate(() => WaterGarden.inspect().drops),0);
    assert(await reducedPage.evaluate(() => WaterGarden.inspect().energy > .01));
    await reducedPage.locator('[data-mode="ice"]').click(); await reducedPage.locator('#freeze-all').click(); await reducedPage.waitForFunction(() => WaterGarden.inspect().iceCoverage > .99);
    await reducedPage.mouse.click(187.2,405.12); await reducedPage.waitForTimeout(300);
    assert.equal(await reducedPage.evaluate(() => WaterGarden.inspect().iceCenter),0); assert.equal(await reducedPage.evaluate(() => WaterGarden.inspect().iceShards),0);
    await reducedPage.locator('#rain').click();await reducedPage.locator('[data-rain="4"]').click();await reducedPage.waitForTimeout(300);
    assert(await reducedPage.evaluate(()=>WaterGarden.inspect().rainStreaks>0&&WaterGarden.inspect().rainStreaks<200));
    reports.push({scenario:'reduced motion freezes and breaks without airborne shards',result:'passed'}); await reducedContext.close();
    // Simulated slow timing verifies both downgrade thresholds, without claiming real-device FPS.
    const slowContext = await browser.newContext({viewport:{width:390,height:844}}), slowPage = await slowContext.newPage();
    slowPage.on('pageerror', e => errors.push(e.message));
    await slowPage.addInitScript(() => { const original=requestAnimationFrame; let clock=0; window.requestAnimationFrame=callback=>original(()=>callback(clock+=60)); });
    await slowPage.goto(url); await slowPage.waitForFunction(() => window.WaterGarden && window.WaterGarden.inspect().quality === 'low', null, {timeout:15000});
    await slowPage.waitForFunction(() => WaterGarden.inspect().renderer === 'canvas2d', null, {timeout:15000});
    await slowPage.mouse.click(195,410); assert(await slowPage.evaluate(() => WaterGarden.inspect().energy > .001));
    reports.push({scenario:'synthetic slow timing normal → low → Canvas 2D',result:'passed'}); await slowContext.close();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({browser:await browser.version(),date:'2026-10-04',errors,reports},null,2)+'\n');
    console.log('Browser checks passed: four viewports, four rain levels, airborne streak pixels, repeated lightning, delayed thunder, rain audio lifecycle, ice, touch, broad stone waves, oldest-stone recycling, reset, safe areas, context recovery, Canvas fallback and offline file URL.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => {console.error(error);process.exitCode=1;});
