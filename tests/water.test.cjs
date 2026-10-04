const { test } = require('node:test');
const assert = require('node:assert/strict');
const { WaveField, IceField, shore, bufferSize, waterMesh, updateMesh, seededRandom } = require('../src/water-core.js');
const terrain = require('../src/terrain.js');
const {System: FallingStones,limit:stoneLimit}=require('../src/falling-stones.js');
const fishAsset=require('../src/fish-asset.js');
const {System: FishSchool}=require('../src/fish.js');

test('animated fish geometry raises displayed water depth and clears old footprints without altering the solid bed',()=>{
  for(const low of [false,true]){
    const aspect=.6,bed=terrain.bathymetry(terrain.create(aspect,low),aspect,low),school=new FishSchool();school.attach(aspect);
    const base=Array.from(bed.pixels),physical=Array.from(bed.heights);
    const depth=p=>(p[0]*256+p[1])/65535*.6-.3;
    const state=terrain.dynamicDepth(bed,school.geometry());let raised=0,max=0;
    for(let i=0;i<base.length;i+=4){const delta=depth(state.pixels.subarray(i,i+2))-depth(base.slice(i,i+2));if(delta>.01)raised++;max=Math.max(max,delta);assert.equal(state.pixels[i+2],base[i+2]);assert.equal(state.pixels[i+3],base[i+3]);}
    assert(raised>25&&max>.05,'real fish surfaces must affect the water depth color');
    assert.deepEqual(Array.from(bed.pixels),base);assert.deepEqual(Array.from(bed.heights),physical);
    const old=Array.from(state.pixels);school.items.forEach(f=>f.u+=.10);
    assert.equal(terrain.dynamicDepth(bed,school.geometry(),state),state,'reuse depth storage');
    assert.notDeepEqual(Array.from(state.pixels),old,'depth silhouette must follow swimming geometry');
    terrain.dynamicDepth(bed,new Float32Array(0),state);assert.deepEqual(Array.from(state.pixels),base,'removing fish must leave no depth trails');
  }
});

test('nearby strokes startle fish, accelerate the Blender swim cycle and then decay',()=>{
  const calm=new FishSchool(),scared=new FishSchool();calm.attach(1);scared.attach(1);
  const f=scared.items[0],u=f.u-.045,v=f.v,bed={heightAt:()=>-.22};
  scared.scare(u,v,1,u-.2,v);
  assert(f.fear>.5);assert.equal(scared.items[3].fear,0,'distant fish should stay calm');
  const before=Math.hypot(f.u-u,(f.v-v)/.866);
  for(let i=0;i<45;i++){calm.update(1/30,bed,false);scared.update(1/30,bed,false);}
  assert(f.speed>calm.items[0].speed*1.5);
  assert(f.swim>calm.items[0].swim*1.4,'existing Blender animation must play faster without a phase jump');
  assert(f.y<calm.items[0].y-.015,'startled fish dive');
  assert(Math.hypot(f.u-u,(f.v-v)/.866)>before+.03,'fish swim away from the hand');
  for(let i=0;i<360;i++)scared.update(1/30,bed,false);
  assert(f.fear<.002);assert(f.speed<.06,'fish return to a gentle cruise');
});

test('water moves fish and shallow fish feed back bounded wakes without repainting pool depth',()=>{
  const flat=new FishSchool(),wave=new FishSchool();flat.attach(1);wave.attach(1);
  const bed={heightAt:()=>-.22},still={sample:()=>0,ice:{sample:()=>0},disturb:()=>{}},sloped={sample:(u,v)=>(u-.3)*2,ice:{sample:()=>0},disturb:()=>{}};
  for(let i=0;i<30;i++){flat.update(1/30,bed,false,still);wave.update(1/30,bed,false,sloped);}
  assert(wave.items[0].flowX<-.025,'wave slope pushes the body');
  assert(wave.items[0].u<flat.items[0].u-.006,'water must change the actual position, not just its appearance');
  const field=new WaveField(96,96,1);field.setBathymetry(bed);const school=new FishSchool();school.attach(1);
  const originalMask=Array.from(field.mask),originalDepth=Array.from(field.depthScale);
  let maximum=0;
  for(let i=0;i<600;i++){school.update(1/30,bed,false,field);field.step();field.step();maximum=Math.max(maximum,field.energy());}
  assert(maximum>.00001&&maximum<1,'swimming must make small stable waves');
  assert(school.items.every(f=>f.fear===0),'fish must not panic from their own small wakes');
  assert.deepEqual(Array.from(field.mask),originalMask);assert.deepEqual(Array.from(field.depthScale),originalDepth);
  field.clear();school.calm();school.update(.08,bed,false,field);assert.equal(field.energy(),0);
  field.ice.current.fill(1);for(let i=0;i<90;i++)school.update(1/30,bed,false,field);assert.equal(field.energy(),0,'fish cannot disturb solid ice');
});

