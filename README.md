# Crowd Management System

A Next.js dashboard for viewing site occupancy, footfall, dwell time, demographics, crowd entries, and real-time alerts.

## Getting started

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set `NEXT_PUBLIC_API_BASE` in `.env.local` to use a different backend. If it is not set, the application uses `https://hiring-dev.internal.kloudspot.com`.

Other useful commands:

```bash
npm run lint
npm run build
npm start
```

## High-level design

- `app/login/page.tsx` authenticates the user and stores the returned access token in browser local storage.
- `components/AuthGuard.tsx` protects the application pages and redirects unauthenticated users to login.
- `components/Shell.tsx` loads available sites, provides the site selector and navigation, and shares the selected site ID with page components.
- `app/(app)/dashboard/page.tsx` loads the dashboard analytics and subscribes to real-time occupancy and alert events.
- `app/(app)/entries/page.tsx` loads and paginates entry/exit records for the current site.
- `lib/api.ts` contains the HTTP client, token/site storage helpers, API functions, and response formatting utilities. Requests include the bearer token when available. A `401` response clears the session and redirects to login.
- `lib/socket.ts` creates and closes the Socket.IO connection used by the dashboard.
- Numeric values shown in the UI are rounded to at most two decimal places.

## HTTP API

The HTTP base URL is `NEXT_PUBLIC_API_BASE` (or the default backend URL above). The client sends the saved token as a bearer authorization header when one is available.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Sign in with `{ "email": "...", "password": "..." }`. The client accepts a token in `token`, `accessToken`, or `access_token` (also under `data`). |
| `GET` | `/api/sites` | Load the sites available to the signed-in user. |
| `POST` | `/api/analytics/dwell` | Get average dwell-time analytics for a time range. |
| `POST` | `/api/analytics/footfall` | Get footfall analytics for a time range. |
| `POST` | `/api/analytics/occupancy` | Get occupancy time-series analytics for a time range. |
| `POST` | `/api/analytics/demographics` | Get demographic time-series analytics for a time range. |
| `POST` | `/api/analytics/entry-exit` | Get paginated crowd entry/exit records. |

Analytics requests include `siteId`, `fromUtc`, and `toUtc` in the JSON body. Time-range values are Unix timestamps in milliseconds. Entry/exit requests also include `page`, `size`, `pageNumber`, and `pageSize` (page numbering starts at 1).

The dashboard requests today's and yesterday's dwell and footfall, and today's occupancy and demographics. The entries page requests today's records for the current page.

## Real-time Socket.IO

The dashboard opens a Socket.IO client connection to the same backend base URL. It requests WebSocket transport first and permits polling as a fallback. The saved `token` and selected `siteId` are provided in both the Socket.IO `auth` object and connection query parameters. The connection is closed when the dashboard unmounts, when the selected site changes, and on logout.

The dashboard listens for:

| Event | Client behavior |
| --- | --- |
| `live_occupancy` or `live occupancy` | Update the live occupancy card and append a point to the occupancy timeline. The client reads the value from `occupancy`, `count`, `liveOccupancy`, or `total` in the payload. |
| `alert` | Add the event to the live alerts list. The UI reads action/type, zone/zoneName, site/siteName, and severity fields when present. |

These are inbound events consumed by the client; event payload fields are read defensively because the server may return different supported aliases.

## Routes

- `/login` — sign-in page.
- `/dashboard` — overview analytics and real-time events.
- `/entries` — paginated entry/exit records.
