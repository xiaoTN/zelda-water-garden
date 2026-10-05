const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
for(const [name,globalName] of [['water-tap','WaterTapAsset'],['water-swipe','WaterSwipeAsset'],['stone-impact','StoneImpactAsset'],['water-ripples','WaterRipplesAsset'],['snowball-roll','SnowballRollAsset']]){
  const bytes=fs.readFileSync(path.join(root,'assets-source/audio/'+name+'.mp3'));
  // Small encoded samples are decoded directly by Web Audio, without media URLs.
  const asset={bytes:bytes.length,base64:bytes.toString('base64')};
  if(name==='snowball-roll'){asset.seconds=10;asset.overlap=.6;}
  fs.writeFileSync(path.join(root,'src/'+name+'-asset.js'),'(function(root){\n  "use strict";\n  root.'+globalName+'='+JSON.stringify(asset)+';\n  if(typeof module!=="undefined"&&module.exports)module.exports=root.'+globalName+';\n}(typeof window!=="undefined"?window:global));\n');
  console.log('Bundled '+name+' sample: '+bytes.length+' bytes');
}
for(const scene of ['water']){
  const bytes=fs.readFileSync(path.join(root,'assets-source/audio/runtime/'+scene+'-music.mp3'));
  if(bytes.length>1024*1024)throw Error('Music asset exceeds the inline audio budget');
  const asset={bytes:bytes.length,base64:bytes.toString('base64')};
  fs.writeFileSync(path.join(root,'src/'+scene+'-music-asset.js'),'(function(root){\n  "use strict";\n  root.GardenMusicAssets=root.GardenMusicAssets||{};\n  root.GardenMusicAssets.'+scene+'='+JSON.stringify(asset)+';\n  if(typeof module!=="undefined"&&module.exports)module.exports=root.GardenMusicAssets.'+scene+';\n}(typeof window!=="undefined"?window:global));\n');
  console.log('Bundled '+scene+' music: '+bytes.length+' bytes');
}
// Preserve original recordings in assets-source; only the shared water track ships.
for(const scene of ['snow','cloud']){
  const unused=path.join(root,'src/'+scene+'-music-asset.js');
  if(fs.existsSync(unused))fs.unlinkSync(unused);
}
