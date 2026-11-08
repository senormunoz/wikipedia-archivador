export function retryDeadline(value, now=Date.now()) {
  if (typeof value!=='string'||!value.trim()) return null;
  const seconds=Number(value);
  if(Number.isFinite(seconds)&&seconds<0)return null;
  const deadline=Number.isFinite(seconds)?now+seconds*1000:Date.parse(value);
  return Number.isFinite(deadline)?Math.max(now,deadline):null;
}
export function createScheduler({lookup,storage,now=Date.now,random=Math.random}) {
  let queue=Promise.resolve();
  async function request(url,large=false) {
    const state=await storage.get()||{cache:[],nextAllowed:0,cooldownUntil:0,strikes:0};
    const time=now();state.cache=(state.cache||[]).filter(e=>e.expires>time);
    const cached=state.cache.find(e=>e.url===url);
    if(cached)return {value:cached.value,cached:true};
    if(state.cooldownUntil>time)return {limited:true,waitUntil:state.cooldownUntil};
    if(state.nextAllowed>time)return {waitUntil:state.nextAllowed};
    try {
      const value=await lookup(url);
      state.cache.push({url,value,expires:now()+(value?86400000:3600000)});
      state.cache=state.cache.slice(-300);
      state.nextAllowed=now()+(large?3000:1500)+random()*(large?2000:1000)+Math.min(state.strikes||0,5)*1000;
      await storage.set(state);return {value};
    } catch(e) {
      if(e.status===429){
        state.strikes=(state.strikes||0)+1;
        const fallback=now()+Math.min(900000,60000*2**Math.min(state.strikes-1,4));
        state.cooldownUntil=Math.max(now()+1000,e.retryAt??fallback)+random()*1000;
        state.nextAllowed=state.cooldownUntil;
        await storage.set(state);
        return {limited:true,waitUntil:state.cooldownUntil};
      }
      state.nextAllowed=now()+3000;await storage.set(state);
      return {error:e.message};
    }
  }
  return {request(url,large){const job=queue.then(()=>request(url,large));queue=job.catch(()=>{});return job;}};
}
