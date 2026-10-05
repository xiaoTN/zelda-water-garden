const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(path.join(process.env.CODEX_NODE_MODULES||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'),'playwright'));
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/evidence-v'+require('../package.json').version),server=require('./serve.cjs')();
(async()=>{
  fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:796,height:922},reducedMotion:'reduce'}),errors=[],reports=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
    await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.NatureGarden&&getComputedStyle(document.getElementById('loading')).opacity==='0');
    await page.evaluate(()=>{const draw=NatureSurface.prototype.draw;NatureSurface.prototype.draw=function(){window.displacementSurface=this;return draw.apply(this,arguments);};});
    const select=async kind=>{await page.locator('button[data-scene="'+kind+'"]').click();await page.waitForFunction(kind=>NatureGarden.inspect().scene===kind&&WaterGarden.inspect().sceneTransition.phase==='idle',kind);};
    for(const kind of ['snow','cloud']){
      await select(kind);
      await page.locator('#nature').press('Enter');
      for(const sweep of [false,true]){
        const report=await page.evaluate(({kind,sweep})=>{
          const s=displacementSurface,field=kind==='snow'?s.snow:s.clouds.field;field.clear();
          if(sweep){for(let pass=0;pass<3;pass++)for(let y=.3;y<.85;y+=.035)field.stroke(pass%2?1:0,y,pass%2?0:1,y,.035,.8);}
          else field.stroke(.18,.52,.82,.52,.04,.8);
          const empty={size:field.size,origin:field.origin,span:field.span,depth:new Float32Array(field.depth.length)};
          let low=0,high=0,total=0,dug=0,piled=0;
          for(let i=0;i<field.depth.length;i++){const v=field.depth[i];total+=v;if(v>0)dug+=v;else piled-=v;if(v>field.depth[low])low=i;if(v<field.depth[high])high=i;}
          function delta(i){const x=(field.origin+(i%field.size+.5)/field.size*field.span-.5)*12*s.aspect,z=(field.origin+(Math.floor(i/field.size)+.5)/field.size*field.span-.5)*12;return s.height(x,z,kind,field,s.clouds)-s.height(x,z,kind,empty,s.clouds);}
          s.draw(kind,0,s.snow,s.clouds,0,false,true);
          const tiers=[];
          if(kind==='cloud'){
            const width=s.canvas.width,height=s.canvas.height,quality=s.low;
            for(const lowTier of [false,true]){
              s.resize(width,height,lowTier);s.draw(kind,0,s.snow,s.clouds,0,false,true);
              let raisedTexture=0;for(let i=1;i<s.pixels.length;i+=4)raisedTexture=Math.max(raisedTexture,s.pixels[i]);
              tiers.push({low:lowTier,raisedTexture,triangles:s.count/3});
            }
            s.resize(width,height,quality);s.draw(kind,0,s.snow,s.clouds,0,false,true);
          }
          return {kind,sweep,total,dug,piled,lower:delta(low),raised:delta(high),triangles:s.count/3,tiers};
        },{kind,sweep});
        assert(report.dug>100&&report.lower<(kind==='cloud'?-.06:-.15));
        if(kind==='cloud'){
          assert.equal(report.piled,0);assert(report.raised<=1e-8,'cloud world heights never rise above the undisturbed surface');
          assert(report.tiers.every(t=>t.raisedTexture===0&&t.triangles<=(t.low?50000:100000)),'both GPU tiers upload no raised-cloud displacement');
        }else{
          assert(Math.abs(report.total)<.02&&report.piled>100&&report.raised>.08,'snow keeps its displaced banks');
        }
        await page.screenshot({path:path.join(out,kind+(sweep?'-fully-swept':kind==='cloud'?'-no-raised-banks':'-raised-banks')+'.png')});reports.push(report);
      }
    }
    // The visible continuous material must move, not just the legacy cloud markers.
    await select('cloud');
    for(const lowTier of [false,true]){
      const pushed=await page.evaluate(lowTier=>{
        const s=displacementSurface,c=s.clouds;c.clear();s.resize(s.canvas.width,s.canvas.height,lowTier);
        const center=s.point(.5,.5,'cloud',c,false),scale=Math.min(c.aspect,1),samples=[];
        for(let i=0;i<12;i++){
          const angle=i*Math.PI/6,u=center.u+Math.cos(angle)*scale*.10/c.aspect,v=center.v+Math.sin(angle)*scale*.10;
          const x=(u-.5)*12*s.aspect,z=(v-.5)*12;samples.push({u,v,x,z,before:s.height(x,z,'cloud',c.field,c)});
        }
        for(let i=0;i<16;i++)c.touch(center.u,center.v,'part',.01,0,.016,.8);
        s.draw('cloud',0,s.snow,c,0,false,true);
        let change=0,pickError=0,outward=0,channelError=0;
        for(const p of samples){
          const offset=c.offset(p.u,p.v),height=s.height(p.x,p.z,'cloud',c.field,c);
          change=Math.max(change,Math.abs(height-p.before));
          outward=Math.min(outward||1,offset[0]*(p.u-center.u)*c.aspect*c.aspect+offset[1]*(p.v-center.v));
          const screen=s.camera.project([p.x,height,p.z]),hit=s.point(screen.u,screen.v,'cloud',c,false);
          pickError=Math.max(pickError,Math.hypot((hit.u-p.u)*s.aspect,hit.v-p.v));
        }
        for(let i=0;i<c.pushX.length;i++)channelError=Math.max(channelError,Math.abs(s.pixels[i*4+2]-(128+Math.round(c.pushX[i]/.08*127))),Math.abs(s.pixels[i*4+3]-(128+Math.round(c.pushY[i]/.08*127))));
        const outsideCut=samples.every(p=>c.field.depth[c.field.index(p.u,p.v)]===0);
        return {low:lowTier,change,pickError,outward,channelError,outsideCut,triangles:s.count/3,drawCalls:s.drawCalls};
      },lowTier);
      assert(pushed.outsideCut&&pushed.change>.005,'the halo visibly shifts 3D cloud geometry beyond the thinned opening');
      assert(pushed.outward>0&&pushed.channelError===0,'both GPU channels carry the outward displacement');
      assert(pushed.pickError<.001,'camera picking follows the displaced geometry');
      assert(pushed.triangles<=(lowTier?50000:100000)&&pushed.drawCalls<=(lowTier?50:100));
      await page.screenshot({path:path.join(out,'cloud-outward-push-'+(lowTier?'low':'high')+'.png')});reports.push({cloudPush:pushed});
    }
    for(const viewport of [{width:390,height:844},{width:844,height:390}]){
      await page.setViewportSize(viewport);await page.waitForFunction(w=>WaterGarden.inspect().width===w,viewport.width);
      for(const kind of ['snow','cloud']){
        await select(kind);
        const edges=await page.evaluate(kind=>{
          const s=displacementSurface,field=kind==='snow'?s.snow:s.clouds.field;field.clear();const points=[];
          for(const [u,v] of [[.001,.001],[.999,.001],[.001,.999],[.999,.999],[.5,.001],[.5,.999],[.001,.5],[.999,.5]]){
            const p=s.point(u,v,kind,s.clouds,false);if(!p)return {valid:false};
            const margin=Math.min(p.u-field.origin,p.v-field.origin,field.origin+field.span-p.u,field.origin+field.span-p.v);
            field.stamp(p.u,p.v,.025,.8);points.push({margin,depth:field.depth[field.index(p.u,p.v)]});
          }
          return {valid:points.every(p=>p.margin>.04&&p.depth>.6),points};
        },kind);
        assert(edges.valid,'every visible edge and corner must accept a 3D stroke in the fixed view');
        if(kind==='snow')await page.locator('#reset').click();
        else await page.evaluate(()=>displacementSurface.clouds.clear());
        const before=await page.evaluate(()=>NatureGarden.inspect().snow.markedCells+NatureGarden.inspect().cloudCarve);
        await page.mouse.move(viewport.width*.45,viewport.height*.5);await page.mouse.down();await page.mouse.move(viewport.width*.45,2,{steps:24});await page.mouse.up();
        await page.mouse.move(viewport.width*.55,viewport.height*.5);await page.mouse.down();await page.mouse.move(viewport.width-2,viewport.height-2,{steps:24});await page.mouse.up();
        const after=await page.evaluate(()=>NatureGarden.inspect().snow.markedCells+NatureGarden.inspect().cloudCarve);assert(after>before);
        if(viewport.width===390)await page.screenshot({path:path.join(out,kind+'-screen-edges.png')});
        reports.push({kind,viewport,edgePicking:edges,result:'passed'});
      }
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'displacement-report.json'),JSON.stringify({browser:await browser.version(),errors,reports},null,2)+'\n');
    console.log('Displacement browser checks passed: snow retains conserved banks; clouds have no piled banks, their outer halo moves the continuous 3D material in both tiers, GPU channels and camera picking agree, and edge swipes pass.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
