# chess-app

Next.js app for the **chess·prep** project.
See the [project README](../README.md) at the repository root for the product pitch, architecture, niche story, and run instructions.

## Quick commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run build
npm run lint
```

## Required env vars (`chess-app/.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon JWT>
```

Then run [`supabase/schema.sql`](supabase/schema.sql) in your Supabase SQL Editor once.
