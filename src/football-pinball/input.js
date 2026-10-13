export function bindInputs(root, engine, allowed) {
  const abort = new AbortController(), options = { signal: abort.signal };
  const keys = { ArrowLeft: 'blue-left', ArrowRight: 'blue-right', KeyA: 'blue-left', KeyD: 'blue-right', KeyJ: 'red-left', KeyL: 'red-right' };
  const held = new Map();
  const update = id => {
    const down = [...held.values()].includes(id);
    engine.setInput(id, down);
    root.querySelector(`[data-boot="${id}"]`)?.setAttribute('aria-pressed', String(down));
  };
  const release = token => { const id = held.get(token); held.delete(token); if (id) update(id); };
  const press = (token, id) => { if (!allowed() || !root.querySelector(`[data-boot="${id}"]`)) return; held.set(token, id); update(id); };
  function clear() {
    held.clear(); engine.releaseInputs();
    root.querySelectorAll('[data-boot]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  }
  root.querySelectorAll('[data-boot]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      press(`p${event.pointerId}`, button.dataset.boot);
    }, options);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(name, event => release(`p${event.pointerId}`), options);
    }
    button.addEventListener('contextmenu', event => event.preventDefault(), options);
    button.addEventListener('keydown', event => {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault(); press(`button-${event.code}`, button.dataset.boot);
      }
    }, options);
    button.addEventListener('keyup', event => release(`button-${event.code}`), options);
    button.addEventListener('blur', clear, options);
  });
  window.addEventListener('keydown', event => {
    if (keys[event.code] && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) {
      event.preventDefault(); press(event.code, keys[event.code]);
    }
  }, options);
  window.addEventListener('keyup', event => release(event.code), options);
  window.addEventListener('blur', clear, options);
  return { clear, dispose() { clear(); abort.abort(); } };
}