test('a new stone overlapping a fish does not trap it forever or teleport it',()=>{
  const school=new FishSchool();school.attach(1);const f=school.items[0],u=f.u,v=f.v;
  const bed={heightAt:(x,y)=>Math.hypot((x-u)*2,(y-v)/.4330127)<.13?.03:-.22};
  school.scare(u,v,1.5);
  for(let i=0;i<600;i++){const a=f.u,b=f.v;school.update(1/30,bed,false);assert(Math.hypot((f.u-a)*2,(f.v-b)/.4330127)<.01);}
  assert(school.clearAt(f.u,f.v,f.size,bed),'fish must be able to leave a newly occupied footprint');
});

test('Blender fish asset contains a closed swim cycle with stronger tail movement and an animated GLB',()=>{
  assert.equal(fishAsset.poses.length,24);
  assert.equal(fishAsset.materials.length,fishAsset.indices.length/3);
  assert(fishAsset.indices.every(i=>i>=0&&i<fishAsset.vertexCount));
  assert(fishAsset.poses.every(p=>p.length===fishAsset.vertexCount*3&&p.every(Number.isFinite)));
  const motion=index=>{const zs=fishAsset.poses.map(p=>p[index*3+2]);return Math.max(...zs)-Math.min(...zs);};
  const rest=fishAsset.poses[0];let head=0,tail=0;
  for(let i=0;i<fishAsset.vertexCount;i++){if(rest[i*3]>.35*fishAsset.scale)head=Math.max(head,motion(i));if(rest[i*3]<-.75*fishAsset.scale)tail=Math.max(tail,motion(i));}
  assert(tail>head*5,'tail must visibly bend relative to the head');
  const distance=(a,b)=>Math.sqrt(a.reduce((s,x,i)=>s+(x-b[i])**2,0));
  const seam=distance(fishAsset.poses[23],fishAsset.poses[0]);
  const largestStep=Math.max(...fishAsset.poses.slice(1).map((p,i)=>distance(p,fishAsset.poses[i])));
  assert(seam<=largestStep*1.05,'loop wrap must be no larger than an ordinary frame step');
  const bytes=require('fs').readFileSync(require('path').join(__dirname,'../assets-source/fish/garden-koi.glb'));
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)).trim());
  assert(gltf.skins.length>0&&gltf.animations[0].channels.length>=3,'GLB must preserve the animated rig');
});

test('fish keep a bounded underwater footprint around banks and obstacles across aspect ratios',()=>{
  for(const aspect of [.38,.462,1,2.2]){
    const school=new FishSchool();school.attach(aspect);
    const bed={heightAt:(u,v)=>Math.hypot((u-.5)*aspect*2,(v-.49)/.4330127)<.075?0:-.22};
    let moved=0;
    for(let step=0;step<2400;step++){
      const before=school.items.map(f=>[f.u,f.v]);school.update(1/30,bed,false);
      school.items.forEach((f,i)=>{
        const d=Math.hypot((f.u-before[i][0])*aspect*2,(f.v-before[i][1])/.4330127);
        assert(d<.002,'movement cannot teleport');moved+=d;
        assert(school.clearAt(f.u,f.v,f.size*school.scale,bed),'fish footprint must remain in clear water');
      });
    }
    assert(moved>1,'fish must continue swimming');
    const vertices=school.geometry();assert.equal(vertices.length/33,1175);
    assert(vertices.every(Number.isFinite));
    for(let i=1;i<vertices.length;i+=11)assert(vertices[i]<-.035,'the entire fish must remain underwater');
    const frozen=Array.from(vertices),clock=school.clock;
    school.update(.08,bed,true);assert.equal(school.clock,clock);assert.deepEqual(Array.from(school.geometry()),frozen);
    school.update(.08,bed,false);assert.equal(school.geometry(),vertices,'reuse the animation buffer');
    assert.notDeepEqual(Array.from(vertices),frozen);
  }
});

test('even small stone waves spread wider and carry much more energy than a finger stroke',()=>{
  for(const aspect of [.38,.462,1,2.2]){
    const w=aspect>=1?192:Math.max(64,Math.round(192*aspect)),h=aspect>=1?Math.max(64,Math.round(192/aspect)):192;
    const finger=new WaveField(w,h,aspect),small=new WaveField(w,h,aspect),large=new WaveField(w,h,aspect);
    finger.stroke(.4,.49,.6,.49,.17);
    small.stoneImpact(.5,.49,.075*Math.sqrt(Math.min(aspect,1)));
    large.stoneImpact(.5,.49,.185*Math.sqrt(Math.min(aspect,1)));
    const widthAcrossStroke=field=>{
      let low=h,high=0;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(Math.abs(field.current[y*w+x])>.02){low=Math.min(low,y);high=Math.max(high,y);}
      return high-low;
    };
    assert(widthAcrossStroke(small)>widthAcrossStroke(finger)*3,'the smallest rock needs a broad displacement, not a narrow finger wake');
    assert(large.energy()>small.energy()*2,'larger rocks must displace more water');
    let stoneEnergy=0,fingerEnergy=0;
    for(let frame=0;frame<=30;frame++){
      stoneEnergy+=small.energy();fingerEnergy+=finger.energy();
      small.step();large.step();finger.step();
    }
    assert(stoneEnergy>fingerEnergy*4,'stone waves need much more energy over the first half-second, including troughs between crests');
  }
});

