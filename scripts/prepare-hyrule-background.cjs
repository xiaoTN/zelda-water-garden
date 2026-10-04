const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'),file=path.join(root,'tmp/hyrule-aerial.jpg');
fs.mkdirSync(path.dirname(file),{recursive:true});
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',path.join(root,'assets-source/hyrule-aerial/hyrule-aerial.png'),'-vf','scale=1024:1024:flags=lanczos','-q:v','22',file],{windowsHide:true});
const bytes=fs.readFileSync(file);if(bytes.length>102400)throw new Error('Aerial background must fit the 100 KiB inline image budget');
fs.writeFileSync(path.join(root,'src/hyrule-background.js'),'// Original generated aerial artwork; see assets-source/hyrule-aerial.\nwindow.HyruleBackground="data:image/jpeg;base64,'+bytes.toString('base64')+'";\n');
console.log('1024x1024 aerial background: '+bytes.length+' bytes');
