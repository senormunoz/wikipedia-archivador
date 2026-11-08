const normalize = s => s.replace(/_/g, ' ').trim().toLowerCase().replace(/\s+/g, ' ');
export const supported = name => /^cita (web|noticia|publicación|libro)$/.test(normalize(name));

// Mask ignored regions without changing offsets. Separators inside templates,
// template arguments and wikilinks do not delimit the surrounding template.
function masked(text) {
  return text.replace(/<!--[\s\S]*?(?:-->|$)|<(nowiki|pre|source|syntaxhighlight|math)\b[^>]*>[\s\S]*?<\/\1\s*>|<nowiki\s*\/>/gi, s => ' '.repeat(s.length));
}
function boundaries(text, start, end, separator) {
  const result = []; let braces = [], links = 0;
  for (let i = start; i < end; i++) {
    if (text.startsWith('{{{', i)) { braces.push(3); i += 2; }
    else if (text.startsWith('{{', i)) { braces.push(2); i++; }
    else if (braces.length && text.startsWith('}'.repeat(braces.at(-1)), i)) { i += braces.pop() - 1; }
    else if (text.startsWith('[[', i)) { links++; i++; }
    else if (links && text.startsWith(']]', i)) { links--; i++; }
    else if (!braces.length && !links && text[i] === separator) result.push(i);
  }
  return result;
}
export function scan(text) {
  const safe = masked(text), stack = [], result = [];
  for (let i = 0; i < safe.length; i++) {
    if (safe.startsWith('{{{', i)) { stack.push({start:i,size:3}); i+=2; }
    else if (safe.startsWith('{{', i)) { stack.push({start:i,size:2}); i++; }
    else if (stack.length && safe.startsWith('}'.repeat(stack.at(-1).size), i)) {
      const entry=stack.pop(), end=i+entry.size; i=end-1;
      if (entry.size !== 2) continue;
      const a=entry.start+2, b=end-2, pipes=boundaries(safe,a,b,'|');
      const name=text.slice(a,pipes[0]??b); if (!supported(name)) continue;
      const params={}; const spans={};
      for (let j=0;j<pipes.length;j++) {
        const from=pipes[j]+1,to=pipes[j+1]??b, eq=boundaries(safe,from,to,'=')[0];
        if (eq===undefined) continue;
        const key=normalize(text.slice(from,eq));
        params[key]=text.slice(eq+1,to).trim(); spans[key]={from:eq+1,to};
      }
      result.push({id:String(entry.start),start:entry.start,end,name:name.trim(),params,spans,raw:text.slice(entry.start,end)});
    }
  }
  return result.sort((a,b)=>a.start-b.start);
}
export function needsArchive(params) {
  return !['urlarchivo','fechaarchivo','url-archivo','fecha-archivo','archive-url','archive-date'].some(k=>params[k]?.trim());
}
export function sourceURL(value) {
  try { const u=new URL(value); return /^https?:$/.test(u.protocol) && !/[{}\[\]|\s<>]/.test(value) ? u.href : null; } catch { return null; }
}
export function archiveDate(timestamp) {
  if (!/^\d{14}$/.test(timestamp)) throw Error('Fecha de captura inválida');
  const iso=`${timestamp.slice(0,4)}-${timestamp.slice(4,6)}-${timestamp.slice(6,8)}`;
  const d=new Date(`${iso}T${timestamp.slice(8,10)}:${timestamp.slice(10,12)}:${timestamp.slice(12,14)}Z`);
  if (!Number.isFinite(+d)||d.toISOString().slice(0,10)!==iso) throw Error('Fecha de captura inválida');
  return iso;
}
export function patchTemplate(citation, archive) {
  let raw=citation.raw;
  const edits=[];
  for (const key of ['urlarchivo','fechaarchivo']) {
    if (citation.spans[key]) edits.push({...citation.spans[key],value:key==='urlarchivo'?archive.url:archive.date});
  }
  for (const e of edits.sort((a,b)=>b.from-a.from)) raw=raw.slice(0,e.from-citation.start)+e.value+raw.slice(e.to-citation.start);
  let extra='';
  for (const [key,value] of [['urlarchivo',archive.url],['fechaarchivo',archive.date]]) if (!citation.spans[key]) extra+=`|${key}=${value}`;
  return raw.slice(0,-2)+extra+'}}';
}
export function applySource(source, proposals) {
  let out=source;
  const sorted=[...proposals].sort((a,b)=>b.start-a.start);
  let previous=source.length;
  for (const p of sorted) {
    if (p.end>previous || source.slice(p.start,p.end)!==p.raw) throw Error('El texto ha cambiado. Vuelve a revisar.');
    out=out.slice(0,p.start)+p.after+out.slice(p.end); previous=p.start;
  }
  return out;
}
