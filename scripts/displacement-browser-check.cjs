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
    for(const kind of ['snow','cloud']){
      await page.locator('button[data-scene="'+kind+'"]').click();
      if(await page.locator('#view-3d').getAttribute('aria-pressed')==='false')await page.locator('#view-3d').click();
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
          return {kind,sweep,total,dug,piled,lower:delta(low),raised:delta(high),triangles:s.count/3};
        },{kind,sweep});
        assert(Math.abs(report.total)<.02);assert(report.dug>100&&report.piled>100);assert(report.lower<(kind==='cloud'?-.06:-.15)&&report.raised>(kind==='cloud'?.02:.08),'real world mesh is depressed AND raised');
        await page.screenshot({path:path.join(out,kind+(sweep?'-fully-swept':'-raised-banks')+'.png')});reports.push(report);
      }
    }
    for(const viewport of [{width:390,height:844},{width:844,height:390}]){
      await page.setViewportSize(viewport);await page.waitForFunction(w=>WaterGarden.inspect().width===w,viewport.width);
      for(const kind of ['snow','cloud']){
        await page.locator('button[data-scene="'+kind+'"]').click();
        for(const oblique of [false,true]){
          if((await page.locator('#view-3d').getAttribute('aria-pressed')==='true')!==oblique)await page.locator('#view-3d').click();
          const edges=await page.evaluate(kind=>{
            const s=displacementSurface,field=kind==='snow'?s.snow:s.clouds.field;field.clear();const points=[];
            for(const [u,v] of [[.001,.001],[.999,.001],[.001,.999],[.999,.999],[.5,.001],[.5,.999],[.001,.5],[.999,.5]]){
              const p=s.point(u,v,kind,s.clouds,false);if(!p)return {valid:false};
              const margin=Math.min(p.u-field.origin,p.v-field.origin,field.origin+field.span-p.u,field.origin+field.span-p.v);
              field.stamp(p.u,p.v,.025,.8);points.push({margin,depth:field.depth[field.index(p.u,p.v)]});
            }
            return {valid:points.every(p=>p.margin>.04&&p.depth>.6),points};
          },kind);
          assert(edges.valid,'every visible edge and corner must accept a 3D stroke in both views');
          await page.locator('#reset').click();
          const before=await page.evaluate(()=>NatureGarden.inspect().snow.markedCells+NatureGarden.inspect().cloudCarve);
          await page.mouse.move(viewport.width*.45,viewport.height*.5);await page.mouse.down();await page.mouse.move(viewport.width*.45,2,{steps:24});await page.mouse.up();
          await page.mouse.move(viewport.width*.55,viewport.height*.5);await page.mouse.down();await page.mouse.move(viewport.width-2,viewport.height-2,{steps:24});await page.mouse.up();
          const after=await page.evaluate(()=>NatureGarden.inspect().snow.markedCells+NatureGarden.inspect().cloudCarve);assert(after>before);
          if(viewport.width===390&&oblique)await page.screenshot({path:path.join(out,kind+'-screen-edges.png')});
          reports.push({kind,viewport,oblique,edgePicking:edges,result:'passed'});
        }
      }
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'displacement-report.json'),JSON.stringify({browser:await browser.version(),errors,reports},null,2)+'\n');
    console.log('Displacement browser checks passed: both world-space height directions, conserved material, complete repeated sweeps for snow and clouds.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
