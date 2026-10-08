# Codex handoff — 2026-10-08

## User intent and next action

Communicate in Ukrainian. The owner wants to transfer this project via GitHub to
their home laptop, then host it on their own Hetzner VPS. The VPS has been used for
n8n and OpenClaw. Server address, operating system, available resources, management
panel, reverse proxy, Docker configuration and domain are not yet known. Do not
assume the older services are absent or replace their configuration.

GitHub is source control/transfer, not the selected hosting provider. Nothing has
been pushed or deployed by the current agent. No remote URL is configured here.
Do not start the research or rebuild the UI from scratch.

## Implemented and checked

- Both indices, candle/line view, UTC daily/weekly/monthly aggregation, time ranges.
- Official daily history from 2016-02-15, preserving gaps and partial bars.
- Independent current calculation from minute `.BXBT` observations; 1441/10081
  prices, sample variance ddof=1, log returns, scaling 100*sqrt(1440/10080).
- Three historical comparison days: 2020-03-12, 2025-05-01, 2026-09-18.
  867 samples per index, 1734 total; 100% matched official values rounded to 0.01.
  Production JS agrees with saved Python values (maximum observed difference 0).
- Bitstamp BTC/USD fallback uses closed minute candles at candle-start +60s.
  It is separately labeled and only active for unavailable/stale primary windows.
  No fallback is spliced into official candles or comparison history.
- Auto-refresh, atomic file caches, last-good values on network failure, visible
  timestamps/staleness; dark/light theme persisted locally; price axis without %;
  CSV export and methodology modal.
- All 11 Node tests passed 2026-10-08. Python four integrity tests passed earlier.
  Live Bitstamp full 10081-price window checked; fallback activation/recovery tested
  with synthetic outages, not an induced real exchange outage.

## Repository map and persistence

| Path | Purpose |
|---|---|
| `site/dist/*.js`, `index.html`, `style.css` | Hand-written frontend source: KEEP these tracked |
| `site/dist/data/market.json` | Tracked public bootstrap snapshot; runtime replaces it |
| `site/dist/vendor/` | Generated chart library/license; ignored; `npm run build` restores |
| `site/server.mjs` | Local HTTP server, API, CSV and scheduled refresh |
| `site/market-store.mjs` | Official quotes/daily history fetching and atomic persistence |
| `site/live-calculation.mjs` | Shared rolling formula and incremental price cache |
| `site/bitstamp-feed.mjs` | Reserve OHLC adapter and activation policy |
| `site/bxbt-live.json`, `site/bitstamp-live.json` | Ignored runtime caches; regenerated on first run |
| `data/validation/raw/` | Public raw research fixtures: KEEP for offline reproducibility |
| `data/validation/*.csv`, `*.json` | Validation outputs and reports |
| `scripts/` | Python stdlib validation/bootstrap and PowerShell API probe |
| `docs/RESEARCH.md`, `VALIDATION_*.md`, `WEBSITE.md` | Methods, statistics, contracts and limitations |

The directory called `dist` is NOT entirely disposable build output. The build
script only copies the chart library and license. Do not ignore or delete all of it.
Do not exclude the raw fixtures: `npm test` loads them to repeat 1734 comparisons.
No exchange keys are needed. Local credentials and live caches are ignored.

## Run after cloning

Use Node 24 LTS (original machine: v24.19.0); `package-lock.json` is included.
From repository root:

```sh
cd site
npm ci
npm run build
npm run check
npm test
npm start
```

Open http://127.0.0.1:4173/. First independent calculation needs up to 11 API pages
and can take a while; the bootstrap official snapshot remains visible meanwhile.
Python is optional for serving. From repo root with Python 3.12+:

```sh
python -m unittest discover -s scripts -p 'test_*.py'
python scripts/validate_indices.py --offline
```

Use `python3` on Linux if required. The original bundled Python path in README is
specific to the office laptop, not a prerequisite on the home machine/VPS.
Do not run `prepare_site_data.py` while the server writes the same market snapshot.

## Current vs proposed refresh behavior

Currently: server startup + every 300s; browser polls every 60s when visible and
when returning to the page. Current calculations target five-minute UTC boundaries.
The reference site's public JS was inspected on 2026-10-08: it polls every 60s;
its separate 15s timer only updates freshness status. Backend cadence is unknown.

Proposed for VPS, not yet implemented: backend checks every 60s, frontend every
30s. Official values are still published every five minutes. Update both timing
code and UI/status documentation together. Retain deduplication and throttling;
avoid re-downloading years of history. A one-minute independent intermediate index
was discussed as an option, not requested or implemented.

## VPS deployment work remaining

1. Inspect the existing server with the owner's authorized access: OS, free memory,
   disk, running containers/services, proxy, ports, domain/DNS and backup setup.
2. Choose Docker Compose alongside existing services if appropriate; systemd is
   also viable. Dockerfile/Compose/systemd units do not exist yet.
3. Make bind address/port and a dedicated writable DATA_DIR configurable. Current
   bind is hard-coded 127.0.0.1:4173; inside a Docker container it must be reachable
   from the selected proxy network. Do not expose it publicly without the proxy.
4. Move runtime files to persistent storage, seeded with the tracked market JSON
   only when absent. Preserve it across rebuilds and backups. Keep minute caches
   outside the public static directory. Run a single writer/process; there is no
   cross-process cache lock and horizontal scaling is not supported.
5. Add automatic restart, health check and bounded logs; integrate with the existing
   reverse proxy and HTTPS rather than replacing n8n/OpenClaw proxy settings.
6. Implement agreed faster checks and test upstream access from Hetzner's region.
   Verify both indices, fallback labels, CSV, themes, restart persistence, and
   updates while no browser is open. Exercise outage/recovery tests.
7. Review public API behavior: POST /api/market currently triggers a globally
   throttled refresh without auth. Apply suitable proxy rate limits; do not make
   upstream requests proportional to visitors. No administration endpoint is needed.
8. Document the actual deployed domain, service commands, backup and rollback steps
   without writing secrets to the repository. Report success only after live checks.

## Remaining product limitations

No claim of all-years formula replication: older methodology, pre-2017 source
coverage and missing history need further auditing. Independent historical charts
only cover the three saved samples. Current calculations are separate cards.
Historical gaps remain gaps; timestamps and sources must never be silently mixed.

## Suggested prompt on the home laptop

> Прочитай AGENTS.md, актуальний блок PROJECT_CONTEXT.md і docs/HANDOFF.md.
> Це вже готовий локальний сайт, не починай розробку з нуля. Перевір запуск і тести,
> потім допоможи розгорнути його на моєму Hetzner VPS поруч із n8n та OpenClaw.
> Спочатку з'ясуй конфігурацію сервера й доступ. Підготуй постійне сховище кешу,
> автозапуск, HTTPS та перевірку нових даних щохвилини; сторінка — кожні 30 секунд.
> Збережи роботу наявних сервісів і розділення офіційних, незалежних та резервних даних.
