import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readServerConfig,prepareStorage} from './server-config.mjs';

test('default server settings preserve local bind and cache locations',()=>{
 const config=readServerConfig({});
 assert.equal(config.host,'127.0.0.1');assert.equal(config.port,4173);
 assert.equal(config.marketFile,config.seed);
 assert.equal(config.calculationFile,fileURLToPath(new URL('./bxbt-live.json',import.meta.url)));
 assert.equal(config.fallbackFile,fileURLToPath(new URL('./bitstamp-live.json',import.meta.url)));
});

test('container settings keep all runtime files outside the static directory',()=>{
 const dir=path.join(os.tmpdir(),'bvol-config-data');
 const config=readServerConfig({HOST:'0.0.0.0',PORT:'8080',DATA_DIR:dir});
 assert.equal(config.host,'0.0.0.0');assert.equal(config.port,8080);
 for(const file of [config.marketFile,config.calculationFile,config.fallbackFile])assert.equal(path.dirname(file),dir);
 assert.throws(()=>readServerConfig({DATA_DIR:config.root}),/outside/);
 assert.throws(()=>readServerConfig({DATA_DIR:path.join(config.root,'data')}),/outside/);
 for(const port of ['','invalid','-1','1.5','65536'])assert.throws(()=>readServerConfig({PORT:port}),/PORT/);
});

test('storage is seeded once and retains saved data when the seed changes',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bvol-storage-'));
 const seed=path.join(dir,'bootstrap.json'),config=readServerConfig({DATA_DIR:path.join(dir,'runtime')});
 config.seed=seed;
 try{
  await writeFile(seed,'initial');await prepareStorage(config);
  assert.equal(await readFile(config.marketFile,'utf8'),'initial');
  await writeFile(config.marketFile,'last good');await writeFile(seed,'new image');await prepareStorage(config);
  assert.equal(await readFile(config.marketFile,'utf8'),'last good');
 }finally{await rm(dir,{recursive:true,force:true});}
});

async function startServer(dataDir){
 // Block upstream traffic so readiness and persistence tests also work offline.
 const child=spawn(process.execPath,['--input-type=module','--eval',"globalThis.fetch=async()=>{throw new Error('Offline test');};await import('./server.mjs');"],
  {cwd:fileURLToPath(new URL('.',import.meta.url)),env:{...process.env,HOST:'127.0.0.1',PORT:'0',DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
 let output='';child.stderr.on('data',chunk=>{output+=chunk;});
 const ready=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Server startup timed out: '+output)),10000);
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code+': '+output));});
  child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/HTTP server: http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1]);}});
 });
 try{return {child,url:await ready};}
 catch(error){await stopServer(child);throw error;}
}

async function stopServer(child){
 if(child.exitCode!==null||child.signalCode!==null)return;
 const exited=once(child,'exit');child.kill();await exited;
}

test('HTTP readiness, private caches and persisted API/CSV survive an offline restart',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bvol-http-'));let running;
 try{
  running=await startServer(dir);
  assert.deepEqual(await (await fetch(running.url+'/healthz')).json(),{status:'ok'});
  const initial=await (await fetch(running.url+'/api/market')).json();
  assert.ok(initial.indices.BVOL24H.candles.length);assert.ok(initial.indices.BVOL7D.candles.length);
  const csv=await fetch(running.url+'/export.csv?symbol=BVOL24H&frame=1D');
  assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);
  await stopServer(running.child);running=null;
  const file=path.join(dir,'market.json'),saved=JSON.parse(await readFile(file,'utf8'));
  saved.downloadedAt='2026-10-10T00:00:00.000Z';await writeFile(file,JSON.stringify(saved));
  await writeFile(path.join(dir,'bxbt-live.json'),'private cache');
  running=await startServer(dir);
  assert.equal((await (await fetch(running.url+'/api/market')).json()).downloadedAt,saved.downloadedAt);
  assert.equal((await (await fetch(running.url+'/data/market.json')).json()).downloadedAt,saved.downloadedAt);
  assert.equal((await fetch(running.url+'/bxbt-live.json')).status,404);
  assert.equal((await fetch(running.url+'/healthz',{method:'POST'})).status,405);
  assert.equal(JSON.parse(await readFile(file,'utf8')).downloadedAt,saved.downloadedAt);
 }finally{if(running)await stopServer(running.child);await rm(dir,{recursive:true,force:true});}
});
