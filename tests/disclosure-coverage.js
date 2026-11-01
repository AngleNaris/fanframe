// Structural regression fixtures, not product VIS/FLOW evidence.
// DisclosureRow: web-frontend.readable.txt:5884–5885; ToolRow:1830–1851;
// BashRow:2518–2561 in the read-only installed-host audit copies.
window.runDisclosureCoverageRegression = async function () {
  const results = [], roots = [];
  const check = (name, pass, actual) => results.push({name, pass: !!pass, actual});
  const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
  const effects = {}; plugin.apply({effect(fn, name) { effects[name] = fn; }});
  const originalMedia = window.matchMedia, media = new EventTarget();
  media.matches = false; window.matchMedia = () => media;
  const flow = document.createElement('div'); flow.dataset.chatFlow = ''; flow.dataset.chatMotion = '';
  flow.style.cssText = 'width:480px'; document.body.append(flow);
  let dispose;
  function fixture(kind, parent = flow) {
    const root = document.createElement('div');
    root.style.cssText = 'display:flex;flex-direction:column;box-sizing:border-box';
    const body = document.createElement('div'); body.style.cssText = 'height:180px;flex:none'; body.textContent = 'Conditional body';
    let header, shell = root, row;
    if (kind === 'bash-sample') {
      root.innerHTML = '<div data-sample="bash" data-variant="bash" data-expandable role="button" tabindex="0" aria-expanded="false" style="height:24px;flex:none">Command output</div>';
      header = root.firstElementChild;
    } else if (kind === 'compaction' || kind === 'question-reply') {
      if (kind === 'question-reply') { root.dataset.questionReply = 'fixture'; shell = document.createElement('div'); shell.style.cssText = 'display:flex;flex-direction:column;padding:8px'; root.append(shell); }
      shell.innerHTML = '<button aria-expanded="false" style="display:flex;height:24px;flex:none;border:0;padding:0">' + (kind === 'compaction' ? '<span data-compaction-disclosure="collapsed">Compaction</span>' : 'Answer summary') + '</button>';
      header = shell.firstElementChild;
    } else {
      if (kind !== 'context' && kind !== 'button-only') {
        root.dataset.tool = kind;
        root.innerHTML = '<span style="position:absolute;width:1px;height:1px;overflow:hidden">Running</span><div style="display:flex;flex-direction:column"></div>';
        shell = root.lastElementChild;
      }
      shell.innerHTML = '<div data-disclosure-header style="display:flex;flex:none"><div data-disclosure-row style="height:24px;flex:auto">Disclosure</div></div>';
      row = shell.querySelector('[data-disclosure-row]');
      if (kind === 'button-only') { row.innerHTML = '<button aria-expanded="false" style="height:24px;border:0;padding:0">Toggle</button>'; header = row.firstElementChild; }
      else { header = row; header.setAttribute('aria-expanded', 'false'); header.setAttribute('role', 'button'); header.tabIndex = 0; }
    }
    let calls = 0, commit;
    header.onclick = () => {
      calls++; const open = header.getAttribute('aria-expanded') !== 'true';
      header.setAttribute('aria-expanded', String(open)); shell.toggleAttribute('data-open', open);
      if (open) shell.append(body); else body.remove();
      commit = {height: root.getBoundingClientRect().height, top: parent.scrollTop};
    };
    parent.append(root); roots.push(root);
    return {root, shell, header, body, calls: () => calls, commit: () => commit};
  }
  const heightMotion = f => [...f.root.getAnimations(), ...(f.shell === f.root ? [] : f.shell.getAnimations())].find(a => a.effect.getKeyframes().some(k => 'height' in k));
  try {
    dispose = effects['fan-de-hai: card-disclosure-motion']();
    for (const kind of ['read', 'grep', 'pwsh', 'edit', 'cordis_inspect_query', 'present', 'ask_user_question', 'context', 'button-only', 'bash-sample', 'compaction', 'question-reply']) {
      const f = fixture(kind); await flush(); const closed = f.root.getBoundingClientRect().height;
      f.header.click(); await flush(); let a = heightMotion(f);
      check(kind + ' first opening has height motion', !!a, f.root.getAnimations().length + f.shell.getAnimations().length);
      if (!a) continue;
      a.finish(); await flush(); const full = f.root.getBoundingClientRect().height;
      check(kind + ' reaches actual natural height', Math.abs(full - closed - 180) < 0.5, {closed, full});
      f.header.click(); await flush(); a = heightMotion(f);
      check(kind + ' close keeps the pre-toggle shell through host layout', !!a && Math.abs(f.commit().height - full) < 0.5, f.commit());
      check(kind + ' never retains removed content or replays the click', !f.body.isConnected && f.calls() === 2, f.calls());
      if (a) { a.finish(); await flush(); }
      check(kind + ' restores intrinsic height and styles', Math.abs(f.root.getBoundingClientRect().height - closed) < 0.5 && !f.root.style.height && !f.shell.style.height, {height: f.root.getBoundingClientRect().height, style: f.root.style.cssText});
    }
    const stale = fixture('read'); await flush();
    // The header reflows and is clicked in one task, before ResizeObserver runs.
    stale.header.style.height = '48px'; const liveStart = stale.root.getBoundingClientRect().height;
    stale.header.click(); await flush(); let a = heightMotion(stale);
    check('first toggle samples live geometry, not the previous ResizeObserver cache', !!a && Math.abs(parseFloat(a.effect.getKeyframes()[0].height) - liveStart) < 0.5, {liveStart, keyframe: a && a.effect.getKeyframes()[0].height});
    if (a) { a.finish(); await flush(); }
    const scroller = document.createElement('div'); scroller.dataset.chatFlow = ''; scroller.style.cssText = 'width:480px;height:300px;overflow:auto;overflow-anchor:none';
    scroller.innerHTML = '<div style="height:1600px;flex:none">Earlier conversation</div>'; document.body.append(scroller); roots.push(scroller);
    const tail = fixture('read', scroller); await flush(); tail.header.click(); await flush(); a = heightMotion(tail); if (a) { a.finish(); await flush(); }
    scroller.scrollTop = 99999; const before = scroller.scrollTop;
    tail.header.click(); await flush(); a = heightMotion(tail);
    if (a) { a.pause(); a.currentTime = 0; }
    check('ordinary tool collapse never clamps shared scroll range before animation', !!a && tail.commit().top === before && scroller.scrollTop === before, {before, commit: tail.commit(), after: scroller.scrollTop});
    if (a) { a.finish(); await flush(); }
    const lazy = fixture('read'); await flush(); lazy.header.click(); await flush(); a = heightMotion(lazy);
    if (a) {
      a.pause(); a.currentTime = 80; const visible = lazy.root.getBoundingClientRect().height;
      lazy.body.style.height = '280px'; lazy.body.append(document.createTextNode(' late output')); await flush();
      a = heightMotion(lazy);
      check('lazy first-open content retargets rather than jumping to auto height', !!a && Math.abs(parseFloat(a.effect.getKeyframes()[0].height) - visible) < 0.5, {visible, start:a && a.effect.getKeyframes()[0].height});
      if (a) { a.pause(); a.currentTime = 60; const reverse = lazy.root.getBoundingClientRect().height; lazy.header.click(); await flush(); a = heightMotion(lazy);
        check('ordinary tool reverses from its current visible height', !!a && Math.abs(parseFloat(a.effect.getKeyframes()[0].height) - reverse) < 0.5, {reverse, start:a && a.effect.getKeyframes()[0].height});
        if (a) { a.finish(); await flush(); }
      }
    }
    const trigger = document.createElement('section'); trigger.dataset.turnTrigger = '';
    trigger.innerHTML = '<button aria-expanded="true" aria-controls="coverage-notice" style="display:flex;height:24px;padding:0;border:0">Notification</button><div id="coverage-notice" style="height:180px">Notice</div>';
    scroller.append(trigger); roots.push(trigger); await flush(); const triggerButton = trigger.firstElementChild, notice = trigger.lastElementChild;
    let triggerCommit; triggerButton.onclick = () => { triggerButton.setAttribute('aria-expanded','false'); notice.remove(); triggerCommit=scroller.scrollTop; };
    scroller.scrollTop=99999; const triggerBefore=scroller.scrollTop; triggerButton.click(); await flush(); a=trigger.getAnimations()[0]; if(a){a.pause();a.currentTime=0;}
    check('TurnTrigger first collapse protects the same shared scroll range', !!a && triggerCommit===triggerBefore && scroller.scrollTop===triggerBefore, {before:triggerBefore,commit:triggerCommit,after:scroller.scrollTop});
    if(a){a.finish();await flush();}
    const menu=document.createElement('div'); menu.setAttribute('role','menu'); flow.append(menu); roots.push(menu);
    const menuControl=fixture('context',menu);await flush();menuControl.header.click();await flush();
    check('conversation-owned menu controls are not treated as in-flow disclosures',!heightMotion(menuControl)&&!menuControl.root.style.height,menuControl.root.style.cssText);
    const outside = document.createElement('div'); document.body.append(outside); roots.push(outside);
    const unrelated = fixture('read', outside); await flush(); unrelated.header.click(); await flush();
    check('ordinary tool-shaped controls outside conversation stay untouched', !heightMotion(unrelated) && !unrelated.root.style.height && !unrelated.shell.style.height, unrelated.root.style.cssText);
    media.matches = true; media.dispatchEvent(new Event('change')); await flush();
    stale.header.click(); await flush();
    check('new disclosure families respect live reduced motion', !heightMotion(stale) && !stale.body.isConnected && !stale.root.style.height, stale.root.style.cssText);
  } catch (e) { check('unexpected exception', false, e.stack); }
  finally { if (dispose) dispose(); roots.forEach(r => r.remove()); flow.remove(); window.matchMedia = originalMedia; }
  return {passed: results.filter(r => r.pass).length, total: results.length, results};
};

