const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Snow, Clouds } = require('../src/nature-core.js');
const SceneTransition = require('../src/scene-transition.js');
const { Fling } = require('../src/nature-core.js');
const { Settings, local } = require('../src/garden-tuning.js');

test('a fling uses recent world-space travel, stops after a held pause and rejects stale or invalid tuning', () => {
  const f=new Fling(.2,.5,0,.5);f.sample(.24,.5,.02);f.sample(.28,.5,.04);
  const v=f.velocity(.05);assert(Math.abs(v[0]-12)<1e-8);assert.equal(v[1],0);
  assert.deepEqual(f.velocity(.16),[0,0]);assert.deepEqual(f.velocity(.01),[0,0]);
  f.sample(NaN,0,.17);assert.deepEqual(f.velocity(.17),[0,0]);
  const settings=new Settings();settings.load('{"friction":99,"inertia":0,"growth":"bad","unknown":8}');
  assert.equal(settings.values.friction,6);assert.equal(settings.values.inertia,0);assert.equal(settings.values.growth,.035);assert.equal(settings.values.unknown,undefined);
  settings.load('invalid');settings.reset();assert.equal(settings.values.friction,4.6);
  for(const host of ['localhost','127.0.0.1','[::1]'])assert(local({hostname:host,protocol:'http:'},false));
  assert(!local({hostname:'example.com',protocol:'https:'},false));assert(!local({hostname:'localhost.example.com',protocol:'http:'},false));
  assert(!local({hostname:'',protocol:'file:'},false));assert(!local({hostname:'localhost',protocol:'http:'},true));
});
test('a thrown sphere rolls, grows, rotates, leaves snow tracks and comes to a finite stop', () => {
  const snow=new Snow(),ball=snow.ball(.3,.5,.02),start=ball.u;
  assert(snow.launch(ball,6,0));const first=ball.vx;
  for(let i=0;i<20;i++)snow.advance(.02);
  assert(ball.u>start+.08);assert(ball.radius>.02);assert(ball.vx>0&&ball.vx<first);assert.notDeepEqual(ball.rotation,[0,0,0,1]);assert(snow.inspect().markedCells>0);
  for(let i=0;i<250;i++)snow.advance(.02);
  assert.equal(ball.vx,0);assert.equal(ball.vz,0);const stopped=snow.inspect();snow.advance(.08);assert.deepEqual(snow.inspect(),stopped);
});
test('inertia tuning changes travel live; slow releases do not launch and grabbing a ball stops it', () => {
  const values=new Settings().values,snow=new Snow(values),ball=snow.ball(.3,.5,.02);
  assert.equal(snow.launch(ball,.2,0),false);assert.equal(ball.vx,0);
  values.inertia=0;assert.equal(snow.launch(ball,10,0),false);
  values.inertia=2;values.maxSpeed=4;snow.launch(ball,12,0);assert.equal(ball.vx,4);
  snow.advance(.02,null,b=>b===ball);assert.equal(ball.u,.3);snow.stopBall(ball);assert.equal(ball.vx,0);
  const distances=[];
  for(const friction of [.3,6]){values.friction=friction;snow.clear();const b=snow.ball(.3,.5,.02);snow.launch(b,4,0);for(let i=0;i<40;i++)snow.advance(.02);distances.push(b.u-.3);}
  assert(distances[0]>distances[1]*1.8);
});
test('inertial spheres merge with volume and momentum conservation, stay inside the field and stop on reset', () => {
  const snow=new Snow({growth:0,inertia:1}),a=snow.ball(.3,.5,.04),b=snow.ball(.4,.5,.04),volume=a.radius**3+b.radius**3;
  snow.launch(a,6,0);for(let i=0;i<40;i++)snow.advance(.02);
  assert.equal(snow.balls.length,1);assert.equal(b.mergedInto,a);assert(Math.abs(a.radius**3-volume)<1e-12);assert(a.vx<3);
  snow.clear();const edge=snow.ball(snow.origin+snow.span-.03,.5,.02);snow.launch(edge,10,0);for(let i=0;i<20;i++)snow.advance(.02);
  assert(edge.u<=snow.origin+snow.span-edge.radius/snow.aspect+1e-8);assert.equal(edge.vx,0);
  snow.launch(edge,-8,0);snow.stopMotion();assert.equal(edge.vx,0);snow.clear();assert.equal(snow.advance(.02),0);assert.equal(snow.launch(edge,5,0),false);
});
test('inertial travel agrees across frame rates and shares world-space contact with the rendered sphere', () => {
  const positions=[];let supportChecks=0;
  for(const dt of [1/30,1/60]){const snow=new Snow({growth:0}),ball=snow.ball(.3,.5,.025);snow.launch(ball,5,0);for(let i=0;i<Math.round(.8/dt);i++)snow.advance(dt,b=>{supportChecks++;return snow.ballCenter(b);});positions.push(ball.u);}
  assert(Math.abs(positions[0]-positions[1])<1e-8);assert.equal(supportChecks,0,'distant spheres avoid unnecessary full terrain contact sampling');
  const snow=new Snow({growth:0}),a=snow.ball(.3,.5,.04),b=snow.ball(.4,.5,.04);
  snow.launch(a,6,0);for(let i=0;i<30;i++)snow.advance(.02,ball=>[(ball.u-.5)*12,ball===a?2:.48,(ball.v-.5)*12,ball.radius*12]);
  assert.equal(snow.balls.length,2,'world-space elevation separates a nearby but lower sphere');
});

