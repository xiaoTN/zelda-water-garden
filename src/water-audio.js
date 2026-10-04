(function (root) {
  'use strict';
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
    // Rapid taps share one decoded buffer and keep at most four short voices.
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
  function StrokeAudio(context, output, asset) {
    this.context=context;this.output=output;this.buffer=null;this.node=null;this.lastMove=-10;this.speed=0;this.failed=false;this.fadeEnd=0;
    var self=this;
    function fail(){self.failed=true;self.speed=0;}
    try {
      var raw=root.atob(asset.base64),bytes=new Uint8Array(raw.length);
      for(var i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
      var decoded=context.decodeAudioData(bytes.buffer,function(original){
        self.buffer=loopBuffer(context,original);
        if(self.speed>0&&context.currentTime-self.lastMove<.09)self.stroke(self.speed);
      },fail);
      if(decoded&&decoded.catch)decoded.catch(fail);
    }catch(error){fail();}
  }
  StrokeAudio.prototype.stroke=function(speed){
    var c=this.context;if(c.state!=='running'||this.failed)return;
    this.fadeEnd=0;
    this.lastMove=c.currentTime;this.speed=Math.max(0,Math.min(2.5,speed));
    if(!this.buffer)return;
    if(!this.node){
      var source=c.createBufferSource(),gain=c.createGain();
      source.buffer=this.buffer;source.loop=true;gain.gain.value=0;
      source.connect(gain);gain.connect(this.output);source.start();
      this.node={source:source,gain:gain};
    }
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
  root.WaterSound = { Stroke: StrokeAudio, Tap: TapAudio };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.WaterSound;
}(typeof window !== 'undefined' ? window : global));
