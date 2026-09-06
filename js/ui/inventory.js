// Inventory screens: survival inventory (Java layout), Bedrock-style creative inventory, crafting table, furnace, chest.
(function () {
  var Screen = MC.Screen;
  function extend(Sub, Base) { Sub.prototype = Object.create(Base.prototype); Sub.prototype.constructor = Sub; }

  // ---------------- Crafting ----------------
  function trimPattern(rows) {
    var minR = 99, maxR = -1, minC = 99, maxC = -1;
    for (var r = 0; r < rows.length; r++) for (var c = 0; c < rows[r].length; c++) if (rows[r][c] && rows[r][c] !== ' ') { minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c); }
    if (maxR < 0) return null;
    var out = []; for (r = minR; r <= maxR; r++) { var line = []; for (c = minC; c <= maxC; c++) line.push(rows[r][c] && rows[r][c] !== ' ' ? rows[r][c] : null); out.push(line); }
    return out;
  }
  var recipeCache = null;
  function prepared() {
    if (recipeCache) return recipeCache;
    recipeCache = MC.RECIPES.map(function (R) { var rows = R.pattern.map(function (s) { return s.split('').map(function (ch) { return ch === ' ' ? null : R.key[ch]; }); }); var t = trimPattern(rows); var m = t.map(function (row) { return row.slice().reverse(); }); return { t: t, m: m, result: R.result, count: R.count }; });
    return recipeCache;
  }
  function gridMatches(g, p) {
    if (g.length !== p.length || g[0].length !== p[0].length) return false;
    for (var r = 0; r < g.length; r++) for (var c = 0; c < g[0].length; c++) if ((g[r][c] || null) !== (p[r][c] || null)) return false;
    return true;
  }
  var Crafting = {
    match: function (stacks, size) { // stacks: array size*size of stack|null
      var rows = []; for (var r = 0; r < size; r++) { var line = []; for (var c = 0; c < size; c++) { var s = stacks[r * size + c]; line.push(s ? s.id : null); } rows.push(line); }
      var g = trimPattern(rows); if (!g) return null;
      var list = prepared();
      for (var i = 0; i < list.length; i++) { var R = list[i]; if (gridMatches(g, R.t) || gridMatches(g, R.m)) return { id: R.result, count: R.count }; }
      return null;
    }
  };
  MC.Crafting = Crafting;
  var FUEL = { coal: 80, charcoal: 80, coal_block: 800, lava_bucket: 1000, blaze_rod: 120, stick: 5, oak_planks: 15, spruce_planks: 15, birch_planks: 15, jungle_planks: 15, acacia_planks: 15, dark_oak_planks: 15, cherry_planks: 15, oak_log: 15, spruce_log: 15, birch_log: 15, jungle_log: 15, acacia_log: 15, dark_oak_log: 15, cherry_log: 15, crafting_table: 15, bookshelf: 15, chest: 15, oak_sapling: 5, birch_sapling: 5, spruce_sapling: 5, cherry_sapling: 5, bow: 15, fishing_rod: 15, wooden_sword: 10, wooden_pickaxe: 10, wooden_axe: 10, wooden_shovel: 10, wooden_hoe: 10, dead_bush: 5, white_wool: 5, hay_block: 15, note_block: 15, jukebox: 15, dried_kelp_block: 200, bamboo: 2.5 };
  MC.FUEL = FUEL;

  // ---------------- Player model preview ----------------
  var playerModel = null, skinTex = null;
  function getPlayerModel() {
    if (playerModel) return playerModel;
    skinTex = new THREE.CanvasTexture(MC.Sprites.s.skin); skinTex.magFilter = THREE.NearestFilter; skinTex.minFilter = THREE.NearestFilter; skinTex.colorSpace = THREE.SRGBColorSpace;
    var mat = new THREE.MeshBasicMaterial({ map: skinTex, alphaTest: 0.5 });
    var defs = [
      { name: 'head', size: [8, 8, 8], pos: [0, 28, 0], pivot: [0, 24, 0], uv: [0, 0] },
      { name: 'body', size: [8, 12, 4], pos: [0, 18, 0], uv: [16, 16] },
      { name: 'armR', size: [4, 12, 4], pos: [-6, 18, 0], pivot: [-6, 22, 0], uv: [40, 16] },
      { name: 'armL', size: [4, 12, 4], pos: [6, 18, 0], pivot: [6, 22, 0], uv: [32, 48] },
      { name: 'legR', size: [4, 12, 4], pos: [-2, 6, 0], pivot: [-2, 12, 0], uv: [0, 16] },
      { name: 'legL', size: [4, 12, 4], pos: [2, 6, 0], pivot: [2, 12, 0], uv: [16, 48] }
    ];
    var root = new THREE.Group(), parts = {};
    defs.forEach(function (d) {
      var geo = new THREE.BoxGeometry(d.size[0] / 16, d.size[1] / 16, d.size[2] / 16);
      MC.MobModel.boxUV(geo, 64, 64, d.uv[0], d.uv[1], d.size[0], d.size[1], d.size[2]);
      var piv = new THREE.Group(); var p = d.pivot || d.pos; piv.position.set(p[0] / 16, p[1] / 16, p[2] / 16);
      var m = new THREE.Mesh(geo, mat); m.position.set((d.pos[0] - p[0]) / 16, (d.pos[1] - p[1]) / 16, (d.pos[2] - p[2]) / 16); piv.add(m); root.add(piv); parts[d.name] = piv;
    });
    // simple shading via vertex colors is skipped; use a directional light-ish tint by material per face? keep flat.
    playerModel = { root: root, parts: parts }; return playerModel;
  }
  MC.PlayerModel = { get: getPlayerModel };

  // ---------------- Container base ----------------
  function ContainerScreen(game) { Screen.call(this, game); this.slots = []; this.cursor = null; this.px = 0; this.py = 0; this.pw = 176; this.ph = 166; this.title = ''; }
  extend(ContainerScreen, Screen);
  ContainerScreen.prototype.pausesGame = false;
  ContainerScreen.prototype.addSlot = function (x, y, area, get, set, extra) { var s = { x: x, y: y, area: area, get: get, set: set }; if (extra) Object.assign(s, extra); this.slots.push(s); return s; };
  ContainerScreen.prototype.invSlots = function (inv, mainY, hotbarY, ox) {
    ox = ox || 8; var self = this;
    for (var j = 0; j < 3; j++) for (var i = 0; i < 9; i++) (function (idx) { self.addSlot(ox + i * 18, mainY + j * 18, 'main', function () { return inv.slots[idx]; }, function (s) { inv.slots[idx] = s; }, { index: idx }); })(9 + j * 9 + i);
    for (i = 0; i < 9; i++) (function (idx) { self.addSlot(ox + i * 18, hotbarY, 'hotbar', function () { return inv.slots[idx]; }, function (s) { inv.slots[idx] = s; }, { index: idx }); })(i);
  };
  ContainerScreen.prototype.hoveredSlot = function () { var g = MC.Gui; for (var i = 0; i < this.slots.length; i++) { var s = this.slots[i]; if (s.hidden) continue; var sx = this.px + s.x, sy = this.py + s.y; if (g.mx >= sx - 1 && g.my >= sy - 1 && g.mx < sx + 17 && g.my < sy + 17) return s; } return null; };
  ContainerScreen.prototype.renderSlots = function () {
    var g = MC.Gui, c = g.ctx; var hov = this.hoveredSlot();
    for (var i = 0; i < this.slots.length; i++) { var s = this.slots[i]; if (s.hidden) continue; var st = s.get(); var sx = this.px + s.x, sy = this.py + s.y; if (st) g.drawItemStack(st, sx, sy, s.area === 'creative'); else if (s.ghost) { c.globalAlpha = 0.35; g.drawItemIcon(s.ghost, sx, sy); c.globalAlpha = 1; } if (s === hov) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(sx, sy, 16, 16); } }
    if (this.cursor) g.drawItemStack(this.cursor, Math.floor(g.mx) - 8, Math.floor(g.my) - 8);
    else if (hov && hov.get()) { var st2 = hov.get(); var lines = [g.itemLabel(st2)]; var it = MC.ITEMS[st2.id]; if (it && (it.tool || it.armor)) { var dur = it.tool ? it.tool.durability : it.armor.durability; lines.push('§7Durability: ' + (dur - (st2.damage || 0)) + ' / ' + dur); } if (it && it.food) lines.push('§7Restores ' + it.food.hunger / 2 + ' hunger'); if (MC.Hud.debug) lines.push('§8minecraft:' + st2.id); g.drawTooltip(lines, g.mx, g.my); }
  };
  function canMerge(a, b) { return a && b && a.id === b.id && !a.damage && !b.damage; }
  function maxStack(id) { var it = MC.ITEMS[id]; return it ? it.stack : 64; }
  ContainerScreen.prototype.canPlace = function (slot, stack) {
    if (slot.area === 'result' || slot.area === 'creative') return false;
    if (slot.area === 'armor') { var it = MC.ITEMS[stack.id]; return !!(it && it.armor && it.armor.slot === slot.armorSlot); }
    if (slot.area === 'fuel') return !!FUEL[stack.id] || stack.id === 'lava_bucket';
    if (slot.area === 'output') return false;
    return true;
  };
  ContainerScreen.prototype.clickSlot = function (slot, button, shift) {
    var cur = this.cursor, st = slot.get(); var self = this;
    if (slot.area === 'creative') {
      if (shift && st) { this.game.player.inventory.add(st.id, maxStack(st.id), 0); return; }
      if (button === 0) { if (cur) { if (canMerge(cur, st) && cur.count < maxStack(st.id)) cur.count = Math.min(maxStack(st.id), cur.count + 1); else this.cursor = st ? { id: st.id, count: maxStack(st.id), damage: 0 } : null; } else if (st) this.cursor = { id: st.id, count: maxStack(st.id), damage: 0 }; }
      else if (button === 2) { if (st) { if (canMerge(cur, st)) cur.count = Math.min(maxStack(st.id), cur.count + 1); else if (!cur) this.cursor = { id: st.id, count: 1, damage: 0 }; } }
      return;
    }
    if (slot.area === 'result') {
      if (!st) return;
      if (shift) { var guard = 0; while (slot.get() && guard++ < 64) { var r = slot.get(); if (this.game.player.inventory.add(r.id, r.count, 0) > 0) break; this.onCraft(slot); } this.onGridChange(); return; }
      if (cur && !(canMerge(cur, st) && cur.count + st.count <= maxStack(st.id))) return;
      if (cur) cur.count += st.count; else this.cursor = { id: st.id, count: st.count, damage: 0 };
      this.onCraft(slot); this.onGridChange(); return;
    }
    if (shift) { if (st) { this.quickMove(slot); this.onGridChange(); } return; }
    if (button === 0) {
      if (!cur) { if (st) { slot.set(null); this.cursor = st; } }
      else if (!st) { if (this.canPlace(slot, cur)) { if (slot.area === 'armor') { slot.set({ id: cur.id, count: 1, damage: cur.damage }); cur.count--; if (cur.count <= 0) this.cursor = null; } else { slot.set(cur); this.cursor = null; } } }
      else if (canMerge(cur, st) && this.canPlace(slot, cur)) { var mx = maxStack(st.id); var n = Math.min(mx - st.count, cur.count); st.count += n; cur.count -= n; if (cur.count <= 0) this.cursor = null; }
      else if (this.canPlace(slot, cur) && !(slot.area === 'armor')) { slot.set(cur); this.cursor = st; }
    } else if (button === 2) {
      if (!cur) { if (st) { var half = Math.ceil(st.count / 2); this.cursor = { id: st.id, count: half, damage: st.damage }; st.count -= half; if (st.count <= 0) slot.set(null); } }
      else if (!st) { if (this.canPlace(slot, cur)) { slot.set({ id: cur.id, count: 1, damage: cur.damage }); cur.count--; if (cur.count <= 0) this.cursor = null; } }
      else if (canMerge(cur, st) && st.count < maxStack(st.id) && this.canPlace(slot, cur)) { st.count++; cur.count--; if (cur.count <= 0) this.cursor = null; }
    }
    this.onGridChange();
  };
  // shift-click movement between areas
  ContainerScreen.prototype.quickMove = function (slot) {
    var st = slot.get(); if (!st) return; var inv = this.game.player.inventory;
    var it = MC.ITEMS[st.id];
    if ((slot.area === 'main' || slot.area === 'hotbar') && it && it.armor) { var idx = 36 + it.armor.slot; if (!inv.slots[idx]) { inv.slots[idx] = { id: st.id, count: 1, damage: st.damage }; st.count--; if (st.count <= 0) slot.set(null); return; } }
    if ((slot.area === 'main' || slot.area === 'hotbar') && this.containerSlots && this.containerSlots.length) { var left = this.putInto(this.containerSlots, st); if (left <= 0) slot.set(null); else st.count = left; return; }
    if (slot.area === 'main') { var l2 = this.putInto(this.slots.filter(function (s) { return s.area === 'hotbar'; }), st); if (l2 <= 0) slot.set(null); else st.count = l2; return; }
    if (slot.area === 'hotbar') { var l3 = this.putInto(this.slots.filter(function (s) { return s.area === 'main'; }), st); if (l3 <= 0) slot.set(null); else st.count = l3; return; }
    // from container/craft/armor/offhand -> inventory (main first then hotbar)
    var l4 = this.putInto(this.slots.filter(function (s) { return s.area === 'main'; }), st); if (l4 > 0) l4 = this.putInto(this.slots.filter(function (s) { return s.area === 'hotbar'; }), { id: st.id, count: l4, damage: st.damage });
    if (l4 <= 0) slot.set(null); else st.count = l4;
  };
  ContainerScreen.prototype.putInto = function (slots, st) {
    var left = st.count; var mx = maxStack(st.id);
    for (var i = 0; i < slots.length && left > 0; i++) { var t = slots[i].get(); if (t && canMerge(t, st) && t.count < mx && this.canPlace(slots[i], st)) { var n = Math.min(mx - t.count, left); t.count += n; left -= n; } }
    for (i = 0; i < slots.length && left > 0; i++) { if (!slots[i].get() && this.canPlace(slots[i], st)) { var n2 = slots[i].area === 'armor' ? 1 : Math.min(mx, left); slots[i].set({ id: st.id, count: n2, damage: st.damage }); left -= n2; } }
    return left;
  };
  ContainerScreen.prototype.onCraft = function (slot) { };
  ContainerScreen.prototype.onGridChange = function () { };
  ContainerScreen.prototype.mouseDown = function (x, y, button) {
    if (Screen.prototype.mouseDown.call(this, x, y, button)) return true;
    var slot = this.hoveredSlot();
    if (slot) { this.clickSlot(slot, button, MC.Input.down('ShiftLeft') || MC.Input.down('ShiftRight')); return true; }
    // click outside panel with cursor item -> drop / delete
    if (this.cursor && (x < this.px || y < this.py || x > this.px + this.pw || y > this.py + this.ph)) { if (this.game.player.isCreative() && this.deleteOutside) this.cursor = null; else { this.game.dropItem(this.cursor); this.cursor = null; } return true; }
    return false;
  };
  ContainerScreen.prototype.key = function (code) {
    if (code === 'KeyE' || code === 'Escape') { this.game.closeScreen(); return true; }
    var slot = this.hoveredSlot();
    if (slot && /^Digit[1-9]$/.test(code) && slot.area !== 'creative' && slot.area !== 'result') { var n = parseInt(code.slice(5), 10) - 1; var inv = this.game.player.inventory; var a = slot.get(), b = inv.slots[n]; if (slot.area === 'hotbar' && slot.index === n) return true; if (b && !this.canPlace(slot, b)) return true; slot.set(b || null); inv.slots[n] = a || null; this.onGridChange(); return true; }
    if (slot && /^Digit[1-9]$/.test(code) && slot.area === 'creative' && slot.get()) { var n2 = parseInt(code.slice(5), 10) - 1; var st = slot.get(); this.game.player.inventory.slots[n2] = { id: st.id, count: maxStack(st.id), damage: 0 }; return true; }
    if (code === 'KeyQ' && slot && slot.get() && slot.area !== 'creative' && slot.area !== 'result') { var s = slot.get(); var one = { id: s.id, count: 1, damage: s.damage }; s.count--; if (s.count <= 0) slot.set(null); this.game.dropItem(one); this.onGridChange(); return true; }
    return false;
  };
  ContainerScreen.prototype.onClose = function () {
    Screen.prototype.onClose.call(this);
    var inv = this.game.player.inventory;
    if (this.cursor) { if (inv.addStack(this.cursor) > 0 && !this.game.player.isCreative()) this.game.dropItem(this.cursor); this.cursor = null; }
    if (this.craftGrid) { for (var i = 0; i < this.craftGrid.length; i++) { var s = this.craftGrid[i]; if (s) { var left = inv.addStack(s); if (left > 0) this.game.dropItem({ id: s.id, count: left, damage: s.damage }); this.craftGrid[i] = null; } } }
  };
  ContainerScreen.prototype.render = function () { var g = MC.Gui; g.drawDim(); this.px = Math.floor((g.W - this.pw) / 2); this.py = Math.floor((g.H - this.ph) / 2); this.drawPanel(); this.renderSlots(); this.renderWidgets(); };
  ContainerScreen.prototype.drawPanel = function () { MC.Sprites.panel(MC.Gui.ctx, this.px, this.py, this.pw, this.ph); for (var i = 0; i < this.slots.length; i++) { var s = this.slots[i]; if (!s.hidden && s.area !== 'creative') MC.Sprites.slot(MC.Gui.ctx, this.px + s.x - 1, this.py + s.y - 1); } };

  // ---------------- Survival inventory ----------------
  function InventoryScreen(game) {
    ContainerScreen.call(this, game); var inv = game.player.inventory; var self = this;
    this.craftGrid = [null, null, null, null];
    for (var i = 0; i < 4; i++) (function (i) { self.addSlot(36 + i, 8 + i * 18, 'armor', function () { return inv.slots[36 + i]; }, function (s) { inv.slots[36 + i] = s; }, { armorSlot: i, ghost: ['leather_helmet', 'leather_chestplate', 'leather_leggings', 'leather_boots'][i] }); })(i);
    for (i = 0; i < 4; i++) (function (i) { self.addSlot(98 + (i % 2) * 18, 18 + Math.floor(i / 2) * 18, 'craft', function () { return self.craftGrid[i]; }, function (s) { self.craftGrid[i] = s; }); })(i);
    this.resultSlot = this.addSlot(154, 28, 'result', function () { return self.result; }, function (s) { self.result = s; });
    this.addSlot(77, 62, 'offhand', function () { return inv.slots[40]; }, function (s) { inv.slots[40] = s; }, { ghost: 'shield' });
    this.invSlots(inv, 84, 142);
    // reset armor slot x (defined above with wrong x) -> fix
    this.slots.forEach(function (s) { if (s.area === 'armor') { s.x = 8; s.y = 8 + s.armorSlot * 18; } });
    this.result = null; this.modelCanvas = null;
  }
  extend(InventoryScreen, ContainerScreen);
  InventoryScreen.prototype.onGridChange = function () { var r = Crafting.match(this.craftGrid, 2); this.result = r ? { id: r.id, count: r.count, damage: 0 } : null; };
  InventoryScreen.prototype.onCraft = function () { for (var i = 0; i < 4; i++) { var s = this.craftGrid[i]; if (s) { s.count--; if (s.count <= 0) this.craftGrid[i] = null; } } };
  InventoryScreen.prototype.drawPanel = function () {
    ContainerScreen.prototype.drawPanel.call(this);
    var g = MC.Gui, c = g.ctx, px = this.px, py = this.py;
    g.text('Crafting', px + 97, py + 8, '#404040', false);
    // arrow
    art(c, px + 133, py + 30, ['.......XX.......', '.......XXX......', 'XXXXXXXXXXX.....', 'XXXXXXXXXXXX....', 'XXXXXXXXXXX.....', '.......XXX......', '.......XX.......'], '#8b8b8b');
    // player preview
    c.fillStyle = '#000000'; c.fillRect(px + 26, py + 8, 51, 72);
    var model = getPlayerModel(); var mx = (g.mx - (px + 51)) / 30, my = (g.my - (py + 30)) / 30;
    model.parts.head.rotation.y = MC.clamp(mx * 0.8, -1, 1); model.parts.head.rotation.x = MC.clamp(my * 0.5, -0.6, 0.6);
    // The skin's face is on the -Z side; rotate the preview toward its +Z camera
    // so the inventory shows the player's face rather than the back-of-head hair.
    model.root.rotation.y = Math.PI + MC.clamp(mx * 0.3, -0.4, 0.4); model.root.position.set(0, 0, 0);
    var canvas = MC.IconRenderer.renderObject(model.root, 51 * g.S, 72 * g.S, new THREE.Vector3(0, 1.0, 3.6).add(new THREE.Vector3(0, 0, 0)), new THREE.Vector3(0, 1.0, 0), 1.05);
    c.drawImage(canvas, px + 26, py + 8, 51, 72);
  };
  function art(c, x, y, rows, col) { c.fillStyle = col; for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) if (rows[j][i] === 'X') c.fillRect(x + i, y + j, 1, 1); }

  // ---------------- Crafting table ----------------
  function CraftingScreen(game) {
    ContainerScreen.call(this, game); var inv = game.player.inventory; var self = this;
    this.craftGrid = [null, null, null, null, null, null, null, null, null];
    for (var i = 0; i < 9; i++) (function (i) { self.addSlot(30 + (i % 3) * 18, 17 + Math.floor(i / 3) * 18, 'craft', function () { return self.craftGrid[i]; }, function (s) { self.craftGrid[i] = s; }); })(i);
    this.addSlot(124, 35, 'result', function () { return self.result; }, function (s) { self.result = s; });
    this.invSlots(inv, 84, 142); this.result = null;
  }
  extend(CraftingScreen, ContainerScreen);
  CraftingScreen.prototype.onGridChange = function () { var r = Crafting.match(this.craftGrid, 3); this.result = r ? { id: r.id, count: r.count, damage: 0 } : null; };
  CraftingScreen.prototype.onCraft = function () { for (var i = 0; i < 9; i++) { var s = this.craftGrid[i]; if (s) { s.count--; if (s.count <= 0) this.craftGrid[i] = null; } } };
  CraftingScreen.prototype.drawPanel = function () { ContainerScreen.prototype.drawPanel.call(this); var g = MC.Gui, px = this.px, py = this.py; g.text('Crafting', px + 28, py + 6, '#404040', false); g.text('Inventory', px + 8, py + 72, '#404040', false); art(g.ctx, px + 90, py + 32, ['.......XX.......', '.......XXX......', 'XXXXXXXXXXX.....', 'XXXXXXXXXXXX....', 'XXXXXXXXXXX.....', '.......XXX......', '.......XX.......'], '#8b8b8b'); };

  // ---------------- Furnace ----------------
  function FurnaceScreen(game, state) {
    ContainerScreen.call(this, game); var inv = game.player.inventory; this.state = state; var self = this;
    this.addSlot(56, 17, 'input', function () { return state.slots[0]; }, function (s) { state.slots[0] = s; });
    this.addSlot(56, 53, 'fuel', function () { return state.slots[1]; }, function (s) { state.slots[1] = s; });
    this.addSlot(116, 35, 'output', function () { return state.slots[2]; }, function (s) { state.slots[2] = s; });
    this.invSlots(inv, 84, 142);
    this.containerSlots = this.slots.filter(function (s) { return s.area === 'input' || s.area === 'fuel'; });
  }
  extend(FurnaceScreen, ContainerScreen);
  FurnaceScreen.prototype.canPlace = function (slot, stack) { if (slot.area === 'input') return true; return ContainerScreen.prototype.canPlace.call(this, slot, stack); };
  FurnaceScreen.prototype.quickMove = function (slot) { var st = slot.get(); if ((slot.area === 'main' || slot.area === 'hotbar') && st) { var target = (FUEL[st.id] && !MC.SMELT[st.id]) ? this.slots.filter(function (s) { return s.area === 'fuel'; }) : this.slots.filter(function (s) { return s.area === 'input'; }); var left = this.putInto(target, st); if (left <= 0) slot.set(null); else st.count = left; return; } ContainerScreen.prototype.quickMove.call(this, slot); };
  FurnaceScreen.prototype.drawPanel = function () {
    ContainerScreen.prototype.drawPanel.call(this); var g = MC.Gui, c = g.ctx, px = this.px, py = this.py, st = this.state;
    g.textC('Furnace', px + 88, py + 6, '#404040', false); g.text('Inventory', px + 8, py + 72, '#404040', false);
    // fire
    var fire = ['......X......', '.....XXX.....', '.....XXX.....', '....XXXXX....', '...XXXXXXX...', '...XXXXXXX...', '..XXXXXXXXX..', '..XXXXXXXXX..', '.XXXXXXXXXXX.', '.XXXXXXXXXXX.', '.XXXXXXXXXXX.', '..XXXXXXXXX..', '...XXXXXXX...', '....XXXXX....'];
    art(c, px + 57, py + 36, fire, '#8b8b8b');
    if (st.burn > 0 && st.burnMax > 0) { var f = st.burn / st.burnMax; var rows = Math.round(f * 14); c.save(); c.beginPath(); c.rect(px + 57, py + 36 + (14 - rows), 14, rows); c.clip(); art(c, px + 57, py + 36, fire, '#ff9a1a'); c.restore(); }
    var arrow = ['..................XX....', '..................XXX...', '..................XXXX..', 'XXXXXXXXXXXXXXXXXXXXXXX.', 'XXXXXXXXXXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXXXXXXXXX.', '..................XXXX..', '..................XXX...', '..................XX....'];
    art(c, px + 79, py + 38, arrow, '#8b8b8b');
    if (st.progress > 0) { var w = Math.round(st.progress * 24); c.save(); c.beginPath(); c.rect(px + 79, py + 38, w, 9); c.clip(); art(c, px + 79, py + 38, arrow, '#ffffff'); c.restore(); }
  };

  // ---------------- Chest ----------------
  function ChestScreen(game, state) {
    ContainerScreen.call(this, game); var inv = game.player.inventory; var self = this; this.state = state;
    for (var j = 0; j < 3; j++) for (var i = 0; i < 9; i++) (function (idx) { self.addSlot(8 + (idx % 9) * 18, 18 + Math.floor(idx / 9) * 18, 'container', function () { return state.slots[idx]; }, function (s) { state.slots[idx] = s; }); })(j * 9 + i);
    this.invSlots(inv, 84, 142);
    this.containerSlots = this.slots.filter(function (s) { return s.area === 'container'; });
    MC.Audio.play('chest.open');
  }
  extend(ChestScreen, ContainerScreen);
  ChestScreen.prototype.drawPanel = function () { ContainerScreen.prototype.drawPanel.call(this); var g = MC.Gui, px = this.px, py = this.py; g.text('Chest', px + 8, py + 6, '#404040', false); g.text('Inventory', px + 8, py + 72, '#404040', false); };

  // ---------------- Creative (Bedrock-style tabs) ----------------
  var TABS = [
    { key: 'construction', label: 'Construction' }, { key: 'equipment', label: 'Equipment' }, { key: 'items', label: 'Items' }, { key: 'nature', label: 'Nature' }, { key: 'search', label: 'Search Items' }, { key: 'inventory', label: 'Inventory' }
  ];
  var ITEMS_TAB_EXTRA = ['torch', 'lantern_block', 'crafting_table', 'furnace', 'chest', 'bookshelf', 'jukebox', 'note_block', 'tnt', 'glowstone_lamp', 'spawner'];
  function CreativeScreen(game, tab) {
    ContainerScreen.call(this, game); this.tab = tab || 2; this.scroll = 0; this.search = ''; this.deleteOutside = true;
    this.cols = 17; this.rows = 7; this.pw = 332; this.ph = 160; this.tabH = 26; this.hotbarH = 24;
    this.rebuild();
  }
  extend(CreativeScreen, ContainerScreen);
  CreativeScreen.prototype.itemsFor = function () {
    var key = TABS[this.tab].key; var order = MC.ITEM_ORDER;
    if (key === 'search') { var q = this.search.toLowerCase(); return order.filter(function (n) { var it = MC.ITEMS[n]; return !q || it.label.toLowerCase().indexOf(q) >= 0 || n.indexOf(q) >= 0; }); }
    if (key === 'items') { var extra = ITEMS_TAB_EXTRA.filter(function (n) { return MC.ITEMS[n]; }); return extra.concat(order.filter(function (n) { return MC.ITEMS[n].tab === 'items'; })); }
    return order.filter(function (n) { var it = MC.ITEMS[n]; if (key === 'construction') return it.tab === 'construction' && ITEMS_TAB_EXTRA.indexOf(n) < 0; return it.tab === key; });
  };
  CreativeScreen.prototype.rebuild = function () {
    var self = this, inv = this.game.player.inventory; this.slots = []; this.clear();
    var g = MC.Gui;
    this.px = Math.floor((g.W - this.pw) / 2); var totalH = this.tabH + this.ph + 6 + this.hotbarH; this.py = Math.floor((g.H - totalH) / 2) + this.tabH;
    this.items = this.itemsFor(); var per = this.cols * this.rows; this.maxScroll = Math.max(0, Math.ceil(this.items.length / this.cols) - this.rows);
    this.scroll = MC.clamp(this.scroll, 0, this.maxScroll);
    var key = TABS[this.tab].key;
    if (key === 'inventory') {
      // survival-style layout inside the panel
      var ox = Math.floor((this.pw - 162) / 2), oy = 20;
      for (var i = 0; i < 4; i++) (function (i) { self.addSlot(ox, oy + i * 18, 'armor', function () { return inv.slots[36 + i]; }, function (s) { inv.slots[36 + i] = s; }, { armorSlot: i, ghost: ['leather_helmet', 'leather_chestplate', 'leather_leggings', 'leather_boots'][i] }); })(i);
      this.addSlot(ox + 162 - 18, oy + 54, 'offhand', function () { return inv.slots[40]; }, function (s) { inv.slots[40] = s; }, { ghost: 'shield' });
      for (var j = 0; j < 3; j++) for (i = 0; i < 9; i++) (function (idx) { self.addSlot(ox + (idx % 9) * 18, oy + 78 + Math.floor((idx - 9) / 9) * 18, 'main', function () { return inv.slots[idx]; }, function (s) { inv.slots[idx] = s; }, { index: idx }); })(9 + j * 9 + i);
      this.destroyBtn = null;
    } else {
      for (i = 0; i < per; i++) (function (i) { self.addSlot(7 + (i % self.cols) * 18, 26 + Math.floor(i / self.cols) * 18, 'creative', function () { var idx = i + self.scroll * self.cols; var n = self.items[idx]; return n ? { id: n, count: 1, damage: 0 } : null; }, function () { }); })(i);
    }
    // hotbar strip below the panel
    var hbx = Math.floor((this.pw - 174) / 2) + 6, hby = this.ph + 6 + 3;
    for (i = 0; i < 9; i++) (function (idx) { self.addSlot(hbx + idx * 18, hby, 'hotbar', function () { return inv.slots[idx]; }, function (s) { inv.slots[idx] = s; }, { index: idx }); })(i);
    if (key === 'search') { var f = this.field(this.px + this.pw - 110, this.py + 6, 100, 14, this.search, { maxLen: 32, onChange: function (t) { self.search = t; self.scroll = 0; self.rebuild(); self.setFocus(self.widgets[self.widgets.length - 1]); } }); this.searchField = f; }
  };
  CreativeScreen.prototype.onOpen = function () { this.rebuild(); if (this.searchField) this.setFocus(this.searchField); };
  CreativeScreen.prototype.layout = function () { this.rebuild(); };
  CreativeScreen.prototype.wheel = function (dir) { var g = MC.Gui; if (g.my < this.py || g.my > this.py + this.ph) return; this.scroll = MC.clamp(this.scroll + dir, 0, this.maxScroll); };
  CreativeScreen.prototype.tabRects = function () {
    var r = []; var x = this.px + 2;
    for (var i = 0; i < 4; i++) { r.push({ i: i, x: x, y: this.py - this.tabH, w: 30, h: this.tabH }); x += 32; }
    r.push({ i: 4, x: x + 22, y: this.py - this.tabH, w: 30, h: this.tabH });
    r.push({ i: 5, x: this.px + this.pw - 138, y: this.py - this.tabH, w: 30, h: this.tabH });
    return r;
  };
  CreativeScreen.prototype.mouseDown = function (x, y, button) {
    var tabs = this.tabRects();
    for (var i = 0; i < tabs.length; i++) { var t = tabs[i]; if (x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h) { this.tab = t.i; this.scroll = 0; MC.Audio.play('ui.click'); this.rebuild(); if (this.searchField) this.setFocus(this.searchField); return true; } }
    // close button
    if (x >= this.px + this.pw - 22 && x < this.px + this.pw - 4 && y >= this.py - this.tabH + 4 && y < this.py - 4) { MC.Audio.play('ui.click'); this.game.closeScreen(); return true; }
    // scrollbar
    if (this.maxScroll > 0 && x >= this.px + this.pw - 16 && x < this.px + this.pw - 4 && y >= this.py + 26 && y < this.py + 26 + 126) { var f = (y - (this.py + 26)) / 126; this.scroll = Math.round(f * this.maxScroll); return true; }
    return ContainerScreen.prototype.mouseDown.call(this, x, y, button);
  };
  CreativeScreen.prototype.key = function (code) { if (this.focus && code !== 'Escape') return false; return ContainerScreen.prototype.key.call(this, code); };
  CreativeScreen.prototype.render = function () {
    var g = MC.Gui, c = g.ctx; g.drawDim();
    this.px = Math.floor((g.W - this.pw) / 2); var totalH = this.tabH + this.ph + 6 + this.hotbarH; this.py = Math.floor((g.H - totalH) / 2) + this.tabH;
    // tabs
    var tabs = this.tabRects(); var S = MC.Sprites;
    // tab bar background
    c.fillStyle = '#1e1e1f'; c.fillRect(this.px, this.py - this.tabH, this.pw, this.tabH);
    c.fillStyle = '#c6c6c6'; c.fillRect(this.px + 1, this.py - this.tabH + 1, this.pw - 2, this.tabH - 1);
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i]; var sel = t.i === this.tab; var hov = g.hover(t.x, t.y, t.w, t.h);
      c.fillStyle = sel ? '#3fb84a' : (hov ? '#a8a8a8' : '#8b8b8b'); c.fillRect(t.x, t.y + 2, t.w, t.h - 2);
      c.fillStyle = sel ? '#2b8a33' : '#373737'; c.fillRect(t.x, t.y + 2, t.w, 1); c.fillRect(t.x, t.y + 2, 1, t.h - 2);
      c.fillStyle = sel ? '#7be085' : '#ffffff'; c.fillRect(t.x + t.w - 1, t.y + 2, 1, t.h - 2);
      var ix = t.x + 7, iy = t.y + 7;
      if (t.i === 0) g.drawItemIcon('bricks', ix, iy); else if (t.i === 1) { g.drawItemIcon('iron_pickaxe', ix + 1, iy - 1); g.drawItemIcon('iron_sword', ix - 1, iy + 1); } else if (t.i === 2) c.drawImage(S.s.icon_bed, ix, iy); else if (t.i === 3) { g.drawItemIcon('grass_block', ix, iy); c.drawImage(MC.Tex.tileCanvas('poppy'), ix + 4, iy - 5, 10, 10); } else if (t.i === 4) c.drawImage(S.s.icon_search, ix, iy); else g.drawItemIcon('chest', ix, iy);
      if (hov) this.tooltip = TABS[t.i].label;
    }
    // right side icon buttons: recipe book, two toggles, ?, X
    var rx = this.px + this.pw - 104;
    c.fillStyle = '#8b8b8b'; c.fillRect(rx, this.py - this.tabH + 3, 92, this.tabH - 5);
    c.drawImage(S.s.icon_book, rx + 3, this.py - this.tabH + 6);
    g.drawItemIcon('crafting_table', rx + 22, this.py - this.tabH + 6); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(rx + 22, this.py - this.tabH + 6, 16, 16);
    g.drawItemIcon('oak_planks', rx + 41, this.py - this.tabH + 6); c.fillRect(rx + 41, this.py - this.tabH + 6, 16, 16);
    g.textC('?', rx + 66, this.py - this.tabH + 9, '#ffffff', true);
    var closeHover = g.hover(this.px + this.pw - 22, this.py - this.tabH + 4, 18, this.tabH - 8);
    g.textC('x', this.px + this.pw - 13, this.py - this.tabH + 9, closeHover ? '#ffffa0' : '#ffffff', true);
    // main panel
    S.bedrockPanel(c, this.px, this.py, this.pw, this.ph);
    var key = TABS[this.tab].key;
    if (key !== 'search') g.textR(TABS[this.tab].label === 'Search Items' ? 'Items' : (key === 'inventory' ? 'Inventory' : TABS[this.tab].label), this.px + this.pw - 10, this.py + 8, '#404040', false);
    for (i = 0; i < this.slots.length; i++) { var s = this.slots[i]; if (s.area === 'creative') S.bedrockSlot(c, this.px + s.x - 1, this.py + s.y - 1); else if (s.area !== 'hotbar') S.slot(c, this.px + s.x - 1, this.py + s.y - 1); }
    if (key !== 'inventory') {
      // scrollbar
      var sx = this.px + this.pw - 16, sy = this.py + 26; c.fillStyle = '#5a5a5a'; c.fillRect(sx, sy, 12, 126); c.fillStyle = '#373737'; c.fillRect(sx, sy, 12, 1); c.fillRect(sx, sy, 1, 126);
      var hh = Math.max(15, Math.round(126 / (this.maxScroll + 1))); var hy = sy + Math.round((126 - hh) * (this.maxScroll ? this.scroll / this.maxScroll : 0));
      c.fillStyle = this.maxScroll ? '#c6c6c6' : '#8b8b8b'; c.fillRect(sx + 1, hy, 10, hh); c.fillStyle = this.maxScroll ? '#ffffff' : '#a0a0a0'; c.fillRect(sx + 1, hy, 10, 1); c.fillRect(sx + 1, hy, 1, hh); c.fillStyle = '#5a5a5a'; c.fillRect(sx + 10, hy, 1, hh); c.fillRect(sx + 1, hy + hh - 1, 10, 1);
    }
    // hotbar strip
    var hbw = 174, hbx = this.px + Math.floor((this.pw - hbw) / 2), hby = this.py + this.ph + 6;
    S.bedrockPanel(c, hbx, hby, hbw, this.hotbarH);
    for (i = 0; i < this.slots.length; i++) { s = this.slots[i]; if (s.area === 'hotbar') S.slot(c, this.px + s.x - 1, this.py + s.y - 1); }
    this.renderSlots(); this.renderWidgets();
    if (this.tooltip && !this.cursor && !this.hoveredSlot()) g.drawTooltip([this.tooltip], g.mx, g.my);
    this.tooltip = null;
  };
  CreativeScreen.prototype.drawPanel = function () { };

  MC.Inventory.Screens = { InventoryScreen: InventoryScreen, CreativeScreen: CreativeScreen, CraftingScreen: CraftingScreen, FurnaceScreen: FurnaceScreen, ChestScreen: ChestScreen, ContainerScreen: ContainerScreen };
})();
