// Entities: block/item meshes, item drops, falling blocks, primed TNT, particles, explosions.
(function () {
  // ---------- single block geometry using chunk material attributes ----------
  var FACE = [
    { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.6 },
    { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.6 },
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
    { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5 },
    { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.8 },
    { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.8 }
  ];
  var UV = [[0, 1], [1, 1], [1, 0], [0, 0]], UVB = [[0, 0], [1, 0], [1, 1], [0, 1]];
  var geoCache = {};
  function blockGeometry(id, meta, light) {
    light = light === undefined ? 15 : light;
    var key = id + ':' + (meta || 0) + ':' + light; if (geoCache[key]) return geoCache[key];
    var B = MC.BLOCKS[id]; var pos = [], uv = [], data = [], col = [], idx = [], n = 0;
    var tint = [1, 1, 1];
    if (B.tint === 'grass') { var g = MC.BIOMES[1].grass; tint = [g[0] / 255, g[1] / 255, g[2] / 255]; }
    else if (B.tint === 'foliage') { var f = MC.BIOMES[1].foliage; tint = [f[0] / 255, f[1] / 255, f[2] / 255]; }
    else if (B.tint === 'water') { var w = MC.BIOMES[1].water; tint = [w[0] / 255, w[1] / 255, w[2] / 255]; }
    else if (MC.STATIC_TINT[B.tint]) { var s = MC.STATIC_TINT[B.tint]; tint = [s[0] / 255, s[1] / 255, s[2] / 255]; }
    function quad(v, uvs, layer, overlay, t, shade) {
      for (var i = 0; i < 4; i++) { pos.push(v[i][0] - 0.5, v[i][1] - 0.5, v[i][2] - 0.5); uv.push(uvs[i][0], uvs[i][1]); data.push(layer, overlay, B.anim ? MC.Tex.frames(B.faces[0]) : 1, light * 16); col.push(t[0], t[1], t[2], shade); }
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4;
    }
    if (B.model === 'cross') {
      var lay = MC.Tex.layer(B.faces[0]);
      quad([[0.15, 0, 0.15], [0.85, 0, 0.85], [0.85, 1, 0.85], [0.15, 1, 0.15]], UV, lay, 0, tint, 1);
      quad([[0.85, 0, 0.15], [0.15, 0, 0.85], [0.15, 1, 0.85], [0.85, 1, 0.15]], UV, lay, 0, tint, 1);
    } else if (B.model === 'torch') {
      var lay2 = MC.Tex.layer('torch');
      for (var f = 0; f < 6; f++) { var F = FACE[f]; var v = []; for (var k = 0; k < 4; k++) { var cc = F.c[k]; v.push([cc[0] ? 9 / 16 : 7 / 16, cc[1] ? 10 / 16 : 0, cc[2] ? 9 / 16 : 7 / 16]); } var r = (f === 2 || f === 3) ? [7 / 16, 0, 9 / 16, 2 / 16] : [7 / 16, 0, 9 / 16, 1]; quad(v, [[r[0], r[3]], [r[2], r[3]], [r[2], r[1]], [r[0], r[1]]], lay2, 0, tint, F.shade); }
    } else {
      var h = B.model === 'layer' ? 2 / 16 : (B.model === 'liquid' ? 0.875 : 1);
      var inset = B.model === 'cactus' ? 1 / 16 : 0;
      for (f = 0; f < 6; f++) {
        F = FACE[f]; v = [];
        for (k = 0; k < 4; k++) { cc = F.c[k]; v.push([cc[0] ? 1 - (F.n[0] ? inset : 0) : (F.n[0] ? inset : 0), cc[1] ? h : 0, cc[2] ? 1 - (F.n[2] ? inset : 0) : (F.n[2] ? inset : 0)]); }
        var layer = MC.Tex.layer(B.faces[f]), overlay = 0, t = tint;
        if (B.sideOverlay) { if (f === 3) t = [1, 1, 1]; else if (f !== 2) { overlay = MC.Tex.layer('grass_block_side_overlay'); } }
        else if (B.tint === 'grass' && f === 3) t = [1, 1, 1];
        if (B.hasMeta && (B.name === 'furnace' || B.name === 'crafting_table' || B.name === 'jack_o_lantern' || B.name === 'carved_pumpkin' || B.name === 'chest')) { layer = f === 4 ? MC.Tex.layer(B.faces[4]) : (f === 2 || f === 3 ? MC.Tex.layer(B.faces[f]) : MC.Tex.layer(B.faces[0])); }
        quad(v, f === 3 ? UVB : UV, layer, overlay, t, F.shade);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
    geo.setAttribute('aData', new THREE.BufferAttribute(new Float32Array(data), 4));
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(col), 4));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    geoCache[key] = geo; return geo;
  }
  function blockMaterialFor(id, mats) { var B = MC.BLOCKS[id]; return B.translucent ? mats.water : (B.cutout ? mats.cutout : mats.opaque); }
  function blockMesh(id, meta, mats) { return new THREE.Mesh(blockGeometry(id, meta), blockMaterialFor(id, mats)); }

  // ---------- extruded item sprite ----------
  var itemGeoCache = {}, itemTexCache = {};
  function itemTexture(name) {
    if (itemTexCache[name]) return itemTexCache[name];
    var cv = MC.ItemIcons.get(name) || MC.ItemIcons.get('missing');
    var tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false;
    itemTexCache[name] = tex; return tex;
  }
  function itemGeometry(name) {
    if (itemGeoCache[name]) return itemGeoCache[name];
    var cv = MC.ItemIcons.get(name) || MC.ItemIcons.get('missing');
    var d = cv.getContext('2d').getImageData(0, 0, 16, 16).data;
    function a(x, y) { if (x < 0 || y < 0 || x > 15 || y > 15) return 0; return d[(y * 16 + x) * 4 + 3]; }
    var pos = [], uv = [], col = [], idx = [], n = 0; var T = 1 / 16;
    // front and back quads (textured)
    pos.push(0, 0, T / 2, 1, 0, T / 2, 1, 1, T / 2, 0, 1, T / 2); uv.push(0, 1, 1, 1, 1, 0, 0, 0); idx.push(0, 1, 2, 0, 2, 3);
    pos.push(1, 0, -T / 2, 0, 0, -T / 2, 0, 1, -T / 2, 1, 1, -T / 2); uv.push(1, 1, 0, 1, 0, 0, 1, 0); idx.push(4, 5, 6, 4, 6, 7);
    for (var i = 0; i < 8; i++) col.push(1, 1, 1);
    n = 8;
    var start = idx.length;
    // edges (vertex colored)
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      if (a(x, y) < 128) continue;
      var r = d[(y * 16 + x) * 4] / 255, g = d[(y * 16 + x) * 4 + 1] / 255, b = d[(y * 16 + x) * 4 + 2] / 255;
      var x0 = x * T, x1 = x0 + T, y0 = 1 - (y + 1) * T, y1 = y0 + T;
      function q(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, sh) { pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz); for (var k = 0; k < 4; k++) { uv.push(0, 0); col.push(r * sh, g * sh, b * sh); } idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4; }
      if (a(x + 1, y) < 128) q(x1, y0, T / 2, x1, y0, -T / 2, x1, y1, -T / 2, x1, y1, T / 2, 0.8);
      if (a(x - 1, y) < 128) q(x0, y0, -T / 2, x0, y0, T / 2, x0, y1, T / 2, x0, y1, -T / 2, 0.8);
      if (a(x, y - 1) < 128) q(x0, y1, T / 2, x1, y1, T / 2, x1, y1, -T / 2, x0, y1, -T / 2, 1.0);
      if (a(x, y + 1) < 128) q(x0, y0, -T / 2, x1, y0, -T / 2, x1, y0, T / 2, x0, y0, T / 2, 0.6);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    geo.setIndex(idx);
    geo.addGroup(0, start, 0); geo.addGroup(start, idx.length - start, 1);
    geo.translate(-0.5, -0.5, 0);
    itemGeoCache[name] = geo; return geo;
  }
  var edgeMat = null;
  function itemMesh(name) {
    var tex = itemTexture(name);
    var m0 = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, fog: false });
    if (!edgeMat) edgeMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    var mesh = new THREE.Mesh(itemGeometry(name), [m0, edgeMat]);
    return mesh;
  }
  // mesh for any item stack (block → cube; flat block or item → sprite)
  function stackMesh(itemName, mats) {
    var it = MC.ITEMS[itemName]; if (!it) return itemMesh('missing');
    if (it.block >= 0) { var B = MC.BLOCKS[it.block]; if (!B.flat) return blockMesh(it.block, 0, mats); var g = new THREE.Group(); var f = MC.Tex.tileCanvas(B.faces[0]); var tex = new THREE.CanvasTexture(B.tint ? MC.Tex.tintedTileCanvas(B.faces[0], B.tint === 'grass' ? MC.BIOMES[1].grass : MC.BIOMES[1].foliage) : f); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, fog: false })); g.add(m); return g; }
    return itemMesh(itemName);
  }

  // ---------- entity manager ----------
  function Entities(world, scene, mats) { this.world = world; this.scene = scene; this.mats = mats; this.list = []; this.game = null; }
  Entities.prototype.add = function (e) { this.list.push(e); if (e.mesh) this.scene.add(e.mesh); return e; };
  Entities.prototype.remove = function (e) { var i = this.list.indexOf(e); if (i >= 0) this.list.splice(i, 1); if (e.mesh) this.scene.remove(e.mesh); e.dead = true; };
  Entities.prototype.update = function (dt, player, dayLight) {
    for (var i = this.list.length - 1; i >= 0; i--) { var e = this.list[i]; e.update(dt, player, this); if (e.dead) this.remove(e); else if (e.mesh) { var br = this.world.brightnessAt(e.pos.x, e.pos.y + 0.5, e.pos.z, dayLight); if (e.setLight) e.setLight(br); } }
  };
  Entities.prototype.clear = function () { for (var i = this.list.length - 1; i >= 0; i--) this.remove(this.list[i]); };
  // simple AABB physics for small entities (w = width, h = height), returns onGround
  var boxes = [];
  Entities.prototype.moveEntity = function (e, dt) {
    var w = e.width / 2, h = e.height;
    var p = e.pos, v = e.vel;
    // Y
    var dy = v.y * dt;
    this.world.collectBoxes(p.x - w, p.y + Math.min(0, dy), p.z - w, p.x + w, p.y + h + Math.max(0, dy), p.z + w, boxes);
    e.onGround = false;
    for (var i = 0; i < boxes.length; i++) { var b = boxes[i]; if (p.x + w <= b[0] || p.x - w >= b[3] || p.z + w <= b[2] || p.z - w >= b[5]) continue; if (dy < 0 && p.y >= b[4] && p.y + dy < b[4]) { dy = b[4] - p.y; v.y = 0; e.onGround = true; } else if (dy > 0 && p.y + h <= b[1] && p.y + h + dy > b[1]) { dy = b[1] - (p.y + h); v.y = 0; } }
    p.y += dy;
    // X
    var dx = v.x * dt;
    this.world.collectBoxes(p.x - w + Math.min(0, dx), p.y, p.z - w, p.x + w + Math.max(0, dx), p.y + h, p.z + w, boxes);
    for (i = 0; i < boxes.length; i++) { b = boxes[i]; if (p.y + h <= b[1] || p.y >= b[4] || p.z + w <= b[2] || p.z - w >= b[5]) continue; if (dx > 0 && p.x + w <= b[0] && p.x + w + dx > b[0]) { dx = b[0] - (p.x + w); v.x = 0; } else if (dx < 0 && p.x - w >= b[3] && p.x - w + dx < b[3]) { dx = b[3] - (p.x - w); v.x = 0; } }
    p.x += dx;
    var dz = v.z * dt;
    this.world.collectBoxes(p.x - w, p.y, p.z - w + Math.min(0, dz), p.x + w, p.y + h, p.z + w + Math.max(0, dz), boxes);
    for (i = 0; i < boxes.length; i++) { b = boxes[i]; if (p.y + h <= b[1] || p.y >= b[4] || p.x + w <= b[0] || p.x - w >= b[3]) continue; if (dz > 0 && p.z + w <= b[2] && p.z + w + dz > b[2]) { dz = b[2] - (p.z + w); v.z = 0; } else if (dz < 0 && p.z - w >= b[5] && p.z - w + dz < b[5]) { dz = b[5] - (p.z - w); v.z = 0; } }
    p.z += dz;
    return e.onGround;
  };
  Entities.prototype.inWater = function (x, y, z) { var id = this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return id === MC.BLOCK.water.id; };

  // ---------- Item drop ----------
  function ItemDrop(ents, stack, pos, vel) {
    this.ents = ents; this.stack = stack; this.pos = pos.clone(); this.vel = vel ? vel.clone() : new THREE.Vector3((Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2);
    this.width = 0.25; this.height = 0.25; this.age = 0; this.pickupDelay = 0.5; this.onGround = false; this.dead = false;
    this.mesh = new THREE.Group(); this.inner = stackMesh(stack.id, ents.mats);
    var it = MC.ITEMS[stack.id]; var isBlock = it && it.block >= 0 && !MC.BLOCKS[it.block].flat;
    this.inner.scale.setScalar(isBlock ? 0.25 : 0.5); this.isBlock = isBlock;
    if (stack.count > 1 && isBlock) { var extra = stackMesh(stack.id, ents.mats); extra.scale.setScalar(0.25); extra.position.set(0.12, 0.08, 0.1); extra.rotation.y = 0.5; this.mesh.add(extra); }
    this.mesh.add(this.inner); this.spin = Math.random() * Math.PI * 2;
  }
  ItemDrop.prototype.update = function (dt, player, ents) {
    this.age += dt; this.pickupDelay -= dt;
    if (this.age > 300) { this.dead = true; return; }
    if (ents.inWater(this.pos.x, this.pos.y + 0.1, this.pos.z)) { this.vel.y += (1.5 - this.vel.y) * Math.min(1, dt * 4); this.vel.x *= 0.9; this.vel.z *= 0.9; }
    else this.vel.y -= 16 * dt;
    if (this.onGround) { this.vel.x *= Math.pow(0.05, dt); this.vel.z *= Math.pow(0.05, dt); }
    ents.moveEntity(this, dt);
    // escape from inside a block
    var bid = ents.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.1), Math.floor(this.pos.z));
    if (bid > 0 && MC.BLOCKS[bid].solid && MC.BLOCKS[bid].fullCube) this.pos.y += dt * 2;
    this.spin += dt * 1.5;
    var bob = Math.sin(this.age * 2) * 0.05 + 0.1;
    this.mesh.position.set(this.pos.x, this.pos.y + (this.isBlock ? 0.125 : 0.25) + bob, this.pos.z);
    this.mesh.rotation.y = this.spin;
    if (this.pickupDelay <= 0 && player && !player.dead) {
      var dx = player.pos.x - this.pos.x, dy = (player.pos.y + 0.9) - this.pos.y, dz = player.pos.z - this.pos.z;
      var d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 1.6 * 1.6) {
        var left = player.inventory.add(this.stack.id, this.stack.count, this.stack.damage);
        if (left < this.stack.count) { MC.Audio.play('random.pop', { pitch: 0.8 + Math.random() * 0.4 }); if (player.onPickup) player.onPickup(this); }
        if (left <= 0) this.dead = true; else this.stack.count = left;
      }
    }
  };
  ItemDrop.prototype.setLight = function (b) { this.mesh.traverse(function (o) { if (o.material && o.material.uniforms && o.material.uniforms.uLight) o.material.uniforms.uLight.value = b; }); };

  // ---------- XP orb ----------
  function XPOrb(ents, pos, value) {
    this.pos = pos.clone(); this.vel = new THREE.Vector3((Math.random() - 0.5) * 2, 2 + Math.random(), (Math.random() - 0.5) * 2); this.value = value; this.age = 0; this.width = 0.3; this.height = 0.3; this.dead = false;
    var geo = new THREE.PlaneGeometry(0.3, 0.3); var tex = XPOrb.texture || (XPOrb.texture = (function () { var c = document.createElement('canvas'); c.width = 8; c.height = 8; var x = c.getContext('2d'); x.fillStyle = '#7fe63f'; x.fillRect(1, 1, 6, 6); x.fillStyle = '#e8ffb0'; x.fillRect(2, 2, 2, 2); x.clearRect(0, 0, 1, 1); x.clearRect(7, 0, 1, 1); x.clearRect(0, 7, 1, 1); x.clearRect(7, 7, 1, 1); var t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t; })());
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: false })); this.onGround = false;
  }
  XPOrb.prototype.update = function (dt, player, ents) {
    this.age += dt; if (this.age > 120) { this.dead = true; return; }
    this.vel.y -= 12 * dt; if (this.onGround) { this.vel.x *= Math.pow(0.02, dt); this.vel.z *= Math.pow(0.02, dt); }
    if (player && !player.dead) { var dx = player.pos.x - this.pos.x, dy = player.pos.y + 0.9 - this.pos.y, dz = player.pos.z - this.pos.z; var d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < 7 && this.age > 0.4) { var k = (1 - d / 7); this.vel.x += dx / d * k * 30 * dt; this.vel.y += dy / d * k * 30 * dt; this.vel.z += dz / d * k * 30 * dt; } if (d < 0.9 && this.age > 0.4) { player.addXP(this.value); MC.Audio.play('random.orb', { pitch: 0.9 + Math.random() * 0.3 }); this.dead = true; return; } }
    ents.moveEntity(this, dt);
    this.mesh.position.set(this.pos.x, this.pos.y + 0.15, this.pos.z);
    if (player) this.mesh.lookAt(player.getEyePos());
    var hue = (this.age * 2) % 1; this.mesh.material.color.setHSL(0.25 + hue * 0.12, 1, 0.6);
  };

  // ---------- Falling block ----------
  function FallingBlock(ents, id, meta, x, y, z) {
    this.id = id; this.meta = meta; this.pos = new THREE.Vector3(x + 0.5, y, z + 0.5); this.vel = new THREE.Vector3(); this.width = 0.98; this.height = 0.98; this.dead = false; this.onGround = false; this.age = 0;
    this.mesh = blockMesh(id, meta, ents.mats);
  }
  FallingBlock.prototype.update = function (dt, player, ents) {
    this.age += dt; this.vel.y -= 16 * dt;
    ents.moveEntity(this, dt);
    this.mesh.position.set(this.pos.x, this.pos.y + 0.5, this.pos.z);
    if (this.onGround || this.age > 30) {
      var bx = Math.floor(this.pos.x), by = Math.round(this.pos.y), bz = Math.floor(this.pos.z);
      var cur = ents.world.getBlock(bx, by, bz);
      if (cur === 0 || (cur > 0 && MC.BLOCKS[cur].replaceable)) ents.world.setBlock(bx, by, bz, this.id, this.meta);
      else ents.add(new ItemDrop(ents, { id: MC.BLOCKS[this.id].name, count: 1 }, this.pos));
      MC.Audio.play('dig.' + MC.BLOCKS[this.id].sound, { pos: this.pos, volume: 0.5 });
      this.dead = true;
    }
  };

  // ---------- Primed TNT ----------
  function PrimedTNT(ents, x, y, z, fuse) {
    this.pos = new THREE.Vector3(x + 0.5, y, z + 0.5); this.vel = new THREE.Vector3((Math.random() - 0.5) * 0.4, 4, (Math.random() - 0.5) * 0.4); this.width = 0.98; this.height = 0.98; this.fuse = fuse || 4; this.dead = false; this.onGround = false;
    this.mesh = blockMesh(MC.BLOCK.tnt.id, 0, ents.mats); this.mesh.material = ents.mats.opaque.clone(); this.flash = 0;
    MC.Audio.play('fire.ignite', { pos: this.pos });
  }
  PrimedTNT.prototype.update = function (dt, player, ents) {
    this.fuse -= dt; this.vel.y -= 16 * dt; if (this.onGround) { this.vel.x *= 0.8; this.vel.z *= 0.8; }
    ents.moveEntity(this, dt);
    var s = 1 + Math.max(0, Math.sin(this.fuse * 12)) * 0.1;
    this.mesh.position.set(this.pos.x, this.pos.y + 0.5, this.pos.z); this.mesh.scale.setScalar(s);
    this.mesh.material.uniforms.uSkyLight.value = (Math.floor(this.fuse * 8) % 2 === 0) ? 3 : 1;
    if (this.fuse <= 0) { this.dead = true; ents.explode(this.pos.x, this.pos.y + 0.5, this.pos.z, 4, player); }
  };

  // ---------- Explosion ----------
  Entities.prototype.explode = function (x, y, z, power, player) {
    var world = this.world; var list = []; var self = this;
    var r = Math.ceil(power * 1.3);
    for (var dx = -r; dx <= r; dx++) for (var dy = -r; dy <= r; dy++) for (var dz = -r; dz <= r; dz++) {
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d > power * (0.9 + Math.random() * 0.4)) continue;
      var bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz;
      var id = world.getBlock(bx, by, bz); if (id <= 0) continue; var B = MC.BLOCKS[id];
      if (B.hardness < 0 || B.name === 'obsidian' || B.name === 'water' || B.name === 'lava') continue;
      if (B.name === 'tnt') { this.add(new PrimedTNT(this, bx, by, bz, 0.5 + Math.random())); list.push(bx, by, bz, 0, 0); continue; }
      list.push(bx, by, bz, 0, 0);
      if (Math.random() < 0.3 && B.drops) { var drops = MC.Game && MC.Game.dropsFor ? MC.Game.dropsFor(id, null) : []; for (var k = 0; k < drops.length; k++) this.add(new ItemDrop(this, drops[k], new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5))); }
    }
    if (list.length) world.setBlocks(list);
    MC.Audio.play('explode', { pos: new THREE.Vector3(x, y, z), volume: 1 });
    MC.Particles.explosion(x, y, z, power);
    // damage entities + player
    var center = new THREE.Vector3(x, y, z);
    function hit(e, pos, height) { var dd = pos.distanceTo(center) ; if (dd > power * 2) return; var impact = 1 - dd / (power * 2); var dmg = Math.floor((impact * impact + impact) * 7 * power + 1); var dir = pos.clone().sub(center).normalize(); if (e.hurt) e.hurt(dmg, 'explosion', center, impact * 2); }
    if (player && !player.dead) hit(player, player.pos.clone().add(new THREE.Vector3(0, 0.9, 0)));
    if (MC.Mobs) MC.Mobs.list.forEach(function (m) { hit(m, m.pos.clone().add(new THREE.Vector3(0, m.height / 2, 0))); });
    if (this.game && this.game.onExplosion) this.game.onExplosion(center, power);
  };

  // ---------- Particles (block fragments, smoke, explosion) using the texture array ----------
  function Particles(scene, texArray, shared) {
    this.max = 4000; this.n = 0; this.scene = scene;
    this.pos = new Float32Array(this.max * 3); this.uvo = new Float32Array(this.max * 2); this.layer = new Float32Array(this.max); this.size = new Float32Array(this.max); this.col = new Float32Array(this.max * 3);
    this.vel = new Float32Array(this.max * 3); this.life = new Float32Array(this.max); this.maxLife = new Float32Array(this.max); this.grav = new Float32Array(this.max); this.kind = new Uint8Array(this.max);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('aUV', new THREE.BufferAttribute(this.uvo, 2)); geo.setAttribute('aLayer', new THREE.BufferAttribute(this.layer, 1)); geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); geo.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3));
    geo.setDrawRange(0, 0);
    var mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uTex: { value: texArray }, uLight: { value: 1 }, uFogColor: shared.uFogColor, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar, uCamPos: shared.uCamPos, uScreenH: { value: 900 } },
      vertexShader: 'precision highp float; in vec2 aUV; in float aLayer; in float aSize; in vec3 aCol; out vec2 vUV; out float vLayer; out vec3 vCol; out float vFog; uniform vec3 uCamPos; uniform float uFogNear; uniform float uFogFar; uniform float uScreenH; void main(){ vUV = aUV; vLayer = aLayer; vCol = aCol; vec4 wp = modelMatrix * vec4(position,1.0); vFog = smoothstep(uFogNear, uFogFar, length(wp.xz - uCamPos.xz)); vec4 mv = viewMatrix * wp; gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScreenH / max(0.1, -mv.z); }',
      fragmentShader: 'precision highp float; precision highp sampler2DArray; uniform sampler2DArray uTex; uniform vec3 uFogColor; in vec2 vUV; in float vLayer; in vec3 vCol; in float vFog; out vec4 fragColor; void main(){ vec4 t = vLayer < 0.0 ? vec4(1.0) : texture(uTex, vec3(vUV + gl_PointCoord * 0.25, vLayer)); if (t.a < 0.5) discard; vec3 c = t.rgb * vCol; fragColor = vec4(mix(c, uFogColor, vFog), 1.0); }',
      transparent: false
    });
    this.points = new THREE.Points(geo, mat); this.points.frustumCulled = false; this.points.renderOrder = 3; scene.add(this.points);
    this.geo = geo; this.world = null;
  }
  Particles.prototype.spawn = function (x, y, z, vx, vy, vz, layer, u, v, size, life, grav, r, g, b, kind) {
    if (this.n >= this.max) return; var i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.layer[i] = layer; this.uvo[i * 2] = u; this.uvo[i * 2 + 1] = v; this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav; this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b; this.kind[i] = kind || 0;
  };
  Particles.prototype.blockBreak = function (x, y, z, id, count) {
    var B = MC.BLOCKS[id]; if (!B || id === 0) return; var layer = MC.Tex.layer(B.faces[0]);
    var tint = [1, 1, 1]; if (B.tint === 'grass' || B.tint === 'foliage') { var g = this.world ? this.world.getBiome(Math.floor(x), Math.floor(z))[B.tint] : MC.BIOMES[1][B.tint]; tint = [g[0] / 255, g[1] / 255, g[2] / 255]; } else if (MC.STATIC_TINT[B.tint]) { var s = MC.STATIC_TINT[B.tint]; tint = [s[0] / 255, s[1] / 255, s[2] / 255]; }
    if (B.sideOverlay) { layer = MC.Tex.layer('dirt'); tint = [1, 1, 1]; }
    var br = this.world ? this.world.brightnessAt(x, y, z, this.dayLight || 1) : 1;
    count = count || 24;
    for (var i = 0; i < count; i++) {
      var px = x + Math.random(), py = y + Math.random(), pz = z + Math.random();
      var vx = (px - x - 0.5) * 4 + (Math.random() - 0.5), vy = Math.random() * 3 + 1, vz = (pz - z - 0.5) * 4 + (Math.random() - 0.5);
      this.spawn(px, py, pz, vx, vy, vz, layer, Math.floor(Math.random() * 4) * 0.1875, Math.floor(Math.random() * 4) * 0.1875, 0.1 + Math.random() * 0.08, 0.6 + Math.random() * 0.8, 20, tint[0] * br, tint[1] * br, tint[2] * br, 1);
    }
  };
  Particles.prototype.blockHit = function (x, y, z, face, id) {
    var B = MC.BLOCKS[id]; if (!B || id === 0) return; var layer = MC.Tex.layer(B.faces[0]);
    var tint = [1, 1, 1]; if (B.tint === 'grass' || B.tint === 'foliage') { var g = this.world ? this.world.getBiome(Math.floor(x), Math.floor(z))[B.tint] : MC.BIOMES[1][B.tint]; tint = [g[0] / 255, g[1] / 255, g[2] / 255]; }
    if (B.sideOverlay) { layer = MC.Tex.layer('dirt'); tint = [1, 1, 1]; }
    var br = this.world ? this.world.brightnessAt(x, y, z, this.dayLight || 1) : 1;
    var px = x + 0.5 + face[0] * 0.55 + (face[0] ? 0 : (Math.random() - 0.5) * 0.8), py = y + 0.5 + face[1] * 0.55 + (face[1] ? 0 : (Math.random() - 0.5) * 0.8), pz = z + 0.5 + face[2] * 0.55 + (face[2] ? 0 : (Math.random() - 0.5) * 0.8);
    this.spawn(px, py, pz, face[0] * 2 + (Math.random() - 0.5), face[1] * 2 + Math.random() * 1.5, face[2] * 2 + (Math.random() - 0.5), layer, Math.floor(Math.random() * 4) * 0.1875, Math.floor(Math.random() * 4) * 0.1875, 0.08, 0.5 + Math.random() * 0.4, 20, tint[0] * br, tint[1] * br, tint[2] * br, 1);
  };
  Particles.prototype.explosion = function (x, y, z, power) {
    for (var i = 0; i < 60; i++) { var d = Math.random() * power; var a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2; var dx = Math.cos(a) * Math.cos(b), dy = Math.sin(b), dz = Math.sin(a) * Math.cos(b); var g = 0.3 + Math.random() * 0.5; this.spawn(x + dx * d, y + dy * d, z + dz * d, dx * 3, dy * 3 + 1, dz * 3, -1, 0, 0, 0.5 + Math.random() * 0.6, 0.8 + Math.random() * 1.2, 1.5, g, g, g, 2); }
    for (i = 0; i < 30; i++) { a = Math.random() * Math.PI * 2; this.spawn(x, y, z, Math.cos(a) * (2 + Math.random() * 6), Math.random() * 6, Math.sin(a) * (2 + Math.random() * 6), -1, 0, 0, 0.3, 0.5 + Math.random(), 6, 1, 1, 1, 2); }
  };
  Particles.prototype.smoke = function (x, y, z, n) { for (var i = 0; i < (n || 4); i++) { var g = 0.25 + Math.random() * 0.3; this.spawn(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, 0.8 + Math.random(), (Math.random() - 0.5) * 0.4, -1, 0, 0, 0.2 + Math.random() * 0.15, 1 + Math.random(), -0.5, g, g, g, 2); } };
  Particles.prototype.flame = function (x, y, z) { this.spawn(x, y, z, (Math.random() - 0.5) * 0.2, 0.3 + Math.random() * 0.3, (Math.random() - 0.5) * 0.2, -1, 0, 0, 0.12, 0.6 + Math.random() * 0.4, 0, 1, 0.75 + Math.random() * 0.25, 0.2, 2); };
  Particles.prototype.heart = function (x, y, z) { this.spawn(x, y, z, (Math.random() - 0.5), 1 + Math.random(), (Math.random() - 0.5), -1, 0, 0, 0.25, 1.2, -0.3, 1, 0.2, 0.3, 2); };
  Particles.prototype.splash = function (x, y, z, n) { for (var i = 0; i < n; i++) this.spawn(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), (Math.random() - 0.5) * 2, 2 + Math.random() * 3, (Math.random() - 0.5) * 2, -1, 0, 0, 0.12, 0.5 + Math.random() * 0.5, 16, 0.5, 0.7, 1, 2); };
  Particles.prototype.update = function (dt, world) {
    this.world = world;
    for (var i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { var last = --this.n; if (i !== last) { this.copy(last, i); } i--; continue; }
      var vi = i * 3;
      this.vel[vi + 1] -= this.grav[i] * dt;
      if (this.kind[i] === 1 && world) { // block fragments collide with ground
        var nx = this.pos[vi] + this.vel[vi] * dt, ny = this.pos[vi + 1] + this.vel[vi + 1] * dt, nz = this.pos[vi + 2] + this.vel[vi + 2] * dt;
        var id = world.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
        if (id > 0 && MC.BLOCKS[id].solid) { if (world.getBlock(Math.floor(this.pos[vi]), Math.floor(ny), Math.floor(this.pos[vi + 2])) > 0 && MC.BLOCKS[world.getBlock(Math.floor(this.pos[vi]), Math.floor(ny), Math.floor(this.pos[vi + 2]))].solid) { this.vel[vi + 1] = 0; ny = this.pos[vi + 1]; } this.vel[vi] *= 0.5; this.vel[vi + 2] *= 0.5; nx = this.pos[vi]; nz = this.pos[vi + 2]; }
        this.pos[vi] = nx; this.pos[vi + 1] = ny; this.pos[vi + 2] = nz;
        this.vel[vi] *= Math.pow(0.02, dt); this.vel[vi + 2] *= Math.pow(0.02, dt);
      } else {
        this.pos[vi] += this.vel[vi] * dt; this.pos[vi + 1] += this.vel[vi + 1] * dt; this.pos[vi + 2] += this.vel[vi + 2] * dt;
        this.vel[vi] *= Math.pow(0.1, dt); this.vel[vi + 2] *= Math.pow(0.1, dt); if (this.kind[i] === 2) this.vel[vi + 1] *= Math.pow(0.3, dt);
      }
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aUV.needsUpdate = true; this.geo.attributes.aLayer.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true; this.geo.attributes.aCol.needsUpdate = true;
    this.geo.setDrawRange(0, this.n);
  };
  Particles.prototype.copy = function (from, to) {
    for (var k = 0; k < 3; k++) { this.pos[to * 3 + k] = this.pos[from * 3 + k]; this.vel[to * 3 + k] = this.vel[from * 3 + k]; this.col[to * 3 + k] = this.col[from * 3 + k]; }
    this.uvo[to * 2] = this.uvo[from * 2]; this.uvo[to * 2 + 1] = this.uvo[from * 2 + 1]; this.layer[to] = this.layer[from]; this.size[to] = this.size[from]; this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from]; this.grav[to] = this.grav[from]; this.kind[to] = this.kind[from];
  };
  Particles.prototype.clear = function () { this.n = 0; this.geo.setDrawRange(0, 0); };

  MC.BlockMesh = { geometry: blockGeometry, mesh: blockMesh, materialFor: blockMaterialFor };
  MC.ItemMesh = { build: itemMesh, geometry: itemGeometry, texture: itemTexture, stackMesh: stackMesh };
  MC.Entities = Entities; MC.ItemDrop = ItemDrop; MC.XPOrb = XPOrb; MC.FallingBlock = FallingBlock; MC.PrimedTNT = PrimedTNT; MC.ParticlesClass = Particles;
})();
