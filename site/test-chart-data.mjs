import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aggregate,plotData} from './dist/chart-data.js';
const bar=(date,o,h,l,c)=>({time:Date.parse(date+'T00:00:00Z')/1000,open:o,high:h,low:l,close:c});
test('UTC week starts Monday across the year boundary; OHLC is preserved',()=>{
 const rows=[bar('2023-12-31',2,4,1,3),bar('2024-01-01',3,5,2,4),bar('2024-01-02',4,6,3,5)];
 const out=aggregate(rows,'1W');assert.equal(out.length,2);assert.equal(out[1].time,rows[1].time);assert.deepEqual([out[1].open,out[1].high,out[1].low,out[1].close],[3,6,2,5]);assert.equal(out[1].incomplete,false);assert.equal(out[0].incomplete,true);
});
test('Missing days stay empty and mark aggregate data incomplete',()=>{
 const rows=[bar('2024-01-01',2,3,1,2),bar('2024-01-03',2,4,1,3)];
 assert.equal(aggregate(rows,'1M')[0].incomplete,true);
 const points=plotData(rows,'1D','line');assert.equal(points.length,3);assert.deepEqual(Object.keys(points[1]),['time']);assert.equal(points[2].color,'transparent');
});
test('Month boundaries and unfinished candle status remain distinct',()=>{
 const rows=[bar('2024-01-31',2,3,1,2),{...bar('2024-02-01',2,4,1,3),partial:true}];const out=aggregate(rows,'1M');assert.equal(out.length,2);assert.equal(out[1].partial,true);assert.equal(out[1].incomplete,false);assert.deepEqual(aggregate(rows,'1D'),rows);
});
