# CuriooCity Tiles

![Version](https://img.shields.io/github/package-json/v/SaaShup/curioo-tiles)
![Node](https://img.shields.io/badge/node-24--alpine-green)
![License](https://img.shields.io/github/license/SaaShup/curioo-tiles)
![Last Commit](https://img.shields.io/github/last-commit/SaaShup/curioo-tiles)
![Repo Size](https://img.shields.io/github/repo-size/SaaShup/curioo-tiles)
![Top Language](https://img.shields.io/github/languages/top/SaaShup/curioo-tiles)
![CI](https://github.com/SaaShup/curioo-tiles/actions/workflows/tests.yml/badge.svg)

🎨 Fast, local tile preview and theme editor.

CuriooCity Tile Editor was created to build and serve custom map styles for the game world.
On top of [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API), it allows creators to design colorful and unique environments that make exploration more magical for players.

Features
- Edit map theme colors and preview tiles instantly
- Preview themes without saving, then persist changes
- Supports Keycloak-based auth for editor actions

## Quick start

```
sudo docker run -p 3000:3000 \
  -e OVERPASS_URL=https://overpass1.curioo.city/api/interpreter \
  saashup/curioo-tiles:latest
```

## Start From source code

### Install dependencies

```bash
npm install
npx playwright install --with-deps
```

### Test
- API unit tests: `npm run test:api` (uses `vitest`)
- Frontend end-to-end: `npm run test:frontend` (uses Playwright)
- Full test suite: `npm run test`

### Create a `.env` then run locally:

Create a `.env` file in the project root to set local defaults. The server uses `dotenv` when running locally.

Example `.env`:

```env
# Standard server Configuration
NODE_ENV=production
PORT=3000
DEBUG=false

# Tile server setup
THEME=forest
OVERPASS_URL=https://${OVERPASS_URL}
# Inclusive tile zoom range as [from,to]. Defaults to [18,18].
# from must be >= 3 and to must be <= 20.
TILE_ZOOM_RANGE=[18,18]

# Tile API key protection
# Leave TILE_API_KEYS empty to allow public tile requests.
# Set this to a JSON array or a comma-separated list of accepted keys.
# Supported query parameters: key, apikey, api_key
TILE_API_KEYS=["secret123"]

# Keycloak / auth defaults
# Authentication may work on any provider but not tested yet
ALLOWED_EDITOR_EMAILS=""
KEYCLOAK_REALM="${REALM}"
KEYCLOAK_URL="${KEYCLOAK_URL}"
KEYCLOAK_SSL_REQUIRED="external"
KEYCLOAK_CLIENT_ID="${CLIENT_ID}"
KEYCLOAK_CLIENT_SECRET="${CLIENT_SECRET}"
KEYCLOAK_CONFIDENTIAL_PORT=0
```

Notes
- Values in `.env` are used by `npm run dev`. You can still override any value with environment variables (for example when running Docker with `-e`).
- The built-in `dev` script now reads from `.env` instead of hardcoding `THEME` and `OVERPASS_URL`.

### Run

```bash
npm run dev
```

### Open the editor in your browser:

- http://localhost:3000/editor

## Using Docker

Build an image:

```bash
sudo docker build -t saashup/curioo-tiles .
```

Run with custom Overpass URL (example):

```bash
sudo docker run -p 3000:3000 \
  -e OVERPASS_URL=https://overpass1.curioo.city/api/interpreter \
  saashup/curioo-tiles:latest
```

Run with a custom tile zoom range:

```bash
sudo docker run -p 3000:3000 \
  -e OVERPASS_URL=https://overpass1.curioo.city/api/interpreter \
  -e TILE_ZOOM_RANGE='[16,19]' \
  saashup/curioo-tiles:latest
```

Run with API key protection enabled:

```bash
sudo docker run -p 3000:3000 \
  -e OVERPASS_URL=https://overpass1.curioo.city/api/interpreter \
  -e TILE_API_KEYS='["secret123"]' \
  saashup/curioo-tiles:latest
```

## Monitoring

### Prometheus 

This service exposes Prometheus-compatible metrics at the `/metrics` endpoint (exported using `prom-client`). Metrics include default NodeJS process metrics plus these application-specific metrics:

- `tile_requests_total{theme,status}` — counter of tile requests by theme and HTTP status.
- `tile_render_duration_seconds{theme}` — histogram of tile render durations (seconds).
- `overpass_requests_total{status}` — counter of Overpass API requests.
- `overpass_cache_total{result}` — counter for Overpass cache hits/misses.

Prometheus scrape config example:

```yaml
scrape_configs:
	- job_name: 'curioo_tiles'
		static_configs:
			- targets: ['localhost:3000']
		metrics_path: '/metrics'
		scheme: http
```

### Grafana

A ready-to-import Grafana dashboard is included for monitoring CuriooCity Tiles with Prometheus.

The dashboard provides:

- Tile request rate monitoring
- Total tile requests
- HTTP status distribution
- Overpass cache statistics
- 4xx / 5xx error monitoring
- Successful request tracking

Import the dashboard JSON file into Grafana. 
You can [Download Grafana Dashboard here](public/grafana-dashboard.json)

Notes:
- If your instance is behind authentication (Keycloak), ensure Prometheus can access `/metrics` (allowlist the IP or configure an unauthenticated metrics endpoint), or use a pull-proxy or Pushgateway.
- You can import the metrics into Grafana and build dashboards around `tile_render_duration_seconds` and `tile_requests_total` for latency and usage insights.

Development tips
- Edit themes in `public/js/editor.js` and `public/editor.html` for UI tweaks
- Preview changes instantly using the editor's Preview button (requires login)

Contributing
- Open a PR and describe the change. Keep changes focused and test locally.

License
- MIT-style (see project files)
