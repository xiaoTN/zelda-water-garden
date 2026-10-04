import React from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, getRemotionEnvironment, interpolate, staticFile, useCurrentFrame} from 'remotion';
import timeline from './timeline.json';

export const TOTAL = 1350;
export const BACKGROUND = '#102923';
export const SHOTS = timeline;
const clamp = {extrapolateLeft:'clamp', extrapolateRight:'clamp'} as const;
const smooth = (t:number) => t*t*(3-2*t);
const fade = (frame:number, start:number, end:number) => smooth(interpolate(frame,[start,end],[0,1],clamp));

export const SurfaceShot: React.FC<{src?:string;duration?:number;frameCount?:number;first?:boolean;last?:boolean}> = ({src='media/calm.mp4',duration=138,frameCount=138,first=false,last=false}) => {
  const f = useCurrentFrame();
  const opacity = fade(f,0,first?30:18) * (last?1-fade(f,duration-42,duration-1):1);
  return <div style={{position:'absolute',left:72,top:360,width:936,height:721,opacity,
    overflow:'hidden',borderRadius:24,
    maskImage:'linear-gradient(to bottom, transparent, black 7%, black 92%, transparent)',
    WebkitMaskImage:'linear-gradient(to bottom, transparent, black 7%, black 92%, transparent)'}}>
    {getRemotionEnvironment().isRendering
      ? <Img src={staticFile(`frames/${src.split('/').pop()!.replace('.mp4','')}/${String(Math.min(frameCount-1,Math.max(0,Math.floor(f)))).padStart(4,'0')}.jpg`)} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
      : <OffthreadVideo src={staticFile(src)} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
    <div style={{position:'absolute',inset:0,background:'linear-gradient(90deg,#102923 0%,transparent 4%,transparent 96%,#102923 100%)'}}/>
  </div>;
};

export const Poem: React.FC<{text?:string;kicker?:string;duration?:number;first?:boolean;last?:boolean;color?:string;fontSize?:number}> = ({text='给自己，\n留一点安静。',kicker='片刻 · 水光',duration=138,first=false,last=false,color='#e6ead6',fontSize=80}) => {
  const f = useCurrentFrame();
  const onset = first ? 8 : 14;
  const opacity = fade(f,onset,onset+18) * (1-fade(f,duration-(last?36:24),duration-(last?1:6)));
  const shift = interpolate(smooth(interpolate(f,[onset,onset+24],[0,1],clamp)),[0,1],[9,0]);
  return <AbsoluteFill style={{opacity,fontFamily:'SimSun, Songti SC, serif',color,textAlign:'center',transform:`translateY(${shift}px)`}}>
    <div style={{position:'absolute',top:103,width:'100%',fontSize:44,letterSpacing:9,color:'#c7c291'}}>{kicker}</div>
    <div style={{position:'absolute',top:182,left:70,right:70,fontSize,lineHeight:1.12,letterSpacing:5,whiteSpace:'pre-line'}}>{text}</div>
    {(first||last) && <div style={{position:'absolute',top:1019,left:72,width:936,fontSize:42,letterSpacing:3,lineHeight:1.35,
      color:'#e6ead6',textShadow:'0 2px 12px #071d19,0 0 20px #071d19',background:'linear-gradient(transparent,rgba(16,41,35,.7))'}}>
      可以轻轻触碰的水面模拟器
    </div>}
  </AbsoluteFill>;
};

export const WaterPromo: React.FC<{sound?:boolean}> = ({sound=true}) => <AbsoluteFill style={{background:BACKGROUND}}>
  {SHOTS.map(s=><Sequence key={s.id} from={s.from} durationInFrames={s.duration}>
    <SurfaceShot src={`media/${s.id}.mp4`} duration={s.duration} frameCount={s.duration} first={s.id==='calm'} last={s.id==='end'}/>
  </Sequence>)}
  {SHOTS.map(s=><Sequence key={s.id} from={s.from} durationInFrames={s.duration}>
    <Poem text={s.text} kicker={s.kicker} duration={s.duration} first={s.id==='calm'} last={s.id==='end'}/>
  </Sequence>)}
  {sound && SHOTS.map(s=><Sequence key={s.id} from={s.from} durationInFrames={s.duration}>
    <Audio src={staticFile(`audio/${s.id}.wav`)} volume={1}/>
  </Sequence>)}
</AbsoluteFill>;
