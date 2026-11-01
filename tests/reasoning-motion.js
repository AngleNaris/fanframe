window.runReasoningMotionRegression = async function () {
  const results=[], check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
  const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  const effects={};plugin.apply({effect(fn,n){effects[n]=fn;}});
  const originalMedia=window.matchMedia, media=new EventTarget();media.matches=false;window.matchMedia=()=>media;
  const style=document.createElement('style');
  style.textContent='.fixture_reasoning{display:flex;flex-direction:column}.fixture_reasoning:not([data-expanded]){contain:size layout;height:24px}';document.head.append(style);
  const scroller=document.createElement('div');scroller.dataset.chatFlow='';scroller.dataset.chatMotion='';scroller.style.cssText='height:400px;width:480px;overflow:auto;overflow-anchor:none';
  scroller.innerHTML='<div style="height:1200px">Earlier conversation</div><div class="fixture_reasoning" data-variant="think" data-state="running"><span style="position:absolute;width:1px;height:1px;overflow:hidden">Thinking</span><div style="display:flex;flex-direction:column"><div data-disclosure-header><div data-disclosure-row aria-expanded="false" role="button" tabindex="0" style="height:24px">Thinking</div></div></div></div>';
  document.body.append(scroller);
  const root=scroller.querySelector('[data-variant]'), header=root.querySelector('[data-disclosure-row]'), owner=header.parentElement.parentElement;
  const body=document.createElement('div');body.style.cssText='height:600px;flex:none;padding:4px 0;box-sizing:content-box';body.textContent='Reasoning text';
  let calls=0, commit, dispose;
  function toggle(){calls++;const open=header.getAttribute('aria-expanded')!=='true';header.setAttribute('aria-expanded',String(open));root.toggleAttribute('data-expanded',open);if(open)owner.append(body);else body.remove();commit={height:root.getBoundingClientRect().height,top:scroller.scrollTop};}
  header.onclick=toggle;header.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')toggle();};
  try {
    dispose=effects['fan-de-hai: card-disclosure-motion']();
    header.click();await flush();let animation=root.getAnimations()[0];
    check('actual reasoning row animates inside native chat scope',!!animation,root.getAnimations().length);
    animation.pause();animation.currentTime=90;let mid=root.getBoundingClientRect().height;
    check('reasoning opens from contained 24px to natural height',mid>24&&mid<632,mid);
    animation.finish();await flush();check('reasoning natural expanded height restored',Math.abs(root.getBoundingClientRect().height-632)<0.5&&root.style.height==='',root.getBoundingClientRect().height);
    scroller.scrollTop=99999;const before=scroller.scrollTop;
    header.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await flush();animation=root.getAnimations()[0];animation.pause();animation.currentTime=0;
    check('keyboard collapse preserves pre-animation scroll extent',commit.top===before&&Math.abs(commit.height-632)<0.5&&scroller.scrollTop===before,{before,commit,after:scroller.scrollTop});
    check('host receives original toggle exactly once',calls===2,calls);
    check('reasoning body remains removed during collapse',!body.isConnected&&!root.hasAttribute('data-expanded'),body.isConnected);
    animation.currentTime=90;mid=root.getBoundingClientRect().height;
    header.click();await flush();animation=root.getAnimations()[0];
    check('reasoning rapid reversal starts at visible height',Math.abs(parseFloat(animation.effect.getKeyframes()[0].height)-mid)<0.5,animation.effect.getKeyframes()[0].height);
    animation.finish();await flush();
    header.click();await flush();root.getAnimations()[0].finish();await flush();
    check('reasoning restores native collapsed containment',Math.abs(root.getBoundingClientRect().height-24)<0.5&&root.style.cssText===''&&getComputedStyle(root).contain.includes('size'),root.style.cssText);
    media.matches=true;header.click();await flush();check('reasoning reduced motion remains immediate',root.getAnimations().length===0&&body.isConnected,root.getAnimations().length);
    media.matches=false;header.click();await flush();dispose();dispose=null;
    check('reasoning unload restores height and state',root.getAnimations().length===0&&root.style.cssText===''&&!body.isConnected,root.style.cssText);
  }catch(e){check('unexpected exception',false,e.stack);}
  finally{if(dispose)dispose();scroller.remove();style.remove();window.matchMedia=originalMedia;}
  return {passed:results.filter(r=>r.pass).length,total:results.length,results};
};
