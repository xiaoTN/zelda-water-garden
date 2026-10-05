const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const out=path.join(__dirname,'../docs/evidence-v'+require('../package.json').version),server=require('./serve.cjs')(),reports=[],errors=[];
(async()=>{
  fs.mkdirSync(out,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await playwright.chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  try{
    for(const low of [false,true]){
      const page=await browser.newPage({viewport:low?{width:844,height:390}:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>{
        let time=0,id=0,queued=new Map();requestAnimationFrame=callback=>{queued.set(++id,callback);return id;};cancelAnimationFrame=key=>queued.delete(key);
        window.advanceFrames=(count,ms=20)=>{for(let i=0;i<count;i++){time+=ms;const batch=queued;queued=new Map();batch.forEach(callback=>callback(time));}};
      });
      await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(()=>advanceFrames(10));await page.waitForTimeout(650);
      if(low)await page.evaluate(()=>advanceFrames(200,60));
      assert.equal(await page.evaluate(()=>WaterGarden.inspect().quality),low?'low':'normal');
      await page.evaluate(()=>{
        const add=WaterBoats.System.prototype.add;WaterBoats.System.prototype.add=function(){window.capacityBoats=this;return add.apply(this,arguments);};
        const draw=NatureSurface.prototype.draw;NatureSurface.prototype.draw=function(){window.capacitySurface=this;return draw.apply(this,arguments);};
        window.capacitySend=(canvas,type,id,u,v)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,buttons:type==='pointerup'||type==='pointercancel'?0:1,pointerId:id,clientX:u*innerWidth,clientY:v*innerHeight}));
      });
      await page.locator('[data-mode="boat"]').click();await page.evaluate(()=>{const c=document.getElementById('water');capacitySend(c,'pointerdown',100,.38,.49);capacitySend(c,'pointerup',100,.38,.49);});
      const boats=await page.evaluate(()=>{
        const b=capacityBoats,c=document.getElementById('water');b.clear();b.tuning.boatFlow=0;
        for(const v of [.32,.40,.48,.56,.64,.72])for(const u of [.26,.38,.50,.62,.74])if(b.items.length<12)b.add(u,v);
        if(b.items.length!==12)throw new Error('Could not seed a full fleet');
        advanceFrames(2);const oldest=b.items[0],screen=b.inspect()[0];
        capacitySend(c,'pointerdown',101,screen.screenU,screen.screenV);const held=oldest.held;
        let replacements=0;
        for(let i=0;i<8;i++){
          const previous=b.items.slice();let target=null;
          for(let v=.32;v<.72&&!target;v+=.025)for(let u=.25;u<.77;u+=.025){
            const screenV=v-b.height(u,v)*.25,surface=b.surface(u,screenV);
            if(!b.pick(u,screenV,true)&&b.clearAt(surface.u,surface.v,-.2,b.items[0])){target={u,v:screenV};break;}
          }
          if(!target)throw new Error('No clear placement found');
          capacitySend(c,'pointerdown',102,target.u,target.v);
          if(b.items.length!==12||b.items.some((item,j)=>j<11&&item!==previous[j+1]))throw new Error('Fleet did not evict exactly its oldest member');
          capacitySend(c,'pointercancel',102,target.u,target.v);replacements++;
        }
        const active=WaterGarden.inspect().activePointers,position=[oldest.u,oldest.v];
        capacitySend(c,'pointermove',101,.5,.5);capacitySend(c,'pointerup',101,.5,.5);advanceFrames(2);
        return {held,replacements,active,detached:!b.items.includes(oldest)&&!oldest.held&&oldest.vx===0&&oldest.vz===0&&oldest.u===position[0]&&oldest.v===position[1],state:WaterGarden.inspect(),notice:document.getElementById('notice').classList.contains('show')};
      });
      assert(boats.held&&boats.detached);assert.equal(boats.active,0);assert.equal(boats.state.boats.length,12);assert.equal(boats.state.boatTriangles,672);assert.equal(boats.notice,false);
      await page.screenshot({path:path.join(out,'object-replacement-boats-'+(low?'low':'normal')+'.png')});
      await page.locator('[data-scene="snow"]').click();await page.evaluate(()=>advanceFrames(60));await page.locator('[data-nature="2"]').click();
      const snow=await page.evaluate(()=>{
        const s=capacitySurface,snow=s.snow,c=document.getElementById('nature');snow.clear();snow.tuning.growth=0;
        for(let i=0;i<12;i++)snow.ball(.20+(i%4)*.20,.32+Math.floor(i/4)*.20,.008*Math.min(s.aspect,1));
        advanceFrames(2);const oldest=snow.balls[0],others=snow.balls.slice(1),p=s.camera.project(s.ballPosition(oldest));
        capacitySend(c,'pointerdown',201,p.u,p.v);const held=NatureGarden.inspect().activePointers===1;
        const x=(.5-.5)*12*s.aspect,z=(.42-.5)*12,q=s.camera.project([x,s.height(x,z,'snow',snow,s.clouds),z]);
        capacitySend(c,'pointerdown',202,q.u,q.v);capacitySend(c,'pointermove',202,q.u+8/innerWidth,q.v);
        const created=snow.balls[11],active=NatureGarden.inspect().activePointers;
        const kept=snow.balls.length===12&&others.every((ball,i)=>snow.balls[i]===ball)&&created!==oldest;
        capacitySend(c,'pointermove',201,p.u+.05,p.v);capacitySend(c,'pointerup',201,p.u+.05,p.v);capacitySend(c,'pointercancel',202,q.u,q.v);advanceFrames(2);
        return {held,active,kept,staleStopped:oldest.vx===0&&oldest.vz===0&&!snow.balls.includes(oldest),state:NatureGarden.inspect(),notice:document.getElementById('notice').classList.contains('show'),picked:snow.balls.every(ball=>{const p=s.camera.project(s.ballPosition(ball));return s.point(p.u,p.v,'snow',s.clouds,true).ball===ball;})};
      });
      assert(snow.held&&snow.kept&&snow.staleStopped&&snow.picked);assert.equal(snow.active,1);assert.equal(snow.state.activePointers,0);assert.equal(snow.state.ballMeshes,12);assert.equal(snow.notice,false);assert(snow.state.triangles<=(low?50000:100000));
      await page.screenshot({path:path.join(out,'object-replacement-snow-'+(low?'low':'normal')+'.png')});
      reports.push({quality:low?'low':'normal',boats,snow});await page.close();
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'object-capacity-report.json'),JSON.stringify({browser:await browser.version(),errors,reports},null,2)+'\n');
    console.log('Object capacity checks passed: silent FIFO boat/snow replacement, held-object cleanup, stale pointer release, real sphere picking and both geometry tiers.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
