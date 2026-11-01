window.runCatalogRegression=async function(){
 const results=[];const check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
 const orig={raf:requestAnimationFrame,caf:cancelAnimationFrame,st:setTimeout,ct:clearTimeout,now:Date.now};
 let frameId=0,timerId=0,now=100000;const frames=new Map(),timers=new Map();
 window.requestAnimationFrame=cb=>{frames.set(++frameId,cb);return frameId;};window.cancelAnimationFrame=id=>frames.delete(id);
 window.setTimeout=(cb,delay)=>{timers.set(++timerId,cb);return timerId;};window.clearTimeout=id=>timers.delete(id);Date.now=()=>now;
 const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 const drain=async()=>{for(let i=0;i<12;i++){await flush();if(!frames.size)break;const current=[...frames.values()];frames.clear();current.forEach(cb=>cb(0));}};
 const tick=async()=>{now+=16000;const f=[...timers.values()];timers.clear();f.forEach(cb=>cb());await drain();};
 const style=document.createElement('style');style.dataset.plugin='@deepseek-ai/dsh-client-ui-subagent';style.textContent='.fixture_row{}.fixture_label{}.fixture_summary{}';document.head.append(style);
 const menu=document.createElement('div');menu.setAttribute('role','tree');menu.setAttribute('aria-label','子智能体会话');menu.innerHTML='<div role="treeitem" class="fixture_row"><span class="fixture_label">Unique</span><span class="fixture_summary" title="original title">Original summary</span></div>';document.body.append(menu);
 const summary=menu.querySelector('.fixture_summary');let response=null,calls=0,pendingResolve;
 const effects={};plugin.apply({effect(fn,name){effects[name]=fn;},sessions:{list:{getSnapshot:()=>({projectionsBySession:{parent:{values:{subagentCatalog:[{id:'child',label:'Unique'}]}}}})}},connection:{rpc:{call:()=>{calls++;return pendingResolve==='defer'?new Promise(resolve=>pendingResolve=resolve):Promise.resolve(response);}}}});
 let dispose;
 try{
  dispose=effects['fan-de-hai: subagent-model-instead-of-summary']();await drain();check('model miss keeps original',summary.textContent==='Original summary',summary.textContent);
  response={ok:true,value:{found:true,provider:'provider',model:'first'}};await tick();check('miss retries after bounded TTL',summary.textContent==='provider/first',{calls,text:summary.textContent});
  response={ok:true,value:{found:true,provider:'provider',model:'second'}};await tick();check('model cache refreshes switch',summary.textContent==='provider/second',summary.textContent);
  dispose();dispose=null;check('catalog unload restores text and title',summary.textContent==='Original summary'&&summary.title==='original title',{text:summary.textContent,title:summary.title});check('catalog unload removes timers and frames',!timers.size&&!frames.size,{timers:timers.size,frames:frames.size});
  pendingResolve='defer';dispose=effects['fan-de-hai: subagent-model-instead-of-summary']();await drain();dispose();dispose=null;pendingResolve(response);await drain();check('late RPC does not paint after unload',summary.textContent==='Original summary',summary.textContent);
 }catch(e){check('unexpected exception',false,e.stack);}finally{if(dispose)dispose();menu.remove();style.remove();window.requestAnimationFrame=orig.raf;window.cancelAnimationFrame=orig.caf;window.setTimeout=orig.st;window.clearTimeout=orig.ct;Date.now=orig.now;}
 return {passed:results.filter(r=>r.pass).length,total:results.length,results};
};
