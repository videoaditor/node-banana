---
description: After making changes to API routes or backend providers, restart the dev server
---

# After API Route / Backend Provider Changes

When modifying files under `src/app/api/` (especially `route.ts`, `providers/*.ts`, or `schemaUtils.ts`), the Next.js dev server may serve stale cached code.

## Steps

1. After committing changes, kill any running dev server:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
```

2. Clear the Next.js cache:
```bash
rm -rf .next/cache
```

// turbo
3. Restart the dev server:
```bash
cd /Users/alansimon/node-banana && npm run dev
```

4. Wait for `> Ready on http://localhost:3000` before testing.

## When This Applies

- Any change to `src/app/api/generate/route.ts`
- Any change to `src/app/api/generate/providers/*.ts` (gemini, fal, replicate, kie, wavespeed)
- Any change to `src/app/api/generate/schemaUtils.ts`
- Any change to `src/app/api/models/` routes
- Changes to `server.js` or `next.config.ts`

## Why

Next.js caches compiled API route handlers in `.next/`. During long dev sessions (hours), hot reload for API routes can silently fail, causing the server to keep serving old code. A full restart guarantees the latest code runs.
