// Scoped real CSS/Chromium regression fixtures, not product VIS/FLOW acceptance.
window.runThemeColorRegression=async function(sourceURL='../lib/client.js'){
  const results=[],check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
  const source=new URL(sourceURL,location.href);if(source.origin!==location.origin)throw Error('Local fixture sources only');
  const frame=document.createElement('iframe');frame.style.cssText='display:block;width:100%;height:620px;border:0';
  let dispose;
  const rgb=value=>{const n=value.match(/[\d.]+/g);if(!n||!/^rgba?\(/.test(value))throw Error('Unexpected computed color '+value);return n.map(Number);};
  const hex=value=>[0,2,4].map(i=>parseInt(value.slice(i,i+2),16));
  const same=(a,b)=>a.slice(0,3).every((v,i)=>Math.abs(v-b[i])<.6);
  const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  const hsl=c=>{const [r,g,b]=c.slice(0,3).map(v=>v/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0;if(d)h=(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)*60;return[h,d?d/(1-Math.abs(2*l-1)):0,l];};
  try{
    const loaded=new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=reject;});
    frame.srcdoc='<!doctype html><meta charset="utf-8"><style>body{margin:0;font:16px/1.5 sans-serif;background:#fff;color:#222}.fixture-surface{padding:12px}pre code{color:rgb(12,34,56)}</style><script>window.effects={};window.__ModuleLoader__={load(spec){window.plugin=spec.factory(()=>{throw Error("Unexpected require")})}};<\/script><script src="'+source.href+'"><\/script><script>plugin.apply({effect(fn,name){effects[name]=fn}});<\/script><body data-ds-dark-theme></body>';
    document.body.append(frame);await loaded;
    const w=frame.contentWindow,d=w.document,css=e=>w.getComputedStyle(e);
    const background=e=>{const chain=[];for(let p=e;p;p=p.parentElement)chain.unshift(p);let bg=[255,255,255];for(const p of chain){const c=rgb(css(p).backgroundColor),a=c.length===4?c[3]:1;bg=bg.map((v,i)=>c[i]*a+v*(1-a));}return bg;};
    const samples=[['strong','c3aee0'],['b','c3aee0'],['.fixture-bold','c3aee0'],['.fixture-strong','c3aee0'],['summary','9bb8d9'],['[data-disclosure-header]','9bb8d9'],['code:not(pre code)','dfcd9a'],['em','dca8b9'],['i','dca8b9'],['del','8b949e'],['s','8b949e'],['blockquote','c3cbd8'],['mark','d9c68c'],['h1','b9c9df'],['h2','a4cccc'],['h3','cbb7e1'],['h4','e0e4eb'],['h5','e0e4eb'],['h6','e0e4eb'],['th','cbb7e1']];
    const markup='<strong>加粗文字</strong> <b>粗体</b> <span class="fixture-bold">加粗类</span> <span class="fixture-strong">强调类</span><details open><summary>折叠摘要</summary>内容</details><span data-disclosure-header>披露标题</span><ul><li>无序项目</li></ul><ol><li>有序项目</li></ol><p><code>inline_code()</code> <em>斜体</em> <i>斜体别名</i> <del>已删除</del> <s>删除别名</s> <mark>标记文字</mark> <kbd>Ctrl</kbd></p><blockquote>引用正文</blockquote><h1>一级标题</h1><h2>二级标题</h2><h3>三级标题</h3><h4>四级标题</h4><h5>五级标题</h5><h6>六级标题</h6><table><thead><tr><th>表头</th></tr></thead></table><pre><code>unaffected_block()</code></pre>';
    const roots=[];
    for(const scope of ['chat','step'])for(const level of [0,1,2]){const root=d.createElement('section');if(scope==='chat')root.dataset.slot='conversation.chat.message';else root.dataset.stepProcess='';root.className='fixture-surface';root.dataset.level=level;root.innerHTML=markup;d.body.append(root);roots.push(root);}
    const outside=d.createElement('strong');outside.style.color='rgb(10,20,30)';outside.textContent='Outside chat';d.body.append(outside);
    const contents=roots.map(r=>r.innerHTML);
    dispose=w.effects['fan-de-hai: opaque-model-select']();
    const hoverRule=Array.from(d.styleSheets).flatMap(sheet=>Array.from(sheet.cssRules)).find(rule=>rule.selectorText&&rule.selectorText.includes('summary:hover')&&rule.style.color);
    if(!hoverRule)throw Error('Missing actual summary hover color declaration');
    const hoverValue=hoverRule.style.color;
    const setMode=dark=>{if(dark)d.body.setAttribute('data-ds-dark-theme','');else d.body.removeAttribute('data-ds-dark-theme');d.body.style.backgroundColor=dark?'#131313':'#fff';d.body.style.color=dark?'#ddd':'#222';roots.forEach(r=>r.style.backgroundColor=(dark?['#131313','#1e1e1e','#282828']:['#fff','#f5f5f5','#e8e8e8'])[+r.dataset.level]);};
    for(const dark of [true,false]){
      setMode(dark);
      for(const [index,root] of roots.entries()){
        for(const [selector,original] of samples){const e=root.querySelector(selector),color=rgb(css(e).color),before=hex(original),actual={color:css(e).color,background:background(e),contrast:ratio(color,background(e))};
          if(dark)check('dark '+index+' '+selector+' preserves the approved color byte-for-byte',same(color,before),actual);
          else{check('light '+index+' '+selector+' text has at least 4.5:1 composed contrast',actual.contrast>=4.5,actual);const a=hsl(before),b=hsl(color),hue=Math.min(Math.abs(a[0]-b[0]),360-Math.abs(a[0]-b[0]));check('light '+index+' '+selector+' keeps hue and saturation while lowering lightness',hue<2&&Math.abs(a[1]-b[1])<.025&&b[2]<a[2],{before:a,after:b});}
        }
        for(const [selector,original] of [['ul li','d2b489'],['ol li','d3bb92'],['summary','92aedb']]){const e=root.querySelector(selector),c=rgb(w.getComputedStyle(e,'::marker').color);check((dark?'dark ':'light ')+index+' '+selector+' marker remains readable',dark?same(c,hex(original)):ratio(c,background(e))>=4.5,{color:c,contrast:ratio(c,background(e))});}
        const hoverProbe=d.createElement('span');hoverProbe.textContent='Summary hover declaration';hoverProbe.style.setProperty('color',hoverValue,'important');root.append(hoverProbe);const hoverColor=rgb(css(hoverProbe).color);check((dark?'dark ':'light ')+index+' actual summary hover declaration remains readable',dark?same(hoverColor,hex('abc5e3')):ratio(hoverColor,background(hoverProbe))>=4.5,{color:css(hoverProbe).color,contrast:ratio(hoverColor,background(hoverProbe))});hoverProbe.remove();
        const kbd=root.querySelector('kbd');check((dark?'dark ':'light ')+index+' readable keycap pair is unchanged',same(rgb(css(kbd).color),hex('e0e4eb'))&&same(rgb(css(kbd).backgroundColor),hex('21262d'))&&ratio(rgb(css(kbd).color),background(kbd))>=4.5,css(kbd).color);
        check((dark?'dark ':'light ')+index+' syntax-code colors are not retinted',css(root.querySelector('pre code')).color==='rgb(12, 34, 56)',css(root.querySelector('pre code')).color);
        const line=root.querySelector('del'),lineColor=rgb(css(line).textDecorationColor);check((dark?'dark ':'light ')+index+' deletion line retains a distinct readable red',dark?same(lineColor,hex('cf8188')):ratio(lineColor,background(line))>=3,css(line).textDecorationColor);
      }
      check((dark?'dark':'light')+' settings/non-chat text is not recolored',css(outside).color==='rgb(10, 20, 30)',css(outside).color);
    }
    setMode(true);check('switching back to dark restores every original foreground without reinstall',roots.every(root=>samples.every(([selector,original])=>same(rgb(css(root.querySelector(selector)).color),hex(original)))),null);
    check('theme switching never mutates Markdown content',roots.every((r,i)=>r.innerHTML===contents[i]),null);
    dispose();dispose=null;check('unload removes private text tokens and styling',roots.every(r=>!css(r).getPropertyValue('--fan-md-bold').trim())&&!d.querySelector('[data-fan-default-motion]'),css(roots[0]).getPropertyValue('--fan-md-bold'));
  }catch(error){check('unexpected exception',false,error.stack);}
  finally{if(dispose)dispose();frame.remove();}
  return{passed:results.filter(r=>r.pass).length,total:results.length,results};
};
