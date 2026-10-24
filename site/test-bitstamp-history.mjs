import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createBitstampHistory,dailyCandles} from './bitstamp-history.mjs';
import {SOURCE} from './bitstamp-feed.mjs';
test('history backfills both windows, persists, catches up and retains data on a minute gap',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bvol-history-')),file=path.join(dir,'history.json');
 const start=Date.parse('2026-10-14T00:00:00Z');let now=start,calls=0,gap=false;
 const feed=async params=>{
  calls++;if(!params.startTime)return [{symbol:SOURCE,timestamp:new Date(now).toISOString(),price:200}];
  const from=Date.parse(params.startTime),to=Math.min(Date.parse(params.endTime),from+999*60000),rows=[];
  for(let t=from;t<=to;t+=60000)if(!gap||t!==now-60000)rows.push({symbol:SOURCE,timestamp:new Date(t).toISOString(),price:t<start?100:200});
  return rows;
 };
 const options={feed,clock:()=>now,pause:async()=>{},start};
 try{
  const history=createBitstampHistory(file,options);
  await Promise.all([history.refresh(),history.refresh()]);
  const initial=await history.response();assert.equal(initial.error,null);assert.equal(calls,12);
  for(const symbol of ['BVOL24H','BVOL7D'])assert.ok(Math.abs(initial.indices[symbol].latest.price-100*Math.log(2))<1e-10);
  assert.equal(initial.indices.BVOL7D.candles[0].partial,true);
  const restarted=createBitstampHistory(file,options);assert.deepEqual((await restarted.response()).indices,initial.indices);
  now+=300000;await restarted.refresh();assert.equal((await restarted.response()).indices.BVOL7D.latest.timestamp,new Date(now).toISOString());
  const saved=await readFile(file,'utf8');assert.equal(JSON.parse(saved).prices.length,10081);
  now+=300000;gap=true;await restarted.refresh();assert.match((await restarted.response()).error,/Missing\/invalid/);assert.equal(await readFile(file,'utf8'),saved);
  now+=300000;gap=false;await restarted.refresh();assert.equal((await restarted.response()).error,null);
  const observations=JSON.parse(await readFile(file,'utf8')).observations.BVOL7D;
  assert.equal(observations.length,4);assert.equal(new Set(observations.map(r=>r[0])).size,4);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('daily OHLC separates UTC days and marks missing five-minute observations',()=>{
 const start=Date.parse('2026-10-14T00:00:00Z');
 const rows=dailyCandles([[start,3],[start+300000,5],[start+600000,2],[start+86400000,4]],start+86400000);
 assert.deepEqual([rows[0].open,rows[0].high,rows[0].low,rows[0].close],[3,5,2,2]);
 assert.equal(rows[0].partial,false);assert.equal(rows[0].incomplete,true);assert.equal(rows[1].partial,true);assert.equal(rows[1].incomplete,false);
});
