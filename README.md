# CuriooCity Tiles

![version](https://img.shields.io/badge/version-1.8.0-blue)
![node](https://img.shields.io/badge/node-24--alpine-green)
![license](https://img.shields.io/badge/license-ISC-blue)
![last-commit](https://img.shields.io/github/last-commit/your-org/your-repo)

🎨 Fast, local tile preview and theme editor.

Features
- Edit map theme colors and preview tiles instantly
- Preview themes without saving, then persist changes
- Supports Keycloak-based auth for editor actions

Quick start

```
sudo docker run -p 3000:3000 -e OVERPASS_URL=https://overpass1.curioo.city/api/interpreter saashup/curioo-tiles:latest
```

Start From source code

1. Install dependencies

```bash
npm install
```

2. Create a `.env` (see Configuration below), then run locally:

```bash
npm run dev
```

3. Open the editor in your browser:

- http://localhost:3000/editor
- http://localhost:3000/editor

Configuration (.env)
Create a `.env` file in the project root to set local defaults. The server uses `dotenv` when running locally.

Example `.env`:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
DEBUG=false

# Tile setup
THEME=forest
OVERPASS_URL=https://${OVERPASS_URL}

# Tile API key protection
# Leave TILE_API_KEYS empty to allow public tile requests.
# Set this to a JSON array or a comma-separated list of accepted keys.
# Supported query parameters: key, apikey, api_key
TILE_API_KEYS=["secret123"]

# Keycloak / auth defaults
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

Docker
Build an image:

```bash
sudo docker build -t saashup/curioo-tiles .
```

Run with custom Overpass URL (example):

```bash
sudo docker run -p 3000:3000 -e OVERPASS_URL=https://overpass1.curioo.city/api/interpreter saashup/curioo-tiles:latest
```

Run with API key protection enabled:

```bash
sudo docker run -p 3000:3000 \
  -e OVERPASS_URL=https://overpass1.curioo.city/api/interpreter \
  -e TILE_API_KEYS='["secret123"]' \
  saashup/curioo-tiles:latest
```

Testing
- API unit tests: `npm run test:api` (uses `vitest`)
- Frontend end-to-end: `npm run test:frontend` (uses Playwright)
- Full test suite: `npm run test`

Monitoring

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
