FROM node:24-bookworm-slim AS build
WORKDIR /app/site
COPY site/package.json site/package-lock.json ./
RUN npm ci --ignore-scripts
COPY site/ ./
COPY data/validation/ /app/data/validation/
RUN npm run build && npm run check && npm test

FROM node:24-bookworm-slim
WORKDIR /app/site
ENV HOST=0.0.0.0 PORT=4173 DATA_DIR=/app/runtime-data
COPY --from=build /app/site/dist/ ./dist/
COPY --from=build /app/site/package.json /app/site/server.mjs /app/site/server-config.mjs /app/site/market-store.mjs /app/site/live-calculation.mjs /app/site/bitstamp-feed.mjs /app/site/bitstamp-history.mjs ./
RUN mkdir -p /app/runtime-data && chown node:node /app/runtime-data
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "--input-type=module", "-e", "try{const r=await fetch('http://127.0.0.1:4173/healthz',{signal:AbortSignal.timeout(4000)});process.exit(r.ok?0:1);}catch{process.exit(1);}"]
CMD ["node", "server.mjs"]
