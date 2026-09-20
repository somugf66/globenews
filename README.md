# GlobeNews Live

A Google-News-style 3D globe news reader. Click any country on the globe to load its latest news, search across all countries, filter by time frame and category, and watch a LIVE ticker of stories published in the last 2 minutes.

Built with an **Express** backend (Google News RSS proxy -> JSON, no API key required) and a **three.js / globe.gl** frontend (cosmic or macOS liquid-glass themes, flying camera, per-country local-news ranking with LOCAL badges).

## Features

- 3D interactive globe (world-atlas 110m countries) with click-to-fly, search-to-zoom, and a "Solar view" button
- Live news ticker (stories from the last 2 minutes, refreshes every ~20 s)
- Time-frame filter (24h / 2d / 7d) and category filter (politics, business, technology, sports, science, health, entertainment)
- Local-first result ranking per country with LOCAL badge on national outlets
- Settings: theme, 3D quality, stars/orbits/labels/moon/sun-glow toggles, refresh rate, auto-rotate, system speed
- No register page, no telemetry, serves on `127.0.0.1` only (dev) or via container on `5556`

## Run it

### Deploy from image (fastest — recommended on another machine)

```bash
docker pull ghcr.io/somugf66/globenews:latest
docker run -d --name globenews -p 5556:5556 ghcr.io/somugf66/globenews
# open http://localhost:5556
```

Updating an existing container:

```bash
docker pull ghcr.io/somugf66/globenews:latest
docker stop globenews && docker rm globenews
docker run -d --name globenews -p 5556:5556 ghcr.io/somugf66/globenews
```

### Docker (build from source)

```bash
docker build -t globenews .
docker run -d --name globenews -p 5556:5556 globenews
# open http://localhost:5556
```

### From source

```bash
npm install
GLOBENEWS_NO_OPEN=1 npm start   # or just: npm start (auto-opens the browser)
# server listens on http://localhost:9000
```

## API

- `GET /api/geojson` - country polygons + centroids for the globe
- `GET /api/news?country=NG&q=kw&tf=24&section=technology` - news items (60 max)
- `GET /api/live` - buffer of the freshest stories (polls upstream every ~20 s)

## Notes

- Data source: Google News RSS (cached ~3 min server-side; the RSS feed refreshes on its own schedule, the ticker falls back to the freshest buffer until then).
- Dev server binds `127.0.0.1`; the Docker image binds `0.0.0.0` inside the container for port mapping.

## License

ISC