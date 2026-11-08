import test from 'node:test';
import assert from 'node:assert/strict';
import {scan,needsArchive,patchTemplate,applySource,archiveDate,sourceURL} from '../extension/core.js';
import {oldest} from '../extension/wayback.js';
const archive={url:'https://web.archive.org/web/20010102030405/https://example.org/',date:'2001-01-02'};
test('four supported templates, nested markup, comments and nowiki',()=>{
 const s='<!-- {{Cita web|url=https://ignored.org}} --><nowiki>{{Cita libro|url=x}}</nowiki>'+['web','noticia','publicación','libro'].map(t=>`<ref>{{Cita ${t}|url=https://example.org/?a=1&b=2|título={{lang|es|[[Uno|Dos]]}}}}</ref>`).join('');
 const found=scan(s);assert.equal(found.length,4);assert.equal(found[0].params.url,'https://example.org/?a=1&b=2');assert.equal(found[0].params.título,'{{lang|es|[[Uno|Dos]]}}');
});
test('existing archive data including partial fields are preserved',()=>{
 for(const p of [{urlarchivo:'x'},{fechaarchivo:'2000-01-01'},{'archive-url':'x'}])assert.equal(needsArchive(p),false);
 assert.equal(needsArchive({urlarchivo:' '}),true);
});
test('patch fills empty parameters, preserves original URL and is idempotent',()=>{
 const s='before {{Cita web\n|url=https://example.org/\n|urlarchivo=\n|fechaarchivo=\n|título=Hola\n}} after';const c=scan(s)[0];
 const after=patchTemplate(c,archive);const updated=applySource(s,[{...c,after}]);
 assert.equal(scan(updated)[0].params.url,'https://example.org/');assert.equal(scan(updated)[0].params.fechaarchivo,archive.date);assert.equal(needsArchive(scan(updated)[0].params),false);assert.equal((updated.match(/urlarchivo=/g)||[]).length,1);
 assert.throws(()=>applySource('changed'+s,[{...c,after}]));
});
test('multiple replacements use original offsets',()=>{
 const s='{{Cita web|url=https://a.org}} text {{Cita libro|url=https://b.org}}';const p=scan(s).map(c=>({...c,after:patchTemplate(c,archive)}));assert.equal(scan(applySource(s,p)).filter(c=>!needsArchive(c.params)).length,2);
});
test('URL and date validation',()=>{assert.equal(sourceURL('javascript:alert(1)'),null);assert.equal(sourceURL('https://x.org/{{x}}'),null);assert.equal(archiveDate('20000229010203'),'2000-02-29');assert.throws(()=>archiveDate('20010229010203'));});
test('CDX query requests earliest exact match and only status 200',async()=>{
 let requested;const result=await oldest('https://example.org/',async url=>{requested=new URL(url);return{ok:true,json:async()=>[['timestamp','original','statuscode'],['20010102030405','https://example.org/','200']]};});
 assert.equal(requested.searchParams.get('limit'),'1');assert.equal(requested.searchParams.get('matchType'),'exact');assert.equal(requested.searchParams.get('filter'),'statuscode:200');assert.deepEqual(result,{...archive,timestamp:'20010102030405'});
});
test('CDX absence, service failure, and malformed capture remain distinct',async()=>{
 assert.equal(await oldest('https://example.org',async()=>({ok:true,json:async()=>[]})),null);
 await assert.rejects(oldest('https://example.org',async()=>({ok:false,status:429})),/429/);
 await assert.rejects(oldest('https://example.org',async()=>({ok:true,json:async()=>[['timestamp','original','statuscode'],['20010102030405','https://example.org','404']]})),/inválida/);
});
