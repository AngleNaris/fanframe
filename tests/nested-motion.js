// Host evidence: web-frontend.readable.txt:6439–6467, 6580–6646.
// Real browser geometry/WAAPI; structural fixtures are NOT product VIS/FLOW.
window.runNestedOutputRegression = async function () {
  const results=[], check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
  const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
  const effects={};plugin.apply({effect(fn,n){effects[n]=fn;}});
  const originalMedia=window.matchMedia, media=new EventTarget();media.matches=false;window.matchMedia=()=>media;
  const scroller=document.createElement('div');scroller.style.cssText='height:400px;overflow:auto;overflow-anchor:none;width:480px';
  scroller.innerHTML='<div style="height:1600px">Conversation</div><div data-chat-flow></div>';document.body.append(scroller);
  const flow=scroller.lastElementChild;let dispose,cssDispose;
  function fixture(kind){
    const root=document.createElement('div');root.setAttribute('data-'+kind,'');root.style.cssText='display:flex;flex-direction:column';
    root.innerHTML='<div style="height:24px;flex:none">Output header</div><div style="flex:1 1 auto"><div style="height:24px">Head</div><button style="display:block;height:24px;border:0;padding:0" aria-expanded="false">More</button><div style="height:24px">Tail</div></div>';
    const body=root.lastElementChild,button=body.querySelector('button'),extras=[];let calls=0,commit;
    for(let i=0;i<8;i++){const line=document.createElement('div');line.style.height='24px';line.textContent='Line '+i;extras.push(line);}
    const set=open=>{button.setAttribute('aria-expanded',String(open));extras.forEach(line=>open?body.insertBefore(line,button):line.remove());};
    button.onclick=()=>{calls++;set(button.getAttribute('aria-expanded')!=='true');commit={height:root.getBoundingClientRect().height,top:scroller.scrollTop};};
    flow.append(root);return{root,body,button,extras,set,calls:()=>calls,commit:()=>commit};
  }
  const motion=root=>root.getAnimations().find(a=>a.effect.getKeyframes().some(k=>'height' in k));
  async function finish(root){const a=motion(root);if(a)a.finish();await flush();}
  try{
    cssDispose=effects['fan-de-hai: opaque-model-select']();dispose=effects['fan-de-hai: card-disclosure-motion']();
    for(const kind of ['terminal','read','diff','search']){
      const f=fixture(kind);await flush();f.button.click();await flush();let a=motion(f.root);
      check(kind+' inner expansion has height motion',!!a,f.root.style.cssText);
      if(a){a.pause();a.currentTime=0;check(kind+' first frame retains 96px closed shell',Math.abs(f.root.getBoundingClientRect().height-96)<.5,f.root.getBoundingClientRect().height);await finish(f.root);}
      check(kind+' settles at real output height without inline lock',Math.abs(f.root.getBoundingClientRect().height-288)<.5&&!f.root.style.height,f.root.getBoundingClientRect().height);
      scroller.scrollTop=99999;const before=scroller.scrollTop;f.button.click();await flush();a=motion(f.root);if(a){a.pause();a.currentTime=0;}
      check(kind+' first collapse does not clamp the tail early',!!a&&f.commit().top===before&&scroller.scrollTop===before,{before,commit:f.commit(),after:scroller.scrollTop});
      check(kind+' original click delivered once per action',f.calls()===2,f.calls());await finish(f.root);
      f.set(true);await flush();await finish(f.root);scroller.scrollTop=99999;const cached=scroller.scrollTop;
      f.set(false);await flush();a=motion(f.root);if(a){a.pause();a.currentTime=0;}
      check(kind+' observer locks cached extent before a programmatic-close layout read',!!a&&scroller.scrollTop===cached,{before:cached,after:scroller.scrollTop});await finish(f.root);
      const streaming=document.createElement('div');streaming.style.height='24px';f.body.append(streaming);await flush();
      check(kind+' ordinary streaming update is not treated as a toggle',!motion(f.root),f.root.getAnimations().length);streaming.remove();await flush();
      if(kind==='search'){
        const file=document.createElement('button');file.setAttribute('aria-expanded','true');file.style.cssText='display:block;height:24px;padding:0;border:0';file.textContent='file.ts';
        const match=document.createElement('div');match.style.height='48px';match.textContent='Matches';f.body.append(file,match);await flush();await finish(f.root);
        file.onclick=()=>{file.setAttribute('aria-expanded','false');match.remove();};file.click();await flush();
        check('search responds to a secondary file header, not only its first control',!!motion(f.root),f.root.getAnimations().length);await finish(f.root);
      }
    }
    const tree=document.createElement('div');tree.setAttribute('role','tree');flow.append(tree);
    const json=document.createElement('div');json.setAttribute('role','treeitem');json.setAttribute('aria-expanded','false');json.style.lineHeight='24px';
    json.innerHTML='<span data-json-expander role="button" tabindex="0" aria-expanded="false" style="display:inline-block;height:24px;width:20px;vertical-align:top">+</span><span>Object:</span>';
    const expander=json.firstElementChild,children=document.createElement('ul');children.setAttribute('role','group');children.style.cssText='height:180px;margin:0;padding:0';children.textContent='Nested members';tree.append(json);
    const setJson=open=>{json.setAttribute('aria-expanded',String(open));expander.setAttribute('aria-expanded',String(open));if(open)json.append(children);else children.remove();};
    expander.onclick=()=>setJson(expander.getAttribute('aria-expanded')!=='true');
    expander.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();setJson(e.key==='ArrowRight');}};
    await flush();expander.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await flush();let a=motion(json);
    check('JSON ArrowRight first expansion has motion',!!a,json.getAnimations().length);await finish(json);
    check('JSON mixed-inline row reaches exact original natural height',Math.abs(json.getBoundingClientRect().height-204)<.5&&!json.style.height,json.getBoundingClientRect().height);
    scroller.scrollTop=99999;const beforeJson=scroller.scrollTop;expander.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await flush();a=motion(json);if(a){a.pause();a.currentTime=0;}
    check('JSON ArrowLeft first collapse retains the scroll extent',!!a&&scroller.scrollTop===beforeJson,{before:beforeJson,after:scroller.scrollTop});await finish(json);
    check('JSON natural inline baseline is restored after collapse',json.getBoundingClientRect().height===24&&tree.style.height==='',json.getBoundingClientRect().height);
    const stringRow=document.createElement('div');stringRow.setAttribute('role','treeitem');tree.append(stringRow);
    function renderString(open){stringRow.innerHTML='<'+(open?'div':'span')+' data-expanded="'+open+'" style="display:block;height:'+(open?220:48)+'px"><button aria-controls="string-value" aria-expanded="'+open+'">'+(open?'Collapse':'Expand')+'</button></'+(open?'div':'span')+'>';stringRow.querySelector('button').onclick=()=>renderString(!open);}
    renderString(false);await flush();stringRow.querySelector('button').click();await flush();
    check('JSON long-string span-to-div replacement animates',!!motion(stringRow),stringRow.getAnimations().length);await finish(stringRow);
    check('JSON long string reaches native size without preserving removed nodes',stringRow.getBoundingClientRect().height===220&&!stringRow.style.height,stringRow.getBoundingClientRect().height);
    const late=document.createElement('div');late.style.cssText='display:flex;flex-direction:column';flow.append(late);await flush();
    late.innerHTML='<div data-disclosure-header><div data-disclosure-row aria-expanded="false" role="button" style="height:24px">Lazy DisclosureRow</div></div>';
    const lateHeader=late.firstElementChild.firstElementChild,lateBody=document.createElement('div');lateBody.style.cssText='height:180px;flex:none';
    lateHeader.onclick=()=>{lateHeader.setAttribute('aria-expanded','true');late.append(lateBody);};await flush();lateHeader.click();await flush();
    check('DisclosureRow discovered when its header arrives in a later commit',!!motion(late),late.getAnimations().length);await finish(late);
    expander.focus();const focus=getComputedStyle(expander);
    check('JSON keyboard focus has no outer frame and has an underline cue',focus.outlineStyle==='none'&&focus.textDecorationLine.includes('underline'),{outline:focus.outlineStyle,decoration:focus.textDecorationLine});
    expander.click();await flush();media.matches=true;media.dispatchEvent(new Event('change'));await flush();
    check('nested output reduced motion cancels and restores natural styles',!motion(json)&&!json.style.height&&children.isConnected,json.style.cssText);
  }catch(e){check('unexpected exception',false,e.stack);}
  finally{if(dispose)dispose();if(cssDispose)cssDispose();scroller.remove();window.matchMedia=originalMedia;}
  return{passed:results.filter(r=>r.pass).length,total:results.length,results};
};

