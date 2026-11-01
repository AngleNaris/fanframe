window.runQuestionMotionRegression = async function () {
  const results=[], check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
  const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  const effects={};plugin.apply({effect(fn,n){effects[n]=fn;}});
  const originalMedia=window.matchMedia, media=new EventTarget();media.matches=false;window.matchMedia=()=>media;
  const style=document.createElement('style');
  style.textContent='.fixture_qframe{display:flex;justify-content:center;padding:6px 16px 10px}.fixture_qcard{display:flex;flex-direction:column;box-sizing:border-box;width:100%;max-height:min(60vh,520px);padding:0 0 10px;overflow:hidden}.fixture_qcard *{box-sizing:border-box}.fixture_qcard.min{max-height:none}.fixture_qcard>header{display:flex;flex-shrink:0;padding:20px 16px 0 24px}.fixture_qcard.min>header{padding-bottom:14px}.fixture_qcard [data-question-scroll]{display:flex;flex-direction:column;flex:auto;min-height:0;overflow-y:auto}.fixture_qcard>footer{display:flex;flex-shrink:0;height:24px;margin-top:12px;padding:0 10px 0 18px}';document.head.append(style);
  const scroller=document.createElement('div');scroller.style.cssText='height:400px;width:600px;overflow:auto;overflow-anchor:none';
  scroller.innerHTML='<div style="height:1200px">Conversation</div><div data-composer-seat style="display:flex;flex-direction:column"><div style="height:160px;flex:none">Composer</div></div>';
  document.body.append(scroller);const seat=scroller.querySelector('[data-composer-seat]');
  const frame=document.createElement('div');frame.dataset.questionKey='fixture';frame.className='fixture_qframe';
  frame.innerHTML='<section class="fixture_qcard"><header><button aria-expanded="true" style="height:24px;padding:0;border:0">Minimize</button></header><div data-question-scroll><div style="height:700px;flex:none">Question choices</div></div><footer>Answer</footer></section>';
  const root=frame.firstElementChild, button=root.querySelector('button'), body=root.querySelector('[data-question-scroll]'), footer=root.querySelector('footer');
  let dispose,disposePresence,commit,calls=0;
  button.onclick=()=>{calls++;const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));root.classList.toggle('min',!open);if(open){root.append(body,footer);}else{body.remove();footer.remove();}commit={height:root.getBoundingClientRect().height,top:scroller.scrollTop};};
  const heightAnimation=()=>root.getAnimations().find(a=>a.effect.getKeyframes().some(k=>'height' in k));
  try {
    dispose=effects['fan-de-hai: card-disclosure-motion']();disposePresence=effects['fan-de-hai: question-presence-motion']();
    seat.replaceChildren(frame);await flush();
    check('question takeover fades actual card in',root.getAnimations().some(a=>a.effect.getKeyframes().some(k=>'opacity' in k)),root.getAnimations().length);
    root.getAnimations().forEach(a=>a.finish());await flush();const full=root.getBoundingClientRect().height;
    check('question retains native viewport cap and scroll body',Math.abs(full-Math.min(innerHeight*0.6,520))<1&&body.scrollHeight>body.clientHeight,{full,body:body.clientHeight,scroll:body.scrollHeight});
    scroller.scrollTop=99999;const before=scroller.scrollTop;button.click();await flush();let animation=heightAnimation();animation.pause();animation.currentTime=0;
    check('question minimize has no early scroll clamp',commit.top===before&&scroller.scrollTop===before,{before,commit,after:scroller.scrollTop});
    animation.currentTime=90;const mid=root.getBoundingClientRect().height;
    check('question actual card shrinks gradually',mid>68&&mid<full,mid);
    check('question body and footer remain host-unmounted',!body.isConnected&&!footer.isConnected,calls);
    animation.finish();await flush();check('question restores native minimized height and frame style',Math.abs(root.getBoundingClientRect().height-68)<0.5&&root.style.cssText===''&&frame.style.cssText==='',{height:root.getBoundingClientRect().height,style:frame.style.cssText});
    button.click();await flush();animation=heightAnimation();animation.finish();await flush();
    check('question expansion measures natural capped flex layout',Math.abs(root.getBoundingClientRect().height-full)<0.5&&body.isConnected,root.getBoundingClientRect().height);
    body.innerHTML='<div style="height:80px;flex:none">Next shorter question</div>';await flush();animation=heightAnimation();
    check('question page content height change animates',!!animation,root.getAnimations().length);
    animation.finish();await flush();check('short question settles without stale height',Math.abs(root.getBoundingClientRect().height-170)<0.5&&root.style.height==='',root.getBoundingClientRect().height);
    button.click();await flush();media.matches=true;media.dispatchEvent(new Event('change'));await flush();
    check('question reduced motion releases all height ownership',root.getAnimations().length===0&&root.style.cssText===''&&frame.style.cssText==='',root.style.cssText);
    media.matches=false;seat.innerHTML='<div style="height:160px;flex:none">Composer restored</div>';await flush();
    check('question exit fades restored input without ghost question',seat.getAnimations().length===1&&!seat.querySelector('[data-question-key]'),seat.innerHTML);
    check('question exit never writes shared seat height or scroll position',seat.style.height===''&&scroller.style.overflowAnchor==='none',seat.style.cssText);
    disposePresence();disposePresence=null;dispose();dispose=null;
    check('question presence cleanup removes all effects',seat.getAnimations().length===0&&seat.style.opacity==='',seat.style.cssText);
  }catch(e){check('unexpected exception',false,e.stack);}
  finally{if(dispose)dispose();if(disposePresence)disposePresence();scroller.remove();style.remove();window.matchMedia=originalMedia;}
  return {passed:results.filter(r=>r.pass).length,total:results.length,results};
};