test('scene swaps happen only under an opaque veil and reveal the live destination', () => {
  const t = new SceneTransition('water', false);
  assert(t.request('snow')); assert.equal(t.current, 'water'); assert.equal(t.opacity, 0);
  assert.equal(t.update(.14), null); assert.equal(t.current, 'water'); assert(Math.abs(t.opacity - .5) < 1e-8);
  assert.equal(t.update(.14), 'snow'); assert.equal(t.opacity, 1);
  assert.equal(t.update(.28), null); assert(Math.abs(t.opacity - .5) < 1e-8);
  t.update(.28); assert.deepEqual(t.inspect(), {current:'snow',target:'snow',phase:'idle',opacity:0});
});
test('rapid requests preserve opacity, skip superseded scenes and can return to the current scene', () => {
  const t = new SceneTransition('water', false);
  t.request('snow'); t.update(.14); const level = t.opacity;
  t.request('cloud'); assert.equal(t.opacity, level); assert.equal(t.update(.14), 'cloud');
  t.update(.20); const revealed = t.opacity;
  t.request('snow'); assert.equal(t.opacity, revealed);
  t.request('cloud'); assert.equal(t.opacity, revealed); t.update(1);
  assert.equal(t.current, 'cloud'); assert.equal(t.phase, 'idle');
  t.request('water'); t.update(.1); const covered = t.opacity;
  t.request('cloud'); assert.equal(t.opacity, covered); t.update(1);
  assert.equal(t.current, 'cloud'); assert.equal(t.opacity, 0);
});
test('hidden pages settle the latest destination; repeated clicks and reduced motion remain bounded', () => {
  for (const reduced of [false, true]) {
    const t = new SceneTransition('water', reduced);
    assert.equal(t.request('water'), false); assert.equal(t.request('invalid'), false);
    t.request('snow'); t.update(.05); const before=t.inspect();
    assert.equal(t.request('snow'), false); assert.deepEqual(t.inspect(), before);
    t.request('cloud'); assert.equal(t.finish(), 'cloud'); assert.equal(t.finish(), null);
    assert.deepEqual(t.inspect(), {current:'cloud',target:'cloud',phase:'idle',opacity:0});
    t.request('water'); let commits = 0;
    for(let i=0;i<100;i++){if(t.update(.01))commits++;assert(t.opacity>=0&&t.opacity<=1);}
    assert.equal(commits,1); assert.equal(t.phase,'idle');
  }
});

