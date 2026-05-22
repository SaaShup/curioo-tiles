# Configuration

CuriooCity Tiles can be configured with environment variables. When running locally, create a `.env` file in the project root.

## Example `.env`

```env
# Standard server configuration
NODE_ENV=production
PORT=3000
DEBUG=false

# Tile server setup
THEME=forest
OVERPASS_URL=https://overpass1.curioo.city/api/interpreter

# Inclusive tile zoom range as [from,to]. Defaults to [18,18].
# from must be >= 3 and to must be <= 20.
TILE_ZOOM_RANGE=[18,18]

# Editor changes are persisted under TILE_RUNTIME_CONFIG_FILE.
# Set it to a directory to store runtime-config.json and themes.json together.
TILE_RUNTIME_CONFIG_FILE=data

# Tile API key protection
# Leave TILE_API_KEYS empty to allow public tile requests.
# Set this to a JSON array or a comma-separated list of accepted keys.
# Supported query parameters: key, apikey, api_key
TILE_API_KEYS=["secret123"]

# Keycloak / auth defaults
# Authentication may work on any provider but is currently tested with Keycloak.
ALLOWED_EDITOR_EMAILS=""
KEYCLOAK_REALM="${REALM}"
KEYCLOAK_URL="${KEYCLOAK_URL}"
KEYCLOAK_SSL_REQUIRED="external"
KEYCLOAK_CLIENT_ID="${CLIENT_ID}"
KEYCLOAK_CLIENT_SECRET="${CLIENT_SECRET}"
KEYCLOAK_CONFIDENTIAL_PORT=0
```

## Notes

- Values in `.env` are used by `npm run dev`.
- Docker `-e` values override defaults.
- Leave `TILE_API_KEYS` empty to allow public tile requests.
- Use `TILE_RUNTIME_CONFIG_FILE=/data` with a Docker volume if you want saved themes to survive container recreation.
