import test from 'node:test';
import assert from 'node:assert/strict';
import {createBitstampFeed,SOURCE,fallbackNeeded} from './bitstamp-feed.mjs';
const now=Date.parse('2026-10-08T12:00:00Z');
test('Bitstamp closed candle timestamps and bounded pagination',async()=>{
 let url;
 const feed=createBitstampFeed({clock:()=>now,fetcher:async u=>{url=new URL(u);return {ok:true,json:async()=>({data:{pair:'BTC/USD',ohlc:[{timestamp:String(now/1000-60),close:'82000'}]}})};}});
 const rows=await feed({startTime:new Date(now).toISOString(),endTime:new Date(now).toISOString()});
 assert.equal(url.searchParams.get('start'),String(now/1000-60));
 assert.equal(url.searchParams.get('end'),null);
 assert.equal(url.searchParams.get('limit'),'1');
 assert.equal(url.searchParams.get('exclude_current_candle'),'true');
 assert.deepEqual(rows,[{symbol:SOURCE,timestamp:new Date(now).toISOString(),price:82000}]);
});
test('Bitstamp rejects unfinished candles and bad prices',async()=>{
 for(const row of [{timestamp:String(now/1000),close:'82000'},{timestamp:String(now/1000-60),close:'0'}]){
  const feed=createBitstampFeed({clock:()=>now,fetcher:async()=>({ok:true,json:async()=>({data:{pair:'BTC/USD',ohlc:[row]}})})});
  await assert.rejects(feed({}),/Invalid or unfinished/);
 }
});
test('Fallback activates per unavailable window and clears on primary recovery',()=>{
 const good={value:2,timestamp:new Date(now).toISOString()};
 const primary={results:{BVOL24H:good,BVOL7D:good},error:null};
 assert.deepEqual(fallbackNeeded(primary,now),{BVOL24H:false,BVOL7D:false});
 assert.deepEqual(fallbackNeeded({...primary,results:{BVOL24H:good,BVOL7D:{error:'Missing minute'}}},now),{BVOL24H:false,BVOL7D:true});
 assert.deepEqual(fallbackNeeded({...primary,error:'Network failed'},now),{BVOL24H:true,BVOL7D:true});
 assert.deepEqual(fallbackNeeded(primary,now+16*60000),{BVOL24H:true,BVOL7D:true});
 assert.deepEqual(fallbackNeeded(primary,now),{BVOL24H:false,BVOL7D:false});
});
