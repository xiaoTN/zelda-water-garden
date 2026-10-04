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
  function loopBuffer(context, original, seconds) {
    var overlap=Math.min(Math.floor(original.sampleRate*(seconds||.12)),Math.floor(original.length/4)),length=original.length-overlap;
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
  function decodeLoop(self, asset, ready, failed, seconds) {
    var context=self.context;
    function fail(){self.failed=true;if(failed)failed();}
    try {
      var raw=root.atob(asset.base64),bytes=new Uint8Array(raw.length);
      for(var i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
      var decoded=context.decodeAudioData(bytes.buffer,function(original){
        self.buffer=loopBuffer(context,original,seconds);
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
    // RMS includes both moving crests and rain waves, independent of grid size.
    var level=Number.isFinite(rms)?Math.max(0,Math.min(1,(rms-.0005)/.06)):0,c=this.context;
    if(level<=.005||c.state!=='running'||this.failed){
      this.stop(c.state!=='running');
      if(this.fadeEnd&&c.currentTime>=this.fadeEnd)this.stop(true);
      return;
    }
    var previous=this.level;this.level=level;this.fadeEnd=0;
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
  function Music(context, output, assets, random) {
    this.context=context;this.output=output;this.assets=assets;this.random=random||Math.random;this.kind=null;this.tracks={};
  }
  Music.prototype.level=function(track, target) {
    var time=this.context.currentTime,voice=track.node;
    // Evaluate our envelope explicitly so rapid reversals also work on Chrome 61.
    var value=voice.target+(voice.from-voice.target)*Math.exp(-(time-voice.at)/.25);
    voice.gain.gain.cancelScheduledValues(time);voice.gain.gain.setValueAtTime(value,time);
    voice.gain.gain.setTargetAtTime(target,time,.25);
    voice.from=value;voice.target=target;voice.at=time;track.fadeEnd=target?0:time+1.5;
  };
  Music.prototype.select=function(kind) {
    if(!this.assets[kind])return;
    this.kind=kind;this.update();
  };
  Music.prototype.update=function() {
    var c=this.context,self=this;
    if(c.state!=='running')return;
    for(var name in this.tracks){
      var track=this.tracks[name];
      if(track.fadeEnd&&c.currentTime>=track.fadeEnd)this.release(track);
      if(track.node&&name!==this.kind&&!track.fadeEnd)this.level(track,0);
    }
    if(!this.kind)return;
    var active=this.tracks[this.kind];
    if(!active){active={context:c,buffer:null,node:null,loading:false,failed:false,fadeEnd:0};this.tracks[this.kind]=active;}
    if(active.failed)return;
    if(active.node){if(active.fadeEnd)this.level(active,.42);return;}
    if(!active.buffer){
      if(active.loading)return;
      active.loading=true;var requested=this.kind;
      decodeLoop(active,this.assets[requested],function(){
        active.loading=false;
        if(self.kind!==requested||c.state!=='running'){active.buffer=null;return;}
        self.update();
      },function(){active.loading=false;},.8);
      return;
    }
    var source=c.createBufferSource(),gain=c.createGain();
    source.buffer=active.buffer;source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(this.output);
    var offset=(.02+Math.max(0,Math.min(.999999,this.random()))*.96)*active.buffer.duration*.5;
    active.node={source:source,gain:gain,offset:offset,from:0,target:0,at:c.currentTime};
    source.start(0,offset);this.level(active,.42);
  };
  Music.prototype.release=function(track) {
    var node=track.node;track.node=null;track.buffer=null;track.fadeEnd=0;
    if(node){try{node.source.stop();}catch(error){}node.source.disconnect();node.gain.disconnect();}
  };
  Music.prototype.stop=function() {
    this.kind=null;for(var name in this.tracks)this.release(this.tracks[name]);
  };
  Music.prototype.inspect=function() {
    var tracks=[];
    for(var name in this.tracks){var t=this.tracks[name];if(t.node)tracks.push({scene:name,offset:t.node.offset,duration:t.buffer.duration,loop:t.node.source.loop,fading:!!t.fadeEnd});}
    return {scene:this.kind,voices:tracks,loading:Object.keys(this.tracks).filter(function(name){return this.tracks[name].loading;},this).length};
  };
  root.WaterSound = { Music: Music, Stroke: StrokeAudio, Ripple: RippleAudio, Tap: TapAudio, OneShot: TapAudio, SceneMixer: SceneMixer, fadeParameter: fadeParameter };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.WaterSound;
}(typeof window !== 'undefined' ? window : global));
