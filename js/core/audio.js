// Web Audio synthesizer: all game sounds (blocks, UI, player, mobs) + generative ambient music.
(function () {
  var ctx = null, master = null, buses = {}, noiseBuf = null, started = false;
  var volumes = { master: 1, music: 1, blocks: 1, hostile: 1, friendly: 1, players: 1, ambient: 1, ui: 1 };
  var listener = { x: 0, y: 0, z: 0, yaw: 0 };

  function init() {
    if (ctx) return true;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ctx.createGain(); master.connect(ctx.destination);
    // gentle compressor to avoid clipping when many sounds play
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
    master.disconnect(); master.connect(comp); comp.connect(ctx.destination);
    Object.keys(volumes).forEach(function (k) { if (k === 'master') return; var g = ctx.createGain(); g.connect(master); buses[k] = g; });
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    // reverb for music
    var ir = ctx.createBuffer(2, ctx.sampleRate * 2.5, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var ch = ir.getChannelData(c); for (i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 2.5) * 0.5; }
    reverb = ctx.createConvolver(); reverb.buffer = ir; reverbGain = ctx.createGain(); reverbGain.gain.value = 0.35; reverb.connect(reverbGain); reverbGain.connect(buses.music);
    started = true; return true;
  }
  var reverb = null, reverbGain = null;
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function applyVolumes() { if (!ctx) return; master.gain.value = volumes.master; Object.keys(buses).forEach(function (k) { buses[k].gain.value = volumes[k]; }); }
  function setVolume(k, v) { volumes[k] = MC.clamp(v, 0, 1); applyVolumes(); }

  function now() { return ctx.currentTime; }
  function env(g, t, a, peak, d, sustain, r) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + d); if (r) g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r); }

  // Spatialization: returns a gain node (already connected) for a sound at world pos
  function output(bus, pos, vol) {
    var g = ctx.createGain(); g.gain.value = vol === undefined ? 1 : vol;
    if (pos) {
      var dx = pos.x - listener.x, dy = pos.y - listener.y, dz = pos.z - listener.z; var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var att = MC.clamp(1 - dist / 16, 0, 1); att *= att;
      if (att <= 0.001) { g.gain.value = 0; }
      else {
        g.gain.value *= att;
        // pan relative to yaw
        var rx = dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw);
        var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (pan) { pan.pan.value = MC.clamp(rx / Math.max(1, dist), -1, 1) * 0.8; g.connect(pan); pan.connect(buses[bus] || master); return g; }
      }
    }
    g.connect(buses[bus] || master); return g;
  }
  function noise(t, dur, filterType, freq, q, out, rate) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rate || 1;
    var f = ctx.createBiquadFilter(); f.type = filterType || 'lowpass'; f.frequency.value = freq || 1000; f.Q.value = q || 0.7;
    s.connect(f); f.connect(out); s.start(t); s.stop(t + dur + 0.05); return { src: s, filter: f };
  }
  function tone(t, dur, type, freq, out, freqEnd) {
    var o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    o.connect(out); o.start(t); o.stop(t + dur + 0.05); return o;
  }

  // ---- Sound definitions: fn(t, out, pitch) ----
  var SFX = {};
  function def(name, fn) { SFX[name] = fn; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // Runtime SFX now come from the bundled Minecraft 1.17 sound pack.  Keeping the
  // original definitions below is useful only as a compatibility fallback while the
  // pack is loading; every sound the game emits has an entry in this table.
  var SOUND_PACK_ROOT = 'Minecraft Sound Pack 1.17 - Sound Effects/Minecraft Sound Pack 1.17 - Sound Effects/';
  function variants(path, count) {
    var files = [];
    for (var i = 1; i <= count; i++) files.push(path + i + '.ogg');
    return files;
  }
  var PACK_SFX = {
    'dig.stone': variants('dig/stone', 4), 'step.stone': variants('step/stone', 6),
    'dig.gravel': variants('dig/gravel', 4), 'step.gravel': variants('step/gravel', 4),
    'dig.grass': variants('dig/grass', 4), 'step.grass': variants('step/grass', 6),
    'dig.sand': variants('dig/sand', 4), 'step.sand': variants('step/sand', 5),
    'dig.wood': variants('dig/wood', 4), 'step.wood': variants('step/wood', 6),
    'dig.wool': variants('dig/cloth', 4), 'step.wool': variants('step/cloth', 4),
    'dig.glass': variants('random/glass', 3), 'step.glass': variants('random/glass', 3),
    'dig.snow': variants('dig/snow', 4), 'step.snow': variants('step/snow', 4),
    'dig.metal': variants('dig/stone', 4), 'step.metal': variants('step/stone', 6),
    'dig.slime': variants('mob/slime/big', 4), 'step.slime': variants('mob/slime/small', 5),
    'ui.click': ['random/click.ogg'],
    'random.pop': ['random/pop.ogg'], 'random.orb': ['random/orb.ogg'], 'random.levelup': ['random/levelup.ogg'],
    'player.hurt': variants('damage/hit', 3), 'player.fall': ['damage/fallbig.ogg', 'damage/fallsmall.ogg'],
    'player.splash': ['liquid/heavy_splash.ogg', 'liquid/splash.ogg'], 'player.swim': variants('liquid/swim', 18),
    'player.eat': variants('random/eat', 3), 'player.burp': ['random/burp.ogg'],
    'player.attack': variants('entity/player/attack/strong', 6), 'player.attack.sweep': variants('entity/player/attack/sweep', 7),
    'entity.hit': variants('damage/hit', 3), 'item.break': ['random/break.ogg'], 'block.torch': ['fire/ignite.ogg'],
    'fire.ignite': ['fire/ignite.ogg'], 'explode': variants('random/explode', 4), 'creeper.primed': ['random/fuse.ogg'],
    'creeper.hurt': variants('mob/creeper/say', 4), 'creeper.death': ['mob/creeper/death.ogg'],
    'zombie.ambient': variants('mob/zombie/say', 3), 'zombie.hurt': variants('mob/zombie/hurt', 2), 'zombie.death': ['mob/zombie/death.ogg'],
    'skeleton.ambient': variants('mob/skeleton/say', 3), 'skeleton.hurt': variants('mob/skeleton/hurt', 4), 'skeleton.death': ['mob/skeleton/death.ogg'],
    'spider.ambient': variants('mob/spider/say', 4), 'spider.hurt': variants('mob/spider/say', 4), 'spider.death': ['mob/spider/death.ogg'],
    'pig.ambient': variants('mob/pig/say', 3), 'pig.hurt': variants('mob/pig/say', 3), 'pig.death': ['mob/pig/death.ogg'],
    'cow.ambient': variants('mob/cow/say', 4), 'cow.hurt': variants('mob/cow/hurt', 3), 'cow.death': variants('mob/cow/hurt', 3),
    'sheep.ambient': variants('mob/sheep/say', 3), 'sheep.hurt': variants('mob/sheep/say', 3), 'sheep.death': variants('mob/sheep/say', 3),
    'chicken.ambient': variants('mob/chicken/say', 3), 'chicken.hurt': variants('mob/chicken/hurt', 2), 'chicken.death': variants('mob/chicken/hurt', 2), 'chicken.egg': ['mob/chicken/plop.ogg'],
    'bow.shoot': ['random/bow.ogg'], 'arrow.hit': variants('random/bowhit', 4), 'chest.open': ['random/chestopen.ogg'],
    'door': ['random/door_open.ogg', 'random/door_close.ogg'], 'lava.pop': ['liquid/lavapop.ogg'],
    'fire.ambient': ['fire/fire.ogg'], 'ambient.cave': variants('ambient/cave/cave', 19),
    'rain': variants('ambient/weather/rain', 8), 'thunder': variants('ambient/weather/thunder', 3), 'sign': variants('dig/wood', 4)
  };
  function soundBus(name) {
    return name.indexOf('dig.') === 0 || name.indexOf('step.') === 0 || name.indexOf('block.') === 0 ? 'blocks' : name.indexOf('ui.') === 0 ? 'ui' : name.indexOf('player.') === 0 || name.indexOf('random.') === 0 || name.indexOf('item.') === 0 ? 'players' : (/zombie|creeper|skeleton|spider|explode/).test(name) ? 'hostile' : (/pig|cow|sheep|chicken|entity/).test(name) ? 'friendly' : 'ambient';
  }
  function playPacked(name, opts, bus) {
    var choices = PACK_SFX[name];
    if (!choices) return false;
    var volume = (opts.volume === undefined ? 1 : opts.volume) * volumes.master * (volumes[bus] === undefined ? 1 : volumes[bus]);
    if (opts.pos) {
      var dx = opts.pos.x - listener.x, dy = opts.pos.y - listener.y, dz = opts.pos.z - listener.z;
      var distance = Math.sqrt(dx * dx + dy * dy + dz * dz), attenuation = MC.clamp(1 - distance / 16, 0, 1);
      volume *= attenuation * attenuation;
    }
    if (volume <= 0.001) return true;
    var audio = new Audio(encodeURI(SOUND_PACK_ROOT + choices[Math.floor(Math.random() * choices.length)]));
    audio.preload = 'auto'; audio.volume = MC.clamp(volume, 0, 1); audio.playbackRate = opts.pitch || 1;
    var start = function () { audio.play().catch(function () {}); };
    if (opts.delay) setTimeout(start, opts.delay * 1000); else start();
    return true;
  }

  // Block material sounds (dig = break/place, step = footstep)
  var MAT = {
    stone: { f: 900, type: 'lowpass', dur: 0.14, q: 0.8, knock: 0 },
    gravel: { f: 1400, type: 'lowpass', dur: 0.2, q: 0.5, knock: 0, crunch: true },
    grass: { f: 1200, type: 'bandpass', dur: 0.16, q: 0.6, knock: 0, soft: true },
    sand: { f: 2500, type: 'highpass', dur: 0.2, q: 0.4, knock: 0, soft: true },
    wood: { f: 700, type: 'lowpass', dur: 0.12, q: 1, knock: 180 },
    wool: { f: 500, type: 'lowpass', dur: 0.14, q: 0.5, knock: 0, soft: true },
    glass: { f: 4000, type: 'highpass', dur: 0.25, q: 0.8, knock: 0, glass: true },
    snow: { f: 1800, type: 'bandpass', dur: 0.18, q: 0.5, knock: 0, soft: true },
    metal: { f: 1800, type: 'bandpass', dur: 0.3, q: 6, knock: 900 },
    slime: { f: 400, type: 'lowpass', dur: 0.25, q: 2, knock: 0, soft: true },
    none: null
  };
  function blockSound(mat, step) {
    return function (t, out, pitch) {
      var m = MAT[mat] || MAT.stone; pitch = pitch || 1;
      var g = ctx.createGain(); g.connect(out);
      var vol = step ? 0.22 : 0.6; if (m.soft) vol *= 0.8;
      var dur = m.dur * (step ? 0.7 : 1);
      env(g, t, 0.004, vol, dur, 0.001);
      var n = noise(t, dur, m.type, m.f * pitch * (step ? 0.9 : 1), m.q, g, rnd(0.9, 1.1) * pitch);
      if (m.type === 'lowpass') n.filter.frequency.exponentialRampToValueAtTime(Math.max(60, m.f * pitch * 0.25), t + dur);
      if (m.crunch) { for (var i = 1; i < 3; i++) { var g2 = ctx.createGain(); g2.connect(out); env(g2, t + i * 0.04, 0.003, vol * 0.5, 0.06, 0.001); noise(t + i * 0.04, 0.08, 'lowpass', 1200 * pitch, 0.6, g2); } }
      if (m.knock) { var g3 = ctx.createGain(); g3.connect(out); env(g3, t, 0.002, vol * 0.5, 0.1, 0.001); tone(t, 0.12, 'triangle', m.knock * pitch, g3, m.knock * pitch * 0.5); }
      if (m.glass && !step) { for (var k = 0; k < 4; k++) { var g4 = ctx.createGain(); g4.connect(out); env(g4, t + k * 0.03, 0.002, 0.25, 0.12, 0.001); tone(t + k * 0.03, 0.14, 'sine', rnd(2500, 5000) * pitch, g4); } }
    };
  }
  Object.keys(MAT).forEach(function (m) { if (!MAT[m]) return; def('dig.' + m, blockSound(m, false)); def('step.' + m, blockSound(m, true)); });
  def('ui.click', function (t, out) {
    var g = ctx.createGain(); g.connect(out); env(g, t, 0.002, 0.5, 0.06, 0.001);
    tone(t, 0.07, 'square', 1180, g, 600);
    var g2 = ctx.createGain(); g2.connect(out); env(g2, t, 0.001, 0.25, 0.04, 0.001); noise(t, 0.05, 'bandpass', 2000, 1.5, g2);
  });
  def('random.pop', function (t, out, pitch) { pitch = pitch || 1; var g = ctx.createGain(); g.connect(out); env(g, t, 0.003, 0.4, 0.09, 0.001); tone(t, 0.1, 'sine', 700 * pitch, g, 1500 * pitch); });
  def('random.orb', function (t, out, pitch) { pitch = pitch || 1; var f = rnd(1000, 2100) * pitch; var g = ctx.createGain(); g.connect(out); env(g, t, 0.002, 0.28, 0.18, 0.001); tone(t, 0.2, 'sine', f, g); tone(t, 0.2, 'sine', f * 2.01, g).detune.value = 5; });
  def('random.levelup', function (t, out) { var notes = [523, 659, 784, 1046]; notes.forEach(function (f, i) { var g = ctx.createGain(); g.connect(out); env(g, t + i * 0.09, 0.005, 0.3, 0.4, 0.001); tone(t + i * 0.09, 0.45, 'sine', f, g); tone(t + i * 0.09, 0.45, 'triangle', f * 2, g).connect(g); }); });
  def('player.hurt', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.005, 0.6, 0.25, 0.001); tone(t, 0.28, 'sawtooth', 280, g, 110); var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; var g2 = ctx.createGain(); g2.connect(f); f.connect(out); env(g2, t, 0.003, 0.3, 0.12, 0.001); noise(t, 0.14, 'lowpass', 1500, 0.6, g2); });
  def('player.fall', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.003, 0.7, 0.2, 0.001); noise(t, 0.22, 'lowpass', 500, 0.8, g); tone(t, 0.15, 'sine', 120, g, 40); });
  def('player.splash', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.01, 0.5, 0.45, 0.001); var n = noise(t, 0.5, 'lowpass', 3000, 0.5, g); n.filter.frequency.exponentialRampToValueAtTime(300, t + 0.5); });
  def('player.swim', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.05, 0.18, 0.3, 0.001); noise(t, 0.35, 'bandpass', 800, 0.8, g); });
  def('player.eat', function (t, out) { for (var i = 0; i < 3; i++) { var g = ctx.createGain(); g.connect(out); env(g, t + i * 0.22, 0.01, 0.35, 0.12, 0.001); noise(t + i * 0.22, 0.14, 'lowpass', 900, 0.8, g); } });
  def('player.burp', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.02, 0.45, 0.3, 0.001); tone(t, 0.32, 'sawtooth', 130, g, 70); });
  def('player.attack', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.003, 0.25, 0.12, 0.001); var n = noise(t, 0.14, 'bandpass', 900, 1.2, g); n.filter.frequency.exponentialRampToValueAtTime(300, t + 0.14); });
  def('player.attack.sweep', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.01, 0.3, 0.2, 0.001); var n = noise(t, 0.22, 'bandpass', 1800, 1.5, g); n.filter.frequency.exponentialRampToValueAtTime(200, t + 0.22); });
  def('entity.hit', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.002, 0.45, 0.1, 0.001); noise(t, 0.12, 'lowpass', 700, 0.8, g); tone(t, 0.08, 'sine', 200, g, 90); });
  def('item.break', function (t, out) { for (var k = 0; k < 3; k++) { var g = ctx.createGain(); g.connect(out); env(g, t + k * 0.04, 0.002, 0.3, 0.1, 0.001); tone(t + k * 0.04, 0.1, 'square', rnd(600, 1200), g, 300); } });
  def('block.torch', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.002, 0.3, 0.1, 0.001); noise(t, 0.1, 'highpass', 3000, 0.5, g); });
  def('fire.ignite', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.01, 0.4, 0.3, 0.001); noise(t, 0.35, 'highpass', 2000, 0.5, g); });
  def('explode', function (t, out) {
    var g = ctx.createGain(); g.connect(out); env(g, t, 0.005, 1.2, 0.9, 0.001, 0.5);
    var n = noise(t, 1.5, 'lowpass', 400, 0.7, g); n.filter.frequency.exponentialRampToValueAtTime(60, t + 1.2);
    var g2 = ctx.createGain(); g2.connect(out); env(g2, t, 0.005, 0.9, 0.6, 0.001); tone(t, 0.7, 'sine', 90, g2, 30);
    var g3 = ctx.createGain(); g3.connect(out); env(g3, t, 0.001, 0.5, 0.08, 0.001); noise(t, 0.1, 'highpass', 1500, 0.5, g3);
  });
  def('creeper.primed', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.05, 0.55, 1.4, 0.3); var n = noise(t, 1.5, 'bandpass', 800, 1.0, g); n.filter.frequency.exponentialRampToValueAtTime(5000, t + 1.4); });
  def('creeper.hurt', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.005, 0.5, 0.2, 0.001); noise(t, 0.22, 'bandpass', 1500, 1.5, g); });
  def('creeper.death', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.005, 0.5, 0.5, 0.001); var n = noise(t, 0.55, 'bandpass', 2000, 1.2, g); n.filter.frequency.exponentialRampToValueAtTime(300, t + 0.5); });
  function growl(t, out, f0, f1, dur, vol) { var g = ctx.createGain(); var flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 700; flt.Q.value = 3; g.connect(flt); flt.connect(out); env(g, t, 0.05, vol || 0.5, dur, 0.001); var o = tone(t, dur + 0.05, 'sawtooth', f0, g, f1); var lfo = ctx.createOscillator(); lfo.frequency.value = 6; var lg = ctx.createGain(); lg.gain.value = 8; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.1); }
  def('zombie.ambient', function (t, out) { growl(t, out, 110, 85, 0.9, 0.45); });
  def('zombie.hurt', function (t, out) { growl(t, out, 160, 100, 0.35, 0.5); });
  def('zombie.death', function (t, out) { growl(t, out, 140, 60, 0.9, 0.55); });
  def('skeleton.ambient', function (t, out) { for (var i = 0; i < 5; i++) { var g = ctx.createGain(); g.connect(out); env(g, t + i * 0.07, 0.002, 0.3, 0.05, 0.001); noise(t + i * 0.07, 0.06, 'bandpass', rnd(1500, 3000), 4, g); } });
  def('skeleton.hurt', function (t, out) { for (var i = 0; i < 3; i++) { var g = ctx.createGain(); g.connect(out); env(g, t + i * 0.05, 0.002, 0.4, 0.06, 0.001); noise(t + i * 0.05, 0.07, 'bandpass', rnd(1200, 2500), 4, g); } });
  def('spider.ambient', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.05, 0.35, 0.5, 0.001); noise(t, 0.55, 'bandpass', 2500, 2, g); });
  def('spider.hurt', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.01, 0.4, 0.25, 0.001); noise(t, 0.28, 'bandpass', 3500, 2, g); });
  function formant(t, out, f0, f1, dur, vol, ff, fq) { var g = ctx.createGain(); var flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = ff; flt.Q.value = fq || 2; g.connect(flt); flt.connect(out); env(g, t, 0.03, vol, dur, 0.001); tone(t, dur + 0.05, 'sawtooth', f0, g, f1); }
  def('pig.ambient', function (t, out) { formant(t, out, 300, 220, 0.18, 0.7, 900, 3); formant(t + 0.2, out, 280, 200, 0.16, 0.6, 800, 3); });
  def('pig.hurt', function (t, out) { formant(t, out, 420, 260, 0.3, 0.8, 1000, 3); });
  def('pig.death', function (t, out) { formant(t, out, 380, 150, 0.6, 0.8, 900, 3); });
  def('cow.ambient', function (t, out) { formant(t, out, 130, 110, 0.9, 0.7, 500, 1.5); formant(t + 0.05, out, 260, 220, 0.85, 0.3, 700, 2); });
  def('cow.hurt', function (t, out) { formant(t, out, 180, 120, 0.45, 0.8, 600, 1.5); });
  def('cow.death', function (t, out) { formant(t, out, 150, 70, 0.9, 0.8, 500, 1.5); });
  def('sheep.ambient', function (t, out) { var g = ctx.createGain(); var flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 1200; flt.Q.value = 1.5; g.connect(flt); flt.connect(out); env(g, t, 0.03, 0.6, 0.7, 0.001); var o = tone(t, 0.75, 'sawtooth', 240, g, 200); var lfo = ctx.createOscillator(); lfo.frequency.value = 16; var lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(g.gain); lfo.start(t); lfo.stop(t + 0.8); });
  def('sheep.hurt', function (t, out) { SFX['sheep.ambient'](t, out); });
  def('sheep.death', function (t, out) { formant(t, out, 240, 120, 0.8, 0.7, 1000, 1.5); });
  def('chicken.ambient', function (t, out) { for (var i = 0; i < 3; i++) { formant(t + i * 0.13, out, 900 + i * 60, 600, 0.08, 0.5, 1800, 4); } });
  def('chicken.hurt', function (t, out) { formant(t, out, 1200, 700, 0.15, 0.6, 2000, 4); formant(t + 0.16, out, 1100, 650, 0.12, 0.5, 2000, 4); });
  def('chicken.death', function (t, out) { formant(t, out, 1000, 300, 0.5, 0.6, 1600, 3); });
  def('chicken.egg', function (t, out) { SFX['random.pop'](t, out, 0.9); });
  def('bow.shoot', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.002, 0.4, 0.2, 0.001); tone(t, 0.2, 'sine', 400, g, 150); noise(t, 0.08, 'highpass', 2000, 0.5, g); });
  def('arrow.hit', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.002, 0.4, 0.08, 0.001); tone(t, 0.08, 'triangle', 300, g, 100); });
  def('chest.open', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.02, 0.35, 0.4, 0.001); var o = tone(t, 0.45, 'sawtooth', 120, g, 260); var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; });
  def('door', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.005, 0.4, 0.15, 0.001); tone(t, 0.15, 'triangle', 220, g, 140); noise(t, 0.1, 'lowpass', 800, 0.8, g); });
  def('lava.pop', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.005, 0.3, 0.12, 0.001); tone(t, 0.12, 'sine', 300, g, 90); });
  def('fire.ambient', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.1, 0.12, 0.8, 0.001); noise(t, 0.9, 'bandpass', 3000, 0.4, g); });
  def('ambient.cave', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.6, 0.3, 2.5, 0.001); tone(t, 3, 'sine', 90, g, 60); tone(t, 3, 'sine', 135, g, 100); });
  def('rain', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.2, 0.25, 1, 0.001); noise(t, 1.2, 'highpass', 1500, 0.3, g); });
  def('thunder', function (t, out) { var g = ctx.createGain(); g.connect(out); env(g, t, 0.05, 0.9, 1.5, 0.001, 1); var n = noise(t, 2.5, 'lowpass', 500, 0.8, g); n.filter.frequency.exponentialRampToValueAtTime(80, t + 2); });
  def('sign', function (t, out) { SFX['dig.wood'](t, out); });

  function play(name, opts) {
    if (!ctx) { if (!init()) return; }
    resume();
    opts = opts || {};
    var bus = opts.bus || soundBus(name);
    if (playPacked(name, opts, bus)) return;
    var fn = SFX[name]; if (!fn) return;
    var out = output(bus, opts.pos, opts.volume === undefined ? 1 : opts.volume);
    if (out.gain.value <= 0.0001) return;
    var t = now() + (opts.delay || 0);
    try { fn(t, out, opts.pitch || 1); } catch (e) { }
  }

  // ---------------- Music ----------------
  var music = { playing: false, nextAt: 0, timer: null, mode: 'none', notesTimer: null, padNodes: [] };
  var SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];  // pentatonic
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function pianoNote(t, n, vel, dur) {
    var f = midi(n); var g = ctx.createGain(); g.connect(buses.music); g.connect(reverb);
    env(g, t, 0.008, vel, dur, 0.001);
    var o1 = tone(t, dur + 0.1, 'sine', f, g); var o2 = tone(t, dur + 0.1, 'triangle', f * 2, g); o2.detune.value = 3;
    var g2 = ctx.createGain(); g2.gain.value = 0.25; g2.connect(g); var o3 = tone(t, dur * 0.5, 'sine', f * 3, g2);
  }
  function padChord(t, root, dur) {
    var g = ctx.createGain(); var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; g.connect(f); f.connect(buses.music); f.connect(reverb);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + 2.5); g.gain.setValueAtTime(0.045, t + dur - 2.5); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    [0, 7, 12, 16].forEach(function (iv) { var o = tone(t, dur, 'triangle', midi(root + iv - 12), g); o.detune.value = rnd(-6, 6); var o2 = tone(t, dur, 'sine', midi(root + iv - 12), g); o2.detune.value = rnd(-6, 6); });
  }
  function composePiece(t0, length, calm) {
    var root = [60, 62, 65, 67][Math.floor(Math.random() * 4)]; // C D F G
    var beat = calm ? 0.62 : 0.5; var t = t0; var bar = 0;
    var prog = [0, -3, -5, -7, 0, 2, -3, -5];
    while (t < t0 + length) {
      var chordRoot = root + prog[bar % prog.length];
      padChord(t, chordRoot, beat * 8 + 1);
      var n = 8, lastIdx = 4;
      for (var i = 0; i < n; i++) {
        var bt = t + i * beat;
        if (Math.random() < (calm ? 0.42 : 0.3)) continue; // rests
        var step = Math.floor(rnd(-2, 3)); lastIdx = MC.clamp(lastIdx + step, 0, SCALE.length - 1);
        var note = chordRoot + SCALE[lastIdx] + 12;
        pianoNote(bt + rnd(-0.01, 0.01), note, rnd(0.08, 0.16), rnd(1.4, 2.6));
        if (Math.random() < 0.18) pianoNote(bt + beat * 0.5, note - 12 + (Math.random() < 0.5 ? 7 : 4), 0.07, 2);
      }
      if (bar % 2 === 1 && Math.random() < 0.7) pianoNote(t, chordRoot - 12, 0.1, 3);
      t += beat * 8; bar++;
    }
    return t - t0;
  }
  function setMusicMode(mode) {
    if (!ctx) init(); if (!ctx) return;
    if (music.mode === mode) return;
    music.mode = mode; music.nextAt = ctx.currentTime + (mode === 'menu' ? 0.5 : rnd(8, 20));
    if (music.timer) clearInterval(music.timer);
    music.timer = setInterval(tickMusic, 1000);
  }
  function tickMusic() {
    if (!ctx || music.mode === 'none' || volumes.music <= 0) return;
    if (ctx.currentTime >= music.nextAt) {
      var len = composePiece(ctx.currentTime + 0.2, music.mode === 'menu' ? 120 : rnd(70, 110), music.mode !== 'menu');
      music.nextAt = ctx.currentTime + len + (music.mode === 'menu' ? 8 : rnd(90, 200));
    }
  }
  function stopMusic() { music.mode = 'none'; music.nextAt = Infinity; if (music.timer) { clearInterval(music.timer); music.timer = null; } }

  function setListener(x, y, z, yaw) { listener.x = x; listener.y = y; listener.z = z; listener.yaw = yaw; }

  MC.Audio = { init: init, play: play, setVolume: setVolume, volumes: volumes, setListener: setListener, setMusicMode: setMusicMode, stopMusic: stopMusic, resume: resume, SFX: SFX, get ctx() { return ctx; } };
})();
