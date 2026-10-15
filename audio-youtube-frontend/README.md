# AudioTube

A SvelteKit frontend for browsing YouTube channels and listening through custom
playback controls. It uses the YouTube IFrame Player API for playback and the
`audio_youtube` backend for video search and channel metadata.

The interface includes a latest-upload feed, channel shortcuts, channel search,
video search, and play/pause and seeking controls. Playback requires an internet
connection and YouTube embeds; this app does not download audio files.

## Local setup

Use Node.js 22 and npm. Run these commands from this directory (one level below
the repository root):

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:3000. The development server listens on all interfaces.

### Backend configuration

Set `PUBLIC_API_BASE_URL` in `.env` to the backend URL:

```dotenv
PUBLIC_API_BASE_URL=http://localhost:8000
```

Start the sibling `audio_youtube` backend separately using its README. Its CORS
configuration must allow the frontend origin; `http://localhost:3000` is already
listed in that backend. Use the same hostname in your browser when testing locally.

Without this variable, the app uses the existing hosted API URL in
`src/lib/services/search.ts`. Its availability is not guaranteed by this repository.
`PUBLIC_` values are visible to the browser: never put a YouTube key or other secret
in them. The YouTube Data API key belongs on the backend.

Restart the development server after changing `.env`. Set this variable in your
hosting environment for server deployments. For prerendered pages, public dynamic
environment variables cannot be used; configure the adapter and environment strategy
for your deployment target before enabling prerendering.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start development server on port 3000. |
| `npm run check` | Generate SvelteKit types and check Svelte/TypeScript code. |
| `npm run check:watch` | Run checks while editing. |
| `npm run build` | Build the application. |
| `npm run preview -- --host 0.0.0.0 --port 3000` | Preview the build locally on port 3000. |

There is no automated test runner configured. For a manual smoke check with the
backend running, confirm that the feed loads, select a channel, search for a video,
add a channel, and check play/pause and seeking. The browser should request
`/videos/search`, `/channels/search`, `/channels/{id}/latest`, and `/channels/latest`
on the configured backend.

## Docker development

Create `.env` as above, then run from this directory:

```sh
docker compose up --build
```

Compose starts the development target on port 3000, mounts the source at `/app`,
and keeps container dependencies in a separate volume. The API URL is used by the
browser, so `http://localhost:8000` refers to the host's backend for a local browser.

To build and run a production-build preview instead:

```sh
docker build --target preview -t audiotube:preview .
docker run --rm -p 3000:3000 -e PUBLIC_API_BASE_URL=http://localhost:8000 audiotube:preview
```

The image serves a Vite preview for local verification. Deployment uses
`@sveltejs/adapter-auto`; configure an appropriate adapter for the actual hosting
environment. Infrastructure and deployment automation are not included here.

## Project layout

- `src/routes/`: main page and shared layout.
- `src/lib/components/`: player, feed, channel carousel, and search controls.
- `src/lib/services/search.ts`: backend URL and API requests.
- `src/lib/store/`: video/channel state and browser storage handling.
- `src/lib/data.ts`: default channel shortcuts and feed channel IDs.
- `src/lib/utils/youtube-api.ts`: YouTube IFrame API loader.
- `static/`: icons and favicon.

Styling uses Tailwind CSS and daisyUI, with Svelte 4 and SvelteKit 2.

## Known limitations

- The existing type check reports errors in player typings and store handling.
- Channel persistence has a storage-selection issue; do not rely on added channels
  surviving a reload.
- Failed API calls are logged rather than shown as actionable errors in the interface.
- Player seeking currently has accessibility warnings.
