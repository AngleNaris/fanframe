// Isolated DOM/CSS/WAAPI regression fixtures; not product VIS/FLOW evidence.
window.runDefaultControlRegression = async function () {
  const results=[],check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
  const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  const flush=async()=>{for(let i=0;i<18;i++)await Promise.resolve();};
  const effects={};plugin.apply({effect(fn,name){effects[name]=fn;}});
  const sheet=document.createElement('style');sheet.dataset.pluginCss='@deepseek-ai/dsh-client-ui-fixture/Controls.module.css';
  sheet.textContent=`:root{--ds-transition-duration-fast:.1s;--ds-ease-in-out:cubic-bezier(.4,0,.2,1)}
    .Motion_button,.Motion_item,.Motion_field{color:rgb(240,240,240);background:rgb(20,20,20);border:1px solid rgb(70,70,70);padding:6px;box-sizing:border-box}
    .Motion_button[data-state=active],.Motion_item[aria-selected=true],.Motion_button:disabled{background-color:rgb(160,120,80);color:rgb(0,0,0)}
    .Motion_field:focus-visible{outline:3px solid red;box-shadow:0 0 0 4px red}
    .Motion_native{transition:height .18s linear,opacity .13s ease}
    .Motion_partial{transition-duration:.23s}
    .Motion_partial:hover{transform:translateX(5px)}
    .Motion_icon svg{transition:transform .12s linear}
    .Motion_anim{animation:motion-fixture 2s linear infinite}@keyframes motion-fixture{to{opacity:.9}}
    .Motion_surface{background:rgb(20,20,20);color:rgb(240,240,240)}.Motion_surface:hover{color:white}`;
  document.head.append(sheet);
  const root=document.createElement('div');root.innerHTML='<button class="Motion_button">Default</button><input class="Motion_field" value="Synthetic fixture"><button class="Motion_native">Native</button><button class="Motion_partial">Partial</button><button class="Motion_icon"><svg width="14" height="14"><path d="M1 4L7 10L13 4"/></svg></button><button class="Motion_button" style="transition:height .27s linear">Inline</button><div role="option" aria-selected="false" class="Motion_item">Choice</div><div class="xterm"><button>Terminal fixture</button></div><button class="Motion_anim">Native animated</button>';
  document.body.append(root);
  let dispose;const late=document.createElement('style');
  try{
    dispose=effects['fanframe: default-control-motion']();
    const [button,input,native,partial,icon,inline]=root.querySelectorAll('button,input');
    const css=e=>getComputedStyle(e),props=e=>css(e).transitionProperty;
    check('default native control receives a 100ms paint-only transition',css(button).transitionDuration==='0.1s'&&props(button).includes('background-color')&&!/\b(?:all|height|width|transform)\b/.test(props(button)),{duration:css(button).transitionDuration,props:props(button)});
    check('full native height/opacity contract remains unchanged',props(native)==='height, opacity'&&css(native).transitionDuration==='0.18s, 0.13s',{props:props(native),duration:css(native).transitionDuration});
    check('native partial longhand retains initial all property and own duration',props(partial)==='all'&&css(partial).transitionDuration==='0.23s',{props:props(partial),duration:css(partial).transitionDuration});
    check('native arrow rotation transition is not overwritten',props(icon.querySelector('svg'))==='transform',props(icon.querySelector('svg')));
    check('inline native transition survives',props(inline)==='height'&&css(inline).transitionDuration==='0.27s',css(inline).transition);
    check('native opacity animation keeps ownership while independent paint motion is available',css(root.querySelector('.Motion_anim')).animationName==='motion-fixture'&&props(root.querySelector('.Motion_anim')).includes('background-color')&&css(root.querySelector('.Motion_anim')).transitionDuration==='0.1s',css(root.querySelector('.Motion_anim')).transition);
    check('terminal descendants are excluded',css(root.querySelector('.xterm button')).transitionDuration==='0s',css(root.querySelector('.xterm button')).transition);
    const box=button.getBoundingClientRect();button.dataset.state='active';css(button).backgroundColor;
    let a=button.getAnimations().find(a=>a.transitionProperty==='background-color');
    check('state change starts a real CSS transition',!!a,button.getAnimations().map(a=>a.constructor.name));
    if(a){a.pause();a.currentTime=50;const mid=css(button).backgroundColor;check('midpoint is an actual intermediate color',mid!=='rgb(20, 20, 20)'&&mid!=='rgb(160, 120, 80)',mid);a.finish();}
    button.getAnimations().forEach(a=>a.finish());await flush();
    check('paint transition does not change control geometry',Math.abs(button.getBoundingClientRect().width-box.width)<.01&&Math.abs(button.getBoundingClientRect().height-box.height)<.01,{before:[box.width,box.height],after:[button.getBoundingClientRect().width,button.getBoundingClientRect().height]});
    delete button.dataset.state;css(button).backgroundColor;a=button.getAnimations().find(a=>a.transitionProperty==='background-color');check('reverse state change also transitions',!!a,button.getAnimations().length);button.getAnimations().forEach(a=>a.finish());await flush();
    let clicks=0;button.onclick=()=>clicks++;button.disabled=true;button.click();check('disabled business action is blocked immediately, not after animation',clicks===0&&button.disabled,{clicks,disabled:button.disabled});button.disabled=false;
    const editorCases=[input];
    for(const type of ['search','email','url','tel','password','number','date','time']){const e=document.createElement('input');e.type=type;e.className='Motion_field';root.append(e);editorCases.push(e);}
    for(const html of ['<textarea class="Motion_field">Textarea fixture</textarea>','<input class="Motion_field" readonly value="Readonly fixture">','<textarea class="Motion_field" readonly>Readonly textarea</textarea>','<div class="Motion_field GRgSLq_input" contenteditable="true">Plain text <u>authored underline</u></div>','<div class="Motion_field" contenteditable="">Empty attribute fixture</div>','<div class="Motion_field" contenteditable="plaintext-only">Plaintext fixture</div>','<div class="Motion_field" role="textbox" tabindex="0">Textbox fixture</div>','<div class="Motion_field" role="searchbox" tabindex="0">Searchbox fixture</div>','<div class="Motion_field" contenteditable="true" role="button"><svg width="14" height="14"></svg>Editable button</div>']){const host=document.createElement('div');host.innerHTML=html;root.append(host);editorCases.push(host.firstElementChild);}
    const inherited=document.createElement('div');inherited.contentEditable='true';inherited.innerHTML='<span class="Motion_field" tabindex="0">Inherited editable fixture</span>';root.append(inherited);editorCases.push(inherited.firstElementChild);
    for(const [index,e] of editorCases.entries()){
      const before=e.innerHTML,value=e.value,caret=css(e).caretColor;e.focus();
      check('editor '+index+' focus never underlines its content',document.activeElement===e&&!css(e).textDecorationLine.includes('underline'),{tag:e.tagName,type:e.type,editable:e.isContentEditable,focus:e.matches(':focus-visible'),decoration:css(e).textDecorationLine});
      check('editor '+index+' keeps caret, content, paint motion and no outer ring',css(e).caretColor===caret&&e.innerHTML===before&&e.value===value&&css(e).transitionDuration==='0.1s'&&css(e).outlineStyle==='none'&&css(e).boxShadow==='none'&&!css(e).backgroundImage.includes('linear-gradient'),{caret:css(e).caretColor,decoration:css(e).textDecorationLine,transition:css(e).transitionDuration,outline:css(e).outlineStyle,shadow:css(e).boxShadow});
    }
    const authored=root.querySelector('[contenteditable="true"] u');check('authored underline formatting survives the editor exclusion',css(authored).textDecorationLine.includes('underline'),css(authored).textDecorationLine);
    button.focus();check('non-editable button retains its non-outline keyboard cue',css(button).textDecorationLine.includes('underline')&&css(button).outlineStyle==='none'&&css(button).boxShadow==='none',css(button).textDecorationLine);
    for(const type of ['button','submit','reset','checkbox','radio','range','color','file']){const e=document.createElement('input');e.type=type;e.className='Motion_field';root.append(e);e.focus();check('non-text input '+type+' keeps its existing focus rule',e.matches(':focus-visible')&&css(e).textDecorationLine.includes('underline'),{type,readWrite:e.matches(':read-write'),decoration:css(e).textDecorationLine});}
    const readonlyButton=document.createElement('button');readonlyButton.className='Motion_button';readonlyButton.contentEditable='false';readonlyButton.textContent='Non-editable button';root.append(readonlyButton);readonlyButton.focus();check('contenteditable false does not suppress real button cues',css(readonlyButton).textDecorationLine.includes('underline'),css(readonlyButton).textDecorationLine);
    icon.focus();check('icon focus has an internal cue without changing geometry',css(icon).backgroundImage.includes('linear-gradient')&&css(icon).outlineStyle==='none',css(icon).backgroundImage);
    input.blur();icon.blur();
    inline.style.transition='transform .31s ease';check('native inline transition written after mount takes over immediately',props(inline)==='transform'&&css(inline).transitionDuration==='0.31s',css(inline).transition);
    late.dataset.pluginCss='@deepseek-ai/dsh-client-ui-fixture/Late.module.css';late.textContent='.Motion_button{transition:height .4s linear}';document.head.append(late);await frame();await frame();
    check('late native stylesheet takes ownership without losing height',props(button)==='height'&&css(button).transitionDuration==='0.4s',css(button).transition);
    late.remove();await frame();await frame();check('removed native owner restores fallback without stale exclusions',props(button).includes('background-color'),props(button));
    const generated=document.querySelector('style[data-fan-default-motion]');
    check('reduced motion is guarded by the real CSS media condition, not a JS mock',generated.textContent.includes('@media(prefers-reduced-motion:no-preference)'),generated.textContent.slice(0,90));
    check('supplement does not globally disable native/essential animations',!generated.textContent.includes('animation:none')&&!generated.textContent.includes('transition:all'),generated.textContent.length);
    // A nonmatching media rule exercises CSS cascade removal; it is NOT OS emulation.
    const mediaRule=generated.sheet.cssRules[0].cssRules[0];mediaRule.media.mediaText='not all';
    check('when optional motion media does not match, fallback is absent',css(button).transitionDuration==='0s',css(button).transition);mediaRule.media.mediaText='(prefers-reduced-motion:no-preference)';
    dispose();dispose=null;check('unload removes the owned layer and restores original default',!document.querySelector('[data-fan-default-motion]')&&css(button).transitionDuration==='0s',css(button).transition);
    late.textContent='.Motion_button{color:red}';document.head.append(late);await frame();check('disposed head observer cannot reinstall motion',!document.querySelector('[data-fan-default-motion]'),document.querySelectorAll('[data-fan-default-motion]').length);
  }catch(e){check('unexpected exception',false,e.stack);}
  finally{if(dispose)dispose();root.remove();sheet.remove();late.remove();await flush();}
  return {passed:results.filter(r=>r.pass).length,total:results.length,results};
};

