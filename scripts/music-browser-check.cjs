const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{pathToFileURL}=require('url');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/evidence-v'+require('../package.json').version);
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await playwright.chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
  const reports=[],errors=[];
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});let networkRequests=0;
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))networkRequests++;});
    await page.goto(pathToFileURL(path.join(root,'src/index.html')).href);await page.waitForFunction(()=>window.WaterGarden&&WaterGarden.inspect().steps>5);
    assert.equal((await page.evaluate(()=>WaterGarden.inspect())).music.voices.length,0);
    const recordings=await page.evaluate(async()=>{
      const result={};
      for(const scene of ['water']){
        const bytes=Uint8Array.from(atob(GardenMusicAssets[scene].base64),c=>c.charCodeAt(0));
        const byteLength=bytes.length,c=new OfflineAudioContext(1,22050,22050),buffer=await c.decodeAudioData(bytes.buffer);
        const data=buffer.getChannelData(0);let energy=0;for(const sample of data)energy+=sample*sample;
        result[scene]={duration:buffer.duration,channels:buffer.numberOfChannels,rms:Math.sqrt(energy/data.length),bytes:byteLength};
      }return result;
    });
    assert.deepEqual(await page.evaluate(()=>Object.keys(GardenMusicAssets)),['water']);
    assert(recordings.water.duration>60);assert.equal(recordings.water.channels,1);assert(recordings.water.rms>.001);
    reports.push({scenario:'only the complete water recording ships and decodes offline as audible mono audio',recordings,result:'passed'});
    const pcm=await page.evaluate(async()=>{
      const c=new OfflineAudioContext(1,8000*4,8000);let time=0;
      const buffer=c.createBuffer(1,8000*10,8000);buffer.getChannelData(0).fill(1);
      const clock={state:'running',get currentTime(){return time;},decodeAudioData(bytes,done){done(buffer);},createBuffer:c.createBuffer.bind(c),createBufferSource:c.createBufferSource.bind(c),createGain:c.createGain.bind(c)};
      const music=new WaterSound.Music(clock,c.destination,GardenMusicAssets,()=>.5);
      music.select('water');time=.6;music.select('snow');time=.7;music.select('water');time=1.5;music.select('cloud');
      const rendered=(await c.startRendering()).getChannelData(0);let largestJump=0;
      for(let i=1;i<rendered.length;i++)largestJump=Math.max(largestJump,Math.abs(rendered[i]-rendered[i-1]));
      return {first:rendered[0],atFadeIn:rendered[800],settled:rendered[30000],largestJump,voices:music.inspect().voices};
    });
    assert.equal(pcm.first,0);assert(pcm.atFadeIn>0&&pcm.atFadeIn<.2);assert(Math.abs(pcm.settled-.42)<.0001);assert(pcm.largestJump<.0003);
    reports.push({scenario:'actual WebAudio PCM has a gentle entry and scene requests do not change its gain',...pcm,result:'passed'});
    await page.evaluate(()=>{const update=WaterSound.Music.prototype.update;WaterSound.Music.prototype.update=function(){window.sharedMusic=this;return update.apply(this,arguments);};});
    await page.mouse.click(195,410);
    await page.waitForFunction(()=>WaterGarden.inspect().music.voices.length===1);
    await page.evaluate(()=>{window.firstWaterVoice=sharedMusic.tracks.water.node;window.firstMusicTime=sharedMusic.context.currentTime;});
    const snapshots=[];
    for(const scene of ['water','snow','cloud','water']){
      await page.locator('button[data-scene="'+scene+'"]').click();
      await page.waitForFunction(scene=>NatureGarden.inspect().scene===scene&&WaterGarden.inspect().sceneTransition.phase==='idle',scene);
      await page.waitForFunction(()=>WaterGarden.inspect().music.voices.some(v=>v.scene==='water'&&!v.fading));
      const state=await page.evaluate(()=>WaterGarden.inspect().music);snapshots.push(state);
      const current=state.voices[0];assert(current.loop&&current.offset>0&&current.offset<current.duration/2);
      assert(await page.evaluate(()=>sharedMusic.tracks.water.node===firstWaterVoice),'scene changes must retain the same playback source');
      assert.equal(state.scene,'water');assert.equal(state.voices.length,1);
    }
    for(let i=0;i<12;i++)await page.locator('button[data-scene="'+['snow','cloud','water'][i%3]+'"]').click();
    await page.waitForTimeout(1800);assert.equal((await page.evaluate(()=>WaterGarden.inspect().music)).voices.length,1);
    assert(await page.evaluate(()=>sharedMusic.tracks.water.node===firstWaterVoice&&sharedMusic.context.currentTime>firstMusicTime+2),'rapid switching neither restarts nor pauses shared music');
    const paused=await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));return WaterGarden.inspect().music;});
    assert.equal(paused.voices.length,0);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(()=>WaterGarden.inspect().music.voices.length===1);
    assert.equal((await page.evaluate(()=>WaterGarden.inspect().music)).scene,'water');assert.equal(networkRequests,0);
    reports.push({scenario:'one continuous water loop across water/snow/cloud and rapid switches; hidden-page release and resume over file URL',snapshots,networkRequests,result:'passed'});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'music-browser-report.json'),JSON.stringify({browser:await browser.version(),reports,errors},null,2)+'\n');
    console.log('Music browser checks passed: '+reports.length+' scenarios');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
