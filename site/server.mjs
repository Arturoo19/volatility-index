import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {aggregate} from './dist/chart-data.js';
import {toCSV} from './dist/csv.js';
import {createMarketStore} from './market-store.mjs';
import {createLiveCalculation} from './live-calculation.mjs';
import {createBitstampFeed,SOURCE,fallbackNeeded} from './bitstamp-feed.mjs';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml'};
const store=createMarketStore(path.join(root,'data/market.json'));
const calculation=createLiveCalculation(path.resolve(root,'../bxbt-live.json'));
const fallback=createLiveCalculation(path.resolve(root,'../bitstamp-live.json'),{source:SOURCE,priceFeed:createBitstampFeed()});
async function refreshCalculations(){await calculation.refresh();const needed=fallbackNeeded(await calculation.response());if(Object.values(needed).some(Boolean))await fallback.refresh();}
async function refreshAll(){await store.refresh();await refreshCalculations();}
void refreshAll();setInterval(()=>void refreshAll(),300000).unref();
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/market'){
      if(req.method==='POST'){await store.refresh();void refreshCalculations();}
      else if(req.method!=='GET'){res.writeHead(405).end();return;}
      const independent=await calculation.response(),active=fallbackNeeded(independent);
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({...await store.response(),independent,fallback:{...await fallback.response(),active}}));return;
    }
    if(url.pathname==='/export.csv'){
      const symbol=url.searchParams.get('symbol'),frame=url.searchParams.get('frame'),date=url.searchParams.get('date');
      if(!['BVOL24H','BVOL7D'].includes(symbol)||!['1D','1W','1M'].includes(frame)||(date&&!['2020-03-12','2025-05-01','2026-09-18'].includes(date))){res.writeHead(400).end('Invalid selection');return;}
      const market=await store.load();
      const source=market.indices[symbol];const rows=date?source.comparisons[date]:aggregate(source.candles,frame);
      res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${symbol}-${date||frame}.csv"`,'Cache-Control':'no-store'}).end(toCSV(rows,Boolean(date)));return;
    }
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html')){res.writeHead(403).end();return;}
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}).end(body);
  }catch{res.writeHead(404).end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:4173'));
