import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {calculate} from './live-calculation.mjs';
test('a missing minute rejects the calculation; daily and weekly windows are separate',()=>{
 const t=Date.parse('2026-10-07T00:00:00Z'),prices=new Map(Array.from({length:1441},(_,i)=>[t-i*60000,100]));
 assert.equal(calculate(prices,t,1440),0);assert.throws(()=>calculate(prices,t,10080),/Missing/);
 prices.delete(t-42*60000);assert.throws(()=>calculate(prices,t,1440),/Missing/);
});
test('production JS reproduces all 1734 saved Python comparisons',async()=>{
 const prices=new Map(),dir=new URL('../data/validation/raw/',import.meta.url);
 for(const file of await readdir(dir)){const saved=JSON.parse(await readFile(new URL(file,dir),'utf8'));for(const r of saved.rows||[])if(r.symbol==='.BXBT'&&Number.isFinite(r.price))prices.set(Date.parse(r.timestamp),r.price);}
 let count=0,maxDifference=0;
 for(const [symbol,window] of [['bvol24h',1440],['bvol7d',10080]])for(const date of ['2020-03-12','2025-05-01','2026-09-18']){
  const lines=(await readFile(new URL(`../data/validation/${symbol}-${date}.csv`,import.meta.url),'utf8')).trim().split(/\r?\n/).slice(1);
  for(const line of lines){const [timestamp,official,python]=line.split(',');const result=calculate(prices,Date.parse(timestamp),window),difference=Math.abs(result-Number(python));maxDifference=Math.max(maxDifference,difference);assert.ok(difference<1e-11,`${symbol} ${timestamp}`);assert.equal(Math.round(result*100),Math.round(Number(official)*100));count++;}
 }
 assert.equal(count,1734);console.log({comparisons:count,maxDifferenceFromPython:maxDifference});
});
