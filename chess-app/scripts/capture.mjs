#!/usr/bin/env node
/**
 * Playwright capture script for unauthenticated routes.
 *
 * Usage:
 *   1. Make sure the app is running locally (`npm run dev`) OR set BASE_URL.
 *   2. One-time setup: `npx playwright install chromium`
 *   3. Run: `node scripts/capture.mjs`
 *
 * Output: PNGs saved to ../docs/media/ at the repo root.
 *
 * Authenticated screenshots (/coach, /history, /history/<id>) and GIFs must
 * be captured manually — Playwright can't easily fake the magic-link auth.
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "..", "docs", "media");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

/** @type {{ name: string, url: string, viewport: { width: number, height: number }, prep?: (page: import('playwright').Page) => Promise<void> }[]} */
const CAPTURES = [
  {
    name: "landing.png",
    url: "/",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "landing-mobile.png",
    url: "/",
    viewport: { width: 414, height: 896 },
  },
  {
    name: "training-clusters.png",
    url: "/training",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "training-mobile.png",
    url: "/training",
    viewport: { width: 414, height: 896 },
  },
  {
    name: "play-ai.png",
    url: "/play/ai",
    viewport: { width: 1440, height: 900 },
    // Wait for Stockfish to finish loading so the board is ready (avoids
    // capturing the "Loading Stockfish…" indicator).
    prep: async (page) => {
      await page
        .waitForSelector("text=Stockfish ready", { timeout: 15000 })
        .catch(() => {});
    },
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Saving to ${OUT_DIR}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  const browser = await chromium.launch();
  try {
    for (const cap of CAPTURES) {
      const context = await browser.newContext({
        viewport: cap.viewport,
        deviceScaleFactor: 2, // crisp screenshots on hi-DPI
        colorScheme: "light", // consistent regardless of OS preference
      });
      const page = await context.newPage();
      const target = `${BASE_URL}${cap.url}`;
      try {
        await page.goto(target, { waitUntil: "networkidle", timeout: 30000 });
        if (cap.prep) await cap.prep(page);
        // Brief settle for animations / fonts
        await page.waitForTimeout(400);
        const path = resolve(OUT_DIR, cap.name);
        await page.screenshot({ path, fullPage: false });
        console.log(`✓ ${cap.name}  ${cap.viewport.width}×${cap.viewport.height}`);
      } catch (err) {
        console.error(`✗ ${cap.name} — ${err.message}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
