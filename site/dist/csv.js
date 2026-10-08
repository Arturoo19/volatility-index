export function toCSV(rows,comparison){
 const columns=comparison?['timestamp_utc','official','calculated']:['period_start_utc','open','high','low','close','partial','incomplete'];
 const values=rows.map(r=>comparison?[new Date(r.time*1000).toISOString(),r.official,r.calculated]:[new Date(r.time*1000).toISOString(),r.open,r.high,r.low,r.close,Boolean(r.partial),Boolean(r.incomplete)]);
 return [columns,...values].map(r=>r.join(',')).join('\r\n')+'\r\n';
}
