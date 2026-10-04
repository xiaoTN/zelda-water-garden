(function () {
  'use strict';
  var core = window.WaterCore, garden = document.getElementById('garden'), canvas = document.getElementById('water');
  var fallback = document.getElementById('fallback'), overlay = document.getElementById('life'), ctx = overlay.getContext('2d');
  var fctx = fallback.getContext('2d'), hint = document.getElementById('hint'), cursor = document.getElementById('cursor');
  var renderer = null, scene, field, width = 1, height = 1, mode = 'touch', light = 0, rain = false, muted = true;
  var leaves = [], drops = [], rings = [], dust = [], fingers = {}, reduced = false;
  var weather = new window.WaterWeather.System(), weatherAudio = null, strokeAudio = null, tapAudio = null;
  var rainOptions = document.getElementById('rain-options'), rainButtons = document.querySelectorAll('[data-rain]');
  var fishSchool = new window.WaterFish.System();
  var stoneDrops = new window.WaterStones.System(), fallbackTerrain = null, fallbackBed = null, stoneBedDirty = false;
  var now = 0, lastFrame = 0, lastRender = 0, accumulator = 0, frameId = 0, lostCount = 0, fallbackMode = false;
  var slowFrames = 0, frameSamples = 0, frameTotal = 0, quality = 'normal', resized = false;
  var audio = null, master = null, audioLast = 0, audioNodes = [], noticeTimer = 0;
  var hints = { touch: '轻点泛起涟漪 · 滑动拨开水面 · 长按蓄起水波', leaf: '轻点放下一片浮叶 · 滑动水面，推着叶子走', stone: '轻点选择落点 · 随机石头从高处落下 · 平静可清除' };
  if (window.matchMedia) reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function notice(text) {
    var element = document.getElementById('notice'); element.textContent = text; element.classList.add('show');
    clearTimeout(noticeTimer); noticeTimer = setTimeout(function () { element.classList.remove('show'); }, 2400);
  }
  function initAudio() {
    if (audio) { if (audio.state === 'suspended') audio.resume().catch(function () {}); return true; }
    var Constructor = window.AudioContext || window.webkitAudioContext;
    if (!Constructor) { notice('这里暂时无法播放水声，仍可自在玩水'); return false; }
    try {
      audio = new Constructor(); master = audio.createGain(); master.gain.value = .38; master.connect(audio.destination);
      weatherAudio = new window.WaterWeather.Audio(audio, master);
      strokeAudio = new window.WaterSound.Stroke(audio, master, window.WaterSwipeAsset);
      tapAudio = new window.WaterSound.Tap(audio, master, window.WaterTapAsset);
      if (audio.state === 'suspended') audio.resume().catch(function () {});
      return true;
    } catch (error) { notice('这里暂时无法播放水声，仍可自在玩水'); return false; }
  }
  function sound(strength, deep) {
    if (muted || !audio || audio.state !== 'running' || now - audioLast < .09 || audioNodes.length >= 8) return;
    audioLast = now;
    var length = Math.floor(audio.sampleRate * .22), buffer = audio.createBuffer(1, length, audio.sampleRate), values = buffer.getChannelData(0);
    for (var i = 0; i < length; i++) values[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    var noise = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain(), t = audio.currentTime;
    noise.buffer = buffer; filter.type = 'lowpass'; filter.frequency.setValueAtTime(deep ? 1200 : 2600, t); filter.frequency.exponentialRampToValueAtTime(180, t + .22);
    gain.gain.setValueAtTime(Math.min(.25, .05 + strength * .15), t); gain.gain.exponentialRampToValueAtTime(.001, t + .22);
    noise.connect(filter); filter.connect(gain); gain.connect(master); noise.start(t); noise.stop(t + .23);
    var osc = audio.createOscillator(), tone = audio.createGain(); osc.type = 'sine';
    osc.frequency.setValueAtTime(deep ? 310 : 650 + Math.random() * 180, t); osc.frequency.exponentialRampToValueAtTime(100, t + .16);
    tone.gain.setValueAtTime(.03 + Math.min(strength, 1) * .08, t); tone.gain.exponentialRampToValueAtTime(.001, t + .18);
    osc.connect(tone); tone.connect(master); osc.start(t); osc.stop(t + .2);
    var node = { noise: noise, filter: filter, gain: gain, osc: osc, tone: tone }; audioNodes.push(node);
    noise.onended = function () { noise.disconnect(); filter.disconnect(); gain.disconnect(); osc.disconnect(); tone.disconnect(); var index = audioNodes.indexOf(node); if (index !== -1) audioNodes.splice(index, 1); };
  }
  function stopAudio() {
    weather.cancelThunder();
    if (weatherAudio) weatherAudio.stop();
    if (strokeAudio) strokeAudio.stop();
    if (tapAudio) tapAudio.stop();
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
    if (message) notice(message);
  }
  function resize() {
    width = Math.max(1, garden.clientWidth); height = Math.max(1, window.innerHeight);
    garden.style.setProperty('--app-height', height + 'px');
    var size = core.bufferSize(width, height, window.devicePixelRatio, quality !== 'normal');
    overlay.width = size.width; overlay.height = size.height; fallback.width = size.width; fallback.height = size.height;
    ctx.setTransform(size.scale, 0, 0, size.scale, 0, 0); fctx.setTransform(size.scale, 0, 0, size.scale, 0, 0);
    if (renderer) renderer.destroy(); renderer = null;
    var aspect = width / height, nx = aspect >= 1 ? 192 : Math.max(64, Math.round(192 * aspect)), ny = aspect >= 1 ? Math.max(64, Math.round(192 / aspect)) : 192;
    field = new core.WaveField(nx, ny, aspect); scene = window.WaterScene.create(aspect, fallbackMode);
    fishSchool.attach(aspect);
    if (!fallbackMode) {
      try { renderer = new window.WaterRenderer(canvas, scene, field); renderer.dropSystem = stoneDrops; renderer.fishSystem = fishSchool; renderer.low = quality === 'low'; renderer.resize(width, height); }
      catch (error) { fallbackOn('已为你换成轻量水面'); }
    }
    if(!field.bathymetry)prepareFallbackStones();
    fingers = {}; leaves.length = 0; drops.length = 0; rings.length = 0;
    if (strokeAudio) strokeAudio.stop();
    // Three small existing leaves make the pool feel alive before the first touch.
    addLeaf(.22, .48); addLeaf(.76, .56); addLeaf(.70, .29);
    dust.length = 0;
    var random = core.seededRandom(93412);
    for (var i = 0; i < 24; i++) dust.push({ u: random(), v: random(), phase: random() * 6.28, size: .5 + random() * 1.2 });
    accumulator = 0; lastFrame = 0; lastRender = 0; resized = false;
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
    if(mode!=='stone'&&stoneDrops.blocks(p.u,p.v))return;
    if (mode!=='stone' && renderer && renderer.terrain.blocks(p.u, p.v)) return;
    if (core.shore(p.u, p.v) >= -.025) { notice('轻触池中的青绿水面'); return; }
    garden.classList.add('touched');
    if (!muted) initAudio();
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
    f.travel += distance;
    if (stoneDrops.blocks(p.u,p.v) || (renderer && renderer.terrain.blocks(p.u, p.v))) { f.u=p.u;f.v=p.v;return; }
    if (core.shore(p.u, p.v) < -.02) {
      fishSchool.scare(p.u,p.v,Math.min(1,.35+distance/65),f.u,f.v);
      field.stroke(f.u, f.v, p.u, p.v, Math.min(.17, .035 + distance * .002));
      if (!muted && strokeAudio && distance > .5) strokeAudio.stroke(distance / Math.min(width, height) / Math.max(.016, now - f.movedAt));
      pushLeaves(p.u, p.v, dx / width, dy / height);
      swipeRipple(f, p, distance);
    } else { f.rippleDistance = 0; }
    f.u = p.u; f.v = p.v; f.movedAt = now;
  }
  function end(id, cancelled) {
    var f = fingers[id]; if (!f) return;
    if (!cancelled && mode === 'touch' && f.charged) { splash(f.u, f.v, Math.min(1.1, .45 + (now - f.born) * .18), true); sound(1, true); }
    else if (!cancelled && f.travel < 15) {
      // Wait until release to distinguish a tap from a swipe; swipes have no drawn rings.
      addRing(f.u, f.v, mode === 'leaf' ? .10 : .32);
      if (!muted && (!tapAudio || !tapAudio.play(mode === 'leaf' ? .2 : .6))) sound(.32, false);
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
        if (event.pointerType === 'mouse' && core.shore(event.clientX / width, event.clientY / height) < -.02) { cursor.style.display = 'block'; cursor.style.left = event.clientX + 'px'; cursor.style.top = event.clientY + 'px'; } else cursor.style.display = 'none';
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
      window.addEventListener('mousemove', function (event) { move('mouse', event.clientX, event.clientY); });
      window.addEventListener('mouseup', function () { end('mouse', false); });
    }
  }
  bindInteractions(canvas); bindInteractions(fallback);
  function keyRipple(event) { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); begin('key', width * .5, height * .49); end('key', false); } }
  canvas.addEventListener('keydown', keyRipple); fallback.addEventListener('keydown', keyRipple);
  var buttons = document.querySelectorAll('[data-mode]');
  for (var b = 0; b < buttons.length; b++) buttons[b].addEventListener('click', function () {
    fingers = {}; mode = this.getAttribute('data-mode'); hint.textContent = hints[mode];
    canvas.setAttribute('aria-label', mode === 'stone' ? '交互水池，轻点选择落点，石头从高空落下' : '交互水池，轻点起涟漪，滑动拨水');
    for (var i = 0; i < buttons.length; i++) { var selected = buttons[i] === this; buttons[i].classList.toggle('selected', selected); buttons[i].setAttribute('aria-pressed', String(selected)); }
  });
  document.getElementById('light').addEventListener('click', function () {
    light = (light + 1) % 3; var name = ['晨光','暮色','月夜'][light];
    document.getElementById('light-label').textContent = name; this.setAttribute('aria-label', '切换光照，当前' + name);
    this.querySelector('.sun-icon').textContent = ['☼','☷','☾'][light];
    notice(['晨光落在水底','把一池水染成暮色','月光与萤火，陪你片刻'][light]);
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
    if (weatherAudio) { weatherAudio.stop(); if (!muted && !document.hidden) weatherAudio.setLevel(level); }
    if (!rain) showRainOptions(false); else garden.classList.add('touched');
  }
  document.getElementById('rain').addEventListener('click', function () {
    if (!rain) { setRainLevel(1); showRainOptions(true); notice('小雨轻落，试试不同的雨势'); }
    else showRainOptions(rainOptions.hidden);
  });
  for (var r = 0; r < rainButtons.length; r++) rainButtons[r].addEventListener('click', function () {
    var level = Number(this.getAttribute('data-rain')); setRainLevel(level);
    notice(['雨停了，水波还在','小雨轻落，雨丝拂过水面','中雨连绵，偶有远雷','大雨倾落，雷电渐近','暴雨倾盆，电闪雷鸣'][level] + (muted && level >= 2 ? ' · 可开启声音' : ''));
    if (!level) document.getElementById('rain').focus();
  });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !rainOptions.hidden) { showRainOptions(false); document.getElementById('rain').focus(); } });
  document.getElementById('sound').addEventListener('click', function () {
    if (muted && !initAudio()) return;
    muted = !muted; this.setAttribute('aria-pressed', String(!muted)); this.setAttribute('aria-label', muted ? '开启水声、雨声和雷声' : '关闭声音');
    if (muted) stopAudio(); else { if (weatherAudio) weatherAudio.setLevel(weather.level); audioLast = -10; sound(.45, false); }
  });
  document.getElementById('reset').addEventListener('click', function () {
    if (strokeAudio) strokeAudio.stop();
    if (tapAudio) tapAudio.stop();
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
        var foamWave = field.sample(foamU,foamV);
        r += core.clamp(foamWave*.14,-.065,.065);
        var x = (.5+Math.cos(a)*.465*r)*width, y = (.49+Math.sin(a)*.35*r)*height;
        if (!n || (Math.sin(a*8-foam+foamTime*.5) < -.1)) fctx.moveTo(x,y); else fctx.lineTo(x,y);
      }
      fctx.strokeStyle = 'rgba(231,255,246,'+(opacity*.7)+')'; fctx.lineWidth = 1.2+opacity*1.8; fctx.stroke();
    }
    fctx.restore();
    if (light !== 0) { fctx.fillStyle = light === 1 ? 'rgba(129,56,18,.24)' : 'rgba(3,18,49,.52)'; fctx.fillRect(0, 0, width, height); }
    fishSchool.drawFallback(fctx,width,height,field,light);
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
  function thunder(strength) { if (!muted && weatherAudio) weatherAudio.thunder(strength); }
  function tick(time) {
    frameId = 0;
    if (document.hidden) return;
    if (!lastFrame) lastFrame = time;
    var frameDt = Math.min(.08, Math.max(0, (time - lastFrame) / 1000));
    lastFrame = time; now += frameDt; accumulator += frameDt;
    if (resized) resize();
    if (time - lastRender >= (quality === 'normal' ? 32 : 40)) {
      var dt = Math.min(.08, (time - lastRender) / 1000 || .033); lastRender = time;
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
      if (strokeAudio) strokeAudio.update();
      while (accumulator >= 1 / 60 && steps < 5) { field.step(); accumulator -= 1 / 60; steps++; }
      if (steps === 5) accumulator = 0;
      if (renderer) renderer.draw(reduced ? 0 : now, light); else drawFallback();
      drawLife(dt);
    }
    // Measure delivered RAF timing; downgrade only after sustained slow windows.
    if (frameDt > 0) { frameTotal += frameDt; frameSamples++; }
    if (frameSamples >= 90) {
      if (frameTotal / frameSamples > .045) slowFrames++; else slowFrames = 0;
      frameSamples = 0; frameTotal = 0;
      if (slowFrames >= 2 && quality === 'normal') { quality = 'low'; if (renderer) { renderer.low = true; renderer.resize(width, height); } drops.length = 0; slowFrames = 0; }
      else if (slowFrames >= 2 && quality === 'low') { fallbackOn('已换成轻量水面，让指尖更自在'); slowFrames = 0; }
    }
    frameId = requestAnimationFrame(tick);
  }
  canvas.addEventListener('webglcontextlost', function (event) {
    event.preventDefault(); lostCount++; fallbackOn('水面已切换为轻量模式'); fingers = {};
  });
  canvas.addEventListener('webglcontextrestored', function () {
    if (lostCount > 1) return;
    fallbackMode = false; quality = 'low'; canvas.style.display = 'block'; fallback.style.display = 'none'; fallback.setAttribute('aria-hidden', 'true'); fallback.removeAttribute('tabindex'); resized = true;
  });
  window.addEventListener('resize', function () { resized = true; });
  window.addEventListener('blur', function () { fingers = {}; cursor.style.display = 'none'; });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; fingers = {}; clearTimeout(noticeTimer); document.getElementById('notice').classList.remove('show'); stopAudio(); }
    else { lastFrame = 0; lastRender = 0; accumulator = 0; if (!muted && audio) { audio.resume().catch(function () {}); if (weatherAudio) weatherAudio.setLevel(weather.level); } if (!frameId) frameId = requestAnimationFrame(tick); }
  });
  // Read-only diagnostics keep browser verification independent from the rendering implementation.
  window.WaterGarden = { inspect: function () { return {
    fishTime: fishSchool.clock, fish: fishSchool.items.map(function(f){return {u:f.u,v:f.v,y:f.y,angle:f.angle,fear:f.fear,speed:f.speed,swim:f.swim,flowX:f.flowX,flowZ:f.flowZ};}), fishTriangles: fishSchool.vertices.length/33,
    ready: !!field,
    stones: stoneDrops.items.map(function(s){return {u:s.u,v:s.v,y:s.y,radius:s.radius,top:s.top,entered:s.entered,settled:s.settled,speed:s.body.velocity.length(),rotation:[s.body.quaternion.x,s.body.quaternion.y,s.body.quaternion.z,s.body.quaternion.w]};}),
    stoneImpacts: stoneDrops.impacts, stoneDepth: field && stoneDrops.items.length ? field.bathymetry.heightAt(stoneDrops.items[0].u,stoneDrops.items[0].v) : null,
    mode: mode, light: light, rain: rain, rainLevel: weather.level, rainStreaks: weather.count, rainImpacts: weather.hits,
    lightningCount: weather.strikes, lightningFlash: weather.flash, lightningNext: isFinite(weather.nextStrike) ? weather.nextStrike : null,
    thunderPending: weather.pendingThunder >= 0, thunderPlayed: weatherAudio ? weatherAudio.played : 0,
    rainAudio: !!(weatherAudio && weatherAudio.rain), weatherAudioNodes: weatherAudio ? weatherAudio.nodes.length : 0,
    strokeAudio: !!(strokeAudio && strokeAudio.node), strokeSpeed: strokeAudio ? strokeAudio.speed : 0,
    strokeReady: !!(strokeAudio && strokeAudio.buffer), strokeDuration: strokeAudio && strokeAudio.buffer ? strokeAudio.buffer.duration : 0,
    tapReady: !!(tapAudio && tapAudio.buffer), tapVoices: tapAudio ? tapAudio.voices.length : 0, tapPlayed: tapAudio ? tapAudio.played : 0,
    muted: muted, leaves: leaves.length, leafPositions: leaves.map(function (leaf) { return { u: leaf.u, v: leaf.v }; }), drops: drops.length, rings: rings.length,
    energy: field ? field.energy() : 0, steps: field ? field.steps : 0, quality: quality, renderer: renderer ? 'webgl' : 'canvas2d',
    surfaceVertices: renderer && renderer.mesh ? renderer.mesh.count : 0, surfaceTriangles: renderer && renderer.mesh ? renderer.mesh.indices.length / 3 : 0,
    waterMaps: renderer ? renderer.mapsLoaded : 0, width: width, height: height, bufferWidth: renderer ? canvas.width : fallback.width,
    bufferHeight: renderer ? canvas.height : fallback.height, activePointers: Object.keys(fingers).length
  }; } };
  resize();
  requestAnimationFrame(function () { garden.classList.add('ready'); frameId = requestAnimationFrame(tick); });
}());
