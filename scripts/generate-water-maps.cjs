// Deterministic, seamless source textures; no downloaded assets or build dependencies.
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const size=256,tau=Math.PI*2;
function crc(data){let c=0xffffffff;for(const v of data){c^=v;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const tag=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);tag.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([tag,data])),data.length+8);return out;}
function png(name,sample){const raw=Buffer.alloc(size*(size*4+1));for(let y=0;y<size;y++)for(let x=0;x<size;x++){const rgba=sample(x/size,y/size);for(let k=0;k<4;k++)raw[y*(size*4+1)+1+x*4+k]=Math.max(0,Math.min(255,Math.round(rgba[k])));}const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;fs.writeFileSync(path.join(__dirname,'../src',name),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]));}
const maps=require('../src/water-maps.js');
for(const kind of ['normal','foam']){const data=maps.pixels(kind);png('water-'+kind+'.png',(u,v)=>Array.from(data.subarray((Math.round(v*size)*size+Math.round(u*size))*4,(Math.round(v*size)*size+Math.round(u*size))*4+4)));}
console.log('Generated two seamless 256×256 water maps.');
