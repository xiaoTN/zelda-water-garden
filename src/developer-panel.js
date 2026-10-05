(function () {
  'use strict';
  var store='moment-garden-tuning-v1';
  function prepare(settings) {
    if(!window.GardenTuning.local(window.location,!!(window.xhs && window.xhs.miniTool)))return false;
    try{settings.load(window.localStorage.getItem(store));}catch(error){}
    return true;
  }
  function mount(settings, changed) {
    var panel=document.getElementById('developer-panel'),controls={};
    panel.hidden=false;
    function element(tag,text,parent){var node=document.createElement(tag);if(text)node.textContent=text;if(parent)parent.appendChild(node);return node;}
    var toggle=element('button','开发者参数 · 本机',panel);toggle.className='dev-toggle';toggle.setAttribute('aria-controls','developer-controls');
    var body=element('div','',panel);body.id='developer-controls';body.className='dev-body';
    var expanded=window.innerWidth>=1000 && window.innerHeight>=640;
    function expand(){body.hidden=!expanded;toggle.setAttribute('aria-expanded',String(expanded));}
    toggle.addEventListener('click',function(){expanded=!expanded;expand();});expand();
    element('p','实时生效 · 只保存在当前浏览器',body).className='dev-note';
    var list=element('div','',body);list.className='dev-list';var group='';
    function save(){try{window.localStorage.setItem(store,JSON.stringify(settings.values));}catch(error){}}
    function refresh(){for(var key in controls){controls[key].range.value=settings.values[key];controls[key].number.value=settings.values[key];}json.value=JSON.stringify(settings.values,null,2);}
    window.GardenTuning.definitions.forEach(function(spec){
      if(group!==spec.group){group=spec.group;element('h2',group,list);}
      var row=element('div','',list);row.className='dev-row';
      var label=element('label',spec.label,row),range=element('input','',row),number=element('input','',row);
      range.type='range';range.id='tuning-'+spec.key;range.min=spec.min;range.max=spec.max;range.step=spec.step;label.htmlFor=range.id;
      number.type='number';number.min=spec.min;number.max=spec.max;number.step=spec.step;number.setAttribute('aria-label',spec.label+'数值');
      controls[spec.key]={range:range,number:number};
      function apply(input){if(input.value!=='' && settings.set(spec.key,Number(input.value))){refresh();changed(spec.key);}}
      range.addEventListener('input',function(){apply(range);});range.addEventListener('change',save);
      number.addEventListener('change',function(){apply(number);refresh();save();});
    });
    var actions=element('div','',body);actions.className='dev-actions';
    var reset=element('button','恢复默认',actions),show=element('button','查看参数',actions);
    var json=element('textarea','',body);json.className='dev-json';json.readOnly=true;json.hidden=true;json.setAttribute('aria-label','当前参数 JSON，可选中文字复制');
    reset.addEventListener('click',function(){settings.reset();refresh();changed();save();});
    show.addEventListener('click',function(){json.hidden=!json.hidden;show.textContent=json.hidden?'查看参数':'收起参数';});
    // Panel drags must not reach the fallback window-level mouse handlers.
    ['pointerdown','pointermove','pointerup','touchstart','touchmove','touchend','mousedown','mousemove','mouseup','keydown'].forEach(function(name){panel.addEventListener(name,function(event){event.stopPropagation();});});
    refresh();
  }
  window.GardenDeveloper={prepare:prepare,mount:mount};
}());