test('stone entry still pushes surrounding water when an existing rock blocks its center',()=>{
  const field=new WaveField(128,128,1);
  field.setBathymetry({heightAt:(u,v)=>Math.hypot(u-.5,v-.49)<.035?.1:-.16});
  assert.equal(field.disturb(.5,.49,.95,.06),false);
  assert.equal(field.stoneImpact(.5,.49,.075),true);
  assert(field.energy()>1,'the exposed perimeter must receive the impact');
  for(let frame=0;frame<60;frame++)field.step();
  for(let i=0;i<field.mask.length;i++)if(!field.mask[i])assert.equal(field.current[i],0);
});

test('compressed stones settle without ground contact chatter or spontaneous wakes',()=>{
  const s=new FallingStones(),scene=terrain.create(.462,true),random=seededRandom(6*713);
  s.attach(.462,terrain.bathymetry(scene,.462,true),scene);
  s.add(.5,.49,random);s.add(.5,.49,random);
  for(let i=0;i<2400;i++)s.update(1/120);
  assert(s.items.every(r=>r.settled),'quiet compressed rocks must settle within 20 seconds');
  const pose=s.items.map(r=>({position:r.body.position.clone(),quaternion:r.body.quaternion.clone()}));
  for(let i=0;i<600;i++){
    s.update(1/120);
    for(let j=0;j<2;j++){
      const r=s.items[j];assert(r.settled,'resting contacts must not spontaneously wake');
      assert(r.body.position.distanceTo(pose[j].position)<1e-8);
      assert.deepEqual(r.body.quaternion,pose[j].quaternion);
    }
  }
});

test('five touching rocks rest as a group without repeatedly waking each other',()=>{
  const s=new FallingStones(),scene=terrain.create(.462,true),random=seededRandom(2*713);
  s.attach(.462,terrain.bathymetry(scene,.462,true),scene);
  for(let i=0;i<5;i++)s.add(.5,.49,random);
  for(let i=0;i<2400;i++)s.update(1/120);
  assert(s.items.every(r=>r.settled),'the resting contact group must settle');
  const positions=s.items.map(r=>r.body.position.clone());
  for(let i=0;i<600;i++)s.update(1/120);
  for(let i=0;i<5;i++){assert(s.items[i].settled);assert(s.items[i].body.position.distanceTo(positions[i])<1e-8);}
});

test('faceted contact friction does not sustain motion in a resting pile',()=>{
  for(const seed of [10,14]){
  const s=new FallingStones(),scene=terrain.create(.462,true),random=seededRandom(seed*713);
  s.attach(.462,terrain.bathymetry(scene,.462,true),scene);
  for(let i=0;i<3;i++)s.add(.5,.49,random);
  let residual=0;
  for(let i=0;i<2400;i++){
    s.update(1/120);
    if(i>1800)for(const rock of s.items)residual=Math.max(residual,rock.body.velocity.length()+rock.radius*rock.body.angularVelocity.length());
  }
  assert(residual<.04,'contact friction must not sustain visible micro-oscillation');
  assert(s.items.every(r=>r.settled));
  }
});

test('a new impact wakes the complete resting support group and it settles again',()=>{
  const s=new FallingStones(),scene=terrain.create(.462,true),random=seededRandom(2*713);
  s.attach(.462,terrain.bathymetry(scene,.462,true),scene);
  for(let i=0;i<3;i++)s.add(.5,.49,random);
  for(let i=0;i<2400;i++)s.update(1/120);
  const member=s.items.find(r=>r.restGroup&&r.restGroup.length>1);
  assert(member,'fixture must form a supported resting pile');
  const group=member.restGroup.slice(),top=group.reduce((a,b)=>a.top>b.top?a:b);
  assert(s.add(top.u,top.v,()=>.99));
  let together=false;
  for(let i=0;i<3000;i++){s.update(1/120);if(group.every(r=>!r.settled))together=true;}
  assert(together,'impact must wake every rock in the supporting contact group');
  assert(s.items.every(r=>r.settled),'the disturbed pile must return to stable rest');
});

test('stone undersides have irregular facets and rendering matches the full collision hull',()=>{
  const s=new FallingStones();s.attach(1,{heightAt:()=>-.22});
  for(let seed=1;seed<=8;seed++){
    const rock=s.add(.5,.49,seededRandom(seed*713)),shape=rock.body.shapes[0];
    const lower=shape.vertices.filter(v=>v.y<0).map(v=>v.y);
    assert(lower.length>=6);assert(Math.max(...lower)-Math.min(...lower)>rock.height*.25);
    assert(shape.faces.every(face=>face.length===3),'no broad planar cap on any side');
    assert.equal(rock.local.length,shape.faces.length*33);assert(rock.local.length<=96*11);
  }
  assert.equal(s.geometry(false).length,s.items.reduce((n,r)=>n+r.local.length,0));
});

