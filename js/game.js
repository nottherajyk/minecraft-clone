// Game orchestration: renderer, states (title / loading / playing), screens, saving, hand rendering, block outline.
(function () {
  var DEFAULT_OPTIONS = { fov: 70, renderDistance: 8, sensitivity: 0.5, invertMouse: false, bobbing: true, clouds: true, fancy: true, guiScale: 0, maxFps: 260, gamma: 0.5, autoJump: false, damageTilt: 1, volumes: { master: 1, music: 1, blocks: 1, hostile: 1, friendly: 1, players: 1, ambient: 1, ui: 1 } };
  MC.Options = Object.assign({}, DEFAULT_OPTIONS, MC.Storage.get('options', {}));
  MC.Options.volumes = Object.assign({}, DEFAULT_OPTIONS.volumes, MC.Options.volumes || {});
  MC.saveOptions = function () { MC.Storage.set('options', MC.Options); };

  function Game() {
    this.state = 'boot'; this.screen = null; this.time = 0; this.last = performance.now(); this.frameAcc = 0;
    this.stats = { chunksRendered: 0 }; this.rendererName = 'WebGL2'; this.difficulty = 'normal'; this.worldInfo = null;
    this.edits = {}; this.editsByChunk = {}; this.containers = {}; this.furnaces = {}; this.saplings = []; this.autosaveT = 0; this.arrows = [];
    this.perspective = 0; // 0 = first person, 1 = third behind, 2 = third front
  }
  Game.prototype.init = function () {
    var self = this;
    this.canvas = document.getElementById('game'); this.guiCanvas = document.getElementById('gui'); this.crosshair = document.getElementById('crosshair');
    try { this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }); }
    catch (e) { document.body.innerHTML = '<div style="color:#fff;font:16px sans-serif;padding:20px">WebGL 2 is required to run this game.</div>'; return; }
    this.renderer.autoClear = false; this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.setPixelRatio(1);
    var gl = this.renderer.getContext(); var dbg = gl.getExtension('WEBGL_debug_renderer_info'); if (dbg) this.rendererName = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)).slice(0, 40);
    MC.Tex.build(); MC.Sprites.build(); MC.ItemIcons.build();
    this.texArray = MC.Tex.makeArrayTexture();
    MC.IconRenderer.init(this.texArray);
    MC.Gui.init(this.guiCanvas); MC.Input.init(this.canvas);
    MC.Input.onUnlock = function () { if (MC.Input.touchActive) return; if (self.state === 'playing' && !self.screen && !self.chat.open) self.openScreen(new MC.Screens.PauseScreen(self)); };
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 1000);
    this.handCamera = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
    this.chat = new MC.Chat(this);
    window.addEventListener('resize', function () { self.resize(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && self.state === 'playing') self.saveWorld(); });
    window.addEventListener('beforeunload', function () { if (self.state === 'playing') self.saveWorld(); });
    document.addEventListener('mousedown', function () { MC.Audio.init(); MC.Audio.resume(); if (self.state === 'title' && !self.musicStarted) { self.musicStarted = true; MC.Audio.setMusicMode('menu'); } }, { once: false });
    document.addEventListener('touchstart', function () { MC.Audio.init(); MC.Audio.resume(); if (self.state === 'title' && !self.musicStarted) { self.musicStarted = true; MC.Audio.setMusicMode('menu'); } }, { once: false });
    this.resize();
    this.buildHandScene();
    this.setupPanorama();
    this.openScreen(new MC.Screens.TitleScreen(this)); this.state = 'title';
    this.applyOptions();
    if (MC.query.autoplay) { var info = this.createWorld({ name: 'Test World', seed: MC.query.seed || '12345', gameMode: MC.query.mode || 'survival', cheats: true, difficulty: 'normal' }); this.startWorld(info); }
    requestAnimationFrame(function (t) { self.frame(t); });
    MC.debug = { game: this, tp: function (x, y, z) { self.player.pos.set(x, y, z); self.player.prevPos.copy(self.player.pos); }, time: function (t) { self.sky.time = t; }, look: function (yaw, pitch) { self.player.yaw = yaw; self.player.pitch = pitch; }, lock: function () { MC.Input.mouse.locked = true; }, screen: function () { return self.screen ? self.screen.constructor.name : null; }, state: function () { return self.state; }, give: function (id, n) { self.player.inventory.add(id, n || 1, 0); }, mode: function (m) { self.player.setGameMode(m); }, open: function (name) { self.openScreen(new (MC.Inventory.Screens[name] || MC.Screens[name])(self)); }, spawn: function (t, dx, dz) { var d = self.player.getLookDir(); var p = self.player.pos.clone().add(new THREE.Vector3(d.x * 5 + (dx || 0), 0, d.z * 5 + (dz || 0))); p.y = self.world.getTopSolid(Math.floor(p.x), Math.floor(p.z)) + 1; return !!self.spawnMob(t, p); }, ready: function () { return self.state === 'playing'; } };
  };
  Game.prototype.resize = function () {
    var w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.handCamera.aspect = w / h; this.handCamera.updateProjectionMatrix();
    MC.Gui.forcedScale = MC.Options.guiScale || 0; MC.Gui.resize(w, h);
    if (this.screen) this.screen.layout();
    this.updateCrosshair();
    if (this.pano) { this.pano.camera.aspect = w / h; this.pano.camera.updateProjectionMatrix(); }
  };
  Game.prototype.updateCrosshair = function () {
    var S = MC.Gui.S; var c = this.crosshair; c.width = 15 * S; c.height = 15 * S; var x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(MC.Sprites.s.crosshair, 0, 0, 15 * S, 15 * S);
    c.style.width = (15 * S) + 'px'; c.style.height = (15 * S) + 'px';
  };
  Game.prototype.applyOptions = function () {
    var O = MC.Options;
    Object.keys(O.volumes).forEach(function (k) { MC.Audio.setVolume(k, O.volumes[k]); });
    if (this.world && this.world.renderDistance !== O.renderDistance) this.world.setRenderDistance(O.renderDistance);
    if (this.world) this.world.materials.uniforms.uGamma.value = O.gamma;
    if (this.sky) this.sky.cloudsEnabled = O.clouds;
    if (this.player) this.player.autoJump = O.autoJump;
    if (MC.Gui.forcedScale !== (O.guiScale || 0)) this.resize();
    this.camera.far = Math.max(300, O.renderDistance * 16 * 2 + 200); this.camera.updateProjectionMatrix();
  };
  Game.prototype.toggleFullscreen = function () { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(function () { }); };
  Game.prototype.quit = function () { this.saveWorld(); window.close(); this.openScreen(new MC.Screens.ConfirmScreen(this, this.screen, 'Quit Game', 'Close this browser tab to quit. (Browsers do not allow pages to close themselves.)', 'OK', function () { })); };

  // ---------------- screens ----------------
  Game.prototype.openScreen = function (s) {
    if (this.screen && this.screen !== s) this.screen.onClose();
    this.screen = s; if (s) { s.onOpen(); if (!MC.Input.touchActive) MC.Input.unlock(); this.crosshair.style.display = 'none'; }
    if (MC.TouchControls) MC.TouchControls.update();
  };
  Game.prototype.closeScreen = function () {
    if (this.screen) this.screen.onClose(); this.screen = null;
    if (this.state === 'playing') { MC.Input.lock(); this.crosshair.style.display = MC.Input.touchActive ? 'none' : (MC.Hud.hidden ? 'none' : 'block'); }
    if (MC.TouchControls) MC.TouchControls.update();
  };
  Game.prototype.drawScreenBackground = function () { if (this.state === 'playing') MC.Gui.drawDim(); else MC.Gui.drawBackground(); };
  Game.prototype.onChatClosed = function () { if (this.state === 'playing' && !this.screen) { MC.Input.lock(); this.player.controlsEnabled = true; } if (MC.TouchControls) MC.TouchControls.blurKb(); };

  // ---------------- panorama (title background) ----------------
  Game.prototype.setupPanorama = function () {
    var scene = new THREE.Scene();
    // Home screen: a bright forest sunrise instead of the old cherry-grove dusk.
    var world = new MC.World(scene, { seed: 9081726, renderDistance: 5 }); world.init(this.texArray); world.forceBiome = 'forest';
    world.worker.postMessage({ type: 'init', seed: 9081726, texIndex: MC.Tex.indexMap(), frames: MC.Tex.FRAMES, forceBiome: 'forest' });
    var sky = new MC.Sky(scene, world.materials.uniforms); sky.time = 4400;
    var camera = new THREE.PerspectiveCamera(85, window.innerWidth / window.innerHeight, 0.05, 1000);
    this.pano = { scene: scene, world: world, sky: sky, camera: camera, angle: 0, ready: false, particles: null };
    world.setCenter(0, 0);
  };
  Game.prototype.disposePanorama = function () { if (!this.pano) return; this.pano.world.dispose(); this.pano = null; };
  Game.prototype.renderPanorama = function (dt) {
    var p = this.pano; if (!p) return;
    p.angle += dt * (Math.PI * 2 / 150);
    if (p.camY === undefined || (!p.ready && p.world.readyFraction(1) >= 1)) { var mh = 0; for (var dx = -6; dx <= 6; dx++) for (var dz = -6; dz <= 6; dz++) mh = Math.max(mh, p.world.getTopSolid(dx, dz)); p.camY = Math.max(mh, 66) + 7; }
    var camY = p.camY;
    p.camera.position.set(0.5, camY, 0.5); p.camera.rotation.order = 'YXZ'; p.camera.rotation.y = -p.angle; p.camera.rotation.x = -0.12;
    p.world.updateUniforms(this.time, p.camera.position); p.world.materials.uniforms.uFogNear.value = 60; p.world.materials.uniforms.uFogFar.value = 90;
    p.sky.update(dt, p.camera.position, MC.BIOME.forest, false, p.camera.far);
    p.world.materials.uniforms.uGamma.value = 0.5;
    this.renderer.setClearColor(p.sky.fogColor); this.renderer.clear(true, true, false);
    this.renderer.render(p.scene, p.camera);
    if (!p.ready && p.world.readyFraction(2) >= 1) p.ready = true;
  };

  // ---------------- worlds (storage) ----------------
  Game.prototype.listWorlds = function () { var keys = MC.Storage.keys('worldinfo:'); var out = []; for (var i = 0; i < keys.length; i++) { var w = MC.Storage.get(keys[i]); if (w) out.push(w); } out.sort(function (a, b) { return (b.lastPlayed || b.created) - (a.lastPlayed || a.created); }); return out; };
  Game.prototype.createWorld = function (o) {
    var id = o.name.replace(/[^a-zA-Z0-9_ -]/g, '').trim() || 'World'; var base = id, n = 1; var existing = this.listWorlds().map(function (w) { return w.id; });
    while (existing.indexOf(id) >= 0) id = base + ' (' + (++n) + ')';
    var seedStr = MC.formatSeed(o.seed);
    var info = { id: id, name: o.name, seed: seedStr, seedInt: MC.seedToInt(seedStr), gameMode: o.gameMode || 'survival', allowModeSwitch: !!o.allowModeSwitch || o.gameMode === 'creative', hardcore: !!o.hardcore, difficulty: o.difficulty || 'normal', cheats: !!o.cheats, created: Date.now(), lastPlayed: Date.now(), time: 1000, version: MC.VERSION };
    MC.Storage.set('worldinfo:' + id, info); return info;
  };
  Game.prototype.saveWorldInfo = function (info) { MC.Storage.set('worldinfo:' + info.id, info); };
  Game.prototype.deleteWorld = function (id) { MC.Storage.del('worldinfo:' + id); MC.Storage.del('worlddata:' + id); };
  Game.prototype.saveWorld = function () {
    if (this.state !== 'playing' || !this.worldInfo) return;
    var info = this.worldInfo; info.lastPlayed = Date.now(); info.time = this.sky.time; info.gameMode = this.player.gameMode;
    this.saveWorldInfo(info);
    var data = { edits: this.edits, player: this.player.serialize(), mobs: MC.Mobs.serialize(), containers: this.containers, furnaces: this.furnaces, saplings: this.saplings, time: this.sky.time, difficulty: this.difficulty };
    try { MC.Storage.set('worlddata:' + info.id, data); } catch (e) { this.chat.add('§cFailed to save world (storage full?)'); }
  };
  Game.prototype.saveAndQuit = function () { this.saveWorld(); this.toTitle(); };
  Game.prototype.toTitle = function () {
    MC.Input.unlock(); this.crosshair.style.display = 'none';
    if (this.world) { this.world.dispose(); this.world = null; }
    if (this.scene) { this.scene.clear(); }
    MC.Mobs.clear(); if (this.entities) this.entities.clear(); if (this.particles) this.particles.clear();
    this.player = null; this.state = 'title'; this.chat.messages = []; this.chat.open = false; MC.Input.setTextTarget(null);
    if (!this.pano) this.setupPanorama();
    MC.Audio.setMusicMode('menu');
    this.openScreen(new MC.Screens.TitleScreen(this));
  };

  // ---------------- start / load world ----------------
  Game.prototype.startWorld = function (info) {
    var self = this; this.worldInfo = info; this.difficulty = info.difficulty || 'normal';
    this.openScreen(null); this.state = 'loading'; this.loadT = 0; this.loadStage = 'Building terrain';
    this.disposePanorama();
    this.scene = new THREE.Scene();
    this.world = new MC.World(this.scene, { seed: info.seedInt, renderDistance: MC.Options.renderDistance }); this.world.init(this.texArray);
    this.world.materials.uniforms.uGamma.value = MC.Options.gamma;
    this.sky = new MC.Sky(this.scene, this.world.materials.uniforms); this.sky.time = info.time || 1000; this.sky.cloudsEnabled = MC.Options.clouds;
    this.entities = new MC.Entities(this.world, this.scene, this.world.materials); this.entities.game = this;
    this.particles = new MC.ParticlesClass(this.scene, this.texArray, this.world.materials.uniforms); MC.Particles = this.particles;
    MC.Mobs.init(this.world, this.scene, this.entities, this.world.materials.uniforms, this.sky, this);
    this.player = new MC.Player(this.world, this); this.player.setGameMode(info.gameMode); this.player.autoJump = MC.Options.autoJump;
    this.playerModel = MC.PlayerModel.get().root.clone(true); this.playerModel.visible = false;
    this.playerModelParts = { head: this.playerModel.children[0], armR: this.playerModel.children[2], armL: this.playerModel.children[3], legR: this.playerModel.children[4], legL: this.playerModel.children[5] };
    this.scene.add(this.playerModel);
    MC.Mobs.setPlayer(this.player);
    this.edits = {}; this.editsByChunk = {}; this.containers = {}; this.furnaces = {}; this.saplings = []; this.arrows = []; this.villageSpawned = {};
    var data = MC.Storage.get('worlddata:' + info.id, null); this.saveData = data;
    if (data) {
      this.edits = data.edits || {}; this.containers = data.containers || {}; this.furnaces = data.furnaces || {}; this.saplings = data.saplings || [];
      // Remove transient flowing-water edits written by the retired fluid experiment.
      // Deleting the edits (rather than replacing them with air) lets the original
      // terrain regenerate exactly as it was before the flood.
      var waterId = MC.BLOCK.water.id;
      for (var editKey in this.edits) if (this.edits[editKey][0] === waterId && this.edits[editKey][1] > 0) delete this.edits[editKey];
      if (data.time) this.sky.time = data.time; if (data.difficulty) this.difficulty = data.difficulty; this.indexEdits();
    }
    this.world.events.on('chunk', function (c) { self.onChunk(c); });
    this.world.events.on('blockChanged', function (e) { self.onBlockChanged(e); });
    var start = data && data.player ? new THREE.Vector3(data.player.pos[0], data.player.pos[1], data.player.pos[2]) : new THREE.Vector3(0.5, 70, 0.5);
    this.player.pos.copy(start); this.player.prevPos.copy(start);
    this.world.setCenter(Math.floor(start.x) >> 4, Math.floor(start.z) >> 4);
    this.buildSelection();
    MC.Audio.stopMusic();
    this.chat.messages = [];
  };
  Game.prototype.indexEdits = function () { this.editsByChunk = {}; for (var k in this.edits) { var p = k.split(','); var x = +p[0], y = +p[1], z = +p[2]; var ck = (x >> 4) + ',' + (z >> 4); (this.editsByChunk[ck] = this.editsByChunk[ck] || []).push(x, y, z, this.edits[k][0], this.edits[k][1]); } };
  Game.prototype.onChunk = function (c) {
    var list = this.editsByChunk[c.cx + ',' + c.cz];
    if (list) {
      var send = [];
      for (var i = 0; i < list.length; i += 5) { var x = list[i], y = list[i + 1], z = list[i + 2]; var idx = (((x & 15) << 4 | (z & 15)) << 7) | y; c.blocks[idx] = list[i + 3]; c.meta[idx] = list[i + 4]; send.push(x, y, z, list[i + 3], list[i + 4]); }
      this.world.worker.postMessage({ type: 'setBlocks', list: send });
    }
    this.spawnVillageResidents(c);
  };
  Game.prototype.spawnVillageResidents = function (c) {
    var key = c.cx + ',' + c.cz;
    if (!c.villageSpawns || this.villageSpawned[key]) return;
    this.villageSpawned[key] = true;
    for (var i = 0; i < c.villageSpawns.length; i++) {
      var s = c.villageSpawns[i], villager = this.spawnMob('villager', new THREE.Vector3(s.x, s.y, s.z));
      if (villager) villager.villageHome = new THREE.Vector3(c.cx * 16 + 8.5, s.y, c.cz * 16 + 10.5);
    }
  };
  Game.prototype.finishLoading = function () {
    var self = this; var data = this.saveData;
    if (data && data.player) { this.player.load(data.player); MC.Mobs.load(data.mobs); }
    else { var sp = this.world.findSpawn(); this.player.pos.copy(sp); this.player.prevPos.copy(sp); this.player.spawn.copy(sp); MC.Mobs.seedSalt = this.worldInfo.seedInt; MC.Mobs.initialSpawn(sp, 10); }
    this.state = 'playing'; this.closeScreen();
    MC.Audio.setMusicMode('game');
    if (!data) {
      if (MC.Input.touchActive) this.chat.add('§7Welcome! Use the on-screen controls to play.');
      else this.chat.add('§7Welcome to ' + this.worldInfo.name + '! Press §fE§7 for inventory, §fT§7 to chat, §f/help§7 for commands.');
    }
    this.player.controlsEnabled = true;
    setTimeout(function () { if (self.state === 'playing' && !self.screen) MC.Input.lock(); }, 50);
    if (MC.TouchControls) MC.TouchControls.update();
  };

  // ---------------- world events ----------------
  Game.prototype.recordEdit = function (x, y, z, id, meta) { var k = x + ',' + y + ',' + z; this.edits[k] = [id, meta || 0]; var ck = (x >> 4) + ',' + (z >> 4); var arr = this.editsByChunk[ck] || (this.editsByChunk[ck] = []); arr.push(x, y, z, id, meta || 0); };
  Game.prototype.onBlockChanged = function (e) {
    this.recordEdit(e.x, e.y, e.z, e.id, this.world.getMeta(e.x, e.y, e.z));
    // gravity blocks above
    var above = this.world.getBlock(e.x, e.y + 1, e.z);
    if (above > 0 && MC.BLOCKS[above].gravity && (e.id === 0 || !MC.BLOCKS[e.id].solid)) this.scheduleFall(e.x, e.y + 1, e.z);
    if (e.id > 0 && MC.BLOCKS[e.id].gravity) { var below = this.world.getBlock(e.x, e.y - 1, e.z); if (below === 0 || (below > 0 && !MC.BLOCKS[below].solid)) this.scheduleFall(e.x, e.y, e.z); }
    // plants lose support
    if (e.id === 0 || !MC.BLOCKS[e.id].solid) { if (above > 0 && (MC.BLOCKS[above].model === 'cross' || MC.BLOCKS[above].model === 'torch' && this.world.getMeta(e.x, e.y + 1, e.z) === 0 || MC.BLOCKS[above].model === 'layer' || MC.BLOCKS[above].model === 'petals')) { var B = MC.BLOCKS[above]; this.world.setBlock(e.x, e.y + 1, e.z, 0, 0); if (B.drops && !this.player.isCreative()) { var d = this.dropsFor(above, null, true); for (var i = 0; i < d.length; i++) this.spawnDrop(d[i], new THREE.Vector3(e.x + 0.5, e.y + 1.3, e.z + 0.5)); } MC.Particles.blockBreak(e.x, e.y + 1, e.z, above, 8); } }
    // wall torches attached to this block
    if (e.id === 0) { var dirs = [[1, 0, 0, 1], [-1, 0, 0, 2], [0, 0, 1, 3], [0, 0, -1, 4]]; for (i = 0; i < 4; i++) { var tx = e.x + dirs[i][0], tz = e.z + dirs[i][2]; var t = this.world.getBlock(tx, e.y, tz); if (t === MC.BLOCK.torch.id && this.world.getMeta(tx, e.y, tz) === dirs[i][3]) { this.world.setBlock(tx, e.y, tz, 0, 0); if (!this.player.isCreative()) this.spawnDrop({ id: 'torch', count: 1, damage: 0 }, new THREE.Vector3(tx + 0.5, e.y + 0.3, tz + 0.5)); } } }
    // containers destroyed
    var key = e.x + ',' + e.y + ',' + e.z;
    if (e.old === MC.BLOCK.chest.id && e.id !== e.old && this.containers[key]) { var st = this.containers[key]; for (i = 0; i < st.slots.length; i++) if (st.slots[i]) this.spawnDrop(st.slots[i], new THREE.Vector3(e.x + 0.5, e.y + 0.5, e.z + 0.5)); delete this.containers[key]; }
    if (e.old === MC.BLOCK.furnace.id && e.id !== e.old && this.furnaces[key]) { var fs = this.furnaces[key]; for (i = 0; i < 3; i++) if (fs.slots[i]) this.spawnDrop(fs.slots[i], new THREE.Vector3(e.x + 0.5, e.y + 0.5, e.z + 0.5)); delete this.furnaces[key]; }
  };
  Game.prototype.scheduleFall = function (x, y, z) { var self = this; setTimeout(function () { if (self.state !== 'playing') return; var id = self.world.getBlock(x, y, z); if (id <= 0 || !MC.BLOCKS[id].gravity) return; var below = self.world.getBlock(x, y - 1, z); if (below > 0 && MC.BLOCKS[below].solid) return; var meta = self.world.getMeta(x, y, z); self.world.setBlock(x, y, z, 0, 0); self.entities.add(new MC.FallingBlock(self.entities, id, meta, x, y, z)); }, 100); };
  Game.prototype.onBlockBroken = function (x, y, z, id, meta) { };
  Game.prototype.onBlockPlaced = function (x, y, z, id) { var B = MC.BLOCKS[id]; if ((/_sapling$/).test(B.name)) this.saplings.push({ x: x, y: y, z: z, t: this.time + 45 + Math.random() * 60, type: B.name.replace('_sapling', '') }); };
  Game.prototype.boneMeal = function (hit) { var w = this.world; for (var i = 0; i < 12; i++) { var x = hit.x + Math.floor(Math.random() * 7) - 3, z = hit.z + Math.floor(Math.random() * 7) - 3, y = w.getTopSolid(x, z) + 1; if (w.getBlock(x, y - 1, z) === MC.BLOCK.grass_block.id && w.getBlock(x, y, z) === 0) w.setBlock(x, y, z, Math.random() < 0.85 ? MC.BLOCK.short_grass.id : (Math.random() < 0.5 ? MC.BLOCK.dandelion.id : MC.BLOCK.poppy.id), 0); } for (i = 0; i < 10; i++) MC.Particles.heart(hit.x + Math.random(), hit.y + 1.2, hit.z + Math.random()); MC.Audio.play('dig.grass', { pos: hit.point, volume: 0.5 }); };
  Game.prototype.dropsFor = function (id, held, canHarvest) {
    var B = MC.BLOCKS[id]; if (!B || B.drops === null) return [];
    if (canHarvest === false) return [];
    var tool = held && MC.ITEMS[held.id] && MC.ITEMS[held.id].tool ? MC.ITEMS[held.id].tool : null;
    if (B.name === 'glass' || B.name === 'ice' || (/stained_glass/).test(B.name) || B.name === 'glowstone' && tool && tool.type === 'shears') { if (tool && tool.type === 'shears') return [{ id: B.name, count: 1, damage: 0 }]; }
    if ((/leaves/).test(B.name) && tool && (tool.type === 'shears' || tool.type === 'hoe')) return [{ id: B.name, count: 1, damage: 0 }];
    if (B.name === 'short_grass' || B.name === 'fern' || B.name === 'cobweb' || B.name === 'seagrass') { if (tool && tool.type === 'shears') return [{ id: B.name === 'cobweb' ? 'cobweb' : B.name, count: 1, damage: 0 }]; }
    if (typeof B.drops === 'string') return MC.ITEMS[B.drops] ? [{ id: B.drops, count: 1, damage: 0 }] : [];
    var out = [];
    for (var i = 0; i < B.drops.length; i++) { var d = B.drops[i]; if (Math.random() < d.chance) { var n = d.min + Math.floor(Math.random() * (d.max - d.min + 1)); if (n > 0 && MC.ITEMS[d.item]) out.push({ id: d.item, count: n, damage: 0 }); if (d.exclusive || B.drops.length && i === 0 && d.chance < 1 && d.item === 'flint') break; } }
    return out;
  };
  Game.prototype.spawnDrop = function (stack, pos, vel) { if (!stack || !MC.ITEMS[stack.id]) return; this.entities.add(new MC.ItemDrop(this.entities, { id: stack.id, count: stack.count, damage: stack.damage || 0 }, pos, vel)); };
  Game.prototype.dropItem = function (stack) { if (!stack) return; var p = this.player; var d = p.getLookDir(); var pos = p.getEyePos(1).add(d.clone().multiplyScalar(0.3)); pos.y -= 0.3; var vel = d.clone().multiplyScalar(6); vel.y += 1; vel.x += (Math.random() - 0.5); vel.z += (Math.random() - 0.5); this.entities.add(new MC.ItemDrop(this.entities, stack, pos, vel)).pickupDelay = 2; };
  Game.prototype.spawnXP = function (pos, n) { while (n > 0) { var v = Math.min(n, n > 10 ? 7 : 3); this.entities.add(new MC.XPOrb(this.entities, pos, v)); n -= v; } };
  Game.prototype.spawnMob = function (type, pos) { return MC.Mobs.spawn(type, pos); };
  Game.prototype.primeTNT = function (x, y, z) { this.entities.add(new MC.PrimedTNT(this.entities, x, y, z, 4)); };
  Game.prototype.shootArrow = function (mob, player) {
    var from = mob.pos.clone().add(new THREE.Vector3(0, mob.height * 0.85, 0)); var to = player.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
    var d = to.clone().sub(from); var dist = d.length(); d.normalize();
    var speed = 22; var vel = d.multiplyScalar(speed); vel.y += dist * 0.5 + (Math.random() - 0.5) * 2; vel.x += (Math.random() - 0.5) * 2; vel.z += (Math.random() - 0.5) * 2;
    var arrow = new Arrow(this.entities, from, vel); this.entities.add(arrow);
    MC.Audio.play('bow.shoot', { pos: from });
  };
  Game.prototype.onPlayerDeath = function (source) {
    var inv = this.player.inventory;
    if (!this.player.isCreative()) for (var i = 0; i < inv.slots.length; i++) { if (inv.slots[i]) { this.spawnDrop(inv.slots[i], this.player.pos.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3((Math.random() - 0.5) * 4, 3, (Math.random() - 0.5) * 4)); inv.slots[i] = null; } }
    this.openScreen(new MC.Screens.DeathScreen(this, this.worldInfo.hardcore));
  };
  Game.prototype.respawn = function () { this.player.respawn(); if (this.worldInfo.hardcore) { this.player.setGameMode('creative'); this.player.flying = true; } this.closeScreen(); MC.Mobs.list.forEach(function (m) { if (m.T.hostile && m.pos.distanceTo(MC.game.player.pos) < 24) m.dead = true; }); };
  Game.prototype.openCrafting = function () { this.openScreen(new MC.Inventory.Screens.CraftingScreen(this)); };
  Game.prototype.openFurnace = function (hit) { var k = hit.x + ',' + hit.y + ',' + hit.z; var st = this.furnaces[k] || (this.furnaces[k] = { slots: [null, null, null], progress: 0, burn: 0, burnMax: 0 }); this.openScreen(new MC.Inventory.Screens.FurnaceScreen(this, st)); };
  Game.prototype.openChest = function (hit) { var k = hit.x + ',' + hit.y + ',' + hit.z; var st = this.containers[k] || (this.containers[k] = { slots: new Array(27).fill(null) }); this.openScreen(new MC.Inventory.Screens.ChestScreen(this, st)); };
  Game.prototype.onExplosion = function (center, power) { this.shake = 0.6; };

  // ---------------- Arrow projectile ----------------
  function Arrow(ents, pos, vel) {
    this.pos = pos.clone(); this.vel = vel.clone(); this.width = 0.3; this.height = 0.3; this.age = 0; this.dead = false; this.stuck = false; this.onGround = false;
    var geo = new THREE.BoxGeometry(0.05, 0.05, 0.6); var mat = new THREE.MeshBasicMaterial({ color: 0x8a6a3a, fog: false }); this.mesh = new THREE.Mesh(geo, mat);
    var tip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.12), new THREE.MeshBasicMaterial({ color: 0xcfcfcf, fog: false })); tip.position.z = -0.3; this.mesh.add(tip);
    var fl = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.15), new THREE.MeshBasicMaterial({ color: 0xeeeeee, fog: false })); fl.position.z = 0.25; this.mesh.add(fl);
  }
  Arrow.prototype.update = function (dt, player, ents) {
    this.age += dt; if (this.age > 20) { this.dead = true; return; }
    if (this.stuck) return;
    this.vel.y -= 20 * dt; var next = this.pos.clone().addScaledVector(this.vel, dt);
    var id = ents.world.getBlock(Math.floor(next.x), Math.floor(next.y), Math.floor(next.z));
    if (id > 0 && MC.BLOCKS[id].solid) { this.stuck = true; MC.Audio.play('arrow.hit', { pos: this.pos }); return; }
    this.pos.copy(next);
    if (player && !player.dead && Math.abs(player.pos.x - this.pos.x) < 0.5 && Math.abs(player.pos.z - this.pos.z) < 0.5 && this.pos.y > player.pos.y && this.pos.y < player.pos.y + 1.9) { player.hurt(2 + Math.floor(Math.random() * 2), 'arrow', this.pos, 0.3); this.dead = true; if (MC.game) MC.game.lastAttacker = 'Skeleton'; return; }
    this.mesh.position.copy(this.pos); this.mesh.lookAt(this.pos.clone().add(this.vel)); this.mesh.rotateY(Math.PI);
  };

  // ---------------- selection box + break overlay + hand ----------------
  Game.prototype.buildSelection = function () {
    var geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.selection = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })); this.selection.visible = false; this.selection.renderOrder = 4; this.scene.add(this.selection);
    // break overlay: cube with destroy_stage layer, updated per stage
    var stage0 = MC.Tex.layer('destroy_stage_0');
    this.breakGeos = [];
    for (var s = 0; s < 10; s++) { var g = MC.BlockMesh.geometry(MC.BLOCK.stone.id, 0, 15).clone(); var d = g.attributes.aData; for (var i = 0; i < d.count; i++) { d.setX(i, stage0 + s); d.setY(i, 0); } d.needsUpdate = true; var col = g.attributes.aColor; for (i = 0; i < col.count; i++) col.setW(i, 1); col.needsUpdate = true; this.breakGeos.push(g); }
    var mat = this.world.materials.cutout.clone(); mat.transparent = true; mat.depthWrite = false; mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -2; mat.uniforms = this.world.materials.cutout.uniforms; mat.uniforms.uAlphaTest = { value: 0.1 };
    this.breakMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: this.world.materials.cutout.vertexShader, fragmentShader: this.world.materials.cutout.fragmentShader, uniforms: Object.assign({}, this.world.materials.uniforms, { uAlphaTest: { value: 0.05 }, uOpacity: { value: 1 } }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.DoubleSide });
    this.breakMesh = new THREE.Mesh(this.breakGeos[0], this.breakMat); this.breakMesh.visible = false; this.breakMesh.renderOrder = 3; this.breakMesh.scale.setScalar(1.002); this.scene.add(this.breakMesh);
  };
  Game.prototype.buildHandScene = function () {
    this.handScene = new THREE.Scene();
    this.handGroup = new THREE.Group(); this.handScene.add(this.handGroup);
    var skinTex = new THREE.CanvasTexture(MC.Sprites.s.skin); skinTex.magFilter = THREE.NearestFilter; skinTex.minFilter = THREE.NearestFilter; skinTex.colorSpace = THREE.SRGBColorSpace;
    this.handShared = { uCamPos: { value: new THREE.Vector3() }, uFogColor: { value: new THREE.Vector3() }, uFogNear: { value: 1e5 }, uFogFar: { value: 2e5 } };
    this.armMat = MC.Shaders.createEntityMaterial(skinTex, this.handShared);
    var armGeo = MC.MobModel.makePart({ size: [4, 12, 4], uv: [40, 16] }, { width: 64, height: 64 });
    this.armMesh = new THREE.Mesh(armGeo, this.armMat); this.armGroup = new THREE.Group(); this.armGroup.add(this.armMesh); this.handGroup.add(this.armGroup);
    this.heldGroup = new THREE.Group(); this.handGroup.add(this.heldGroup); this.heldId = null; this.heldMesh = null;
    this.handMats = null;
  };
  Game.prototype.updateHand = function (dt, alpha) {
    var p = this.player; if (!p) return;
    var held = p.held(); var hid = held ? held.id : null;
    if (!this.handMats && this.world) { this.handMats = MC.Shaders.createChunkMaterials(this.texArray); this.handMats.uniforms.uFogNear.value = 1e5; this.handMats.uniforms.uFogFar.value = 2e5; }
    if (hid !== this.heldId) {
      this.heldId = hid; if (this.heldMesh) { this.heldGroup.remove(this.heldMesh); this.heldMesh = null; }
      if (hid) { this.heldMesh = MC.ItemMesh.stackMesh(hid, this.handMats); this.heldGroup.add(this.heldMesh); }
    }
    var isBlock = hid && MC.ITEMS[hid].block >= 0 && !MC.BLOCKS[MC.ITEMS[hid].block].flat;
    this.armGroup.visible = !hid; this.heldGroup.visible = !!hid;
    var sw = p.swinging ? p.swing : 0; var f = Math.sin(Math.sqrt(sw) * Math.PI), f1 = Math.sin(sw * Math.PI);
    // Food is brought toward the camera in short, rhythmic bites during the
    // existing 1.6-second eating action.
    var isEating = hid && MC.ITEMS[hid].food && p.eating > 0;
    var eatProgress = isEating ? MC.clamp(p.eating / 1.6, 0, 1) : 0;
    var bite = isEating ? Math.sin(eatProgress * Math.PI * 10) * 0.035 : 0;
    var eatLift = isEating ? 0.26 + bite : 0;
    var eatIn = isEating ? 0.28 : 0;
    var eatTurn = isEating ? -0.55 + bite * 2 : 0;
    var eq = p.equip;
    // MC-like first person arm transform
    var g = this.handGroup; g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
    if (!hid) {
      // arm points from the lower-right (shoulder, near) toward the upper-left (hand, far)
      var a = this.armGroup;
      var dir = new THREE.Vector3(0.3 - f * 0.3, 0.32 - f1 * 0.45, -0.85).normalize();          // shoulder -> hand
      var near = new THREE.Vector3(0.42 - f * 0.12, -0.6 - eq * 0.6 - f1 * 0.06, -0.5);
      a.position.copy(near).addScaledVector(dir, 0.33);
      a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
      a.scale.setScalar(0.88);
      this.armMesh.position.set(0, 0, 0); this.armMesh.rotation.set(0, -0.8 + f * 0.4, 0);
    } else {
      var h = this.heldGroup;
      if (isBlock) { h.position.set(0.6 - f * 0.5, -0.56 - eq * 0.6 - f1 * 0.35, -1.05 + f1 * 0.1); h.rotation.set(0, 0, 0); h.rotation.order = 'YXZ'; h.rotation.y = 0.78 - f * 0.9; h.rotation.x = -f1 * 0.9; h.scale.setScalar(0.42); }
      else { var flat = hid && MC.ITEMS[hid].block >= 0; h.position.set(0.68 - f * 0.5 - eatIn, -0.3 - eq * 0.6 - f1 * 0.45 - (flat ? 0.12 : 0) + eatLift, -0.95 + f1 * 0.1 + eatIn * 0.45); h.rotation.set(0, 0, 0); h.rotation.order = 'YXZ'; h.rotation.y = -0.4 - f * 0.6 + eatTurn; h.rotation.x = -0.15 - f1 * 1.1 + eatLift * 1.2; h.rotation.z = -0.12 - f * 0.4 + eatTurn * 0.18; h.scale.setScalar(flat ? 0.45 : 0.62); }
    }
    // lighting for hand
    var br = this.world.brightnessAt(p.pos.x, p.pos.y + p.eyeHeight, p.pos.z, this.sky.dayLight);
    this.armMat.uniforms.uLight.value = br;
    if (this.handMats) { this.handMats.uniforms.uSkyLight.value = this.world.materials.uniforms.uSkyLight.value; this.handMats.uniforms.uSkyTint.value.copy(this.world.materials.uniforms.uSkyTint.value); this.handMats.uniforms.uTime.value = this.time; this.handMats.uniforms.uGamma.value = MC.Options.gamma; }
    if (this.heldMesh) this.heldMesh.traverse(function (o) { if (o.material && o.material.color && !o.material.map) { } });
    // dim held non-block items by light
    if (this.heldMesh && !isBlock) this.heldMesh.traverse(function (o) { if (o.material && o.material.color && o.material.isMeshBasicMaterial) { o.material.color.setScalar(Math.pow(br, 0.8)); } });
    // per-vertex light for block held: uses uSkyLight of handMats and baked light 15; scale by local light through uSkyLight override
    if (this.handMats) { var lb = this.world.getLight(Math.floor(p.pos.x), Math.floor(p.pos.y + p.eyeHeight), Math.floor(p.pos.z)); var curve = function (v) { var ff = v / 15; return ff / (4 - 3 * ff); }; var sky = curve(lb.sky) * this.sky.dayLight, blk = curve(lb.block); this.handMats.uniforms.uSkyLight.value = Math.max(sky, blk * 0.95); }
  };

  // ---------------- main loop ----------------
  Game.prototype.frame = function (t) {
    var self = this; requestAnimationFrame(function (tt) { self.frame(tt); });
    var dt = (t - this.last) / 1000; if (dt <= 0) return;
    if (MC.Options.maxFps < 260) { var minDt = 1 / MC.Options.maxFps; if (dt < minDt) return; }
    this.last = t; dt = Math.min(dt, 0.1); this.time += dt;
    this.fpsAcc = (this.fpsAcc || 0) + dt; this.fpsN = (this.fpsN || 0) + 1; if (this.fpsAcc >= 0.5) { MC.Hud.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    var input = MC.Input; var m = input.mouse; MC.Gui.setMouse(m.x, m.y);
    try {
      if (this.state === 'title') this.updateTitle(dt);
      else if (this.state === 'loading') this.updateLoading(dt);
      else if (this.state === 'playing') this.updatePlaying(dt);
    } catch (e) { console.error(e); if (this.chat) this.chat.add('§cError: ' + e.message); }
    input.endFrame();
  };
  Game.prototype.handleScreenInput = function () {
    var input = MC.Input, m = input.mouse; var s = this.screen; if (!s) return;
    for (var i = 0; i < m.clicks.length; i++) { var c = m.clicks[i]; var gx = c.x / MC.Gui.S, gy = c.y / MC.Gui.S; if (c.down) s.mouseDown(gx, gy, c.button); else s.mouseUp(gx, gy, c.button); }
    if (m.moved) s.mouseMove(MC.Gui.mx, MC.Gui.my);
    if (m.wheel) s.wheel(m.wheel);
    var codes = Object.keys(input.keys).filter(function (k) { return input.pressed(k); });
    for (i = 0; i < codes.length; i++) { var code = codes[i]; if (s.key(code)) continue; if (code === 'Escape') { if (this.state === 'playing') this.closeScreen(); else if (s.parent) this.openScreen(s.parent); } if (code === 'F11') this.toggleFullscreen(); }
  };
  Game.prototype.updateTitle = function (dt) {
    this.renderPanorama(dt);
    if (this.screen) { this.screen.tick(dt); this.handleScreenInput(); }
    MC.Gui.begin();
    if (this.screen) this.screen.render();
    if (!this.pano || !this.pano.ready) { var g = MC.Gui; g.drawBackground(); g.textC('Loading...', g.W / 2, g.H / 2 - 4, '#ffffff', true); }
  };
  Game.prototype.updateLoading = function (dt) {
    this.loadT += dt;
    var w = this.world; var total = w.totalTarget || 1; var done = MC.clamp(1 - w.pendingMesh / total, 0, 1);
    var readyNear = w.readyFraction(2) >= 1 && this.loadT > 0.5;
    if (readyNear && (w.readyFraction(Math.min(4, w.renderDistance)) >= 1 || this.loadT > 12)) { this.finishLoading(); return; }
    var g = MC.Gui; g.begin(); g.drawBackground();
    g.textC('Loading level', g.W / 2, Math.floor(g.H / 2) - 20, '#ffffff', true);
    g.textC(this.loadStage, g.W / 2, Math.floor(g.H / 2) + 4, '#ffffff', true);
    var bx = Math.floor(g.W / 2) - 50, by = Math.floor(g.H / 2) + 16;
    g.rect(bx, by, 100, 2, '#808080'); g.rect(bx, by, Math.round(done * 100), 2, '#80ff20');
    this.renderer.setClearColor(0x000000); this.renderer.clear(true, true, false);
  };
  Game.prototype.updatePlaying = function (dt) {
    var input = MC.Input, p = this.player, world = this.world, O = MC.Options;
    var paused = !!(this.screen && this.screen.pausesGame);
    // global keys
    if (!this.chat.open && !(this.screen && this.screen.focus)) {
      if (input.pressed('F1')) { MC.Hud.hidden = !MC.Hud.hidden; this.crosshair.style.display = MC.Hud.hidden || this.screen ? 'none' : 'block'; }
      if (input.pressed('F3')) MC.Hud.debug = !MC.Hud.debug;
      if (input.pressed('perspective')) this.perspective = (this.perspective + 1) % 3;
      if (input.pressed('F11')) this.toggleFullscreen();
    }
    if (this.screen) {
      this.screen.tick(dt); this.handleScreenInput();
      p.controlsEnabled = false;
    } else if (this.chat.open) {
      p.controlsEnabled = false;
      if (input.pressed('Escape')) this.chat.close();
    } else {
      p.controlsEnabled = true;
      if (input.pressed('Escape')) { this.openScreen(new MC.Screens.PauseScreen(this)); }
      else if (input.pressed('inventory')) { this.openScreen(p.isCreative() ? new MC.Inventory.Screens.CreativeScreen(this, this.lastCreativeTab || 2) : new MC.Inventory.Screens.InventoryScreen(this)); }
      else if (input.pressed('chat')) { this.chat.openChat(''); MC.Input.unlock(); }
      else if (input.pressed('command')) { this.chat.openChat('/'); MC.Input.unlock(); }
      else if (!MC.Input.touchActive && !input.locked && input.mouse.clicks.some(function (c) { return c.down; })) { MC.Input.lock(); }
    }
    if (MC.TouchControls) MC.TouchControls.update();
    if (this.screen && this.screen.constructor === MC.Inventory.Screens.CreativeScreen) this.lastCreativeTab = this.screen.tab;
    if (!paused) {
      var sens = O.sensitivity; if (O.invertMouse) input.mouse.dy = -input.mouse.dy;
      p.update(dt, input, sens);
      var cx = Math.floor(p.pos.x) >> 4, cz = Math.floor(p.pos.z) >> 4; world.setCenter(cx, cz);
      this.sky.time += dt * 20;
      this.entities.update(dt, p, this.sky.dayLight);
      MC.Mobs.update(dt, this.sky.dayLight);
      this.particles.dayLight = this.sky.dayLight; this.particles.update(dt, world);
      this.tickFurnaces(dt); this.tickSaplings(); this.tickAmbient(dt);
      MC.Hud.tick(dt, p);
      this.autosaveT += dt; if (this.autosaveT > 60) { this.autosaveT = 0; this.saveWorld(); }
      if (this.shake > 0) this.shake -= dt;
    }
    this.render(dt, paused);
  };
  Game.prototype.tickFurnaces = function (dt) {
    for (var k in this.furnaces) {
      var f = this.furnaces[k]; var input = f.slots[0], fuel = f.slots[1], out = f.slots[2];
      var result = input ? MC.SMELT[input.id] : null; var canOut = result && (!out || (out.id === result && out.count < MC.ITEMS[result].stack));
      if (f.burn > 0) f.burn -= dt;
      if (f.burn <= 0 && canOut && fuel && MC.FUEL[fuel.id]) { f.burn = MC.FUEL[fuel.id]; f.burnMax = f.burn; fuel.count--; if (fuel.id === 'lava_bucket') f.slots[1] = { id: 'bucket', count: 1, damage: 0 }; else if (fuel.count <= 0) f.slots[1] = null; }
      if (f.burn > 0 && canOut) { f.progress += dt / 10; if (f.progress >= 1) { f.progress = 0; input.count--; if (input.count <= 0) f.slots[0] = null; if (out) out.count++; else f.slots[2] = { id: result, count: 1, damage: 0 }; } }
      else if (!canOut) f.progress = Math.max(0, f.progress - dt / 5);
      if (f.burn <= 0) { f.burn = 0; }
      // furnace lit state -> particles
      var pos = k.split(',').map(Number);
      if (f.burn > 0 && Math.random() < dt * 3 && this.player.pos.distanceTo(new THREE.Vector3(pos[0], pos[1], pos[2])) < 24) { MC.Particles.smoke(pos[0] + 0.5, pos[1] + 1.05, pos[2] + 0.5, 1); }
    }
  };
  Game.prototype.tickSaplings = function () {
    for (var i = this.saplings.length - 1; i >= 0; i--) { var s = this.saplings[i]; if (this.time < s.t) continue; this.saplings.splice(i, 1); var id = this.world.getBlock(s.x, s.y, s.z); if (id <= 0 || !(/_sapling$/).test(MC.BLOCKS[id].name)) continue; if (this.world.getLight(s.x, s.y, s.z).sky < 9 && this.world.getLight(s.x, s.y, s.z).block < 9) { s.t = this.time + 30; this.saplings.push(s); continue; } this.world.worker.postMessage({ type: 'growTree', x: s.x, y: s.y, z: s.z, kind: s.type, seed: (Math.random() * 1e9) | 0 }); }
  };
  Game.prototype.tickAmbient = function (dt) {
    var p = this.player; MC.Audio.setListener(p.pos.x, p.pos.y + p.eyeHeight, p.pos.z, p.yaw);
    this.ambientT = (this.ambientT || 0) - dt;
    if (this.ambientT <= 0) { this.ambientT = 4 + Math.random() * 6; var l = this.world.getLight(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z)); if (l.sky === 0 && Math.random() < 0.2) MC.Audio.play('ambient.cave', { volume: 0.5 }); }
    // torch / lava / fire particles near the player
    this.fxT = (this.fxT || 0) - dt;
    if (this.fxT <= 0) { this.fxT = 0.12; var w = this.world; var bx = Math.floor(p.pos.x), by = Math.floor(p.pos.y), bz = Math.floor(p.pos.z); for (var i = 0; i < 40; i++) { var x = bx + Math.floor(Math.random() * 33) - 16, y = by + Math.floor(Math.random() * 25) - 12, z = bz + Math.floor(Math.random() * 33) - 16; var id = w.getBlock(x, y, z); if (id === MC.BLOCK.torch.id) { var meta = w.getMeta(x, y, z); var ox = 0.5, oz = 0.5, oy = 0.7; if (meta === 1) ox = 0.1; else if (meta === 2) ox = 0.9; else if (meta === 3) oz = 0.1; else if (meta === 4) oz = 0.9; if (meta) oy = 0.85; MC.Particles.flame(x + ox, y + oy, z + oz); if (Math.random() < 0.3) MC.Particles.smoke(x + ox, y + oy + 0.1, z + oz, 1); } else if (id === MC.BLOCK.lava.id && w.getBlock(x, y + 1, z) === 0 && Math.random() < 0.3) { MC.Particles.flame(x + Math.random(), y + 1, z + Math.random()); if (Math.random() < 0.05) MC.Audio.play('lava.pop', { pos: new THREE.Vector3(x, y, z), volume: 0.4 }); } } }
  };

  Game.prototype.render = function (dt, paused) {
    var p = this.player, world = this.world, O = MC.Options; var alpha = paused ? 1 : p.alpha();
    // camera
    var eye = p.getEyePos(alpha); var cam = this.camera;
    cam.rotation.order = 'YXZ';
    var yaw = p.yaw, pitch = p.pitch, roll = 0;
    if (O.bobbing && !p.dead) { var bob = MC.lerp(p.prevBob, p.bob, alpha); var f = -(MC.lerp(p.prevWalkDist, p.walkDist, alpha)); var bx = Math.sin(f * Math.PI) * bob * 0.5, by = -Math.abs(Math.cos(f * Math.PI) * bob); var right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); eye.addScaledVector(right, bx * 0.6); eye.y += by * 0.6; roll += Math.sin(f * Math.PI) * bob * 3 * Math.PI / 180; pitch += Math.abs(Math.cos(f * Math.PI - 0.2) * bob) * 5 * Math.PI / 180; }
    if (p.hurtTime > 0 && O.damageTilt > 0) { var ht = p.hurtTime / 0.5; var hf = Math.sin(ht * ht * ht * ht * Math.PI); roll += hf * 14 * Math.PI / 180 * (p.hurtYaw > 0 ? 1 : -1) * O.damageTilt; }
    if (this.shake > 0) { roll += (Math.random() - 0.5) * this.shake * 0.05; pitch += (Math.random() - 0.5) * this.shake * 0.03; }
    if (p.dead) { pitch = MC.lerp(pitch, 0, Math.min(1, p.deathTime * 2)); roll = MC.lerp(0, Math.PI / 2 * 0.9, Math.min(1, p.deathTime * 1.5)); eye.y -= Math.min(1, p.deathTime * 1.5) * 1.3; }
    var thirdPerson = this.perspective !== 0;
    if (this.playerModel) {
      this.playerModel.visible = thirdPerson && !p.dead;
      if (this.playerModel.visible) {
        var modelPos = p.renderPos(alpha); this.playerModel.position.copy(modelPos);
        // World movement and the player mesh share the same forward axis.
        this.playerModel.rotation.set(0, yaw, 0);
        var pp = this.playerModelParts, walk = Math.sin(MC.lerp(p.prevWalkDist, p.walkDist, alpha) * Math.PI) * Math.min(1, p.bob * 12);
        if (pp.legR) { pp.legR.rotation.x = walk * 0.75; pp.legL.rotation.x = -walk * 0.75; pp.armR.rotation.x = -walk * 0.55; pp.armL.rotation.x = walk * 0.55; pp.head.rotation.x = p.pitch * 0.25; }
      }
    }
    if (thirdPerson) {
      var look = p.getLookDir(), target = p.renderPos(alpha).add(new THREE.Vector3(0, 1.35, 0));
      var side = this.perspective === 1 ? -1 : 1;
      cam.position.copy(target).addScaledVector(look, side * 4.2); cam.position.y += 0.45;
      cam.lookAt(target); cam.rotateZ(roll * 0.35);
    } else {
      cam.position.copy(eye); cam.rotation.set(-pitch, yaw, roll);
    }
    var fovMult = p.sprinting || (p.flying && p.sprinting) ? 1.15 : 1; this.fovMult = this.fovMult === undefined ? 1 : this.fovMult + (fovMult - this.fovMult) * Math.min(1, dt * 8);
    var fov = O.fov * this.fovMult; if (p.headInWater) fov *= 0.9;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    // sky + fog + uniforms
    var biome = world.getBiome(Math.floor(p.pos.x), Math.floor(p.pos.z));
    this.sky.update(dt, cam.position, biome, p.headInWater, cam.far);
    world.updateUniforms(this.time, cam.position);
    if (p.headInWater) { world.setFog(2, 22); }
    var lavaHead = world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z)) === MC.BLOCK.lava.id;
    if (lavaHead) { world.setFog(0.2, 2.5); this.sky.fogColor.setRGB(0.6, 0.1, 0); world.materials.uniforms.uFogColor.value.set(0.6, 0.1, 0); }
    // selection + break overlay
    var hit = p.target;
    if (hit && !p.dead && !this.screen) { var boxes = world.hitBoxes(hit.id) || [[0, 0, 0, 1, 1, 1]]; var b = boxes[0]; this.selection.visible = true; this.selection.position.set(hit.x + (b[0] + b[3]) / 2, hit.y + (b[1] + b[4]) / 2, hit.z + (b[2] + b[5]) / 2); this.selection.scale.set(b[3] - b[0], b[4] - b[1], b[5] - b[2]); } else this.selection.visible = false;
    if (p.mining.target && p.mining.progress > 0 && hit) { var stage = Math.min(9, Math.floor(p.mining.progress * 10)); this.breakMesh.geometry = this.breakGeos[stage]; this.breakMesh.visible = true; this.breakMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5); } else this.breakMesh.visible = false;
    // render world
    var r = this.renderer;
    r.setClearColor(this.sky.fogColor); r.clear(true, true, false);
    r.render(this.scene, cam);
    this.stats.chunksRendered = r.info.render.calls;
    // hand
    if (!MC.Hud.hidden && !p.dead && !thirdPerson) { this.updateHand(dt, alpha); this.handCamera.fov = 70; this.handCamera.updateProjectionMatrix(); r.clearDepth(); r.render(this.handScene, this.handCamera); }
    // GUI
    var g = MC.Gui; g.begin();
    if (p.headInWater) g.rect(0, 0, g.W, g.H, 'rgba(10,30,110,0.35)');
    if (lavaHead) g.rect(0, 0, g.W, g.H, 'rgba(200,60,0,0.6)');
    if (p.fireTicks > 0 && !p.dead) { g.gradient(0, g.H * 0.6, g.W, g.H * 0.4, 'rgba(255,120,0,0)', 'rgba(255,90,0,0.55)'); }
    MC.Hud.render(this);
    this.chat.render();
    if (this.screen) this.screen.render();
    this.crosshair.style.display = (MC.Input.touchActive || this.screen || MC.Hud.hidden || this.chat.open) ? 'none' : 'block';
  };

  MC.Game = Game;
  window.addEventListener('load', function () { MC.game = new Game(); MC.game.init(); window.gameInstance = MC.game; });
})();
