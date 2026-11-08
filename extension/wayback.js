import {archiveDate,sourceURL} from './core.js';
export async function oldest(url, fetcher=fetch) {
  if (!sourceURL(url)) throw Error('URL no compatible');
  const query=new URLSearchParams({url,matchType:'exact',output:'json',fl:'timestamp,original,statuscode',filter:'statuscode:200',limit:'1'});
  const response=await fetcher(`https://web.archive.org/cdx/search/cdx?${query}`,{signal:AbortSignal.timeout(30000),credentials:'omit',redirect:'error'});
  if (!response.ok) throw Error(`Wayback respondió HTTP ${response.status}. Vuelve a intentarlo más tarde.`);
  const rows=await response.json();
  if (!Array.isArray(rows)) throw Error('Respuesta de Wayback inválida');
  if (rows.length===0 || rows.length===1 && rows[0][0]==='timestamp') return null;
  if (JSON.stringify(rows[0])!==JSON.stringify(['timestamp','original','statuscode'])) throw Error('Cabecera de Wayback inválida');
  const row=rows[1];
  if (!Array.isArray(row)||row[2]!=='200'||!sourceURL(row[1])) throw Error('Captura inválida');
  const date=archiveDate(row[0]);
  // CDX returns captures chronologically (oldest first), without collapse.
  return {url:`https://web.archive.org/web/${row[0]}/${row[1]}`,date,timestamp:row[0]};
}
