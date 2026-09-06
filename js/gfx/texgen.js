// Procedural block texture generator. Every tile is a 16x16 RGBA buffer in the Minecraft style.
// Tiles become layers of a DataArrayTexture (mipmapped, nearest magnification).
(function () {
  var TILES = [], BY_NAME = {}, FRAMES = {};

  function Tile(name) { this.name = name; this.d = new Uint8ClampedArray(16 * 16 * 4); this.d.fill(0); }
  Tile.prototype.set = function (x, y, c, a) {
    if (x < 0 || y < 0 || x > 15 || y > 15) return;
    var i = (y * 16 + x) * 4; this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a === undefined ? 255 : a;
  };
  Tile.prototype.get = function (x, y) { x &= 15; y &= 15; var i = (y * 16 + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; };
  Tile.prototype.fill = function (c, a) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) this.set(x, y, c, a); return this; };
  Tile.prototype.rect = function (x0, y0, w, h, c, a) { for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) this.set(x, y, c, a); return this; };
  Tile.prototype.copyFrom = function (o) { this.d.set(o.d); return this; };
  Tile.prototype.each = function (fn) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var c = this.get(x, y); var r = fn(x, y, c); if (r) this.set(x, y, r, r.length > 3 ? r[3] : c[3]); } return this; };

  function sh(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }            // shade
  function add(c, k) { return [c[0] + k, c[1] + k, c[2] + k]; }          // brighten
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function hex(h) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255]; }
  function rngFor(name) { return MC.rng(MC.hashStr(name)); }

  // clustered value noise in [0,1): coarse blobs + fine grain, wraps for tiling
  function makeNoise(rng, coarse, fineAmt) {
    var g = [];
    var n = coarse || 4;
    for (var i = 0; i < n * n; i++) g.push(rng());
    return function (x, y) {
      var fx = x / 16 * n, fy = y / 16 * n; var x0 = Math.floor(fx), y0 = Math.floor(fy); var tx = fx - x0, ty = fy - y0;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      var a = g[(y0 % n) * n + (x0 % n)], b = g[(y0 % n) * n + ((x0 + 1) % n)], c = g[((y0 + 1) % n) * n + (x0 % n)], d = g[((y0 + 1) % n) * n + ((x0 + 1) % n)];
      var v = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
      return v * (1 - (fineAmt || 0.35)) + rng() * (fineAmt || 0.35);
    };
  }

  // Quantized noisy fill from a palette (MC textures use a handful of discrete shades)
  function noisy(t, palette, rng, opts) {
    opts = opts || {};
    var nz = makeNoise(rng, opts.coarse || 4, opts.fine === undefined ? 0.5 : opts.fine);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var v = nz(x, y); if (opts.bias) v = Math.pow(v, opts.bias);
      var i = Math.min(palette.length - 1, Math.floor(v * palette.length));
      t.set(x, y, palette[i], opts.alpha);
    }
    return t;
  }
  function speckle(t, n, colors, rng) { for (var i = 0; i < n; i++) t.set(rng.int(16), rng.int(16), colors[rng.int(colors.length)]); return t; }

  // Cobblestone: voronoi cells with dark mortar
  function cobble(t, stonePal, mortar, rng, cells) {
    var pts = []; cells = cells || 9;
    for (var i = 0; i < cells; i++) pts.push([rng() * 16, rng() * 16, rng.pick(stonePal)]);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var best = 1e9, second = 1e9, bc = null;
      for (var k = 0; k < pts.length; k++) {
        for (var ox = -16; ox <= 16; ox += 16) for (var oy = -16; oy <= 16; oy += 16) {
          var dx = pts[k][0] + ox - x - 0.5, dy = pts[k][1] + oy - y - 0.5; var d = dx * dx + dy * dy;
          if (d < best) { second = best; best = d; bc = pts[k][2]; } else if (d < second) second = d;
        }
      }
      var edge = Math.sqrt(second) - Math.sqrt(best);
      var c = edge < 0.9 ? mortar : (edge < 1.8 ? sh(bc, 0.85) : (rng() < 0.15 ? add(bc, 12) : bc));
      t.set(x, y, c);
    }
    return t;
  }
  function bricks(t, bw, bh, brick, mortar, rng, dark) {
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var row = Math.floor(y / bh); var off = (row % 2) * Math.floor(bw / 2);
      var bx = (x + off) % bw, by = y % bh;
      var c;
      if (by === bh - 1 || bx === bw - 1) c = mortar;
      else { var k = MC.hash3(Math.floor((x + off) / bw), row, 7) % 3; c = k === 0 ? brick : (k === 1 ? sh(brick, 0.92) : add(brick, 6)); if (rng() < 0.08) c = sh(c, 0.9); }
      t.set(x, y, c);
    }
    return t;
  }
  function planks(t, base, rng) {
    var dark = sh(base, 0.72), line = sh(base, 0.55), light = add(base, 10);
    for (var y = 0; y < 16; y++) {
      var board = Math.floor(y / 4);
      for (var x = 0; x < 16; x++) {
        var c = base; var r = rng();
        if (y % 4 === 3) c = line; else if (r < 0.12) c = dark; else if (r < 0.2) c = light;
        // board end seams (offset per board)
        var seam = (board * 5 + 3) % 16; if (y % 4 !== 3 && x === seam) c = line;
        t.set(x, y, c);
      }
    }
    return t;
  }
  function logSide(t, base, dark, light, rng) {
    for (var x = 0; x < 16; x++) {
      var col = rng() < 0.35 ? dark : (rng() < 0.3 ? light : base);
      for (var y = 0; y < 16; y++) {
        var c = col; var r = rng(); if (r < 0.15) c = dark; else if (r < 0.22) c = light;
        t.set(x, y, c);
      }
    }
    return t;
  }
  function logTop(t, bark, wood, ring, rng) {
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      var c;
      if (d > 6.5) c = rng() < 0.3 ? sh(bark, 0.85) : bark;
      else if (d > 5.5) c = sh(wood, 0.8);
      else { var k = Math.floor(d); c = (k % 2 === 0) ? wood : ring; if (rng() < 0.1) c = sh(c, 0.92); }
      t.set(x, y, c);
    }
    return t;
  }
  function leaves(t, palette, rng, holeChance) {
    var nz = makeNoise(rng, 5, 0.6);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var v = nz(x, y);
      if (rng() < (holeChance || 0.16)) { t.set(x, y, [0, 0, 0], 0); continue; }
      var i = Math.min(palette.length - 1, Math.floor(v * palette.length));
      t.set(x, y, palette[i]);
    }
    return t;
  }
  function bevelBlock(t, base, light, dark, inner) {
    t.fill(base);
    for (var i = 0; i < 16; i++) { t.set(i, 0, light); t.set(0, i, light); t.set(i, 15, dark); t.set(15, i, dark); }
    if (inner) { t.rect(2, 2, 12, 12, inner); for (i = 2; i < 14; i++) { t.set(i, 2, sh(inner, 0.85)); t.set(2, i, sh(inner, 0.85)); t.set(i, 13, add(inner, 15)); t.set(13, i, add(inner, 15)); } }
    return t;
  }
  // Draw pixel-art from rows of chars using a palette map
  function art(t, rows, pal, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    for (var y = 0; y < rows.length; y++) for (var x = 0; x < rows[y].length; x++) {
      var ch = rows[y][x]; if (ch === '.' || ch === ' ') continue;
      var c = pal[ch]; if (!c) continue;
      t.set(x + ox, y + oy, c, c.length > 3 ? c[3] : 255);
    }
    return t;
  }

  function T(name, fn) {
    var t = new Tile(name); var rng = rngFor(name); fn(t, rng);
    t.index = TILES.length; TILES.push(t); BY_NAME[name] = t; return t;
  }
  function animated(name, frames, fn) {
    var first = null;
    for (var f = 0; f < frames; f++) { var t = T(f === 0 ? name : name + '#' + f, function (tt, rng) { fn(tt, rng, f); }); if (f === 0) first = t; }
    FRAMES[name] = frames; return first;
  }
  function alias(name, src) { BY_NAME[name] = BY_NAME[src]; }

  // ---------------- palettes ----------------
  var STONE = [hex(0x686868), hex(0x717171), hex(0x7a7a7a), hex(0x7f7f7f), hex(0x858585), hex(0x8f8f8f)];
  var DIRT = [hex(0x5a3f2a), hex(0x6d4a32), hex(0x79553a), hex(0x866043), hex(0x8f6a4c), hex(0x9a7250)];
  var GRASS_GRAY = [hex(0x9a9a9a), hex(0xa8a8a8), hex(0xb4b4b4), hex(0xbfbfbf), hex(0xcacaca), hex(0xd4d4d4), hex(0xdedede)];
  var SAND = [hex(0xcfc79a), hex(0xd6cd9c), hex(0xdbd3a0), hex(0xdfd8a6), hex(0xe3dcaa)];
  var RED_SAND = [hex(0xa2531c), hex(0xac5b23), hex(0xb66427), hex(0xbe6a2b), hex(0xc5732f)];
  var GRAVEL = [hex(0x5d5c5c), hex(0x6e6e6e), hex(0x7f7e7e), hex(0x8b8a8a), hex(0x9a9999), hex(0xa8a7a7)];
  var LEAF_GRAY = [hex(0x6a6a6a), hex(0x7c7c7c), hex(0x8e8e8e), hex(0xa0a0a0), hex(0xb0b0b0), hex(0xc0c0c0)];
  var WOOL = { white: 0xe9ecec, orange: 0xf07613, magenta: 0xbd44b3, light_blue: 0x3aafd9, yellow: 0xf8c627, lime: 0x70b919, pink: 0xed8dac, gray: 0x3e4447, light_gray: 0x8e8e86, cyan: 0x158991, purple: 0x792aac, blue: 0x35399d, brown: 0x724728, green: 0x546d1b, red: 0xa12722, black: 0x141519 };
  var CONCRETE = { white: 0xcfd5d6, orange: 0xe06101, magenta: 0xa9309f, light_blue: 0x2489c7, yellow: 0xf1af15, lime: 0x5ea918, pink: 0xd5658f, gray: 0x373a3e, light_gray: 0x7d7d73, cyan: 0x157788, purple: 0x64209c, blue: 0x2d2f8f, brown: 0x603c20, green: 0x495b24, red: 0x8e2121, black: 0x080a0f };
  var TERRACOTTA = { white: 0xd1b2a1, orange: 0xa15325, magenta: 0x95586c, light_blue: 0x706c8a, yellow: 0xba8523, lime: 0x677534, pink: 0xa04e4e, gray: 0x392a23, light_gray: 0x876a61, cyan: 0x575b5b, purple: 0x7a4958, blue: 0x4c3d5b, brown: 0x4d3323, green: 0x4b522a, red: 0x8f3d2e, black: 0x251610 };

  function build() {
    if (TILES.length) return;
    T('missing', function (t) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) t.set(x, y, ((x >> 3) + (y >> 3)) % 2 ? [248, 0, 248] : [0, 0, 0]); });

    // --- stone family ---
    T('stone', function (t, r) { noisy(t, STONE, r, { coarse: 4, fine: 0.45 }); });
    T('granite', function (t, r) { noisy(t, [hex(0x7b5a4b), hex(0x8a6553), hex(0x976b5b), hex(0xa3765f), hex(0xb08a75), hex(0x6e5142)], r, { coarse: 5, fine: 0.6 }); });
    T('polished_granite', function (t, r) { noisy(t, [hex(0x8f6553), hex(0x976b5b), hex(0x9e7160)], r, { coarse: 3, fine: 0.3 }); bevelBlock(t, t.get(4, 4), hex(0xa97e6b), hex(0x7a5645)); noisy(t, [hex(0x8f6553), hex(0x976b5b), hex(0x9e7160)], r, { coarse: 3, fine: 0.3 }); for (var i = 0; i < 16; i++) { t.set(i, 0, hex(0xa97e6b)); t.set(0, i, hex(0xa97e6b)); t.set(i, 15, hex(0x7a5645)); t.set(15, i, hex(0x7a5645)); } });
    T('diorite', function (t, r) { noisy(t, [hex(0x8f8f90), hex(0xa4a4a6), hex(0xb4b4b6), hex(0xbdbdbf), hex(0xc9c9cb), hex(0x7d7d7f)], r, { coarse: 5, fine: 0.7 }); });
    T('polished_diorite', function (t, r) { noisy(t, [hex(0xbbbbbd), hex(0xc4c4c6), hex(0xcbcbcd)], r, { coarse: 3, fine: 0.3 }); for (var i = 0; i < 16; i++) { t.set(i, 0, hex(0xd6d6d8)); t.set(0, i, hex(0xd6d6d8)); t.set(i, 15, hex(0x9d9d9f)); t.set(15, i, hex(0x9d9d9f)); } });
    T('andesite', function (t, r) { noisy(t, [hex(0x6f6f70), hex(0x7c7c7d), hex(0x868687), hex(0x8f8f90), hex(0x999a9a)], r, { coarse: 4, fine: 0.5 }); });
    T('polished_andesite', function (t, r) { noisy(t, [hex(0x818183), hex(0x878789), hex(0x8e8e90)], r, { coarse: 3, fine: 0.3 }); for (var i = 0; i < 16; i++) { t.set(i, 0, hex(0x9a9a9c)); t.set(0, i, hex(0x9a9a9c)); t.set(i, 15, hex(0x6a6a6c)); t.set(15, i, hex(0x6a6a6c)); } });
    T('smooth_stone', function (t, r) { noisy(t, [hex(0x9c9c9c), hex(0xa2a2a2), hex(0xa8a8a8), hex(0xafafaf)], r, { coarse: 3, fine: 0.3 }); });
    T('cobblestone', function (t, r) { cobble(t, [hex(0x7a7a7a), hex(0x858585), hex(0x929292), hex(0x9d9d9d), hex(0x6f6f6f)], hex(0x4a4a4a), r, 9); });
    T('mossy_cobblestone', function (t, r) { cobble(t, [hex(0x7a7a7a), hex(0x858585), hex(0x929292), hex(0x6f6f6f)], hex(0x4a4a4a), r, 9); var nz = makeNoise(r, 3, 0.3); t.each(function (x, y, c) { var v = nz(x, y); if (v > 0.55) return mixc(c, hex(0x5a7a3a), 0.8); }); });
    T('bedrock', function (t, r) { noisy(t, [hex(0x222222), hex(0x333333), hex(0x444444), hex(0x555555), hex(0x666666), hex(0x7a7a7a), hex(0x8c8c8c)], r, { coarse: 4, fine: 0.7 }); });
    T('deepslate', function (t, r) { noisy(t, [hex(0x4a4a4e), hex(0x515155), hex(0x585a5e), hex(0x606265), hex(0x6a6c70)], r, { coarse: 4, fine: 0.4 }); t.each(function (x, y, c) { if ((x + (y >> 2)) % 5 === 0 && r() < 0.6) return sh(c, 0.85); }); });
    T('deepslate_top', function (t, r) { noisy(t, [hex(0x4a4a4e), hex(0x515155), hex(0x585a5e), hex(0x606265)], r, { coarse: 4, fine: 0.4 }); });
    T('cobbled_deepslate', function (t, r) { cobble(t, [hex(0x4d4d51), hex(0x565659), hex(0x5f5f63), hex(0x46464a)], hex(0x2f2f32), r, 9); });
    T('tuff', function (t, r) { noisy(t, [hex(0x5a5c52), hex(0x686a5f), hex(0x74766b), hex(0x7f8175), hex(0x8c8e82)], r, { coarse: 5, fine: 0.6 }); });
    T('calcite', function (t, r) { noisy(t, [hex(0xd6d7d3), hex(0xdedfdb), hex(0xe4e5e1), hex(0xc9cac6)], r, { coarse: 4, fine: 0.5 }); });
    T('dripstone_block', function (t, r) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var band = [hex(0x866652), hex(0x7d5f4c), hex(0x90705b), hex(0x735645)][(y >> 1) % 4]; if (r() < 0.2) band = sh(band, 0.9); t.set(x, y, band); } });
    T('amethyst_block', function (t, r) { cobble(t, [hex(0x8f68c4), hex(0x9b75cf), hex(0x7f5bb5), hex(0xa987d8)], hex(0x5e3f8c), r, 7); });
    T('obsidian', function (t, r) { noisy(t, [hex(0x0a0716), hex(0x100b1e), hex(0x150e28), hex(0x1d1533), hex(0x261b40)], r, { coarse: 4, fine: 0.5 }); });
    T('netherrack', function (t, r) { noisy(t, [hex(0x4d1f1f), hex(0x5f2626), hex(0x6e2e2e), hex(0x7a3535), hex(0x8a3d3d)], r, { coarse: 5, fine: 0.6 }); });
    T('soul_sand', function (t, r) { noisy(t, [hex(0x3f2f26), hex(0x4c3a2e), hex(0x574236), hex(0x62493c)], r, { coarse: 4, fine: 0.5 }); art(t, ['..#..#....', '.#.#.#.#..', '..#...#...'], { '#': hex(0x2a1f19) }, 3, 5); });
    T('end_stone', function (t, r) { noisy(t, [hex(0xc9c58f), hex(0xd6d29d), hex(0xe0dca8), hex(0xe8e5b3), hex(0xbfba86)], r, { coarse: 5, fine: 0.6 }); });
    T('end_stone_bricks', function (t, r) { bricks(t, 8, 8, hex(0xdcd8a5), hex(0xb5b07c), r); });
    T('magma_block', function (t, r) { var nz = makeNoise(r, 3, 0.2); t.each(function (x, y) { var v = nz(x, y); return v > 0.62 ? (v > 0.75 ? hex(0xffb830) : hex(0xd6541a)) : (v > 0.45 ? hex(0x5c2a1c) : hex(0x3a1c17)); }); });
    T('glowstone', function (t, r) { var nz = makeNoise(r, 3, 0.35); t.each(function (x, y) { var v = nz(x, y); return v > 0.62 ? hex(0xfff6b8) : (v > 0.42 ? hex(0xe8c36a) : (v > 0.28 ? hex(0xb08b4b) : hex(0x8a6a3a))); }); });
    T('sea_lantern', function (t, r) { t.fill(hex(0xb5d4cf)); noisy(t, [hex(0xa7c8c2), hex(0xb9d9d4), hex(0xd2ebe7)], r, { coarse: 2, fine: 0.2 }); t.rect(3, 3, 10, 10, hex(0xdff5f0)); for (var i = 3; i < 13; i++) { t.set(i, 3, hex(0xc3e0db)); t.set(3, i, hex(0xc3e0db)); } t.rect(6, 6, 4, 4, hex(0xf2fffd)); });
    T('redstone_lamp_on', function (t, r) { noisy(t, [hex(0xd9a15a), hex(0xe8b56d), hex(0xf2c57c)], r, { coarse: 3, fine: 0.3 }); for (var i = 0; i < 16; i++) { t.set(i, 0, hex(0x6b4020)); t.set(0, i, hex(0x6b4020)); t.set(i, 15, hex(0x6b4020)); t.set(15, i, hex(0x6b4020)); } });
    T('quartz_block_side', function (t, r) { noisy(t, [hex(0xe9e3dc), hex(0xede8e2), hex(0xf1ede8)], r, { coarse: 3, fine: 0.3 }); for (var i = 0; i < 16; i++) { t.set(i, 0, hex(0xf6f3ef)); t.set(i, 15, hex(0xd7cfc4)); } });
    T('quartz_block_top', function (t, r) { noisy(t, [hex(0xe9e3dc), hex(0xede8e2), hex(0xf1ede8)], r, { coarse: 3, fine: 0.3 }); });
    T('quartz_block_bottom', function (t, r) { noisy(t, [hex(0xe4ddd5), hex(0xe9e3dc), hex(0xede8e2)], r, { coarse: 3, fine: 0.3 }); });
    T('chiseled_quartz_block', function (t, r) { noisy(t, [hex(0xe9e3dc), hex(0xede8e2)], r, { coarse: 3, fine: 0.2 }); t.rect(1, 1, 14, 14, hex(0xd9d1c8)); t.rect(2, 2, 12, 12, hex(0xede8e2)); t.rect(4, 4, 8, 8, hex(0xd9d1c8)); t.rect(5, 5, 6, 6, hex(0xf1ede8)); });
    T('chiseled_quartz_block_top', function (t, r) { noisy(t, [hex(0xe9e3dc), hex(0xede8e2)], r, { coarse: 3, fine: 0.2 }); t.rect(2, 2, 12, 12, hex(0xd9d1c8)); t.rect(3, 3, 10, 10, hex(0xede8e2)); });
    T('purpur_block', function (t, r) { bricks(t, 8, 8, hex(0xa97fa9), hex(0x8f6a8f), r); });
    T('prismarine', function (t, r) { cobble(t, [hex(0x63a59a), hex(0x6eb0a3), hex(0x7bbdb0), hex(0x5c998f)], hex(0x3f7a73), r, 8); });
    T('dark_prismarine', function (t, r) { bricks(t, 4, 4, hex(0x335d4f), hex(0x2a4d41), r); });
    T('prismarine_bricks', function (t, r) { bricks(t, 8, 4, hex(0x63a59a), hex(0x4a8a80), r); });
    T('nether_bricks', function (t, r) { bricks(t, 8, 4, hex(0x2c161a), hex(0x1c0d10), r); });
    T('red_nether_bricks', function (t, r) { bricks(t, 8, 4, hex(0x4a0d10), hex(0x2c0709), r); });
    T('bricks', function (t, r) { bricks(t, 8, 4, hex(0x976254), hex(0xa79c93), r); });
    T('stone_bricks', function (t, r) { bricks(t, 8, 8, hex(0x7f7f7f), hex(0x5c5c5c), r); speckle(t, 14, [hex(0x8a8a8a), hex(0x727272)], r); });
    T('mossy_stone_bricks', function (t, r) { bricks(t, 8, 8, hex(0x7f7f7f), hex(0x5c5c5c), r); var nz = makeNoise(r, 3, 0.3); t.each(function (x, y, c) { if (nz(x, y) > 0.55) return mixc(c, hex(0x5f7d3a), 0.85); }); });
    T('cracked_stone_bricks', function (t, r) { bricks(t, 8, 8, hex(0x7f7f7f), hex(0x5c5c5c), r); art(t, ['.#..', '..#.', '..#.', '.#..', '.#..', '..#.'], { '#': hex(0x4a4a4a) }, 4, 2); art(t, ['#.', '.#', '.#', '#.'], { '#': hex(0x4a4a4a) }, 11, 9); });
    T('chiseled_stone_bricks', function (t, r) { noisy(t, [hex(0x7a7a7a), hex(0x808080), hex(0x868686)], r, { coarse: 3, fine: 0.2 }); for (var i = 0; i < 16; i++) { t.set(i, 0, hex(0x8f8f8f)); t.set(0, i, hex(0x8f8f8f)); t.set(i, 15, hex(0x5c5c5c)); t.set(15, i, hex(0x5c5c5c)); } t.rect(3, 3, 10, 10, hex(0x5c5c5c)); t.rect(4, 4, 8, 8, hex(0x828282)); t.rect(6, 6, 4, 4, hex(0x5c5c5c)); t.rect(7, 7, 2, 2, hex(0x8a8a8a)); });
    T('mud_bricks', function (t, r) { bricks(t, 8, 4, hex(0x8b6a52), hex(0x6a4f3b), r); });
    T('packed_mud', function (t, r) { noisy(t, [hex(0x8b6a52), hex(0x94725a), hex(0x826048), hex(0x9c7a62)], r, { coarse: 4, fine: 0.5 }); });

    // --- soils ---
    T('dirt', function (t, r) { noisy(t, DIRT, r, { coarse: 4, fine: 0.55 }); speckle(t, 5, [hex(0x9a9a9a), hex(0x8c8c8c)], r); });
    T('coarse_dirt', function (t, r) { noisy(t, DIRT, r, { coarse: 4, fine: 0.55 }); speckle(t, 22, [hex(0x8a8a8a), hex(0x777777), hex(0x5a5a5a)], r); });
    T('rooted_dirt', function (t, r) { noisy(t, DIRT, r, { coarse: 4, fine: 0.55 }); art(t, ['#...#...', '.#.#....', '..#.....', '.#..#...', '#....#..'], { '#': hex(0x4e3624) }, 2, 5); });
    T('mud', function (t, r) { noisy(t, [hex(0x3a3641), hex(0x433f4a), hex(0x4a4652), hex(0x524e5a)], r, { coarse: 4, fine: 0.5 }); });
    T('clay', function (t, r) { noisy(t, [hex(0x9aa1b2), hex(0xa1a7b7), hex(0xa9afbd), hex(0xb0b6c3)], r, { coarse: 4, fine: 0.5 }); });
    T('gravel', function (t, r) { cobble(t, GRAVEL, hex(0x4f4e4e), r, 14); });
    T('sand', function (t, r) { noisy(t, SAND, r, { coarse: 4, fine: 0.5 }); });
    T('red_sand', function (t, r) { noisy(t, RED_SAND, r, { coarse: 4, fine: 0.5 }); });
    T('grass_block_top', function (t, r) { noisy(t, GRASS_GRAY, r, { coarse: 4, fine: 0.55 }); });
    T('grass_block_side_overlay', function (t, r) {
      var top = BY_NAME.grass_block_top;
      for (var x = 0; x < 16; x++) { var depth = 2 + (r() < 0.5 ? 1 : 0) + (r() < 0.3 ? 1 : 0); for (var y = 0; y < depth; y++) { var c = top.get(x, (y * 3 + x) & 15); t.set(x, y, c, 255); } }
    });
    T('grass_block_side', function (t, r) { t.copyFrom(BY_NAME.dirt); }); // overlay is tinted separately
    T('grass_block_snow', function (t, r) { t.copyFrom(BY_NAME.dirt); for (var x = 0; x < 16; x++) { var depth = 3 + (r() < 0.4 ? 1 : 0); for (var y = 0; y < depth; y++) t.set(x, y, [248 - r() * 10, 250 - r() * 8, 252]); } });
    T('snow', function (t, r) { noisy(t, [hex(0xf0f4f7), hex(0xf5f8fa), hex(0xfafcfd), hex(0xffffff)], r, { coarse: 4, fine: 0.4 }); });
    alias('snow_block', 'snow');
    T('podzol_top', function (t, r) { noisy(t, [hex(0x5a3d1f), hex(0x6b4a26), hex(0x7d5a2e), hex(0x8f6a37), hex(0xa27a3e)], r, { coarse: 4, fine: 0.6 }); speckle(t, 10, [hex(0xb98a3c), hex(0x4b3419)], r); });
    T('podzol_side', function (t, r) { t.copyFrom(BY_NAME.dirt); var top = BY_NAME.podzol_top; for (var x = 0; x < 16; x++) { var depth = 2 + (r() < 0.5 ? 1 : 0); for (var y = 0; y < depth; y++) t.set(x, y, top.get(x, y)); } });
    T('mycelium_top', function (t, r) { noisy(t, [hex(0x6b5e6e), hex(0x776a7a), hex(0x827485), hex(0x8e7f91)], r, { coarse: 4, fine: 0.55 }); speckle(t, 12, [hex(0xa093a3), hex(0x5a4f5d)], r); });
    T('mycelium_side', function (t, r) { t.copyFrom(BY_NAME.dirt); var top = BY_NAME.mycelium_top; for (var x = 0; x < 16; x++) { var depth = 2 + (r() < 0.5 ? 1 : 0); for (var y = 0; y < depth; y++) t.set(x, y, top.get(x, y)); } });
    T('dirt_path_top', function (t, r) { noisy(t, [hex(0x8f7a4e), hex(0x9a8556), hex(0xa48f5c), hex(0xae9964)], r, { coarse: 4, fine: 0.5 }); });
    T('dirt_path_side', function (t, r) { t.copyFrom(BY_NAME.dirt); var top = BY_NAME.dirt_path_top; for (var x = 0; x < 16; x++) for (var y = 0; y < 2; y++) t.set(x, y, top.get(x, y)); });
    T('moss_block', function (t, r) { noisy(t, [hex(0x4c6a2a), hex(0x587a30), hex(0x628a36), hex(0x6d963c)], r, { coarse: 4, fine: 0.5 }); speckle(t, 10, [hex(0x86ad4a)], r); });
    T('sponge', function (t, r) { noisy(t, [hex(0xb5b544), hex(0xc4c44e), hex(0xd0cf5d), hex(0xa4a33c)], r, { coarse: 4, fine: 0.5 }); speckle(t, 18, [hex(0x8a8a2e), hex(0x6e6e24)], r); });
    T('hay_block_side', function (t, r) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var c = [hex(0xb8962e), hex(0xc7a439), hex(0xd4b345), hex(0xa48526)][(x + (y >> 3) * 2) % 4]; if (r() < 0.1) c = sh(c, 0.85); if (y === 7 || y === 15) c = hex(0x7d6620); t.set(x, y, c); } });
    T('hay_block_top', function (t, r) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var c = [hex(0xb8962e), hex(0xc7a439), hex(0xd4b345), hex(0xa48526)][(y + (x >> 3)) % 4]; if (r() < 0.1) c = sh(c, 0.85); t.set(x, y, c); } });

    // --- ores ---
    function ore(name, cols, pattern) { T(name, function (t, r) { t.copyFrom(BY_NAME.stone); art(t, pattern, { a: cols[0], b: cols[1], c: cols[2] || cols[1] }); }); }
    var OREP = ['....aa..........', '...abba.....aa..', '...abba....abba.', '....aa......aa..', '.aa.............', 'abba....aa......', 'abba...abba.....', '.aa.....aa......', '........................'.slice(0, 16), '..........aa....', '..aa.....abba...', '.abba.....aa....', '.abba...........', '..aa.......aa...', '..........abba..', '...........aa...'];
    ore('coal_ore', [hex(0x2f2f2f), hex(0x141414)], OREP);
    ore('iron_ore', [hex(0xd8af93), hex(0xba8a70)], OREP);
    ore('gold_ore', [hex(0xfcee4b), hex(0xd9b93b)], OREP);
    ore('copper_ore', [hex(0xe0875e), hex(0xb96b46)], OREP);
    ore('diamond_ore', [hex(0x6cecec), hex(0x3fbfc9)], OREP);
    ore('emerald_ore', [hex(0x17dd62), hex(0x109a48)], OREP);
    ore('lapis_ore', [hex(0x2f5fd0), hex(0x1f3f9c)], OREP);
    ore('redstone_ore', [hex(0xff2a1a), hex(0xb31a0f)], OREP);

    // --- metal / gem blocks ---
    bevelBlock(T('iron_block', function () { }), hex(0xdcdcdc), hex(0xf2f2f2), hex(0xa8a8a8), hex(0xe6e6e6));
    bevelBlock(T('gold_block', function () { }), hex(0xf6d33c), hex(0xfff090), hex(0xc99a1f), hex(0xf9dd52));
    bevelBlock(T('diamond_block', function () { }), hex(0x6fe6e0), hex(0xc6fffb), hex(0x3aa9a6), hex(0x80eee8));
    bevelBlock(T('emerald_block', function () { }), hex(0x35c56b), hex(0x9cf7bd), hex(0x1f7f45), hex(0x45d77e));
    bevelBlock(T('lapis_block', function () { }), hex(0x2d4fa8), hex(0x5e7fd0), hex(0x1c2f6b), hex(0x3559b3));
    bevelBlock(T('coal_block', function () { }), hex(0x141414), hex(0x2c2c2c), hex(0x080808), hex(0x1a1a1a));
    bevelBlock(T('redstone_block', function () { }), hex(0xa9180b), hex(0xd23a2a), hex(0x6f0e05), hex(0xb71e10));
    bevelBlock(T('copper_block', function () { }), hex(0xc06b4a), hex(0xe08f6a), hex(0x8e4b30), hex(0xc87455));
    T('netherite_block', function (t, r) { bevelBlock(t, hex(0x443f44), hex(0x5c565c), hex(0x2c282c), hex(0x4a444a)); });

    // --- wood ---
    var WOODS = {
      oak: { plank: 0xa2814e, bark: [0x6b5430, 0x4d3a1f, 0x7d6337], wood: 0xb08e5b, ring: 0x9a7a4b },
      spruce: { plank: 0x735531, bark: [0x3b2611, 0x2a1a0b, 0x4c3218], wood: 0x8b6a3a, ring: 0x74562e },
      birch: { plank: 0xc8b77a, bark: [0xdad9d3, 0x3a3a38, 0xc7c6c0], wood: 0xd6c5a0, ring: 0xbcaa85 },
      jungle: { plank: 0xa07350, bark: [0x574a1f, 0x3d3315, 0x6b5a28], wood: 0xa88863, ring: 0x8f7250 },
      acacia: { plank: 0xac5d32, bark: [0x676157, 0x4a463f, 0x7a7469], wood: 0xb06035, ring: 0x9a522c },
      dark_oak: { plank: 0x432b14, bark: [0x3a2611, 0x261809, 0x4b3217], wood: 0x4f3417, ring: 0x3f2911 },
      cherry: { plank: 0xe3b5ad, bark: [0x3a2225, 0x2a171a, 0x4c2e33], wood: 0xe8bdb6, ring: 0xd6a49c }
    };
    Object.keys(WOODS).forEach(function (w) {
      var W = WOODS[w];
      T(w + '_planks', function (t, r) { planks(t, hex(W.plank), r); });
      T(w + '_log', function (t, r) {
        if (w === 'birch') { logSide(t, hex(W.bark[0]), hex(W.bark[2]), hex(0xe6e5df), r); for (var i = 0; i < 9; i++) { var x = r.int(16), y = r.int(16), l = 1 + r.int(3); for (var k = 0; k < l; k++) t.set((x + k) & 15, y, hex(0x3a3a38)); } }
        else logSide(t, hex(W.bark[0]), hex(W.bark[1]), hex(W.bark[2]), r);
      });
      T(w + '_log_top', function (t, r) { logTop(t, hex(W.bark[0]), hex(W.wood), hex(W.ring), r); });
    });
    T('oak_leaves', function (t, r) { leaves(t, LEAF_GRAY, r, 0.14); });
    T('spruce_leaves', function (t, r) { leaves(t, LEAF_GRAY, r, 0.12); });
    T('birch_leaves', function (t, r) { leaves(t, LEAF_GRAY, r, 0.16); });
    T('jungle_leaves', function (t, r) { leaves(t, LEAF_GRAY, r, 0.12); });
    T('acacia_leaves', function (t, r) { leaves(t, LEAF_GRAY, r, 0.14); });
    T('dark_oak_leaves', function (t, r) { leaves(t, LEAF_GRAY, r, 0.1); });
    T('cherry_leaves', function (t, r) { leaves(t, [hex(0xd97fb0), hex(0xe58fbd), hex(0xf0a2ca), hex(0xf7b8d7), hex(0xfcc9e1), hex(0xffd8ea)], r, 0.13); });
    T('bookshelf', function (t, r) {
      planks(t, hex(0xa2814e), r);
      var books = [0xa63a2e, 0x3a6a3a, 0x3a4a9a, 0x8a6a2a, 0xc9c9c9, 0x6a3a8a, 0x2a8a8a];
      for (var row = 0; row < 2; row++) { var y0 = row === 0 ? 1 : 9; var x = 1; while (x < 15) { var w = 1 + r.int(2); var col = hex(books[r.int(books.length)]); var h = 5 + r.int(2); for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) if (x + xx < 15) t.set(x + xx, y0 + (6 - h) + yy, yy === 1 ? add(col, 25) : col); x += w; if (r() < 0.2) { t.rect(x, y0, 1, 6, hex(0x2a1e10)); x++; } } t.rect(1, y0, 14, 1, hex(0x3a2a14)); t.rect(0, y0, 1, 6, hex(0x3a2a14)); t.rect(15, y0, 1, 6, hex(0x3a2a14)); }
    });
    T('crafting_table_top', function (t, r) {
      planks(t, hex(0xa87f4c), r); // lighter oak
      t.rect(0, 0, 16, 1, hex(0x6a4a2a)); t.rect(0, 15, 16, 1, hex(0x6a4a2a)); t.rect(0, 0, 1, 16, hex(0x6a4a2a)); t.rect(15, 0, 1, 16, hex(0x6a4a2a));
      art(t, ['.....##.', '....#..#', '...#..#.', '..#..#..', '.#..#...', '#..#....', '.##.....'], { '#': hex(0x8a8a8a) }, 2, 2);     // saw-ish
      art(t, ['....##', '...#..', '..#...', '####..', '#..#..', '....##'], { '#': hex(0x4a3a2a) }, 9, 9);
    });
    T('crafting_table_side', function (t, r) {
      planks(t, hex(0x8a6a3a), r); t.rect(0, 0, 16, 4, hex(0xa87f4c)); t.rect(0, 4, 16, 1, hex(0x5a3a1a));
      art(t, ['.##.', '#..#', '#..#', '.##.', '.##.', '.##.'], { '#': hex(0x4a4a4a) }, 3, 6);
      art(t, ['####', '#..#', '####', '.##.', '.##.', '.##.'], { '#': hex(0x5a4a3a) }, 9, 6);
    });
    T('crafting_table_front', function (t, r) {
      planks(t, hex(0x8a6a3a), r); t.rect(0, 0, 16, 4, hex(0xa87f4c)); t.rect(0, 4, 16, 1, hex(0x5a3a1a));
      art(t, ['#####', '#...#', '#####', '..#..', '..#..', '..#..', '..#..'], { '#': hex(0x4a4a4a) }, 3, 6);
      art(t, ['..#..', '.###.', '#####', '..#..', '..#..', '..#..'], { '#': hex(0x9a9a9a) }, 9, 6);
    });
    T('furnace_top', function (t, r) { t.copyFrom(BY_NAME.stone); });
    T('furnace_side', function (t, r) { cobble(t, [hex(0x7a7a7a), hex(0x858585), hex(0x929292), hex(0x6f6f6f)], hex(0x4a4a4a), r, 9); });
    T('furnace_front', function (t, r) { cobble(t, [hex(0x7a7a7a), hex(0x858585), hex(0x929292), hex(0x6f6f6f)], hex(0x4a4a4a), r, 9); t.rect(3, 7, 10, 8, hex(0x2a2a2a)); t.rect(4, 8, 8, 6, hex(0x0f0f0f)); t.rect(3, 6, 10, 1, hex(0x5a5a5a)); });
    T('tnt_side', function (t, r) { noisy(t, [hex(0xd6301b), hex(0xdb3a24), hex(0xc42a17)], r, { coarse: 3, fine: 0.3 }); t.rect(0, 5, 16, 5, hex(0xe8e8e8)); t.rect(0, 5, 16, 1, hex(0xd0d0d0)); art(t, ['###.#.#.###', '.#..##.#.#.', '.#..#.##.#.', '.#..#..#.#.'], { '#': hex(0x0a0a0a) }, 2, 6); t.rect(0, 0, 16, 1, hex(0xa8211a)); t.rect(0, 15, 16, 1, hex(0xa8211a)); });
    T('tnt_top', function (t, r) { noisy(t, [hex(0xa8a8a8), hex(0xb2b2b2), hex(0x9c9c9c)], r, { coarse: 3, fine: 0.3 }); t.rect(2, 2, 12, 12, hex(0xd6301b)); t.rect(4, 4, 8, 8, hex(0xa8a8a8)); t.rect(6, 6, 4, 4, hex(0x3a3a3a)); });
    T('tnt_bottom', function (t, r) { noisy(t, [hex(0xa8a8a8), hex(0xb2b2b2), hex(0x9c9c9c)], r, { coarse: 3, fine: 0.3 }); t.rect(2, 2, 12, 12, hex(0xd6301b)); });
    T('pumpkin_side', function (t, r) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var c = [hex(0xc76a17), hex(0xd7761c), hex(0xe0821f), hex(0xb85f13)][(x >> 1) % 4]; if (r() < 0.08) c = sh(c, 0.9); if (y === 0 || y === 15) c = sh(c, 0.75); t.set(x, y, c); } });
    T('pumpkin_top', function (t, r) { noisy(t, [hex(0xb85f13), hex(0xc76a17), hex(0xd7761c)], r, { coarse: 3, fine: 0.3 }); t.rect(6, 5, 4, 5, hex(0x5a7a20)); t.rect(7, 4, 2, 1, hex(0x4a6a18)); });
    T('carved_pumpkin', function (t, r) { t.copyFrom(BY_NAME.pumpkin_side); art(t, ['##...##', '.##.##.', '#..#..#'], { '#': hex(0x1a0a02) }, 4, 4); art(t, ['..#..#..#..', '.#########.', '#...#..#..#'], { '#': hex(0x1a0a02) }, 2, 9); });
    T('jack_o_lantern', function (t, r) { t.copyFrom(BY_NAME.pumpkin_side); art(t, ['##...##', '.##.##.', '#..#..#'], { '#': hex(0xffe066) }, 4, 4); art(t, ['..#..#..#..', '.#########.', '#...#..#..#'], { '#': hex(0xffe066) }, 2, 9); });
    T('melon_side', function (t, r) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var band = ((x + (y >> 2)) % 5) < 2; var c = band ? hex(0x6f9a1f) : hex(0x9fbf2a); if (r() < 0.1) c = sh(c, 0.9); t.set(x, y, c); } });
    T('melon_top', function (t, r) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var band = ((y + (x >> 2)) % 5) < 2; var c = band ? hex(0x6f9a1f) : hex(0x9fbf2a); if (r() < 0.1) c = sh(c, 0.9); t.set(x, y, c); } });
    T('chest_side', function (t, r) { planks(t, hex(0x9a6c3a), r); t.rect(0, 0, 16, 1, hex(0x3a2a14)); t.rect(0, 15, 16, 1, hex(0x3a2a14)); t.rect(0, 0, 1, 16, hex(0x3a2a14)); t.rect(15, 0, 1, 16, hex(0x3a2a14)); t.rect(0, 6, 16, 1, hex(0x5a3a1a)); });
    T('chest_front', function (t, r) { t.copyFrom(BY_NAME.chest_side); t.rect(7, 5, 2, 4, hex(0x6a6a6a)); t.rect(7, 5, 2, 1, hex(0x9a9a9a)); });
    T('chest_top', function (t, r) { planks(t, hex(0x9a6c3a), r); t.rect(0, 0, 16, 1, hex(0x3a2a14)); t.rect(0, 15, 16, 1, hex(0x3a2a14)); t.rect(0, 0, 1, 16, hex(0x3a2a14)); t.rect(15, 0, 1, 16, hex(0x3a2a14)); });
    T('note_block', function (t, r) { planks(t, hex(0x5e3c22), r); for (var i = 0; i < 16; i++) { t.set(i, 0, hex(0x3a2412)); t.set(i, 15, hex(0x3a2412)); t.set(0, i, hex(0x3a2412)); t.set(15, i, hex(0x3a2412)); } });
    T('jukebox_side', function (t, r) { planks(t, hex(0x5e3c22), r); for (var i = 0; i < 16; i++) { t.set(i, 0, hex(0x3a2412)); t.set(i, 15, hex(0x3a2412)); t.set(0, i, hex(0x3a2412)); t.set(15, i, hex(0x3a2412)); } t.rect(2, 2, 12, 12, hex(0x7a5030)); });
    T('jukebox_top', function (t, r) { t.copyFrom(BY_NAME.jukebox_side); t.rect(4, 4, 8, 8, hex(0x1a1a1a)); t.rect(7, 7, 2, 2, hex(0x8a8a8a)); });
    T('spawner', function (t, r) { t.fill([0, 0, 0], 0); for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { if (x % 4 === 0 || y % 4 === 0 || x === 15 || y === 15) t.set(x, y, [24 + r() * 14, 30 + r() * 14, 38 + r() * 10], 255); } });

    // --- sandstone ---
    T('sandstone_top', function (t, r) { noisy(t, [hex(0xd7cd9c), hex(0xdcd3a3), hex(0xe1d9ab)], r, { coarse: 3, fine: 0.3 }); });
    T('sandstone_bottom', function (t, r) { noisy(t, [hex(0xd0c692), hex(0xd7cd9c), hex(0xdcd3a3)], r, { coarse: 3, fine: 0.3 }); });
    T('sandstone', function (t, r) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var c = [hex(0xd7cd9c), hex(0xdcd3a3), hex(0xcbc08c), hex(0xe1d9ab), hex(0xbfb27a)][(y + (x >> 3)) % 5]; if (r() < 0.1) c = sh(c, 0.94); if (y === 0) c = hex(0xe6dfb4); if (y === 15) c = hex(0xb7aa71); t.set(x, y, c); } });
    T('cut_sandstone', function (t, r) { noisy(t, [hex(0xd7cd9c), hex(0xdcd3a3)], r, { coarse: 3, fine: 0.25 }); t.rect(0, 0, 16, 1, hex(0xe6dfb4)); t.rect(0, 7, 16, 1, hex(0xb7aa71)); t.rect(0, 8, 16, 1, hex(0xe6dfb4)); t.rect(0, 15, 16, 1, hex(0xb7aa71)); });
    T('chiseled_sandstone', function (t, r) { t.copyFrom(BY_NAME.cut_sandstone); t.rect(0, 7, 16, 2, hex(0xd7cd9c)); art(t, ['.##......##.', '.##......##.', '....####....', '...######...', '...#.##.#...', '...#....#...'], { '#': hex(0xb7aa71) }, 2, 5); });
    T('red_sandstone_top', function (t, r) { noisy(t, [hex(0xb4601f), hex(0xbc6823), hex(0xc47027)], r, { coarse: 3, fine: 0.3 }); });
    T('red_sandstone_bottom', function (t, r) { noisy(t, [hex(0xa8581a), hex(0xb4601f), hex(0xbc6823)], r, { coarse: 3, fine: 0.3 }); });
    T('red_sandstone', function (t, r) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var c = [hex(0xb4601f), hex(0xbc6823), hex(0xa4561a), hex(0xc47027), hex(0x944c15)][(y + (x >> 3)) % 5]; if (r() < 0.1) c = sh(c, 0.94); t.set(x, y, c); } });
    T('terracotta', function (t, r) { noisy(t, [hex(0x8f5a41), hex(0x985f45), hex(0xa06649), hex(0x8a5540)], r, { coarse: 4, fine: 0.5 }); });

    // --- colors ---
    Object.keys(WOOL).forEach(function (c) {
      T(c + '_wool', function (t, r) { var base = hex(WOOL[c]); var nz = makeNoise(r, 3, 0.4); t.each(function (x, y) { var v = nz(x, y); var k = 0.86 + v * 0.22; if (((x * 3 + y * 5) & 7) === 0) k -= 0.05; return sh(base, k); }); });
      T(c + '_concrete', function (t, r) { var base = hex(CONCRETE[c]); t.each(function (x, y) { return sh(base, 0.94 + r() * 0.1); }); });
      T(c + '_terracotta', function (t, r) { var base = hex(TERRACOTTA[c]); noisy(t, [sh(base, 0.9), base, add(base, 8)], r, { coarse: 4, fine: 0.5 }); });
    });

    // --- glass / ice / translucent ---
    T('glass', function (t, r) { t.fill([255, 255, 255], 0); for (var i = 0; i < 16; i++) { t.set(i, 0, [255, 255, 255], 255); t.set(i, 15, [255, 255, 255], 255); t.set(0, i, [255, 255, 255], 255); t.set(15, i, [255, 255, 255], 255); } for (i = 0; i < 16; i++) { if (i > 1 && i < 6) t.set(i, 7 - i, [255, 255, 255], 255); if (i > 3 && i < 9) t.set(i, 12 - i, [255, 255, 255], 255); if (i > 5 && i < 9) t.set(i + 4, 13 - i + 4 > 15 ? 15 : 13 - i + 4, [255, 255, 255], 255); } t.set(1, 1, [200, 220, 230], 180); t.set(14, 14, [200, 220, 230], 180); });
    function stained(name, col) { T(name, function (t) { t.fill(col, 110); for (var i = 0; i < 16; i++) { t.set(i, 0, add(col, 40), 200); t.set(i, 15, add(col, 40), 200); t.set(0, i, add(col, 40), 200); t.set(15, i, add(col, 40), 200); } }); }
    stained('white_stained_glass', hex(0xffffff)); stained('light_blue_stained_glass', hex(0x6cb6f0)); stained('red_stained_glass', hex(0xb02020));
    T('ice', function (t, r) { noisy(t, [hex(0x8fb9ff), hex(0x9cc1ff), hex(0xa7c9ff), hex(0xb5d2ff)], r, { coarse: 3, fine: 0.3, alpha: 200 }); art(t, ['#...', '.#..', '.#..', '..#.'], { '#': [220, 236, 255, 230] }, 3, 3); art(t, ['..#', '.#.', '#..'], { '#': [220, 236, 255, 230] }, 9, 9); });
    T('packed_ice', function (t, r) { noisy(t, [hex(0x82adf3), hex(0x8db5f5), hex(0x9cc0f8), hex(0xaacaf9)], r, { coarse: 3, fine: 0.3 }); });
    T('blue_ice', function (t, r) { noisy(t, [hex(0x6f9fe6), hex(0x74a8f0), hex(0x7db0f4), hex(0x86b8f8)], r, { coarse: 3, fine: 0.3 }); });
    T('slime_block', function (t) { t.fill(hex(0x77c76a), 170); t.rect(3, 3, 10, 10, hex(0x8fdc7f), 190); });
    T('honey_block', function (t) { t.fill(hex(0xf0a832), 200); t.rect(3, 3, 10, 10, hex(0xf7c04e), 220); });

    // --- water & lava (animated, 16 frames) ---
    var wn = new MC.Noise(777);
    animated('water_still', 16, function (t, r, f) {
      var ph = f / 16 * Math.PI * 2;
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        var v = 0.5 + 0.5 * Math.sin((x * 0.9 + y * 0.4) + ph + wn.noise2D(x * 0.3, y * 0.3) * 3) * 0.6 + wn.noise2D(x * 0.6 + f * 0.2, y * 0.6) * 0.25;
        var g = 165 + Math.round(MC.clamp(v, 0, 1) * 75);
        t.set(x, y, [g, g, g], 175);
      }
    });
    animated('lava_still', 16, function (t, r, f) {
      var ph = f / 16 * Math.PI * 2;
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        var v = wn.noise3D(x * 0.25, y * 0.25, ph * 0.6) * 0.6 + wn.noise2D(x * 0.5 + Math.cos(ph) * 1.5, y * 0.5 + Math.sin(ph) * 1.5) * 0.4;
        var c = v > 0.35 ? hex(0xffd23f) : v > 0.1 ? hex(0xf78c1e) : v > -0.2 ? hex(0xd6541a) : hex(0x9a2f0f);
        t.set(x, y, c);
      }
    });

    // --- plants (cross models) ---
    var G1 = [0x6e6e6e], G2 = [0x8a8a8a], G3 = [0xa0a0a0];
    T('short_grass', function (t, r) { t.fill([0, 0, 0], 0); var pal = { a: hex(0x707070), b: hex(0x8c8c8c), c: hex(0xa4a4a4) }; art(t, [
      '................', '................', '.....b..........', '.....b.......c..', '..b..b...b...c..', '..b..bb..b..c...', '..bb.bb..b.cc...', '...b.b..bb.c.b..', '...bbb..b.cc.b..', '...ab.b.b.c..b..', '....abb.b.c.bb..', '.b..abb.bbc.b...', '.bb.aab.bbcbb...', '..b.aabbabcb....', '..baaabbabbb....', '..aaaaaabbaa....'], pal); });
    T('fern', function (t, r) { t.fill([0, 0, 0], 0); var pal = { a: hex(0x707070), b: hex(0x8c8c8c), c: hex(0xa4a4a4) }; art(t, [
      '................', '..............c.', '.c...........c..', '..c....b....c...', '...c...b...c....', '....c..b..c.....', '.c...c.b.c...c..', '..c...cbc...c...', '...c..cbc..c....', '....c.cbc.c.....', '.....ccbcc......', '...c..cbc..c....', '....c.cbc.c.....', '.....ccbcc......', '......cbc.......', '.......b........'], pal); });
    T('dead_bush', function (t, r) { t.fill([0, 0, 0], 0); var pal = { a: hex(0x6b4a25), b: hex(0x8a6230), c: hex(0x5a3c1c) }; art(t, [
      '................', '................', '..b........b....', '...b......b...b.', '...b.b...b...b..', '....b.b.b...b...', '.....bb.b..b....', '......bbb.b.....', '.......bbb......', '.......ab.......', '......bab.......', '.....b.a........', '.......a........', '.......a........', '.......a........', '......aaa.......'], pal); });
    T('seagrass', function (t, r) { t.fill([0, 0, 0], 0); art(t, ['................', '................', '.....a..........', '.....a......a...', '..a..a...a..a...', '..a..aa..a.a....', '..aa.aa..a.a....', '...a.a..aa.a....', '...aaa..a.a.....', '...aa.a.a.a.....', '....aaa.a.a.....', '....aaa.aaa.....', '....aaa.aaa.....', '.....aaaaa......', '.....aaaaa......', '......aaa.......'], { a: hex(0x3f9a3b) }); });
    T('sugar_cane', function (t, r) { t.fill([0, 0, 0], 0); art(t, ['....ab....ab....', '....ab....ab....', '....ab....ab....', '....aa....aa....', '....ab....ab....', '....ab....ab....', '....ab....ab....', '....aa....aa....', '....ab....ab....', '....ab....ab....', '....ab....ab....', '....aa....aa....', '....ab....ab....', '....ab....ab....', '....ab....ab....', '....ab....ab....'], { a: hex(0x9aa46a), b: hex(0xbcc47e) }); });
    T('cobweb', function (t, r) { t.fill([0, 0, 0], 0); for (var i = 0; i < 16; i++) { t.set(i, i, [230, 230, 230], 255); t.set(15 - i, i, [230, 230, 230], 255); t.set(i, 7, [230, 230, 230], 255); t.set(7, i, [230, 230, 230], 255); } for (i = 0; i < 16; i += 4) { t.set(i + 1, 3, [230, 230, 230]); t.set(3, i + 1, [230, 230, 230]); t.set(i + 2, 11, [230, 230, 230]); t.set(11, i + 2, [230, 230, 230]); } });
    T('pink_petals', function (t, r) { t.fill([0, 0, 0], 0); for (var i = 0; i < 9; i++) { var x = r.int(14), y = r.int(14); t.rect(x, y, 2, 2, hex(0xf7b8d7)); t.set(x, y, hex(0xffd8ea)); t.set(x + 1, y + 1, hex(0xe58fbd)); } });
    function flower(name, rows, pal) { T(name, function (t) { t.fill([0, 0, 0], 0); art(t, rows, pal); }); }
    var STEM = { s: hex(0x3f7a25), S: hex(0x5a9a35), l: hex(0x4c8a2c) };
    flower('dandelion', ['................', '................', '................', '................', '......yyy.......', '.....yYyyy......', '.....yyyyy......', '.....yyyyy......', '......yyy.......', '.......s........', '.......s........', '..l....s....l...', '...l...s...l....', '....l..s..l.....', '.....l.s.l......', '.......s........'], Object.assign({ y: hex(0xf6d42a), Y: hex(0xfff08a) }, STEM));
    flower('poppy', ['................', '................', '................', '......rr........', '.....rrrr.......', '....rrRrrr......', '....rrkkrr......', '....rrkkrr......', '.....rrrr.......', '......s.........', '......s.........', '..l...s.l.......', '...l..sl........', '....l.s.........', '......s.........', '......s.........'], Object.assign({ r: hex(0xd41e1e), R: hex(0xf04a3a), k: hex(0x1a1a1a) }, STEM));
    flower('blue_orchid', ['................', '................', '................', '......bb........', '....bbbBbb......', '....bbbbbbb.....', '.....bbybb......', '......bb........', '.......s........', '.......s........', '.......s...l....', '..l....s..l.....', '...l...s.l......', '....l..sl.......', '.....l.s........', '.......s........'], Object.assign({ b: hex(0x2fa4e8), B: hex(0x7fd0ff), y: hex(0xf3e14a) }, STEM));
    flower('allium', ['................', '................', '.....mmmm.......', '....mmMmmm......', '...mmmmmmmm.....', '...mmMmmmmm.....', '...mmmmmmMm.....', '....mmmmmm......', '.....mmmm.......', '.......s........', '.......s........', '.......s........', '.......s........', '.......s........', '.......s........', '.......s........'], Object.assign({ m: hex(0xb36cd6), M: hex(0xd9a6f0) }, STEM));
    flower('azure_bluet', ['................', '................', '................', '..ww......ww....', '.wyww....wyww...', '..ww......ww....', '......ww........', '..s..wyww...s...', '..s...ww....s...', '...s..s....s....', '...s..s....s....', '....s.s...s.....', '....s.s..s......', '.....ss.s.......', '......ss........', '......s.........'], Object.assign({ w: hex(0xf0f0f0), y: hex(0xf3e14a) }, STEM));
    function tulip(name, col, hi) { flower(name, ['................', '................', '................', '......c.c.......', '.....ccCcc......', '.....ccccc......', '.....ccccc......', '......ccc.......', '.......s........', '.......s........', '.......s........', '..l....s........', '...l...s........', '....l..s........', '.....l.s........', '.......s........'], Object.assign({ c: col, C: hi }, STEM)); }
    tulip('red_tulip', hex(0xd0301c), hex(0xf06a4a)); tulip('orange_tulip', hex(0xe8801f), hex(0xf7b055)); tulip('white_tulip', hex(0xededed), hex(0xffffff)); tulip('pink_tulip', hex(0xe9a3c8), hex(0xf8cfe3));
    flower('oxeye_daisy', ['................', '................', '................', '....w..w..w.....', '.....wwwww......', '....wwyyyww.....', '...wwyyyyyww....', '....wwyyyww.....', '.....wwwww......', '....w..s..w.....', '.......s........', '.......s........', '..l....s........', '...l...s........', '....l..s........', '.......s........'], Object.assign({ w: hex(0xf0f0f0), y: hex(0xf3e14a) }, STEM));
    flower('cornflower', ['................', '................', '................', '.....b.b........', '....bbbbb.......', '.....bBbb.......', '....bbbbb.......', '.....b.b........', '.......s........', '.......s........', '.......s...l....', '..l....s..l.....', '...l...s.l......', '....l..s........', '.....l.s........', '.......s........'], Object.assign({ b: hex(0x466ad6), B: hex(0x8fa8ff) }, STEM));
    flower('lily_of_the_valley', ['................', '................', '.......s........', '......ws........', '.....www.s......', '......w..sw.....', '.......s.www....', '.......s..w.....', '....ww.s........', '...wwwws........', '....ww.s.ww.....', '.......swwww....', '..l....s.ww.....', '...l...s........', '....l..s........', '.......s........'], Object.assign({ w: hex(0xf5f5f5) }, STEM));
    flower('brown_mushroom', ['................', '................', '................', '................', '................', '................', '......bbbb......', '.....bBbbbb.....', '.....bbbbbb.....', '.......ww.......', '.......ww.......', '.......ww.......', '................', '................', '................', '................'], { b: hex(0x8a6a4a), B: hex(0xb08a60), w: hex(0xd8c8b0) });
    flower('red_mushroom', ['................', '................', '................', '................', '.....rrrrr......', '....rrwrrwr.....', '....rrrrrrr.....', '....rwrrrwr.....', '....rrrrrrr.....', '......www.......', '......www.......', '......www.......', '......www.......', '................', '................', '................'], { r: hex(0xd42a2a), w: hex(0xf0f0f0) });
    flower('oak_sapling', ['................', '................', '................', '......ggg.......', '.....ggggg......', '....ggGgggg.....', '....ggggggg.....', '.....ggggg......', '....gg.g.gg.....', '.......t........', '.......t........', '.......t........', '.......t........', '.......t........', '......ttt.......', '................'], { g: hex(0x4a8a2a), G: hex(0x6aaa3a), t: hex(0x6b4a25) });
    flower('birch_sapling', ['................', '................', '................', '......ggg.......', '.....ggggg......', '....ggGgggg.....', '....ggggggg.....', '.....ggggg......', '....gg.g.gg.....', '.......t........', '.......t........', '.......t........', '.......k........', '.......t........', '......ttt.......', '................'], { g: hex(0x7aa84a), G: hex(0x9ac86a), t: hex(0xdad9d3), k: hex(0x3a3a38) });
    flower('spruce_sapling', ['................', '.......g........', '......ggg.......', '......ggg.......', '.....ggggg......', '.....ggggg......', '....ggggggg.....', '....ggggggg.....', '...ggggggggg....', '.......t........', '.......t........', '.......t........', '.......t........', '.......t........', '......ttt.......', '................'], { g: hex(0x2f5a2f), t: hex(0x3b2611) });
    flower('cherry_sapling', ['................', '................', '................', '......ppp.......', '.....ppppp......', '....ppPpppp.....', '....ppppppp.....', '.....ppppp......', '....pp.p.pp.....', '.......t........', '.......t........', '.......t........', '.......t........', '.......t........', '......ttt.......', '................'], { p: hex(0xe58fbd), P: hex(0xfcc9e1), t: hex(0x3a2225) });
    T('cactus_side', function (t, r) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var c = [hex(0x5a8a2a), hex(0x66992f), hex(0x4f7a26), hex(0x70a536)][x % 4]; if (r() < 0.1) c = sh(c, 0.9); if (x === 0 || x === 15) c = hex(0x3f6a1f); t.set(x, y, c); } speckle(t, 10, [hex(0xd8e8b0)], r); });
    T('cactus_top', function (t, r) { noisy(t, [hex(0x6ea033), hex(0x78ab3a), hex(0x86b843)], r, { coarse: 3, fine: 0.3 }); for (var i = 0; i < 16; i++) { t.set(i, 0, hex(0x3f6a1f)); t.set(i, 15, hex(0x3f6a1f)); t.set(0, i, hex(0x3f6a1f)); t.set(15, i, hex(0x3f6a1f)); } });
    T('cactus_bottom', function (t, r) { noisy(t, [hex(0x5a8a2a), hex(0x66992f)], r, { coarse: 3, fine: 0.3 }); });
    T('torch', function (t) { t.fill([0, 0, 0], 0); art(t, ['..', 'yY', 'oy', 'rr', 'bb', 'ba', 'ab', 'ba', 'ab', 'ba', 'ab', 'ba', 'ab', 'ba', 'ab', 'ba'], { y: hex(0xffe77a), Y: hex(0xfff6c8), o: hex(0xffb833), r: hex(0xd66a1a), a: hex(0x7d5a2e), b: hex(0x9a7238) }, 7, 0); });
    T('lantern', function (t) { t.fill([0, 0, 0], 0); art(t, ['..#..', '.###.', '#iii#', '#iyi#', '#iyi#', '#iii#', '.###.', '..#..'], { '#': hex(0x3a3a48), i: hex(0xffc453), y: hex(0xfff0b0) }, 5, 4); });

    // --- destroy stages (cracks) ---
    for (var s = 0; s < 10; s++) {
      (function (stage) {
        T('destroy_stage_' + stage, function (t, r) {
          t.fill([0, 0, 0], 0);
          var rr = MC.rng(4242);
          // fixed crack seeds, revealed progressively
          var lines = [];
          for (var i = 0; i < 12; i++) { var x = 8 + (rr() - 0.5) * 3, y = 8 + (rr() - 0.5) * 3, ang = rr() * Math.PI * 2, len = 4 + rr() * 8; lines.push([x, y, ang, len, rr()]); }
          var reveal = (stage + 1) / 10;
          for (i = 0; i < lines.length; i++) {
            var L = lines[i]; var steps = Math.floor(L[3] * Math.min(1, reveal * 1.6));
            var px = L[0], py = L[1], a = L[2];
            for (var k = 0; k < steps; k++) { t.set(Math.floor(px), Math.floor(py), [0, 0, 0], 150 + stage * 10); px += Math.cos(a); py += Math.sin(a); a += (rr() - 0.5) * 0.9; }
          }
          if (stage > 4) for (i = 0; i < (stage - 4) * 6; i++) t.set(rr.int(16), rr.int(16), [0, 0, 0], 120 + stage * 10);
        });
      })(s);
    }
    // aliases used by blocks
    alias('snow_block', 'snow');
  }

  function makeArrayTexture() {
    var n = TILES.length;
    var data = new Uint8Array(16 * 16 * 4 * n);
    for (var i = 0; i < n; i++) data.set(TILES[i].d, i * 16 * 16 * 4);
    var tex = new THREE.DataArrayTexture(data, 16, 16, n);
    tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType;
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.generateMipmaps = true; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  // canvas for 2D use (GUI flat icons, particles) — 16px tiles
  function tileCanvas(name) {
    var t = BY_NAME[name] || BY_NAME.missing;
    if (t.canvas) return t.canvas;
    var c = document.createElement('canvas'); c.width = 16; c.height = 16;
    var ctx = c.getContext('2d'); var img = ctx.createImageData(16, 16); img.data.set(t.d); ctx.putImageData(img, 0, 0);
    t.canvas = c; return c;
  }
  // tinted copy
  function tintedTileCanvas(name, tint) {
    var key = name + '|' + tint.join(',');
    tintedTileCanvas.cache = tintedTileCanvas.cache || {};
    if (tintedTileCanvas.cache[key]) return tintedTileCanvas.cache[key];
    var t = BY_NAME[name] || BY_NAME.missing;
    var c = document.createElement('canvas'); c.width = 16; c.height = 16;
    var ctx = c.getContext('2d'); var img = ctx.createImageData(16, 16);
    for (var i = 0; i < 256; i++) { img.data[i * 4] = t.d[i * 4] * tint[0] / 255; img.data[i * 4 + 1] = t.d[i * 4 + 1] * tint[1] / 255; img.data[i * 4 + 2] = t.d[i * 4 + 2] * tint[2] / 255; img.data[i * 4 + 3] = t.d[i * 4 + 3]; }
    ctx.putImageData(img, 0, 0); tintedTileCanvas.cache[key] = c; return c;
  }
  function avgColor(name) {
    var t = BY_NAME[name] || BY_NAME.missing; var r = 0, g = 0, b = 0, n = 0;
    for (var i = 0; i < 256; i++) { if (t.d[i * 4 + 3] < 128) continue; r += t.d[i * 4]; g += t.d[i * 4 + 1]; b += t.d[i * 4 + 2]; n++; }
    n = n || 1; return [r / n, g / n, b / n];
  }

  MC.Tex = {
    build: build, TILES: TILES, BY_NAME: BY_NAME, FRAMES: FRAMES,
    layer: function (name) { var t = BY_NAME[name]; return t ? t.index : 0; },
    frames: function (name) { return FRAMES[name] || 1; },
    tile: function (name) { return BY_NAME[name] || BY_NAME.missing; },
    makeArrayTexture: makeArrayTexture, tileCanvas: tileCanvas, tintedTileCanvas: tintedTileCanvas, avgColor: avgColor,
    indexMap: function () { var m = {}; for (var k in BY_NAME) m[k] = BY_NAME[k].index; return m; }
  };
})();
