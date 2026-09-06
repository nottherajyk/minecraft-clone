// Seeded simplex noise (2D + 3D), shared with the worker.
MC.Shared.push(function defineNoise(ns) {
  var F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  var F3 = 1 / 3, G3 = 1 / 6;
  var grad3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];

  function Noise(seed) {
    var s = (seed | 0) || 1;
    function rnd() { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    var p = new Uint8Array(256);
    for (var i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = p[i]; p[i] = p[j]; p[j] = t; }
    this.perm = new Uint8Array(512); this.permMod12 = new Uint8Array(512);
    for (i = 0; i < 512; i++) { this.perm[i] = p[i & 255]; this.permMod12[i] = this.perm[i] % 12; }
  }
  Noise.prototype.noise2D = function (xin, yin) {
    var perm = this.perm, permMod12 = this.permMod12;
    var n0, n1, n2;
    var s = (xin + yin) * F2; var i = Math.floor(xin + s), j = Math.floor(yin + s);
    var t = (i + j) * G2; var X0 = i - t, Y0 = j - t; var x0 = xin - X0, y0 = yin - Y0;
    var i1, j1; if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    var ii = i & 255, jj = j & 255;
    var t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0; else { var gi0 = permMod12[ii + perm[jj]]; t0 *= t0; n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0); }
    var t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0; else { var gi1 = permMod12[ii + i1 + perm[jj + j1]]; t1 *= t1; n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1); }
    var t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0; else { var gi2 = permMod12[ii + 1 + perm[jj + 1]]; t2 *= t2; n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2); }
    return 70 * (n0 + n1 + n2);
  };
  Noise.prototype.noise3D = function (xin, yin, zin) {
    var perm = this.perm, permMod12 = this.permMod12;
    var n0, n1, n2, n3;
    var s = (xin + yin + zin) * F3; var i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    var t = (i + j + k) * G3; var x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    var i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) { if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; } }
    else { if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } }
    var x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    var x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    var x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    var ii = i & 255, jj = j & 255, kk = k & 255;
    var t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) n0 = 0; else { var g0 = grad3[permMod12[ii + perm[jj + perm[kk]]]]; t0 *= t0; n0 = t0 * t0 * (g0[0] * x0 + g0[1] * y0 + g0[2] * z0); }
    var t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) n1 = 0; else { var g1 = grad3[permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]]; t1 *= t1; n1 = t1 * t1 * (g1[0] * x1 + g1[1] * y1 + g1[2] * z1); }
    var t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) n2 = 0; else { var g2 = grad3[permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]]; t2 *= t2; n2 = t2 * t2 * (g2[0] * x2 + g2[1] * y2 + g2[2] * z2); }
    var t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) n3 = 0; else { var g3 = grad3[permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]]; t3 *= t3; n3 = t3 * t3 * (g3[0] * x3 + g3[1] * y3 + g3[2] * z3); }
    return 32 * (n0 + n1 + n2 + n3);
  };
  // fractal brownian motion helpers
  Noise.prototype.fbm2 = function (x, y, oct, lac, gain) {
    var a = 1, f = 1, sum = 0, norm = 0;
    for (var i = 0; i < oct; i++) { sum += a * this.noise2D(x * f, y * f); norm += a; a *= gain; f *= lac; }
    return sum / norm;
  };
  Noise.prototype.fbm3 = function (x, y, z, oct, lac, gain) {
    var a = 1, f = 1, sum = 0, norm = 0;
    for (var i = 0; i < oct; i++) { sum += a * this.noise3D(x * f, y * f, z * f); norm += a; a *= gain; f *= lac; }
    return sum / norm;
  };
  Noise.prototype.ridged2 = function (x, y, oct) {
    var a = 1, f = 1, sum = 0, norm = 0;
    for (var i = 0; i < oct; i++) { sum += a * (1 - Math.abs(this.noise2D(x * f, y * f))); norm += a; a *= 0.5; f *= 2; }
    return sum / norm;
  };
  ns.Noise = Noise;

  // integer hash helpers usable in both threads
  ns.hash2i = function (x, z, seed) {
    var h = (x | 0) * 374761393 + (z | 0) * 668265263 + (seed | 0) * 2147483647;
    h = (h ^ (h >>> 13)) * 1274126177; h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  };
  ns.hash3i = function (x, y, z, seed) {
    var h = (x | 0) * 374761393 + (y | 0) * 1103515245 + (z | 0) * 668265263 + (seed | 0) * 12345;
    h = (h ^ (h >>> 13)) * 1274126177; h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  };
});
