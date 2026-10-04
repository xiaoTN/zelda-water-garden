const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Camera,intersect,rotation}=require('../src/nature-3d.js');
test('perspective projection and ray picking agree on a deformed world in both views and orientations',()=>{
  const height=(x,z)=>.3+.25*Math.sin(x*1.3)*Math.cos(z*.8);
  for(const aspect of [390/844,1.5,844/390])for(const oblique of [false,true]){
    const camera=new Camera(aspect,oblique);
    for(const x of [-1,0,1])for(const z of [-2,0,2]){
      const p=[x,height(x,z),z],screen=camera.project(p),picked=intersect(camera,screen.u,screen.v,height);
      assert(picked);assert(Math.hypot(...picked.map((v,i)=>v-p[i]))<.0001);
    }
    const near=camera.project([1,0,2]),far=camera.project([1,0,-2]);
    assert(Math.abs(near.u-.5)>Math.abs(far.u-.5),'near objects have real perspective magnification');
  }
});
test('rolling rotates around the direction of travel, stays normalized and reverses consistently',()=>{
  const identity=[0,0,0,1],q=rotation(identity,.4,0,.2);
  assert(Math.abs(q[2])>.5);assert.equal(q[0],0);
  const back=rotation(q,-.4,0,.2);assert(Math.hypot(...back.map((v,i)=>v-identity[i]))<1e-12);
  let turning=q;for(let i=0;i<500;i++)turning=rotation(turning,Math.cos(i)*.01,Math.sin(i)*.01,.2);
  assert(Math.abs(Math.hypot(...turning)-1)<1e-12);
  assert(Math.abs(rotation(identity,0,.4,.2)[0])>.5);
});
