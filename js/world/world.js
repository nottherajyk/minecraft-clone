// Main-thread world: mirrors chunk data from the worker, owns chunk meshes, block queries, raycasts.
(function () {
  var H = 128;
  function idx(x, y, z) { return (((x << 4) | z) << 7) | y; }

  function World(scene, opts) {
    this.scene = scene; this.seed = opts.seed | 0; this.renderDistance = opts.renderDistance || 8;
    this.chunks = new Map(); this.worker = null; this.materials = null;
    this.center = { cx: NaN, cz: NaN };
    this.events = new MC.Emitter();
    this.pendingMesh = 0; this.pendingGen = 0; this.totalTarget = 1;
    this.meshCount = 0; this.edits = 0; this.timeUniform = 0;
    this.group = new THREE.Group(); scene.add(this.group);
    this.BLOCKS = MC.BLOCKS;
  }
  World.prototype.init = function (texArray) {
    this.materials = MC.Shaders.createChunkMaterials(texArray);
    var src = 'var ns = {};\n' + MC.Shared.map(function (f) { return '(' + f.toString() + ')(ns);'; }).join('\n') + '\n(' + MC.WorkerSource.toString() + ')(ns);';
    var blob = new Blob([src], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
    var self = this;
    this.worker.onmessage = function (e) { self.onMessage(e.data); };
    this.worker.onerror = function (e) { console.error('worker error', e.message, e.filename, e.lineno); };
    this.worker.postMessage({ type: 'init', seed: this.seed, texIndex: MC.Tex.indexMap(), frames: MC.Tex.FRAMES });
  };
  World.prototype.key = function (cx, cz) { return cx + ',' + cz; };
  World.prototype.onMessage = function (m) {
    var k;
    switch (m.type) {
      case 'chunk': {
        k = this.key(m.cx, m.cz); var c = this.chunks.get(k);
        if (!c) { c = { cx: m.cx, cz: m.cz, meshes: {}, light: null }; this.chunks.set(k, c); }
        c.blocks = new Uint8Array(m.blocks); c.meta = new Uint8Array(m.meta); c.heights = new Uint8Array(m.heights); c.biomes = new Uint8Array(m.biomes); c.topSolid = new Uint8Array(m.topSolid); c.villageSpawns = m.villageSpawns || null;
        // re-apply any local edits made before the chunk arrived (rare)
        this.events.emit('chunk', c);
        break;
      }
      case 'mesh': {
        k = this.key(m.cx, m.cz); c = this.chunks.get(k); if (!c) return;
        c.light = new Uint8Array(m.light);
        this.applyMesh(c, m.parts);
        this.events.emit('mesh', c);
        break;
      }
      case 'unload': {
        k = this.key(m.cx, m.cz); c = this.chunks.get(k); if (!c) return;
        this.disposeMeshes(c); this.chunks.delete(k); break;
      }
      case 'progress': this.pendingMesh = m.pending; this.pendingGen = m.gen; this.workerStats = m.stats; break;
      case 'blockChanged': {
        for (var i = 0; i < m.list.length; i += 5) {
          var x = m.list[i], y = m.list[i + 1], z = m.list[i + 2], id = m.list[i + 3], meta = m.list[i + 4];
          c = this.chunks.get(this.key(x >> 4, z >> 4)); if (!c || !c.blocks) continue;
          var bi = idx(x & 15, y, z & 15); var old = c.blocks[bi]; c.blocks[bi] = id; c.meta[bi] = meta;
          this.events.emit('blockChanged', { x: x, y: y, z: z, old: old, id: id });
        }
        break;
      }
      case 'query': console.log('query', m); break;
    }
  };
  World.prototype.disposeMeshes = function (c) {
    for (var k in c.meshes) { var mesh = c.meshes[k]; if (mesh) { this.group.remove(mesh); mesh.geometry.dispose(); } }
    c.meshes = {};
  };
  World.prototype.applyMesh = function (c, parts) {
    var wasMeshed = !!c.meshed;
    this.disposeMeshes(c);
    var mats = this.materials; var names = ['opaque', 'cutout', 'water']; var order = [0, 1, 2];
    var box = new THREE.Box3(new THREE.Vector3(c.cx * 16, 0, c.cz * 16), new THREE.Vector3(c.cx * 16 + 16, H, c.cz * 16 + 16));
    var sphere = new THREE.Sphere(); box.getBoundingSphere(sphere);
    for (var i = 0; i < names.length; i++) {
      var p = parts[names[i]]; if (!p) continue;
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(p.pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(p.uv, 2));
      geo.setAttribute('aData', new THREE.BufferAttribute(p.data, 4));
      geo.setAttribute('aColor', new THREE.BufferAttribute(p.col, 4));
      geo.setIndex(new THREE.BufferAttribute(p.idx, 1));
      geo.boundingBox = box; geo.boundingSphere = sphere;
      var mesh = new THREE.Mesh(geo, mats[names[i]]); mesh.matrixAutoUpdate = false; mesh.renderOrder = order[i]; mesh.frustumCulled = true;
      mesh.userData.chunk = c;
      this.group.add(mesh); c.meshes[names[i]] = mesh;
    }
    c.meshed = true; if (!wasMeshed) this.meshCount++;
  };
  World.prototype.setCenter = function (cx, cz, force) {
    if (!force && cx === this.center.cx && cz === this.center.cz) return;
    this.center.cx = cx; this.center.cz = cz;
    var R = this.renderDistance; this.totalTarget = (2 * R + 1) * (2 * R + 1);
    this.worker.postMessage({ type: 'center', cx: cx, cz: cz, r: R });
  };
  World.prototype.setRenderDistance = function (r) { this.renderDistance = r; this.setCenter(this.center.cx, this.center.cz, true); };
  World.prototype.updateUniforms = function (time, camPos) {
    var u = this.materials.uniforms; u.uTime.value = time; u.uCamPos.value.copy(camPos);
    var R = this.renderDistance * 16; u.uFogNear.value = Math.max(8, R * 0.72); u.uFogFar.value = R * 0.98;
  };
  World.prototype.setFog = function (near, far) { this.materials.uniforms.uFogNear.value = near; this.materials.uniforms.uFogFar.value = far; };
  // fraction of chunks within radius r that are meshed (for the loading screen / spawn)
  World.prototype.readyFraction = function (r) {
    var n = 0, tot = 0;
    for (var dx = -r; dx <= r; dx++) for (var dz = -r; dz <= r; dz++) { tot++; var c = this.chunks.get(this.key(this.center.cx + dx, this.center.cz + dz)); if (c && c.meshed) n++; }
    return tot ? n / tot : 0;
  };
  World.prototype.chunkAt = function (x, z) { return this.chunks.get(this.key(x >> 4, z >> 4)); };
  World.prototype.getBlock = function (x, y, z) {
    if (y < 0) return MC.BLOCK.bedrock.id; if (y >= H) return 0;
    var c = this.chunks.get(this.key(x >> 4, z >> 4)); if (!c || !c.blocks) return -1;
    return c.blocks[idx(x & 15, y, z & 15)];
  };
  World.prototype.getBlockDef = function (x, y, z) { var id = this.getBlock(x, y, z); return id < 0 ? null : MC.BLOCKS[id]; };
  World.prototype.getMeta = function (x, y, z) { var c = this.chunks.get(this.key(x >> 4, z >> 4)); if (!c || !c.meta || y < 0 || y >= H) return 0; return c.meta[idx(x & 15, y, z & 15)]; };
  World.prototype.isLoaded = function (x, z) { var c = this.chunks.get(this.key(x >> 4, z >> 4)); return !!(c && c.blocks); };
  World.prototype.setBlock = function (x, y, z, id, meta) {
    if (y < 0 || y >= H) return -1;
    var c = this.chunks.get(this.key(x >> 4, z >> 4)); if (!c || !c.blocks) return -1;
    var i = idx(x & 15, y, z & 15); var old = c.blocks[i];
    c.blocks[i] = id; c.meta[i] = meta || 0;
    var ci = (x & 15) * 16 + (z & 15);
    if (MC.BLOCKS[id].solid && y > c.topSolid[ci]) c.topSolid[ci] = y;
    else if (!MC.BLOCKS[id].solid && y === c.topSolid[ci]) { var yy = y - 1; while (yy > 0 && !MC.BLOCKS[c.blocks[(ci << 7) + yy]].solid) yy--; c.topSolid[ci] = yy; }
    this.worker.postMessage({ type: 'setBlock', x: x, y: y, z: z, id: id, meta: meta || 0 });
    this.edits++;
    this.events.emit('blockChanged', { x: x, y: y, z: z, old: old, id: id });
    return old;
  };
  World.prototype.setBlocks = function (list) { // [x,y,z,id,meta,...]
    var send = [];
    for (var k = 0; k < list.length; k += 5) {
      var x = list[k], y = list[k + 1], z = list[k + 2], id = list[k + 3], meta = list[k + 4];
      var c = this.chunks.get(this.key(x >> 4, z >> 4)); if (!c || !c.blocks || y < 0 || y >= H) continue;
      var i = idx(x & 15, y, z & 15); var old = c.blocks[i]; c.blocks[i] = id; c.meta[i] = meta;
      send.push(x, y, z, id, meta); this.events.emit('blockChanged', { x: x, y: y, z: z, old: old, id: id });
    }
    if (send.length) this.worker.postMessage({ type: 'setBlocks', list: send });
    this.edits++;
  };
  World.prototype.getLight = function (x, y, z) {
    if (y >= H) return { sky: 15, block: 0 }; if (y < 0) return { sky: 0, block: 0 };
    var c = this.chunks.get(this.key(x >> 4, z >> 4)); if (!c || !c.light) return { sky: 15, block: 0 };
    var v = c.light[idx(x & 15, y, z & 15)]; return { sky: v >> 4, block: v & 15 };
  };
  // brightness 0..1 at position (for entities)
  World.prototype.brightnessAt = function (x, y, z, dayLight) {
    var l = this.getLight(Math.floor(x), Math.floor(y), Math.floor(z));
    function curve(v) { var f = v / 15; return f / (4 - 3 * f); }
    return Math.max(0.035, Math.max(curve(l.sky) * dayLight, curve(l.block)));
  };
  World.prototype.getBiome = function (x, z) { var c = this.chunks.get(this.key(x >> 4, z >> 4)); if (!c || !c.biomes) return MC.BIOMES[1]; return MC.BIOMES[c.biomes[(x & 15) * 16 + (z & 15)]]; };
  World.prototype.getTopSolid = function (x, z) { var c = this.chunks.get(this.key(x >> 4, z >> 4)); if (!c || !c.topSolid) return -1; return c.topSolid[(x & 15) * 16 + (z & 15)]; };
  World.prototype.getHeight = function (x, z) { var c = this.chunks.get(this.key(x >> 4, z >> 4)); if (!c || !c.heights) return 64; return c.heights[(x & 15) * 16 + (z & 15)]; };

  // Collision boxes for a block (list of [x0,y0,z0,x1,y1,z1] in block-local coords)
  World.prototype.blockBoxes = function (id) {
    var b = MC.BLOCKS[id]; if (!b || !b.solid) return null;
    if (b.model === 'cactus') return [[1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16]];
    return FULL;
  };
  var FULL = [[0, 0, 0, 1, 1, 1]];
  // Selection/hit boxes (for raycast), includes non-solid targetable blocks
  World.prototype.hitBoxes = function (id) {
    var b = MC.BLOCKS[id]; if (!b || id === 0) return null;
    if (b.model === 'liquid') return null;
    if (b.model === 'cross') return [[0.1, 0, 0.1, 0.9, 0.8, 0.9]];
    if (b.model === 'torch') return [[0.4, 0, 0.4, 0.6, 0.6, 0.6]];
    if (b.model === 'lantern') return [[5 / 16, 0, 5 / 16, 11 / 16, 9 / 16, 11 / 16]];
    if (b.model === 'layer') return [[0, 0, 0, 1, 2 / 16, 1]];
    if (b.model === 'petals') return [[0, 0, 0, 1, 1 / 16, 1]];
    if (b.model === 'cactus') return [[1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16]];
    return FULL;
  };
  // Amanatides-Woo voxel traversal. Returns {x,y,z, face:[nx,ny,nz], point, dist} or null
  World.prototype.raycast = function (origin, dir, maxDist, includeFluids) {
    var ox = origin.x, oy = origin.y, oz = origin.z; var dx = dir.x, dy = dir.y, dz = dir.z;
    var x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    var stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    var tDX = dx !== 0 ? Math.abs(1 / dx) : Infinity, tDY = dy !== 0 ? Math.abs(1 / dy) : Infinity, tDZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    var tMX = dx !== 0 ? ((dx > 0 ? (x + 1 - ox) : (ox - x)) * tDX) : Infinity, tMY = dy !== 0 ? ((dy > 0 ? (y + 1 - oy) : (oy - y)) * tDY) : Infinity, tMZ = dz !== 0 ? ((dz > 0 ? (z + 1 - oz) : (oz - z)) * tDZ) : Infinity;
    var t = 0, face = [0, 0, 0];
    for (var n = 0; n < 200; n++) {
      var id = this.getBlock(x, y, z);
      if (id > 0) {
        var b = MC.BLOCKS[id];
        var boxes = (includeFluids && b.model === 'liquid') ? FULL : this.hitBoxes(id);
        if (boxes) {
          // precise slab test against boxes
          var best = null;
          for (var i = 0; i < boxes.length; i++) {
            var bx = boxes[i]; var r = rayBox(ox, oy, oz, dx, dy, dz, x + bx[0], y + bx[1], z + bx[2], x + bx[3], y + bx[4], z + bx[5]);
            if (r && r.t <= maxDist && (!best || r.t < best.t)) best = r;
          }
          if (best) return { x: x, y: y, z: z, id: id, face: best.face, dist: best.t, point: new THREE.Vector3(ox + dx * best.t, oy + dy * best.t, oz + dz * best.t) };
        }
      }
      if (tMX < tMY) { if (tMX < tMZ) { x += stepX; t = tMX; tMX += tDX; face = [-stepX, 0, 0]; } else { z += stepZ; t = tMZ; tMZ += tDZ; face = [0, 0, -stepZ]; } }
      else { if (tMY < tMZ) { y += stepY; t = tMY; tMY += tDY; face = [0, -stepY, 0]; } else { z += stepZ; t = tMZ; tMZ += tDZ; face = [0, 0, -stepZ]; } }
      if (t > maxDist) return null;
      if (y < 0 || y >= H) return null;
    }
    return null;
  };
  function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
    var tmin = -Infinity, tmax = Infinity, face = null;
    var axes = [[ox, dx, x0, x1, [1, 0, 0]], [oy, dy, y0, y1, [0, 1, 0]], [oz, dz, z0, z1, [0, 0, 1]]];
    for (var i = 0; i < 3; i++) {
      var o = axes[i][0], d = axes[i][1], a0 = axes[i][2], a1 = axes[i][3], nrm = axes[i][4];
      if (Math.abs(d) < 1e-9) { if (o < a0 || o > a1) return null; continue; }
      var t1 = (a0 - o) / d, t2 = (a1 - o) / d; var sign = -1; if (t1 > t2) { var tmp = t1; t1 = t2; t2 = tmp; sign = 1; }
      if (t1 > tmin) { tmin = t1; face = [nrm[0] * sign, nrm[1] * sign, nrm[2] * sign]; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (tmax < 0) return null;
    if (tmin < 0) return { t: 0, face: face || [0, 1, 0] };
    return { t: tmin, face: face };
  }
  // AABB collision helpers
  World.prototype.collectBoxes = function (minX, minY, minZ, maxX, maxY, maxZ, out) {
    out.length = 0;
    var x0 = Math.floor(minX), x1 = Math.floor(maxX), y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H - 1, Math.floor(maxY)), z0 = Math.floor(minZ), z1 = Math.floor(maxZ);
    for (var x = x0; x <= x1; x++) for (var z = z0; z <= z1; z++) for (var y = y0; y <= y1; y++) {
      var id = this.getBlock(x, y, z);
      if (id === -1) { out.push([x, y, z, x + 1, y + 1, z + 1]); continue; } // unloaded: solid
      if (id === 0) continue;
      var boxes = this.blockBoxes(id); if (!boxes) continue;
      for (var i = 0; i < boxes.length; i++) { var b = boxes[i]; out.push([x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]]); }
    }
    if (minY < 0) out.push([x0, -1, z0, x1 + 1, 0, z1 + 1]);
    return out;
  };
  World.prototype.dispose = function () {
    if (this.worker) this.worker.terminate();
    var self = this; this.chunks.forEach(function (c) { self.disposeMeshes(c); }); this.chunks.clear();
    this.scene.remove(this.group);
  };
  World.prototype.findSpawn = function () {
    // search near origin for a flat, sky-exposed grass/sand column above sea level
    var best = null, bestScore = -Infinity;
    for (var r = 0; r < 80; r += 2) for (var a = 0; a < 24; a++) {
      var x = Math.round(Math.cos(a / 24 * Math.PI * 2) * r), z = Math.round(Math.sin(a / 24 * Math.PI * 2) * r);
      if (!this.isLoaded(x, z)) continue;
      var y = this.getTopSolid(x, z); if (y <= 62) continue;
      var id = this.getBlock(x, y, z); var b = MC.BLOCKS[id];
      if (!(b.name === 'grass_block' || b.name === 'sand' || b.name === 'snowy_grass_block' || b.name === 'podzol' || b.name === 'dirt')) continue;
      if (this.getBlock(x, y + 1, z) !== 0 || this.getBlock(x, y + 2, z) !== 0) continue;
      var maxD = 0, n = 0;
      for (var dx = -4; dx <= 4; dx += 2) for (var dz = -4; dz <= 4; dz += 2) { if (!this.isLoaded(x + dx, z + dz)) continue; var ty = this.getTopSolid(x + dx, z + dz); maxD = Math.max(maxD, Math.abs(ty - y)); n++; }
      if (n < 20) continue;
      var score = -maxD * 3 - r * 0.05 + (b.name === 'grass_block' ? 4 : 0);
      if (score > bestScore) { bestScore = score; best = new THREE.Vector3(x + 0.5, y + 1, z + 0.5); }
      if (maxD <= 1 && b.name === 'grass_block') return best;
    }
    if (best) return best;
    return new THREE.Vector3(0.5, Math.max(64, this.getTopSolid(0, 0) + 1), 0.5);
  };
  MC.World = World; MC.WORLD_HEIGHT = H;
})();
