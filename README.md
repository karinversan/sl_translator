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
- `/auth` Sign in/up mock
- `/pricing` Pricing plans
- `/about` About
- `/docs` Docs + FAQ

## Run

```bash
npm install
npm run dev
```

## Notes

- All interactions are mock-only (no real camera/video processing/ML pipeline).
- Exports (`SRT`, `VTT`, `TXT`) are generated client-side via Blob.
