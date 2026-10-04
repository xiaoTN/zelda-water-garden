(async()=>{
const wait=ms=>new Promise(r=>setTimeout(r,ms));const click=s=>document.querySelector(s).click();
const mode=new URLSearchParams(location.search).get('shot');
function pointer(type,x,y,id=1){document.getElementById(mode==='snow'||mode==='cloud'?'nature':'water').dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:'touch',button:0,buttons:type==='pointerup'?0:1,clientX:innerWidth*x,clientY:innerHeight*y}));}
async function tap(x,y){pointer('pointerdown',x,y);await wait(70);pointer('pointerup',x,y);}
async function swipe(){pointer('pointerdown',.27,.53);for(let i=0;i<36;i++){await wait(18);pointer('pointermove',.27+i*.012,.53-Math.sin(i/35*Math.PI)*.085);}pointer('pointerup',.69,.53);}
await wait(1300);
if(mode==='tap'){await tap(.47,.49);await wait(210);}
if(mode==='swipe'){await swipe();await wait(110);}
if(mode==='leaf'){click('[data-mode="leaf"]');await tap(.48,.44);await wait(450);}
if(mode==='stone'){click('[data-mode="stone"]');await tap(.51,.48);for(let i=0;i<200&&WaterGarden.inspect().stoneImpacts<1;i++)await wait(20);await wait(280);}
if(mode==='rain'){click('[data-rain="2"]');await wait(1600);}
if(mode==='snow'){click('button[data-scene="snow"]');await wait(450);await swipe();await wait(300);}
if(mode==='cloud'){click('button[data-scene="cloud"]');await wait(450);await swipe();await wait(300);}
if(mode==='end'){click('#light');click('#light');await wait(800);}
captureFrozen=true;document.getElementById('capture-ready').textContent='画面就绪';
})().catch(e=>{document.getElementById('capture-ready').textContent=e.message});