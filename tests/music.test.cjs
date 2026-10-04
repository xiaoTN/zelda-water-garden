const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Music}=require('../src/water-audio.js');
function fixture(){
  const decodes=[],nodes=[],events=[];
  const c={state:'running',currentTime:0,decodeAudioData(bytes,done,fail){decodes.push({done,fail});},createBuffer(channels,length,rate){const data=Array.from({length:channels},()=>new Float32Array(length).fill(1));return {length,sampleRate:rate,numberOfChannels:channels,duration:length/rate,getChannelData:i=>data[i]};},createBufferSource(){const n={connect(){},disconnect(){this.disconnected=true;},start(time,offset){this.offset=offset;},stop(){this.stopped=true;}};nodes.push(n);return n;},createGain(){const n={gain:{value:0,cancelScheduledValues(){},setValueAtTime(v,t){events.push({value:v,time:t});},setTargetAtTime(v,t,tau){events.push({target:v,time:t,tau});}},connect(){},disconnect(){this.disconnected=true;}};nodes.push(n);return n;}};
  const asset={base64:Buffer.from('music').toString('base64')},music=new Music(c,{}, {water:asset,snow:asset,cloud:asset},()=>.5);
  return {music,c,decodes,nodes,events,decode:i=>decodes[i].done(c.createBuffer(1,80000,8000))};
}
for(const scene of ['water','snow','cloud'])test(scene+' music packages its full optimized recording within the Base64 budget',()=>{
  const asset=require('../src/'+scene+'-music-asset.js'),bytes=fs.readFileSync(path.join(__dirname,'../assets-source/audio/runtime/'+scene+'-music.mp3'));
  assert(Buffer.from(asset.base64,'base64').equals(bytes));assert.equal(asset.bytes,bytes.length);assert(asset.bytes<1024*1024);
  assert(fs.statSync(path.join(__dirname,'../assets-source/audio/'+scene+'-music.mp3')).size>bytes.length);
});
test('music loops from the first half, reverses a fade without duplicating a scene and frees old decoded buffers',()=>{
  const f=fixture(),{music,c}=f;music.select('water');assert.equal(f.decodes.length,1);music.update();assert.equal(f.decodes.length,1);f.decode(0);
  const voice=music.tracks.water.node;assert(voice.source.loop);assert(voice.offset>0&&voice.offset<voice.source.buffer.duration/2);assert.equal(voice.source.buffer.duration,9.2);
  c.currentTime=.1;music.select('snow');f.decode(1);assert(music.tracks.water.fadeEnd);assert(music.tracks.snow.node);
  c.currentTime=.2;music.select('water');assert.equal(music.tracks.water.node,voice);assert.equal(music.tracks.water.fadeEnd,0);assert.equal(f.decodes.length,2);
  assert(f.events.filter(e=>e.tau).every(e=>e.tau===.25));assert(f.events.some(e=>e.value>0&&e.value<.42));
  c.currentTime=2;music.update();assert.equal(music.tracks.snow.node,null);assert.equal(music.tracks.snow.buffer,null);
  music.select('cloud');f.decode(2);c.currentTime=4;music.update();assert.equal(music.inspect().voices.length,1);assert.equal(music.inspect().voices[0].scene,'cloud');
  music.stop();assert.equal(music.inspect().voices.length,0);assert(f.nodes.every(n=>n.disconnected));
});
test('music ignores stale decoding after a switch or hide and restarts only the current scene on resume',()=>{
  const f=fixture(),{music,c}=f;music.select('water');music.select('snow');f.decode(0);assert.equal(music.tracks.water.node,null);assert.equal(music.tracks.water.buffer,null);
  music.stop();f.decode(1);assert.equal(music.inspect().voices.length,0);assert.equal(music.tracks.snow.buffer,null);
  c.state='suspended';music.select('cloud');assert.equal(f.decodes.length,2);c.state='running';music.update();assert.equal(f.decodes.length,3);f.decode(2);assert.equal(music.inspect().voices[0].scene,'cloud');
  music.stop();music.select('water');f.decodes[3].fail();music.update();assert.equal(music.inspect().voices.length,0);assert.equal(f.decodes.length,4);
});
