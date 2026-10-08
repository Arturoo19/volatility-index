export const SOURCE='Bitstamp BTC/USD';
// A closed minute candle at S supplies its close at S+60 seconds.
// This is an explicitly different price series from BitMEX minute snapshots.
export function createBitstampFeed({fetcher=fetch,clock=Date.now}={}){
 return async params=>{
  const query=new URLSearchParams({step:'60',exclude_current_candle:'true'});
  const first=params.startTime?Math.ceil(Date.parse(params.startTime)/60000)*60000:null;
  const end=params.endTime?Date.parse(params.endTime):null;
  query.set('limit',String(first===null?1:Math.min(1000,Math.floor((end-first)/60000)+1)));
  // Bitstamp ignores start when end is also supplied: use start and bounded limit.
  if(first!==null)query.set('start',String(first/1000-60));
  const r=await fetcher('https://www.bitstamp.net/api/v2/ohlc/btcusd/?'+query,{signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw new Error('Bitstamp HTTP '+r.status);
  const body=await r.json(),rows=body.data?.ohlc;
  if(!Array.isArray(rows)||body.data?.pair!=='BTC/USD')throw new Error('Invalid Bitstamp OHLC');
  const result=rows.map(row=>({symbol:SOURCE,timestamp:new Date((Number(row.timestamp)+60)*1000).toISOString(),price:Number(row.close)}));
  for(const row of result){const t=Date.parse(row.timestamp);if(!Number.isInteger(t/60000)||t>Math.floor(clock()/60000)*60000||!Number.isFinite(row.price)||row.price<=0)throw new Error('Invalid or unfinished Bitstamp candle');}
  const sorted=result.sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
  if(first===null)return sorted.slice(-1);
  return sorted.filter(row=>Date.parse(row.timestamp)>=first&&Date.parse(row.timestamp)<=end);
 };
}
export function fallbackNeeded(primary,now=Date.now()){
 return Object.fromEntries(['BVOL24H','BVOL7D'].map(symbol=>{const r=primary.results?.[symbol];return [symbol,Boolean(primary.error)||!r||Boolean(r.error)||!Number.isFinite(r.value)||!Number.isFinite(Date.parse(r.timestamp))||now-Date.parse(r.timestamp)>15*60000];}));
}