window.runInlineProcessRegression=async function(){
  const results=[],check=(name,pass,actual)=>results.push({name,pass:!!pass,actual}),flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
  const effects={};plugin.apply({effect(fn,n){effects[n]=fn;}});
  const originalMedia=window.matchMedia,media=new EventTarget();media.matches=false;window.matchMedia=()=>media;
  const flow=document.createElement('div');flow.dataset.chatFlow='';flow.innerHTML='<div data-turn-process-inline hidden="until-found"><div style="height:180px">Inline reasoning</div></div>';document.body.append(flow);
  const root=flow.firstElementChild;let dispose;
  try{
    dispose=effects['fan-de-hai: disclosure-motion']();root.removeAttribute('hidden');root.removeAttribute('data-turn-process-inline');await flush();
    check('inline reasoning is recognized after its marker is removed on reveal',root.getAnimations().length===1,root.getAnimations().length);
    check('inline reasoning reveal leaves host state untouched',!root.hasAttribute('hidden')&&!root.hasAttribute('data-turn-process-inline'),root.outerHTML);
    root.getAnimations().forEach(a=>a.finish());await flush();root.dataset.turnProcessInline='';root.setAttribute('hidden','until-found');await flush();
    check('inline reasoning first close animates without removing hidden',root.getAnimations().length===1&&root.getAttribute('hidden')==='until-found',root.getAnimations().length);
    root.dispatchEvent(new Event('beforematch',{bubbles:true}));root.removeAttribute('hidden');root.removeAttribute('data-turn-process-inline');await flush();
    check('inline reasoning find-in-page reveals immediately and cancels motion',!root.getAnimations().length&&!root.style.height,root.style.cssText);
    flow.dataset.chatMotion='';root.dataset.turnProcessInline='';root.setAttribute('hidden','until-found');await flush();
    check('native chat-motion owns inline reasoning without a second driver',!root.getAnimations().length,root.getAnimations().length);
    delete flow.dataset.chatMotion;root.removeAttribute('hidden');root.removeAttribute('data-turn-process-inline');await flush();media.matches=true;media.dispatchEvent(new Event('change'));await flush();
    check('inline fallback cancels cleanly under reduced motion',!root.getAnimations().length&&!root.style.height&&!root.hasAttribute('hidden'),root.style.cssText);
    dispose();dispose=null;
    check('inline fallback unload does not write application attributes',!root.hasAttribute('hidden')&&!root.hasAttribute('data-turn-process-inline'),root.outerHTML);
  }catch(e){check('unexpected exception',false,e.stack);}
  finally{if(dispose)dispose();flow.remove();window.matchMedia=originalMedia;}
  return{passed:results.filter(r=>r.pass).length,total:results.length,results};
};
