# Chess — Project Status

> Single source of truth for the nFactorial Incubator "Chess" assignment.
> **This file is updated incrementally** — append to the status log and decisions log; flip checkboxes in the roadmap; never rewrite the whole file.

---

## 1. Project Overview

**Product pitch.** A modern chess web platform with a unique angle: **chess for BigTech interview prep**. Beyond standard play (local, vs AI, multiplayer) the app offers a `/training` mode where puzzles and calculation drills are framed around the same problem-decomposition skills that show up in algorithmic interviews — daily streaks, pattern packs (forks, pins, discovered attacks), and post-game AI coaching. Monetizable via a Pro tier (unlimited AI coach analyses, advanced training packs, custom piece skins).

**Assignment source.** [`material/Chess.pdf`](material/Chess.pdf)

**Deadline.** **2026-05-20**

**Submission form.** https://nfactorialschool.typeform.com/to/HYVeKeEx

**Required deliverables.**
- [x] Live working link (Vercel) — https://chess-bigtech-prep-ft50dlmbr-almacho04s-projects.vercel.app
- [x] Public GitHub repository — https://github.com/almacho04/chess-bigtech-prep
- [ ] `README.md` describing what was built, for whom, and why it is valuable

---

## 2. Current Status

*Most recent first. Append a new dated bullet whenever work meaningfully advances or pivots. 1–3 lines per entry.*

