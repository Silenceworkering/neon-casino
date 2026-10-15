import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const preview = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4174",
  ],
  { stdio: "ignore" },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4174")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let meCalls = 0,
    pollStarted = false,
    manualStarted = false,
    releasePoll;
  const fixture = {
    id: "test-user",
    nickname: "InteractionTest",
    role: "USER",
    profile: { avatar: "⚡", xp: 0, bio: "", prestige: 0 },
    wallet: { coins: 10000, crystals: 0 },
    inventory: [],
    achievements: [],
    notifications: [],
    stats: { played: 0, payout: 0 },
    level: 1,
  };
  const round = {
    id: "test-round",
    game: "crash",
    bet: 100,
    status: "ACTIVE",
    state: { startAt: Date.now(), auto: 100 },
    commitment: "test",
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/me") {
      if (++meCalls > 1) await new Promise((r) => setTimeout(r, 1500));
      return route.fulfill({ json: fixture });
    }
    if (path === "/api/games/active") return route.fulfill({ json: [] });
    if (path === "/api/games/start") return route.fulfill({ json: round });
    if (path.endsWith("/action")) {
      const { action } = route.request().postDataJSON();
      if (action.type === "check") {
        pollStarted = true;
        await new Promise((r) => (releasePoll = r));
        return route.fulfill({ json: round });
      }
      if (action.type === "cashout") {
        manualStarted = true;
        await new Promise((r) => setTimeout(r, 350));
        return route.fulfill({
          json: {
            ...round,
            status: "DONE",
            state: { ...round.state, crash: 4 },
            result: { payout: 150 },
          },
        });
      }
    }
    return route.fulfill({ json: {} });
  });
  await page.goto("http://127.0.0.1:4174");
  await page.locator(".balance").waitFor();
  await page.locator(".mobile-nav button").filter({ hasText: "Игры" }).click();
  await page.locator(".card-crash").click();
  await page.locator(".play-button").click();
  // A slow wallet request must not delay accepting/displaying the round.
  await page.locator(".crash-cashout").waitFor({ timeout: 900 });
  const deadline = Date.now() + 6000;
  while (!pollStarted && Date.now() < deadline) await page.waitForTimeout(50);
  assert.ok(pollStarted, "Crash poll did not start");
  const button = page.locator(".crash-cashout");
  assert.equal(await button.isEnabled(), true, "Polling disabled cashout");
  await button.click();
  await page.waitForTimeout(70);
  assert.equal(manualStarted, true, "Cashout waited for background poll");
  assert.equal(
    await button.evaluate((el) => getComputedStyle(el).opacity),
    "1",
    "Cashout became transparent",
  );
  await page.locator(".result-banner").waitFor({ timeout: 900 });
  releasePoll();
  await page.waitForTimeout(150);
  assert.equal(
    await page.locator(".result-banner").count(),
    1,
    "Stale poll replaced final result",
  );
  assert.equal(await page.locator(".crash-cashout").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "Interaction QA passed: slow wallet does not block round, cashout works during pending poll, opacity stays 1, stale responses cannot reopen the round.",
  );
} finally {
  await browser?.close();
  preview.kill("SIGTERM");
}
