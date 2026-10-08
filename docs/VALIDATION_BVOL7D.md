# BVOL7D independent validation

Historical first-stage report. Expanded results for three periods and both indices
are now in VALIDATION_INDICES.md; the original experiment and outputs are retained.

Executed 2026-10-07. Scope: two fixed one-day intervals, each including both
midnight endpoints (289 publications). No claim of verification across all years.

## Result

| Role | UTC interval, inclusive | Points | Mean absolute error (percentage points) | Maximum error (percentage points) | Match rounded to 0.01 |
|---|---|---:|---:|---:|---:|
| Calibration | 2026-09-18 00:00 to 2026-09-19 00:00 | 289 | 0.002524686922 | 0.004984573608 | 100% |
| Holdout | 2025-05-01 00:00 to 2025-05-02 00:00 | 289 | 0.002457555033 | 0.004997171594 | 100% |

Total: 578/578 rounded matches. No missing minute prices, missing official
publications, duplicate timestamps, or invalid calculation windows in these
intervals. Exact full-precision equality is neither observed nor claimed:
official values are published in increments of 0.01. Errors are consistent with
rounding to that precision.

## Method

- Official observations: BitMEX `/api/v1/trade`, symbol `.BVOL7D`, field `price`.
- Input prices: same endpoint, symbol `.BXBT`, field `price`, one observation at
  each UTC minute. No candle substitution, forward fill, or fallback exchange.
- At publication timestamp T, select 10081 prices from T-10080 minutes to T.
- Calculate 10080 natural-log returns `ln(P[i]/P[i-1])`.
- Two-pass sample variance: `fsum((r-mean)^2)/(10080-1)`, using `math.fsum` for
  stable summation. Result: `100 * sqrt(variance) * sqrt(10080)`.
- Values represent seven-day volatility in percent, not annualized volatility.
- Compare only to the official publication at the identical timestamp T.
- Preserve full precision in CSV/JSON; rounded test uses Python `round(x, 2)`.
  Exact half-way tie behavior of BitMEX has not been determined.

Each period downloaded 11523 minute prices: seven days of warmup, the validation
day, and one extra minute on each side for alignment diagnostics. Pagination used
1000 rows per request and advanced by 1 millisecond after each final timestamp.
Complete expected timestamp grids were checked after download. Cached requests
include URL, retrieval timestamp, headers and response rows; keys are URL SHA256.

## Calibration diagnostics

Only the calibration interval was used for alternatives. The original candidate
was retained unchanged for the holdout, which contains no parameter search.

| Last price relative to T | ddof | Rounded match | Maximum error, pp |
|---|---:|---:|---:|
| T | 1 | 100% | 0.00498457 |
| T-1 minute | 1 | 95.5017% | 0.02119765 |
| T+1 minute (diagnostic only) | 1 | 95.8478% | 0.09847897 |
| T | 0 | 96.1938% | 0.00523929 |

This supports both the timestamp alignment and sample standard deviation for
these periods. Both periods are also mentioned by the reference site; we did not
use its computed values, downloaded datasets or implementation. A further period
outside its published validation dates would broaden the evidence.

## Reproduce

Python 3, standard library only; no package installation required:

```powershell
python scripts/validate_bvol7d.py
python scripts/validate_bvol7d.py --offline
python -m unittest discover -s scripts -p 'test_*.py'
```

On this machine the executable used is:
`C:\Users\aazizbekov\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`.
The normal `python` Windows alias was unavailable. Use the full path with `&` in
PowerShell if needed.

Outputs:

- `data/validation/bvol7d-report.json`: statistics, missing-data checks, diagnostics,
  and five largest discrepancies per comparison.
- `data/validation/bvol7d-calibration.csv` and `bvol7d-holdout.csv`: every comparison.
- `data/validation/raw/`: cached raw API responses for offline reproduction.

Three tests verify acceptance of a complete window and rejection of missing
interior/oldest prices. A numerical sanity check compares the variance baseline
against Python's `statistics.stdev` on a separate small fixture.
All three tests passed. A second full run with `--offline` produced a byte-identical
JSON report (SHA256 comparison), confirming reproduction from the saved responses.

## Remaining scope

At the time of this initial experiment, BVOL24H still required its own validation;
it has since passed the samples in VALIDATION_INDICES.md. Historical continuity, older source
changes and full-history matching are not established. Official methodology pages
still need fuller archival investigation, especially before 2017. Frontend work
has not started; next steps are broader BVOL7D sampling and BVOL24H validation.