test('large stones lose almost all head-on rebound energy at mutual contact',()=>{
  const s=new FallingStones();s.attach(1,{heightAt:()=>-.22});
  const a=s.add(.3,.5,()=>.99),b=s.add(.7,.5,()=>.99);s.world.gravity.set(0,0,0);
  for(const rock of [a,b]){rock.body.position.y=1;rock.body.quaternion.set(0,0,0,1);rock.body.angularVelocity.set(0,0,0);}
  a.body.position.x=-.21;b.body.position.x=.21;a.body.velocity.set(.7,0,0);b.body.velocity.set(-.7,0,0);
  let contacts=0;
  for(let i=0;i<180;i++){
    s.world.step(1/240);
    for(const contact of s.world.contacts)if(contact.bi.mass&&contact.bj.mass){contacts++;assert.equal(contact.restitution,0);}
  }
  assert(contacts>0);assert(Math.abs(a.body.velocity.x)<.08&&Math.abs(b.body.velocity.x)<.08,'head-on impact must not rebound like an elastic ball');
});

test('rigid stones accelerate, rotate, impact once and settle without sinking through the bed',()=>{
  const stones=new FallingStones(),events=[];stones.attach(1,{heightAt:()=>-.22});
  const rock=stones.add(.5,.49,()=>.8),start=rock.y;assert(start>1.5);assert.equal(stones.geometry(true).length,0);
  stones.update(.08,(event)=>events.push(event));const delta1=start-rock.y;
  stones.update(.08,(event)=>events.push(event));const delta2=start-delta1-rock.y;
  assert(delta2>delta1);assert.equal(rock.entered,false);assert.deepEqual(events,[]);
  const rotation=rock.body.quaternion.clone();let rotated=false;
  for(let i=0;i<1200;i++){
    stones.update(1/120,(event)=>events.push(event));
    const q=rock.body.quaternion;if(Math.abs(rotation.x*q.x+rotation.y*q.y+rotation.z*q.z+rotation.w*q.w)<.9999)rotated=true;
  }
  assert.equal(events.filter(e=>e==='impact').length,1);assert(events.includes('settled'));assert(rock.settled);
  assert(Math.abs(rock.y+.22)<.004);assert.equal(stones.impacts,1);
  assert(rotated,'orientation must evolve physically without requiring a large tumble');
  assert(stones.geometry(true).length>0);assert.equal(stones.shadows().length,0);
  stones.attach(.46,{heightAt:()=>-.18});for(let i=0;i<600;i++)stones.update(1/120);
  assert(rock.settled);assert(Math.abs(rock.y+.18)<.004);assert.equal(stones.items.length,1);
  stones.clear();stones.update(.08,(event)=>events.push(event));assert.equal(stones.items.length,0);assert.equal(stones.geometry(false).length,0);assert.equal(stones.impacts,0);
});

test('same-point rigid bodies collide, transfer momentum, roll apart and sleep',()=>{
  const stones=new FallingStones();stones.attach(1,{heightAt:()=>-.22});
  for(let i=0;i<3;i++)assert(stones.add(.5,.49,()=>.8));
  assert(stones.items[1].y>stones.items[0].top);
  let collisions=0;stones.items[0].body.addEventListener('collide',e=>{if(e.body.mass>0)collisions++;});
  for(let i=0;i<2400;i++)stones.update(1/120);
  assert(collisions>0,'rigid bodies must generate mutual contact');
  assert(stones.items.every(s=>s.settled));assert(stones.items.some(s=>Math.abs(s.u-.5)>.04),'contact must allow lateral motion');
  assert(stones.items.every(s=>s.y>-.224));assert.equal(stones.shadows().length,0);
  assert.equal(stones.geometry(true).length,stones.items.reduce((n,s)=>n+s.local.length,0));
  const sleeping=stones.items[0],previous=sleeping.body.position.clone();
  assert(stones.add(sleeping.u+.025,sleeping.v,()=>.99));let woke=false,maxMotion=0;
  for(let i=0;i<1800;i++){stones.update(1/120);if(!sleeping.settled)woke=true;maxMotion=Math.max(maxMotion,sleeping.body.position.distanceTo(previous));}
  assert(woke,'a new collision must wake a resting rock');
  assert(maxMotion>.003,'impact must move existing stones');
});

