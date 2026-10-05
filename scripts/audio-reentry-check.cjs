const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/evidence-v'+require('../package.json').version);
(async()=>{
  const browser=await playwright.chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']}),reports=[],errors=[];
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const Native=window.AudioContext;
      window.audioProbe={contexts:[],blocked:false};
      window.AudioContext=function(){
        const c=new Native(),createGain=c.createGain.bind(c),resume=c.resume.bind(c),suspend=c.suspend.bind(c),state=Object.getOwnPropertyDescriptor(Native.prototype,'state')||Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Native.prototype),'state');
        c.createGain=function(){const node=createGain();if(!c.probeMaster){c.probeMaster=node;c.probeMeter=c.createAnalyser();node.connect(c.probeMeter);}return node;};
        Object.defineProperty(c,'state',{get:()=>c.probeInterrupted?'interrupted':state.get.call(c)});
        c.resume=function(){if(audioProbe.blocked)return Promise.reject(new Error('test gesture required'));c.probeInterrupted=false;return resume();};
        c.suspend=function(){if(c.probeDelaySuspend){c.probeDelaySuspend=false;return new Promise((done,fail)=>setTimeout(()=>suspend().then(done,fail),60));}return suspend();};
        audioProbe.contexts.push(c);return c;
      };
    });
    await page.goto(pathToFileURL(path.join(root,'src/index.html')).href);
    await page.waitForFunction(()=>window.WaterGarden&&WaterGarden.inspect().ready);
    await page.mouse.click(195,410);
    const audible=()=>page.evaluate(()=>{
      const c=audioProbe.contexts[audioProbe.contexts.length-1],samples=new Float32Array(2048);c.probeMeter.getFloatTimeDomainData(samples);
      return {state:c.state,rms:Math.sqrt(samples.reduce((a,v)=>a+v*v,0)/samples.length),voices:WaterGarden.inspect().music.voices.length,contexts:audioProbe.contexts.length};
    });
    const waitAudible=()=>page.waitForFunction(()=>{
      const c=audioProbe.contexts[audioProbe.contexts.length-1],music=WaterGarden.inspect().music;
      if(c.state!=='running'||music.voices.length!==1||music.voices[0].fading)return false;
      const samples=new Float32Array(2048);c.probeMeter.getFloatTimeDomainData(samples);return samples.some(v=>Math.abs(v)>.00001);
    },null,{timeout:3000});
    await waitAudible();
    // A cached WebView can leave/re-enter through page events without visibilitychange.
    await page.evaluate(async()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));await audioProbe.contexts[0].suspend();window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
    try{await waitAudible();}catch{throw new Error('pagehide → pageshow restored the mini-tool without audible output: '+JSON.stringify(await audible()));}
    reports.push({scenario:'cached-page re-entry resumes actual music PCM without visibilitychange',...await audible()});
    // Native interruptions use a fourth AudioContext state on some mobile WebViews.
    await page.evaluate(async()=>{const c=audioProbe.contexts[0];await c.suspend();c.probeInterrupted=true;audioProbe.blocked=true;window.dispatchEvent(new Event('focus'));});
    await page.mouse.click(195,410);assert.equal((await audible()).state,'interrupted');
    await page.evaluate(()=>{audioProbe.blocked=false;});await page.mouse.click(195,410);await waitAudible();
    reports.push({scenario:'interrupted audio retries on the next gesture after a rejected resume',...await audible()});
    for(let i=0;i<4;i++){
      await page.evaluate(()=>{audioProbe.contexts[0].probeDelaySuspend=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
      await page.waitForTimeout(180);
      await waitAudible();
    }
    assert.equal((await audible()).contexts,1,'ordinary returns reuse one audio graph');
    reports.push({scenario:'rapid exits and returns do not leave a late suspension behind',...await audible()});
    for(const scene of ['snow','cloud','water']){
      await page.locator('[data-scene="'+scene+'"]').click();await page.waitForTimeout(1600);await waitAudible();
      await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));});
      await page.waitForFunction(()=>WaterGarden.inspect().audioState==='suspended');
      assert.equal((await audible()).voices,0,'hidden scenes release all music voices');
      await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});await waitAudible();
      assert.equal(await page.evaluate(()=>WaterGarden.inspect().music.voices[0].scene),scene);
      reports.push({scenario:scene+' scene music becomes audible again after re-entry',...await audible()});
    }
    await page.locator('#rain').click();await page.waitForFunction(()=>WaterGarden.inspect().rainAudio);
    await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));});
    await page.waitForFunction(()=>WaterGarden.inspect().audioState==='suspended');
    await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});await waitAudible();
    await page.waitForFunction(()=>WaterGarden.inspect().rainAudio);
    reports.push({scenario:'rain ambience also restores at its selected level',rainLevel:await page.evaluate(()=>WaterGarden.inspect().rainLevel),...await audible()});
    await page.evaluate(async()=>{await audioProbe.contexts[0].close();});await page.mouse.click(195,410);await waitAudible();
    assert.equal((await audible()).contexts,2);reports.push({scenario:'a closed native context is rebuilt on the next gesture',...await audible()});
    await page.waitForFunction(()=>WaterGarden.inspect().tapReady);const taps=await page.evaluate(()=>WaterGarden.inspect().tapPlayed);
    await page.mouse.click(195,410);await page.waitForFunction(count=>WaterGarden.inspect().tapPlayed>count,taps);
    reports.push({scenario:'short recorded effects play after rebuilding the audio graph',...await audible()});
    assert.deepEqual(errors,[]);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'audio-reentry-report.json'),JSON.stringify({browser:await browser.version(),reports,errors},null,2)+'\n');
    console.log('Audio re-entry checks passed: actual PCM after cached return, interruption retry, rapid returns and closed-context recovery.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
