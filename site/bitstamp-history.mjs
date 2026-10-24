import {readFile,writeFile,rename} from 'node:fs/promises';
import {calculate} from './live-calculation.mjs';
import {SOURCE,createBitstampFeed} from './bitstamp-feed.mjs';
const MINUTE=60000,STEP=5*MINUTE,WINDOWS={BVOL24H:1440,BVOL7D:10080};
export const HISTORY_START=Date.parse('2026-10-14T00:00:00Z');
export function dailyCandles(observations,now){
 const groups=new Map();
 for(const [timestamp,value] of observations){
  const time=Math.floor(timestamp/86400000)*86400;
  let g=groups.get(time);
  if(!g){g={time,open:value,high:value,low:value,close:value,count:0};groups.set(time,g);}
  g.high=Math.max(g.high,value);g.low=Math.min(g.low,value);g.close=value;g.count++;
 }
 return [...groups.values()].map(g=>({...g,bucketEnd:new Date((g.time+86400)*1000).toISOString(),partial:(g.time+86400)*1000>now,incomplete:g.count<Math.min(288,Math.floor((now-g.time*1000)/STEP)+1)}));
}
export function createBitstampHistory(file,{feed=createBitstampFeed(),clock=Date.now,pause=ms=>new Promise(r=>setTimeout(r,ms)),start=HISTORY_START}={}){
 let cache={prices:[],observations:{BVOL24H:[],BVOL7D:[]},computedAt:null},loaded=false,pending=null,error=null,lastChecked=null,lastAttempt=-Infinity;
 async function load(){
  if(!loaded){try{const saved=JSON.parse(await readFile(file,'utf8'));
   if(!Array.isArray(saved.prices)||Object.keys(WINDOWS).some(s=>!Array.isArray(saved.observations?.[s])))throw new Error('Invalid Bitstamp history cache');
   cache=saved;
  }catch(e){if(e.code!=='ENOENT')throw e;}loaded=true;}return cache;
 }
 async function refresh(){
  if(pending)return pending;if(clock()-lastAttempt<60000)return;lastAttempt=clock();
  pending=(async()=>{try{
   await load();
   const latest=(await feed({count:'1',reverse:'true'}))[0],latestTime=Date.parse(latest?.timestamp);
   if(latest?.symbol!==SOURCE||!Number.isInteger(latestTime/MINUTE)||latestTime>clock())throw new Error('Invalid latest Bitstamp minute');
   const target=Math.floor(latestTime/STEP)*STEP;
   const previous=cache.observations.BVOL7D.at(-1)?.[0];
   if(previous!==undefined&&target<previous)throw new Error('Bitstamp history moved backwards');
   const first=previous===undefined?start:previous+STEP;
   if(first>target){lastChecked=new Date(clock()).toISOString();error=null;return;}
   const prices=new Map(cache.prices),required=first-10080*MINUTE;
   let cursor=required;while(cursor<=target&&prices.has(cursor))cursor+=MINUTE;
   while(cursor<=target){
    const rows=await feed({count:'1000',reverse:'false',startTime:new Date(cursor).toISOString(),endTime:new Date(target).toISOString()});
    if(!rows.length)throw new Error('Missing Bitstamp minute: '+new Date(cursor).toISOString());
    for(const row of rows){const t=Date.parse(row.timestamp);
     if(row.symbol!==SOURCE||t!==cursor||!Number.isFinite(row.price)||row.price<=0||t>target)throw new Error('Missing/invalid Bitstamp minute: '+new Date(cursor).toISOString());
     prices.set(t,row.price);cursor+=MINUTE;
    }
    if(cursor<=target)await pause(1100);
   }
   const observations=structuredClone(cache.observations);
   for(let t=first;t<=target;t+=STEP)for(const [symbol,window] of Object.entries(WINDOWS))observations[symbol].push([t,calculate(prices,t,window)]);
   const next={prices:[...prices].filter(([t])=>t>=target-10080*MINUTE),observations,computedAt:new Date(clock()).toISOString()};
   await writeFile(file+'.tmp',JSON.stringify(next));await rename(file+'.tmp',file);cache=next;error=null;lastChecked=next.computedAt;
  }catch(e){error=e.message;lastChecked=new Date(clock()).toISOString();console.error('Bitstamp history:',error);}
  finally{pending=null;}})();return pending;
 }
 return {refresh,async response(){await load();return {source:SOURCE,computedAt:cache.computedAt,lastChecked,error,updating:Boolean(pending),indices:Object.fromEntries(Object.keys(WINDOWS).map(symbol=>{
  const rows=cache.observations[symbol],last=rows.at(-1);
  return [symbol,{candles:dailyCandles(rows,clock()),latest:last?{timestamp:new Date(last[0]).toISOString(),price:last[1]}:null}];
 }))};}};
}
