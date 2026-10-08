"""Reproducible BVOL7D calibration + untouched holdout, Python stdlib only."""
import argparse
import csv
import hashlib
import json
import math
import statistics
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'data' / 'validation' / 'raw'
OUT = ROOT / 'data' / 'validation'
UTC = timezone.utc
N = 10080

def iso(t):
    return t.isoformat(timespec='milliseconds').replace('+00:00', 'Z')

def parse(t):
    return datetime.fromisoformat(t.replace('Z', '+00:00'))

def request(params, offline, endpoint='trade', fresh=False):
    url = 'https://www.bitmex.com/api/v1/' + endpoint + '?' + urllib.parse.urlencode(params)
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.json')
    if path.exists() and not fresh:
        saved = json.loads(path.read_text())
        assert saved['url'] == url
        return saved['rows']
    if offline:
        raise RuntimeError('Missing cached request: ' + url)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=40) as response:
                rows = json.load(response)
                headers = dict(response.headers)
            break
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 502, 503, 504) or attempt == 3:
                raise
            time.sleep(min(30, max(2 ** attempt, int(exc.headers.get('Retry-After', '2')))))
    assert isinstance(rows, list)
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({'url': url, 'fetchedAtUtc': iso(datetime.now(UTC)),
                                'headers': headers, 'rows': rows}, indent=2))
    time.sleep(1.1)
    return rows

def fetch(symbol, start, end, offline):
    cursor = start
    rows = []
    pages = 0
    while cursor <= end:
        page = request({'symbol': symbol, 'count': 1000, 'reverse': 'false',
                        'startTime': iso(cursor), 'endTime': iso(end)}, offline)
        pages += 1
        if not page:
            break
        times = [parse(r['timestamp']) for r in page]
        assert all(cursor <= t <= end for t in times), 'Out-of-range API response'
        assert all(a < b for a, b in zip(times, times[1:])), 'Duplicate/unordered records'
        assert all(r['symbol'] == symbol and r['price'] > 0 for r in page)
        rows.extend(page)
        cursor = times[-1] + timedelta(milliseconds=1)
        print(f'{symbol}: {len(rows)} records, through {iso(times[-1])}', flush=True)
    timestamps = [parse(r['timestamp']) for r in rows]
    assert len(set(timestamps)) == len(timestamps)
    return rows, pages

def value(prices, ddof=1):
    returns = [math.log(b / a) for a, b in zip(prices, prices[1:])]
    mean = math.fsum(returns) / len(returns)
    variance = math.fsum((r - mean) ** 2 for r in returns) / (len(returns) - ddof)
    return 100 * math.sqrt(variance) * math.sqrt(len(returns))

def evaluate(official, prices, shift=0, ddof=1, window=N):
    compared, missing = [], []
    for row in official:
        t = parse(row['timestamp'])
        last = t + timedelta(minutes=shift)
        keys = [last - timedelta(minutes=i) for i in range(window, -1, -1)]
        if any(k not in prices for k in keys):
            missing.append(iso(t))
            continue
        calculated = value([prices[k] for k in keys], ddof)
        published = row['price']
        compared.append({'timestamp': iso(t), 'official': published,
                         'calculated': calculated, 'absolute_error': abs(calculated - published),
                         'rounded_equal': round(calculated, 2) == round(published, 2)})
    errors = [r['absolute_error'] for r in compared]
    return compared, {'compared_points': len(compared), 'invalid_windows': len(missing),
                     'invalid_timestamps': missing,
                     'mean_absolute_error_pp': statistics.mean(errors) if errors else None,
                     'maximum_absolute_error_pp': max(errors) if errors else None,
                     'rounded_match_percent': 100 * sum(r['rounded_equal'] for r in compared) / len(compared) if compared else None,
                     'largest_discrepancies': sorted(compared, key=lambda r: r['absolute_error'], reverse=True)[:5]}

def run(offline):
    # Numerical sanity check independent of market data, against stdlib stdev.
    test_prices = [100, 102, 99, 104]
    logs = [math.log(b/a) for a, b in zip(test_prices, test_prices[1:])]
    assert math.isclose(value(test_prices), 100 * statistics.stdev(logs) * math.sqrt(3), rel_tol=1e-14)
    assert value([100] * 8) == 0
    reports = []
    for label, date in [('calibration', '2026-09-18'), ('holdout', '2025-05-01')]:
        start = parse(date + 'T00:00:00Z')
        end = start + timedelta(days=1)  # inclusive: 289 five-minute publications
        raw_prices, price_pages = fetch('.BXBT', start - timedelta(minutes=N+1), end + timedelta(minutes=1), offline)
        official, index_pages = fetch('.BVOL7D', start, end, offline)
        prices = {parse(r['timestamp']): r['price'] for r in raw_prices}
        expected_prices = {start - timedelta(minutes=N+1) + timedelta(minutes=i) for i in range(N+1440+3)}
        expected_index = {start + timedelta(minutes=5*i) for i in range(289)}
        actual_index = {parse(r['timestamp']) for r in official}
        assert not (set(prices) - expected_prices), 'Unexpected price timestamp alignment'
        assert not (actual_index - expected_index), 'Unexpected publication alignment'
        comparisons, metrics = evaluate(official, prices)
        report = {'role': label, 'start': iso(start), 'end_inclusive': iso(end),
                  'price_records': len(prices), 'official_records': len(official),
                  'price_pages': price_pages, 'index_pages': index_pages,
                  'missing_price_timestamps': [iso(t) for t in sorted(expected_prices - set(prices))],
                  'missing_official_timestamps': [iso(t) for t in sorted(expected_index - actual_index)],
                  'metrics': metrics}
        if label == 'calibration':
            report['diagnostics'] = []
            for shift, ddof in [(-1, 1), (1, 1), (0, 0)]:
                _, diagnostic = evaluate(official, prices, shift, ddof)
                report['diagnostics'].append({'shift_minutes': shift, 'ddof': ddof, **diagnostic})
        OUT.mkdir(parents=True, exist_ok=True)
        with (OUT / f'bvol7d-{label}.csv').open('w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['timestamp', 'official', 'calculated', 'absolute_error', 'rounded_equal'])
            writer.writeheader()
            writer.writerows(comparisons)
        reports.append(report)
        (OUT / 'bvol7d-report.json').write_text(json.dumps({'formula': '100 * sample_std(log(Pi/Pi-1)) * sqrt(10080)',
            'last_price': 'at publication timestamp T', 'rounding': 'Python round(x, 2), nearest ties-to-even; BitMEX tie rule unverified',
            'periods': reports}, indent=2))
        print(json.dumps({'period': label, **metrics}), flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--offline', action='store_true')
    run(parser.parse_args().offline)
