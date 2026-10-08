# BVOL24H and expanded BVOL7D validation

Executed 2026-10-07. This report extends the initial BVOL7D experiment, retaining
its original formula. The additional 2020-03-12 interval is outside the reference
website's listed validation dates. No formula parameters were adjusted to fit it.

## Results

Each interval runs from 00:00 UTC on the stated date to 00:00 the following day,
inclusive: 289 official five-minute publications.

| Index | Date | Role | Compared | Rounded match | Mean absolute error, pp | Maximum absolute error, pp |
|---|---|---|---:|---:|---:|---:|
| BVOL7D | 2026-09-18 | Calibration | 289 | 100% | 0.002524686922 | 0.004984573608 |
| BVOL7D | 2025-05-01 | Holdout | 289 | 100% | 0.002457555033 | 0.004997171594 |
| BVOL7D | 2020-03-12 | Additional holdout | 289 | 100% | 0.002364420811 | 0.004991408353 |
| BVOL24H | 2026-09-18 | Calibration | 289 | 100% | 0.002442997334 | 0.004993476919 |
| BVOL24H | 2025-05-01 | Holdout | 289 | 100% | 0.002369655199 | 0.004996511380 |
| BVOL24H | 2020-03-12 | Additional holdout | 289 | 100% | 0.002338966224 | 0.004986831898 |

867/867 rounded matches per index, 1734 comparisons total. All expected minute
prices and official publications were present; no invalid windows or duplicate
timestamps. Rounded-match precision is 0.01. Full-precision equality is not claimed.
The 2020 sample includes substantially larger observed volatility (for example,
official BVOL7D 20.36 at 21:00 UTC), broadening the range tested.

## Verified implementation on these samples

Both indices use the official BitMEX `.BXBT` minute trade feed (`price`), natural
log returns and sample standard deviation (`ddof=1`). Official comparison values
come from the `.BVOL24H` / `.BVOL7D` trade feed at the identical UTC timestamps.

| Index | Window | Inclusive price range at publication T | Prices | Formula |
|---|---|---|---:|---|
| BVOL24H | 1440 minutes | T-1440 minutes through T | 1441 | `100 * s(log returns) * sqrt(1440)` |
| BVOL7D | 10080 minutes | T-10080 minutes through T | 10081 | `100 * s(log returns) * sqrt(10080)` |

Values are own-period percentage volatility, not annualized. Computation uses a
two-pass variance with `math.fsum`; no gap filling, alternate exchange or rounded
intermediate inputs. Every expected minute in each window is required.

All three price downloads use weekly warmup plus a diagnostic minute on either
side (11523 prices each). Daily evaluation selects only its own 1441-price window;
extra downloaded prices do not alter its formula.

## BVOL24H calibration alternatives

On 2026-09-18 only:

| Last input price | ddof | Rounded match | Max error, pp |
|---|---:|---:|---:|
| T | 1 | 100% | 0.00499348 |
| T-1 minute | 1 | 91.3495% | 0.03678023 |
| T+1 minute (diagnostic only) | 1 | 89.6194% | 0.03502909 |
| T | 0 | 94.1176% | 0.00569933 |

No diagnostic search is performed on either holdout interval. Weekly calibration
alternatives are recorded in VALIDATION_BVOL7D.md.

## Reproduction and artifacts

Python standard library only:

```powershell
python scripts/validate_indices.py
python scripts/validate_indices.py --offline
python -m unittest discover -s scripts -p 'test_*.py'
```

Use the bundled Python executable documented in VALIDATION_BVOL7D.md if the local
`python` alias is unavailable.

- `scripts/validate_indices.py`: fixed three-period experiment for both indices.
- `scripts/validate_bvol7d.py`: reused fetch/cache and numerical baseline; original
  weekly experiment remains runnable with its unchanged default window.
- `data/validation/indices-report.json`: machine-readable metrics and diagnostics.
- `data/validation/bvol24h-YYYY-MM-DD.csv` and `bvol7d-YYYY-MM-DD.csv`: every pair.
- `data/validation/raw/`: original responses with request URLs and retrieval times.

Four integrity tests passed, including a daily-window test that verifies older
weekly data is unnecessary and that the daily oldest endpoint is required.
A complete offline rerun produced a byte-identical report (SHA256 checked).
Aggregate mean absolute error is 0.002448887589 pp for BVOL7D and 0.002383872919 pp
for BVOL24H; aggregate maxima are 0.004997171594 and 0.004996511380 pp respectively.

## Limits and next implementation boundary

This is validation across three sampled dates, not every point between 2020 and
2026 or all historical years. Exact BitMEX half-way rounding remains unverified.
Pre-2017 source history and methodology transitions remain open research items.
Numerical matching supports these formulas but does not replace historical
methodology documentation. The maximum API page size remains untested; pages of
1000 work in these downloads.

These results support building the initial chart with separately labeled official
history and independent calculations, reporting this exact validation scope.
Do not extrapolate a verified methodology epoch to untested years. Historical
coverage/holes must be audited when downloading chart data. Chart candle periods
remain independent of formula windows. No fallback, cache refresh service or UI
has been implemented by this validation step.
