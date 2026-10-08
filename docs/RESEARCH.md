# BitMEX data investigation

Research date: 2026-10-07 UTC. Stage: API availability verified; BVOL7D and BVOL24H
independently match at 0.01 precision on three one-day intervals (867 points per
index). This is sample validation, not an all-history claim. See VALIDATION_INDICES.md.

## Reproduction

Run from the project root in PowerShell:

```powershell
./scripts/probe-bitmex.ps1
```

This performs 12 unauthenticated public requests, with a pause between requests.
Raw JSON responses and a request manifest (URLs, UTC retrieval times, HTTP status)
are saved in `data/research`. Re-running overwrites this latest probe snapshot.
Network access is required. No account credentials are used.

## Observed results

All 12 requests returned HTTP 200 on 2026-10-07 around 11:08 UTC.

| Symbol | referenceSymbol in metadata | Latest trade-sample cadence | First returned trade with reverse=false |
|---|---|---|---|
| .BVOL7D | .BXBT | 5 minutes | 2014-11-13 20:55 UTC |
| .BVOL24H | .BXBT | 5 minutes | 2014-11-07 20:55 UTC |
| .BXBT | .BXBT | 1 minute | 2017-03-14 13:49 UTC |

These are endpoint observations, not verified inception dates, nor proof of
continuous coverage. Only 12 recent and 3 earliest trades per symbol were fetched.
Both volatility indices had a latest trade timestamp of 2026-10-07 11:05 UTC.
Their metadata says `state=Unlisted` despite these recent publications.
Do not use that status alone to conclude publication has stopped.

Metadata represents intervals as legacy date-shaped strings:

- BVOL7D: calcInterval `2000-01-08T00:00:00.000Z`, publishInterval `2000-01-01T00:05:00.000Z`.
- BVOL24H: calcInterval `2000-01-02T00:00:00.000Z`, same publishInterval.
- BXBT: publishInterval `2000-01-01T00:01:00.000Z`.

The strings are consistent with the expected windows/cadence; they do not alone
establish the exact rolling-window boundary or mathematical implementation.
The BXBT instrument timestamp can have seconds, while the sampled trade feed is
aligned to minute boundaries. Use the historical feed for validation inputs.

## Verified endpoints and timestamp pitfalls

- `/api/v1/instrument?symbol=...`: metadata.
- `/api/v1/trade?symbol=...&count=12&reverse=true`: index publications as zero-size
  referential trades. Use `price` and original UTC `timestamp` for validation.
- `/api/v1/trade?symbol=...&count=3&reverse=false`: earliest returned records.
- `/api/v1/trade/bucketed?symbol=...&binSize=1m&count=12&reverse=true&partial=false`:
  minute buckets. In the current BXBT sample, close equals trade price at the same
  timestamp. This is a small-sample check, not an all-history guarantee.

BVOL minute buckets include carried-forward prices with `trades=0` between real
five-minute observations. They must not count as new validation observations.
Use raw trades for the initial calculation and comparison. Do not fill gaps.

Official bucket documentation says timestamps mark the END of a bucket, and open
is the previous bucket's close. When implementing chart OHLC later, distinguish
official buckets from independently aggregated observation OHLC.

## Formula candidates and validation status

Minute log returns: `r[i] = ln(P[i] / P[i-1])`.
Sample standard deviation with `ddof=1`.

| Index | Returns | Prices | Candidate percent scaling |
|---|---:|---:|---|
| BVOL7D | 10080 | 10081 | `100 * s(r) * sqrt(10080)` |
| BVOL24H | 1440 | 1441 | `100 * s(r) * sqrt(1440)` |

Own-period volatility, not annualized. Both formulas including prices through T
(both window endpoints included) matched on three periods; see VALIDATION_INDICES.md.
Older methodology epochs and untested dates remain unverified.

The reference site's 100% rounded-match claim is not our validation result.
The 2015 BitMEX announcement describes five-minute Bitfinex samples and sqrt(288)
for BVOL24H. A prior indexed version of the index definition described minute
samples, sample standard deviation and sqrt(1440); direct web extraction currently
returns a JavaScript shell. Do not apply the modern candidate to all years blindly.

## Initial experiment plan (now completed for three periods of both indices)

1. Verify count limits and pagination with bounded historical requests, checking
   ordering, duplicates and inclusive/exclusive time filters explicitly.
2. Download one fixed BVOL7D validation interval and at least seven preceding days
   of BXBT minute trades. Preserve raw responses for offline reproduction.
3. Reject incomplete windows; compare only identical UTC publication timestamps.
4. Use a stable two-pass/sample variance baseline; examine endpoint alignment
   separately from ddof/scaling. Keep calibration and holdout intervals separate.
5. Report count, mean absolute error, maximum absolute error, rounded match rate
   at 0.01, largest discrepancies and missing timestamps.
6. Validate other historical periods, then repeat for BVOL24H.

Verified: pages of 1000 records work; advancing startTime to the last timestamp
plus 1 millisecond preserves a gap-free minute series in both tested periods.
Requests at exact start/end timestamps included those endpoints. Both series
reached the requested end timestamp; pagination does not assume that a short page
alone implies exhaustion.

Unknown: full historical continuity; maximum page-size limit; pre-2017 price
sources/archives; dates of methodology changes; rounding tie rule; exact window
alignment outside tested periods. No fallback is implemented. Future fallback must retain a separate
source label and must never silently replace official history.

## Official sources

- [Index trade feed](https://docs.bitmex.com/api-explorer/get-trade)
- [Bucket semantics and parameters](https://docs.bitmex.com/api-explorer/get-trade-bucketed)
- [Instrument metadata](https://docs.bitmex.com/api-explorer/get-instruments)
- [BVOL7D definition](https://www.bitmex.com/app/index/.BVOL7D)
- [BVOL24H definition](https://www.bitmex.com/app/index/.BVOL24H)
- [2015 BVOL24H announcement](https://www.bitmex.com/blog/site-announcement/bvol24h-pgp-and-indices)

UI/reference claims: https://weekly-crypto-volatility.tarnoplsky.chatgpt.site/
