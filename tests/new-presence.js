// Real DOM/WAAPI over synthetic host-shaped nodes. Not product VIS/FLOW.
window.runNewContentPresenceRegression=async function(){
  const results=[],check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
  const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
  const effects={};plugin.apply({effect(fn,name){effects[name]=fn;}});
  const originalMedia=window.matchMedia,media=new EventTarget();media.matches=false;window.matchMedia=()=>media;
  const scene=document.createElement('div'),style=document.createElement('style');style.textContent='.presence_goalbar{box-sizing:border-box;height:36px;width:320px;display:flex;padding:4px 12px;align-items:center}.presence_goalbar.presence_editBar{height:auto;min-height:36px}.presence_echo{padding:8px;width:280px;box-sizing:border-box}';document.head.append(style);
  const flow=document.createElement('div');flow.dataset.chatFlow='';scene.append(flow);
  function user(key){const el=document.createElement('div');el.dataset.chatFlowKind='user';el.dataset.chatNodeKey=key;el.textContent='Synthetic persisted user';return el;}
  function echo(){const el=document.createElement('div');el.dataset.submissionEcho='true';el.className='presence_echo';el.innerHTML='<span>Synthetic local submission</span>';return el;}
  function todo(){const el=document.createElement('section');el.dataset.testid='todo-panel';el.innerHTML='<button aria-expanded="false">Synthetic tasks</button>';return el;}
  function goal(){const root=document.createElement('div');root.dataset.goalBar='true';root.innerHTML='<div class="presence_goalbar"><span>Synthetic objective</span><button>Edit</button></div>';return root;}
  const history=user('existing'),existingEcho=echo(),existingTodo=todo(),existingGoal=goal();flow.append(history,existingEcho);scene.append(existingTodo,existingGoal);document.body.append(scene);
  const opacity=e=>e.getAnimations().filter(a=>a.effect&&a.effect.getKeyframes().some(k=>'opacity'in k));
  let dispose,disclose,native;
  try{
    dispose=effects['fanframe: new-content-presence']();
    check('initial history, pending echo and docks do not replay entry',![history,existingEcho,existingTodo,existingGoal.firstElementChild].some(e=>opacity(e).length),null);
    const tasks=todo();scene.append(tasks);await flush();let a=opacity(tasks)[0];check('new task dock fades for exactly 140ms',!!a&&a.effect.getTiming().duration===140,a&&a.effect.getTiming());
    check('dock entry changes opacity only with no inline layout residue',!!a&&a.effect.getKeyframes().every(k=>!('height'in k)&&!('transform'in k))&&tasks.style.cssText==='',a&&a.effect.getKeyframes());
    const originalTaskAnimation=a;tasks.querySelector('button').textContent='Updated synthetic counts';await flush();check('task content update never repeats entry',opacity(tasks)[0]===originalTaskAnimation,opacity(tasks).length);
    a.finish();await flush();check('completed entry restores native opacity and removes animation',opacity(tasks).length===0&&getComputedStyle(tasks).opacity==='1',getComputedStyle(tasks).opacity);
    const target=goal();scene.append(target);await flush();const bar=target.firstElementChild;a=opacity(bar)[0];check('new objective fades on styled bar, not shared dock',!!a&&a.effect.getTiming().duration===140&&!opacity(target).length,null);
    disclose=effects['fan-de-hai: card-disclosure-motion']();bar.classList.add('presence_editBar');bar.innerHTML='<div contenteditable="true" style="height:92px">Unchanged synthetic objective draft</div><button>Cancel</button>';await flush();
    const height=bar.getAnimations().find(a=>a.effect.getKeyframes().some(k=>'height'in k));check('140ms entry and existing 180ms edit expansion coexist',!!height&&height.effect.getTiming().duration===180&&opacity(bar).length===1,bar.getAnimations().map(a=>a.effect.getTiming().duration));
    bar.getAnimations().forEach(a=>a.finish());await flush();disclose();disclose=null;
    const scroller=document.createElement('div');scroller.style.cssText='height:120px;overflow:auto;width:400px';const space=document.createElement('div');space.style.height='900px';scroller.append(space,flow);scene.append(scroller);scroller.scrollTop=300;
    const pending=echo();flow.append(pending);await flush();a=opacity(pending)[0];const geometry=pending.getBoundingClientRect();check('new local transcript echo starts one 140ms entry',!!a&&a.effect.getTiming().duration===140&&opacity(pending).length===1,null);
    a.pause();a.currentTime=70;const from=parseFloat(getComputedStyle(pending).opacity);check('entry has visible intermediate opacity without changing size or scroll',from>0&&from<1&&pending.getBoundingClientRect().height===geometry.height&&scroller.scrollTop===300,{opacity:from,scrollTop:scroller.scrollTop});
    pending.querySelector('span').textContent='Synthetic content updated';await flush();check('echo content updates do not restart the active fade',opacity(pending)[0]===a,null);
    const durable=user('new-durable');pending.remove();flow.append(durable);await flush();a=opacity(durable)[0];check('single same-batch echo acknowledgement transfers remaining duration',!!a&&Math.abs(a.effect.getTiming().duration-70)<.01,a&&a.effect.getTiming().duration);
    check('durable replacement continues from current opacity instead of zero',!!a&&Math.abs(Number(a.effect.getKeyframes()[0].opacity)-from)<.001,a&&a.effect.getKeyframes());
    check('transfer leaves authoritative row, key and text unchanged',durable.dataset.chatNodeKey==='new-durable'&&durable.textContent==='Synthetic persisted user'&&pending.isConnected===false,null);
    if(a)a.finish();await flush();
    const older=user('older');flow.prepend(older);await flush();check('prepend of older persisted history never animates',opacity(older).length===0,null);
    const external=user('external-without-echo');flow.append(external);await flush();check('durable rows without local echo proof are not guessed to be sends',opacity(external).length===0,null);
    const queue=document.createElement('div');queue.dataset.composerSeat='';const queued=echo();queue.append(queued);scene.append(queue);await flush();check('composer queue echoes outside chat are untouched',opacity(queued).length===0,null);
    const two=[echo(),echo()];flow.append(...two);await flush();const commits=[user('one'),user('two')];two.forEach(e=>e.remove());flow.append(...commits);await flush();check('ambiguous multi-submit acknowledgements never replay or guess a pairing',commits.every(e=>opacity(e).length===0),null);
    const nativeEcho=echo();native=nativeEcho.animate([{opacity:.2},{opacity:1}],{duration:500,fill:'both'});native.pause();flow.append(nativeEcho);await flush();check('existing native opacity animation keeps sole ownership',opacity(nativeEcho).length===1&&opacity(nativeEcho)[0]===native,native.effect.getTiming().duration);
    const unmounted=todo();scene.append(unmounted);await flush();unmounted.remove();await flush();check('removed dock has no retained entry animation',opacity(unmounted).length===0,null);
    const openFlow=document.createElement('div');openFlow.dataset.chatFlow='';const first=echo();openFlow.append(first);scene.append(openFlow);await flush();check('first send in a newly mounted flow still fades',opacity(first).length===1,null);
    media.matches=true;media.dispatchEvent(new Event('change'));await flush();check('reduced-motion switch cancels owned entry jobs, not native ones',opacity(first).length===0&&opacity(nativeEcho)[0]===native,null);
    const reduced=todo(),reducedEcho=echo();scene.append(reduced);flow.append(reducedEcho);await flush();check('new content under reduced motion appears immediately',opacity(reduced).length===0&&opacity(reducedEcho).length===0,null);
    media.matches=false;const last=echo();flow.append(last);await flush();dispose();dispose=null;check('unload cancels entry and preserves mounted content and native animation',opacity(last).length===0&&last.isConnected&&opacity(nativeEcho)[0]===native,null);
  }catch(error){check('unexpected exception',false,error.stack);}
  finally{if(disclose)disclose();if(dispose)dispose();if(native)native.cancel();scene.remove();style.remove();window.matchMedia=originalMedia;}
  return{passed:results.filter(r=>r.pass).length,total:results.length,results};
};
