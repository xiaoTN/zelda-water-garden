(function (root) {
  'use strict';
  var definitions = [
    {key:'boatInertia', group:'纸船', label:'惯性强度', value:1.1, min:0, max:3, step:.05},
    {key:'boatFriction', group:'纸船', label:'水面阻力', value:1.25, min:.3, max:5, step:.05},
    {key:'boatThrowThreshold', group:'纸船', label:'甩动触发速度', value:.15, min:.02, max:1, step:.01},
    {key:'boatMaxSpeed', group:'纸船', label:'最高滑行速度', value:1.5, min:.2, max:3, step:.05},
    {key:'boatSize', group:'纸船', label:'纸船大小', value:.6, min:.6, max:1.5, step:.05},
    {key:'boatRocking', group:'纸船', label:'随波摇晃幅度', value:.7, min:0, max:1.5, step:.05},
    {key:'boatFlow', group:'纸船', label:'水流推动力度', value:1, min:0, max:3, step:.1},
    {key:'inertia', group:'雪球', label:'惯性强度', value:1.15, min:0, max:2.5, step:.05},
    {key:'friction', group:'雪球', label:'减速摩擦', value:4.6, min:.3, max:6, step:.1},
    {key:'throwThreshold', group:'雪球', label:'甩动触发速度', value:3.8, min:.3, max:5, step:.1},
    {key:'maxSpeed', group:'雪球', label:'最高滚动速度', value:10, min:2, max:16, step:.5},
    {key:'growth', group:'雪球', label:'雪球生长速度', value:.035, min:0, max:.15, step:.005},
    {key:'initialRadius', group:'雪球', label:'初始半径', value:.025, min:.01, max:.05, step:.001},
    {key:'snowBrush', group:'雪地', label:'划雪范围', value:.04, min:.02, max:.09, step:.005},
    {key:'snowfall', group:'雪地', label:'飘雪回填速度', value:1, min:0, max:3, step:.1},
    {key:'waterStroke', group:'水与云', label:'拨水力度', value:1, min:.25, max:2, step:.05},
    {key:'cloudBrush', group:'水与云', label:'拨云范围', value:.065, min:.03, max:.10, step:.005},
    {key:'cloudHalo', group:'水与云', label:'云层羽化范围', value:.18, min:.12, max:.30, step:.01},
    {key:'cloudPush', group:'水与云', label:'推云力度', value:2.6, min:0, max:5, step:.1},
    {key:'cloudRecovery', group:'水与云', label:'云隙恢复速度', value:1, min:.3, max:3, step:.1},
    {key:'sceneDuration', group:'场景', label:'切换时长（秒）', value:.84, min:.3, max:1.8, step:.06}
  ];
  function Settings() { this.values = {}; this.reset(); }
  Settings.prototype.set = function (key, value) {
    var spec = null; for(var i=0;i<definitions.length;i++)if(definitions[i].key===key)spec=definitions[i];
    if(!spec || typeof value !== 'number' || !isFinite(value))return false;
    this.values[key] = Math.max(spec.min,Math.min(spec.max,value)); return true;
  };
  Settings.prototype.reset = function () { for(var i=0;i<definitions.length;i++)this.values[definitions[i].key]=definitions[i].value; };
  Settings.prototype.load = function (text) {
    try { var values=JSON.parse(text); if(!values || typeof values!=='object' || Array.isArray(values))return;
      for(var key in values)if(Object.prototype.hasOwnProperty.call(values,key))this.set(key,values[key]);
    } catch(error) {}
  };
  function local(location, bridge) {
    return !bridge && (location.protocol==='http:' || location.protocol==='https:') &&
      /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(location.hostname);
  }
  var api={Settings:Settings, definitions:definitions, local:local};
  root.GardenTuning=api;
  if(typeof module!=='undefined' && module.exports)module.exports=api;
}(typeof window!=='undefined'?window:global));
