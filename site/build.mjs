import {copyFile, mkdir} from 'node:fs/promises';
await mkdir(new URL('./dist/vendor/', import.meta.url), {recursive:true});
for (const [from,to] of [['dist/lightweight-charts.standalone.production.js','charts.js'],['LICENSE','LICENSE']]) {
  await copyFile(new URL(`./node_modules/lightweight-charts/${from}`,import.meta.url),new URL(`./dist/vendor/${to}`,import.meta.url));
}
console.log('Chart library and license copied to dist/vendor');