test('random stone sizes, capacity and cancellation are bounded',()=>{
  const stones=new FallingStones();stones.attach(1,{heightAt:()=>-.22});
  const small=stones.add(.35,.45,()=>0),large=stones.add(.7,.55,()=>.99);assert(large.radius>small.radius*2);
  assert(stones.add(.35,.45));assert.equal(stones.add(0,0),false);
  stones.clear();let events=0;stones.add(.5,.49);stones.update(.08);stones.clear();for(let i=0;i<100;i++)stones.update(.04,()=>events++);assert.equal(events,0);
  for(const v of [.28,.48,.68])for(const u of [.2,.4,.6,.8])stones.add(u,v,()=>0);
  assert.equal(stones.items.length,stoneLimit);
  const existing=stones.items.slice(),bodyCount=stones.world.bodies.length;
  assert.equal(stones.add(0,0),false);assert.deepEqual(stones.items,existing,'invalid targets must not remove a stone');
  for(let i=0;i<stoneLimit+2;i++){
    const oldest=stones.items[0],next=stones.items[1],added=stones.add(.5,.49,()=>.3);
    assert(added);assert.equal(stones.items.length,stoneLimit);assert.equal(stones.items[0],next);
    assert.equal(stones.items[stoneLimit-1],added);assert(!stones.world.bodies.includes(oldest.body));
    assert.equal(stones.world.bodies.length,bodyCount,'replacement must release the old physics body');
  }
  const before=stones.items[0].y;stones.update(0);assert.equal(stones.items[0].y,before);
});

test('replacing the oldest stone wakes its resting support group without stale members',()=>{
  const s=new FallingStones(),scene=terrain.create(.462,true),random=seededRandom(2*713);
  s.attach(.462,terrain.bathymetry(scene,.462,true),scene);
  for(let i=0;i<3;i++)s.add(.5,.49,random);
  for(let i=0;i<2400;i++)s.update(1/120);
  const oldest=s.items[0],neighbour=s.items[1],unrelated=s.items[2];
  assert(oldest.restGroup.includes(neighbour));assert(neighbour.settled);
  while(s.items.length<stoneLimit)assert(s.add(.75,.4,()=>0));
  assert(s.add(.75,.4,()=>0));
  assert(!s.world.bodies.includes(oldest.body));assert(!neighbour.settled);assert.equal(neighbour.restGroup,null);
  assert(unrelated.settled,'unrelated resting rocks should remain asleep');
  s.update(1/120);
  for(const stone of s.items)assert(!stone.restGroup||!stone.restGroup.includes(oldest));
});

test('fixed physics steps agree across frame rates and ten overlapping drops stay bounded',()=>{
  function simulate(dt){const s=new FallingStones();s.attach(.8,{heightAt:()=>-.22});s.add(.5,.49,()=>.65);for(let i=0;i<Math.round(4/dt);i++)s.update(dt);return s.items[0].body;}
  const a=simulate(1/30),b=simulate(1/60);assert(a.position.distanceTo(b.position)<.00001);assert(a.velocity.distanceTo(b.velocity)<.00001);
  const s=new FallingStones(),scene=terrain.create(.8,true),bed=terrain.bathymetry(scene,.8,true);s.attach(.8,bed,scene);
  for(let i=0;i<stoneLimit;i++)assert(s.add(.5,.49,()=>.2+i*.07));
  for(let i=0;i<3000;i++)s.update(1/120);
  assert(s.items.every(r=>Number.isFinite(r.y)&&r.y>-.24&&Math.abs(r.body.position.x)<1.1&&Math.abs(r.body.position.z)<1.5));
  assert(s.items.every(r=>r.settled),'the pile should eventually sleep');
  const bodyCount=s.world.bodies.length;s.clear();assert.equal(s.world.bodies.length,bodyCount-stoneLimit);
});

test('small rocks and shore contacts dissipate rolling motion and enter sleep',()=>{
  for(const [aspect,seed] of [[.462,11],[1.5,7]]){
    const s=new FallingStones(),scene=terrain.create(aspect,true),random=seededRandom(seed*713);
    s.attach(aspect,terrain.bathymetry(scene,aspect,true),scene);s.add(.5,.49,random);
    for(let i=0;i<1200;i++)s.update(1/120);
    s.add(.5,.49,random);s.add(.5,.49,random);
    for(let i=0;i<2400;i++)s.update(1/120);
    assert(s.items.every(r=>r.settled),'low-energy contact motion should sleep at every rock size');
  }
});

test('repeated drops dissipate impact energy instead of scattering across the pool',()=>{
  let totalTravel=0,maxLift=0,cases=0;
  for(const aspect of [.462,1.5]){
    const scene=terrain.create(aspect,true),bed=terrain.bathymetry(scene,aspect,true);
    for(let seed=1;seed<=8;seed++){
      const s=new FallingStones(),random=seededRandom(seed*713);s.attach(aspect,bed,scene);
      for(let i=0;i<3;i++)s.add(.5,.49,random);
      let travel=0;
      for(let i=0;i<2400;i++){
        s.update(1/120);
        for(const rock of s.items){
          travel=Math.max(travel,Math.hypot((rock.u-.5)*aspect*2,(rock.v-.49)*2/.8660254));
          if(rock.entered)maxLift=Math.max(maxLift,rock.y);
        }
      }
      totalTravel+=travel;cases++;
    }
  }
  assert(totalTravel/cases<.30,'average peak scattering must stay near the impact area');
  assert(maxLift<.08,'underwater collisions must not launch stones far above water');
});

