"""Extend weekly holdout and validate daily volatility without formula tuning."""
import argparse
import csv
import json
from datetime import timedelta
from validate_bvol7d import OUT, N, parse, iso, fetch, evaluate

PERIODS = [('calibration', '2026-09-18'), ('holdout', '2025-05-01'),
           ('additional_holdout', '2020-03-12')]

def run(offline):
    reports = []
    for role, date in PERIODS:
        start = parse(date + 'T00:00:00Z')
        end = start + timedelta(days=1)
        # Identical request boundaries reuse previous weekly downloads.
        rows, _ = fetch('.BXBT', start - timedelta(minutes=N+1), end + timedelta(minutes=1), offline)
        prices = {parse(r['timestamp']): r['price'] for r in rows}
        expected_prices = {start - timedelta(minutes=N+1) + timedelta(minutes=i) for i in range(N+1440+3)}
        assert not (set(prices) - expected_prices), 'Unexpected minute alignment'
        for symbol, window in [('.BVOL7D', 10080), ('.BVOL24H', 1440)]:
            official, _ = fetch(symbol, start, end, offline)
            expected_official = {start + timedelta(minutes=5*i) for i in range(289)}
            actual_official = {parse(r['timestamp']) for r in official}
            assert not (actual_official - expected_official), 'Unexpected publication alignment'
            comparisons, metrics = evaluate(official, prices, window=window)
            report = {'symbol': symbol, 'window_minutes': window, 'ddof': 1, 'last_price_shift_minutes': 0,
                      'role': role, 'start': iso(start), 'end_inclusive': iso(end),
                      'price_records': len(prices), 'official_records': len(official),
                      'missing_price_timestamps': [iso(t) for t in sorted(expected_prices-set(prices))],
                      'missing_official_timestamps': [iso(t) for t in sorted(expected_official-actual_official)],
                      'metrics': metrics}
            if role == 'calibration' and symbol == '.BVOL24H':
                report['diagnostics'] = []
                for shift, ddof in [(-1, 1), (1, 1), (0, 0)]:
                    _, diagnostic = evaluate(official, prices, shift=shift, ddof=ddof, window=window)
                    report['diagnostics'].append({'shift_minutes': shift, 'ddof': ddof, **diagnostic})
            OUT.mkdir(parents=True, exist_ok=True)
            with (OUT / f'{symbol[1:].lower()}-{date}.csv').open('w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=['timestamp','official','calculated','absolute_error','rounded_equal'])
                writer.writeheader()
                writer.writerows(comparisons)
            reports.append(report)
            (OUT / 'indices-report.json').write_text(json.dumps({
                'method': '100 * sample_std(log returns) * sqrt(window_minutes)',
                'periods': reports}, indent=2))
            print(json.dumps({'symbol': symbol, 'date': date, **metrics}), flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--offline', action='store_true')
    run(parser.parse_args().offline)
