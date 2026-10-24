# AudioTube frontend

SvelteKit/Svelte 4 listening app, preserving the original monochrome grid,
outlined channel buttons and bottom search. Includes native audio, queue,
saved items, progress/history, channel management and library import/export.

Use Node 22+:

```sh
npm ci
cp .env.example .env
npm run dev
```

Set `PUBLIC_API_BASE_URL` to a browser-reachable running AudioTube API. The
frontend and API default to ports 3000 and 8000 respectively. The native player
needs the API's `/audio/{video_id}` endpoint, not an old metadata-only deployment.

```sh
npm run check
npm test
npm run build
npm run test:e2e
ORIGIN=http://localhost:3000 npm start
```

Browser tests use Chrome by default. For Playwright-managed Chromium, run
`npx playwright install chromium`, then `PLAYWRIGHT_CHANNEL=chromium npm run test:e2e`.
A built production server is launched automatically when none is running on 3000.
Tests use mock discovery and local audio; actual phone lock-screen playback is a
separate manual check. `docker build --target production .` builds the Node server.

See the [API README](https://github.com/Ashwyn28/audio_youtube#readme) for API configuration, complete Compose startup,
background playback details and limitations, and the release checklist.

Vercel builds select the Vercel adapter automatically when `VERCEL=1`; local and
Docker builds retain the Node adapter. Set `PUBLIC_API_BASE_URL` in both Preview
and Production environments to the HTTPS streaming API, and keep its CORS origins
aligned with the frontend origin.
