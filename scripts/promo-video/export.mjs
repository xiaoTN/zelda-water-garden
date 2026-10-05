import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const raw=path.join(root,'tmp/promo-raw.mp4');
const output=path.join(root,'artifacts/promo/moment-water-promo-v5.mp4');
const shots=JSON.parse(readFileSync(path.join(here,'src/timeline.json'),'utf8'));
const seconds=Math.max(...shots.map(s=>s.from+s.duration))/30;
mkdirSync(path.dirname(output),{recursive:true});
function run(bin,args) {
  const r=spawnSync(bin,args,{cwd:here,stdio:'inherit'});
  if(r.error)throw r.error;
  if(r.status!==0)process.exit(r.status??1);
}
const reuseIndex=process.argv.indexOf('--reuse-video');
if(reuseIndex!==-1) {
  // Audio-only revision: reuse approved picture packets and mix the same timeline PCM.
  const picture=process.argv[reuseIndex+1];
  if(!picture)throw new Error('--reuse-video requires an existing film path');
  const inputs=shots.flatMap(s=>['-i',path.join(here,`public/audio/${s.id}.wav`)]);
  const delayed=shots.map((s,i)=>`[${i+1}:a]adelay=${Math.round(s.from/30*48000)}S:all=1[a${i}]`);
  const mix=shots.map((s,i)=>`[a${i}]`).join('')+`amix=inputs=${shots.length}:normalize=0,apad=whole_dur=${seconds}[mix]`;
  run('ffmpeg',['-hide_banner','-loglevel','error','-y','-threads','1','-i',path.resolve(picture),...inputs,
    '-filter_complex',[...delayed,mix].join(';'),'-map','0:v:0','-map','[mix]',
    '-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t',String(seconds),'-movflags','+faststart',output]);
} else {
run(process.execPath,['node_modules/@remotion/cli/remotion-cli.js','render','src/index.ts','WaterPromo',raw,'--offthreadvideo-video-threads=1']);
// Measured in this pipeline: Remotion 4.0.484 / AAC / 48 kHz / MP4 = +2048 samples.
// Correct the complete mixed track once; picture packets are copied unchanged.
run('ffmpeg',['-hide_banner','-loglevel','error','-y','-threads','1','-i',raw,
  '-af',`atrim=start_sample=2048,asetpts=PTS-STARTPTS,apad=whole_dur=${seconds}`,
  '-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t',String(seconds),'-movflags','+faststart',output]);
}
console.log(`Exported synchronized film: ${output}`);
