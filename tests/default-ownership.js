// Isolated real Chromium CSSOM/media-query fixtures; never product VIS/FLOW evidence.
window.runDefaultOwnershipRegression = async function (clientUrl = '../lib/client.js') {
  const results=[],check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
  const iframe=document.createElement('iframe');iframe.style.cssText='width:600px;height:180px;border:0';
  document.body.append(iframe);
  const w=iframe.contentWindow,d=w.document;
  const frame=()=>new Promise(resolve=>w.requestAnimationFrame(resolve));
  const settle=async()=>{for(let i=0;i<4;i++)await frame();};
  const subscriptions=new Map();let dispose;
  try {
    const matchMedia=w.matchMedia.bind(w);
    // Observe listener lifecycle only; matches/events still come from real Chromium.
    w.matchMedia=text=>{
      const query=matchMedia(text),add=query.addEventListener.bind(query),remove=query.removeEventListener.bind(query);
      query.addEventListener=(type,fn,...args)=>{if(type==='change'){if(!subscriptions.has(query))subscriptions.set(query,new Set());subscriptions.get(query).add(fn);}return add(type,fn,...args);};
      query.removeEventListener=(type,fn,...args)=>{if(type==='change')subscriptions.get(query)?.delete(fn);return remove(type,fn,...args);};
      return query;
    };
    w.__ModuleLoader__={load(spec){w.ownershipPlugin=spec.factory(()=>{throw Error('Unexpected require');});}};
    const script=d.createElement('script');script.src=new URL(clientUrl,location.href).href;
    await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject;d.head.append(script);});
    const sheet=d.createElement('style');sheet.dataset.pluginCss='@deepseek-ai/dsh-client-ui-fixture/Ownership.module.css';
    sheet.textContent=`:root{--ds-transition-duration-fast:.1s;--ds-ease-in-out:cubic-bezier(.4,0,.2,1)}
      button{background:rgb(20,20,20);color:rgb(240,240,240);border:0;padding:5px}
      .GAkraW_iconButton[data-on=true]{background:rgb(160,120,80)}
      /* Exact rc.3 WorkspaceBrowser entrance (native source CSS line 2721). */
      .GAkraW_wide{animation:GAkraW_wide-in .2s var(--ds-ease-in-out)}
      @keyframes GAkraW_wide-in{0%{opacity:0}}
      .Own_paint{animation:own-paint 10s linear infinite}@keyframes own-paint{to{color:red}}
      .Own_var{animation:own-var 10s linear infinite}@keyframes own-var{to{--native-paint:red}}
      .Own_unknown{animation:unknown-native-name 10s linear infinite}
      .Own_dynamicName{--native-animation:own-paint 10s linear infinite;animation:var(--native-animation)}
      .Own_customTiming{--own-timing:linear;animation:GAkraW_wide-in .2s var(--own-timing)}
      .Own_dynamic{animation:own-dynamic 10s linear infinite}@keyframes own-dynamic{to{opacity:.9}}
      .Own_animationNone{animation:none}.Own_transitionNone{transition:none}
      @layer native-optout{.Own_layeredNone{transition:none}}
      @media (max-width:0px){.Own_inactive{transition-duration:.41s;animation:unknown-native-name 2s}}
      @supports (not-a-css-property:1){.Own_unsupported{transition-duration:.43s}}
      @media (min-width:800px){.Own_responsive{transition-duration:.37s}}`;
    d.head.append(sheet);
    const mediaSheet=d.createElement('style');mediaSheet.dataset.pluginCss='@deepseek-ai/dsh-client-ui-fixture/Media.module.css';
    mediaSheet.media='print';mediaSheet.textContent='.Own_sheet{transition-duration:.29s}';d.head.append(mediaSheet);
    d.body.innerHTML='<button class="GAkraW_iconButton GAkraW_wide">View options fixture</button><button class="Own_paint">Native paint</button><button class="Own_var">Native custom property</button><button class="Own_unknown">Unknown native animation</button><button class="Own_dynamicName">Dynamic native animation</button><button class="Own_customTiming">Unknown timing variable</button><button class="Own_dynamic">Late keyframes</button><button class="Own_animationNone">No native animation</button><button class="Own_transitionNone">Explicit no transition</button><button class="Own_layeredNone">Layered native opt out</button><button class="Own_inactive">Inactive media</button><button class="Own_unsupported">Unsupported condition</button><button class="Own_responsive">Responsive native owner</button><button class="Own_sheet">Stylesheet media</button>';
    const effects={};w.ownershipPlugin.apply({effect(fn,name){effects[name]=fn;}});
    dispose=effects['fanframe: default-control-motion']();
    const css=selector=>w.getComputedStyle(d.querySelector(selector));
    const paints=selector=>css(selector).transitionProperty.includes('background-color')&&css(selector).transitionDuration==='0.1s';
    const wide=d.querySelector('.GAkraW_wide');const native=wide.getAnimations().find(a=>a.animationName==='GAkraW_wide-in');
    check('rc.3 wide button retains its native 200ms opacity entrance',!!native&&css('.GAkraW_wide').animationDuration==='0.2s',css('.GAkraW_wide').animation);
    check('rc.3 opacity entrance no longer excludes independent 100ms colors',paints('.GAkraW_wide'),css('.GAkraW_wide').transition);
    const box=wide.getBoundingClientRect();css('.GAkraW_wide').backgroundColor;wide.dataset.on='true';css('.GAkraW_wide').backgroundColor;
    const transition=wide.getAnimations().find(a=>a.transitionProperty==='background-color');
    check('real color transition and native entrance coexist without replacing either',!!transition&&wide.getAnimations().some(a=>a===native),wide.getAnimations().map(a=>a.constructor.name));
    let midpoint=null;if(transition){transition.pause();transition.currentTime=50;midpoint=css('.GAkraW_wide').backgroundColor;transition.finish();}
    check('coexisting color transition has an actual intermediate paint',!!transition&&midpoint!=='rgb(20, 20, 20)'&&midpoint!=='rgb(160, 120, 80)',midpoint);
    if(native)native.finish();await settle();
    check('finished entrance does not permanently exclude later color changes',paints('.GAkraW_wide')&&css('.GAkraW_wide').animationName==='GAkraW_wide-in',css('.GAkraW_wide').transition);
    const after=wide.getBoundingClientRect();check('repair does not animate or change button geometry',Math.abs(after.width-box.width)<.01&&Math.abs(after.height-box.height)<.01,{before:[box.width,box.height],after:[after.width,after.height]});
    check('native keyframes that change color keep exclusive paint ownership',css('.Own_paint').transitionDuration==='0s'&&css('.Own_paint').animationName==='own-paint',css('.Own_paint').transition);
    check('animated custom properties remain conservatively protected',css('.Own_var').transitionDuration==='0s',css('.Own_var').transition);
    check('unknown animation definitions remain conservatively protected',css('.Own_unknown').transitionDuration==='0s',css('.Own_unknown').transition);
    check('dynamic native animation names are not guessed from root variables',css('.Own_dynamicName').transitionDuration==='0s'&&css('.Own_dynamicName').animationName==='own-paint',css('.Own_dynamicName').transition);
    check('unknown shorthand variables remain protected even with a known keyframe name',css('.Own_customTiming').transitionDuration==='0s',css('.Own_customTiming').transition);
    check('animation none is not treated as a paint animation owner',paints('.Own_animationNone'),css('.Own_animationNone').transition);
    check('an active explicit native transition none still wins the cascade',css('.Own_transitionNone').transitionProperty==='none'&&css('.Own_transitionNone').transitionDuration==='0s',css('.Own_transitionNone').transition);
    check('native explicit opt out in an earlier layer is not overridden',css('.Own_layeredNone').transitionProperty==='none'&&css('.Own_layeredNone').transitionDuration==='0s',css('.Own_layeredNone').transition);
    check('inactive media declarations do not exclude paint fallback',paints('.Own_inactive'),css('.Own_inactive').transition);
    check('unsupported conditions do not exclude paint fallback',paints('.Own_unsupported'),css('.Own_unsupported').transition);
    check('nonmatching stylesheet media does not exclude paint fallback',paints('.Own_sheet'),css('.Own_sheet').transition);
    check('native partial transition in inactive viewport starts with paint fallback',paints('.Own_responsive'),css('.Own_responsive').transition);
    iframe.style.width='1000px';iframe.getBoundingClientRect();await settle();
    check('real media change hands all transition longhands back to native',css('.Own_responsive').transitionProperty==='all'&&css('.Own_responsive').transitionDuration==='0.37s',css('.Own_responsive').transition);
    iframe.style.width='600px';iframe.getBoundingClientRect();await settle();
    check('reverse real media change restores fallback without stale exclusions',paints('.Own_responsive'),css('.Own_responsive').transition);
    mediaSheet.media='all';await settle();
    check('stylesheet media attribute change restores native partial ownership',css('.Own_sheet').transitionProperty==='all'&&css('.Own_sheet').transitionDuration==='0.29s',css('.Own_sheet').transition);
    mediaSheet.media='print';await settle();check('nonmatching stylesheet media restores paint fallback',paints('.Own_sheet'),css('.Own_sheet').transition);
    const late=d.createElement('style');late.textContent='@keyframes own-dynamic{to{color:red}}';
    check('known opacity-only keyframes allow paint before a late native change',paints('.Own_dynamic'),css('.Own_dynamic').transition);
    d.head.append(late);await settle();check('late color keyframes take ownership without an animation override',css('.Own_dynamic').transitionDuration==='0s'&&css('.Own_dynamic').animationName==='own-dynamic',css('.Own_dynamic').transition);
    late.remove();await settle();check('removing late paint ownership restores independent fallback',paints('.Own_dynamic'),css('.Own_dynamic').transition);
    check('real media listeners are registered for conditional ownership',[...subscriptions.values()].some(listeners=>listeners.size),[...subscriptions.values()].map(listeners=>listeners.size));
    dispose();dispose=null;
    check('unload removes all owned media listeners and fallback style',[...subscriptions.values()].every(listeners=>listeners.size===0)&&!d.querySelector('[data-fan-default-motion]'),[...subscriptions.values()].map(listeners=>listeners.size));
    iframe.style.width='1000px';iframe.getBoundingClientRect();await settle();
    check('media changes after unload cannot reinstall fallback',!d.querySelector('[data-fan-default-motion]'),!!d.querySelector('[data-fan-default-motion]'));
  } catch(error) {check('unexpected ownership fixture exception',false,error.stack||String(error));}
  finally {if(dispose)dispose();iframe.remove();}
  return {passed:results.filter(result=>result.pass).length,total:results.length,results};
};
