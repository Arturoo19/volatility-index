# Hetzner VPS deployment without a domain

## Status and inspected facts (2026-10-10)

The site is deployed and reachable from the home laptop at
http://23.88.99.59:4173/. Docker build and all 15 Node tests passed on the VPS;
container `volatility-index-web-1` is healthy. The local Docker Engine is not
running, so the actual image build/runtime checks were performed remotely.

Actual source directory: `/root/volatility-index.us4VwD`.
Compose project: `volatility-index`; persistent volume: `volatility-index_market-data`.
Use these read-only commands on the VPS to inspect the running site:

```sh
cd /root/volatility-index.us4VwD
docker compose ps
docker compose logs --tail=80 web
```

Verification evidence from 2026-10-10 (timestamps are UTC):

- Public `/healthz`, HTML, scripts, styles and chart library returned HTTP 200.
- Both official indices and complete independent BXBT calculations were current
  and matched to 0.01 at identical timestamps; fallback was inactive.
- Official refresh advanced from 15:28:09 to 15:33:09 without an agent POST request,
  confirming the background five-minute schedule.
- Both indices exported CSV for 1D/1W/1M: 3891/3886 daily rows, 556 weekly rows and
  129 monthly rows at verification time.
- A stop/copy/start backup cycle retained market and minute caches; after restart,
  both calculations returned current 15:35 publications without errors.
- Original n8n/PostgreSQL/Caddy IDs/start times and OpenClaw PID/start time were
  unchanged. Both n8n and OpenClaw HTTP checks returned 200.
- Browser automation failed to initialize. No new visual interaction checks are
  claimed; HTTP assets and API/CSV were verified. Existing earlier local UI checks
  remain documented in `WEBSITE.md`.

Consistent backup on the VPS: `/root/volatility-index-backup.ea7FjJ/`.
An off-VPS copy is on the laptop at
`C:/GitHub/volatility-index/site/runtime-data/deployment-backup/` (ignored by Git).
It contains `market.json` and `bxbt-live.json`; the inactive reserve had no cache yet.

The owner supplied these read-only observations:

- Server IPv4: `23.88.99.59`; Ubuntu server, 4 GB RAM reported in the Hetzner UI.
- Existing Compose project: `n8n-project`, with n8n, PostgreSQL and Caddy.
- Existing Compose file: `/root/n8n-project/docker-compose.yml`.
- Caddy publishes ports 80/443 and belongs to `n8n-project_default`.
- OpenClaw listens on loopback ports 18789/18791 as the root user's enabled
  `openclaw-gateway.service`; unit file:
  `/root/.config/systemd/user/openclaw-gateway.service`.
- Caddy runs `caddy reverse-proxy --from n8n.rentautoazizbekov.online --to n8n:5678`
  with its existing `/data` and `/config` Docker volumes.
- Inspection found 2.0 GiB available memory, 61 GB available disk, Docker 29.1.3,
  Docker enabled at boot, and UFW inactive. Public port 4173 was reachable without
  changing host or Hetzner firewall rules.
- TCP port 4173 was not listed as occupied. The owner has no domain.
- The local checkout has origin `https://github.com/Arturoo19/volatility-index.git`.
  The deployment changes have not been committed or pushed.

Inspection was completed before the first start. For future changes, re-check
Caddy arguments/mounts, OpenClaw, free memory/disk and applicable firewall rules.
Run each command on its own line, without combining several `docker inspect`
commands into one command:

```sh
docker inspect n8n-project-caddy-1 --format 'CMD={{json .Config.Cmd}} MOUNTS={{json .Mounts}}'
free -h
df -h /
ps -p 3371561 -o pid,user,comm
readlink /proc/3371561/cwd
```

The PID is from the owner's observation; re-check `ss -tulpn` if it has changed.
No existing service needs a restart for this deployment. The new Compose project
has its own bridge network and does not attach to the n8n/PostgreSQL network.

## Transfer the prepared working files

The generated `volatility-index-deploy.tar.gz` contains this working tree's
deployment changes, frontend sources, public snapshot and validation fixtures.
It omits Git metadata, dependencies, credentials and live minute caches. This
avoids assuming that uncommitted changes have already reached GitHub.

From the home laptop's PowerShell, with existing SSH access:

