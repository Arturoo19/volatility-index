# Bitcoin Historical Volatility

Local research prototype with BVOL24H and BVOL7D. Both calculations matched all
867 sampled publications per index after rounding to 0.01. This is sample-based
validation, not proof for every historical year.

## Local website

For a new Codex session, read [AGENTS.md](AGENTS.md),
[current context](PROJECT_CONTEXT.md), and [handoff](docs/HANDOFF.md) first.
For moving to another laptop, follow [GitHub transfer](docs/GITHUB_TRANSFER.md).
Live website: http://23.88.99.59:4173/ on the owner's existing Hetzner VPS.
Docker build, live upstream access and cache persistence are verified; see
[deployment operations](docs/DEPLOYMENT.md).

Use Node.js 24 LTS (tested with 24.19.0). Python 3.12+ is only needed for research
and Python validation, not for running the website. Run these commands from the
cloned repository root. On Windows use `npm.cmd` if PowerShell blocks `npm.ps1`.

```powershell
cd site
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4173/. The server binds only to loopback and serves `site/dist`.
The chart library is packaged locally; the browser needs no BitMEX keys or CDN.

The server refreshes official quotes and recent daily candles on startup and every
five minutes, saving `site/dist/data/market.json` atomically. The visible browser
checks the server every minute. Failed refreshes keep the last successful data and
show an error; publication timestamps remain visible. Switching indices, daily/weekly/monthly
candles, line view, time ranges, comparison dates and methodology are available.
Historical comparison is restricted to the three actual validation days; it is
not a continuously computed multi-year series. Current independent calculations
from minute BXBT prices are displayed separately on both quote cards, including
their timestamps and same-time errors against official publications.

If the primary calculation is unavailable or stale, a separately labeled Bitstamp
BTC/USD reserve uses closed minute candles and the same formula. It never replaces
official chart history. Dark/light theme choice is saved in the browser.
Automatic updates require the local server to remain running.

## Docker on the existing VPS

See [VPS deployment](docs/DEPLOYMENT.md) for the deployed directory and operations.
The separate Compose project serves HTTP on port 4173 by default, so it works by
server IP without a domain. Existing ports 80/443 and the n8n network are not used.
It stores market and minute caches in a named volume, seeds only an absent market
snapshot, runs as the Node user, restarts automatically and includes a health check.

The server accepts `HOST`, `PORT` and `DATA_DIR`. Without these variables local
behavior and file locations are unchanged. Compose sets them for the container.

## Data and verification

```powershell
python scripts/validate_indices.py
python scripts/validate_indices.py --offline
python scripts/prepare_site_data.py
python -m unittest discover -s scripts -p 'test_*.py'
cd site
npm test
```

On this Windows machine use the bundled executable if the Windows Python alias
is unavailable:
`C:\Users\aazizbekov\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`.

See [validation](docs/VALIDATION_INDICES.md), [research](docs/RESEARCH.md), and
[website implementation](docs/WEBSITE.md).

## Remaining stages

- Continuous independent history beyond the saved validation intervals, if needed.
- Optional domain/HTTPS route and future deployment updates.
- Further audit of historical methodology, pre-2017 sources and missing history.
