// Native catalog geometry only; not product VIS/FLOW.
window.runCatalogScrollRegression=async function(){
 const results=[],check=(name,pass,actual)=>results.push({name,pass:!!pass,actual});
 const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);};
 const source=nativeSidebarStyles.find(s=>s.id.endsWith('/SubagentHeaderLineage.module.css'));
 const cls=key=>source.css.match(new RegExp('\\.([\\w-]+_'+key+')(?![\\w-])'))[1];
 const style=document.createElement('style');style.dataset.pluginCss=source.id;style.textContent=source.css;document.head.append(style);
 const effects={};plugin.apply({effect(fn,name){effects[name]=fn;}});let dispose;const panels=[];
 const rows=tree=>{for(let i=0;i<36;i++){const node=document.createElement('div');node.className=cls('node');node.setAttribute('role','treeitem');node.innerHTML='<div class="'+cls('row')+'"><button class="'+cls('clickarea')+'"><span class="'+cls('label')+'">Child '+i+'</span></button></div>';tree.append(node);}};
 const make=(populate=true)=>{const panel=document.createElement('div');panel.className=cls('menu');panel.style.cssText='position:fixed;left:16px;top:48px;width:300px;height:160px';const tree=document.createElement('div');tree.className=cls('menuBody');tree.setAttribute('role','tree');tree.setAttribute('aria-label','localized catalog label');panel.append(tree);if(populate)rows(tree);panels.push(panel);return{panel,tree};};
 const bottom=tree=>Math.abs(tree.scrollHeight-tree.clientHeight-tree.scrollTop)<1;
 try{
  const first=make();document.body.append(first.panel);const focus=document.activeElement;
  check('native catalog starts at top as a positive control',first.tree.scrollTop===0&&first.tree.scrollHeight>first.tree.clientHeight);
  dispose=effects['fan-de-hai: subagent-catalog-scroll']();await flush();
  check('opening scrolls the native body to its own bottom',bottom(first.tree)&&first.tree.scrollTop>0,{top:first.tree.scrollTop,height:first.tree.scrollHeight,client:first.tree.clientHeight});
  check('opening does not move focus',document.activeElement===focus);
  first.tree.scrollTop=0;first.tree.firstElementChild.append(document.createTextNode('model refreshed'));await flush();
  check('later model updates never pull a reader back down',first.tree.scrollTop===0);
  first.panel.remove();await flush();const reopened=make();document.body.append(reopened.panel);await flush();
  check('each newly opened native catalog starts at bottom',bottom(reopened.tree)&&reopened.tree.scrollTop>0);
  const late=make(false);document.body.append(late.panel);await flush();rows(late.tree);await flush();
  check('an initially empty catalog waits for its first rows',bottom(late.tree)&&late.tree.scrollTop>0);
  const intent=make();document.body.append(intent.panel);await Promise.resolve();intent.tree.dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:-40}));await flush();
  check('user navigation before first paint cancels the default',intent.tree.scrollTop===0);
  const keyboard=make();document.body.append(keyboard.panel);keyboard.tree.querySelector('button').focus();await flush();
  check('native keyboard opening retains its visible focused row',keyboard.tree.contains(document.activeElement)&&keyboard.tree.scrollTop===0);
  const unknown=make();unknown.tree.className='unknown_body';document.body.append(unknown.panel);await flush();
  check('unrecognized tree contracts remain unchanged',unknown.tree.scrollTop===0);
  const canceled=make();document.body.append(canceled.panel);await Promise.resolve();dispose();dispose=null;await flush();
  check('unload cancels a pending initial scroll',canceled.tree.scrollTop===0);
  const after=make();document.body.append(after.panel);await flush();check('unload removes root discovery',after.tree.scrollTop===0);
 }catch(error){check('unexpected exception',false,error.stack);}finally{if(dispose)dispose();panels.forEach(p=>p.remove());style.remove();}
 return{passed:results.filter(r=>r.pass).length,total:results.length,results};
};
