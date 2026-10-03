(function(root){
  'use strict';
  var core=root.WaterCore,C=root.WaterPhysics,limit=10,stride=11,fixed=1/120;
  if(!C&&typeof require==='function')C=require('./physics.js');
  // Small convex hulls keep collision faces and visible rock faces identical.
  function hull(points){
    var faces=[],seen={},eps=1e-7,n=points.length;
    for(var i=0;i<n-2;i++)for(var j=i+1;j<n-1;j++)for(var k=j+1;k<n;k++){
      var a=points[i],ab=points[j].vsub(a),ac=points[k].vsub(a),normal=ab.cross(ac);
      if(normal.length()<eps)continue;normal.normalize();
      var positive=false,negative=false,ids=[];
      for(var m=0;m<n;m++){var d=normal.dot(points[m].vsub(a));if(d>eps)positive=true;else if(d<-eps)negative=true;else ids.push(m);}
      if(positive&&negative)continue;
      var key=ids.join(',');if(seen[key])continue;seen[key]=true;
      if(positive)normal.negate(normal);
      var center=new C.Vec3();for(m=0;m<ids.length;m++)center.vadd(points[ids[m]],center);center.scale(1/ids.length,center);
      var axis=points[ids[0]].vsub(center);axis.normalize();var tangent=normal.cross(axis);
      ids.sort(function(p,q){var x=points[p].vsub(center),y=points[q].vsub(center);return Math.atan2(x.dot(tangent),x.dot(axis))-Math.atan2(y.dot(tangent),y.dot(axis));});
      faces.push(ids);
    }
    return new C.ConvexPolyhedron({vertices:points,faces:faces});
  }
  function rockShape(radius,height,seed){
    var random=core.seededRandom(seed),points=[];
    // Staggered, uneven rings round out both ends; no shared cut plane underneath.
    for(var ring=0;ring<3;ring++)for(var i=0;i<5;i++){
      var a=(i/5+ring*.075)*Math.PI*2+(random()-.5)*.18;
      var r=radius*(ring===1?(.91+random()*.15):(.60+random()*.17));
      var y=height*((ring-1)*.32+(random()-.5)*.13);
      points.push(new C.Vec3(Math.cos(a)*r,y,Math.sin(a)*r*(.83+random()*.1)));
    }
    points.push(new C.Vec3(radius*(random()-.5)*.28,-height*(.49+random()*.06),radius*(random()-.5)*.28));
    points.push(new C.Vec3(radius*(random()-.5)*.30,height*(.48+random()*.07),radius*(random()-.5)*.30));
    return hull(points);
  }
  function mesh(shape,seed){
    var random=core.seededRandom(seed),data=[],color=[.45+random()*.10,.49+random()*.09,.39+random()*.08];
    for(var f=0;f<shape.faces.length;f++){
      var face=shape.faces[f],normal=shape.faceNormals[f];
      for(var i=1;i<face.length-1;i++)[face[0],face[i],face[i+1]].forEach(function(index){var p=shape.vertices[index];data.push(p.x,p.y,p.z,0,0,normal.x,normal.y,normal.z,color[0],color[1],color[2]);});
    }
    return new Float32Array(data);
  }
  function Stones(){
    this.items=[];this.aspect=1;this.bed=null;this.world=null;this.revision=0;this.impacts=0;this.accumulator=0;this.bedClock=0;
    this.frame=new Float32Array(limit*96*stride);this.shadowFrame=new Float32Array(limit*36*stride);this.vector=new C.Vec3();this.normal=new C.Vec3();
    this.parents=new Int8Array(limit);this.supported=new Uint8Array(limit);this.groupQuiet=new Float64Array(limit);this.groupMotion=new Float64Array(limit);
  }
  Stones.prototype.attach=function(aspect,bed,terrain){
    var oldBed=this.bed,oldAspect=this.aspect;this.bed=bed;
    if(this.world&&Math.abs(aspect-oldAspect)<.00001)return;
    this.aspect=aspect;this.accumulator=0;
    var world=this.world=new C.World({gravity:new C.Vec3(0,-6.5,0),allowSleep:false});
    world.broadphase=new C.SAPBroadphase(world);world.solver.iterations=18;world.solver.tolerance=.0001;
    // Average friction over each contact manifold instead of competing constraints per facet.
    world.narrowphase.enableFrictionReduction=true;
    world.defaultContactMaterial.friction=.75;world.defaultContactMaterial.restitution=0;
    world.defaultContactMaterial.contactEquationStiffness=1e5;
    world.defaultContactMaterial.contactEquationRelaxation=8;
    // Heightfield covers the basin profile; shoreline rocks have separate solid hulls.
    var step=.10,x0=-aspect*1.14,z0=1.14/.8660254,nx=Math.ceil(aspect*2.28/step),nz=Math.ceil(2.28/.8660254/step),data=[];
    for(var x=0;x<=nx;x++){var row=[];for(var z=0;z<=nz;z++){
      var u=(x0+x*step)/(aspect*2)+.5,v=(z0-z*step)*.4330127+.5;
      var elevation=terrain?root.WaterTerrain.elevation(u,v):bed.heightAt(u,v);row.push(elevation);
    }data.push(row);}
    var ground=new C.Body({mass:0,shape:new C.Heightfield(data,{elementSize:step}),collisionFilterGroup:1,collisionFilterMask:2});
    ground.position.set(x0,0,z0);ground.quaternion.setFromEuler(-Math.PI/2,0,0);world.addBody(ground);
    // Use a single support surface: an overlapping floor makes compressed contacts alternate.
    // Scene bounds sit outside the visible garden, preventing fast impacts from leaving the terrain.
    var bounds=[[-aspect*1.06,0,0,Math.PI/2],[aspect*1.06,0,0,-Math.PI/2],[0,0,-1.25,0],[0,0,1.25,Math.PI]];
    for(var wall=0;wall<bounds.length;wall++){
      var bound=bounds[wall],barrier=new C.Body({mass:0,shape:new C.Plane(),collisionFilterGroup:1,collisionFilterMask:2});
      barrier.position.set(bound[0],bound[1],bound[2]);barrier.quaternion.setFromEuler(0,bound[3],0);world.addBody(barrier);
    }
    if(terrain)for(var r=0;r<terrain.rocks.length;r++){
      var rock=terrain.rocks[r],points=[],keys={},cx=(rock.u-.5)*aspect*2,cz=(rock.v-.5)*2/.8660254,cy=(rock.base+rock.top)*.5;
      for(var at=rock.start*stride;at<(rock.start+rock.count)*stride;at+=stride){
        var px=terrain.stones[at]-cx,py=terrain.stones[at+1]-cy,pz=terrain.stones[at+2]-cz,key=px.toFixed(6)+','+py.toFixed(6)+','+pz.toFixed(6);
        if(!keys[key]){keys[key]=true;points.push(new C.Vec3(px,py,pz));}
      }
      var solid=new C.Body({mass:0,shape:hull(points),collisionFilterGroup:1,collisionFilterMask:2});solid.position.set(cx,cy,cz);world.addBody(solid);
    }
    for(var i=0;i<this.items.length;i++){
      var s=this.items[i],previous=s.body,ratio=Math.sqrt(Math.min(aspect,1)/Math.min(oldAspect,1));
      var y=bed.heightAt(s.u,s.v)+(previous.position.y-oldBed.heightAt(s.u,s.v))*ratio;
      this.createBody(s,y);s.body.quaternion.copy(previous.quaternion);s.body.velocity.copy(previous.velocity);s.body.angularVelocity.copy(previous.angularVelocity);
      s.settled=false;this.sync(s);
    }
    this.revision++;
  };
  Stones.prototype.createBody=function(s,y){
    s.radius=s.size*Math.sqrt(Math.min(this.aspect,1));s.height=s.radius*s.tall;
    var shape=rockShape(s.radius,s.height,s.seed);s.local=mesh(shape,s.seed);
    s.body=new C.Body({mass:Math.max(.15,s.radius*s.radius*s.height*1800),shape:shape,linearDamping:.08,angularDamping:.25,
      allowSleep:false,collisionFilterGroup:2,collisionFilterMask:3});
    s.body.waterStone=s;s.quietTime=0;s.restGroup=null;
    var system=this;
    s.body.addEventListener('collide',function(event){
      // Wake the complete supporting group before the contact solver runs.
      // Even a slow new contact must participate: a sleeping neighbour otherwise acts infinitely heavy.
      if(s.body.sleepState===C.Body.SLEEPING&&event.body.mass>0&&event.body.sleepState!==C.Body.SLEEPING)system.wakeGroup(s);
    });
    s.body.position.set((s.u-.5)*this.aspect*2,y,(s.v-.5)*2/.8660254);s.body.quaternion.setFromEuler(.09,s.angle,.06);
    this.world.addBody(s.body);
  };
  Stones.prototype.wakeGroup=function(stone){
    var group=stone.restGroup||[stone];
    for(var i=0;i<group.length;i++){var s=group[i];s.body.wakeUp();s.settled=false;s.quietTime=0;s.restGroup=null;}
  };
  Stones.prototype.groupRoot=function(index){
    while(this.parents[index]!==index){this.parents[index]=this.parents[this.parents[index]];index=this.parents[index];}
    return index;
  };
  Stones.prototype.joinGroup=function(a,b){
    a=this.groupRoot(a);b=this.groupRoot(b);if(a!==b)this.parents[Math.max(a,b)]=Math.min(a,b);
  };
  Stones.prototype.restContacts=function(){
    var items=this.items,n=items.length,i,j,s;
    for(i=0;i<n;i++){
      s=items[i];s.contact=false;s.body.waterIndex=i;this.parents[i]=i;
      this.supported[i]=0;this.groupQuiet[i]=Infinity;this.groupMotion[i]=0;
    }
    // Sleeping pairs do not generate contacts; retain their support graph until impact.
    for(i=0;i<n;i++)if(items[i].restGroup)for(j=0;j<items[i].restGroup.length;j++)this.joinGroup(i,items[i].restGroup[j].body.waterIndex);
    for(i=0;i<this.world.contacts.length;i++){
      var contact=this.world.contacts[i],a=contact.bi.waterStone,b=contact.bj.waterStone;
      if(a)a.contact=true;if(b)b.contact=true;
      if(a&&b)this.joinGroup(a.body.waterIndex,b.body.waterIndex);
      else if(a&&!contact.bj.mass)this.supported[a.body.waterIndex]=1;
      else if(b&&!contact.bi.mass)this.supported[b.body.waterIndex]=1;
    }
    for(i=0;i<n;i++){
      s=items[i];var root=this.groupRoot(i),motion=s.body.velocity.lengthSquared()+s.body.angularVelocity.lengthSquared()*s.radius*s.radius;
      this.groupMotion[root]=Math.max(this.groupMotion[root],motion);
      this.groupQuiet[root]=Math.min(this.groupQuiet[root],s.quietTime);
      if(this.supported[i]||s.body.sleepState===C.Body.SLEEPING)this.supported[root]=1;
    }
    for(i=0;i<n;i++){
      root=this.groupRoot(i);s=items[i];
      s.quietTime=this.supported[root]&&this.groupMotion[root]<.0016?this.groupQuiet[root]+fixed:0;
    }
    for(i=0;i<n;i++)if(this.groupRoot(i)===i&&items[i].quietTime>.7){
      var needsSleep=false;
      for(j=0;j<n;j++)if(this.groupRoot(j)===i&&items[j].body.sleepState!==C.Body.SLEEPING)needsSleep=true;
      if(needsSleep){
        var group=[];for(j=0;j<n;j++)if(this.groupRoot(j)===i)group.push(items[j]);
        for(j=0;j<group.length;j++){group[j].body.sleep();group[j].restGroup=group;}
      }
    }
  };
  Stones.prototype.sync=function(s){
    var b=s.body,points=b.shapes[0].vertices,p=this.vector,lo=Infinity,hi=-Infinity;
    for(var i=0;i<points.length;i++){b.quaternion.vmult(points[i],p);lo=Math.min(lo,p.y+b.position.y);hi=Math.max(hi,p.y+b.position.y);}
    s.u=b.position.x/(this.aspect*2)+.5;s.v=b.position.z*.4330127+.5;s.y=lo;s.top=hi;s.vy=b.velocity.y;
  };
  Stones.prototype.add=function(u,v,random){
    random=random||Math.random;
    if(!this.world||this.items.length>=limit||core.shore(u,v)>-.10||this.bed.heightAt(u,v)>-.025)return false;
    var s={u:u,v:v,size:.075+random()*.11,tall:1.85+random()*.4,seed:Math.floor(random()*1000000)+1,angle:random()*6.28,entered:false,settled:false};
    var y=Math.max(1.5,v*4+.25);
    for(var i=0;i<this.items.length;i++){
      var other=this.items[i],dx=(u-other.u)*this.aspect*2,dz=(v-other.v)*2/.8660254;
      if(dx*dx+dz*dz<Math.pow(other.radius+s.size,2)*2)y=Math.max(y,other.top+s.size*2+.3);
    }
    this.createBody(s,y);s.body.angularVelocity.set((random()-.5)*.8,(random()-.5)*.7,(random()-.5)*.8);
    this.sync(s);this.items.push(s);this.revision++;return s;
  };
  Stones.prototype.update=function(dt,onEvent){
    if(!this.world||!this.items.length||dt<=0)return;
    var active=false;for(var a=0;a<this.items.length;a++)if(this.items[a].body.sleepState!==C.Body.SLEEPING)active=true;
    if(!active){this.accumulator=0;return;}
    this.accumulator+=Math.min(.08,dt);var count=0,moved=false;
    while(this.accumulator>=fixed&&count++<10){
      for(var i=0;i<this.items.length;i++){
        var s=this.items[i],b=s.body;
        if(b.sleepState===C.Body.SLEEPING)continue;
        var wet=core.clamp(-s.y/Math.max(.01,s.top-s.y),0,1);
        // Approximate buoyancy for stone density 2.65 x water; water also damps spin.
        b.force.y+=b.mass*6.5*wet/2.65;
        // Speed-dependent water resistance removes impact energy before the shallow bed.
        var speed=b.velocity.length(),drag=1/(1+fixed*(.3+speed*.7+wet*(4+speed*8)));b.velocity.scale(drag,b.velocity);
        var slide=Math.exp(-fixed*(wet*5+(s.contact?3:0)));
        b.velocity.x*=slide;b.velocity.z*=slide;
        // Rough rock contacts dissipate rolling energy as well as sliding friction.
        b.angularVelocity.scale(Math.exp(-fixed*(wet*3+(s.contact?5:0))),b.angularVelocity);
      }
      this.world.step(fixed);this.accumulator-=fixed;
      this.restContacts();
      for(i=0;i<this.items.length;i++){
        s=this.items[i];var before=s.y,wasSettled=s.settled;this.sync(s);
        s.settled=s.body.sleepState===C.Body.SLEEPING;
        if(!s.entered&&before>0&&s.y<=0){s.entered=true;this.impacts++;if(onEvent)onEvent('impact',s);}
        if(s.settled&&!wasSettled&&onEvent)onEvent('settled',s);
        if(!s.settled||!wasSettled){this.revision++;if(s.entered)moved=true;}
      }
    }
    this.bedClock+=dt;
    if(moved&&this.bedClock>=.25){this.bedClock=0;if(onEvent)onEvent('moved',this.items[0]);}
  };
  Stones.prototype.geometry=function(contactOnly){
    var out=this.frame,at=0,p=this.vector,n=this.normal;
    for(var i=0;i<this.items.length;i++){
      var s=this.items[i];if(contactOnly&&((!s.entered&&!s.settled)||(s.y>.015&&!s.settled)))continue;
      var data=s.local,b=s.body;
      for(var j=0;j<data.length;j+=stride){
        p.set(data[j],data[j+1],data[j+2]);b.quaternion.vmult(p,p);n.set(data[j+5],data[j+6],data[j+7]);b.quaternion.vmult(n,n);
        out[at++]=b.position.x+p.x;out[at++]=b.position.y+p.y;out[at++]=b.position.z+p.z;
        out[at++]=s.u;out[at++]=s.v;out[at++]=n.x;out[at++]=n.y;out[at++]=n.z;
        out[at++]=data[j+8];out[at++]=data[j+9];out[at++]=data[j+10];
      }
    }
    return out.subarray(0,at);
  };
  Stones.prototype.shadows=function(){
    var at=0,out=this.shadowFrame;
    for(var i=0;i<this.items.length;i++){
      var s=this.items[i];if(s.y<=0||s.settled)continue;
      var radius=s.radius*(1+Math.max(0,s.y)*.4),opacity=Math.max(.12,1-s.y*.3);
      for(var k=0;k<12;k++)for(var j=0;j<3;j++){
        var a=(k+j-1)/12*6.2831853,dx=j?Math.cos(a):0,dz=j?Math.sin(a):0;
        out[at++]=(s.u-.5)*this.aspect*2+dx*radius;out[at++]=.003;out[at++]=(s.v-.5)*2/.8660254+dz*radius;
        out[at++]=.5+dx*.5;out[at++]=.5+dz*.5;out[at++]=0;out[at++]=1;out[at++]=0;out[at++]=opacity;out[at++]=1;out[at++]=1;
      }
    }
    return out.subarray(0,at);
  };
  Stones.prototype.clear=function(){
    for(var i=0;i<this.items.length;i++)this.world.removeBody(this.items[i].body);
    this.items.length=0;this.impacts=0;this.accumulator=0;this.bedClock=0;this.revision++;
  };
  Stones.prototype.blocks=function(u,v){
    var data=this.geometry(false);
    for(var at=0;at<data.length;at+=33){
      var ax=data[at]/(2*this.aspect)+.5,ay=.5+data[at+2]*.4330127-data[at+1]*.25;
      var bx=data[at+11]/(2*this.aspect)+.5,by=.5+data[at+13]*.4330127-data[at+12]*.25;
      var cx=data[at+22]/(2*this.aspect)+.5,cy=.5+data[at+24]*.4330127-data[at+23]*.25;
      var det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(det)<1e-9)continue;
      var a=((by-cy)*(u-cx)+(cx-bx)*(v-cy))/det,b=((cy-ay)*(u-cx)+(ax-cx)*(v-cy))/det,c=1-a-b;
      if(a>=0&&b>=0&&c>=0&&a*data[at+1]+b*data[at+12]+c*data[at+23]>.004)return true;
    }
    return false;
  };
  root.WaterStones={System:Stones,limit:limit};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.WaterStones;
}(typeof window!=='undefined'?window:global));
