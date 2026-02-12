# SignFlow UI Demo

Next.js 14 frontend prototype for sign language subtitles workflow.

## Stack

- Next.js 14 (App Router)
- TypeScript
- TailwindCSS
- shadcn-style UI components
- Framer Motion
- lucide-react

## Pages

- `/` Landing
- `/live` Live subtitles mock
- `/upload` Upload workflow mock
- `/jobs/[id]` Job details and export
- `/history` Job history
- `/about` About
- `/docs` Docs + FAQ

## Landing UX Structure

`/` now follows a clear user path:

1. Hero (`#hero`): value proposition, 2 CTA, quick mode switch, scroll indicator
2. Mode selector (`#modes`): Realtime vs Video+Editor with benefits and direct actions
3. How it works (`#how`)
4. Key features (`#features`)
5. Demo preview (`#demo`)
6. Model & architecture (`#model`)
7. Project status, privacy, roadmap (`#status`)
8. FAQ (`#faq`)
9. Final CTA

## UX/Motion Systems

- `components/layout/site-header.tsx`
  - Fixed header with scrollspy for landing sections
  - Mobile sheet menu with larger hitboxes
  - Persistent CTA: `Launch demo`
- `components/layout/custom-cursor.tsx`
  - Desktop-only custom cursor (dot + ring)
  - Hover states for interactive targets
  - Disables automatically on touch and reduced-motion
- `components/sections/home-main.tsx`
  - Mouse scroll indicator in hero (`scroll -> #modes`)
  - Mode preselect used by primary CTA
- `components/layout/reveal.tsx`
  - Section reveal animations with reduced-motion fallback

## Theme Tokens

Main design tokens are in `styles/globals.css`:

- Color tokens (`--background`, `--foreground`, `--muted`, etc.)
- Cursor tokens (`--cursor-dot-size`, `--cursor-ring-size`, `--cursor-ring-hover-size`)
- Reusable classes (`.glass-panel`, `.section-title`, `.section-copy`, `.page-kicker`, `.page-lead`, `.page-head`, `.glass-chip`, `.skip-link`)

## Run

```bash
npm install
npm run dev
```

## Notes

- All interactions are mock-only (no real camera/video processing/ML pipeline).
- Exports (`SRT`, `VTT`, `TXT`) are generated client-side via Blob.

## Backend Bootstrap

- Detailed backend architecture plan: `docs/BACKEND_PLAN.md`
- Execution tracker: `docs/BACKEND_BACKLOG.md`
- Phase-1 backend scaffold: `backend/`
- Frontend can use backend API by setting `NEXT_PUBLIC_API_BASE_URL` (default: `http://localhost:8000/v1`)
- Backend includes baseline protections: per-endpoint rate limit, upload MIME/size validation, max request size guard.
- Start backend stack:

```bash
docker compose -f docker-compose.backend.yml up --build
```

- Run backend tests in Docker:

```bash
docker compose -f docker-compose.backend.yml run --rm api pytest tests -q
```

- Run migrations in Docker:

```bash
docker compose -f docker-compose.backend.yml run --rm api alembic upgrade head
```
