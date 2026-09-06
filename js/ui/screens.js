// Menu screens: title, world select/create, options (+video/sound/controls/language/accessibility), pause, death, multiplayer, realms.
(function () {
  var Screen = MC.Screen;
  function extend(Sub, Base) { Sub.prototype = Object.create(Base.prototype); Sub.prototype.constructor = Sub; }
  var SPLASHES = ['Also try Limbo!', 'Also try Terraria!', 'Now with more Fable!', 'Keyboard compatible!', 'Undocumented!', 'Ingots!', 'Exploding creepers!', 'That\'s no moon!', 'Home-made!', 'Contains simulated goats!', 'Woo, Java!', 'Cherry blossoms!', 'Pixels!', 'Made in the browser!', 'Watch out for creepers!', 'Punch a tree!', 'Sneak to not fall!', '90% bug free!', 'Don\'t look directly at the bugs!', 'Now in 3D!', 'Absolutely no memes!', 'Hobo humping slobo babe!', 'Random splash!', 'Cheerful!', 'As seen on TV!', 'Awesome!', '100% pure!', 'May contain nuts!', 'Better than Prey!', 'More polygons!', 'Sexy!', 'Limited edition!', 'Flashing letters!', 'Its here!', 'Best in class!', 'Uses LWJGL!', 'Reticulating splines!', 'Minecraft!', 'Yaaay!', 'Singleplayer!', 'Keyboard compatible!', 'Ingots!', 'Closed source!', 'Classy!', 'Wow!', 'Not on steam!', 'Oh man!', 'Awesome community!', 'Pixels!', 'Teetsuuuuoooo!', 'Kaaneeeedaaaa!', 'Now with difficulty!', 'Enhanced!', '90% bug free!', 'Pretty!', '12 herbs and spices!', 'Fat free!', 'Absolutely no memes!', 'Free dental!', 'Ask your doctor!', 'Minors welcome!', 'Cloud computing!', 'Legal in Finland!', 'Hard to label!', 'Technically good!', 'Bringing home the bacon!', 'Indev!', 'Spiders everywhere!', 'Check it out!', 'Holy cow, man!', 'It\'s a game!', 'Made in Sweden!', 'Uses wood!', 'Reticulating splines!', 'Minecraft!', 'Yaaay!'];

  // ---------------- Title ----------------
  function TitleScreen(game) { Screen.call(this, game); this.splash = MC.Storage.get('firstRun', true) ? SPLASHES[0] : SPLASHES[Math.floor(Math.random() * SPLASHES.length)]; MC.Storage.set('firstRun', false); this.t = 0; }
  extend(TitleScreen, Screen);
  TitleScreen.prototype.pausesGame = false;
  TitleScreen.prototype.layout = function () {
    var g = MC.Gui, W = g.W, H = g.H; var self = this; this.clear();
    var y = Math.floor(H / 4) + 48, x = Math.floor(W / 2) - 100;
    this.button(x, y, 200, 20, 'Singleplayer', function () { self.game.openScreen(new SelectWorldScreen(self.game, self)); });
    this.button(x, y + 24, 200, 20, 'Multiplayer', function () { self.game.openScreen(new MultiplayerScreen(self.game, self)); });
    var realms = this.button(x, y + 48, 200, 20, 'Minecraft Realms', function () { self.game.openScreen(new RealmsScreen(self.game, self)); });
    realms.realms = true;
    var y2 = y + 72 + 12;
    var lang = this.button(x - 24, y2, 20, 20, '', function () { self.game.openScreen(new LanguageScreen(self.game, self)); }); lang.icon = MC.Sprites.s.icon_language;
    this.button(x, y2, 98, 20, 'Options...', function () { self.game.openScreen(new OptionsScreen(self.game, self)); });
    this.button(x + 102, y2, 98, 20, 'Quit Game', function () { self.game.quit(); });
    var acc = this.button(x + 204, y2, 20, 20, '', function () { self.game.openScreen(new AccessibilityScreen(self.game, self)); }); acc.icon = MC.Sprites.s.icon_accessibility;
  };
  TitleScreen.prototype.tick = function (dt) { Screen.prototype.tick.call(this, dt); this.t += dt; };
  TitleScreen.prototype.render = function () {
    var g = MC.Gui, c = g.ctx, W = g.W, H = g.H, S = MC.Sprites.s;
    // logo + edition
    var lx = Math.floor(W / 2) - 128; c.drawImage(S.logo, lx, 30); c.drawImage(S.edition, Math.floor(W / 2) - 64, 30 + 44 - 7);
    // splash
    c.save(); c.translate(Math.floor(W / 2) + 123, 69); c.rotate(-20 * Math.PI / 180);
    var scale = 1.8 - Math.abs(Math.sin((this.t * 1000 % 1000) / 1000 * Math.PI)) * 0.1; scale = scale * 100 / (MC.Font.width(this.splash) + 32);
    c.scale(scale, scale); MC.Font.drawCentered(c, this.splash, 0, -4, '#ffff00', true); c.restore();
    this.renderWidgets();
    // realms icons on the realms button
    for (var i = 0; i < this.widgets.length; i++) { var w = this.widgets[i]; if (w.realms) { c.drawImage(S.icon_realms_notify, w.x + w.w - 40, w.y + 5); c.drawImage(S.icon_realms, w.x + w.w - 26, w.y + 4); } }
    // Creator credit in the bottom-left, using the bundled SVG GitHub mark.
    if (!MC.githubLogo) { MC.githubLogo = new Image(); MC.githubLogo.src = 'assets/github.svg'; }
    if (MC.githubLogo.complete) c.drawImage(MC.githubLogo, 2, H - 13, 12, 12);
    g.text('@notterajyk', 17, H - 10, '#ffffff', true);
    var copy = 'Fan recreation. Not affiliated with Mojang AB.'; g.text(copy, W - MC.Font.width(copy) - 2, H - 10, '#ffffff', true);
  };

  // ---------------- Select World ----------------
  function SelectWorldScreen(game, parent) { Screen.call(this, game); this.parent = parent; this.worlds = game.listWorlds(); this.selected = -1; this.scroll = 0; this.lastClick = 0; this.filter = ''; }
  extend(SelectWorldScreen, Screen);
  SelectWorldScreen.prototype.pausesGame = false;
  SelectWorldScreen.prototype.layout = function () {
    var g = MC.Gui, W = g.W, H = g.H, self = this; this.clear();
    var search = this.field(Math.floor(W / 2) - 100, 22, 200, 20, this.filter, { placeholder: '', onChange: function (t) { self.filter = t; } });
    this.play = this.button(Math.floor(W / 2) - 154, H - 52, 150, 20, 'Play Selected World', function () { self.playSelected(); });
    this.button(Math.floor(W / 2) + 4, H - 52, 150, 20, 'Create New World', function () { self.game.openScreen(new CreateWorldScreen(self.game, self)); });
    this.edit = this.button(Math.floor(W / 2) - 154, H - 28, 72, 20, 'Edit', function () { var w = self.worlds[self.selected]; if (w) self.game.openScreen(new EditWorldScreen(self.game, self, w)); });
    this.del = this.button(Math.floor(W / 2) - 76, H - 28, 72, 20, 'Delete', function () { var w = self.worlds[self.selected]; if (w) self.game.openScreen(new ConfirmScreen(self.game, self, "Are you sure you want to delete this world?", "'" + w.name + "' will be lost forever! (A long time!)", 'Delete', function () { self.game.deleteWorld(w.id); self.worlds = self.game.listWorlds(); self.selected = -1; })); });
    this.recreate = this.button(Math.floor(W / 2) + 4, H - 28, 72, 20, 'Re-Create', function () { var w = self.worlds[self.selected]; if (w) self.game.openScreen(new CreateWorldScreen(self.game, self, w)); });
    this.button(Math.floor(W / 2) + 82, H - 28, 72, 20, 'Cancel', function () { self.game.openScreen(self.parent); });
  };
  SelectWorldScreen.prototype.visible = function () { var f = this.filter.toLowerCase(); return this.worlds.filter(function (w) { return !f || w.name.toLowerCase().indexOf(f) >= 0; }); };
  SelectWorldScreen.prototype.playSelected = function () { var w = this.worlds[this.selected]; if (w) this.game.startWorld(w); };
  SelectWorldScreen.prototype.render = function () {
    var g = MC.Gui, c = g.ctx, W = g.W, H = g.H; g.drawBackground();
    g.textC('Select World', W / 2, 8, '#ffffff', true);
    var listTop = 48, listBottom = H - 64; var vis = this.visible();
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, listTop, W, listBottom - listTop);
    c.save(); c.beginPath(); c.rect(0, listTop, W, listBottom - listTop); c.clip();
    var x0 = Math.floor(W / 2) - 150;
    for (var i = 0; i < vis.length; i++) {
      var w = vis[i]; var y = listTop + 4 + i * 36 - this.scroll; if (y > listBottom || y + 36 < listTop) continue;
      var idx = this.worlds.indexOf(w);
      if (idx === this.selected) { c.fillStyle = '#808080'; c.fillRect(x0 - 2, y - 2, 304, 36); c.fillStyle = '#000000'; c.fillRect(x0 - 1, y - 1, 302, 34); }
      // icon
      var icon = g.blockIcon(MC.BLOCK.grass_block.id); c.drawImage(icon, x0, y, 32, 32);
      if (g.hover(x0, y, 32, 32)) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x0, y, 32, 32); g.text('>', x0 + 12, y + 12, '#ffffff', true); }
      g.text(MC.Font.fit(w.name, 250), x0 + 35, y + 1, '#ffffff', true);
      var d = new Date(w.lastPlayed || w.created); var ds = w.id + ' (' + (d.getMonth() + 1) + '/' + d.getDate() + '/' + (d.getFullYear() % 100) + ', ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ' ' + (d.getHours() < 12 ? 'AM' : 'PM') + ')';
      g.text(ds, x0 + 35, y + 12, '#808080', true);
      g.text((w.gameMode === 'creative' ? 'Creative' : (w.hardcore ? 'Hardcore' : 'Survival')) + ' Mode' + (w.cheats ? ', Cheats' : '') + ', Version: ' + MC.VERSION, x0 + 35, y + 22, '#808080', true);
    }
    c.restore();
    if (!vis.length) g.textC(this.worlds.length ? 'No worlds match the search' : 'No worlds yet. Create a new world!', W / 2, (listTop + listBottom) / 2 - 4, '#a0a0a0', true);
    // gradients at list edges
    g.gradient(0, listTop, W, 4, 'rgba(0,0,0,1)', 'rgba(0,0,0,0)'); g.gradient(0, listBottom - 4, W, 4, 'rgba(0,0,0,0)', 'rgba(0,0,0,1)');
    var has = this.selected >= 0; this.play.enabled = has; this.edit.enabled = has; this.del.enabled = has; this.recreate.enabled = has;
    this.renderWidgets();
  };
  SelectWorldScreen.prototype.mouseDown = function (x, y, button) {
    if (Screen.prototype.mouseDown.call(this, x, y, button)) return true;
    var g = MC.Gui, W = g.W, H = g.H; var listTop = 48, listBottom = H - 64;
    if (y >= listTop && y < listBottom && button === 0) {
      var vis = this.visible(); var x0 = Math.floor(W / 2) - 150;
      for (var i = 0; i < vis.length; i++) { var yy = listTop + 4 + i * 36 - this.scroll; if (y >= yy - 2 && y < yy + 34 && x >= x0 - 2 && x < x0 + 302) { var idx = this.worlds.indexOf(vis[i]); var now = performance.now(); if (idx === this.selected && now - this.lastClick < 400) { this.playSelected(); return true; } if (x < x0 + 32 && idx === this.selected) { this.playSelected(); return true; } this.selected = idx; this.lastClick = now; MC.Audio.play('ui.click'); return true; } }
      this.selected = -1;
    }
    return false;
  };
  SelectWorldScreen.prototype.wheel = function (dir) { var max = Math.max(0, this.visible().length * 36 - (MC.Gui.H - 64 - 48) + 8); this.scroll = MC.clamp(this.scroll + dir * 18, 0, max); };
  SelectWorldScreen.prototype.key = function (code) { if (code === 'Enter' && this.selected >= 0) { this.playSelected(); return true; } if (code === 'ArrowDown') { this.selected = Math.min(this.worlds.length - 1, this.selected + 1); return true; } if (code === 'ArrowUp') { this.selected = Math.max(0, this.selected - 1); return true; } return false; };

  // ---------------- Create World ----------------
  function CreateWorldScreen(game, parent, template) {
    Screen.call(this, game); this.parent = parent; this.tab = 0;
    this.name = template ? template.name : 'New World'; this.gameMode = template ? template.gameMode : 'survival'; this.difficulty = template ? (template.difficulty || 'normal') : 'normal'; this.cheats = template ? !!template.cheats : false; this.seed = template ? String(template.seed) : ''; this.worldType = 'Default'; this.structures = true; this.bonusChest = false;
  }
  extend(CreateWorldScreen, Screen);
  CreateWorldScreen.prototype.pausesGame = false;
  CreateWorldScreen.prototype.layout = function () {
    var g = MC.Gui, W = g.W, H = g.H, self = this; this.clear();
    var cx = Math.floor(W / 2);
    // tabs
    var tabs = ['Game', 'World', 'More']; this.tabButtons = [];
    for (var i = 0; i < 3; i++) (function (i) { var b = self.button(cx - 105 + i * 70, 24, 70, 20, tabs[i], function () { self.tab = i; self.layout(); }); b.tab = true; b.tabIndex = i; self.tabButtons.push(b); })(i);
    var y = 60;
    if (this.tab === 0) {
      this.nameField = this.field(cx - 100, y + 10, 200, 20, this.name, { maxLen: 32, onChange: function (t) { self.name = t; } });
      this.button(cx - 75, y + 44, 150, 20, function () { return 'Game Mode: ' + (self.gameMode === 'creative' ? 'Creative' : self.gameMode === 'hardcore' ? 'Hardcore' : 'Survival'); }, function () { self.gameMode = self.gameMode === 'survival' ? 'hardcore' : self.gameMode === 'hardcore' ? 'creative' : 'survival'; if (self.gameMode === 'hardcore') self.difficulty = 'hard'; });
      this.diffBtn = this.button(cx - 75, y + 90, 150, 20, function () { return 'Difficulty: ' + self.difficulty.charAt(0).toUpperCase() + self.difficulty.slice(1); }, function () { var d = ['peaceful', 'easy', 'normal', 'hard']; self.difficulty = d[(d.indexOf(self.difficulty) + 1) % 4]; });
      this.button(cx - 75, y + 114, 150, 20, function () { return 'Allow Commands: ' + (self.cheats ? 'ON' : 'OFF'); }, function () { self.cheats = !self.cheats; }, 'Commands like /gamemode, /time, /give');
    } else if (this.tab === 1) {
      this.button(cx - 75, y + 10, 150, 20, function () { return 'World Type: ' + self.worldType; }, function () { var t = ['Default', 'Superflat', 'Large Biomes', 'Amplified']; self.worldType = t[(t.indexOf(self.worldType) + 1) % 4]; }, 'Only Default terrain is generated in this recreation');
      this.seedField = this.field(cx - 100, y + 50, 200, 20, this.seed, { maxLen: 32, placeholder: '', onChange: function (t) { self.seed = t; } });
      this.button(cx - 75, y + 84, 150, 20, function () { return 'Generate Structures: ' + (self.structures ? 'ON' : 'OFF'); }, function () { self.structures = !self.structures; });
      this.button(cx - 75, y + 108, 150, 20, function () { return 'Bonus Chest: ' + (self.bonusChest ? 'ON' : 'OFF'); }, function () { self.bonusChest = !self.bonusChest; });
      var c = this.button(cx - 75, y + 132, 150, 20, 'Customize', null); c.enabled = false;
    } else {
      var b1 = this.button(cx - 75, y + 10, 150, 20, 'Game Rules', null); b1.enabled = false;
      var b2 = this.button(cx - 75, y + 34, 150, 20, 'Data Packs', null); b2.enabled = false;
      var b3 = this.button(cx - 75, y + 58, 150, 20, 'Experiments', null); b3.enabled = false;
    }
    this.button(cx - 155, H - 28, 150, 20, 'Create New World', function () { self.create(); });
    this.button(cx + 5, H - 28, 150, 20, 'Cancel', function () { self.game.openScreen(self.parent); });
  };
  CreateWorldScreen.prototype.create = function () {
    var name = (this.name || '').trim() || 'New World';
    var info = this.game.createWorld({ name: name, seed: this.seed, gameMode: this.gameMode === 'hardcore' ? 'survival' : this.gameMode, hardcore: this.gameMode === 'hardcore', difficulty: this.difficulty, cheats: this.cheats || this.gameMode === 'creative', worldType: this.worldType });
    this.game.startWorld(info);
  };
  CreateWorldScreen.prototype.render = function () {
    var g = MC.Gui, W = g.W, H = g.H, c = g.ctx; g.drawBackground();
    var cx = Math.floor(W / 2);
    g.textC('Create New World', cx, 8, '#ffffff', true);
    // tab header bar
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 46, W, 2);
    var y = 60;
    if (this.tab === 0) { g.text('World Name', cx - 100, y, '#a0a0a0', true); var desc = this.gameMode === 'creative' ? ['Unlimited resources, free flying and', 'destroy blocks instantly'] : this.gameMode === 'hardcore' ? ['Same as Survival Mode, locked at hardest', 'difficulty, and one life only'] : ['Search for resources, crafting, gain', 'levels, health and hunger']; g.text(desc[0], cx - 75, y + 68, '#a0a0a0', true); g.text(desc[1], cx - 75, y + 78, '#a0a0a0', true); if (this.diffBtn) this.diffBtn.enabled = this.gameMode !== 'hardcore'; }
    else if (this.tab === 1) { g.text('Seed for the world generator', cx - 100, y + 40, '#a0a0a0', true); g.text('Leave blank for a random seed', cx - 100, y + 72, '#a0a0a0', true); }
    else { g.text('Additional options for your world', cx - 75, y + 90, '#a0a0a0', true); }
    this.renderWidgets();
    for (var i = 0; i < this.tabButtons.length; i++) { var b = this.tabButtons[i]; if (b.tabIndex === this.tab) { c.fillStyle = '#ffffff'; c.fillRect(b.x, b.y + b.h - 2, b.w, 2); } }
  };
  CreateWorldScreen.prototype.key = function (code) { if (code === 'Enter' && !this.focus) { this.create(); return true; } return false; };

  // ---------------- Edit World ----------------
  function EditWorldScreen(game, parent, world) { Screen.call(this, game); this.parent = parent; this.world = world; this.name = world.name; }
  extend(EditWorldScreen, Screen); EditWorldScreen.prototype.pausesGame = false;
  EditWorldScreen.prototype.layout = function () {
    var g = MC.Gui, W = g.W, H = g.H, self = this, cx = Math.floor(W / 2); this.clear();
    this.field(cx - 100, 38, 200, 20, this.name, { maxLen: 32, onChange: function (t) { self.name = t; } });
    var opts = ['Reset Icon', 'Open World Folder', 'Make Backup', 'Open Backups Folder', 'Optimize World'];
    for (var i = 0; i < opts.length; i++) { var b = this.button(cx - 100, 70 + i * 24, 200, 20, opts[i], null); b.enabled = false; }
    this.button(cx - 100, H - 52, 98, 20, 'Save', function () { self.world.name = self.name.trim() || self.world.name; self.game.saveWorldInfo(self.world); self.parent.worlds = self.game.listWorlds(); self.game.openScreen(self.parent); });
    this.button(cx + 2, H - 52, 98, 20, 'Cancel', function () { self.game.openScreen(self.parent); });
  };
  EditWorldScreen.prototype.render = function () { var g = MC.Gui; g.drawBackground(); g.textC('Edit World', g.W / 2, 8, '#ffffff', true); g.text('World Name', g.W / 2 - 100, 26, '#a0a0a0', true); this.renderWidgets(); };

  // ---------------- Confirm ----------------
  function ConfirmScreen(game, parent, title, message, yesLabel, onYes) { Screen.call(this, game); this.parent = parent; this.title = title; this.message = message; this.yesLabel = yesLabel; this.onYes = onYes; }
  extend(ConfirmScreen, Screen); ConfirmScreen.prototype.pausesGame = false;
  ConfirmScreen.prototype.layout = function () { var g = MC.Gui, W = g.W, H = g.H, self = this; this.clear(); var y = Math.floor(H / 6) + 96; this.button(Math.floor(W / 2) - 155, y, 150, 20, this.yesLabel, function () { self.onYes(); self.game.openScreen(self.parent); }); this.button(Math.floor(W / 2) + 5, y, 150, 20, 'Cancel', function () { self.game.openScreen(self.parent); }); };
  ConfirmScreen.prototype.render = function () { var g = MC.Gui, W = g.W, H = g.H; g.drawBackground(); g.textC(this.title, W / 2, 70, '#ffffff', true); var lines = MC.Font.wrap(this.message, W - 50); for (var i = 0; i < lines.length; i++) g.textC(lines[i], W / 2, 90 + i * 9, '#a0a0a0', true); this.renderWidgets(); };

  // ---------------- Options ----------------
  function OptionsScreen(game, parent) { Screen.call(this, game); this.parent = parent; }
  extend(OptionsScreen, Screen);
  OptionsScreen.prototype.layout = function () {
    var g = MC.Gui, W = g.W, H = g.H, self = this, O = MC.Options; this.clear();
    var cx = Math.floor(W / 2), y = Math.floor(H / 6) - 12;
    this.slider(cx - 155, y, 150, function (v) { var f = Math.round(30 + v * 80); return 'FOV: ' + (f === 70 ? 'Normal' : f === 110 ? 'Quake Pro' : f); }, (O.fov - 30) / 80, function (v) { O.fov = Math.round(30 + v * 80); self.game.applyOptions(); });
    var rn = this.button(cx + 5, y, 150, 20, 'Realms Notifications: ON', null); rn.enabled = false;
    var sk = this.button(cx - 155, y + 24, 150, 20, 'Skin Customization...', null); sk.enabled = false;
    this.button(cx + 5, y + 24, 150, 20, 'Music & Sounds...', function () { self.game.openScreen(new SoundScreen(self.game, self)); });
    this.button(cx - 155, y + 48, 150, 20, 'Video Settings...', function () { self.game.openScreen(new VideoScreen(self.game, self)); });
    this.button(cx + 5, y + 48, 150, 20, 'Controls...', function () { self.game.openScreen(new ControlsScreen(self.game, self)); });
    this.button(cx - 155, y + 72, 150, 20, 'Language...', function () { self.game.openScreen(new LanguageScreen(self.game, self)); });
    var ch = this.button(cx + 5, y + 72, 150, 20, 'Chat Settings...', null); ch.enabled = false;
    var rp = this.button(cx - 155, y + 96, 150, 20, 'Resource Packs...', null); rp.enabled = false;
    this.button(cx + 5, y + 96, 150, 20, 'Accessibility Settings...', function () { self.game.openScreen(new AccessibilityScreen(self.game, self)); });
    var on = this.button(cx - 155, y + 120, 150, 20, 'Online...', null); on.enabled = false;
    var tel = this.button(cx + 5, y + 120, 150, 20, 'Telemetry Data...', null); tel.enabled = false;
    this.button(cx - 100, Math.floor(H / 6) + 168, 200, 20, 'Done', function () { self.game.openScreen(self.parent); });
  };
  OptionsScreen.prototype.render = function () { var g = MC.Gui; this.game.drawScreenBackground(); g.textC('Options', g.W / 2, 15, '#ffffff', true); this.renderWidgets(); };
  OptionsScreen.prototype.onClose = function () { Screen.prototype.onClose.call(this); MC.saveOptions(); };

  function VideoScreen(game, parent) { Screen.call(this, game); this.parent = parent; }
  extend(VideoScreen, Screen);
  VideoScreen.prototype.layout = function () {
    var g = MC.Gui, W = g.W, H = g.H, self = this, O = MC.Options; this.clear();
    var cx = Math.floor(W / 2), y = 40; var L = cx - 155, R = cx + 5;
    this.button(L, y, 150, 20, function () { return 'Graphics: ' + (O.fancy ? 'Fancy' : 'Fast'); }, function () { O.fancy = !O.fancy; self.game.applyOptions(); });
    this.slider(R, y, 150, function (v) { return 'Render Distance: ' + Math.round(2 + v * 14) + ' chunks'; }, (O.renderDistance - 2) / 14, function (v) { O.renderDistance = Math.round(2 + v * 14); });
    this.widgets[this.widgets.length - 1].onRelease = function () { self.game.applyOptions(); };
    var sl = this.button(L, y + 24, 150, 20, 'Smooth Lighting: Maximum', null); sl.enabled = false;
    this.slider(R, y + 24, 150, function (v) { var f = Math.round(10 + v * 250); return 'Max Framerate: ' + (f >= 260 ? 'Unlimited' : f + ' fps'); }, (O.maxFps - 10) / 250, function (v) { O.maxFps = Math.round(10 + v * 250); });
    this.button(L, y + 48, 150, 20, function () { return 'View Bobbing: ' + (O.bobbing ? 'ON' : 'OFF'); }, function () { O.bobbing = !O.bobbing; });
    this.button(R, y + 48, 150, 20, function () { return 'GUI Scale: ' + (O.guiScale ? O.guiScale : 'Auto'); }, function () { O.guiScale = (O.guiScale + 1) % 5; self.game.applyOptions(); self.layout(); });
    this.slider(L, y + 72, 150, function (v) { return 'Brightness: ' + (v <= 0.01 ? 'Moody' : v >= 0.99 ? 'Bright' : Math.round(v * 100) + '%'); }, O.gamma, function (v) { O.gamma = v; self.game.applyOptions(); });
    this.button(R, y + 72, 150, 20, function () { return 'Clouds: ' + (O.clouds ? 'Fancy' : 'OFF'); }, function () { O.clouds = !O.clouds; self.game.applyOptions(); });
    this.button(L, y + 96, 150, 20, function () { return 'Fullscreen: ' + (document.fullscreenElement ? 'ON' : 'OFF'); }, function () { self.game.toggleFullscreen(); });
    var pa = this.button(R, y + 96, 150, 20, 'Particles: All', null); pa.enabled = false;
    var mm = this.button(L, y + 120, 150, 20, 'Mipmap Levels: 4', null); mm.enabled = false;
    var es = this.button(R, y + 120, 150, 20, 'Entity Shadows: OFF', null); es.enabled = false;
    this.button(cx - 100, H - 27, 200, 20, 'Done', function () { self.game.openScreen(self.parent); });
  };
  VideoScreen.prototype.render = function () { var g = MC.Gui; this.game.drawScreenBackground(); g.textC('Video Settings', g.W / 2, 20, '#ffffff', true); this.renderWidgets(); };
  VideoScreen.prototype.onClose = function () { Screen.prototype.onClose.call(this); MC.saveOptions(); };

  function SoundScreen(game, parent) { Screen.call(this, game); this.parent = parent; }
  extend(SoundScreen, Screen);
  SoundScreen.prototype.layout = function () {
    var g = MC.Gui, W = g.W, H = g.H, self = this, O = MC.Options; this.clear();
    var cx = Math.floor(W / 2); var y = 40;
    function vol(name, key, x, yy, w) { self.slider(x, yy, w, function (v) { return name + ': ' + (v <= 0 ? 'OFF' : Math.round(v * 100) + '%'); }, O.volumes[key], function (v) { O.volumes[key] = v; MC.Audio.setVolume(key, v); }); }
    vol('Master Volume', 'master', cx - 155, y, 310);
    vol('Music', 'music', cx - 155, y + 24, 150); var jb = this.slider(cx + 5, y + 24, 150, function () { return 'Jukebox/Note Blocks: 100%'; }, 1, null); jb.enabled = false;
    var we = this.slider(cx - 155, y + 48, 150, function () { return 'Weather: 100%'; }, 1, null); we.enabled = false; vol('Blocks', 'blocks', cx + 5, y + 48, 150);
    vol('Hostile Creatures', 'hostile', cx - 155, y + 72, 150); vol('Friendly Creatures', 'friendly', cx + 5, y + 72, 150);
    vol('Players', 'players', cx - 155, y + 96, 150); vol('Ambient/Environment', 'ambient', cx + 5, y + 96, 150);
    vol('UI', 'ui', cx - 155, y + 120, 150); var st = this.button(cx + 5, y + 120, 150, 20, 'Show Subtitles: OFF', null); st.enabled = false;
    this.button(cx - 100, H - 27, 200, 20, 'Done', function () { self.game.openScreen(self.parent); });
  };
  SoundScreen.prototype.render = function () { var g = MC.Gui; this.game.drawScreenBackground(); g.textC('Music & Sound Options', g.W / 2, 20, '#ffffff', true); this.renderWidgets(); };
  SoundScreen.prototype.onClose = function () { Screen.prototype.onClose.call(this); MC.saveOptions(); };

  function ControlsScreen(game, parent) { Screen.call(this, game); this.parent = parent; }
  extend(ControlsScreen, Screen);
  ControlsScreen.prototype.layout = function () {
    var g = MC.Gui, W = g.W, H = g.H, self = this, O = MC.Options; this.clear(); var cx = Math.floor(W / 2), y = 40;
    this.button(cx - 155, y, 150, 20, 'Mouse Settings...', function () { self.game.openScreen(new MouseScreen(self.game, self)); });
    this.button(cx + 5, y, 150, 20, 'Key Binds...', function () { self.game.openScreen(new KeyBindsScreen(self.game, self)); });
    var ts = this.button(cx - 155, y + 24, 150, 20, 'Sneak: Hold', null); ts.enabled = false; var tp = this.button(cx + 5, y + 24, 150, 20, 'Sprint: Hold', null); tp.enabled = false;
    this.button(cx - 155, y + 48, 150, 20, function () { return 'Auto-Jump: ' + (O.autoJump ? 'ON' : 'OFF'); }, function () { O.autoJump = !O.autoJump; self.game.applyOptions(); });
    var op = this.button(cx + 5, y + 48, 150, 20, 'Operator Items Tab: OFF', null); op.enabled = false;
    this.button(cx - 100, H - 27, 200, 20, 'Done', function () { self.game.openScreen(self.parent); });
  };
  ControlsScreen.prototype.render = function () { var g = MC.Gui; this.game.drawScreenBackground(); g.textC('Controls', g.W / 2, 20, '#ffffff', true); this.renderWidgets(); };
  ControlsScreen.prototype.onClose = function () { Screen.prototype.onClose.call(this); MC.saveOptions(); };

  function MouseScreen(game, parent) { Screen.call(this, game); this.parent = parent; }
  extend(MouseScreen, Screen);
  MouseScreen.prototype.layout = function () {
    var g = MC.Gui, W = g.W, H = g.H, self = this, O = MC.Options; this.clear(); var cx = Math.floor(W / 2), y = 40;
    this.slider(cx - 155, y, 150, function (v) { return 'Sensitivity: ' + (v <= 0 ? '*yawn*' : v >= 1 ? 'HYPERSPEED!!!' : Math.round(v * 200) + '%'); }, O.sensitivity, function (v) { O.sensitivity = v; });
    this.button(cx + 5, y, 150, 20, function () { return 'Invert Mouse: ' + (O.invertMouse ? 'ON' : 'OFF'); }, function () { O.invertMouse = !O.invertMouse; });
    var a = this.slider(cx - 155, y + 24, 150, function () { return 'Scroll Sensitivity: 1'; }, 0, null); a.enabled = false; var b = this.button(cx + 5, y + 24, 150, 20, 'Discrete Scrolling: OFF', null); b.enabled = false;
    var c = this.button(cx - 155, y + 48, 150, 20, 'Touchscreen Mode: OFF', null); c.enabled = false; var d = this.button(cx + 5, y + 48, 150, 20, 'Raw Input: ON', null); d.enabled = false;
    this.button(cx - 100, H - 27, 200, 20, 'Done', function () { self.game.openScreen(self.parent); });
  };
  MouseScreen.prototype.render = function () { var g = MC.Gui; this.game.drawScreenBackground(); g.textC('Mouse Settings', g.W / 2, 20, '#ffffff', true); this.renderWidgets(); };
  MouseScreen.prototype.onClose = function () { Screen.prototype.onClose.call(this); MC.saveOptions(); };

  function KeyBindsScreen(game, parent) { Screen.call(this, game); this.parent = parent; }
  extend(KeyBindsScreen, Screen);
  KeyBindsScreen.prototype.layout = function () { var g = MC.Gui, self = this; this.clear(); this.button(Math.floor(g.W / 2) - 100, g.H - 27, 200, 20, 'Done', function () { self.game.openScreen(self.parent); }); };
  KeyBindsScreen.prototype.render = function () {
    var g = MC.Gui, W = g.W; this.game.drawScreenBackground(); g.textC('Key Binds', W / 2, 8, '#ffffff', true);
    var binds = [['Attack/Destroy', 'Left Button'], ['Use Item/Place Block', 'Right Button'], ['Pick Block', 'Middle Button'], ['Walk Forwards', 'W'], ['Walk Backwards', 'S'], ['Strafe Left', 'A'], ['Strafe Right', 'D'], ['Jump', 'Space'], ['Sneak', 'Left Shift'], ['Sprint', 'Left Control'], ['Drop Selected Item', 'Q'], ['Hotbar Slots', '1 - 9'], ['Open/Close Inventory', 'E'], ['Swap Item With Offhand', 'F'], ['Open Chat', 'T'], ['Open Command', '/'], ['Toggle HUD', 'F1'], ['Toggle Debug Screen', 'F3'], ['Toggle Fullscreen', 'F11'], ['Game Menu', 'Escape']];
    var cx = Math.floor(W / 2);
    for (var i = 0; i < binds.length; i++) { var y = 26 + i * 10; g.text(binds[i][0], cx - 150, y, '#ffffff', true); g.textR(binds[i][1], cx + 150, y, '#a0a0a0', true); }
    this.renderWidgets();
  };

  function LanguageScreen(game, parent) { Screen.call(this, game); this.parent = parent; }
  extend(LanguageScreen, Screen); LanguageScreen.prototype.pausesGame = false;
  LanguageScreen.prototype.layout = function () { var g = MC.Gui, self = this; this.clear(); var fu = this.button(Math.floor(g.W / 2) - 155, g.H - 38, 150, 20, 'Force Unicode Font: OFF', null); fu.enabled = false; this.button(Math.floor(g.W / 2) + 5, g.H - 38, 150, 20, 'Done', function () { self.game.openScreen(self.parent); }); };
  LanguageScreen.prototype.render = function () {
    var g = MC.Gui, c = g.ctx, W = g.W, H = g.H; this.game.drawScreenBackground(); g.textC('Language', W / 2, 16, '#ffffff', true);
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, 32, W, H - 32 - 65);
    var langs = ['English (US)', 'English (UK)', 'Pirate Speak (The Seven Seas)', 'Deutsch (Deutschland)', 'Espanol (Espana)', 'Francais (France)', 'Italiano (Italia)', 'Portugues (Brasil)', 'Svenska (Sverige)', 'Nederlands (Nederland)', 'Polski (Polska)'];
    for (var i = 0; i < langs.length; i++) { var y = 36 + i * 18; if (y + 16 > H - 65) break; if (i === 0) { c.fillStyle = '#808080'; c.fillRect(W / 2 - 110, y - 2, 220, 18); c.fillStyle = '#000000'; c.fillRect(W / 2 - 109, y - 1, 218, 16); } g.textC(langs[i], W / 2, y + 3, i === 0 ? '#ffffff' : '#a0a0a0', true); }
    g.textC('(Language selection may not be 100% accurate)', W / 2, H - 56, '#808080', true);
    this.renderWidgets();
  };

  function AccessibilityScreen(game, parent) { Screen.call(this, game); this.parent = parent; }
  extend(AccessibilityScreen, Screen); AccessibilityScreen.prototype.pausesGame = false;
  AccessibilityScreen.prototype.layout = function () {
    var g = MC.Gui, W = g.W, H = g.H, self = this, O = MC.Options; this.clear(); var cx = Math.floor(W / 2), y = 40;
    var opts = [['Narrator: OFF', false], ['Subtitles: OFF', false], ['High Contrast: OFF', false], ['Auto-Jump: ' + (O.autoJump ? 'ON' : 'OFF'), true], ['Menu Background Blur: OFF', false], ['Darkness Pulsing: 100%', false], ['Damage Tilt: ' + Math.round(O.damageTilt * 100) + '%', true], ['Distortion Effects: 100%', false], ['FOV Effects: 100%', false], ['Screen Effect Scale: 100%', false]];
    for (var i = 0; i < opts.length; i++) (function (i) { var b = self.button((i % 2 === 0 ? cx - 155 : cx + 5), y + Math.floor(i / 2) * 24, 150, 20, opts[i][0], function () { if (opts[i][0].indexOf('Auto-Jump') === 0) { O.autoJump = !O.autoJump; self.game.applyOptions(); } if (opts[i][0].indexOf('Damage Tilt') === 0) { O.damageTilt = O.damageTilt > 0 ? 0 : 1; } self.layout(); }); b.enabled = opts[i][1]; })(i);
    this.button(cx - 100, H - 27, 200, 20, 'Done', function () { self.game.openScreen(self.parent); });
  };
  AccessibilityScreen.prototype.render = function () { var g = MC.Gui; this.game.drawScreenBackground(); g.textC('Accessibility Settings', g.W / 2, 20, '#ffffff', true); this.renderWidgets(); };
  AccessibilityScreen.prototype.onClose = function () { Screen.prototype.onClose.call(this); MC.saveOptions(); };

  // ---------------- Pause ----------------
  function PauseScreen(game) { Screen.call(this, game); }
  extend(PauseScreen, Screen);
  PauseScreen.prototype.layout = function () {
    var g = MC.Gui, W = g.W, H = g.H, self = this; this.clear(); var cx = Math.floor(W / 2), y = Math.floor(H / 4);
    this.button(cx - 102, y + 8, 204, 20, 'Back to Game', function () { self.game.closeScreen(); });
    var a = this.button(cx - 102, y + 32, 98, 20, 'Advancements', null); a.enabled = false; var s = this.button(cx + 4, y + 32, 98, 20, 'Statistics', null); s.enabled = false;
    var f = this.button(cx - 102, y + 56, 98, 20, 'Give Feedback', null); f.enabled = false; var r = this.button(cx + 4, y + 56, 98, 20, 'Report Bugs', null); r.enabled = false;
    this.button(cx - 102, y + 80, 98, 20, 'Options...', function () { self.game.openScreen(new OptionsScreen(self.game, self)); });
    var lan = this.button(cx + 4, y + 80, 98, 20, 'Open to LAN', null); lan.enabled = false;
    if (this.game.worldInfo.allowModeSwitch || this.game.worldInfo.gameMode === 'creative') {
      this.button(cx - 102, y + 104, 204, 20, function () { return 'Game Mode: ' + (self.game.player.isCreative() ? 'Creative' : 'Survival'); }, function () {
        var mode = self.game.player.isCreative() ? 'survival' : 'creative';
        self.game.player.setGameMode(mode); self.game.worldInfo.gameMode = mode;
        self.game.saveWorldInfo(self.game.worldInfo);
      }, 'Switch between Creative and Survival');
      this.button(cx - 102, y + 128, 204, 20, 'Save and Quit to Title', function () { self.game.saveAndQuit(); });
    } else this.button(cx - 102, y + 104, 204, 20, 'Save and Quit to Title', function () { self.game.saveAndQuit(); });
  };
  PauseScreen.prototype.render = function () { var g = MC.Gui; g.drawDim(); g.textC('Game Menu', g.W / 2, 40, '#ffffff', true); this.renderWidgets(); };
  PauseScreen.prototype.key = function (code) { if (code === 'Escape') { this.game.closeScreen(); return true; } return false; };

  // ---------------- Death ----------------
  function DeathScreen(game, hardcore) { Screen.call(this, game); this.t = 0; this.hardcore = hardcore; }
  extend(DeathScreen, Screen);
  DeathScreen.prototype.layout = function () {
    var g = MC.Gui, W = g.W, H = g.H, self = this; this.clear(); var cx = Math.floor(W / 2);
    this.respawn = this.button(cx - 100, Math.floor(H / 4) + 72, 200, 20, this.hardcore ? 'Spectate World' : 'Respawn', function () { self.game.respawn(); });
    this.title = this.button(cx - 100, Math.floor(H / 4) + 96, 200, 20, 'Title Screen', function () { self.game.saveAndQuit(); });
    this.respawn.enabled = false; this.title.enabled = false;
  };
  DeathScreen.prototype.tick = function (dt) { Screen.prototype.tick.call(this, dt); this.t += dt; if (this.t > 1) { this.respawn.enabled = true; this.title.enabled = true; } };
  DeathScreen.prototype.render = function () {
    var g = MC.Gui, c = g.ctx, W = g.W, H = g.H; g.gradient(0, 0, W, H, 'rgba(96,0,0,0.38)', 'rgba(128,48,48,0.63)');
    c.save(); c.translate(Math.floor(W / 2), 30); c.scale(2, 2); MC.Font.drawCentered(c, this.hardcore ? 'Game Over!' : 'You Died!', 0, 0, '#ffffff', true); c.restore();
    var src = this.game.player.deathSource; var msg = { fall: 'Player fell from a high place', drown: 'Player drowned', lava: 'Player tried to swim in lava', fire: 'Player burned to death', starve: 'Player starved to death', mob: 'Player was slain by ' + (this.game.lastAttacker || 'a monster'), explosion: 'Player was blown up by Creeper', cactus: 'Player was pricked to death', suffocate: 'Player suffocated in a wall', void: 'Player fell out of the world', magma: 'Player discovered the floor was lava', arrow: 'Player was shot by Skeleton' }[src] || 'Player died';
    g.textC(msg, W / 2, 85, '#ffffff', true);
    g.textC('Score: §e' + this.game.player.score, W / 2, 100, '#ffffff', true);
    this.renderWidgets();
  };
  DeathScreen.prototype.key = function () { return true; };

  // ---------------- Multiplayer / Realms ----------------
  function MultiplayerScreen(game, parent) { Screen.call(this, game); this.parent = parent; this.t = 0; }
  extend(MultiplayerScreen, Screen); MultiplayerScreen.prototype.pausesGame = false;
  MultiplayerScreen.prototype.layout = function () {
    var g = MC.Gui, W = g.W, H = g.H, self = this; this.clear(); var cx = Math.floor(W / 2);
    var j = this.button(cx - 154, H - 52, 100, 20, 'Join Server', null); j.enabled = false; var d = this.button(cx - 50, H - 52, 100, 20, 'Direct Connection', null); d.enabled = false; var a = this.button(cx + 54, H - 52, 100, 20, 'Add Server', null); a.enabled = false;
    var e = this.button(cx - 154, H - 28, 70, 20, 'Edit', null); e.enabled = false; var de = this.button(cx - 74, H - 28, 70, 20, 'Delete', null); de.enabled = false;
    this.button(cx + 4, H - 28, 70, 20, 'Refresh', function () { self.t = 0; });
    this.button(cx + 82, H - 28, 75, 20, 'Cancel', function () { self.game.openScreen(self.parent); });
  };
  MultiplayerScreen.prototype.tick = function (dt) { Screen.prototype.tick.call(this, dt); this.t += dt; };
  MultiplayerScreen.prototype.render = function () {
    var g = MC.Gui, c = g.ctx, W = g.W, H = g.H; g.drawBackground(); g.textC('Play Multiplayer', W / 2, 20, '#ffffff', true);
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, 32, W, H - 32 - 64);
    var y = 40; c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(W / 2 - 150, y, 300, 36);
    g.text('Scanning for games on your local network', W / 2 - 110, y + 6, '#ffffff', true);
    var dots = ['O o o', 'o O o', 'o o O', 'o O o'][Math.floor(this.t * 3) % 4]; g.text(dots, W / 2 - 110, y + 18, '#808080', true);
    g.textC('Multiplayer is not available in this recreation', W / 2, H - 78, '#a0a0a0', true);
    this.renderWidgets();
  };
  function RealmsScreen(game, parent) { Screen.call(this, game); this.parent = parent; }
  extend(RealmsScreen, Screen); RealmsScreen.prototype.pausesGame = false;
  RealmsScreen.prototype.layout = function () { var g = MC.Gui, self = this; this.clear(); var cx = Math.floor(g.W / 2); var b = this.button(cx - 155, g.H - 32, 150, 20, 'Create Realm', null); b.enabled = false; this.button(cx + 5, g.H - 32, 150, 20, 'Back', function () { self.game.openScreen(self.parent); }); };
  RealmsScreen.prototype.render = function () {
    var g = MC.Gui, c = g.ctx, W = g.W, H = g.H; g.drawBackground(); g.textC('Minecraft Realms', W / 2, 16, '#ffffff', true);
    c.drawImage(MC.Sprites.s.icon_realms, W / 2 - 6, 40);
    var lines = ['Realms is a safe, simple way to enjoy an online', 'Minecraft world with up to ten friends at a time.', '', 'Realms servers are not available in this fan recreation.', 'Play Singleplayer instead!'];
    for (var i = 0; i < lines.length; i++) g.textC(lines[i], W / 2, 64 + i * 12, i < 2 ? '#ffffff' : '#a0a0a0', true);
    this.renderWidgets();
  };

  MC.Screens = { TitleScreen: TitleScreen, SelectWorldScreen: SelectWorldScreen, CreateWorldScreen: CreateWorldScreen, OptionsScreen: OptionsScreen, VideoScreen: VideoScreen, SoundScreen: SoundScreen, ControlsScreen: ControlsScreen, PauseScreen: PauseScreen, DeathScreen: DeathScreen, MultiplayerScreen: MultiplayerScreen, RealmsScreen: RealmsScreen, LanguageScreen: LanguageScreen, AccessibilityScreen: AccessibilityScreen, ConfirmScreen: ConfirmScreen };
})();
