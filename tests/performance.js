// Real-browser engineering regressions only; not product VIS/FLOW or a speed claim.
window.runMotionIndexPerformanceRegression = async function () {
  const results = [], check = (name, pass, actual) => results.push({ name, pass: !!pass, actual });
  const microtasks = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); };
  const hooks = {}; plugin.apply({ effect(fn, name) { hooks[name] = fn; } });
  const native = document.createElement('style'), extras = [], instruments = [];
  native.dataset.pluginCss = '@deepseek-ai/dsh-client-ui-fixture/Performance.module.css';
  native.textContent = '.Perf_surface{width:160px;height:40px;background:rgb(30,30,30)}';
  document.head.append(native);
  const getter = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'cssRules').get;
  const savedMedia = window.matchMedia, signalQuery = '(min-width: 1px)', signalMedia = savedMedia.call(window, signalQuery), listeners = new Set();
  let reads = 0, defaults, hover, popup;
  // Instrument only exact fixture objects, not global CSS/geometry APIs.
  function replaceMethod(target, key, fn) {
    const saved = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, value: fn });
    instruments.push(() => { if (saved) Object.defineProperty(target, key, saved); else delete target[key]; });
  }
  const add = signalMedia.addEventListener, remove = signalMedia.removeEventListener;
  replaceMethod(signalMedia, 'addEventListener', function (type, listener, ...args) { if (type === 'change') listeners.add(listener); return add.call(this, type, listener, ...args); });
  replaceMethod(signalMedia, 'removeEventListener', function (type, listener, ...args) { if (type === 'change') listeners.delete(listener); return remove.call(this, type, listener, ...args); });
  window.matchMedia = text => text.replace(/\s/g, '') === signalQuery.replace(/\s/g, '') ? signalMedia : savedMedia.call(window, text);
  function track(sheet = native.sheet, onRead = () => { reads++; }) {
    const saved = Object.getOwnPropertyDescriptor(sheet, 'cssRules');
    Object.defineProperty(sheet, 'cssRules', { configurable: true, get() { onRead(); return getter.call(this); } });
    instruments.push(() => { if (saved) Object.defineProperty(sheet, 'cssRules', saved); else delete sheet.cssRules; });
  }
  function change(css) { native.textContent += css; track(); }
  function remountPopup() { if (popup) popup(); popup = hooks['fan-de-hai: footer-popup-motion'](); }
  const menu = document.createElement('div'); menu.className = 'Perf_surface'; menu.setAttribute('role', 'menu'); menu.textContent = 'Fixture surface';
  try {
    track(); defaults = hooks['fanframe: default-control-motion'](); hover = hooks['fanframe: hover-feedback']();
    await settle(); let before = reads;
    const ownDefault = document.querySelector('[data-fan-default-motion]'), ownHover = document.querySelector('[data-fan-hover-feedback]');
    ownDefault.textContent += '\n/* owned output edit */'; ownHover.textContent += '\n/* owned hover edit */'; await settle();
    check('pure edits of either exact output do not rescan input rules', reads === before, { before, reads });
    document.body.append(menu); change('\n.Perf_late{transition:height .2s}'); before = reads;
    // No microtask yield: readMotionIndex must drain pending head records itself.
    remountPopup(); const synchronous = reads;
    check('a native surface consumes new rules before observer delivery', synchronous === before + 1 && menu.hasAttribute('data-fan-default-surface'), { before, synchronous });
    await settle();
    check('observer delivery and queued CSS reuse the synchronous parse', reads === synchronous, { synchronous, reads });
    change('\n.Perf_second{transition:opacity .3s}'); await microtasks(); remountPopup();
    before = reads; change('\n.Perf_third{transition:transform .4s}'); await microtasks(); await settle();
    check('a second invalidation after sync consumption still rebuilds', reads === before + 1, { before, reads });
    const late = document.createElement('style'); late.dataset.pluginCss = '@deepseek-ai/dsh-client-ui-fixture/LatePerformance.module.css'; late.textContent = '.Perf_mixed{transition:height .7s}'; extras.push(late);
    const fragment = document.createDocumentFragment(); fragment.append(ownHover, late); before = reads; document.head.append(fragment); await settle();
    check('mixed owned/external head changes retain invalidation', reads === before + 1 && ownDefault.textContent.includes('.Perf_mixed'), { before, reads });
    const lookalike = document.createElement('style'); lookalike.setAttribute('data-fan-default-motion', ''); lookalike.textContent = '.Perf_lookalike{transition:height .8s}'; extras.push(lookalike);
    let lookalikeReads = 0; document.head.append(lookalike); track(lookalike.sheet, () => { lookalikeReads++; }); await settle();
    check('the unregistered lookalike itself is parsed and protected', lookalikeReads === 1 && ownDefault.textContent.includes('.Perf_lookalike'), { lookalikeReads });
    native.sheet.disabled = true; remountPopup(); await settle();
    check('CSSOM disabled metadata detected by a consumer also updates output CSS', !ownDefault.textContent.includes('.Perf_late'), ownDefault.textContent.includes('.Perf_late'));
    native.sheet.disabled = false; remountPopup(); await settle();
    check('CSSOM re-enable restores the current ownership CSS', ownDefault.textContent.includes('.Perf_late'));
    change('\n@media ' + signalQuery + '{.Perf_media{transition:height .6s}}'); remountPopup();
    check('sync consumption subscribes to a new media query before its CSS frame', listeners.size === 1, listeners.size);
    before = reads;
    // Synthetic delivery tests the subscription window, not native media matching.
    // default-ownership.js separately exercises real iframe-width media changes.
    signalMedia.dispatchEvent(new Event('change')); await settle();
    check('a media event in that window invalidates the sync parse', reads === before + 1 && listeners.size === 1, { before, reads, listeners: listeners.size });
    popup(); popup = null; menu.remove(); hover(); hover = null; await settle();
    change('\n.Perf_pending{transition:width .9s}'); await microtasks(); before = reads;
    defaults(); defaults = null; signalMedia.dispatchEvent(new Event('change')); await settle();
    check('unload cancels queued work and removes media subscriptions', reads === before && listeners.size === 0 && !ownDefault.isConnected && !ownHover.isConnected, { before, reads, listeners: listeners.size });
  } catch (error) { check('unexpected performance fixture exception', false, error.stack); }
  finally {
    if (popup) popup(); if (hover) hover(); if (defaults) defaults();
    window.matchMedia = savedMedia; instruments.reverse().forEach(restore => restore());
    native.remove(); extras.forEach(node => node.remove()); menu.remove();
  }
  return { passed: results.filter(result => result.pass).length, total: results.length, results };
};

