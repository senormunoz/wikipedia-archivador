import {oldest} from './wayback.js';
chrome.action.onClicked.addListener(async tab=>{
  if (!tab.id || !/^https:\/\/es\.wikipedia\.org\//.test(tab.url||'')) return;
  try {
    await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',files:['bridge.js']});
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['panel.js']});
  } catch (e) { console.error('Wikipedia Archivador:', e.message); }
});
// One sequential request at a time across tabs; no persistent browsing history.
let queue=Promise.resolve();
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if (message?.type!=='wayback' || !/^https:\/\/es\.wikipedia\.org\//.test(sender.url||'')) return;
  const job=queue.then(()=>oldest(message.url));
  queue=job.catch(()=>{}).then(()=>new Promise(r=>setTimeout(r,600)));
  job.then(value=>respond({value}),e=>respond({error:e.message}));
  return true;
});
