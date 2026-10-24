# Current status — 2026-10-24
2026-10-24 update: Bitstamp chart deployed at the same public URL. Current source
is `/root/volatility-index-bitstamp.niOvYb`; previous image retained as
`volatility-index:before-bitstamp`. Default source is separately labeled Bitstamp,
with five-minute calculated history since Oct 14 and daily/weekly/monthly charts
and CSV. Official BitMEX archive remains separate (upstream currently 403).
New private persistent cache: `bitstamp-history.json`. 17 tests pass locally and
in Docker. Live data and browser source switching verified; neighboring services
unchanged. See latest sections of WEBSITE.md and DEPLOYMENT.md for exact behavior,
backup paths and limitations. Use this source directory for future Compose work.
# PROJECT_CONTEXT.md

## Current deployment status - 2026-10-10

The website is deployed at http://23.88.99.59:4173/ on the existing Hetzner VPS.
SSH access from the home laptop works. Source directory:
`/root/volatility-index.us4VwD`; Compose project `volatility-index`, container
`volatility-index-web-1`, volume `volatility-index_market-data`.
Docker build and all 15 Node tests passed on the VPS. Both current BitMEX indices,
independent calculations, public assets, CSV, five-minute background refresh and
cache persistence through stop/start were verified. Existing n8n/PostgreSQL/Caddy
containers and the OpenClaw user service retained their IDs/PID and startup times.
This is HTTP by IP, with no HTTPS route configured. Refresh remains 300s/60s.
Backups exist on the VPS and in ignored `site/runtime-data/deployment-backup/`.
Browser UI automation was unavailable; no new visual interaction verification is
claimed. The home checkout has a GitHub origin, but deployment edits are not
committed or pushed. See `docs/DEPLOYMENT.md` for operations and recovery.
The dated status and original brief below describe earlier stages.

## CURRENT STATUS — 2026-10-08 (read first)

This project is implemented and locally tested. The original brief below records
the starting requirements; its "first task", candidate formula, stack suggestions
and research instructions are historical, not the current work queue.
Read `docs/HANDOFF.md` for the current architecture, validation evidence, commands,
remaining work and deployment decisions. Read `docs/WEBSITE.md` for data contracts.

- Implemented: BVOL24H and BVOL7D; official OHLC history; independent current BXBT
  calculations; labeled Bitstamp reserve; caching; automatic refresh; light/dark
  theme; CSV; historical comparison on three validation dates.
- Verified: 867 official publications per index, 1734 total, 100% rounded matches
  to 0.01 on the selected samples. All 11 JavaScript tests passed on 2026-10-08.
- Actual stack: vanilla JavaScript + Lightweight Charts 5.2.0 + Node.js server;
  Python stdlib research scripts. No React, Next.js, database or API keys required.
- Current intervals: server 300 seconds, browser 60 seconds, calculation aligned
  to official five-minute timestamps. Faster checks were discussed, not implemented.
- User owns a Hetzner VPS previously used for n8n and OpenClaw. Preferred direction
  is hosting this app there. Vercel/GitHub Pages/Sites were discussed alternatives,
  not selected deployments. GitHub is now for source transfer and backup.
- Current request: prepare handoff files and GitHub upload instructions; the user
  will clone on their home laptop and continue VPS setup with another Codex.
- No repository remote, public deployment, domain, SSH access or Docker setup has
  been configured by this project. The site currently listens on 127.0.0.1:4173.
- Never claim whole-history replication: pre-2017 methodology and missing data
  still need further auditing. Current calculations are cards, not full historical
  independent chart series. Official OHLC preserves BitMEX's previous-close open
  convention; the generic OHLC sketch in the original brief does not override it.

## Original project brief (historical context)

## 1. Project summary

The goal is to build a Bitcoin historical volatility website with two BitMEX-style volatility indices:

- **BVOL24H**
- **BVOL7D**

The project started because the user previously relied on the official BitMEX `BVOL24H` chart in TradingView, but that symbol/index disappeared from their TradingView setup.

A first attempt was made to reproduce BVOL24H in TradingView using Pine Script and Bitfinex BTC/USD data. The result looked visually similar, but the user correctly noticed that it was not identical to the old official index.

The project direction then changed:

> Instead of approximating the old TradingView indicator, reproduce the official BitMEX methodology and historical values as accurately as possible.