window.runNativeDetailsRegression = async function () {
  const results = [], check = (name, pass, actual) => results.push({name, pass: !!pass, actual});
  const flush = async () => { for(let i=0;i<16;i++) await Promise.resolve(); };
  const effects = {}; plugin.apply({effect(fn,name){effects[name]=fn;}});
  const flow = document.createElement('div'); flow.dataset.chatFlow='';
  flow.style.cssText='width:480px;height:300px;overflow:auto;overflow-anchor:none';
  flow.innerHTML='<div style="height:1600px">Conversation</div><details><summary style="height:24px">Retry details</summary><div style="height:180px">Failure and retry explanation</div></details>';
  const details=flow.lastElementChild, summary=details.firstElementChild, body=details.lastElementChild;
  const outside=details.cloneNode(true); document.body.append(flow,outside);
  let dispose;
  const transition=()=>details.getAnimations().find(a=>a.effect.getKeyframes().some(k=>'height' in k));
  const toggle=async()=>{const event=new Promise(resolve=>details.addEventListener('toggle',resolve,{once:true}));summary.click();await event;await flush();};
  try {
    dispose=effects['fan-de-hai: native-details-motion']();
    const closed=details.getBoundingClientRect().height;
    await toggle(); let a=transition();
    check('native details first opening animates its real shell',!!a,details.getAnimations({subtree:true}).length);
    if(a){a.pause();a.currentTime=90;const mid=details.getBoundingClientRect().height;
      check('native details interpolates without moving its summary',mid>closed&&mid<closed+180&&summary.getBoundingClientRect().height===24,{closed,mid});
      a.finish();await flush();}
    const full=details.getBoundingClientRect().height;
    check('native details reaches original natural height',details.open&&Math.abs(full-closed-180)<0.5,full);
    flow.scrollTop=99999;const before=flow.scrollTop; await toggle();a=transition();
    if(a){a.pause();a.currentTime=0;}
    check('native details first collapse retains the scroll extent at transition start',!!a&&flow.scrollTop===before,{before,after:flow.scrollTop});
    check('native details keeps original DOM and browser open state',!details.open&&body.isConnected&&!details.hasAttribute('hidden'),{open:details.open,connected:body.isConnected});
    if(a){a.pause();a.currentTime=90;const visible=details.getBoundingClientRect().height;await toggle();a=transition();
      check('native details rapid reversal continues from visible geometry',!!a&&Math.abs(details.getBoundingClientRect().height-visible)<1,{visible,after:details.getBoundingClientRect().height});
      if(a){a.finish();await flush();}}
    outside.firstElementChild.click();outside.getBoundingClientRect();
    check('native details outside chat has no plugin transition',outside.getAnimations({subtree:true}).length===0,outside.getAnimations({subtree:true}).length);
    dispose();dispose=null;details.getBoundingClientRect();
    check('removing plugin restores native details without changing open or content',details.open&&body.isConnected&&details.getAnimations({subtree:true}).length===0,details.open);
  } catch(e) {check('unexpected exception',false,e.stack);}
  finally{if(dispose)dispose();flow.remove();outside.remove();}
  return {passed:results.filter(r=>r.pass).length,total:results.length,results};
};
