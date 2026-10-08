import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createLiveCalculation} from './live-calculation.mjs';
test('minute cache supports incremental updates, deduplication and failure retention',async()=>{
 const base=Date.parse('2026-10-07T14:00:00Z'),root=path.resolve(os.tmpdir());
 const dir=await mkdtemp(path.join(root,'bvol-live-test-'));
 assert.ok(path.resolve(dir).startsWith(root+path.sep+'bvol-live-test-'));
 const file=path.join(dir,'minutes.json');let clock=base+300000,calls=0,fail=false;
 await writeFile(file,JSON.stringify({prices:Array.from({length:10081},(_,i)=>[base-(10080-i)*60000,100]),results:{},computedAt:null}));
 const live=createLiveCalculation(file,{clock:()=>clock,pause:async()=>{},fetcher:async url=>{calls++;if(fail)throw new Error('simulated failure');const p=new URL(url).searchParams;const rows=p.get('count')==='1'?[{symbol:'.BXBT',timestamp:new Date(clock).toISOString(),price:100}]:Array.from({length:5},(_,i)=>({symbol:'.BXBT',timestamp:new Date(base+(i+1)*60000).toISOString(),price:100}));return {ok:true,json:async()=>rows};}});
 try{
  await Promise.all([live.refresh(),live.refresh()]);assert.equal(calls,2);
  const result=await live.response();assert.equal(result.results.BVOL24H.value,0);assert.equal(result.results.BVOL7D.value,0);
  const saved=await readFile(file,'utf8');assert.equal(JSON.parse(saved).prices.length,10081);
  await live.refresh();assert.equal(calls,2);
  clock+=300000;fail=true;await live.refresh();const failed=await live.response();assert.match(failed.error,/simulated failure/);assert.deepEqual(failed.results,result.results);assert.equal(await readFile(file,'utf8'),saved);
 }finally{await rm(dir,{recursive:true});}
});
