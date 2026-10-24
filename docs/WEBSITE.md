# Initial local chart implementation

2026-10-07: vanilla JavaScript UI with locally packaged Lightweight Charts 5.2.0,
simple loopback Node server, and Python snapshot preparation. No React or database
is needed for this first read-only version.

## Data contracts

`prepare_site_data.py` downloads `/trade/bucketed` daily OHLC with partial=true.
Raw responses retain request URLs and times in `data/validation/raw`. The UI bundle
contains only public market values and validation results.

Both downloaded daily histories start at chart date 2016-02-15. Earlier raw trade
publications found during research do not imply the daily bucket endpoint has
the same coverage. The initial snapshot ends at 2026-10-07 (unfinished daily bar):
3888 daily candles for BVOL24H, 3883 for BVOL7D. Five missing BVOL7D calendar days
are retained as missing, not filled. This audit finds missing whole daily buckets;
it does not establish that every intraday publication is present inside each bar.

API bucket timestamps are end times; chart timestamps subtract one day. Weekly
aggregation starts Monday at 00:00 UTC; monthly starts on the first calendar day.
Open is the first daily open; high/low are extrema of the source highs/lows;
close is the last daily close. All official fields are preserved, including the
BitMEX convention that open is the previous bucket close. The formula window
does not change with chart aggregation. Aggregates with missing constituent days
are labeled incomplete; the current bucket is labeled as forming. Empty dates are
whitespace, with line segments interrupted on daily gaps.

The CSV button exports the full selected series and timeframe, rather than only
the zoomed viewport. Comparison exports include official/calculated values at
identical UTC timestamps with full precision. No official/independent/fallback
sources are mixed in OHLC.

## Verification

- Python: four window-integrity tests passed in the validation phase.
- JavaScript: three aggregation tests passed (UTC week/year boundary, month
  boundary, missing-day handling and partial status).
- Browser: index selection, candle/line views, weekly/monthly timeframe, comparison
  checkbox and historical date selection, and methodology dialog checked.
- Responsive layout: narrow viewport checked, no document-width overflow observed.
- WebMCP index selection checked with valid input and intentional invalid input;
  invalid input did not change the selected index.
- No browser console errors observed during the initial interactive check.
- CSV endpoint verified: 3888 daily BVOL24H rows and 289 comparison rows for
  BVOL7D on 2020-03-12; full-precision values and attachment filename confirmed.
  The embedded browser's blob download event timed out, so export now uses a
  normal HTTP attachment route. OS save-dialog completion was not automated.

## Limitations

This stage is local, with official background refresh and a labeled Bitstamp
fallback, but no deployed URL. Quote timestamps always remain visible. Comparison is
limited to the three validated one-day samples. Old-history methodology is not
claimed to be independently reproduced. Snapshot preparation is a manual full
download bootstrap; the server subsequently performs incremental official updates.

## Official automatic refresh

`site/market-store.mjs` refreshes both official quotes and daily buckets on server
startup and every 300 seconds, even when the page is closed (while the local server
is running). It re-fetches the previous/current buckets, paginates forward after
downtime, and merges by exact bucket timestamp. It does not compute BVOL from daily
BTC candles. Current independent calculation is a separate process described below.

The complete two-index update is committed only after both fetches succeed and the
new file is atomically renamed into place. Failure preserves the last good file.
Concurrent requests share one refresh; manual requests are throttled to one attempt
per minute. `/api/market` GET returns data/status; POST requests a bounded refresh.
CSV exports use the same current store. A later full bootstrap should be performed
with the local server stopped, to avoid competing writers.

Visible pages poll once per minute and on returning to the tab. The manual refresh
button requests a server refresh. Refreshes preserve the visible time range.
Errors and publications older than 15 minutes are explicitly labeled. No other
exchange is substituted in the official chart. Chart price-axis numbers omit the percent suffix; units
are still identified in the chart heading and quote cards.

Two additional tests passed: replacement of unfinished candles, and deduplication,
throttling, persistence plus preserving last-good data through a simulated outage.
The filesystem test requires normal Windows rename permissions (sandbox denied
replacement in its temporary folder); it passed outside that sandbox restriction.
An actual successful upstream update was verified on 2026-10-07 with official
publications at 13:50 UTC and the browser displaying the updated values.

## Current independent calculation

`site/live-calculation.mjs` reads the latest `.BXBT` trade timestamp, rounds it down
to a five-minute UTC boundary T, then obtains every minute from T-10080 minutes
through T. The initial download takes up to 11 pages of 1000 records, followed by
incremental missing-minute downloads on subsequent refreshes. Requests pause 1.1
seconds between pages. The rolling cache is stored atomically in
`site/bxbt-live.json`, outside the served directory, and survives server restarts.

BVOL24H selects the last 1441 prices, BVOL7D all 10081. Each uses natural logs and
two-pass sample variance with compensated summation, multiplied by 100 and the
square root of its return count. No source substitution or gap filling occurs.
A missing minute invalidates only the affected window. Complete-window results
include the exact source, timestamp, window and ddof. Failed network updates keep
the previous successful result with an error status; timestamps older than 15
minutes are labeled stale. Refreshes are deduplicated and throttled to one attempt
per minute. Scheduled operation remains every five minutes while the server runs.

The calculation follows the underlying price publication even if official index
publication stops. The browser shows an error/difference only against an official
value with the identical UTC timestamp; different timestamps are explicitly not
compared. Current calculations are displayed on cards and do not replace chart
history or the saved historical comparison series.

