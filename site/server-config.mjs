import {constants} from 'node:fs';
import {copyFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const site=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(site,'dist');
const seed=path.join(root,'data/market.json');

export function readServerConfig(env=process.env){
 const rawPort=env.PORT??'4173';
 if(!/^\d+$/.test(String(rawPort))||Number(rawPort)>65535)throw new Error('PORT must be an integer from 0 to 65535');
 const dataDir=env.DATA_DIR?path.resolve(env.DATA_DIR):null;
 if(dataDir&&(dataDir===root||dataDir.startsWith(root+path.sep)))throw new Error('DATA_DIR must be outside the public static directory');
 return {root,host:env.HOST||'127.0.0.1',port:Number(rawPort),dataDir,seed,
  marketFile:dataDir?path.join(dataDir,'market.json'):seed,
  calculationFile:path.join(dataDir||site,'bxbt-live.json'),
  fallbackFile:path.join(dataDir||site,'bitstamp-live.json')};
}

export async function prepareStorage(config){
 if(!config.dataDir)return;
 await mkdir(config.dataDir,{recursive:true});
 // A rebuilt image must never replace the last good persisted market snapshot.
 try{await copyFile(config.seed,config.marketFile,constants.COPYFILE_EXCL);}
 catch(error){if(error.code!=='EEXIST')throw error;}
}
