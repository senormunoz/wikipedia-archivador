import test from 'node:test';
import assert from 'node:assert/strict';
import {retryDeadline,createScheduler} from '../extension/rate-limit.js';
import {oldest} from '../extension/wayback.js';
function fixture(lookup){let time=1000000,data;const storage={get:async()=>structuredClone(data),set:async v=>{data=structuredClone(v);}};const options={lookup,storage,now:()=>time,random:()=>0};return {scheduler:createScheduler(options),restart:()=>createScheduler(options),advance:ms=>time+=ms,state:()=>data,now:()=>time};}
test('Retry-After supports seconds and HTTP dates without shortening waits',()=>{
 assert.equal(retryDeadline('120',1000),121000);
 assert.equal(retryDeadline('Thu, 01 Jan 1970 00:02:00 GMT',1000),120000);
 assert.equal(retryDeadline('Thu, 01 Jan 1970 00:00:00 GMT',1000),1000);
 assert.equal(retryDeadline('-1',1000),null);assert.equal(retryDeadline(null,1000),null);assert.equal(retryDeadline('invalid',1000),null);
});
test('HTTP 429 preserves the retry deadline for the scheduler',async()=>{
 await assert.rejects(oldest('https://example.org',async()=>({ok:false,status:429,headers:{get:()=> '120'}})),e=>e.status===429&&e.retryAt>Date.now()+119000);
});
test('cache deduplicates lookups across reviews and worker restarts; negative results expire sooner',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return null;});
 assert.deepEqual(await f.scheduler.request('https://a.org'),{value:null});
 assert.equal((await f.restart().request('https://a.org')).cached,true);assert.equal(calls,1);
 f.advance(3600001);await f.scheduler.request('https://a.org');assert.equal(calls,2);
});
test('large reviews wait at least three seconds; global pacing survives worker restarts',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return {url:'archive'};});
 await f.scheduler.request('a',true);
 assert.equal((await f.restart().request('b')).waitUntil,f.now()+3000);assert.equal(calls,1);
 f.advance(3000);await f.scheduler.request('b',true);assert.equal(calls,2);
});
test('429 pauses the global queue and is not cached; repeated limits back off',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;throw Object.assign(Error('429'),{status:429});});
 const first=await f.scheduler.request('a');assert.equal(first.limited,true);assert.equal(first.waitUntil,f.now()+60000);
 assert.deepEqual(await f.restart().request('b'),first);assert.equal(calls,1);
 f.advance(60000);const second=await f.scheduler.request('a');assert.equal(second.waitUntil,f.now()+120000);assert.equal(calls,2);assert.equal(f.state().cache.length,0);
});
test('a server Retry-After longer than the fallback is respected',async()=>{
 const f=fixture(async()=>{throw Object.assign(Error('429'),{status:429,retryAt:2000000});});
 assert.equal((await f.scheduler.request('a')).waitUntil,2000000);
});
test('requests are serialized across simultaneous callers and cached results need no network during cooldown',async()=>{
 let active=0,max=0,calls=0;const f=fixture(async url=>{active++;max=Math.max(max,active);calls++;await Promise.resolve();active--;return {url};});
 const result=await Promise.all([f.scheduler.request('a'),f.scheduler.request('b'),f.scheduler.request('a')]);
 assert.equal(max,1);assert.equal(calls,1);assert(result[1].waitUntil);assert(result[2].cached);
});
