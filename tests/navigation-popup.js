// Structural native popup + WAAPI coverage, not product VIS/FLOW.
window.runNavigationPopupRegression=async function(){
 const results=[],check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
 const flush=async()=>{for(let i=0;i<28;i++)await Promise.resolve();};
 const effects={};plugin.apply({effect(fn,name){effects[name]=fn;}});
 const sheets=nativeSidebarStyles.map(s=>{const el=document.createElement('style');el.dataset.pluginCss=s.id;el.textContent=s.css;document.head.append(el);return el;});
 const cls=(file,key)=>{const s=nativeSidebarStyles.find(s=>s.id.endsWith('/'+file));const m=s.css.match(new RegExp('\\.([\\w-]+_'+key+')(?![\\w-])'));if(!m)throw Error(file+':'+key);return m[1];};
 const attr='data-fan-footer-panel',ghost='[data-fan-footer-ghost]',nodes=[];
 const finish=async el=>{el.getAnimations().forEach(a=>a.finish());await flush();};
 const box=el=>{const r=el.getBoundingClientRect();return[r.left,r.top,r.width,r.height];};
 const make=(type)=>{const el=document.createElement('div');el.style.cssText='position:fixed;left:32px;top:64px;width:220px;height:104px;box-sizing:border-box;visibility:visible';
  el.innerHTML='<button aria-label="Action">Action</button>';
  if(type==='team'){el.dataset.teamPanel='true';el.setAttribute('role','dialog');el.className=cls('TeamAction.module.css','panel');}
  if(type==='catalog'){el.className=cls('SubagentHeaderLineage.module.css','menu');el.innerHTML='<div role="tree"><div role="treeitem" tabindex="0">child</div></div>';}
  if(type==='mcp'){el.dataset.cordisPanel='true';el.className=cls('CordisPanel.module.css','panel');}
  if(['more','preset','signed-out','signed-in'].includes(type)){el.setAttribute('role','menu');el.dataset.menuMaterial='translucent';}
  if(type==='more')el.className=cls('SidebarRoot.module.css','moreMenu');
  if(type==='preset')el.innerHTML='<button role="menuitem"><span class="'+cls('AgentPresetSeat.module.css','item')+'">Creator</span></button>';
  if(type==='signed-out')el.className=cls('AccountMenu.module.css','signedOutMenu');
  nodes.push(el);return el;};
 let dispose,cssDispose,trigger,accountPanel,clicks=0;
 const launcher=document.createElement('div');launcher.dataset.slot='sidebar.settings';launcher.innerHTML='<button class="'+cls('AccountMenu.module.css','trigger')+'" aria-label="Account" aria-haspopup="menu" aria-expanded="false">Account</button>';document.body.append(launcher);nodes.push(launcher);trigger=launcher.firstElementChild;
 try{
  cssDispose=effects['fan-de-hai: opaque-model-select']();dispose=effects['fan-de-hai: footer-popup-motion']();
  for(const type of ['team','catalog','mcp','more','preset','signed-out']){
   const el=make(type);document.body.append(el);await flush();
   check(type+': exact native owner receives animation marker',el.hasAttribute(attr),el.outerHTML.slice(0,100));
   const entry=el.getAnimations().find(a=>a.effect.getTiming().duration===140);
   check(type+': entrance is opacity-only 140ms',!!entry&&entry.effect.getKeyframes().every(f=>!('transform'in f)&&!('height'in f)),el.getAnimations().map(a=>a.effect.getTiming()));
   check(type+': actual surface and pseudo glass are removed',getComputedStyle(el).backdropFilter==='none'&&getComputedStyle(el,'::before').backdropFilter==='none',{root:getComputedStyle(el).backdropFilter,before:getComputedStyle(el,'::before').backdropFilter});
   await finish(el);const before=box(el);el.remove();await flush();const copy=document.querySelector(ghost);
   check(type+': native DOM closes immediately; only inert paint remains',!el.isConnected&&!!copy&&copy.inert&&copy.getAttribute('aria-hidden')==='true'&&!copy.hasAttribute('role')&&!copy.querySelector('[role],[tabindex],[data-team-panel],[data-cordis-panel]'),copy?.outerHTML.slice(0,140));
   check(type+': exit keeps the original rectangle and cannot intercept clicks',!!copy&&box(copy).every((x,i)=>Math.abs(x-before[i])<.1)&&getComputedStyle(copy).pointerEvents==='none',{before,after:copy&&box(copy)});
   if(copy)await finish(copy);check(type+': finished exit leaves no residue',!document.querySelector(ghost));
  }
  trigger.onclick=()=>{clicks++;trigger.setAttribute('aria-expanded','true');accountPanel=make('signed-in');document.body.append(accountPanel);};
  trigger.click();await flush();check('signed-in account: native click is observed, never swallowed or replayed',clicks===1&&accountPanel.hasAttribute(attr),{clicks,marked:accountPanel.hasAttribute(attr)});
  const unrelatedMenu=make('signed-in');document.body.append(unrelatedMenu);await flush();check('one native account intent cannot claim a second generic menu',!unrelatedMenu.hasAttribute(attr));unrelatedMenu.remove();
  await finish(accountPanel);trigger.setAttribute('aria-expanded','false');accountPanel.remove();trigger.focus();await flush();check('account close never delays host focus restoration',document.activeElement===trigger&&!accountPanel.isConnected&&!!document.querySelector(ghost));if(document.querySelector(ghost))await finish(document.querySelector(ghost));
  const unrelated=make('signed-in');document.body.append(unrelated);await flush();check('unrelated generic material menu remains outside the motion scope',!unrelated.hasAttribute(attr));unrelated.remove();await flush();
  const otherDialog=document.createElement('div');otherDialog.setAttribute('role','dialog');otherDialog.className='dockkit_surface_unrelated';otherDialog.textContent='unrelated';document.body.append(otherDialog);nodes.push(otherDialog);await flush();check('unrelated dialog/layout material is not claimed',!otherDialog.hasAttribute(attr)&&!otherDialog.style.background);
  const title=document.createElement('span');title.textContent='创造模式';title.title='Existing native description';document.body.append(title);nodes.push(title);await flush();check('approved read-only mode title remains native and unchanged',title.title==='Existing native description'&&!title.hasAttribute('tabindex')&&!title.hasAttribute(attr)&&!title.hasAttribute('role'));
  const late=make('catalog');late.replaceChildren();document.body.append(late);await flush();check('catalog wrapper is not claimed before its real tree exists',!late.hasAttribute(attr));const tree=document.createElement('div');tree.setAttribute('role','tree');late.append(tree);await flush();check('late catalog body is discovered without translated labels',late.hasAttribute(attr));await finish(late);late.remove();await flush();if(document.querySelector(ghost))await finish(document.querySelector(ghost));
  const positioned=make('team');positioned.style.visibility='hidden';document.body.append(positioned);await flush();check('measurement placeholders do not animate or reveal hidden panels',positioned.style.visibility==='hidden'&&!positioned.getAnimations().length);positioned.style.visibility='visible';await flush();check('entrance starts only after native position becomes visible',positioned.getAnimations().some(a=>a.effect.getTiming().duration===140));await finish(positioned);positioned.remove();await flush();if(document.querySelector(ghost))await finish(document.querySelector(ghost));
  const rapid=make('team');document.body.append(rapid);await flush();await finish(rapid);rapid.remove();await flush();const exiting=document.querySelector(ghost);if(exiting)exiting.getAnimations().forEach(a=>a.currentTime=50);const reopened=make('team');document.body.append(reopened);await flush();check('rapid reopen removes the old inert exit before continuing',!document.querySelector(ghost)&&reopened.getAnimations().length===1);reopened.remove();await flush();check('immediate close after reverse still has exactly one inert exit',document.querySelectorAll(ghost).length===1);if(document.querySelector(ghost))await finish(document.querySelector(ghost));
  const mounted=make('mcp');document.body.append(mounted);await flush();dispose();dispose=null;await flush();check('unload restores the live popup and removes every animation/ghost',!mounted.hasAttribute(attr)&&!mounted.getAnimations().length&&!document.querySelector(ghost)&&!mounted.style.getPropertyPriority('background'));
 }finally{if(dispose)dispose();if(cssDispose)cssDispose();nodes.forEach(n=>n.remove());sheets.forEach(s=>s.remove());await flush();}
 return{passed:results.filter(r=>r.pass).length,total:results.length,results};
};