test('displayed underwater depth reconstructs diagonal edges without large stair steps',()=>{
  const vertex=(u,v,y)=>[(u-.5)*2,y,(v-.5)*2/.8660254,u,v,0,1,0,1,1,1];
  const ground=new Float32Array([...vertex(0,0,-.22),...vertex(1,0,-.22),...vertex(0,1,-.22),...vertex(1,0,-.22),...vertex(1,1,-.22),...vertex(0,1,-.22)]);
  const stones=new Float32Array([...vertex(.3,.3,-.03),...vertex(.7,.61,-.03),...vertex(.3,.7,-.03)]);
  for(const low of [false,true]){
    const bed=terrain.bathymetry({ground,stones},1,low);
    const read=(x,y)=>{const i=(y*bed.width+x)*4;return (bed.pixels[i]*256+bed.pixels[i+1])/65535*.6-.3;};
    const height=(u,v)=>{
      const x=u*bed.width-.5,y=v*bed.height-.5,ix=Math.floor(x),iy=Math.floor(y),tx=x-ix,ty=y-iy;
      return (read(ix,iy)*(1-tx)+read(ix+1,iy)*tx)*(1-ty)+(read(ix,iy+1)*(1-tx)+read(ix+1,iy+1)*tx)*ty;
    };
    let maxError=0;
    for(let j=0;j<700;j++){
      const u=.36+j/700*.25,expected=.3+(u-.3)*.775;
      let a=expected-.015,b=expected+.015;
      for(let k=0;k<24;k++){const m=(a+b)/2;if(height(u,m)>-.125)b=m;else a=m;}
      maxError=Math.max(maxError,Math.abs((a+b)/2-expected)*1280);
    }
    assert(maxError<(low?1.3:.65),'a straight stone edge must stay straight at display scale');
    assert.equal(bed.heightAt(.4,.5),Math.fround(-.03),'physical stone heights must remain sharp');
  }
});

test('bathymetry comes from stone triangles and blocks waves and ice at dry footprints', () => {
  const mesh=terrain.create(.8,false),bed=terrain.bathymetry(mesh,.8,false),field=new WaveField(128,160,.8);
  field.setBathymetry(bed);
  let raisedWet=0,blocked=0;
  for(let y=0;y<bed.height;y++)for(let x=0;x<bed.width;x++) {
    const i=y*bed.width+x,u=(x+.5)/bed.width,v=(y+.5)/bed.height;
    if(bed.stone[i]&&bed.heights[i]<-.004&&bed.heights[i]>terrain.elevation(u,v)+.01)raisedWet++;
    const packed=(bed.pixels[i*4]*256+bed.pixels[i*4+1])/65535*.6-.3;
    let min=Infinity,max=-Infinity;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      const value=bed.heights[Math.max(0,Math.min(bed.height-1,y+dy))*bed.width+Math.max(0,Math.min(bed.width-1,x+dx))];
      min=Math.min(min,value);max=Math.max(max,value);
    }
    assert(packed>=min-.00001&&packed<=max+.00001,'visual reconstruction must not overshoot the local geometry');
  }
  assert(raisedWet>100,'submerged stone surfaces must make the local water shallower');
  for(let y=0;y<field.height;y++)for(let x=0;x<field.width;x++) {
    const i=y*field.width+x,u=x/(field.width-1),v=y/(field.height-1);
    if(shore(u,v)<-.007&&bed.heightAt(u,v)>=-.002){assert.equal(field.mask[i],0);blocked++;}
  }
  assert(blocked>20);
  field.stroke(.07,.2,.15,.75,.5);for(let i=0;i<180;i++)field.step();
  field.ice.paint(.5,.49,2,true,true);for(let i=0;i<50;i++)field.ice.update(.1);
  assert(field.ice.coverage()>.999);
  for(let i=0;i<field.mask.length;i++)if(!field.mask[i]){assert.equal(field.current[i],0);assert.equal(field.ice.current[i],0);}
});

test('solid barriers reflect instead of transmitting, including the finger brush', () => {
  const wall={heightAt:u=>Math.abs(u-.5)<.025?.1:-.16},field=new WaveField(101,101,1),open=new WaveField(101,101,1);
  field.setBathymetry(wall);open.setBathymetry({heightAt:()=>-.16});
  const i=49*101+47;field.current[i]=field.previous[i]=.5;open.current[i]=open.previous[i]=.5;
  field.step();open.step();assert(field.current[i]>open.current[i]+.1,'no-flux wall reflects the incident wave');
  field.clear();field.disturb(.45,.49,.6,.09);
  for(let t=0;t<220;t++)field.step();
  let left=0,right=0;
  for(let y=0;y<101;y++)for(let x=0;x<101;x++){if(x<47)left+=Math.abs(field.current[y*101+x]);if(x>53)right+=Math.abs(field.current[y*101+x]);}
  assert(left>0);assert.equal(right,0,'waves and brush impulses cannot cross a solid wall');
  assert.equal(field.disturb(.5,.49,1,.03),false);
});

