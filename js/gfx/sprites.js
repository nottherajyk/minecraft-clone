// GUI sprites (HUD icons, widgets, logo, backgrounds) generated procedurally at 1 GUI px = 1 canvas px.
(function () {
  var S = {};
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function px(ctx, x, y, col, a) { ctx.fillStyle = typeof col === 'string' ? col : 'rgba(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ',' + (a === undefined ? 1 : a) + ')'; ctx.fillRect(x, y, 1, 1); }
  function art(ctx, rows, pal, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    for (var y = 0; y < rows.length; y++) for (var x = 0; x < rows[y].length; x++) { var ch = rows[y][x]; if (ch === '.' || ch === ' ') continue; var c = pal[ch]; if (!c) continue; ctx.fillStyle = c; ctx.fillRect(x + ox, y + oy, 1, 1); }
  }
  function sprite(name, w, h, fn) { var c = cv(w, h); var ctx = c.getContext('2d'); fn(ctx, c); S[name] = c; return c; }

  var HEART = ['.XX...XX.', 'X..X.X..X', 'X...X...X', 'X.......X', '.X.....X.', '..X...X..', '...X.X...', '....X....'];
  function heart(name, fill, hi, dark, outline, half) {
    sprite(name, 9, 9, function (ctx) {
      // interior fill first
      var inner = ['.........', '.ff.h.ff.', '.fff.fff.', '.fffffff.', '..fffff..', '...fff...', '....f....', '.........'];
      if (half) inner = inner.map(function (r) { return r.slice(0, 5) + '....'; });
      art(ctx, inner, { f: fill, h: fill });
      if (hi) { px(ctx, 1, 1, hi); px(ctx, 2, 1, hi); px(ctx, 1, 2, hi); }
      if (dark) { px(ctx, 4, 6, dark); px(ctx, 3, 5, dark); px(ctx, 5, 5, dark); px(ctx, 2, 4, dark); px(ctx, 6, 4, dark); }
      art(ctx, HEART, { X: outline });
    });
  }
  function build() {
    if (S.heart_full) return;
    var OUT = '#000000';
    heart('heart_container', 'rgba(40,40,40,1)', 'rgba(80,80,80,1)', null, OUT);
    heart('heart_full', '#ff0000', '#ff7b7b', '#bd0000', OUT);
    heart('heart_half', '#ff0000', '#ff7b7b', '#bd0000', OUT, true);
    // half heart: right half should show container interior
    (function () { var c = S.heart_half; var ctx = c.getContext('2d'); art(ctx, ['.........', '.....h.f.', '......ff.', '.....ff..', '.....f...', '.........'], { f: 'rgba(40,40,40,1)', h: 'rgba(40,40,40,1)' }); px(ctx, 5, 3, 'rgba(40,40,40,1)'); px(ctx, 6, 3, 'rgba(40,40,40,1)'); px(ctx, 7, 3, 'rgba(40,40,40,1)'); px(ctx, 5, 4, 'rgba(40,40,40,1)'); px(ctx, 6, 4, 'rgba(40,40,40,1)'); px(ctx, 5, 5, 'rgba(40,40,40,1)'); px(ctx, 6, 1, 'rgba(40,40,40,1)'); px(ctx, 7, 1, 'rgba(40,40,40,1)'); px(ctx, 5, 2, 'rgba(40,40,40,1)'); px(ctx, 6, 2, 'rgba(40,40,40,1)'); px(ctx, 7, 2, 'rgba(40,40,40,1)'); art(ctx, HEART, { X: OUT }); })();
    heart('heart_poison', '#94a061', '#c0cd8a', '#6b7642', OUT);
    heart('heart_absorb', '#ffc82a', '#ffe28a', '#c99a10', OUT);

    var FOOD = ['.........', '......XX.', '.....XwwX', '....XwwXX', '.XXXXwX..', 'XmmmmX...', 'XmMmmX...', 'XmmmX....', '.XXX.....'];
    sprite('food_container', 9, 9, function (ctx) { art(ctx, FOOD, { X: '#000000', w: 'rgba(48,48,48,1)', m: 'rgba(48,48,48,1)', M: 'rgba(70,70,70,1)' }); });
    sprite('food_full', 9, 9, function (ctx) { art(ctx, FOOD, { X: '#3e1a05', w: '#e8dcc8', m: '#a8531a', M: '#d88a3a' }); px(ctx, 7, 2, '#ffffff'); });
    sprite('food_half', 9, 9, function (ctx) { art(ctx, FOOD, { X: '#000000', w: 'rgba(48,48,48,1)', m: 'rgba(48,48,48,1)', M: 'rgba(70,70,70,1)' }); ctx.drawImage(S.food_full, 4, 0, 5, 9, 4, 0, 5, 9); });
    sprite('food_hunger_full', 9, 9, function (ctx) { art(ctx, FOOD, { X: '#3e2a05', w: '#c8c8a0', m: '#7a7a2a', M: '#a8a83a' }); });

    var ARMOR = ['.........', 'XXX...XXX', 'XwwX.XwwX', 'XwwXXXwwX', 'XwwwwwwwX', '.XXwwwXX.', '..XwwwX..', '..XwwwX..', '..XXXXX..'];
    sprite('armor_container', 9, 9, function (ctx) { art(ctx, ARMOR, { X: '#000000', w: 'rgba(48,48,48,1)' }); });
    sprite('armor_full', 9, 9, function (ctx) { art(ctx, ARMOR, { X: '#3a3a3a', w: '#d8d8d8' }); px(ctx, 1, 2, '#ffffff'); px(ctx, 2, 2, '#ffffff'); });
    sprite('armor_half', 9, 9, function (ctx) { art(ctx, ARMOR, { X: '#000000', w: 'rgba(48,48,48,1)' }); ctx.drawImage(S.armor_full, 0, 0, 5, 9, 0, 0, 5, 9); });
    var BUBBLE = ['..XXXXX..', '.XbbbbbX.', 'XbWbbbbbX', 'XbbbbbbbX', 'XbbbbbbbX', 'XbbbbbbbX', 'XbbbbbbbX', '.XbbbbbX.', '..XXXXX..'];
    sprite('bubble', 9, 9, function (ctx) { art(ctx, BUBBLE, { X: '#1c2f6b', b: '#5a8cff', W: '#d8e6ff' }); });
    sprite('bubble_pop', 9, 9, function (ctx) { art(ctx, ['.........', '.X.....X.', '..X...X..', '.........', '.X.....X.', '....X....', '.X.....X.', '..X...X..', '.........'], { X: '#8fb2ff' }); });

    // XP bar (182x5) empty + filled
    sprite('xp_bg', 182, 5, function (ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, 182, 5);
      ctx.fillStyle = 'rgba(38,48,38,1)'; ctx.fillRect(1, 1, 180, 3);
      for (var x = 1; x < 181; x += 9) { ctx.fillStyle = 'rgba(70,90,70,1)'; ctx.fillRect(x, 2, 1, 1); ctx.fillRect(x + 4, 1, 1, 3); }
      ctx.fillStyle = 'rgba(12,16,12,1)'; for (x = 5; x < 181; x += 9) ctx.fillRect(x + 4, 1, 1, 3);
    });
    sprite('xp_fill', 182, 5, function (ctx) {
      ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 182, 5);
      ctx.fillStyle = '#7eff26'; ctx.fillRect(1, 1, 180, 3); ctx.fillStyle = '#b7ff7a'; ctx.fillRect(1, 1, 180, 1); ctx.fillStyle = '#54c516'; ctx.fillRect(1, 3, 180, 1);
      for (var x = 1; x < 181; x += 9) { ctx.fillStyle = '#4a9a12'; ctx.fillRect(x + 4, 1, 1, 3); }
    });
    // crosshair 15x15 (9px plus in the middle)
    sprite('crosshair', 15, 15, function (ctx) { ctx.fillStyle = '#ffffff'; ctx.fillRect(3, 7, 9, 1); ctx.fillRect(7, 3, 1, 9); });
    sprite('crosshair_attack', 15, 15, function (ctx) { ctx.fillStyle = '#ffffff'; ctx.fillRect(3, 7, 9, 1); ctx.fillRect(7, 3, 1, 9); ctx.fillRect(4, 12, 7, 1); ctx.fillRect(4, 12, 1, 1); });

    // Hotbar 182x22
    sprite('hotbar', 182, 22, function (ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, 182, 22);
      for (var i = 0; i < 9; i++) {
        var x0 = 1 + i * 20;
        ctx.fillStyle = 'rgba(139,139,139,0.85)'; ctx.fillRect(x0, 1, 20, 20);
        ctx.fillStyle = 'rgba(28,28,28,0.75)'; ctx.fillRect(x0 + 1, 2, 18, 18);
      }
      ctx.clearRect(0, 0, 1, 1); ctx.clearRect(181, 0, 1, 1); ctx.clearRect(0, 21, 1, 1); ctx.clearRect(181, 21, 1, 1);
    });
    sprite('hotbar_selection', 24, 24, function (ctx) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 24, 24); ctx.clearRect(1, 1, 22, 22);
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(1, 1, 22, 22); ctx.clearRect(2, 2, 20, 20);
      ctx.clearRect(0, 0, 1, 1); ctx.clearRect(23, 0, 1, 1); ctx.clearRect(0, 23, 1, 1); ctx.clearRect(23, 23, 1, 1);
    });
    sprite('offhand', 29, 24, function (ctx) { ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, 22, 22); ctx.fillStyle = 'rgba(139,139,139,0.85)'; ctx.fillRect(1, 1, 20, 20); ctx.fillStyle = 'rgba(28,28,28,0.75)'; ctx.fillRect(2, 2, 18, 18); });

    // Buttons: body textures 200x20 (normal / hover / disabled)
    ['button', 'button_hover', 'button_disabled'].forEach(function (n, i) {
      var base = [[116, 116, 116], [132, 140, 210], [72, 72, 72]][i], spread = [10, 10, 6][i];
      sprite(n, 200, 20, function (ctx) {
        var r = MC.rng(MC.hashStr(n));
        for (var y = 0; y < 20; y++) for (var x = 0; x < 200; x++) {
          var k = r(); var d = k < 0.18 ? -spread : (k > 0.8 ? spread : 0);
          px(ctx, x, y, [base[0] + d, base[1] + d, base[2] + d]);
        }
        ctx.fillStyle = 'rgba(255,255,255,' + (i === 2 ? 0.12 : 0.35) + ')'; ctx.fillRect(1, 1, 198, 1); ctx.fillRect(1, 1, 1, 17);
        ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(1, 17, 198, 2); ctx.fillRect(198, 2, 1, 16);
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 200, 1); ctx.fillRect(0, 19, 200, 1); ctx.fillRect(0, 0, 1, 20); ctx.fillRect(199, 0, 1, 20);
        ctx.clearRect(0, 0, 1, 1); ctx.clearRect(199, 0, 1, 1); ctx.clearRect(0, 19, 1, 1); ctx.clearRect(199, 19, 1, 1);
      });
    });
    // slider handle 8x20 (normal/hover)
    sprite('slider_handle', 8, 20, function (ctx) { ctx.drawImage(S.button, 0, 0, 4, 20, 0, 0, 4, 20); ctx.drawImage(S.button, 196, 0, 4, 20, 4, 0, 4, 20); });
    sprite('slider_handle_hover', 8, 20, function (ctx) { ctx.drawImage(S.button_hover, 0, 0, 4, 20, 0, 0, 4, 20); ctx.drawImage(S.button_hover, 196, 0, 4, 20, 4, 0, 4, 20); });

    // Dark dirt background tile (options_background)
    sprite('dirt_bg', 16, 16, function (ctx) {
      var t = MC.Tex.tile('dirt');
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var c = t.get(x, y); px(ctx, x, y, [c[0] * 0.28, c[1] * 0.28, c[2] * 0.28]); }
    });
    sprite('stone_bg', 16, 16, function (ctx) { var t = MC.Tex.tile('stone'); for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var c = t.get(x, y); px(ctx, x, y, c); } });

    // Icon buttons 20x20 contents
    sprite('icon_language', 20, 20, function (ctx) {
      art(ctx, ['.....XXXXXX.....', '...XXwwwwwwXX...', '..XwwwwwwwwwwX..', '.XwwwwwwXwwwwwX.', '.XwwwwXXXXwwwwX.', 'XwwwXXXXXXXXwwwX', 'XwwXXXXXXXXXXwwX', 'XwwXXXXXXXXXXwwX', 'XwwwXXXXXXXXwwwX', 'XwwwwXXXXXXwwwwX', 'XwwwwwXXXXwwwwwX', '.XwwwwwXXwwwwwX.', '.XwwwwwwwwwwwwX.', '..XwwwwwwwwwwX..', '...XXwwwwwwXX...', '.....XXXXXX.....'], { X: '#1a3d8f', w: '#ffffff' }, 2, 2);
    });
    sprite('icon_accessibility', 20, 20, function (ctx) {
      art(ctx, ['......XXXX......', '.....XwwwwX.....', '.....XwwwwX.....', '......XXXX......', '.XXXXXXXXXXXXXX.', 'XwwwwwwwwwwwwwwX', 'XwwwXXwwwwXXwwwX', '.XXX.XwwwwX.XXX.', '.....XwwwwX.....', '.....XwwwwX.....', '....XwwwwwwX....', '....XwwXXwwX....', '....XwwXXwwX....', '...XwwwXXwwwX...', '...XwwXX.XwwX...', '...XXXX..XXXX...'], { X: '#000000', w: '#ffffff' }, 2, 2);
    });
    sprite('icon_realms_notify', 10, 10, function (ctx) { art(ctx, ['..XXXXXX..', '.XggGGgX..', 'XgGGGGGgX.', 'XgGGGGGGgX', 'XGGGGGGGgX', 'XGGGGGGggX', 'XgGGGGgggX', '.XggggggX.', '..XXXXXX..', '..........'], { X: '#1d5a1d', g: '#3fa83f', G: '#7ee87e' }); });
    sprite('icon_realms', 12, 12, function (ctx) { art(ctx, ['XXXXXXXXXXXX', 'XwwwwwwwwwwX', 'XwXXXwwXXXwX', 'XwXbXwwXbXwX', 'XwXXXwwXXXwX', 'XwwwwwwwwwwX', 'XwXXXXXXXXwX', 'XwXbbbbbbXwX', 'XwXbbbbbbXwX', 'XwXXXXXXXXwX', 'XwwwwwwwwwwX', 'XXXXXXXXXXXX'], { X: '#2b2b2b', w: '#c9c9c9', b: '#5a8fd6' }); });
    sprite('icon_search', 16, 16, function (ctx) { art(ctx, ['....XXXXX.......', '...XwwwwwX......', '..XwwXXXwwX.....', '..XwX...XwX.....', '..XwX...XwX.....', '..XwwXXXwwX.....', '...XwwwwwX......', '....XXXXXXX.....', '..........XX....', '...........XX...', '............XX..', '.............XX.', '..............X.'], { X: '#000000', w: '#c8c8c8' }); });
    sprite('icon_bed', 16, 16, function (ctx) { art(ctx, ['................', '................', '................', '................', '.XXXXXXXXXXXXXX.', 'XwwwwXrrrrrrrrrX', 'XwwwwXrrrrrrrrrX', 'XXXXXXXXXXXXXXXX', 'XbbbbbbbbbbbbbbX', 'XbbbbbbbbbbbbbbX', '.XXXXXXXXXXXXXX.', '.Xb..........bX.', '.Xb..........bX.', '.XX..........XX.', '................', '................'], { X: '#000000', w: '#f0f0f0', r: '#c0292d', b: '#8a5a2b' }); });
    sprite('icon_book', 16, 16, function (ctx) { art(ctx, ['................', '..XXXXXXXXXXX...', '.XwwwwwwwwwwwX..', '.XwbbbbbbbbbwX..', '.XwbbbbbbbbbwX..', '.XwwwwwwwwwwwX..', '.XwbbbbbbbbbwX..', '.XwbbbbbbbbbwX..', '.XwwwwwwwwwwwX..', '.XwbbbbbbbbbwX..', '.XwbbbbbbbbbwX..', '.XwwwwwwwwwwwX..', '.XXXXXXXXXXXXX..', '..XXXXXXXXXXX...', '................', '................'], { X: '#3a2a14', w: '#d8c8a8', b: '#4a8a3a' }); });
    sprite('icon_question', 16, 16, function (ctx) { });
    sprite('icon_close', 16, 16, function (ctx) { });

    // Logo 256x44 ("MINECRAFT" in blocky stone letters) + edition text 128x14
    buildLogo();
    // Sun / moon textures for the sky
    sprite('sun', 32, 32, function (ctx) {
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
        var dx = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5));
        var a = dx <= 8 ? 1 : dx <= 11 ? 0.55 : dx <= 14 ? 0.18 : 0;
        px(ctx, x, y, dx <= 8 ? [255, 255, 235] : [255, 240, 200], a);
      }
    });
    sprite('moon', 32, 32, function (ctx) {
      var r = MC.rng(99);
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
        var dx = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5));
        if (dx <= 8) { var k = r(); px(ctx, x, y, k < 0.12 ? [190, 190, 200] : k < 0.25 ? [215, 215, 225] : [240, 240, 245]); }
      }
    });
    // Steve skin (64x64) for the first-person arm and inventory model
    buildSkin();
  }

  function buildLogo() {
    var LETTERS = {
      M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#'],
      I: ['##', '##', '##', '##', '##', '##'],
      N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
      E: ['#####', '#....', '####.', '#....', '#....', '#####'],
      C: ['.####', '#....', '#....', '#....', '#....', '.####'],
      R: ['####.', '#...#', '####.', '#.#..', '#..#.', '#...#'],
      A: ['.###.', '#...#', '#####', '#...#', '#...#', '#...#'],
      F: ['#####', '#....', '####.', '#....', '#....', '#....'],
      T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..']
    };
    var word = 'MINECRAFT', cell = 5, gap = 3, depth = 4;
    var totalW = 0; for (var i = 0; i < word.length; i++) totalW += LETTERS[word[i]][0].length * cell + gap; totalW -= gap;
    var c = cv(256, 44); var ctx = c.getContext('2d');
    var r = MC.rng(31337);
    var x0 = Math.floor((256 - totalW) / 2), y0 = 3;
    var stoneT = MC.Tex.tile('stone');
    // mask of letter pixels
    var mask = new Uint8Array(256 * 44);
    var cx = x0;
    for (i = 0; i < word.length; i++) {
      var L = LETTERS[word[i]];
      for (var gy = 0; gy < 6; gy++) for (var gx = 0; gx < L[gy].length; gx++) if (L[gy][gx] === '#') for (var yy = 0; yy < cell; yy++) for (var xx = 0; xx < cell; xx++) mask[(y0 + gy * cell + yy) * 256 + cx + gx * cell + xx] = 1;
      cx += L[0].length * cell + gap;
    }
    // extrusion (dark) then face
    for (var y = 0; y < 44; y++) for (var x = 0; x < 256; x++) {
      if (!mask[y * 256 + x]) continue;
      for (var d = 1; d <= depth; d++) { if (y + d < 44 && !mask[(y + d) * 256 + x]) { var sc = 0.28 + (d === depth ? -0.08 : 0); var t = stoneT.get(x, y + d); px(ctx, x, y + d, [t[0] * sc, t[1] * sc, t[2] * sc]); } }
    }
    for (y = 0; y < 44; y++) for (x = 0; x < 256; x++) {
      if (!mask[y * 256 + x]) continue;
      var t2 = stoneT.get(x * 3, y * 3); var k = 0.82 + r() * 0.3;
      // bevel: lighter on top-left edge pixels, darker on bottom/right edge
      var up = y > 0 && mask[(y - 1) * 256 + x], left = x > 0 && mask[y * 256 + x - 1], down = y < 43 && mask[(y + 1) * 256 + x], right = x < 255 && mask[y * 256 + x + 1];
      if (!up || !left) k *= 1.25; else if (!down || !right) k *= 0.7;
      px(ctx, x, y, [Math.min(255, t2[0] * k), Math.min(255, t2[1] * k), Math.min(255, t2[2] * k)]);
    }
    // outline
    for (y = 0; y < 44; y++) for (x = 0; x < 256; x++) {
      if (mask[y * 256 + x]) continue;
      var near = false;
      for (var oy = -1; oy <= 1 && !near; oy++) for (var ox = -1; ox <= 1; ox++) { var nx = x + ox, ny = y + oy; if (nx < 0 || ny < 0 || nx > 255 || ny > 43) continue; if (mask[ny * 256 + nx] || (ny - depth >= 0 && mask[(ny - depth) * 256 + nx] && !mask[ny * 256 + nx])) { near = true; break; } }
      var extr = false; for (var d2 = 1; d2 <= depth; d2++) if (y - d2 >= 0 && mask[(y - d2) * 256 + x]) extr = true;
      if (near && !extr) px(ctx, x, y, [20, 20, 20], 0.9);
    }
    // creeper face inside the A
    var aIndex = word.indexOf('A'); var ax = x0; for (i = 0; i < aIndex; i++) ax += LETTERS[word[i]][0].length * cell + gap;
    var face = ['.........', '.##...##.', '.##...##.', '...###...', '..#####..', '..#...#..'];
    ctx.fillStyle = 'rgba(15,15,15,1)';
    for (var fy = 0; fy < face.length; fy++) for (var fx = 0; fx < face[fy].length; fx++) if (face[fy][fx] === '#') ctx.fillRect(ax + 8 + fx, y0 + 12 + fy, 1, 1);
    S.logo = c;

    // edition text
    var e = cv(128, 14); var ectx = e.getContext('2d');
    var tmp = cv(72, 8); var tctx = tmp.getContext('2d');
    MC.Font.draw(tctx, 'WEB EDITION', 0, 0, '#000000', false);
    tctx.globalCompositeOperation = 'source-over';
    ectx.imageSmoothingEnabled = false;
    // outline: draw black scaled copies at offsets, then light text
    var w = MC.Font.width('WEB EDITION') - 1; var sx = Math.floor((128 - w * 1.7) / 2);
    var offs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]];
    for (i = 0; i < offs.length; i++) ectx.drawImage(tmp, 0, 0, w, 8, sx + offs[i][0], 0 + offs[i][1], Math.round(w * 1.7), 14);
    var tmp2 = cv(72, 8); var t2ctx = tmp2.getContext('2d'); MC.Font.draw(t2ctx, 'WEB EDITION', 0, 0, '#e8e8e8', false);
    ectx.drawImage(tmp2, 0, 0, w, 8, sx, 0, Math.round(w * 1.7), 14);
    S.edition = e;
  }

  function buildSkin() {
    // Classic Steve-like skin, 64x64 layout (head 0,0; body 16,16; right arm 40,16; right leg 0,16; left leg 16,48; left arm 32,48)
    var c = cv(64, 64); var ctx = c.getContext('2d');
    var SKIN = '#b6896c', SKIN_D = '#a57a5c', HAIR = '#2f1e0e', SHIRT = '#00a6a6', SHIRT_D = '#008b8b', PANTS = '#3f3f8f', PANTS_D = '#343473', SHOE = '#6b6b6b', EYE_W = '#ffffff', EYE = '#4a3fcf', MOUTH = '#8a5a4a';
    function box(x, y, w, h, d, top, bottom, right, front, left, back) {
      ctx.fillStyle = top; ctx.fillRect(x + d, y, w, d);
      ctx.fillStyle = bottom; ctx.fillRect(x + d + w, y, w, d);
      ctx.fillStyle = right; ctx.fillRect(x, y + d, d, h);
      ctx.fillStyle = front; ctx.fillRect(x + d, y + d, w, h);
      ctx.fillStyle = left; ctx.fillRect(x + d + w, y + d, d, h);
      ctx.fillStyle = back; ctx.fillRect(x + 2 * d + w, y + d, w, h);
    }
    // head 8x8x8 at (0,0)
    box(0, 0, 8, 8, 8, HAIR, SKIN, SKIN_D, SKIN, SKIN_D, HAIR);
    // hair on top of front face + sides
    ctx.fillStyle = HAIR; ctx.fillRect(8, 8, 8, 2); ctx.fillRect(0, 8, 8, 3); ctx.fillRect(16, 8, 8, 3); ctx.fillRect(8, 10, 1, 1); ctx.fillRect(15, 10, 1, 1);
    // Two clearly separated eyes.  The previous four adjacent pixels read as one
    // long cyclops-like strip when the 8px face was scaled up in the inventory.
    ctx.fillStyle = EYE_W; ctx.fillRect(9, 12, 2, 1); ctx.fillRect(13, 12, 2, 1);
    ctx.fillStyle = EYE; ctx.fillRect(10, 12, 1, 1); ctx.fillRect(13, 12, 1, 1);
    // nose / mouth
    ctx.fillStyle = SKIN_D; ctx.fillRect(11, 13, 2, 1); ctx.fillStyle = MOUTH; ctx.fillRect(11, 14, 2, 1); ctx.fillStyle = HAIR; ctx.fillRect(10, 15, 4, 1); ctx.fillRect(9, 14, 1, 2); ctx.fillRect(14, 14, 1, 2);
    // body 8x12x4 at (16,16)
    box(16, 16, 8, 12, 4, SHIRT, SHIRT_D, SHIRT_D, SHIRT, SHIRT_D, SHIRT);
    ctx.fillStyle = PANTS; ctx.fillRect(20, 30, 8, 2); ctx.fillRect(16, 30, 4, 2); ctx.fillRect(28, 30, 12, 2);
    // right arm 4x12x4 at (40,16), left arm (32,48)
    box(40, 16, 4, 12, 4, SHIRT, SKIN, SKIN_D, SKIN, SKIN_D, SKIN); ctx.fillStyle = SHIRT; ctx.fillRect(40, 20, 16, 3); ctx.fillStyle = SHIRT_D; ctx.fillRect(40, 20, 4, 3); ctx.fillRect(48, 20, 4, 3);
    box(32, 48, 4, 12, 4, SHIRT, SKIN, SKIN_D, SKIN, SKIN_D, SKIN); ctx.fillStyle = SHIRT; ctx.fillRect(32, 52, 16, 3); ctx.fillStyle = SHIRT_D; ctx.fillRect(32, 52, 4, 3); ctx.fillRect(40, 52, 4, 3);
    // right leg (0,16), left leg (16,48)
    box(0, 16, 4, 12, 4, PANTS, SHOE, PANTS_D, PANTS, PANTS_D, PANTS); ctx.fillStyle = SHOE; ctx.fillRect(0, 29, 16, 3);
    box(16, 48, 4, 12, 4, PANTS, SHOE, PANTS_D, PANTS, PANTS_D, PANTS); ctx.fillStyle = SHOE; ctx.fillRect(16, 61, 16, 3);
    S.skin = c;
  }

  // Java-style panel + slot helpers (ctx already scaled to GUI px)
  function panel(ctx, x, y, w, h) {
    ctx.fillStyle = '#000000'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#c6c6c6'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 1, w - 3, 2); ctx.fillRect(x + 1, y + 1, 2, h - 3);
    ctx.fillStyle = '#555555'; ctx.fillRect(x + 2, y + h - 3, w - 3, 2); ctx.fillRect(x + w - 3, y + 2, 2, h - 3);
    ctx.fillStyle = '#c6c6c6'; ctx.fillRect(x + 1, y + h - 3, 1, 2); ctx.fillRect(x + w - 3, y + 1, 2, 1);
    ctx.clearRect(x, y, 1, 1); ctx.clearRect(x + w - 1, y, 1, 1); ctx.clearRect(x, y + h - 1, 1, 1); ctx.clearRect(x + w - 1, y + h - 1, 1, 1);
    ctx.fillStyle = '#000000'; ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y + 1, 1, 1); ctx.fillRect(x + w - 2, y, 1, 1); ctx.fillRect(x + w - 1, y + 1, 1, 1); ctx.fillRect(x, y + h - 2, 1, 1); ctx.fillRect(x + 1, y + h - 1, 1, 1); ctx.fillRect(x + w - 1, y + h - 2, 1, 1); ctx.fillRect(x + w - 2, y + h - 1, 1, 1);
  }
  function slot(ctx, x, y) {
    ctx.fillStyle = '#373737'; ctx.fillRect(x, y, 18, 18);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 17, 17, 1); ctx.fillRect(x + 17, y + 1, 1, 17);
    ctx.fillStyle = '#8b8b8b'; ctx.fillRect(x + 1, y + 1, 16, 16);
  }
  function bedrockPanel(ctx, x, y, w, h) {
    ctx.fillStyle = '#1e1e1f'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#c6c6c6'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillRect(x + 1, y + 1, 1, h - 2);
    ctx.fillStyle = '#8b8b8b'; ctx.fillRect(x + 1, y + h - 2, w - 2, 1); ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
  }
  function bedrockSlot(ctx, x, y, size) {
    size = size || 18;
    ctx.fillStyle = '#8b8b8b'; ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#373737'; ctx.fillRect(x, y, size, 1); ctx.fillRect(x, y, 1, size);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y + size - 1, size, 1); ctx.fillRect(x + size - 1, y, 1, size);
  }
  function tileBackground(ctx, w, h, name, alphaDim) {
    var t = S[name || 'dirt_bg']; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    for (var y = 0; y < h; y += 16) for (var x = 0; x < w; x += 16) ctx.drawImage(t, x, y);
  }
  // Draw a 200-wide button texture stretched to width w by splitting halves
  function buttonBody(ctx, x, y, w, h, state) {
    var img = state === 'hover' ? S.button_hover : state === 'disabled' ? S.button_disabled : S.button;
    var half = Math.floor(w / 2);
    var hh = Math.min(h, 20);
    ctx.drawImage(img, 0, 0, half, hh, x, y, half, hh);
    ctx.drawImage(img, 200 - (w - half), 0, w - half, hh, x + half, y, w - half, hh);
  }

  MC.Sprites = { build: build, s: S, panel: panel, slot: slot, bedrockPanel: bedrockPanel, bedrockSlot: bedrockSlot, tileBackground: tileBackground, buttonBody: buttonBody };
})();
