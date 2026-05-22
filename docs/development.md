# Development

## Install dependencies

```bash
npm install
npx playwright install --with-deps
```

## Create a `.env` file

Create a `.env` file in the project root to set local defaults. The server uses `dotenv` when running locally.

See [Configuration](configuration.md) for the full environment variable example.

## Run locally

```bash
npm run dev
```

Open the editor:

- <http://localhost:3000/editor>

## Tests

```bash
npm run test:api
npm run test:frontend
npm run test
```

Test commands:

- `npm run test:api` — API unit tests with Vitest
- `npm run test:frontend` — frontend end-to-end tests with Playwright
- `npm run test` — full test suite

## Development tips

- Edit themes in `public/js/editor.js`
- Edit the editor UI in `public/editor.html`
- Use the editor Preview button to test changes before saving
- Preview requires login when editor authentication is enabled
