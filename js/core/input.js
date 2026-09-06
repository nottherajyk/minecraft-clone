// Keyboard / mouse / pointer-lock input. Exposes injectMouse for the headless harness.
(function () {
  var keys = {}, pressed = {}, released = {};
  var mouse = { x: 0, y: 0, dx: 0, dy: 0, buttons: 0, wheel: 0, clicks: [], locked: false, moved: false };
  var textTarget = null; // callback receiving typed characters when a text field is focused
  var canvas = null;
  var BIND = {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', sneak: 'ShiftLeft', sprint: 'ControlLeft',
    inventory: 'KeyE', drop: 'KeyQ', chat: 'KeyT', command: 'Slash', debug: 'F3', hideGui: 'F1', perspective: 'F5', fullscreen: 'F11', swapHands: 'KeyF', pickBlock: 'MouseMiddle'
  };
  function init(cv) {
    canvas = cv;
    window.addEventListener('keydown', function (e) {
      if (e.code === 'F11' || e.code === 'F3' || e.code === 'F1' || e.code === 'F5' || e.code === 'Tab' || e.code === 'Slash' && !textTarget) e.preventDefault();
      if (textTarget) {
        if (e.key === 'Backspace') textTarget('\b'); else if (e.key === 'Enter') textTarget('\n'); else if (e.key === 'Escape') textTarget('\x1b');
        else if (e.key === 'ArrowLeft') textTarget('\x11'); else if (e.key === 'ArrowRight') textTarget('\x12'); else if (e.key === 'ArrowUp') textTarget('\x13'); else if (e.key === 'ArrowDown') textTarget('\x14');
        else if (e.key === 'Tab') textTarget('\t');
        else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) textTarget(e.key);
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { for (var i = 0; i < t.length; i++) textTarget(t[i]); }).catch(function () { }); }
        if (e.code !== 'Escape' && e.code !== 'F11') { e.preventDefault(); return; }
      }
      if (!keys[e.code]) pressed[e.code] = true;
      keys[e.code] = true;
      if (e.code === 'Space' || (e.code.indexOf('Arrow') === 0)) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; released[e.code] = true; });
    window.addEventListener('blur', function () { for (var k in keys) keys[k] = false; mouse.buttons = 0; });
    document.addEventListener('mousemove', function (e) {
      if (mouse.locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
      var r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.moved = true;
    });
    document.addEventListener('mousedown', function (e) {
      mouse.buttons |= (1 << e.button);
      var r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      mouse.clicks.push({ button: e.button, x: mouse.x, y: mouse.y, down: true });
      if (e.button === 1) e.preventDefault();
    });
    document.addEventListener('mouseup', function (e) { mouse.buttons &= ~(1 << e.button); mouse.clicks.push({ button: e.button, x: mouse.x, y: mouse.y, down: false }); });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('wheel', function (e) { mouse.wheel += e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0); if (mouse.locked) e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', function () { mouse.locked = document.pointerLockElement === canvas; if (!mouse.locked) MC.Input.onUnlock && MC.Input.onUnlock(); });
    document.addEventListener('pointerlockerror', function () { mouse.locked = false; });
  }
  function lock() {
    if (!canvas || mouse.locked) return;
    try {
      var p = canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(function () { try { var q = canvas.requestPointerLock(); if (q && q.catch) q.catch(function () { }); } catch (e) { } });
    } catch (e) { try { var q2 = canvas.requestPointerLock(); if (q2 && q2.catch) q2.catch(function () { }); } catch (e2) { } }
  }
  function unlock() { if (document.exitPointerLock && mouse.locked) document.exitPointerLock(); }
  function down(action) { var code = BIND[action] || action; return !!keys[code]; }
  function wasPressed(action) { var code = BIND[action] || action; return !!pressed[code]; }
  function endFrame() { pressed = {}; released = {}; mouse.dx = 0; mouse.dy = 0; mouse.wheel = 0; mouse.clicks.length = 0; mouse.moved = false; }
  function injectMouse(dx, dy) { mouse.dx += dx; mouse.dy += dy; }
  function setTextTarget(fn) { textTarget = fn; }
  MC.Input = { init: init, lock: lock, unlock: unlock, down: down, pressed: wasPressed, keys: keys, mouse: mouse, endFrame: endFrame, injectMouse: injectMouse, setTextTarget: setTextTarget, BIND: BIND, onUnlock: null,
    get locked() { return mouse.locked; }, simulateLock: false };
})();
