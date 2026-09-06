// Biome table (shared): colors for grass/foliage/water/sky/fog and decoration parameters.
MC.Shared.push(function defineBiomes(ns) {
  function hex(h) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255]; }
  var B = [];
  function biome(name, o) { o.id = B.length; o.name = name; o.grass = hex(o.grass); o.foliage = hex(o.foliage); o.water = hex(o.water || 0x3f76e4); o.sky = hex(o.sky || 0x78a7ff); o.fog = hex(o.fog || 0xc0d8ff); B.push(o); return o; }
  biome('ocean', { label: 'Ocean', grass: 0x8eb971, foliage: 0x71a74d, water: 0x3f76e4, sky: 0x7fa1ff, temp: 0.5 });
  biome('plains', { label: 'Plains', grass: 0x91bd59, foliage: 0x77ab2f, sky: 0x78a7ff, temp: 0.8 });
  biome('forest', { label: 'Forest', grass: 0x79c05a, foliage: 0x59ae30, sky: 0x79a6ff, temp: 0.7 });
  biome('birch_forest', { label: 'Birch Forest', grass: 0x88bb67, foliage: 0x6ba941, sky: 0x7aa5ff, temp: 0.6 });
  biome('desert', { label: 'Desert', grass: 0xbfb755, foliage: 0xaea42a, sky: 0x6eb1ff, temp: 2.0 });
  biome('taiga', { label: 'Taiga', grass: 0x86b783, foliage: 0x68a464, sky: 0x7da3ff, temp: 0.25 });
  biome('snowy_plains', { label: 'Snowy Plains', grass: 0x80b497, foliage: 0x60a17b, water: 0x3d57d6, sky: 0x7fa1ff, temp: 0.0 });
  biome('windswept_hills', { label: 'Windswept Hills', grass: 0x8ab689, foliage: 0x6da36b, sky: 0x7ba4ff, temp: 0.2 });
  biome('cherry_grove', { label: 'Cherry Grove', grass: 0xb6db61, foliage: 0xb6db61, water: 0x5db7ef, sky: 0x7ba4ff, temp: 0.5 });
  biome('beach', { label: 'Beach', grass: 0x91bd59, foliage: 0x77ab2f, sky: 0x78a7ff, temp: 0.8 });
  biome('river', { label: 'River', grass: 0x8eb971, foliage: 0x71a74d, water: 0x3f76e4, sky: 0x78a7ff, temp: 0.5 });
  biome('savanna', { label: 'Savanna', grass: 0xbfb755, foliage: 0xaea42a, sky: 0x6eb1ff, temp: 1.2 });
  biome('jungle', { label: 'Jungle', grass: 0x59c93c, foliage: 0x30bb0b, sky: 0x77a8ff, temp: 0.95 });
  biome('snowy_slopes', { label: 'Snowy Slopes', grass: 0x80b497, foliage: 0x60a17b, water: 0x3d57d6, sky: 0x7fa1ff, temp: -0.3 });
  biome('swamp', { label: 'Swamp', grass: 0x6a7039, foliage: 0x6a7039, water: 0x617b64, sky: 0x78a7ff, temp: 0.8 });
  biome('meadow', { label: 'Meadow', grass: 0x83bb6d, foliage: 0x63a948, water: 0x0e4ecf, sky: 0x7ba4ff, temp: 0.5 });
  ns.BIOMES = B;
  ns.BIOME = {}; B.forEach(function (b) { ns.BIOME[b.name] = b; });
});