- `2026-05-19` — **Tier 3a shipped — Stockfish AI opponent + landing page.** Stockfish 10 (WASM, ~640 KB) vendored at [`chess-app/public/engines/`](chess-app/public/engines/); browser loads it via Web Worker. Engine wrapper [`src/lib/chess/engine.ts`](chess-app/src/lib/chess/engine.ts) speaks UCI with a promise API. 4 difficulties (Skill Level 0/8/15/20 × depth 5/10/14/18). New routes: `/` is a landing page with niche pitch, `/play/local` is the existing 2-player, `/play/ai` plays vs Stockfish with side selection, live difficulty changes, and 2-ply undo. Shared site header at [`src/components/site/header.tsx`](chess-app/src/components/site/header.tsx). Persists at `chess.ai-game.v1`. `npm run build` + `npm run lint` clean. **Next:** dark/light toggle, then promotion picker.
- `2026-05-19` — **Vercel production URL confirmed public 200:** https://chess-bigtech-prep.vercel.app  (after fixing Root Directory = `chess-app`). Preview URLs still 401 (Vercel Auth on previews — fine for submission).
- `2026-05-19` — **Tier 2 (Medium) shipped.** Playable local two-player game: full rules via chess.js, drag-and-drop **and** click-to-move with legal-target highlights, undo/redo, board flip, move history in SAN, status banner (turn / check / mate / stalemate / draw cause), localStorage persistence (`chess.local-game.v1`).
- `2026-05-19` — **Pushed to GitHub:** https://github.com/almacho04/chess-bigtech-prep (public, `main`). Vercel imported: https://chess-bigtech-prep-ft50dlmbr-almacho04s-projects.vercel.app
- `2026-05-19` — **Scaffolded Next.js 16 + React 19 + TS + Tailwind v4** in `chess-app/`. Installed `chess.js`, `react-chessboard`, `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `zustand`. Git initialized at the project root (repo contains `material/`, `PROJECT_STATUS.md`, and `chess-app/`).
- `2026-05-19` — Master tracking document created. Stack (Next.js + TS + Supabase) and niche ("BigTech interview prep") decided. No code yet.

---

## 3. Tech Stack & Rationale

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router) + **TypeScript** | SSR + edge deploys; best AI-tool support; one-click Vercel deploy |
| Styling | **Tailwind CSS** + **shadcn/ui** | Fast iteration, accessible primitives, consistent design tokens |
| Chess rules engine | **`chess.js`** | Battle-tested move generation, FEN/PGN, check/mate detection |
| Board UI | **`react-chessboard`** | Drag/drop, custom pieces, mobile-friendly |
| AI opponent | **`stockfish.js`** (WASM, in-browser) | Zero server cost; selectable strength via depth |
| Auth + DB | **Supabase** (Postgres + Auth + Realtime + RLS) | One service covers auth, DB, and multiplayer |
| Multiplayer transport | **Supabase Realtime** channels | No custom WebSocket server to operate |
| AI Coach | **Anthropic Claude API** + Stockfish eval | Natural-language commentary on blunders |
| Payments | **Stripe Checkout** | Pro tier + cosmetic skins |
| Hosting | **Vercel** | Zero-config Next.js + preview deploys per PR |
| Observability | **Vercel Analytics** + **Sentry** | Minimal setup, sufficient for an MVP |

### Alternatives considered (and rejected for this timeline)
- **Convex** instead of Supabase — better real-time ergonomics, but less mature ecosystem and Supabase covers more in one service.
- **SvelteKit** — cleaner code, smaller bundles, weaker AI-tooling support.
- **Phoenix LiveView** — best-in-class real-time, but learning/setup cost is too high for <24h with no existing scaffolding.
- **Rust (Leptos / Yew)** — maximally creative; shipping speed unacceptable for this deadline.

---

## 4. Roadmap by Tier

> Flip checkboxes as features ship. The Tier checklists below will be lifted nearly verbatim into the README at submission.

### Tier 1 — Weak  *(subsumed by Medium; no separate phase)*
- [x] 8×8 board renders with starting position
- [x] Pieces drag-and-droppable (no rule check)

### Tier 2 — Medium  ✅ shipped 2026-05-19
- [x] `chess.js` integrated; only legal moves allowed
- [x] Castling, en passant, promotion (auto-queen for now), check / mate / stalemate / draw detection
- [x] Local 2-player on one screen
- [x] Game state persisted to `localStorage` (resume in-progress game on reload)
- [x] Move history panel in algebraic notation
- [x] Undo / redo on local games
- [x] Click-to-move with legal-target highlighting (in addition to drag-and-drop)
- [x] Board flip control

### Tier 3 — Strong  (in progress)
- [x] **Stockfish (WASM) AI opponent**, selectable difficulty (Easy / Medium / Hard / Master) via UCI Skill Level + depth
- [x] **Landing page** `/` with niche pitch + dual CTAs (`/play/ai`, `/play/local`)
- [ ] Supabase Auth (email magic-link + Google OAuth)
- [ ] `games` table in Postgres with Row-Level Security (user can only read/write their own games)
- [ ] Game history page (list + replay viewer)
- [ ] Dark / light theme toggle (system-aware + manual override, persisted)
- [x] Mobile-first responsive — playable on a phone in portrait (board + panel stack)
- [ ] Profile page (display name, ELO, city)
- [ ] Promotion piece picker (currently auto-queens)

### Tier 4 — Great  *(the "wow")*
- [ ] **Multiplayer** via shareable link (Supabase Realtime channel keyed by game ID)
- [ ] **Post-game AI Coach:** Stockfish flags moves with eval drop > N centipawns → Claude API generates plain-language coaching for each
- [ ] **BigTech interview prep angle:** `/training` mode with curated puzzle packs themed around interview-style tactics; daily puzzle streak
- [ ] City-based leaderboard (user profile stores city; weekly board by city + ELO)
- [ ] **Stripe Checkout → Pro tier:** unlimited AI Coach analyses, custom piece skins, advanced training packs
- [ ] README with screenshots/GIFs, niche pitch, monetization story

---

## 5. Unique Product Angle — "Chess for BigTech Interview Prep"

*Lift this into the README near submission.*

- **Why this niche.** Ambitious eng/CS students already grind LeetCode. Chess pattern recognition and calculation under time pressure mirror the same decomposition skills interviewers probe — making chess a complementary, less-saturated training surface for the same audience.
- **Hero features.**
  - Daily puzzle + streak (habit loop).
  - "Calculation drills" — mate-in-N positions timed under interview-style constraints.
  - Pattern packs (forks / pins / discovered attacks) framed as interview-style tactics.
  - Pro **AI Coach review** of training mistakes — not just chess, but a coach that explains the *reasoning pattern* that failed.
- **Why it can become a product.**
  - Clear paying ICP: CS students and new grads prepping FAANG/BigTech.
  - Low-CAC channels: university CS clubs, LeetCode communities, BigTech-prep Discords.
  - High LTV: monthly subscription matches LeetCode Premium's price point.

---

## 6. Web Software Best Practices We Apply

*Doubles as a self-review checklist before submission.*

- **Type-safe end-to-end** — TypeScript strict mode; Zod at every parsing boundary; generate Supabase types via CLI (`supabase gen types`).
- **Pure game logic** — chess rules in pure functions, separated from React components; unit-testable without a DOM.
- **Single source of truth** — one Zustand (or `useReducer`) store per game; UI subscribes, never duplicates state.
- **Optimistic UI** — moves render immediately, server reconciliation in background; rollback on conflict.
- **Authoritative server for multiplayer** — never trust the client; validate moves via Supabase RPC / Postgres function.
- **Row-Level Security on every Supabase table** — default-deny, explicit policies, tested.
- **Mobile-first responsive** — design at 360px width first; touch targets ≥ 44px.
- **Accessibility** — keyboard navigation on the board, ARIA labels for squares, color-blind-safe board theme.
- **Performance** — lazy-load Stockfish WASM; code-split routes; image-optimize piece sprites; cache static assets.
- **Error boundaries + loading skeletons** — no white screen of death; graceful degradation if Stockfish fails to load.
- **Testing** — Vitest for rules & helpers; one Playwright smoke test: "open app → play a full game vs AI → game saves."
- **CI/CD** — GitHub Actions on push: typecheck + lint + tests; Vercel preview deploys per PR.
- **Observability** — Sentry for runtime errors; Vercel Analytics for traffic; structured `console.error` with context.
- **Secrets hygiene** — `.env.local` gitignored from commit #1; only public keys in `NEXT_PUBLIC_*`.
- **Git hygiene** — atomic commits, conventional-commit prefixes (`feat:`, `fix:`, `chore:`); no force-push to main.
- **README quality** (graded directly) — product pitch, screenshots/GIFs, niche explanation, run instructions, deploy link, tech stack, "what's next."

---

## 7. Architecture Notes

*Starts as a sketch; grows as the system is built. Add a bullet when introducing a non-obvious module.*

### Routes (initial sketch)
- `/` — landing + product pitch
- `/play/local` — two-player on one device
- `/play/ai` — vs Stockfish
- `/play/[gameId]` — multiplayer via shareable link
- `/training` — puzzles & calculation drills (BigTech prep angle lives here)
- `/leaderboard` — city + global
- `/profile` — settings, history, ELO
- `/pricing` — Pro tier

### Modules (initial sketch)
- `lib/chess/` — pure rules / eval helpers, no React imports
- `lib/supabase/` — server-side + client-side factories, typed
- `lib/stockfish/` — Web Worker wrapper, lazy-loaded
- `lib/coach/` — Stockfish-eval-driven blunder detection + Claude API client (server-only)
- `components/board/` — board, pieces, animations
- `components/coach/` — post-game review UI
- `components/ui/` — shadcn primitives

---

## 8. Decisions Log

*Append-only. Every reversal or non-obvious technical choice gets one line.*

- `2026-05-19` — **Stack: Next.js + TS + Supabase** over Convex / SvelteKit / Phoenix. Reason: best AI-tooling support + fastest path to Strong+Great within ~20h.
- `2026-05-19` — **Niche: BigTech interview prep** over stakes / AI-coach-hero / city-social. Reason: clearest ICP and monetization story for the README pitch.
- `2026-05-19` — **Skip Tier 1 as a separate phase.** Reason: rendering an inert board adds zero value; Tier 2 produces a real playable game in nearly the same time.

---

## 9. Risks & Open Questions

- **Time risk.** Tier 4 (multiplayer + AI Coach + training + Stripe) is a lot in <24h. Pre-decide cut order if we slip: **drop Stripe last → cut city leaderboard → cut multiplayer**. Keep AI Coach and `/training` (they are the differentiators).
- **Stockfish WASM size** (~1MB). Must be lazy-loaded; risk degraded mobile UX on first interaction.
- **Anthropic API key safety.** Never ship to the browser; proxy through a Next.js route handler with rate limiting.
- **Stripe live mode** requires business verification — out of reach in 24h. **Demo with Stripe test mode** and document the limitation in the README.
- **Open:** puzzle dataset for `/training`. Leading candidate: **Lichess puzzle database (CC0)**.
- **Open:** ELO computation — full Glicko-2 or simplified ELO for the MVP?
