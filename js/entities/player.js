// Player: 20-TPS Minecraft-style physics, controls, inventory, health/hunger/xp, mining & placing.
(function () {
  var TICK = 1 / 20;

  function Inventory(size) { this.slots = []; for (var i = 0; i < size; i++) this.slots.push(null); }
  Inventory.prototype.maxStack = function (id) { var it = MC.ITEMS[id]; return it ? it.stack : 64; };
  Inventory.prototype.add = function (id, count, damage) {
    var max = this.maxStack(id); var left = count;
    // fill existing stacks (hotbar + main only)
    for (var i = 0; i < 36 && left > 0; i++) { var s = this.slots[i]; if (s && s.id === id && !s.damage && !damage && s.count < max) { var n = Math.min(max - s.count, left); s.count += n; left -= n; } }
    for (i = 0; i < 36 && left > 0; i++) { if (!this.slots[i]) { var n2 = Math.min(max, left); this.slots[i] = { id: id, count: n2, damage: damage || 0 }; left -= n2; } }
    return left;
  };
  Inventory.prototype.addStack = function (st) { if (!st) return 0; return this.add(st.id, st.count, st.damage); };
  Inventory.prototype.count = function (id) { var n = 0; for (var i = 0; i < 36; i++) if (this.slots[i] && this.slots[i].id === id) n += this.slots[i].count; return n; };
  Inventory.prototype.remove = function (id, count) { var left = count; for (var i = 0; i < 36 && left > 0; i++) { var s = this.slots[i]; if (s && s.id === id) { var n = Math.min(s.count, left); s.count -= n; left -= n; if (s.count <= 0) this.slots[i] = null; } } return count - left; };
  Inventory.prototype.take = function (i, n) { var s = this.slots[i]; if (!s) return null; n = Math.min(n, s.count); var out = { id: s.id, count: n, damage: s.damage }; s.count -= n; if (s.count <= 0) this.slots[i] = null; return out; };
  Inventory.prototype.isEmpty = function () { for (var i = 0; i < this.slots.length; i++) if (this.slots[i]) return false; return true; };
  Inventory.prototype.serialize = function () { return this.slots.map(function (s) { return s ? [s.id, s.count, s.damage || 0] : null; }); };
  Inventory.prototype.load = function (arr) { for (var i = 0; i < this.slots.length; i++) { var a = arr && arr[i]; this.slots[i] = a && MC.ITEMS[a[0]] ? { id: a[0], count: a[1], damage: a[2] || 0 } : null; } };

  function Player(world, game) {
    this.world = world; this.game = game;
    this.pos = new THREE.Vector3(0.5, 70, 0.5); this.prevPos = this.pos.clone(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; // radians; yaw 0 = looking -z (north)
    this.onGround = false; this.inWater = false; this.headInWater = false; this.inLava = false; this.sneaking = false; this.sprinting = false; this.flying = false;
    this.width = 0.6; this.height = 1.8; this.eyeHeight = 1.62;
    this.health = 20; this.maxHealth = 20; this.hunger = 20; this.saturation = 5; this.exhaustion = 0; this.air = 300; this.xp = 0; this.level = 0; this.totalXp = 0; this.score = 0;
    this.gameMode = 'survival'; this.dead = false; this.deathTime = 0;
    this.inventory = new Inventory(41); this.selected = 0;
    this.fallDist = 0; this.walkDist = 0; this.prevWalkDist = 0; this.nextStep = 1; this.bob = 0; this.prevBob = 0; this.jumpCooldown = 0; this.sprintToggle = false; this.collidedH = false;
    this.swing = 0; this.swinging = false; this.equip = 0; this.lastSelected = 0; this.lastHeldId = null;
    this.hurtTime = 0; this.hurtYaw = 0; this.invuln = 0; this.regenTimer = 0; this.foodTimer = 0; this.fireTicks = 0;
    this.mining = { target: null, progress: 0, cooldown: 0, sinceSound: 0 };
    this.useCooldown = 0; this.eating = 0; this.eatingItem = null; this.attackCooldown = 0;
    this.target = null; this.lastJumpTap = -10; this.lastForwardTap = -10; this.acc = 0; this.controlsEnabled = true; this.spawn = new THREE.Vector3(0.5, 70, 0.5);
    this.time = 0; this.armorPointsCache = 0; this.reach = 4.5; this.autoJump = false;
  }
  Player.prototype.setGameMode = function (m) { this.gameMode = m; if (m === 'survival') this.flying = false; this.reach = m === 'creative' ? 5 : 4.5; };
  Player.prototype.isCreative = function () { return this.gameMode === 'creative'; };
  Player.prototype.held = function () { return this.inventory.slots[this.selected]; };
  Player.prototype.getEyePos = function (alpha) { var p = this.renderPos(alpha === undefined ? 1 : alpha); p.y += this.eyeHeight; return p; };
  Player.prototype.renderPos = function (alpha) { return this.prevPos.clone().lerp(this.pos, alpha); };
  Player.prototype.getLookDir = function () { var cp = Math.cos(this.pitch); return new THREE.Vector3(-Math.sin(this.yaw) * cp, -Math.sin(this.pitch), -Math.cos(this.yaw) * cp); };
  Player.prototype.armorPoints = function () { var n = 0; for (var i = 36; i < 40; i++) { var s = this.inventory.slots[i]; if (s && MC.ITEMS[s.id] && MC.ITEMS[s.id].armor) n += MC.ITEMS[s.id].armor.points; } return n; };

  Player.prototype.look = function (dx, dy, sensitivity) {
    var f = sensitivity * 0.6 + 0.2; var k = f * f * f * 8 * 0.15 * (Math.PI / 180);
    this.yaw -= dx * k; this.pitch += dy * k; this.pitch = MC.clamp(this.pitch, -Math.PI / 2, Math.PI / 2);
  };

  // ---- per-frame update: interaction + fixed tick physics ----
  Player.prototype.update = function (dt, input, sensitivity) {
    this.time += dt;
    if (this.dead) { this.deathTime += dt; this.prevPos.copy(this.pos); return; }
    if (this.controlsEnabled && input.locked) {
      if (input.mouse.dx || input.mouse.dy) this.look(input.mouse.dx, input.mouse.dy, sensitivity);
      // double-tap detection runs per frame so quick taps are never missed between 20 TPS ticks
      if (input.pressed('forward')) {
        if (this.time - this.lastForwardTap < 0.35 && !this.sprintToggle) this.sprintToggle = true; // double-tap W = sprint while held
        this.lastForwardTap = this.time;
      }
      if (this.isCreative() && input.pressed('jump')) {
        if (this.time - this.lastJumpTap < 0.35) { this.flying = !this.flying; this.vel.y = 0; this.lastJumpTap = -10; }
        else this.lastJumpTap = this.time;
      }
    }
    this.acc += dt; var n = 0;
    while (this.acc >= TICK && n < 5) { this.acc -= TICK; this.tick(input); n++; }
    if (n >= 5) this.acc = 0;
    this.updateInteraction(dt, input);
    // swing animation (6 ticks)
    if (this.swinging) { this.swing += dt / 0.3; if (this.swing >= 1) { this.swing = 0; this.swinging = false; } }
    if (this.hurtTime > 0) this.hurtTime -= dt;
    // equip animation when held item changes
    var held = this.held(); var hid = held ? held.id : null;
    if (hid !== this.lastHeldId) { this.equip = 1; this.lastHeldId = hid; }
    if (this.equip > 0) this.equip = Math.max(0, this.equip - dt * 3.5);
    if (this.mining.cooldown > 0) this.mining.cooldown -= dt;
    if (this.useCooldown > 0) this.useCooldown -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
  };
  Player.prototype.alpha = function () { return MC.clamp(this.acc / TICK, 0, 1); };

  Player.prototype.tick = function (input) {
    this.prevPos.copy(this.pos); this.prevWalkDist = this.walkDist; this.prevBob = this.bob;
    var ctrl = this.controlsEnabled && input.locked;
    var fwd = 0, strafe = 0, jump = false, sneak = false;
    if (ctrl) {
      if (input.moveStick && input.moveStick.active) {
        fwd = input.moveStick.fwd;
        strafe = input.moveStick.strafe;
      } else {
        if (input.down('forward')) fwd += 1; if (input.down('back')) fwd -= 1; if (input.down('left')) strafe += 1; if (input.down('right')) strafe -= 1;
      }
      jump = input.down('jump'); sneak = input.down('sneak');
      if (fwd <= 0 || this.collidedH || sneak || (this.hunger <= 6 && !this.isCreative())) this.sprintToggle = false; // MC: releasing W, hitting a wall, sneaking or low hunger ends a double-tap sprint
      var wantSprint = (input.down('sprint') || this.sprintToggle) && fwd > 0 && (this.hunger > 6 || this.isCreative()) && !sneak;
      this.sprinting = wantSprint && !this.headInWater;
    } else { this.sprinting = false; this.sprintToggle = false; }
    this.sneaking = sneak && !this.flying;
    this.height = this.sneaking ? 1.5 : 1.8; this.eyeHeight = this.sneaking ? 1.27 : 1.62;
    // water state
    var feet = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.2), Math.floor(this.pos.z));
    var eye = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + this.eyeHeight), Math.floor(this.pos.z));
    var wasInWater = this.inWater;
    this.inWater = feet === MC.BLOCK.water.id || this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.8), Math.floor(this.pos.z)) === MC.BLOCK.water.id;
    this.headInWater = eye === MC.BLOCK.water.id;
    this.inLava = feet === MC.BLOCK.lava.id;
    if (this.inWater && !wasInWater && this.vel.y < -0.2) { MC.Audio.play('player.splash', { volume: Math.min(1, -this.vel.y) }); MC.Particles.splash(this.pos.x, Math.floor(this.pos.y + 0.2) + 0.9, this.pos.z, 12); }
    // input vector (normalized)
    var len = Math.sqrt(fwd * fwd + strafe * strafe); if (len > 1) { fwd /= len; strafe /= len; }
    var sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    var dirX = -sin * fwd - cos * strafe, dirZ = -cos * fwd + sin * strafe; // yaw 0 faces -z
    var speed = 0.1; if (this.sprinting) speed *= 1.3; if (this.sneaking) speed *= 0.3;
    var v = this.vel;
    if (this.flying) {
      var fs = this.sprinting ? 0.1 : 0.05;
      v.x += dirX * fs; v.z += dirZ * fs; v.x *= 0.91; v.z *= 0.91;
      var vy = jump ? 0.25 : (sneak ? -0.25 : 0); v.y += (vy - v.y) * 0.4;
      this.moveEntity(); this.fallDist = 0;
      if (this.onGround && !jump && !this.isCreative()) this.flying = false;
    } else if (this.inWater && !this.headInWater && false) {
    } else if (this.inWater || this.inLava) {
      var ws = this.inLava ? 0.01 : 0.02;
      v.x += dirX * ws; v.z += dirZ * ws;
      var startY = this.pos.y;
      this.moveEntity();
      v.x *= 0.8; v.z *= 0.8; v.y *= 0.8; v.y -= 0.02;
      if (jump) v.y += 0.04;
      // climb out of water onto a block
      if (this.collidedH && jump && this.canStepOut()) v.y = 0.3;
      this.fallDist = 0;
    } else {
      var friction = this.onGround ? 0.6 : 1.0; var f = friction * 0.91;
      var accel = this.onGround ? speed * (0.16277136 / (f * f * f)) : 0.02;
      if (this.sprinting && !this.onGround) accel = 0.026;
      v.x += dirX * accel; v.z += dirZ * accel;
      if (jump && this.onGround && this.jumpCooldown <= 0) { v.y = 0.42; if (this.sprinting) { v.x += -sin * 0.2; v.z += -cos * 0.2; } this.jumpCooldown = 10; this.addExhaustion(this.sprinting ? 0.2 : 0.05); MC.Audio.play('step.' + this.groundSound(), { volume: 0.4 }); }
      if (this.jumpCooldown > 0) this.jumpCooldown--;
      // sneaking edge protection
      if (this.sneaking && this.onGround) this.applySneakEdge();
      var y0 = this.pos.y;
      this.moveEntity();
      var dy = this.pos.y - y0;
      v.y -= 0.08; v.y *= 0.98; v.x *= f; v.z *= f;
      if (this.onGround) { if (this.fallDist > 0) this.land(); this.fallDist = 0; }
      else if (dy < 0) this.fallDist -= dy;
    }
    if (Math.abs(v.x) < 0.003) v.x = 0; if (Math.abs(v.z) < 0.003) v.z = 0; if (Math.abs(v.y) < 0.003) v.y = 0;
    // walking distance / bobbing / steps
    var hx = this.pos.x - this.prevPos.x, hz = this.pos.z - this.prevPos.z; var hd = Math.sqrt(hx * hx + hz * hz);
    var moved = Math.min(1, hd / 0.22);
    this.bob += (moved * (this.onGround ? 1 : 0.4) * 0.1 - this.bob) * 0.4; // MC-like bob amount
    if (this.onGround || this.inWater) this.walkDist += hd * 0.6;
    if (this.walkDist > this.nextStep && this.onGround) { this.nextStep = Math.floor(this.walkDist) + 1; if (!this.inWater) MC.Audio.play('step.' + this.groundSound(), { volume: this.sneaking ? 0.15 : 0.35, pitch: 0.95 + Math.random() * 0.1 }); else MC.Audio.play('player.swim', { volume: 0.4 }); this.addExhaustion(this.sprinting ? 0.1 : 0.005); }
    // status
    this.tickStatus();
  };
  Player.prototype.groundSound = function () { var id = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.2), Math.floor(this.pos.z)); if (id <= 0) return 'stone'; var s = MC.BLOCKS[id].sound; return s === 'none' ? 'stone' : s; };
  Player.prototype.canStepOut = function () {
    var dir = this.getLookDir(); var x = Math.floor(this.pos.x + dir.x * 0.7), z = Math.floor(this.pos.z + dir.z * 0.7), y = Math.floor(this.pos.y + 0.6);
    var id = this.world.getBlock(x, y, z); var id2 = this.world.getBlock(x, y + 1, z);
    return id > 0 && MC.BLOCKS[id].solid && (id2 <= 0 || !MC.BLOCKS[id2].solid);
  };
  Player.prototype.applySneakEdge = function () {
    var w = this.width / 2, v = this.vel; var step = 0.05;
    function ground(self, x, z) { var boxes = []; self.world.collectBoxes(x - w, self.pos.y - 0.6, z - w, x + w, self.pos.y - 0.01, z + w, boxes); return boxes.length > 0; }
    if (v.x !== 0 && !ground(this, this.pos.x + v.x + Math.sign(v.x) * step, this.pos.z)) v.x = 0;
    if (v.z !== 0 && !ground(this, this.pos.x, this.pos.z + v.z + Math.sign(v.z) * step)) v.z = 0;
  };
  var boxes = [];
  Player.prototype.moveEntity = function () {
    var w = this.width / 2, h = this.height, p = this.pos, v = this.vel; var world = this.world;
    this.collidedH = false;
    var dy = v.y;
    world.collectBoxes(p.x - w, p.y + Math.min(0, dy) - 0.01, p.z - w, p.x + w, p.y + h + Math.max(0, dy), p.z + w, boxes);
    this.onGround = false;
    for (var i = 0; i < boxes.length; i++) { var b = boxes[i]; if (p.x + w <= b[0] || p.x - w >= b[3] || p.z + w <= b[2] || p.z - w >= b[5]) continue; if (dy < 0 && p.y >= b[4] - 1e-6 && p.y + dy < b[4]) { dy = b[4] - p.y; v.y = 0; this.onGround = true; } else if (dy > 0 && p.y + h <= b[1] + 1e-6 && p.y + h + dy > b[1]) { dy = b[1] - (p.y + h); v.y = 0; } }
    p.y += dy;
    if (Math.abs(dy) < 1e-9 && v.y <= 0) { // resting check
      world.collectBoxes(p.x - w, p.y - 0.05, p.z - w, p.x + w, p.y + 0.01, p.z + w, boxes);
      for (i = 0; i < boxes.length; i++) { b = boxes[i]; if (p.x + w <= b[0] || p.x - w >= b[3] || p.z + w <= b[2] || p.z - w >= b[5]) continue; if (Math.abs(p.y - b[4]) < 0.05) this.onGround = true; }
    }
    var dx = v.x;
    world.collectBoxes(p.x - w + Math.min(0, dx), p.y, p.z - w, p.x + w + Math.max(0, dx), p.y + h, p.z + w, boxes);
    for (i = 0; i < boxes.length; i++) { b = boxes[i]; if (p.y + h <= b[1] + 1e-6 || p.y >= b[4] - 1e-6 || p.z + w <= b[2] || p.z - w >= b[5]) continue; if (dx > 0 && p.x + w <= b[0] + 1e-6 && p.x + w + dx > b[0]) { dx = b[0] - (p.x + w); v.x = 0; this.collidedH = true; } else if (dx < 0 && p.x - w >= b[3] - 1e-6 && p.x - w + dx < b[3]) { dx = b[3] - (p.x - w); v.x = 0; this.collidedH = true; } }
    p.x += dx;
    var dz = v.z;
    world.collectBoxes(p.x - w, p.y, p.z - w + Math.min(0, dz), p.x + w, p.y + h, p.z + w + Math.max(0, dz), boxes);
    for (i = 0; i < boxes.length; i++) { b = boxes[i]; if (p.y + h <= b[1] + 1e-6 || p.y >= b[4] - 1e-6 || p.x + w <= b[0] || p.x - w >= b[3]) continue; if (dz > 0 && p.z + w <= b[2] + 1e-6 && p.z + w + dz > b[2]) { dz = b[2] - (p.z + w); v.z = 0; this.collidedH = true; } else if (dz < 0 && p.z - w >= b[5] - 1e-6 && p.z - w + dz < b[5]) { dz = b[5] - (p.z - w); v.z = 0; this.collidedH = true; } }
    p.z += dz;
    // auto-jump / step for 1-block ledges when enabled
    if (this.autoJump && this.collidedH && this.onGround && !this.sneaking && (Math.abs(this.vel.x) + Math.abs(this.vel.z) > 0 || true)) {
      var dir = this.getLookDir(); var fx = Math.floor(p.x + dir.x * 0.6), fz = Math.floor(p.z + dir.z * 0.6), fy = Math.floor(p.y + 0.5);
      var b1 = world.getBlock(fx, fy, fz), b2 = world.getBlock(fx, fy + 1, fz), b3 = world.getBlock(fx, fy + 2, fz);
      if (b1 > 0 && MC.BLOCKS[b1].solid && (b2 <= 0 || !MC.BLOCKS[b2].solid) && (b3 <= 0 || !MC.BLOCKS[b3].solid)) this.vel.y = 0.42;
    }
  };
  Player.prototype.land = function () {
    var dmg = Math.floor(this.fallDist - 3);
    if (this.fallDist > 1.5) MC.Audio.play('player.fall', { volume: Math.min(1, this.fallDist / 8) });
    if (dmg > 0 && !this.isCreative()) this.hurt(dmg, 'fall');
  };
  Player.prototype.addExhaustion = function (v) { if (this.isCreative()) return; this.exhaustion += v; if (this.exhaustion >= 4) { this.exhaustion -= 4; if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1); else this.hunger = Math.max(0, this.hunger - 1); } };
  Player.prototype.tickStatus = function () {
    if (this.invuln > 0) this.invuln--;
    if (this.isCreative()) { this.air = 300; return; }
    // regen / starvation
    if (this.hunger >= 18 && this.health < this.maxHealth) { this.regenTimer++; var interval = (this.hunger >= 20 && this.saturation > 0) ? 10 : 80; if (this.regenTimer >= interval) { this.regenTimer = 0; this.health = Math.min(this.maxHealth, this.health + 1); this.addExhaustion(6); } }
    else if (this.hunger <= 0) { this.regenTimer++; if (this.regenTimer >= 80) { this.regenTimer = 0; if (this.health > 1) this.hurt(1, 'starve'); } }
    else this.regenTimer = 0;
    // air
    if (this.headInWater) { this.air--; if (this.air <= -20) { this.air = 0; this.hurt(2, 'drown'); } }
    else this.air = Math.min(300, this.air + 4);
    // lava / fire
    if (this.inLava) { this.hurt(4, 'lava'); this.fireTicks = 300; }
    if (this.fireTicks > 0) { this.fireTicks--; if (this.fireTicks % 20 === 0) this.hurt(1, 'fire'); if (this.inWater) this.fireTicks = 0; }
    // cactus / magma contact
    var fx = Math.floor(this.pos.x), fz = Math.floor(this.pos.z), fy = Math.floor(this.pos.y);
    var below = this.world.getBlock(fx, Math.floor(this.pos.y - 0.05), fz);
    if (below === MC.BLOCK.magma_block.id && !this.sneaking && this.time % 1 < 0.05) this.hurt(1, 'magma');
    for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) { var id = this.world.getBlock(fx + dx, fy, fz + dz); if (id === MC.BLOCK.cactus.id) { var bx = fx + dx + 0.5, bz = fz + dz + 0.5; if (Math.abs(bx - this.pos.x) < 0.5 + this.width / 2 + 0.05 && Math.abs(bz - this.pos.z) < 0.5 + this.width / 2 + 0.05) { if (this.invuln <= 0) this.hurt(1, 'cactus'); } } }
    // suffocation
    var head = this.world.getBlock(fx, Math.floor(this.pos.y + this.eyeHeight), fz);
    if (head > 0 && MC.BLOCKS[head].opaque && MC.BLOCKS[head].fullCube && this.invuln <= 0) this.hurt(1, 'suffocate');
    // void
    if (this.pos.y < -10) this.hurt(4, 'void');
  };
  Player.prototype.hurt = function (amount, source, from, knock) {
    if (this.dead || this.isCreative()) return false;
    if (this.invuln > 0 && source !== 'void') return false;
    var armor = this.armorPoints(); if (source !== 'starve' && source !== 'drown' && source !== 'void' && source !== 'fire') amount = amount * (1 - Math.min(20, armor) * 0.04);
    amount = Math.max(0, amount);
    if (amount <= 0) return false;
    this.health -= amount; this.invuln = 10; this.hurtTime = 0.5; this.hurtYaw = (Math.random() - 0.5) * 2;
    MC.Audio.play('player.hurt');
    if (from) { var dx = this.pos.x - from.x, dz = this.pos.z - from.z; var d = Math.sqrt(dx * dx + dz * dz) || 1; var k = knock || 0.4; this.vel.x += dx / d * k; this.vel.z += dz / d * k; this.vel.y += 0.3; }
    this.addExhaustion(0.1);
    if (this.health <= 0) { this.health = 0; this.die(source); }
    return true;
  };
  Player.prototype.die = function (source) {
    this.dead = true; this.deathTime = 0; this.deathSource = source;
    if (this.game && this.game.onPlayerDeath) this.game.onPlayerDeath(source);
  };
  Player.prototype.respawn = function () {
    this.dead = false; this.health = 20; this.hunger = 20; this.saturation = 5; this.exhaustion = 0; this.air = 300; this.fireTicks = 0; this.vel.set(0, 0, 0); this.fallDist = 0;
    this.pos.copy(this.spawn); this.prevPos.copy(this.pos); this.xp = 0; this.level = 0; this.totalXp = 0;
  };
  Player.prototype.xpForLevel = function (L) { return L >= 30 ? 112 + (L - 30) * 9 : (L >= 15 ? 37 + (L - 15) * 5 : 7 + L * 2); };
  Player.prototype.addXP = function (n) { this.totalXp += n; this.score += n; this.xp += n / this.xpForLevel(this.level); while (this.xp >= 1) { this.xp = (this.xp - 1) * this.xpForLevel(this.level) / this.xpForLevel(this.level + 1); this.level++; MC.Audio.play('random.levelup'); } };
  Player.prototype.eat = function (item) { var f = MC.ITEMS[item.id].food; this.hunger = Math.min(20, this.hunger + f.hunger); this.saturation = Math.min(this.hunger, this.saturation + f.saturation); };

  // ---- interaction (per frame) ----
  Player.prototype.updateInteraction = function (dt, input) {
    var world = this.world; var eye = this.getEyePos(1); var dir = this.getLookDir();
    var hit = this.touchTarget || world.raycast(eye, dir, this.reach, false);
    this.target = hit;
    // entity target (mobs)
    this.targetMob = this.touchTargetMob || (MC.Mobs ? MC.Mobs.pick(eye, dir, hit ? hit.dist : 3.2) : null);
    if (!this.controlsEnabled || !input.locked) { this.mining.progress = 0; this.mining.target = null; this.eating = 0; return; }
    var m = input.mouse; var left = (m.buttons & 1) !== 0, right = (m.buttons & 4) !== 0, middle = (m.buttons & 2) !== 0;
    var held = this.held();
    // hotbar selection
    if (m.wheel) { this.selected = MC.mod(this.selected + m.wheel, 9); }
    for (var k = 1; k <= 9; k++) if (input.pressed('Digit' + k)) this.selected = k - 1;
    if (input.pressed('drop') && held) { var st = this.inventory.take(this.selected, input.down('ControlLeft') ? held.count : 1); this.game.dropItem(st); this.swingArm(); }
    if (input.pressed('swapHands')) { var t = this.inventory.slots[40]; this.inventory.slots[40] = this.inventory.slots[this.selected]; this.inventory.slots[this.selected] = t; }
    // attack mob
    if (left && this.targetMob && this.attackCooldown <= 0) {
      this.attackCooldown = 0.35; this.swingArm();
      var dmg = 1; if (held && MC.ITEMS[held.id] && MC.ITEMS[held.id].tool) dmg = MC.ITEMS[held.id].tool.damage; else if (held && MC.ITEMS[held.id].block >= 0) dmg = 1;
      var crit = this.fallDist > 0 && !this.onGround && !this.inWater; if (crit) dmg *= 1.5;
      this.targetMob.hurt(dmg, 'player', this.pos, this.sprinting ? 0.9 : 0.5);
      MC.Audio.play(crit ? 'player.attack.sweep' : 'player.attack');
      if (held && MC.ITEMS[held.id].tool) this.damageItem(this.selected, held.id === 'shears' ? 0 : 1);
      this.addExhaustion(0.1);
      this.mining.progress = 0; this.mining.target = null;
      return;
    }
    // mining
    if (left && hit && this.mining.cooldown <= 0) {
      var B = MC.BLOCKS[hit.id];
      var same = this.mining.target && this.mining.target.x === hit.x && this.mining.target.y === hit.y && this.mining.target.z === hit.z;
      if (!same) { this.mining.target = { x: hit.x, y: hit.y, z: hit.z }; this.mining.progress = 0; this.mining.sinceSound = 0.2; }
      if (!this.swinging) this.swingArm();
      if (this.isCreative()) { this.breakBlock(hit); this.mining.cooldown = 0.25; this.mining.target = null; }
      else if (B.hardness >= 0) {
        var time = this.breakTime(B, held);
        this.mining.progress += dt / time;
        this.mining.sinceSound += dt;
        if (this.mining.sinceSound >= 0.25 && time > 0.3) { this.mining.sinceSound = 0; MC.Audio.play('step.' + (B.sound === 'none' ? 'stone' : B.sound), { volume: 0.25, pitch: 0.5 }); MC.Particles.blockHit(hit.x, hit.y, hit.z, hit.face, hit.id); }
        if (this.mining.progress >= 1) { this.breakBlock(hit, held); this.mining.progress = 0; this.mining.target = null; this.mining.cooldown = 0.3; this.addExhaustion(0.005); }
      }
    } else if (!left) { this.mining.progress = 0; this.mining.target = null; }
    else if (left && !hit) { if (!this.swinging && input.pressed('MouseLeft')) this.swingArm(); }
    if (left && !hit) { var clicked = m.clicks.some(function (c) { return c.button === 0 && c.down; }); if (clicked) this.swingArm(); }
    // use / place
    if (right) {
      var pressedNow = m.clicks.some(function (c) { return c.button === 2 && c.down; });
      if (pressedNow && this.targetMob && MC.Mobs.interact(this.targetMob, this, held)) { this.swingArm(); this.useCooldown = 0.25; return; }
      if (held && MC.ITEMS[held.id].food && (this.hunger < 20 || this.isCreative())) {
        this.eating += dt; if (Math.floor(this.eating * 5) !== Math.floor((this.eating - dt) * 5)) MC.Audio.play('player.eat', { volume: 0.5 });
        if (this.eating >= 1.6) { this.eat(held); if (!this.isCreative()) this.inventory.take(this.selected, 1); this.eating = 0; MC.Audio.play('player.burp'); }
      } else if ((pressedNow || this.useCooldown <= 0) && hit) {
        if (this.useCooldown <= 0 || pressedNow) { this.useOnBlock(hit, held); this.useCooldown = 0.25; }
      } else if (pressedNow && held && MC.ITEMS[held.id].egg && !hit) {
        // Spawn eggs also work when aiming into open space: find the nearby ground.
        var aim = eye.clone().add(dir.clone().multiplyScalar(3)), sx = Math.floor(aim.x), sz = Math.floor(aim.z), sy = world.getTopSolid(sx, sz) + 1;
        if (sy > 0 && world.getBlock(sx, sy, sz) === 0) { this.game.spawnMob(MC.ITEMS[held.id].egg, new THREE.Vector3(sx + 0.5, sy, sz + 0.5)); if (!this.isCreative()) this.inventory.take(this.selected, 1); this.swingArm(); }
      } else if (pressedNow && held && (held.id === 'water_bucket' || held.id === 'lava_bucket') && !hit) { }
    } else this.eating = 0;
    if (middle && this.isCreative() && hit) { var pressedMid = m.clicks.some(function (c) { return c.button === 1 && c.down; }); if (pressedMid) this.pickBlock(hit); }
  };
  Player.prototype.swingArm = function () { this.swing = 0; this.swinging = true; };
  Player.prototype.breakTime = function (B, held) {
    var tool = held && MC.ITEMS[held.id] && MC.ITEMS[held.id].tool ? MC.ITEMS[held.id].tool : null;
    var mult = 1, canHarvest = true;
    if (B.tool && B.tool !== 'shears' && B.tool !== 'hoe') { if (tool && tool.type === B.tool) mult = tool.speed; if (B.tier > 0 && (!tool || tool.type !== B.tool || tool.tier < B.tier)) canHarvest = false; }
    else if (B.tool === 'shears' && tool && (tool.type === 'shears' || tool.type === 'sword')) mult = tool.type === 'shears' ? 15 : 1.5;
    else if (B.tool === 'hoe' && tool && tool.type === 'hoe') mult = tool.speed;
    if (tool && tool.type === 'sword' && (B.name === 'cobweb')) mult = 15;
    var dmg = mult / Math.max(0.01, B.hardness) / (canHarvest ? 30 : 100);
    if (this.headInWater) dmg /= 5; if (!this.onGround) dmg /= 5;
    var ticks = Math.ceil(1 / dmg); return Math.max(0.05, ticks / 20);
  };
  Player.prototype.canHarvest = function (B, held) {
    var tool = held && MC.ITEMS[held.id] && MC.ITEMS[held.id].tool ? MC.ITEMS[held.id].tool : null;
    if (B.tool && B.tier > 0) return !!(tool && tool.type === B.tool && tool.tier >= B.tier);
    return true;
  };
  Player.prototype.breakBlock = function (hit, held) {
    var world = this.world; var B = MC.BLOCKS[hit.id]; if (B.hardness < 0 && !this.isCreative()) return;
    var meta = world.getMeta(hit.x, hit.y, hit.z);
    world.setBlock(hit.x, hit.y, hit.z, 0, 0);
    MC.Audio.play('dig.' + (B.sound === 'none' ? 'stone' : B.sound), { pos: new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5) });
    MC.Particles.blockBreak(hit.x, hit.y, hit.z, hit.id);
    if (!this.isCreative()) {
      var drops = this.game.dropsFor(hit.id, held, this.canHarvest(B, held));
      for (var i = 0; i < drops.length; i++) this.game.spawnDrop(drops[i], new THREE.Vector3(hit.x + 0.5, hit.y + 0.3, hit.z + 0.5));
      if (held && MC.ITEMS[held.id].tool && B.hardness > 0) this.damageItem(this.selected, 1);
      var xp = { coal_ore: 1, diamond_ore: 5, emerald_ore: 5, lapis_ore: 3, redstone_ore: 3, copper_ore: 0, gold_ore: 0, iron_ore: 0 }[B.name]; if (xp) this.game.spawnXP(new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5), xp);
    }
    this.game.onBlockBroken(hit.x, hit.y, hit.z, hit.id, meta);
  };
  Player.prototype.damageItem = function (slot, n) {
    var s = this.inventory.slots[slot]; if (!s || this.isCreative()) return; var it = MC.ITEMS[s.id]; var dur = it.tool ? it.tool.durability : (it.armor ? it.armor.durability : 0); if (!dur) return;
    s.damage = (s.damage || 0) + n;
    if (s.damage >= dur) { this.inventory.slots[slot] = null; MC.Audio.play('item.break'); }
  };
  Player.prototype.intersectsBlock = function (x, y, z) { var w = this.width / 2; return !(this.pos.x + w <= x || this.pos.x - w >= x + 1 || this.pos.z + w <= z || this.pos.z - w >= z + 1 || this.pos.y + this.height <= y || this.pos.y >= y + 1); };
  Player.prototype.useOnBlock = function (hit, held) {
    var world = this.world; var B = MC.BLOCKS[hit.id];
    // interactive blocks
    if (!this.sneaking) {
      if (B.name === 'crafting_table') { this.game.openCrafting(); this.swingArm(); return; }
      if (B.name === 'furnace') { this.game.openFurnace(hit); this.swingArm(); return; }
      if (B.name === 'chest') { this.game.openChest(hit); this.swingArm(); return; }
      if (B.name === 'red_bed') { this.spawn.set(hit.x + 0.5, hit.y + 1, hit.z + 0.5); if (this.game.sky.isNight()) { this.game.sky.time = Math.floor(this.game.sky.time / 24000 + 1) * 24000 + 1000; this.game.chat.add('§7You slept through the night.'); } else this.game.chat.add('§7Respawn point set. You can only sleep at night.'); this.swingArm(); return; }
      if (B.name === 'tnt' && held && held.id === 'flint_and_steel') { world.setBlock(hit.x, hit.y, hit.z, 0, 0); this.game.primeTNT(hit.x, hit.y, hit.z); this.damageItem(this.selected, 1); this.swingArm(); return; }
    }
    if (!held) return;
    var it = MC.ITEMS[held.id]; if (!it) return;
    if (it.egg) { var p = new THREE.Vector3(hit.x + 0.5 + hit.face[0], hit.y + hit.face[1] * 1.0, hit.z + 0.5 + hit.face[2]); if (hit.face[1] > 0) p.y = hit.y + 1; this.game.spawnMob(it.egg, p); if (!this.isCreative()) this.inventory.take(this.selected, 1); this.swingArm(); return; }
    if (held.id === 'bucket') {
      var fl = world.raycast(this.getEyePos(1), this.getLookDir(), this.reach, true);
      if (fl && (fl.id === MC.BLOCK.water.id || fl.id === MC.BLOCK.lava.id)) { world.setBlock(fl.x, fl.y, fl.z, 0, 0); if (!this.isCreative()) { this.inventory.take(this.selected, 1); this.inventory.add(fl.id === MC.BLOCK.water.id ? 'water_bucket' : 'lava_bucket', 1); } MC.Audio.play('player.splash', { volume: 0.5 }); this.swingArm(); }
      return;
    }
    if (it.place) { var px = hit.x + hit.face[0], py = hit.y + hit.face[1], pz = hit.z + hit.face[2]; var cur = world.getBlock(px, py, pz); if (cur === 0 || MC.BLOCKS[cur].replaceable) { world.setBlock(px, py, pz, MC.BLOCK[it.place].id, 0); if (!this.isCreative()) { this.inventory.take(this.selected, 1); this.inventory.add('bucket', 1); } MC.Audio.play('player.splash', { volume: 0.5 }); this.swingArm(); } return; }
    if (held.id === 'flint_and_steel') { MC.Audio.play('fire.ignite'); this.damageItem(this.selected, 1); this.swingArm(); return; }
    if (held.id === 'bone_meal' && (B.name === 'grass_block')) { this.game.boneMeal(hit); if (!this.isCreative()) this.inventory.take(this.selected, 1); this.swingArm(); return; }
    if (it.tool && it.tool.type === 'hoe' && hit.face[1] > 0 && (B.name === 'grass_block' || B.name === 'dirt' || B.name === 'coarse_dirt')) { world.setBlock(hit.x, hit.y, hit.z, MC.BLOCK.farmland.id, 0); MC.Audio.play('dig.grass', { pos: hit.point }); this.damageItem(this.selected, 1); this.swingArm(); return; }
    if (held.id === 'wheat_seeds' && B.name === 'farmland' && hit.face[1] > 0 && world.getBlock(hit.x, hit.y + 1, hit.z) === 0) { world.setBlock(hit.x, hit.y + 1, hit.z, MC.BLOCK.wheat_crop.id, 0); if (!this.isCreative()) this.inventory.take(this.selected, 1); MC.Audio.play('dig.grass', { pos: hit.point, volume: 0.5 }); this.swingArm(); return; }
    if (it.tool && it.tool.type === 'shovel' && B.name === 'grass_block' && hit.face[1] > 0) { world.setBlock(hit.x, hit.y, hit.z, MC.BLOCK.dirt_path.id, 0); MC.Audio.play('dig.grass', { pos: hit.point }); this.damageItem(this.selected, 1); this.swingArm(); return; }
    if (it.tool && it.tool.type === 'axe' && (/_log$/).test(B.name)) { return; }
    if (it.block < 0) return;
    // place block
    var PB = MC.BLOCKS[it.block];
    var px2 = hit.x + hit.face[0], py2 = hit.y + hit.face[1], pz2 = hit.z + hit.face[2];
    if (B.replaceable) { px2 = hit.x; py2 = hit.y; pz2 = hit.z; }
    var cur2 = world.getBlock(px2, py2, pz2);
    if (cur2 < 0 || (cur2 !== 0 && !MC.BLOCKS[cur2].replaceable)) return;
    if (py2 < 0 || py2 >= MC.WORLD_HEIGHT) return;
    if (PB.solid && this.intersectsBlock(px2, py2, pz2)) return;
    if (MC.Mobs && PB.solid && MC.Mobs.anyIntersects(px2, py2, pz2)) return;
    var meta = 0;
    if (PB.model === 'torch' || PB.model === 'cross' || PB.model === 'petals' || PB.model === 'layer') {
      // needs support
      if (PB.model === 'torch') { if (hit.face[1] < 0) return; if (hit.face[1] === 0) { meta = hit.face[0] === 1 ? 1 : hit.face[0] === -1 ? 2 : hit.face[2] === 1 ? 3 : 4; var supp = world.getBlock(px2 - hit.face[0], py2, pz2 - hit.face[2]); if (supp <= 0 || !MC.BLOCKS[supp].opaque) return; } else { var below = world.getBlock(px2, py2 - 1, pz2); if (below <= 0 || !MC.BLOCKS[below].solid) return; } }
      else { var below2 = world.getBlock(px2, py2 - 1, pz2); if (below2 <= 0 || !MC.BLOCKS[below2].solid) return; if (PB.model === 'cross' && !B.replaceable && (PB.name.indexOf('sapling') >= 0 || PB.tint === 'grass' || (/tulip|dandelion|poppy|orchid|allium|bluet|daisy|cornflower|lily/).test(PB.name)) && !(MC.BLOCKS[below2].name === 'grass_block' || MC.BLOCKS[below2].name === 'dirt' || MC.BLOCKS[below2].name === 'podzol' || MC.BLOCKS[below2].name === 'coarse_dirt' || MC.BLOCKS[below2].name === 'moss_block')) return; if (PB.name === 'cactus' && !(MC.BLOCKS[below2].name === 'sand' || MC.BLOCKS[below2].name === 'red_sand' || MC.BLOCKS[below2].name === 'cactus')) return; if (PB.name === 'dead_bush' && !(MC.BLOCKS[below2].name === 'sand' || MC.BLOCKS[below2].name === 'red_sand' || MC.BLOCKS[below2].name === 'dirt' || MC.BLOCKS[below2].name === 'coarse_dirt' || MC.BLOCKS[below2].name === 'terracotta')) return; }
    }
    if (PB.hasMeta && (/_log$/).test(PB.name)) meta = hit.face[1] !== 0 ? 0 : (hit.face[0] !== 0 ? 1 : 2);
    if (PB.hasMeta && (PB.name === 'furnace' || PB.name === 'crafting_table' || PB.name === 'jack_o_lantern' || PB.name === 'carved_pumpkin' || PB.name === 'chest')) { var yaw = MC.mod(this.yaw, Math.PI * 2); var q = Math.round(yaw / (Math.PI / 2)) % 4; meta = [0, 1, 2, 3][q]; /* 0:+z(south) faces player looking north */ meta = q === 0 ? 0 : q === 1 ? 1 : q === 2 ? 2 : 3; }
    world.setBlock(px2, py2, pz2, PB.id, meta);
    MC.Audio.play('dig.' + (PB.sound === 'none' ? 'stone' : PB.sound), { pos: new THREE.Vector3(px2 + 0.5, py2 + 0.5, pz2 + 0.5), volume: 0.8, pitch: 0.8 });
    if (!this.isCreative()) this.inventory.take(this.selected, 1);
    this.swingArm();
    this.game.onBlockPlaced(px2, py2, pz2, PB.id);
  };
  Player.prototype.pickBlock = function (hit) {
    var B = MC.BLOCKS[hit.id]; var name = B.hidden ? (B.name === 'snowy_grass_block' ? 'grass_block' : null) : B.name; if (!name || !MC.ITEMS[name]) return;
    for (var i = 0; i < 9; i++) if (this.inventory.slots[i] && this.inventory.slots[i].id === name) { this.selected = i; return; }
    var empty = -1; for (i = 0; i < 9; i++) if (!this.inventory.slots[i]) { empty = i; break; }
    if (empty < 0) empty = this.selected;
    this.inventory.slots[empty] = { id: name, count: 1, damage: 0 }; this.selected = empty;
  };
  Player.prototype.serialize = function () {
    return { pos: [this.pos.x, this.pos.y, this.pos.z], yaw: this.yaw, pitch: this.pitch, health: this.health, hunger: this.hunger, saturation: this.saturation, xp: this.xp, level: this.level, totalXp: this.totalXp, inv: this.inventory.serialize(), selected: this.selected, gameMode: this.gameMode, flying: this.flying, spawn: [this.spawn.x, this.spawn.y, this.spawn.z], score: this.score };
  };
  Player.prototype.load = function (d) {
    if (!d) return; this.pos.set(d.pos[0], d.pos[1], d.pos[2]); this.prevPos.copy(this.pos); this.yaw = d.yaw || 0; this.pitch = d.pitch || 0; this.health = d.health; this.hunger = d.hunger; this.saturation = d.saturation; this.xp = d.xp || 0; this.level = d.level || 0; this.totalXp = d.totalXp || 0; this.inventory.load(d.inv); this.selected = d.selected || 0; this.setGameMode(d.gameMode || 'survival'); this.flying = !!d.flying; if (d.spawn) this.spawn.set(d.spawn[0], d.spawn[1], d.spawn[2]); this.score = d.score || 0;
  };
  MC.Player = Player; MC.Inventory = Inventory;
})();
