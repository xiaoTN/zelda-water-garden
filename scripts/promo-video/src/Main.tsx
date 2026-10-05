import React from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, cancelRender, continueRender, delayRender, getRemotionEnvironment, interpolate, staticFile, useCurrentFrame} from 'remotion';
import timeline from './timeline.json';

export const TOTAL = Math.max(...timeline.map(s=>s.from+s.duration));
export const BACKGROUND = '#102923';
// Match the portrait recordings: preserve the whole game and its controls.
export const WIDTH = 1080;
export const HEIGHT = 1576;
export const SHOTS = timeline;
const clamp = {extrapolateLeft:'clamp', extrapolateRight:'clamp'} as const;
const smooth = (t:number) => t*t*(3-2*t);
const fade = (frame:number, start:number, end:number) => smooth(interpolate(frame,[start,end],[0,1],clamp));
const fontPromise = typeof FontFace === 'undefined' ? Promise.resolve() : new FontFace('Moment WenKai', `url(${staticFile('fonts/LXGWWenKai-Regular.ttf')})`).load().then(font=>{document.fonts.add(font);});
export const FontReady:React.FC = () => {
  const [handle]=React.useState(()=>delayRender('Load WenKai font'));
  React.useEffect(()=>{fontPromise.then(()=>continueRender(handle)).catch(cancelRender);},[handle]);
  return null;
};

export const EndTriptych:React.FC<{duration?:number}> = ({duration=240}) => {
  const f=useCurrentFrame();
  const opacity=fade(f,0,18)*(1-fade(f,duration-24,duration-1));
  return <AbsoluteFill style={{background:BACKGROUND,opacity}}>
    <Img src={staticFile('stills/water.jpg')} style={{position:'absolute',width:'100%',height:'100%',objectFit:'cover',filter:'brightness(.28)'}}/>
    {['water','snow','cloud'].map((scene,i)=>{
      const progress=fade(f,8+i*7,38+i*7);
      return <div key={scene} style={{position:'absolute',left:36+i*340,top:430+(1-progress)*22,width:328,opacity:progress}}>
        <div style={{height:560,borderRadius:18,overflow:'hidden',border:'1px solid rgba(199,194,145,.4)',boxShadow:'0 16px 38px rgba(0,0,0,.22)'}}>
          <Img src={staticFile(`stills/${scene}.jpg`)} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:scene==='water'?'25% center':'center'}}/>
        </div>
        <div style={{marginTop:25,textAlign:'center',fontFamily:'Moment WenKai, serif',fontSize:58,letterSpacing:8,color:'#c7c291'}}>{['水光','雪落','云间'][i]}</div>
      </div>;
    })}
  </AbsoluteFill>;
};

export const SurfaceShot: React.FC<{src?:string;duration?:number;frameCount?:number;first?:boolean;last?:boolean}> = ({src='media/calm.mp4',duration=138,frameCount=138,first=false,last=false}) => {
  const f = useCurrentFrame();
  const opacity = fade(f,0,first?30:18) * (last?1-fade(f,duration-42,duration-1):1);
  return <AbsoluteFill style={{opacity,overflow:'hidden'}}>
    {getRemotionEnvironment().isRendering
      ? <Img src={staticFile(`frames/${src.split('/').pop()!.replace('.mp4','')}/${String(Math.min(frameCount-1,Math.max(0,Math.floor(f)))).padStart(4,'0')}.jpg`)} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
      : <OffthreadVideo src={staticFile(src)} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
  </AbsoluteFill>;
};

// Full-screen recordings need no feathered picture border. Retain this export
// for the frozen-content cut regression and older workbench project references.
export const SurfaceMatte:React.FC=()=> null;

export const Poem: React.FC<{text?:string;kicker?:string;duration?:number;first?:boolean;last?:boolean;color?:string;fontSize?:number}> = ({text='给自己，\n留一点安静。',kicker='片刻 · 水光',duration=138,first=false,last=false,color,fontSize=94}) => {
  const f = useCurrentFrame();
  const onset = first ? 8 : 14;
  const opacity = fade(f,onset,onset+18) * (1-fade(f,duration-(last?36:24),duration-(last?1:6)));
  const shift = interpolate(smooth(interpolate(f,[onset,onset+24],[0,1],clamp)),[0,1],[9,0]);
  const brightScene=!last && /雪|云/.test(kicker);
  const ink=color ?? (brightScene?'#18362e':'#f4f4df');
  return <AbsoluteFill style={{opacity,fontFamily:'Moment WenKai, serif',color:ink,textAlign:'center',transform:`translateY(${shift}px)`,pointerEvents:'none'}}>
    <FontReady/>
    {last && <div style={{position:'absolute',top:103,width:'100%',fontSize:58,letterSpacing:9,color:'#c7c291'}}>{kicker}</div>}
    <div style={{position:'absolute',top:last?182:316,left:70,right:70,fontSize,lineHeight:1.12,letterSpacing:4,whiteSpace:'pre-line',
      textShadow:brightScene?'0 1px 8px rgba(255,255,255,.85)':'0 2px 12px rgba(7,29,25,.9),0 0 24px rgba(7,29,25,.7)'}}>{text}</div>
    {last && <div style={{position:'absolute',top:1110,left:72,width:936,fontSize:58,letterSpacing:3,lineHeight:1.1,
      color:'#e6ead6',textShadow:'0 2px 12px #071d19,0 0 20px #071d19'}}>
      下一处宁静，会在哪里？
    </div>}
  </AbsoluteFill>;
};

export const WaterPromo: React.FC<{sound?:boolean}> = ({sound=true}) => <AbsoluteFill style={{background:BACKGROUND}}>
  {SHOTS.filter(s=>s.id!=='end').map(s=><Sequence key={s.id} from={s.from} durationInFrames={s.duration}>
    <SurfaceShot src={`media/${s.id}.mp4`} duration={s.duration} frameCount={s.duration} first={s.id==='calm'}/>
  </Sequence>)}
  <SurfaceMatte/>
  {SHOTS.filter(s=>s.id==='end').map(s=><Sequence key={s.id} from={s.from} durationInFrames={s.duration}>
    <EndTriptych duration={s.duration}/>
  </Sequence>)}
  {SHOTS.map(s=><Sequence key={s.id} from={s.from} durationInFrames={s.duration}>
    <Poem text={s.text} kicker={s.kicker} duration={s.duration} first={s.id==='calm'} last={s.id==='end'}/>
  </Sequence>)}
  {sound && SHOTS.map(s=><Sequence key={s.id} from={s.from} durationInFrames={s.duration}>
    <Audio src={staticFile(`audio/${s.id}.wav`)} volume={1}/>
  </Sequence>)}
</AbsoluteFill>;
