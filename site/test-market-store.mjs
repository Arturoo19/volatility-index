import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {createMarketStore,mergeDaily} from './market-store.mjs';
const now=Date.parse('2026-10-07T12:00:00Z');
const candle={time:Date.parse('2026-10-07T00:00:00Z')/1000,open:1,high:2,low:1,close:2,partial:true};
const fixture=()=>({downloadedAt:'2026-10-07T10:00:00Z',indices:Object.fromEntries(['BVOL24H','BVOL7D'].map(s=>[s,{candles:[candle],latest:{timestamp:'2026-10-07T10:00:00Z',price:2},missingDays:[],comparisons:{}}]))});
test('refresh is deduplicated, persisted and throttled; failure retains last good data',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bvol-test-'));const file=path.join(dir,'market.json');await writeFile(file,JSON.stringify(fixture()));let calls=0,fail=false,time=now;
 const store=createMarketStore(file,{clock:()=>time,fetcher:async url=>{calls++;if(fail)throw new Error('test outage');const u=new URL(url),symbol=u.searchParams.get('symbol');return {ok:true,json:async()=>u.pathname.endsWith('bucketed')?[{timestamp:'2026-10-08T00:00:00Z',symbol,open:1,high:3,low:1,close:3,trades:100}]:[{timestamp:'2026-10-07T12:00:00Z',symbol,price:3}]};}});
 try{await Promise.all([store.refresh(),store.refresh()]);assert.equal(calls,4);assert.equal((await store.load()).indices.BVOL24H.latest.price,3);const saved=await readFile(file,'utf8');await store.refresh();assert.equal(calls,4);time+=300000;fail=true;await store.refresh();assert.equal(await readFile(file,'utf8'),saved);assert.match((await store.response()).refresh.error,/test outage/);}finally{await rm(dir,{recursive:true});}
});
test('daily merge replaces the unfinished candle without duplication',()=>{
 const out=mergeDaily([candle],[{timestamp:'2026-10-08T00:00:00Z',open:1,high:3,low:1,close:3,trades:1}],now);assert.equal(out.length,1);assert.equal(out[0].close,3);assert.equal(out[0].partial,true);
});
