const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const out=path.join(__dirname,'../docs/evidence-v'+require('../package.json').version),reports=[],errors=[],server=require('./serve.cjs')();
(async()=>{
  fs.mkdirSync(out,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await playwright.chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  try{
    for(const viewport of [{width:390,height:844},{width:1440,height:960},{width:320,height:568},{width:844,height:390},{width:2560,height:720}])for(const low of [false,true]){
      const context=await browser.newContext({viewport,deviceScaleFactor:2,hasTouch:true}),page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await page.addInitScript(()=>{
        const raf=requestAnimationFrame;let time=0;
        window.requestAnimationFrame=callback=>raf(()=>callback(time+=window.openSlow?60:1000/30));
      });
      await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.WaterGarden&&WaterGarden.inspect().steps>5&&WaterGarden.inspect().waterMaps===2);
      if(low){await page.evaluate(()=>window.openSlow=true);await page.waitForFunction(()=>WaterGarden.inspect().quality==='low');await page.evaluate(()=>window.openSlow=false);}
      assert.equal(await page.evaluate(()=>WaterGarden.inspect().quality),low?'low':'normal');
      await page.waitForFunction(()=>getComputedStyle(document.getElementById('loading')).opacity==='0');
      await page.screenshot({path:path.join(out,`open-water-${viewport.width}x${viewport.height}-${low?'low':'normal'}.png`)});
      const edges=await page.evaluate(()=>{
        const canvas=document.getElementById('water'),result=[];
        for(const [u,v] of [[.002,.002],[.998,.002],[.002,.998],[.998,.998],[.5,.002],[.002,.5],[.998,.5],[.5,.998]]){
          document.getElementById('reset').click();
          canvas.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,buttons:1,pointerId:813,clientX:u*innerWidth,clientY:v*innerHeight}));
          result.push({u,v,energy:WaterGarden.inspect().energy,pointers:WaterGarden.inspect().activePointers});
          canvas.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:813}));
        }
        return result;
      });
      assert(edges.every(p=>p.energy>0&&p.pointers===1),'four corners and edge midpoints must resolve onto interactive water');
      const coverage=await page.evaluate(({viewport,low})=>{
        // Color only the actual depth-tested water pass. No UI or backdrop can
        // conceal uncovered pixels, including at maximum positive/negative swell.
        const canvas=document.createElement('canvas'),field=new WaterCore.WaveField(96,96,viewport.width/viewport.height);
        const proto=WebGLRenderingContext.prototype,source=proto.shaderSource;let renderer;
        try{
          proto.shaderSource=function(shader,text){return source.call(this,shader,text.replace('gl_FragColor=vec4(col,alpha);','if(uPass>.5&&uPass<1.5){col=vec3(1.,0.,0.);alpha=1.;}gl_FragColor=vec4(col,alpha);'));};
          renderer=new WaterRenderer(canvas,WaterScene.create(field.aspect),field);proto.shaderSource=source;renderer.low=low;renderer.resize(viewport.width,viewport.height);
          const gl=renderer.gl,states=[];
          for(const height of [-.95,0,.95]){
            field.current.fill(height);renderer.draw(4,0);
            const pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
            let uncovered=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==255||pixels[i+1]!==0||pixels[i+2]!==0)uncovered++;
            states.push({height,uncovered});
          }
          const boats=new WaterBoats.System();boats.attach(field.aspect,field,()=>false);boats.clock=4;
          const rays=[];
          for(const [u,v] of [[.002,.002],[.5,.5],[.998,.998]]){
            const hit=boats.surface(u,v),projected=hit.v-boats.height(hit.u,hit.v)*.25;
            rays.push(Math.abs(projected-v));
          }
          return {states,rays,buffer:[canvas.width,canvas.height],triangles:renderer.mesh.indices.length/3+renderer.terrain.ground.length/33,rocks:renderer.terrain.rocks.length,error:gl.getError()};
        }finally{proto.shaderSource=source;if(renderer)renderer.destroy();}
      },{viewport,low});
      assert(coverage.states.every(s=>s.uncovered===0),'every output pixel must be covered by the 3D water mesh at all wave extrema');
      assert(coverage.rays.every(error=>error<.00001),'camera rays must meet the displaced surface used by rendering');
      assert.equal(coverage.rocks,0);assert.equal(coverage.error,0);assert(coverage.triangles<(low?50000:100000));assert(coverage.buffer[0]*coverage.buffer[1]<=(low?1000000:2000000));
      reports.push({viewport,quality:low?'low':'normal',edges,coverage});await context.close();
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'open-water-report.json'),JSON.stringify({browser:await browser.version(),errors,reports},null,2)+'\n');
    console.log('Open-water checks passed: five viewports, both quality tiers, full GPU pixel coverage at wave extrema, camera rays and all eight screen edges.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
