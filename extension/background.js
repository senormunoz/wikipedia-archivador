import {oldest} from './wayback.js';
import {sourceURL} from './core.js';
import {createScheduler} from './rate-limit.js';
chrome.action.onClicked.addListener(async tab=>{
  if (!tab.id || !/^https:\/\/es\.wikipedia\.org\//.test(tab.url||'')) return;
  try {
    await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',files:['bridge.js']});
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['panel.js']});
  } catch (e) { console.error('Wikipedia Archivador:', e.message); }
});
// Session storage survives service-worker suspension, but clears on browser exit.
const scheduler=createScheduler({lookup:oldest,storage:{
  async get(){return (await chrome.storage.session.get('wayback')).wayback;},
  async set(value){await chrome.storage.session.set({wayback:value});}
}});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if (message?.type!=='wayback' || !/^https:\/\/es\.wikipedia\.org\//.test(sender.url||'')) return;
  if(!sourceURL(message.url||'')){respond({error:'URL no compatible'});return;}
  scheduler.request(message.url,message.large===true).then(respond,e=>respond({error:e.message}));
  return true;
});
