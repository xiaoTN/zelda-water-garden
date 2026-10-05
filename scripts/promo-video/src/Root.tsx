import React from 'react';
import {Composition} from 'remotion';
import {WaterPromo,TOTAL,WIDTH,HEIGHT} from './Main';
export const Root: React.FC = () => <Composition id="WaterPromo" component={WaterPromo} durationInFrames={TOTAL} fps={30} width={WIDTH} height={HEIGHT} defaultProps={{sound:true}}/>;
