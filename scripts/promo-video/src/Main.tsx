import React from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, cancelRender, continueRender, delayRender, getRemotionEnvironment, interpolate, staticFile, useCurrentFrame} from 'remotion';
import timeline from './timeline.json';

export const TOTAL = Math.max(...timeline.map(s=>s.from+s.duration));
export const BACKGROUND = '#102923';
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
    {['water','snow','cloud'].map((scene,i)=>{
      const progress=fade(f,8+i*7,38+i*7);
      return <div key={scene} style={{position:'absolute',left:80+i*316,top:420+(1-progress)*22,width:288,opacity:progress}}>
        <div style={{height:466,borderRadius:18,overflow:'hidden',border:'1px solid rgba(199,194,145,.4)',boxShadow:'0 16px 38px rgba(0,0,0,.22)'}}>
          <Img src={staticFile(`stills/${scene}.jpg`)} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:scene==='water'?'25% center':'center'}}/>
        </div>
        <div style={{marginTop:25,textAlign:'center',fontFamily:'Moment WenKai, serif',fontSize:52,letterSpacing:8,color:'#c7c291'}}>{['水光','雪落','云间'][i]}</div>
      </div>;
    })}
  </AbsoluteFill>;
};

export const SurfaceShot: React.FC<{src?:string;duration?:number;frameCount?:number;first?:boolean;last?:boolean}> = ({src='media/calm.mp4',duration=138,frameCount=138,first=false,last=false}) => {
  const f = useCurrentFrame();
  const opacity = fade(f,0,first?30:18) * (last?1-fade(f,duration-42,duration-1):1);
  return <div style={{position:'absolute',left:72,top:360,width:936,height:721,opacity,
    overflow:'hidden',borderRadius:24}}>
    {getRemotionEnvironment().isRendering
      ? <Img src={staticFile(`frames/${src.split('/').pop()!.replace('.mp4','')}/${String(Math.min(frameCount-1,Math.max(0,Math.floor(f)))).padStart(4,'0')}.jpg`)} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
      : <OffthreadVideo src={staticFile(src)} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
  </div>;
};

// Apply the feather once, after incoming/outgoing pictures have composited.
// Per-shot masks brighten the overlap and snap dark when the old shot unmounts.
export const SurfaceMatte:React.FC=()=> <div style={{position:'absolute',left:72,top:360,width:936,height:721,
  borderRadius:24,pointerEvents:'none',background:
  `linear-gradient(to bottom,${BACKGROUND},transparent 7%,transparent 92%,${BACKGROUND}),linear-gradient(to right,${BACKGROUND},transparent 4%,transparent 96%,${BACKGROUND})`}}/>;

export const Poem: React.FC<{text?:string;kicker?:string;duration?:number;first?:boolean;last?:boolean;color?:string;fontSize?:number}> = ({text='给自己，\n留一点安静。',kicker='片刻 · 水光',duration=138,first=false,last=false,color='#e6ead6',fontSize=88}) => {
  const f = useCurrentFrame();
  const onset = first ? 8 : 14;
  const opacity = fade(f,onset,onset+18) * (1-fade(f,duration-(last?36:24),duration-(last?1:6)));
  const shift = interpolate(smooth(interpolate(f,[onset,onset+24],[0,1],clamp)),[0,1],[9,0]);
  return <AbsoluteFill style={{opacity,fontFamily:'Moment WenKai, serif',color,textAlign:'center',transform:`translateY(${shift}px)`}}>
    <FontReady/>
    <div style={{position:'absolute',top:103,width:'100%',fontSize:50,letterSpacing:9,color:'#c7c291'}}>{kicker}</div>
    <div style={{position:'absolute',top:182,left:70,right:70,fontSize,lineHeight:1.06,letterSpacing:5,whiteSpace:'pre-line'}}>{text}</div>
    {(first||last) && <div style={{position:'absolute',top:1007,left:72,width:936,fontSize:last?52:46,letterSpacing:3,lineHeight:1.35,
      color:'#e6ead6',textShadow:'0 2px 12px #071d19,0 0 20px #071d19',background:'linear-gradient(transparent,rgba(16,41,35,.7))'}}>
      {last?'下一处宁静，会在哪里？':'可以轻轻触碰的水面模拟器'}
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
