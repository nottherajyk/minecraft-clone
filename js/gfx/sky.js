// Sky: gradient dome with sunrise/sunset band, sun & moon, stars, drifting 3D clouds, day/night colors.
(function () {
  function Sky(scene, sharedUniforms) {
    this.scene = scene; this.shared = sharedUniforms;
    this.group = new THREE.Group(); scene.add(this.group);
    this.time = 6000; // ticks 0..24000 (0 = sunrise-ish 6am, 6000 noon, 12000 sunset, 18000 midnight)
    this.buildDome(); this.buildCelestials(); this.buildStars(); this.buildClouds();
    this.skyColor = new THREE.Color(); this.fogColor = new THREE.Color();
    this.dayLight = 1; this.cloudDrift = 0; this.cloudsEnabled = true;
  }
  Sky.prototype.buildDome = function () {
    var geo = new THREE.SphereGeometry(900, 32, 16);
    var mat = new THREE.ShaderMaterial({
      uniforms: { uZenith: { value: new THREE.Color(0x78a7ff) }, uHorizon: { value: new THREE.Color(0xc0d8ff) }, uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uSunset: { value: 0 }, uSunsetColor: { value: new THREE.Color(0xff9a3c) }, uVoid: { value: new THREE.Color(0x101820) } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: [
        'uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform float uSunset; uniform vec3 uSunsetColor; uniform vec3 uVoid; varying vec3 vDir;',
        'void main(){ float h = vDir.y; vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.42, h));',
        ' if (h < 0.0) col = mix(uHorizon, uVoid, smoothstep(0.0, -0.25, h));',
        ' float toward = max(0.0, dot(normalize(vec3(vDir.x, 0.0, vDir.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))));',
        ' float band = exp(-abs(h) * 9.0) * pow(toward, 2.0) * uSunset;',
        ' col = mix(col, uSunsetColor, clamp(band, 0.0, 0.85));',
        ' gl_FragColor = vec4(col, 1.0); }'
      ].join('\n'),
      side: THREE.BackSide, depthWrite: false, depthTest: false
    });
    this.dome = new THREE.Mesh(geo, mat); this.dome.renderOrder = -100; this.dome.frustumCulled = false; this.group.add(this.dome);
  };
  Sky.prototype.buildCelestials = function () {
    var sunTex = new THREE.CanvasTexture(MC.Sprites.s.sun); sunTex.magFilter = THREE.NearestFilter; sunTex.minFilter = THREE.NearestFilter; sunTex.colorSpace = THREE.SRGBColorSpace;
    var moonTex = new THREE.CanvasTexture(MC.Sprites.s.moon); moonTex.magFilter = THREE.NearestFilter; moonTex.minFilter = THREE.NearestFilter; moonTex.colorSpace = THREE.SRGBColorSpace;
    this.celestial = new THREE.Group(); this.group.add(this.celestial);
    // The player looks at these planes from inside the sky dome, so they must be
    // double-sided; a one-sided material culls the sun's visible face entirely.
    var sun = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    sun.position.set(0, 400, 0); sun.rotation.x = -Math.PI / 2; sun.renderOrder = -90; this.celestial.add(sun); this.sun = sun;
    var moon = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false }));
    moon.position.set(0, -400, 0); moon.rotation.x = Math.PI / 2; moon.renderOrder = -90; this.celestial.add(moon); this.moon = moon;
  };
  Sky.prototype.buildStars = function () {
    var n = 1200, pos = new Float32Array(n * 3); var r = MC.rng(10842);
    for (var i = 0; i < n; i++) { var u = r() * 2 - 1, th = r() * Math.PI * 2; var s = Math.sqrt(1 - u * u); pos[i * 3] = s * Math.cos(th) * 600; pos[i * 3 + 1] = u * 600; pos[i * 3 + 2] = s * Math.sin(th) * 600; }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, depthTest: true, fog: false }));
    this.stars.renderOrder = -95; this.celestial.add(this.stars);
  };
  Sky.prototype.buildClouds = function () {
    var N = 96, CELL = 12, TH = 4; var r = MC.rng(777); var nz = new MC.Noise(4242);
    var cells = new Uint8Array(N * N);
    for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
      // periodic noise via 4D-ish trick: sample on a torus using two 2D noises
      var a = i / N * Math.PI * 2, b = j / N * Math.PI * 2;
      var v = nz.noise3D(Math.cos(a) * 2.2, Math.sin(a) * 2.2 + Math.cos(b) * 2.2, Math.sin(b) * 2.2) * 0.6 + nz.noise3D(Math.cos(a) * 5 + 9, Math.sin(a) * 5, Math.sin(b) * 5 + Math.cos(b) * 5) * 0.4;
      cells[i * N + j] = v > 0.31 ? 1 : 0;
    }
    var pos = [], col = [], idx = [], n = 0;
    function face(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, shade) { pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz); for (var k = 0; k < 4; k++) col.push(shade, shade, shade); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4; }
    function at(i, j) { return cells[((i % N + N) % N) * N + ((j % N + N) % N)]; }
    for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
      if (!at(i, j)) continue;
      var x0 = (i - N / 2) * CELL, x1 = x0 + CELL, z0 = (j - N / 2) * CELL, z1 = z0 + CELL, y0 = 0, y1 = TH;
      face(x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, 1.0);          // top
      face(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, 0.7);          // bottom
      if (!at(i + 1, j)) face(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 0.9);
      if (!at(i - 1, j)) face(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, 0.9);
      if (!at(i, j + 1)) face(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0.8);
      if (!at(i, j - 1)) face(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0.8);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
    var mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(1, 1, 1) }, uCamPos: this.shared.uCamPos, uFogColor: this.shared.uFogColor, uFogNear: { value: 200 }, uFogFar: { value: 700 }, uAlpha: { value: 0.85 } },
      vertexShader: 'attribute vec3 color; varying vec3 vCol; varying float vDist; uniform vec3 uCamPos; void main(){ vCol = color; vec4 wp = modelMatrix * vec4(position,1.0); vDist = length(wp.xz - uCamPos.xz); gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: 'uniform vec3 uColor; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar; uniform float uAlpha; varying vec3 vCol; varying float vDist; void main(){ vec3 c = uColor * vCol; float fog = smoothstep(uFogNear, uFogFar, vDist); gl_FragColor = vec4(mix(c, uFogColor, fog), uAlpha * (1.0 - fog)); }',
      transparent: true, depthWrite: false
    });
    this.clouds = new THREE.Mesh(geo, mat); this.clouds.frustumCulled = false; this.clouds.renderOrder = 5; this.clouds.position.y = 136; this.group.add(this.clouds);
    this.cloudPeriod = N * CELL;
  };
  // celestial angle 0..1 like MC (0 = sunrise)
  Sky.prototype.celestialAngle = function () {
    var f = ((this.time % 24000) + 24000) % 24000 / 24000 - 0.25; if (f < 0) f += 1;
    var a = 1 - ((Math.cos(f * Math.PI) + 1) / 2); return f + (a - f) / 3;
  };
  Sky.prototype.update = function (dt, camPos, biome, underwater, far) {
    var ang = this.celestialAngle();
    this.celestial.scale.setScalar(((far || 456) - 8) / 600);
    var rot = ang * Math.PI * 2;
    // sun at +x at sunrise, up at noon
    this.celestial.rotation.set(0, 0, 0); this.celestial.rotation.z = -rot; // rotate around z: sun from +x horizon up to +y
    // rotate group so that the sun position is (cos, sin) in the x-y plane
    this.sun.position.set(0, 400, 0); this.moon.position.set(0, -400, 0);
    var sunDir = new THREE.Vector3(Math.sin(rot) * 1, Math.cos(rot), 0);
    // day light: MC formula
    var dl = 1 - (Math.cos(rot) * 2 + 0.2); dl = MC.clamp(dl, 0, 1); var dayLight = 1 - dl; // 1 at noon, 0 at night
    // brightness with dusk shaping
    var sunH = Math.cos(rot);
    var bright = MC.clamp((sunH + 0.15) / 0.55, 0, 1);
    this.dayLight = 0.2 + 0.8 * bright;
    var nightBlue = 1 - bright;
    // colors
    var skyBase = biome ? new THREE.Color(biome.sky[0] / 255, biome.sky[1] / 255, biome.sky[2] / 255) : new THREE.Color(0x78a7ff);
    var fogBase = new THREE.Color(0xc0d8ff);
    var dayF = MC.clamp((sunH + 0.1) / 0.45, 0, 1);
    var night = new THREE.Color(0x02030a), nightFog = new THREE.Color(0x0a0e1a);
    this.skyColor.copy(night).lerp(skyBase, Math.pow(dayF, 0.8));
    this.fogColor.copy(nightFog).lerp(fogBase, Math.pow(dayF, 0.9));
    // sunset tint
    var sunset = MC.clamp(1 - Math.abs(sunH) / 0.3, 0, 1) * (sunH > -0.25 ? 1 : 0);
    var sunsetCol = new THREE.Color(0xff8a2a).lerp(new THREE.Color(0xff5030), MC.clamp(-sunH * 6, 0, 1));
    this.fogColor.lerp(sunsetCol, sunset * 0.35);
    var mat = this.dome.material.uniforms;
    mat.uZenith.value.copy(this.skyColor); mat.uHorizon.value.copy(this.fogColor); mat.uSunDir.value.copy(sunDir); mat.uSunset.value = sunset; mat.uSunsetColor.value.copy(sunsetCol);
    mat.uVoid.value.copy(this.fogColor).multiplyScalar(0.5);
    if (underwater) { var wc = new THREE.Color(0x0a2a6a).multiplyScalar(this.dayLight); this.fogColor.copy(wc); this.skyColor.copy(wc); mat.uZenith.value.copy(wc); mat.uHorizon.value.copy(wc); mat.uVoid.value.copy(wc); mat.uSunset.value = 0; }
    this.stars.material.opacity = MC.clamp((0.2 - sunH) / 0.35, 0, 1) * 0.9;
    this.sun.visible = sunH > -0.08 && !underwater;
    this.sun.material.opacity = MC.clamp((sunH + 0.08) / 0.35, 0, 1);
    this.moon.visible = sunH < 0.15 && !underwater;
    this.moon.material.opacity = MC.clamp((0.1 - sunH) / 0.2, 0, 1) * 0.95 + 0.05;
    this.group.position.copy(camPos);
    // clouds drift + wrap
    this.cloudDrift += dt * 0.6;
    if (this.clouds) {
      var P = this.cloudPeriod; var x = this.cloudDrift; var wrapX = Math.round((camPos.x - x) / P) * P;
      this.clouds.position.set(x + wrapX - camPos.x, 136 - camPos.y, Math.round(camPos.z / P) * P - camPos.z);
      var cc = new THREE.Color(1, 1, 1).multiplyScalar(0.35 + 0.65 * bright); cc.lerp(sunsetCol, sunset * 0.35);
      this.clouds.material.uniforms.uColor.value.copy(cc);
      this.clouds.visible = this.cloudsEnabled && !underwater;
    }
    // shared lighting uniforms
    this.shared.uSkyLight.value = this.dayLight;
    var tint = this.shared.uSkyTint.value; tint.set(1 - nightBlue * 0.25, 1 - nightBlue * 0.2, 1);
    this.shared.uFogColor.value.set(this.fogColor.r, this.fogColor.g, this.fogColor.b);
  };
  Sky.prototype.isNight = function () { var rot = this.celestialAngle() * Math.PI * 2; return Math.cos(rot) < -0.05; };
  MC.Sky = Sky;
})();