window.runDefaultSurfaceRegression = async function () {
  const results=[],check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
  const flush=async()=>{for(let i=0;i<22;i++)await Promise.resolve();};
  const effects={};plugin.apply({effect(fn,name){effects[name]=fn;}});
  const originalMedia=matchMedia,media=new EventTarget();media.matches=false;window.matchMedia=()=>media;
  const sheet=document.createElement('style');sheet.dataset.pluginCss='@deepseek-ai/dsh-client-ui-fixture/Popup.module.css';
  sheet.textContent='.DefaultPopup_root{position:fixed;left:50px;top:70px;width:210px;height:100px;box-sizing:border-box;background:rgba(35,40,50,.72);border:1px solid rgb(70,80,90);box-shadow:0 5px 13px rgba(0,0,0,.2);color:rgb(230,230,230)}.DefaultPopup_native{transition:opacity .22s}.DefaultPopup_root [aria-pressed=true]{background:rgb(75,65,55)}';document.head.append(sheet);
  const all=new Set();let dispose;
  const anim=root=>root.getAnimations().find(a=>a.constructor.name==='Animation'&&a.effect.getKeyframes().some(k=>'opacity'in k));
  const ghost=()=>document.querySelector('[data-fan-footer-ghost]');
  function make(role,cls='DefaultPopup_root',hidden=false){const root=document.createElement('div');root.className=cls;root.setAttribute('role',role);root.setAttribute('aria-label','Synthetic surface');root.innerHTML='<button id="default-fixture-action" aria-pressed="true">Action</button>';if(hidden)root.style.visibility='hidden';document.body.append(root);all.add(root);return root;}
  async function finish(root){const a=anim(root);if(a)a.finish();await flush();}
  try{
    dispose=effects['fan-de-hai: footer-popup-motion']();
    for(const role of ['menu','listbox','dialog','tooltip']){
      const root=make(role);await flush();let a=anim(root);check(role+' receives exactly one opacity entrance',!!a&&root.getAnimations().filter(a=>a.constructor.name==='Animation').length===1,root.getAnimations().length);
      check(role+' is motion-only, without footer material override',root.hasAttribute('data-fan-default-surface')&&!root.hasAttribute('data-fan-footer-panel')&&getComputedStyle(root).backgroundColor==='rgba(35, 40, 50, 0.72)',{marker:root.hasAttribute('data-fan-default-surface'),bg:getComputedStyle(root).backgroundColor});
      const rect=root.getBoundingClientRect(),shadow=getComputedStyle(root).boxShadow;await finish(root);root.remove();await flush();const g=ghost();
      check(role+' real host DOM closes immediately',!root.isConnected&&!document.getElementById('default-fixture-action'),root.isConnected);
      check(role+' exits with a noninteractive identity-free ghost',!!g&&g.inert&&g.getAttribute('aria-hidden')==='true'&&!g.querySelector('[id="default-fixture-action"],[role],[aria-pressed]'),g?.outerHTML.slice(0,220));
      if(g){check(role+' preserves state-dependent paint after ARIA identity is stripped',getComputedStyle(g.querySelector('button')).backgroundColor==='rgb(75, 65, 55)',getComputedStyle(g.querySelector('button')).backgroundColor);const r=g.getBoundingClientRect();check(role+' preserves exit rectangle and existing shadow',Math.abs(r.left-rect.left)<.01&&Math.abs(r.top-rect.top)<.01&&Math.abs(r.width-rect.width)<.01&&getComputedStyle(g).boxShadow===shadow,{rect:[r.left,r.top,r.width],shadow:getComputedStyle(g).boxShadow});await finish(g);}
      check(role+' exit cleans up',!ghost(),!!ghost());
    }
    for(const kind of ['password','text','textarea','iframe','canvas']){
      const sensitive=make('dialog'),field=document.createElement(kind==='password'||kind==='text'?'input':kind);if(field.tagName==='INPUT'){field.type=kind;field.value='Synthetic fixture only';}sensitive.append(field);await flush();await finish(sensitive);sensitive.remove();await flush();check(kind+' editor/media closes without retaining an exit copy',!ghost(),!!ghost());
    }
    const scrolled=make('listbox');scrolled.innerHTML='<div style="height:24px;overflow:auto"><div style="height:140px">Synthetic scrolled options</div></div>';scrolled.firstChild.scrollTop=60;await flush();await finish(scrolled);scrolled.remove();await flush();check('scrolled viewport closes without a reset-to-top drawing copy',!ghost(),!!ghost());
    const upper=make('dialog');await flush();await finish(upper);upper.remove();await flush();const olderGhost=ghost();
    const lower=make('dialog');lower.style.top='220px';await flush();check('distinct surfaces sharing x do not steal each other exit state',!!olderGhost&&olderGhost.isConnected&&!!anim(lower),{older:olderGhost?.isConnected,entering:!!anim(lower)});await finish(lower);lower.remove();await flush();document.querySelectorAll('[data-fan-footer-ghost]').forEach(g=>anim(g)?.finish());await flush();
    const third=make('dialog','ThirdParty_dialog');await flush();check('third-party custom dialog remains untouched',!anim(third)&&!third.hasAttribute('data-fan-default-surface'),third.outerHTML.slice(0,120));third.remove();
    const native=make('dialog','DefaultPopup_root DefaultPopup_native');await flush();check('existing native transition owner is not animated twice',!anim(native)&&!native.hasAttribute('data-fan-default-surface'),native.getAnimations().length);native.remove();
    const pending=make('dialog','DefaultPopup_root',true);await flush();check('positioning placeholder does not animate',!anim(pending),pending.getAnimations().length);pending.style.visibility='visible';await flush();check('surface waits until actually positioned and visible',!!anim(pending),pending.getAnimations().length);await finish(pending);pending.remove();await flush();if(ghost())await finish(ghost());
    const first=make('dialog');await flush();await finish(first);first.remove();await flush();let g=ghost();if(g&&anim(g)){anim(g).pause();anim(g).currentTime=70;}const opacity=g?Number(getComputedStyle(g).opacity):null;
    const second=make('dialog');await flush();const entering=anim(second);if(entering){entering.pause();entering.currentTime=0;}check('rapid reopen replaces stale ghost and continues visible opacity',!!entering&&!ghost()&&Math.abs(Number(getComputedStyle(second).opacity)-opacity)<.02,{opacity,after:getComputedStyle(second).opacity});await finish(second);
    media.matches=true;media.dispatchEvent(new Event('change'));await flush();check('live reduced motion settles entrances without changing host open state',second.isConnected&&!anim(second),second.getAnimations().length);second.remove();await flush();check('reduced motion never creates exit clones',!ghost(),!!ghost());
    media.matches=false;media.dispatchEvent(new Event('change'));const final=make('dialog');await flush();dispose();dispose=null;check('unload cancels all work and restores surviving host styles',!anim(final)&&!final.hasAttribute('data-fan-default-surface')&&final.style.transition===''&&!ghost(),final.style.cssText);
  }catch(e){check('unexpected exception',false,e.stack);}
  finally{if(dispose)dispose();all.forEach(e=>e.remove());sheet.remove();window.matchMedia=originalMedia;await flush();}
  return {passed:results.filter(r=>r.pass).length,total:results.length,results};
};

