import {readFile,writeFile,rename} from 'node:fs/promises';
const MINUTE=60000;
const WINDOWS={BVOL24H:1440,BVOL7D:10080};
function sum(values){let total=0,correction=0;for(const x of values){const next=total+x;correction+=Math.abs(total)>=Math.abs(x)?(total-next)+x:(x-next)+total;total=next;}return total+correction;}
export function calculate(prices,timestamp,window){
 if(!Number.isInteger(timestamp/MINUTE))throw new Error('Timestamp must align to UTC minute');
 const returns=[];let previous;
 for(let i=window;i>=0;i--){const time=timestamp-i*MINUTE,p=prices.get(time);if(!Number.isFinite(p)||p<=0)throw new Error('Missing/invalid minute: '+new Date(time).toISOString());if(previous!==undefined)returns.push(Math.log(p/previous));previous=p;}
 const mean=sum(returns)/window;
 return 100*Math.sqrt(sum(returns.map(r=>(r-mean)**2))/(window-1))*Math.sqrt(window);
}
export function createLiveCalculation(file,{fetcher=fetch,clock=Date.now,pause=ms=>new Promise(r=>setTimeout(r,ms)),priceFeed=null,source='.BXBT'}={}){
 let cache={prices:[],results:{},computedAt:null},loaded=false,pending=null,error=null,lastChecked=null,lastAttempt=0;
 async function load(){if(!loaded){try{const saved=JSON.parse(await readFile(file,'utf8'));if(!Array.isArray(saved.prices)||saved.prices.some(([t,p])=>!Number.isInteger(t/MINUTE)||!Number.isFinite(p)||p<=0))throw new Error('Invalid minute cache');cache=saved;}catch(e){if(e.code!=='ENOENT')console.error('Minute cache:',e.message);}loaded=true;}return cache;}
 async function api(params){if(priceFeed)return priceFeed(params);const r=await fetcher('https://www.bitmex.com/api/v1/trade?'+new URLSearchParams({symbol:'.BXBT',...params}),{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error('BitMEX HTTP '+r.status);const rows=await r.json();if(!Array.isArray(rows))throw new Error('Invalid BXBT response');return rows;}
 async function refresh(){
  if(pending)return pending;
  if(clock()-lastAttempt<60000)return;
  lastAttempt=clock();
  pending=(async()=>{try{
   await load();
   const latest=(await api({count:'1',reverse:'true'}))[0];
   const latestTime=Date.parse(latest?.timestamp);
   if(latest?.symbol!==source||!Number.isFinite(latestTime)||!Number.isFinite(latest.price)||latest.price<=0||latestTime>clock()+MINUTE)throw new Error('Invalid latest price publication');
   const target=Math.floor(latestTime/(5*MINUTE))*5*MINUTE,start=target-10080*MINUTE;
   if(cache.results.BVOL7D?.timestamp===new Date(target).toISOString()&&!cache.results.BVOL7D.error&&!cache.results.BVOL24H?.error){error=null;lastChecked=new Date(clock()).toISOString();return;}
   const prices=new Map(cache.prices.filter(([t])=>t>=start&&t<=target));
   let cursor=start;
   while(cursor<=target&&prices.has(cursor))cursor+=MINUTE;
   while(cursor<=target){
    await pause(1100);
    const rows=await api({count:'1000',reverse:'false',startTime:new Date(cursor).toISOString(),endTime:new Date(target).toISOString()});
    if(!rows.length)break;
    let previous=cursor-1;
    for(const r of rows){const t=Date.parse(r.timestamp);if(r.symbol!==source||!Number.isInteger(t/MINUTE)||t<cursor||t>target||t<=previous||!Number.isFinite(r.price)||r.price<=0)throw new Error('Invalid minute sequence');prices.set(t,r.price);previous=t;}
    cursor=previous+1;
   }
   const results={};
   for(const [symbol,window] of Object.entries(WINDOWS)){
    const base={timestamp:new Date(target).toISOString(),source,windowMinutes:window,ddof:1};
    try{results[symbol]={...base,value:calculate(prices,target,window),error:null};}
    catch(e){results[symbol]={...base,value:null,error:e.message};}
   }
   const next={prices:[...prices].sort((a,b)=>a[0]-b[0]),results,computedAt:new Date(clock()).toISOString()};
   await writeFile(file+'.tmp',JSON.stringify(next));await rename(file+'.tmp',file);cache=next;error=null;lastChecked=next.computedAt;
  }catch(e){error=e.message;lastChecked=new Date(clock()).toISOString();console.error('Independent calculation:',error);}
  finally{pending=null;}})();return pending;
 }
 return {refresh,async response(){await load();return {results:cache.results,computedAt:cache.computedAt,lastChecked,error,updating:Boolean(pending)};}};
}
