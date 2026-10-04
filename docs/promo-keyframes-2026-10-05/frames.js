const shots = [
  {id:'calm',time:'00–04s',name:'一池宁静',title:'给自己，<br>留一点安静。',note:'水声先入，镜头轻轻推近。'},
  {id:'tap',time:'04–10s',name:'轻触水面',title:'轻轻一点，<br>水便有了回响。',note:'一次轻触，停留看涟漪展开。'},
  {id:'swipe',time:'10–17s',name:'指尖与余波',title:'指尖走过，<br>温柔还在荡漾。',note:'缓缓划过，停手后继续看余波。'},
  {id:'leaf',time:'17–22s',name:'浮叶与游鱼',title:'看一片叶，<br>慢慢漂远。',note:'靠近浮叶，给游鱼和水声留白。'},
  {id:'stone',time:'22–28s',name:'落石与回响',title:'落下的，<br>是一圈圈涟漪。',note:'石头入水，宽阔水波向外展开。'},
  {id:'rain',time:'28–35s',name:'听雨',title:'听雨落下，<br>让思绪慢一点。',note:'雨势柔和增加，雨声渐入。'},
  {id:'snow',time:'35–37s',name:'雪落 · 短暂带过',title:'也有雪落，',note:'一张雪地画面，轻微推近，两秒带过。'},
  {id:'cloud',time:'37–39s',name:'云间 · 短暂带过',title:'有云经过。',note:'柔和叠化到云海，随后回到水面。'},
  {id:'end',time:'39–45s',name:'回到片刻',title:'把片刻，<br>留给自己。',note:'回到月夜水面，片名停留，声音淡出。'}
];
const params=new URLSearchParams(location.search),selected=Number(params.get('frame'));
if(selected>=1&&selected<=shots.length){
  const s=shots[selected-1];document.body.className='single '+s.id+(params.has('guides')?' guides':'');
  document.body.innerHTML=`<main class="frame"><div class="ambient" style="background-image:url(sources/${s.id}.jpg)"></div><p class="wordmark">片刻 <span>·</span> ${s.id==='snow'?'雪落':s.id==='cloud'?'云间':'水光'}</p><h1>${s.title}</h1><div class="scene"><img src="sources/${s.id}.jpg" alt="${s.name}的真实项目画面"></div>${s.id==='end'?'<p class="descriptor">可以轻轻触碰的水面模拟器</p>':'<div class="quiet-line"></div>'}<div class="safe-top"><span>上方留白 · 180 px</span></div><div class="safe-bottom"><span>下方留白 · 360 px</span><small>笔记文字可占用的低信息区域<br>这里不放字幕与主要动作</small></div><div class="safe-side"></div></main>`;
  function fitFrame(){document.querySelector('.frame').style.zoom=innerWidth/1080;document.body.style.width='100%';document.body.style.height='auto';document.body.style.overflow='auto';}
  fitFrame();addEventListener('resize',fitFrame);
}else{
  document.body.innerHTML=`<main class="review"><header><p class="eyebrow">片刻 · 水光 / 宣传片关键帧 · V01</p><h1>把片刻，留给自己。</h1><p class="intro">45 秒 · 3:4 构图 · 水面为主，雪与云各两秒<br>主要画面与字幕集中于中部，底部保留约四分之一的低信息区域。</p><a class="guide-link" href="?frame=2&guides=1">查看留白示意 ↗</a></header><section class="grid">${shots.map((s,i)=>`<article><a href="?frame=${i+1}"><img src="frames/${String(i+1).padStart(2,'0')}-${s.id}.jpg" alt="${s.name}宣传片关键帧"></a><div class="shot-line"><b>${String(i+1).padStart(2,'0')} / ${s.name}</b><span>${s.time}</span></div><p>${s.note}</p></article>`).join('')}</section><footer>静态构图预览 · 场景来自项目真实 WebGL 截图，文字与留白为宣传片排版。<br>留白数值是本片的构图预留，不是小红书的固定界面尺寸。</footer></main>`;
}