test('shallower water propagates waves more slowly', () => {
  function arrival(depth) {
    const field=new WaveField(128,128,1);field.setBathymetry({heightAt:()=>-depth});field.disturb(.4,.49,.5,.012);
    for(let n=1;n<120;n++){field.step();if(Math.abs(field.sample(.55,.49))>.001)return n;}
    return 120;
  }
  assert(arrival(.025)>arrival(.16)*1.4);
});

test('3D terrain has submerged bed, dry bank and faceted shoreline rocks', () => {
  assert(terrain.elevation(.5,.49)<-.1);assert(terrain.elevation(.05,.1)>0);
  for(const aspect of [.38,1,2.2]) {
    const mesh=terrain.create(aspect,false),low=terrain.create(aspect,true);
    assert(low.ground.length<mesh.ground.length);
    assert((mesh.ground.length+mesh.stones.length+mesh.shadows.length)/33+32768<100000);
    assert(mesh.rocks.filter(r=>r.base<0&&r.top>.025).length>=8,'shore stones cross the water plane');
    assert(mesh.rocks.filter(r=>r.submerged&&r.top<0).length>=20);
    for(const data of [mesh.ground,mesh.stones,mesh.shadows]) {
      assert.equal(data.length%33,0);
      for(let i=0;i<data.length;i+=11) {
        assert(Array.from(data.subarray(i,i+11)).every(Number.isFinite));
        assert(Math.abs(Math.hypot(data[i+5],data[i+6],data[i+7])-1)<1e-5);
      }
    }
    const rock=mesh.rocks[112];
    assert(mesh.blocks(rock.u-rock.radius*.12/(2*aspect),rock.v-rock.radius*.08*.4330127-rock.top*.25),'dry rock top blocks water input');
    assert.equal(mesh.blocks(.5,.49),false);
  }
});

test('3D water mesh has valid topology, camera alignment and bounded low quality geometry', () => {
  for (const aspect of [.38,1,1.5,2.2]) {
    const mesh = waterMesh(aspect,false), low = waterMesh(aspect,true);
    assert(mesh.count < 65536); assert(mesh.indices.length / 3 <= 32768);
    assert(low.count < mesh.count / 2);
    for (const index of mesh.indices) assert(index < mesh.count);
    for (let i=0;i<mesh.count;i++) {
      const o=i*5,u=mesh.vertices[o+3],v=mesh.vertices[o+4];
      assert(Math.abs(mesh.vertices[o]/aspect-(u*2-1))<1e-6);
      assert(Math.abs(-mesh.vertices[o+2]*.8660254-(1-v*2))<1e-6,'projected ground aligns with touch UV');
    }
  }
});

test('mesh receives touch heights and frozen vertices stop displacing', () => {
  const field=new WaveField(96,128,.75), mesh=waterMesh(.75,false);
  field.disturb(.5,.5,.8,.08); updateMesh(mesh,field);
  assert(mesh.dynamics.some((value,index)=>index%2===0 && value>.5));
  field.ice.paint(.5,.5,1,true,true);for(let i=0;i<30;i++)field.ice.update(.1);
  updateMesh(mesh,field);
  for(let i=0;i<mesh.count;i++)if(mesh.dynamics[i*2+1]===1)assert.equal(mesh.dynamics[i*2],0);
});

test('a calm pool remains calm; shoreline rejects land touches', () => {
  const field = new WaveField(96, 128, .75);
  assert(shore(.5, .49) < 0);
  assert(shore(0, 0) > 0);
  assert.equal(field.disturb(0, 0, 1), false);
  assert.equal(field.disturb(NaN, .5, 1), false);
  for (let i = 0; i < 90; i++) field.step();
  assert.equal(field.energy(), 0);
});

test('a tap propagates beyond its origin and loses energy', () => {
  const field = new WaveField(128, 128, 1);
  field.disturb(.5, .49, .5, .022);
  assert(Math.abs(field.sample(.5, .49)) > .3);
  assert(Math.abs(field.sample(.61, .49)) < .001);
  let propagated = false;
  for (let i = 0; i < 60; i++) { field.step(); if (Math.abs(field.sample(.61, .49)) > .002) propagated = true; }
  assert(propagated, 'wave must reach a distant point');
  const initial = field.energy();
  for (let i = 0; i < 700; i++) field.step();
  assert(field.energy() < initial * .03, 'wave should settle naturally');
});

test('swiping disturbs a continuous path and clear removes history', () => {
  const field = new WaveField(128, 128, 1);
  field.stroke(.3, .49, .7, .49, .2);
  for (const u of [.35, .4, .5, .6, .65]) assert(field.sample(u, .49) > .08);
  field.step(); field.clear();
  assert.equal(field.energy(), 0);
  field.step(); assert.equal(field.energy(), 0);
});