```powershell
scp C:/GitHub/volatility-index/volatility-index-deploy.tar.gz root@23.88.99.59:
```

On the VPS, create a new directory rather than overwriting an existing checkout:

```sh
APP_DIR=$(mktemp -d "$HOME/volatility-index.XXXXXX")
tar -xzf "$HOME/volatility-index-deploy.tar.gz" -C "$APP_DIR"
cd "$APP_DIR"
pwd
docker compose config --quiet
docker compose build web
```

Keep the directory printed by `pwd` for subsequent commands. No application has
started at this point. If any command fails, resolve it before continuing.

## Start after server inspection

From that extracted directory:

```sh
docker compose up -d web
docker compose ps
docker compose logs --tail=80 web
curl -fsS http://127.0.0.1:4173/healthz
```

Expected health body: `{"status":"ok"}`. This confirms the HTTP process and readable
market snapshot, not fresh upstream data. It remains healthy during an exchange
outage because serving the last good cache is intentional.

Open `http://23.88.99.59:4173/`. This configuration uses direct HTTP on a separate
port; it does not configure HTTPS or modify the existing Caddy. The public port is
configurable through `PUBLIC_PORT`; `PUBLIC_BIND_ADDRESS` defaults to `0.0.0.0`.
See [Docker port publishing](https://docs.docker.com/engine/network/port-publishing/).

If the local health request succeeds but the remote browser cannot connect,
inspect the Hetzner firewall attached to this server. If one is attached and
blocks this port, add an inbound TCP 4173 rule while retaining its existing rules.
Do not reset the firewall. Docker manages published-port forwarding, so UFW alone
is not a reliable way to restrict a published container port; see
[Docker firewall integration](https://docs.docker.com/engine/network/packet-filtering-firewalls/).

For private access instead of publishing the site, create `.env` with
`PUBLIC_BIND_ADDRESS=127.0.0.1`, recreate only this Compose service, and open a
tunnel from the laptop:

```powershell
ssh -N -L 4173:127.0.0.1:4173 root@23.88.99.59
```

The browser address for this private mode is `http://127.0.0.1:4173/`.

## Verify the actual deployment

- Check both indices, line/candle view, CSV, themes and historical comparisons.
- Check `/api/market` for current official timestamps, independent calculation
  timestamps and separately labeled fallback status. Initial minute downloads
  can take up to 11 pages; readiness alone does not prove fresh calculations.
- Wait through a scheduled refresh with all browser tabs closed, then verify
  that the data's checked/publication timestamps progress when upstream publishes.
- Run `docker compose restart web` and confirm that the stored market snapshot
  and minute caches remain. Run one process only; storage has no cross-process lock.
- Confirm that all three pre-existing n8n project containers remain running and
  that the host Node/OpenClaw service still responds through its existing access.

Backend checks remain every 300 seconds and browser polling every 60 seconds.
The previously discussed faster cadence is not part of this deployment change.

## Persistence, backup and recovery

The named volume is `volatility-index_market-data`, mounted at
`/app/runtime-data`. It contains `market.json`, `bxbt-live.json` and
`bitstamp-live.json`. A rebuilt image seeds `market.json` only when the file is
absent. The runtime filesystem is read-only except for this volume and `/tmp`.
Logs rotate; the container is limited to 512 MB of memory.
See [Docker volumes](https://docs.docker.com/engine/storage/volumes/).

To back up a consistent set of caches, stop only this app, copy its data and
start it again from the extracted deployment directory:

```sh
BACKUP_DIR=$(mktemp -d "$HOME/volatility-index-backup.XXXXXX")
docker compose stop web
docker compose cp web:/app/runtime-data/. "$BACKUP_DIR/"
docker compose start web
```

Keep a copy of that backup outside the VPS. Cache files can also be re-created
from public sources, but relying on upstream availability is not a backup policy.

To stop the app without removing its storage, use `docker compose stop web`.
Do not use `docker compose down -v`: it deletes the persistent volume.
Before rebuilding an update, retain the current image with
`docker image tag volatility-index:local volatility-index:previous`; rebuild and
verify the new image. Roll back with:

```sh
docker compose stop web
docker image tag volatility-index:previous volatility-index:local
docker compose up -d --no-build web
```

Image rollback does not replace the volume. Restore a saved data backup separately
with the app stopped if a later change has altered the cache format.
