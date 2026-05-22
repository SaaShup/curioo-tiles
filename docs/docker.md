# Docker

## Run the published image

```bash
sudo docker run -p 3000:3000 \
  -e OVERPASS_URL=https://overpass1.curioo.city/api/interpreter \
  saashup/curioo-tiles:latest
```

## Build locally

```bash
sudo docker build -t saashup/curioo-tiles .
```

## Run with a custom tile zoom range

```bash
sudo docker run -p 3000:3000 \
  -e OVERPASS_URL=https://overpass1.curioo.city/api/interpreter \
  -e TILE_ZOOM_RANGE='[16,19]' \
  saashup/curioo-tiles:latest
```

## Persist editor changes

Use a Docker volume to persist runtime tile zoom settings and saved themes:

```bash
sudo docker run -p 3000:3000 \
  -e OVERPASS_URL=https://overpass1.curioo.city/api/interpreter \
  -e TILE_RUNTIME_CONFIG_FILE=/data \
  -v curioo-tiles-data:/data \
  saashup/curioo-tiles:latest
```

## Enable API key protection

```bash
sudo docker run -p 3000:3000 \
  -e OVERPASS_URL=https://overpass1.curioo.city/api/interpreter \
  -e TILE_API_KEYS='["secret123"]' \
  saashup/curioo-tiles:latest
```