The user was given a reference website for BVOL7D:

https://weekly-crypto-volatility.tarnoplsky.chatgpt.site/

That site is now the main product/UI reference.

---

## 2. Main product idea

Create one website containing both indices.

Suggested structure:

```text
Bitcoin Historical Volatility

[BVOL24H] [BVOL7D]

current value
change
timestamp

interactive chart

[Candles] [Line]
[1D] [1W] [1M]
[3M] [6M] [1Y] [3Y] [5Y] [All]

[Compare calculation]
[Formula and verification]
```

The user should be able to switch between:

```text
24-hour volatility
7-day volatility
```

without leaving the page.

---

## 3. Why the old TradingView replica is not enough

A Pine Script replica was created previously with:

```text
BITFINEX:BTCUSD
```

and two possible calculation modes:

- 1-minute / 1440 observations
- legacy 5-minute / 288 observations

The chart looked reasonably similar to the old BitMEX TradingView chart.

However, it is only an approximation because:

- it uses Bitfinex as the price source
- the exact historical BitMEX methodology/source can differ
- TradingView aggregation can differ
- historical index publication may not be reconstructable from a different exchange exactly

Therefore:

```text
Do not use the Pine Script replica as the source of truth.
```

It can remain useful later as a sanity check or optional TradingView version.

---

## 4. Reference BVOL7D implementation

The supplied reference website explains its method as follows.

### Formula

Minute observations of `.BXBT`:

```text
r_i = ln(P_i / P_{i-1})
```

Then:

```text
BVOL7D = 100 × s(r) × sqrt(10080)
```

Where:

```text
10081 prices
-> 10080 log returns
```

and:

```text
s(r) = sample standard deviation
ddof = 1
```

This is a seven-day rolling window:

```text
7 × 24 × 60 = 10080 minutes
```

The result is presented as a percentage over the seven-day period and is not annualized.

The reference page says values are calculated/published every 5 minutes.

---

## 5. Reference site's validation claims

The reference page states that its independent calculation was compared against official BitMEX BVOL7D history.

It reports:

```text
100.0% match after rounding to 0.01
2595 validation points
865 additional calibration points
```

Validation periods shown on the site:

```text
2023-11-01
2024-08-04
2025-05-01
2026-09-18
```

The site displays the following reported error statistics:

```text
mean error: 0.002602 percentage points
maximum error: 0.004999 percentage points
```

Important:

These are claims shown by the reference site.

Our project should independently reproduce and verify the methodology instead of merely trusting those numbers.

---

## 6. Official vs independently calculated data

The desired website should preserve the distinction between two concepts.

### Official history

Historical OHLC values published by BitMEX for the official volatility index.

For example:

```text
.BVOL7D
.BVOL24H
```

### Independent calculation

A rolling calculation made from the underlying BTC reference price series.

Likely source to investigate:

```text
.BXBT
```

The website should allow the user to compare the independent calculation against official data.

Suggested control:

```text
Compare calculation
```

The independent calculation must not silently replace the official historical series.

---

## 7. Expected BVOL24H methodology

The current candidate formula is:

```text
r_i = ln(P_i / P_{i-1})

BVOL24H = 100 × s(r) × sqrt(1440)
```

Expected input window:

```text
1441 one-minute prices
-> 1440 one-minute log returns
```

Expected standard deviation:

```text
sample standard deviation
ddof = 1
```

Why 1440:

```text
24 × 60 = 1440 minutes
```

Like BVOL7D, this value is expected to represent volatility over its own rolling period rather than an annualized value.

### Critical task

This must be verified against:

- official BitMEX documentation
- official historical `.BVOL24H` values
- official or reconstructable underlying BitMEX price data

Do not lock the implementation until the historical comparison passes.

---

## 8. Historical BVOL24H behavior

The user previously used the official BitMEX BVOL24H chart in TradingView.

The old chart displayed:

- OHLC candles
- a volatility value on the right scale
- a moving-average line
- daily chart candles

The exact old TradingView indicator is no longer available to the user.

The new website does not need to replicate every TradingView visual detail.

The objective is a better standalone volatility tool.

---

## 9. Difference between formula window and chart candle timeframe

This distinction is extremely important.

### BVOL24H

The formula always uses a rolling 24-hour window.

