// Block + item registry (shared with the worker). Face order: +X(east) -X(west) +Y(top) -Y(bottom) +Z(south) -Z(north)
MC.Shared.push(function defineBlocks(ns) {
  var blocks = [], byName = {}, items = {}, itemOrder = [];
  var WOOL_COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];

  function title(name) { return name.split('_').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' '); }

  function faces(tex) {
    if (typeof tex === 'string') return [tex, tex, tex, tex, tex, tex];
    var side = tex.side || tex.all;
    return [tex.east || side, tex.west || side, tex.top || tex.all, tex.bottom || tex.top || tex.all, tex.south || tex.front || side, tex.north || side];
  }

  function B(name, o) {
    o = o || {};
    var model = o.model || 'cube';
    var b = {
      id: blocks.length, name: name, label: o.label || title(name),
      model: model,
      faces: faces(o.tex || name),
      solid: o.solid !== undefined ? o.solid : (model === 'cube' || model === 'cactus'),
      opaque: o.opaque !== undefined ? o.opaque : (model === 'cube' && !o.cutout && !o.translucent),
      cutout: !!o.cutout || model === 'cross' || model === 'torch' || model === 'cactus',
      translucent: !!o.translucent,
      light: o.light || 0,
      lightOpacity: o.lightOpacity !== undefined ? o.lightOpacity : ((model === 'cube' && !o.cutout && !o.translucent) ? 15 : 0),
      hardness: o.hardness !== undefined ? o.hardness : 1,
      tool: o.tool || null, tier: o.tier || 0,
      drops: o.drops === undefined ? name : o.drops, // string | null | [{item,min,max,chance}]
      tint: o.tint || null, sideOverlay: !!o.sideOverlay,
      sound: o.sound || 'stone',
      replaceable: !!o.replaceable, gravity: !!o.gravity, liquid: model === 'liquid', flat: !!o.flat || model === 'cross' || model === 'torch',
      tab: o.tab === undefined ? 'construction' : o.tab, hidden: !!o.hidden, anim: o.anim || 0,
      damage: o.damage || 0, hasMeta: !!o.hasMeta, randomOffset: !!o.randomOffset, fullCube: model === 'cube',
      stack: o.stack || 64
    };
    if (b.model === 'liquid') { b.solid = false; b.opaque = false; b.translucent = true; b.replaceable = true; }
    blocks.push(b); byName[name] = b;
    if (!b.hidden) {
      items[name] = { name: name, label: b.label, block: b.id, tab: b.tab, stack: b.stack, icon: name };
      itemOrder.push(name);
    }
    return b;
  }

  function I(name, o) {
    o = o || {};
    var it = { name: name, label: o.label || title(name), block: -1, tab: o.tab || 'items', stack: o.stack || 64, icon: o.icon || name };
    if (o.tool) it.tool = o.tool;   // {type, tier, speed, damage, durability}
    if (o.food) it.food = o.food;   // {hunger, saturation}
    if (o.armor) it.armor = o.armor;// {slot, points, durability}
    if (o.egg) it.egg = o.egg;
    if (o.place) it.place = o.place; // block placed by using this item (buckets)
    if (o.color) it.color = o.color;
    items[name] = it; itemOrder.push(name);
    return it;
  }

  // ---------- Blocks ----------
  B('air', { model: 'none', solid: false, opaque: false, lightOpacity: 0, hidden: true, hardness: 0, drops: null, replaceable: true });
  B('stone', { hardness: 1.5, tool: 'pickaxe', drops: 'cobblestone', tab: 'nature' });
  B('granite', { hardness: 1.5, tool: 'pickaxe', tab: 'nature' });
  B('polished_granite', { hardness: 1.5, tool: 'pickaxe' });
  B('diorite', { hardness: 1.5, tool: 'pickaxe', tab: 'nature' });
  B('polished_diorite', { hardness: 1.5, tool: 'pickaxe' });
  B('andesite', { hardness: 1.5, tool: 'pickaxe', tab: 'nature' });
  B('polished_andesite', { hardness: 1.5, tool: 'pickaxe' });
  B('grass_block', { tex: { top: 'grass_block_top', bottom: 'dirt', side: 'grass_block_side' }, hardness: 0.6, tool: 'shovel', drops: 'dirt', tint: 'grass', sideOverlay: true, sound: 'grass', tab: 'nature' });
  B('dirt', { hardness: 0.5, tool: 'shovel', sound: 'gravel', tab: 'nature' });
  B('coarse_dirt', { hardness: 0.5, tool: 'shovel', sound: 'gravel', tab: 'nature' });
  B('podzol', { tex: { top: 'podzol_top', bottom: 'dirt', side: 'podzol_side' }, hardness: 0.5, tool: 'shovel', drops: 'dirt', sound: 'gravel', tab: 'nature' });
  B('cobblestone', { hardness: 2, tool: 'pickaxe' });
  ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'cherry'].forEach(function (w) { B(w + '_planks', { hardness: 2, tool: 'axe', sound: 'wood' }); });
  ['oak', 'spruce', 'birch', 'cherry'].forEach(function (w) { B(w + '_sapling', { model: 'cross', hardness: 0, sound: 'grass', tab: 'nature' }); });
  B('bedrock', { hardness: -1, drops: null, tab: 'nature' });
  B('water', { model: 'liquid', tex: 'water_still', hardness: 100, drops: null, tint: 'water', lightOpacity: 1, hidden: true, anim: 16, sound: 'none' });
  B('lava', { model: 'liquid', tex: 'lava_still', hardness: 100, drops: null, light: 15, lightOpacity: 0, hidden: true, anim: 16, sound: 'none' });
  B('sand', { hardness: 0.5, tool: 'shovel', gravity: true, sound: 'sand', tab: 'nature' });
  B('red_sand', { hardness: 0.5, tool: 'shovel', gravity: true, sound: 'sand', tab: 'nature' });
  B('gravel', { hardness: 0.6, tool: 'shovel', gravity: true, sound: 'gravel', tab: 'nature', drops: [{ item: 'flint', min: 1, max: 1, chance: 0.1 }, { item: 'gravel', min: 1, max: 1, chance: 0.9, exclusive: true }] });
  B('gold_ore', { hardness: 3, tool: 'pickaxe', tier: 2, drops: 'raw_gold', tab: 'nature' });
  B('iron_ore', { hardness: 3, tool: 'pickaxe', tier: 1, drops: 'raw_iron', tab: 'nature' });
  B('coal_ore', { hardness: 3, tool: 'pickaxe', drops: 'coal', tab: 'nature' });
  B('copper_ore', { hardness: 3, tool: 'pickaxe', tier: 1, drops: [{ item: 'raw_copper', min: 2, max: 5, chance: 1 }], tab: 'nature' });
  B('lapis_ore', { hardness: 3, tool: 'pickaxe', tier: 1, drops: [{ item: 'lapis_lazuli', min: 4, max: 9, chance: 1 }], tab: 'nature' });
  B('redstone_ore', { hardness: 3, tool: 'pickaxe', tier: 2, drops: [{ item: 'redstone', min: 4, max: 5, chance: 1 }], tab: 'nature' });
  B('diamond_ore', { hardness: 3, tool: 'pickaxe', tier: 2, drops: 'diamond', tab: 'nature' });
  B('emerald_ore', { hardness: 3, tool: 'pickaxe', tier: 2, drops: 'emerald', tab: 'nature' });
  B('deepslate', { tex: { top: 'deepslate_top', side: 'deepslate' }, hardness: 3, tool: 'pickaxe', drops: 'cobbled_deepslate', tab: 'nature' });
  B('cobbled_deepslate', { hardness: 3.5, tool: 'pickaxe' });
  B('tuff', { hardness: 1.5, tool: 'pickaxe', tab: 'nature' });
  B('calcite', { hardness: 0.75, tool: 'pickaxe', tab: 'nature' });
  B('dripstone_block', { hardness: 1.5, tool: 'pickaxe', tab: 'nature' });
  B('amethyst_block', { hardness: 1.5, tool: 'pickaxe', tab: 'nature', sound: 'glass' });
  ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'cherry'].forEach(function (w) {
    B(w + '_log', { tex: { top: w + '_log_top', side: w + '_log' }, hardness: 2, tool: 'axe', sound: 'wood', tab: 'nature', hasMeta: true });
  });
  B('oak_leaves', { cutout: true, lightOpacity: 1, hardness: 0.2, tool: 'shears', tint: 'foliage', sound: 'grass', tab: 'nature', drops: [{ item: 'oak_sapling', min: 1, max: 1, chance: 0.05 }, { item: 'apple', min: 1, max: 1, chance: 0.005 }, { item: 'stick', min: 1, max: 2, chance: 0.02 }] });
  B('spruce_leaves', { cutout: true, lightOpacity: 1, hardness: 0.2, tool: 'shears', tint: 'spruce', sound: 'grass', tab: 'nature', drops: [{ item: 'spruce_sapling', min: 1, max: 1, chance: 0.05 }] });
  B('birch_leaves', { cutout: true, lightOpacity: 1, hardness: 0.2, tool: 'shears', tint: 'birch', sound: 'grass', tab: 'nature', drops: [{ item: 'birch_sapling', min: 1, max: 1, chance: 0.05 }] });
  B('jungle_leaves', { cutout: true, lightOpacity: 1, hardness: 0.2, tool: 'shears', tint: 'foliage', sound: 'grass', tab: 'nature', drops: null });
  B('acacia_leaves', { cutout: true, lightOpacity: 1, hardness: 0.2, tool: 'shears', tint: 'foliage', sound: 'grass', tab: 'nature', drops: null });
  B('dark_oak_leaves', { cutout: true, lightOpacity: 1, hardness: 0.2, tool: 'shears', tint: 'foliage', sound: 'grass', tab: 'nature', drops: null });
  B('cherry_leaves', { cutout: true, lightOpacity: 1, hardness: 0.2, tool: 'shears', sound: 'grass', tab: 'nature', drops: [{ item: 'cherry_sapling', min: 1, max: 1, chance: 0.05 }] });
  B('sponge', { hardness: 0.6, sound: 'grass' });
  B('glass', { cutout: true, lightOpacity: 0, hardness: 0.3, drops: null, sound: 'glass' });
  B('lapis_block', { hardness: 3, tool: 'pickaxe', tier: 1 });
  B('sandstone', { tex: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone' }, hardness: 0.8, tool: 'pickaxe' });
  B('chiseled_sandstone', { tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'chiseled_sandstone' }, hardness: 0.8, tool: 'pickaxe' });
  B('cut_sandstone', { tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'cut_sandstone' }, hardness: 0.8, tool: 'pickaxe' });
  B('smooth_sandstone', { tex: 'sandstone_top', hardness: 2, tool: 'pickaxe' });
  B('red_sandstone', { tex: { top: 'red_sandstone_top', bottom: 'red_sandstone_bottom', side: 'red_sandstone' }, hardness: 0.8, tool: 'pickaxe' });
  WOOL_COLORS.forEach(function (c) { B(c + '_wool', { hardness: 0.8, tool: 'shears', sound: 'wool' }); });
  ['dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley'].forEach(function (f) {
    B(f, { model: 'cross', hardness: 0, sound: 'grass', tab: 'nature', replaceable: false, randomOffset: true });
  });
  B('farmland', { tex: { top: 'dirt_path_top', bottom: 'dirt', side: 'dirt_path_side' }, hardness: 0.6, tool: 'shovel', sound: 'gravel', tab: 'nature', drops: 'dirt' });
  B('wheat_crop', { label: 'Wheat Crop', model: 'cross', tex: 'short_grass', hardness: 0, sound: 'grass', tab: 'nature', replaceable: true, drops: [{ item: 'wheat_seeds', min: 1, max: 2, chance: 1 }, { item: 'wheat', min: 1, max: 2, chance: 0.8 }] });
  B('short_grass', { label: 'Grass', model: 'cross', hardness: 0, tint: 'grass', sound: 'grass', tab: 'nature', replaceable: true, randomOffset: true, drops: [{ item: 'wheat_seeds', min: 1, max: 1, chance: 0.125 }] });
  B('fern', { model: 'cross', hardness: 0, tint: 'grass', sound: 'grass', tab: 'nature', replaceable: true, randomOffset: true, drops: [{ item: 'wheat_seeds', min: 1, max: 1, chance: 0.125 }] });
  B('dead_bush', { model: 'cross', hardness: 0, sound: 'grass', tab: 'nature', replaceable: true, drops: [{ item: 'stick', min: 0, max: 2, chance: 1 }] });
  B('cactus', { model: 'cactus', tex: { top: 'cactus_top', bottom: 'cactus_bottom', side: 'cactus_side' }, hardness: 0.4, sound: 'wool', tab: 'nature', damage: 1 });
  B('brown_mushroom', { model: 'cross', hardness: 0, sound: 'grass', tab: 'nature', light: 1 });
  B('red_mushroom', { model: 'cross', hardness: 0, sound: 'grass', tab: 'nature' });
  B('gold_block', { hardness: 3, tool: 'pickaxe', tier: 2, sound: 'metal' });
  B('iron_block', { hardness: 5, tool: 'pickaxe', tier: 1, sound: 'metal' });
  B('diamond_block', { hardness: 5, tool: 'pickaxe', tier: 2, sound: 'metal' });
  B('emerald_block', { hardness: 5, tool: 'pickaxe', tier: 2, sound: 'metal' });
  B('coal_block', { hardness: 5, tool: 'pickaxe' });
  B('redstone_block', { hardness: 5, tool: 'pickaxe', sound: 'metal' });
  B('copper_block', { hardness: 3, tool: 'pickaxe', tier: 1, sound: 'metal' });
  B('quartz_block', { tex: { top: 'quartz_block_top', side: 'quartz_block_side' }, hardness: 0.8, tool: 'pickaxe' });
  B('smooth_stone', { hardness: 2, tool: 'pickaxe' });
  B('bricks', { hardness: 2, tool: 'pickaxe' });
  B('stone_bricks', { hardness: 1.5, tool: 'pickaxe' });
  B('mossy_stone_bricks', { hardness: 1.5, tool: 'pickaxe' });
  B('cracked_stone_bricks', { hardness: 1.5, tool: 'pickaxe' });
  B('chiseled_stone_bricks', { hardness: 1.5, tool: 'pickaxe' });
  B('mossy_cobblestone', { hardness: 2, tool: 'pickaxe' });
  B('bookshelf', { tex: { top: 'oak_planks', bottom: 'oak_planks', side: 'bookshelf' }, hardness: 1.5, tool: 'axe', sound: 'wood', drops: [{ item: 'book', min: 3, max: 3, chance: 1 }] });
  B('crafting_table', { tex: { top: 'crafting_table_top', bottom: 'oak_planks', side: 'crafting_table_side', south: 'crafting_table_front', north: 'crafting_table_front' }, hardness: 2.5, tool: 'axe', sound: 'wood' });
  B('red_bed', { label: 'Red Bed', model: 'bed', tex: { top: 'red_wool', bottom: 'oak_planks', side: 'red_wool' }, solid: true, opaque: false, hardness: 0.2, tool: 'axe', sound: 'wool', tab: 'items' });
  B('furnace', { tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', south: 'furnace_front' }, hardness: 3.5, tool: 'pickaxe', hasMeta: true });
  B('tnt', { tex: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }, hardness: 0, sound: 'grass' });
  B('torch', { model: 'torch', hardness: 0, light: 14, sound: 'wood', hasMeta: true });
  B('glowstone', { hardness: 0.3, light: 15, sound: 'glass', drops: [{ item: 'glowstone_dust', min: 2, max: 4, chance: 1 }] });
  B('sea_lantern', { hardness: 0.3, light: 15, sound: 'glass', drops: [{ item: 'prismarine_crystals', min: 2, max: 3, chance: 1 }] });
  B('jack_o_lantern', { tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', south: 'jack_o_lantern' }, hardness: 1, tool: 'axe', light: 15, sound: 'wood', hasMeta: true });
  B('pumpkin', { tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side' }, hardness: 1, tool: 'axe', sound: 'wood', tab: 'nature' });
  B('carved_pumpkin', { tex: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', south: 'carved_pumpkin' }, hardness: 1, tool: 'axe', sound: 'wood', hasMeta: true });
  B('melon', { tex: { top: 'melon_top', bottom: 'melon_top', side: 'melon_side' }, hardness: 1, tool: 'axe', sound: 'wood', tab: 'nature', drops: [{ item: 'melon_slice', min: 3, max: 7, chance: 1 }] });
  B('hay_block', { tex: { top: 'hay_block_top', side: 'hay_block_side' }, hardness: 0.5, sound: 'grass' });
  B('obsidian', { hardness: 50, tool: 'pickaxe', tier: 3, tab: 'nature' });
  B('netherrack', { hardness: 0.4, tool: 'pickaxe', tab: 'nature' });
  B('soul_sand', { hardness: 0.5, tool: 'shovel', sound: 'sand', tab: 'nature' });
  B('nether_bricks', { hardness: 2, tool: 'pickaxe' });
  B('end_stone', { hardness: 3, tool: 'pickaxe', tab: 'nature' });
  B('purpur_block', { hardness: 1.5, tool: 'pickaxe' });
  B('prismarine', { hardness: 1.5, tool: 'pickaxe' });
  B('magma_block', { hardness: 0.5, tool: 'pickaxe', light: 3, tab: 'nature', damage: 1 });
  B('snow_block', { hardness: 0.2, tool: 'shovel', sound: 'snow', tab: 'nature', drops: [{ item: 'snowball', min: 4, max: 4, chance: 1 }] });
  B('ice', { translucent: true, lightOpacity: 3, hardness: 0.5, tool: 'pickaxe', drops: null, sound: 'glass', tab: 'nature' });
  B('packed_ice', { hardness: 0.5, tool: 'pickaxe', drops: null, sound: 'glass', tab: 'nature' });
  B('blue_ice', { hardness: 2.8, tool: 'pickaxe', drops: null, sound: 'glass', tab: 'nature' });
  B('clay', { hardness: 0.6, tool: 'shovel', sound: 'gravel', tab: 'nature', drops: [{ item: 'clay_ball', min: 4, max: 4, chance: 1 }] });
  B('moss_block', { hardness: 0.1, tool: 'hoe', sound: 'grass', tab: 'nature' });
  B('mud', { hardness: 0.5, tool: 'shovel', sound: 'gravel', tab: 'nature' });
  B('slime_block', { translucent: true, lightOpacity: 0, hardness: 0, sound: 'slime' });
  WOOL_COLORS.forEach(function (c) { B(c + '_concrete', { hardness: 1.8, tool: 'pickaxe' }); });
  WOOL_COLORS.forEach(function (c) { B(c + '_terracotta', { hardness: 1.25, tool: 'pickaxe' }); });
  B('terracotta', { hardness: 1.25, tool: 'pickaxe' });
  B('snowy_grass_block', { tex: { top: 'snow', bottom: 'dirt', side: 'grass_block_snow' }, hardness: 0.6, tool: 'shovel', drops: 'dirt', sound: 'grass', hidden: true });
  B('seagrass', { model: 'cross', hardness: 0, sound: 'grass', tab: 'nature', replaceable: true, drops: null, tool: 'shears' });
  B('snow', { label: 'Snow', tex: 'snow', model: 'layer', hardness: 0.1, tool: 'shovel', sound: 'snow', tab: 'nature', drops: [{ item: 'snowball', min: 1, max: 1, chance: 1 }], solid: false, opaque: false, lightOpacity: 0, cutout: false, replaceable: true });
  B('pink_petals', { model: 'petals', hardness: 0, sound: 'grass', tab: 'nature', replaceable: true, solid: false, opaque: false, lightOpacity: 0, cutout: true });
  B('mycelium', { tex: { top: 'mycelium_top', bottom: 'dirt', side: 'mycelium_side' }, hardness: 0.6, tool: 'shovel', drops: 'dirt', sound: 'grass', tab: 'nature' });
  B('smooth_quartz', { tex: 'quartz_block_bottom', hardness: 2, tool: 'pickaxe' });
  B('end_stone_bricks', { hardness: 3, tool: 'pickaxe' });
  B('dark_prismarine', { hardness: 1.5, tool: 'pickaxe' });
  B('prismarine_bricks', { hardness: 1.5, tool: 'pickaxe' });
  B('red_nether_bricks', { hardness: 2, tool: 'pickaxe' });
  B('lantern_block', { label: 'Lantern', tex: 'lantern', model: 'lantern', hardness: 3.5, tool: 'pickaxe', light: 15, sound: 'metal', solid: false, opaque: false, lightOpacity: 0, cutout: true });
  B('glowstone_lamp', { label: 'Redstone Lamp', tex: 'redstone_lamp_on', hardness: 0.3, light: 15, sound: 'glass' });
  B('chiseled_quartz_block', { tex: { top: 'chiseled_quartz_block_top', side: 'chiseled_quartz_block' }, hardness: 0.8, tool: 'pickaxe' });
  B('honey_block', { translucent: true, lightOpacity: 0, hardness: 0, sound: 'slime' });
  B('white_stained_glass', { tex: 'white_stained_glass', translucent: true, lightOpacity: 0, hardness: 0.3, drops: null, sound: 'glass' });
  B('light_blue_stained_glass', { translucent: true, lightOpacity: 0, hardness: 0.3, drops: null, sound: 'glass' });
  B('red_stained_glass', { translucent: true, lightOpacity: 0, hardness: 0.3, drops: null, sound: 'glass' });
  B('spruce_sapling_dummy', { hidden: true, model: 'none', solid: false, opaque: false, lightOpacity: 0 }); // reserved
  B('cobweb', { model: 'cross', hardness: 4, tool: 'sword', sound: 'wool', tab: 'nature', drops: 'string', solid: false });
  B('spawner', { cutout: true, lightOpacity: 0, hardness: 5, tool: 'pickaxe', drops: null, sound: 'metal', tab: 'nature' });
  B('chest', { tex: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', south: 'chest_front' }, hardness: 2.5, tool: 'axe', sound: 'wood', hasMeta: true });
  B('note_block', { hardness: 0.8, tool: 'axe', sound: 'wood' });
  B('jukebox', { tex: { top: 'jukebox_top', side: 'jukebox_side' }, hardness: 2, tool: 'axe', sound: 'wood' });
  B('oak_fence_dummy', { hidden: true, model: 'none', solid: false, opaque: false, lightOpacity: 0 }); // reserved
  B('cake_dummy', { hidden: true, model: 'none', solid: false, opaque: false, lightOpacity: 0 }); // reserved
  B('dirt_path', { tex: { top: 'dirt_path_top', bottom: 'dirt', side: 'dirt_path_side' }, hardness: 0.65, tool: 'shovel', drops: 'dirt', sound: 'grass', tab: 'nature' });
  B('rooted_dirt', { hardness: 0.5, tool: 'shovel', sound: 'gravel', tab: 'nature' });
  B('packed_mud', { hardness: 1, tool: 'pickaxe', sound: 'gravel' });
  B('mud_bricks', { hardness: 1.5, tool: 'pickaxe' });
  B('sugar_cane', { model: 'cross', hardness: 0, sound: 'grass', tab: 'nature', tint: 'grass' });
  B('bamboo_dummy', { hidden: true, model: 'none', solid: false, opaque: false, lightOpacity: 0 }); // reserved

  ns.BLOCKS = blocks; ns.BLOCK = byName;
  ns.WOOL_COLORS = WOOL_COLORS;

  // ---------- Items ----------
  var TIERS = {
    wooden: { level: 0, speed: 2, durability: 59, dmg: 0 },
    stone: { level: 1, speed: 4, durability: 131, dmg: 1 },
    iron: { level: 2, speed: 6, durability: 250, dmg: 2 },
    golden: { level: 0, speed: 12, durability: 32, dmg: 0 },
    diamond: { level: 3, speed: 8, durability: 1561, dmg: 3 },
    netherite: { level: 4, speed: 9, durability: 2031, dmg: 4 }
  };
  var TOOL_BASE = { sword: 4, pickaxe: 2, axe: 7, shovel: 2.5, hoe: 1 };
  var AXE_DMG = { wooden: 7, stone: 9, iron: 9, golden: 7, diamond: 9, netherite: 10 };
  ['wooden', 'stone', 'iron', 'golden', 'diamond', 'netherite'].forEach(function (m) {
    ['sword', 'pickaxe', 'axe', 'shovel', 'hoe'].forEach(function (t) {
      var T = TIERS[m];
      var dmg = t === 'axe' ? AXE_DMG[m] : (t === 'hoe' ? 1 : TOOL_BASE[t] + T.dmg);
      I(m + '_' + t, { tab: 'equipment', stack: 1, tool: { type: t, tier: T.level, speed: T.speed, damage: dmg, durability: T.durability, material: m } });
    });
  });
  var ARMOR = { leather: [1, 3, 2, 1, 5], chainmail: [2, 5, 4, 1, 15], iron: [2, 6, 5, 2, 15], golden: [2, 5, 3, 1, 7], diamond: [3, 8, 6, 3, 33], netherite: [3, 8, 6, 3, 37] };
  Object.keys(ARMOR).forEach(function (m) {
    ['helmet', 'chestplate', 'leggings', 'boots'].forEach(function (p, i) {
      var a = ARMOR[m];
      var durMult = [11, 16, 15, 13][i];
      I(m + '_' + p, { tab: 'equipment', stack: 1, armor: { slot: i, points: a[i], durability: a[4] * durMult, material: m } });
    });
  });
  var FOOD = { apple: [4, 2.4], golden_apple: [4, 9.6], bread: [5, 6], carrot: [3, 3.6], golden_carrot: [6, 14.4], potato: [1, 0.6], baked_potato: [5, 6], beetroot: [1, 1.2], melon_slice: [2, 1.2], cookie: [2, 0.4], porkchop: [3, 1.8], cooked_porkchop: [8, 12.8], beef: [3, 1.8], cooked_beef: [8, 12.8], chicken: [2, 1.2], cooked_chicken: [6, 7.2], mutton: [2, 1.2], cooked_mutton: [6, 9.6], cod: [2, 0.4], cooked_cod: [5, 6], salmon: [2, 0.4], cooked_salmon: [6, 9.6], sweet_berries: [2, 0.4], pumpkin_pie: [8, 4.8], rotten_flesh: [4, 0.8], spider_eye: [2, 3.2], mushroom_stew: [6, 7.2], glow_berries: [2, 0.4] };
  var FOOD_LABEL = { beef: 'Raw Beef', cooked_beef: 'Steak', porkchop: 'Raw Porkchop', chicken: 'Raw Chicken', mutton: 'Raw Mutton', cod: 'Raw Cod', salmon: 'Raw Salmon' };
  Object.keys(FOOD).forEach(function (f) { I(f, { tab: 'equipment', label: FOOD_LABEL[f], food: { hunger: FOOD[f][0], saturation: FOOD[f][1] }, stack: f === 'mushroom_stew' ? 1 : 64 }); });
  I('bow', { tab: 'equipment', stack: 1 }); I('arrow', { tab: 'equipment' });
  I('shears', { tab: 'equipment', stack: 1, tool: { type: 'shears', tier: 0, speed: 15, damage: 1, durability: 238 } });
  I('flint_and_steel', { tab: 'equipment', stack: 1 }); I('fishing_rod', { tab: 'equipment', stack: 1 });
  I('compass', { tab: 'equipment', stack: 1 }); I('clock', { tab: 'equipment', stack: 1 }); I('spyglass', { tab: 'equipment', stack: 1 });
  I('shield', { tab: 'equipment', stack: 1 }); I('elytra', { tab: 'equipment', stack: 1 }); I('trident', { tab: 'equipment', stack: 1 });
  I('bucket', { tab: 'items', stack: 16 }); I('water_bucket', { tab: 'items', stack: 1, place: 'water' }); I('lava_bucket', { tab: 'items', stack: 1, place: 'lava' }); I('milk_bucket', { tab: 'items', stack: 1 });
  I('stick'); I('coal'); I('charcoal'); I('raw_iron'); I('iron_ingot'); I('iron_nugget'); I('raw_gold'); I('gold_ingot'); I('gold_nugget'); I('raw_copper'); I('copper_ingot'); I('netherite_ingot'); I('netherite_scrap');
  I('diamond'); I('emerald'); I('lapis_lazuli'); I('redstone', { label: 'Redstone Dust' }); I('quartz', { label: 'Nether Quartz' }); I('amethyst_shard'); I('glowstone_dust'); I('prismarine_shard'); I('prismarine_crystals');
  I('gunpowder'); I('flint'); I('feather'); I('leather'); I('string'); I('bone'); I('bone_meal'); I('ender_pearl', { stack: 16 }); I('ender_eye', { label: 'Eye of Ender' }); I('blaze_rod'); I('blaze_powder'); I('slime_ball', { label: 'Slimeball' });
  I('sugar'); I('paper'); I('book'); I('snowball', { stack: 16 }); I('clay_ball'); I('brick'); I('nether_brick'); I('egg', { stack: 16 }); I('wheat'); I('wheat_seeds'); I('beetroot_seeds'); I('melon_seeds'); I('pumpkin_seeds');
  I('ink_sac'); I('glow_ink_sac'); I('honeycomb'); I('nautilus_shell'); I('heart_of_the_sea'); I('phantom_membrane'); I('rabbit_hide'); I('rabbit_foot'); I('ghast_tear'); I('magma_cream'); I('nether_star'); I('dragon_breath'); I('turtle_scute', { label: 'Scute' });
  I('name_tag', { tab: 'items' }); I('saddle', { tab: 'items', stack: 1 }); I('lead', { tab: 'items' }); I('experience_bottle', { label: "Bottle o' Enchanting" }); I('glass_bottle'); I('totem_of_undying', { stack: 1 }); I('enchanted_book', { stack: 1 }); I('writable_book', { label: 'Book and Quill', stack: 1 });
  I('iron_horse_armor', { stack: 1 }); I('golden_horse_armor', { stack: 1 }); I('diamond_horse_armor', { stack: 1 });
  I('music_disc_13', { label: 'Music Disc', stack: 1 }); I('music_disc_cat', { label: 'Music Disc', stack: 1 });
  WOOL_COLORS.forEach(function (c) { I(c + '_dye', { color: c }); });
  I('pig_spawn_egg', { tab: 'nature', egg: 'pig' }); I('cow_spawn_egg', { tab: 'nature', egg: 'cow' }); I('sheep_spawn_egg', { tab: 'nature', egg: 'sheep' }); I('chicken_spawn_egg', { tab: 'nature', egg: 'chicken' }); I('villager_spawn_egg', { tab: 'nature', egg: 'villager' });
  I('zombie_spawn_egg', { tab: 'nature', egg: 'zombie' }); I('creeper_spawn_egg', { tab: 'nature', egg: 'creeper' }); I('skeleton_spawn_egg', { tab: 'nature', egg: 'skeleton' }); I('spider_spawn_egg', { tab: 'nature', egg: 'spider' });

  ns.ITEMS = items; ns.ITEM_ORDER = itemOrder; ns.TIERS = TIERS;
  ns.itemOf = function (name) { return items[name] || null; };
  ns.blockOfItem = function (name) { var it = items[name]; return it && it.block >= 0 ? blocks[it.block] : null; };

  // Helper: is block id a "full solid opaque cube" for lighting/culling
  ns.isOpaque = function (id) { return blocks[id].opaque; };

  // Tint colors (biome dependent) resolved at runtime; static ones here
  ns.STATIC_TINT = { birch: [0x80, 0xa7, 0x55], spruce: [0x61, 0x99, 0x61] };

  // Crafting recipes: pattern rows (max 3), key map -> item name; result {item,count}
  var recipes = [];
  function R(pattern, key, result, count) { recipes.push({ pattern: pattern, key: key, result: result, count: count || 1 }); }
  ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'cherry'].forEach(function (w) { R(['L'], { L: w + '_log' }, w + '_planks', 4); });
  R(['P', 'P'], { P: 'oak_planks' }, 'stick', 4); R(['P', 'P'], { P: 'birch_planks' }, 'stick', 4); R(['P', 'P'], { P: 'spruce_planks' }, 'stick', 4);
  R(['PP', 'PP'], { P: 'oak_planks' }, 'crafting_table'); R(['PP', 'PP'], { P: 'birch_planks' }, 'crafting_table'); R(['PP', 'PP'], { P: 'spruce_planks' }, 'crafting_table');
  R(['C', 'S'], { C: 'coal', S: 'stick' }, 'torch', 4); R(['C', 'S'], { C: 'charcoal', S: 'stick' }, 'torch', 4);
  R(['CCC', 'C C', 'CCC'], { C: 'cobblestone' }, 'furnace');
  R(['CCC', 'C C', 'CCC'], { C: 'oak_planks' }, 'chest');
  var mats = { wooden: 'oak_planks', stone: 'cobblestone', iron: 'iron_ingot', golden: 'gold_ingot', diamond: 'diamond' };
  Object.keys(mats).forEach(function (m) {
    var M = mats[m];
    R(['M', 'M', 'S'], { M: M, S: 'stick' }, m + '_sword');
    R(['MMM', ' S ', ' S '], { M: M, S: 'stick' }, m + '_pickaxe');
    R(['MM', 'MS', ' S'], { M: M, S: 'stick' }, m + '_axe');
    R(['M', 'S', 'S'], { M: M, S: 'stick' }, m + '_shovel');
    R(['MM', ' S', ' S'], { M: M, S: 'stick' }, m + '_hoe');
  });
  var armorMats = { leather: 'leather', iron: 'iron_ingot', golden: 'gold_ingot', diamond: 'diamond' };
  Object.keys(armorMats).forEach(function (m) {
    var M = armorMats[m];
    R(['MMM', 'M M'], { M: M }, m + '_helmet');
    R(['M M', 'MMM', 'MMM'], { M: M }, m + '_chestplate');
    R(['MMM', 'M M', 'M M'], { M: M }, m + '_leggings');
    R(['M M', 'M M'], { M: M }, m + '_boots');
  });
  R(['WWW'], { W: 'wheat' }, 'bread'); R(['SSS', 'SSS', 'SSS'], { S: 'snowball' }, 'snow_block'); R(['SS', 'SS'], { S: 'sand' }, 'sandstone');
  R(['SS', 'SS'], { S: 'stone' }, 'stone_bricks'); R(['BB', 'BB'], { B: 'brick' }, 'bricks'); R(['CC', 'CC'], { C: 'clay_ball' }, 'clay');
  R(['III', 'III', 'III'], { I: 'iron_ingot' }, 'iron_block'); R(['III', 'III', 'III'], { I: 'gold_ingot' }, 'gold_block'); R(['III', 'III', 'III'], { I: 'diamond' }, 'diamond_block');
  R(['CCC', 'CCC', 'CCC'], { C: 'coal' }, 'coal_block'); R(['B'], { B: 'iron_block' }, 'iron_ingot', 9); R(['B'], { B: 'gold_block' }, 'gold_ingot', 9); R(['B'], { B: 'diamond_block' }, 'diamond', 9);
  R(['I I', 'I'], { I: 'iron_ingot' }, 'bucket'); R(['I', 'F'], { I: 'iron_ingot', F: 'flint' }, 'flint_and_steel'); R([' I', 'I '], { I: 'iron_ingot' }, 'shears');
  R(['SSS', 'S S', 'SSS'], { S: 'string' }, 'white_wool'); R(['PSP', 'PBP', 'PPP'], { P: 'oak_planks', S: 'oak_planks', B: 'book' }, 'bookshelf');
  R(['WWW', 'PPP'], { W: 'red_wool', P: 'oak_planks' }, 'red_bed');
  R(['G'], { G: 'glowstone_dust' }, 'glowstone_dust'); R(['GG', 'GG'], { G: 'glowstone_dust' }, 'glowstone');
  R(['SSS', 'SSS', 'SSS'], { S: 'wheat' }, 'hay_block'); R(['P', 'S'], { P: 'pumpkin', S: 'torch' }, 'jack_o_lantern'); R(['GGG', 'GSG', 'GGG'], { G: 'gunpowder', S: 'sand' }, 'tnt');
  R(['PPP', 'P P', 'PPP'], { P: 'paper' }, 'book'); R(['SSS'], { S: 'sugar_cane' }, 'paper', 3);
  R(['S', 'C'], { S: 'sugar', C: 'cocoa' }, 'cookie', 8); R(['M'], { M: 'melon_slice' }, 'melon_seeds');
  R(['L', 'R', 'B'], { L: 'wheat_seeds', R: 'wheat', B: 'wheat' }, 'bread');
  R(['SS', 'SS'], { S: 'quartz' }, 'quartz_block');
  R(['SSS', 'SSS', 'SSS'], { S: 'slime_ball' }, 'slime_block');
  R(['SS', 'SS'], { S: 'sandstone' }, 'cut_sandstone');
  R([' S ', 'SGS', ' S '], { S: 'stick', G: 'iron_ingot' }, 'compass');
  R([' S ', 'SGS', ' S '], { S: 'gold_ingot', G: 'redstone' }, 'clock');
  R([' SS', 'SSS', ' SS'], { S: 'stick' }, 'stick', 4);
  R(['MM', 'MM'], { M: 'mud' }, 'packed_mud'); R(['MM', 'MM'], { M: 'packed_mud' }, 'mud_bricks');
  ns.RECIPES = recipes;
  ns.SMELT = { iron_ore: 'iron_ingot', raw_iron: 'iron_ingot', raw_gold: 'gold_ingot', gold_ore: 'gold_ingot', raw_copper: 'copper_ingot', sand: 'glass', cobblestone: 'stone', oak_log: 'charcoal', birch_log: 'charcoal', spruce_log: 'charcoal', porkchop: 'cooked_porkchop', beef: 'cooked_beef', chicken: 'cooked_chicken', mutton: 'cooked_mutton', cod: 'cooked_cod', salmon: 'cooked_salmon', potato: 'baked_potato', clay_ball: 'brick', clay: 'terracotta', stone: 'smooth_stone', netherrack: 'nether_brick', wet_sponge: 'sponge', cactus: 'green_dye', stone_bricks: 'cracked_stone_bricks' };
});
