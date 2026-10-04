const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
for(const [name,globalName] of [['water-tap','WaterTapAsset'],['water-swipe','WaterSwipeAsset'],['stone-impact','StoneImpactAsset']]){
  const bytes=fs.readFileSync(path.join(root,'assets-source/audio/'+name+'.mp3'));
  // Small encoded samples are decoded directly by Web Audio, without media URLs.
  const asset={bytes:bytes.length,base64:bytes.toString('base64')};
  fs.writeFileSync(path.join(root,'src/'+name+'-asset.js'),'(function(root){\n  "use strict";\n  root.'+globalName+'='+JSON.stringify(asset)+';\n  if(typeof module!=="undefined"&&module.exports)module.exports=root.'+globalName+';\n}(typeof window!=="undefined"?window:global));\n');
  console.log('Bundled '+name+' sample: '+bytes.length+' bytes');
}