Even if the user views:

```text
1D candles
1W candles
1M candles
```

the underlying index remains BVOL24H.

### BVOL7D

The formula always uses a rolling seven-day window.

Changing chart aggregation does not change the formula to another rolling period.

Example:

```text
BVOL7D viewed as weekly candles
```

means:

```text
weekly OHLC candles of a continuously calculated 7-day rolling volatility index
```

not:

```text
a new weekly volatility formula
```

---

## 10. OHLC aggregation

If index observations are available every 5 minutes, chart candles can be aggregated from those observations.

For a selected candle bucket:

```text
open = first index observation
high = maximum index observation
low = minimum index observation
close = last index observation
```

This should be done separately for:

```text
official index series
independent calculation series
fallback series
```

Do not mix sources when creating OHLC.

---

## 11. Data-source investigation

The coding agent should first investigate the BitMEX API and documentation.

Questions that must be answered:

```text
1. Can historical .BVOL7D observations be fetched?
2. Can historical .BVOL24H observations be fetched?
3. Can historical .BXBT minute observations be fetched?
4. What is the maximum API page size?
5. How is pagination done?
6. How far back does history go?
7. Are observations available every minute or every 5 minutes?
8. Are there gaps?
9. Are timestamps aligned exactly to UTC minute boundaries?
10. Is the official index published every 5 minutes?
```

If official index history is not directly available through a convenient endpoint, investigate other official BitMEX historical-data sources before falling back to third parties.

---

## 12. Validation workflow

The initial implementation should be a small research script, not the full website.

### Step A

Download a historical section of the official index:

```text
.BVOL7D
```

### Step B

Download the corresponding underlying minute price series:

```text
.BXBT
```

### Step C

Calculate:

```text
log returns
rolling sample standard deviation
scaling
```

### Step D

Align exact timestamps.

### Step E

Compare:

```text
official_value
calculated_value
absolute_error
rounded_equal_0_01
```

### Step F

Report:

```text
number of compared points
rounded match %
mean absolute error
maximum absolute error
largest discrepancies
missing timestamps
```

Only after BVOL7D works should the same process be repeated for BVOL24H.

---

## 13. Why validate BVOL7D first

BVOL7D is a good first target because the reference site already claims a proven match.

This gives us a known benchmark.

If our independent implementation cannot reproduce BVOL7D closely, something is wrong in:

- data source
- timestamps
- rolling-window boundaries
- standard-deviation definition
- scaling
- publication alignment

Once BVOL7D is reproduced, BVOL24H becomes much easier to investigate.

---

## 14. Possible timestamp pitfalls

Check all of these explicitly:

```text
Does the window include the current price?
Does it include exactly 10081 prices for BVOL7D?
Does it include exactly 1441 prices for BVOL24H?
At timestamp T, is the last price observation T or T-1 minute?
Is the index published on exact 5-minute boundaries?
Are price observations sampled at every minute?
Are missing minutes skipped or treated as invalid?
```

Do not fill missing data silently.

The reference site explicitly states:

```text
gaps are not filled
```

That behavior should be preserved unless official methodology says otherwise.

---

## 15. Fallback source

The reference implementation mentions Bitstamp as a fallback when BitMEX price publication is unavailable.

If our project uses Bitstamp or another exchange:

```text
same formula
different price source
```

Therefore the fallback must be visually distinct.

Suggested UI meaning:

```text
official BitMEX index      = primary
independent BitMEX calc    = comparison
fallback exchange calc     = clearly labeled fallback
```

Never claim that fallback equals the official BitMEX index.

---

## 16. Current value card

For the selected index, display:

```text
current value
timestamp
change
source/status
```

Example:

```text
BVOL7D
4.39
06 Oct 2026, 15:50 UTC
```

If official publication is unavailable but independent BitMEX calculation is still available, show that distinction.

Possible status labels:

```text
Official
Calculated from BitMEX
Fallback
```

---

## 17. Formula modal

The website should have a button similar to:

```text
Formula and verification
```

For BVOL24H, explain:

```text
r_i = ln(P_i / P_{i-1})

BVOL24H = 100 × s(r) × sqrt(1440)
```

For BVOL7D:

```text
r_i = ln(P_i / P_{i-1})

BVOL7D = 100 × s(r) × sqrt(10080)
```

Also display:

