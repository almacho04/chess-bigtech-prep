# chess·prep — Personal AI chess tutor

> An AI chess tutor that remembers your puzzle results, finds weak spots, and turns them into personalized training missions.

**🟢 Live:** **https://chess-bigtech-prep.vercel.app**
**📦 Repo:** https://github.com/almacho04/chess-bigtech-prep
**🏫 Assignment:** [nFactorial Incubator — Chess](material/Chess.pdf)

---

## What this is

A chess web app where the marketing pitch isn't *"play chess online"* — it's *"train with a tutor that understands your actual mistakes."* The BigTech-prep angle still shapes the tone: pattern recognition, calculation under pressure, and short focused drills.

- **`/coach`** — personal tutor dashboard with level, XP, strongest themes, weakest themes, and today's mission.
- **`/training`** — daily mate-in-1 puzzle + a curated pack of tactical patterns, framed as "find the move that ends the game **now**, not three moves from now." Same problem-decomposition skill as a hard LeetCode under a 25-minute timer.
- **`/play/ai`** — full-strength **Stockfish** opponent with 4 difficulty levels (Skill 0 → 20), runs entirely in your browser via Web Worker.
- **`/play/local`** — pass-and-play two-player on one device, full rules.
- **`/history`** — every game you finish (signed in) is auto-saved with PGN + result; replay any one move-by-move with keyboard nav.

## Who it's for

- CS students and new grads prepping for BigTech / FAANG interviews
- People who already grind LeetCode and want a complementary surface for the same skill
- Anyone who wants a modern, clean, no-nonsense chess UI

## Try it in 30 seconds

1. Open **https://chess-bigtech-prep.vercel.app**
2. Click **"Start training"** — solve a few puzzles. Drag a piece, or click-then-click.
3. Sign in with an email magic link, then open **"AI tutor"** to see your weak/strong spots.
4. Try **"Play vs AI"** at *Medium* — Stockfish responds in 1–2 s. Switch theme top-right.

---

## Feature checklist

### Shipped
- [x] Full chess rules — castling, en passant, promotion (with **piece picker modal**), check / mate / stalemate / draw detection (`chess.js`)
- [x] **Stockfish AI** opponent at 4 difficulties, runs in a Web Worker (no server cost, no API key)
- [x] **`/training` mode** — daily puzzle + mate-in-1 pack, interactive solver with hints
- [x] **Personal tutor profile** at `/coach` — theme strengths, weak spots, XP, level, and daily mission
- [x] **Persistent theme stats** — puzzle results update `user_theme_stats` so training can adapt
- [x] **Magic-link auth** via Supabase (email)
- [x] **Game history** with per-game **replay viewer** — step buttons, keyboard nav (←/→/Home/End), click-to-jump on the move list
- [x] **Auto-save** completed games (PGN + result + move count) to Postgres with row-level security
- [x] **Visual post-game AI Coach** — Stockfish flags mistakes, shows red/green arrows for played/better moves, and adds optional Gemini explanations when `GEMINI_API_KEY` is configured
- [x] **Dark / light theme** with a no-FOUC boot script, system / light / dark cycle, persisted
- [x] **Mobile-first responsive** — playable on a phone in portrait
- [x] **localStorage** persistence on every play surface — close the tab, come back, resume

### On the roadmap
- [ ] **Deeper game-to-weakness classification** — convert real-game blunders into tags like fork, hanging piece, opening, endgame
- [ ] **Multiplayer** via shareable link (Supabase Realtime channel)
- [ ] **Pro tier (Stripe)** — unlimited AI Coach analyses, custom piece skins, advanced puzzle packs
- [ ] **City-based leaderboards** ("Top players from Almaty")
- [ ] More puzzle packs — mate-in-2, forks/pins/discoveries framed as interview-style tactics
- [ ] **ELO** per user with per-game updates

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) + **TypeScript** strict |
| Styling | **Tailwind CSS v4** + `data-theme`-driven dark variant |
| Chess rules | **`chess.js` v1** (pure helpers in [`lib/chess/game.ts`](chess-app/src/lib/chess/game.ts)) |
| Board UI | **`react-chessboard` v5** |
| AI opponent | **Stockfish 10** (WASM, vendored at [`public/engines/`](chess-app/public/engines)) |
| Auth + DB | **Supabase** — Postgres + Auth + Realtime + RLS, via `@supabase/ssr` |
| Hosting | **Vercel** (preview deploys per PR) |
| Persistence | `localStorage` (in-progress games) + Postgres (completed games) |

