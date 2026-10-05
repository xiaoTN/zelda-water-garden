import React from 'react';
import {AbsoluteFill, Composition, Sequence, registerRoot} from 'remotion';
import {BACKGROUND, SurfaceMatte, SurfaceShot} from './Main';

// Same frozen source on both sides: only compositing can change the edge.
const EdgeRepro:React.FC=()=> <AbsoluteFill style={{background:BACKGROUND}}>
  <Sequence durationInFrames={138}><SurfaceShot frameCount={1}/></Sequence>
  <Sequence from={120} durationInFrames={138}><SurfaceShot frameCount={1}/></Sequence>
  <SurfaceMatte/>
</AbsoluteFill>;
registerRoot(()=> <Composition id="EdgeRepro" component={EdgeRepro} width={1080} height={1440} fps={30} durationInFrames={258}/>);
