import {aggregate,plotData} from './chart-data.js';
const $=id=>document.getElementById(id);
const state={symbol:'BVOL24H',source:'bitstamp',view:'candles',frame:'1D',range:'12',compare:false,date:'2026-09-18'};
let data,chart,mainSeries,calcSeries,visible=[];
function applyTheme(){
 const light=document.documentElement.dataset.theme==='light';
 $('theme-toggle').textContent=light?'☾ Темна тема':'☀ Світла тема';
 $('theme-toggle').setAttribute('aria-label',light?'Увімкнути темну тему':'Увімкнути світлу тему');
 if(!chart)return;
 const p=light?{bg:'#ffffff',text:'#53647c',grid:'#e9edf3',border:'#d5deea',up:'#087f72',down:'#c44560',calc:'#7850bb'}:{bg:'#101824',text:'#94a6bf',grid:'#1a2636',border:'#263246',up:'#65dbc5',down:'#ee8192',calc:'#c0a5ff'};
 chart.applyOptions({layout:{background:{type:'solid',color:p.bg},textColor:p.text},grid:{vertLines:{color:p.grid},horzLines:{color:p.grid}},rightPriceScale:{borderColor:p.border},timeScale:{borderColor:p.border},crosshair:{vertLine:{color:p.text,labelBackgroundColor:light?'#425570':'#34445c'},horzLine:{color:p.text,labelBackgroundColor:light?'#425570':'#34445c'}}});
 mainSeries?.applyOptions(state.compare||state.view==='line'?{color:p.up}:{upColor:p.up,downColor:p.down,wickUpColor:p.up,wickDownColor:p.down});
 calcSeries?.applyOptions({color:p.calc});
}
$('theme-toggle').onclick=()=>{const theme=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=theme;try{localStorage.setItem('bvol-theme',theme);}catch{}applyTheme();};
applyTheme();
const fmt=(v,n=2)=>Number(v).toLocaleString('uk-UA',{minimumFractionDigits:n,maximumFractionDigits:n});
const dateTime=t=>new Date(t).toLocaleString('uk-UA',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})+' UTC';
const day=t=>new Date(t*1000).toISOString().slice(0,10);
function selectButtons(selector,key){document.querySelectorAll(selector).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===state[key])));}
function range(){if(!chart||!visible.length)return;if(state.compare||state.range==='all')chart.timeScale().fitContent();else{const to=visible.at(-1).time;const d=new Date(to*1000);d.setUTCMonth(d.getUTCMonth()-Number(state.range));chart.timeScale().setVisibleRange({from:Math.max(visible[0].time,d.getTime()/1000),to});}}
function ohlc(row){if(!row){$('ohlc').textContent='Немає значення';return;}if(state.compare){$('ohlc').textContent=`${dateTime(row.time*1000)} · BitMEX ${fmt(row.official)}% · Розрахунок ${fmt(row.calculated,6)}% · Δ ${fmt(Math.abs(row.official-row.calculated),6)} п.п.`;}else{$('ohlc').textContent=`${day(row.time)} · O ${fmt(row.open)}  H ${fmt(row.high)}  L ${fmt(row.low)}  C ${fmt(row.close)}${row.partial?' · формується':''}${row.incomplete?' · неповні дані':''}`;}}
function render(preserveRange=false){
 if(!data)return;
 const priorRange=preserveRange?chart.timeScale().getVisibleRange():null;
 if(mainSeries)chart.removeSeries(mainSeries);if(calcSeries){chart.removeSeries(calcSeries);calcSeries=null;}
 const source=state.source==='bitstamp'?data.bitstamp?.indices?.[state.symbol]:data.indices[state.symbol];
 $('series-label').textContent=state.source==='bitstamp'?'Розрахунок із Bitstamp BTC/USD · не офіційний BitMEX':'Офіційний BitMEX';
 $('chart-title').innerHTML=`${state.symbol} <span>· Bitcoin / USD · ${state.compare?'5 хв':state.frame}</span>`;
 $('comparison-bar').hidden=!state.compare;$('calc-legend').hidden=!state.compare;
 document.querySelectorAll('#frame-controls button,#view-controls button,#range-controls button').forEach(b=>b.disabled=state.compare);
 const options={priceFormat:{type:'custom',formatter:p=>fmt(p),minMove:.01},priceLineVisible:false};
 if(state.compare){
  visible=source.comparisons[state.date];
  mainSeries=chart.addSeries(LightweightCharts.LineSeries,{...options,color:'#65dbc5',lineWidth:2});mainSeries.setData(visible.map(r=>({time:r.time,value:r.official})));
  calcSeries=chart.addSeries(LightweightCharts.LineSeries,{...options,color:'#c0a5ff',lineStyle:2,lineWidth:2,lastValueVisible:false});calcSeries.setData(visible.map(r=>({time:r.time,value:r.calculated})));
 }else{
  visible=aggregate(source?.candles||[],state.frame);
  mainSeries=chart.addSeries(state.view==='candles'?LightweightCharts.CandlestickSeries:LightweightCharts.LineSeries,{...options,upColor:'#65dbc5',downColor:'#ee8192',wickUpColor:'#65dbc5',wickDownColor:'#ee8192',borderVisible:false,color:'#65dbc5',lineWidth:2});
  // Preserve absence of entire buckets as whitespace, rather than inventing prices.
  mainSeries.setData(plotData(visible,state.frame,state.view));
 }
 chart.applyOptions({timeScale:{timeVisible:state.compare,secondsVisible:false}});applyTheme();range();ohlc(visible.at(-1));
 if(priorRange)chart.timeScale().setVisibleRange(priorRange);
 $('error').hidden=visible.length>0;
 if(!visible.length)$('error').textContent=state.source==='bitstamp'?(data.bitstamp?.error?'Історія Bitstamp недоступна: '+data.bitstamp.error:'Завантажуємо хвилинні дані Bitstamp та розраховуємо історію. Сторінка оновиться автоматично.'):'Історія недоступна';
 $('context').textContent=state.compare?'Контрольний день: дві лінії майже збігаються. Точна різниця — у підказці над графіком.':`Вікно формули: ${state.symbol==='BVOL24H'?'24 години':'7 діб'}. Період свічок змінює лише відображення.`;
 if(!state.compare&&state.source==='bitstamp')$('context').textContent+=' Джерело: закриття хвилинних свічок Bitstamp. Історія з 14.10.2026, значення кожні 5 хв; відрізняється від BitMEX.';
 document.querySelectorAll('[data-symbol]').forEach(b=>{b.classList.toggle('active',b.dataset.symbol===state.symbol);b.setAttribute('aria-pressed',String(b.dataset.symbol===state.symbol));});
 selectButtons('[data-view]','view');selectButtons('[data-frame]','frame');selectButtons('[data-range]','range');
}
function exportCSV(){if(!data)return;const params=new URLSearchParams({symbol:state.symbol,frame:state.frame,source:state.source});if(state.compare)params.set('date',state.date);const a=document.createElement('a');a.href='/export.csv?'+params;a.download=`${state.source}-${state.symbol}-${state.compare?state.date:state.frame}.csv`;document.body.append(a);a.click();a.remove();}
document.querySelectorAll('[data-symbol]').forEach(b=>b.onclick=()=>{state.symbol=b.dataset.symbol;render();});
for(const key of ['view','frame','range'])document.querySelectorAll(`[data-${key}]`).forEach(b=>b.onclick=()=>{state[key]=b.dataset[key];render();});
$('data-source').onchange=e=>{state.source=e.target.value;state.compare=false;$('compare').checked=false;updateQuotes();render();};
$('compare').onchange=e=>{state.compare=e.target.checked;if(state.compare){state.source='bitmex';$('data-source').value='bitmex';}updateQuotes();render();};$('comparison-date').onchange=e=>{state.date=e.target.value;render();};$('reset').onclick=range;$('export').onclick=exportCSV;
$('method').onclick=()=>$('method-dialog').showModal();$('close-method').onclick=()=>$('method-dialog').close();$('method-dialog').onclick=e=>{if(e.target===$('method-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
async function init(){try{
 const response=await fetch('/api/market');if(!response.ok)throw new Error('Дані недоступні');data=await response.json();
 chart=LightweightCharts.createChart($('chart'),{autoSize:true,layout:{background:{type:'solid',color:'#101824'},textColor:'#94a6bf',fontFamily:'Segoe UI',fontSize:12,attributionLogo:true},grid:{vertLines:{color:'#1a2636'},horzLines:{color:'#1a2636'}},rightPriceScale:{borderColor:'#263246',scaleMargins:{top:.12,bottom:.08}},timeScale:{borderColor:'#263246',rightOffset:3},crosshair:{mode:0},localization:{locale:'uk-UA'}});
 chart.subscribeCrosshairMove(p=>{if(!p.time){ohlc(visible.at(-1));return;}const r=visible.find(r=>r.time===p.time);ohlc(r);});
 for(const [symbol,s] of Object.entries(data.indices)){$(`value-${symbol}`).innerHTML=`${fmt(s.latest.price)}<small>%</small>`;$(`time-${symbol}`).textContent=`Офіційний · ${dateTime(s.latest.timestamp)}`;}
 updateQuotes();
 $('metrics').innerHTML=['BVOL24H','BVOL7D'].map(symbol=>{const p=data.validation.periods.filter(p=>p.symbol==='.'+symbol);const n=p.reduce((a,p)=>a+p.metrics.compared_points,0);const mean=p.reduce((a,p)=>a+p.metrics.mean_absolute_error_pp*p.metrics.compared_points,0)/n;const max=Math.max(...p.map(p=>p.metrics.maximum_absolute_error_pp));const match=p.reduce((a,p)=>a+p.metrics.rounded_match_percent*p.metrics.compared_points,0)/n;return `<tr><td>${symbol}</td><td>${n}</td><td>${fmt(match,0)}%</td><td>${fmt(mean,6)}</td><td>${fmt(max,6)}</td></tr>`;}).join('');
 $('coverage').textContent=Object.entries(data.indices).map(([k,s])=>`${k}: ${day(s.candles[0].time)} — ${day(s.candles.at(-1).time)}, ${s.candles.length} денних свічок; пропущених днів між свічками: ${s.missingDays.length}, відхилених порожніх записів: ${s.rejectedBuckets.length}.`).join(' ');
 render();
 }catch(error){$('error').hidden=false;$('error').textContent='Не вдалося завантажити графік. Перевірте локальний знімок даних і перезавантажте сторінку.';$('source-status').textContent='Помилка завантаження';console.error(error);}}
init();
function updateQuotes(){
 for(const [symbol,s] of Object.entries(data.indices)){$(`value-${symbol}`).innerHTML=`${fmt(s.latest.price)}<small>%</small>`;$(`time-${symbol}`).textContent=`Офіційний · ${dateTime(s.latest.timestamp)}`;}
 if(state.source==='bitstamp')for(const symbol of Object.keys(data.indices)){
  const latest=data.bitstamp?.indices?.[symbol]?.latest||data.fallback?.results?.[symbol];
  const value=latest?.price??latest?.value;
  $(`value-${symbol}`).innerHTML=Number.isFinite(value)?`${fmt(value)}<small>%</small>`:'—';
  $(`time-${symbol}`).textContent=latest?.timestamp?`Bitstamp · ${dateTime(latest.timestamp)}${Date.now()-Date.parse(latest.timestamp)>15*60000?' · застаріле значення':''}`:'Готуємо історію Bitstamp…';
 }
 for(const [symbol,s] of Object.entries(data.indices)){
  const c=data.independent?.results?.[symbol],box=$('calculation-'+symbol);
  const fb=$('fallback-'+symbol),active=Boolean(data.fallback?.active?.[symbol]),f=data.fallback?.results?.[symbol];
  if(state.source==='bitstamp'){box.textContent='Розрахунок із закритих хвилинних свічок BTC/USD. Та сама формула; інше джерело, не офіційний BitMEX.';fb.hidden=true;continue;}
  fb.hidden=!active;
  if(active){fb.textContent=f&&!f.error&&Number.isFinite(f.value)?`Резерв · Bitstamp BTC/USD: ${fmt(f.value,4)}%\n${dateTime(f.timestamp)}${Date.now()-Date.parse(f.timestamp)>15*60000?' · застаріле значення':''}\nІнше джерело — не офіційний BitMEX${data.fallback?.error?' · оновлення недоступне':''}`:data.fallback?.error||f?.error?'Резерв Bitstamp недоступний. Показано останні дані BitMEX.':'Готуємо резервний розрахунок Bitstamp…';}
  if(!c){box.textContent=data.independent?.error?'Розрахунок .BXBT тимчасово недоступний':'Готуємо розрахунок із .BXBT…';continue;}
  if(c.error||!Number.isFinite(c.value)){box.textContent='Розрахунок .BXBT недоступний: неповне хвилинне вікно';continue;}
  const aligned=Date.parse(c.timestamp)===Date.parse(s.latest.timestamp);
  const stale=Date.now()-Date.parse(c.timestamp)>15*60000;
  box.textContent=`Наш розрахунок .BXBT: ${fmt(c.value,4)}%\n${dateTime(c.timestamp)}${stale?' · застаріле значення':''}\n${aligned?`Δ ${fmt(Math.abs(c.value-s.latest.price),6)} п.п. · ${Math.round(c.value*100)===Math.round(s.latest.price*100)?'збіг до 0,01':'відмінність до 0,01'}`:'Час відрізняється — значення не порівнюємо'}${data.independent?.error?' · оновлення недоступне':data.independent?.updating?' · оновлення…':''}`;
 }
 const stale=Object.values(data.indices).some(s=>Date.now()-Date.parse(s.latest.timestamp)>15*60000);
 $('source-status').textContent=data.refresh?.error?`BitMEX недоступний. Збережені дані: ${dateTime(data.downloadedAt)}. Повторна спроба автоматично.`:`Автооновлення кожні 5 хв · Дані: ${dateTime(data.downloadedAt)}${stale?' · Публікації застарілі':''}${data.refresh?.updating?' · Оновлення…':''}`;
 if(state.source==='bitstamp')$('source-status').textContent=`Bitstamp · перевірка кожні 5 хв · ${data.bitstamp?.computedAt?'Дані: '+dateTime(data.bitstamp.computedAt):'Підготовка історії…'}${data.bitstamp?.updating?' · Оновлення…':''}${data.bitstamp?.error?' · Помилка оновлення: '+data.bitstamp.error:''}`;
}
let refreshing=false;
async function refreshMarket(manual=false){
 if(refreshing)return;refreshing=true;$('refresh').disabled=true;
 try{const response=await fetch('/api/market',{method:manual?'POST':'GET'});if(!response.ok)throw new Error('Refresh failed');const next=await response.json();const changed=data?.downloadedAt!==next.downloadedAt||data?.bitstamp?.computedAt!==next.bitstamp?.computedAt||data?.bitstamp?.error!==next.bitstamp?.error;const hadVisible=visible.length>0;data=next;updateQuotes();if(chart&&changed)render(hadVisible);}
 catch{$('source-status').textContent='Немає зв’язку із сервером. Показано останні отримані дані.';}
 finally{refreshing=false;$('refresh').disabled=false;}
}
$('refresh').onclick=()=>refreshMarket(true);
setInterval(()=>{if(!document.hidden)void refreshMarket();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshMarket();});
if(document.modelContext?.registerTool){
 const lifetime=new AbortController();window.addEventListener('pagehide',()=>lifetime.abort(),{once:true});
 const tool={name:'select_volatility_index',title:'Вибрати індекс волатильності',description:'Switch the visible chart between the daily and weekly Bitcoin volatility indices. Does not alter data.',inputSchema:{type:'object',properties:{symbol:{type:'string',enum:['BVOL24H','BVOL7D']}},required:['symbol'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||!['BVOL24H','BVOL7D'].includes(input.symbol)||Object.keys(input).some(k=>k!=='symbol'))throw new Error('Expected symbol BVOL24H or BVOL7D');if(!data)throw new Error('Data not loaded');state.symbol=input.symbol;render();return {symbol:state.symbol,comparison:state.compare,source:state.source,snapshot:state.source==='bitstamp'?data.bitstamp?.computedAt:data.downloadedAt};}};
 try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifetime.signal})).catch(()=>{});}catch{}
}
