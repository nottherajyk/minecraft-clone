import os

items_js = r'''// Item icon pixel art (16x16). Authentic Minecraft palettes, multi-tone shading,
// high-definition templates, and hand-crafted icons for maximum visual excellence.
(function () {
  var ICONS = {};
  function cv() { var c = document.createElement('canvas'); c.width = 16; c.height = 16; return c; }
  function hex(h) { return '#' + ('000000' + h.toString(16)).slice(-6); }
  function shade(h, k) {
    var r = (h >> 16) & 255, g = (h >> 8) & 255, b = h & 255;
    return ((Math.min(255, Math.max(0, r * k | 0)) & 255) << 16) |
           ((Math.min(255, Math.max(0, g * k | 0)) & 255) << 8) |
           (Math.min(255, Math.max(0, b * k | 0)) & 255);
  }
  function art(ctx, rows, pal, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    for (var y = 0; y < rows.length; y++) {
      var row = rows[y];
      for (var x = 0; x < row.length; x++) {
        var ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        var c = pal[ch];
        if (c === undefined) continue;
        ctx.fillStyle = typeof c === 'number' ? hex(c) : c;
        ctx.fillRect(x + ox, y + oy, 1, 1);
      }
    }
  }
  function icon(name, rows, pal, ox, oy) {
    var c = cv();
    art(c.getContext('2d'), rows, pal, ox, oy);
    ICONS[name] = c;
    return c;
  }

  // 6-tone material palette: l specular, p highlight, P primary, s mid-shade, k deep-shade, d outline
  function mat(main, opt) {
    opt = opt || {};
    return {
      P: main,
      l: opt.l !== undefined ? opt.l : shade(main, 1.42),
      p: opt.p !== undefined ? opt.p : shade(main, 1.22),
      s: opt.s !== undefined ? opt.s : shade(main, 0.72),
      k: opt.k !== undefined ? opt.k : shade(main, 0.50),
      d: opt.d !== undefined ? opt.d : shade(main, 0.28)
    };
  }

  var HANDLE = { H: 0x9c7a46, h: 0x6e522c, d: 0x2a1d10, g: 0x4a3720 };

  var TOOL_MATS = {
    wooden:    { P: 0x866538, l: 0xb88e55, p: 0xa07844, s: 0x684b23, k: 0x4c3414, d: 0x2a1a08 },
    stone:     { P: 0x7c7c7c, l: 0xafafaf, p: 0x949494, s: 0x5e5e5e, k: 0x464646, d: 0x2b2b2b },
    iron:      { P: 0xd8d8d8, l: 0xffffff, p: 0xefefef, s: 0x9e9e9e, k: 0x727272, d: 0x383838 },
    golden:    { P: 0xf5d341, l: 0xfffca6, p: 0xfdee63, s: 0xc89814, k: 0x8a6008, d: 0x4d3300 },
    diamond:   { P: 0x2fc3ba, l: 0xd4ffff, p: 0x5df6ee, s: 0x1d968f, k: 0x116c67, d: 0x073f3c },
    netherite: { P: 0x463f41, l: 0x73696b, p: 0x5b5254, s: 0x342e30, k: 0x241f20, d: 0x141011 }
  };

  var ARMOR_MATS = {
    leather:   { P: 0x9a6538, l: 0xc48c58, p: 0xb07644, s: 0x754722, k: 0x543216, d: 0x321a08 },
    chainmail: { P: 0x949494, l: 0xd8d8d8, p: 0xb8b8b8, s: 0x707070, k: 0x505050, d: 0x303030 },
    iron:      { P: 0xd8d8d8, l: 0xffffff, p: 0xefefef, s: 0x9e9e9e, k: 0x727272, d: 0x383838 },
    golden:    { P: 0xf5d341, l: 0xfffca6, p: 0xfdee63, s: 0xc89814, k: 0x8a6008, d: 0x4d3300 },
    diamond:   { P: 0x2fc3ba, l: 0xd4ffff, p: 0x5df6ee, s: 0x1d968f, k: 0x116c67, d: 0x073f3c },
    netherite: { P: 0x463f41, l: 0x73696b, p: 0x5b5254, s: 0x342e30, k: 0x241f20, d: 0x141011 }
  };

  // ---------------- Templates (16x16) ----------------
  var SWORD = [
    '.............ld.',
    '............lPpd',
    '...........lPPsd',
    '..........lPPsd.',
    '.........lPPsd..',
    '........lPPsd...',
    '.......lPPsd....',
    '...dd.lPPsd.....',
    '..dggdlPPsd.....',
    '..dgggPsd.......',
    '...dggd.........',
    '..ddgdgd........',
    '.dhhd.dgd.......',
    'dhhd...dd.......',
    'dhd.............',
    'dd..............'
  ];

  var PICKAXE = [
    '......dddddd....',
    '....ddlPpPPPdd..',
    '...dlPPpPpPPPPd.',
    '..dlPPsddhddsPPd',
    '.dlPPd..dHd.dsPd',
    '.dlPd..dHhd..dsd',
    'ddPd..dHhd....dd',
    '.dd..dHhd.......',
    '.d..dHhd........',
    '...dHhd.........',
    '..dHhd..........',
    '.dHhd...........',
    'dHhd............',
    'dhd.............',
    'dd..............',
    '................'
  ];

  var AXE = [
    '........ddddd...',
    '.......dlPpPPd..',
    '......dlPpPPPsd.',
    '.....dlPPPddPPsd',
    '....dlPPPdHhdPsd',
    '...dlPPsdHhd.dsd',
    '..ddPPdHhd....dd',
    '..d..ddHhd......',
    '.....dHhd.......',
    '....dHhd........',
    '...dHhd.........',
    '..dHhd..........',
    '.dHhd...........',
    'dHhd............',
    'dhd.............',
    'dd..............'
  ];

  var SHOVEL = [
    '...........ddd..',
    '..........dlPpd.',
    '.........dlPPPPd',
    '........dlPPPsPd',
    '........dPPkssd.',
    '.......ddHhdsd..',
    '......ddHhd.d...',
    '.....ddHhd......',
    '....dHhd........',
    '...dHhd.........',
    '..dHhd..........',
    '.dHhd...........',
    'dHhd............',
    'dhd.............',
    'dd..............',
    '................'
  ];

  var HOE = [
    '........dddddd..',
    '.......dlPpPPPd.',
    '......dlPpPddsd.',
    '.....dlPPsdd.dd.',
    '.....dHhddd.....',
    '....dHhd........',
    '...dHhd.........',
    '..dHhd..........',
    '.dHhd...........',
    'dHhd............',
    'dhd.............',
    'dd..............',
    '................',
    '................',
    '................',
    '................'
  ];

  var HELMET = [
    '................',
    '................',
    '....dddddddd....',
    '...dlPPPPPPPd...',
    '..dlPpPPPPPPsd..',
    '..dlPPPPPPPPsd..',
    '..dlPPddddPPsd..',
    '..dlPd....dlsd..',
    '..dlPd....dlsd..',
    '..dlPPddddPPsd..',
    '..dlPPd..dlPsd..',
    '..dlPsd..dPksd..',
    '..dddd....dddd..',
    '................',
    '................',
    '................'
  ];

  var CHEST = [
    '................',
    '.ddddd....ddddd.',
    '.dlPPd....dlPPd.',
    '.dlPpd....dlPsd.',
    '.dlPPddddddPPsd.',
    '.dlPPPPPPPPPPsd.',
    '.dlPdPPPPPPdlsd.',
    '.ddddPPPPPPdddd.',
    '....dlPPPPsd....',
    '....dlPPPPsd....',
    '....dlPPPPsd....',
    '....dlPPPPsd....',
    '....dlPPPssd....',
    '....dlPPkssd....',
    '....dddddddd....',
    '................'
  ];

  var LEGS = [
    '................',
    '..dddddddddddd..',
    '..dlPPPPPPPPsd..',
    '..dlPpPPPPPPsd..',
    '..dlPPPPddPPsd..',
    '..dlPPd..dlPsd..',
    '..dlPPd..dlPsd..',
    '..dlPPd..dlPsd..',
    '..dlPPd..dlPsd..',
    '..dlPPd..dlPsd..',
    '..dlPPd..dlPsd..',
    '..dlPPd..dlPsd..',
    '..dlPsd..dPksd..',
    '..ddddd..ddddd..',
    '................',
    '................'
  ];

  var BOOTS = [
    '................',
    '................',
    '..dddd....dddd..',
    '..dlPd....dlPd..',
    '..dlPd....dlPd..',
    '..dlPd....dlPd..',
    '..dlPd....dlPd..',
    '..dlPd....dlPd..',
    '..dlPd....dlPd..',
    '.ddlPd....ddlPd.',
    'dlPPPd...dlPPPd.',
    'dlPPsd...dlPPsd.',
    'dlPkssd..dlPkssd',
    'ddddddd..ddddddd',
    '................',
    '................'
  ];

  var LUMP = [
    '................',
    '................',
    '......dddd......',
    '....ddlPppdd....',
    '...dlPPPPPpps...',
    '..dlPPPPPPPPsd..',
    '..dlPPPPPPPPsd..',
    '..dssPPPPPPksd..',
    '..dssPPPPPPksd..',
    '...dssPPPPPksd..',
    '....dssPPPksd...',
    '.....ddsskkd....',
    '.......dddd.....',
    '................',
    '................',
    '................'
  ];

  var INGOT = [
    '................',
    '................',
    '................',
    '................',
    '.......ddddddd..',
    '......dlPppPPPd.',
    '.....dlPPPPPpps.',
    '....dlPPPPPPPPs.',
    '...dlPPPPPPPPPsd',
    '..ddsssssssssssd',
    '.dssssssssssssd.',
    '.ddddddddddddd..',
    '................',
    '................',
    '................',
    '................'
  ];

  var GEM = [
    '................',
    '................',
    '.....dddddd.....',
    '....dlddddsd....',
    '...dlPPllPPsd...',
    '..dlPPlppPPksd..',
    '..dlPPPPPPPksd..',
    '...dlPPPPPksd...',
    '....dlPPPksd....',
    '.....dlPksd.....',
    '......dlkd......',
    '.......dd.......',
    '................',
    '................',
    '................',
    '................'
  ];

  var DUST = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......dd.dd.....',
    '....ddlPdPld....',
    '...dlPppdlPPd...',
    '..dlPPPPddPppd..',
    '.dlPllPPPPPPPsd.',
    'dlPPPPPPPPPPkssd',
    'dssPPPPPPPPPkkkd',
    '.ddsskkkkkkkkd..',
    '..ddddddddddd...',
    '................'
  ];

  var BALL = [
    '................',
    '................',
    '.....dddddd.....',
    '...ddlPlllPdd...',
    '..dlPllPPPPPsd..',
    '.dlPlPPPPPPPksd.',
    '.dlPPPPPPPPPksd.',
    '.dlPPPPPPPPPksd.',
    '.dlPPPPPPPPPksd.',
    '..dlPPPPPPPksd..',
    '..dssPPPPPkkd...',
    '...ddssskkdd....',
    '.....dddddd.....',
    '................',
    '................',
    '................'
  ];

  var EGG = [
    '................',
    '......dddd......',
    '....ddlPPpdd....',
    '...dlPPPPPPsd...',
    '..dlPPPPPPPPsd..',
    '..dlPPPPPPPPsd..',
    '.dlPPPPPPPPPksd.',
    '.dlPPPPPPPPPksd.',
    '.dlPPPPPPPPPksd.',
    '..dlPPPPPPPksd..',
    '..dlPPPPPPPksd..',
    '...dssPPPPkkd...',
    '....ddsskkdd....',
    '......dddd......',
    '................',
    '................'
  ];

  var ROD = [
    '.............dd.',
    '............dlPd',
    '...........dlPsd',
    '..........dlPsd.',
    '.........dlPsd..',
    '........dlPsd...',
    '.......dlPsd....',
    '......dlPsd.....',
    '.....dlPsd......',
    '....dlPsd.......',
    '...dlPsd........',
    '..dlPsd.........',
    '.dlPsd..........',
    'dlPsd...........',
    'dpsd............',
    'dd..............'
  ];

  var BOTTLE = [
    '.....dddddd.....',
    '.....dccccd.....',
    '.....dccccd.....',
    '......dwwd......',
    '.....ddwwdd.....',
    '....dwlPPwwd....',
    '...dwlPPPPPwd...',
    '..dwlPPPPPPPsd..',
    '..dwlPPPPPPPsd..',
    '..dwlPPPPPPPsd..',
    '..dwlPPPPPPPsd..',
    '..dwlPPPPPPPsd..',
    '..dssPPPPPPPsd..',
    '...dssPPPPPsd...',
    '....dddddddd....',
    '................'
  ];

  var DISC = [
    '................',
    '.....dddddd.....',
    '...ddkkkkkkdd...',
    '..dkklPPllkkkd..',
    '.dkkPPddPPkkkkd.',
    '.dkkPddddPkkkkd.',
    'dkkkPddddPkkkkkd',
    'dkkkPddddPkkkkkd',
    'dkkkkPddPkkkkkkd',
    'dkkkklPPlkkkkkkd',
    '.dkkkkkkkkkkkkd.',
    '.dkkkkkkkkkkkkd.',
    '..dkkkkkkkkkkd..',
    '...ddkkkkkkdd...',
    '.....dddddd.....',
    '................'
  ];

  var MEAT = [
    '................',
    '....ddd.........',
    '..ddwwwdddd.....',
    '.dwwwwwdllPdd...',
    '.dwwwdllPPPPsd..',
    '..dddlPPPPPPsd..',
    '..dlPPPPPPPPPsd.',
    '..dlPlPPPPPPPsd.',
    '..dlPPsPPPPPPsd.',
    '..dlPPPsPPPPPsd.',
    '..dlPPPPsPPPPsd.',
    '..dssPPPPPsssd..',
    '...dssPPPsssd...',
    '....ddssssdd....',
    '......dddd......',
    '................'
  ];

  var FISH = [
    '................',
    '................',
    '......ddd.......',
    '....ddllPd..dd..',
    '..ddlPPPPPdddPd.',
    '.dlPPeePPPPPPPd.',
    'dlPPeeeePPPPPPPd',
    'dlPPeeddPPPPPsd.',
    '.dlPPddPPPPPsd..',
    '..dlPPPPPPsdd...',
    '...dlPPPPsdd....',
    '....ddPPsd..dd..',
    '......dd....dPd.',
    '.............dd.',
    '................',
    '................'
  ];

  function tool(kind, rows) {
    Object.keys(TOOL_MATS).forEach(function (m) {
      var pal = Object.assign({}, HANDLE, TOOL_MATS[m]);
      icon(m + '_' + kind, rows, pal);
    });
  }

  function armor(kind, rows) {
    Object.keys(ARMOR_MATS).forEach(function (m) {
      var pal = Object.assign({}, ARMOR_MATS[m]);
      icon(m + '_' + kind, rows, pal);
      if (m === 'chainmail') {
        var ctx = ICONS[m + '_' + kind].getContext('2d');
        ctx.fillStyle = hex(0x606060);
        for (var y = 2; y < 14; y++) {
          for (var x = 2; x < 14; x++) {
            if ((x + y) % 2 === 0 && rows[y] && (rows[y][x] === 'P' || rows[y][x] === 'p')) {
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
      }
    });
  }

  function generic(name, rows, main, extra) {
    var pal = mat(main);
    if (extra) Object.assign(pal, extra);
    return icon(name, rows, pal);
  }

  function build() {
    if (ICONS.stick) return;

    // Tools & Armor
    tool('sword', SWORD);
    tool('pickaxe', PICKAXE);
    tool('axe', AXE);
    tool('shovel', SHOVEL);
    tool('hoe', HOE);

    armor('helmet', HELMET);
    armor('chestplate', CHEST);
    armor('leggings', LEGS);
    armor('boots', BOOTS);

    // Rods & Sticks
    generic('stick', ROD, 0x866538, { l: 0xad824e, p: 0x9a7442, s: 0x674b24, k: 0x4a3416, d: 0x261706 });
    generic('blaze_rod', ROD, 0xf69814, { l: 0xfff076, p: 0xffc43b, s: 0xd96504, k: 0x9a3e00, d: 0x541c00 });
    generic('bone', ROD, 0xe4e2d8, { l: 0xffffff, p: 0xf5f3ed, s: 0xb5b2a4, k: 0x8a8779, d: 0x48463e });

    // Coal & Ores
    generic('coal', LUMP, 0x2c2c2c, { l: 0x5c5c5c, p: 0x444444, s: 0x1f1f1f, k: 0x141414, d: 0x0a0a0a });
    generic('charcoal', LUMP, 0x3d3532, { l: 0x6e635e, p: 0x544945, s: 0x2b2320, k: 0x1e1715, d: 0x0f0b0a });
    generic('raw_iron', LUMP, 0xd4a88b, { l: 0xf2d0bc, p: 0xe2bc9f, s: 0xa97c5f, k: 0x7c553d, d: 0x482d1c });
    generic('raw_gold', LUMP, 0xf3cf44, { l: 0xfff59c, p: 0xfde36a, s: 0xc19d1c, k: 0x886b09, d: 0x4e3c00 });
    generic('raw_copper', LUMP, 0xc8754b, { l: 0xf0a77f, p: 0xde8f65, s: 0x9f512c, k: 0x72361a, d: 0x3f1b0b });

    // Balls & Spheres
    generic('clay_ball', BALL, 0xa5adc2, { l: 0xd6dbed, p: 0xbcc4da, s: 0x828b9f, k: 0x636a7a, d: 0x3b404d });
    generic('snowball', BALL, 0xf0f5ff, { l: 0xffffff, p: 0xffffff, s: 0xc9d7ed, k: 0x9fb0cb, d: 0x62718a });
    generic('slime_ball', BALL, 0x7ac752, { l: 0xb8f78f, p: 0x98e869, s: 0x579c33, k: 0x3b721e, d: 0x1f460d });
    generic('ender_pearl', BALL, 0x165b53, { l: 0x48d7c2, p: 0x28a694, s: 0x0d3e38, k: 0x062824, d: 0x021412 });
    generic('magma_cream', BALL, 0xde7d1d, { l: 0xffd95e, p: 0xf9a433, s: 0xb0550d, k: 0x7e3604, d: 0x4a1d00 });
    generic('ghast_tear', GEM, 0xe2f3f4, { l: 0xffffff, p: 0xf5ffff, s: 0xb8d4d6, k: 0x8daab0, d: 0x526a72 });

    // Ingots
    generic('iron_ingot', INGOT, 0xd4d4d4, { l: 0xffffff, p: 0xeeeeee, s: 0x9e9e9e, k: 0x707070, d: 0x383838 });
    generic('gold_ingot', INGOT, 0xf5cf31, { l: 0xfffca6, p: 0xfdee63, s: 0xc89814, k: 0x8a6008, d: 0x4d3300 });
    generic('copper_ingot', INGOT, 0xca6f43, { l: 0xf5a57d, p: 0xde875a, s: 0xa04e26, k: 0x753415, d: 0x431b08 });
    generic('netherite_ingot', INGOT, 0x463f41, { l: 0x766d6e, p: 0x5c5355, s: 0x342e30, k: 0x241f20, d: 0x141011 });
    generic('brick', INGOT, 0xa95741, { l: 0xd4806a, p: 0xbf6b55, s: 0x853b27, k: 0x622716, d: 0x381208 });
    generic('nether_brick', INGOT, 0x3a1b22, { l: 0x673942, p: 0x512933, s: 0x290f15, k: 0x1b080d, d: 0x0c0306 });
    generic('netherite_scrap', LUMP, 0x635048, { l: 0x8f7970, p: 0x78645b, s: 0x493730, k: 0x33231e, d: 0x1a100c });

    // Nuggets
    generic('iron_nugget', LUMP, 0xd4d4d4, { l: 0xffffff, p: 0xeeeeee, s: 0x9e9e9e, k: 0x707070, d: 0x383838 });
    generic('gold_nugget', LUMP, 0xf5cf31, { l: 0xfffca6, p: 0xfdee63, s: 0xc89814, k: 0x8a6008, d: 0x4d3300 });

    // Gems & Minerals
    generic('diamond', GEM, 0x2fc3ba, { l: 0xd4ffff, p: 0x5df6ee, s: 0x1d968f, k: 0x116c67, d: 0x073f3c });
    generic('emerald', GEM, 0x1ebd52, { l: 0xaaffc5, p: 0x43e878, s: 0x138e3a, k: 0x0c6426, d: 0x043512 });
    generic('quartz', GEM, 0xede6de, { l: 0xffffff, p: 0xf8f4ed, s: 0xc9beaf, k: 0x9e9180, d: 0x584e40 });
    generic('amethyst_shard', GEM, 0xa26edc, { l: 0xe4bfff, p: 0xc08ff9, s: 0x7b44b8, k: 0x572a8c, d: 0x2d114f });
    generic('prismarine_shard', GEM, 0x68b9ac, { l: 0xaef5e9, p: 0x89d6c9, s: 0x458f83, k: 0x2c6a60, d: 0x133e37 });
    generic('prismarine_crystals', GEM, 0xbfe6dc, { l: 0xffffff, p: 0xddfaf2, s: 0x95c9bc, k: 0x6ca396, d: 0x365f57 });
    generic('lapis_lazuli', LUMP, 0x1e49b8, { l: 0x6b97ff, p: 0x3c6bf0, s: 0x122e84, k: 0x0a1b56, d: 0x030b2c });
    generic('flint', LUMP, 0x4a4a4a, { l: 0x7d7d7d, p: 0x626262, s: 0x333333, k: 0x222222, d: 0x101010 });
    generic('heart_of_the_sea', BALL, 0x2589bd, { l: 0x86e7ff, p: 0x4ec2f0, s: 0x135e87, k: 0x0b4160, d: 0x042133 });
    generic('nether_star', GEM, 0xfffde8, { l: 0xffffff, p: 0xffffff, s: 0xd8d49a, k: 0xa8a462, d: 0x5c5a2c });

    // Dusts
    generic('redstone', DUST, 0xdf1616, { l: 0xff7e7e, p: 0xf74040, s: 0xa60b0b, k: 0x740404, d: 0x3e0000 });
    generic('glowstone_dust', DUST, 0xf7ce33, { l: 0xfffcaa, p: 0xfde361, s: 0xbd9510, k: 0x886804, d: 0x4b3700 });
    generic('gunpowder', DUST, 0x6a6a6a, { l: 0xa0a0a0, p: 0x858585, s: 0x4b4b4b, k: 0x353535, d: 0x1c1c1c });
    generic('sugar', DUST, 0xf6f6f6, { l: 0xffffff, p: 0xffffff, s: 0xc8c8c8, k: 0x9b9b9b, d: 0x5b5b5b });
    generic('bone_meal', DUST, 0xe4e2d8, { l: 0xffffff, p: 0xf5f3ed, s: 0xb5b2a4, k: 0x8a8779, d: 0x48463e });
    generic('blaze_powder', DUST, 0xf69814, { l: 0xfff076, p: 0xffc43b, s: 0xd96504, k: 0x9a3e00, d: 0x541c00 });

    // Egg, Bottles & Discs
    generic('egg', EGG, 0xdfd2bb, { l: 0xfffaee, p: 0xf1e7d5, s: 0xb5a78e, k: 0x887a64, d: 0x4c4232 });
    generic('glass_bottle', BOTTLE, 0xbfdcfa, { w: 0xe0f1ff, c: 0x9c7a46, l: 0xffffff, p: 0xdcf0ff, s: 0x8fb8de, k: 0x688eae, d: 0x334d63 });
    generic('experience_bottle', BOTTLE, 0xd0e830, { w: 0xe0f1ff, c: 0x9c7a46, l: 0xf6ff94, p: 0xe2f756, s: 0x9db516, k: 0x6e820a, d: 0x364202 });
    generic('dragon_breath', BOTTLE, 0xd544d5, { w: 0xe0f1ff, c: 0x9c7a46, l: 0xffa9ff, p: 0xec6fec, s: 0x9e249e, k: 0x6f116f, d: 0x3a043a });
    generic('honey_bottle', BOTTLE, 0xf2a11b, { w: 0xe0f1ff, c: 0x9c7a46, l: 0xffe27a, p: 0xf7bf45, s: 0xb86f05, k: 0x824b00, d: 0x452400 });

    generic('music_disc_13', DISC, 0x282828, { k: 0x161616, P: 0xdfbf2e, l: 0xffea78, d: 0x080808 });
    generic('music_disc_cat', DISC, 0x282828, { k: 0x161616, P: 0x58b82a, l: 0x9af06e, d: 0x080808 });

    // Meats
    generic('porkchop', MEAT, 0xef9b9b, { w: 0xffffff, l: 0xffdede, p: 0xf8bcbc, s: 0xba6a6a, k: 0x874444, d: 0x4c2020 });
    generic('cooked_porkchop', MEAT, 0xa96232, { w: 0xe2cfb5, l: 0xd49463, p: 0xbe7642, s: 0x7c411c, k: 0x55280d, d: 0x2d1203 });
    generic('beef', MEAT, 0xb82e2e, { w: 0xffffff, l: 0xf37979, p: 0xd54848, s: 0x851a1a, k: 0x5b0c0c, d: 0x320303 });
    generic('cooked_beef', MEAT, 0x6b3b1c, { w: 0xd1bfa8, l: 0x9f643f, p: 0x834d28, s: 0x4b240c, k: 0x321404, d: 0x1b0800 });
    generic('chicken', MEAT, 0xe4b693, { w: 0xffffff, l: 0xf9dcbf, p: 0xeec7a7, s: 0xb58965, k: 0x875d3c, d: 0x4b2f19 });
    generic('cooked_chicken', MEAT, 0xb57339, { w: 0xffffff, l: 0xe39f64, p: 0xc88748, s: 0x874e1d, k: 0x5f320e, d: 0x321603 });
    generic('mutton', MEAT, 0xcb4343, { w: 0xffffff, l: 0xfa8888, p: 0xdf5959, s: 0x972727, k: 0x691313, d: 0x370505 });
    generic('cooked_mutton', MEAT, 0x7a3e20, { w: 0xd0bfa8, l: 0xad6843, p: 0x91502d, s: 0x572710, k: 0x3a1506, d: 0x1f0900 });
    generic('rotten_flesh', MEAT, 0x79562f, { w: 0x5d7729, l: 0x9b764b, p: 0x876136, s: 0x573b1c, k: 0x3b250e, d: 0x1e1104 });
    generic('rabbit_hide', MEAT, 0x98714e, { w: 0xc6aa8c, l: 0xbe9874, p: 0xa8815c, s: 0x6e4e31, k: 0x4e331d, d: 0x2a1a0c });

    // Fish
    generic('cod', FISH, 0xb59e7a, { e: 0x000000, l: 0xe0cead, p: 0xc7b08d, s: 0x8f7652, k: 0x6a5436, d: 0x3a2c19 });
    generic('cooked_cod', FISH, 0xd0a974, { e: 0x000000, l: 0xf2cea0, p: 0xdeb987, s: 0xa47c48, k: 0x79562a, d: 0x412b10 });
    generic('salmon', FISH, 0xad4133, { e: 0x000000, l: 0xdc6b5b, p: 0xc04f40, s: 0x812b20, k: 0x5c1a11, d: 0x320a05 });
    generic('cooked_salmon', FISH, 0xbf5f3f, { e: 0x000000, l: 0xeb8967, p: 0xd36f4d, s: 0x933f23, k: 0x6b2913, d: 0x391104 });

    // Food icons
    icon('apple', [
      '................',
      '.......dd.......',
      '......dgd.......',
      '......dd........',
      '..dddd..dddd....',
      '.dllPddllPPsd...',
      '.dlPPPPPPPPsd...',
      'dlPPPPPPPPPPsd..',
      'dlPPPPPPPPPPksd.',
      'dlPPPPPPPPPPksd.',
      '.dlPPPPPPPPksd..',
      '.dlPPPPPPPPksd..',
      '..dssPPPPPkksd..',
      '...ddsssskkdd...',
      '.....dddddd.....',
      '................'
    ], { d: 0x380a0a, g: 0x489620, l: 0xff8585, P: 0xe01d1d, s: 0xa10a0a, k: 0x6f0303 });

    icon('golden_apple', [
      '................',
      '.......dd.......',
      '......dgd.......',
      '......dd........',
      '..dddd..dddd....',
      '.dllYddllYYsd...',
      '.dlYYYYYYYYsd...',
      'dlYYYYYYYYYYsd..',
      'dlYYYYYYYYYYksd.',
      'dlYYYYYYYYYYksd.',
      '.dlYYYYYYYYksd..',
      '.dlYYYYYYYYksd..',
      '..dssYYYYYkksd..',
      '...ddsssskkdd...',
      '.....dddddd.....',
      '................'
    ], { d: 0x583e00, g: 0x489620, l: 0xffffff, Y: 0xffe742, s: 0xcf9b0c, k: 0x8a6200 });

    icon('carrot', [
      '................',
      '.............gg.',
      '...........gggg.',
      '..........ggg...',
      '.........dggd...',
      '........dlOod...',
      '.......dlOOod...',
      '......dlOOod....',
      '.....dlOOod.....',
      '....dlOOod......',
      '...dlOOod.......',
      '..dlOOod........',
      '.dlOod..........',
      '.dod............',
      '.dd.............',
      '................'
    ], { d: 0x6c2f08, g: 0x3ca020, l: 0xffb766, O: 0xf77f1e, o: 0xc4540a });

    icon('golden_carrot', [
      '................',
      '.............gg.',
      '...........gggg.',
      '..........ggg...',
      '.........dggd...',
      '........dlYyd...',
      '.......dlYYyd...',
      '......dlYYyd....',
      '.....dlYYyd.....',
      '....dlYYyd......',
      '...dlYYyd.......',
      '..dlYYyd........',
      '.dlYyd..........',
      '.dyd............',
      '.dd.............',
      '................'
    ], { d: 0x6c4e00, g: 0x3ca020, l: 0xffffff, Y: 0xf5cf31, y: 0xb58a08 });

    icon('potato', [
      '................',
      '................',
      '................',
      '.....dddddd.....',
      '....dlPppPPd....',
      '...dlPPPPPPPd...',
      '..dlPPPPPPPPPsd.',
      '..dlPPPPPPPPPsd.',
      '..dlPPPPPPPPssd.',
      '...dssPPPPPsssd.',
      '....dssPPksssd..',
      '.....dddddddd...',
      '................',
      '................',
      '................',
      '................'
    ], { d: 0x553b16, l: 0xf8e0aa, P: 0xd9af5b, p: 0xebc982, s: 0xad8236, k: 0x7c581c });

    icon('baked_potato', [
      '................',
      '................',
      '................',
      '.....dddddd.....',
      '....dlPppPPd....',
      '...dlPkkkPPPd...',
      '..dlPPkFkPPPPsd.',
      '..dlPPPkPPPPPsd.',
      '..dlPPPPPPPPssd.',
      '...dssPPPPPsssd.',
      '....dssPPksssd..',
      '.....dddddddd...',
      '................',
      '................',
      '................',
      '................'
    ], { d: 0x482e0a, l: 0xf0cf8e, P: 0xc69643, p: 0xdfb466, s: 0x936521, k: 0x583407, F: 0x422002 });

    icon('poisonous_potato', LUMP, { d: 0x3c4915, l: 0xd5e88c, P: 0x94ab42, p: 0xb1c85d, s: 0x6a7f25, k: 0x495b13 });

    icon('beetroot', [
      '................',
      '................',
      '.......gg.......',
      '......gggg......',
      '.......gg.......',
      '.....dddddd.....',
      '....dlRrRRRd....',
      '...dlRrRRRRRd...',
      '...dlRRRRRRRRd..',
      '...dlRRRRRRRsd..',
      '....dssRRRRssd..',
      '.....dssRRssd...',
      '......dsRssd....',
      '.......dsd......',
      '........d.......',
      '................'
    ], { d: 0x330612, g: 0x38981e, l: 0xeb5978, R: 0x9e1733, r: 0xc22f51, s: 0x69071c });

    icon('melon_slice', [
      '................',
      '..............d.',
      '.............dGd',
      '............dGgd',
      '...........dGrgd',
      '..........dGrrgd',
      '.........dGrrrgd',
      '........dGrrkrgd',
      '.......dGrrrrrgd',
      '......dGrrkrrrgd',
      '.....dGrrrrrkrgd',
      '....dGrrrrrrrrgd',
      '...dGgggggggggd.',
      '..ddddddddddddd.',
      '................',
      '................'
    ], { d: 0x163406, G: 0xa4c62e, g: 0x689617, r: 0xeb2b2b, k: 0x181818 });

    icon('sweet_berries', [
      '................',
      '................',
      '.....gg.........',
      '....gggg..gg....',
      '...dd.gg.gggg...',
      '..dRRd.dd.gg....',
      '..dRld.dRRd.....',
      '...dd.dRlrd.....',
      '.....ddRRd.dd...',
      '....dRRddd.dRRd.',
      '....dRld..dRlrd.',
      '.....dd....ddd..',
      '................',
      '................',
      '................',
      '................'
    ], { d: 0x30050a, g: 0x3da022, l: 0xff7b8d, R: 0xc91c2e, r: 0x900a18 });

    icon('glow_berries', [
      '................',
      '................',
      '.....gg.........',
      '....gggg..gg....',
      '...dd.gg.gggg...',
      '..dYYd.dd.gg....',
      '..dYld.dYYd.....',
      '...dd.dYlyd.....',
      '.....ddYYd.dd...',
      '....dYYddd.dYYd.',
      '....dYld..dYlyd.',
      '.....dd....ddd..',
      '................',
      '................',
      '................',
      '................'
    ], { d: 0x524006, g: 0x3da022, l: 0xffffff, Y: 0xf8be24, y: 0xb5800a });

    icon('bread', [
      '................',
      '................',
      '................',
      '................',
      '..........ddd...',
      '........ddlPPd..',
      '......ddlPkPPPd.',
      '....ddlPkPPPPPd.',
      '..ddlPkPPPPPPsd.',
      '.dlPPPPPPPPPssd.',
      '.dlPPPPPPPPsssd.',
      '.dssPPPPPPsssd..',
      '..ddssssssddd...',
      '....dddddd......',
      '................',
      '................'
    ], { d: 0x482b08, l: 0xf5cf82, P: 0xc98c36, k: 0x663c0a, s: 0x935b18 });

    icon('cookie', [
      '................',
      '................',
      '................',
      '................',
      '.....dddddd.....',
      '...ddllPllPdd...',
      '..dlPPkPPPPPPd..',
      '..dlPPPPPPkPPd..',
      '.dlPPkPPPPPPsd..',
      '.dlPPPPkPPkPsd..',
      '.dlPkPPPPPPPsd..',
      '..dlPPPPkPPssd..',
      '..dssPPPPPsssd..',
      '...ddsssssdd....',
      '.....dddddd.....',
      '................'
    ], { d: 0x4c2c0a, l: 0xf2ca84, P: 0xc58c38, s: 0x945f1b, k: 0x422104 });

    icon('pumpkin_pie', [
      '................',
      '................',
      '................',
      '................',
      '.....dddddd.....',
      '...ddwwwwwwdd...',
      '..dwwwwwwwwwwd..',
      '.dwwOOOOOOOOwwd.',
      '.dOOOOOOoOOOOOd.',
      '.dOOOoOOOOOOOOd.',
      '.dsOOOOOOOoOOsd.',
      '..dssOOOOOOssd..',
      '...ddsssssddd...',
      '.....dddddd.....',
      '................',
      '................'
    ], { d: 0x4e2c08, w: 0xebd9b8, O: 0xdb832c, o: 0xf5a746, s: 0xa45612 });

    icon('mushroom_stew', [
      '................',
      '................',
      '................',
      '................',
      '....dddddddd....',
      '..ddlPPPPPPldd..',
      '.dlPPmmPPPPmmPd.',
      '.dlPPPPPPPPPPPd.',
      '..dwwwwwwwwwwd..',
      '..dwlllllllwwd..',
      '...dwwwwwwwwd...',
      '...dwwwwwwwwd...',
      '....dsswwssd....',
      '.....dddddd.....',
      '................',
      '................'
    ], { d: 0x362007, P: 0xb57335, m: 0xdfdfd2, w: 0x8a5323, l: 0xa66c39, s: 0x5a310c });

    icon('spider_eye', [
      '................',
      '................',
      '................',
      '................',
      '.....dddddd.....',
      '....dlRRRRRRd...',
      '...dlRRRRRRRRd..',
      '..dlRRRkkkkRRsd.',
      '..dlRRkkwkkkRsd.',
      '..dlRRkkkkkkRsd.',
      '..dlRRRkkkkRRsd.',
      '...dssRRRRRRsd..',
      '....dssRRRRsd...',
      '.....dddddd.....',
      '................',
      '................'
    ], { d: 0x320409, l: 0xf04862, R: 0x9f1326, s: 0x620713, k: 0x1c0206, w: 0xffffff });

    icon('ender_eye', [
      '................',
      '................',
      '................',
      '................',
      '.....dddddd.....',
      '....dlGGGGGGd...',
      '...dlGGGGGGGGd..',
      '..dlGGGkkkkGGsd.',
      '..dlGGkkwkkkGsd.',
      '..dlGGkkkkkkGsd.',
      '..dlGGGkkkkGGsd.',
      '...dssGGGGGGsd..',
      '....dssGGGGsd...',
      '.....dddddd.....',
      '................',
      '................'
    ], { d: 0x052a20, l: 0xa3f7bc, G: 0x66c888, s: 0x378f54, k: 0x0e3f2e, w: 0xffffff });

    icon('wheat', [
      '................',
      '......y.y.......',
      '.....yyyy.y.....',
      '.....yyyyyy.....',
      '....lyyyyyy.....',
      '.....yyyyyy.....',
      '....yyyyyyyy....',
      '.....yyyyyy.....',
      '......gyyg......',
      '......g..g......',
      '......g..g......',
      '.....g..g.......',
      '.....g..g.......',
      '.....g..g.......',
      '....g..g........',
      '................'
    ], { l: 0xfff69e, y: 0xd9b736, g: 0x7c9429 });

    icon('wheat_seeds', [
      '................',
      '................',
      '................',
      '................',
      '.....g..........',
      '....ggg.....g...',
      '.....g.....ggg..',
      '........g...g...',
      '..g....ggg......',
      '.ggg....g...g...',
      '..g........ggg..',
      '......g.....g...',
      '.....ggg........',
      '......g.........',
      '................',
      '................'
    ], { g: 0x3fa022 });

    icon('beetroot_seeds', [
      '................',
      '................',
      '................',
      '................',
      '.....g..........',
      '....ggg.....g...',
      '.....g.....ggg..',
      '........g...g...',
      '..g....ggg......',
      '.ggg....g...g...',
      '..g........ggg..',
      '......g.....g...',
      '.....ggg........',
      '......g.........',
      '................',
      '................'
    ], { g: 0xaa2c36 });

    icon('melon_seeds', [
      '................',
      '................',
      '................',
      '................',
      '.....g..........',
      '....ggg.....g...',
      '.....g.....ggg..',
      '........g...g...',
      '..g....ggg......',
      '.ggg....g...g...',
      '..g........ggg..',
      '......g.....g...',
      '.....ggg........',
      '......g.........',
      '................',
      '................'
    ], { g: 0x222222 });

    icon('pumpkin_seeds', [
      '................',
      '................',
      '................',
      '................',
      '.....g..........',
      '....ggg.....g...',
      '.....g.....ggg..',
      '........g...g...',
      '..g....ggg......',
      '.ggg....g...g...',
      '..g........ggg..',
      '......g.....g...',
      '.....ggg........',
      '......g.........',
      '................',
      '................'
    ], { g: 0xe8dba0 });

    icon('feather', [
      '................',
      '..............d.',
      '.............dwd',
      '............dwwd',
      '...........dwwwd',
      '..........dwWwd.',
      '.........dwWwwd.',
      '........dwWwwd..',
      '.......dwWwwd...',
      '......dwWwwd....',
      '.....dwWwd......',
      '....dwWwd.......',
      '...dwwd.........',
      '..dhd...........',
      '.dhd............',
      '.d..............'
    ], { d: 0x363636, w: 0xe6e6e6, W: 0xffffff, h: 0x9e9e9e });

    icon('leather', [
      '................',
      '................',
      '................',
      '...dddd..ddd....',
      '..dlPPddlPPd....',
      '.dlPPPPPPPPPd...',
      '.dlPPPPPPPPPd...',
      '.dlPPPPPPPPPsd..',
      '..dlPPPPPPPPsd..',
      '..dlPPPPPPPssd..',
      '...dssPPPPPssd..',
      '...dssPPPPsssd..',
      '....dssddsssd...',
      '.....dd..dd.....',
      '................',
      '................'
    ], { d: 0x3a1f07, l: 0xc8905b, P: 0x9b6639, s: 0x70411a });

    icon('string', [
      '................',
      '.....dd.........',
      '....dwwd........',
      '...dw..wd.......',
      '...dw..wd.......',
      '....dwwd........',
      '.....dwd........',
      '.....dwd........',
      '.....dwwd.......',
      '......dwwd......',
      '.......dwwd.....',
      '........dwwd....',
      '.........dwwd...',
      '..........dwd...',
      '...........d....',
      '................'
    ], { d: 0x8a8a8a, w: 0xf5f5f5 });

    icon('paper', [
      '................',
      '................',
      '....dddddddd....',
      '...dwwwwwwwwd...',
      '..dwwwwwwwwwwd..',
      '..dwwwwwwwwwwd..',
      '..dwwwwwwwwwwd..',
      '..dwwwwwwwwwwd..',
      '..dwwwwwwwwwwd..',
      '..dwwwwwwwwwwd..',
      '..dwwwwwwwwwwd..',
      '..dwwwwwwwwwwd..',
      '..dwwwwwwwwwwd..',
      '...dddddddddd...',
      '................',
      '................'
    ], { d: 0x929292, w: 0xf8f8f8 });

    icon('book', [
      '................',
      '................',
      '..dddddddddd....',
      '.dRRRRRRRRRRdd..',
      '.dRRRRRRRRRRwd..',
      '.dlRRRRRRRRRwd..',
      '.dlRRRRRRRRRwd..',
      '.dlrRRRRRRRRwd..',
      '.dlRRRRRRRRRwd..',
      '.dlRRRRRRRRRwd..',
      '.dssRRRRRRRRwd..',
      '.dssRRRRRRRRwd..',
      '.dRRRRRRRRRRdd..',
      '..dddddddddd....',
      '................',
      '................'
    ], { d: 0x2e1b09, l: 0xbe8652, R: 0x965e31, r: 0xb57c48, s: 0x6e3e15, w: 0xf0e6d2 });

    icon('enchanted_book', [
      '................',
      '................',
      '..dddddddddd....',
      '.dRRRRRRRRRRdd..',
      '.dRRRRRRRRRRwd..',
      '.dlRRRRRRRRRwd..',
      '.dlRRRyRRRRRwd..',
      '.dlrRRRRRRRRwd..',
      '.dlRRRRRRRRRwd..',
      '.dlRRRRRRRyRwd..',
      '.dssRRRRRRRRwd..',
      '.dssRRRRRRRRwd..',
      '.dRRRRRRRRRRdd..',
      '..dddddddddd....',
      '................',
      '................'
    ], { d: 0x2e1b09, l: 0xca8cbe, R: 0x8b4380, r: 0xac5b9e, s: 0x5e2354, w: 0xf0e6d2, y: 0xfff070 });

    icon('writable_book', [
      '................',
      '................',
      '..dddddddddd....',
      '.dRRRRRRRRRRdd..',
      '.dRRRRRRRRRRwd..',
      '.dlRRRRRRRRRwd..',
      '.dlRRRRRRRRRwd..',
      '.dlrRRRRRRRRwd..',
      '.dlRRRRRRRRRwd..',
      '.dlRRRRRRRRRwd..',
      '.dssRRRRRRRRwd..',
      '.dssRRRRRRRRwd..',
      '.dRRRRRRRRRRdd..',
      '..dddddddddd....',
      '......ff........',
      '................'
    ], { d: 0x2e1b09, l: 0x8f7f6f, R: 0x655444, r: 0x7f6d5c, s: 0x463728, w: 0xf0e6d2, f: 0xffffff });

    icon('bucket', [
      '................',
      '................',
      '.....dddddd.....',
      '....dwwwwwwd....',
      '...dw......wd...',
      '...dlPPPPPPld...',
      '...dlPPPPPPsd...',
      '....dlPPPPsd....',
      '....dlPPPPsd....',
      '....dlPPPPsd....',
      '....dlPPPPsd....',
      '.....dlPPsd.....',
      '.....dlPPsd.....',
      '.....dsskkd.....',
      '......dddd......',
      '................'
    ], { d: 0x363636, w: 0xababab, l: 0xffffff, P: 0xd4d4d4, s: 0x8a8a8a, k: 0x5c5c5c });

    function bucketOf(name, fill, shine) {
      icon(name, [
        '................',
        '................',
        '.....dddddd.....',
        '....dwwwwwwd....',
        '...dw......wd...',
        '...dlPPPPPPld...',
        '...dFFFFFFFFd...',
        '....dFFFFFFd....',
        '....dlPPPPsd....',
        '....dlPPPPsd....',
        '....dlPPPPsd....',
        '.....dlPPsd.....',
        '.....dlPPsd.....',
        '.....dsskkd.....',
        '......dddd......',
        '................'
      ], { d: 0x363636, w: 0xababab, l: 0xffffff, P: 0xd4d4d4, s: 0x8a8a8a, k: 0x5c5c5c, F: fill });
    }
    bucketOf('water_bucket', 0x3f76e4);
    bucketOf('lava_bucket', 0xf07a1a);
    bucketOf('milk_bucket', 0xffffff);

    icon('flint_and_steel', [
      '................',
      '........dd......',
      '.......dlPd.....',
      '......dlPppd....',
      '.....dlPPPPPsd..',
      '....dlPPPPPPsd..',
      '...dlPPPPPPsd...',
      '..dlPPPPPPsd....',
      '..dlPPPPPPd.....',
      '.ddlPPPPsd......',
      'dkkdlPPsd.......',
      'dkkkdlPd........',
      'dkkkkd..........',
      '.dkkkd..........',
      '..ddd...........',
      '................'
    ], { d: 0x242424, l: 0xffffff, P: 0xdcdcdc, p: 0xababab, s: 0x767676, k: 0x484848 });

    icon('shears', [
      '................',
      '..............d.',
      '.............dlP',
      '............dlPd',
      '...........dlPd.',
      '..........dlPd..',
      '...d.....dlPd...',
      '..dlP...dlPd....',
      '...dlP.dlPd.....',
      '....dlPPPd......',
      '.....dlPd.......',
      '....ddddd.......',
      '...dRRdRRd......',
      '..dRRRdRRRd.....',
      '...dRRdRRd......',
      '....dd.dd.......'
    ], { d: 0x242424, l: 0xffffff, P: 0xd0d0d0, R: 0x8f2d2d });

    icon('bow', [
      '................',
      '.......dd.......',
      '......dlPd......',
      '.....dlP.dd.....',
      '....dlP...w.....',
      '...dlP....w.....',
      '...dlP....w.....',
      '..dlP.....w.....',
      '..dlP.....w.....',
      '..dlP.....w.....',
      '...dlP....w.....',
      '...dlP....w.....',
      '....dlP...w.....',
      '.....dlP.dd.....',
      '......dlPd......',
      '.......dd.......'
    ], { d: 0x2c1b0a, l: 0xbf8852, P: 0x935f32, w: 0xf5f5f5 });

    icon('arrow', [
      '................',
      '.............dd.',
      '............dlwd',
      '...........dlwwd',
      '..........dhdwwd',
      '.........dhd.dd.',
      '........dhd.....',
      '.......dhd......',
      '......dhd.......',
      '.....dhd........',
      '....dhd.........',
      '..fdhd..........',
      '.fffd...........',
      'fffff...........',
      '.fff............',
      '..f.............'
    ], { d: 0x2b2b2b, l: 0xffffff, w: 0xc8c8c8, h: 0x866538, f: 0xf6f6f6 });

    icon('compass', [
      '................',
      '................',
      '.....dddddd.....',
      '...ddlPPPPldd...',
      '..dlPPkkkkPPsd..',
      '.dlPPkkRRkkPPsd.',
      '.dlPPkkRRkkPPsd.',
      'dlPPPkkRRkkPPPsd',
      'dlPPPkkwwkkPPPsd',
      '.dlPPkkwwkkPPsd.',
      '.dlPPkkwwkkPPsd.',
      '..dlPPkkkkPPsd..',
      '...ddssPPssdd...',
      '.....dddddd.....',
      '................',
      '................'
    ], { d: 0x303030, l: 0xffffff, P: 0xa8a8a8, s: 0x6e6e6e, k: 0x181824, R: 0xeb1a1a, w: 0xf5f5f5 });

    icon('clock', [
      '................',
      '................',
      '.....dddddd.....',
      '...ddlYYYYldd...',
      '..dlYYbbbbYYsd..',
      '.dlYYbbSSbbYYsd.',
      '.dlYYbbSSbbYYsd.',
      'dlYYYbbSSbbYYYsd',
      'dlYYYbbbbbbYYYsd',
      '.dlYYbbbbbbYYsd.',
      '.dlYYbbbbbbYYsd.',
      '..dlYYbbbbYYsd..',
      '...ddssYYssdd...',
      '.....dddddd.....',
      '................',
      '................'
    ], { d: 0x483200, l: 0xfffca6, Y: 0xf5cf31, s: 0xb58a08, b: 0x2b529e, S: 0xfff066 });

    icon('spyglass', [
      '................',
      '.............dd.',
      '............dlPd',
      '...........dlPsd',
      '..........dlPsd.',
      '.........dlCCd..',
      '........dlCCd...',
      '.......dlCCd....',
      '......dlCCd.....',
      '.....dlCCd......',
      '....dlCCd.......',
      '...dlCCd........',
      '..dlCCd.........',
      '.dlPsd..........',
      'dlPsd...........',
      'dd..............'
    ], { d: 0x301a08, l: 0xf8b488, P: 0xd98150, s: 0xa04e26, C: 0xb86038 });

    icon('fishing_rod', [
      '................',
      '.............dd.',
      '............dwd.',
      '...........dlPdw',
      '..........dlPd.w',
      '.........dlPd..w',
      '........dlPd...w',
      '.......dlPd....w',
      '......dlPd.....w',
      '.....dlPd......w',
      '....dlPd....dww.',
      '...dlPd....dkkd.',
      '..dlPd.....dkkd.',
      '.dlPd.......dd..',
      '.dd.............',
      '................'
    ], { d: 0x2c1b0a, l: 0xbf8852, P: 0x935f32, w: 0xf5f5f5, k: 0x8a8a8a });

    icon('shield', [
      '................',
      '..dddddddddddd..',
      '.dlPPPPwwPPPPsd.',
      '.dlPPPPwwPPPPsd.',
      '.dlPPPPwwPPPPsd.',
      '.dlwwwwwwwwwwsd.',
      '.dlwwwwwwwwwwsd.',
      '.dlPPPPwwPPPPsd.',
      '.dlPPPPwwPPPPsd.',
      '..dlPPPwwPPPsd..',
      '..dlPPPwwPPPsd..',
      '...dlPPwwPPsd...',
      '....dlPwwPsd....',
      '.....dlwwsd.....',
      '......dddd......',
      '................'
    ], { d: 0x2b1a08, l: 0xb87f48, P: 0x8f5a28, s: 0x623910, w: 0xdcdcdc });

    icon('elytra', [
      '................',
      '.......dd.......',
      '......dlPd......',
      '.....dlPPPd.....',
      '....dlPddPPd....',
      '...dlPd..dlPd...',
      '..dlPd....dlPd..',
      '..dlPd....dlPd..',
      '.dlPd......dlPd.',
      '.dlPd......dlPd.',
      '.dlPd......dlPd.',
      '.dlPd......dlPd.',
      '.dd..........dd.',
      '................',
      '................',
      '................'
    ], { d: 0x282836, l: 0xb2b2c6, P: 0x828296 });

    icon('trident', [
      '................',
      '.............dd.',
      '............dlPd',
      '..........ddlPPd',
      '.........dlPPPd.',
      '..........dlPd..',
      '.........dlPd...',
      '........dlPd....',
      '.......dlPd.....',
      '......dlPd......',
      '.....dlPd.......',
      '....dlPd........',
      '...dlPd.........',
      '..dlPd..........',
      '.dlPd...........',
      '.dd.............'
    ], { d: 0x0a3230, l: 0x88f2e6, P: 0x3ca89a });

    icon('name_tag', [
      '................',
      '................',
      '................',
      '.....ddddddddd..',
      '....dwwwwwwwwwd.',
      '...dwkwwwwwwwwd.',
      '..dwwwwwwwwwwwd.',
      '.dwwwwwwwwwwwwd.',
      '..dwwwwwwwwwwwd.',
      '...dwwwwwwwwwwd.',
      '....dwwwwwwwwwd.',
      '.....ddddddddd..',
      '................',
      '................',
      '................',
      '................'
    ], { d: 0x303030, w: 0xeeeeee, k: 0x303030 });

    icon('saddle', [
      '................',
      '................',
      '................',
      '................',
      '....dddd........',
      '...dlPPPd.......',
      '..dlPPPPPdddd...',
      '.dlPPPPPPPPPPsd.',
      '.dlPPPPPPPPPPsd.',
      '.dlPPPPddPPPPsd.',
      '..dlPPd..dPPPsd.',
      '..dkkd....dkkd..',
      '..dkkd....dkkd..',
      '...dd......dd...',
      '................',
      '................'
    ], { d: 0x2b1706, l: 0xb57335, P: 0x8c501c, s: 0x5e3008, k: 0x9e9e9e });

    icon('lead', [
      '................',
      '.....ddd........',
      '....dlPPd.......',
      '...dlP.dPd......',
      '...dlP.dPd......',
      '....dlPPd.......',
      '.....dlPd.......',
      '.....dlPd.......',
      '......dlPd......',
      '.......dlPd.....',
      '........dlPd....',
      '.........dlPd...',
      '..........dlPd..',
      '...........dd...',
      '................',
      '................'
    ], { d: 0x2e1b09, l: 0xc48c58, P: 0x965e31 });

    icon('totem_of_undying', [
      '................',
      '.....dddddd.....',
      '....dlGGGGld....',
      '....dGEddEGd....',
      '....dlGGGGld....',
      '.....dGGGGd.....',
      'dddddlGGGGlddddd',
      'dlYYYlGGGGlsYYYd',
      'ddssslGGGGlddddd',
      '.....dlGGld.....',
      '.....dlGGld.....',
      '.....dlGGld.....',
      '.....dlGGld.....',
      '.....dlGGld.....',
      '.....dddddd.....',
      '................'
    ], { d: 0x483200, l: 0xfffca6, Y: 0xf5cf31, s: 0xb58a08, G: 0xe5a31a, E: 0x2ecc71 });

    icon('ink_sac', [
      '................',
      '................',
      '................',
      '.....ddddd......',
      '....dkkkkkd.....',
      '...dkkKkkkkd....',
      '..dkkkkkkkkkd...',
      '..dkkkkkkkkkd...',
      '...dkkkkkkkd....',
      '....dkdkdkd.....',
      '...dkd.dkd.dkd..',
      '...dkd..dkd.dkd.',
      '....d....d...d..',
      '................',
      '................',
      '................'
    ], { d: 0x050505, k: 0x1a1a24, K: 0x36364c });

    icon('glow_ink_sac', [
      '................',
      '................',
      '................',
      '.....ddddd......',
      '....dkkkkkd.....',
      '...dkkKkkkkd....',
      '..dkkkkkkkkkd...',
      '..dkkkkkkkkkd...',
      '...dkkkkkkkd....',
      '....dkdkdkd.....',
      '...dkd.dkd.dkd..',
      '...dkd..dkd.dkd.',
      '....d....d...d..',
      '................',
      '................',
      '................'
    ], { d: 0x062828, k: 0x1db0b0, K: 0x76f5f5 });

    icon('honeycomb', [
      '................',
      '................',
      '.....dddddd.....',
      '....dlOOoOOd....',
      '...dldOOdOOOd...',
      '..dlOOOdOOdOOsd.',
      '..dldOOOOOOdOsd.',
      '..dlOOOdOOdOOsd.',
      '..dlOOOOdOOOOsd.',
      '...dldOOOOdOsd..',
      '....dssOdOOssd..',
      '.....dddddd.....',
      '................',
      '................',
      '................',
      '................'
    ], { d: 0x5a3400, l: 0xffe770, O: 0xf39e14, o: 0xffc43b, s: 0xb56904 });

    icon('nautilus_shell', BALL, { d: 0x4a3a2a, l: 0xfffaee, P: 0xd5c09e, s: 0x9b8564, k: 0x6e5a3c });
    icon('phantom_membrane', LUMP, { d: 0x2b3848, l: 0xe2ecf8, P: 0xa4b7cc, s: 0x6e849c, k: 0x485a6e });
    icon('rabbit_foot', ROD, { d: 0x3a2818, l: 0xfae4ce, P: 0xcda47f, s: 0x996e49, k: 0x6e4928 });
    icon('turtle_scute', LUMP, { d: 0x163816, l: 0x86e886, P: 0x39a039, s: 0x217021, k: 0x104810 });

    icon('iron_horse_armor', CHEST, mat(0xd8d8d8));
    icon('golden_horse_armor', CHEST, mat(0xf5d341));
    icon('diamond_horse_armor', CHEST, mat(0x2fc3ba));

    // Dyes
    var DYE = {
      white: 0xf8f8f8, orange: 0xf07613, magenta: 0xbd44b3, light_blue: 0x3aafd9,
      yellow: 0xf8c627, lime: 0x70b919, pink: 0xed8dac, gray: 0x3e4447,
      light_gray: 0x8e8e86, cyan: 0x158991, purple: 0x792aac, blue: 0x35399d,
      brown: 0x724728, green: 0x546d1b, red: 0xa12722, black: 0x1a1a1e
    };
    Object.keys(DYE).forEach(function (c) {
      generic(c + '_dye', DUST, DYE[c], { d: shade(DYE[c], 0.35) });
    });

    // Spawn eggs
    var EGGS = {
      pig: [0xf0a5a2, 0xdb635f], cow: [0x443626, 0xa1a1a1], sheep: [0xe7e7e7, 0xffb5b5],
      chicken: [0xa1a1a1, 0xff0000], zombie: [0x00afaf, 0x799c65], creeper: [0x0da70b, 0x000000],
      skeleton: [0xc1c1c1, 0x494949], spider: [0x342d27, 0xa80e0e]
    };
    Object.keys(EGGS).forEach(function (m) {
      var pal = mat(EGGS[m][0]);
      pal.d = shade(EGGS[m][0], 0.35);
      var c = icon(m + '_spawn_egg', EGG, pal);
      var ctx = c.getContext('2d');
      ctx.fillStyle = hex(EGGS[m][1]);
      [[6, 5], [9, 7], [5, 9], [8, 10], [10, 4], [7, 12]].forEach(function (p) {
        ctx.fillRect(p[0], p[1], 1, 1);
      });
    });

    // Fallback
    icon('missing', [
      'dddddddddddddddd',
      'd..............d',
      'd.pp.pp.pp.pp..d',
      'd..............d',
      'd.pp.pp.pp.pp..d',
      'd..............d',
      'd.pp.pp.pp.pp..d',
      'd..............d',
      'd.pp.pp.pp.pp..d',
      'd..............d',
      'd.pp.pp.pp.pp..d',
      'd..............d',
      'd.pp.pp.pp.pp..d',
      'd..............d',
      'd..............d',
      'dddddddddddddddd'
    ], { d: 0x000000, p: 0xf800f8 });
  }

  function get(name) { build(); return ICONS[name] || null; }
  MC.ItemIcons = { build: build, get: get, ICONS: ICONS };
})();
'''

with open('js/gfx/items.js', 'w', encoding='utf-8') as f:
    f.write(items_js)
print('items.js written successfully! Bytes:', len(items_js))
