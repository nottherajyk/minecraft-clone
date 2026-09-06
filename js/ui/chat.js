// Chat + slash commands.
(function () {
  function Chat(game) { this.game = game; this.messages = []; this.open = false; this.text = ''; this.history = []; this.histIdx = -1; this.caretT = 0; }
  Chat.prototype.add = function (text) { this.messages.push({ text: text, time: this.game.time }); if (this.messages.length > 100) this.messages.shift(); };
  Chat.prototype.openChat = function (prefill) {
    var self = this; this.open = true; this.text = prefill || ''; this.histIdx = -1;
    MC.Input.setTextTarget(function (ch) {
      if (ch === '\b') self.text = self.text.slice(0, -1);
      else if (ch === '\n') { self.submit(); }
      else if (ch === '\x1b') { self.close(); }
      else if (ch === '\x13') { if (self.history.length) { self.histIdx = self.histIdx < 0 ? self.history.length - 1 : Math.max(0, self.histIdx - 1); self.text = self.history[self.histIdx]; } }
      else if (ch === '\x14') { if (self.histIdx >= 0) { self.histIdx++; if (self.histIdx >= self.history.length) { self.histIdx = -1; self.text = ''; } else self.text = self.history[self.histIdx]; } }
      else if (ch === '\t') { self.autocomplete(); }
      else if (ch.length === 1 && ch >= ' ' && self.text.length < 256) self.text += ch;
    });
  };
  Chat.prototype.close = function () { this.open = false; MC.Input.setTextTarget(null); this.game.onChatClosed(); };
  Chat.prototype.submit = function () {
    var t = this.text.trim(); if (t) { this.history.push(t); if (t[0] === '/') this.execute(t.slice(1)); else this.add('<Player> ' + t); }
    this.close();
  };
  Chat.prototype.autocomplete = function () {
    var t = this.text; if (t[0] !== '/') return; var parts = t.slice(1).split(' ');
    if (parts.length === 1) { var cmds = Object.keys(COMMANDS).filter(function (c) { return c.indexOf(parts[0]) === 0; }); if (cmds.length === 1) this.text = '/' + cmds[0] + ' '; else if (cmds.length) this.add('§7' + cmds.join(', ')); }
    else if (parts[0] === 'give' || parts[0] === 'summon' || parts[0] === 'setblock') { var pre = parts[parts.length - 1]; var src = parts[0] === 'summon' ? Object.keys(MC.Mobs.TYPES) : Object.keys(MC.ITEMS); var m = src.filter(function (n) { return n.indexOf(pre) === 0; }); if (m.length === 1) { parts[parts.length - 1] = m[0]; this.text = '/' + parts.join(' ') + ' '; } else if (m.length) this.add('§7' + m.slice(0, 12).join(', ') + (m.length > 12 ? ' ...' : '')); }
  };
  var COMMANDS = {
    help: function (g, a, chat) { chat.add('§7Commands: /' + Object.keys(COMMANDS).join(', /') + '\n§7Time: /day, /night, /sunrise, /sunset, /noon, /midnight, or /time set <value>'); },
    time: function (g, a, chat) { var v = a[1]; var map = { day: 1000, noon: 6000, night: 13000, midnight: 18000, sunrise: 23000, sunset: 12000 }; if (map[a[0]] !== undefined) { v = a[0]; a[0] = 'set'; } if (a[0] === 'set') { var t = map[v] !== undefined ? map[v] : parseInt(v, 10); if (isNaN(t)) return chat.add('§cInvalid time'); g.sky.time = Math.floor(g.sky.time / 24000) * 24000 + t; chat.add('Set the time to ' + (map[v] !== undefined ? v : t)); } else if (a[0] === 'add') { g.sky.time += parseInt(v, 10) || 0; chat.add('Added ' + v + ' to the time'); } else if (a[0] === 'query') chat.add('The time is ' + Math.floor(g.sky.time % 24000)); else chat.add('§cUsage: /time <day|night|noon|midnight|ticks>, /time set <value>, /time add <ticks>, or /time query'); },
    day: function (g, a, chat) { COMMANDS.time(g, ['set', 'day'], chat); },
    night: function (g, a, chat) { COMMANDS.time(g, ['set', 'night'], chat); },
    sunrise: function (g, a, chat) { COMMANDS.time(g, ['set', 'sunrise'], chat); },
    sunset: function (g, a, chat) { COMMANDS.time(g, ['set', 'sunset'], chat); },
    noon: function (g, a, chat) { COMMANDS.time(g, ['set', 'noon'], chat); },
    midnight: function (g, a, chat) { COMMANDS.time(g, ['set', 'midnight'], chat); },
    gamemode: function (g, a, chat) { var m = { creative: 'creative', c: 'creative', '1': 'creative', survival: 'survival', s: 'survival', '0': 'survival', spectator: 'creative', adventure: 'survival' }[a[0]]; if (!m) return chat.add('§cUsage: /gamemode <survival|creative>'); g.player.setGameMode(m); chat.add('Set own game mode to ' + (m === 'creative' ? 'Creative' : 'Survival') + ' Mode'); },
    tp: function (g, a, chat) { if (a.length < 3) return chat.add('§cUsage: /tp <x> <y> <z>'); var p = g.player; function rel(s, cur) { if (s[0] === '~') return cur + (parseFloat(s.slice(1)) || 0); return parseFloat(s); } var x = rel(a[0], p.pos.x), y = rel(a[1], p.pos.y), z = rel(a[2], p.pos.z); if ([x, y, z].some(isNaN)) return chat.add('§cInvalid coordinates'); p.pos.set(x, y, z); p.prevPos.copy(p.pos); p.vel.set(0, 0, 0); chat.add('Teleported Player to ' + x.toFixed(2) + ', ' + y.toFixed(2) + ', ' + z.toFixed(2)); },
    give: function (g, a, chat) { var id = (a[0] || '').replace('minecraft:', ''); var n = parseInt(a[1], 10) || 1; if (!MC.ITEMS[id]) return chat.add('§cUnknown item: ' + id); var left = g.player.inventory.add(id, n, 0); chat.add('Gave ' + (n - left) + ' [' + MC.ITEMS[id].label + '] to Player'); },
    kill: function (g, a, chat) { g.player.hurt(1000, 'void'); chat.add('Killed Player'); },
    seed: function (g, a, chat) { chat.add('Seed: [' + g.worldInfo.seed + ']'); },
    summon: function (g, a, chat) { var t = (a[0] || '').replace('minecraft:', ''); if (!MC.Mobs.TYPES[t]) return chat.add('§cUnknown entity: ' + t); var p = g.player; var d = p.getLookDir(); var pos = p.pos.clone().add(new THREE.Vector3(d.x * 3, 0, d.z * 3)); pos.y = g.world.getTopSolid(Math.floor(pos.x), Math.floor(pos.z)) + 1; g.spawnMob(t, pos); chat.add('Summoned new ' + MC.Mobs.TYPES[t].name); },
    clear: function (g, a, chat) { var inv = g.player.inventory; var n = 0; for (var i = 0; i < inv.slots.length; i++) if (inv.slots[i]) { n += inv.slots[i].count; inv.slots[i] = null; } chat.add('Removed ' + n + ' item(s) from player Player'); },
    xp: function (g, a, chat) { var n = parseInt(a[0], 10) || 0; if ((a[1] || '').indexOf('level') >= 0 || /L$/.test(a[0] || '')) { g.player.level += n; chat.add('Given ' + n + ' experience levels to Player'); } else { g.player.addXP(n); chat.add('Given ' + n + ' experience points to Player'); } },
    difficulty: function (g, a, chat) { var d = a[0]; if (['peaceful', 'easy', 'normal', 'hard'].indexOf(d) < 0) return chat.add('The difficulty is ' + g.difficulty); g.difficulty = d; if (d === 'peaceful') MC.Mobs.list.filter(function (m) { return m.T.hostile; }).forEach(function (m) { m.dead = true; }); chat.add('The difficulty has been set to ' + d); },
    weather: function (g, a, chat) { chat.add('Weather is always clear in this world'); },
    setblock: function (g, a, chat) { if (a.length < 4) return chat.add('§cUsage: /setblock <x> <y> <z> <block>'); var p = g.player; function rel(s, cur) { if (s[0] === '~') return Math.floor(cur + (parseFloat(s.slice(1)) || 0)); return parseInt(s, 10); } var b = MC.BLOCK[a[3].replace('minecraft:', '')]; if (!b) return chat.add('§cUnknown block'); g.world.setBlock(rel(a[0], p.pos.x), rel(a[1], p.pos.y), rel(a[2], p.pos.z), b.id, 0); chat.add('Changed the block'); },
    spawnpoint: function (g, a, chat) { g.player.spawn.copy(g.player.pos); chat.add('Set spawn point to ' + Math.floor(g.player.pos.x) + ', ' + Math.floor(g.player.pos.y) + ', ' + Math.floor(g.player.pos.z)); },
    fly: function (g, a, chat) { g.player.flying = !g.player.flying; chat.add('Flying ' + (g.player.flying ? 'enabled' : 'disabled')); },
    heal: function (g, a, chat) { g.player.health = 20; g.player.hunger = 20; g.player.saturation = 5; chat.add('Healed Player'); },
    save: function (g, a, chat) { g.saveWorld(); chat.add('Saved the game'); },
    fps: function (g, a, chat) { chat.add('FPS: ' + Math.round(MC.Hud.fps)); }
  };
  Chat.prototype.execute = function (line) {
    var parts = line.trim().split(/\s+/); var cmd = parts.shift().toLowerCase();
    var fn = COMMANDS[cmd];
    if (!fn) return this.add('§cUnknown or incomplete command, see below for error\n§7' + cmd + '§c§o<--[HERE]');
    if (!this.game.worldInfo.cheats && ['gamemode', 'tp', 'give', 'time', 'day', 'night', 'sunrise', 'sunset', 'noon', 'midnight', 'summon', 'xp', 'setblock', 'fly', 'heal', 'difficulty', 'kill', 'clear', 'weather', 'spawnpoint'].indexOf(cmd) >= 0 && !this.game.player.isCreative()) return this.add('§cYou do not have permission to use this command (enable cheats in world settings)');
    try { fn(this.game, parts, this); } catch (e) { this.add('§cError: ' + e.message); }
  };
  Chat.prototype.render = function () {
    var g = MC.Gui, c = g.ctx, H = g.H, W = g.W; var now = this.game.time; this.caretT += 0.016;
    var lines = [];
    for (var i = this.messages.length - 1; i >= 0 && lines.length < 10; i--) {
      var m = this.messages[i]; var age = now - m.time; if (!this.open && age > 10) break;
      var wrapped = MC.Font.wrap(m.text, Math.min(320, W - 20)); for (var k = wrapped.length - 1; k >= 0; k--) lines.push({ text: wrapped[k], age: age });
    }
    var y0 = H - 40;
    for (i = 0; i < lines.length; i++) {
      var l = lines[i]; var a = this.open ? 1 : MC.clamp((10 - l.age) * 2, 0, 1); if (a <= 0) continue;
      var y = y0 - (i + 1) * 9; c.globalAlpha = a * 0.5; c.fillStyle = '#000000'; c.fillRect(0, y, Math.min(320, W - 20) + 4, 9); c.globalAlpha = a; g.text(l.text, 2, y + 1, '#ffffff', true);
    }
    c.globalAlpha = 1;
    if (this.open) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(2, H - 14, W - 4, 12); var shown = this.text; while (MC.Font.width(shown + '_') > W - 8 && shown.length) shown = shown.slice(1); g.text(shown + (Math.floor(this.caretT * 2) % 2 === 0 ? '_' : ''), 4, H - 12, '#ffffff', true); }
  };
  MC.Chat = Chat;
})();
