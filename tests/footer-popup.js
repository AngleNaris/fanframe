// Host evidence: ui-chat DialogPill:7516–7558; ui-conversation ContextMeter:18638,18792–18842.
// Isolated real Chromium DOM/WAAPI fixtures, NOT product VIS/FLOW acceptance.
window.runFooterPopupRegression = async function () {
  const results=[],check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
  const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
  const effects={};plugin.apply({effect(fn,name){effects[name]=fn;}});
  const originalMedia=window.matchMedia,media=new EventTarget();media.matches=false;window.matchMedia=()=>media;
  const sheet=document.createElement('style');sheet.dataset.pluginCss='@deepseek-ai/dsh-client-ui-conversation/ContextMeter.module.css';
  sheet.textContent='.ChangedHash_panel{position:fixed;background:rgba(22,24,32,.4);backdrop-filter:blur(8px)}';document.head.append(sheet);
  const lateGlass=document.createElement('style');
  const footer=document.createElement('div');footer.setAttribute('data-composer-dock','');document.body.append(footer);
  const all=new Set();let dispose,cssDispose,seq=0;
  const ghost=()=>document.querySelector('[data-fan-footer-ghost]');
  const animation=root=>root.getAnimations().find(a=>a.effect.getKeyframes().some(k=>'opacity' in k)&&a.constructor.name==='Animation');
  const finish=async root=>{const a=animation(root);if(a)a.finish();await flush();};
  const color=root=>{const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.fillStyle=getComputedStyle(root).backgroundColor;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data);};
  function make(type,hidden=false) {
    const root=document.createElement('div');root.id='public-popup-'+(++seq);root.setAttribute('role',type==='tip'?'tooltip':'dialog');root.setAttribute('aria-label','Context used / 已用上下文');
    root.style.cssText='position:fixed;left:24px;top:80px;width:248px;height:136px;padding:12px;box-sizing:border-box;--dsw-alias-bg-layer-1:rgba(24,28,36,.3);background:rgba(1,2,3,.4)!important;backdrop-filter:blur(9px)!important';
    if(type==='context')root.className='ChangedHash_panel';
    if(type==='tip'){root.style.transform='translate(-50%,-100%)';root.style.left='300px';root.style.top='280px';root.dataset.side='top';root.dataset.align='center';}
    if(type==='addon')root.setAttribute('data-dsh-usage-glass','dialog');
    if(type==='activity'||type==='usage')root.innerHTML='<dl data-session-stats-'+(type==='activity'?'details':'usage')+'><dt>Input</dt><dd>12.5k</dd></dl>';
    else root.innerHTML='<div>Context: 42%</div>';
    root.insertAdjacentHTML('beforeend','<button id="old-action-'+seq+'" aria-label="old action" tabindex="0">Inspect</button><svg width="16" height="16"><defs><linearGradient id="paint-'+seq+'"><stop stop-color="red"/></linearGradient></defs><rect width="16" height="16" fill="url(#paint-'+seq+')"/></svg>');
    if(hidden)root.style.visibility='hidden';
    (type==='tip'?footer:document.body).append(root);all.add(root);return root;
  }
  try {
    cssDispose=effects['fan-de-hai: opaque-model-select']();dispose=effects['fan-de-hai: footer-popup-motion']();
    lateGlass.textContent='[data-dsh-usage-glass="dialog"]{background:rgba(1,1,1,.2)!important;backdrop-filter:blur(12px)!important}[data-dsh-usage-glass="dialog"]::before{content:"";backdrop-filter:blur(11px)!important}[data-dsh-usage-glass="dialog"] dl{backdrop-filter:blur(10px)!important}';document.head.append(lateGlass);
    for(const type of ['activity','usage','context','addon','tip']) {
      const root=make(type);await flush();const a=animation(root);
      check(type+' appears with an opacity animation',!!a,root.getAnimations().length);
      const before=root.getBoundingClientRect();if(a){a.pause();a.currentTime=0;}
      check(type+' first frame fades without moving/resizing',Math.abs(Number(getComputedStyle(root).opacity))<.01&&Math.abs(root.getBoundingClientRect().top-before.top)<.1,{opacity:getComputedStyle(root).opacity,top:root.getBoundingClientRect().top});
      check(type+' background really has alpha 1, even with translucent theme',color(root)[3]===255,color(root));
      check(type+' glass is removed on surface, descendants and pseudo layers',getComputedStyle(root).backdropFilter==='none'&&getComputedStyle(root,'::before').backdropFilter==='none'&&getComputedStyle(root.firstElementChild).backdropFilter==='none',{root:getComputedStyle(root).backdropFilter,pseudo:getComputedStyle(root,'::before').backdropFilter});
      await finish(root);const rect=root.getBoundingClientRect(),publicId=root.id;
      root.remove();await flush();const g=ghost();
      check(type+' original business element disappears immediately',!root.isConnected&&!document.getElementById(publicId),root.isConnected);
      check(type+' removed portal has a real exit animation',!!g&&!!animation(g),g?.outerHTML.slice(0,100));
      if(g) {
        const r=g.getBoundingClientRect();
        check(type+' exit copy preserves viewport bounds',Math.abs(r.left-rect.left)<.1&&Math.abs(r.top-rect.top)<.1&&Math.abs(r.width-rect.width)<.1&&Math.abs(r.height-rect.height)<.1,{r:{left:r.left,top:r.top,width:r.width,height:r.height},rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height}});
        check(type+' exit copy is inert, a11y-hidden and click-through',g.inert&&g.getAttribute('aria-hidden')==='true'&&getComputedStyle(g).pointerEvents==='none'&&getComputedStyle(g.querySelector('button')).pointerEvents==='none',g.outerHTML.slice(0,120));
        check(type+' no live roles, public ids or business data are retained',!g.querySelector('[role],[aria-label],[tabindex],[data-session-stats-details],[data-session-stats-usage],[data-dsh-usage-glass]')&&!g.hasAttribute('role')&&!g.id,g.outerHTML.slice(0,120));
        const b=g.querySelector('button');b.focus();check(type+' old controls cannot receive focus',document.activeElement!==b,document.activeElement?.tagName);
        const gradient=g.querySelector('linearGradient');check(type+' SVG paint ids are safely remapped',gradient.id.startsWith('fan-footer-paint-')&&g.querySelector('rect').getAttribute('fill')==='url(#'+gradient.id+')',g.querySelector('rect').getAttribute('fill'));
        await finish(g);
      }
      check(type+' exit leaves no residual layer',!ghost(),document.querySelectorAll('[data-fan-footer-ghost]').length);
      check(type+' detached original inline background/blur are restored',root.style.getPropertyValue('backdrop-filter')==='blur(9px)'&&root.style.getPropertyPriority('backdrop-filter')==='important'&&!root.hasAttribute('data-fan-footer-panel'),root.style.cssText);
    }
    const delayed=make('context',true);await flush();check('position-measurement placeholder stays hidden without a premature animation',getComputedStyle(delayed).visibility==='hidden'&&!animation(delayed),getComputedStyle(delayed).visibility);
    delayed.style.left='48px';delayed.style.visibility='visible';await flush();check('entry starts only after anchored position is ready',!!animation(delayed)&&delayed.getBoundingClientRect().left===48,delayed.getBoundingClientRect().left);await finish(delayed);delayed.remove();await flush();if(ghost())await finish(ghost());

    let root=make('activity');await flush();let a=animation(root);if(a){a.pause();a.currentTime=70;}
    const visible=Number(getComputedStyle(root).opacity);root.remove();await flush();let g=ghost();if(g){const x=animation(g);x.pause();x.currentTime=0;}
    check('close during entry starts from current visible opacity, never flashes full',!!g&&Math.abs(Number(getComputedStyle(g).opacity)-visible)<.015,{visible,exit:g&&getComputedStyle(g).opacity});
    if(g){const x=animation(g);x.currentTime=70;}
    const remaining=g?Number(getComputedStyle(g).opacity):0;
    root=make('activity');await flush();a=animation(root);if(a){a.pause();a.currentTime=0;}
    check('rapid reopen removes old exit and resumes from its current opacity',!ghost()&&!!a&&Math.abs(Number(getComputedStyle(root).opacity)-remaining)<.015,{remaining,entry:getComputedStyle(root).opacity});
    const resumed=Number(getComputedStyle(root).opacity);root.remove();await flush();g=ghost();
    check('immediate reclose after rapid reopen preserves the resumed nonzero opacity',!!g&&Math.abs(Number(getComputedStyle(g).opacity)-resumed)<.015,{resumed,exit:g&&getComputedStyle(g).opacity});if(g)await finish(g);
    root=make('activity');await flush();await finish(root);
    root.style.setProperty('--dsw-alias-bg-layer-1','rgba(230,232,240,.2)');await flush();check('light/dark token changes stay opaque without replaying entry',color(root)[0]===230&&color(root)[3]===255&&!animation(root),color(root));

    // Native hooks can keep a hidden placeholder rather than unmount. Do not
    // undo its state; cleanup must use the old exit key even after repositioning.
    root.hidden=true;await flush();const oldGhost=ghost();
    check('hidden close is left untouched while a visual exit plays',root.hidden&&!!oldGhost,root.hidden);
    root.style.left='72px';root.hidden=false;await flush();if(oldGhost)await finish(oldGhost);
    check('repositioned same-node reopen cannot leak an old keyed exit',!ghost()&&root.isConnected&&!root.hidden,document.querySelectorAll('[data-fan-footer-ghost]').length);await finish(root);
    root.remove();await flush();if(ghost())await finish(ghost());

    const late=document.createElement('div');late.setAttribute('role','dialog');late.style.cssText='position:fixed;left:24px;top:100px;width:248px;height:136px';document.body.append(late);all.add(late);await flush();
    check('empty unrelated dialog shell is not taken over',!late.hasAttribute('data-fan-footer-panel'),late.outerHTML);
    late.innerHTML='<dl data-session-stats-usage><dt>Late data</dt><dd>1k</dd></dl>';await flush();check('footer details arriving in a later commit are discovered',!!animation(late),late.outerHTML.slice(0,100));await finish(late);late.remove();await flush();if(ghost())await finish(ghost());
    const unrelated=make('unrelated');await flush();check('translated title and generic _panel names never select unrelated dialogs',!unrelated.hasAttribute('data-fan-footer-panel')&&!animation(unrelated)&&getComputedStyle(unrelated).backdropFilter!=='none',unrelated.style.cssText);unrelated.remove();await flush();check('unrelated dialogs have no ghost exit',!ghost());
    const outsideTip=document.createElement('span');outsideTip.setAttribute('role','tooltip');outsideTip.textContent='Sidebar tooltip';document.body.append(outsideTip);all.add(outsideTip);await flush();check('non-footer tooltip is not animated or restyled',!outsideTip.hasAttribute('data-fan-footer-panel')&&!animation(outsideTip),outsideTip.outerHTML);outsideTip.remove();

    const trigger=document.createElement('button');trigger.textContent='Footer control';trigger.setAttribute('aria-expanded','true');footer.append(trigger);trigger.focus();await flush();
    check('footer keyboard focus has no outline and keeps an underline cue',getComputedStyle(trigger).outlineStyle==='none'&&getComputedStyle(trigger).textDecorationLine.includes('underline'),{outline:getComputedStyle(trigger).outlineStyle,decoration:getComputedStyle(trigger).textDecorationLine});
    let calls=0;root=make('usage');await flush();await finish(root);trigger.onclick=()=>{calls++;trigger.setAttribute('aria-expanded','false');root.remove();};trigger.click();await flush();
    check('host click/state/focus are not replayed or delayed',calls===1&&trigger.getAttribute('aria-expanded')==='false'&&!root.isConnected&&document.activeElement===trigger,{calls,expanded:trigger.getAttribute('aria-expanded'),connected:root.isConnected});
    media.matches=true;media.dispatchEvent(new Event('change'));await flush();check('live reduced motion immediately removes pending exits',!ghost(),document.querySelectorAll('[data-fan-footer-ghost]').length);
    root=make('context');await flush();check('reduced motion makes entry immediate',!animation(root),root.getAnimations().length);root.remove();await flush();check('reduced motion makes close immediate without a stale snapshot',!ghost());
    media.matches=false;media.dispatchEvent(new Event('change'));
    for(let i=0;i<12;i++){root=make('usage');await flush();a=animation(root);if(a){a.pause();a.currentTime=70;}root.remove();await flush();root=make('usage');await flush();await finish(root);root.remove();await flush();if(ghost())await finish(ghost());}
    check('repeated rapid replacement leaves no visual layers or public identities',!ghost()&&!document.querySelector('[data-fan-footer-panel]'),{ghosts:document.querySelectorAll('[data-fan-footer-ghost]').length,owned:document.querySelectorAll('[data-fan-footer-panel]').length});
    root=make('activity');await flush();await finish(root);root.remove();await flush();const active=make('context');await flush();dispose();dispose=null;await flush();
    check('plugin unload cancels entries/exits and restores surviving original styles',!ghost()&&!active.getAnimations().length&&!active.hasAttribute('data-fan-footer-panel')&&active.style.getPropertyValue('backdrop-filter')==='blur(9px)',active.style.cssText);
    check('plugin unload never changes host open state or focus',active.isConnected&&document.activeElement===trigger&&trigger.getAttribute('aria-expanded')==='false',{connected:active.isConnected,active:document.activeElement?.textContent});
    const after=make('usage');await flush();check('no late observer remounts after unload',!after.hasAttribute('data-fan-footer-panel')&&!animation(after),after.outerHTML.slice(0,100));
  } finally {
    if(dispose)dispose();if(cssDispose)cssDispose();window.matchMedia=originalMedia;
    all.forEach(root=>root.remove());footer.remove();sheet.remove();lateGlass.remove();await flush();
  }
  return {passed:results.filter(x=>x.pass).length,total:results.length,results};
};
