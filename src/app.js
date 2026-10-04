(function () {
  'use strict';
  var core = window.WaterCore, garden = document.getElementById('garden'), canvas = document.getElementById('water');
  var fallback = document.getElementById('fallback'), overlay = document.getElementById('life'), ctx = overlay.getContext('2d');
  var fctx = fallback.getContext('2d'), hint = document.getElementById('hint'), cursor = document.getElementById('cursor');
  var renderer = null, scene, field, width = 1, height = 1, mode = 'touch', light = 0, rain = false;
  var leaves = [], drops = [], rings = [], dust = [], fingers = {}, reduced = false;
  var weather = new window.WaterWeather.System(), weatherAudio = null, strokeAudio = null, tapAudio = null, stoneAudio = null, rippleAudio = null;
  var rainOptions = document.getElementById('rain-options'), rainButtons = document.querySelectorAll('[data-rain]');
  var fishSchool = new window.WaterFish.System();
  var stoneDrops = new window.WaterStones.System(), fallbackTerrain = null, fallbackBed = null, stoneBedDirty = false;
  var now = 0, lastFrame = 0, lastRender = 0, accumulator = 0, frameId = 0, lostCount = 0, fallbackMode = false;
  var slowFrames = 0, frameSamples = 0, frameTotal = 0, quality = 'normal', resized = false;
  var audio = null, master = null, audioLast = 0, audioNodes = [], noticeTimer = 0;
  var hints = { touch: '轻点泛起涟漪 · 滑动拨开水面 · 长按蓄起水波', leaf: '轻点放下一片浮叶 · 滑动水面，推着叶子走', stone: '轻点选择落点 · 随机石头从高处落下 · 平静可清除' };
  var sceneKind = 'water', natureCanvas = document.getElementById('nature');
  var snow = new window.GardenNature.Snow(), clouds = new window.GardenNature.Clouds();
  var natureRenderer = new window.NatureRenderer(natureCanvas, snow, clouds);
  var natureModes = { snow: 0, cloud: 0 }, natureWeather = { snow: true, cloud: true };
  var natureIcons = {
    snow: ['M3 17c3-8 5 7 9-2s5 3 9-8M4 21c3-5 5 3 8-2', 'M7 3c-4 0-4 10-1 10s4-10 1-10ZM16 8c-4 0-4 10-1 10s4-10 1-10ZM4 16v3h3v-3Zm9 5h3', 'M20 12a8 8 0 1 1-16 0 8 8 0 1 1 16 0ZM7 11c0-3 2-4 4-4M4 21h12'],
    cloud: ['M8 16H6a4 4 0 1 1 1-8 5 5 0 0 1 9-1 4 4 0 0 1 2 9h-2M9 12l-3 3 3 3m6-6 3 3-3 3', 'M6 17a4 4 0 1 1 1-8 5 5 0 0 1 9-1 4 4 0 0 1 2 9M3 21h6l-2-2m14 2h-6l2-2', 'M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 17h5a3 3 0 1 1-3 3']
  };
  var natureHints = {
    snow: ['滑动划出雪痕 · 长按压实积雪', '轻点踩下脚印 · 拖动走出一串足迹'],
    cloud: ['轻点推开云海 · 滑动划出云间小径', '按住聚拢云团 · 缓缓拖动，带着云走']
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
      weatherAudio = new window.WaterWeather.Audio(audio, master);
      strokeAudio = new window.WaterSound.Stroke(audio, master, window.WaterSwipeAsset);
      tapAudio = new window.WaterSound.Tap(audio, master, window.WaterTapAsset);
      stoneAudio = new window.WaterSound.OneShot(audio, master, window.StoneImpactAsset);
      rippleAudio = new window.WaterSound.Ripple(audio, master, window.WaterRipplesAsset);
      weatherAudio.setLevel(sceneKind === 'water' ? weather.level : 0);
      if (audio.state === 'suspended') audio.resume().catch(function () {});
      return true;
    } catch (error) { notice('这里暂时无法播放声音，仍可继续体验'); return false; }
  }
  function unlockAudio() { if (!document.hidden && (!audio || audio.state !== 'running')) initAudio(); }
  // Initialize within the first user gesture, including toolbar and keyboard use.
  document.addEventListener(window.PointerEvent ? 'pointerdown' : 'mousedown', unlockAudio, true);
  if (!window.PointerEvent) document.addEventListener('touchstart', unlockAudio, { capture: true, passive: true });
  document.addEventListener('keydown', function(event) { if (event.key === ' ' || event.key === 'Enter') unlockAudio(); }, true);
  function sound(strength, deep) {
    if (!audio || audio.state !== 'running' || now - audioLast < .09 || audioNodes.length >= 8) return;
    audioLast = now;
    var length = Math.floor(audio.sampleRate * .22), buffer = audio.createBuffer(1, length, audio.sampleRate), values = buffer.getChannelData(0);
    for (var i = 0; i < length; i++) values[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    var noise = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain(), t = audio.currentTime;
    noise.buffer = buffer; filter.type = 'lowpass'; filter.frequency.setValueAtTime(deep ? 1200 : 2600, t); filter.frequency.exponentialRampToValueAtTime(180, t + .22);
    gain.gain.setValueAtTime(Math.min(.25, .05 + strength * .15), t); gain.gain.exponentialRampToValueAtTime(.001, t + .22);
    if (sceneKind !== 'water') { filter.type = 'lowpass'; filter.frequency.setValueAtTime(sceneKind === 'snow' ? 2400 : 650, t); filter.frequency.exponentialRampToValueAtTime(sceneKind === 'snow' ? 700 : 180, t + .22); }
    noise.connect(filter); filter.connect(gain); gain.connect(master); noise.start(t); noise.stop(t + .23);
    var osc = audio.createOscillator(), tone = audio.createGain(); osc.type = 'sine';
    osc.frequency.setValueAtTime(deep ? 310 : 650 + Math.random() * 180, t); osc.frequency.exponentialRampToValueAtTime(100, t + .16);
    tone.gain.setValueAtTime(.03 + Math.min(strength, 1) * .08, t); tone.gain.exponentialRampToValueAtTime(.001, t + .18);
    if (sceneKind !== 'water') tone.gain.setValueAtTime(.001, t);
    osc.connect(tone); tone.connect(master); osc.start(t); osc.stop(t + .2);
    var node = { noise: noise, filter: filter, gain: gain, osc: osc, tone: tone }; audioNodes.push(node);
    noise.onended = function () { noise.disconnect(); filter.disconnect(); gain.disconnect(); osc.disconnect(); tone.disconnect(); var index = audioNodes.indexOf(node); if (index !== -1) audioNodes.splice(index, 1); };
  }
  function stopAudio(immediate) {
    weather.cancelThunder();
    if (weatherAudio) weatherAudio.stop(immediate);
    if (strokeAudio) strokeAudio.stop(immediate);
    if (tapAudio) tapAudio.stop();
    if (stoneAudio) stoneAudio.stop();
    if (rippleAudio) rippleAudio.stop(immediate);
    for (var i = 0; i < audioNodes.length; i++) { try { audioNodes[i].noise.stop(); audioNodes[i].osc.stop(); } catch (error) {} }
    if (immediate && audio && audio.state === 'running') audio.suspend().catch(function () {});
  }
  function fallbackOn(message) {
    if (renderer) renderer.destroy(); renderer = null; fallbackMode = true; quality = 'unavailable';
    canvas.style.display = 'none'; fallback.style.display = 'none';
    document.getElementById('render-status').textContent=message || '3D 场景初始化失败，请刷新重试。';
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
    field = new core.WaveField(nx, ny, aspect); scene = window.WaterScene.create(aspect, fallbackMode);
    fishSchool.attach(aspect);
    if (!fallbackMode) {
      try { renderer = new window.WaterRenderer(canvas, scene, field); renderer.dropSystem = stoneDrops; renderer.fishSystem = fishSchool; renderer.low = quality === 'low'; renderer.resize(width, height); }
      catch (error) { fallbackOn('3D 水面初始化失败，请刷新重试。'); }
    }
    if(!field.bathymetry)prepareFallbackStones();
    fingers = {}; leaves.length = 0; drops.length = 0; rings.length = 0;
    if (strokeAudio) strokeAudio.stop();
    if (rippleAudio) rippleAudio.stop();
    // Three small existing leaves make the pool feel alive before the first touch.
    addLeaf(.22, .48); addLeaf(.76, .56); addLeaf(.70, .29);
    dust.length = 0;
    var random = core.seededRandom(93412);
    for (var i = 0; i < 24; i++) dust.push({ u: random(), v: random(), phase: random() * 6.28, size: .5 + random() * 1.2 });
    accumulator = 0; lastFrame = 0; lastRender = 0; slowFrames = 0; frameSamples = 0; frameTotal = 0; resized = false;
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
    field.stoneImpact(stone.u,stone.v,stone.radius);
    fishSchool.scare(stone.u,stone.v,1.5);
    if (!stoneAudio || !stoneAudio.play(.9)) sound(.9,true);
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
    if (core.shore(u, v) >= -.015) return false;
    if (!field.disturb(u, v, strength, .015 + strength * .013)) return false;
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
      splash(p.u,p.v,.15,true,true); f.rippleDistance %= 10; f.last = now;
    }
  }
  function begin(id, x, y) {
    var p = point(x, y);
    if(sceneKind==='water'&&!renderer)return;
    if (sceneKind !== 'water') { if(!natureRenderer.available())return; p=natureRenderer.surface.point(p.u,p.v,sceneKind,clouds,true); if(p)beginNature(id, p); return; }
    if(mode!=='stone'&&stoneDrops.blocks(p.u,p.v))return;
    if (mode!=='stone' && renderer && renderer.terrain.blocks(p.u, p.v)) return;
    if (core.shore(p.u, p.v) >= -.025) { notice('轻触池中的青绿水面'); return; }
    garden.classList.add('touched');
    initAudio();
    if(mode==='stone'){
      if(!stoneDrops.add(p.u,p.v))notice('轻点池中的位置落石');
      else {stoneBedDirty=true;fishSchool.scare(p.u,p.v,.9);}
      return;
    }
    fingers[id] = { u: p.u, v: p.v, startU: p.u, startV: p.v, born: now, last: now, movedAt: now, rippleDistance: 0, travel: 0, charged: false };
    fishSchool.scare(p.u,p.v,.65);
    if (mode === 'leaf') { addLeaf(p.u, p.v); splash(p.u, p.v, .10, true, true); }
    else { splash(p.u, p.v, .32, true, true); }
  }
  function move(id, x, y) {
    var f = fingers[id]; if (!f) return;
    var p = point(x, y), dx = (p.u - f.u) * width, dy = (p.v - f.v) * height, distance = Math.sqrt(dx * dx + dy * dy);
    if (sceneKind !== 'water') { if(!natureRenderer.available())return; p=natureRenderer.surface.point(p.u,p.v,sceneKind,clouds,false); if(!p)return; distance=Math.hypot((p.u-f.u)*width,(p.v-f.v)*height); moveNature(f, p, distance); return; }
    f.travel += distance;
    if (stoneDrops.blocks(p.u,p.v) || (renderer && renderer.terrain.blocks(p.u, p.v))) { f.u=p.u;f.v=p.v;return; }
    if (core.shore(p.u, p.v) < -.02) {
      fishSchool.scare(p.u,p.v,Math.min(1,.35+distance/65),f.u,f.v);
      field.stroke(f.u, f.v, p.u, p.v, Math.min(.17, .035 + distance * .002));
      if (strokeAudio && distance > .5) strokeAudio.stroke(distance / Math.min(width, height) / Math.max(.016, now - f.movedAt));
      pushLeaves(p.u, p.v, dx / width, dy / height);
      swipeRipple(f, p, distance);
    } else { f.rippleDistance = 0; }
    f.u = p.u; f.v = p.v; f.movedAt = now;
  }
  function end(id, cancelled) {
    var f = fingers[id]; if (!f) return;
    if (sceneKind !== 'water') { delete fingers[id]; return; }
    if (!cancelled && mode === 'touch' && f.charged) { splash(f.u, f.v, Math.min(1.1, .45 + (now - f.born) * .18), true); sound(1, true); }
    else if (!cancelled && f.travel < 15) {
      // Wait until release to distinguish a tap from a swipe; swipes have no drawn rings.
      addRing(f.u, f.v, mode === 'leaf' ? .10 : .32);
      if (!tapAudio || !tapAudio.play(mode === 'leaf' ? .2 : .6)) sound(.32, false);
    }
    delete fingers[id];
    if (strokeAudio && !Object.keys(fingers).length) strokeAudio.release();
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
    document.getElementById('render-status').hidden = water ? !fallbackMode : natureRenderer.available();
    document.getElementById('view-3d').hidden = water;
    canvas.style.display = water && !fallbackMode ? 'block' : 'none';
    fallback.style.display = 'none'; overlay.style.display = water && !fallbackMode ? 'block' : 'none';
    natureCanvas.style.display = water ? 'none' : 'block';
    canvas.setAttribute('aria-hidden', String(!water || fallbackMode)); canvas.tabIndex = water && !fallbackMode ? 0 : -1;
    fallback.setAttribute('aria-hidden', 'true'); fallback.tabIndex = -1;
    natureCanvas.setAttribute('aria-hidden', String(water)); natureCanvas.tabIndex = water ? -1 : 0;
  }
  function syncNatureControls() {
    var water = sceneKind === 'water', names = sceneKind === 'snow' ? ['划雪','脚印','雪球'] : ['拨云','聚云'];
    document.querySelector('.modes').hidden = !water;
    document.getElementById('nature-modes').hidden = water;
    var controls = document.querySelectorAll('[data-nature]');
    for (var i = 0; i < controls.length; i++) {
      controls[i].hidden = !water && i >= names.length;
      if (controls[i].hidden) continue;
      controls[i].querySelector('span').textContent = names[i] || '';
      if (!water) { controls[i].querySelector('svg').innerHTML = '<path d="' + natureIcons[sceneKind][i] + '"/>'; }
      var active=sceneKind==='snow'&&i===2?snow.balls.length>0:i===natureModes[sceneKind];
      controls[i].classList.toggle('selected',active); controls[i].setAttribute('aria-pressed',String(active));
    }
    hint.textContent = water ? hints[mode] : natureHints[sceneKind][natureModes[sceneKind]];
    if(sceneKind==='snow'&&snow.balls.length)hint.textContent='拖动雪球，越滚越大 · 再点「雪球」收起';
    natureCanvas.setAttribute('aria-label', (sceneKind === 'snow' ? '交互雪地，' : '交互云层，') + hint.textContent + '；空格或回车触碰中央');
    var weatherName = water ? (rain?window.WaterWeather.profiles[weather.level].name:'下雨') : sceneKind === 'snow' ? '飘雪' : '微风', enabled = water ? rain : natureWeather[sceneKind];
    var rainButton = document.getElementById('rain'); rainButton.hidden = !water; rainButton.querySelector('span').textContent = weatherName;
    rainButton.querySelector('svg').innerHTML = '<path d="' + (water ? 'M6 14a4 4 0 0 1-1-8 6 6 0 0 1 11-1 4 4 0 0 1 2 9M7 16l-1 4m6-4-1 4m6-4-1 4' : sceneKind === 'snow' ? 'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M17 19l-1-4 4-1' : natureIcons.cloud[2]) + '"/>';
    rainButton.setAttribute('aria-label', (enabled ? '关闭' : '开启') + weatherName); rainButton.setAttribute('aria-pressed', String(enabled)); if(water)rainButton.setAttribute('aria-label',rain?'选择雨势，当前'+weatherName:'开启小雨并选择雨势');
    document.getElementById('reset').querySelector('span').textContent = water ? '平静' : sceneKind === 'snow' ? '新雪' : '云海';
    document.getElementById('reset').setAttribute('aria-label', water ? '让水池归于平静' : sceneKind === 'snow' ? '铺一场新雪，清除足迹和雪球' : '重置云海');
    document.querySelector('.toolbar').setAttribute('aria-label', water ? '水面玩法' : sceneKind === 'snow' ? '雪地玩法' : '云层玩法');
  }
  function setScene(kind) {
    if (kind === sceneKind) return;
    fingers = {}; cursor.style.display = 'none'; accumulator = 0; slowFrames = 0; frameSamples = 0; frameTotal = 0; stopAudio(); sceneKind = kind;
    garden.setAttribute('data-scene', kind); garden.classList.remove('touched');
    var titles = { water: '水之庭', snow: '雪之野', cloud: '云之境' };
    document.getElementById('scene-title').textContent = titles[kind]; document.title = '海拉鲁 · ' + titles[kind];
    garden.setAttribute('aria-label', document.title);
    document.getElementById('scene-subtitle').textContent = { water: 'HYRULE WATER GARDEN', snow: 'HYRULE SNOW FIELD', cloud: 'HYRULE CLOUD SANCTUARY' }[kind];
    document.querySelector('.pool-caption').textContent = { water: '✧ 一池水，一点宁静 ✧', snow: '✧ 把足迹，留在新雪里 ✧', cloud: '✧ 拨开云，遇见一线天光 ✧' }[kind];
    document.querySelector('.footnote').textContent = { water: '风吹过的地方，水会记得。', snow: '每一步，都有柔软的回声。', cloud: '让心事，随云慢慢走。' }[kind];
    var selectors = document.querySelectorAll('[data-scene]');
    for (var i = 0; i < selectors.length; i++) if (selectors[i].tagName === 'BUTTON') { var selected = selectors[i].getAttribute('data-scene') === kind; selectors[i].classList.toggle('selected', selected); selectors[i].setAttribute('aria-pressed', String(selected)); }
    showRainOptions(false); if(weatherAudio){weatherAudio.stop();if(kind==='water')weatherAudio.setLevel(weather.level);}
    syncSurfaces(); syncNatureControls();
    if (kind !== 'water') natureRenderer.draw(kind, light, now, natureWeather[kind], reduced);
    initAudio();
  }
  var sceneButtons = document.querySelectorAll('button[data-scene]');
  for (var si = 0; si < sceneButtons.length; si++) sceneButtons[si].addEventListener('click', function () { setScene(this.getAttribute('data-scene')); });
  var natureButtons = document.querySelectorAll('[data-nature]');
  for (var ni = 0; ni < natureButtons.length; ni++) natureButtons[ni].addEventListener('click', function () {
    fingers = {}; var selected=Number(this.getAttribute('data-nature'));
    if(sceneKind==='snow'&&selected===2){
      if(snow.balls.length)snow.balls.length=0;
      else if(natureRenderer.available()){
        var p=natureRenderer.surface.point(.5,.48,'snow',clouds,false);
        if(p)snow.ball(p.u,p.v,natureRadius()*.042);
      }
    }else natureModes[sceneKind]=selected;
    syncNatureControls();
  });
  document.getElementById('view-3d').addEventListener('click',function(){
    if(!natureRenderer.available())return;
    var surface=natureRenderer.surface;surface.oblique=!surface.oblique;surface.resize(surface.canvas.width,surface.canvas.height,surface.low);fingers={};this.setAttribute('aria-pressed',String(surface.oblique));
  });
  function natureRadius() { return Math.min(width, height) / height; }
  function beginNature(id, p) {
    if (!isFinite(p.u+p.v)) return;
    garden.classList.add('touched'); initAudio();
    var f = { u: p.u, v: p.v, born: now, last: now, movedAt: now, travel: 0, spacing: 0, angle: 0 }, selected = natureModes[sceneKind];
    f.offsetU=p.ball?p.u-p.groundU:0; f.offsetV=p.ball?p.v-p.groundV:0;
    fingers[id] = f;
    if (sceneKind === 'snow') {
      var r = natureRadius();
      if(p.ball)f.ball=p.ball;
      else if (selected === 0) snow.stamp(p.u, p.v, r * .04, .65);
      else if (selected === 1) snow.footprint(p.u, p.v, 0, r * .07);
    } else clouds.touch(p.u, p.v, ['part','gather'][selected], 0, 0, selected===0 ? .04 : .22);
    sound(.22, false);
  }
  function moveNature(f, p, distance) {
    p.u += f.offsetU; p.v += f.offsetV;
    var selected = natureModes[sceneKind], r = natureRadius();
    if (sceneKind === 'snow') {
      if(f.ball)snow.roll(f.ball,p.u,p.v);
      else if (selected === 0) snow.stroke(f.u, f.v, p.u, p.v, r * .04, .65);
      else if (selected === 1 && distance > 0) {
        var dx = (p.u - f.u) * width, dy = (p.v - f.v) * height, step = Math.min(width, height) * .15;
        f.angle = Math.atan2(dy, dx) + Math.PI / 2;
        var actual = Math.hypot(dx, dy), next = step - f.spacing;
        for (; next <= actual; next += step) snow.footprint(f.u + (p.u - f.u) * next / actual, f.v + (p.v - f.v) * next / actual, f.angle, r * .07);
        f.spacing = (f.spacing + actual) % step;
      }
    } else {
      var count = Math.min(24, Math.max(1, Math.ceil(distance / 8)));
      var elapsed=Math.max(.008,Math.min(.1,now-f.movedAt)),speed=Math.hypot((p.u-f.u)*clouds.aspect,p.v-f.v)/elapsed;
      for (var i = 1; i <= count; i++) clouds.touch(f.u + (p.u - f.u) * i / count, f.v + (p.v - f.v) * i / count, ['part','gather'][selected], (p.u - f.u) / count, (p.v - f.v) / count, selected===0 ? .016 : .045,speed);
      f.movedAt=now;
    }
    if (distance > 2 && now - f.last > .16) { sound(.15, false); f.last = now; }
    f.travel += distance; f.u = p.u; f.v = p.v;
  }
  function updateNature(dt) {
    if(!natureRenderer.available()){fingers={};natureRenderer.draw(sceneKind,light,now,false,reduced);return;}
    for (var id in fingers) {
      var f = fingers[id], selected = natureModes[sceneKind];
      if (sceneKind === 'snow' && !f.ball && selected === 0 && f.travel < 15 && now - f.born > .3) snow.stamp(f.u, f.v, natureRadius() * .04, Math.min(1, .65 + (now - f.born) * .2));
      if (sceneKind === 'cloud' && selected < 2) clouds.touch(f.u, f.v, selected === 0 ? 'part' : 'gather', 0, 0, dt);
    }
    if (sceneKind === 'snow') snow.update(dt, natureWeather.snow);
    else clouds.update(dt, natureWeather.cloud, reduced);
    natureRenderer.draw(sceneKind, light, now, natureWeather[sceneKind], reduced);
  }
  var buttons = document.querySelectorAll('[data-mode]');
  for (var b = 0; b < buttons.length; b++) buttons[b].addEventListener('click', function () {
    if (strokeAudio) strokeAudio.release();
    fingers = {}; mode = this.getAttribute('data-mode'); hint.textContent = hints[mode];
    canvas.setAttribute('aria-label', mode === 'stone' ? '交互水池，轻点选择落点，石头从高空落下' : '交互水池，轻点起涟漪，滑动拨水');
    for (var i = 0; i < buttons.length; i++) { var selected = buttons[i] === this; buttons[i].classList.toggle('selected', selected); buttons[i].setAttribute('aria-pressed', String(selected)); }
  });
  document.getElementById('light').addEventListener('click', function () {
    light = (light + 1) % 3; var name = ['晨光','暮色','月夜'][light];
    document.getElementById('light-label').textContent = name; this.setAttribute('aria-label', '切换光照，当前' + name);
    this.querySelector('.sun-icon').textContent = ['☼','☷','☾'][light];
    notice(sceneKind === 'water' ? ['晨光落在水底','把一池水染成暮色','月光与萤火，陪你片刻'][light] : sceneKind === 'snow' ? ['晨光照亮新雪','雪原染上晚霞','月光静静落在雪上'][light] : ['晨光穿过云隙','把云海染成暮色','在月光下，慢慢拨云'][light]);
  });
  function showRainOptions(show) {
    rainOptions.hidden = !show; document.getElementById('rain').setAttribute('aria-expanded', String(show));
  }
  function setRainLevel(level) {
    weather.setLevel(level); rain = level > 0;
    var name = window.WaterWeather.profiles[level].name, button = document.getElementById('rain');
    button.setAttribute('aria-pressed', String(rain)); button.setAttribute('aria-label', rain ? '选择雨势，当前' + name : '开启小雨并选择雨势');
    document.getElementById('rain-label').textContent = rain ? name : '下雨';
    for (var i = 0; i < rainButtons.length; i++) rainButtons[i].setAttribute('aria-pressed', String(Number(rainButtons[i].getAttribute('data-rain')) === level));
    if (weatherAudio) {
      if (!document.hidden && sceneKind === 'water' && level) weatherAudio.setLevel(level);
      else weatherAudio.stop();
    }
    if (!rain) showRainOptions(false); else garden.classList.add('touched');
  }
  document.getElementById('rain').addEventListener('click', function () {
    if(sceneKind!=='water')return;
    if (!rain) { setRainLevel(1); showRainOptions(true); notice('小雨轻落，试试不同的雨势'); }
    else showRainOptions(rainOptions.hidden);
  });
  for (var r = 0; r < rainButtons.length; r++) rainButtons[r].addEventListener('click', function () {
    var level = Number(this.getAttribute('data-rain')); setRainLevel(level);
    notice(['雨停了，水波还在','小雨轻落，雨丝拂过水面','中雨连绵，偶有远雷','大雨倾落，雷电渐近','暴雨倾盆，电闪雷鸣'][level]);
    if (!level) document.getElementById('rain').focus();
  });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !rainOptions.hidden) { showRainOptions(false); document.getElementById('rain').focus(); } });
  document.getElementById('reset').addEventListener('click', function () {
    if (strokeAudio) strokeAudio.stop();
    if (rippleAudio) rippleAudio.stop();
    if (tapAudio) tapAudio.stop();
    if (stoneAudio) stoneAudio.stop();
    if (sceneKind !== 'water') { fingers = {}; natureWeather[sceneKind] = true; if (sceneKind === 'snow') snow.clear(); else clouds.clear(); syncNatureControls(); notice(sceneKind === 'snow' ? '一场新雪，等你留下足迹' : '云海重新铺开'); return; }
    field.clear(); drops.length = 0; rings.length = 0; leaves.length = 0; fingers = {};
    setRainLevel(0); weather.clear();
    stoneDrops.clear();refreshStoneBed();stoneBedDirty=false;
    fishSchool.calm();
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
  function drawLife(dt) {
    ctx.clearRect(0, 0, width, height);
    ctx.save(); waterPath(ctx); ctx.clip();
    // The light Canvas fallback uses the same rain lifetime and radius as the height field.
    if (fallbackMode) for (var rainIndex = 0; rainIndex < field.rainRipples.length; rainIndex++) {
      var rainRipple = field.rainRipples[rainIndex];
      if (rainRipple.age >= rainRipple.life) continue;
      var rainRadius = core.rainRadius(rainRipple.age, rainRipple.scale) * height;
      var rainX = rainRipple.u * width, rainY = rainRipple.v * height;
      var terrain = fallbackTerrain;
      if (stoneDrops.blocks(rainRipple.u, rainRipple.v) || (terrain && terrain.blocks(rainRipple.u, rainRipple.v))) continue;
      var rainPen = false; ctx.beginPath();
      for (var rainSegment = 0; rainSegment <= 24; rainSegment++) {
        var rainAngle = rainSegment / 24 * Math.PI * 2;
        var rainPX = rainX + Math.cos(rainAngle) * rainRadius, rainPY = rainY + Math.sin(rainAngle) * rainRadius;
        var rainU = rainPX / width, rainV = rainPY / height;
        var rainCell = Math.round(rainV * (field.height - 1)) * field.width + Math.round(rainU * (field.width - 1));
        var rainWet = field.mask[rainCell];
        if (rainWet && rainPen) ctx.lineTo(rainPX, rainPY); else ctx.moveTo(rainPX, rainPY);
        rainPen = rainWet;
      }
      ctx.strokeStyle = 'rgba(232,255,245,' + (.3 * Math.pow(1 - rainRipple.age / rainRipple.life, 2)) + ')';
      ctx.lineWidth = .7 * rainRipple.scale; ctx.stroke();
    }
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
          var lit = Math.sin(angle * 7 + ring.u * 29 + age) + Math.cos(angle * 3 - age * .5) * .5 > -.3;
          if (lit && pen) ctx.lineTo(rx, ry); else ctx.moveTo(rx, ry);
          pen = lit;
        }
        ctx.stroke();
      }
    }
    for (i = 0; i < leaves.length; i++) {
      var leaf = leaves[i], gx = field.sample(leaf.u + .005, leaf.v) - field.sample(leaf.u - .005, leaf.v), gy = field.sample(leaf.u, leaf.v + .005) - field.sample(leaf.u, leaf.v - .005);
      leaf.vx = core.clamp(leaf.vx * Math.pow(.72, dt) - gx * dt * .045, -.09, .09); leaf.vy = core.clamp(leaf.vy * Math.pow(.72, dt) - gy * dt * .045, -.09, .09);
      var u = leaf.u + (leaf.vx + (reduced ? 0 : .0012 * Math.sin(now * .3 + i))) * dt, v = leaf.v + (leaf.vy + (reduced ? 0 : .0007)) * dt;
      if (core.shore(u, v) < -.075) { leaf.u = u; leaf.v = v; } else { leaf.vx *= -.45; leaf.vy *= -.45; }
      leaf.angle += (leaf.turn + gx * 3) * dt * .15;
      var x = leaf.u * width, y = leaf.v * height, s = leaf.size, bob = reduced ? 0 : Math.sin(now * 1.8 + i) * .6;
      ctx.save(); ctx.translate(x, y + bob); ctx.rotate(leaf.angle);
      ctx.shadowColor = 'rgba(7,54,40,.5)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 3;
      ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(-s * .6, -s * .7, s, 0); ctx.quadraticCurveTo(-s * .2, s * .65, -s, 0);
      ctx.fillStyle = leaf.hue > .3 ? '#adb871' : '#d0b876'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#607650'; ctx.lineWidth = .65; ctx.beginPath(); ctx.moveTo(-s * .9, 0); ctx.lineTo(s * .8, 0); ctx.moveTo(0, 0); ctx.lineTo(-s * .35, -s * .35); ctx.moveTo(s * .25, 0); ctx.lineTo(-s * .05, s * .29); ctx.stroke(); ctx.restore();
    }
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
    weather.draw(ctx, width, height, reduced);
  }
  function rainImpact(u, v, strength, scale) {
    if (u < 0 || u > 1 || v < 0 || v > 1 || core.shore(u, v) >= -.015) return false;
    var cell = Math.round(v * (field.height - 1)) * field.width + Math.round(u * (field.width - 1));
    if (!field.mask[cell]) return false;
    var terrain = renderer ? renderer.terrain : fallbackTerrain;
    if (terrain && terrain.blocks(u, v)) return false;
    return field.rainImpact(u, v, strength, quality !== 'normal', scale);
  }
  function thunder(strength) { if (weatherAudio) weatherAudio.thunder(strength); }
  function tick(time) {
    frameId = 0;
    if (document.hidden) return;
    if (!lastFrame) lastFrame = time;
    var frameDt = Math.min(.08, Math.max(0, (time - lastFrame) / 1000));
    lastFrame = time; now += frameDt; accumulator += frameDt;
    if (resized) resize();
    if (time - lastRender >= (quality === 'normal' ? 32 : 40)) {
      var dt = Math.min(.08, (time - lastRender) / 1000 || .033); lastRender = time;
      // Long audio tails finish even while their water scene is inactive.
      if (strokeAudio) strokeAudio.update();
      if (weatherAudio) weatherAudio.update();
      if (sceneKind !== 'water') { accumulator = 0; updateNature(dt); }
      else if(renderer) {
      stoneDrops.update(dt,stoneEvent);
      if(stoneBedDirty){refreshStoneBed();stoneBedDirty=false;}
      fishSchool.anticipate(stoneDrops.items);
      fishSchool.update(dt,field.bathymetry,reduced,field);
      for (var key in fingers) {
        var finger = fingers[key];
        if (mode === 'touch' && finger.travel < 15 && now - finger.born > .55) {
          finger.charged = true;
          field.disturb(finger.u, finger.v, -.018, .035);
          if (now - finger.last > .28) { rings.push({u: finger.u, v: finger.v, born: now, strength: .16}); if (rings.length > 48) rings.shift(); finger.last = now; }
        }
      }
      weather.update(dt, quality !== 'normal', reduced, rainImpact, thunder);
      var steps = 0;
      field.updateRain(dt);
      while (accumulator >= 1 / 60 && steps < 5) { field.step(); accumulator -= 1 / 60; steps++; }
      if (steps === 5) accumulator = 0;
      renderer.draw(reduced ? 0 : now, light);
      drawLife(dt);
      }
      if (rippleAudio) rippleAudio.update(sceneKind === 'water' && renderer ? Math.sqrt(field.energy() / field.current.length) : 0);
    }
    // Slow callback delivery can also come from the host scheduler. Lower quality,
    // but never treat it as proof that WebGL is unavailable or stop simulation.
    if (frameDt > 0) { frameTotal += frameDt; frameSamples++; }
    if (frameSamples >= 90) {
      if (frameTotal / frameSamples > .045) slowFrames++; else slowFrames = 0;
      frameSamples = 0; frameTotal = 0;
      if (slowFrames >= 2 && quality === 'normal') { quality = 'low'; if (renderer) { renderer.low = true; renderer.resize(width, height); } natureRenderer.resize(width, height, true); drops.length = 0; slowFrames = 0; }
      if (quality !== 'normal') slowFrames = 0;
    }
    frameId = requestAnimationFrame(tick);
  }
  canvas.addEventListener('webglcontextlost', function (event) {
    event.preventDefault(); lostCount++; fallbackOn('3D 水面暂时中断，等待恢复'); fingers = {};
  });
  canvas.addEventListener('webglcontextrestored', function () {
    if (lostCount > 1) return;
    fallbackMode = false; quality = 'low'; syncSurfaces(); resized = true;
  });
  window.addEventListener('resize', function () { resized = true; });
  window.addEventListener('blur', function () { fingers = {}; cursor.style.display = 'none'; });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; fingers = {}; clearTimeout(noticeTimer); document.getElementById('notice').classList.remove('show'); stopAudio(true); }
    else { lastFrame = 0; lastRender = 0; accumulator = 0; slowFrames = 0; frameSamples = 0; frameTotal = 0; if (audio) { audio.resume().catch(function () {}); if (weatherAudio) weatherAudio.setLevel(sceneKind==='water'?weather.level:0); } if (!frameId) frameId = requestAnimationFrame(tick); }
  });
  // Read-only diagnostics keep browser verification independent from the rendering implementation.
  window.WaterGarden = { inspect: function () { return {
    fishTime: fishSchool.clock, fish: fishSchool.items.map(function(f){return {u:f.u,v:f.v,y:f.y,angle:f.angle,fear:f.fear,speed:f.speed,swim:f.swim,flowX:f.flowX,flowZ:f.flowZ};}), fishTriangles: fishSchool.vertices.length/33,
    ready: !!field,
    stones: stoneDrops.items.map(function(s){return {u:s.u,v:s.v,y:s.y,radius:s.radius,top:s.top,entered:s.entered,settled:s.settled,speed:s.body.velocity.length(),rotation:[s.body.quaternion.x,s.body.quaternion.y,s.body.quaternion.z,s.body.quaternion.w]};}),
    stoneImpacts: stoneDrops.impacts, stoneDepth: field && stoneDrops.items.length ? field.bathymetry.heightAt(stoneDrops.items[0].u,stoneDrops.items[0].v) : null,
    mode: mode, light: light, rain: rain, rainLevel: weather.level, rainStreaks: weather.count, rainImpacts: weather.hits,
    rainTransition: !!weather.transitionFrom, rainSpeed: weather.current.speed, rainRippleScale: weather.current.rippleScale,
    lightningCount: weather.strikes, lightningFlash: weather.flash, lightningNext: isFinite(weather.nextStrike) ? weather.nextStrike : null,
    thunderPending: weather.pendingThunder >= 0, thunderPlayed: weatherAudio ? weatherAudio.played : 0,
    rainAudio: !!(weatherAudio && weatherAudio.rain && weatherAudio.level), rainAudioFading: !!(weatherAudio && weatherAudio.rainEnd), weatherAudioNodes: weatherAudio ? weatherAudio.nodes.length : 0,
    strokeAudio: !!(strokeAudio && strokeAudio.node), strokeSpeed: strokeAudio ? strokeAudio.speed : 0,
    audioState: audio ? audio.state : 'uninitialized', strokeAudioFading: !!(strokeAudio && strokeAudio.fadeEnd),
    strokeReady: !!(strokeAudio && strokeAudio.buffer), strokeDuration: strokeAudio && strokeAudio.buffer ? strokeAudio.buffer.duration : 0,
    tapReady: !!(tapAudio && tapAudio.buffer), tapVoices: tapAudio ? tapAudio.voices.length : 0, tapPlayed: tapAudio ? tapAudio.played : 0,
    stoneReady: !!(stoneAudio && stoneAudio.buffer), stoneVoices: stoneAudio ? stoneAudio.voices.length : 0, stonePlayed: stoneAudio ? stoneAudio.played : 0,
    rippleReady: !!(rippleAudio && rippleAudio.buffer), rippleAudio: !!(rippleAudio && rippleAudio.node), rippleLevel: rippleAudio ? rippleAudio.level : 0,
    rippleFading: !!(rippleAudio && rippleAudio.fadeEnd), rippleDuration: rippleAudio && rippleAudio.buffer ? rippleAudio.buffer.duration : 0,
    audioEnabled: true, leaves: leaves.length, leafPositions: leaves.map(function (leaf) { return { u: leaf.u, v: leaf.v }; }), drops: drops.length, rings: rings.length,
    energy: field ? field.energy() : 0, steps: field ? field.steps : 0, quality: quality, renderer: renderer ? 'webgl' : 'unavailable',
    surfaceVertices: renderer && renderer.mesh ? renderer.mesh.count : 0, surfaceTriangles: renderer && renderer.mesh ? renderer.mesh.indices.length / 3 : 0,
    waterMaps: renderer ? renderer.mapsLoaded : 0, width: width, height: height, bufferWidth: renderer ? canvas.width : fallback.width,
    bufferHeight: renderer ? canvas.height : fallback.height, activePointers: Object.keys(fingers).length
  }; } };
  window.NatureGarden = { inspect: function () { return { scene: sceneKind, renderLight: natureRenderer.light, renderer: natureRenderer.available() ? 'webgl' : 'unavailable', camera: natureRenderer.surface && natureRenderer.surface.camera ? 'perspective' : null, ballMeshes: natureRenderer.available() && sceneKind === 'snow' ? snow.balls.length : 0, drawCalls: natureRenderer.surface ? natureRenderer.surface.drawCalls : 0, closedCloudMesh: !!(natureRenderer.surface && natureRenderer.surface.cloudMesh), triangles: natureRenderer.surface ? natureRenderer.surface.count / 3 : 0, cloudCarve: clouds.field.inspect().depth, mode: natureModes[sceneKind], weather: sceneKind === 'water' ? rain : natureWeather[sceneKind], snow: snow.inspect(), cloud: clouds.inspect(), activePointers: Object.keys(fingers).length, bufferWidth: natureCanvas.width, bufferHeight: natureCanvas.height }; } };
  resize();
  requestAnimationFrame(function () { garden.classList.add('ready'); frameId = requestAnimationFrame(tick); });
}());
