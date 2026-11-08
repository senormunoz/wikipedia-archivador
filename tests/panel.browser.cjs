const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try {
 const page=await browser.newPage();
 const initial='{{Cita web|url=https://example.org/a|título=Uno}}\n\n{{Cita libro|url=https://example.org/b|urlarchivo=https://web.archive.org/web/20000101000000/https://example.org/b|fechaarchivo=2000-01-01}}';
 await page.route('https://es.wikipedia.org/**',route=>{
  if(route.request().url().endsWith('/test-core.js'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../extension/core.js'),'utf8')});
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><textarea id="wpTextbox1"></textarea></body></html>'});
 });
 await page.goto('https://es.wikipedia.org/test');
 await page.locator('#wpTextbox1').fill(initial);
 await page.evaluate(()=>{window.calls=[];window.chrome={runtime:{getURL:()=> 'https://es.wikipedia.org/test-core.js',sendMessage:async message=>{calls.push(message);return {value:{url:'https://web.archive.org/web/20010102030405/'+message.url,date:'2001-01-02'}};}}};});
 await page.addScriptTag({path:path.join(__dirname,'../extension/bridge.js')});
 // Open the shadow root only in the test harness to inspect the panel.
 const panel=fs.readFileSync(path.join(__dirname,'../extension/panel.js'),'utf8').replace("mode:'closed'","mode:'open'");
 await page.addScriptTag({content:panel});
 await page.getByRole('button',{name:'Aplicar todo',exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('#wikipedia-archivador').shadowRoot.querySelector('#apply').disabled);
 assert.equal(await page.locator('#wpTextbox1').inputValue(),initial,'Preview must not change the editor');
 assert.equal(await page.evaluate(()=>calls.length),1,'Existing archive must not be queried');
 await page.getByRole('button',{name:'Aplicar todo',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#wikipedia-archivador').shadowRoot.querySelector('#status').textContent.includes('actualizadas en el editor'));
 const updated=await page.locator('#wpTextbox1').inputValue();
 assert(updated.includes('|fechaarchivo=2001-01-02'));assert(updated.endsWith(initial.split('\n\n')[1]));assert(updated.includes('\n\n'));
 console.log('PASS: panel, preview, archive preservation and Aplicar todo');
 await page.getByRole('button',{name:'Revisar referencias',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#wikipedia-archivador').shadowRoot.querySelector('#status').textContent.includes('0 cambios preparados'));
 assert.equal(await page.evaluate(()=>calls.length),1);console.log('PASS: second run is idempotent');
 // Reset source and check stale snapshot protection through the full panel.
 await page.locator('#wpTextbox1').fill(initial);
 await page.getByRole('button',{name:'Revisar referencias',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('#wikipedia-archivador').shadowRoot.querySelector('#apply').disabled);
 await page.locator('#wpTextbox1').fill(initial+'\nMi cambio sin guardar');
 await page.getByRole('button',{name:'Aplicar todo',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#wikipedia-archivador').shadowRoot.querySelector('#status').textContent.includes('El texto ha cambiado'));
 assert((await page.locator('#wpTextbox1').inputValue()).endsWith('Mi cambio sin guardar'));
 console.log('PASS: unsaved changes are preserved when the snapshot is stale');
 // Apply out of source order, then apply only the remaining references.
 const unarchivedB='{{Cita noticia|url=https://example.org/c|título=Dos}}';
 const unarchivedC='{{Cita libro|url=https://example.org/d|título=Tres}}';
 const individualSource=initial+'\n\n'+unarchivedB+'\n\n'+unarchivedC;
 await page.locator('#wpTextbox1').fill(individualSource);
 await page.getByRole('button',{name:'Revisar referencias',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('#wikipedia-archivador').shadowRoot.querySelector('#apply').disabled);
 const individual=page.getByRole('button',{name:'Aplicar referencia',exact:true});
 assert.equal(await individual.count(),3);
 await individual.nth(2).click();
 await page.waitForFunction(()=>document.querySelector('#wikipedia-archivador').shadowRoot.querySelector('#status').textContent.includes('2 pendientes'));
 let partial=await page.locator('#wpTextbox1').inputValue();
 assert(partial.startsWith(initial+'\n\n'+unarchivedB));
 assert(partial.endsWith(unarchivedC.slice(0,-2)+'|urlarchivo=https://web.archive.org/web/20010102030405/https://example.org/d|fechaarchivo=2001-01-02}}'));
 assert.equal(await page.getByRole('button',{name:'Aplicado',exact:true}).count(),1);
 assert(await page.getByRole('button',{name:'Aplicado',exact:true}).isDisabled());
 await individual.nth(0).click();
 await page.waitForFunction(()=>document.querySelector('#wikipedia-archivador').shadowRoot.querySelector('#status').textContent.includes('1 pendientes'));
 partial=await page.locator('#wpTextbox1').inputValue();assert(partial.includes(unarchivedB));
 await page.getByRole('button',{name:'Aplicar todo',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#wikipedia-archivador').shadowRoot.querySelector('#status').textContent.includes('0 pendientes'));
 const final=await page.locator('#wpTextbox1').inputValue();
 assert.equal((final.match(/fechaarchivo=2001-01-02/g)||[]).length,3);
 assert(final.includes(initial.split('\n\n')[1]));
 assert.equal(await page.getByRole('button',{name:'Aplicado',exact:true}).count(),3);
 assert(await page.getByRole('button',{name:'Aplicar todo',exact:true}).isDisabled());
 console.log('PASS: individual applications out of order, then Aplicar todo for remaining references');
 assert(await page.getByRole('dialog',{name:'Wikipedia Archivador'}).isVisible());
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 assert.equal(await page.getByRole('dialog',{name:'Wikipedia Archivador'}).isVisible(),false);
 await page.addScriptTag({content:panel});
 assert(await page.getByRole('dialog',{name:'Wikipedia Archivador'}).isVisible());
 assert.equal(await page.getByRole('button',{name:'Aplicado',exact:true}).count(),3);
 console.log('PASS: close after Aplicar todo and reopen the existing panel');

 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
