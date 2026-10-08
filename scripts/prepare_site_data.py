"""Download official daily OHLC and package verified comparisons for local UI."""
import csv
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from validate_bvol7d import ROOT, OUT, request, parse, iso

DEST = ROOT / 'site' / 'dist' / 'data'
DEST.mkdir(parents=True, exist_ok=True)
now = datetime.now(timezone.utc)
report = json.loads((OUT / 'indices-report.json').read_text())
bundle = {'downloadedAt': iso(now), 'indices': {}, 'validation': report}
for symbol in ['BVOL24H', 'BVOL7D']:
    cursor = parse('2014-01-01T00:00:00Z')
    bars = []
    while cursor <= now + timedelta(days=1):
        rows = request({'symbol': '.'+symbol, 'binSize': '1d', 'count': 1000,
                        'reverse': 'false', 'partial': 'true', 'startTime': iso(cursor),
                        'endTime': iso(now + timedelta(days=1))}, False, 'trade/bucketed')
        if not rows:
            break
        times = [parse(r['timestamp']) for r in rows]
        assert all(a < b for a, b in zip(times, times[1:]))
        assert all(cursor <= t <= now + timedelta(days=1) for t in times)
        bars.extend(rows)
        cursor = times[-1] + timedelta(milliseconds=1)
        print(symbol, len(bars), iso(times[-1]), flush=True)
        if times[-1] > now:
            break
    latest = request({'symbol': '.'+symbol, 'count': 1, 'reverse': 'true'}, False, fresh=True)[0]
    # BitMEX labels a daily bucket by its END; charts use the START date.
    candles, rejected = [], []
    for row in bars:
        t = parse(row['timestamp'])
        if not row.get('trades') or any(row.get(k) is None for k in ['open','high','low','close']):
            rejected.append(row['timestamp'])
            continue
        values = {k: row[k] for k in ['open','high','low','close']}
        # Official open equals previous bucket close, which can lie outside H/L.
        # Preserve every official field, including the exchange's open semantics.
        candles.append({'time': int((t-timedelta(days=1)).timestamp()), **values,
                        'bucketEnd': row['timestamp'], 'partial': t > now})
    assert len({r['time'] for r in candles}) == len(candles)
    missing = []
    for a,b in zip(candles, candles[1:]):
        missing.extend(range(a['time']+86400, b['time'], 86400))
    comparisons = {}
    for date in ['2020-03-12','2025-05-01','2026-09-18']:
        with (OUT / f'{symbol.lower()}-{date}.csv').open() as f:
            comparisons[date] = [{'time':int(parse(r['timestamp']).timestamp()),
                                  'official':float(r['official']), 'calculated':float(r['calculated'])}
                                 for r in csv.DictReader(f)]
    bundle['indices'][symbol] = {'candles': candles, 'latest': latest,
        'rejectedBuckets': rejected, 'missingDays': missing, 'comparisons': comparisons}
    print(symbol, 'accepted',len(candles),'missing days',len(missing),'rejected',len(rejected),flush=True)
temp = DEST / 'market.tmp'
temp.write_text(json.dumps(bundle, separators=(',',':')), encoding='utf-8')
temp.replace(DEST / 'market.json')
print('Saved', DEST / 'market.json', flush=True)
