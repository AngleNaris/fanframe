window.runCardMotionRegression = async function () {
  const results = [];
  const check = (name, pass, actual) => results.push({name, pass: !!pass, actual});
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  const effects = {};
  plugin.apply({effect(fn, name) { effects[name] = fn; }});
  const root = document.createElement('section');
  root.dataset.turnTrigger = 'true';
  root.style.cssText = 'width:300px;box-sizing:content-box;border:1px solid transparent;padding:4px;overflow:visible!important';
  root.innerHTML = '<button aria-expanded="false" aria-controls="card-fixture-body" style="display:block;height:32px;width:100%;padding:0;border:0">Subtask message</button>';
  const button = root.firstElementChild;
  const body = document.createElement('div'); body.id = 'card-fixture-body'; body.style.height = '120px'; body.textContent = 'Message';
  const other = root.cloneNode(true); other.removeAttribute('data-turn-trigger');
  document.body.append(root, other);
  const originalMedia = window.matchMedia;
  const media = new EventTarget(); media.matches = false;
  window.matchMedia = () => media;
  let dispose;
  function toggle(open) { button.setAttribute('aria-expanded', String(open)); if (open) root.append(body); else body.remove(); }
  try {
    dispose = effects['fan-de-hai: card-disclosure-motion']();
    const collapsed = root.getBoundingClientRect().height;
    toggle(true); await flush();
    let animation = root.getAnimations()[0];
    check('conditional insert starts expansion', !!animation, root.getAnimations().length);
    animation.pause(); animation.currentTime = 90;
    const middle = root.getBoundingClientRect().height;
    check('expansion interpolates actual geometry', middle > collapsed + 1 && middle < collapsed + 119, {collapsed, middle});
    toggle(false); await flush();
    let closing = root.getAnimations()[0];
    const inset = 10;
    check('closing reverses from current geometry', !!closing && Math.abs(parseFloat(closing.effect.getKeyframes()[0].height) + inset - middle) < 1, closing && closing.effect.getKeyframes()[0].height);
    check('React body stays removed during close', !body.isConnected && button.getAttribute('aria-expanded') === 'false', body.isConnected);
    check('canceled opening cannot finish closing', root.getAnimations().length === 1, root.getAnimations().length);
    closing.finish(); await flush();
    check('close finishes at original height', Math.abs(root.getBoundingClientRect().height - collapsed) < 1, root.getBoundingClientRect().height);
    check('temporary styles restored with priority', root.style.getPropertyValue('overflow-y') === 'visible' && root.style.getPropertyPriority('overflow-y') === 'important', root.style.cssText);
    toggle(true); await flush(); root.getAnimations()[0].finish(); await flush();
    check('open settles to natural content height', root.getAnimations().length === 0 && Math.abs(root.getBoundingClientRect().height - collapsed - 120) < 0.5, root.getBoundingClientRect().height);
    toggle(false); await flush(); media.matches = true; media.dispatchEvent(new Event('change')); await flush();
    check('reduced-motion change cancels in-flight animation', root.getAnimations().length === 0, root.getAnimations().length);
    toggle(true); await flush(); check('reduced motion keeps native toggle instant', root.getAnimations().length === 0 && body.isConnected, root.getAnimations().length);
    media.matches = false;
    other.firstElementChild.setAttribute('aria-expanded', 'true'); other.append(body.cloneNode(true)); await flush();
    check('unrelated cards remain untouched', other.getAnimations().length === 0 && other.style.overflow === 'visible', other.getAnimations().length);
    toggle(false); await flush(); dispose(); dispose = null; await flush();
    check('unload cancels motion without altering state', root.getAnimations().length === 0 && !body.isConnected && button.getAttribute('aria-expanded') === 'false', root.getAnimations().length);
  } catch (e) { check('unexpected exception', false, e.stack); }
  finally { if (dispose) dispose(); root.remove(); other.remove(); window.matchMedia = originalMedia; }
  return {passed: results.filter(r => r.pass).length, total: results.length, results};
};

window.runToolCardMotionRegression = async function () {
  const results = [], roots = [];
  const check = (name, pass, actual) => results.push({name, pass: !!pass, actual});
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  const effects = {}; plugin.apply({effect(fn, name) { effects[name] = fn; }});
  const originalMedia = window.matchMedia;
  const media = new EventTarget(); media.matches = false; window.matchMedia = () => media;
  let dispose;
  try {
    dispose = effects['fan-de-hai: card-disclosure-motion']();
    for (const name of ['todo_write', 'create_goal', 'update_goal', 'get_goal', 'subagent', 'subagent_role']) {
      const root = document.createElement('div'); root.dataset.tool = name;
      root.style.cssText = 'display:flex;flex-direction:column;width:320px';
      // Mirror DisclosureRow nesting; the header can arrive after the root.
      document.body.append(root); roots.push(root); await flush();
      root.innerHTML = '<div><div data-disclosure-row="true" aria-expanded="false" style="height:24px">Tool header</div></div>';
      await flush();
      const wrapper = root.firstElementChild, header = wrapper.firstElementChild;
      const body = document.createElement('div'); body.style.height = '100px'; body.textContent = 'Details';
      header.setAttribute('aria-expanded', 'true'); wrapper.append(body); await flush();
      let animation = root.getAnimations()[0];
      check(name + ' nested late header expands', !!animation, root.getAnimations().length);
      animation.finish(); await flush();
      check(name + ' settles to natural expanded height', root.getBoundingClientRect().height === 124, root.getBoundingClientRect().height);
      header.setAttribute('aria-expanded', 'false'); body.remove(); await flush();
      animation = root.getAnimations()[0];
      check(name + ' removed body still animates shell close', !!animation && !body.isConnected, root.getAnimations().length);
      root.remove(); await flush();
      check(name + ' removal cancels motion', root.getAnimations().length === 0 && root.style.overflow === '', root.getAnimations().length);
    }
  } catch (e) { check('unexpected exception', false, e.stack); }
  finally { if (dispose) dispose(); roots.forEach(r => r.remove()); window.matchMedia = originalMedia; }
  return {passed: results.filter(r => r.pass).length, total: results.length, results};
};