---

## Architecture at a glance

```
chess-app/
├── public/engines/          ← Stockfish WASM (vendored)
├── src/
│   ├── app/                 ← App-Router routes
│   │   ├── page.tsx                 (landing)
│   │   ├── coach/page.tsx           (personal tutor profile)
│   │   ├── training/page.tsx        (the niche)
│   │   ├── play/{local,ai}/page.tsx
│   │   ├── history/page.tsx + [gameId]/page.tsx
│   │   └── auth/callback/route.ts
│   ├── components/
│   │   ├── chess/           (board, game shells, promotion picker, replay)
│   │   ├── training/        (puzzle solver + training shell)
│   │   └── site/            (header, theme toggle, auth button)
│   ├── lib/
│   │   ├── chess/           (pure rules, engine wrapper, difficulty)
│   │   ├── supabase/        (browser + server clients, games helpers)
│   │   ├── theme/           (FOUC-prevention boot script + helpers)
│   │   ├── storage/         (localStorage persistence)
│   │   └── training/        (puzzles, daily picker)
│   └── middleware.ts        (Supabase session refresh)
└── supabase/                (schema + migrations with RLS)
```

**Boundaries we keep clean:**
- Chess rules live in **pure functions** with no React imports. Easy to unit-test.
- Each game shell (`GameShell`, `AiGameShell`) is the **single client boundary**; presentational children render on the server when possible.
- Stockfish runs in a **Web Worker** with a tiny promise-based UCI wrapper.
- Supabase is gated by **Row-Level Security** — every policy is `auth.uid() = user_id`. The anon key in the browser can't escape its row scope.

---

## Run it locally

```bash
git clone https://github.com/almacho04/chess-bigtech-prep.git
cd chess-bigtech-prep/chess-app
npm install

# Create chess-app/.env.local with:
#   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
# Then run these SQL files in your Supabase SQL Editor:
#   chess-app/supabase/schema.sql
#   chess-app/supabase/migrations/0002_puzzle_attempts.sql
#   chess-app/supabase/migrations/0003_user_theme_stats.sql

npm run dev          # → http://localhost:3000
npm run build        # production build
npm run lint         # ESLint
```

The auto-save / history features require a Supabase project. Local play (`/play/local`, `/play/ai`, `/training`) works without one — moves persist in `localStorage`.

---

## The niche story

Most chess sites compete on volume: millions of players, a giant rating ladder, a thousand puzzles. That market is saturated and the leaders (chess.com, lichess) win on network effects.

A wedge into this market is a **vertical audience with money and a non-chess primary need**:

> **CS students and new grads prepping FAANG interviews.**
> Same audience as LeetCode Premium. Same skill (calculation under time pressure). Adjacent surface (chess) is *under-served* by interview-prep angle.

The product loop:
1. **Daily puzzle** → habit, returns user every day (LeetCode "daily question" pattern)
2. **Pattern packs** framed as interview-style tactics — forks, pins, calculation under constraints
3. **Pro tier** ($7/mo, matches LeetCode Premium price point):
   - Unlimited **AI Coach** analyses of your training mistakes
   - Advanced packs (mate-in-3, endgame technique)
   - Custom piece skins

Low CAC channel: university CS clubs, BigTech-prep Discords, LeetCode Reddit. The "chess for interview prep" framing is a Trojan horse to bring people into chess from an adjacent market they're already paying for.

---

## What I'd build next (if this were the day job)

- **Game-to-profile AI Coach** — turn Stockfish blunders into persistent weak-spot tags, not just one-off game review.
- **Multiplayer** — Supabase Realtime channel per game ID, share-by-link. No matchmaking, no chat — pure share-link play.
- **Puzzle ingestion from Lichess** — the CC0 puzzle DB has 6M+ tagged positions. Curate themed packs from it.
- **Spaced-repetition for puzzles you got wrong** — same loop as Anki. Pulls users back daily.
- **Stripe** — Pro tier paywall on AI Coach + advanced packs.

---

## Acknowledgments

- Built for the **nFactorial Incubator** assignment ([brief](material/Chess.pdf)).
- Stockfish 10 — © T. Romstad, M. Costalba, J. Kiiski, G. Linscott, et al. (GPL-3).
- Built with [Claude Code](https://claude.com/claude-code) as a pair-programming partner.
