window.runScrollMotionRegression = async function () {
  const results=[], check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
  const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  const effects={};plugin.apply({effect(fn,n){effects[n]=fn;}});
  const originalMedia=window.matchMedia, media=new EventTarget();media.matches=false;window.matchMedia=()=>media;
  const scroller=document.createElement('div');
  // The shipped following-tail state disables browser overflow anchoring.
  // Even then, a transient smaller scrollHeight clamps scrollTop synchronously.
  scroller.style.cssText='height:400px;overflow:auto;overflow-anchor:none;width:400px';
  scroller.innerHTML='<div style="height:1600px">Conversation</div><section data-testid="todo-panel" style="box-sizing:border-box;overflow:hidden"><div style="display:flex;flex-direction:column;gap:8px;padding:6px 12px"><button aria-expanded="true" style="height:24px;padding:0;border:0">Tasks</button><ul style="height:180px;margin:0;padding:0">Tasks</ul></div></section>';
  document.body.append(scroller);
  const root=scroller.querySelector('section'), button=root.querySelector('button'), list=root.querySelector('ul'), body=button.parentElement;
  let dispose, commit, clicks=0;
  const toggle=()=>{clicks++;const open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open));if(open)list.remove();else body.append(list);commit={top:scroller.scrollTop,height:root.getBoundingClientRect().height};};
  button.onclick=toggle;
  try {
    dispose=effects['fan-de-hai: card-disclosure-motion']();
    scroller.scrollTop=99999;const before=scroller.scrollTop;
    button.click();await flush();let animation=root.getAnimations()[0];animation.pause();animation.currentTime=0;
    check('collapse commit never releases scroll extent early',commit.top===before&&commit.height===224,commit);
    check('collapse animation start has zero scroll jump',scroller.scrollTop===before,{before,after:scroller.scrollTop});
    check('original click delivered exactly once',clicks===1,clicks);
    animation.currentTime=90;const mid={top:scroller.scrollTop,height:root.getBoundingClientRect().height};
    check('scroll extent shrinks with animated geometry',mid.top<before&&mid.top>1236&&Math.abs(mid.top-(1200+mid.height))<1,mid);
    animation.finish();await flush();
    check('collapse ends at natural height without inline lock',root.getBoundingClientRect().height===36&&root.style.height==='',root.style.cssText);
    button.click();await flush();root.getAnimations()[0].finish();await flush();
    check('opening still reaches full natural height',root.getBoundingClientRect().height===224,root.getBoundingClientRect().height);
    scroller.scrollTop=500;button.click();await flush();animation=root.getAnimations()[0];animation.pause();animation.currentTime=90;
    check('reader above tail is not scrolled',scroller.scrollTop===500,scroller.scrollTop);
    animation.finish();await flush();check('reader stays put after collapse completes',scroller.scrollTop===500,scroller.scrollTop);
    button.onclick=null;button.click();await new Promise(requestAnimationFrame);await flush();
    check('no-op click releases pre-toggle lock',root.style.height===''&&root.getAnimations().length===0,root.style.cssText);
    button.onclick=toggle;button.click();await flush();dispose();dispose=null;
    check('unload clears height lock without removing list',root.style.height===''&&list.isConnected&&root.getAnimations().length===0,root.style.cssText);
  }catch(e){check('unexpected exception',false,e.stack);}
  finally{if(dispose)dispose();scroller.remove();window.matchMedia=originalMedia;}
  return {passed:results.filter(r=>r.pass).length,total:results.length,results};
};
