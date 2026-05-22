# Monitoring

CuriooCity Tiles exposes Prometheus-compatible metrics at `/metrics` using `prom-client`.

## Metrics

Default Node.js process metrics are exposed, plus these application metrics:

- `tile_requests_total{theme,status}` — counter of tile requests by theme and HTTP status
- `tile_render_duration_seconds{theme}` — histogram of tile render duration in seconds
- `tile_memory_tiles` — gauge of tiles currently being rendered in memory
- `overpass_requests_total{status}` — counter of Overpass API requests
- `overpass_cache_total{result}` — counter for Overpass cache hits and misses

## Prometheus scrape config

```yaml
scrape_configs:
  - job_name: 'curioo_tiles'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scheme: http
```

## Grafana

A ready-to-import Grafana dashboard is included:

👉 [Download the Grafana dashboard](../public/grafana-dashboard.json)

The dashboard provides:

- Tile request rate monitoring
- Total tile requests
- HTTP status distribution
- Overpass cache statistics
- 4xx / 5xx error monitoring
- Successful request tracking
- Tiles currently rendered in memory

## Authentication note

If your instance is behind authentication such as Keycloak, make sure Prometheus can access `/metrics`. Common options are:

- allowlist the Prometheus IP
- expose `/metrics` without authentication
- use a pull proxy
- use a Pushgateway when pull-based scraping is not possible
