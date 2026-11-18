// Isolated browser fixture only; not product VIS/FLOW or a replacement UI.
window.runSidebarPaintRegression = async function () {
  const results = [], check = (name, pass, actual) => results.push({ name, pass: !!pass, actual });
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const flush = async () => { for (let i = 0; i < 18; i++) await Promise.resolve(); await frame(); await frame(); };
  const effects = {}; plugin.apply({ effect(fn, name) { effects[name] = fn; } });
  const sheet = document.createElement('style');
  sheet.dataset.pluginCss = '@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css';
  sheet.textContent = `
    .Edge_root{width:52px;color:rgb(240,240,240);--ds-transition-duration-fast:.1s;--ds-ease-in-out:linear}
    .Edge_panelEntry{display:flex;box-sizing:border-box;width:52px;border-inline:3px solid transparent;border-top:1px solid rgb(50,60,70);border-bottom:2px solid rgb(70,80,90)}
    .Edge_panelEntry:hover,.Edge_panelEntry:has(:focus-visible){background-color:rgb(50,50,50)}
    .Edge_panelRow{box-sizing:border-box;width:36px;height:36px;border:0;border-inline:3px solid transparent;color:inherit;background:transparent}
    .Edge_panelRow:hover{background-color:rgb(50,50,50)}
    .Edge_collapsed .Edge_panelEntry,.Edge_collapsed .Edge_panelRow{border-inline:0}`;
  document.head.append(sheet);
  const root = document.createElement('div'); root.className = 'Edge_root Edge_collapsed'; root.dataset.fanSidebarRail = '';
  root.innerHTML = '<div class="Edge_panelEntry"><button class="Edge_panelRow">A</button></div><div class="Edge_panelEntry"><button class="Edge_panelRow">B</button></div><button class="Edge_panelRow">More</button>';
  const outside = document.createElement('div'); outside.className = 'Edge_root Edge_collapsed'; outside.innerHTML = '<button class="Edge_panelRow">Outside adapter</button>';
  document.body.append(root, outside);
  const targets = [...root.querySelectorAll('.Edge_panelEntry,.Edge_panelRow')];
  const css = el => getComputedStyle(el), clear = color => color === 'transparent' || /(?:,\s*0|\/\s*0)\)$/.test(color);
  const geometry = () => targets.map(el => { const box = el.getBoundingClientRect(); return [box.width, box.height]; });
  const baseline = { collapsed: geometry() }; root.classList.remove('Edge_collapsed'); baseline.expanded = geometry(); root.classList.add('Edge_collapsed');
  let disposeControls, disposeEdges;
  try {
    disposeControls = effects['fanframe: default-control-motion']();
    disposeEdges = effects['fanframe: hover-feedback'](); await flush();
    check('collapsed spacer endpoints are transparent without unpin markers', targets.every(el => clear(css(el).borderInlineStartColor) && clear(css(el).borderInlineEndColor)), targets.map(el => css(el).borderInlineStartColor));
    check('the adapter does not recolor identical native classes outside its root', !clear(css(outside.firstElementChild).borderInlineStartColor), css(outside.firstElementChild).borderInlineStartColor);
    for (const collapsed of [false, true, false]) {
      root.classList.toggle('Edge_collapsed', collapsed); await flush();
      check('spacer colors remain transparent after state change: ' + collapsed, targets.every(el => clear(css(el).borderInlineStartColor) && clear(css(el).borderInlineEndColor)), targets.map(el => [css(el).borderInlineStartColor, css(el).borderInlineEndColor]));
      check('no transient border-color animation is created: ' + collapsed, targets.every(el => !el.getAnimations().some(animation => animation.effect.getKeyframes().some(key => Object.keys(key).some(name => /border.*Color/i.test(name))))));
      check('native geometry remains unchanged: ' + collapsed, JSON.stringify(geometry()) === JSON.stringify(baseline[collapsed ? 'collapsed' : 'expanded']), geometry());
    }
    const entry = root.querySelector('.Edge_panelEntry');
    check('top and bottom structural borders retain their colors and widths', css(entry).borderTopWidth === '1px' && css(entry).borderTopColor === 'rgb(50, 60, 70)' && css(entry).borderBottomWidth === '2px' && css(entry).borderBottomColor === 'rgb(70, 80, 90)', { top: css(entry).borderTop, bottom: css(entry).borderBottom });
    check('background and text paint transitions are retained', css(entry).transitionProperty.includes('background-color') && css(entry).transitionProperty.includes('color'), css(entry).transitionProperty);
    disposeEdges(); disposeEdges = null; root.classList.add('Edge_collapsed');
    targets.forEach(el => el.getAnimations().forEach(animation => animation.finish())); await flush();
    check('disposing the shared style restores native collapsed color semantics', targets.every(el => !clear(css(el).borderInlineStartColor)), targets.map(el => css(el).borderInlineStartColor));
  } catch (error) { check('unexpected exception', false, error.stack); }
  finally { if (disposeEdges) disposeEdges(); if (disposeControls) disposeControls(); root.remove(); outside.remove(); sheet.remove(); }
  return { passed: results.filter(result => result.pass).length, total: results.length, results };
};