```text
price count
return count
ddof
data source
calculation interval
validation period
match rate
mean error
maximum error
```

Only show statistics actually produced by our own validation.

---

## 18. Suggested frontend

The user likes the look and behavior of the supplied reference site.

Suggested chart library:

```text
TradingView Lightweight Charts
```

This is preferable to embedding full TradingView if we need full control over our own data.

Possible frontend stack:

```text
Next.js
TypeScript
React
TradingView Lightweight Charts
```

But the stack is not mandatory.

Correct data comes first.

---

## 19. Suggested backend/data implementation

Two reasonable options:

### TypeScript

Useful if the whole project is Next.js/Node.

Possible libraries:

```text
fetch / axios
simple-statistics or custom rolling statistics
```

### Python

Useful for research and historical validation.

Possible libraries:

```text
pandas
numpy
requests/httpx
```

A good workflow would be:

```text
Python research script
-> methodology verified
-> production implementation in TypeScript
```

if that reduces development time.

---

## 20. Performance

A seven-day rolling window on minute data uses:

```text
10081 prices
```

Recomputing the full standard deviation from scratch for every historical point is inefficient.

First get correctness working with a simple implementation.

Then optimize.

Possible optimization later:

```text
rolling sum
rolling sum of squares
online variance / rolling variance
```

But numerical behavior must still match the verified method closely.

---

## 21. Refresh behavior

The reference site says:

```text
page checks data every minute
calculation every 5 minutes
```

Our project may adopt the same behavior if it matches BitMEX publication timing.

Do not poll excessively.

Possible model:

```text
frontend refresh: every 60 seconds
backend index update: every 5 minutes
```

Verify exact publication cadence first.

---

## 22. Caching

Historical index data should not be repeatedly re-downloaded.

Possible simple approach:

```text
SQLite / Postgres / local data files
```

Cache:

```text
official index observations
.BXBT minute prices
calculated index observations
```

For an early prototype, local files are enough.

---

## 23. Initial deliverables

The coding agent should initially produce:

```text
1. research notes
2. source/API findings
3. script to fetch BVOL7D official data
4. script to fetch .BXBT minute data
5. independent BVOL7D calculation
6. validation report
```

Then:

```text
7. BVOL24H data investigation
8. BVOL24H independent calculation
9. BVOL24H validation report
```

Only after these:

```text
10. website
```

---

## 24. Definition of success

### BVOL7D

Success means that our independently calculated values match official historical BitMEX values to the expected precision across multiple independent historical periods.

### BVOL24H

Same requirement.

The desired result is not:

```text
the chart looks similar
```

The desired result is:

```text
the calculation can be independently reproduced and quantitatively verified
```

---

## 25. Useful URLs

Reference website:

https://weekly-crypto-volatility.tarnoplsky.chatgpt.site/

BitMEX BVOL7D:

https://www.bitmex.com/app/index/.BVOL7D

BitMEX BVOL24H:

https://www.bitmex.com/app/index/.BVOL24H

BitMEX BXBT:

https://www.bitmex.com/app/index/.BXBT

The coding agent should verify whether these pages expose or link to methodology/API sources that are still current.

---

## 26. First instruction to Codex

After reading this file and `AGENTS.md`, Codex should begin with research, not implementation.

Recommended initial prompt:

```text
Read AGENTS.md and PROJECT_CONTEXT.md completely.

We are building a Bitcoin historical volatility website with BVOL24H and BVOL7D.

Before building the UI, verify the BitMEX methodology and data availability.

Start with BVOL7D because we have a known reference implementation that claims exact historical replication.

Your first task:
1. identify official BitMEX sources/endpoints for .BVOL7D and .BXBT,
2. determine how much historical data is available,
3. verify exact sampling/publication timestamps,
4. implement a small reproducible validation script,
5. compare calculated BVOL7D against official history,
6. report discrepancies before changing assumptions.

Do not build the full frontend yet.
Do not use the old TradingView/Bitfinex Pine Script as the source of truth.
```

---

## 27. Product philosophy

The project should be understandable and auditable.

A user should be able to answer:

```text
What does this number mean?
Which price source created it?
What exact formula was used?
When was it calculated?
Is it official or independently calculated?
How closely does the independent calculation match history?
```

If the website cannot answer those questions clearly, the project is not finished.
