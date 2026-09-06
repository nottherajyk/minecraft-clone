// Chunk shader (texture array, smooth lighting, biome tints, grass overlay, animated tiles, fog).
(function () {
  var VERT = [
    'precision highp float;',
    'in vec4 aData;',   // layer, overlayLayer, frames, sky*16+block
    'in vec4 aColor;',  // tint rgb, shade*ao
    'out vec2 vUv; out float vLayer; out float vOverlay; out vec4 vCol; out float vSky; out float vBlock; out float vFogDist;',
    'uniform float uTime; uniform vec3 uCamPos;',
    'void main() {',
    '  vUv = uv;',
    '  float fr = aData.z;',
    '  float layer = aData.x;',
    '  if (fr > 1.5) layer += mod(floor(uTime * 8.0), fr);',
    '  vLayer = layer; vOverlay = aData.y;',
    '  vCol = aColor;',
    '  float packed = aData.w;',
    '  vSky = floor(packed / 16.0 + 0.0001);',
    '  vBlock = packed - vSky * 16.0;',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vec2 d = wp.xz - uCamPos.xz;',
    '  vFogDist = length(d);',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');
  var FRAG = [
    'precision highp float; precision highp sampler2DArray;',
    'uniform sampler2DArray uTex;',
    'uniform float uSkyLight; uniform vec3 uSkyTint; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar; uniform float uAlphaTest; uniform float uOpacity; uniform float uGamma;',
    'in vec2 vUv; in float vLayer; in float vOverlay; in vec4 vCol; in float vSky; in float vBlock; in float vFogDist;',
    'out vec4 fragColor;',
    'float curve(float l) { float f = l / 15.0; return f / (4.0 - 3.0 * f); }',
    'void main() {',
    '  vec4 tex = texture(uTex, vec3(vUv, vLayer));',
    '  vec3 col;',
    '  if (vOverlay > 0.5) { vec4 ov = texture(uTex, vec3(vUv, vOverlay)); col = mix(tex.rgb, ov.rgb * vCol.rgb, ov.a); }',
    '  else col = tex.rgb * vCol.rgb;',
    '  if (tex.a < uAlphaTest) discard;',
    '  float sky = curve(vSky) * uSkyLight;',
    '  float blk = curve(vBlock);',
    '  vec3 skyL = vec3(sky) * uSkyTint;',
    '  vec3 blkL = vec3(blk) * vec3(1.0, 0.92, 0.78);',
    '  vec3 light = max(skyL, blkL);',
    '  light = max(light, vec3(0.035));',
    '  light = pow(light, vec3(1.0 / (1.0 + uGamma * 0.6)));',
    '  col *= light * vCol.a;',
    '  float fog = smoothstep(uFogNear, uFogFar, vFogDist);',
    '  col = mix(col, uFogColor, fog);',
    '  fragColor = vec4(col, tex.a * uOpacity);',
    '}'
  ].join('\n');

  function createChunkMaterials(texArray) {
    var uniforms = {
      uTex: { value: texArray }, uTime: { value: 0 }, uCamPos: { value: new THREE.Vector3() },
      uSkyLight: { value: 1 }, uSkyTint: { value: new THREE.Vector3(1, 1, 1) }, uFogColor: { value: new THREE.Vector3(0.75, 0.85, 1) },
      uFogNear: { value: 100 }, uFogFar: { value: 140 }, uGamma: { value: 0.5 }
    };
    function mk(alphaTest, opacity, transparent, side) {
      var u = Object.assign({}, uniforms, { uAlphaTest: { value: alphaTest }, uOpacity: { value: opacity } });
      var m = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, uniforms: u, transparent: transparent, side: side || THREE.FrontSide, depthWrite: true });
      return m;
    }
    var opaque = mk(0.0, 1.0, false, THREE.FrontSide);
    var cutout = mk(0.5, 1.0, false, THREE.DoubleSide);
    var water = mk(0.0, 1.0, true, THREE.DoubleSide);
    water.depthWrite = true;
    return { opaque: opaque, cutout: cutout, water: water, uniforms: uniforms };
  }

  // Entity material: vertex colors baked with face shading; uLight scales brightness (block light at entity pos)
  var EVERT = [
    'precision highp float; in vec3 aShade; out vec2 vUv; out float vShade; out float vFogDist; uniform vec3 uCamPos;',
    'void main(){ vUv = uv; vShade = aShade.x; vec4 wp = modelMatrix * vec4(position,1.0); vFogDist = length(wp.xz - uCamPos.xz); gl_Position = projectionMatrix * viewMatrix * wp; }'
  ].join('\n');
  var EFRAG = [
    'precision highp float; uniform sampler2D uMap; uniform float uLight; uniform vec3 uTint; uniform float uHurt; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar; uniform float uAlpha;',
    'in vec2 vUv; in float vShade; in float vFogDist; out vec4 fragColor;',
    'void main(){ vec4 t = texture(uMap, vUv); if (t.a < 0.5) discard; vec3 col = t.rgb * uTint * vShade * uLight; col = mix(col, vec3(1.0,0.3,0.3), uHurt * 0.5); float fog = smoothstep(uFogNear, uFogFar, vFogDist); col = mix(col, uFogColor, fog); fragColor = vec4(col, uAlpha); }'
  ].join('\n');
  function createEntityMaterial(map, shared) {
    var u = { uMap: { value: map }, uLight: { value: 1 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uHurt: { value: 0 }, uAlpha: { value: 1 }, uCamPos: shared.uCamPos, uFogColor: shared.uFogColor, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar };
    return new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: EVERT, fragmentShader: EFRAG, uniforms: u, side: THREE.DoubleSide });
  }
  MC.Shaders = { createChunkMaterials: createChunkMaterials, createEntityMaterial: createEntityMaterial };
})();
