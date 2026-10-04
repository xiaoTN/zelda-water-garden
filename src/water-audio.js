(function (root) {
  'use strict';
  function holdParameter(param, time) {
    if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(time);
    else {var value=param.value;param.cancelScheduledValues(time);param.setValueAtTime(value,time);}
  }
  function fadeParameter(context,param,seconds){
    holdParameter(param,context.currentTime);param.setTargetAtTime(0,context.currentTime,seconds);
  }
  function SceneMixer(context,output){
    this.context=context;this.kind='water';this.buses={};
    for(var i=0,names=['water','snow','cloud'];i<names.length;i++){
      var bus=context.createGain();bus.gain.value=i===0?1:0;bus.connect(output);this.buses[names[i]]=bus;
    }
  }
  SceneMixer.prototype.output=function(kind){return this.buses[kind];};
  SceneMixer.prototype.select=function(kind){
    if(kind===this.kind||!this.buses[kind])return;
    this.kind=kind;
    for(var name in this.buses){var param=this.buses[name].gain;holdParameter(param,this.context.currentTime);param.setTargetAtTime(name===kind?1:0,this.context.currentTime,.16);}
  };
  function TapAudio(context, output, asset) {
    this.context=context;this.output=output;this.buffer=null;this.voices=[];this.pending=[];this.failed=false;this.played=0;
    var self=this;
    function fail(){self.failed=true;self.pending.length=0;}
    try {
      var raw=root.atob(asset.base64),bytes=new Uint8Array(raw.length);
      for(var i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
      var decoded=context.decodeAudioData(bytes.buffer,function(buffer){
        self.buffer=buffer;
        var pending=self.pending.slice();self.pending.length=0;
        for(var n=0;n<pending.length;n++)self.play(pending[n]);
      },fail);
      if(decoded&&decoded.catch)decoded.catch(fail);
    } catch(error){fail();}
  }
  TapAudio.prototype.play=function(strength){
    if(this.failed)return false;
    if(!this.buffer){if(this.pending.length<4)this.pending.push(strength);return true;}
    var c=this.context;if(c.state!=='running')return false;
    // One-shot effects share one decoded buffer and keep at most four voices.
    if(this.voices.length>=4){var oldest=this.voices.shift();oldest.source.stop();oldest.source.disconnect();oldest.gain.disconnect();}
    var source=c.createBufferSource(),gain=c.createGain(),self=this;
    source.buffer=this.buffer;gain.gain.value=.5*Math.sqrt(Math.max(.1,Math.min(1,strength)));
    source.connect(gain);gain.connect(this.output);
    var voice={source:source,gain:gain};this.voices.push(voice);
    source.onended=function(){source.disconnect();gain.disconnect();var index=self.voices.indexOf(voice);if(index!==-1)self.voices.splice(index,1);};
    source.start();this.played++;return true;
  };
  TapAudio.prototype.stop=function(){
    this.pending.length=0;
    var voices=this.voices.slice();this.voices.length=0;
    for(var i=0;i<voices.length;i++){try{voices[i].source.stop();}catch(error){}voices[i].source.disconnect();voices[i].gain.disconnect();}
  };
  TapAudio.prototype.fadeOut=function(){
    this.pending.length=0;
    if(this.context.state!=='running'){this.stop();return;}
    for(var i=0;i<this.voices.length;i++){
      var voice=this.voices[i];if(voice.fading)continue;
      voice.fading=true;fadeParameter(this.context,voice.gain.gain,.12);voice.source.stop(this.context.currentTime+.65);
    }
  };
  function loopBuffer(context, original) {
    var overlap=Math.min(Math.floor(original.sampleRate*.12),Math.floor(original.length/4)),length=original.length-overlap;
    var buffer=context.createBuffer(original.numberOfChannels,length,original.sampleRate);
    for(var channel=0;channel<original.numberOfChannels;channel++){
      var input=original.getChannelData(channel),output=buffer.getChannelData(channel);
      for(var i=0;i<length;i++){
        output[i]=input[i+overlap];
        // Crossfade the tail into the omitted head; the seam joins adjacent source samples.
        if(i>=length-overlap){var at=i-(length-overlap),mix=at/Math.max(1,overlap-1);output[i]=output[i]*(1-mix)+input[at]*mix;}
      }
    }
    return buffer;
  }
  function decodeLoop(self, asset, ready, failed) {
    var context=self.context;
    function fail(){self.failed=true;if(failed)failed();}
    try {
      var raw=root.atob(asset.base64),bytes=new Uint8Array(raw.length);
      for(var i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
      var decoded=context.decodeAudioData(bytes.buffer,function(original){
        self.buffer=loopBuffer(context,original);
        if(ready)ready();
      },fail);
      if(decoded&&decoded.catch)decoded.catch(fail);
    }catch(error){fail();}
  }
  function startLoop(self) {
    var source=self.context.createBufferSource(),gain=self.context.createGain();
    source.buffer=self.buffer;source.loop=true;gain.gain.value=0;
    source.connect(gain);gain.connect(self.output);source.start();
    self.node={source:source,gain:gain};
  }
  function StrokeAudio(context, output, asset) {
    this.context=context;this.output=output;this.buffer=null;this.node=null;this.lastMove=-10;this.speed=0;this.failed=false;this.fadeEnd=0;
    var self=this;
    decodeLoop(this,asset,function(){if(self.speed>0&&context.currentTime-self.lastMove<.09)self.stroke(self.speed);},function(){self.speed=0;});
  }
  StrokeAudio.prototype.stroke=function(speed){
    var c=this.context;if(c.state!=='running'||this.failed)return;
    this.fadeEnd=0;
    this.lastMove=c.currentTime;this.speed=Math.max(0,Math.min(2.5,speed));
    if(!this.buffer)return;
    if(!this.node)startLoop(this);
    this.node.gain.gain.setTargetAtTime(.10+Math.min(1,this.speed/1.4)*.8,c.currentTime,.08);
  };
  StrokeAudio.prototype.release=function(){
    this.speed=0;
    if(this.node&&!this.fadeEnd){
      this.node.gain.gain.setTargetAtTime(0,this.context.currentTime,.12);
      this.fadeEnd=this.context.currentTime+.65;
    }
  };
  StrokeAudio.prototype.update=function(){
    var idle=this.context.currentTime-this.lastMove;
    if(idle>.09&&this.speed>0)this.release();
    if(this.fadeEnd&&this.context.currentTime>=this.fadeEnd)this.stop(true);
  };
  StrokeAudio.prototype.stop=function(immediate){
    this.speed=0;this.lastMove=-10;
    if(!immediate&&this.context.state==='running'){this.release();return;}
    this.fadeEnd=0;
    if(!this.node)return;
    var n=this.node;this.node=null;
    try{n.source.stop();}catch(error){}
    n.source.disconnect();n.gain.disconnect();
  };
  function RippleAudio(context, output, asset) {
    this.context=context;this.output=output;this.buffer=null;this.node=null;this.failed=false;this.fadeEnd=0;this.level=0;
    decodeLoop(this,asset);
  }
  RippleAudio.prototype.update=function(rms){
    // Small visible waves are already silent. Restart only above a higher RMS
    // threshold so residual waves cannot repeatedly reverse the fade.
    var strength=Number.isFinite(rms)?Math.max(0,rms):0,c=this.context;
    var threshold=this.node&&!this.fadeEnd ? .004 : .006;
    if(strength<=threshold||c.state!=='running'||this.failed){
      this.stop(c.state!=='running');
      if(this.fadeEnd&&c.currentTime>=this.fadeEnd)this.stop(true);
      return;
    }
    var level=Math.min(1,(strength-.004)/.056),previous=this.level;this.level=level;this.fadeEnd=0;
    if(!this.buffer)return;
    if(!this.node)startLoop(this);
    this.node.gain.gain.setTargetAtTime(level*.85,c.currentTime,level>previous ? .18 : .24);
  };
  RippleAudio.prototype.stop=function(immediate){
    this.level=0;
    if(!this.node){this.fadeEnd=0;return;}
    if(!immediate&&this.context.state==='running'){
      if(!this.fadeEnd){this.node.gain.gain.setTargetAtTime(0,this.context.currentTime,.12);this.fadeEnd=this.context.currentTime+.65;}
      return;
    }
    var n=this.node;this.node=null;this.fadeEnd=0;
    try{n.source.stop();}catch(error){}
    n.source.disconnect();n.gain.disconnect();
  };
  root.WaterSound = { Stroke: StrokeAudio, Ripple: RippleAudio, Tap: TapAudio, OneShot: TapAudio, SceneMixer: SceneMixer, fadeParameter: fadeParameter };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.WaterSound;
}(typeof window !== 'undefined' ? window : global));
