// Touch controls & Mobile input adapter for Minecraft Web Edition.
(function () {
  var touchActive = false;
  var enabled = true;
  var overlay = null;
  var kbInput = null;
  var lookTouchId = null;
  var lastLookX = 0, lastLookY = 0;
  var sneakToggled = false;
  var sprintToggled = false;

  // Check touch capability
  function isTouchDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
  }

  function init() {
    createKbInput();
    createOverlay();
    bindTouchListeners();

    // Auto-detect touch
    if (isTouchDevice()) {
      enableTouchMode();
    }

    // Enable on first touch anywhere
    window.addEventListener('touchstart', function onFirstTouch() {
      enableTouchMode();
      window.removeEventListener('touchstart', onFirstTouch);
    }, { passive: true });
  }

  function enableTouchMode() {
    if (touchActive) return;
    touchActive = true;
    MC.Input.simulateLock = true;
    MC.Input.touchActive = true;
    updateVisibility();
  }

  function createKbInput() {
    kbInput = document.createElement('input');
    kbInput.type = 'text';
    kbInput.id = 'mc-mobile-kb';
    kbInput.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0;pointer-events:none;z-index:-1;';
    document.body.appendChild(kbInput);

    kbInput.addEventListener('input', function () {
      if (MC.Input.textTarget && kbInput.value) {
        var val = kbInput.value;
        for (var i = 0; i < val.length; i++) {
          MC.Input.textTarget(val[i]);
        }
        kbInput.value = '';
      }
    });

    kbInput.addEventListener('keydown', function (e) {
      if (MC.Input.textTarget) {
        if (e.key === 'Backspace') MC.Input.textTarget('\b');
        else if (e.key === 'Enter') MC.Input.textTarget('\n');
        else if (e.key === 'Escape') MC.Input.textTarget('\x1b');
      }
    });
  }

  function focusKb() {
    if (kbInput) {
      kbInput.value = '';
      kbInput.focus();
    }
  }

  function blurKb() {
    if (kbInput) {
      kbInput.blur();
    }
  }

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'touch-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;user-select:none;-webkit-user-select:none;display:none;';

    overlay.innerHTML = `
      <!-- Top Bar -->
      <div class="touch-topbar" style="position:absolute;top:10px;right:10px;display:flex;gap:10px;pointer-events:auto;">
        <button id="tb-chat" class="touch-btn touch-btn-sm" title="Chat">💬</button>
        <button id="tb-inv" class="touch-btn touch-btn-sm" title="Inventory">🎒</button>
        <button id="tb-f5" class="touch-btn touch-btn-sm" title="Camera">👁️</button>
        <button id="tb-pause" class="touch-btn touch-btn-sm" title="Pause">⏸️</button>
      </div>

      <!-- D-Pad Left -->
      <div class="touch-dpad-container" style="position:absolute;bottom:20px;left:20px;width:150px;height:150px;pointer-events:auto;">
        <button id="dp-up" class="touch-btn dpad-btn dpad-up">▲</button>
        <button id="dp-down" class="touch-btn dpad-btn dpad-down">▼</button>
        <button id="dp-left" class="touch-btn dpad-btn dpad-left">◀</button>
        <button id="dp-right" class="touch-btn dpad-btn dpad-right">▶</button>
        <button id="dp-center" class="touch-btn dpad-btn dpad-center">🦘</button>
      </div>

      <!-- Actions Right -->
      <div class="touch-actions-container" style="position:absolute;bottom:20px;right:20px;display:flex;flex-direction:column;align-items:flex-end;gap:12px;pointer-events:auto;">
        <div style="display:flex;gap:10px;">
          <button id="btn-drop" class="touch-btn touch-btn-mid" title="Drop Item">🗑️</button>
          <button id="btn-sprint" class="touch-btn touch-btn-mid" title="Sprint">⚡</button>
          <button id="btn-sneak" class="touch-btn touch-btn-mid" title="Sneak">🧎</button>
        </div>
        <div style="display:flex;gap:12px;align-items:center;">
          <button id="btn-place" class="touch-btn touch-btn-lg touch-btn-place" title="Place / Use">📦<br><span style="font-size:10px">PLACE</span></button>
          <button id="btn-mine" class="touch-btn touch-btn-lg touch-btn-mine" title="Mine / Attack">⛏️<br><span style="font-size:10px">MINE</span></button>
          <button id="btn-jump" class="touch-btn touch-btn-lg touch-btn-jump" title="Jump">⬆️<br><span style="font-size:10px">JUMP</span></button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    bindButtonEvents();
  }

  function bindButtonEvents() {
    function bindKeyBtn(id, actionCode, isToggle) {
      var btn = document.getElementById(id);
      if (!btn) return;
      var active = false;

      function onDown(e) {
        e.preventDefault();
        e.stopPropagation();
        if (isToggle) {
          active = !active;
          if (active) {
            MC.Input.pressKey(actionCode);
            btn.classList.add('active');
          } else {
            MC.Input.releaseKey(actionCode);
            btn.classList.remove('active');
          }
        } else {
          MC.Input.pressKey(actionCode);
          btn.classList.add('active');
        }
      }

      function onUp(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!isToggle) {
          MC.Input.releaseKey(actionCode);
          btn.classList.remove('active');
        }
      }

      btn.addEventListener('touchstart', onDown, { passive: false });
      btn.addEventListener('touchend', onUp, { passive: false });
      btn.addEventListener('touchcancel', onUp, { passive: false });
      btn.addEventListener('mousedown', onDown);
      btn.addEventListener('mouseup', onUp);
    }

    // D-Pad unified touch drag + multi-directional support
    var dpadContainer = overlay ? overlay.querySelector('.touch-dpad-container') : document.querySelector('.touch-dpad-container');
    var dpadTouchId = null;
    var dpadState = { forward: false, back: false, left: false, right: false, jump: false };

    function updateDpadFromCoords(clientX, clientY) {
      if (!dpadContainer) return;
      var rect = dpadContainer.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = clientX - cx;
      var dy = clientY - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);

      var next = { forward: false, back: false, left: false, right: false, jump: false };
      if (dist < 18) {
        next.jump = true;
      } else {
        if (dy < -14) next.forward = true;
        if (dy > 14) next.back = true;
        if (dx < -14) next.left = true;
        if (dx > 14) next.right = true;
      }

      for (var action in next) {
        if (next[action] && !dpadState[action]) {
          MC.Input.pressKey(action);
        } else if (!next[action] && dpadState[action]) {
          MC.Input.releaseKey(action);
        }
        dpadState[action] = next[action];
      }

      var u = document.getElementById('dp-up');
      var d = document.getElementById('dp-down');
      var l = document.getElementById('dp-left');
      var r = document.getElementById('dp-right');
      var c = document.getElementById('dp-center');
      if (u) u.classList.toggle('active', !!next.forward);
      if (d) d.classList.toggle('active', !!next.back);
      if (l) l.classList.toggle('active', !!next.left);
      if (r) r.classList.toggle('active', !!next.right);
      if (c) c.classList.toggle('active', !!next.jump);
    }

    function clearDpad() {
      for (var action in dpadState) {
        if (dpadState[action]) {
          MC.Input.releaseKey(action);
          dpadState[action] = false;
        }
      }
      var u = document.getElementById('dp-up');
      var d = document.getElementById('dp-down');
      var l = document.getElementById('dp-left');
      var r = document.getElementById('dp-right');
      var c = document.getElementById('dp-center');
      if (u) u.classList.remove('active');
      if (d) d.classList.remove('active');
      if (l) l.classList.remove('active');
      if (r) r.classList.remove('active');
      if (c) c.classList.remove('active');
      dpadTouchId = null;
    }

    if (dpadContainer) {
      dpadContainer.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var t = e.changedTouches[0];
        dpadTouchId = t.identifier;
        updateDpadFromCoords(t.clientX, t.clientY);
      }, { passive: false });

      dpadContainer.addEventListener('touchmove', function (e) {
        e.preventDefault();
        e.stopPropagation();
        for (var i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === dpadTouchId) {
            updateDpadFromCoords(e.touches[i].clientX, e.touches[i].clientY);
            break;
          }
        }
      }, { passive: false });

      dpadContainer.addEventListener('touchend', function (e) {
        e.preventDefault();
        e.stopPropagation();
        for (var i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === dpadTouchId) {
            clearDpad();
            break;
          }
        }
      }, { passive: false });

      dpadContainer.addEventListener('touchcancel', function (e) {
        clearDpad();
      }, { passive: false });
    }

    // Individual button click fallback for mouse testing
    bindKeyBtn('dp-up', 'forward');
    bindKeyBtn('dp-down', 'back');
    bindKeyBtn('dp-left', 'left');
    bindKeyBtn('dp-right', 'right');
    bindKeyBtn('dp-center', 'jump');

    // Actions
    bindKeyBtn('btn-jump', 'jump');
    bindKeyBtn('btn-sneak', 'sneak', true);
    bindKeyBtn('btn-sprint', 'sprint', true);

    // Drop
    var dropBtn = document.getElementById('btn-drop');
    if (dropBtn) {
      dropBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        MC.Input.pressKey('drop');
        setTimeout(function () { MC.Input.releaseKey('drop'); }, 100);
      }, { passive: false });
    }

    // Mine (Left Click / Button 0)
    var mineBtn = document.getElementById('btn-mine');
    if (mineBtn) {
      function startMine(e) {
        e.preventDefault();
        e.stopPropagation();
        MC.Input.mouse.buttons |= 1;
        MC.Input.mouse.clicks.push({ button: 0, x: MC.Input.mouse.x, y: MC.Input.mouse.y, down: true });
        mineBtn.classList.add('active');
      }
      function endMine(e) {
        e.preventDefault();
        e.stopPropagation();
        MC.Input.mouse.buttons &= ~1;
        MC.Input.mouse.clicks.push({ button: 0, x: MC.Input.mouse.x, y: MC.Input.mouse.y, down: false });
        mineBtn.classList.remove('active');
      }
      mineBtn.addEventListener('touchstart', startMine, { passive: false });
      mineBtn.addEventListener('touchend', endMine, { passive: false });
      mineBtn.addEventListener('touchcancel', endMine, { passive: false });
      mineBtn.addEventListener('mousedown', startMine);
      mineBtn.addEventListener('mouseup', endMine);
    }

    // Place / Use (Right Click / Button 2 = bit 4)
    var placeBtn = document.getElementById('btn-place');
    if (placeBtn) {
      function startPlace(e) {
        e.preventDefault();
        e.stopPropagation();
        MC.Input.mouse.buttons |= 4;
        MC.Input.mouse.clicks.push({ button: 2, x: MC.Input.mouse.x, y: MC.Input.mouse.y, down: true });
        placeBtn.classList.add('active');
      }
      function endPlace(e) {
        e.preventDefault();
        e.stopPropagation();
        MC.Input.mouse.buttons &= ~4;
        MC.Input.mouse.clicks.push({ button: 2, x: MC.Input.mouse.x, y: MC.Input.mouse.y, down: false });
        placeBtn.classList.remove('active');
      }
      placeBtn.addEventListener('touchstart', startPlace, { passive: false });
      placeBtn.addEventListener('touchend', endPlace, { passive: false });
      placeBtn.addEventListener('touchcancel', endPlace, { passive: false });
      placeBtn.addEventListener('mousedown', startPlace);
      placeBtn.addEventListener('mouseup', endPlace);
    }

    // Top bar buttons
    var pauseBtn = document.getElementById('tb-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        if (window.gameInstance) {
          if (window.gameInstance.screen) window.gameInstance.closeScreen();
          else window.gameInstance.openScreen(new MC.Screens.PauseScreen(window.gameInstance));
        }
      }, { passive: false });
    }

    var invBtn = document.getElementById('tb-inv');
    if (invBtn) {
      invBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        if (window.gameInstance && window.gameInstance.player) {
          var p = window.gameInstance.player;
          if (window.gameInstance.screen) window.gameInstance.closeScreen();
          else window.gameInstance.openScreen(p.isCreative() ? new MC.Inventory.Screens.CreativeScreen(window.gameInstance, window.gameInstance.lastCreativeTab || 2) : new MC.Inventory.Screens.InventoryScreen(window.gameInstance));
        }
      }, { passive: false });
    }

    var chatBtn = document.getElementById('tb-chat');
    if (chatBtn) {
      chatBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        if (window.gameInstance && window.gameInstance.chat) {
          window.gameInstance.chat.openChat('');
          focusKb();
        }
      }, { passive: false });
    }

    var f5Btn = document.getElementById('tb-f5');
    if (f5Btn) {
      f5Btn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        if (window.gameInstance) {
          window.gameInstance.perspective = (window.gameInstance.perspective + 1) % 3;
        }
      }, { passive: false });
    }
  }

  function bindTouchListeners() {
    var gameCanvas = document.getElementById('game') || document.body;

    // Window touchstart for camera drag & hotbar taps & GUI clicks
    window.addEventListener('touchstart', function (e) {
      if (!enabled || !touchActive) return;
      var g = window.gameInstance;

      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        var target = t.target;

        // If touching overlay elements or buttons, ignore for camera look
        if (target && target.closest && (target.closest('#touch-overlay button') || target.closest('.touch-dpad-container'))) {
          continue;
        }

        var px = t.clientX;
        var py = t.clientY;

        // If in GUI / menu or chat screen
        if (g && (g.screen || g.chat.open || g.state !== 'playing')) {
          e.preventDefault();
          var r = gameCanvas.getBoundingClientRect();
          var mx = px - r.left;
          var my = py - r.top;
          MC.Input.mouse.x = mx;
          MC.Input.mouse.y = my;
          MC.Input.mouse.moved = true;
          MC.Input.mouse.buttons |= 1;
          MC.Input.mouse.clicks.push({ button: 0, x: mx, y: my, down: true });
          if (MC.Input.textTarget) focusKb();
          continue;
        }

        // Gameplay: check if tapping hotbar area at bottom center (dynamically scaled)
        if (g && g.state === 'playing' && g.player && !g.screen) {
          var S = (MC.Gui && MC.Gui.S) || 2;
          var W = (MC.Gui && MC.Gui.W) || Math.ceil(window.innerWidth / S);
          var H = (MC.Gui && MC.Gui.H) || Math.ceil(window.innerHeight / S);
          var hx = (Math.floor(W / 2) - 91) * S;
          var hy = (H - 22) * S;
          var hw = 182 * S;
          if (px >= hx - 12 && px <= hx + hw + 12 && py >= hy - 16) {
            var slot = Math.floor((px - hx) / (20 * S));
            if (slot >= 0 && slot < 9) {
              g.player.selected = slot;
              MC.Audio.play('ui.click', { volume: 0.25 });
              e.preventDefault();
              continue;
            }
          }
        }

        // Camera Look touch binding (right side or non-button touch)
        if (lookTouchId === null) {
          lookTouchId = t.identifier;
          lastLookX = t.clientX;
          lastLookY = t.clientY;
        }
      }
    }, { passive: false });

    window.addEventListener('touchmove', function (e) {
      if (!enabled || !touchActive) return;
      var g = window.gameInstance;

      for (var i = 0; i < e.touches.length; i++) {
        var t = e.touches[i];

        // GUI mouse drag
        if (g && (g.screen || g.chat.open || g.state !== 'playing')) {
          e.preventDefault();
          var r = gameCanvas.getBoundingClientRect();
          var mx = t.clientX - r.left;
          var my = t.clientY - r.top;
          MC.Input.mouse.x = mx;
          MC.Input.mouse.y = my;
          MC.Input.mouse.moved = true;
        }

        // Camera look update
        if (t.identifier === lookTouchId) {
          var dx = t.clientX - lastLookX;
          var dy = t.clientY - lastLookY;
          lastLookX = t.clientX;
          lastLookY = t.clientY;
          MC.Input.mouse.dx += dx * 1.8;
          MC.Input.mouse.dy += dy * 1.8;
        }
      }
    }, { passive: false });

    function onTouchEnd(e) {
      if (!enabled || !touchActive) return;
      var g = window.gameInstance;

      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];

        if (g && (g.screen || g.chat.open || g.state !== 'playing')) {
          e.preventDefault();
          var r = gameCanvas.getBoundingClientRect();
          var mx = t.clientX - r.left;
          var my = t.clientY - r.top;
          MC.Input.mouse.buttons &= ~1;
          MC.Input.mouse.clicks.push({ button: 0, x: mx, y: my, down: false });
        }

        if (t.identifier === lookTouchId) {
          lookTouchId = null;
        }
      }
    }

    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchEnd, { passive: false });
  }

  function updateVisibility() {
    if (!overlay) return;
    var g = window.gameInstance;
    var shouldShow = enabled && touchActive && g && g.state === 'playing' && !g.screen;
    overlay.style.display = shouldShow ? 'block' : 'none';
  }

  // Update check every frame or state change
  function update() {
    updateVisibility();
  }

  // Export
  MC.TouchControls = {
    init: init,
    enable: function () { enabled = true; enableTouchMode(); },
    disable: function () { enabled = false; updateVisibility(); },
    update: update,
    focusKb: focusKb,
    blurKb: blurKb,
    get active() { return touchActive && enabled; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
