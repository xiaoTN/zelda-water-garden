const path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const result=spawnSync('ffmpeg',['-hide_banner','-y','-i',path.join(root,'assets-source/audio/snowball-roll-original.mp3'),'-t','10','-map_metadata','-1','-ac','1','-ar','22050','-c:a','libmp3lame','-b:a','48k',path.join(root,'assets-source/audio/snowball-roll.mp3')],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status===null?1:result.status;
