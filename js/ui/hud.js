// In-game HUD: hotbar, hearts, hunger, armor, air, XP, item name, F3 debug overlay.
(function () {
  var itemNameTimer = 0, lastSelected = -1, lastHeld = null;
  var Hud = {
    hidden: false, debug: false, fps: 0,
    tick: function (dt, player) {
      var held = player.held(); var hid = held ? held.id : null;
      if (player.selected !== lastSelected || hid !== lastHeld) { if (hid) itemNameTimer = 2.5; lastSelected = player.selected; lastHeld = hid; }
      if (itemNameTimer > 0) itemNameTimer -= dt;
    },
    render: function (game) {
      var g = MC.Gui, c = g.ctx, W = g.W, H = g.H, S = MC.Sprites.s; var p = game.player;
      if (this.hidden) return;
      var cx = Math.floor(W / 2);
      // hotbar
      var hx = cx - 91, hy = H - 22;
      c.drawImage(S.hotbar, hx, hy);
      c.drawImage(S.hotbar_selection, hx - 1 + p.selected * 20, hy - 1);
      for (var i = 0; i < 9; i++) { var st = p.inventory.slots[i]; if (st) g.drawItemStack(st, hx + 3 + i * 20, hy + 3); }
      var off = p.inventory.slots[40]; if (off) { c.drawImage(S.offhand, hx - 29, H - 23); g.drawItemStack(off, hx - 26, H - 20); }
      var survival = !p.isCreative();
      if (survival) {
        // health
        var hp = Math.ceil(p.health), maxHp = p.maxHealth; var rows = Math.ceil(maxHp / 20);
        var lowShake = p.health <= 4;
        var regen = -1; if (p.hunger >= 18 && p.health < p.maxHealth) regen = Math.floor(game.time * 20 / 2) % 30;
        for (i = 0; i < 10; i++) {
          var x = cx - 91 + i * 8, y = H - 39;
          if (lowShake) y += (MC.hash3(i, Math.floor(game.time * 20), 3) % 3) - 1;
          if (regen === i) y -= 2;
          c.drawImage(S.heart_container, x, y);
          var v = i * 2;
          if (hp > v + 1) c.drawImage(S.heart_full, x, y); else if (hp > v) c.drawImage(S.heart_half, x, y);
        }
        // hunger (right to left)
        var hunger = p.hunger;
        for (i = 0; i < 10; i++) {
          x = cx + 91 - 9 - i * 8; y = H - 39;
          if (p.saturation <= 0 && Math.floor(game.time * 20) % 4 < 2 && hunger <= 6) y += (MC.hash3(i, Math.floor(game.time * 20), 9) % 3) - 1;
          c.drawImage(S.food_container, x, y);
          v = i * 2;
          if (hunger > v + 1) c.drawImage(S.food_full, x, y); else if (hunger > v) c.drawImage(S.food_half, x, y);
        }
        // armor
        var armor = p.armorPoints();
        if (armor > 0) for (i = 0; i < 10; i++) { x = cx - 91 + i * 8; y = H - 49; c.drawImage(S.armor_container, x, y); v = i * 2; if (armor > v + 1) c.drawImage(S.armor_full, x, y); else if (armor > v) c.drawImage(S.armor_half, x, y); }
        // air
        if (p.headInWater || p.air < 300) { var bubbles = Math.ceil((p.air - 2) * 10 / 300), pops = Math.ceil(p.air * 10 / 300) - bubbles; for (i = 0; i < bubbles + pops; i++) { x = cx + 91 - 9 - i * 8; y = H - 49; c.drawImage(i < bubbles ? S.bubble : S.bubble_pop, x, y); } }
        // xp bar
        var xb = cx - 91, xy = H - 29;
        c.drawImage(S.xp_bg, xb, xy);
        var fw = Math.floor(p.xp * 183); if (fw > 0) c.drawImage(S.xp_fill, 0, 0, Math.min(182, fw), 5, xb, xy, Math.min(182, fw), 5);
        if (p.level > 0) { var t = String(p.level); var tx = cx - Math.floor(MC.Font.width(t) / 2), ty = H - 35; MC.Font.draw(c, t, tx + 1, ty, '#000000', false); MC.Font.draw(c, t, tx - 1, ty, '#000000', false); MC.Font.draw(c, t, tx, ty + 1, '#000000', false); MC.Font.draw(c, t, tx, ty - 1, '#000000', false); MC.Font.draw(c, t, tx, ty, '#80ff20', false); }
      }
      // held item name
      if (itemNameTimer > 0) { var held = p.held(); if (held) { var a = MC.clamp(itemNameTimer * 4, 0, 1); c.globalAlpha = a; var name = MC.ITEMS[held.id] ? MC.ITEMS[held.id].label : held.id; g.textC(name, cx, H - 59 + (survival ? 0 : 14), '#ffffff', true); c.globalAlpha = 1; } }
      if (this.debug) this.renderDebug(game);
    },
    renderDebug: function (game) {
      var g = MC.Gui, c = g.ctx, p = game.player, W = g.W; var pos = p.pos;
      var yaw = MC.mod(p.yaw * 180 / Math.PI + 180, 360) - 180; // MC yaw: 0 south? keep simple
      var f = MC.mod(-p.yaw + Math.PI, Math.PI * 2); var dirs = ['south (Towards positive Z)', 'west (Towards negative X)', 'north (Towards negative Z)', 'east (Towards positive X)'];
      var facing = dirs[Math.floor(((f + Math.PI / 4) % (Math.PI * 2)) / (Math.PI / 2)) % 4];
      var bx = Math.floor(pos.x), by = Math.floor(pos.y), bz = Math.floor(pos.z); var light = game.world.getLight(bx, by, bz); var biome = game.world.getBiome(bx, bz);
      var lines = ['Minecraft ' + MC.VERSION + ' (' + MC.VERSION + '/vanilla)', Math.round(this.fps) + ' fps T: inf vsync fancy-clouds B: 2', 'C: ' + game.stats.chunksRendered + '/' + game.world.meshCount + ' (s) D: ' + game.world.renderDistance + ', pC: 000, pU: 00, aB: ' + game.world.pendingMesh, 'E: ' + (game.entities.list.length + MC.Mobs.list.length) + '/' + (game.entities.list.length + MC.Mobs.list.length), 'P: ' + game.particles.n + '. T: All: ' + MC.Mobs.list.length, 'Client Chunk Cache: ' + game.world.chunks.size + ', ' + game.world.meshCount, '', 'minecraft:overworld FC: 0', '', 'XYZ: ' + pos.x.toFixed(3) + ' / ' + pos.y.toFixed(5) + ' / ' + pos.z.toFixed(3), 'Block: ' + bx + ' ' + by + ' ' + bz + ' [' + (bx & 15) + ' ' + (by & 15) + ' ' + (bz & 15) + ']', 'Chunk: ' + (bx >> 4) + ' ' + (by >> 4) + ' ' + (bz >> 4) + ' [' + (bx & 15) + ' ' + (by & 15) + ' ' + (bz & 15) + ']', 'Facing: ' + facing + ' (' + (-yaw).toFixed(1) + ' / ' + (p.pitch * 180 / Math.PI).toFixed(1) + ')', 'Client Light: ' + Math.max(light.sky, light.block) + ' (' + light.sky + ' sky, ' + light.block + ' block)', 'Biome: minecraft:' + biome.name, 'Local Difficulty: 1.50 // 0.00 (Day ' + Math.floor(game.sky.time / 24000) + ')', 'Time: ' + Math.floor(game.sky.time % 24000) + ' ticks', 'Sounds: web audio synth'];
      for (var i = 0; i < lines.length; i++) { if (!lines[i]) continue; var w = MC.Font.width(lines[i]); c.fillStyle = 'rgba(80,80,80,0.5)'; c.fillRect(1, 1 + i * 9, w + 1, 9); g.text(lines[i], 2, 2 + i * 9, '#e0e0e0', false); }
      var mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : 'n/a';
      var right = ['JavaScript: ' + (navigator.userAgent.match(/Chrome\/[\d.]+/) || ['browser'])[0], 'Mem: ' + mem, 'CPU: ' + (navigator.hardwareConcurrency || '?') + 'x', '', 'Display: ' + g.pw + 'x' + g.ph + ' (' + game.rendererName + ')', 'WebGL2 / Three.js r' + THREE.REVISION, ''];
      if (p.target) { var B = MC.BLOCKS[p.target.id]; right.push('Targeted Block: ' + p.target.x + ', ' + p.target.y + ', ' + p.target.z, 'minecraft:' + B.name); var meta = game.world.getMeta(p.target.x, p.target.y, p.target.z); if (meta) right.push('meta: ' + meta); }
      if (p.targetMob) right.push('Targeted Entity: minecraft:' + p.targetMob.type, 'health: ' + p.targetMob.health);
      for (i = 0; i < right.length; i++) { if (!right[i]) continue; w = MC.Font.width(right[i]); c.fillStyle = 'rgba(80,80,80,0.5)'; c.fillRect(W - w - 3, 1 + i * 9, w + 1, 9); g.text(right[i], W - w - 2, 2 + i * 9, '#e0e0e0', false); }
    }
  };
  MC.Hud = Hud;
})();
