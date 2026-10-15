import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.QA_URL ?? "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const errors = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("artifacts", { recursive: true });
await page.goto(base);
await page.locator(".hero h1").waitFor();
await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
for (const width of [320, 375, 390, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `Horizontal overflow at ${width}`,
  );
}
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
await page
  .getByRole("button", { name: "Создать аккаунт", exact: true })
  .first()
  .click();
const nickname = "Browser_" + Date.now().toString(36);
await page.locator("input[autocomplete=username]").fill(nickname);
await page.locator("input[type=password]").fill("browser-test-password-123");
await page.locator("form .primary").click();
await page.getByRole("heading", { name: "Сохраните ключ доступа" }).waitFor();
await page.getByRole("button", { name: "Я сохранил код" }).click();
await page.locator(".balance b").waitFor();
assert.equal(
  (await page.locator(".balance b").innerText()).replaceAll(/\s/g, ""),
  "10000",
);
await page.locator(".mobile-nav button").filter({ hasText: "Игры" }).click();
await page.getByRole("heading", { name: "Игровая вселенная" }).waitFor();
await page.locator(".card-coinflip").click();
await page.locator(".play-button").click();
await page.locator(".result-banner").waitFor();
await page.screenshot({ path: "artifacts/game-mobile.png", fullPage: true });
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  "Game overflow",
);
await page.locator(".mobile-nav button").filter({ hasText: "Профиль" }).click();
await page.getByRole("heading", { name: "Профиль игрока" }).waitFor();
await page.getByRole("button", { name: "Настроить", exact: true }).click();
await page.getByText("Качество эффектов").locator("select").selectOption("off");
await page
  .getByRole("button", { name: "Сохранить настройки", exact: true })
  .click();
await page.getByRole("status").waitFor();
await page.locator(".mobile-nav button").filter({ hasText: "Бонусы" }).click();
await page.getByRole("button", { name: "Забрать бесплатно" }).first().click();
await page.getByRole("button", { name: "Получено", exact: true }).waitFor();
await page.reload();
await page.locator(".balance b").waitFor();
assert.ok(
  Number(
    (await page.locator(".balance b").innerText()).replaceAll(/\s/g, ""),
  ) >= 10900,
  "Balance not persisted",
);
await page.setViewportSize({ width: 1440, height: 1000 });
for (const label of [
  "Все игры",
  "Бонусы",
  "Играть с друзьями",
  "Турниры",
  "Рейтинги",
  "Магазин",
  "Друзья",
  "История игр",
]) {
  await page
    .locator(".sidebar nav button")
    .filter({ hasText: label })
    .first()
    .click();
  await page.waitForTimeout(200);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    label + " overflow",
  );
}
assert.deepEqual(errors, []);
console.log(
  "Browser QA passed: desktop, 320–1440px, registration, game, profile settings, bonus and reload persistence.",
);
await browser.close();