test('fast cloud gestures open deeper gaps without widening the brush',()=>{
  const slow=new Clouds(),fast=new Clouds();
  slow.touch(.5,.5,'part',.003,0,.016,.03);fast.touch(.5,.5,'part',.003,0,.016,.8);
  const center=fast.field.index(.5,.5);
  assert(fast.field.depth[center]>slow.field.depth[center]*3);
  assert.equal(fast.field.depth.filter(v=>v!==0).length,slow.field.depth.filter(v=>v!==0).length);
});
test('cloud openings recover quickly then leave a wispy tail without rising above the base surface',()=>{
  const cloud=new Clouds();cloud.touch(.5,.5,'part',.01,0,.06,.8);
  const field=cloud.field,center=field.index(.5,.5),start=field.depth[center];
  for(let i=0;i<30;i++)cloud.update(1/60,true,false);
  const half=field.depth[center];
  assert(half<start*.6,'fresh gaps close visibly within half a second');
  assert(field.depth.every(v=>v>=0)&&field.renderDepth().every(v=>v>=0),'recovery and render smoothing create no raised cloud');
  for(let i=0;i<30;i++)cloud.update(1/60,true,false);
  assert(field.depth[center]/half>half/start,'late recovery is slower');
  assert(field.depth.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
});

test('parting clouds builds a soft depression over time instead of cutting to full depth on contact', () => {
  const cloud=new Clouds(),field=cloud.field;
  cloud.touch(.5,.5,'part',0,0,.016);
  const first=field.depth[field.index(.5,.5)];assert(first>0&&first<.15);
  for(let i=0;i<30;i++)cloud.touch(.5,.5,'part',0,0,.016);
  assert(field.depth[field.index(.5,.5)]>first*3);
  assert(field.depth.every(v=>v>=0),'a soft opening has no surrounding snow-like banks');
});

test('snowfall fills depressions and smooths banks at twice the previous rate, without overshooting', () => {
  const snow=new Snow();snow.depth[0]=.5;snow.depth[1]=-.5;
  snow.update(5,true);
  assert(Math.abs(snow.depth[0]-.28)<1e-6);
  assert(Math.abs(snow.depth[1]+.28)<1e-6);
  snow.update(100,false);assert(Math.abs(snow.depth[0]-.28)<1e-6);
  snow.update(100,true);assert.equal(snow.depth[0],0);assert.equal(snow.depth[1],0);
});

test('footprints have a mirrored medial arch, broad forefoot, heel and conserved displaced snow', () => {
  const radius=.09;
  for(const side of [-1,1]){
    const snow=new Snow();snow.foot=side===-1?0:1;
    snow.footprint(.5,.5,0,radius);
    const u=.5+radius*.65*side;
    const depth=(x,y)=>snow.depth[snow.index(u+x*radius*side,.5+y*radius)];
    assert(depth(.25,.25)>.2,'outer sole joins forefoot to heel');
    assert(depth(-.25,.25)<.05,'medial arch stays inset');
    assert(depth(0,-.4)>.4,'forefoot presses into snow');
    assert(depth(0,.57)>.4,'heel presses into snow');
    assert(Math.abs(snow.depth.reduce((sum,d)=>sum+d,0))<.001,'snow moves to the rim');
  }
});

test('a snow stroke stays continuous, local and persistent without snowfall', () => {
  const snow = new Snow(); snow.aspect = .46;
  snow.stroke(.2, .5, .8, .5, .022, .8);
  for (let u = .25; u < .8; u += .025) assert(snow.depth[snow.index(u,.5)] > .5);
  assert.equal(snow.depth[snow.index(.5,.75)], 0);
  const before = snow.inspect(); snow.update(100, false); assert.deepEqual(snow.inspect(), before);
  snow.update(10, true); assert(snow.inspect().depth < before.depth);
  snow.update(100, true); assert.equal(snow.inspect().markedCells, 0);
});
test('snow pressure is bounded and affects positions above the former cutoff', () => {
  const snow = new Snow();
  for (let i = 0; i < 100; i++) snow.stamp(.5, .3, .04, 1);
  assert(snow.depth.every(d => Number.isFinite(d) && d <= 1 && d >= -1));
  assert(snow.depth[snow.index(.5,.28)]>0);
});
test('rolling a selected snowball grows it and leaves a compressed track', () => {
  const snow = new Snow(); snow.aspect = .46;
  const ball = snow.ball(.3, .5, .02);
  snow.roll(ball, .75, .6);
  assert(ball.radius > .02); assert(snow.inspect().markedCells > 30);
  snow.roll(ball, 4, -2); assert(ball.u < snow.origin+snow.span && ball.v >= snow.origin);
  snow.clear(); assert.equal(snow.balls.length, 0); assert.equal(snow.inspect().markedCells, 0);
});
test('multiple snowballs stay in the shared geometry budget and reset clears them with footprints', () => {
  const snow = new Snow();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) snow.ball(.1 + x * .2, .32 + y * .13, .02);
  assert.equal(snow.balls.length, 12);assert.equal(snow.ball(.9,.9,.02),null,'a full scene keeps existing balls instead of deleting them');
  snow.footprint(.5, .5, 0, .04); assert.equal(snow.inspect().footprints, 1);
  snow.clear(); assert.equal(snow.inspect().footprints, 0);assert.equal(snow.balls.length,0);
});
test('fresh snowballs have a visible seed radius and grow only with finite rolling travel',()=>{
  const snow=new Snow(),ball=snow.startBall(.3,.5);assert.equal(ball.radius,.01);
  snow.roll(ball,.3,.5);assert.equal(ball.radius,.01);assert.deepEqual(ball.rotation,[0,0,0,1]);
  snow.roll(ball,.6,.5);assert(Math.abs(ball.radius-.0205)<1e-12);assert(ball.rotation.every(Number.isFinite));
  assert(Math.abs(Math.hypot(...ball.rotation)-1)<1e-12);assert(snow.inspect().markedCells>0);
  const before=snow.inspect();snow.roll(ball,NaN,0);assert.deepEqual(snow.inspect(),before);
});
test('initial snowball size scales with the viewport and tuning affects only future balls',()=>{
  const settings=new Settings();settings.values.growth=0;
  for(const aspect of [.462,1,2.16]){
    const snow=new Snow(settings.values);snow.aspect=aspect;settings.set('initialRadius',.025);
    const first=snow.startBall(.3,.5);assert.equal(first.radius,.025*Math.min(aspect,1));
    settings.set('initialRadius',.04);const second=snow.startBall(.7,.5);assert.equal(second.radius,.04*Math.min(aspect,1));
    snow.roll(first,.35,.5);assert.equal(first.radius,.025*Math.min(aspect,1),'zero growth preserves a visible existing ball');
    assert.equal(settings.values.growth,0);settings.set('initialRadius',0);assert.equal(snow.startBall(.5,.8).radius,.01*Math.min(aspect,1));
  }
});
test('touching sphere meshes merge by summed volume, including chain collisions',()=>{
  const snow=new Snow(),a=snow.ball(.3,.5,.02),b=snow.ball(.345,.5,.03),c=snow.ball(.385,.5,.02);
  const volume=a.radius**3+b.radius**3+c.radius**3;
  snow.mergeBalls(a);assert.equal(snow.balls.length,2);assert.equal(b.mergedInto,a);
  snow.roll(a,.365,.5);assert.equal(snow.balls.length,1);assert.equal(c.mergedInto,a);
  assert(a.radius**3>=volume&&a.radius>.03,'merged volume is preserved while rolling continues to gather snow');
  assert.equal(snow.roll(b,.8,.5),null,'a consumed ball cannot reappear through another finger');
  snow.clear();assert.equal(snow.roll(a,.5,.5),null,'reset leaves no stale rolling handles');
});
test('sphere contact uses height and a swept path, rather than overlapping ground circles',()=>{
  const snow=new Snow(),a=snow.ball(.3,.5,.04),b=snow.ball(.341,.5,.002);
  snow.mergeBalls(a);assert.equal(snow.balls.length,2,'very different radii do not merge before the actual spheres touch');
  snow.clear();const rolling=snow.ball(.1,.5,.02),hit=snow.ball(.5,.5,.025),nearby=snow.ball(.5,.65,.02);
  snow.roll(rolling,.9,.5);assert.equal(snow.balls.length,2);assert.equal(hit.mergedInto,rolling);assert(snow.balls.includes(nearby));
  snow.clear();const raised=snow.ball(.4,.5,.03),lower=snow.ball(.45,.5,.03);
  snow.mergeBalls(raised,null,ball=>[(ball.u-.5)*12,ball===raised?2:.36,(ball.v-.5)*12,ball.radius*12]);
  assert.equal(snow.balls.length,2,'world-space elevation separates spheres on different snow banks');
  snow.clear();const distant=snow.ball(.1,.5,0);snow.ball(.8,.5,.02);let samples=0;
  snow.roll(distant,.3,.5,ball=>{samples++;return snow.ballCenter(ball);});
  assert.equal(samples,0,'rolling away from other spheres needs no repeated terrain support sampling');
});
test('merging conserves radius cubed and a large merged sphere never shrinks while rolling',()=>{
  const snow=new Snow(),a=snow.ball(.3,.5,.08),b=snow.ball(.44,.5,.08);
  const volume=a.radius**3+b.radius**3;snow.mergeBalls(a);assert.equal(snow.balls.length,1);
  assert(Math.abs(a.radius**3-volume)<1e-15);const radius=a.radius;snow.roll(a,.55,.5);assert(a.radius>=radius);
});
test('parting clouds opens a local gap which recovers over time', () => {
  const clouds = new Clouds(); clouds.aspect = .46;
  const before = clouds.inspect().opacity;
  clouds.touch(clouds.items[0].u-.01, clouds.items[0].v, 'part', 0, 0, .5);
  assert(clouds.inspect().opacity < before); assert(clouds.inspect().motion > 0);
  const gap = clouds.inspect().opacity;
  for (let i = 0; i < 300; i++) clouds.update(1 / 30, false, false);
  assert(clouds.inspect().opacity > gap); assert.equal(clouds.items.length, 72);
});
test('cloud gathering is unsupported and cannot create raised material', () => {
  const clouds = new Clouds(); clouds.items = [{ u: .53, v: .5, homeV: .5, vx: 0, vy: 0, opacity: .2 }];
  const before=clouds.inspect();clouds.touch(.5,.5,'gather',0,0,.2);
  assert.deepEqual(clouds.inspect(),before);assert(clouds.field.depth.every(v=>v===0));
});

