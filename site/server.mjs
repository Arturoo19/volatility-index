import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {aggregate} from './dist/chart-data.js';
import {toCSV} from './dist/csv.js';
import {createMarketStore} from './market-store.mjs';
import {createLiveCalculation} from './live-calculation.mjs';
import {createBitstampFeed,SOURCE,fallbackNeeded} from './bitstamp-feed.mjs';
import {readServerConfig,prepareStorage} from './server-config.mjs';
import {createBitstampHistory} from './bitstamp-history.mjs';
const config=readServerConfig();
await prepareStorage(config);
const root=config.root;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml'};
const store=createMarketStore(config.marketFile);
const calculation=createLiveCalculation(config.calculationFile);
const fallback=createLiveCalculation(config.fallbackFile,{source:SOURCE,priceFeed:createBitstampFeed()});
const history=createBitstampHistory(config.historyFile);
async function refreshCalculations(){await calculation.refresh();const needed=fallbackNeeded(await calculation.response());if(Object.values(needed).some(Boolean))await fallback.refresh();}
async function refreshAll(){await Promise.all([store.refresh(),refreshCalculations(),history.refresh()]);}
void refreshAll();setInterval(()=>void refreshAll(),300000).unref();
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/healthz'){
      if(req.method!=='GET'){res.writeHead(405).end();return;}
      await store.load();
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({status:'ok'}));return;
    }
    if(url.pathname==='/api/market'){
      if(req.method==='POST'){await store.refresh();void refreshCalculations();void history.refresh();}
      else if(req.method!=='GET'){res.writeHead(405).end();return;}
      const independent=await calculation.response(),active=fallbackNeeded(independent);
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({...await store.response(),independent,fallback:{...await fallback.response(),active},bitstamp:await history.response()}));return;
    }
    if(url.pathname==='/export.csv'){
      const symbol=url.searchParams.get('symbol'),frame=url.searchParams.get('frame'),date=url.searchParams.get('date'),feed=url.searchParams.get('source')||'bitmex';
      if(!['bitmex','bitstamp'].includes(feed)||(feed==='bitstamp'&&date)){res.writeHead(400).end('Invalid source');return;}
      if(!['BVOL24H','BVOL7D'].includes(symbol)||!['1D','1W','1M'].includes(frame)||(date&&!['2020-03-12','2025-05-01','2026-09-18'].includes(date))){res.writeHead(400).end('Invalid selection');return;}
      const market=await store.load();
      const source=feed==='bitstamp'?(await history.response()).indices[symbol]:market.indices[symbol];const rows=date?source.comparisons[date]:aggregate(source.candles,frame);
      res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${feed}-${symbol}-${date||frame}.csv"`,'Cache-Control':'no-store'}).end(toCSV(rows,Boolean(date)));return;
    }
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html')){res.writeHead(403).end();return;}
    const body=await readFile(url.pathname==='/data/market.json'?config.marketFile:file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}).end(body);
  }catch{res.writeHead(404).end('Not found');}
}).listen(config.port,config.host,()=>console.log(`HTTP server: http://${config.host}:${server.address().port}`));
