const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets-source/audio/runtime');
fs.mkdirSync(out,{recursive:true});
const origins={water:'https://s2.aigei.com/src/aud/mp3/8c/8c7247cee6f24112b7dcb36d8de9bf5d.mp3',snow:'https://s8.aigei.com/src/aud/mp3/6f/6fef120da6c84af2a38246b5bdd0dfcc.mp3',cloud:'https://s8.aigei.com/src/aud/mp3/43/43213dd532ed44afad49c8aa13559297.mp3'};
const manifest={date:'2026-10-04',origin:'User-provided signed Aigei download URLs; originals preserved without modification.',encoding:'Full duration, mono, 22050 Hz, MP3 32 kbps; no trimming or normalization.',tracks:{}};
function metadata(file){
  const bytes=fs.readFileSync(file),probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-show_entries','stream=sample_rate,channels','-of','json',file],{encoding:'utf8'});
  if(probe.error)throw probe.error;if(probe.status!==0)throw Error(probe.stderr);
  const info=JSON.parse(probe.stdout);
  return {bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),duration:Number(info.format.duration),sampleRate:Number(info.streams[0].sample_rate),channels:info.streams[0].channels};
}
for(const scene of ['water','snow','cloud']){
  const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',path.join(root,'assets-source/audio/'+scene+'-music.mp3'),'-map_metadata','-1','-ac','1','-ar','22050','-codec:a','libmp3lame','-b:a','32k',path.join(out,scene+'-music.mp3')],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
  manifest.tracks[scene]={origin:origins[scene],original:metadata(path.join(root,'assets-source/audio/'+scene+'-music.mp3')),runtime:metadata(path.join(out,scene+'-music.mp3'))};
}
fs.writeFileSync(path.join(root,'assets-source/audio/music-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
