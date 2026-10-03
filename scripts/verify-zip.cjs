// Read the real ZIP directory, inflate each file, and compare it with src/.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),assert=require('assert');
const allowed=new Set(['.jpg','.css','.gif','.svg','.png','.js','.jpeg','.json','.html','.woff2','.webp','.woff']);
module.exports=function verifyZip(file){
  const archive=fs.readFileSync(file),source=path.resolve(__dirname,'../src');let end=-1;
  for(let i=archive.length-22;i>=Math.max(0,archive.length-65557);i--)if(archive.readUInt32LE(i)===0x06054b50){end=i;break;}
  assert(end>=0,'missing ZIP directory');assert.equal(archive.readUInt16LE(end+4),0,'multi-disk ZIP unsupported');
  const entries=archive.readUInt16LE(end+10),expected=[];let cursor=archive.readUInt32LE(end+16);const actual=new Set();
  function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,item.name);if(item.isDirectory())walk(full);else expected.push(path.relative(source,full).split(path.sep).join('/'));}}walk(source);
  for(let i=0;i<entries;i++){
    assert.equal(archive.readUInt32LE(cursor),0x02014b50,'invalid ZIP entry');
    const method=archive.readUInt16LE(cursor+10),size=archive.readUInt32LE(cursor+20),plainSize=archive.readUInt32LE(cursor+24),nameSize=archive.readUInt16LE(cursor+28),extraSize=archive.readUInt16LE(cursor+30),commentSize=archive.readUInt16LE(cursor+32),offset=archive.readUInt32LE(cursor+42);
    const name=archive.subarray(cursor+46,cursor+46+nameSize).toString('utf8');cursor+=46+nameSize+extraSize+commentSize;
    if(name.endsWith('/'))continue;
    assert(!name.includes('\\')&&!name.startsWith('/')&&!name.split('/').includes('..'),'unsafe ZIP path');
    assert(allowed.has(path.extname(name).toLowerCase()),'unsupported uploader type: '+name);assert(!actual.has(name),'duplicate ZIP entry');actual.add(name);
    assert.equal(archive.readUInt32LE(offset),0x04034b50,'invalid local header');
    const begin=offset+30+archive.readUInt16LE(offset+26)+archive.readUInt16LE(offset+28),data=archive.subarray(begin,begin+size);
    assert(method===0||method===8,'unsupported compression');const plain=method===0?data:zlib.inflateRawSync(data);
    assert.equal(plain.length,plainSize,'incorrect expanded size');assert(plain.equals(fs.readFileSync(path.join(source,name))),'content differs from source: '+name);
  }
  assert(actual.has('index.html'),'index.html must be at ZIP root');assert.deepEqual([...actual].sort(),expected.sort(),'ZIP file list differs from source');
  console.log('Verified '+actual.size+' ZIP files, root index.html, allowed extensions and source bytes');
};
if(require.main===module)module.exports(process.argv[2]);
