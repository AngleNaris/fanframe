// Exact native chat/image and current Codex preview CSS, isolated DOM only.
// Does not test real attachment storage, the Codex loader, or product VIS/FLOW.
window.runImageVisibilityRegression=async function(){
 const results=[],check=(name,pass,actual)=>results.push({name,pass:!!pass,actual}),cleanup=[],nodes=[];
 const styles=nativeSidebarStyles.filter(s=>/\/(MessageItem|MessageImage)\.module\.css$/.test(s.id)).map(s=>{const el=document.createElement('style');el.dataset.pluginCss=s.id;el.textContent=s.css;document.head.append(el);return el;});
 const cls=(file,key)=>{const s=nativeSidebarStyles.find(s=>s.id.endsWith('/'+file));return s.css.match(new RegExp('\\.([\\w-]+_'+key+')(?![\\w-])'))[1];};
 const codex=document.createElement('style');codex.textContent=`
.codexMessageImages{display:flex;gap:10px;max-width:100%;padding:8px 0;overflow-x:auto}
.codexImageThumb{display:grid;place-items:center;width:64px;height:64px;padding:0;border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:14px;background:var(--dsw-alias-interactive-bg-hover);color:inherit;overflow:hidden;cursor:zoom-in;flex:none}
.codexImageThumb img{width:100%;height:100%;object-fit:cover}
.codexImageThumb:focus-visible{outline:2px solid #4598ed;outline-offset:2px}
.codexMessageImages{flex-wrap:wrap}.codexMessageImages[data-align=end]{justify-content:flex-end}
.codexMessageImages[data-single=true] .codexImageThumb{width:240px;height:auto;max-width:100%}
.codexMessageImages[data-single=true] img{height:auto;max-height:320px;object-fit:contain}
.codexMessageImages[data-thumbnail=true]{padding:0}.codexMessageImages[data-thumbnail=true] img{object-fit:contain}
`;document.head.append(codex);
 const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
 const src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><path fill="#754668" d="M0 0h400v240H0z"/></svg>');
 const image=async button=>{const img=document.createElement('img');img.alt='Synthetic visibility fixture';const loaded=new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;});img.src=src;button.replaceChildren(img);button.disabled=false;await loaded;return img;};
 const visible=img=>{let el=img;const r=img.getBoundingClientRect();if(!img.naturalWidth||r.width<1||r.height<1)return false;let left=r.left,right=r.right,top=r.top,bottom=r.bottom;while(el&&el!==document.body){const c=getComputedStyle(el),b=el.getBoundingClientRect();if(c.display==='none'||c.visibility==='hidden'||Number(c.opacity)===0||el.hidden)return false;if(/hidden|clip|auto|scroll/.test(c.overflowX)){left=Math.max(left,b.left);right=Math.min(right,b.right);}if(/hidden|clip|auto|scroll/.test(c.overflowY)){top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}if(right-left<1||bottom-top<1)return false;el=el.parentElement;}return true;};
 const make=(type,text)=>{const flow=document.createElement('div');flow.dataset.chatFlow='';flow.style.cssText='position:fixed;left:16px;top:48px;width:420px';flow.innerHTML='<div class="'+cls('MessageItem.module.css','userRow')+'"><div class="'+cls('MessageItem.module.css','userStack')+'"><div class="'+cls('MessageItem.module.css','attachmentRow')+'" data-message-attachments="true"><div data-slot="conversation.chat.user.images" style="display:contents"><div '+(type==='codex'?'class="codexMessageImages" data-align="end" data-single="true"':'class="'+cls('MessageImage.module.css','gallery')+'" data-align="end"')+'><button '+(type==='codex'?'class="codexImageThumb"':'class="'+cls('MessageImage.module.css','frame')+'" data-variant="single" style="width:240px;height:144px"')+' disabled>…</button></div></div></div>'+(text?'<div class="'+cls('MessageItem.module.css','bubble')+'">Image with text</div>':'')+'</div></div>';document.body.append(flow);nodes.push(flow);return{flow,button:flow.querySelector('button')};};
 try{
  const cases=[];for(const type of ['native','codex'])for(const text of [false,true]){const c=make(type,text);c.img=await image(c.button);c.name=type+(text?' image + text':' image-only');c.before=c.img.getBoundingClientRect().toJSON();check(c.name+': baseline decoded image is visible',visible(c.img),c.before);cases.push(c);}
  const effects={};plugin.apply({effect(fn,name){effects[name]=fn;}});Object.values(effects).forEach(fn=>{const dispose=fn();if(typeof dispose==='function')cleanup.push(dispose);});await flush();
  for(const c of cases){const after=c.img.getBoundingClientRect();check(c.name+': all fan effects preserve decoded image and geometry',visible(c.img)&&Math.abs(after.width-c.before.width)<.1&&Math.abs(after.height-c.before.height)<.1,{before:c.before,after:after.toJSON()});}
  const late=make('codex',true);await flush();const img=await image(late.button);await flush();check('Codex image resolving after mount remains visible',visible(img),img.getBoundingClientRect().toJSON());
  let calls=0;late.button.onclick=()=>calls++;late.button.click();check('fan effects do not swallow the image button handler',calls===1&&late.button.firstElementChild===img);
  cleanup.reverse().forEach(fn=>fn());cleanup.length=0;await flush();check('unload preserves the original loaded image node and source',img.isConnected&&img.src===src&&visible(img));
 }catch(error){check('unexpected exception',false,error.stack);}finally{cleanup.reverse().forEach(fn=>fn());nodes.forEach(n=>n.remove());styles.forEach(s=>s.remove());codex.remove();await flush();}
 return{passed:results.filter(r=>r.pass).length,total:results.length,results};
};
