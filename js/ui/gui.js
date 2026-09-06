// GUI manager: pixel-scaled 2D canvas (MC GUI scale), widgets, screens, item drawing, block icon renderer.
(function () {
  var G = {
    canvas: null, ctx: null, S: 2, W: 427, H: 240, pw: 854, ph: 480, mx: 0, my: 0, forcedScale: 0,
    init: function (canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); },
    resize: function (pw, ph) {
      this.pw = pw; this.ph = ph; this.canvas.width = pw; this.canvas.height = ph;
      var s = 1; if (this.forcedScale > 0) s = this.forcedScale; else { while (s < 8 && pw / (s + 1) >= 320 && ph / (s + 1) >= 240) s++; }
      this.S = s; this.W = Math.ceil(pw / s); this.H = Math.ceil(ph / s);
      this.iconCache = {};
    },
    begin: function () { var c = this.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.pw, this.ph); c.setTransform(this.S, 0, 0, this.S, 0, 0); c.imageSmoothingEnabled = false; },
    setMouse: function (px, py) { this.mx = px / this.S; this.my = py / this.S; },
    hover: function (x, y, w, h) { return this.mx >= x && this.my >= y && this.mx < x + w && this.my < y + h; },
    text: function (t, x, y, color, shadow) { return MC.Font.draw(this.ctx, t, x, y, color, shadow); },
    textC: function (t, cx, y, color, shadow) { return MC.Font.drawCentered(this.ctx, t, cx, y, color, shadow); },
    textR: function (t, rx, y, color, shadow) { return MC.Font.drawRight(this.ctx, t, rx, y, color, shadow); },
    rect: function (x, y, w, h, color) { this.ctx.fillStyle = color; this.ctx.fillRect(x, y, w, h); },
    gradient: function (x, y, w, h, c1, c2) { var g = this.ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2); this.ctx.fillStyle = g; this.ctx.fillRect(x, y, w, h); },
    drawBackground: function () { MC.Sprites.tileBackground(this.ctx, this.W + 16, this.H + 16, 'dirt_bg'); },
    drawDim: function () { this.gradient(0, 0, this.W, this.H, 'rgba(16,16,16,0.75)', 'rgba(16,16,16,0.82)'); },
    drawButton: function (x, y, w, h, label, state) {
      MC.Sprites.buttonBody(this.ctx, x, y, w, h, state);
      var col = state === 'disabled' ? '#a0a0a0' : (state === 'hover' ? '#ffffa0' : '#ffffff');
      if (label) this.textC(MC.Font.fit(label, w - 6), x + w / 2, y + Math.floor((h - 8) / 2), col, true);
    },
    drawSlider: function (x, y, w, label, frac, hover, disabled) {
      MC.Sprites.buttonBody(this.ctx, x, y, w, 20, 'disabled');
      var hx = x + Math.round(frac * (w - 8));
      this.ctx.drawImage(hover ? MC.Sprites.s.slider_handle_hover : MC.Sprites.s.slider_handle, hx, y);
      this.textC(label, x + w / 2, y + 6, disabled ? '#a0a0a0' : (hover ? '#ffffa0' : '#ffffff'), true);
    },
    drawField: function (x, y, w, h, text, focused, caret, placeholder) {
      this.rect(x - 1, y - 1, w + 2, h + 2, focused ? '#ffffff' : '#a0a0a0'); this.rect(x, y, w, h, '#000000');
      var tx = x + 4, ty = y + Math.floor((h - 8) / 2);
      if (!text && placeholder && !focused) this.text(placeholder, tx, ty, '#808080', true);
      else { var shown = text; while (MC.Font.width(shown + '_') > w - 8 && shown.length) shown = shown.slice(1); this.text(shown, tx, ty, '#e0e0e0', true); if (focused && caret) this.text('_', tx + MC.Font.width(shown), ty, '#e0e0e0', true); }
    },
    // ---- items ----
    iconCache: {},
    blockIcon: function (id) {
      var key = id + '@' + this.S; if (this.iconCache[key]) return this.iconCache[key];
      var cv = MC.IconRenderer.render(id, Math.min(64, 16 * this.S)); this.iconCache[key] = cv; return cv;
    },
    drawItemIcon: function (itemId, x, y) {
      var it = MC.ITEMS[itemId]; var c = this.ctx;
      if (itemId === 'red_bed') { c.drawImage(MC.Sprites.s.icon_bed, x, y); return; }
      if (it && it.block >= 0) {
        var B = MC.BLOCKS[it.block];
        if (B.flat) { var tile = B.tint ? MC.Tex.tintedTileCanvas(B.faces[0], B.tint === 'grass' ? MC.BIOMES[1].grass : (B.tint === 'foliage' ? MC.BIOMES[1].foliage : [255, 255, 255])) : MC.Tex.tileCanvas(B.faces[0]); c.drawImage(tile, x, y, 16, 16); return; }
        var icon = this.blockIcon(it.block); c.drawImage(icon, x, y, 16, 16); return;
      }
      var img = MC.ItemIcons.get(itemId) || MC.ItemIcons.get('missing'); c.drawImage(img, x, y, 16, 16);
    },
    drawItemStack: function (stack, x, y, noCount) {
      if (!stack) return; this.drawItemIcon(stack.id, x, y);
      var it = MC.ITEMS[stack.id];
      if (it && stack.damage > 0) { var dur = it.tool ? it.tool.durability : (it.armor ? it.armor.durability : 0); if (dur) { var f = 1 - stack.damage / dur; var w = Math.round(f * 13); var hue = f / 3; this.rect(x + 2, y + 13, 13, 2, '#000000'); this.rect(x + 2, y + 13, w, 1, 'hsl(' + (hue * 360) + ',100%,50%)'); } }
      if (!noCount && stack.count > 1) { var t = String(stack.count); this.text(t, x + 17 - MC.Font.width(t) + 1, y + 9, '#ffffff', true); }
    },
    itemLabel: function (stack) { var it = MC.ITEMS[stack.id]; if (!it) return stack.id; var col = it.name.indexOf('golden_apple') === 0 || it.name === 'enchanted_book' || it.name === 'totem_of_undying' ? '§d' : (it.name === 'nether_star' || it.name === 'elytra' ? '§e' : '§f'); return col + it.label; },
    drawTooltip: function (lines, x, y) {
      if (!lines || !lines.length) return;
      var w = 0; for (var i = 0; i < lines.length; i++) w = Math.max(w, MC.Font.width(lines[i]));
      var h = lines.length * 10 + (lines.length > 1 ? 2 : 0); x += 12; y -= 12;
      if (x + w + 8 > this.W) x -= 28 + w; if (y + h + 6 > this.H) y = this.H - h - 6; if (y < 4) y = 4;
      var c = this.ctx;
      c.fillStyle = 'rgba(16,0,16,0.94)'; c.fillRect(x - 3, y - 4, w + 8, h + 8);
      c.fillStyle = 'rgba(80,0,255,0.31)'; c.fillRect(x - 3, y - 3, 1, h + 6); c.fillRect(x + w + 4, y - 3, 1, h + 6); c.fillRect(x - 3, y - 3, w + 8, 1); c.fillRect(x - 3, y + h + 3, w + 8, 1);
      c.fillStyle = 'rgba(40,0,127,0.31)'; c.fillRect(x - 3, y + h + 3, w + 8, 1); c.fillRect(x + w + 4, y - 3, 1, h + 6);
      for (i = 0; i < lines.length; i++) this.text(lines[i], x, y + i * 10 + (i > 0 ? 2 : 0), i === 0 ? '#ffffff' : '#a0a0a0', true);
    }
  };
  MC.Gui = G;

  // ---------- Screen base ----------
  function Screen(game) { this.game = game; this.widgets = []; this.dragging = null; this.focus = null; this.caretT = 0; this.tooltip = null; }
  Screen.prototype.clear = function () { this.widgets = []; this.setFocus(null); };
  Screen.prototype.button = function (x, y, w, h, label, onClick, tooltip) { var b = { type: 'button', x: x, y: y, w: w, h: h, label: label, onClick: onClick, enabled: true, visible: true, tooltip: tooltip }; this.widgets.push(b); return b; };
  Screen.prototype.slider = function (x, y, w, labelFn, value, onChange) { var s = { type: 'slider', x: x, y: y, w: w, h: 20, labelFn: labelFn, value: value, onChange: onChange, enabled: true, visible: true }; this.widgets.push(s); return s; };
  Screen.prototype.field = function (x, y, w, h, text, opts) { var f = Object.assign({ type: 'field', x: x, y: y, w: w, h: h, text: text || '', maxLen: 32, visible: true, enabled: true }, opts || {}); this.widgets.push(f); return f; };
  Screen.prototype.setFocus = function (f) {
    if (this.focus === f) return; this.focus = f; var self = this;
    if (f) MC.Input.setTextTarget(function (ch) { self.typed(ch); }); else MC.Input.setTextTarget(null);
  };
  Screen.prototype.typed = function (ch) {
    var f = this.focus; if (!f) return;
    if (ch === '\b') f.text = f.text.slice(0, -1);
    else if (ch === '\n') { if (f.onEnter) f.onEnter(f.text); }
    else if (ch === '\x1b') { this.setFocus(null); }
    else if (ch === '\t') { var fields = this.widgets.filter(function (w) { return w.type === 'field' && w.visible; }); var i = fields.indexOf(f); if (fields.length) this.setFocus(fields[(i + 1) % fields.length]); }
    else if (ch.length === 1 && ch >= ' ') { if (f.text.length < f.maxLen && (!f.filter || f.filter(ch))) f.text += ch; }
    if (f.onChange) f.onChange(f.text);
  };
  Screen.prototype.renderWidgets = function () {
    var g = MC.Gui; this.tooltip = null;
    for (var i = 0; i < this.widgets.length; i++) {
      var w = this.widgets[i]; if (!w.visible) continue;
      var hov = g.hover(w.x, w.y, w.w, w.h);
      if (w.type === 'button') { var label = typeof w.label === 'function' ? w.label() : w.label; g.drawButton(w.x, w.y, w.w, w.h, label, !w.enabled ? 'disabled' : (hov ? 'hover' : 'normal')); if (w.icon) g.ctx.drawImage(w.icon, w.x + Math.floor((w.w - w.icon.width) / 2), w.y + Math.floor((w.h - w.icon.height) / 2)); if (hov && w.tooltip) this.tooltip = typeof w.tooltip === 'function' ? w.tooltip() : w.tooltip; }
      else if (w.type === 'slider') g.drawSlider(w.x, w.y, w.w, w.labelFn(w.value), w.value, hov || this.dragging === w, !w.enabled);
      else if (w.type === 'field') g.drawField(w.x, w.y, w.w, w.h, w.text, this.focus === w, Math.floor(this.caretT * 2) % 2 === 0, w.placeholder);
    }
    if (this.tooltip) g.drawTooltip(Array.isArray(this.tooltip) ? this.tooltip : [this.tooltip], g.mx, g.my);
  };
  Screen.prototype.mouseDown = function (x, y, button) {
    var g = MC.Gui;
    for (var i = this.widgets.length - 1; i >= 0; i--) {
      var w = this.widgets[i]; if (!w.visible || !w.enabled) continue;
      if (x >= w.x && y >= w.y && x < w.x + w.w && y < w.y + w.h) {
        if (w.type === 'button' && button === 0) { MC.Audio.play('ui.click'); if (w.onClick) w.onClick(w); return true; }
        if (w.type === 'slider' && button === 0) { this.dragging = w; w.value = MC.clamp((x - w.x - 4) / (w.w - 8), 0, 1); if (w.onChange) w.onChange(w.value); return true; }
        if (w.type === 'field') { this.setFocus(w); return true; }
      }
    }
    if (this.focus) this.setFocus(null);
    return false;
  };
  Screen.prototype.mouseUp = function () { if (this.dragging) { if (this.dragging.onRelease) this.dragging.onRelease(this.dragging.value); MC.Audio.play('ui.click'); } this.dragging = null; };
  Screen.prototype.mouseMove = function (x, y) { if (this.dragging) { var w = this.dragging; w.value = MC.clamp((x - w.x - 4) / (w.w - 8), 0, 1); if (w.onChange) w.onChange(w.value); } };
  Screen.prototype.key = function (code) { return false; };
  Screen.prototype.tick = function (dt) { this.caretT += dt; };
  Screen.prototype.wheel = function (dir) { };
  Screen.prototype.onOpen = function () { this.layout(); };
  Screen.prototype.onClose = function () { this.setFocus(null); };
  Screen.prototype.layout = function () { };
  Screen.prototype.render = function () { this.renderWidgets(); };
  Screen.prototype.pausesGame = true;
  MC.Screen = Screen;

  // ---------- Block icon renderer (isometric, like MC inventory) ----------
  var IR = {
    renderer: null, scene: null, camera: null, mats: null, cache: {},
    init: function (texArray) {
      try { this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true }); } catch (e) { this.renderer = null; return; }
      this.renderer.setClearColor(0x000000, 0); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-0.82, 0.82, 0.82, -0.82, 0.1, 20);
      this.camera.position.set(1, 0.82, 1).normalize().multiplyScalar(6); this.camera.lookAt(0, 0, 0);
      this.mats = MC.Shaders.createChunkMaterials(texArray);
      this.mats.uniforms.uFogNear.value = 1e5; this.mats.uniforms.uFogFar.value = 2e5; this.mats.uniforms.uSkyLight.value = 1; this.mats.uniforms.uGamma.value = 0.5;
    },
    render: function (id, size) {
      var key = id + '@' + size; if (this.cache[key]) return this.cache[key];
      var cv = document.createElement('canvas'); cv.width = size; cv.height = size;
      if (!this.renderer) { this.cache[key] = cv; return cv; }
      this.renderer.setSize(size, size, false);
      var geo = MC.BlockMesh.geometry(id, 0, 15); var mesh = new THREE.Mesh(geo, MC.BlockMesh.materialFor(id, this.mats));
      // MC shades block icons with a fixed light: emulate top/left/right via existing shading
      this.scene.add(mesh); this.renderer.render(this.scene, this.camera); this.scene.remove(mesh);
      cv.getContext('2d').drawImage(this.renderer.domElement, 0, 0, size, size);
      this.cache[key] = cv; return cv;
    },
    // render arbitrary object (e.g. player model) to a canvas
    renderObject: function (obj, w, h, camPos, camLook, ortho) {
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h; if (!this.renderer) return cv;
      this.renderer.setSize(w, h, false);
      var cam = ortho ? new THREE.OrthographicCamera(-ortho * w / h, ortho * w / h, ortho, -ortho, 0.1, 50) : new THREE.PerspectiveCamera(50, w / h, 0.1, 50);
      cam.position.copy(camPos); cam.lookAt(camLook);
      this.scene.add(obj); this.renderer.render(this.scene, cam); this.scene.remove(obj);
      cv.getContext('2d').drawImage(this.renderer.domElement, 0, 0, w, h); return cv;
    }
  };
  MC.IconRenderer = IR;
})();
