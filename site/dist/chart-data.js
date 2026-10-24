export function aggregate(rows,frame){
 if(frame==='1D')return rows;
 const groups=new Map();
 for(const r of rows){
  const d=new Date(r.time*1000);
  if(frame==='1W')d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));else d.setUTCDate(1);
  const t=d.getTime()/1000;let g=groups.get(t);
  if(!g){g={...r,time:t,count:1};groups.set(t,g);}
  else{g.high=Math.max(g.high,r.high);g.low=Math.min(g.low,r.low);g.close=r.close;g.partial ||= r.partial;g.incomplete ||= r.incomplete;g.bucketEnd=r.bucketEnd;g.count++;}
 }
 for(const g of groups.values()){
  const end=new Date(g.time*1000);if(frame==='1W')end.setUTCDate(end.getUTCDate()+7);else end.setUTCMonth(end.getUTCMonth()+1);
  const observedEnd=Math.min(end.getTime()/1000,rows.at(-1).time+86400);
  g.incomplete=Boolean(g.incomplete)||g.count<(observedEnd-g.time)/86400;
 }
 return [...groups.values()];
}
export function plotData(rows,frame,view){
 const plotted=[];
 for(let i=0;i<rows.length;i++){
  const r=rows[i],gap=i>0&&frame==='1D'&&r.time-rows[i-1].time>86400;
  if(gap)for(let t=rows[i-1].time+86400;t<r.time;t+=86400)plotted.push({time:t});
  plotted.push(view==='candles'?{time:r.time,open:r.open,high:r.high,low:r.low,close:r.close}:{time:r.time,value:r.close,...(gap?{color:'transparent'}:{})});
 }
 return plotted;
}
