# CuriooCity Tiles

![Version](https://img.shields.io/github/package-json/v/SaaShup/curioo-tiles)
![Node](https://img.shields.io/badge/node-24--alpine-green)
![License](https://img.shields.io/github/license/SaaShup/curioo-tiles)
![Last Commit](https://img.shields.io/github/last-commit/SaaShup/curioo-tiles)
![Repo Size](https://img.shields.io/github/repo-size/SaaShup/curioo-tiles)
![Top Language](https://img.shields.io/github/languages/top/SaaShup/curioo-tiles)
![CI](https://github.com/SaaShup/curioo-tiles/actions/workflows/tests.yml/badge.svg)

🎨 Fast, local tile preview and theme editor for CuriooCity.

CuriooCity Tiles helps creators build and serve custom map styles for the game world. Built on top of [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API), it makes exploration more colorful, magical, and themeable.

## Features

- Edit map theme colors and preview tiles instantly
- Preview themes without saving, then persist changes
- Serve PNG map tiles from OpenStreetMap / Overpass data
- Configure tile zoom range and runtime theme storage
- Protect tile requests with optional API keys
- Secure editor actions with Keycloak-based authentication
- Expose Prometheus metrics and use the included Grafana dashboard

## Quick online start

Try Curioo Tiles instantly with the online demo:

👉 [Launch the demo](https://curioo-tiles-demo1.curioo.city/)

No installation required. Open the demo, choose a map theme, and preview generated tiles directly in your browser.

## Deploy with [SaaShup](https://admin.curioo.city)

<p align="center">
  <a href="https://admin.curioo.city/order?template=curiootiles">
    <img width="320" height="150" alt="download" src="https://github.com/user-attachments/assets/0f995048-29d6-4f68-b456-b051573774ec" />
  </a>
</p>


## Quick local start

```bash
sudo docker run -p 3000:3000 \
  -e OVERPASS_URL=https://overpass/api/interpreter \
  saashup/curioo-tiles:latest
```

Then open:

- <http://localhost:3000/editor>

## Documentation

- [Installation from source](docs/development.md)
- [Docker usage](docs/docker.md)
- [Configuration](docs/configuration.md)
- [Monitoring with Prometheus and Grafana](docs/monitoring.md)
- [Contributing](docs/contributing.md)

## Common commands

```bash
npm install
npm run dev
npm run test
```

## Grafana dashboard

A ready-to-import Grafana dashboard is included here:

👉 [Download the Grafana dashboard](public/grafana-dashboard.json)

## License

MIT-style. See the project license file.
