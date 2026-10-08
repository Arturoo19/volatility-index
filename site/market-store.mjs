import {readFile,writeFile,rename} from 'node:fs/promises';
const DAY=86400;
export function mergeDaily(previous,rows,now){
 const map=new Map(previous.map(r=>[r.time,r]));
 for(const row of rows){
  const end=Date.parse(row.timestamp)/1000;
  if(!Number.isFinite(end)||end%DAY!==0)throw new Error('Invalid bucket timestamp');
  const time=end-DAY;
  if(!row.trades){map.delete(time);continue;}
  if(!['open','high','low','close'].every(k=>Number.isFinite(row[k])&&row[k]>=0))throw new Error('Invalid OHLC');
  map.set(time,{time,...Object.fromEntries(['open','high','low','close'].map(k=>[k,row[k]])),bucketEnd:row.timestamp,partial:end>now/1000});
 }
 return [...map.values()].sort((a,b)=>a.time-b.time);
}
export function createMarketStore(file,{fetcher=fetch,clock=Date.now}={}){
 let market,pending,lastAttempt=0,lastChecked=null,error=null;
 async function load(){if(!market)market=JSON.parse(await readFile(file,'utf8'));return market;}
 async function api(endpoint,params){
  const response=await fetcher('https://www.bitmex.com/api/v1/'+endpoint+'?'+new URLSearchParams(params),{signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error('BitMEX HTTP '+response.status);
  const rows=await response.json();if(!Array.isArray(rows))throw new Error('Invalid BitMEX response');return rows;
 }
 async function refresh(){
  if(pending)return pending;
  if(clock()-lastAttempt<60000)return; // Bound manual refresh and failure retries.
  lastAttempt=clock();
  pending=(async()=>{try{
   const current=await load(),next=structuredClone(current),now=clock();
   for(const symbol of ['BVOL24H','BVOL7D']){
    const source=next.indices[symbol];
    // Re-fetch the previous and current daily buckets, catch up longer downtime.
    let cursor=(source.candles.at(-1).time)*1000;
    const rows=[];
    while(cursor<=now+DAY*1000){
     const page=await api('trade/bucketed',{symbol:'.'+symbol,binSize:'1d',count:'1000',reverse:'false',partial:'true',startTime:new Date(cursor).toISOString(),endTime:new Date(now+DAY*1000).toISOString()});
     if(!page.length)break;
     const stamps=page.map(r=>Date.parse(r.timestamp));
     if(page.some(r=>r.symbol!=='.'+symbol)||stamps.some((t,i)=>!Number.isFinite(t)||t<cursor||t>now+DAY*1000||(i>0&&t<=stamps[i-1])))throw new Error('Invalid bucket order');
     rows.push(...page);cursor=stamps.at(-1)+1;
     if(stamps.at(-1)>now)break;
    }
    if(!rows.length)throw new Error('No daily history returned');
    const ticks=await api('trade',{symbol:'.'+symbol,count:'1',reverse:'true'}),tick=ticks[0];
    if(!tick||tick.symbol!=='.'+symbol||!Number.isFinite(tick.price)||tick.price<0||!Number.isFinite(Date.parse(tick.timestamp)))throw new Error('Invalid index publication');
    if(Date.parse(tick.timestamp)<Date.parse(source.latest.timestamp))throw new Error('Publication moved backwards');
    source.candles=mergeDaily(source.candles,rows,now);source.latest=tick;
    source.missingDays=[];
    for(let i=1;i<source.candles.length;i++)for(let t=source.candles[i-1].time+DAY;t<source.candles[i].time;t+=DAY)source.missingDays.push(t);
   }
   next.downloadedAt=new Date(clock()).toISOString();
   await writeFile(file+'.tmp',JSON.stringify(next));await rename(file+'.tmp',file);
   market=next;lastChecked=next.downloadedAt;error=null;
  }catch(e){lastChecked=new Date(clock()).toISOString();error=String(e.message);console.error('Market refresh:',error);}
  finally{pending=null;}})();
  return pending;
 }
 return {load,refresh,async response(){return {...await load(),refresh:{lastChecked,error,updating:Boolean(pending),intervalSeconds:300}};}};
}
