import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4175",
  ],
  { stdio: "ignore" },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4175")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let authenticated = false;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/admin/login") {
      const v = route.request().postDataJSON();
      authenticated =
        v.login === "AdminFixture" &&
        v.password === "fixture-admin-password-123456";
      return route.fulfill({
        status: authenticated ? 200 : 401,
        json: authenticated
          ? { ok: true }
          : { error: "Неверный логин или пароль администратора" },
      });
    }
    if (path === "/api/me")
      return route.fulfill({
        status: authenticated ? 200 : 401,
        json: authenticated
          ? {
              id: "admin-fixture",
              nickname: "AdminFixture",
              role: "ADMIN",
              profile: { avatar: "⚡" },
              wallet: { coins: 0, crystals: 0 },
              notifications: [],
            }
          : { error: "Войдите в аккаунт" },
      });
    if (path === "/api/admin")
      return route.fulfill({
        json: {
          users: [],
          actions: [],
          transactions: [],
          stats: { users: 1, games: 0, active: 0 },
          config: {},
          promos: [],
          events: [],
          tournaments: [],
        },
      });
    return route.fulfill({ json: {} });
  });
  await page.goto("http://127.0.0.1:4175/admin");
  await page.getByRole("heading", { name: "Вход администратора" }).waitFor();
  assert.equal(
    await page.getByRole("heading", { name: "Пульт управления" }).count(),
    0,
  );
  await page.getByLabel("Логин", { exact: true }).fill("AdminFixture");
  await page.getByLabel("Пароль", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Войти в админ-панель" }).click();
  await page.getByRole("alert").waitFor();
  await page
    .getByLabel("Пароль", { exact: true })
    .fill("fixture-admin-password-123456");
  await page.getByRole("button", { name: "Войти в админ-панель" }).click();
  await page.getByRole("heading", { name: "Пульт управления" }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Пульт управления" }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Admin browser QA passed: /admin login, wrong password, successful entry, reload, mobile layout.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
