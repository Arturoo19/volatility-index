# AGENTS.md

## Resume an existing implementation

Read `PROJECT_CONTEXT.md`, then `docs/HANDOFF.md` before changing code.
Research, validation, UI, fallback and local background refresh are implemented.
The development order below describes the original project sequence, not a request
to restart completed work. Current next step is deployment to the user's existing
Hetzner VPS, from their home laptop. Do not deploy until server access and the
existing n8n/OpenClaw/reverse-proxy configuration have been inspected.
Preserve these services. Do not infer credentials, domain names or server paths.

## Project purpose

This project builds a Bitcoin historical volatility website inspired by the reference site:

https://weekly-crypto-volatility.tarnoplsky.chatgpt.site/

The final product must support both:

- **BVOL24H** — 24-hour Bitcoin historical volatility
- **BVOL7D** — 7-day Bitcoin historical volatility

The priority is **correctness and reproducibility**, not just visual similarity.

---

## Source of truth

Do not treat the old TradingView/Pine Script approximation as authoritative.

The intended hierarchy is:

1. Official BitMEX published index data, when available
2. Official BitMEX methodology/documentation
3. Independent calculation from the underlying BitMEX Bitcoin price series
4. Fallback calculation from another exchange only when BitMEX source data is unavailable

The existing reference website is useful as a product/UI reference and as evidence of a working BVOL7D replication, but its implementation must not be copied blindly.

---

## Core requirement

Before building the full UI, verify that the independent calculation can reproduce official historical index values.

For every index:

- identify the exact BitMEX source series
- identify the exact sampling interval
- identify the rolling window
- identify whether standard deviation is sample or population
- identify scaling factor
- identify publication frequency
- compare calculated values against official historical values
- report mean error, maximum error, and rounded-match rate

Do not claim exact replication until this validation is completed.

---

## Candidate formulas to verify

### BVOL24H

Candidate formula currently expected:

```text
r_i = ln(P_i / P_{i-1})

BVOL24H = 100 × s(r) × sqrt(1440)
```

Expected window:

```text
1441 prices -> 1440 one-minute log returns
```

Expected:

```text
sample standard deviation
ddof = 1
```

This must be verified against official BitMEX methodology and official historical BVOL24H values before it is treated as final.

### BVOL7D

Formula supplied by the reference implementation:

```text
r_i = ln(P_i / P_{i-1})

BVOL7D = 100 × s(r) × sqrt(10080)
```

Expected window:

```text
10081 prices -> 10080 one-minute log returns
```

Expected:

```text
sample standard deviation
ddof = 1
```

Reference site states that the calculation uses minute observations of `.BXBT` and is published/calculated every 5 minutes.

This must still be independently verified in this project.

---

## Important BitMEX symbols

Investigate and verify:

```text
.BVOL24H
.BVOL7D
.BXBT
```

Likely roles:

- `.BVOL24H` — official 24-hour volatility index
- `.BVOL7D` — official 7-day volatility index
- `.BXBT` — underlying BTC/USD reference price series

Do not assume API endpoints or historical availability. Verify them.

---

## Development order

Work in this order:

1. Research official methodology and data availability
2. Build a small data-fetching prototype
3. Reproduce official BVOL7D historical values
4. Reproduce official BVOL24H historical values
5. Produce validation statistics
6. Only then build the main chart/UI
7. Add fallback data source
8. Add caching/background refresh
9. Add deployment configuration

Do not start by polishing the frontend.

---

## UI goal

The website should feel similar to the supplied weekly-volatility reference site, but support both indices.

Suggested top-level selector:

```text
BVOL24H | BVOL7D
```

Suggested chart controls:

```text
Candles | Line
1D | 1W | 1M
3M | 6M | 1Y | 3Y | 5Y | All
Compare calculation
Formula and verification
```

Exact controls can change if there is a better UX.

---

## Chart behavior

Keep these concepts separate:

- the **rolling window used by the index formula**
- the **visual candle timeframe**

Example:

A weekly chart candle does not mean the volatility formula becomes weekly if the user is viewing BVOL24H.

For BVOL24H:

```text
rolling formula window = 24 hours
```

For BVOL7D:

```text
rolling formula window = 7 days
```

Chart timeframe changes only aggregation/display.

---

## Data presentation

Whenever possible, distinguish:

- official BitMEX index history
- independent calculation
- fallback calculation from another exchange

Never visually merge these sources in a way that implies they are identical.

If official publication stops, continue independent calculation only if underlying source data remains available.

If BitMEX underlying price data is unavailable, a fallback exchange may be used, but it must be clearly labeled as a different source.

---

## Fallback source

The reference site mentions Bitstamp as a fallback.

If a fallback is implemented:

- keep the same mathematical formula
- clearly label the fallback series
- do not claim it equals the official BitMEX index
- use it only when the preferred BitMEX source cannot be calculated

---

## Numerical rules

Use stable floating-point calculations.

For validation:

- compare values at identical timestamps
- preserve full precision internally
- only round for display or rounded-match tests
- explicitly use `ddof = 1` when sample standard deviation is required

Do not compare values from different timestamps.

---

## Time handling

Store and calculate timestamps in UTC.

The UI may display UTC by default.

If local-time display is added later, keep internal timestamps UTC.

---

## Engineering expectations

Prefer a simple architecture first.

Possible stack:

- frontend: React / Next.js or another lightweight web frontend
- chart: TradingView Lightweight Charts
- backend/data layer: Node.js/TypeScript or Python
- cache/database only if needed

Do not introduce unnecessary infrastructure before data correctness is proven.

---

## Documentation

Maintain a short technical document explaining:

- formula
- exact source data
- exact timestamps
- sampling
- rolling-window implementation
- validation method
- fallback behavior
- known limitations

Whenever a methodology assumption changes, update the documentation.

---

## Rules for the coding agent

When uncertain:

1. verify before implementing
2. do not invent exchange behavior
3. do not silently replace unavailable official data
4. explain discrepancies quantitatively
5. prefer a testable prototype over a polished guess

Before making a major implementation change, summarize:

- what is known
- what is still uncertain
- what will be tested next
