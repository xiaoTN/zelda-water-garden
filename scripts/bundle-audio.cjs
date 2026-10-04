const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const bytes=fs.readFileSync(path.join(root,'assets-source/audio/water-tap.mp3'));
// The uploader accepts scripts; this tiny encoded sample is decoded directly by Web Audio.
const asset={bytes:bytes.length,base64:bytes.toString('base64')};
fs.writeFileSync(path.join(root,'src/water-tap-asset.js'),'(function(root){\n  "use strict";\n  root.WaterTapAsset='+JSON.stringify(asset)+';\n  if(typeof module!=="undefined"&&module.exports)module.exports=root.WaterTapAsset;\n}(typeof window!=="undefined"?window:global));\n');
console.log('Bundled water tap sample: '+bytes.length+' bytes');
