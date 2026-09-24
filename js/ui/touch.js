// Touch controls & Mobile input adapter for Minecraft Web Edition.
// Implements the official modern Minecraft Bedrock Edition "Touch" control scheme:
// - Move: Virtual analog joystick at bottom-left
// - Tap anywhere on screen: Look around, Use/Place item, Attack mob, Interact with blocks, Hold to mine
// - Top-center: Emote / Perspective (👤), Chat (💬), Pause menu (⏸️)
// - Right side: Jump (▲), Sprint (⏩), Sneak (▼)
// - Bottom-center: Hotbar slot selection + attached "..." Open Inventory/Craft button
(function () {
  var touchActive = false;
  var enabled = true;
  var overlay = null;
  var kbInput = null;

  // Joystick state
  var joystickTouchId = null;
  var joystickBase = null;
  var joystickKnob = null;
  var joystickCenter = { x: 0, y: 0 };
  var joystickMaxRadius = 36;

  // Screen interaction state (look, tap, mine)
  var screenTouchId = null;
  var screenStartX = 0, screenStartY = 0;
  var lastLookX = 0, lastLookY = 0;
  var touchStartTime = 0;
  var hasMoved = false;
  var holdTimer = null;
  var isMining = false;
  var miningTarget = null;
  var miningProgress = 0;
  var miningSoundTimer = 0;

  // Action toggles
  var sprintToggled = false;
  var sneakToggled = false;

  function isTouchDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
  }

  function init() {
    createKbInput();
    createOverlay();
    bindEvents();

    if (isTouchDevice()) {
      enableTouchMode();
    }

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
      <!-- Top Center Bar: Perspective / Emote, Chat, Pause Menu -->
      <div class="touch-topbar-center">
        <button id="tb-cam" class="touch-btn touch-btn-sq" title="Perspective (F5)">
          <svg class="touch-icon" viewBox="0 0 24 24" width="22" height="22">
            <rect x="8" y="2" width="8" height="8" rx="1" fill="#ffffff"/>
            <rect x="7" y="11" width="10" height="7" rx="1" fill="#ffffff"/>
            <rect x="7" y="19" width="4.5" height="4" rx="0.5" fill="#ffffff"/>
            <rect x="12.5" y="19" width="4.5" height="4" rx="0.5" fill="#ffffff"/>
            <rect x="4" y="11" width="2.5" height="7" rx="0.5" fill="#ffffff"/>
            <rect x="17.5" y="11" width="2.5" height="7" rx="0.5" fill="#ffffff"/>
          </svg>
        </button>
        <button id="tb-chat" class="touch-btn touch-btn-sq" title="Chat">
          <svg class="touch-icon" viewBox="0 0 24 24" width="22" height="22">
            <path fill="#ffffff" d="M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-5 4v-4H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm3 4v2h12V8H6zm0 4v2h8v-2H6z"/>
          </svg>
        </button>
        <button id="tb-pause" class="touch-btn touch-btn-sq" title="Menu / Pause">
          <svg class="touch-icon" viewBox="0 0 24 24" width="22" height="22">
            <rect x="6" y="4" width="4" height="16" rx="1" fill="#ffffff"/>
            <rect x="14" y="4" width="4" height="16" rx="1" fill="#ffffff"/>
          </svg>
        </button>
      </div>

      <!-- Bottom-Left Virtual Joystick (Move) -->
      <div id="touch-joystick-zone" class="touch-joystick-zone">
        <div id="touch-joystick-base" class="touch-joystick-base">
          <div id="touch-joystick-knob" class="touch-joystick-knob"></div>
        </div>
      </div>

      <!-- Bottom-Center Inventory button attached to hotbar -->
      <button id="tb-inv" class="touch-btn touch-btn-dots" title="Open Inventory / Craft">
        <svg class="touch-icon" viewBox="0 0 24 24" width="20" height="20">
          <circle cx="5" cy="12" r="2.5" fill="#ffffff"/>
          <circle cx="12" cy="12" r="2.5" fill="#ffffff"/>
          <circle cx="19" cy="12" r="2.5" fill="#ffffff"/>
        </svg>
      </button>

      <!-- Right Side Action Cluster: Jump, Sneak, Interact (Hand), Sprint, Attack (Sword) -->
      <div class="touch-action-cluster">
        <button id="btn-jump" class="touch-btn touch-btn-action touch-jump" title="Jump / Fly">
          <svg class="touch-icon" viewBox="0 0 24 24" width="26" height="26">
            <polygon points="12,2 4,11 9,11 9,16 15,16 15,11 20,11" fill="#ffffff"/>
            <rect x="4" y="18" width="16" height="3" rx="1" fill="#ffffff"/>
          </svg>
        </button>
        <button id="btn-sneak" class="touch-btn touch-btn-action touch-sneak" title="Sneak">
          <svg class="touch-icon" viewBox="0 0 24 24" width="26" height="26">
            <rect x="4" y="3" width="16" height="3" rx="1" fill="#ffffff"/>
            <polygon points="12,22 4,13 9,13 9,8 15,8 15,13 20,13" fill="#ffffff"/>
          </svg>
        </button>
        <button id="btn-interact" class="touch-btn touch-btn-action touch-interact" title="Use / Place / Interact">
          <svg class="touch-icon" viewBox="0 0 24 24" width="26" height="26">
            <path fill="#ffffff" d="M10 2a1.5 1.5 0 0 0-1.5 1.5V11l-1.4-1.4a1.5 1.5 0 0 0-2.1 2.1l4.5 4.5c.9.9 2.1 1.4 3.4 1.4h4.1a3.5 3.5 0 0 0 3.5-3.5V9.5a1.5 1.5 0 0 0-3 0V11h-1V5.5a1.5 1.5 0 0 0-3 0V11h-1V3.5A1.5 1.5 0 0 0 10 2z"/>
          </svg>
        </button>
        <button id="btn-sprint" class="touch-btn touch-btn-action touch-sprint" title="Sprint">
          <svg class="touch-icon" viewBox="0 0 24 24" width="26" height="26">
            <polygon points="3,4 10,12 3,20 6,20 13,12 6,4" fill="#ffffff"/>
            <polygon points="11,4 18,12 11,20 14,20 21,12 14,4" fill="#ffffff"/>
          </svg>
        </button>
        <button id="btn-attack" class="touch-btn touch-btn-action touch-attack" title="Attack / Mine">
          <svg class="touch-icon" viewBox="0 0 16 16" width="26" height="26" shape-rendering="crispEdges">
            <rect x="13" y="1" width="2" height="2" fill="#ffffff"/>
            <rect x="11" y="3" width="2" height="2" fill="#ffffff"/>
            <rect x="9" y="5" width="2" height="2" fill="#ffffff"/>
            <rect x="7" y="7" width="2" height="2" fill="#ffffff"/>
            <rect x="12" y="2" width="2" height="2" fill="#ffffff"/>
            <rect x="10" y="4" width="2" height="2" fill="#ffffff"/>
            <rect x="8" y="6" width="2" height="2" fill="#ffffff"/>
            <rect x="5" y="7" width="2" height="2" fill="#ffffff"/>
            <rect x="4" y="8" width="2" height="2" fill="#ffffff"/>
            <rect x="7" y="9" width="2" height="2" fill="#ffffff"/>
            <rect x="8" y="10" width="2" height="2" fill="#ffffff"/>
            <rect x="6" y="8" width="2" height="2" fill="#ffffff"/>
            <rect x="4" y="10" width="2" height="2" fill="#ffffff"/>
            <rect x="3" y="11" width="2" height="2" fill="#ffffff"/>
            <rect x="1" y="13" width="2" height="2" fill="#ffffff"/>
            <rect x="2" y="14" width="2" height="2" fill="#ffffff"/>
            <rect x="1" y="14" width="2" height="2" fill="#ffffff"/>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    joystickBase = document.getElementById('touch-joystick-base');
    joystickKnob = document.getElementById('touch-joystick-knob');
  }

  function getScreenRayDir(camera, clientX, clientY) {
    var ndcX = (clientX / window.innerWidth) * 2 - 1;
    var ndcY = -(clientY / window.innerHeight) * 2 + 1;
    var v = new THREE.Vector3(ndcX, ndcY, 0.5);
    v.unproject(camera);
    v.sub(camera.position).normalize();
    return v;
  }

  function bindEvents() {
    bindJoystick();
    bindActionButtons();
    bindScreenTouch();
  }

  // ---------------- Joystick Handling ----------------
  function bindJoystick() {
    var zone = document.getElementById('touch-joystick-zone');
    if (!zone) return;

    function handleJoystickMove(clientX, clientY) {
      if (!joystickBase) return;
      var rect = joystickBase.getBoundingClientRect();
      joystickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };

      var dx = clientX - joystickCenter.x;
      var dy = clientY - joystickCenter.y;
      var dist = Math.hypot(dx, dy);

      var nx = 0, ny = 0;
      if (dist > 0) {
        nx = dx / dist;
        ny = dy / dist;
      }

      var clampedDist = Math.min(dist, joystickMaxRadius);
      var knobX = nx * clampedDist;
      var knobY = ny * clampedDist;

      if (joystickKnob) {
        joystickKnob.style.transform = 'translate(' + knobX + 'px, ' + knobY + 'px)';
      }

      var fwd = -ny * (clampedDist / joystickMaxRadius);
      var strafe = -nx * (clampedDist / joystickMaxRadius);

      MC.Input.moveStick = {
        active: dist > 8,
        fwd: fwd,
        strafe: strafe
      };

      // Set digital key states as fallback
      MC.Input.keys['KeyW'] = fwd > 0.25;
      MC.Input.keys['KeyS'] = fwd < -0.25;
      MC.Input.keys['KeyA'] = strafe > 0.25;
      MC.Input.keys['KeyD'] = strafe < -0.25;
    }

    function resetJoystick() {
      joystickTouchId = null;
      if (joystickKnob) {
        joystickKnob.style.transform = 'translate(0px, 0px)';
      }
      MC.Input.moveStick = { active: false, fwd: 0, strafe: 0 };
      MC.Input.keys['KeyW'] = false;
      MC.Input.keys['KeyS'] = false;
      MC.Input.keys['KeyA'] = false;
      MC.Input.keys['KeyD'] = false;
    }

    var isMouseDragging = false;
    zone.addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      isMouseDragging = true;
      handleJoystickMove(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', function (e) {
      if (isMouseDragging) {
        e.preventDefault();
        handleJoystickMove(e.clientX, e.clientY);
      }
    });
    window.addEventListener('mouseup', function (e) {
      if (isMouseDragging) {
        isMouseDragging = false;
        resetJoystick();
      }
    });

    zone.addEventListener('touchstart', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var t = e.changedTouches[0];
      joystickTouchId = t.identifier;
      handleJoystickMove(t.clientX, t.clientY);
    }, { passive: false });

    zone.addEventListener('touchmove', function (e) {
      e.preventDefault();
      e.stopPropagation();
      for (var i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === joystickTouchId) {
          handleJoystickMove(e.touches[i].clientX, e.touches[i].clientY);
          break;
        }
      }
    }, { passive: false });

    zone.addEventListener('touchend', function (e) {
      e.preventDefault();
      e.stopPropagation();
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId) {
          resetJoystick();
          break;
        }
      }
    }, { passive: false });

    zone.addEventListener('touchcancel', function (e) {
      resetJoystick();
    }, { passive: false });
  }

  // ---------------- Right Actions & Top Buttons ----------------
  function bindActionButtons() {
    // Jump button (Double-tap in creative mode toggles flying)
    var jumpBtn = document.getElementById('btn-jump');
    if (jumpBtn) {
      function startJump(e) {
        e.preventDefault();
        e.stopPropagation();
        MC.Input.pressKey('jump');
        jumpBtn.classList.add('active');
      }
      function endJump(e) {
        e.preventDefault();
        e.stopPropagation();
        MC.Input.releaseKey('jump');
        jumpBtn.classList.remove('active');
      }
      jumpBtn.addEventListener('touchstart', startJump, { passive: false });
      jumpBtn.addEventListener('touchend', endJump, { passive: false });
      jumpBtn.addEventListener('touchcancel', endJump, { passive: false });
      jumpBtn.addEventListener('mousedown', startJump);
      jumpBtn.addEventListener('mouseup', endJump);
    }

    // Sprint toggle
    var sprintBtn = document.getElementById('btn-sprint');
    if (sprintBtn) {
      function toggleSprint(e) {
        e.preventDefault();
        e.stopPropagation();
        sprintToggled = !sprintToggled;
        if (sprintToggled) {
          MC.Input.pressKey('sprint');
          sprintBtn.classList.add('active');
        } else {
          MC.Input.releaseKey('sprint');
          sprintBtn.classList.remove('active');
        }
      }
      sprintBtn.addEventListener('touchstart', toggleSprint, { passive: false });
      sprintBtn.addEventListener('click', toggleSprint);
    }

    // Sneak toggle
    var sneakBtn = document.getElementById('btn-sneak');
    if (sneakBtn) {
      function toggleSneak(e) {
        e.preventDefault();
        e.stopPropagation();
        sneakToggled = !sneakToggled;
        if (sneakToggled) {
          MC.Input.pressKey('sneak');
          sneakBtn.classList.add('active');
        } else {
          MC.Input.releaseKey('sneak');
          sneakBtn.classList.remove('active');
        }
      }
      sneakBtn.addEventListener('touchstart', toggleSneak, { passive: false });
      sneakBtn.addEventListener('click', toggleSneak);
    }

    // Top Bar - Camera / Perspective (F5)
    var camBtn = document.getElementById('tb-cam');
    if (camBtn) {
      function triggerCam(e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.gameInstance) {
          window.gameInstance.perspective = (window.gameInstance.perspective + 1) % 3;
        }
      }
      camBtn.addEventListener('touchstart', triggerCam, { passive: false });
      camBtn.addEventListener('click', triggerCam);
    }

    // Top Bar - Chat
    var chatBtn = document.getElementById('tb-chat');
    if (chatBtn) {
      function triggerChat(e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.gameInstance && window.gameInstance.chat) {
          window.gameInstance.chat.openChat('');
          focusKb();
        }
      }
      chatBtn.addEventListener('touchstart', triggerChat, { passive: false });
      chatBtn.addEventListener('click', triggerChat);
    }

    // Top Bar - Pause / Menu
    var pauseBtn = document.getElementById('tb-pause');
    if (pauseBtn) {
      function triggerPause(e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.gameInstance) {
          if (window.gameInstance.screen) window.gameInstance.closeScreen();
          else window.gameInstance.openScreen(new MC.Screens.PauseScreen(window.gameInstance));
        }
      }
      pauseBtn.addEventListener('touchstart', triggerPause, { passive: false });
      pauseBtn.addEventListener('click', triggerPause);
    }

    // Inventory Button (...)
    var invBtn = document.getElementById('tb-inv');
    if (invBtn) {
      function triggerInv(e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.gameInstance && window.gameInstance.player) {
          var p = window.gameInstance.player;
          if (window.gameInstance.screen) window.gameInstance.closeScreen();
          else window.gameInstance.openScreen(p.isCreative() ? new MC.Inventory.Screens.CreativeScreen(window.gameInstance, window.gameInstance.lastCreativeTab || 2) : new MC.Inventory.Screens.InventoryScreen(window.gameInstance));
        }
      }
      invBtn.addEventListener('touchstart', triggerInv, { passive: false });
      invBtn.addEventListener('click', triggerInv);
    }

    // Attack / Mine Button (Sword)
    var attackBtn = document.getElementById('btn-attack');
    if (attackBtn) {
      function startAttack(e) {
        e.preventDefault();
        e.stopPropagation();
        attackBtn.classList.add('active');
        var g = window.gameInstance;
        if (!g || !g.player) return;
        var p = g.player;

        if (p.targetMob) {
          attackMob(p.targetMob);
          return;
        }

        if (p.target) {
          if (p.isCreative()) {
            p.breakBlock(p.target, p.held());
            p.swingArm();
          } else {
            startMining(p.target);
          }
          return;
        }

        p.swingArm();
      }

      function endAttack(e) {
        e.preventDefault();
        e.stopPropagation();
        attackBtn.classList.remove('active');
        if (isMining) {
          stopMining();
        }
      }

      attackBtn.addEventListener('touchstart', startAttack, { passive: false });
      attackBtn.addEventListener('touchend', endAttack, { passive: false });
      attackBtn.addEventListener('touchcancel', endAttack, { passive: false });
      attackBtn.addEventListener('mousedown', startAttack);
      attackBtn.addEventListener('mouseup', endAttack);
    }

    // Interact / Use / Place Button (Hand)
    var interactBtn = document.getElementById('btn-interact');
    if (interactBtn) {
      function triggerInteract(e) {
        e.preventDefault();
        e.stopPropagation();
        interactBtn.classList.add('active');
        setTimeout(function () { interactBtn.classList.remove('active'); }, 120);

        var g = window.gameInstance;
        if (!g || !g.player) return;
        var p = g.player;
        var held = p.held();

        if (p.targetMob && MC.Mobs && MC.Mobs.interact(p.targetMob, p, held)) {
          p.swingArm();
          return;
        }

        if (held && MC.ITEMS[held.id] && MC.ITEMS[held.id].food && (p.hunger < 20 || p.isCreative())) {
          p.eat(held);
          if (!p.isCreative()) p.inventory.take(p.selected, 1);
          MC.Audio.play('player.burp');
          p.swingArm();
          return;
        }

        if (p.target) {
          p.useOnBlock(p.target, held);
          p.swingArm();
          return;
        }

        p.swingArm();
      }

      interactBtn.addEventListener('touchstart', triggerInteract, { passive: false });
      interactBtn.addEventListener('click', triggerInteract);
    }
  }

  // ---------------- Tap Anywhere on Screen (Look, Tap to Place/Attack, Hold to Mine) ----------------
  function bindScreenTouch() {
    var gameCanvas = document.getElementById('game') || document.body;

    window.addEventListener('touchstart', function (e) {
      if (!enabled || !touchActive) return;
      var g = window.gameInstance;

      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        var target = t.target;

        // Skip if touching overlay buttons or joystick
        if (target && target.closest && (target.closest('#touch-overlay button') || target.closest('.touch-joystick-zone'))) {
          continue;
        }

        var px = t.clientX;
        var py = t.clientY;

        // If in GUI / menu or chat screen -> forward to GUI clicks
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

        // Gameplay: check if tapping hotbar slots (bottom center)
        if (g && g.state === 'playing' && g.player && !g.screen) {
          var S = (MC.Gui && MC.Gui.S) || 2;
          var W = (MC.Gui && MC.Gui.W) || Math.ceil(window.innerWidth / S);
          var H = (MC.Gui && MC.Gui.H) || Math.ceil(window.innerHeight / S);
          var hx = (Math.floor(W / 2) - 91) * S;
          var hy = (H - 22) * S;
          var hw = 182 * S;

          if (px >= hx - 10 && px <= hx + hw + 10 && py >= hy - 14) {
            var slot = Math.floor((px - hx) / (20 * S));
            if (slot >= 0 && slot < 9) {
              g.player.selected = slot;
              MC.Audio.play('ui.click', { volume: 0.25 });
              e.preventDefault();
              continue;
            }
          }
        }

        // World touch: camera look / tap to interact / hold to mine
        if (screenTouchId === null && g && g.state === 'playing' && g.player && g.world && g.camera) {
          screenTouchId = t.identifier;
          screenStartX = px;
          screenStartY = py;
          lastLookX = px;
          lastLookY = py;
          touchStartTime = performance.now();
          hasMoved = false;

          // Raycast from touch screen coordinates
          var rayDir = getScreenRayDir(g.camera, px, py);
          var eye = g.player.getEyePos(1);
          var hit = g.world.raycast(eye, rayDir, g.player.reach, false);
          var mob = MC.Mobs ? MC.Mobs.pick(eye, rayDir, hit ? hit.dist : 3.5) : null;

          // If block hit without mob, prepare hold-to-mine timer (200ms)
          if (hit && !mob) {
            if (holdTimer) clearTimeout(holdTimer);
            holdTimer = setTimeout(function () {
              if (!hasMoved && screenTouchId !== null) {
                startMining(hit);
              }
            }, 200);
          }
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

        // World touch move
        if (t.identifier === screenTouchId) {
          var distMoved = Math.hypot(t.clientX - screenStartX, t.clientY - screenStartY);
          if (distMoved > 8) {
            hasMoved = true;
            if (holdTimer) {
              clearTimeout(holdTimer);
              holdTimer = null;
            }
            if (isMining) {
              stopMining();
            }
          }

          // Camera rotation
          var dx = t.clientX - lastLookX;
          var dy = t.clientY - lastLookY;
          lastLookX = t.clientX;
          lastLookY = t.clientY;

          MC.Input.mouse.dx += dx * 1.6;
          MC.Input.mouse.dy += dy * 1.6;
        }
      }
    }, { passive: false });

    function onTouchEnd(e) {
      if (!enabled || !touchActive) return;
      var g = window.gameInstance;

      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];

        // GUI mouse up
        if (g && (g.screen || g.chat.open || g.state !== 'playing')) {
          e.preventDefault();
          var r = gameCanvas.getBoundingClientRect();
          var mx = t.clientX - r.left;
          var my = t.clientY - r.top;
          MC.Input.mouse.buttons &= ~1;
          MC.Input.mouse.clicks.push({ button: 0, x: mx, y: my, down: false });
        }

        // World touch end
        if (t.identifier === screenTouchId) {
          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }

          if (isMining) {
            stopMining();
          } else if (!hasMoved && g && g.state === 'playing' && g.player && g.world && g.camera) {
            // TAP ACTION: Interact, Place block, Attack mob, or Eat
            executeTap(t.clientX, t.clientY);
          }

          screenTouchId = null;
        }
      }
    }

    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchEnd, { passive: false });
  }

  function attackMob(mob) {
    var g = window.gameInstance;
    if (!g || !g.player) return;
    var p = g.player;
    var held = p.held();
    p.swingArm();
    var dmg = 1;
    if (held && MC.ITEMS[held.id] && MC.ITEMS[held.id].tool) dmg = MC.ITEMS[held.id].tool.damage;
    else if (held && MC.ITEMS[held.id].block >= 0) dmg = 1;
    var crit = p.fallDist > 0 && !p.onGround && !p.inWater;
    if (crit) dmg *= 1.5;
    mob.hurt(dmg, 'player', p.pos, p.sprinting ? 0.9 : 0.5);
    MC.Audio.play(crit ? 'player.attack.sweep' : 'player.attack');
    if (held && MC.ITEMS[held.id].tool) p.damageItem(p.selected, held.id === 'shears' ? 0 : 1);
    p.addExhaustion(0.1);
  }

  function executeTap(clientX, clientY) {
    var g = window.gameInstance;
    if (!g || !g.player || !g.world || !g.camera) return;
    var p = g.player;

    var rayDir = getScreenRayDir(g.camera, clientX, clientY);
    var eye = p.getEyePos(1);
    var hit = g.world.raycast(eye, rayDir, p.reach, false);
    var mob = MC.Mobs ? MC.Mobs.pick(eye, rayDir, hit ? hit.dist : 3.5) : null;
    var held = p.held();

    // 1. Attack Mob
    if (mob) {
      attackMob(mob);
      return;
    }

    // 2. Interact with Block or Place Item
    if (hit) {
      // Eat food if holding food and hungry
      if (held && MC.ITEMS[held.id] && MC.ITEMS[held.id].food && (p.hunger < 20 || p.isCreative())) {
        p.eat(held);
        if (!p.isCreative()) p.inventory.take(p.selected, 1);
        MC.Audio.play('player.burp');
        p.swingArm();
        return;
      }

      // Interact with block (door, chest, furnace, crafting table, bed) or place block
      p.useOnBlock(hit, held);
      p.swingArm();
      return;
    }

    // 3. Tap empty air -> Swing arm
    p.swingArm();
  }

  function startMining(hit) {
    var g = window.gameInstance;
    if (!g || !g.player) return;
    isMining = true;
    miningTarget = hit;
    miningProgress = 0;
    miningSoundTimer = 0.2;
    g.player.touchTarget = hit;
  }

  function stopMining() {
    var g = window.gameInstance;
    isMining = false;
    miningTarget = null;
    miningProgress = 0;
    if (g && g.player) {
      g.player.touchTarget = null;
      g.player.mining.target = null;
      g.player.mining.progress = 0;
    }
    if (g && g.breakMesh) {
      g.breakMesh.visible = false;
    }
  }

  function updateMining(dt) {
    var g = window.gameInstance;
    if (!isMining || !miningTarget || !g || !g.player || !g.world) return;
    var p = g.player;

    var currentId = g.world.getBlock(miningTarget.x, miningTarget.y, miningTarget.z);
    if (currentId <= 0 || currentId !== miningTarget.id) {
      stopMining();
      return;
    }

    var B = MC.BLOCKS[miningTarget.id];
    var held = p.held();

    // Creative mode instant break
    if (p.isCreative()) {
      p.breakBlock(miningTarget, held);
      stopMining();
      return;
    }

    // Bedrock or unbreakable
    if (B.hardness < 0) {
      return;
    }

    var breakTime = p.breakTime(B, held);
    miningProgress += dt / breakTime;
    p.mining.progress = miningProgress;
    p.mining.target = miningTarget;
    p.touchTarget = miningTarget;

    // Crack stage update
    var stage = Math.min(9, Math.floor(miningProgress * 10));
    if (g.breakMesh && g.breakGeos && g.breakGeos[stage]) {
      g.breakMesh.geometry = g.breakGeos[stage];
      g.breakMesh.visible = true;
      g.breakMesh.position.set(miningTarget.x + 0.5, miningTarget.y + 0.5, miningTarget.z + 0.5);
    }

    // Hit sounds & particles every 0.25s
    miningSoundTimer += dt;
    if (miningSoundTimer >= 0.25) {
      miningSoundTimer = 0;
      MC.Audio.play('step.' + (B.sound === 'none' ? 'stone' : B.sound), { volume: 0.3, pitch: 0.5 });
      MC.Particles.blockHit(miningTarget.x, miningTarget.y, miningTarget.z, miningTarget.face, miningTarget.id);
      p.swingArm();
    }

    // Finished breaking
    if (miningProgress >= 1) {
      p.breakBlock(miningTarget, held);
      miningProgress = 0;
      p.mining.progress = 0;
      p.mining.target = null;
      if (g.breakMesh) g.breakMesh.visible = false;

      // Continue mining next block along line of sight if still holding
      var rayDir = getScreenRayDir(g.camera, lastLookX, lastLookY);
      var eye = p.getEyePos(1);
      var nextHit = g.world.raycast(eye, rayDir, p.reach, false);
      if (nextHit) {
        miningTarget = nextHit;
        p.touchTarget = nextHit;
      } else {
        stopMining();
      }
    }
  }

  function updateVisibility() {
    if (!overlay) return;
    var g = window.gameInstance;
    var shouldShow = enabled && touchActive && g && g.state === 'playing' && !g.screen;
    overlay.style.display = shouldShow ? 'block' : 'none';
  }

  // Update check every frame
  function update(dt) {
    updateVisibility();

    // Position "..." inventory button right next to the hotbar
    var invBtn = document.getElementById('tb-inv');
    var g = window.gameInstance;
    if (invBtn && g && g.state === 'playing' && !g.screen) {
      var S = (MC.Gui && MC.Gui.S) || 2;
      var W = (MC.Gui && MC.Gui.W) || Math.ceil(window.innerWidth / S);
      var H = (MC.Gui && MC.Gui.H) || Math.ceil(window.innerHeight / S);
      var hotbarRight = (Math.floor(W / 2) + 91) * S;
      var btnSize = 22 * S;
      invBtn.style.left = (hotbarRight + 4) + 'px';
      invBtn.style.bottom = '0px';
      invBtn.style.width = (btnSize + 2) + 'px';
      invBtn.style.height = btnSize + 'px';
    }

    if (dt && isMining) {
      updateMining(dt);
    }
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
