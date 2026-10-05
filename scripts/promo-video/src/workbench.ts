import {BACKGROUND,EndTriptych,Poem,SHOTS,SurfaceShot,TOTAL,WaterPromo} from './Main';
export const WORKBENCH = {
  name:'片刻 · 水光｜实机宣传片',revision:'3',fps:30,width:1080,height:1440,total:TOTAL,background:BACKGROUND,
  shots:SHOTS.map(s=>({id:s.id,label:s.label,from:s.from,duration:s.duration,component:s.id==='end'?EndTriptych:SurfaceShot,
    props:{src:`media/${s.id}.mp4`,frameCount:s.duration,first:s.id==='calm',last:s.id==='end'},durationProp:'duration',cardId:s.id==='end'?'triptych':'surface',cardName:s.id==='end'?'三景合影':'实机片段',
    schema:[{type:'text',key:'src',label:'视频素材',default:'media/calm.mp4'}]})),
  captions:SHOTS.map(s=>({id:`poem-${s.id}`,label:s.text.replace('\n',''),from:s.from,duration:s.duration,component:Poem,
    props:{text:s.text,kicker:s.kicker,first:s.id==='calm',last:s.id==='end'},durationProp:'duration',cardId:'poem',cardName:'诗句',
    schema:[{type:'textarea',key:'text',label:'文案',default:''},{type:'text',key:'kicker',label:'小标题',default:''},
      {type:'color',key:'color',label:'文字颜色',default:'#e6ead6'},{type:'number',key:'fontSize',label:'字号',default:88,min:48,max:100,step:2}]})),
  sfx:SHOTS.map(s=>({from:s.from,duration:s.duration,src:`audio/${s.id}.wav`,volume:1,label:`${s.label} · ${s.id==='end'?'水面 BGM':'录屏原声'}`})),
  original:WaterPromo,
};
