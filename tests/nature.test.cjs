const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Snow, Clouds } = require('../src/nature-core.js');

test('a snow stroke stays continuous, local and persistent without snowfall', () => {
  const snow = new Snow(); snow.aspect = .46;
  snow.stroke(.2, .5, .8, .5, .022, .8);
  for (let u = .25; u < .8; u += .025) assert(snow.depth[Math.floor(.5 * snow.size) * snow.size + Math.floor(u * snow.size)] > .5);
  assert.equal(snow.depth[Math.floor(.75 * snow.size) * snow.size + Math.floor(.5 * snow.size)], 0);
  const before = snow.inspect(); snow.update(100, false); assert.deepEqual(snow.inspect(), before);
  snow.update(10, true); assert(snow.inspect().depth < before.depth);
  snow.update(100, true); assert.equal(snow.inspect().markedCells, 0);
});
test('snow pressure is bounded and never paints above the snow field', () => {
  const snow = new Snow();
  for (let i = 0; i < 100; i++) snow.stamp(.5, .3, .04, 1);
  assert(snow.depth.every(d => Number.isFinite(d) && d <= 1 && d >= -1));
  assert(snow.depth.slice(0, Math.floor(.29 * snow.size) * snow.size).every(d => d === 0));
});
test('rolling a selected snowball grows it and leaves a compressed track', () => {
  const snow = new Snow(); snow.aspect = .46;
  const ball = snow.ball(.3, .5, .02); assert.equal(snow.ball(.3, .5, .02), ball);
  snow.roll(ball, .75, .6);
  assert(ball.radius > .02); assert(snow.inspect().markedCells > 30);
  snow.roll(ball, 4, -2); assert(ball.u < 1 && ball.v >= .31);
  snow.clear(); assert.equal(snow.balls.length, 0); assert.equal(snow.inspect().markedCells, 0);
});
test('snowballs have a fixed population cap and reset footprints', () => {
  const snow = new Snow();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) snow.ball(.1 + x * .2, .32 + y * .13, .02);
  assert.equal(snow.balls.length, 12);
  snow.footprint(.5, .5, 0, .04); assert.equal(snow.inspect().footprints, 1);
  snow.clear(); assert.equal(snow.inspect().footprints, 0);
});
test('parting clouds opens a local gap which recovers over time', () => {
  const clouds = new Clouds(); clouds.aspect = .46;
  const before = clouds.inspect().opacity;
  clouds.touch(.5, .5, 'part', 0, 0, .5);
  assert(clouds.inspect().opacity < before); assert(clouds.inspect().motion > 0);
  const gap = clouds.inspect().opacity;
  for (let i = 0; i < 300; i++) clouds.update(1 / 30, false, false);
  assert(clouds.inspect().opacity > gap); assert.equal(clouds.items.length, 72);
});
test('gather pulls nearby clouds inward and wind follows the drag direction', () => {
  const clouds = new Clouds(); clouds.items = [{ u: .6, v: .5, homeV: .5, vx: 0, vy: 0, opacity: .2 }];
  clouds.touch(.5, .5, 'gather', 0, 0, .2); clouds.update(.08, false, true);
  assert(clouds.items[0].u < .6); assert(clouds.items[0].opacity > .2);
  clouds.items[0].vx = 0; clouds.touch(.5, .5, 'wind', .1, 0, .1);
  assert(clouds.items[0].vx > 0);
});
test('reduced motion suppresses ambient drift while direct cloud interaction still works', () => {
  const clouds = new Clouds(), first = clouds.items[0].u;
  clouds.update(1, true, true); assert.equal(clouds.items[0].u, first); assert.equal(clouds.time, 0);
  clouds.touch(clouds.items[0].u, clouds.items[0].v, 'wind', .1, 0, .2);
  clouds.update(.05, false, true); assert(clouds.items[0].u > first);
  clouds.clear(); assert.equal(clouds.inspect().motion, 0); assert.equal(clouds.inspect().opacity, 72);
});
test('cloud sea channels retain displaced rims and refill while snow channels persist', () => {
  const cloud=new Clouds(),snow=new Snow();cloud.aspect=.46;snow.aspect=.46;
  cloud.touch(.5,.5,'part',0,0,.2);snow.stamp(.5,.5,.03,.8);
  assert(cloud.field.depth.some(d=>d<0),'a cloud channel has displaced material at its edge');
  const before=cloud.field.inspect().depth, snowBefore=snow.inspect().depth;
  cloud.update(2,false,true);snow.update(2,false);
  assert(cloud.field.inspect().depth<before);assert.equal(snow.inspect().depth,snowBefore);
  cloud.touch(.5,.5,'gather',0,0,.6);assert(cloud.field.depth[160*320+160]<0,'gather raises the center using surrounding material');
  cloud.clear();assert.equal(cloud.field.inspect().depth,0);assert.equal(cloud.flowX,0);
});
test('breeze and direct vertical wind move the continuous cloud material',()=>{
  const calm=new Clouds(),breeze=new Clouds();calm.update(1,false,false);breeze.update(1,true,false);assert(breeze.flowX>calm.flowX*2);
  const wind=new Clouds();wind.touch(.5,.5,'wind',0,-.1,.1);wind.update(.2,false,true);assert(wind.flowY<0);
});
function volume(field){let dug=0,piled=0;for(const d of field.depth){if(d>0)dug+=d;else piled-=d;}return {dug,piled,balance:dug-piled};}
test('a channel moves its missing volume to both shoulders and repeated pressure creates no material',()=>{
  const snow=new Snow();snow.aspect=.46;snow.stroke(.18,.5,.82,.5,.023,.75);
  const at=(u,v)=>snow.depth[Math.round(v*320)*320+Math.round(u*320)];
  assert(at(.5,.5)>.6);assert(at(.5,.467)<-.1);assert(at(.5,.533)<-.1);
  let v=volume(snow);assert(v.piled>100);assert(Math.abs(v.balance)<.001);
  snow.stamp(.5,.5,.023,.75);const previous=volume(snow);
  for(let i=0;i<200;i++)snow.stamp(.5,.5,.023,.75);
  v=volume(snow);assert(Math.abs(v.dug-previous.dug)<.001);assert(Math.abs(v.piled-previous.piled)<.001);
});
test('covering the complete playable field repeatedly retains displaced snow instead of lowering the entire sheet',()=>{
  for(const aspect of [.46,1.5]){
    const snow=new Snow();snow.aspect=aspect;
    for(let pass=0;pass<3;pass++)for(let y=.29;y<=.86;y+=.028){
      if(pass%2)snow.stroke(1,y,0,y,.028,.8);else snow.stroke(0,y,1,y,.028,.8);
    }
    const v=volume(snow);assert(v.dug>500&&v.piled>500);assert(Math.abs(v.balance)<.02);
    assert(snow.depth.some(d=>d<-.3));assert(snow.depth.every(d=>Number.isFinite(d)&&d>=-1&&d<=1));
  }
});
test('crossing an old trench refills it locally and moves its old banks without deleting snow',()=>{
  const snow=new Snow();snow.stroke(.1,.5,.9,.5,.04,.8);const old=snow.depth[160*320+180];
  snow.stroke(.5,.35,.5,.7,.045,.8);
  assert(snow.depth[160*320+180]<old,'a new shoulder can refill a previously carved cell');
  assert(Math.abs(volume(snow).balance)<.003);
});
test('cloud part, gather and relaxation preserve displaced volume across a full-field sweep',()=>{
  const clouds=new Clouds();clouds.aspect=.46;
  for(let y=.3;y<.86;y+=.045)for(let x=0;x<=1;x+=.035)clouds.touch(x,y,'part',0,0,.1);
  let v=volume(clouds.field);assert(v.dug>500&&v.piled>500);assert(Math.abs(v.balance)<.01);
  const center=160*320+160;for(let i=0;i<60;i++)clouds.touch(.5,.5,'gather',0,0,1/30);
  assert(clouds.field.depth[center]<-.5);v=volume(clouds.field);assert(Math.abs(v.balance)<.01);
  clouds.update(4,false,true);const relaxed=volume(clouds.field);assert(relaxed.dug<v.dug&&relaxed.piled<v.piled);assert(Math.abs(relaxed.balance)<.01);
});
