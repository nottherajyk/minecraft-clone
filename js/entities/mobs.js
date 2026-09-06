// Mobs: procedural box models + skins, wandering/hostile AI, spawning, combat, drops.
(function () {
  var TYPES = {};
  var list = [];
  var ctx = { world: null, scene: null, ents: null, shared: null, sky: null, game: null, player: null };
  var skins = {}, materials = {};

  // ---------- skin painting helpers ----------
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rnd(seedStr) { return MC.rng(MC.hashStr(seedStr)); }
  // paint a box's 6 faces in MC layout; colors: fn(face, x, y, w, h) -> css or css string
  function paintBox(g, u, v, w, h, d, color, noiseAmt, r) {
    var faces = { top: [u + d, v, w, d], bottom: [u + d + w, v, w, d], right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h] };
    Object.keys(faces).forEach(function (f) {
      var rr = faces[f]; var base = typeof color === 'function' ? color(f) : color;
      for (var y = 0; y < rr[3]; y++) for (var x = 0; x < rr[2]; x++) {
        var c = base; if (noiseAmt) { var k = 1 + (r() - 0.5) * noiseAmt; c = shade(base, k); }
        g.fillStyle = c; g.fillRect(rr[0] + x, rr[1] + y, 1, 1);
      }
    });
    return faces;
  }
  function shade(css, k) { var m = /rgb\((\d+),(\d+),(\d+)\)/.exec(css); if (!m) { var n = parseInt(css.slice(1), 16); m = [0, (n >> 16) & 255, (n >> 8) & 255, n & 255]; } return 'rgb(' + Math.min(255, m[1] * k | 0) + ',' + Math.min(255, m[2] * k | 0) + ',' + Math.min(255, m[3] * k | 0) + ')'; }
  function px(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
  function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }

  // Box UV mapping for THREE.BoxGeometry to MC layout
  function boxUV(geo, texW, texH, u, v, w, h, d, mirror) {
    var uv = geo.attributes.uv;
    function setFace(fi, x0, y0, x1, y1) {
      var i = fi * 4; var a = x0 / texW, b = x1 / texW, c = 1 - y0 / texH, e = 1 - y1 / texH;
      if (mirror) { var t = a; a = b; b = t; }
      uv.setXY(i, a, c); uv.setXY(i + 1, b, c); uv.setXY(i + 2, a, e); uv.setXY(i + 3, b, e);
    }
    setFace(0, u, v + d, u + d, v + d + h);                 // +x right
    setFace(1, u + d + w, v + d, u + 2 * d + w, v + d + h); // -x left
    setFace(2, u + d, v, u + d + w, v + d);                 // +y top
    setFace(3, u + d + w, v, u + 2 * d + w, v + d);         // -y bottom
    setFace(4, u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h); // +z back
    setFace(5, u + d, v + d, u + d + w, v + d + h);         // -z front
    uv.needsUpdate = true;
  }
  var SHADES = [0.8, 0.8, 1.0, 0.55, 0.85, 0.85];
  function makePart(def, tex) {
    var s = def.size, inflate = def.inflate || 0;
    var geo = new THREE.BoxGeometry((s[0] + inflate * 2) / 16, (s[1] + inflate * 2) / 16, (s[2] + inflate * 2) / 16);
    boxUV(geo, tex.width, tex.height, def.uv[0], def.uv[1], s[0], s[1], s[2], def.mirror);
    var sh = new Float32Array(24 * 3); for (var f = 0; f < 6; f++) for (var k = 0; k < 4; k++) { sh[(f * 4 + k) * 3] = SHADES[f]; }
    geo.setAttribute('aShade', new THREE.BufferAttribute(sh, 3));
    return geo;
  }
  function buildModel(type, mat) {
    var T = TYPES[type]; var tex = skins[type];
    var root = new THREE.Group(); var parts = {};
    T.parts.forEach(function (def) {
      var pivot = new THREE.Group(); var p = def.pivot || def.pos;
      pivot.position.set(p[0] / 16, p[1] / 16, p[2] / 16);
      var mesh = new THREE.Mesh(makePart(def, tex), mat);
      mesh.position.set((def.pos[0] - p[0]) / 16, (def.pos[1] - p[1]) / 16, (def.pos[2] - p[2]) / 16);
      if (def.rot) mesh.rotation.set(def.rot[0], def.rot[1], def.rot[2]);
      pivot.add(mesh); root.add(pivot); parts[def.name] = pivot; pivot.userData.mesh = mesh;
      if (def.hidden) pivot.visible = false;
    });
    return { root: root, parts: parts };
  }

  // ---------- type definitions ----------
  function def(name, o) { TYPES[name] = o; o.name = name; }
  // Humanoid parts (zombie/skeleton): head 8x8x8 at y 24..32, body 8x12x4, arms/legs 4x12x4
  function humanoid(armW, legW) {
    return [
      { name: 'head', size: [8, 8, 8], pos: [0, 28, 0], pivot: [0, 24, 0], uv: [0, 0] },
      { name: 'body', size: [8, 12, 4], pos: [0, 18, 0], uv: [16, 16] },
      { name: 'armR', size: [armW, 12, armW], pos: [-(4 + armW / 2), 18, 0], pivot: [-(4 + armW / 2), 22, 0], uv: [40, 16] },
      { name: 'armL', size: [armW, 12, armW], pos: [4 + armW / 2, 18, 0], pivot: [4 + armW / 2, 22, 0], uv: [40, 16], mirror: true },
      { name: 'legR', size: [legW, 12, legW], pos: [-2, 6, 0], pivot: [-2, 12, 0], uv: [0, 16] },
      { name: 'legL', size: [legW, 12, legW], pos: [2, 6, 0], pivot: [2, 12, 0], uv: [0, 16], mirror: true }
    ];
  }
  def('pig', { width: 0.9, height: 0.9, health: 10, speed: 2.2, hostile: false, sound: 'pig', xp: 2, drops: function (r, burning) { return [{ id: burning ? 'cooked_porkchop' : 'porkchop', count: 1 + r.int(3) }]; },
    parts: [
      { name: 'head', size: [8, 8, 8], pos: [0, 12, -10], pivot: [0, 12, -6], uv: [0, 0] },
      { name: 'snout', size: [4, 3, 1], pos: [0, 10, -14.5], pivot: [0, 12, -6], uv: [16, 16] },
      { name: 'body', size: [10, 16, 8], pos: [0, 10, 1], uv: [28, 8], rot: [Math.PI / 2, 0, 0] },
      { name: 'leg1', size: [4, 6, 4], pos: [-3, 3, -5], pivot: [-3, 6, -5], uv: [0, 16] }, { name: 'leg2', size: [4, 6, 4], pos: [3, 3, -5], pivot: [3, 6, -5], uv: [0, 16] },
      { name: 'leg3', size: [4, 6, 4], pos: [-3, 3, 7], pivot: [-3, 6, 7], uv: [0, 16] }, { name: 'leg4', size: [4, 6, 4], pos: [3, 3, 7], pivot: [3, 6, 7], uv: [0, 16] }
    ],
    skin: function (g, r) { var P = 'rgb(240,165,162)'; paintBox(g, 0, 0, 8, 8, 8, P, 0.08, r); paintBox(g, 28, 8, 10, 16, 8, P, 0.08, r); paintBox(g, 0, 16, 4, 6, 4, P, 0.08, r); paintBox(g, 16, 16, 4, 3, 1, 'rgb(219,99,95)', 0.05, r);
      // eyes on head front (u 8..16, v 8..16)
      px(g, 9, 13, '#ffffff'); px(g, 10, 13, '#1a1a3a'); px(g, 14, 13, '#ffffff'); px(g, 13, 13, '#1a1a3a'); // snout nostrils
      px(g, 18, 18, '#8a3a3a'); px(g, 20, 18, '#8a3a3a'); }
  });
  def('cow', { width: 0.9, height: 1.4, health: 10, speed: 2.0, hostile: false, sound: 'cow', xp: 2, drops: function (r, burning) { var d = [{ id: burning ? 'cooked_beef' : 'beef', count: 1 + r.int(3) }]; if (r() < 0.7) d.push({ id: 'leather', count: 1 + r.int(2) }); return d; },
    parts: [
      { name: 'head', size: [8, 8, 6], pos: [0, 20, -11], pivot: [0, 20, -8], uv: [0, 0] },
      { name: 'hornR', size: [1, 3, 1], pos: [-4.5, 24.5, -11], pivot: [0, 20, -8], uv: [22, 0] }, { name: 'hornL', size: [1, 3, 1], pos: [4.5, 24.5, -11], pivot: [0, 20, -8], uv: [22, 0] },
      { name: 'body', size: [12, 18, 10], pos: [0, 17, 1], uv: [18, 4], rot: [Math.PI / 2, 0, 0] },
      { name: 'udder', size: [4, 6, 1], pos: [0, 12.5, 6], uv: [52, 0], rot: [Math.PI / 2, 0, 0] },
      { name: 'leg1', size: [4, 12, 4], pos: [-4, 6, -6], pivot: [-4, 12, -6], uv: [0, 16] }, { name: 'leg2', size: [4, 12, 4], pos: [4, 6, -6], pivot: [4, 12, -6], uv: [0, 16] },
      { name: 'leg3', size: [4, 12, 4], pos: [-4, 6, 7], pivot: [-4, 12, 7], uv: [0, 16] }, { name: 'leg4', size: [4, 12, 4], pos: [4, 6, 7], pivot: [4, 12, 7], uv: [0, 16] }
    ],
    skin: function (g, r) { var B = 'rgb(68,50,36)'; paintBox(g, 0, 0, 8, 8, 6, B, 0.1, r); paintBox(g, 18, 4, 12, 18, 10, B, 0.1, r); paintBox(g, 0, 16, 4, 12, 4, 'rgb(90,72,58)', 0.1, r); paintBox(g, 22, 0, 1, 3, 1, 'rgb(190,190,190)', 0, r); paintBox(g, 52, 0, 4, 6, 1, 'rgb(230,180,180)', 0.05, r);
      // white patches on body (front face region 28..40, 14..32)
      rect(g, 30, 16, 4, 5, 'rgb(230,230,230)'); rect(g, 36, 22, 3, 4, 'rgb(230,230,230)'); rect(g, 41, 14, 5, 6, 'rgb(230,230,230)'); rect(g, 19, 20, 3, 5, 'rgb(230,230,230)');
      // face: front at (6..14, 6..14)
      rect(g, 8, 11, 4, 3, 'rgb(230,230,230)'); rect(g, 8, 12, 4, 2, 'rgb(200,170,170)'); px(g, 7, 9, '#ffffff'); px(g, 8, 9, '#1a1a1a'); px(g, 12, 9, '#ffffff'); px(g, 11, 9, '#1a1a1a'); rect(g, 8, 6, 4, 2, 'rgb(230,230,230)'); }
  });
  def('sheep', { width: 0.9, height: 1.3, health: 8, speed: 2.0, hostile: false, sound: 'sheep', xp: 2, drops: function (r, burning, m) { var d = [{ id: burning ? 'cooked_mutton' : 'mutton', count: 1 + r.int(2) }]; if (!m.sheared) d.push({ id: 'white_wool', count: 1 }); return d; },
    parts: [
      { name: 'head', size: [6, 6, 8], pos: [0, 18, -9], pivot: [0, 18, -6], uv: [0, 0] },
      { name: 'headWool', size: [6, 6, 6], pos: [0, 18, -8], pivot: [0, 18, -6], uv: [0, 32], inflate: 0.6, wool: true },
      { name: 'body', size: [8, 16, 6], pos: [0, 15, 2], uv: [28, 8], rot: [Math.PI / 2, 0, 0] },
      { name: 'bodyWool', size: [8, 16, 6], pos: [0, 15, 2], uv: [28, 40], rot: [Math.PI / 2, 0, 0], inflate: 1.75, wool: true },
      { name: 'leg1', size: [4, 12, 4], pos: [-3, 6, -5], pivot: [-3, 12, -5], uv: [0, 16] }, { name: 'leg2', size: [4, 12, 4], pos: [3, 6, -5], pivot: [3, 12, -5], uv: [0, 16] },
      { name: 'leg3', size: [4, 12, 4], pos: [-3, 6, 7], pivot: [-3, 12, 7], uv: [0, 16] }, { name: 'leg4', size: [4, 12, 4], pos: [3, 6, 7], pivot: [3, 12, 7], uv: [0, 16] },
      { name: 'legW1', size: [4, 6, 4], pos: [-3, 9, -5], pivot: [-3, 12, -5], uv: [0, 48], inflate: 0.5, wool: true }, { name: 'legW2', size: [4, 6, 4], pos: [3, 9, -5], pivot: [3, 12, -5], uv: [0, 48], inflate: 0.5, wool: true },
      { name: 'legW3', size: [4, 6, 4], pos: [-3, 9, 7], pivot: [-3, 12, 7], uv: [0, 48], inflate: 0.5, wool: true }, { name: 'legW4', size: [4, 6, 4], pos: [3, 9, 7], pivot: [3, 12, 7], uv: [0, 48], inflate: 0.5, wool: true }
    ],
    texSize: [64, 64],
    skin: function (g, r) { var S = 'rgb(196,170,150)', W = 'rgb(236,236,236)'; paintBox(g, 0, 0, 6, 6, 8, S, 0.08, r); paintBox(g, 28, 8, 8, 16, 6, S, 0.08, r); paintBox(g, 0, 16, 4, 12, 4, S, 0.08, r);
      paintBox(g, 0, 32, 6, 6, 6, W, 0.12, r); paintBox(g, 28, 40, 8, 16, 6, W, 0.12, r); paintBox(g, 0, 48, 4, 6, 4, W, 0.12, r);
      // face front at (8..14, 8..14)
      px(g, 9, 10, '#1a1a1a'); px(g, 12, 10, '#1a1a1a'); rect(g, 9, 12, 4, 1, 'rgb(170,140,120)'); }
  });
  def('chicken', { width: 0.4, height: 0.7, health: 4, speed: 1.8, hostile: false, sound: 'chicken', xp: 1, drops: function (r, burning) { var d = [{ id: burning ? 'cooked_chicken' : 'chicken', count: 1 }]; if (r() < 0.8) d.push({ id: 'feather', count: 1 + r.int(2) }); return d; },
    parts: [
      { name: 'head', size: [4, 6, 3], pos: [0, 12, -4], pivot: [0, 9, -4], uv: [0, 0] },
      { name: 'beak', size: [4, 2, 2], pos: [0, 11, -6.5], pivot: [0, 9, -4], uv: [14, 0] },
      { name: 'wattle', size: [2, 2, 2], pos: [0, 9, -5.5], pivot: [0, 9, -4], uv: [14, 4] },
      { name: 'body', size: [6, 8, 6], pos: [0, 8, 0], uv: [0, 9], rot: [Math.PI / 2, 0, 0] },
      { name: 'wingR', size: [1, 4, 6], pos: [-3.5, 9, 0], pivot: [-3.5, 11, 0], uv: [24, 13] }, { name: 'wingL', size: [1, 4, 6], pos: [3.5, 9, 0], pivot: [3.5, 11, 0], uv: [24, 13] },
      { name: 'legR', size: [3, 5, 3], pos: [-2, 2.5, 1], pivot: [-2, 5, 1], uv: [26, 0] }, { name: 'legL', size: [3, 5, 3], pos: [1, 2.5, 1], pivot: [1, 5, 1], uv: [26, 0] }
    ],
    skin: function (g, r) { var W = 'rgb(235,235,235)'; paintBox(g, 0, 0, 4, 6, 3, W, 0.08, r); paintBox(g, 14, 0, 4, 2, 2, 'rgb(230,170,40)', 0.05, r); paintBox(g, 14, 4, 2, 2, 2, 'rgb(200,40,40)', 0.05, r); paintBox(g, 0, 9, 6, 8, 6, W, 0.1, r); paintBox(g, 24, 13, 1, 4, 6, W, 0.1, r); paintBox(g, 26, 0, 3, 5, 3, 'rgb(230,170,40)', 0.05, r);
      px(g, 3, 5, '#1a1a1a'); px(g, 6, 5, '#1a1a1a'); }
  });
  def('zombie', { width: 0.6, height: 1.95, health: 20, speed: 2.3, hostile: true, damage: 3, sound: 'zombie', xp: 5, burns: true, drops: function (r) { var d = []; if (r() < 0.8) d.push({ id: 'rotten_flesh', count: 1 + r.int(2) }); if (r() < 0.03) d.push({ id: ['iron_ingot', 'carrot', 'potato'][r.int(3)], count: 1 }); return d; },
    parts: humanoid(4, 4), texSize: [64, 64], armsOut: true,
    skin: function (g, r) { var SK = 'rgb(88,130,74)', SH = 'rgb(0,140,140)', PN = 'rgb(62,66,120)'; paintBox(g, 0, 0, 8, 8, 8, SK, 0.1, r); paintBox(g, 16, 16, 8, 12, 4, SH, 0.1, r); paintBox(g, 40, 16, 4, 12, 4, SK, 0.1, r); paintBox(g, 0, 16, 4, 12, 4, PN, 0.1, r);
      rect(g, 8, 8, 8, 2, 'rgb(40,70,35)'); px(g, 10, 12, '#1a1a1a'); px(g, 13, 12, '#1a1a1a'); rect(g, 11, 14, 2, 1, 'rgb(40,70,35)'); rect(g, 40, 20, 16, 2, SH); rect(g, 44, 26, 4, 2, SK); rect(g, 4, 26, 4, 2, 'rgb(40,40,60)'); }
  });
  def('skeleton', { width: 0.6, height: 1.99, health: 20, speed: 2.4, hostile: true, damage: 2, sound: 'skeleton', xp: 5, burns: true, ranged: true, drops: function (r) { var d = []; if (r() < 0.8) d.push({ id: 'bone', count: r.int(3) }); if (r() < 0.8) d.push({ id: 'arrow', count: r.int(3) }); return d.filter(function (x) { return x.count > 0; }); },
    parts: humanoid(2, 2), armsOut: true,
    skin: function (g, r) { var B = 'rgb(214,214,214)', D = 'rgb(120,120,120)'; paintBox(g, 0, 0, 8, 8, 8, B, 0.06, r); paintBox(g, 16, 16, 8, 12, 4, B, 0.06, r); paintBox(g, 40, 16, 2, 12, 2, B, 0.06, r); paintBox(g, 0, 16, 2, 12, 2, B, 0.06, r);
      rect(g, 10, 11, 2, 2, '#2a2a2a'); rect(g, 13, 11, 2, 2, '#2a2a2a'); rect(g, 11, 14, 3, 1, D); // ribs on body front (20..28, 20..32)
      for (var y = 21; y < 31; y += 2) rect(g, 20, y, 8, 1, D); }
  });
  def('villager', { width: 0.6, height: 1.95, health: 20, speed: 1.45, hostile: false, sound: 'villager', xp: 0, drops: function () { return []; }, parts: humanoid(4, 4),
    skin: function (g, r) { var SK = 'rgb(184,132,96)', ROBE = 'rgb(116,78,48)', APRON = 'rgb(76,138,72)', PANTS = 'rgb(74,62,54)'; paintBox(g, 0, 0, 8, 8, 8, SK, 0.06, r); paintBox(g, 16, 16, 8, 12, 4, ROBE, 0.06, r); paintBox(g, 40, 16, 4, 12, 4, ROBE, 0.06, r); paintBox(g, 0, 16, 4, 12, 4, PANTS, 0.06, r); rect(g, 8, 8, 8, 2, 'rgb(104,70,42)'); px(g, 10, 12, '#2a1a10'); px(g, 13, 12, '#2a1a10'); rect(g, 11, 12, 2, 2, 'rgb(150,100,70)'); rect(g, 20, 20, 8, 8, APRON); rect(g, 44, 20, 4, 3, APRON); }
  });
  def('creeper', { width: 0.6, height: 1.7, health: 20, speed: 2.4, hostile: true, damage: 0, sound: 'creeper', xp: 5, explodes: true, drops: function (r) { return r() < 0.9 ? [{ id: 'gunpowder', count: r.int(3) }].filter(function (x) { return x.count > 0; }) : []; },
    parts: [
      { name: 'head', size: [8, 8, 8], pos: [0, 22, 0], pivot: [0, 18, 0], uv: [0, 0] },
      { name: 'body', size: [8, 12, 4], pos: [0, 12, 0], uv: [16, 16] },
      { name: 'leg1', size: [4, 6, 4], pos: [-2, 3, -4], pivot: [-2, 6, -4], uv: [0, 16] }, { name: 'leg2', size: [4, 6, 4], pos: [2, 3, -4], pivot: [2, 6, -4], uv: [0, 16] },
      { name: 'leg3', size: [4, 6, 4], pos: [-2, 3, 4], pivot: [-2, 6, 4], uv: [0, 16] }, { name: 'leg4', size: [4, 6, 4], pos: [2, 3, 4], pivot: [2, 6, 4], uv: [0, 16] }
    ],
    skin: function (g, r) {
      function camo(f) { return 'rgb(' + (40 + r.int(60)) + ',' + (140 + r.int(80)) + ',' + (40 + r.int(50)) + ')'; }
      var faces = paintBox(g, 0, 0, 8, 8, 8, camo, 0.5, r); paintBox(g, 16, 16, 8, 12, 4, camo, 0.5, r); paintBox(g, 0, 16, 4, 6, 4, camo, 0.5, r);
      var K = '#0a0a0a'; rect(g, 9, 11, 2, 2, K); rect(g, 13, 11, 2, 2, K); rect(g, 11, 13, 2, 3, K); rect(g, 10, 14, 1, 2, K); rect(g, 13, 14, 1, 2, K);
    }
  });
  def('spider', { width: 1.4, height: 0.9, health: 16, speed: 3.0, hostile: true, damage: 2, sound: 'spider', xp: 5, nightOnly: true, drops: function (r) { var d = []; if (r() < 0.8) d.push({ id: 'string', count: r.int(3) }); if (r() < 0.33) d.push({ id: 'spider_eye', count: 1 }); return d.filter(function (x) { return x.count > 0; }); },
    parts: [
      { name: 'head', size: [8, 8, 8], pos: [0, 9, -7], pivot: [0, 9, -3], uv: [32, 4] },
      { name: 'neck', size: [6, 6, 6], pos: [0, 9, 0], uv: [0, 0] },
      { name: 'body', size: [10, 8, 12], pos: [0, 9, 9], uv: [0, 12] },
      { name: 'legR1', size: [16, 2, 2], pos: [-11, 9, 2], pivot: [-4, 9, 2], uv: [18, 0], rot: [0, 0.6, -0.3] }, { name: 'legL1', size: [16, 2, 2], pos: [11, 9, 2], pivot: [4, 9, 2], uv: [18, 0], rot: [0, -0.6, 0.3] },
      { name: 'legR2', size: [16, 2, 2], pos: [-11, 9, 0], pivot: [-4, 9, 0], uv: [18, 0], rot: [0, 0.2, -0.3] }, { name: 'legL2', size: [16, 2, 2], pos: [11, 9, 0], pivot: [4, 9, 0], uv: [18, 0], rot: [0, -0.2, 0.3] },
      { name: 'legR3', size: [16, 2, 2], pos: [-11, 9, -2], pivot: [-4, 9, -2], uv: [18, 0], rot: [0, -0.2, -0.3] }, { name: 'legL3', size: [16, 2, 2], pos: [11, 9, -2], pivot: [4, 9, -2], uv: [18, 0], rot: [0, 0.2, 0.3] },
      { name: 'legR4', size: [16, 2, 2], pos: [-11, 9, -4], pivot: [-4, 9, -4], uv: [18, 0], rot: [0, -0.6, -0.3] }, { name: 'legL4', size: [16, 2, 2], pos: [11, 9, -4], pivot: [4, 9, -4], uv: [18, 0], rot: [0, 0.6, 0.3] }
    ],
    skin: function (g, r) { var D = 'rgb(48,40,34)'; paintBox(g, 32, 4, 8, 8, 8, D, 0.15, r); paintBox(g, 0, 0, 6, 6, 6, D, 0.15, r); paintBox(g, 0, 12, 10, 8, 12, D, 0.15, r); paintBox(g, 18, 0, 16, 2, 2, D, 0.15, r);
      // eyes on head front (40..48, 12..20)
      var R = '#ff2020'; px(g, 41, 14, R); px(g, 46, 14, R); rect(g, 42, 15, 1, 1, R); rect(g, 45, 15, 1, 1, R); rect(g, 43, 16, 2, 1, R); px(g, 41, 17, R); px(g, 46, 17, R); }
  });

  function skinFor(type) {
    if (skins[type]) return skins[type];
    var T = TYPES[type]; var size = T.texSize || [64, 32]; var c = cv(size[0], size[1]); var g = c.getContext('2d');
    T.skin(g, rnd(type)); skins[type] = c; return c;
  }
  function materialFor(type) {
    var tex = new THREE.CanvasTexture(skinFor(type)); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
    return MC.Shaders.createEntityMaterial(tex, ctx.shared);
  }

  // ---------- Mob ----------
  function Mob(type, pos) {
    var T = TYPES[type]; this.type = type; this.T = T;
    this.pos = pos.clone(); this.vel = new THREE.Vector3(); this.width = T.width; this.height = T.height;
    this.health = T.health; this.maxHealth = T.health; this.dead = false; this.dying = 0; this.age = 0;
    this.yaw = Math.random() * Math.PI * 2; this.bodyYaw = this.yaw; this.headYaw = this.yaw; this.headPitch = 0;
    this.limb = 0; this.limbAmt = 0; this.hurtT = 0; this.onGround = false; this.state = 'idle'; this.stateT = Math.random() * 3;
    this.target = null; this.panic = 0; this.attackCd = 0; this.fuse = 0; this.fire = 0; this.sheared = false; this.woolTimer = 0; this.soundT = 3 + Math.random() * 8; this.angry = false; this.jumpCd = 0;
    this.material = materialFor(type); var m = buildModel(type, this.material); this.group = m.root; this.parts = m.parts;
    if (T.armsOut) { this.parts.armR.rotation.x = Math.PI / 2; this.parts.armL.rotation.x = Math.PI / 2; }
    this.mesh = this.group; this.persistent = false;
  }
  Mob.prototype.setLight = function (b) { this.material.uniforms.uLight.value = b; };
  Mob.prototype.hurt = function (amount, source, from, knock) {
    if (this.dead || this.dying) return false;
    this.health -= amount; this.hurtT = 0.5; this.material.uniforms.uHurt.value = 1;
    if (from) { var dx = this.pos.x - from.x, dz = this.pos.z - from.z; var d = Math.sqrt(dx * dx + dz * dz) || 1; var k = (knock || 0.5) * 8; this.vel.x += dx / d * k; this.vel.z += dz / d * k; this.vel.y = Math.max(this.vel.y, 5); }
    if (!this.T.hostile) { this.panic = 3; this.state = 'panic'; this.target = null; }
    if (this.type === 'spider') this.angry = true;
    if (this.health <= 0) { this.die(source); MC.Audio.play(this.T.sound + '.death', { pos: this.pos }); }
    else MC.Audio.play(this.T.sound + '.hurt', { pos: this.pos });
    return true;
  };
  Mob.prototype.die = function (source) {
    this.dying = 0.001; this.health = 0;
    var r = MC.rng((Math.random() * 1e9) | 0);
    var drops = this.T.drops(r, this.fire > 0, this);
    for (var i = 0; i < drops.length; i++) if (drops[i].count > 0) ctx.game.spawnDrop({ id: drops[i].id, count: drops[i].count, damage: 0 }, this.pos.clone().add(new THREE.Vector3(0, this.height / 2, 0)));
    if (source === 'player') ctx.game.spawnXP(this.pos.clone().add(new THREE.Vector3(0, this.height / 2, 0)), this.T.xp + (Math.random() < 0.5 ? 1 : 0));
  };
  Mob.prototype.moveToward = function (tx, tz, speed, dt) {
    var dx = tx - this.pos.x, dz = tz - this.pos.z; var d = Math.sqrt(dx * dx + dz * dz); if (d < 0.05) return;
    this.yaw = Math.atan2(-dx, -dz);
    var k = Math.min(1, dt * 8);
    this.vel.x += (dx / d * speed - this.vel.x) * k; this.vel.z += (dz / d * speed - this.vel.z) * k;
    // jump over 1-block obstacles
    if (this.onGround && this.jumpCd <= 0) {
      var fx = Math.floor(this.pos.x + dx / d * (this.width / 2 + 0.3)), fz = Math.floor(this.pos.z + dz / d * (this.width / 2 + 0.3)), fy = Math.floor(this.pos.y + 0.1);
      var b1 = ctx.world.getBlock(fx, fy, fz), b2 = ctx.world.getBlock(fx, fy + 1, fz);
      if (b1 > 0 && MC.BLOCKS[b1].solid && !(b2 > 0 && MC.BLOCKS[b2].solid)) { this.vel.y = 8.2; this.jumpCd = 0.6; }
    }
  };
  Mob.prototype.canSee = function (p) { var eye = this.pos.clone().add(new THREE.Vector3(0, this.height * 0.85, 0)); var to = p.getEyePos(1).sub(eye); var d = to.length(); if (d > 24) return false; var hit = ctx.world.raycast(eye, to.normalize(), d, false); return !hit; };
  Mob.prototype.update = function (dt) {
    var T = this.T, world = ctx.world, player = ctx.player;
    this.age += dt; if (this.jumpCd > 0) this.jumpCd -= dt;
    if (this.hurtT > 0) { this.hurtT -= dt; if (this.hurtT <= 0) this.material.uniforms.uHurt.value = 0; }
    if (this.dying) { this.dying += dt; this.group.rotation.z = Math.min(Math.PI / 2, this.dying * 4); if (this.dying > 0.9) { this.dead = true; MC.Particles.smoke(this.pos.x, this.pos.y + 0.5, this.pos.z, 8); } return; }
    // environment
    var inWater = ctx.ents.inWater(this.pos.x, this.pos.y + 0.3, this.pos.z);
    var feetId = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.1), Math.floor(this.pos.z));
    if (feetId === MC.BLOCK.lava.id) { this.fire = 4; if (this.age % 0.5 < dt) this.hurt(4, 'lava'); }
    // burning in daylight
    if (T.burns && !ctx.sky.isNight() && ctx.sky.dayLight > 0.6) { var l = world.getLight(Math.floor(this.pos.x), Math.floor(this.pos.y + this.height), Math.floor(this.pos.z)); if (l.sky >= 15 && !inWater) this.fire = Math.max(this.fire, 1); }
    if (this.fire > 0) { this.fire -= dt; if (Math.floor(this.age * 2) !== Math.floor((this.age - dt) * 2)) this.hurt(1, 'fire'); if (Math.random() < dt * 20) MC.Particles.flame(this.pos.x + (Math.random() - 0.5) * this.width, this.pos.y + Math.random() * this.height, this.pos.z + (Math.random() - 0.5) * this.width); if (inWater) this.fire = 0; }
    var dist = player && !player.dead ? player.pos.distanceTo(this.pos) : 999;
    var speed = T.speed;
    // AI
    this.stateT -= dt;
    if (this.panic > 0) { this.panic -= dt; if (this.stateT <= 0 || !this.target) { var a = Math.random() * Math.PI * 2; this.target = new THREE.Vector3(this.pos.x + Math.cos(a) * 6, 0, this.pos.z + Math.sin(a) * 6); this.stateT = 1.5; } this.moveToward(this.target.x, this.target.z, speed * 1.6, dt); if (this.panic <= 0) { this.state = 'idle'; this.target = null; } }
    else if (T.hostile && (!T.nightOnly || this.angry || ctx.sky.isNight() || world.getLight(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z)).sky < 10) && player && !player.dead && !player.isCreative() && dist < 16 && (this.state === 'chase' || this.canSee(player))) {
      this.state = 'chase';
      if (T.ranged) {
        if (dist > 9) this.moveToward(player.pos.x, player.pos.z, speed, dt);
        else if (dist < 5) {
          var away = this.pos.clone().sub(player.pos).normalize();
          var k = Math.min(1, dt * 8);
          this.vel.x += (away.x * speed * 0.8 - this.vel.x) * k;
          this.vel.z += (away.z * speed * 0.8 - this.vel.z) * k;
          var ddx = player.pos.x - this.pos.x, ddz = player.pos.z - this.pos.z;
          this.yaw = Math.atan2(-ddx, -ddz);
        } else {
          this.vel.x *= 0.8; this.vel.z *= 0.8;
          var ddx = player.pos.x - this.pos.x, ddz = player.pos.z - this.pos.z;
          this.yaw = Math.atan2(-ddx, -ddz);
        }
        this.attackCd -= dt; if (this.attackCd <= 0 && dist < 15 && this.canSee(player)) { this.attackCd = 2 + Math.random(); ctx.game.shootArrow(this, player); }
      } else if (T.explodes) {
        if (dist > 3) { this.moveToward(player.pos.x, player.pos.z, speed, dt); this.fuse = Math.max(0, this.fuse - dt * 1.5); }
        else { this.vel.x *= 0.7; this.vel.z *= 0.7; if (this.fuse === 0) MC.Audio.play('creeper.primed', { pos: this.pos }); this.fuse += dt; var ddx2 = player.pos.x - this.pos.x, ddz2 = player.pos.z - this.pos.z; this.yaw = Math.atan2(-ddx2, -ddz2); }
        if (dist > 7) this.fuse = Math.max(0, this.fuse - dt * 3);
        if (this.fuse >= 1.5) { this.dead = true; ctx.ents.explode(this.pos.x, this.pos.y + 0.5, this.pos.z, 3, player); return; }
      } else {
        this.moveToward(player.pos.x, player.pos.z, dist > 2 ? speed : speed * 0.5, dt);
        this.attackCd -= dt;
        var reach = this.width / 2 + player.width / 2 + 0.5;
        if (dist < reach + 0.3 && this.attackCd <= 0 && Math.abs(player.pos.y - this.pos.y) < 2) { this.attackCd = 1.0; player.hurt(T.damage, 'mob', this.pos, 0.5); if (this.type === 'spider') this.vel.y = 6; }
      }
    } else {
      if (this.state === 'chase') { this.state = 'idle'; this.stateT = 1; this.fuse = 0; }
      if (this.state === 'idle') {
        this.vel.x *= Math.pow(0.05, dt); this.vel.z *= Math.pow(0.05, dt);
        if (this.stateT <= 0) {
          if (Math.random() < 0.6) {
            var a2 = Math.random() * Math.PI * 2, r2 = 3 + Math.random() * 7, home = this.villageHome || this.pos;
            this.target = new THREE.Vector3(home.x + Math.cos(a2) * r2, 0, home.z + Math.sin(a2) * r2);
            var ty = world.getTopSolid(Math.floor(this.target.x), Math.floor(this.target.z));
            if (ty > 0 && Math.abs(ty + 1 - this.pos.y) < 4 && world.getBlock(Math.floor(this.target.x), ty, Math.floor(this.target.z)) !== MC.BLOCK.water.id) {
              this.state = 'walk'; this.stateT = 6; this.lookAtPlayer = 0;
            } else this.stateT = 1;
          } else this.stateT = 2 + Math.random() * 4;
        }
        if (dist < 6 && Math.random() < dt * 2) this.lookAtPlayer = 2 + Math.random() * 2;
      } else if (this.state === 'walk') {
        this.lookAtPlayer = 0;
        this.moveToward(this.target.x, this.target.z, speed * 0.6, dt);
        var d2 = Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.z);
        if (d2 < 0.8 || this.stateT <= 0) { this.state = 'idle'; this.stateT = 2 + Math.random() * 5; }
      }
    }
    if (this.lookAtPlayer > 0 && this.state === 'idle') {
      this.lookAtPlayer -= dt;
      if (player) {
        var lx = player.pos.x - this.pos.x, lz = player.pos.z - this.pos.z;
        this.headYawTarget = Math.atan2(-lx, -lz);
        this.headPitchTarget = Math.atan2(player.pos.y + 1.4 - (this.pos.y + this.height * 0.9), Math.hypot(lx, lz));
      }
    } else {
      this.lookAtPlayer = 0;
      this.headYawTarget = this.yaw;
      this.headPitchTarget = 0;
    }
    // ambient sounds
    this.soundT -= dt; if (this.soundT <= 0) { this.soundT = 6 + Math.random() * 14; if (dist < 24 && MC.Audio.SFX[T.sound + '.ambient']) MC.Audio.play(T.sound + '.ambient', { pos: this.pos, volume: 0.8 }); }
    // wool regrowth
    if (this.sheared) { this.woolTimer -= dt; if (this.woolTimer <= 0) this.setSheared(false); }
    // physics
    if (inWater) { this.vel.y += (2.2 - this.vel.y) * Math.min(1, dt * 3); this.vel.x *= Math.pow(0.5, dt); this.vel.z *= Math.pow(0.5, dt); }
    else this.vel.y -= 32 * dt;
    if (this.vel.y < -40) this.vel.y = -40;
    var wasGround = this.onGround, vyBefore = this.vel.y;
    ctx.ents.moveEntity(this, dt);
    if (this.onGround && !wasGround && vyBefore < -12 && !inWater) { var fall = (vyBefore * vyBefore) / (2 * 32) - 3; if (fall > 0) this.hurt(Math.floor(fall), 'fall'); }
    // despawn far away
    // Village residents are anchored to their settlement.  They must not vanish
    // simply because the player briefly walks beyond the usual passive-mob range.
    if (dist > (T.hostile ? 64 : 110) && !this.villageHome) { this.dead = true; }
    // animation
    var hs = Math.hypot(this.vel.x, this.vel.z);
    this.limbAmt += (Math.min(1, hs / speed) - this.limbAmt) * Math.min(1, dt * 6); this.limb += hs * dt * 3.2;
    var dyaw = this.yaw - this.bodyYaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); this.bodyYaw += dyaw * Math.min(1, dt * 8);
    var hy = (this.headYawTarget !== undefined ? this.headYawTarget : this.yaw) - this.headYaw; hy = Math.atan2(Math.sin(hy), Math.cos(hy)); this.headYaw += hy * Math.min(1, dt * 6);
    this.headPitch += ((this.headPitchTarget || 0) - this.headPitch) * Math.min(1, dt * 6);
    this.updateModel();
  };
  Mob.prototype.updateModel = function () {
    var g = this.group, P = this.parts, T = this.T;
    g.position.set(this.pos.x, this.pos.y, this.pos.z); g.rotation.y = this.bodyYaw;
    var rel = this.headYaw - this.bodyYaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel)); rel = MC.clamp(rel, -1.3, 1.3);
    if (P.head) { P.head.rotation.y = rel; P.head.rotation.x = this.headPitch; }
    ['snout', 'headWool', 'beak', 'wattle', 'hornR', 'hornL'].forEach(function (n) { if (P[n]) { P[n].rotation.y = rel; P[n].rotation.x = this.headPitch; } }, this);
    var s = Math.sin(this.limb) * this.limbAmt * 1.2;
    if (P.leg1) { P.leg1.rotation.x = s; P.leg4.rotation.x = s; P.leg2.rotation.x = -s; P.leg3.rotation.x = -s; if (P.legW1) { P.legW1.rotation.x = s; P.legW4.rotation.x = s; P.legW2.rotation.x = -s; P.legW3.rotation.x = -s; } }
    if (P.legR) { P.legR.rotation.x = s; P.legL.rotation.x = -s; }
    if (P.armR && !T.armsOut) { P.armR.rotation.x = -s; P.armL.rotation.x = s; }
    if (P.armR && T.armsOut) { P.armR.rotation.x = Math.PI / 2 + Math.sin(this.age * 1.5) * 0.06; P.armL.rotation.x = Math.PI / 2 - Math.sin(this.age * 1.5) * 0.06; P.armR.rotation.y = 0.1 - Math.sin(this.limb) * 0.05; P.armL.rotation.y = -0.1 + Math.sin(this.limb) * 0.05; }
    if (P.wingR) { var w = this.onGround ? 0 : Math.sin(this.age * 25) * 0.8; P.wingR.rotation.z = w; P.wingL.rotation.z = -w; }
    if (this.type === 'spider') { for (var i = 1; i <= 4; i++) { var ph = Math.sin(this.limb + i) * this.limbAmt * 0.4; P['legR' + i].rotation.y = 0.6 - (i - 1) * 0.4 + ph; P['legL' + i].rotation.y = -0.6 + (i - 1) * 0.4 - ph; } }
    if (T.explodes) { var sw = 1 + Math.min(1, this.fuse / 1.5) * 0.3 * (0.5 + 0.5 * Math.sin(this.fuse * 40)); g.scale.set(sw, sw, sw); this.material.uniforms.uTint.value.setScalar(1 + Math.min(1, this.fuse / 1.5) * (Math.sin(this.fuse * 30) > 0 ? 1.2 : 0)); }
  };
  Mob.prototype.setSheared = function (v) { this.sheared = v; var P = this.parts; ['headWool', 'bodyWool', 'legW1', 'legW2', 'legW3', 'legW4'].forEach(function (n) { if (P[n]) P[n].visible = !v; }); if (v) this.woolTimer = 40 + Math.random() * 30; };
  Mob.prototype.intersects = function (x, y, z) { var w = this.width / 2; return !(this.pos.x + w <= x || this.pos.x - w >= x + 1 || this.pos.z + w <= z || this.pos.z - w >= z + 1 || this.pos.y + this.height <= y || this.pos.y >= y + 1); };

  // ---------- manager ----------
  var Mobs = {
    list: list, TYPES: TYPES,
    init: function (world, scene, ents, shared, sky, game) { ctx.world = world; ctx.scene = scene; ctx.ents = ents; ctx.shared = shared; ctx.sky = sky; ctx.game = game; list.length = 0; skins = {}; this.spawnTimer = 0; },
    setPlayer: function (p) { ctx.player = p; },
    spawn: function (type, pos) { if (!TYPES[type]) return null; var m = new Mob(type, pos); list.push(m); ctx.scene.add(m.group); return m; },
    update: function (dt, dayLight) {
      for (var i = list.length - 1; i >= 0; i--) {
        var m = list[i]; m.update(dt);
        if (m.dead) { ctx.scene.remove(m.group); list.splice(i, 1); continue; }
        m.setLight(ctx.world.brightnessAt(m.pos.x, m.pos.y + 0.5, m.pos.z, dayLight));
      }
      this.spawnTimer -= dt; if (this.spawnTimer <= 0) { this.spawnTimer = 1; this.naturalSpawn(); }
    },
    counts: function () { var h = 0, p = 0; for (var i = 0; i < list.length; i++) { if (list[i].T.hostile) h++; else p++; } return { hostile: h, passive: p }; },
    naturalSpawn: function () {
      var player = ctx.player, world = ctx.world; if (!player) return;
      var c = this.counts(); var night = ctx.sky.isNight();
      var R = MC.rng((Math.random() * 1e9) | 0);
      if (c.hostile < 14 && ctx.game.difficulty !== 'peaceful') {
        for (var t = 0; t < 3; t++) {
          var a = R() * Math.PI * 2, d = 24 + R() * 24; var x = Math.floor(player.pos.x + Math.cos(a) * d), z = Math.floor(player.pos.z + Math.sin(a) * d);
          if (!world.isLoaded(x, z)) continue;
          var y;
          if (R() < 0.5) { y = world.getTopSolid(x, z) + 1; } else { y = 5 + Math.floor(R() * 60); var bb = world.getBlock(x, y - 1, z); if (!(bb > 0 && MC.BLOCKS[bb].solid) || world.getBlock(x, y, z) !== 0 || world.getBlock(x, y + 1, z) !== 0) continue; }
          var below = world.getBlock(x, y - 1, z); if (below <= 0 || !MC.BLOCKS[below].solid || !MC.BLOCKS[below].opaque) continue;
          if (world.getBlock(x, y, z) !== 0 || world.getBlock(x, y + 1, z) !== 0) continue;
          var l = world.getLight(x, y, z); if (l.block > 0) continue; if (l.sky >= 8 && !night) continue; if (l.sky > 0 && !night && l.sky >= 1) continue;
          var type = R() < 0.4 ? 'zombie' : R() < 0.65 ? 'skeleton' : R() < 0.85 ? 'creeper' : 'spider';
          var pos = new THREE.Vector3(x + 0.5, y, z + 0.5); if (pos.distanceTo(player.pos) < 20) continue;
          this.spawn(type, pos); break;
        }
      }
      if (c.passive < 12 && R() < 0.25) {
        for (t = 0; t < 4; t++) {
          a = R() * Math.PI * 2; d = 20 + R() * 30; x = Math.floor(player.pos.x + Math.cos(a) * d); z = Math.floor(player.pos.z + Math.sin(a) * d);
          if (!world.isLoaded(x, z)) continue; y = world.getTopSolid(x, z) + 1;
          var g = world.getBlock(x, y - 1, z); if (g !== MC.BLOCK.grass_block.id && g !== MC.BLOCK.snowy_grass_block.id) continue;
          if (world.getBlock(x, y, z) !== 0) continue; if (world.getLight(x, y, z).sky < 9) continue;
          var ptype = ['pig', 'cow', 'sheep', 'chicken'][R.int(4)]; var n = 2 + R.int(3);
          for (var k = 0; k < n; k++) { var ox = x + R.int(5) - 2, oz = z + R.int(5) - 2; var oy = world.getTopSolid(ox, oz) + 1; if (Math.abs(oy - y) > 2) continue; var gb = world.getBlock(ox, oy - 1, oz); if (gb !== MC.BLOCK.grass_block.id && gb !== MC.BLOCK.snowy_grass_block.id) continue; this.spawn(ptype, new THREE.Vector3(ox + 0.5, oy, oz + 0.5)); }
          break;
        }
      }
    },
    initialSpawn: function (center, count) {
      var world = ctx.world; var R = MC.rng(this.seedSalt || 7);
      var made = 0, tries = 0;
      while (made < count && tries < 200) { tries++; var x = Math.floor(center.x + (R() - 0.5) * 80), z = Math.floor(center.z + (R() - 0.5) * 80); if (!world.isLoaded(x, z)) continue; var y = world.getTopSolid(x, z) + 1; var g = world.getBlock(x, y - 1, z); if (g !== MC.BLOCK.grass_block.id && g !== MC.BLOCK.snowy_grass_block.id) continue; var type = ['pig', 'cow', 'sheep', 'chicken'][R.int(4)]; var n = 2 + R.int(3); for (var k = 0; k < n; k++) { var ox = x + R.int(5) - 2, oz = z + R.int(5) - 2; var oy = world.getTopSolid(ox, oz) + 1; var gb = world.getBlock(ox, oy - 1, oz); if (gb !== MC.BLOCK.grass_block.id && gb !== MC.BLOCK.snowy_grass_block.id) continue; this.spawn(type, new THREE.Vector3(ox + 0.5, oy, oz + 0.5)); made++; } }
    },
    // pick mob along ray within maxDist
    pick: function (origin, dir, maxDist) {
      var best = null, bd = maxDist;
      for (var i = 0; i < list.length; i++) {
        var m = list[i]; if (m.dying) continue; var w = m.width / 2;
        var t = rayAABB(origin, dir, m.pos.x - w, m.pos.y, m.pos.z - w, m.pos.x + w, m.pos.y + m.height, m.pos.z + w);
        if (t !== null && t < bd) { bd = t; best = m; }
      }
      return best;
    },
    anyIntersects: function (x, y, z) { for (var i = 0; i < list.length; i++) if (list[i].intersects(x, y, z)) return true; return false; },
    interact: function (mob, player, held) {
      if (!held) return false;
      if (mob.type === 'sheep' && held.id === 'shears' && !mob.sheared) { mob.setSheared(true); var n = 1 + Math.floor(Math.random() * 3); ctx.game.spawnDrop({ id: 'white_wool', count: n, damage: 0 }, mob.pos.clone().add(new THREE.Vector3(0, 0.8, 0))); player.damageItem(player.selected, 1); MC.Audio.play('dig.wool', { pos: mob.pos }); return true; }
      if (mob.type === 'cow' && held.id === 'bucket') { if (!player.isCreative()) { player.inventory.take(player.selected, 1); player.inventory.add('milk_bucket', 1); } MC.Audio.play('cow.ambient', { pos: mob.pos, volume: 0.5 }); return true; }
      if ((mob.type === 'cow' || mob.type === 'sheep') && held.id === 'wheat' || mob.type === 'pig' && held.id === 'carrot' || mob.type === 'chicken' && held.id === 'wheat_seeds') { for (var i = 0; i < 5; i++) MC.Particles.heart(mob.pos.x + (Math.random() - 0.5), mob.pos.y + mob.height + 0.2, mob.pos.z + (Math.random() - 0.5)); if (!player.isCreative()) player.inventory.take(player.selected, 1); mob.lookAtPlayer = 3; return true; }
      return false;
    },
    clear: function () { for (var i = 0; i < list.length; i++) ctx.scene.remove(list[i].group); list.length = 0; },
    serialize: function () { return list.filter(function (m) { return !m.dying; }).map(function (m) { return { t: m.type, p: [m.pos.x, m.pos.y, m.pos.z], h: m.health, s: m.sheared }; }); },
    load: function (arr) { if (!arr) return; for (var i = 0; i < arr.length; i++) { var a = arr[i]; var m = this.spawn(a.t, new THREE.Vector3(a.p[0], a.p[1], a.p[2])); if (m) { m.health = a.h; if (a.s) m.setSheared(true); } } }
  };
  function rayAABB(o, d, x0, y0, z0, x1, y1, z1) {
    var tmin = -Infinity, tmax = Infinity;
    var os = [o.x, o.y, o.z], ds = [d.x, d.y, d.z], a0 = [x0, y0, z0], a1 = [x1, y1, z1];
    for (var i = 0; i < 3; i++) { if (Math.abs(ds[i]) < 1e-9) { if (os[i] < a0[i] || os[i] > a1[i]) return null; continue; } var t1 = (a0[i] - os[i]) / ds[i], t2 = (a1[i] - os[i]) / ds[i]; if (t1 > t2) { var tmp = t1; t1 = t2; t2 = tmp; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return null; }
    if (tmax < 0) return null; return Math.max(0, tmin);
  }
  MC.Mobs = Mobs; MC.Mob = Mob; MC.MobModel = { build: buildModel, skinFor: skinFor, boxUV: boxUV, makePart: makePart, SHADES: SHADES };
})();
