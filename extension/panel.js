(async()=>{
  const existing=document.getElementById('wikipedia-archivador');
  if(existing){existing.hidden=false;return;}
  const {scan,supported,needsArchive,sourceURL,patchTemplate,applySource}=await import(chrome.runtime.getURL('core.js'));
  const host=document.createElement('div');host.id='wikipedia-archivador';document.documentElement.append(host);
  const root=host.attachShadow({mode:'closed'});
  root.innerHTML=`<style>
  :host{all:initial}:host([hidden]){display:none!important}aside{position:fixed;right:20px;top:24px;width:min(540px,calc(100vw - 40px));max-height:88vh;overflow:auto;z-index:2147483647;background:#fff;color:#202122;border:1px solid #a2a9b1;border-radius:12px;box-shadow:0 8px 40px #0004;font:14px/1.5 system-ui;padding:20px;box-sizing:border-box}h2{margin:0 0 8px;font-size:22px}button{font:inherit;cursor:pointer;border:1px solid #72777d;background:#f8f9fa;border-radius:5px;padding:8px 12px;margin:5px 5px 5px 0}button:disabled{opacity:.5;cursor:default}.primary{background:#36c;color:#fff;border-color:#36c}.close{float:right;margin:0}p{margin:8px 0}.row{border-top:1px solid #eaecf0;padding:12px 0;overflow-wrap:anywhere}pre{white-space:pre-wrap;background:#f8f9fa;padding:8px;font:12px/1.4 monospace;max-height:180px;overflow:auto}a{color:#36c}small{color:#54595d}progress{width:100%}</style>
  <aside role="dialog" aria-label="Wikipedia Archivador"><button class="close" aria-label="Cerrar">×</button><h2>Wikipedia Archivador</h2><p>Busca la captura más antigua registrada con HTTP 200. Revisa el contenido antes de publicar.</p><button class="primary" id="review">Revisar referencias</button><button id="cancel" disabled>Detener</button><button class="primary" id="apply" disabled>Aplicar todo</button><p id="status" role="status" aria-live="polite">Abre el editor de Wikipedia para comenzar.</p><section id="limit" hidden><p id="limit-message" role="status" aria-live="polite"></p><button id="resume">Esperar y reanudar</button><button id="finish">Aplicar las encontradas y terminar</button></section><progress hidden></progress><div id="results"></div><small>Las URL de las fuentes se envían a Internet Archive. No se publica ninguna edición.</small></aside>`;
  const $=s=>root.querySelector(s); let stopped=false,busy=false,reviewing=false,controller=null,resolveLimit=null,state=null,proposals=[],applied=[];
  const status=text=>$('#status').textContent=text;
  function rpc(method,payload){return new Promise((resolve,reject)=>{
    const id=crypto.randomUUID();
    const timeout=setTimeout(()=>{window.removeEventListener('message',listener);reject(Error('El editor no responde. Recarga la página.'));},15000);
    function listener(event){if(event.source!==window||event.origin!==location.origin||event.data?.channel!=='wa-response'||event.data.id!==id)return;clearTimeout(timeout);window.removeEventListener('message',listener);event.data.error?reject(Error(event.data.error)):resolve(event.data.result);}
    window.addEventListener('message',listener);window.postMessage({channel:'wa-request',id,method,payload},location.origin);
  });}
  function syncButtons(){
    $('#apply').disabled=busy||!state||!proposals.length;
    $('#review').disabled=busy||reviewing;
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
    }catch(e){status(e.message);state=null;proposals=[];stopped=true;controller?.abort();}
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
  function delay(ms,signal){return new Promise(resolve=>{
    if(signal.aborted){resolve();return;}
    const timer=setTimeout(done,Math.max(0,ms));
    function done(){clearTimeout(timer);signal.removeEventListener('abort',done);resolve();}
    signal.addEventListener('abort',done,{once:true});
  });}
  function limited(waitUntil,signal){return new Promise(resolve=>{
    let confirmed=false;
    $('#limit').hidden=false;
    function update(){
      const seconds=Math.max(0,Math.ceil((waitUntil-Date.now())/1000));
      $('#limit-message').textContent=`Archive.org ha limitado las consultas. ¿Quieres reanudar en ${seconds} s o prefieres aplicar las referencias ya encontradas y volver en otro momento?`;
      $('#resume').textContent=confirmed?`Reanudando en ${seconds} s…`:(seconds?'Esperar y reanudar':'Reanudar ahora');
      $('#resume').disabled=confirmed;
      $('#finish').disabled=busy;
      if(confirmed&&seconds===0&&!busy)done('resume');
    }
    function done(choice){clearInterval(timer);signal.removeEventListener('abort',cancel);resolveLimit=null;$('#limit').hidden=true;resolve(choice);}
    function cancel(){done('stop');}
    const timer=setInterval(update,250);
    resolveLimit=done;
    $('#resume').onclick=()=>{confirmed=true;update();};
    $('#finish').onclick=()=>{if(!busy)done('apply');};
    signal.addEventListener('abort',cancel,{once:true});update();
  });}
  $('#cancel').onclick=()=>{stopped=true;controller?.abort();status('Deteniendo la revisión…');};
  $('#review').onclick=async()=>{
    if(busy||reviewing)return;
    reviewing=true;busy=true;stopped=false;state=null;proposals=[];applied=[];controller=new AbortController();
    const signal=controller.signal;
    $('#results').replaceChildren();$('#cancel').disabled=false;syncButtons();
    let finishWithApply=false,done=0,errors=0,entries=[];
    try{
      state=await rpc('read');busy=false;
      entries=state.mode==='source'?scan(state.text):state.entries.filter(e=>supported(e.name));
      const unique=new Set(entries.filter(e=>needsArchive(e.params)&&sourceURL(e.params.url||'')).map(e=>e.params.url));
      status(`${entries.length} referencias; ${unique.size} URL únicas necesitan comprobarse.`);
      const cache=new Map(),progress=$('progress');progress.hidden=false;progress.max=entries.length||1;progress.value=0;
      for(const entry of entries){
        if(stopped||!state)break;
        if(!needsArchive(entry.params))addRow(entry,'Se conserva: ya tiene datos de archivo.');
        else if(!sourceURL(entry.params.url||''))addRow(entry,'Sin una URL HTTP/HTTPS compatible; no se modifica.');
        else{
          const url=entry.params.url;let response=cache.get(url);
          while(!response&&!stopped&&state){
            status(`Revisando ${done+1} de ${entries.length}; ${unique.size} URL únicas en esta revisión…`);
            try{response=await chrome.runtime.sendMessage({type:'wayback',url,large:unique.size>25});}
            catch(e){response={error:e.message};}
            if(stopped||!state)break;
            if(response?.limited){
              const choice=await limited(response.waitUntil,signal);response=null;
              if(choice!=='resume'){stopped=true;finishWithApply=choice==='apply';break;}
            }else if(response?.waitUntil){
              status(`Pausa entre consultas. ${done}/${entries.length} revisadas; puedes aplicar las referencias encontradas.`);
              await delay(response.waitUntil-Date.now(),signal);response=null;
            }else if(!response)response={error:'El servicio de consultas no respondió.'};
          }
          if(stopped||!state)break;
          if(response.error){errors++;addRow(entry,response.error);}
          else{
            cache.set(url,response);
            if(!response.value)addRow(entry,'No se encontró ninguna captura con HTTP 200.');
            else{
              const archive=response.value,after=state.mode==='source'?patchTemplate(entry,archive):'visual';
              proposals.push({...entry,archive,after});addRow(entry,'Captura encontrada. Pendiente de aplicar.',archive,after);
            }
          }
        }
        progress.value=++done;syncButtons();
      }
      // An individual application can still be in flight when the last query completes.
      while(busy)await delay(20,new AbortController().signal);
      if(state)status(`${stopped?'Revisión detenida. ':''}${done}/${entries.length} referencias revisadas; ${proposals.length} cambios preparados; ${errors} errores.`);
    }catch(e){state=null;proposals=[];status(e.message);}
    finally{reviewing=false;busy=false;resolveLimit?.('stop');$('#cancel').disabled=true;$('progress').hidden=true;syncButtons();}
    if(finishWithApply&&state){
      if(proposals.length)await applyChanges([...proposals]);
      else status('Revisión terminada. No quedan referencias encontradas pendientes de aplicar.');
    }
  };
  $('#apply').onclick=()=>applyChanges([...proposals]);
  $('#review').click();
})();