Validation: the production JavaScript function reproduced all 1734 saved Python
comparison values with maximum observed floating-point difference 0. Rounded
matches remained 100% on those samples. Tests also passed for missing minutes,
distinct window lengths, incremental cache updates, deduplication, throttling and
retaining persisted values through a simulated network outage. Exact half-way
rounding behavior remains unverified (the UI uses JavaScript Math.round).

Observed live comparison on 2026-10-07 14:05 UTC:

| Index | Independent | Official | Absolute error, pp |
|---|---:|---:|---:|
| BVOL24H | 1.7350801128323512 | 1.74 | 0.0049198871676488 |
| BVOL7D | 4.252843971029022 | 4.25 | 0.002843971029022 |

Remaining: internet hosting/background runtime, and further
historical source/methodology auditing. Full independent historical chart coverage
is not provided by this current-value feature.

## Bitstamp reserve (2026-10-08)

`site/bitstamp-feed.mjs` uses the public BTC/USD OHLC endpoint documented at
https://www.bitstamp.net/api/ with step=60 and exclude_current_candle=true.
A candle starting at S contributes its close at S+60 seconds. This differs from
BitMEX minute snapshots and is never presented as an exact BitMEX replication.
Pagination uses start plus limit (at most 1000); end is omitted because Bitstamp
gives it precedence over start. Both windows use the same validated calculation
engine and reject missing minutes. The cache is `site/bitstamp-live.json` outside
the public directory.

The reserve refreshes only when primary calculation fails, a window is incomplete,
or its timestamp is more than 15 minutes old. Visibility is decided separately
for each index. Recovery hides the reserve automatically. Reserve values appear
on separate labeled cards, never inside official historical candles or comparison
exports. A reserve failure retains its previous value with visible age/error status.
The local server must remain running for scheduled updates.

Live verification downloaded a complete 10081-minute-price window ending at
2026-10-08 07:50 UTC: BVOL24H 1.6645065764928197 and BVOL7D
4.178484065403451 (Bitstamp-derived, not official indices). All 11 JavaScript tests
passed, including candle timestamp mapping, rejection of unfinished candles,
per-window fallback activation, recovery, cache outage retention and all 1734
historical reference comparisons. A real exchange outage was not induced;
activation/recovery were verified with deterministic test inputs.

## 2026-10-24 — Bitstamp chart deployment

Current source directory: `/root/volatility-index-bitstamp.niOvYb`.
Same Compose project, container name, public URL and persistent volume as before.
Rollback image: `volatility-index:before-bitstamp`. Pre-update cache copies are in
`/root/volatility-index-bitstamp.niOvYb/backup/`. Previous source directory remains.

The default chart now selects **Bitstamp calculation**. A source selector opens the
separate official BitMEX archive. No series are spliced. BitMEX requests currently
return CloudFront 403 from both laptop and VPS; official cache ends 2026-10-14
01:05 UTC. Bitstamp history begins 2026-10-14 00:00 UTC and is explicitly not an
official BitMEX index. This change does not establish a cause for the upstream 403.

`site/bitstamp-history.mjs` persists `bitstamp-history.json` in DATA_DIR (otherwise
site/). It downloads closed minute BTC/USD candle closes, timestamps each at its
start +60s, and calculates both windows at five-minute UTC boundaries with the
existing stable sample-standard-deviation formula. Initial warm-up begins seven
days before the history start. Every required minute must exist; a missing minute
or failed fetch aborts the update and retains the complete last-good file. No
interpolation. Repeated refreshes catch up from the last calculated boundary.
Last 10081 minute prices are retained; full five-minute results remain persisted.
Daily OHLC uses first/max/min/last calculated observations, unlike BitMEX's
previous-close open convention. Weekly/monthly aggregation preserves incomplete
flags. Current UTC day is partial. A stale current day is also marked incomplete.

API: `/api/market` adds `bitstamp` with status, source and per-index candles/latest.
CSV: `/export.csv?source=bitstamp&symbol=BVOL24H&frame=1D` (also BVOL7D, 1W, 1M).
Source is included in CSV filenames. Historical validation comparisons remain
BitMEX-only. Background checks: 300s; visible browser polling: 60s. Bitstamp chart
refresh runs independently of BitMEX availability and has its own deduplication.

Verified on 2026-10-24: all 17 Node tests pass locally and in VPS Docker build;
11 daily candles per index from Oct 14–24; no incomplete historical days; latest
11:35 UTC values equal the separate live Bitstamp calculation exactly at identical
timestamps; all six source-specific CSV exports return 200. History survived two
container recreations and startup caught up from 11:30 to 11:35 UTC. Browser checked
BVOL24H candles, BVOL7D line, and switching to/from the official archive. Container
healthy. Existing n8n/PostgreSQL/Caddy IDs and OpenClaw PID/start time unchanged.
Scheduled refresh verified without POST requests: computedAt advanced from 11:36:55 to 11:41:55 UTC; both latest publications advanced from 11:35 to 11:40 UTC with no errors.

Limitations: new chart covers only Oct 14 onwards; full earlier Bitstamp backfill
is not implemented. Historical candle ranges longer than available coverage show
only that coverage. This series has not been validated as equal to BitMEX; it uses
a different source. A missing upstream minute currently stalls catch-up rather than
silently skipping it. Minute caches and full five-minute history are private runtime
files; include `bitstamp-history.json` in future backups.
