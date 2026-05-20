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
# Optional, enables natural-language coach explanations:
GEMINI_API_KEY=<server-side Gemini key>
```

Then run these SQL files in your Supabase SQL Editor:

1. [`supabase/schema.sql`](supabase/schema.sql)
2. [`supabase/migrations/0002_puzzle_attempts.sql`](supabase/migrations/0002_puzzle_attempts.sql)
3. [`supabase/migrations/0003_user_theme_stats.sql`](supabase/migrations/0003_user_theme_stats.sql)
4. [`supabase/migrations/0004_game_analyses.sql`](supabase/migrations/0004_game_analyses.sql)
5. [`supabase/migrations/0005_game_dedupe.sql`](supabase/migrations/0005_game_dedupe.sql)
