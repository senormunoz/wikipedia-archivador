(async()=>{
  const existing=document.getElementById('wikipedia-archivador');
  if(existing){existing.hidden=false;return;}
  const {scan,supported,needsArchive,sourceURL,patchTemplate,applySource}=await import(chrome.runtime.getURL('core.js'));
  const host=document.createElement('div');host.id='wikipedia-archivador';document.documentElement.append(host);
  const root=host.attachShadow({mode:'closed'});
  root.innerHTML=`<style>
  :host{all:initial}:host([hidden]){display:none!important}aside{position:fixed;right:20px;top:24px;width:min(540px,calc(100vw - 40px));max-height:88vh;overflow:auto;z-index:2147483647;background:#fff;color:#202122;border:1px solid #a2a9b1;border-radius:12px;box-shadow:0 8px 40px #0004;font:14px/1.5 system-ui;padding:20px;box-sizing:border-box}h2{margin:0 0 8px;font-size:22px}button{font:inherit;cursor:pointer;border:1px solid #72777d;background:#f8f9fa;border-radius:5px;padding:8px 12px;margin:5px 5px 5px 0}button:disabled{opacity:.5;cursor:default}.primary{background:#36c;color:#fff;border-color:#36c}.close{float:right;margin:0}p{margin:8px 0}.row{border-top:1px solid #eaecf0;padding:12px 0;overflow-wrap:anywhere}pre{white-space:pre-wrap;background:#f8f9fa;padding:8px;font:12px/1.4 monospace;max-height:180px;overflow:auto}a{color:#36c}small{color:#54595d}progress{width:100%}</style>
  <aside role="dialog" aria-label="Wikipedia Archivador"><button class="close" aria-label="Cerrar">×</button><h2>Wikipedia Archivador</h2><p>Busca la captura más antigua registrada con HTTP 200. Revisa el contenido antes de publicar.</p><button class="primary" id="review">Revisar referencias</button><button id="cancel" disabled>Detener</button><button class="primary" id="apply" disabled>Aplicar todo</button><p id="status" role="status" aria-live="polite">Abre el editor de Wikipedia para comenzar.</p><progress hidden></progress><div id="results"></div><small>Las URL de las fuentes se envían a Internet Archive. No se publica ninguna edición.</small></aside>`;
  const $=s=>root.querySelector(s); let stopped=false,busy=false,state=null,proposals=[],applied=[];
  const status=text=>$('#status').textContent=text;
  function rpc(method,payload){return new Promise((resolve,reject)=>{
    const id=crypto.randomUUID();
    const timeout=setTimeout(()=>{window.removeEventListener('message',listener);reject(Error('El editor no responde. Recarga la página.'));},15000);
    function listener(event){if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='wa-response'||event.data.id!==id)return;clearTimeout(timeout);window.removeEventListener('message',listener);event.data.error?reject(Error(event.data.error)):resolve(event.data.result);}
    window.addEventListener('message',listener);window.postMessage({channel:'wa-request',id,method,payload},location.origin);
  });}
  function syncButtons(){
    $('#apply').disabled=busy||!state||!proposals.length;
    $('#review').disabled=busy;
    for(const button of root.querySelectorAll('[data-reference]')) button.disabled=busy||!state||!proposals.some(p=>p.id===button.dataset.reference);
  }
  async function applyChanges(selected){
    if(busy||!state||!selected.length)return;
    busy=true;syncButtons();
    try{
      const cumulative=[...applied,...selected];
      await rpc('apply',state.mode==='source'?{text:applySource(state.text,cumulative)}:{changes:selected.map(({id,archive})=>({id,archive}))});
      applied=cumulative;
      const ids=new Set(selected.map(p=>p.id));
      proposals=proposals.filter(p=>!ids.has(p.id));
      for(const button of root.querySelectorAll('[data-reference]')) if(ids.has(button.dataset.reference)){
        button.textContent='Aplicado';button.parentNode.querySelector('.reference-status').textContent='Referencia actualizada en el editor.';
      }
      status(`${selected.length} referencias actualizadas en el editor. ${proposals.length} pendientes. Revisa los cambios y publica desde Wikipedia cuando quieras.`);
    }catch(e){status(e.message);state=null;proposals=[];}
    finally{busy=false;syncButtons();}
  }
  function addRow(entry,message,archive,after){
    const row=document.createElement('div');row.className='row';
    const title=document.createElement('strong');title.textContent=entry.name;row.append(title);
    const url=document.createElement('p');url.textContent=entry.params.url||'Sin parámetro URL';row.append(url);
    const info=document.createElement('p');info.className='reference-status';info.textContent=message;row.append(info);
    if(archive){const a=document.createElement('a');a.href=archive.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=`Abrir captura (${archive.date})`;row.append(a);}
    if(after){const details=document.createElement('details'),label=document.createElement('summary'),pre=document.createElement('pre');label.textContent='Ver cambio propuesto';pre.textContent=entry.raw?`ANTES\n${entry.raw}\n\nDESPUÉS\n${after}`:`Añadir:\n|urlarchivo=${archive.url}\n|fechaarchivo=${archive.date}`;details.append(label,pre);row.append(details);}
    if(after){const button=document.createElement('button');button.type='button';button.className='primary';button.dataset.reference=entry.id;button.textContent='Aplicar referencia';button.disabled=true;button.onclick=()=>applyChanges(proposals.filter(p=>p.id===entry.id));row.append(button);}
    $('#results').append(row);
  }
  $('.close').onclick=()=>{host.hidden=true;};
  $('#cancel').onclick=()=>{stopped=true;status('Deteniendo después de la consulta en curso…');};
  $('#review').onclick=async()=>{
    if(busy)return;busy=true;stopped=false;state=null;proposals=[];applied=[];$('#results').replaceChildren();$('#apply').disabled=true;$('#review').disabled=true;$('#cancel').disabled=false;
    try{
      state=await rpc('read');
      const entries=state.mode==='source'?scan(state.text):state.entries.filter(e=>supported(e.name));
      const cache=new Map();let done=0,errors=0;const progress=$('progress');progress.hidden=false;progress.max=entries.length||1;progress.value=0;
      for(const entry of entries){
        if(stopped)break;status(`Revisando ${done+1} de ${entries.length}…`);
        if(!needsArchive(entry.params))addRow(entry,'Se conserva: ya tiene datos de archivo.');
        else if(!sourceURL(entry.params.url||''))addRow(entry,'Sin una URL HTTP/HTTPS compatible; no se modifica.');
        else{
          const url=entry.params.url;
          let response=cache.get(url);
          if(!response){response=await chrome.runtime.sendMessage({type:'wayback',url});if(!response?.error)cache.set(url,response);}
          if(response?.error){errors++;addRow(entry,response.error);}
          else if(!response?.value)addRow(entry,'No se encontró ninguna captura con HTTP 200.');
          else{
            const archive=response.value,after=state.mode==='source'?patchTemplate(entry,archive):'visual';
            proposals.push({...entry,archive,after});addRow(entry,'Captura encontrada. Pendiente de aplicar.',archive,after);
          }
        }
        progress.value=++done;
      }
      status(`${stopped?'Revisión detenida. ':''}${done}/${entries.length} referencias revisadas; ${proposals.length} cambios preparados; ${errors} errores.`);
      $('#apply').disabled=!proposals.length;
    }catch(e){state=null;proposals=[];status(e.message);}
    finally{busy=false;$('#cancel').disabled=true;$('progress').hidden=true;syncButtons();}
  };
  $('#apply').onclick=()=>applyChanges([...proposals]);
  $('#review').click();
})();