window.runDefaultDisclosureRegression = async function () {
  const results=[],check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
  const flush=async()=>{for(let i=0;i<22;i++)await Promise.resolve();};
  const effects={};plugin.apply({effect(fn,name){effects[name]=fn;}});
  const originalMedia=matchMedia,media=new EventTarget();media.matches=false;window.matchMedia=()=>media;
  const root=document.createElement('div');root.style.width='460px';document.body.append(root);const disposers=[];
  try{
    for(const kind of ['shared','inventory']){
      const card=document.createElement(kind==='inventory'?'li':'section');card.style.cssText='display:flex;flex-direction:column;box-sizing:border-box;padding:8px';
      if(kind==='inventory'){card.dataset.pluginModule='fixture';card.innerHTML='<button aria-expanded="false" style="height:28px;flex:none">Plugin settings</button>';}
      else card.innerHTML='<div data-disclosure-header><button aria-expanded="false" style="height:28px">Shared disclosure</button></div>';
      const button=card.querySelector('button'),body=document.createElement('div');body.style.cssText='height:160px;flex:none';body.textContent='Synthetic settings details';let calls=0;
      button.onclick=()=>{calls++;const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));if(open)card.append(body);else body.remove();};root.append(card);
      if(!disposers.length)disposers.push(effects['fan-de-hai: card-disclosure-motion']());
      await flush();button.click();await flush();let a=card.getAnimations().find(a=>a.effect.getKeyframes().some(k=>'height'in k));check(kind+' first open outside chat animates without replaying business input',!!a&&calls===1&&body.isConnected,{animations:card.getAnimations().length,calls});if(a)a.finish();await flush();button.click();await flush();a=card.getAnimations().find(a=>a.effect.getKeyframes().some(k=>'height'in k));check(kind+' first close animates while real body unmounts immediately',!!a&&!body.isConnected&&calls===2,{animations:card.getAnimations().length,calls});if(a)a.finish();await flush();card.remove();
    }
    const details=document.createElement('details');details.innerHTML='<summary>Default details outside chat</summary><div style="height:140px">Content</div>';root.append(details);disposers.push(effects['fan-de-hai: native-details-motion']());await flush();
    details.querySelector('summary').click();details.dispatchEvent(new Event('toggle'));await flush();let a=details.getAnimations().find(a=>a.effect.getKeyframes().some(k=>'height'in k));check('native details outside chat now shares the approved opening motion',!!a&&details.open,details.getAnimations().length);if(a)a.finish();await flush();
    details.querySelector('summary').click();details.dispatchEvent(new Event('toggle'));await flush();a=details.getAnimations().find(a=>a.effect.getKeyframes().some(k=>'height'in k));check('native details close preserves native state and original content',!!a&&!details.open&&details.children.length===2,details.getAnimations().length);if(a)a.finish();await flush();
    details.open=true;details.dispatchEvent(new Event('toggle'));await flush();check('browser-find/programmatic reveal outside chat is immediate, never height-locked',details.open&&details.getAnimations().length===0&&details.style.height==='',{animations:details.getAnimations().length,height:details.style.height});
  }catch(e){check('unexpected exception',false,e.stack);}
  finally{disposers.reverse().forEach(fn=>fn());root.remove();window.matchMedia=originalMedia;await flush();}
  return {passed:results.filter(r=>r.pass).length,total:results.length,results};
};