window.runCardBatchPerformanceRegression = async function () {
  const results = [], check = (name, pass, actual) => results.push({ name, pass: !!pass, actual });
  const microtasks = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
  const hooks = {}; plugin.apply({ effect(fn, name) { hooks[name] = fn; } });
  const savedMedia = window.matchMedia, savedResize = window.ResizeObserver;
  const media = new EventTarget(); media.matches = false; window.matchMedia = () => media;
  window.ResizeObserver = undefined;
  const flow = document.createElement('div'); flow.dataset.chatFlow = ''; flow.style.cssText = 'width:400px;height:200px;overflow:auto;overflow-anchor:none';
  document.body.append(flow); let dispose, serial = 0;
  function card(open = true) {
    const root = document.createElement('section'), id = 'perf-card-body-' + (++serial); root.dataset.turnTrigger = '';
    root.style.cssText = 'box-sizing:content-box;border:1px solid transparent;padding:4px';
    root.innerHTML = '<button aria-expanded="' + open + '" aria-controls="' + id + '" style="display:block;width:100%;height:32px;border:0;padding:0">Fixture</button>';
    if (open) { const body = document.createElement('div'); body.id = id; body.style.height = '160px'; root.append(body); }
    return root;
  }
  try {
    const initial = card(); flow.append(initial); const height = initial.getBoundingClientRect().height;
    dispose = hooks['fan-de-hai: card-disclosure-motion']();
    initial.firstElementChild.setAttribute('aria-expanded', 'false'); initial.lastElementChild.remove(); await microtasks();
    let animation = initial.getAnimations()[0]; if (animation) { animation.pause(); animation.currentTime = 0; }
    check('initial programmatic close retains height and inset without RO', !!animation && Math.abs(parseFloat(animation.effect.getKeyframes()[0].height) + 10 - height) < .5, { height, from: animation?.effect.getKeyframes()[0].height });
    check('first close does not retain the removed React body', initial.children.length === 1 && initial.firstElementChild.getAttribute('aria-expanded') === 'false');
    if (animation) { animation.finish(); await microtasks(); }
    if (typeof savedResize !== 'function') throw Error('The dynamic-before-RO fixture requires real Chromium ResizeObserver');
    let deliveries = 0;
    window.ResizeObserver = function (callback) { return new savedResize((entries, observer) => { deliveries++; callback(entries, observer); }); };
    const inserted = card(); flow.append(inserted); await microtasks();
    const insertedHeight = inserted.getBoundingClientRect().height; flow.scrollTop = flow.scrollHeight; const scroll = flow.scrollTop;
    inserted.firstElementChild.setAttribute('aria-expanded', 'false'); inserted.lastElementChild.remove(); await microtasks();
    animation = inserted.getAnimations()[0]; if (animation) { animation.pause(); animation.currentTime = 0; }
    check('a dynamically batched card closes before its first real RO callback', deliveries === 0 && !!animation && Math.abs(parseFloat(animation.effect.getKeyframes()[0].height) + 10 - insertedHeight) < .5, { deliveries, insertedHeight, from: animation?.effect.getKeyframes()[0].height });
    check('that programmatic close preserves the existing scroll range', !!animation && flow.scrollTop === scroll, { scroll, after: flow.scrollTop });
    if (animation) { animation.finish(); await microtasks(); }
    const wrapper = document.createElement('div'), added = card(false), span = document.createElement('span'), scans = new Map();
    for (const node of [wrapper, added, span]) {
      scans.set(node, 0); const query = node.querySelectorAll;
      node.querySelectorAll = function (selector) { if (selector.startsWith('section[data-turn-trigger]')) scans.set(node, scans.get(node) + 1); return query.call(this, selector); };
    }
    flow.append(wrapper); wrapper.append(added); added.append(span); await microtasks();
    check('overlapping candidates scan only the outer subtree, not descendants', scans.get(wrapper) === 1 && scans.get(added) === 0 && scans.get(span) === 0, Array.from(scans.values()));
    const late = document.createElement('div'); flow.append(late); await microtasks();
    late.innerHTML = '<div data-disclosure-header style="height:24px"><button aria-expanded="false">Late header</button></div>'; await microtasks();
    const lateButton = late.querySelector('button'), body = document.createElement('div'); body.style.height = '80px';
    lateButton.setAttribute('aria-expanded', 'true'); late.append(body); await microtasks(); animation = late.getAnimations()[0];
    check('direct-parent discovery still mounts a late-header shell', !!animation, late.getAnimations().length);
    if (animation) { animation.finish(); await microtasks(); }
    late.remove(); await microtasks();
    check('removal disposes card motion and temporary properties', late.getAnimations().length === 0 && !late.style.height && !late.style.overflow, late.style.cssText);
    flow.append(late); await microtasks(); lateButton.setAttribute('aria-expanded', 'false'); body.remove(); await microtasks();
    check('a separately reinserted root remounts once and closes normally', late.getAnimations().length === 1, late.getAnimations().length);
    dispose(); dispose = null;
    check('unload cancels reinserted-root motion and restores styles', late.getAnimations().length === 0 && !late.style.height && !late.style.overflow, late.style.cssText);
  } catch (error) { check('unexpected card-batch fixture exception', false, error.stack); }
  finally { if (dispose) dispose(); flow.remove(); window.matchMedia = savedMedia; window.ResizeObserver = savedResize; }
  return { passed: results.filter(result => result.pass).length, total: results.length, results };
};
