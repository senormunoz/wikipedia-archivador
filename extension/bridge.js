(() => {
  if (window.__wikipediaArchivadorBridge) return;
  window.__wikipediaArchivadorBridge=true;
  let snapshot;
  const visualSurface=()=>window.ve?.init?.target?.getSurface?.();
  function visualNodes(surface) {
    const nodes=[];
    function visit(node) {
      if (node.getType?.() !== 'document' && node.getAttribute?.('mw')?.parts) nodes.push(node);
      for (const child of node.getChildren?.()||[]) visit(child);
    }
    visit(surface.getModel().getDocument().getDocumentNode()); return nodes;
  }
  function sourceEditor() {
    const textarea=document.querySelector('#wpTextbox1');
    if (!textarea) return null;
    // WikiEditor's textSelection adapter also supports CodeMirror where enabled.
    const jq=window.jQuery?.(textarea);
    return {
      isCurrent:()=>textarea.isConnected && document.querySelector('#wpTextbox1')===textarea && visualSurface()?.getMode?.()!=='visual',
      get:()=>jq?.textSelection ? jq.textSelection('getContents') : textarea.value,
      set:value=>{ if (jq?.textSelection) jq.textSelection('setContents',value); else textarea.value=value; textarea.dispatchEvent(new Event('input',{bubbles:true})); textarea.dispatchEvent(new Event('change',{bubbles:true})); }
    };
  }
  async function read() {
    const surface=visualSurface();
    if (surface && surface.getMode?.()==='visual') {
      const entries=[];
      for (const node of visualNodes(surface)) {
        const mw=node.getAttribute('mw');
        for (let i=0;i<mw.parts.length;i++) {
          const t=mw.parts[i]?.template; if (!t) continue;
          const params=Object.fromEntries(Object.entries(t.params||{}).map(([k,v])=>[k,v.wt||'']));
          entries.push({id:String(entries.length),name:t.target?.wt||'',params,node,part:i,mw:JSON.stringify(mw)});
        }
      }
      snapshot={mode:'visual',surface,entries};
      return {mode:'visual',entries:entries.map(({id,name,params})=>({id,name,params}))};
    }
    // VE's wikitext mode uses a surface model rather than wpTextbox1.
    if (surface && surface.getMode?.()==='source') {
      const text=surface.getDom();
      if (typeof text!=='string') throw Error('No se puede leer este editor de código. Usa «Editar código» de Wikipedia.');
      snapshot={mode:'ve-source',surface,text}; return {mode:'source',text};
    }
    const editor=sourceEditor();
    if (!editor) throw Error('Abre «Editar» o «Editar código» en Wikipedia y vuelve a pulsar la extensión.');
    const text=editor.get(); snapshot={mode:'source',editor,text}; return {mode:'source',text};
  }
  async function apply(payload) {
    if (!snapshot) throw Error('Vuelve a revisar las referencias.');
    if (snapshot.mode==='visual') {
      if (visualSurface()!==snapshot.surface) throw Error('El editor ha cambiado. Vuelve a revisar.');
      const model=snapshot.surface.getModel(),doc=model.getDocument(), grouped=new Map();
      for (const change of payload.changes) {
        const entry=snapshot.entries.find(e=>e.id===change.id);
        if (!entry || JSON.stringify(entry.node.getAttribute('mw'))!==entry.mw || entry.node.getDocument()!==doc) throw Error('Una referencia ha cambiado. Vuelve a revisar.');
        let updated=grouped.get(entry.node);
        if (!updated) {updated=JSON.parse(entry.mw);grouped.set(entry.node,updated);}
        const params=updated.parts[entry.part].template.params;
        params.urlarchivo={wt:change.archive.url}; params.fechaarchivo={wt:change.archive.date};
      }
      model.breakpoint();
      // Attribute-only transactions preserve the rest of the unsaved document.
      for (const [node,mw] of grouped) model.change(window.ve.dm.TransactionBuilder.static.newFromAttributeChanges(doc,node.getOuterRange().start,{mw}));
      model.breakpoint(); snapshot=null; return;
    }
    if (snapshot.mode==='ve-source') {
      if (visualSurface()!==snapshot.surface || snapshot.surface.getDom()!==snapshot.text) throw Error('El texto ha cambiado. Vuelve a revisar.');
      const model=snapshot.surface.getModel(),range=model.getDocument().getDocumentRange();
      model.breakpoint(); model.getLinearFragment(range).insertContent(payload.text); model.breakpoint();
    } else {
      if (!snapshot.editor.isCurrent() || snapshot.editor.get()!==snapshot.text) throw Error('El texto ha cambiado. Vuelve a revisar.');
      snapshot.editor.set(payload.text);
    }
    snapshot=null;
  }
  window.addEventListener('message',async event=>{
    if(event.source!==window || event.origin!==location.origin || event.data?.channel!=='wa-request') return;
    const {id,method,payload}=event.data;
    try {
      const result=method==='read'?await read():method==='apply'?await apply(payload):null;
      window.postMessage({channel:'wa-response',id,result},location.origin);
    } catch(e) {window.postMessage({channel:'wa-response',id,error:e.message},location.origin);}
  });
})();