test('cloud thinning uses a broad feather while the wider halo pushes sideways without carving', () => {
  const cloud=new Clouds();cloud.touch(.5,.5,'part',0,0,.01);
  const field=cloud.field,reach=.045;
  for(let y=0;y<field.size;y++)for(let x=0;x<field.size;x++){
    if(field.depth[y*field.size+x]!==0)assert(Math.hypot(field.origin+x/field.size*field.span-.5,field.origin+y/field.size*field.span-.5)<=reach+1e-6);
  }
  const at=v=>field.depth[field.index(.5,v)];
  assert(at(.5)>at(.51)&&at(.51)>at(.52)&&at(.52)>at(.53));
  assert(at(.53)>0);assert.equal(at(.55),0);
  assert(cloud.offset(.5,.59)[1]>0,'the outer cloud moves even beyond the opening');
  assert(Math.hypot(...cloud.offset(.5,.615))<Math.hypot(...cloud.offset(.5,.59))*.1,'the outer edge feathers to rest');
  assert.deepEqual(cloud.offset(.5,.64),[0,0]);
  assert(field.depth.every(v=>v>=0));
});
test('continuous cloud displacement pushes radially, is isotropic, bounded and recovers after release',()=>{
  for(const aspect of [.46,1,2]){
    const cloud=new Clouds();cloud.aspect=aspect;const r=Math.min(aspect,1)*.075;
    for(let i=0;i<30;i++)cloud.touch(.5,.5,'part',.01,0,.016,.8);
    const right=cloud.offset(.5+r/aspect,.5),left=cloud.offset(.5-r/aspect,.5),down=cloud.offset(.5,.5+r),up=cloud.offset(.5,.5-r);
    assert(right[0]>0&&left[0]<0&&down[1]>0&&up[1]<0);
    assert(Math.abs(right[0]*aspect-down[1])<.002,'equal world radii produce equal travel');
    assert(cloud.pushX.every(v=>Number.isFinite(v)&&Math.abs(v)<.08));
    assert(cloud.pushY.every(v=>Number.isFinite(v)&&Math.abs(v)<.08));
    const start=right[0];cloud.update(.5,false,true);assert(cloud.offset(.5+r/aspect,.5)[0]<start*.7);
    cloud.update(20,false,true);assert.equal(cloud.pushActive,false);assert(cloud.pushX.every(v=>v===0));
    cloud.touch(.5,.5,'part',0,0,.1);cloud.clear();assert.deepEqual(cloud.offset(.55,.5),[0,0]);
    cloud.touch(NaN,.5,'part',0,0,.1);assert.equal(cloud.pushActive,false);
  }
});
test('reduced motion suppresses ambient drift while direct cloud interaction still works', () => {
  const clouds = new Clouds(), first = clouds.items[0].u;
  clouds.update(1, true, true); assert.equal(clouds.items[0].u, first); assert.equal(clouds.time, 0);
  clouds.touch(clouds.items[0].u-.01, clouds.items[0].v, 'part', .1, 0, .2);
  clouds.update(.05, false, true); assert(clouds.items[0].u > first);
  clouds.clear(); assert.equal(clouds.inspect().motion, 0); assert.equal(clouds.inspect().opacity, 72);
});
test('cloud channels have no displaced rims and refill while snow channels retain their banks', () => {
  const cloud=new Clouds(),snow=new Snow();cloud.aspect=.46;snow.aspect=.46;
  cloud.touch(.5,.5,'part',0,0,.2);snow.stamp(.5,.5,.03,.8);
  assert(cloud.field.depth.every(d=>d>=0));assert(snow.depth.some(d=>d<0),'snow still builds banks');
  const before=cloud.field.inspect().depth, snowBefore=snow.inspect().depth;
  cloud.update(2,false,true);snow.update(2,false);
  assert(cloud.field.inspect().depth<before);assert.equal(snow.inspect().depth,snowBefore);
  assert(cloud.field.depth.every(d=>d>=0));
  cloud.clear();assert.equal(cloud.field.inspect().depth,0);assert.equal(cloud.flowX,0);
});
test('ambient breeze moves the continuous cloud material',()=>{
  const calm=new Clouds(),breeze=new Clouds();calm.update(1,false,false);breeze.update(1,true,false);assert(breeze.flowX>calm.flowX*2);
});
function volume(field){let dug=0,piled=0;for(const d of field.depth){if(d>0)dug+=d;else piled-=d;}return {dug,piled,balance:dug-piled};}
test('a channel moves its missing volume to both shoulders and repeated pressure creates no material',()=>{
  const snow=new Snow();snow.aspect=.46;snow.stroke(.18,.5,.82,.5,.023,.75);
  const at=(u,v)=>snow.depth[snow.index(u,v)];
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
  const snow=new Snow();snow.stroke(.1,.5,.9,.5,.04,.8);const old=snow.depth[snow.index(.5625,.5)];
  snow.stroke(.5,.35,.5,.7,.045,.8);
  assert(snow.depth[snow.index(.5625,.5)]<old,'a new shoulder can refill a previously carved cell');
  assert(Math.abs(volume(snow).balance)<.003);
});
test('repeated full-field cloud sweeps and relaxation never build raised banks',()=>{
  const clouds=new Clouds();clouds.aspect=.46;
  for(let pass=0;pass<3;pass++)for(let y=.3;y<.86;y+=.045)for(let x=0;x<=1;x+=.035)clouds.touch(x,y,'part',0,0,.1);
  const v=volume(clouds.field);assert(v.dug>500);assert.equal(v.piled,0);
  assert(clouds.field.renderDepth().every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  for(const reduced of [false,true])for(const dt of [1/60,.2,4]){
    clouds.update(dt,true,reduced);assert(clouds.field.depth.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
    assert(clouds.field.renderDepth().every(v=>v>=0));
  }
  assert(volume(clouds.field).dug<v.dug);
});
test('snow and cloud carving crosses all old rectangle limits and extends beyond the viewport coordinates',()=>{
  for(const field of [new Snow(),new Clouds().field]){
    for(const [u,v] of [[-.15,.5],[1.15,.5],[.5,-.35],[.5,1.1],[.5,.28],[.5,.87]]){
      field.stamp(u,v,.035,.8);assert(field.depth[field.index(u,v)]>.7);
    }
    if(field.soft)assert.equal(volume(field).piled,0);else assert(Math.abs(volume(field).balance)<.003);
  }
});
test('render smoothing removes one-cell teeth while preserving volume and untouched terrain',()=>{
  const snow=new Snow();snow.depth[snow.index(.5,.5)]=1;snow.depth[snow.index(.6,.5)]=-1;snow.revision++;
  const filtered=snow.renderDepth();assert(filtered[snow.index(.5,.5)]<.25);assert(filtered[snow.index(.5,.5)+1]>0);
  assert(Math.abs(filtered.reduce((a,b)=>a+b,0))<1e-6);assert.equal(filtered[snow.index(.9,.9)],0);
  assert.equal(snow.renderDepth(),filtered);snow.clear();assert(snow.renderDepth().every(v=>v===0));
});
