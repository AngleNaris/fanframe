window.runRegression=async function(){
  const results=[];const assert=(name,ok,actual)=>{results.push({name,pass:!!ok,actual});};
  const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  const media=new EventTarget();media.matches=false;
  const originalMedia=window.matchMedia;window.matchMedia=()=>media;
  const originalRAF=window.requestAnimationFrame;
  const originalCAF=window.cancelAnimationFrame;
  const previousSort=localStorage.getItem('fan_plugin_sort_mode');
  const originalSet=CSSStyleDeclaration.prototype.setProperty;
  const originalAdd=document.addEventListener, originalRemove=document.removeEventListener;
  let dispose,cssDispose,root;
  try{
    // Real browser animations, deterministic finish(), no sleep or timing guesses.
    root=document.createElement('div');root.setAttribute('data-chat-flow','');
    const owner=document.createElement('div');owner.setAttribute('data-step-process','');
    const button=document.createElement('button');button.setAttribute('aria-controls','regression-body');
    const body=document.createElement('div');body.id='regression-body';body.setAttribute('data-step-process-body','');
    body.innerHTML='<div style="height:120px">fixture content</div>';owner.append(button,body);root.append(owner);document.body.append(root);
    const baseline='height: 160px; overflow: auto; opacity: 0.7; margin-top: 8px; transition: color 2s linear;';body.setAttribute('style',baseline);
    dispose=effects['fan-de-hai: disclosure-motion']();
    body.setAttribute('hidden','until-found');await flush();
    assert('collapse preserves application hidden',body.getAttribute('hidden')==='until-found',body.getAttribute('hidden'));
    assert('collapse starts actual animation',body.getAnimations().length===1,body.getAnimations().length);
    body.removeAttribute('hidden');await flush();
    let anims=body.getAnimations();assert('rapid reversal has one current animation',anims.length===1,anims.length);
    anims.forEach(a=>a.finish());await flush();
    assert('rapid reversal remains open',!body.hasAttribute('hidden'),body.getAttribute('hidden'));
    assert('host styles restored exactly',body.getAttribute('style')===baseline,body.getAttribute('style'));
    body.setAttribute('hidden','until-found');await flush();const oldAnimations=body.getAnimations();dispose();dispose=null;
    assert('dispose cancels all running animations',body.getAnimations().length===0,body.getAnimations().length);
    body.removeAttribute('hidden');await flush();
    assert('disposed code cannot rehide',!body.hasAttribute('hidden'),body.getAttribute('hidden'));
    assert('dispose preserves styles',body.getAttribute('style')===baseline,body.getAttribute('style'));
    dispose=effects['fan-de-hai: disclosure-motion']();
    const other=document.createElement('div');other.innerHTML='<div style="height:120px">settings</div>';document.body.appendChild(other);other.hidden=true;await flush();
    assert('non-chat hidden untouched',other.hidden&&other.getAnimations().length===0,{hidden:other.hidden,animations:other.getAnimations().length});other.remove();
    root.dataset.chatMotion='';body.setAttribute('hidden','until-found');await flush();
    assert('native scope not double animated',body.getAnimations().length===0,body.getAnimations().length);
    root.removeAttribute('data-chat-motion');body.removeAttribute('hidden');await flush();root.dataset.chatMotion='';await flush();
    assert('native takeover cancels fallback',body.getAnimations().length===0,body.getAnimations().length);root.removeAttribute('data-chat-motion');
    body.setAttribute('hidden','until-found');await flush();media.matches=true;media.dispatchEvent(new Event('change'));await flush();
    assert('live reduced motion cancels animation',body.getAnimations().length===0&&body.hasAttribute('hidden'),body.getAnimations().length);
    body.removeAttribute('hidden');await flush();assert('reduced motion is immediate',body.getAnimations().length===0,body.getAnimations().length);
    media.matches=false;body.setAttribute('hidden','until-found');await flush();body.dispatchEvent(new Event('beforematch',{bubbles:true}));body.removeAttribute('hidden');await flush();
    assert('browser find reveal not delayed',body.getAnimations().length===0,body.getAnimations().length);
    body.setAttribute('hidden','until-found');await flush();body.remove();await flush();assert('removed node animation canceled',body.getAnimations().length===0,body.getAnimations().length);
    dispose();dispose=null;root.remove();root=null;

    // List fixtures: actual effect, scoped DOM, counted writes, controlled RAF.
    let frames=[],writes=0,added=0,removed=0;
    window.requestAnimationFrame=cb=>(frames.push(cb),frames.length);
    window.cancelAnimationFrame=id=>{if(id>0&&id<=frames.length)frames[id-1]=()=>{};};
    const drain=async()=>{for(let i=0;i<12;i++){await flush();if(!frames.length)break;const f=frames.splice(0);f.forEach(cb=>cb(0));}await flush();};
    document.addEventListener=function(type,...args){if(type==='click'||type==='keydown')added++;return originalAdd.call(this,type,...args);};
    document.removeEventListener=function(type,...args){if(type==='click'||type==='keydown')removed++;return originalRemove.call(this,type,...args);};
    CSSStyleDeclaration.prototype.setProperty=function(key,...args){if(key==='order')writes++;return originalSet.call(this,key,...args);};
    const panel=document.createElement('section');panel.dataset.pluginPanel='true';document.body.append(panel);root=panel;
    function makeSection(){const s=document.createElement('section');s.dataset.pluginGroup='bundles';s.innerHTML='<div class="fixture_groupHead">Installed</div><ul class="fixture_cards" style="display:flex;flex-direction:column"></ul>';const ul=s.querySelector('ul');for(let i=0;i<50;i++){const li=document.createElement('li');li.dataset.pluginPackage='fixture-'+i;li.innerHTML='<span class="fixture_cardTitle">Plugin '+i+'</span><span class="fixture_cardDesc">Description</span>';ul.append(li);}panel.append(s);return s;}
    let section=makeSection();const first=section.querySelector('li');first.style.order='7';
    localStorage.setItem('fan_plugin_sort_mode','name-desc');cssDispose=effects['fan-de-hai: opaque-model-select']();dispose=effects['fan-de-hai: plugin-manager-search-sort']();await drain();
    assert('toolbar before installed list',section.querySelector('.fan-plugin-toolbar').nextElementSibling.matches('ul'),section.children[1].className);
    const baseWrites=writes;
    for(let i=0;i<10;i++){const unrelated=document.createElement('span');unrelated.textContent='streaming';document.body.append(unrelated);await drain();unrelated.remove();await drain();}
    assert('zero reranks for 20 unrelated mutations',writes===baseWrites,{extraWrites:writes-baseWrites});
    for(let i=0;i<5;i++){section.remove();await drain();section=makeSection();await drain();}
    assert('constant document listeners across remounts',added===1,{added,removed});
    let input=section.querySelector('input'),clear=section.querySelector('.fan-search-clear');
    assert('custom clear does not duplicate native search cancel',input.type==='text',input.type);
    assert('clear button really hidden when query empty',getComputedStyle(clear).display==='none',getComputedStyle(clear).display);
    const trigger=section.querySelector('.fan-select-trigger'),dropdown=section.querySelector('.fan-select-dropdown');
    trigger.click();dropdown.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));dropdown.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await drain();
    assert('keyboard selects last sort option',localStorage.getItem('fan_plugin_sort_mode')==='name-desc',localStorage.getItem('fan_plugin_sort_mode'));
    assert('sort selection restores focus',document.activeElement===trigger,document.activeElement.className);
    assert('dropdown has an exit animation',dropdown.getAnimations().length===1&&!dropdown.hidden,{animations:dropdown.getAnimations().length,hidden:dropdown.hidden});
    dropdown.getAnimations().forEach(a=>a.finish());await flush();assert('dropdown hidden after exit',dropdown.hidden,dropdown.hidden);
    trigger.click();dropdown.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));trigger.click();dropdown.getAnimations().forEach(a=>a.finish());await flush();
    assert('popup rapid reopen wins',!dropdown.hidden&&trigger.getAttribute('aria-expanded')==='true',dropdown.hidden);
    assert('date sorting is not fabricated',!dropdown.textContent.includes('日期'),dropdown.textContent);
    input.value='NONEXISTENT_A';input.dispatchEvent(new Event('input'));await drain();input.value='NONEXISTENT_B';input.dispatchEvent(new Event('input'));await drain();
    assert('empty message follows latest query',section.querySelector('.fan-no-match-tip').textContent.includes('NONEXISTENT_B'),section.querySelector('.fan-no-match-tip').textContent);
    clear.click();await drain();assert('clear restores visible list',[...section.querySelectorAll('li')].every(c=>c.style.display!== 'none'),section.querySelector('li').style.display);
    input.value='nothing-matches';input.dispatchEvent(new Event('input'));await drain();
    const unrelated=document.createElement('div');unrelated.style.order='77';document.body.append(unrelated);
    const card=section.querySelector('li');dispose();dispose=null;await drain();
    assert('unload restores filtered card',card.style.display!=='none',card.style.display);
    assert('unrelated style preserved',unrelated.style.order==='77',unrelated.style.order);
    assert('all document listeners disposed',added===removed,{added,removed});unrelated.remove();
    const host=document.createElement('div');host.className='host_card';host.style.transition='height 180ms ease, opacity 180ms ease';document.body.append(host);
    assert('host height transition preserved',getComputedStyle(host).transitionProperty.includes('height'),getComputedStyle(host).transitionProperty);host.remove();
    const h=document.createElement('h1');h.style.color='rgb(10, 20, 30)';document.body.append(h);assert('settings heading not recolored',getComputedStyle(h).color==='rgb(10, 20, 30)',getComputedStyle(h).color);h.remove();
    cssDispose();cssDispose=null;panel.remove();root=null;
  }catch(e){results.push({name:'unexpected exception',pass:false,actual:e.stack});}
  finally{if(dispose)dispose();if(cssDispose)cssDispose();if(root)root.remove();window.matchMedia=originalMedia;window.requestAnimationFrame=originalRAF;window.cancelAnimationFrame=originalCAF;CSSStyleDeclaration.prototype.setProperty=originalSet;document.addEventListener=originalAdd;document.removeEventListener=originalRemove;if(previousSort===null)localStorage.removeItem('fan_plugin_sort_mode');else localStorage.setItem('fan_plugin_sort_mode',previousSort);}
  window.lastResults={passed:results.filter(r=>r.pass).length,total:results.length,results};return window.lastResults;
};
