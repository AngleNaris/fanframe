// Browser/WAAPI engineering regressions. Synthetic nodes, NOT product VIS/FLOW.
window.runFirstMountRegression=async function(){
  const results=[],check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
  const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
  const hooks={};plugin.apply({effect(fn,name){hooks[name]=fn;}});
  const original=window.matchMedia,media=new EventTarget();media.matches=false;window.matchMedia=()=>media;
  const scene=document.createElement('div');document.body.append(scene);
  const todo=()=>{const e=document.createElement('section');e.dataset.testid='todo-panel';e.style.width='320px';e.innerHTML='<div style="height:40px"><button aria-expanded="false">Synthetic tasks</button></div>';return e;};
  const goal=()=>{const e=document.createElement('div');e.dataset.goalBar='true';e.innerHTML='<div style="height:36px;width:320px">Synthetic goal</div>';return e;};
  const animations=(e,key)=>e.getAnimations().filter(a=>a.effect.getKeyframes().some(k=>key in k));
  const dock=document.createElement('div');dock.dataset.composerDock='';dock.innerHTML='<div data-slot="conversation.composer.dock" style="display:contents"></div>';scene.append(dock);
  const stat=kind=>{const e=document.createElement('span');e.dataset.composerStat=kind;e.innerHTML='<button aria-haspopup="dialog">Synthetic '+kind+'</button>';return e;};
  const old=todo(),oldStat=stat('usage');scene.append(old);dock.firstChild.append(oldStat);
  let layout,presence,native;
  try{
    presence=hooks['fanframe: new-content-presence']();layout=hooks['fanframe: dock-first-layout']();
    check('initial task and footer history do not replay',old.getAnimations().length===0&&oldStat.getAnimations().length===0);
    const task=todo();scene.append(task);await flush();let h=animations(task,'height')[0],fade=animations(task,'opacity')[0];
    check('new task owns independent 180ms geometry and 140ms fade',h&&fade&&h.effect.getTiming().duration===180&&fade.effect.getTiming().duration===140);
    h.pause();h.currentTime=90;const mid=task.getBoundingClientRect().height;
    check('first task has a real intermediate occupied height',mid>0&&mid<40,mid);
    h.finish();fade.finish();await flush();
    check('finished task restores natural geometry and all owned inline properties',task.getBoundingClientRect().height===40&&task.style.cssText==='width: 320px;',task.style.cssText);
    const objective=goal();scene.append(objective);await flush();h=animations(objective,'height')[0];
    check('goal geometry belongs to outer dock; opacity belongs to inner bar',h&&animations(objective,'opacity').length===0&&animations(objective.firstChild,'opacity').length===1);
    h.pause();h.currentTime=90;check('goal also occupies a partial height',objective.getBoundingClientRect().height>0&&objective.getBoundingClientRect().height<36,objective.getBoundingClientRect().height);
    objective.firstChild.dispatchEvent(new Event('focusin',{bubbles:true}));await flush();
    check('focus releases first-mount geometry immediately without losing content',animations(objective,'height').length===0&&objective.textContent==='Synthetic goal'&&objective.style.cssText==='');
    const clicked=todo();scene.append(clicked);await flush();clicked.querySelector('button').dispatchEvent(new MouseEvent('click',{bubbles:true}));await flush();
    check('interaction yields height ownership to native disclosure',animations(clicked,'height').length===0);
    const changed=todo();scene.append(changed);await flush();changed.firstChild.append(document.createElement('p'));await flush();
    check('structural update cancels stale first-mount geometry',animations(changed,'height').length===0);
    const guarded=todo();native=guarded.animate([{height:'10px'},{height:'40px'}],{duration:1000,fill:'both'});native.pause();scene.append(guarded);await flush();
    check('an existing native height animator retains sole geometry ownership',animations(guarded,'height').length===1&&animations(guarded,'height')[0]===native);
    const usage=stat('usage'),activity=stat('activity');dock.firstChild.append(usage,activity);await flush();
    check('new cache usage and activity each fade for 140ms',animations(usage,'opacity')[0]?.effect.getTiming().duration===140&&animations(activity,'opacity')[0]?.effect.getTiming().duration===140);
    const saved=animations(usage,'opacity')[0];usage.querySelector('button').firstChild.data='42k · cache 81%';await flush();
    check('numeric-only footer changes do not restart the fade',animations(usage,'opacity')[0]===saved);
    const context=document.createElement('span');context.innerHTML='<button aria-haspopup="dialog">42%</button>';dock.append(context);await flush();
    check('direct native context meter fades without a hashed CSS selector',animations(context,'opacity').length===1);
    const unrelated=document.createElement('span');unrelated.innerHTML='<button aria-haspopup="dialog">Not a composer stat</button>';scene.append(unrelated);await flush();
    check('unrelated dialog triggers remain untouched',unrelated.getAnimations().length===0);
    const removed=todo();scene.append(removed);await flush();removed.remove();await flush();
    check('unmount cancels first-layout animations and inline ownership',removed.getAnimations().length===0&&removed.style.cssText==='width: 320px;',removed.style.cssText);
    const reduced=todo();scene.append(reduced);await flush();media.matches=true;media.dispatchEvent(new Event('change'));await flush();
    check('reduced-motion transition settles both owned effects, not native animation',reduced.getAnimations().length===0&&guarded.getAnimations().includes(native));
    const instant=todo(),instantStat=stat('activity');scene.append(instant);dock.firstChild.append(instantStat);await flush();
    check('new content under reduced motion appears instantly',instant.getAnimations().length===0&&instantStat.getAnimations().length===0);
    media.matches=false;const final=goal();scene.append(final);await flush();layout();layout=null;presence();presence=null;await flush();
    check('unload releases geometry, footer opacity and contents',final.style.cssText===''&&final.getAnimations().length===0&&final.firstChild.getAnimations().length===0&&usage.getAnimations().length===0&&final.isConnected);
  }catch(error){check('unexpected exception',false,error.stack);}
  finally{if(layout)layout();if(presence)presence();if(native)native.cancel();scene.remove();window.matchMedia=original;}
  return{passed:results.filter(r=>r.pass).length,total:results.length,results};
};
