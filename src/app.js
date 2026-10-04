(function () {
  'use strict';
  var core = window.WaterCore, garden = document.getElementById('garden'), canvas = document.getElementById('water');
  var fallback = document.getElementById('fallback'), overlay = document.getElementById('life'), ctx = overlay.getContext('2d');
  var fctx = fallback.getContext('2d'), hint = document.getElementById('hint'), cursor = document.getElementById('cursor');
  var renderer = null, scene, field, width = 1, height = 1, mode = 'touch', light = 0, rain = false, muted = true;
  var leaves = [], drops = [], rings = [], dust = [], fingers = {}, reduced = false;
  var iceEffects = new window.WaterIce.Effects();
  var stoneDrops = new window.WaterStones.System(), fallbackTerrain = null, fallbackBed = null, stoneBedDirty = false;
  var now = 0, lastFrame = 0, lastRender = 0, accumulator = 0, rainTimer = 0, frameId = 0, lostCount = 0, fallbackMode = false;
  var slowFrames = 0, frameSamples = 0, frameTotal = 0, quality = 'normal', resized = false;
  var audio = null, master = null, audioLast = 0, audioNodes = [], noticeTimer = 0;
  var hints = { touch: '轻点泛起涟漪 · 滑动拨开水面 · 长按蓄起水波', leaf: '轻点放下一片浮叶 · 滑动水面，推着叶子走', ice: '点水结冰 · 点冰踩碎 · 滑动凝出一条冰径', stone: '轻点选择落点 · 随机石头从高处落下 · 平静可清除' };
  var sceneKind = 'water', natureCanvas = document.getElementById('nature');
  var snow = new window.GardenNature.Snow(), clouds = new window.GardenNature.Clouds();
  var natureRenderer = new window.NatureRenderer(natureCanvas, snow, clouds);
  var natureModes = { snow: 0, cloud: 0 }, weather = { snow: false, cloud: false };
  var natureIcons = {
    snow: ['M3 17c3-8 5 7 9-2s5 3 9-8M4 21c3-5 5 3 8-2', 'M7 3c-4 0-4 10-1 10s4-10 1-10ZM16 8c-4 0-4 10-1 10s4-10 1-10ZM4 16v3h3v-3Zm9 5h3', 'M20 12a8 8 0 1 1-16 0 8 8 0 1 1 16 0ZM7 11c0-3 2-4 4-4M4 21h12'],
    cloud: ['M8 16H6a4 4 0 1 1 1-8 5 5 0 0 1 9-1 4 4 0 0 1 2 9h-2M9 12l-3 3 3 3m6-6 3 3-3 3', 'M6 17a4 4 0 1 1 1-8 5 5 0 0 1 9-1 4 4 0 0 1 2 9M3 21h6l-2-2m14 2h-6l2-2', 'M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 17h5a3 3 0 1 1-3 3']
  };
  var natureHints = {
    snow: ['滑动划出雪痕 · 长按压实积雪', '轻点踩下脚印 · 拖动走出一串足迹', '轻点放下雪球 · 拖着滚动，越滚越大'],
    cloud: ['轻点推开云海 · 滑动划出云间小径', '按住聚拢云团 · 缓缓拖动，带着云走', '拖动送出一阵风 · 松手后云团随风漂移']
  };
  if (window.matchMedia) reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function notice(text) {
    var element = document.getElementById('notice'); element.textContent = text; element.classList.add('show');
    clearTimeout(noticeTimer); noticeTimer = setTimeout(function () { element.classList.remove('show'); }, 2400);
  }
  function initAudio() {
    if (audio) { if (audio.state === 'suspended') audio.resume().catch(function () {}); return true; }
    var Constructor = window.AudioContext || window.webkitAudioContext;
    if (!Constructor) { notice('这里暂时无法播放声音，仍可继续体验'); return false; }
    try {
      audio = new Constructor(); master = audio.createGain(); master.gain.value = .38; master.connect(audio.destination);
      if (audio.state === 'suspended') audio.resume().catch(function () {});
      return true;
    } catch (error) { notice('这里暂时无法播放声音，仍可继续体验'); return false; }
  }
  function sound(strength, deep, icy) {
    if (muted || !audio || audio.state !== 'running' || now - audioLast < .09 || audioNodes.length >= 8) return;
    audioLast = now;
    var length = Math.floor(audio.sampleRate * .22), buffer = audio.createBuffer(1, length, audio.sampleRate), values = buffer.getChannelData(0);
    for (var i = 0; i < length; i++) values[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    var noise = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain(), t = audio.currentTime;
    noise.buffer = buffer; filter.type = icy ? 'highpass' : 'lowpass'; filter.frequency.setValueAtTime(icy ? 1700 : (deep ? 1200 : 2600), t); filter.frequency.exponentialRampToValueAtTime(icy ? 4800 : 180, t + .22);
    gain.gain.setValueAtTime(Math.min(.25, .05 + strength * .15), t); gain.gain.exponentialRampToValueAtTime(.001, t + .22);
    if (sceneKind !== 'water') { filter.type = 'lowpass'; filter.frequency.setValueAtTime(sceneKind === 'snow' ? 2400 : 650, t); filter.frequency.exponentialRampToValueAtTime(sceneKind === 'snow' ? 700 : 180, t + .22); }
    noise.connect(filter); filter.connect(gain); gain.connect(master); noise.start(t); noise.stop(t + .23);
    var osc = audio.createOscillator(), tone = audio.createGain(); osc.type = 'sine';
    osc.frequency.setValueAtTime(icy ? 1800 : (deep ? 310 : 650 + Math.random() * 180), t); osc.frequency.exponentialRampToValueAtTime(icy ? 620 : 100, t + .16);
    tone.gain.setValueAtTime(.03 + Math.min(strength, 1) * .08, t); tone.gain.exponentialRampToValueAtTime(.001, t + .18);
    if (sceneKind !== 'water') tone.gain.setValueAtTime(.001, t);
    osc.connect(tone); tone.connect(master); osc.start(t); osc.stop(t + .2);
    var node = { noise: noise, filter: filter, gain: gain, osc: osc, tone: tone }; audioNodes.push(node);
    noise.onended = function () { noise.disconnect(); filter.disconnect(); gain.disconnect(); osc.disconnect(); tone.disconnect(); var index = audioNodes.indexOf(node); if (index !== -1) audioNodes.splice(index, 1); };
  }
  function stopAudio() {
    for (var i = 0; i < audioNodes.length; i++) { try { audioNodes[i].noise.stop(); audioNodes[i].osc.stop(); } catch (error) {} }
    if (audio && audio.state === 'running') audio.suspend().catch(function () {});
  }
  function fallbackOn(message) {
    if (renderer) renderer.destroy(); renderer = null; fallbackMode = true; quality = 'canvas2d';
    canvas.style.display = 'none'; fallback.style.display = 'block';
    if (field) {
      scene = window.WaterScene.create(field.aspect, true);
      prepareFallbackStones();
    }
    fallback.removeAttribute('aria-hidden'); fallback.setAttribute('aria-label', '交互水池，轻点起涟漪，滑动拨水'); fallback.setAttribute('tabindex', '0');
    syncSurfaces();
    if (message) notice(message);
  }
  function resize() {
    width = Math.max(1, garden.clientWidth); height = Math.max(1, window.innerHeight);
    garden.style.setProperty('--app-height', height + 'px');
    var size = core.bufferSize(width, height, window.devicePixelRatio, quality !== 'normal');
    overlay.width = size.width; overlay.height = size.height; fallback.width = size.width; fallback.height = size.height;
    ctx.setTransform(size.scale, 0, 0, size.scale, 0, 0); fctx.setTransform(size.scale, 0, 0, size.scale, 0, 0);
    natureRenderer.resize(width, height, quality !== 'normal');
    if (renderer) renderer.destroy(); renderer = null;
    var aspect = width / height, nx = aspect >= 1 ? 192 : Math.max(64, Math.round(192 * aspect)), ny = aspect >= 1 ? Math.max(64, Math.round(192 / aspect)) : 192;
    var previousIce = field ? field.ice : null;
    field = new core.WaveField(nx, ny, aspect); field.ice.restore(previousIce); scene = window.WaterScene.create(aspect, fallbackMode);
    if (!fallbackMode) {
      try { renderer = new window.WaterRenderer(canvas, scene, field); renderer.dropSystem = stoneDrops; renderer.low = quality === 'low'; renderer.resize(width, height); }
      catch (error) { fallbackOn('已为你换成轻量水面'); }
    }
    if(!field.bathymetry)prepareFallbackStones();
    fingers = {}; leaves.length = 0; drops.length = 0; rings.length = 0;
    // Three small existing leaves make the pool feel alive before the first touch.
    addLeaf(.22, .48); addLeaf(.76, .56); addLeaf(.70, .29);
    dust.length = 0;
    var random = core.seededRandom(93412);
    for (var i = 0; i < 24; i++) dust.push({ u: random(), v: random(), phase: random() * 6.28, size: .5 + random() * 1.2 });
    accumulator = 0; lastFrame = 0; lastRender = 0; resized = false;
    syncSurfaces();
  }
  function prepareFallbackStones() {
    fallbackTerrain=window.WaterTerrain.create(field.aspect,true);fallbackBed=window.WaterTerrain.bathymetry(fallbackTerrain,field.aspect,true);
    stoneDrops.attach(field.aspect,fallbackBed,fallbackTerrain);refreshStoneBed();
  }
  function refreshStoneBed() {
    if(renderer){renderer.refreshDrops();return;}
    var extra=stoneDrops.geometry(true),bed=fallbackBed;
    if(extra.length){var all=new Float32Array(fallbackTerrain.stones.length+extra.length);all.set(fallbackTerrain.stones);all.set(extra,fallbackTerrain.stones.length);bed=window.WaterTerrain.bathymetry({ground:fallbackTerrain.ground,stones:all},field.aspect,true);}
    field.setBathymetry(bed);
  }
  function stoneEvent(event,stone) {
    stoneBedDirty=true;
    if(event!=='impact')return;
    if(field.ice.sample(stone.u,stone.v)>.1){iceEffects.breakAt(stone.u,stone.v,Math.max(.05,stone.radius*.7),now);}
    field.ice.paint(stone.u,stone.v,Math.max(.045,stone.radius*.65),false,false);
    field.disturb(stone.u,stone.v,.75,stone.radius*.45);
    for(var i=0;i<16;i++){
      var a=i/16*Math.PI*2,r=stone.radius*1.22;
      field.disturb(stone.u+Math.cos(a)*r/(field.aspect*2),stone.v+Math.sin(a)*r*.4330127,.24,Math.max(.009,stone.radius*.16));
    }
    sound(.9,true);
  }
  function addLeaf(u, v) {
    if (core.shore(u, v) > -.06) return;
    if (leaves.length >= 18) leaves.shift();
    leaves.push({ u: u, v: v, vx: 0, vy: 0, angle: Math.random() * 6.28, turn: (Math.random() - .5) * .6, size: 10 + Math.random() * 5, hue: Math.random() });
  }
  function addRing(u, v, strength) {
    if (rings.length >= 48) rings.shift();
    rings.push({ u: u, v: v, born: now, strength: strength });
  }
  function splash(u, v, strength, noSpray, noRing) {
    if (core.shore(u, v) >= -.015 || field.ice.sample(u, v) > .45) return false;
    field.disturb(u, v, strength, .015 + strength * .013);
    if (!noRing) addRing(u, v, strength);
    var count = reduced || noSpray ? 0 : Math.floor((quality === 'normal' ? 20 : 9) * strength), limit = quality === 'normal' ? 150 : 60;
    for (var i = 0; i < count && drops.length < limit; i++) {
      var a = Math.random() * Math.PI * 2, speed = 15 + Math.random() * strength * 90;
      drops.push({ u: u, v: v, x: 0, y: 0, z: 0, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * .55, vz: 45 + Math.random() * 90 * strength, born: now, life: .35 + Math.random() * .4, size: .7 + Math.random() * strength * 1.2 });
    }
    return true;
  }
  function point(x, y) { return { u: x / width, v: y / height }; }
  function swipeRipple(f, p, distance) {
    f.rippleDistance += distance;
    if (f.rippleDistance >= 10 && now - f.last > .12) {
      splash(p.u,p.v,.15,true,true); sound(.15,false); f.rippleDistance %= 10; f.last = now;
    }
  }
  function iceRadius() { return Math.min(width, height) / height * .16; }
  function freezeAt(u, v, small) {
    var radius = iceRadius() * (small ? .62 : 1);
    field.ice.paint(u, v, radius, true, false); iceEffects.freeze(u, v, radius, now); sound(.18, false, true);
  }
  function breakAt(u, v) { iceEffects.breakAt(u, v, iceRadius() * .9, now); sound(.8, true, true); }
  function begin(id, x, y) {
    var p = point(x, y);
    if (sceneKind !== 'water') { if(natureRenderer.surface)p=natureRenderer.surface.point(p.u,p.v,sceneKind,clouds); beginNature(id, p); return; }
    if(mode!=='stone'&&stoneDrops.blocks(p.u,p.v))return;
    if (mode!=='stone' && renderer && renderer.terrain.blocks(p.u, p.v)) return;
    if (core.shore(p.u, p.v) >= -.025) { notice('轻触池中的青绿水面'); return; }
    garden.classList.add('touched');
    if (!muted) initAudio();
    if(mode==='stone'){
      if(!stoneDrops.add(p.u,p.v))notice(stoneDrops.items.length>=window.WaterStones.limit?'石头已经够多了，轻点「平静」重新开始':'轻点池中的位置落石');
      return;
    }
    fingers[id] = { u: p.u, v: p.v, startU: p.u, startV: p.v, born: now, last: now, rippleDistance: 0, travel: 0, charged: false };
    if (field.ice.sample(p.u, p.v) > .45 || (mode === 'ice' && field.ice.sample(p.u, p.v, true))) {
      fingers[id].iceAction = 'break'; breakAt(p.u, p.v);
    } else if (mode === 'ice') { fingers[id].iceAction = 'freeze'; freezeAt(p.u, p.v, false); }
    else if (mode === 'leaf') { addLeaf(p.u, p.v); splash(p.u, p.v, .10, true, true); sound(.1, false); }
    else { splash(p.u, p.v, .32, true, true); sound(.32, false); }
  }
  function move(id, x, y) {
    var f = fingers[id]; if (!f) return;
    var p = point(x, y), dx = (p.u - f.u) * width, dy = (p.v - f.v) * height, distance = Math.sqrt(dx * dx + dy * dy);
    if (sceneKind !== 'water') { if(natureRenderer.surface)p=natureRenderer.surface.point(p.u,p.v,sceneKind,clouds); distance=Math.hypot((p.u-f.u)*width,(p.v-f.v)*height); moveNature(f, p, distance); return; }
    f.travel += distance;
    if (stoneDrops.blocks(p.u,p.v) || (renderer && renderer.terrain.blocks(p.u, p.v))) { f.u=p.u;f.v=p.v;return; }
    if (core.shore(p.u, p.v) < -.02) {
      if (f.iceAction || mode === 'ice') {
        if (f.iceAction === 'freeze' && distance > 1) {
          var count = Math.min(24, Math.max(1, Math.ceil(distance / 12)));
          for (var n = 1; n <= count; n++) field.ice.paint(f.u + (p.u - f.u) * n / count, f.v + (p.v - f.v) * n / count, iceRadius() * .62, true, false);
          if (now - f.last > .12) { iceEffects.freeze(p.u, p.v, iceRadius() * .62, now); sound(.1, false, true); f.last = now; }
        } else if (f.iceAction === 'break' && distance > 3 && now - f.last > .15 && field.ice.sample(p.u, p.v) > .45) { breakAt(p.u, p.v); f.last = now; }
      } else if (field.ice.sample(p.u, p.v) > .45) {
        if (now - f.last > .15) { breakAt(p.u, p.v); f.last = now; }

      } else {
        field.stroke(f.u, f.v, p.u, p.v, Math.min(.17, .035 + distance * .002));
        pushLeaves(p.u, p.v, dx / width, dy / height);
        swipeRipple(f, p, distance);
      }
    } else { f.rippleDistance = 0; }
    f.u = p.u; f.v = p.v;
  }
  function end(id, cancelled) {
    var f = fingers[id]; if (!f) return;
    if (sceneKind !== 'water') { delete fingers[id]; return; }
    if (!cancelled && mode === 'touch' && f.charged) { splash(f.u, f.v, Math.min(1.1, .45 + (now - f.born) * .18), true); sound(1, true); }
    else if (!cancelled && !f.iceAction && mode !== 'ice' && f.travel < 15 && field.ice.sample(f.u, f.v) < .45) {
      // Wait until release to distinguish a tap from a swipe; swipes have no drawn rings.
      addRing(f.u, f.v, mode === 'leaf' ? .10 : .32);
    }
    delete fingers[id];
  }
  function pushLeaves(u, v, dx, dy) {
    for (var i = 0; i < leaves.length; i++) {
      var leaf = leaves[i], x = (leaf.u - u) * width, y = (leaf.v - v) * height, r = Math.sqrt(x * x + y * y);
      if (r < 130) { var force = (1 - r / 130) * 3.5; leaf.vx += dx * force; leaf.vy += dy * force; leaf.turn += dx * 7; }
    }
  }
  function bindInteractions(surface) {
    if (window.PointerEvent) {
      surface.addEventListener('pointerdown', function (event) {
        if (event.button !== 0) return;
        event.preventDefault(); begin(event.pointerId, event.clientX, event.clientY);
        if (surface.setPointerCapture && fingers[event.pointerId]) { try { surface.setPointerCapture(event.pointerId); } catch (error) {} }
      });
      surface.addEventListener('pointermove', function (event) {
        move(event.pointerId, event.clientX, event.clientY);
        if (event.pointerType === 'mouse' && (sceneKind !== 'water' || core.shore(event.clientX / width, event.clientY / height) < -.02)) { cursor.style.display = 'block'; cursor.style.left = event.clientX + 'px'; cursor.style.top = event.clientY + 'px'; } else cursor.style.display = 'none';
      });
      surface.addEventListener('pointerup', function (event) { end(event.pointerId, false); });
      surface.addEventListener('pointercancel', function (event) { end(event.pointerId, true); });
      surface.addEventListener('lostpointercapture', function (event) { end(event.pointerId, true); });
      surface.addEventListener('pointerleave', function () { cursor.style.display = 'none'; });
    } else {
      surface.addEventListener('touchstart', function (event) { event.preventDefault(); for (var i = 0; i < event.changedTouches.length; i++) { var t = event.changedTouches[i]; begin(t.identifier, t.clientX, t.clientY); } }, { passive: false });
      surface.addEventListener('touchmove', function (event) { event.preventDefault(); for (var i = 0; i < event.changedTouches.length; i++) { var t = event.changedTouches[i]; move(t.identifier, t.clientX, t.clientY); } }, { passive: false });
      surface.addEventListener('touchend', function (event) { for (var i = 0; i < event.changedTouches.length; i++) end(event.changedTouches[i].identifier, false); });
      surface.addEventListener('touchcancel', function (event) { for (var i = 0; i < event.changedTouches.length; i++) end(event.changedTouches[i].identifier, true); });
      surface.addEventListener('mousedown', function (event) { if (event.button === 0) begin('mouse', event.clientX, event.clientY); });
    }
  }
  bindInteractions(canvas); bindInteractions(fallback); bindInteractions(natureCanvas);
  if (!window.PointerEvent) {
    window.addEventListener('mousemove', function (event) { move('mouse', event.clientX, event.clientY); });
    window.addEventListener('mouseup', function () { end('mouse', false); });
  }
  function keyRipple(event) { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); begin('key', width * .5, height * .49); end('key', false); } }
  canvas.addEventListener('keydown', keyRipple); fallback.addEventListener('keydown', keyRipple);
  natureCanvas.addEventListener('keydown', keyRipple);
  function syncSurfaces() {
    var water = sceneKind === 'water';
    canvas.style.display = water && !fallbackMode ? 'block' : 'none';
    fallback.style.display = water && fallbackMode ? 'block' : 'none'; overlay.style.display = water ? 'block' : 'none';
    natureCanvas.style.display = water ? 'none' : 'block';
    canvas.setAttribute('aria-hidden', String(!water || fallbackMode)); canvas.tabIndex = water && !fallbackMode ? 0 : -1;
    fallback.setAttribute('aria-hidden', String(!water || !fallbackMode)); fallback.tabIndex = water && fallbackMode ? 0 : -1;
    natureCanvas.setAttribute('aria-hidden', String(water)); natureCanvas.tabIndex = water ? -1 : 0;
  }
  function syncNatureControls() {
    var water = sceneKind === 'water', names = sceneKind === 'snow' ? ['划雪','脚印','雪球'] : ['拨云','聚云','送风'];
    document.querySelector('.modes').hidden = !water;
    document.getElementById('nature-modes').hidden = water;
    document.getElementById('ice-actions').hidden = !water || mode !== 'ice';
    var controls = document.querySelectorAll('[data-nature]');
    for (var i = 0; i < controls.length; i++) {
      controls[i].querySelector('span').textContent = names[i];
      if (!water) { controls[i].querySelector('svg').innerHTML = '<path d="' + natureIcons[sceneKind][i] + '"/>'; }
      controls[i].classList.toggle('selected', i === natureModes[sceneKind]); controls[i].setAttribute('aria-pressed', String(i === natureModes[sceneKind]));
    }
    hint.textContent = water ? hints[mode] : natureHints[sceneKind][natureModes[sceneKind]];
    natureCanvas.setAttribute('aria-label', (sceneKind === 'snow' ? '交互雪地，' : '交互云层，') + hint.textContent + '；空格或回车触碰中央');
    var weatherName = water ? '细雨' : sceneKind === 'snow' ? '飘雪' : '微风', enabled = water ? rain : weather[sceneKind];
    var rainButton = document.getElementById('rain'); rainButton.querySelector('span').textContent = weatherName;
    rainButton.querySelector('svg').innerHTML = '<path d="' + (water ? 'M6 14a4 4 0 0 1-1-8 6 6 0 0 1 11-1 4 4 0 0 1 2 9M7 16l-1 4m6-4-1 4m6-4-1 4' : sceneKind === 'snow' ? 'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M17 19l-1-4 4-1' : natureIcons.cloud[2]) + '"/>';
    rainButton.setAttribute('aria-label', (enabled ? '关闭' : '开启') + weatherName); rainButton.setAttribute('aria-pressed', String(enabled));
    var soundName = water ? '水声' : sceneKind === 'snow' ? '雪声' : '风声';
    document.getElementById('sound').querySelector('span').textContent = soundName;
    document.getElementById('sound').setAttribute('aria-label', (muted ? '开启' : '关闭') + soundName);
    document.getElementById('reset').querySelector('span').textContent = water ? '平静' : sceneKind === 'snow' ? '新雪' : '云海';
    document.getElementById('reset').setAttribute('aria-label', water ? '让水池归于平静' : sceneKind === 'snow' ? '铺一场新雪，清除足迹和雪球' : '重置云海');
    document.querySelector('.toolbar').setAttribute('aria-label', water ? '水面玩法' : sceneKind === 'snow' ? '雪地玩法' : '云层玩法');
  }
  function setScene(kind) {
    if (kind === sceneKind) return;
    fingers = {}; cursor.style.display = 'none'; accumulator = 0; stopAudio(); sceneKind = kind;
    garden.setAttribute('data-scene', kind); garden.classList.remove('touched');
    var titles = { water: '水之庭', snow: '雪之野', cloud: '云之境' };
    document.getElementById('scene-title').textContent = titles[kind]; document.title = '海拉鲁 · ' + titles[kind];
    garden.setAttribute('aria-label', document.title);
    document.getElementById('scene-subtitle').textContent = { water: 'HYRULE WATER GARDEN', snow: 'HYRULE SNOW FIELD', cloud: 'HYRULE CLOUD SANCTUARY' }[kind];
    document.querySelector('.pool-caption').textContent = { water: '✧ 一池水，一点宁静 ✧', snow: '✧ 把足迹，留在新雪里 ✧', cloud: '✧ 拨开云，遇见一线天光 ✧' }[kind];
    document.querySelector('.footnote').textContent = { water: '风吹过的地方，水会记得。', snow: '每一步，都有柔软的回声。', cloud: '让心事，随云慢慢走。' }[kind];
    var selectors = document.querySelectorAll('[data-scene]');
    for (var i = 0; i < selectors.length; i++) if (selectors[i].tagName === 'BUTTON') { var selected = selectors[i].getAttribute('data-scene') === kind; selectors[i].classList.toggle('selected', selected); selectors[i].setAttribute('aria-pressed', String(selected)); }
    syncSurfaces(); syncNatureControls();
    if (kind !== 'water') natureRenderer.draw(kind, light, now, weather[kind], reduced);
    if (!muted) initAudio();
  }
  var sceneButtons = document.querySelectorAll('button[data-scene]');
  for (var si = 0; si < sceneButtons.length; si++) sceneButtons[si].addEventListener('click', function () { setScene(this.getAttribute('data-scene')); });
  var natureButtons = document.querySelectorAll('[data-nature]');
  for (var ni = 0; ni < natureButtons.length; ni++) natureButtons[ni].addEventListener('click', function () { fingers = {}; natureModes[sceneKind] = Number(this.getAttribute('data-nature')); syncNatureControls(); });
  function natureRadius() { return Math.min(width, height) / height; }
  function beginNature(id, p) {
    if (p.v < .29 || p.v > .86) return;
    garden.classList.add('touched'); if (!muted) initAudio();
    var f = { u: p.u, v: p.v, born: now, last: now, travel: 0, spacing: 0, angle: 0 }, selected = natureModes[sceneKind];
    fingers[id] = f;
    if (sceneKind === 'snow') {
      var r = natureRadius();
      if (selected === 0) snow.stamp(p.u, p.v, r * .04, .65);
      else if (selected === 1) snow.footprint(p.u, p.v, 0, r * .045);
      else { f.ball = snow.ball(p.u, p.v, r * .042); if (!f.ball) notice('已有十二个雪球，轻点「新雪」重新开始'); }
    } else clouds.touch(p.u, p.v, ['part','gather','wind'][selected], .018, 0, .22);
    sound(.22, false);
  }
  function moveNature(f, p, distance) {
    p.u = core.clamp(p.u, 0, 1); p.v = core.clamp(p.v, .29, .86);
    var selected = natureModes[sceneKind], r = natureRadius();
    if (sceneKind === 'snow') {
      if (selected === 0) snow.stroke(f.u, f.v, p.u, p.v, r * .04, .65);
      else if (selected === 1 && distance > 0) {
        var dx = (p.u - f.u) * width, dy = (p.v - f.v) * height, step = Math.min(width, height) * .095;
        f.angle = Math.atan2(dy, dx) + Math.PI / 2;
        var actual = Math.hypot(dx, dy), next = step - f.spacing;
        for (; next <= actual; next += step) snow.footprint(f.u + (p.u - f.u) * next / actual, f.v + (p.v - f.v) * next / actual, f.angle, r * .045);
        f.spacing = (f.spacing + actual) % step;
      } else if (f.ball) snow.roll(f.ball, p.u, p.v);
    } else {
      var count = Math.min(24, Math.max(1, Math.ceil(distance / 12)));
      for (var i = 1; i <= count; i++) clouds.touch(f.u + (p.u - f.u) * i / count, f.v + (p.v - f.v) * i / count, ['part','gather','wind'][selected], (p.u - f.u) / count, (p.v - f.v) / count, .045);
    }
    if (distance > 2 && now - f.last > .16) { sound(.15, false); f.last = now; }
    f.travel += distance; f.u = p.u; f.v = p.v;
  }
  function updateNature(dt) {
    for (var id in fingers) {
      var f = fingers[id], selected = natureModes[sceneKind];
      if (sceneKind === 'snow' && selected === 0 && f.travel < 15 && now - f.born > .3) snow.stamp(f.u, f.v, natureRadius() * .04, Math.min(1, .65 + (now - f.born) * .2));
      if (sceneKind === 'cloud' && selected < 2) clouds.touch(f.u, f.v, selected === 0 ? 'part' : 'gather', 0, 0, dt);
    }
    if (sceneKind === 'snow') snow.update(dt, weather.snow);
    else clouds.update(dt, weather.cloud, reduced);
    natureRenderer.draw(sceneKind, light, now, weather[sceneKind], reduced);
  }
  var buttons = document.querySelectorAll('[data-mode]');
  for (var b = 0; b < buttons.length; b++) buttons[b].addEventListener('click', function () {
    fingers = {}; mode = this.getAttribute('data-mode'); hint.textContent = hints[mode];
    document.getElementById('ice-actions').hidden = mode !== 'ice';
    canvas.setAttribute('aria-label', mode === 'stone' ? '交互水池，轻点选择落点，石头从高空落下' : mode === 'ice' ? '交互水池，点水结冰，点冰踩碎，滑动生成冰径' : '交互水池，轻点起涟漪，滑动拨水，点冰踩碎');
    for (var i = 0; i < buttons.length; i++) { var selected = buttons[i] === this; buttons[i].classList.toggle('selected', selected); buttons[i].setAttribute('aria-pressed', String(selected)); }
  });
  document.getElementById('freeze-all').addEventListener('click', function () {
    fingers = {}; iceEffects.clear(); rings.length = 0; drops.length = 0;
    field.ice.paint(.5, .49, 1, true, true); garden.classList.add('touched');
    iceEffects.freeze(.5, .49, Math.min(width, height) / height * .42, now);
    if (!muted) initAudio(); sound(.4, false, true); notice('一池薄冰，试着轻点踩碎');
  });
  document.getElementById('thaw-all').addEventListener('click', function () {
    fingers = {}; iceEffects.clear(); field.ice.paint(.5, .49, 1, false, true); notice('冰霜慢慢融化，水又流动起来');
  });
  document.getElementById('light').addEventListener('click', function () {
    light = (light + 1) % 3; var name = ['晨光','暮色','月夜'][light];
    document.getElementById('light-label').textContent = name; this.setAttribute('aria-label', '切换光照，当前' + name);
    this.querySelector('.sun-icon').textContent = ['☼','☷','☾'][light];
    notice(sceneKind === 'water' ? ['晨光落在水底','把一池水染成暮色','月光与萤火，陪你片刻'][light] : sceneKind === 'snow' ? ['晨光照亮新雪','雪原染上晚霞','月光静静落在雪上'][light] : ['晨光穿过云隙','把云海染成暮色','在月光下，慢慢拨云'][light]);
  });
  document.getElementById('rain').addEventListener('click', function () {
    if (sceneKind !== 'water') { weather[sceneKind] = !weather[sceneKind]; syncNatureControls(); notice(sceneKind === 'snow' ? (weather.snow ? '雪慢慢落下，也慢慢覆盖足迹' : '雪停了，留下这一刻的足迹') : (weather.cloud ? '微风起，云海缓缓向远处流动' : '风轻下来，云继续慢慢漂浮')); return; }
    rain = !rain; this.setAttribute('aria-pressed', String(rain)); this.setAttribute('aria-label', rain ? '收起细雨' : '开启细雨');
    notice(rain ? '听，一场小雨落进了水里' : '雨停了，水波还在');
  });
  document.getElementById('sound').addEventListener('click', function () {
    if (muted && !initAudio()) return;
    muted = !muted; this.setAttribute('aria-pressed', String(!muted)); this.setAttribute('aria-label', muted ? '开启水声' : '关闭水声');
    if (muted) stopAudio(); else { audioLast = -10; sound(.45, false); }
    syncNatureControls();
  });
  document.getElementById('reset').addEventListener('click', function () {
    if (sceneKind !== 'water') { fingers = {}; weather[sceneKind] = false; if (sceneKind === 'snow') snow.clear(); else clouds.clear(); syncNatureControls(); notice(sceneKind === 'snow' ? '一场新雪，等你留下足迹' : '云海重新铺开'); return; }
    field.clear(); field.ice.clear(); iceEffects.clear(); drops.length = 0; rings.length = 0; leaves.length = 0; fingers = {}; rain = false; rainTimer = 0;
    stoneDrops.clear();refreshStoneBed();stoneBedDirty=false;
    document.getElementById('rain').setAttribute('aria-pressed', 'false'); document.getElementById('rain').setAttribute('aria-label', '开启细雨');
    addLeaf(.22, .48); addLeaf(.76, .56); addLeaf(.70, .29); notice('一切，归于平静');
  });
  function waterPath(context) {
    context.beginPath();
    for (var i = 0; i <= 120; i++) {
      var angle = i / 120 * Math.PI * 2, radius = 1 + .048 * Math.sin(angle * 5 + .7) + .024 * Math.sin(angle * 9 - .5) + .04 * Math.cos(angle * 3);
      var x = (.5 + Math.cos(angle) * .465 * radius) * width, y = (.49 + Math.sin(angle) * .35 * radius) * height;
      if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.closePath();
  }
  function drawFallback() {
    fctx.drawImage(scene, 0, 0, width, height); fctx.save(); waterPath(fctx); fctx.clip();
    var tint = fctx.createRadialGradient(width*.5,height*.49,Math.min(width,height)*.07,width*.5,height*.49,Math.max(width*.465,height*.35));
    tint.addColorStop(0,'#299aad'); tint.addColorStop(.65,'#45b8bb'); tint.addColorStop(.94,'#85d9c4'); tint.addColorStop(1,'#ceeee0');
    fctx.fillStyle = tint; fctx.fillRect(0,0,width,height);
    for (var foam = 0; foam < 3; foam++) {
      var foamTime = reduced ? 0 : now, progress = (foamTime*.18+foam/3)%1, opacity = Math.sin(progress*Math.PI);
      fctx.beginPath();
      for (var n = 0; n <= 180; n++) {
        var a = n/180*Math.PI*2, r = 1+.048*Math.sin(a*5+.7)+.024*Math.sin(a*9-.5)+.04*Math.cos(a*3);
        r -= .008 + (1-progress)*.20 + .012*Math.sin(a*11+foamTime*.6);
        var foamU = .5+Math.cos(a)*.465*r, foamV = .49+Math.sin(a)*.35*r;
        var foamWave = field.sample(foamU,foamV)*(1-field.ice.sample(foamU,foamV));
        r += core.clamp(foamWave*.14,-.065,.065);
        var x = (.5+Math.cos(a)*.465*r)*width, y = (.49+Math.sin(a)*.35*r)*height;
        if (!n || (Math.sin(a*8-foam+foamTime*.5) < -.1)) fctx.moveTo(x,y); else fctx.lineTo(x,y);
      }
      fctx.strokeStyle = 'rgba(231,255,246,'+(opacity*.7)+')'; fctx.lineWidth = 1.2+opacity*1.8; fctx.stroke();
    }
    fctx.restore();
    if (light !== 0) { fctx.fillStyle = light === 1 ? 'rgba(129,56,18,.24)' : 'rgba(3,18,49,.52)'; fctx.fillRect(0, 0, width, height); }
    var stoneGeometry=stoneDrops.geometry(false);
    for(var at=0;at<stoneGeometry.length;at+=33){
      var ny=stoneGeometry[at+6],nz=stoneGeometry[at+7];if(ny*.866-nz*.5<0)continue;
      var shade=.60+Math.max(0,-stoneGeometry[at+5]*.4+ny*.8-nz*.3)*.5;
      var wet=stoneGeometry[at+1]+stoneGeometry[at+12]+stoneGeometry[at+23]<0;
      fctx.fillStyle=wet?'rgba(85,152,144,.85)':'rgb('+Math.round(stoneGeometry[at+8]*shade*255)+','+Math.round(stoneGeometry[at+9]*shade*255)+','+Math.round(stoneGeometry[at+10]*shade*255)+')';
      fctx.beginPath();for(var j=0;j<3;j++){var k=at+j*11,x=(stoneGeometry[k]/(2*field.aspect)+.5)*width,y=(.5+stoneGeometry[k+2]*.4330127-stoneGeometry[k+1]*.25)*height;if(!j)fctx.moveTo(x,y);else fctx.lineTo(x,y);}fctx.closePath();fctx.fill();
    }
  }
  function drawLife(dt) {
    ctx.clearRect(0, 0, width, height);
    ctx.save(); waterPath(ctx); ctx.clip();
    for (var i = rings.length - 1; i >= 0; i--) {
      var ring = rings[i], age = now - ring.born;
      if (age > 2.5) { rings.splice(i, 1); continue; }
      var radius = age * Math.min(width, height) * .19;
      // Broken, irregular crests catch the light above the refracting wave field.
      ctx.strokeStyle = 'rgba(239,247,218,' + Math.max(0, (1 - age / 2.5) * Math.sqrt(ring.strength) * (fallbackMode ? .7 : .48)) + ')';
      ctx.lineWidth = Math.max(.65, 1.4 - age * .25);
      var segments = quality === 'normal' ? 72 : 36;
      for (var k = 0; k < 2; k++) {
        var rr = radius - k * 7; if (rr < 1) continue;
        var pen = false; ctx.beginPath();
        for (var segment = 0; segment <= segments; segment++) {
          var angle = segment / segments * Math.PI * 2;
          var ripple = rr + Math.sin(angle * 5 + age * 2) * 1.1 + Math.sin(angle * 11 - age) * .5;
          var rx = ring.u * width + Math.cos(angle) * ripple, ry = ring.v * height + Math.sin(angle) * ripple * .84;
          var lit = Math.sin(angle * 7 + ring.u * 29 + age) + Math.cos(angle * 3 - age * .5) * .5 > -.3 && field.ice.sample(rx / width, ry / height) < .35;
          if (lit && pen) ctx.lineTo(rx, ry); else ctx.moveTo(rx, ry);
          pen = lit;
        }
        ctx.stroke();
      }
    }
    if (fallbackMode) iceEffects.drawFallback(ctx, field.ice, width, height, light);
    for (i = 0; i < leaves.length; i++) {
      var leaf = leaves[i], gx = field.sample(leaf.u + .005, leaf.v) - field.sample(leaf.u - .005, leaf.v), gy = field.sample(leaf.u, leaf.v + .005) - field.sample(leaf.u, leaf.v - .005);
      leaf.vx = core.clamp(leaf.vx * Math.pow(.72, dt) - gx * dt * .045, -.09, .09); leaf.vy = core.clamp(leaf.vy * Math.pow(.72, dt) - gy * dt * .045, -.09, .09);
      var u = leaf.u + (leaf.vx + (reduced ? 0 : .0012 * Math.sin(now * .3 + i))) * dt, v = leaf.v + (leaf.vy + (reduced ? 0 : .0007)) * dt;
      var trapped = field.ice.sample(leaf.u, leaf.v) > .45;
      if (trapped) { leaf.vx = 0; leaf.vy = 0; }
      else if (core.shore(u, v) < -.075 && field.ice.sample(u, v) < .45) { leaf.u = u; leaf.v = v; } else { leaf.vx *= -.45; leaf.vy *= -.45; }
      if (!trapped) leaf.angle += (leaf.turn + gx * 3) * dt * .15;
      var x = leaf.u * width, y = leaf.v * height, s = leaf.size, bob = reduced ? 0 : Math.sin(now * 1.8 + i) * .6;
      ctx.save(); ctx.globalAlpha = trapped ? .48 : 1; ctx.translate(x, y + (trapped ? 0 : bob)); ctx.rotate(leaf.angle);
      ctx.shadowColor = 'rgba(7,54,40,.5)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 3;
      ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(-s * .6, -s * .7, s, 0); ctx.quadraticCurveTo(-s * .2, s * .65, -s, 0);
      ctx.fillStyle = leaf.hue > .3 ? '#adb871' : '#d0b876'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#607650'; ctx.lineWidth = .65; ctx.beginPath(); ctx.moveTo(-s * .9, 0); ctx.lineTo(s * .8, 0); ctx.moveTo(0, 0); ctx.lineTo(-s * .35, -s * .35); ctx.moveTo(s * .25, 0); ctx.lineTo(-s * .05, s * .29); ctx.stroke(); ctx.restore();
    }
    iceEffects.draw(ctx, field.ice, width, height, now, reduced, light);
    ctx.restore();
    for (i = drops.length - 1; i >= 0; i--) {
      var drop = drops[i], elapsed = now - drop.born;
      if (elapsed > drop.life) { drops.splice(i, 1); continue; }
      drop.x += drop.vx * dt; drop.y += drop.vy * dt; drop.z += drop.vz * dt; drop.vz -= 250 * dt;
      var alpha = Math.max(0, 1 - elapsed / drop.life);
      ctx.fillStyle = 'rgba(230,252,217,' + alpha * .85 + ')'; ctx.beginPath(); ctx.ellipse(drop.u * width + drop.x, drop.v * height + drop.y - Math.max(0, drop.z), drop.size, drop.size * 1.45, -.25, 0, 6.28); ctx.fill();
    }
    if (!reduced && quality === 'normal') for (i = 0; i < dust.length; i++) {
      var mote = dust[i], mx = mote.u * width + Math.sin(now * .2 + mote.phase) * 18, my = (mote.v * height + now * 3) % height, opacity = (.5 + .5 * Math.sin(now * .8 + mote.phase)) * (light === 2 ? .8 : .25);
      ctx.fillStyle = 'rgba(222,233,160,' + opacity + ')';
      if (light === 2) { ctx.shadowColor = '#c9e684'; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.arc(mx, my, mote.size, 0, 6.28); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
  function tick(time) {
    frameId = 0;
    if (document.hidden) return;
    if (!lastFrame) lastFrame = time;
    var frameDt = Math.min(.08, Math.max(0, (time - lastFrame) / 1000));
    lastFrame = time; now += frameDt; accumulator += frameDt;
    if (resized) resize();
    if (time - lastRender >= (quality === 'normal' ? 32 : 40)) {
      var dt = Math.min(.08, (time - lastRender) / 1000 || .033); lastRender = time;
      if (sceneKind !== 'water') { accumulator = 0; updateNature(dt); }
      else {
      stoneDrops.update(dt,stoneEvent);
      if(stoneBedDirty){refreshStoneBed();stoneBedDirty=false;}
      for (var key in fingers) {
        var finger = fingers[key];
        if (mode === 'touch' && !finger.iceAction && field.ice.sample(finger.u, finger.v) < .45 && finger.travel < 15 && now - finger.born > .55) {
          finger.charged = true;
          field.disturb(finger.u, finger.v, -.018, .035);
          if (now - finger.last > .28) { rings.push({u: finger.u, v: finger.v, born: now, strength: .16}); if (rings.length > 48) rings.shift(); finger.last = now; }
        }
      }
      if (rain) {
        rainTimer += dt;
        if (rainTimer > (quality === 'normal' ? .09 : .17)) {
          rainTimer = 0; var ru = .1 + Math.random() * .8, rv = .2 + Math.random() * .58;
          if (splash(ru, rv, .09)) sound(.08, false);
        }
      }
      var steps = 0;
      field.ice.update(dt);
      iceEffects.update(field.ice, now, reduced, quality !== 'normal', function (u, v) { splash(u, v, .55); });
      while (accumulator >= 1 / 60 && steps < 5) { field.step(); accumulator -= 1 / 60; steps++; }
      if (steps === 5) accumulator = 0;
      if (renderer) renderer.draw(reduced ? 0 : now, light); else drawFallback();
      drawLife(dt);
      }
    }
    // Measure delivered RAF timing; downgrade only after sustained slow windows.
    if (frameDt > 0) { frameTotal += frameDt; frameSamples++; }
    if (frameSamples >= 90) {
      if (frameTotal / frameSamples > .045) slowFrames++; else slowFrames = 0;
      frameSamples = 0; frameTotal = 0;
      if (slowFrames >= 2 && quality === 'normal') { quality = 'low'; if (renderer) { renderer.low = true; renderer.resize(width, height); } natureRenderer.resize(width, height, true); drops.length = 0; slowFrames = 0; }
      else if (slowFrames >= 2 && quality === 'low') { natureRenderer.fallback(); fallbackOn('已换成轻量画面，让指尖更自在'); slowFrames = 0; }
    }
    frameId = requestAnimationFrame(tick);
  }
  canvas.addEventListener('webglcontextlost', function (event) {
    event.preventDefault(); lostCount++; fallbackOn('水面已切换为轻量模式'); fingers = {};
  });
  canvas.addEventListener('webglcontextrestored', function () {
    if (lostCount > 1) return;
    fallbackMode = false; quality = 'low'; syncSurfaces(); resized = true;
  });
  window.addEventListener('resize', function () { resized = true; });
  window.addEventListener('blur', function () { fingers = {}; cursor.style.display = 'none'; });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; fingers = {}; clearTimeout(noticeTimer); document.getElementById('notice').classList.remove('show'); stopAudio(); }
    else { lastFrame = 0; lastRender = 0; accumulator = 0; if (!muted && audio) audio.resume().catch(function () {}); if (!frameId) frameId = requestAnimationFrame(tick); }
  });
  // Read-only diagnostics keep browser verification independent from the rendering implementation.
  window.WaterGarden = { inspect: function () { return { ready: !!field, iceCoverage: field ? field.ice.coverage() : 0, iceCenter: field ? field.ice.sample(.48, .48) : 0, iceShards: iceEffects.shards.length, iceFractures: iceEffects.fractures.length, stones: stoneDrops.items.map(function(s){return {u:s.u,v:s.v,y:s.y,radius:s.radius,top:s.top,entered:s.entered,settled:s.settled,speed:s.body.velocity.length(),rotation:[s.body.quaternion.x,s.body.quaternion.y,s.body.quaternion.z,s.body.quaternion.w]};}), stoneImpacts: stoneDrops.impacts, stoneDepth: field && stoneDrops.items.length ? field.bathymetry.heightAt(stoneDrops.items[0].u,stoneDrops.items[0].v) : null, mode: mode, light: light, rain: rain, muted: muted, leaves: leaves.length, leafPositions: leaves.map(function (leaf) { return { u: leaf.u, v: leaf.v }; }), drops: drops.length, rings: rings.length, energy: field ? field.energy() : 0, steps: field ? field.steps : 0, quality: quality, renderer: renderer ? 'webgl' : 'canvas2d', surfaceVertices: renderer && renderer.mesh ? renderer.mesh.count : 0, surfaceTriangles: renderer && renderer.mesh ? renderer.mesh.indices.length / 3 : 0, waterMaps: renderer ? renderer.mapsLoaded : 0, width: width, height: height, bufferWidth: renderer ? canvas.width : fallback.width, bufferHeight: renderer ? canvas.height : fallback.height, activePointers: Object.keys(fingers).length }; } };
  window.NatureGarden = { inspect: function () { return { scene: sceneKind, renderLight: natureRenderer.light, renderer: natureRenderer.surface ? 'webgl' : 'canvas2d', triangles: natureRenderer.surface ? natureRenderer.surface.count / 3 : 0, cloudCarve: clouds.field.inspect().depth, mode: natureModes[sceneKind], weather: sceneKind === 'water' ? rain : weather[sceneKind], snow: snow.inspect(), cloud: clouds.inspect(), activePointers: Object.keys(fingers).length, bufferWidth: natureCanvas.width, bufferHeight: natureCanvas.height }; } };
  resize();
  requestAnimationFrame(function () { garden.classList.add('ready'); frameId = requestAnimationFrame(tick); });
}());
