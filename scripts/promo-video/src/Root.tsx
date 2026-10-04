import React from 'react';
import {Composition} from 'remotion';
import {WaterPromo,TOTAL} from './Main';
export const Root: React.FC = () => <Composition id="WaterPromo" component={WaterPromo} durationInFrames={TOTAL} fps={30} width={1080} height={1440} defaultProps={{sound:true}}/>;