// Real installed rc.3 CSS bytes; synthetic DOM, not the authenticated product UI.
window.runHostPrimitiveMotionRegression = async function () {
  const results=[],check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
  const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
  const effects={};plugin.apply({effect(fn,name){effects[name]=fn;}});
  const link=document.createElement('link');link.rel='stylesheet';link.href='/tests/assets/index-BNyAYEM7.css';
  await new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=reject;document.head.append(link);});
  const roots=[];let dispose,disposeControls;
  const animation=root=>root.getAnimations().find(a=>a.constructor.name==='Animation'&&a.effect.getKeyframes().some(k=>'opacity'in k));
  const finish=async root=>{const a=animation(root);if(a)a.finish();await flush();};
  try{
    disposeControls=effects['fanframe: default-control-motion']();dispose=effects['fan-de-hai: footer-popup-motion']();
    const modal=document.createElement('div');modal.className='_root_o6lrb_6';modal.setAttribute('role','presentation');modal.innerHTML='<div class="_mask_o6lrb_18"></div><section class="_dialog_o6lrb_33" role="dialog" aria-label="Synthetic rc.3 dialog"><div class="_content_o6lrb_63"><button>Close fixture</button></div></section>';roots.push(modal);document.body.append(modal);await flush();
    check('actual rc.3 modal outer shell receives one opacity driver',!!animation(modal)&&modal.hasAttribute('data-fan-default-surface'),{animations:modal.getAnimations().length,marker:modal.hasAttribute('data-fan-default-surface')});
    check('backdrop and content share the same parent fade, without nested drivers',!animation(modal.querySelector('[role=dialog]'))&&!modal.querySelector('[role=dialog]').hasAttribute('data-fan-default-surface'),modal.querySelector('[role=dialog]').getAnimations().length);
    const button=modal.querySelector('button');check('real shell CSS leaves missing default control paint motion available',getComputedStyle(button).transitionProperty.includes('background-color')&&getComputedStyle(button).transitionDuration==='0.1s',getComputedStyle(button).transition);
    await finish(modal);modal.remove();await flush();let ghost=document.querySelector('[data-fan-footer-ghost]');check('rc.3 modal whole-shell exit preserves both mask and dialog',!!ghost&&!!ghost.querySelector('._mask_o6lrb_18')&&!!ghost.querySelector('._dialog_o6lrb_33'),!!ghost);if(ghost)await finish(ghost);
    const tip=document.createElement('div');tip.className='_bubble_44yfq_1';tip.dataset.side='bottom';tip.dataset.align='center';tip.style.cssText='left:120px;top:130px;--ds-ease-in-out:ease';tip.innerHTML='<span class="_label_44yfq_30">Synthetic rc.3 tooltip</span>';roots.push(tip);document.body.append(tip);await flush();
    check('actual role-less rc.3 Tooltip retains its sole native 150ms CSS animation',!animation(tip)&&!tip.hasAttribute('data-fan-default-surface')&&getComputedStyle(tip).animationName==='_tooltip-in_44yfq_1'&&getComputedStyle(tip).animationDuration==='0.15s',{animations:tip.getAnimations().map(a=>a.constructor.name),animation:getComputedStyle(tip).animation,role:tip.getAttribute('role')});tip.remove();await flush();ghost=document.querySelector('[data-fan-footer-ghost]');check('native-owned Tooltip is not taken over by a second exit driver',!ghost&&!tip.isConnected,!!ghost);
  }catch(e){check('unexpected exception',false,e.stack);}
  finally{if(dispose)dispose();if(disposeControls)disposeControls();roots.forEach(r=>r.remove());link.remove();await flush();}
  return {passed:results.filter(r=>r.pass).length,total:results.length,results};
};
