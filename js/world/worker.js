// World worker: owns voxel data. Generates terrain, computes sky/block lighting (BFS), builds chunk meshes.
// Runs inside a Blob worker; `ns` holds the shared modules (Noise, BLOCKS, BIOMES). No MC/window access here.
MC.WorkerSource = function workerMain(ns) {
  var H = 128, SEA = 62;
  var BLOCKS = ns.BLOCKS, BLOCK = ns.BLOCK, BIOME = ns.BIOME;
  var AIR = 0;
  var texIndex = {}, frames = {};
  var seed = 1, N = {}, forceBiome = null;
  var chunks = new Map();
  var colCache = new Map();
  var faceLayer = [];   // blockId -> [6]
  var center = { cx: 0, cz: 0, r: 8, active: false };
  var genQueue = [], meshQueue = [];
  var dirtySet = new Set();
  var pumping = false;
  var STATS = { genMs: 0, genN: 0, meshMs: 0, meshN: 0, lightMs: 0 };
  var lightOpacity = new Uint8Array(BLOCKS.length), emission = new Uint8Array(BLOCKS.length), opaque = new Uint8Array(BLOCKS.length);
  for (var i = 0; i < BLOCKS.length; i++) { lightOpacity[i] = BLOCKS[i].lightOpacity; emission[i] = BLOCKS[i].light; opaque[i] = BLOCKS[i].opaque ? 1 : 0; }
  var ID = {}; for (var k in BLOCK) ID[k] = BLOCK[k].id;

  function key(cx, cz) { return (cx + 32768) * 65536 + (cz + 32768); }
  function neighborhood(c) { var NB = new Array(9); for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) { var nc = chunks.get(key(c.cx + dx, c.cz + dz)); NB[(dx + 1) * 3 + (dz + 1)] = nc && nc.generated ? nc : null; } return NB; }
  function idx(x, y, z) { return (((x << 4) | z) << 7) | y; }
  function smooth(a, b, t) { t = Math.max(0, Math.min(1, (t - a) / (b - a))); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rng(s) { s |= 0; return function () { s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function chunkRng(cx, cz, salt) { return rng((seed ^ Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ Math.imul(salt, 83492791)) | 0); }

  // ---------------- chunk access ----------------
  var lastC = null, lastCx = NaN, lastCz = NaN;
  function chunkAt(x, z) {
    var cx = x >> 4, cz = z >> 4;
    if (cx === lastCx && cz === lastCz) return lastC;
    var c = chunks.get(key(cx, cz)); c = (c && c.generated) ? c : null;
    lastC = c; lastCx = cx; lastCz = cz; return c;
  }
  function invalidateChunkCache() { lastC = null; lastCx = NaN; lastCz = NaN; }
  function getBlock(x, y, z) { if (y < 0 || y >= H) return AIR; var c = chunkAt(x, z); if (!c) return -1; return c.blocks[idx(x & 15, y, z & 15)]; }
  function getMeta(x, y, z) { var c = chunkAt(x, z); if (!c) return 0; return c.meta[idx(x & 15, y, z & 15)]; }
  function getSky(x, y, z) { if (y >= H) return 15; if (y < 0) return 0; var c = chunkAt(x, z); if (!c) return 15; return c.light[idx(x & 15, y, z & 15)] >> 4; }
  function getBlockLight(x, y, z) { if (y < 0 || y >= H) return 0; var c = chunkAt(x, z); if (!c) return 0; return c.light[idx(x & 15, y, z & 15)] & 15; }

  // ---------------- terrain ----------------
  function initNoise() {
    N.cont = new ns.Noise(seed + 1); N.ero = new ns.Noise(seed + 2); N.pv = new ns.Noise(seed + 3); N.temp = new ns.Noise(seed + 4); N.humid = new ns.Noise(seed + 5);
    N.hills = new ns.Noise(seed + 6); N.river = new ns.Noise(seed + 7); N.cave1 = new ns.Noise(seed + 8); N.cave2 = new ns.Noise(seed + 9); N.cheese = new ns.Noise(seed + 10);
    N.detail = new ns.Noise(seed + 11); N.cherry = new ns.Noise(seed + 12); N.jit = new ns.Noise(seed + 13); N.ridge = new ns.Noise(seed + 14); N.patch = new ns.Noise(seed + 15);
  }
  // Column info for a chunk (heights + biomes), cached; pure function of seed.
  function columns(cx, cz) {
    var kk = key(cx, cz); var cc = colCache.get(kk); if (cc) return cc;
    var heights = new Uint8Array(256), biomes = new Uint8Array(256), mount = new Float32Array(256);
    for (var lx = 0; lx < 16; lx++) for (var lz = 0; lz < 16; lz++) {
      var x = cx * 16 + lx, z = cz * 16 + lz;
      var c = N.cont.fbm2(x / 900, z / 900, 3, 2, 0.5);
      var e = N.ero.fbm2(x / 600, z / 600, 2, 2, 0.5) * 0.5 + 0.5;
      var t = clamp(N.temp.fbm2(x / 800, z / 800, 2, 2, 0.5) * 0.6 + 0.5, 0, 1);
      var hu = clamp(N.humid.fbm2(x / 700, z / 700, 2, 2, 0.5) * 0.6 + 0.5, 0, 1);
      var hills = N.hills.fbm2(x / 140, z / 140, 4, 2, 0.5);
      var detail = N.detail.fbm2(x / 40, z / 40, 2, 2, 0.5);
      var mN = N.pv.fbm2(x / 450, z / 450, 2, 2, 0.5) * 0.5 + 0.5;
      var m = smooth(0.42, 0.72, mN * (1.1 - e * 0.4));
      var ridge = N.ridge.ridged2(x / 190, z / 190, 4);
      var h = 66 + c * 14 + hills * 6 + detail * 1.5;
      h += m * (ridge * 46 + 12);
      // ocean
      if (c < -0.28) { var depth = smooth(-0.28, -0.62, c); h = Math.min(h, SEA - 1 - depth * 26 + hills * 2); }
      // rivers
      var rv = 1 - Math.abs(N.river.noise2D(x / 380, z / 380) + 0.18 * N.river.noise2D(x / 95, z / 95));
      var rk = 0;
      if (rv > 0.9 && m < 0.55) { rk = smooth(0.9, 0.965, rv) * (1 - m * 1.6); if (rk < 0) rk = 0; h = lerp(h, 57.5, rk); }
      h = clamp(h, 6, 124);
      var hi = Math.floor(h);
      var b;
      var cherry = N.cherry.fbm2(x / 300, z / 300, 2, 2, 0.5);
      var jit = N.jit.noise2D(x / 120, z / 120);
      if (hi < SEA - 1) b = (rk > 0.45 && c > -0.28) ? BIOME.river : BIOME.ocean;
      else if (rk > 0.55) b = BIOME.river;
      else if (hi <= SEA + 2 && c < -0.12) b = BIOME.beach;
      else if (m > 0.55) { if (t < 0.3 || hi > 110) b = BIOME.snowy_slopes; else if (cherry > 0.28 && t > 0.3 && t < 0.75) b = BIOME.cherry_grove; else b = BIOME.windswept_hills; }
      else if (t < 0.22) b = hu > 0.55 ? BIOME.taiga : BIOME.snowy_plains;
      else if (t > 0.72) b = hu < 0.42 ? BIOME.desert : (hu > 0.64 ? BIOME.jungle : BIOME.savanna);
      else if (hu > 0.68) b = jit > 0.25 ? BIOME.birch_forest : (hi < SEA + 4 && t > 0.55 ? BIOME.swamp : BIOME.forest);
      else if (hu > 0.5) b = jit > 0.35 ? BIOME.forest : (jit < -0.4 ? BIOME.birch_forest : BIOME.plains);
      else if (m > 0.3 && t > 0.4 && t < 0.7 && jit > 0.2) b = BIOME.meadow;
      else if (t > 0.6 && hu < 0.3 && jit > 0.3) b = BIOME.savanna;
      else b = BIOME.plains;
      if (forceBiome && BIOME[forceBiome] && hi >= SEA - 1) { b = BIOME[forceBiome]; if (hi < SEA + 2) { hi = SEA + 2 + Math.floor(hills * 2 + 2); h = hi; } }
      var i = lx * 16 + lz; heights[i] = hi; biomes[i] = b.id; mount[i] = m;
    }
    cc = { heights: heights, biomes: biomes, mount: mount }; colCache.set(kk, cc); return cc;
  }
  function heightAt(x, z) { var cc = columns(x >> 4, z >> 4); return cc.heights[(x & 15) * 16 + (z & 15)]; }
  function biomeAt(x, z) { var cc = columns(x >> 4, z >> 4); return cc.biomes[(x & 15) * 16 + (z & 15)]; }

  function caveAt(x, y, z) {
    var s1 = Math.abs(N.cave1.fbm3(x / 72, y / 42, z / 72, 2, 2, 0.5)), s2 = Math.abs(N.cave2.fbm3(x / 72 + 100, y / 42, z / 72 - 100, 2, 2, 0.5));
    var th = 0.07 + (y < 30 ? 0.02 : 0) - (y > 90 ? 0.02 : 0);
    if (Math.max(s1, s2) < th) return true;
    if (y < 52) { var ch = N.cheese.fbm3(x / 95, y / 48, z / 95, 2, 2, 0.5); if (ch > 0.58 - (y < 40 ? 0.08 : 0)) return true; }
    return false;
  }

  function generate(cx, cz) {
    var c = { cx: cx, cz: cz, blocks: new Uint8Array(16 * 16 * H), meta: new Uint8Array(16 * 16 * H), light: new Uint8Array(16 * 16 * H), heights: new Uint8Array(256), biomes: new Uint8Array(256), topSolid: new Uint8Array(256), generated: false, lit: false, meshed: false, dirty: false, maxH: 0 };
    var cc = columns(cx, cz); c.heights.set(cc.heights); c.biomes.set(cc.biomes);
    var bl = c.blocks; var R = chunkRng(cx, cz, 1);
    var ST = ID.stone, DS = ID.deepslate, DIRT = ID.dirt, GRASS = ID.grass_block, SAND = ID.sand, SANDST = ID.sandstone, GRAVEL = ID.gravel, WATER = ID.water, BED = ID.bedrock, SNOWG = ID.snowy_grass_block, SNOWB = ID.snow_block, ICE = ID.ice, CLAY = ID.clay, RSAND = ID.red_sand;
    // cave grid (5x33x5, step 4)
    var cg = new Uint8Array(5 * 33 * 5);
    for (var gx = 0; gx <= 4; gx++) for (var gz = 0; gz <= 4; gz++) for (var gy = 0; gy <= 32; gy++) cg[(gx * 5 + gz) * 33 + gy] = caveAt(cx * 16 + gx * 4, gy * 4, cz * 16 + gz * 4) ? 1 : 0;
    function caveInterp(lx, y, lz) {
      var gx = lx >> 2, gz = lz >> 2, gy = y >> 2; var fx = (lx & 3) / 4, fz = (lz & 3) / 4, fy = (y & 3) / 4;
      function g(a, b, d) { return cg[((gx + a) * 5 + (gz + b)) * 33 + gy + d]; }
      var v = (g(0, 0, 0) * (1 - fx) + g(1, 0, 0) * fx) * (1 - fz) * (1 - fy) + (g(0, 1, 0) * (1 - fx) + g(1, 1, 0) * fx) * fz * (1 - fy) + (g(0, 0, 1) * (1 - fx) + g(1, 0, 1) * fx) * (1 - fz) * fy + (g(0, 1, 1) * (1 - fx) + g(1, 1, 1) * fx) * fz * fy;
      return v > 0.5;
    }
    for (var lx = 0; lx < 16; lx++) for (var lz = 0; lz < 16; lz++) {
      var x = cx * 16 + lx, z = cz * 16 + lz; var ci = lx * 16 + lz;
      var h = cc.heights[ci], b = ns.BIOMES[cc.biomes[ci]], m = cc.mount[ci];
      // slope from neighbouring heights
      var slope = Math.max(Math.abs(heightAt(x + 1, z) - h), Math.abs(heightAt(x - 1, z) - h), Math.abs(heightAt(x, z + 1) - h), Math.abs(heightAt(x, z - 1) - h));
      var patch = N.patch.noise2D(x / 18, z / 18);
      var base = ci << 7;
      var topSolid = 0;
      for (var y = 0; y < H; y++) {
        var id = AIR;
        if (y === 0 || (y < 5 && R() < (5 - y) / 5)) id = BED;
        else if (y <= h) {
          var depth = h - y;
          id = y < 10 + R() * 3 ? DS : ST;
          var bn = b.name;
          if (bn === 'ocean' || bn === 'river') { if (depth < 3) id = patch > 0.35 ? GRAVEL : (patch < -0.45 ? CLAY : SAND); else if (depth < 5) id = SAND; }
          else if (bn === 'beach') { if (depth < 4) id = SAND; else if (depth < 7) id = SANDST; }
          else if (bn === 'desert') { if (depth < 4) id = patch > 0.55 ? RSAND : SAND; else if (depth < 8) id = SANDST; }
          else if (bn === 'snowy_plains') { if (depth === 0) id = SNOWG; else if (depth < 4) id = DIRT; }
          else if (bn === 'snowy_slopes') { if (depth === 0) id = (y > 96 || slope < 3) ? (y > 100 ? SNOWB : SNOWG) : ST; else if (depth < 3 && slope < 3) id = y > 100 ? SNOWB : DIRT; }
          else if (bn === 'windswept_hills' || bn === 'meadow' || bn === 'cherry_grove') {
            var exposed = slope >= 3 || y > 96 + patch * 6 + (bn === 'windswept_hills' ? 0 : 16);
            if (exposed) { if (depth < 2 && patch > 0.5) id = GRAVEL; }
            else if (depth === 0) id = GRASS; else if (depth < 3 + (patch > 0 ? 1 : 0)) id = DIRT;
          }
          else if (bn === 'swamp') { if (depth === 0) id = h <= SEA ? DIRT : GRASS; else if (depth < 3) id = patch > 0.3 ? CLAY : DIRT; }
          else if (bn === 'jungle' || bn === 'taiga') { if (depth === 0) id = GRASS; else if (depth < 4) id = (bn === 'taiga' && patch > 0.5 && depth === 1) ? ID.coarse_dirt : DIRT; if (bn === 'taiga' && depth === 0 && patch > 0.6) id = ID.podzol; }
          else { if (depth === 0) id = GRASS; else if (depth < 3 + (patch > 0.2 ? 1 : 0)) id = DIRT; if (bn === 'savanna' && depth === 0 && patch > 0.7) id = ID.coarse_dirt; }
          // caves
          if (y >= 2 && id !== BED && !(h <= SEA + 1 && y > h - 4) && caveInterp(lx, y, lz)) { id = y < 11 ? ID.lava : AIR; }
          else if (y === h && slope >= 4 && id === GRASS && m > 0.4) id = ST;
        }
        else if (y <= SEA) { id = WATER; if (y === SEA && (b.name === 'snowy_plains' || b.name === 'snowy_slopes' || b.name === 'taiga' && R() < 0.5)) id = ICE; }
        bl[base + y] = id;
        if (id !== AIR && id !== WATER && id !== ID.lava && !(id === ICE)) topSolid = y;
      }
      c.topSolid[ci] = topSolid;
    }
    placeOres(c, R);
    decorate(c);
    placeVillage(c);
    // snow layers in cold biomes
    for (lx = 0; lx < 16; lx++) for (lz = 0; lz < 16; lz++) {
      ci = lx * 16 + lz; b = ns.BIOMES[c.biomes[ci]];
      if (b.name === 'snowy_plains' || b.name === 'snowy_slopes' || (b.name === 'taiga' && cc.mount[ci] > 0.2)) {
        for (y = H - 2; y > SEA; y--) { var bid = bl[(ci << 7) + y]; if (bid !== AIR) { if (BLOCKS[bid].solid && bl[(ci << 7) + y + 1] === AIR && bid !== ICE) bl[(ci << 7) + y + 1] = ID.snow; break; } }
      }
    }
    // compute maxH (highest non-air)
    var maxH = 0;
    for (ci = 0; ci < 256; ci++) { for (y = H - 1; y >= 0; y--) if (bl[(ci << 7) + y] !== AIR) { if (y > maxH) maxH = y; break; } var ts = 0; for (y = H - 1; y >= 0; y--) { var q = bl[(ci << 7) + y]; if (BLOCKS[q].solid) { ts = y; break; } } c.topSolid[ci] = ts; }
    c.maxH = maxH;
    c.generated = true;
    return c;
  }

  // Compact, self-contained village plots.  A village is deliberately common: a
  // player exploring suitable land should come across one within a minute or two.
  // Each biome chooses its own building palette, so villages have a clear identity.
  function placeVillage(c) {
    var R = chunkRng(c.cx, c.cz, 91), center = 8 * 16 + 8, biome = ns.BIOMES[c.biomes[center]].name;
    var styles = {
      plains: { wall: 'oak_planks', roof: 'oak_planks', log: 'oak_log', base: 'cobblestone', path: 'dirt_path' },
      meadow: { wall: 'oak_planks', roof: 'birch_planks', log: 'birch_log', base: 'cobblestone', path: 'dirt_path' },
      forest: { wall: 'oak_planks', roof: 'dark_oak_planks', log: 'oak_log', base: 'cobblestone', path: 'dirt_path' },
      birch_forest: { wall: 'birch_planks', roof: 'birch_planks', log: 'birch_log', base: 'cobblestone', path: 'dirt_path' },
      cherry_grove: { wall: 'cherry_planks', roof: 'cherry_planks', log: 'cherry_log', base: 'cobblestone', path: 'dirt_path' },
      savanna: { wall: 'acacia_planks', roof: 'acacia_planks', log: 'acacia_log', base: 'sandstone', path: 'sandstone' },
      desert: { wall: 'sandstone', roof: 'cut_sandstone', log: 'sandstone', base: 'sandstone', path: 'smooth_sandstone' },
      taiga: { wall: 'spruce_planks', roof: 'spruce_planks', log: 'spruce_log', base: 'cobblestone', path: 'dirt_path' },
      snowy_plains: { wall: 'spruce_planks', roof: 'stone_bricks', log: 'spruce_log', base: 'cobblestone', path: 'dirt_path' },
      jungle: { wall: 'jungle_planks', roof: 'jungle_planks', log: 'jungle_log', base: 'cobblestone', path: 'dirt_path' },
      swamp: { wall: 'mud_bricks', roof: 'dark_oak_planks', log: 'dark_oak_log', base: 'mud_bricks', path: 'mud_bricks' }
    }, style = styles[biome];
    if (!style || R() > 0.06) return;
    var baseY = c.heights[center], minY = baseY, maxY = baseY;
    for (var x = 2; x <= 13; x++) for (var z = 2; z <= 13; z++) { var h = c.heights[x * 16 + z]; minY = Math.min(minY, h); maxY = Math.max(maxY, h); }
    if (baseY <= SEA + 1 || maxY - minY > 3 || baseY + 7 >= H) return;
    var bl = c.blocks, meta = c.meta, wall = ID[style.wall], roof = ID[style.roof], log = ID[style.log], foundation = ID[style.base], path = ID[style.path], glass = ID.glass, torch = ID.torch, dirt = ID.dirt;
    function put(x, y, z, id, m) { if (x < 0 || x > 15 || z < 0 || z > 15 || y < 0 || y >= H) return; bl[idx(x, y, z)] = id; meta[idx(x, y, z)] = m || 0; }
    // Level the plot and lay a cobblestone path through its center.
    for (x = 2; x <= 13; x++) for (z = 2; z <= 13; z++) {
      var ground = c.heights[x * 16 + z];
      for (var y = ground + 1; y <= baseY; y++) put(x, y, z, dirt);
      for (y = baseY + 1; y <= baseY + 7; y++) put(x, y, z, AIR);
      if (x === 8 || z === 8) put(x, baseY + 1, z, path);
    }
    // Build two proper cottages with framed corners and stepped, pitched roofs.
    function cottage(x0, z0, doorNorth) {
      var x1 = x0 + 4, z1 = z0 + 4;
      for (x = x0; x <= x1; x++) for (z = z0; z <= z1; z++) put(x, baseY + 1, z, foundation);
      for (x = x0; x <= x1; x++) for (z = z0; z <= z1; z++) {
        var edge = x === x0 || x === x1 || z === z0 || z === z1;
        if (!edge) continue;
        for (y = baseY + 2; y <= baseY + 4; y++) put(x, y, z, wall);
        if ((x === x0 || x === x1) && (z === z0 || z === z1)) for (y = baseY + 2; y <= baseY + 4; y++) put(x, y, z, log);
      }
      var dz = doorNorth ? z0 : z1;
      put(x0 + 2, baseY + 2, dz, AIR); put(x0 + 2, baseY + 3, dz, AIR);
      put(x0 + 1, baseY + 3, doorNorth ? z1 : z0, glass); put(x0 + 3, baseY + 3, doorNorth ? z1 : z0, glass);
      for (x = x0 - 1; x <= x1 + 1; x++) for (z = z0 - 1; z <= z1 + 1; z++) put(x, baseY + 5, z, roof);
      for (x = x0; x <= x1; x++) for (z = z0; z <= z1; z++) put(x, baseY + 6, z, roof);
      put(x0 + 2, baseY + 3, z0 + 2, torch);
    }
    cottage(2, 2, false); cottage(10, 10, true);
    // Central stone well with water, a small plaza, and lights.
    for (x = 6; x <= 10; x++) for (z = 6; z <= 10; z++) put(x, baseY + 1, z, path);
    for (x = 7; x <= 9; x++) for (z = 7; z <= 9; z++) put(x, baseY + 2, z, (x === 8 && z === 8) ? ID.water : foundation);
    [[7, 7], [9, 7], [7, 9], [9, 9]].forEach(function (p) { put(p[0], baseY + 3, p[1], log); put(p[0], baseY + 4, p[1], log); });
    put(8, baseY + 5, 8, roof); put(6, baseY + 2, 8, torch); put(10, baseY + 2, 8, torch);
    // A real village farm: irrigated crop rows, hay bales, and timber corner posts.
    for (x = 10; x <= 14; x++) for (z = 2; z <= 6; z++) {
      if (x === 12) { put(x, baseY + 1, z, ID.water); continue; }
      put(x, baseY + 1, z, ID.coarse_dirt);
      if ((x + z) % 2) put(x, baseY + 2, z, ID.short_grass);
    }
    [[10, 2], [14, 2], [10, 6], [14, 6]].forEach(function (p) { put(p[0], baseY + 2, p[1], log); });
    put(14, baseY + 2, 2, ID.hay_block); put(13, baseY + 2, 2, ID.hay_block);
    c.villageSpawns = [{ x: c.cx * 16 + 7.5, y: baseY + 2, z: c.cz * 16 + 10.5 }, { x: c.cx * 16 + 9.5, y: baseY + 2, z: c.cz * 16 + 10.5 }, { x: c.cx * 16 + 7.5, y: baseY + 2, z: c.cz * 16 + 6.5 }, { x: c.cx * 16 + 10.5, y: baseY + 2, z: c.cz * 16 + 8.5 }, { x: c.cx * 16 + 5.5, y: baseY + 2, z: c.cz * 16 + 8.5 }];
  }

  function placeOres(c, R) {
    var bl = c.blocks;
    function vein(id, tries, minY, maxY, size, host) {
      for (var t = 0; t < tries; t++) {
        var x = 1 + Math.floor(R() * 14), z = 1 + Math.floor(R() * 14), y = minY + Math.floor(R() * (maxY - minY));
        for (var k = 0; k < size; k++) {
          var dx = Math.round((R() - 0.5) * 2.4), dy = Math.round((R() - 0.5) * 2), dz = Math.round((R() - 0.5) * 2.4);
          var px = x + dx, py = y + dy, pz = z + dz;
          if (px < 0 || px > 15 || pz < 0 || pz > 15 || py < 1 || py >= H) continue;
          var i = idx(px, py, pz); var cur = bl[i];
          if (cur === ID.stone || cur === ID.deepslate || (host && cur === host)) bl[i] = id;
          if (R() < 0.35) { x = px; y = py; z = pz; }
        }
      }
    }
    vein(ID.granite, 3, 10, 80, 30); vein(ID.diorite, 3, 10, 80, 30); vein(ID.andesite, 3, 10, 80, 30); vein(ID.tuff, 2, 1, 20, 24); vein(ID.gravel, 3, 20, 110, 20); vein(ID.dirt, 4, 20, 110, 20);
    vein(ID.coal_ore, 16, 5, 120, 10); vein(ID.iron_ore, 14, 4, 70, 7); vein(ID.copper_ore, 8, 40, 96, 8); vein(ID.gold_ore, 2, 4, 32, 6); vein(ID.redstone_ore, 6, 3, 16, 7); vein(ID.lapis_ore, 1, 12, 32, 6); vein(ID.diamond_ore, 1, 3, 16, 6);
    if (R() < 0.3) vein(ID.emerald_ore, 2, 40, 110, 1);
  }

  // ---------------- decorations (trees, plants) ----------------
  function treeList(cx, cz) {
    var R = chunkRng(cx, cz, 2); var cc = columns(cx, cz); var list = [];
    // count trees per biome (sample biome at chunk center)
    var counts = { forest: 7, birch_forest: 7, taiga: 6, jungle: 9, cherry_grove: 3, savanna: 1, swamp: 2, plains: 0, meadow: 0, windswept_hills: 0, snowy_plains: 0, snowy_slopes: 0, desert: 0, ocean: 0, river: 0, beach: 0 };
    var bC = ns.BIOMES[cc.biomes[8 * 16 + 8]].name;
    var n = counts[bC] || 0;
    if (bC === 'plains' && R() < 0.12) n = 1; if (bC === 'meadow' && R() < 0.25) n = 1; if (bC === 'windswept_hills' && R() < 0.3) n = 1; if (bC === 'snowy_plains' && R() < 0.2) n = 1; if (bC === 'snowy_slopes' && R() < 0.15) n = 1;
    n += Math.floor(R() * 3) - 1; if (n < 0) n = 0;
    for (var i = 0; i < n; i++) {
      var lx = 2 + Math.floor(R() * 12), lz = 2 + Math.floor(R() * 12); var ci = lx * 16 + lz;
      var h = cc.heights[ci], b = ns.BIOMES[cc.biomes[ci]].name;
      if (h < SEA + 1) continue;
      var type = 'oak', r = R();
      if (b === 'forest') type = r < 0.25 ? 'birch' : (r < 0.35 ? 'big_oak' : 'oak');
      else if (b === 'birch_forest') type = r < 0.15 ? 'tall_birch' : 'birch';
      else if (b === 'taiga' || b === 'snowy_plains' || b === 'snowy_slopes') type = r < 0.4 ? 'pine' : 'spruce';
      else if (b === 'jungle') type = r < 0.5 ? 'jungle' : (r < 0.8 ? 'jungle_small' : 'oak');
      else if (b === 'cherry_grove') type = 'cherry';
      else if (b === 'savanna') type = 'acacia';
      else if (b === 'swamp') type = 'swamp_oak';
      else if (b === 'windswept_hills' || b === 'meadow') type = r < 0.5 ? 'spruce' : 'oak';
      else if (b === 'desert' || b === 'beach' || b === 'ocean' || b === 'river') continue;
      list.push({ x: cx * 16 + lx, z: cz * 16 + lz, y: h + 1, type: type, seed: Math.floor(R() * 1e9) });
    }
    return list;
  }
  // tree voxel writer bound to a chunk (clips to chunk)
  function makeWriter(c) {
    var ox = c.cx * 16, oz = c.cz * 16;
    return {
      set: function (x, y, z, id, meta, replaceLeaves) {
        var lx = x - ox, lz = z - oz; if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 0 || y >= H) return;
        var i = idx(lx, y, lz); var cur = c.blocks[i];
        if (cur === AIR || BLOCKS[cur].replaceable || (replaceLeaves && BLOCKS[cur].cutout && !BLOCKS[cur].solid) || (replaceLeaves === 2)) { c.blocks[i] = id; c.meta[i] = meta || 0; }
      },
      leaf: function (x, y, z, id) { var lx = x - ox, lz = z - oz; if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 0 || y >= H) return; var i = idx(lx, y, lz); var cur = c.blocks[i]; if (cur === AIR || BLOCKS[cur].replaceable) c.blocks[i] = id; },
      get: function (x, y, z) { var lx = x - ox, lz = z - oz; if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 0 || y >= H) return -1; return c.blocks[idx(lx, y, lz)]; }
    };
  }
  function growTree(w, t) {
    var R = rng(t.seed); var x = t.x, y = t.y, z = t.z;
    function canopy(cx, cy, cz, radii, leafId, holes) {
      for (var i = 0; i < radii.length; i++) { var r = radii[i]; var yy = cy + i; if (r <= 0) continue;
        for (var dx = -r; dx <= r; dx++) for (var dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && (r > 1 || R() < 0.5) && holes !== false) continue;
          w.leaf(cx + dx, yy, cz + dz, leafId);
        }
      }
    }
    var log, leaves, hgt, i;
    switch (t.type) {
      case 'oak': case 'swamp_oak':
        log = ID.oak_log; leaves = ID.oak_leaves; hgt = 4 + Math.floor(R() * 3);
        for (i = 0; i < hgt; i++) w.set(x, y + i, z, log, 0, 1);
        canopy(x, y + hgt - 3, z, [2, 2, 1, 1], leaves);
        w.leaf(x, y + hgt, z, leaves); w.leaf(x, y + hgt + 0, z, leaves);
        break;
      case 'big_oak':
        log = ID.oak_log; leaves = ID.oak_leaves; hgt = 6 + Math.floor(R() * 4);
        for (i = 0; i < hgt; i++) w.set(x, y + i, z, log, 0, 1);
        canopy(x, y + hgt - 2, z, [2, 2, 1], leaves);
        for (var br = 0; br < 3; br++) { var bx = x + Math.floor(R() * 5) - 2, bz = z + Math.floor(R() * 5) - 2, by = y + 3 + Math.floor(R() * (hgt - 4)); w.set(bx, by, bz, log, 0, 1); canopy(bx, by, bz, [1, 2, 1], leaves); }
        break;
      case 'birch': case 'tall_birch':
        log = ID.birch_log; leaves = ID.birch_leaves; hgt = (t.type === 'tall_birch' ? 7 : 5) + Math.floor(R() * 3);
        for (i = 0; i < hgt; i++) w.set(x, y + i, z, log, 0, 1);
        canopy(x, y + hgt - 3, z, [2, 2, 1, 1], leaves); w.leaf(x, y + hgt, z, leaves);
        break;
      case 'spruce': case 'pine':
        log = ID.spruce_log; leaves = ID.spruce_leaves; hgt = 7 + Math.floor(R() * 4);
        for (i = 0; i < hgt; i++) w.set(x, y + i, z, log, 0, 1);
        if (t.type === 'spruce') { var radii = []; var start = 2 + Math.floor(R() * 2); for (i = start; i <= hgt; i++) { var k = hgt - i; radii.push(k <= 0 ? 0 : (k % 2 === 1 ? Math.min(2, Math.ceil(k / 3)) : Math.min(3, Math.ceil(k / 3) + 1))); } canopy(x, y + start, z, radii, leaves, false); w.leaf(x, y + hgt, z, leaves); w.leaf(x, y + hgt + 1, z, leaves); }
        else { canopy(x, y + hgt - 3, z, [2, 1, 2, 1], leaves); w.leaf(x, y + hgt + 1, z, leaves); w.leaf(x, y + hgt, z, leaves); }
        break;
      case 'jungle': case 'jungle_small':
        log = ID.jungle_log; leaves = ID.jungle_leaves; hgt = (t.type === 'jungle' ? 9 : 5) + Math.floor(R() * 4);
        for (i = 0; i < hgt; i++) w.set(x, y + i, z, log, 0, 1);
        canopy(x, y + hgt - 2, z, [2, 2, 1], leaves); w.leaf(x, y + hgt + 1, z, leaves);
        break;
      case 'acacia':
        log = ID.acacia_log; leaves = ID.acacia_leaves; hgt = 5 + Math.floor(R() * 2);
        var dxa = Math.floor(R() * 3) - 1, dza = Math.floor(R() * 3) - 1;
        for (i = 0; i < hgt; i++) { var fx = i >= 3 ? x + dxa : x, fz = i >= 3 ? z + dza : z; w.set(fx, y + i, fz, log, 0, 1); }
        canopy(x + dxa, y + hgt - 1, z + dza, [3, 2], leaves); w.leaf(x + dxa, y + hgt + 1, z + dza, leaves);
        break;
      case 'cherry':
        log = ID.cherry_log; leaves = ID.cherry_leaves; hgt = 4 + Math.floor(R() * 2);
        for (i = 0; i < hgt; i++) w.set(x, y + i, z, log, 0, 1);
        var dxc = Math.floor(R() * 3) - 1, dzc = Math.floor(R() * 3) - 1;
        for (i = 0; i < 2; i++) w.set(x + dxc * (i + 1), y + hgt + i, z + dzc * (i + 1), log, 0, 1);
        var ccx = x + dxc * 2, ccz = z + dzc * 2, ccy = y + hgt + 1;
        for (var dy = -1; dy <= 2; dy++) { var rr = dy === -1 ? 3 : dy === 0 ? 4 : dy === 1 ? 3 : 2; for (var ddx = -rr; ddx <= rr; ddx++) for (var ddz = -rr; ddz <= rr; ddz++) { var d2 = ddx * ddx + ddz * ddz; if (d2 > rr * rr + 1) continue; if (d2 > rr * rr - rr && R() < 0.35) continue; w.leaf(ccx + ddx, ccy + dy, ccz + ddz, leaves); } }
        break;
    }
  }
  function decorate(c) {
    var w = makeWriter(c); var cx = c.cx, cz = c.cz;
    // trees from 3x3 neighborhood (deterministic), clipped
    for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) {
      var list = treeList(cx + dx, cz + dz);
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        if (dx === 0 && dz === 0) { var below = w.get(t.x, t.y - 1, t.z); if (below !== ID.grass_block && below !== ID.dirt && below !== ID.snowy_grass_block && below !== ID.podzol && below !== ID.coarse_dirt) continue; if (w.get(t.x, t.y, t.z) !== AIR) continue; }
        else { if (caveAt(t.x, t.y - 1, t.z) || caveAt(t.x, t.y, t.z)) continue; }
        growTree(w, t);
      }
    }
    // ground cover
    var R = chunkRng(cx, cz, 3);
    for (var lx = 0; lx < 16; lx++) for (var lz = 0; lz < 16; lz++) {
      var ci = lx * 16 + lz; var b = ns.BIOMES[c.biomes[ci]].name; var h = c.heights[ci];
      var x = cx * 16 + lx, z = cz * 16 + lz;
      var top = c.blocks[(ci << 7) + h], above = c.blocks[(ci << 7) + h + 1];
      if (above !== AIR) {
        if (top === ID.sand || top === ID.gravel || top === ID.clay) { if (above === ID.water && h < SEA - 1 && R() < 0.1) c.blocks[(ci << 7) + h + 1] = ID.seagrass; }
        continue;
      }
      var r = R();
      if (top === ID.grass_block) {
        var grassD = { plains: 0.22, meadow: 0.5, forest: 0.12, birch_forest: 0.12, savanna: 0.5, jungle: 0.35, swamp: 0.25, taiga: 0.08, windswept_hills: 0.1, cherry_grove: 0.08 }[b] || 0.08;
        if (r < grassD) c.blocks[(ci << 7) + h + 1] = (b === 'taiga' || b === 'jungle') && r < grassD * 0.5 ? ID.fern : ID.short_grass;
        else if (r < grassD + 0.03) {
          var fl;
          if (b === 'meadow') fl = [ID.dandelion, ID.poppy, ID.azure_bluet, ID.cornflower, ID.oxeye_daisy, ID.allium][Math.floor(R() * 6)];
          else if (b === 'forest' || b === 'birch_forest') fl = [ID.dandelion, ID.poppy, ID.lily_of_the_valley, ID.red_tulip, ID.pink_tulip, ID.white_tulip, ID.orange_tulip][Math.floor(R() * 7)];
          else if (b === 'swamp') fl = ID.blue_orchid;
          else if (b === 'cherry_grove') fl = R() < 0.5 ? ID.pink_petals : ID.dandelion;
          else fl = R() < 0.5 ? ID.dandelion : ID.poppy;
          c.blocks[(ci << 7) + h + 1] = fl;
        }
        else if (b === 'cherry_grove' && r < grassD + 0.25) c.blocks[(ci << 7) + h + 1] = ID.pink_petals;
        else if ((b === 'plains' || b === 'forest') && r > 0.9985) c.blocks[(ci << 7) + h + 1] = ID.pumpkin;
        else if ((b === 'swamp' || b === 'taiga') && r > 0.995) c.blocks[(ci << 7) + h + 1] = R() < 0.5 ? ID.brown_mushroom : ID.red_mushroom;
        else if (b === 'plains' && r > 0.998 && h > SEA) { /* melon */ }
      } else if (top === ID.sand || top === ID.red_sand) {
        if (b === 'desert') { if (r < 0.012) { var ch = 1 + Math.floor(R() * 3); for (var k = 0; k < ch; k++) if (h + 1 + k < H) c.blocks[(ci << 7) + h + 1 + k] = ID.cactus; } else if (r < 0.03) c.blocks[(ci << 7) + h + 1] = ID.dead_bush; }
        else if (h === SEA && r < 0.08) { var nearWater = false; for (var ddx = -1; ddx <= 1; ddx++) for (var ddz = -1; ddz <= 1; ddz++) if (heightAt(x + ddx, z + ddz) < SEA) nearWater = true; if (nearWater) { var sh = 1 + Math.floor(R() * 3); for (k = 0; k < sh; k++) c.blocks[(ci << 7) + h + 1 + k] = ID.sugar_cane; } }
      } else if (top === ID.snowy_grass_block && r < 0.05 && b === 'snowy_plains') { /* sparse */ }
      else if (top === ID.stone && b === 'windswept_hills' && r < 0.02) c.blocks[(ci << 7) + h + 1] = ID.short_grass;
    }
  }

  // ---------------- lighting ----------------
  var QCAP = 1 << 18;
  var qx = new Int32Array(QCAP), qy = new Int32Array(QCAP), qz = new Int32Array(QCAP), ql = new Int32Array(QCAP);
  var qh = 0, qt = 0;
  var rqx = new Int32Array(QCAP), rqy = new Int32Array(QCAP), rqz = new Int32Array(QCAP); var rqt = 0;
  function qpush(x, y, z, l) { if (qt >= QCAP) { qt = 0; } qx[qt] = x; qy[qt] = y; qz[qt] = z; ql[qt] = l; qt++; }
  function rqpush(x, y, z) { if (rqt >= QCAP) return; rqx[rqt] = x; rqy[rqt] = y; rqz[rqt] = z; rqt++; }
  var DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  function markDirty(c) { if (c && c.generated) { c.dirty = true; if (c.meshed) dirtySet.add(c); } }
  function setSky(c, i, v) { c.light[i] = (c.light[i] & 15) | (v << 4); }
  function setBlk(c, i, v) { c.light[i] = (c.light[i] & 0xF0) | v; }

  // propagate from queue (levels read from arrays)
  function propagate(isSky) {
    while (qh < qt) {
      var x = qx[qh], y = qy[qh], z = qz[qh]; qh++;
      var c = chunkAt(x, z); if (!c) continue;
      var i = idx(x & 15, y, z & 15);
      var lvl = isSky ? (c.light[i] >> 4) : (c.light[i] & 15);
      if (lvl <= 1) continue;
      for (var d = 0; d < 6; d++) {
        var nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2];
        if (ny < 0 || ny >= H) continue;
        var nc = (nx >> 4) === (x >> 4) && (nz >> 4) === (z >> 4) ? c : chunkAt(nx, nz); if (!nc) continue;
        var ni = idx(nx & 15, ny, nz & 15); var nb = nc.blocks[ni]; var op = lightOpacity[nb];
        if (op >= 15) continue;
        var nl = (isSky && d === 3 && lvl === 15 && op === 0) ? 15 : lvl - (op > 1 ? op : 1);
        if (nl <= 0) continue;
        var cur = isSky ? (nc.light[ni] >> 4) : (nc.light[ni] & 15);
        if (nl > cur) { if (isSky) setSky(nc, ni, nl); else setBlk(nc, ni, nl); qpush(nx, ny, nz, nl); if (nc !== c) markDirty(nc); else if (nc.meshed && nc.lit) markDirty(nc); }
      }
    }
    qh = qt = 0;
  }
  function removeLight(x0, y0, z0, isSky) {
    var c0 = chunkAt(x0, z0); if (!c0) return;
    var i0 = idx(x0 & 15, y0, z0 & 15); var old = isSky ? (c0.light[i0] >> 4) : (c0.light[i0] & 15);
    if (isSky) setSky(c0, i0, 0); else setBlk(c0, i0, 0);
    qh = qt = 0; rqt = 0; qpush(x0, y0, z0, old); markDirty(c0);
    while (qh < qt) {
      var x = qx[qh], y = qy[qh], z = qz[qh], ol = ql[qh]; qh++;
      for (var d = 0; d < 6; d++) {
        var nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2];
        if (ny < 0 || ny >= H) continue;
        var nc = chunkAt(nx, nz); if (!nc) continue;
        var ni = idx(nx & 15, ny, nz & 15); var nl = isSky ? (nc.light[ni] >> 4) : (nc.light[ni] & 15);
        if (nl === 0) continue;
        if (nl < ol || (isSky && d === 3 && ol === 15 && nl === 15)) { if (isSky) setSky(nc, ni, 0); else setBlk(nc, ni, 0); qpush(nx, ny, nz, nl); markDirty(nc); }
        else rqpush(nx, ny, nz);
      }
    }
    qh = qt = 0;
    for (var k = 0; k < rqt; k++) qpush(rqx[k], rqy[k], rqz[k], 0); rqt = 0;
    propagate(isSky);
  }
  // initial lighting of a freshly generated chunk
  function lightChunk(c) {
    var bl = c.blocks, L = c.light; var ox = c.cx * 16, oz = c.cz * 16;
    var NBL = neighborhood(c);
    // sky columns
    var maxH = c.maxH;
    for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) { var nb = chunks.get(key(c.cx + dx, c.cz + dz)); if (nb && nb.generated && nb.maxH > maxH) maxH = nb.maxH; }
    for (var lx = 0; lx < 16; lx++) for (var lz = 0; lz < 16; lz++) {
      var base = ((lx << 4) | lz) << 7; var lvl = 15;
      for (var y = H - 1; y >= 0; y--) {
        var op = lightOpacity[bl[base + y]];
        if (op >= 15) lvl = 0; else if (op > 0) lvl = Math.max(0, lvl - op);
        L[base + y] = (lvl << 4) | (emission[bl[base + y]]);
        if (lvl === 0 && op >= 15) { for (var yy = y - 1; yy >= 0; yy--) L[base + yy] = emission[bl[base + yy]]; break; }
      }
    }
    // seeds: sky cells adjacent to darker non-opaque cells (own chunk) and neighbor border cells
    qh = qt = 0;
    var top = Math.min(H - 1, maxH + 1);
    for (lx = 0; lx < 16; lx++) for (lz = 0; lz < 16; lz++) {
      base = ((lx << 4) | lz) << 7;
      for (y = 0; y <= top; y++) {
        var s = L[base + y] >> 4; if (s <= 1) continue;
        var x = ox + lx, z = oz + lz;
        // check 4 horizontal neighbors + below
        var need = false;
        for (var d = 0; d < 6 && !need; d++) { if (d === 2) continue; var nx = x + DIRS[d][0], ny = y + DIRS[d][1], nz = z + DIRS[d][2]; if (ny < 0) continue; var nc = NBL[((nx >> 4) - c.cx + 1) * 3 + ((nz >> 4) - c.cz + 1)]; if (!nc) continue; var ni = idx(nx & 15, ny, nz & 15); if (lightOpacity[nc.blocks[ni]] >= 15) continue; var ns_ = nc.light[ni] >> 4; if (ns_ < s - 1) need = true; }
        if (need) qpush(x, y, z, s);
      }
    }
    // neighbor border cells feeding into us
    for (var d2 = 0; d2 < 4; d2++) {
      var ncx = c.cx + DIRS[d2][0], ncz = c.cz + DIRS[d2][2]; var nc2 = chunks.get(key(ncx, ncz)); if (!nc2 || !nc2.generated) continue;
      for (var a = 0; a < 16; a++) for (y = 0; y <= top; y++) {
        var bx = DIRS[d2][0] === 1 ? 0 : DIRS[d2][0] === -1 ? 15 : a; var bz = DIRS[d2][2] === 1 ? 0 : DIRS[d2][2] === -1 ? 15 : a;
        var li = idx(bx, y, bz); if ((nc2.light[li] >> 4) > 1) qpush(ncx * 16 + bx, y, ncz * 16 + bz, 0);
      }
    }
    propagate(true);
    // block light seeds
    qh = qt = 0;
    for (lx = 0; lx < 16; lx++) for (lz = 0; lz < 16; lz++) { base = ((lx << 4) | lz) << 7; for (y = 0; y < H; y++) if (emission[bl[base + y]] > 0) qpush(ox + lx, y, oz + lz, 0); }
    for (d2 = 0; d2 < 4; d2++) {
      ncx = c.cx + DIRS[d2][0]; ncz = c.cz + DIRS[d2][2]; nc2 = chunks.get(key(ncx, ncz)); if (!nc2 || !nc2.generated) continue;
      for (a = 0; a < 16; a++) for (y = 0; y < H; y++) { bx = DIRS[d2][0] === 1 ? 0 : DIRS[d2][0] === -1 ? 15 : a; bz = DIRS[d2][2] === 1 ? 0 : DIRS[d2][2] === -1 ? 15 : a; li = idx(bx, y, bz); if ((nc2.light[li] & 15) > 1) qpush(ncx * 16 + bx, y, ncz * 16 + bz, 0); }
    }
    propagate(false);
    c.lit = true;
  }

  // ---------------- block edits ----------------
  function setBlockWorld(x, y, z, id, meta, silent) {
    if (y < 0 || y >= H) return;
    var c = chunkAt(x, z); if (!c) return;
    var lx = x & 15, lz = z & 15, i = idx(lx, y, lz);
    var old = c.blocks[i]; if (old === id && c.meta[i] === (meta || 0)) return;
    c.blocks[i] = id; c.meta[i] = meta || 0;
    // heightmaps
    var ci = lx * 16 + lz;
    if (BLOCKS[id].solid && y > c.topSolid[ci]) c.topSolid[ci] = y;
    else if (!BLOCKS[id].solid && y === c.topSolid[ci]) { var yy = y - 1; while (yy > 0 && !BLOCKS[c.blocks[(ci << 7) + yy]].solid) yy--; c.topSolid[ci] = yy; }
    if (id !== AIR && y > c.maxH) c.maxH = y;
    var oldOp = lightOpacity[old], newOp = lightOpacity[id], oldEm = emission[old], newEm = emission[id];
    if (c.lit) {
      if (oldEm > 0) removeLight(x, y, z, false);
      if (newOp > oldOp) { removeLight(x, y, z, false); removeLight(x, y, z, true); }
      else if (newOp < oldOp) {
        // opened: pour sky light down if open to sky, then pull from neighbors
        qh = qt = 0;
        if (newOp === 0 && (y === H - 1 || getSky(x, y + 1, z) === 15)) { for (var py = y; py >= 0; py--) { var pc = chunkAt(x, z); var pi = idx(lx, py, lz); if (lightOpacity[pc.blocks[pi]] >= 15) break; if (lightOpacity[pc.blocks[pi]] > 0 && py !== y) break; setSky(pc, pi, 15); qpush(x, py, z, 0); } }
        for (var d = 0; d < 6; d++) qpush(x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2], 0);
        propagate(true);
        qh = qt = 0; for (d = 0; d < 6; d++) qpush(x + DIRS[d][0], y + DIRS[d][1], z + DIRS[d][2], 0); propagate(false);
      }
      if (newEm > 0) { setBlk(c, i, newEm); qh = qt = 0; qpush(x, y, z, 0); propagate(false); }
    }
    markDirty(c);
    if (lx === 0) markDirty(chunks.get(key(c.cx - 1, c.cz))); if (lx === 15) markDirty(chunks.get(key(c.cx + 1, c.cz)));
    if (lz === 0) markDirty(chunks.get(key(c.cx, c.cz - 1))); if (lz === 15) markDirty(chunks.get(key(c.cx, c.cz + 1)));
    if (lx === 0 && lz === 0) markDirty(chunks.get(key(c.cx - 1, c.cz - 1))); if (lx === 15 && lz === 15) markDirty(chunks.get(key(c.cx + 1, c.cz + 1)));
    if (lx === 0 && lz === 15) markDirty(chunks.get(key(c.cx - 1, c.cz + 1))); if (lx === 15 && lz === 0) markDirty(chunks.get(key(c.cx + 1, c.cz - 1)));
  }

  // ---------------- meshing ----------------
  function Builder() { this.pos = []; this.uv = []; this.data = []; this.col = []; this.idx = []; this.n = 0; }
  Builder.prototype.quad = function (v, uv, layer, overlay, fr, lights, tint, shade, ao) {
    // v: 4 corners [x,y,z], uv: 4 [u,v], lights: 4 [sky, block], ao: 4 factors
    var base = this.n;
    for (var i = 0; i < 4; i++) {
      this.pos.push(v[i][0], v[i][1], v[i][2]); this.uv.push(uv[i][0], uv[i][1]);
      this.data.push(layer, overlay, fr, lights[i][0] * 16 + lights[i][1]);
      this.col.push(tint[0], tint[1], tint[2], shade * ao[i]);
    }
    // flip quad diagonal for better AO interpolation
    if (ao[0] + ao[2] > ao[1] + ao[3]) this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else this.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    this.n += 4;
  };
  Builder.prototype.pack = function () {
    if (!this.n) return null;
    return { pos: new Float32Array(this.pos), uv: new Float32Array(this.uv), data: new Float32Array(this.data), col: new Float32Array(this.col), idx: new Uint32Array(this.idx), count: this.idx.length };
  };
  // Face table: normal, corners (unit cube), uv per corner, tangent axes for AO
  var FACE = [
    { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 0.6, t1: 1, t2: 2 },
    { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 0.6, t1: 1, t2: 2 },
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 1.0, t1: 0, t2: 2 },
    { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.5, t1: 0, t2: 2 },
    { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 0.8, t1: 0, t2: 1 },
    { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: [[0, 1], [1, 1], [1, 0], [0, 0]], shade: 0.8, t1: 0, t2: 1 }
  ];
  var WHITE = [1, 1, 1];
  var AO_OCC = 0.2;

  function tintColorFor(kind, tints, ci) {
    if (!kind) return WHITE;
    var t = kind === 'grass' ? tints.grass : kind === 'foliage' ? tints.foliage : kind === 'water' ? tints.water : null;
    if (t) return [t[ci * 3] / 255, t[ci * 3 + 1] / 255, t[ci * 3 + 2] / 255];
    var st = ns.STATIC_TINT[kind]; if (st) return [st[0] / 255, st[1] / 255, st[2] / 255];
    return WHITE;
  }
  function biomeTints(c) {
    // blended biome colors per column (5x5 neighborhood)
    var grass = new Float32Array(256 * 3), foliage = new Float32Array(256 * 3), water = new Float32Array(256 * 3);
    for (var lx = 0; lx < 16; lx++) for (var lz = 0; lz < 16; lz++) {
      var gr = 0, gg = 0, gb = 0, fr = 0, fg = 0, fb = 0, wr = 0, wg = 0, wb = 0, n = 0;
      for (var dx = -2; dx <= 2; dx++) for (var dz = -2; dz <= 2; dz++) {
        var x = c.cx * 16 + lx + dx, z = c.cz * 16 + lz + dz; var nc = chunks.get(key(x >> 4, z >> 4));
        var bid = (nc && nc.generated) ? nc.biomes[(x & 15) * 16 + (z & 15)] : c.biomes[lx * 16 + lz];
        var b = ns.BIOMES[bid]; gr += b.grass[0]; gg += b.grass[1]; gb += b.grass[2]; fr += b.foliage[0]; fg += b.foliage[1]; fb += b.foliage[2]; wr += b.water[0]; wg += b.water[1]; wb += b.water[2]; n++;
      }
      var ci = (lx * 16 + lz) * 3; grass[ci] = gr / n; grass[ci + 1] = gg / n; grass[ci + 2] = gb / n; foliage[ci] = fr / n; foliage[ci + 1] = fg / n; foliage[ci + 2] = fb / n; water[ci] = wr / n; water[ci + 1] = wg / n; water[ci + 2] = wb / n;
    }
    return { grass: grass, foliage: foliage, water: water };
  }

  function meshChunk(c) {
    var ox = c.cx * 16, oz = c.cz * 16;
    var opaqueB = new Builder(), cutoutB = new Builder(), waterB = new Builder();
    var tints = biomeTints(c);
    var bl = c.blocks;
    // neighborhood-cached getters (no string keys / map lookups in the hot path)
    var NBH = neighborhood(c); var bedId = ID.bedrock; var ccx = c.cx, ccz = c.cz;
    function gb(x, y, z) { if (y < 0) return bedId; if (y >= H) return AIR; var dx = (x >> 4) - ccx + 1, dz = (z >> 4) - ccz + 1; if (dx < 0 || dx > 2 || dz < 0 || dz > 2) return AIR; var nc = NBH[dx * 3 + dz]; if (!nc) return AIR; return nc.blocks[(((x & 15) << 4 | (z & 15)) << 7) | y]; }
    function gl(x, y, z) { if (y >= H) return 0xF0; if (y < 0) return 0; var dx = (x >> 4) - ccx + 1, dz = (z >> 4) - ccz + 1; if (dx < 0 || dx > 2 || dz < 0 || dz > 2) return 0xF0; var nc = NBH[dx * 3 + dz]; if (!nc) return 0xF0; return nc.light[(((x & 15) << 4 | (z & 15)) << 7) | y]; }
    function vertexLightAO(x, y, z, f, ci, out) {
      var n = f.n; var nx = x + n[0], ny = y + n[1], nz = z + n[2];
      var cl = gl(nx, ny, nz); var csky = cl >> 4, cblk = cl & 15;
      var a1 = f.t1, a2 = f.t2;
      for (var k = 0; k < 4; k++) {
        var corner = f.c[k]; var s1 = corner[a1] ? 1 : -1, s2 = corner[a2] ? 1 : -1;
        var p1x = nx, p1y = ny, p1z = nz, p2x = nx, p2y = ny, p2z = nz;
        if (a1 === 0) p1x += s1; else if (a1 === 1) p1y += s1; else p1z += s1;
        if (a2 === 0) p2x += s2; else if (a2 === 1) p2y += s2; else p2z += s2;
        var p3x = p1x + (p2x - nx), p3y = p1y + (p2y - ny), p3z = p1z + (p2z - nz);
        var o1 = opaque[gb(p1x, p1y, p1z)], o2 = opaque[gb(p2x, p2y, p2z)], o3 = (o1 && o2) ? 1 : opaque[gb(p3x, p3y, p3z)];
        var sky = csky, blk = cblk, cnt = 1;
        if (!o1) { var l1 = gl(p1x, p1y, p1z); sky += l1 >> 4; blk += l1 & 15; cnt++; }
        if (!o2) { var l2 = gl(p2x, p2y, p2z); sky += l2 >> 4; blk += l2 & 15; cnt++; }
        if (!o3) { var l3 = gl(p3x, p3y, p3z); sky += l3 >> 4; blk += l3 & 15; cnt++; }
        out.light[k][0] = sky / cnt; out.light[k][1] = blk / cnt;
        out.ao[k] = (1 + (o1 ? AO_OCC : 1) + (o2 ? AO_OCC : 1) + (o3 ? AO_OCC : 1)) / 4;
      }
    }
    var scratch = { light: [[0, 0], [0, 0], [0, 0], [0, 0]], ao: [1, 1, 1, 1] };
    var flatLight = [[0, 0], [0, 0], [0, 0], [0, 0]], flatAO = [1, 1, 1, 1];
    function selfLight(x, y, z) { var l = gl(x, y, z); for (var k = 0; k < 4; k++) { flatLight[k][0] = l >> 4; flatLight[k][1] = l & 15; } return flatLight; }
    var v = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
    function cubeFace(x, y, z, f, layer, overlay, fr, tint, builder, x0, y0, z0, x1, y1, z1, uvs) {
      for (var k = 0; k < 4; k++) { var cc = f.c[k]; v[k][0] = x + (cc[0] ? x1 : x0); v[k][1] = y + (cc[1] ? y1 : y0); v[k][2] = z + (cc[2] ? z1 : z0); }
      vertexLightAO(x, y, z, f, 0, scratch);
      builder.quad(v, uvs || f.uv, layer, overlay, fr, scratch.light, tint, f.shade, scratch.ao);
    }
    var faceUV = [];
    for (var lx = 0; lx < 16; lx++) for (var lz = 0; lz < 16; lz++) {
      var ci = lx * 16 + lz; var base = ci << 7;
      var x = ox + lx, z = oz + lz;
      for (var y = 0; y < H; y++) {
        var id = bl[base + y]; if (id === AIR) continue;
        var B = BLOCKS[id]; var layers = faceLayer[id];
        var model = B.model;
        if (model === 'cube') {
          var tint = tintColorFor(B.tint, tints, ci);
          var fr = B.anim || 1;
          for (var f = 0; f < 6; f++) {
            var F = FACE[f]; var nb = gb(x + F.n[0], y + F.n[1], z + F.n[2]);
            if (nb === -1) continue;
            var NB = BLOCKS[nb];
            if (NB.opaque) continue;
            if (nb === id && (B.translucent || B.cutout) && B.name !== 'oak_leaves' && !(/leaves/).test(B.name)) continue; // glass-glass, ice-ice
            if (nb === id && (/leaves/).test(B.name)) { /* fancy leaves render inner faces */ }
            var overlay = 0, faceTint = tint, layer = layers[f];
            if (B.sideOverlay) { if (f === 2) { faceTint = tint; } else if (f === 3) { faceTint = WHITE; } else { overlay = texIndex.grass_block_side_overlay; faceTint = tint; } }
            else if (B.tint === 'grass' && f === 3) faceTint = WHITE;
            var builder = B.translucent ? waterB : (B.cutout ? cutoutB : opaqueB);
            var uvs = F.uv;
            if (B.hasMeta && (/_log$/).test(B.name)) { var axis = c.meta[base + y]; if (axis === 1) { layer = (f === 0 || f === 1) ? layers[2] : layers[0]; } else if (axis === 2) { layer = (f === 4 || f === 5) ? layers[2] : layers[0]; } }
            if (B.hasMeta && (B.name === 'furnace' || B.name === 'crafting_table' || B.name === 'jack_o_lantern' || B.name === 'carved_pumpkin' || B.name === 'chest')) { var facing = c.meta[base + y] & 3; var frontFace = [4, 1, 5, 0][facing]; layer = f === frontFace ? layers[4] : (f === 2 || f === 3 ? layers[f] : layers[0]); }
            cubeFace(x, y, z, F, layer, overlay, fr, faceTint, builder, 0, 0, 0, 1, 1, 1, uvs);
          }
        } else if (model === 'liquid') {
          var above = gb(x, y + 1, z); var isTop = above !== id;
          var wt = tintColorFor(B.tint, tints, ci); var wfr = B.anim || 1;
          var hgt = isTop ? 0.875 : 1;
          for (f = 0; f < 6; f++) {
            F = FACE[f]; nb = gb(x + F.n[0], y + F.n[1], z + F.n[2]); if (nb === -1) continue; NB = BLOCKS[nb];
            if (nb === id) continue; if (NB.opaque && f !== 2) continue; if (f === 2 && !isTop) continue;
            if (NB.solid && NB.fullCube && f !== 2) continue;
            var lt = selfLight(x, y, z);
            for (var k = 0; k < 4; k++) { var cc = F.c[k]; v[k][0] = x + cc[0]; v[k][1] = y + (cc[1] ? hgt : 0); v[k][2] = z + cc[2]; }
            waterB.quad(v, F.uv, layers[f], 0, wfr, lt, wt, F.shade, flatAO);
          }
        } else if (model === 'cross') {
          var pt = tintColorFor(B.tint, tints, ci); var lt2 = selfLight(x, y, z);
          var offx = 0, offz = 0;
          if (B.randomOffset) { var hsh = ns.hash3i(x, 0, z, seed); offx = (hsh - 0.5) * 0.5; offz = (((hsh * 7919) % 1) - 0.5) * 0.5; }
          var lay = layers[0];
          var q1 = [[x + 0.15 + offx, y, z + 0.15 + offz], [x + 0.85 + offx, y, z + 0.85 + offz], [x + 0.85 + offx, y + 1, z + 0.85 + offz], [x + 0.15 + offx, y + 1, z + 0.15 + offz]];
          var q2 = [[x + 0.85 + offx, y, z + 0.15 + offz], [x + 0.15 + offx, y, z + 0.85 + offz], [x + 0.15 + offx, y + 1, z + 0.85 + offz], [x + 0.85 + offx, y + 1, z + 0.15 + offz]];
          var suv = [[0, 1], [1, 1], [1, 0], [0, 0]];
          cutoutB.quad(q1, suv, lay, 0, 1, lt2, pt, 1.0, flatAO); cutoutB.quad(q2, suv, lay, 0, 1, lt2, pt, 1.0, flatAO);
        } else if (model === 'torch') {
          var meta = c.meta[base + y]; var lt3 = selfLight(x, y, z);
          torchModel(x, y, z, meta, layers[0], lt3, cutoutB);
        } else if (model === 'lantern') {
          var lt4 = selfLight(x, y, z);
          boxModel(x, y, z, 5 / 16, 0, 5 / 16, 11 / 16, 7 / 16, 11 / 16, layers[0], [[5, 6, 11, 13], [5, 6, 11, 13], [5, 4, 11, 10], [5, 4, 11, 10], [5, 6, 11, 13], [5, 6, 11, 13]], lt4, cutoutB);
          boxModel(x, y, z, 7 / 16, 7 / 16, 7 / 16, 9 / 16, 9 / 16, 9 / 16, layers[0], [[7, 4, 9, 6], [7, 4, 9, 6], [7, 4, 9, 6], [7, 4, 9, 6], [7, 4, 9, 6], [7, 4, 9, 6]], lt4, cutoutB);
        } else if (model === 'bed') {
          // Low mattress, distinct white pillow, and four wooden legs.
          var ltb = selfLight(x, y, z), bedUV = [[0, 0, 16, 16], [0, 0, 16, 16], [0, 0, 16, 16], [0, 0, 16, 16], [0, 0, 16, 16], [0, 0, 16, 16]];
          boxModel(x, y, z, 0, 3 / 16, 0, 1, 8 / 16, 1, layers[0], bedUV, ltb, opaqueB);
          boxModel(x, y, z, 0, 8 / 16, 0, 1, 10 / 16, 5 / 16, texIndex.white_wool, bedUV, ltb, opaqueB);
          [[0, 0], [14 / 16, 0], [0, 14 / 16], [14 / 16, 14 / 16]].forEach(function (p) { boxModel(x, y, z, p[0], 0, p[1], p[0] + 2 / 16, 3 / 16, p[1] + 2 / 16, texIndex.oak_planks, bedUV, ltb, opaqueB); });
        } else if (model === 'cactus') {
          for (f = 0; f < 6; f++) {
            F = FACE[f]; nb = gb(x + F.n[0], y + F.n[1], z + F.n[2]); if (nb === -1) continue;
            if ((f === 2 || f === 3) && nb === id) continue; if ((f === 2 || f === 3) && BLOCKS[nb].opaque) continue;
            var inset = (f === 2 || f === 3) ? 0 : 1 / 16;
            for (k = 0; k < 4; k++) { cc = F.c[k]; v[k][0] = x + (cc[0] ? 1 - (F.n[0] ? inset : 0) : (F.n[0] ? inset : 0)); v[k][1] = y + cc[1]; v[k][2] = z + (cc[2] ? 1 - (F.n[2] ? inset : 0) : (F.n[2] ? inset : 0)); }
            var ltc = selfLight(x, y, z);
            cutoutB.quad(v, F.uv, layers[f], 0, 1, ltc, WHITE, F.shade, flatAO);
          }
        } else if (model === 'layer') {
          for (f = 0; f < 6; f++) {
            F = FACE[f]; nb = gb(x + F.n[0], y + F.n[1], z + F.n[2]); if (nb === -1) continue; if (f === 3 && BLOCKS[nb].opaque) continue; if (f !== 2 && f !== 3 && (BLOCKS[nb].opaque || nb === id)) continue;
            var ltl = selfLight(x, y, z);
            var uvl = f === 2 || f === 3 ? F.uv : [[0, 1], [1, 1], [1, 1 - 2 / 16], [0, 1 - 2 / 16]];
            for (k = 0; k < 4; k++) { cc = F.c[k]; v[k][0] = x + cc[0]; v[k][1] = y + (cc[1] ? 2 / 16 : 0); v[k][2] = z + cc[2]; }
            opaqueB.quad(v, uvl, layers[f], 0, 1, ltl, WHITE, F.shade, flatAO);
          }
        } else if (model === 'petals') {
          var ltp = selfLight(x, y, z); var F2 = FACE[2];
          for (k = 0; k < 4; k++) { cc = F2.c[k]; v[k][0] = x + cc[0]; v[k][1] = y + 1 / 16; v[k][2] = z + cc[2]; }
          cutoutB.quad(v, F2.uv, layers[2], 0, 1, ltp, WHITE, 1.0, flatAO);
        }
      }
    }
    // small box helper (used by torch/lantern): px coordinates 0..16 for uv rects [u0,v0,u1,v1]
    function boxModel(x, y, z, x0, y0, z0, x1, y1, z1, layer, uvRects, lt, builder) {
      for (var f = 0; f < 6; f++) {
        var F = FACE[f]; var r = uvRects[f];
        var uvs = [[r[0] / 16, r[3] / 16], [r[2] / 16, r[3] / 16], [r[2] / 16, r[1] / 16], [r[0] / 16, r[1] / 16]];
        if (f === 2 || f === 3) uvs = [[r[0] / 16, r[3] / 16], [r[2] / 16, r[3] / 16], [r[2] / 16, r[1] / 16], [r[0] / 16, r[1] / 16]];
        for (var k = 0; k < 4; k++) { var cc = F.c[k]; v[k][0] = x + (cc[0] ? x1 : x0); v[k][1] = y + (cc[1] ? y1 : y0); v[k][2] = z + (cc[2] ? z1 : z0); }
        builder.quad(v, uvs, layer, 0, 1, lt, WHITE, F.shade, flatAO);
      }
    }
    function torchModel(x, y, z, meta, layer, lt, builder) {
      // meta 0 = floor, 1..4 = on wall (attached to -x,+x,-z,+z)
      var pts = [];
      var x0 = 7 / 16, x1 = 9 / 16, y0 = 0, y1 = 10 / 16, z0 = 7 / 16, z1 = 9 / 16;
      // The torch artwork spans the full texture height: the flame is at its top
      // and the handle below it.  Starting at row 6 cropped the flame entirely.
      var uvSide = [7 / 16, 0, 9 / 16, 1], uvTop = [7 / 16, 0, 9 / 16, 2 / 16];
      var tilt = 0, dx = 0, dz = 0;
      if (meta === 1) { tilt = 1; dx = -0.4; } else if (meta === 2) { tilt = 2; dx = 0.4; } else if (meta === 3) { tilt = 3; dz = -0.4; } else if (meta === 4) { tilt = 4; dz = 0.4; }
      for (var f = 0; f < 6; f++) {
        var F = FACE[f]; var r = (f === 2 || f === 3) ? uvTop : uvSide;
        var uvs = [[r[0], r[3]], [r[2], r[3]], [r[2], r[1]], [r[0], r[1]]];
        for (var k = 0; k < 4; k++) {
          var cc = F.c[k]; var px = (cc[0] ? x1 : x0) - 0.5, py = (cc[1] ? y1 : y0), pz = (cc[2] ? z1 : z0) - 0.5;
          if (tilt) { var ang = 0.4; var s = Math.sin(ang), co = Math.cos(ang); if (tilt === 1) { var nx = px * co + py * s, ny = py * co - px * s; px = nx; py = ny; } else if (tilt === 2) { nx = px * co - py * s; ny = py * co + px * s; px = nx; py = ny; } else if (tilt === 3) { var nz = pz * co + py * s; ny = py * co - pz * s; pz = nz; py = ny; } else { nz = pz * co - py * s; ny = py * co + pz * s; pz = nz; py = ny; } py += 3 / 16; }
          v[k][0] = x + 0.5 + px + dx; v[k][1] = y + py; v[k][2] = z + 0.5 + pz + dz;
        }
        builder.quad(v, uvs, layer, 0, 1, lt, WHITE, F.shade, flatAO);
      }
    }
    c.meshed = true; c.dirty = false;
    return { opaque: opaqueB.pack(), cutout: cutoutB.pack(), water: waterB.pack() };
  }

  // ---------------- scheduling ----------------
  function neighborsGenerated(cx, cz) { for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) { var c = chunks.get(key(cx + dx, cz + dz)); if (!c || !c.generated) return false; } return true; }
  function rebuildQueues() {
    genQueue = []; meshQueue = [];
    var R = center.r;
    for (var dx = -R - 1; dx <= R + 1; dx++) for (var dz = -R - 1; dz <= R + 1; dz++) {
      var cx = center.cx + dx, cz = center.cz + dz; var d = Math.max(Math.abs(dx), Math.abs(dz));
      var c = chunks.get(key(cx, cz));
      if (!c) { genQueue.push({ cx: cx, cz: cz, d: d }); }
      if (d <= R) { if (!c || !c.meshed || c.dirty) meshQueue.push({ cx: cx, cz: cz, d: d }); }
    }
    genQueue.sort(function (a, b) { return a.d - b.d; }); meshQueue.sort(function (a, b) { return a.d - b.d; });
    // unload far chunks
    chunks.forEach(function (c, k) {
      var d = Math.max(Math.abs(c.cx - center.cx), Math.abs(c.cz - center.cz));
      if (d > R + 3) { chunks.delete(k); colCache.delete(k); dirtySet.delete(c); invalidateChunkCache(); postMessage({ type: 'unload', cx: c.cx, cz: c.cz }); }
    });
  }
  function postChunk(c) {
    var blocks = c.blocks.slice(0), meta = c.meta.slice(0), heights = c.heights.slice(0), biomes = c.biomes.slice(0), topSolid = c.topSolid.slice(0);
    postMessage({ type: 'chunk', cx: c.cx, cz: c.cz, blocks: blocks.buffer, meta: meta.buffer, heights: heights.buffer, biomes: biomes.buffer, topSolid: topSolid.buffer, villageSpawns: c.villageSpawns || null }, [blocks.buffer, meta.buffer, heights.buffer, biomes.buffer, topSolid.buffer]);
  }
  function postMesh(c) {
    var t0 = Date.now();
    if (!c.lit) lightChunk(c);
    var t1 = Date.now(); STATS.lightMs += t1 - t0;
    var m = meshChunk(c);
    STATS.meshMs += Date.now() - t1; STATS.meshN++;
    var light = c.light.slice(0);
    var transfer = [light.buffer];
    ['opaque', 'cutout', 'water'].forEach(function (k) { var p = m[k]; if (p) transfer.push(p.pos.buffer, p.uv.buffer, p.data.buffer, p.col.buffer, p.idx.buffer); });
    postMessage({ type: 'mesh', cx: c.cx, cz: c.cz, parts: m, light: light.buffer }, transfer);
    dirtySet.delete(c);
  }
  var progressTotal = 0;
  function pump() {
    pumping = false;
    var start = Date.now(); var did = false;
    // 1. dirty (edited) chunks first
    if (dirtySet.size) { var arr = Array.from(dirtySet); for (var i = 0; i < arr.length; i++) { var c = arr[i]; if (c.generated && neighborsGenerated(c.cx, c.cz)) postMesh(c); else dirtySet.delete(c); } did = true; }
    while (Date.now() - start < 12) {
      var worked = false;
      // 2. mesh the nearest ready chunk (neighbors generated) — keeps the spawn area appearing first
      for (var j = 0; j < meshQueue.length; j++) {
        var m = meshQueue[j]; var mc = chunks.get(key(m.cx, m.cz));
        if (mc && mc.meshed && !mc.dirty) { meshQueue.splice(j, 1); j--; continue; }
        if (mc && mc.generated && neighborsGenerated(m.cx, m.cz)) { meshQueue.splice(j, 1); postMesh(mc); worked = true; break; }
        // only look a little past the nearest un-meshable chunk so generation can catch up
        if (j > 24) break;
      }
      // 3. generation (nearest first)
      if (!worked && genQueue.length) {
        var g = genQueue.shift();
        if (!chunks.has(key(g.cx, g.cz))) { var t0 = Date.now(); var nc = generate(g.cx, g.cz); STATS.genMs += Date.now() - t0; STATS.genN++; chunks.set(key(g.cx, g.cz), nc); invalidateChunkCache(); postChunk(nc); worked = true; }
        else worked = true;
      }
      if (!worked) break; did = true;
    }
    var pending = meshQueue.length;
    postMessage({ type: 'progress', pending: pending, gen: genQueue.length, stats: STATS });
    if (genQueue.length || meshQueue.length || dirtySet.size) schedule();
  }
  function schedule() { if (!pumping) { pumping = true; setTimeout(pump, 0); } }

  self.onmessage = function (e) {
    var m = e.data;
    switch (m.type) {
      case 'init':
        seed = m.seed | 0; texIndex = m.texIndex; frames = m.frames; forceBiome = m.forceBiome || null; initNoise();
        faceLayer = BLOCKS.map(function (b) { return b.faces.map(function (f) { return texIndex[f] !== undefined ? texIndex[f] : 0; }); });
        for (var i = 0; i < BLOCKS.length; i++) { var b = BLOCKS[i]; if (b.anim) b.anim = frames[b.faces[0]] || 1; }
        break;
      case 'center':
        center.cx = m.cx; center.cz = m.cz; center.r = m.r; center.active = true; rebuildQueues(); schedule(); break;
      case 'setBlock':
        setBlockWorld(m.x, m.y, m.z, m.id, m.meta || 0); schedule(); break;
      case 'setBlocks':
        for (var k = 0; k < m.list.length; k += 5) setBlockWorld(m.list[k], m.list[k + 1], m.list[k + 2], m.list[k + 3], m.list[k + 4]); schedule(); break;
      case 'growTree': {
        var changed = [];
        var tw = {
          set: function (x, y, z, id, meta) { var cur = getBlock(x, y, z); if (cur < 0) return; if (cur === AIR || BLOCKS[cur].replaceable || (BLOCKS[cur].cutout && !BLOCKS[cur].solid)) { setBlockWorld(x, y, z, id, meta || 0); changed.push(x, y, z, id, meta || 0); } },
          leaf: function (x, y, z, id) { var cur = getBlock(x, y, z); if (cur === AIR || (cur > 0 && BLOCKS[cur].replaceable)) { setBlockWorld(x, y, z, id, 0); changed.push(x, y, z, id, 0); } },
          get: function (x, y, z) { return getBlock(x, y, z); }
        };
        growTree(tw, { x: m.x, y: m.y, z: m.z, type: m.kind, seed: m.seed });
        if (changed.length) postMessage({ type: 'blockChanged', list: changed });
        schedule(); break;
      }
      case 'query':
        // debug: return block at pos
        postMessage({ type: 'query', id: getBlock(m.x, m.y, m.z), sky: getSky(m.x, m.y, m.z), blk: getBlockLight(m.x, m.y, m.z) }); break;
    }
  };
};