test('many overlapping strokes stay finite and dry bank stays dry', () => {
  for (const aspect of [.4, 1, 2.5]) {
    const field = new WaveField(96, 128, aspect);
    for (let n = 0; n < 200; n++) { field.disturb(.5 + Math.sin(n) * .25, .49 + Math.cos(n) * .16, .8); field.step(); }
    for (let i = 0; i < field.current.length; i++) { assert(Number.isFinite(field.current[i])); assert(Math.abs(field.current[i]) <= .971); if (!field.mask[i]) assert.equal(field.current[i], 0); }
  }
});

test('height packing preserves sign and stays within two-byte precision', () => {
  const field = new WaveField(32, 32, 1);
  field.disturb(.5, .49, -.25);
  const bytes = field.pack();
  for (let i = 0; i < field.current.length; i++) {
    const value = (bytes[i * 4] * 256 + bytes[i * 4 + 1]) / 65535 * 2 - 1;
    assert(Math.abs(value - field.current[i]) < .000032);
  }
});

test('all viewport sizes obey pixel and DPR budgets', () => {
  for (const [w, h, dpr] of [[390,844,3],[1920,1080,2],[3840,2160,3],[320,568,1]]) {
    for (const low of [false, true]) {
      const result = bufferSize(w, h, dpr, low);
      assert(result.width * result.height <= (low ? 1000000 : 2000000));
      assert(result.scale <= (low ? 1 : 1.5));
    }
  }
});

function settleIce(ice, seconds = 2) { for (let n = 0; n < seconds * 60; n++) ice.update(1 / 60); }

test('local frost grows outward, stays inside the pool and blocks water impulses', () => {
  const field = new WaveField(128, 128, 1), ice = field.ice;
  ice.paint(.5, .49, .12, true, false);
  settleIce(ice, .2);
  assert(ice.sample(.5, .49) > ice.sample(.59, .49), 'the center freezes before the perimeter');
  settleIce(ice);
  assert.equal(ice.sample(.5, .49), 1); assert.equal(ice.sample(.8, .49), 0);
  assert(ice.coverage() > .06 && ice.coverage() < .16);
  assert.equal(field.disturb(.5, .49, 1), false);
  assert.equal(field.disturb(.8, .49, 1), true);
  for (let i = 0; i < 120; i++) field.step();
  assert.equal(field.sample(.5, .49), 0);
});

test('whole-pool ice can be shattered locally without delayed refreezing', () => {
  const ice = new IceField(128, 128, 1);
  ice.paint(.5, .49, 1, true, true); settleIce(ice);
  assert.equal(ice.coverage(), 1); assert.equal(ice.sample(0, 0), 0);
  ice.paint(.5, .49, .12, false, false);
  assert.equal(ice.sample(.5, .49), 0); assert.equal(ice.sample(.8, .49), 1);
  settleIce(ice); assert.equal(ice.sample(.5, .49), 0); assert(ice.coverage() < .95);
  ice.paint(.5, .49, .12, true, false); ice.paint(.5, .49, .12, false, false);
  settleIce(ice); assert.equal(ice.sample(.5, .49), 0, 'a fast second tap cancels pending freeze cells');
  ice.paint(.5, .49, 1, false, true); settleIce(ice); assert.equal(ice.coverage(), 0);
});

test('frozen state and holes survive viewport changes; reset clears pending growth', () => {
  const ice = new IceField(80, 160, .5);
  ice.paint(.5, .49, 1, true, true); settleIce(ice);
  ice.paint(.5, .49, .08, false, false);
  const landscape = new IceField(160, 80, 2); landscape.restore(ice);
  assert.equal(landscape.sample(.5, .49), 0); assert.equal(landscape.sample(.8, .49), 1);
  landscape.paint(.5, .49, .1, true, false); landscape.clear(); settleIce(landscape);
  assert.equal(landscape.coverage(), 0);
});

test('overlapping freeze and shatter gestures keep simulation finite and texture packing independent', () => {
  const field = new WaveField(80, 128, .625);
  for (let n = 0; n < 160; n++) {
    const u = .5 + Math.sin(n) * .25, v = .49 + Math.cos(n) * .2;
    field.ice.paint(u, v, .08, n % 3 !== 0, false); field.ice.update(.04); field.disturb(u, v, .8); field.step();
  }
  const packed = field.pack();
  for (let i = 0; i < field.current.length; i++) {
    assert(Number.isFinite(field.current[i])); assert(Math.abs(field.current[i]) <= .971);
    assert(field.ice.current[i] >= 0 && field.ice.current[i] <= 1);
    assert.equal(packed[i * 4 + 2], Math.round(field.ice.current[i] * 255));
    if (!field.mask[i]) assert.equal(field.ice.current[i], 0);
  }
});
